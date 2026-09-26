import path from 'node:path';
import { readFileSync } from 'node:fs';
import { execFile, ExecFileOptions } from 'node:child_process';
import { partitionPaths } from './path-denylist.js';
import { scrubbedGitEnv } from './git-utils.js';
import { safeRealpath } from './file-resolution.js';
import { PathUtils } from './path-utils.js';

export type TaskDiffResult = {
  diff: string;
  stats: { filesChanged: number; linesAdded: number; linesRemoved: number } | undefined;
  skippedPaths: string[];
  truncated: boolean;
  rejection?: { message: string };
};

/** Which end of the change the gate selects (design Component 5). */
export type RangeSelector = { commit: string } | { baseRef: string };

export type RangeStatsResult =
  | {
      ok: true;
      stats: { filesChanged: number; linesAdded: number; linesRemoved: number };
      touched: string[];
      /** Changed lines (added + removed) per touched path, for per-path line rules. */
      perFile: Record<string, number>;
      /** The untracked (non-ignored) subset of `touched`, empty in commit mode (retro P5). */
      untracked: string[];
    }
  | { ok: false; message: string };

const MAX_BUFFER = 16 * 1024 * 1024;
const PER_FILE_LINE_CAP = 500;
const TOTAL_BYTE_CAP = 50_000;

const DIFF_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/;
const BINARY_MARKER_RE = /^Binary files .* differ$/m;
const HEAD_SHA_RE = /^[0-9a-f]{40}$/;

type GitRun = { stdout: string; ok: boolean; cause?: string };

/** How long any single git invocation may run before it is killed (R2-1). */
const GIT_TIMEOUT_MS = 10_000;

/**
 * The `cause` string for a failed git run (design Component 2). Node 20's
 * execFile callback sets `error.code` to a string system code (`ENOENT`,
 * `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`) or to the numeric exit code; a killed
 * (timed-out) process leaves `code` unset, so its `message` is used (7.7).
 */
function gitRunCause(err: Error & { code?: unknown }): string {
  const code = err.code;
  if (typeof code === 'string') return code;
  if (typeof code === 'number') return `exit ${code}`;
  return err.message;
}

/**
 * Runs git in `projectPath` with the four `GIT_*` location variables scrubbed
 * (requirement 2.12).
 *
 * This runs in the **parent** process, so neither runner's spawn-site scrub
 * reaches it. An inherited `GIT_DIR` pointing at another repository makes
 * `git diff --numstat -M HEAD -- <paths>` return empty stdout at exit 0, so
 * this reports `ok: true`, {@link computeTaskDiff} takes the success path with
 * no rejection, and the reviewing agent is told the changes were already
 * committed.
 */
function runGit(projectPath: string, args: string[]): Promise<GitRun> {
  return new Promise((resolve) => {
    const opts: ExecFileOptions = {
      cwd: projectPath,
      env: { ...scrubbedGitEnv(), GIT_OPTIONAL_LOCKS: '0' },
      maxBuffer: MAX_BUFFER,
      timeout: GIT_TIMEOUT_MS,
    };
    execFile('git', args, opts, (err, stdout) => {
      const stdoutStr = typeof stdout === 'string' ? stdout : stdout?.toString() ?? '';
      if (!err) {
        resolve({ stdout: stdoutStr, ok: true });
        return;
      }
      resolve({ stdout: stdoutStr, ok: false, cause: gitRunCause(err) });
    });
  });
}

/**
 * The workspace's `HEAD` commit as a 40-hex sha, or null when `HEAD` does not
 * resolve — an unborn branch or a non-repository (design Component 2). Reuses
 * the `rev-parse --verify` form at {@link computeRangeStats}.
 */
export async function readHeadCommit(workspacePath: string): Promise<string | null> {
  const run = await runGit(workspacePath, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!run.ok) return null;
  const sha = run.stdout.trim();
  return HEAD_SHA_RE.test(sha) ? sha : null;
}

/**
 * What git said about `commit` relative to the workspace's `HEAD`:
 * `ancestor` and `not-ancestor` are git's answer; `unknown` means git gave no
 * answer (it could not be spawned, the workspace path is gone, it timed out or
 * overflowed the buffer), so the base is unvalidated rather than rejected.
 */
export type AncestryResult = 'ancestor' | 'not-ancestor' | 'unknown';

const GIT_EXIT_CAUSE_RE = /^exit \d+$/;

/**
 * Whether `commit` is an ancestor of the workspace's `HEAD` (requirement 1.5).
 * `rev-parse --verify` is not enough: linked worktrees share one object
 * database, so any sibling branch's commit verifies. `merge-base --is-ancestor`
 * exits 0 for an ancestor, 1 for a non-ancestor and 128 for an unknown sha;
 * both non-zero exits are git's answer and mean `not-ancestor`. A failure that
 * is not an exit code (`ENOENT`, a timeout, `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`)
 * is an infrastructure fault and reports `unknown`, so the caller can say the
 * base was not validated instead of claiming it was rejected (design R2-4).
 */
export async function isAncestorOfHead(
  workspacePath: string,
  commit: string,
): Promise<AncestryResult> {
  const run = await runGit(workspacePath, ['merge-base', '--is-ancestor', commit, 'HEAD']);
  if (run.ok) return 'ancestor';
  return run.cause !== undefined && GIT_EXIT_CAUSE_RE.test(run.cause) ? 'not-ancestor' : 'unknown';
}

/**
 * `PathUtils.validatePathWithinBases` throws a fixed message rather than
 * returning a boolean, so the question is asked here through a `try`. Same shape
 * as `file-resolution.ts`'s private `containedIn`; kept local because the two
 * differ in what they do with the answer.
 */
function containedIn(candidate: string, base: string): boolean {
  try {
    PathUtils.validatePathWithinBases(candidate, [base]);
    return true;
  } catch {
    return false;
  }
}

/** Realpath when it resolves, plain resolve when it does not (a deleted file). */
function realOrResolve(p: string): string {
  const result = safeRealpath(p);
  return result.ok ? result.path : path.resolve(p);
}

/**
 * The diff pathspecs that are NOT contained by the workspace (R4 AC 23).
 *
 * Two containment tests, accepting on either. The lexical one matches the
 * spelling `resolveLoggedFiles` emits — `path.resolve`d, deliberately *not*
 * realpath-normalized (R4 AC 17) — and the realpath one covers an entry that
 * reaches the workspace through a symlink, which the resolver accepted on its
 * realpath and would otherwise be rejected here for its spelling.
 *
 * A *relative* pathspec is resolved against the workspace, because that is what
 * git itself would do: `runGit` sets `cwd` to the workspace. Resolving it
 * against this process's cwd instead would reject every relative entry.
 */
function findOutsideWorkspace(files: string[], workspacePath: string): string[] {
  const baseReal = realOrResolve(workspacePath);
  return files.filter(entry => {
    const candidate = path.resolve(workspacePath, entry);
    if (containedIn(candidate, workspacePath)) return false;
    return !containedIn(realOrResolve(candidate), baseReal);
  });
}

/** How many offending paths the rejection message names before summarising. */
const MAX_LISTED_OUTSIDE_PATHS = 5;

/**
 * Reviewer-facing text for a containment rejection (R4 AC 24).
 *
 * STATED here, not inherited. `TaskDiffResult.rejection` now has two producers:
 * `unwrapDiff` in `review-task.ts`, whose message is a thrown exception's
 * `.message`, and this assertion. Both classify as `rejected` — which is the
 * point, since that is what makes a containment failure distinguishable from the
 * `empty` diff the mis-partition would otherwise masquerade as — but they are not
 * the same event, and the preamble that fires for either
 * (`R4_2B_DIFF_REJECTED`) says the utility "threw an unexpected exception",
 * which is false here. That constant is byte-pinned by seventeen committed
 * methodology fixtures and a cross-spec drift test, so it is not edited; instead
 * the text below names the contradiction outright, the way
 * `NO_REVIEWABLE_FILES_DISCLOSURE` names its own residual.
 *
 * That wording reaches the agent on the DIRECT-CALL path only, where it travels
 * as `data.diffRejection.message`. A dashboard-spawned reviewer never reads it:
 * `TaskReviewRunner` destructures six fields from the prepare response and none
 * carries diff data, so neither `data.diff` nor `data.diffRejection` is rendered
 * into the prompt. The rejection stays distinguishable there — the preamble
 * flips from `R4_2A_DIFF_EMPTY` to `R4_2B_DIFF_REJECTED` — but only that
 * classification arrives, not this text. AC 24 is silent on the second path
 * where AC 19 is explicit, so it is a residual, not a gap: deferral
 * `d-6e59490b`, owned by the `worktree-review-signals` spec.
 */
export function containmentRejectionMessage(
  outside: string[],
  workspacePath: string,
): string {
  const shown = outside.slice(0, MAX_LISTED_OUTSIDE_PATHS).join(', ');
  const remainder = outside.length - MAX_LISTED_OUTSIDE_PATHS;
  const more = remainder > 0 ? `, and ${remainder} more` : '';
  return (
    `DIFF CONTAINMENT ASSERTION FAILED. ${outside.length} path(s) handed to the diff are not contained by the workspace under review (${workspacePath}): ${shown}${more}. ` +
    'git was NOT invoked and no diff was computed for this task. This is not an unexpected exception and not a benign empty diff — the file set was mis-partitioned before it reached the diff, so any guidance in this review context describing a thrown exception, or explaining a missing diff as "the task changes were already committed before review", does not hold here. ' +
    'Read every file in filesToReview and evaluate it against the implementation log, and report this containment failure in your review summary so the mis-partitioned path is fixed rather than read as a clean tree.'
  );
}

/**
 * Reviewer-facing text for a git diff failure (requirement 1.10). Same
 * stated-text pattern as {@link containmentRejectionMessage}: the failure is
 * named, and the two fabrications an empty diff would otherwise leave the
 * reviewer holding — a benign empty diff, and "the changes were committed" —
 * are contradicted outright.
 */
export function gitFailureMessage(
  cause: string,
  base: string,
  workspacePath: string,
): string {
  return (
    `GIT DIFF FAILED. git diff from ${base} in ${workspacePath} did not complete: ${cause}. ` +
    'No diff was computed for this task. This is not a benign empty diff and does not show the changes were committed. ' +
    'Read every file in filesToReview, evaluate it against the implementation log, and report this failure in your review summary.'
  );
}

export async function computeTaskDiff(
  /**
   * The workspace under review (R4 AC 1): git's working directory, and the
   * containment base every pathspec is asserted against.
   */
  workspacePath: string,
  allFiles: string[],
  /**
   * The commit the diff starts from (requirement 1.6): replaces the `HEAD`
   * literal at the two argument arrays below. Required, not defaulted — every
   * caller states its base.
   */
  base: string,
): Promise<TaskDiffResult> {
  const { kept, skipped } = partitionPaths(allFiles);

  // R4 AC 23: containment is asserted BEFORE git is invoked, over every path
  // passed — denylisted ones included, since a path outside the workspace is a
  // mis-partition whether or not the denylist would have dropped it anyway.
  //
  // Asserting rather than letting git report it is deliberate. git's own
  // out-of-tree complaint is gettext-marked and translates, so classifying on
  // its stderr would let a localized git fall through to the benign `!ok` arm
  // below: empty diff, no rejection, and a reviewing agent told the changes were
  // already committed (R4 AC 24).
  const outside = findOutsideWorkspace(allFiles, workspacePath);
  if (outside.length > 0) {
    return {
      diff: '',
      stats: undefined,
      skippedPaths: skipped,
      truncated: false,
      rejection: { message: containmentRejectionMessage(outside, workspacePath) },
    };
  }

  if (kept.length === 0) {
    return { diff: '', stats: undefined, skippedPaths: skipped, truncated: false };
  }

  const diffArgs = ['diff', '-U10', '-M', base, '--', ...kept];
  const numstatArgs = ['diff', '--numstat', '-M', base, '--', ...kept];

  const [diffRun, numstatRun] = await Promise.all([
    runGit(workspacePath, diffArgs),
    runGit(workspacePath, numstatArgs),
  ]);

  // A git failure on the diff is never reported as a benign empty diff
  // (requirement 1.10): it classifies as `rejected`, naming the first failing
  // run's observed cause.
  if (!diffRun.ok || !numstatRun.ok) {
    const failing = !diffRun.ok ? diffRun : numstatRun;
    return {
      diff: '',
      stats: undefined,
      skippedPaths: skipped,
      truncated: false,
      rejection: { message: gitFailureMessage(failing.cause ?? '', base, workspacePath) },
    };
  }

  const numstat = parseNumstat(numstatRun.stdout);
  const sections = splitDiffSections(diffRun.stdout);

  let truncated = false;
  const nonBinarySections: { filePath: string; body: string }[] = [];
  for (const sec of sections) {
    if (BINARY_MARKER_RE.test(sec.body)) continue;
    const stat = numstat.perFile.get(sec.filePath);
    if (stat && stat.added + stat.removed > PER_FILE_LINE_CAP) {
      nonBinarySections.push({
        filePath: sec.filePath,
        body: `<diff truncated: ${sec.filePath} per-file cap exceeded>\n`,
      });
      truncated = true;
    } else {
      nonBinarySections.push(sec);
    }
  }

  let totalBytes = 0;
  let budgetExhausted = false;
  const finalParts: string[] = [];
  for (const sec of nonBinarySections) {
    if (budgetExhausted) {
      finalParts.push(
        `<diff truncated: ${sec.filePath} total budget exhausted, file truncated despite size>\n`,
      );
      truncated = true;
      continue;
    }
    const bodyBytes = Buffer.byteLength(sec.body, 'utf-8');
    if (totalBytes + bodyBytes > TOTAL_BYTE_CAP) {
      finalParts.push(
        `<diff truncated: ${sec.filePath} total budget exhausted, file truncated despite size>\n`,
      );
      truncated = true;
      budgetExhausted = true;
    } else {
      finalParts.push(sec.body);
      totalBytes += bodyBytes;
    }
  }

  return {
    diff: finalParts.join(''),
    stats: {
      filesChanged: numstat.filesChanged,
      linesAdded: numstat.linesAdded,
      linesRemoved: numstat.linesRemoved,
    },
    skippedPaths: skipped,
    truncated,
  };
}

function splitDiffSections(diff: string): { filePath: string; body: string }[] {
  const lines = diff.split('\n');
  const sections: { filePath: string; body: string }[] = [];
  let currentPath: string | undefined;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentPath === undefined) return;
    let body = currentLines.join('\n');
    if (body.length > 0 && !body.endsWith('\n')) body += '\n';
    sections.push({ filePath: currentPath, body });
  };

  for (const line of lines) {
    const m = DIFF_HEADER_RE.exec(line);
    if (m) {
      flush();
      currentPath = m[2];
      currentLines = [line];
    } else if (currentPath !== undefined) {
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}

function parseNumstat(text: string): {
  perFile: Map<string, { added: number; removed: number }>;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
} {
  const perFile = new Map<string, { added: number; removed: number }>();
  let filesChanged = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const rawLine of text.split('\n')) {
    if (!rawLine) continue;
    const parts = rawLine.split('\t');
    if (parts.length < 3) continue;
    const [aStr, rStr, ...rest] = parts;
    const filePath = rest.join('\t');
    const added = aStr === '-' ? 0 : Number.parseInt(aStr, 10);
    const removed = rStr === '-' ? 0 : Number.parseInt(rStr, 10);
    const a = Number.isFinite(added) ? added : 0;
    const r = Number.isFinite(removed) ? removed : 0;
    perFile.set(filePath, { added: a, removed: r });
    filesChanged++;
    linesAdded += a;
    linesRemoved += r;
  }

  return { perFile, filesChanged, linesAdded, linesRemoved };
}

/** Sorted, de-duplicated copy of the paths (Component 5, one encoding — R2-1). */
function sortedUnique(paths: Iterable<string>): string[] {
  return [...new Set(paths)].sort();
}

/** Changed lines (added + removed) per path, for the per-path line rules (retro P2). */
function changedByPath(map: Map<string, { added: number; removed: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [p, s] of map) out[p] = s.added + s.removed;
  return out;
}

/**
 * Newline count of a file's bytes, or 0 when it cannot be read (D18). Gives an
 * untracked file a line count without staging it, so the index stays untouched.
 */
function countFileNewlines(filePath: string): number {
  try {
    const buf = readFileSync(filePath);
    let count = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0x0a) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Touched paths and line counts over the range the caller selects — every
 * changed file, not only the logged ones (Req 1.4, 8.3, design Component 5).
 *
 * Placed beside {@link computeTaskDiff} to reuse the file-private {@link runGit}
 * and {@link parseNumstat} (D15); `computeTaskDiff` itself is unchanged (Req 8.3).
 * `touched` is returned whole, never capped (R4-1) — the 100-path cap is the
 * caller's.
 */
export async function computeRangeStats(
  root: string,
  range: RangeSelector,
  opts: { ignoreWhitespace?: boolean } = {},
): Promise<RangeStatsResult> {
  const selector = 'commit' in range ? 'commit' : 'baseRef';
  const ref = 'commit' in range ? range.commit : range.baseRef;
  // With `--ignore-all-space` a whitespace-only edit counts zero changed lines,
  // so a caller can tell a real change from a re-indent or no-op (retro P14).
  const ws = opts.ignoreWhitespace ? ['--ignore-all-space'] : [];

  // Repo check first, with its own message (R3-1): `--show-toplevel` exits 128
  // outside a repository, so `runGit` reports `ok: false`.
  const repo = await runGit(root, ['rev-parse', '--show-toplevel']);
  if (!repo.ok) {
    return { ok: false, message: `no git repository at ${root}` };
  }

  // Resolve the selector. A genuinely bad ref is a caller error (D19); an
  // unborn `HEAD` is not — it is a clean empty range (R3-5, D12).
  const resolved = await runGit(root, ['rev-parse', '--verify', `${ref}^{commit}`]);
  if (!resolved.ok) {
    if (ref === 'HEAD') {
      return {
        ok: true,
        stats: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 },
        touched: [],
        perFile: {},
        untracked: [],
      };
    }
    return { ok: false, message: `${selector} ${ref} does not resolve in ${root}` };
  }

  if (selector === 'commit') {
    // First-parent, one commit, raw UTF-8 (R1-1, R2-1, D16). The empty `--format=`
    // leaves no sha header, so `parseNumstat`'s three-field guard never fires.
    const run = await runGit(root, [
      '-c', 'core.quotePath=false',
      'log', '--first-parent', '-1', '--numstat', ...ws, '--format=', '--no-renames', ref,
    ]);
    const numstat = parseNumstat(run.stdout);
    return {
      ok: true,
      stats: {
        filesChanged: numstat.filesChanged,
        linesAdded: numstat.linesAdded,
        linesRemoved: numstat.linesRemoved,
      },
      touched: sortedUnique(numstat.perFile.keys()),
      perFile: changedByPath(numstat.perFile),
      untracked: [],
    };
  }

  // baseRef (and the `HEAD` fallback): tracked changes since the ref, committed
  // or not, from the diff; plus untracked non-ignored files from ls-files, each
  // adding one file and its newline count (D17, D18). `root` is assumed to
  // gitignore the spec store and generated artifacts (R2-2).
  const [diffRun, othersRun] = await Promise.all([
    runGit(root, ['-c', 'core.quotePath=false', 'diff', '--numstat', ...ws, '--no-renames', ref]),
    runGit(root, ['-c', 'core.quotePath=false', 'ls-files', '--others', '--exclude-standard']),
  ]);

  const numstat = parseNumstat(diffRun.stdout);
  let { filesChanged, linesAdded, linesRemoved } = numstat;
  const perFile = changedByPath(numstat.perFile);

  const untracked = othersRun.stdout.split('\n').filter((line) => line.length > 0);
  for (const rel of untracked) {
    const added = countFileNewlines(path.join(root, rel));
    filesChanged += 1;
    linesAdded += added;
    perFile[rel] = added;
  }

  return {
    ok: true,
    stats: { filesChanged, linesAdded, linesRemoved },
    touched: sortedUnique([...numstat.perFile.keys(), ...untracked]),
    perFile,
    untracked,
  };

}
