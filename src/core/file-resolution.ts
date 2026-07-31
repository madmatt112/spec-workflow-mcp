/**
 * Resolution of implementation-log file entries against two roots.
 *
 * A review runs in a *workspace* (a checkout — possibly a linked worktree) while
 * the spec documents live under a shared *workflow root*. Logged paths therefore
 * have two plausible homes, and the rules for choosing between them differ by
 * entry shape:
 *
 * - **Relative** entries are *anchored*: workspace first, workflow root second
 *   (R4 AC 8).
 * - **Absolute** entries are *not* anchored — `path.resolve` ignores its base for
 *   an absolute argument, so anchoring them is a no-op — and are classified by
 *   containment alone (R4 AC 9).
 *
 * Containment accepts the workspace, or the `.spec-workflow` directory under the
 * workflow root; never the workflow root itself, which in a nested worktree
 * layout contains every sibling worktree (R4 AC 16).
 *
 * **`realpath` is used for decisions, `path.resolve` for the answer.** Every
 * containment test and the dedupe key are computed on the `realpath` (R4 AC 11,
 * 16-17), but the path this module *emits* is the `path.resolve` spelling — the
 * one `validateAllFiles` emitted before this module replaced it, which kept the
 * realpath in `seen` and pushed `resolve`d strings. Keeping the two separate is
 * what holds R3 AC 11: with equal roots the emitted list is byte-identical to
 * pre-change behaviour even where a root is reached through a symlink, a
 * divergence Linux CI cannot see. Nothing in R4 asks for a normalized *output* —
 * only for normalized comparison operands and a realpath dedupe key.
 *
 * Requirements: 4.8-4.18, 7.6, 3.11.
 */
import path from 'path';
import * as nodeFs from 'node:fs';
import { PathUtils } from './path-utils.js';

const validateWarnedKeys = new Set<string>();

/** Test-only: clears the warn-once ledger so a later test can observe a warning. */
export function _resetValidateWarnings(): void {
  validateWarnedKeys.clear();
}

function warnOnce(key: string, message: string): void {
  if (validateWarnedKeys.has(key)) return;
  validateWarnedKeys.add(key);
  console.warn(message);
}

/**
 * Distinguishes failure causes, which a bare `string | undefined` cannot.
 *
 * `ENOENT` (the file is gone) has to be told apart from `EACCES`/`ELOOP` (the
 * file may well be there and we could not look): the first is dropped silently,
 * the second warns, and the deleted-in-workspace guard (R4 AC 14) keys off it.
 */
export type RealpathResult =
  | { ok: true; path: string }
  | { ok: false; code: string };

/**
 * `fs.realpathSync` that never throws.
 *
 * Warn policy, unchanged by the move to core: silent on `ENOENT` — a task that
 * deletes files records them, so warning on every deletion is noise — and
 * `warnOnce` per `(code, path)` on every other code.
 */
export function safeRealpath(p: string): RealpathResult {
  try {
    return { ok: true, path: nodeFs.realpathSync(p) };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
    if (code !== 'ENOENT') {
      warnOnce(
        `safeRealpath:${code}:${p}`,
        `[spec-workflow] safeRealpath: ${code} on ${p}`
      );
    }
    return { ok: false, code };
  }
}

/**
 * The six causes an entry can be dropped for, each counted separately (R4 AC 12).
 *
 * `resolve-threw` is **defensive and unreachable** on this path, and is kept only
 * because R4 AC 12 enumerates it: `path.resolve` throws `ERR_INVALID_ARG_TYPE`
 * for a non-string argument and nothing else — it accepts NUL bytes, empty
 * strings and unbounded `..` runs without complaint. Both arguments here are
 * guaranteed strings: the entry by the `typeof` guard above the call, the roots
 * by {@link ResolutionRoots}. A NUL byte is therefore rejected one step later, by
 * `realpathSync`, and counted as `realpath-failed`. Its tests assert it is zero
 * rather than folding it into a sum, so the day an untyped caller does reach it
 * the count is not hidden.
 */
export type DropCause =
  | 'not-array'
  | 'not-string'
  | 'resolve-threw'
  | 'missing'
  | 'realpath-failed'
  | 'outside-roots';

const DROP_CAUSES: readonly DropCause[] = [
  'not-array',
  'not-string',
  'resolve-threw',
  'missing',
  'realpath-failed',
  'outside-roots',
];

export interface ResolvedFile {
  /**
   * Absolute, and the `path.resolve` spelling — *not* realpath-normalized.
   * Containment and dedupe were decided on this path's `realpath`; the spelling
   * handed back is the one pre-change behaviour handed back (R3 AC 11).
   */
  path: string;
  /** Which root resolved it (R4 AC 18). */
  root: 'workspace' | 'workflow';
  /** A *relative* entry that anchored to a distinct existing file under both roots. */
  ambiguous: boolean;
}

export interface FileResolution {
  files: ResolvedFile[];
  workspaceFiles: string[];
  workflowFiles: string[];
  drops: Record<DropCause, number>;
}

export interface ResolutionRoots {
  workspacePath: string;
  workflowRoot: string;
}

function emptyDrops(): Record<DropCause, number> {
  const drops = {} as Record<DropCause, number>;
  for (const cause of DROP_CAUSES) drops[cause] = 0;
  return drops;
}

/** Realpath-normalizes a base, falling back to a plain resolve when it does not exist. */
function normalizeBase(p: string): string {
  const result = safeRealpath(p);
  return result.ok ? result.path : path.resolve(p);
}

/**
 * `PathUtils.validatePathWithinBases` throws a fixed message rather than
 * returning a boolean, and its message names neither root — so containment is
 * asked here one base at a time (the answer has to say *which* base matched, to
 * label the root) and the reviewer-facing warning is emitted by this module.
 */
function containedIn(candidate: string, base: string): boolean {
  try {
    PathUtils.validatePathWithinBases(candidate, [base]);
    return true;
  } catch {
    return false;
  }
}

type Anchor = { real: string } | { failure: 'missing' | 'realpath-failed' };

function anchor(candidate: string): Anchor {
  const result = safeRealpath(candidate);
  if (result.ok) return { real: result.path };
  return { failure: result.code === 'ENOENT' ? 'missing' : 'realpath-failed' };
}

/**
 * Resolves raw implementation-log entries against the workspace and the shared
 * workflow root.
 *
 * Ordering for a relative entry (R4 AC 8, 14, 16): the workspace candidate is
 * preferred; the workflow-root candidate is accepted only when it lands inside
 * `<workflowRoot>/.spec-workflow`. That single rule is what reconciles "anchor
 * the workflow root second" with "do not substitute": a code file missing from
 * the workspace but present in the main checkout fails the `.spec-workflow`
 * containment test and is dropped as `missing`, so the reviewer is never handed
 * the undeleted copy of a file the task removed.
 */
export function resolveLoggedFiles(
  input: unknown,
  roots: ResolutionRoots
): FileResolution {
  const drops = emptyDrops();

  if (!Array.isArray(input)) {
    drops['not-array'] += 1;
    warnOnce(
      'resolveLoggedFiles:non-array',
      `[spec-workflow] resolveLoggedFiles: allFiles is not an array (got ${typeof input})`
    );
    return { files: [], workspaceFiles: [], workflowFiles: [], drops };
  }

  // Both containment bases are realpath-normalized, since the resolved paths
  // they are compared against are (R4 AC 17). Comparing a normalized path
  // against an unnormalized base rejects every `.spec-workflow` path under a
  // symlinked workflow root.
  const workspaceBase = normalizeBase(roots.workspacePath);
  const workflowRootReal = normalizeBase(roots.workflowRoot);
  const workflowSpecBase = normalizeBase(path.join(workflowRootReal, '.spec-workflow'));
  // When the two roots are the same directory there is only one anchor to try,
  // and nothing can be ambiguous.
  const rootsEqual = workspaceBase === workflowRootReal;

  const files: ResolvedFile[] = [];
  const seen = new Set<string>();

  // Dedupe keys on the realpath (R4 AC 11) — `src/foo.ts` and `./src/foo.ts`
  // reach here as distinct entries and are one file — while the *emitted* path
  // is the `path.resolve` spelling of whichever entry arrived first. First-seen
  // wins for the whole record, `ambiguous` included.
  const accept = (
    real: string,
    resolved: string,
    root: 'workspace' | 'workflow',
    ambiguous: boolean
  ): void => {
    if (seen.has(real)) return;
    seen.add(real);
    files.push({ path: resolved, root, ambiguous });
  };

  const rejectOutside = (real: string): void => {
    drops['outside-roots'] += 1;
    warnOnce(
      `resolveLoggedFiles:outside:${real}`,
      `[spec-workflow] resolveLoggedFiles: path outside the workspace and the shared .spec-workflow directory: ${real}`
    );
  };

  for (let i = 0; i < input.length; i++) {
    const entry = input[i];

    if (typeof entry !== 'string') {
      const typeLabel = entry === null ? 'null' : typeof entry;
      drops['not-string'] += 1;
      warnOnce(
        `resolveLoggedFiles:non-string:${typeLabel}`,
        `[spec-workflow] resolveLoggedFiles: non-string entry at index ${i} (type: ${typeLabel})`
      );
      continue;
    }

    // Absolute entries are NOT anchored: `path.resolve` ignores its base for an
    // absolute argument, so both candidates collapse to the same value and the
    // entry is classified by containment alone, below. It is still called on
    // them, because it is also what strips `..` and duplicate separators — the
    // lexical normalization pre-change behaviour applied to every entry.
    const entryIsAbsolute = path.isAbsolute(entry);
    let workspaceCandidate: string;
    let workflowCandidate: string;
    try {
      workspaceCandidate = path.resolve(roots.workspacePath, entry);
      workflowCandidate = entryIsAbsolute
        ? workspaceCandidate
        : path.resolve(roots.workflowRoot, entry);
      // Unreachable: see `DropCause`. `path.resolve` throws only on a non-string
      // argument, and both of these are strings by construction.
    } catch (err) {
      const errMsg = (err as Error).message;
      drops['resolve-threw'] += 1;
      warnOnce(
        `resolveLoggedFiles:throw:${errMsg}`,
        `[spec-workflow] resolveLoggedFiles: path.resolve threw at index ${i}: ${errMsg}`
      );
      continue;
    }

    const primary = anchor(workspaceCandidate);
    const secondary =
      workspaceCandidate === workflowCandidate ? primary : anchor(workflowCandidate);

    // Ambiguity is a property of *relative* entries only: an absolute entry has
    // one candidate, so labelling it ambiguous would be vacuously true for all
    // of them (R4 AC 10). Two anchors that land on the same file are one file,
    // not two candidates — which is also why equal roots never produce it.
    const ambiguous =
      !rootsEqual &&
      !entryIsAbsolute &&
      'real' in primary &&
      'real' in secondary &&
      primary.real !== secondary.real;

    if ('real' in primary && containedIn(primary.real, workspaceBase)) {
      accept(primary.real, workspaceCandidate, 'workspace', ambiguous);
      continue;
    }

    if ('real' in secondary && containedIn(secondary.real, workflowSpecBase)) {
      accept(secondary.real, workflowCandidate, 'workflow', ambiguous);
      continue;
    }

    if ('real' in primary) {
      // It exists and neither base contains it: a containment rejection, which
      // is the one drop the reviewer is told about.
      rejectOutside(primary.real);
      continue;
    }

    // The workspace anchor failed. `missing` stays silent (R4 AC 15); the
    // non-ENOENT case has already warned inside `safeRealpath`. Reaching here
    // with a resolvable workflow candidate is the deleted-in-workspace case
    // (R4 AC 14) — dropped, never substituted.
    drops[primary.failure] += 1;
  }

  return {
    files,
    workspaceFiles: files.filter(f => f.root === 'workspace').map(f => f.path),
    workflowFiles: files.filter(f => f.root === 'workflow').map(f => f.path),
    drops,
  };
}
