/**
 * Root selection for tools that accept an `args.projectPath` override
 * (requirements 3.5 - 3.10).
 *
 * With no override the two roots come straight off the context: `projectPath`
 * is the shared workflow root (where `.spec-workflow` lives) and
 * `workspacePath` is the checkout whose code is read (requirement 3.10). Both
 * are already translated paths — see the comments on `ToolContext`.
 *
 * With an override the override becomes the **workspace**, and the workflow
 * root is **derived** from it (requirement 3.6). Taking the override verbatim
 * as the workflow root is the defect that criterion exists to prevent: handed a
 * worktree, every `.spec-workflow` lookup would search inside that worktree
 * instead of the shared root the worktree's specs actually live on.
 *
 * The derivation is `resolveGitRoot`, which returns its argument **unchanged**
 * in four cases that are not derivations at all:
 *
 *   1. `SPEC_WORKFLOW_SHARED_ROOT` is set — the derivation never runs; the
 *      environment value wins and the override's repository is ignored.
 *   2. the git call fails — git is unavailable, or the override is not inside a
 *      repository (or does not exist).
 *   3. the common directory contains no `.git` segment, as under
 *      `--separate-git-dir`, so the `.git`-substring normalization finds
 *      nothing to strip.
 *   4. a bare repository, whose common directory is the literal `.`.
 *
 * Each is a silent degradation to verbatim, so each warns (requirement 3.7).
 * A *fifth* case also returns the argument unchanged and is NOT a degradation:
 * a plain main checkout, whose common directory is `<override>/.git`. That is
 * the correct answer, and warning on it would put a false "could not derive"
 * line in front of the most common override there is. Telling the two apart is
 * the only reason this module asks git a second question, and it asks it only
 * when the returned root equals the override.
 *
 * Only the four tools named in requirement 3.8 use this — `review-task`,
 * `log-implementation`, `adversarial-review` and `adversarial-response`. The
 * other override-accepting tools (`deferrals`, `get-task-review`, `spec-index`,
 * `spec-status`, `approvals`) read only `.spec-workflow` and are explicitly out
 * of scope for the override rule.
 */
import { join } from 'path';
import {
  SPEC_WORKFLOW_SHARED_ROOT_ENV,
  gitCommonDirAbsolute,
  normalizeIdentityPath,
  resolveGitRoot,
} from '../core/git-utils.js';
import { ToolContext } from '../types.js';

export interface SelectedRoots {
  /** Shared workflow root — the directory that contains `.spec-workflow`. */
  workflowRoot: string;
  /** The checkout whose code is read, diffed and compiled. */
  workspacePath: string;
}

/**
 * Maximum number of override values kept in the derivation and warn-once
 * ledgers.
 *
 * Both are keyed by a string an agent supplies on every call, so neither may
 * grow without bound: a client that sends a fresh `projectPath` each time would
 * otherwise leak an entry per call for the lifetime of the process. Eviction is
 * FIFO — a `Map` iterates in insertion order, so the first key is the oldest —
 * which costs at most a repeated git derivation for an override that has aged
 * out, never a wrong answer.
 */
export const ROOT_SELECTION_CACHE_LIMIT = 32;

interface DerivedRoot {
  workflowRoot: string;
  /** Non-null when the derivation degraded to the override verbatim. */
  warning: string | null;
}

const derivationCache = new Map<string, DerivedRoot>();
const warnedKeys = new Map<string, true>();

function remember<V>(store: Map<string, V>, key: string, value: V): void {
  if (!store.has(key) && store.size >= ROOT_SELECTION_CACHE_LIMIT) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) {
      store.delete(oldest);
    }
  }
  store.set(key, value);
}

function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) {
    return;
  }
  remember(warnedKeys, key, true);
  console.warn(message);
}

/** Test-only: clears this module's derivation cache and warn-once ledger. */
export function _resetRootSelection(): void {
  derivationCache.clear();
  warnedKeys.clear();
}

/** Test-only: current number of memoized override derivations. */
export function _rootSelectionCacheSize(): number {
  return derivationCache.size;
}

/** Test-only: current number of keys in the warn-once ledger. */
export function _rootSelectionWarnLedgerSize(): number {
  return warnedKeys.size;
}

function degradedWarning(override: string, cause: string): string {
  return (
    `[spec-workflow] Could not derive a shared workflow root from the projectPath override ` +
    `"${override}": ${cause}. Using "${override}" as the workflow root verbatim — if it is a ` +
    `worktree, .spec-workflow lookups will search inside it instead of the shared root.`
  );
}

/**
 * Runs the git derivation once per override value.
 *
 * Uncached: one `execSync` inside `resolveGitRoot`, plus a second only when
 * that call returned the override unchanged and the outcome must be classified.
 */
function deriveUncached(override: string): DerivedRoot {
  const workflowRoot = resolveGitRoot(override);
  if (workflowRoot !== override) {
    // A different root came back: the derivation genuinely ran.
    return { workflowRoot, warning: null };
  }

  const commonDir = gitCommonDirAbsolute(override);
  if (commonDir === null) {
    return {
      workflowRoot,
      warning: degradedWarning(
        override,
        'git is unavailable, or the path is not inside a git repository'
      ),
    };
  }
  if (commonDir === normalizeIdentityPath(join(override, '.git'))) {
    // A plain main checkout. The override *is* the repository root, so the
    // unchanged return is the derivation's correct answer, not a failure.
    return { workflowRoot, warning: null };
  }
  if (commonDir === normalizeIdentityPath(override)) {
    return {
      workflowRoot,
      warning: degradedWarning(
        override,
        'it is a bare repository, which reports "." as its git common directory'
      ),
    };
  }
  return {
    workflowRoot,
    warning: degradedWarning(
      override,
      `its git common directory "${commonDir}" contains no ".git" segment ` +
      '(the --separate-git-dir layout), so no repository root can be stripped from it'
    ),
  };
}

function deriveWorkflowRoot(override: string): string {
  const sharedRoot = process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV]?.trim();
  if (sharedRoot) {
    // Not cached: no git runs on this path, and the value must track a change
    // to the environment variable rather than a stale first reading.
    const workflowRoot = resolveGitRoot(override);
    warnOnce(
      `shared-root:${override}`,
      `[spec-workflow] ${SPEC_WORKFLOW_SHARED_ROOT_ENV}="${sharedRoot}" outranks the workflow ` +
      `root derivation, so the workflow root is "${workflowRoot}" and nothing was derived from ` +
      `the projectPath override "${override}".`
    );
    return workflowRoot;
  }

  let entry = derivationCache.get(override);
  if (entry === undefined) {
    entry = deriveUncached(override);
    remember(derivationCache, override, entry);
  }
  if (entry.warning !== null) {
    warnOnce(`degraded:${override}`, entry.warning);
  }
  return entry.workflowRoot;
}

/**
 * Picks the workflow root and the workspace path for one tool invocation.
 *
 * A non-empty string `args.projectPath` is an override; anything else (absent,
 * empty, or not a string) falls back to the context, which is the only source
 * that can be trusted to hold two coherent roots.
 */
export function selectRoots(args: { projectPath?: unknown } | undefined, context: ToolContext): SelectedRoots {
  const override = typeof args?.projectPath === 'string' && args.projectPath.length > 0
    ? args.projectPath
    : null;

  if (override === null) {
    return { workflowRoot: context.projectPath, workspacePath: context.workspacePath };
  }

  const workflowRoot = deriveWorkflowRoot(override);
  warnOnce(
    `override:${override}`,
    `[spec-workflow] The projectPath argument "${override}" overrides the server context: it is ` +
    `now the workspace under review, discarding the context workspacePath ` +
    `"${context.workspacePath}". The shared workflow root was derived from it as ` +
    `"${workflowRoot}".`
  );

  return { workflowRoot, workspacePath: override };
}
