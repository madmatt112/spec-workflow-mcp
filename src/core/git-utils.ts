import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import { realpathSync, statSync } from 'fs';
import { resolve } from 'path';

export const SPEC_WORKFLOW_SHARED_ROOT_ENV = 'SPEC_WORKFLOW_SHARED_ROOT';
export const SPEC_WORKFLOW_WORKSPACE_ENV = 'SPEC_WORKFLOW_WORKSPACE';
const GIT_EXEC_OPTIONS: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 5000
};

/**
 * Environment variables that tell git where to look, removed from **every** git
 * invocation in this module (requirement 1.9).
 *
 * An inherited `GIT_DIR` makes `git rev-parse --git-common-dir` succeed from any
 * directory — including one that is not a repository at all — and return that
 * value, so two unrelated paths compare equal and workspace inference adopts an
 * unrelated directory. The variables are reachable from a git hook, from
 * `git rebase --exec`, and from any parent process that exported them.
 *
 * Scrubbing changes the `git --git-dir=$HOME/.dotfiles --work-tree=$HOME`
 * pattern, where the exported variables *are* the configuration: resolution
 * sees the directory's own repository instead. That is the intended answer here.
 */
const SCRUBBED_GIT_ENV_VARS = [
  'GIT_DIR',
  'GIT_COMMON_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE'
] as const;

/**
 * Builds the exec options for a git invocation in `cwd`.
 *
 * The environment is rebuilt from the live `process.env` on every call rather
 * than snapshotted at module load, so a variable exported after this module was
 * imported is still scrubbed.
 */
function gitExecOptions(cwd: string): ExecSyncOptionsWithStringEncoding {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of SCRUBBED_GIT_ENV_VARS) {
    delete env[name];
  }
  return { ...GIT_EXEC_OPTIONS, cwd, env };
}

/**
 * Runs a git command in `cwd` and returns its trimmed stdout, or null when the
 * command fails or produces no output. Never throws.
 */
function gitCapture(command: string, cwd: string): string | null {
  try {
    const output = execSync(command, gitExecOptions(cwd)).trim();
    return output || null;
  } catch {
    return null;
  }
}

/**
 * Absolute, `realpath`-normalized form of a path, for use as an identity key.
 *
 * Behaviour: `realpath(resolve(p))`. Relative input is resolved against the
 * process working directory first, so the result is always absolute.
 *
 * Fallback: when `realpath` fails — the directory does not exist, as after
 * `git worktree remove`, or is unreadable — the un-normalized absolute path
 * `resolve(p)` is returned (requirement 1.12).
 *
 * What the fallback guarantees is determinism, not stability across a change to
 * the filesystem: two computations of the same input agree, but a value
 * computed while the path resolved need not equal one computed after it stopped
 * resolving. Concretely, if a symlinked component of `p` is removed between the
 * two calls, the earlier call returns the physical `/real/child` and the later
 * one the link spelling `/link/child`, and they do not match. An identifier
 * therefore must not be recomputed from a path that may have gone away since —
 * requirement 1.13 unregisters a project by the identifier cached at
 * registration for exactly this reason.
 */
export function normalizeIdentityPath(p: string): string {
  const absolute = resolve(p);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

/**
 * Absolute, `realpath`-normalized git common directory for `cwd`, or null when
 * `cwd` is not inside a git repository or git is unavailable.
 *
 * This is exactly `realpath(resolve(cwd, raw))` — no component is stripped.
 * `resolve` handles every form git emits: bare `.git` at a repository root,
 * `../..`-repeated to depth from a subdirectory, an absolute `<main>/.git` from
 * a linked worktree, `<super>/.git/modules/<name>` from a submodule, `.` from a
 * bare repository or from inside a `.git` directory, and an arbitrary path
 * under `--separate-git-dir`. The `realpath` is what makes a repository reached
 * through a symlinked path compare equal to its own linked worktree
 * (requirement 1.6).
 *
 * The `.git`-stripping normalization inside {@link resolveGitRoot} is
 * deliberately **not** reused: it returns the repository *root*, which makes a
 * submodule compare equal to its superproject (requirement 1.5), and produces a
 * nonexistent path under `--separate-git-dir`, whose common directory contains
 * no `.git` segment at all.
 */
export function gitCommonDirAbsolute(cwd: string): string | null {
  const raw = gitCapture('git rev-parse --git-common-dir', cwd);
  if (raw === null) {
    return null;
  }
  return normalizeIdentityPath(resolve(cwd, raw));
}

/**
 * Absolute, `realpath`-normalized git top-level directory for `cwd`, or null
 * when the command fails.
 *
 * It fails — and this is the point (requirement 1.7) — in a bare repository and
 * from inside a `.git` directory, both of which still report a usable common
 * directory. Callers gating workspace inference must require a non-null result
 * on both sides; otherwise those failures fall back to their inputs, satisfy a
 * "differing toplevels" precondition, and inference adopts a directory that is
 * not a checkout.
 */
export function gitTopLevel(cwd: string): string | null {
  const raw = gitCapture('git rev-parse --show-toplevel', cwd);
  if (raw === null) {
    return null;
  }
  return normalizeIdentityPath(raw);
}

/**
 * True only when both paths are inside a git repository and it is the same one.
 *
 * Returns false when either side resolves to no common directory, so two
 * directories that are not in any repository never compare equal
 * (requirement 1.4). Common directories are compared **directly**, never a
 * parent derived from them, which is what keeps a submodule distinct from its
 * superproject (requirement 1.5).
 *
 * This predicate does not gate on `git rev-parse --show-toplevel`; that is a
 * separate, required gate the caller applies (requirement 1.7, see
 * {@link gitTopLevel}).
 */
export function sameRepository(a: string, b: string): boolean {
  const commonA = gitCommonDirAbsolute(a);
  if (commonA === null) {
    return false;
  }

  const commonB = gitCommonDirAbsolute(b);
  if (commonB === null) {
    return false;
  }

  return commonA === commonB;
}

/**
 * Resolves the git workspace root directory.
 * For repositories and worktrees, this returns the top-level checked-out directory.
 *
 * @param projectPath - Any path inside the workspace
 * @returns Workspace root path, or original path when git is unavailable
 */
export function resolveGitWorkspaceRoot(projectPath: string): string {
  try {
    const workspaceRoot = execSync(
      'git rev-parse --show-toplevel',
      gitExecOptions(projectPath)
    ).trim();

    return workspaceRoot || projectPath;
  } catch {
    return projectPath;
  }
}

/**
 * Resolves the git root directory for storing shared specs.
 * In worktrees, this returns the main repository path so all worktrees share specs.
 *
 * @param projectPath - The current project/worktree path
 * @returns The resolved path (main repo for worktrees, or original path)
 */
export function resolveGitRoot(projectPath: string): string {
  // Check for explicit override first. Resolved to absolute (requirement 2.9):
  // a relative value would make every `.spec-workflow` path derived from it
  // resolve against the process working directory instead.
  const explicitRoot = process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV]?.trim();
  if (explicitRoot) {
    return resolve(explicitRoot);
  }

  try {
    // Get the git common directory (main repo's .git folder)
    const gitCommonDir = execSync(
      'git rev-parse --git-common-dir',
      gitExecOptions(projectPath)
    ).trim();

    // In main repo, returns ".git" - no change needed
    if (gitCommonDir === '.git') {
      return projectPath;
    }

    // In worktree or subdirectory, returns path like "/main/.git", "/main/.git/worktrees/name",
    // or relative path like "../../.git" when run from a subdirectory.
    // Extract the main repo path (parent of .git) and resolve to absolute path.
    const gitIndex = gitCommonDir.lastIndexOf('.git');
    if (gitIndex > 0) {
      const mainRepoPath = gitCommonDir.substring(0, gitIndex - 1);
      // If path is already absolute (Unix or Windows style), return as-is
      // Otherwise, resolve relative to projectPath
      const isAbsolute = mainRepoPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(mainRepoPath);
      return isAbsolute ? mainRepoPath : resolve(projectPath, mainRepoPath);
    }

    return projectPath;
  } catch {
    // Not a git repo or git unavailable - use original path
    return projectPath;
  }
}

/**
 * Checks if the current directory is a git worktree (not the main repo).
 *
 * @param projectPath - The path to check
 * @returns true if in a worktree, false if main repo or not a git repo
 */
export function isGitWorktree(projectPath: string): boolean {
  try {
    const gitCommonDir = execSync(
      'git rev-parse --git-common-dir',
      gitExecOptions(projectPath)
    ).trim();
    return gitCommonDir !== '.git';
  } catch {
    return false;
  }
}

/** How the workspace path was chosen, in precedence order (requirement 2.3). */
export type WorkspaceSource = 'env' | 'flag' | 'inference' | 'argument';

export interface ResolvedRoots {
  /** Where **code** lives: the diff, the typecheck, and spawned agents. */
  workspacePath: string;
  /** Where `.spec-workflow` lives; shared across a repository's worktrees. */
  workflowRootPath: string;
  source: WorkspaceSource;
}

export interface WorkspaceRootsOptions {
  /** The CLI path argument, tilde-expanded; defaults to the process cwd upstream. */
  configuredPath: string;
  /** The launch directory, i.e. `process.cwd()`. */
  cwd: string;
  /** Dashboard-only mode: no workspace of its own (requirements 1.14, 2.11). */
  dashboardMode: boolean;
  /** `--no-workspace-inference` (requirement 1.15). */
  noInference: boolean;
  /** `--no-shared-worktree-specs` (requirement 2.8). */
  noSharedWorktreeSpecs: boolean;
}

/** True only when `p` names an existing directory. Never throws. */
function isExistingDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * `SPEC_WORKFLOW_WORKSPACE`, validated, or null when it is unset or unusable.
 *
 * Validation is `stat().isDirectory()` rather than mere existence
 * (requirement 2.4): a value naming a *file* passes an existence test and then
 * throws inside `initialize`, killing the MCP handshake. A failed check logs and
 * returns null so resolution falls through to inference rather than aborting
 * startup (requirement 2.5).
 *
 * A usable value in a **different repository** from the configured path is used
 * but warned about (requirement 2.6) — otherwise specs come from one project
 * while `git diff`, `tsc` and the spawned agent all run in another, with no
 * signal. The equal-path guard keeps the warning off the ordinary case of two
 * spellings of one directory that is in no repository at all, where
 * {@link sameRepository} is false by construction.
 */
function resolveEnvWorkspace(configuredPath: string): string | null {
  const raw = process.env[SPEC_WORKFLOW_WORKSPACE_ENV]?.trim();
  if (!raw) {
    return null;
  }

  const candidate = resolve(raw);
  if (!isExistingDirectory(candidate)) {
    console.warn(
      `${SPEC_WORKFLOW_WORKSPACE_ENV}="${raw}" does not name a directory. ` +
      'Ignoring it and falling through to workspace inference.'
    );
    return null;
  }

  const sameDirectory = normalizeIdentityPath(candidate) === normalizeIdentityPath(configuredPath);
  if (!sameDirectory && !sameRepository(candidate, configuredPath)) {
    console.warn(
      `${SPEC_WORKFLOW_WORKSPACE_ENV}="${candidate}" is not in the same repository as the ` +
      `project path "${configuredPath}". Specs will be read from one project while git, ` +
      'typechecks and spawned agents run in the other.'
    );
  }

  return candidate;
}

/**
 * The top-level directory of `cwd` when it is a different checkout of the same
 * repository as `configuredPath`, otherwise null.
 *
 * Ordering the launch directory above the configured path inverts the usual
 * rule, and is correct here because `.mcp.json` is tracked in git and
 * byte-identical in every worktree — the path argument is structurally
 * incapable of naming the current worktree (requirement 1.1).
 *
 * Two independent gates, both required:
 *
 * - **A successful `--show-toplevel` on both sides** (requirement 1.7). A bare
 *   repository and a path inside a `.git` directory each report a usable common
 *   directory and *no* toplevel; without this gate those failures would satisfy
 *   the "differing toplevels" precondition and inference would adopt a
 *   non-work-tree, where the spawn cwd is not a checkout and `git diff` fails.
 * - **{@link sameRepository}** (requirements 1.3, 1.5), which compares git
 *   common directories directly. Two paths in different repositories — or in no
 *   repository at all (requirement 1.4) — leave the configured path's toplevel
 *   in place.
 *
 * Equal toplevels return null rather than the toplevel itself, so the single
 * fallback in {@link resolveWorkspaceRoots} owns requirement 1.2.
 */
function inferWorkspaceFromCwd(configuredPath: string, cwd: string): string | null {
  const cwdTopLevel = gitTopLevel(cwd);
  if (cwdTopLevel === null) {
    return null;
  }

  const configuredTopLevel = gitTopLevel(configuredPath);
  if (configuredTopLevel === null) {
    return null;
  }

  if (cwdTopLevel === configuredTopLevel) {
    return null;
  }

  if (!sameRepository(cwd, configuredPath)) {
    return null;
  }

  return cwdTopLevel;
}

/**
 * The one decision point for workspace identity and the shared workflow root.
 *
 * **Workspace precedence (requirement 2.3), exactly:**
 * `SPEC_WORKFLOW_WORKSPACE` → `--no-workspace-inference` → inference →
 * `resolveGitWorkspaceRoot(configuredPath)`.
 *
 * The environment override and inference are both skipped in dashboard-only
 * mode (requirements 1.14, 2.11), which has no workspace of its own. Dashboard
 * mode is an input distinct from `noInference` (requirement 2.10) precisely so
 * that the two can be reported differently in `source`.
 *
 * **The fallback is the git toplevel, not the raw configured path**
 * (requirement 1.2). Returning the configured path verbatim would move
 * `projectId`, narrow containment to a subdirectory, and make the two roots
 * unequal for users with no worktrees at all.
 *
 * **Validation of an *inferred* path is the caller's** (requirement 1.8).
 * `validateProjectPath` is async while this function and `parseArguments` are
 * synchronous, so the resolver reports `source` and `SpecWorkflowMCPServer.initialize`
 * — which already awaits that predicate — checks the workspace when
 * `source === 'inference'` and falls back with a log rather than throwing.
 *
 * **Workflow root precedence:** `SPEC_WORKFLOW_SHARED_ROOT`, resolved to
 * absolute (requirement 2.9) → the resolved workspace path when
 * `--no-shared-worktree-specs` is passed, including when that path came from
 * inference or the environment (requirement 2.8) → `resolveGitRoot` of the
 * **configured path argument** (requirement 2.7).
 *
 * Never throws: every git invocation below fails closed to null or to its
 * input, so `parseArguments` cannot die on a missing git binary.
 */
export function resolveWorkspaceRoots(options: WorkspaceRootsOptions): ResolvedRoots {
  const { configuredPath, cwd, dashboardMode, noInference, noSharedWorktreeSpecs } = options;

  let workspacePath: string | null = null;
  let source: WorkspaceSource = 'argument';

  if (!dashboardMode) {
    workspacePath = resolveEnvWorkspace(configuredPath);
    if (workspacePath !== null) {
      source = 'env';
    }
  }

  if (workspacePath === null) {
    if (noInference) {
      source = 'flag';
    } else if (!dashboardMode) {
      const inferred = inferWorkspaceFromCwd(configuredPath, cwd);
      if (inferred !== null) {
        workspacePath = inferred;
        source = 'inference';
      }
    }
  }

  if (workspacePath === null) {
    workspacePath = resolveGitWorkspaceRoot(configuredPath);
  }

  let workflowRootPath: string;
  const explicitSharedRoot = process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV]?.trim();
  if (explicitSharedRoot) {
    workflowRootPath = resolve(explicitSharedRoot);
  } else if (noSharedWorktreeSpecs) {
    workflowRootPath = workspacePath;
  } else {
    workflowRootPath = resolveGitRoot(configuredPath);
  }

  return { workspacePath, workflowRootPath, source };
}
