/**
 * Unit-level git fixture (requirement 7.1).
 *
 * Builds real git repositories in a temporary directory so the resolution
 * helpers and the logged-file resolver can be tested against genuine git
 * output rather than a mock. `src/core/__tests__/git-utils.test.ts` mocks
 * `child_process` wholesale, so real-repository tests cannot live there —
 * they get their own files and consume this fixture.
 *
 * Every layout this fixture builds is verified by reading
 * `git rev-parse --git-common-dir` from inside it. Construction is never
 * assumed to have succeeded.
 *
 * Teardown contract: call {@link GitFixture.cleanup} from `afterEach` (or
 * `afterAll` when the fixture is shared), assigning the fixture to the tracked
 * variable *before* building anything so a mid-construction throw is still
 * cleaned up. As a backstop, add `afterAll(cleanupAllGitFixtures)`:
 * vitest's worker pool does not emit `process.on('exit')`, so the process-exit
 * hook only covers plain node consumers.
 *
 * Reference: e2e/helpers/worktree-harness.ts (that harness is e2e and stays).
 */
import { execFile } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { appendFile, mkdir, rm, stat, realpath, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const GIT_CMD = process.platform === 'win32' ? 'git.exe' : 'git';
const GIT_TIMEOUT_MS = 30_000;

/** Where a linked worktree is placed relative to its main checkout. */
export type WorktreeLayout = 'sibling' | 'nested';

export interface GitSubmoduleFixture {
  /** Absolute path to the submodule's working directory. */
  path: string;
  /** Submodule path relative to the superproject. */
  name: string;
  /** Absolute `--git-common-dir`, i.e. `<super>/.git/modules/<name>`. */
  gitCommonDir: string;
  /** The standalone repository the submodule was cloned from. */
  source: GitRepoFixture;
}

export interface BareRepoFixture {
  /** Absolute path to the bare repository directory. */
  path: string;
  /** Absolute `--git-common-dir`; git reports `.` inside a bare repo. */
  gitCommonDir: string;
}

export interface SeparateGitDirFixture {
  /** Absolute path to the working directory (its `.git` is a file). */
  path: string;
  /** Absolute path to the detached git directory. */
  gitDir: string;
  /** Absolute `--git-common-dir`, equal to `gitDir`. */
  gitCommonDir: string;
}

const activeRoots = new Set<string>();
let exitCleanupRegistered = false;

function registerExitCleanup(): void {
  if (exitCleanupRegistered) {
    return;
  }
  exitCleanupRegistered = true;
  process.on('exit', () => {
    for (const root of activeRoots) {
      try {
        rmSync(root, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // Best effort — the process is already on its way out.
      }
    }
    activeRoots.clear();
  });
}

/**
 * Removes every temporary root created by this module that has not already been
 * cleaned up.
 *
 * Use it as `afterAll(cleanupAllGitFixtures)`. It exists because vitest's worker
 * pool terminates without emitting `process.on('exit')`, so a fixture whose
 * owner threw before reaching its own `cleanup()` would otherwise survive the
 * run.
 */
export async function cleanupAllGitFixtures(): Promise<void> {
  const roots = [...activeRoots];
  activeRoots.clear();
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true, maxRetries: 3 }))
  );
}

/**
 * Environment for the fixture's own git invocations.
 *
 * Every `GIT_*` variable is dropped so an ambient `GIT_DIR`, `GIT_COMMON_DIR`,
 * `GIT_WORK_TREE` or `GIT_INDEX_FILE` (which some tests deliberately export)
 * cannot redirect fixture construction, and the global and system config files
 * are pointed at an empty file inside the fixture so a developer's
 * `commit.gpgsign`, `core.hooksPath` or template settings cannot break or
 * contaminate the temporary repositories.
 *
 * Called for *every* git invocation rather than snapshotted once: a variable
 * exported after the fixture was created must still be scrubbed.
 */
function buildFixtureGitEnv(gitConfigPath: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('GIT_')) {
      continue;
    }
    env[key] = value;
  }
  env.GIT_CONFIG_GLOBAL = gitConfigPath;
  env.GIT_CONFIG_SYSTEM = gitConfigPath;
  env.GIT_TERMINAL_PROMPT = '0';
  return env;
}

async function assertDotGitIsFile(worktreePath: string, label: string): Promise<void> {
  const dotGit = join(worktreePath, '.git');
  const stats = await stat(dotGit);
  if (!stats.isFile()) {
    throw new Error(`git fixture: expected ${label} to have a .git file at ${dotGit}, found a directory`);
  }
}

/**
 * Shared helpers for a working directory inside a {@link GitFixture}: writing
 * files into it and running git in it.
 */
export class GitWorkingDirFixture {
  /** Absolute, realpath-normalized path to the working directory. */
  readonly path: string;

  protected readonly fixture: GitFixture;

  /** @internal — construct via a {@link GitFixture} factory method. */
  constructor(fixture: GitFixture, path: string) {
    this.fixture = fixture;
    this.path = path;
  }

  /** Runs git inside this working directory with the fixture's scrubbed environment. */
  async git(args: string[]): Promise<string> {
    return this.fixture.git(args, this.path);
  }

  /** Creates a directory at `relativePath` (recursively) and returns its absolute path. */
  async mkdirp(relativePath: string): Promise<string> {
    const target = resolve(this.path, relativePath);
    await mkdir(target, { recursive: true });
    return target;
  }

  /** Writes a file at `relativePath`, creating parent directories. Returns its absolute path. */
  async writeFile(relativePath: string, contents: string): Promise<string> {
    const target = resolve(this.path, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf-8');
    return target;
  }

  /**
   * Stages everything in *this* working directory and commits. No-ops when there
   * is nothing to commit.
   *
   * Lives on the base rather than on {@link GitRepoFixture} because a linked
   * worktree needs it just as much: git's index is per-worktree, so this stages
   * only this directory's tree and the commit lands on the branch *this*
   * worktree has checked out. Anything that diffs against `HEAD` — the reviewer
   * diff in `src/core/task-diff.ts` does — sees an empty diff for a file that was
   * only ever written, never committed.
   */
  async commitAll(message: string): Promise<void> {
    await this.git(['add', '-A']);
    const status = await this.git(['status', '--porcelain']);
    if (!status) {
      return;
    }
    await this.git(['commit', '-q', '-m', message]);
  }
}

/** A linked worktree of a {@link GitRepoFixture}. */
export class GitWorktreeFixture extends GitWorkingDirFixture {
  /** Branch checked out in the worktree. */
  readonly branch: string;
  readonly layout: WorktreeLayout;
  /** Absolute `--git-common-dir` as reported from inside the worktree. */
  readonly gitCommonDir: string;

  /** @internal — construct via {@link GitRepoFixture.addWorktree}. */
  constructor(
    fixture: GitFixture,
    worktreePath: string,
    branch: string,
    layout: WorktreeLayout,
    gitCommonDir: string
  ) {
    super(fixture, worktreePath);
    this.branch = branch;
    this.layout = layout;
    this.gitCommonDir = gitCommonDir;
  }
}

/** A single git repository inside a {@link GitFixture}. */
export class GitRepoFixture extends GitWorkingDirFixture {
  /** Absolute `--git-common-dir` for the repository root. */
  readonly gitCommonDir: string;

  private worktreeCount = 0;
  private nestedWorktreesExcluded = false;

  /** @internal — construct via {@link GitFixture.createRepo}. */
  constructor(fixture: GitFixture, repoPath: string, gitCommonDir: string) {
    super(fixture, repoPath);
    this.gitCommonDir = gitCommonDir;
  }

  /**
   * Adds a linked worktree.
   *
   * - `sibling` places it beside the main checkout (`<root>/<name>`).
   * - `nested` places it under the main checkout (`<repo>/worktrees/<name>`),
   *   the layout in which the shared workflow root contains every sibling
   *   worktree.
   *
   * Verified: `--git-common-dir` from inside the worktree resolves to this
   * repository's `.git`, and its `.git` is a file, not a directory.
   */
  async addWorktree(name: string, layout: WorktreeLayout = 'sibling'): Promise<GitWorktreeFixture> {
    const worktreePath = layout === 'nested'
      ? join(this.path, 'worktrees', name)
      : join(dirname(this.path), name);
    const branch = `wt-${name}-${++this.worktreeCount}`;

    if (layout === 'nested') {
      await mkdir(dirname(worktreePath), { recursive: true });
      await this.excludeNestedWorktrees();
    }

    await this.git(['worktree', 'add', '-q', '-b', branch, worktreePath]);

    const gitCommonDir = await this.fixture.verifyGitCommonDir(
      worktreePath,
      { absolute: join(this.path, '.git') },
      `${layout} worktree "${name}"`
    );
    await assertDotGitIsFile(worktreePath, `${layout} worktree "${name}"`);

    return new GitWorktreeFixture(this.fixture, worktreePath, branch, layout, gitCommonDir);
  }

  /**
   * Adds a submodule at `name`, cloning from `source` (a fresh standalone
   * repository is created when `source` is omitted).
   *
   * `-c protocol.file.allow=always` is mandatory: `git submodule add` from a
   * local path has been refused by default since git 2.38.1 (CVE-2022-39253),
   * and without it this case silently never runs. The submodule case is the
   * reason the resolution helpers must not reuse the `.git`-stripping
   * normalization in `git-utils.ts` — a submodule's common directory is
   * `<super>/.git/modules/<name>`, which strips down to the superproject and
   * would make the two compare equal.
   */
  async addSubmodule(name: string, source?: GitRepoFixture): Promise<GitSubmoduleFixture> {
    const sourceRepo = source ?? await this.fixture.createRepo(`${name}-submodule-source`);

    await this.git([
      '-c', 'protocol.file.allow=always',
      'submodule', 'add', '-q', '--', sourceRepo.path, name
    ]);
    await this.commitAll(`Add submodule ${name}`);

    const submodulePath = join(this.path, name);
    const gitCommonDir = await this.fixture.verifyGitCommonDir(
      submodulePath,
      { absolute: join(this.path, '.git', 'modules', name) },
      `submodule "${name}"`
    );
    await assertDotGitIsFile(submodulePath, `submodule "${name}"`);

    const registered = await this.git(['submodule', 'status', '--', name]);
    if (!registered.includes(name)) {
      throw new Error(`git fixture: submodule "${name}" was not registered in ${this.path}`);
    }

    return { path: submodulePath, name, gitCommonDir, source: sourceRepo };
  }

  /**
   * Excludes the nested-worktree directory from the superproject's index.
   *
   * Without this, `git add -A` records the nested worktree as a gitlink and
   * every later `git submodule` command in the repository fails with
   * "no submodule mapping found in .gitmodules".
   */
  private async excludeNestedWorktrees(): Promise<void> {
    if (this.nestedWorktreesExcluded) {
      return;
    }
    const excludePath = join(this.path, '.git', 'info', 'exclude');
    await mkdir(dirname(excludePath), { recursive: true });
    await appendFile(excludePath, '\n/worktrees/\n', 'utf-8');
    this.nestedWorktreesExcluded = true;
  }
}

/**
 * A temporary directory hosting one or more real git repositories.
 *
 * Every directory it creates lives under {@link GitFixture.root} and is removed
 * by {@link GitFixture.cleanup}; a `process.on('exit')` hook removes any root
 * whose owner forgot to (or crashed before it could).
 */
export class GitFixture {
  /** Absolute, realpath-normalized temporary root. */
  readonly root: string;

  private readonly gitConfigPath: string;
  private readonly registeredPaths: string[];
  private disposed = false;

  private constructor(root: string, registeredPaths: string[], gitConfigPath: string) {
    this.root = root;
    this.registeredPaths = registeredPaths;
    this.gitConfigPath = gitConfigPath;
  }

  /** Creates the temporary root and registers it for teardown. */
  static async create(prefix = 'specwf-git-fixture-'): Promise<GitFixture> {
    registerExitCleanup();
    const created = mkdtempSync(join(tmpdir(), prefix));
    // Normalize up front: on macOS /tmp is a symlink to /private/tmp, and git
    // reports realpath-normalized absolute paths.
    const root = await realpath(created);

    const registeredPaths = root === created ? [root] : [root, created];
    for (const path of registeredPaths) {
      activeRoots.add(path);
    }

    const gitConfigPath = join(root, 'isolated.gitconfig');
    writeFileSync(gitConfigPath, '', 'utf-8');

    return new GitFixture(root, registeredPaths, gitConfigPath);
  }

  /**
   * Runs git in `cwd` with the fixture's scrubbed environment; returns trimmed
   * stdout.
   *
   * The environment is rebuilt from the live `process.env` on every call so an
   * ambient `GIT_*` variable exported *after* the fixture was created is still
   * scrubbed.
   */
  async git(args: string[], cwd: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(GIT_CMD, args, {
        cwd,
        env: buildFixtureGitEnv(this.gitConfigPath),
        encoding: 'utf-8',
        timeout: GIT_TIMEOUT_MS
      });
      return stdout.trim();
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr ?? '';
      const message = (error as Error).message ?? String(error);
      throw new Error(`git fixture: \`git ${args.join(' ')}\` failed in ${cwd}\n${stderr || message}`);
    }
  }

  /** Reads `git rev-parse --git-common-dir` from `cwd`, or null when `cwd` is not a repository. */
  async readGitCommonDir(cwd: string): Promise<string | null> {
    try {
      return await this.git(['rev-parse', '--git-common-dir'], cwd);
    } catch {
      return null;
    }
  }

  /**
   * Asserts the git shape of `cwd` by reading `--git-common-dir` from inside it.
   *
   * `raw` pins git's literal output (`.git` at a repository root, `.` in a bare
   * repository); `absolute` pins the path it resolves to. Returns the absolute
   * common directory.
   */
  async verifyGitCommonDir(
    cwd: string,
    expected: { raw?: string; absolute?: string },
    label: string
  ): Promise<string> {
    const actual = await this.readGitCommonDir(cwd);
    if (actual === null) {
      throw new Error(`git fixture: ${label} at ${cwd} is not a git repository`);
    }

    if (expected.raw !== undefined && actual !== expected.raw) {
      throw new Error(
        `git fixture: ${label} at ${cwd} reported --git-common-dir "${actual}", expected "${expected.raw}"`
      );
    }

    const actualAbsolute = resolve(cwd, actual);
    if (expected.absolute !== undefined && actualAbsolute !== resolve(expected.absolute)) {
      throw new Error(
        `git fixture: ${label} at ${cwd} resolved --git-common-dir to "${actualAbsolute}", ` +
        `expected "${resolve(expected.absolute)}"`
      );
    }

    return actualAbsolute;
  }

  /**
   * Creates a repository at `<root>/<name>` with one commit.
   *
   * Verified: `--git-common-dir` is the literal `.git`.
   */
  async createRepo(name: string): Promise<GitRepoFixture> {
    this.assertUsable();
    const repoPath = join(this.root, name);
    await mkdir(repoPath, { recursive: true });

    await this.git(['init', '-q', '-b', 'main', '.'], repoPath);
    await this.git(['config', 'user.email', 'fixture@example.com'], repoPath);
    await this.git(['config', 'user.name', 'Git Fixture'], repoPath);
    await writeFile(join(repoPath, 'README.md'), `# ${name}\n`, 'utf-8');
    await this.git(['add', 'README.md'], repoPath);
    await this.git(['commit', '-q', '-m', 'Initial commit'], repoPath);

    const gitCommonDir = await this.verifyGitCommonDir(
      repoPath,
      { raw: '.git', absolute: join(repoPath, '.git') },
      `repository "${name}"`
    );

    return new GitRepoFixture(this, repoPath, gitCommonDir);
  }

  /**
   * Creates a bare repository at `<root>/<name>`.
   *
   * Verified: `--git-common-dir` is the literal `.` and the repository has no
   * work tree, the case the top-level resolution helper must fail on.
   */
  async createBareRepo(name: string): Promise<BareRepoFixture> {
    this.assertUsable();
    const barePath = join(this.root, name);
    await mkdir(barePath, { recursive: true });
    await this.git(['init', '-q', '--bare', '-b', 'main', '.'], barePath);

    const gitCommonDir = await this.verifyGitCommonDir(
      barePath,
      { raw: '.', absolute: barePath },
      `bare repository "${name}"`
    );

    let hasWorkTree = true;
    try {
      await this.git(['rev-parse', '--show-toplevel'], barePath);
    } catch {
      hasWorkTree = false;
    }
    if (hasWorkTree) {
      throw new Error(`git fixture: bare repository "${name}" unexpectedly reports a work tree`);
    }

    return { path: barePath, gitCommonDir };
  }

  /**
   * Creates a repository whose git directory lives outside the work tree.
   *
   * Verified: `--git-common-dir` is the external directory, which contains no
   * `.git` segment — the shape that defeats `.git`-substring normalization.
   */
  async createSeparateGitDirRepo(name: string): Promise<SeparateGitDirFixture> {
    this.assertUsable();
    const workTreePath = join(this.root, name);
    const gitDirPath = join(this.root, `${name}-gitdir`);
    await mkdir(workTreePath, { recursive: true });

    await this.git(['init', '-q', '-b', 'main', `--separate-git-dir=${gitDirPath}`, '.'], workTreePath);
    await this.git(['config', 'user.email', 'fixture@example.com'], workTreePath);
    await this.git(['config', 'user.name', 'Git Fixture'], workTreePath);
    await writeFile(join(workTreePath, 'README.md'), `# ${name}\n`, 'utf-8');
    await this.git(['add', 'README.md'], workTreePath);
    await this.git(['commit', '-q', '-m', 'Initial commit'], workTreePath);

    const gitCommonDir = await this.verifyGitCommonDir(
      workTreePath,
      { absolute: gitDirPath },
      `--separate-git-dir repository "${name}"`
    );
    await assertDotGitIsFile(workTreePath, `--separate-git-dir repository "${name}"`);

    return { path: workTreePath, gitDir: gitDirPath, gitCommonDir };
  }

  /** Creates a plain, non-git directory at `<root>/<name>`. */
  async createNonGitDirectory(name: string): Promise<string> {
    this.assertUsable();
    const target = join(this.root, name);
    await mkdir(target, { recursive: true });

    const commonDir = await this.readGitCommonDir(target);
    if (commonDir !== null) {
      throw new Error(
        `git fixture: non-git directory ${target} unexpectedly resolved to a repository (${commonDir}). ` +
        'The temporary root is inside a git repository.'
      );
    }

    return target;
  }

  /**
   * Creates a symlink at `<root>/<linkName>` pointing at `targetPath`.
   *
   * Used for the symlinked-repository-root case: a repository reached through
   * the link must compare equal to its own linked worktree. Requires symlink
   * privileges on Windows; callers should skip that platform.
   */
  async createSymlink(targetPath: string, linkName: string): Promise<string> {
    this.assertUsable();
    const linkPath = join(this.root, linkName);
    await symlink(targetPath, linkPath, 'dir');

    const resolved = await realpath(linkPath);
    if (resolved !== resolve(targetPath)) {
      throw new Error(
        `git fixture: symlink ${linkPath} resolved to ${resolved}, expected ${resolve(targetPath)}`
      );
    }

    return linkPath;
  }

  /** Removes the temporary root and everything under it. Safe to call twice. */
  async cleanup(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    await rm(this.root, { recursive: true, force: true, maxRetries: 3 });
    for (const path of this.registeredPaths) {
      activeRoots.delete(path);
    }
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('git fixture: this fixture has already been cleaned up');
    }
  }
}
