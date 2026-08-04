import path from 'node:path';
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

const MAX_BUFFER = 16 * 1024 * 1024;
const PER_FILE_LINE_CAP = 500;
const TOTAL_BYTE_CAP = 50_000;

const DIFF_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/;
const BINARY_MARKER_RE = /^Binary files .* differ$/m;

type GitRun = { stdout: string; ok: boolean };

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
    };
    execFile('git', args, opts, (err, stdout) => {
      const stdoutStr = typeof stdout === 'string' ? stdout : stdout?.toString() ?? '';
      resolve({ stdout: stdoutStr, ok: !err });
    });
  });
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

export async function computeTaskDiff(
  /**
   * The workspace under review (R4 AC 1): git's working directory, and the
   * containment base every pathspec is asserted against.
   */
  workspacePath: string,
  allFiles: string[],
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

  const diffArgs = ['diff', '-U10', '-M', 'HEAD', '--', ...kept];
  const numstatArgs = ['diff', '--numstat', '-M', 'HEAD', '--', ...kept];

  const [diffRun, numstatRun] = await Promise.all([
    runGit(workspacePath, diffArgs),
    runGit(workspacePath, numstatArgs),
  ]);

  if (!diffRun.ok || !numstatRun.ok) {
    return { diff: '', stats: undefined, skippedPaths: skipped, truncated: false };
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
