/**
 * End-to-end worktree harness (requirements 7.2, 7.3).
 *
 * Rewritten, not extended. The previous harness could only exercise
 * `--no-shared-worktree-specs`: it seeded a `.spec-workflow` inside every
 * worktree and spawned the server with `cwd` set to *this* repository, under
 * which workspace inference can never fire — `cwd` and the configured path are
 * in different repositories, so `sameRepository` is false and the configured
 * path's own toplevel wins.
 *
 * Three things changed:
 *
 * - **The child `cwd` is the worktree.** That is the only way inference has an
 *   input: `cwd` is a different checkout of the same repository as the
 *   configured path.
 * - **The invocation is `node <tsx cli> <absolute entry>`, not `npm run`**
 *   (requirement 7.3). The temporary repository has no `package.json`, so
 *   `npm run` from that `cwd` fails outright. `tsx`'s CLI and `src/index.ts`
 *   are both addressed absolutely under `serverRoot`, which makes the child's
 *   `cwd` free to be anywhere.
 * - **In `shared` mode the `.spec-workflow` lives in the main checkout only.**
 *   That is the assertion surface: specs can only appear in the dashboard if
 *   the server resolved the shared workflow root from the configured path while
 *   keeping the worktree as its workspace identity.
 *
 * Two invariants are load-bearing and easy to lose:
 *
 * - **`SPEC_WORKFLOW_HOME` isolation.** Every child gets the harness's
 *   `specWorkflowHome`, and the constructor rejects anything but an absolute
 *   path. A temp worktree that reaches a developer's real global registry
 *   leaves an entry that is *permanently* unreapable under path translation,
 *   where the liveness check returns true unconditionally.
 * - **`realpath` normalization of every fixture path.** {@link GitFixture}
 *   normalizes its temporary root before building anything, so the paths this
 *   harness hands out are physical. Since task 15 that is not cosmetic:
 *   `generateProjectId` realpaths internally, so a fixture path that still
 *   carried a symlinked spelling would be *registered* under the physical id
 *   and compared against the link spelling here — every path assertion in the
 *   suites would miss.
 */
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { isAbsolute, join } from 'path';
import {
  GitFixture,
  GitRepoFixture,
  WorktreeLayout
} from '../../src/core/__tests__/helpers/git-fixture.js';

export type { WorktreeLayout };

/** Shape returned by `GET /api/projects/list`. */
export interface RegisteredProject {
  projectId: string;
  projectName: string;
  projectPath: string;
  instances: Array<{ pid: number; registeredAt: string }>;
}

/**
 * An entry as stored in `activeProjects.json`.
 *
 * The dashboard's list endpoint reports the workspace path only, so the
 * shared workflow root — the thing shared mode exists to prove — is readable
 * only from the registry file. See {@link WorktreeHarness.readRegistry}.
 */
export interface RegistryEntry {
  projectId: string;
  projectPath: string;
  workflowRootPath: string;
  projectName: string;
  instances: Array<{ pid: number; registeredAt: string }>;
}

/**
 * Which `.spec-workflow` the servers are pointed at.
 *
 * - `shared` (the default in production): the configured path argument is the
 *   **main checkout**, `cwd` is the worktree, no opt-out flag. Inference fires,
 *   the workspace is the worktree and the workflow root is the main checkout.
 * - `no-shared`: `--no-shared-worktree-specs`, configured path argument is the
 *   worktree itself. Workspace and workflow root are both the worktree.
 *
 * Required rather than defaulted: the two modes seed different directories, and
 * a harness that guesses is a harness whose fixtures silently disagree with the
 * suite's assertions.
 */
export type WorktreeSpecsMode = 'shared' | 'no-shared';

export interface WorktreeFixtureSpec {
  /** Directory name for the worktree, e.g. `wt-a`. */
  name: string;
  /** `sibling` → `<root>/<name>`; `nested` → `<main checkout>/worktrees/<name>`. */
  layout?: WorktreeLayout;
  /**
   * Workspace-local file seeded with {@link WorktreeFixtureSpec.sourceContents}.
   *
   * Defaults to `src/service.ts` — the *same* relative path in every worktree,
   * which is what makes one shared approval whose `filePath` is relative
   * resolve to different contents per selected project.
   */
  sourceFile?: string;
  /** Contents of {@link WorktreeFixtureSpec.sourceFile}. */
  sourceContents?: string;
  /** `no-shared` only: spec seeded under the worktree's own `.spec-workflow`. */
  specName?: string;
  /** `no-shared` only: approval id seeded under the worktree's own `.spec-workflow`. */
  approvalId?: string;
  /** `no-shared` only: `filePath` recorded in that approval. */
  approvalFilePath?: string;
}

export interface WorktreeHarnessOptions {
  /** This repository — where `node_modules/tsx` and `src/index.ts` live. */
  serverRoot: string;
  dashboardApiBaseUrl: string;
  /** Absolute; enforced. The global registry every spawned server writes to. */
  specWorkflowHome: string;
  mode: WorktreeSpecsMode;
  /** Defaults to two sibling worktrees, `wt-a` and `wt-b`. */
  worktrees?: WorktreeFixtureSpec[];
  /** `shared` only: spec seeded in the main checkout's `.spec-workflow`. */
  sharedSpecName?: string;
  /** `shared` only: approval id seeded in the main checkout's `.spec-workflow`. */
  sharedApprovalId?: string;
  /**
   * `shared` only: `filePath` recorded in the shared approval.
   *
   * Relative on purpose: the dashboard resolves an approval's file against the
   * selected project's *workspace*, so one shared approval renders the
   * worktree's own copy of this file.
   */
  sharedApprovalFilePath?: string;
  /**
   * Park every spawned server one statement short of registering, until
   * {@link WorktreeHarness.releaseRegistrationBarrier} lets them all go.
   *
   * For concurrency scenarios only. See
   * `e2e/helpers/registration-barrier-entry.ts` for why the barrier sits at the
   * critical section rather than at process start.
   */
  registrationBarrier?: boolean;
}

/**
 * A worktree after seeding, with every name the suites need resolved.
 *
 * The four methods delegate to this worktree's `GitWorktreeFixture` and keep its
 * names — `git`, `mkdirp`, `writeFile`, `commitAll` — so there is one vocabulary
 * for driving a working directory across the unit fixture and this harness.
 *
 * `commitAll` is not a convenience. Seeded files are only *written*, and
 * `src/core/task-diff.ts` diffs logged paths against `HEAD`: an untracked file
 * produces an empty diff, so any suite asserting a *non-empty* diff from a
 * worktree has to commit a base version on that worktree's branch first and then
 * modify it. Because git's index is per-worktree, that commit lands on
 * {@link HarnessWorktree.branch} and is invisible to the other worktrees —
 * which is also what makes "worktree A's review diffs A's files, not B's"
 * expressible at all.
 */
export interface HarnessWorktree {
  name: string;
  path: string;
  layout: WorktreeLayout;
  branch: string;
  sourceFile: string;
  sourceContents: string;
  specName: string;
  approvalId: string;
  approvalFilePath: string;
  /** Runs git in this worktree with the fixture's scrubbed environment. */
  git(args: string[]): Promise<string>;
  /** Creates a directory under this worktree; returns its absolute path. */
  mkdirp(relativePath: string): Promise<string>;
  /** Writes a file under this worktree; returns its absolute path. */
  writeFile(relativePath: string, contents: string): Promise<string>;
  /** Stages and commits this worktree's tree onto {@link HarnessWorktree.branch}. */
  commitAll(message: string): Promise<void>;
}

const DEFAULT_WORKTREES: WorktreeFixtureSpec[] = [
  { name: 'wt-a', layout: 'sibling' },
  { name: 'wt-b', layout: 'sibling' }
];

const MAX_LOG_LINES = 200;

/**
 * What a barriered server prints once it is parked on the barrier.
 *
 * Duplicated by hand from `READY_MARKER` in
 * `e2e/helpers/registration-barrier-entry.ts`. Importing it from there is not an
 * option: importing that module starts a server.
 */
export const REGISTRATION_BARRIER_READY = 'registration-barrier: ready to register';

/**
 * Markers of `logWorkspaceResolution`'s startup emission in `src/index.ts`.
 *
 * Output matching any of these is retained separately from the rolling
 * {@link MAX_LOG_LINES} buffer. Workspace resolution is emitted **once, at
 * startup**, and these servers then stay up for the rest of a suite: under a
 * plain ring buffer the one piece of evidence a suite asserts on is also the
 * first thing evicted, so a chattier server — or simply a longer scenario —
 * turns a passing assertion into a flake that reads like a resolution bug.
 *
 * Retention beats a bigger buffer or a head-and-tail window because it is not a
 * bet on volume: no amount of later output can push these out, so the assertion
 * cannot start depending on how much the server happened to say. It also does
 * not weaken the guarantee — retention is driven by what the server actually
 * printed, so a server that never infers retains no inference line and
 * {@link WorktreeHarness.getResolutionLogsFor} still fails the assertion.
 */
const RESOLUTION_LOG_MARKERS = [
  'Workspace inferred from the working directory.',
  'Workspace set by ',
  'Git worktree detected.',
  'Shared worktree specs disabled.',
  'Workspace inference disabled.',
  'workspacePath=',
  'workflowRootPath='
];

/**
 * Empties the harness's global registry **without removing its directory**.
 *
 * Deleting `SPEC_WORKFLOW_HOME` between suites looks equivalent and is not: the
 * dashboard watches `activeProjects.json` with chokidar, and when the file does
 * not exist yet that watch lives on the *parent directory*. Removing the
 * directory destroys it permanently — the dashboard then never observes another
 * registration, and every later suite in the same run times out waiting for
 * projects that did register. Truncating the file to `{}` produces the same
 * empty registry and keeps the watch alive.
 *
 * Call it from `beforeAll` in every suite that shares one dashboard.
 */
export async function resetSpecWorkflowHome(specWorkflowHome: string): Promise<void> {
  if (!specWorkflowHome || !isAbsolute(specWorkflowHome)) {
    throw new Error(
      `resetSpecWorkflowHome requires an absolute path. Received: ${JSON.stringify(specWorkflowHome)}`
    );
  }
  await mkdir(specWorkflowHome, { recursive: true });
  await writeFile(join(specWorkflowHome, 'activeProjects.json'), '{}\n', 'utf-8');
}

function buildApprovalPayload(params: {
  id: string;
  title: string;
  filePath: string;
  categoryName: string;
}) {
  return {
    id: params.id,
    title: params.title,
    filePath: params.filePath,
    type: 'document',
    status: 'pending',
    createdAt: new Date().toISOString(),
    category: 'spec',
    categoryName: params.categoryName
  };
}

async function killProcess(child: ChildProcess): Promise<void> {
  if (child.killed || child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export class WorktreeHarness {
  private readonly options: WorktreeHarnessOptions;
  private readonly specs: WorktreeFixtureSpec[];
  private readonly worktrees = new Map<string, HarnessWorktree>();
  private readonly processes = new Map<string, ChildProcess>();
  private readonly logs = new Map<string, string[]>();
  /** Never evicted; see {@link RESOLUTION_LOG_MARKERS}. */
  private readonly resolutionLogs = new Map<string, string[]>();

  private fixture: GitFixture | null = null;
  private repo: GitRepoFixture | null = null;

  constructor(options: WorktreeHarnessOptions) {
    if (!options.specWorkflowHome || !isAbsolute(options.specWorkflowHome)) {
      // The whole point of the isolation: without an absolute override every
      // spawned server falls back to the developer's real global registry and
      // leaves temp-worktree entries in it that nothing can reap.
      throw new Error(
        'WorktreeHarness requires an absolute specWorkflowHome. ' +
        `Received: ${JSON.stringify(options.specWorkflowHome)}`
      );
    }

    this.options = options;
    this.specs = options.worktrees ?? DEFAULT_WORKTREES;
    if (this.specs.length === 0) {
      throw new Error('WorktreeHarness requires at least one worktree fixture.');
    }
  }

  /** Absolute path to the main checkout — the shared workflow root in `shared` mode. */
  getRepoPath(): string {
    if (!this.repo) {
      throw new Error('WorktreeHarness.setup() has not run yet.');
    }
    return this.repo.path;
  }

  getWorktree(name: string): HarnessWorktree {
    const worktree = this.worktrees.get(name);
    if (!worktree) {
      throw new Error(
        `Unknown worktree "${name}". Known: ${[...this.worktrees.keys()].join(', ') || '(none)'}`
      );
    }
    return worktree;
  }

  getWorktrees(): HarnessWorktree[] {
    return [...this.worktrees.values()];
  }

  /** Combined stderr/stdout of every spawned server, newest last. */
  getCapturedLogs(): string {
    return [...this.logs.entries()]
      .map(([name, lines]) => lines.map((line) => `[${name}] ${line}`).join('\n'))
      .join('\n');
  }

  /**
   * Recent captured output of one server — the last {@link MAX_LOG_LINES}
   * chunks, oldest evicted first.
   *
   * For anything the server emits **once at startup**, assert against
   * {@link WorktreeHarness.getResolutionLogsFor} instead: this window is a tail,
   * and a long-running scenario will scroll startup out of it.
   */
  getLogsFor(name: string): string {
    return (this.logs.get(name) ?? []).join('\n');
  }

  /**
   * The workspace-resolution output of one server, retained in full.
   *
   * This is where inference is observable: `src/index.ts` emits exactly one
   * resolution line plus `workspacePath=` / `workflowRootPath=`, so a suite can
   * assert that the workspace was inferred rather than inferring it from the
   * registry alone. Retained out of the rolling buffer so that assertion holds
   * however much the server says afterwards.
   */
  getResolutionLogsFor(name: string): string {
    return (this.resolutionLogs.get(name) ?? []).join('\n');
  }

  async setup(): Promise<void> {
    // Assigned before anything is built so a mid-construction throw is still
    // torn down by cleanup().
    const fixture = await GitFixture.create('specwf-e2e-worktree-');
    this.fixture = fixture;

    const repo = await fixture.createRepo('repo-main');
    this.repo = repo;

    for (const spec of this.specs) {
      const layout = spec.layout ?? 'sibling';
      const worktreeFixture = await repo.addWorktree(spec.name, layout);

      const resolved: HarnessWorktree = {
        name: spec.name,
        path: worktreeFixture.path,
        layout,
        branch: worktreeFixture.branch,
        sourceFile: spec.sourceFile ?? 'src/service.ts',
        sourceContents: spec.sourceContents ?? `export const source = "${spec.name}";\n`,
        specName: spec.specName ?? `spec-${spec.name}`,
        approvalId: spec.approvalId ?? `approval-${spec.name}`,
        approvalFilePath: spec.approvalFilePath ?? spec.sourceFile ?? 'src/service.ts',
        git: (args) => worktreeFixture.git(args),
        mkdirp: (relativePath) => worktreeFixture.mkdirp(relativePath),
        writeFile: (relativePath, contents) => worktreeFixture.writeFile(relativePath, contents),
        commitAll: (message) => worktreeFixture.commitAll(message)
      };

      await worktreeFixture.writeFile(resolved.sourceFile, resolved.sourceContents);

      if (this.options.mode === 'no-shared') {
        await this.seedWorkflowRoot(resolved.path, {
          specName: resolved.specName,
          approvalId: resolved.approvalId,
          approvalFilePath: resolved.approvalFilePath
        });
      }

      this.worktrees.set(resolved.name, resolved);
    }

    if (this.options.mode === 'shared') {
      // The main checkout is the ONLY place a `.spec-workflow` exists in this
      // mode. If the server resolved the workflow root wrongly the dashboard
      // shows no specs at all, which is the failure this seeding makes visible.
      await this.seedWorkflowRoot(repo.path, {
        specName: this.options.sharedSpecName ?? 'spec-shared',
        approvalId: this.options.sharedApprovalId ?? 'approval-shared',
        approvalFilePath: this.options.sharedApprovalFilePath ?? 'src/service.ts'
      });
    }
  }

  private async seedWorkflowRoot(
    rootPath: string,
    seed: { specName: string; approvalId: string; approvalFilePath: string }
  ): Promise<void> {
    const specDir = join(rootPath, '.spec-workflow', 'specs', seed.specName);
    const approvalsDir = join(rootPath, '.spec-workflow', 'approvals', seed.specName);
    await mkdir(specDir, { recursive: true });
    await mkdir(approvalsDir, { recursive: true });
    await writeFile(join(specDir, 'requirements.md'), `# Requirements ${seed.specName}\n`, 'utf-8');

    const approval = buildApprovalPayload({
      id: seed.approvalId,
      title: `Requirements: ${seed.specName}`,
      filePath: seed.approvalFilePath,
      categoryName: seed.specName
    });
    await writeFile(
      join(approvalsDir, `${seed.approvalId}.json`),
      JSON.stringify(approval, null, 2),
      'utf-8'
    );
  }

  /**
   * Starts one server per worktree, serially, waiting for each to appear in the
   * registry before starting the next so a failure names the worktree that
   * caused it.
   */
  async startMcpServers(timeoutMs = 60000): Promise<void> {
    let started = 0;
    for (const worktree of this.worktrees.values()) {
      this.startMcpServer(worktree.name);
      started += 1;
      await this.waitForProjects(started, timeoutMs);
    }
  }

  /**
   * Spawns the MCP server for one worktree.
   *
   * `cwd` is the worktree (requirement 7.2) and the entry is addressed
   * absolutely through `tsx`'s CLI (requirement 7.3) — `npm run` cannot be used
   * from a `cwd` with no `package.json`.
   *
   * The configured path argument models `.mcp.json`, which is tracked in git and
   * byte-identical in every worktree: in shared mode it names the main checkout,
   * which is structurally incapable of naming the current worktree. That gap is
   * exactly what inference closes.
   */
  startMcpServer(name: string): ChildProcess {
    const worktree = this.getWorktree(name);
    if (this.processes.has(name)) {
      throw new Error(`An MCP server is already running for worktree "${name}".`);
    }

    const tsxCli = join(this.options.serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    // The barrier entry is a wrapper around this same `src/index.ts`; it claims
    // the entrypoint and passes the arguments below through unchanged.
    const entryPoint = this.options.registrationBarrier
      ? join(this.options.serverRoot, 'e2e', 'helpers', 'registration-barrier-entry.ts')
      : join(this.options.serverRoot, 'src', 'index.ts');
    for (const required of [tsxCli, entryPoint]) {
      if (!existsSync(required)) {
        throw new Error(`WorktreeHarness cannot spawn the server: ${required} does not exist.`);
      }
    }

    const args = [tsxCli, entryPoint];
    if (this.options.mode === 'shared') {
      args.push(this.getRepoPath());
    } else {
      args.push(worktree.path, '--no-shared-worktree-specs');
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SPEC_WORKFLOW_HOME: this.options.specWorkflowHome
    };
    // Both override resolution ahead of inference. A developer with either
    // exported would otherwise see this harness resolve a workspace it never
    // built, with no signal beyond a failed assertion.
    delete env.SPEC_WORKFLOW_WORKSPACE;
    delete env.SPEC_WORKFLOW_SHARED_ROOT;

    const child = spawn(process.execPath, args, {
      cwd: worktree.path,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const lines: string[] = [];
    this.logs.set(name, lines);
    const resolutionLines: string[] = [];
    this.resolutionLogs.set(name, resolutionLines);
    const appendLog = (chunk: Buffer, source: 'stdout' | 'stderr') => {
      const entry = `[${source}] ${chunk.toString().trimEnd()}`;
      if (RESOLUTION_LOG_MARKERS.some((marker) => entry.includes(marker))) {
        resolutionLines.push(entry);
      }
      lines.push(entry);
      if (lines.length > MAX_LOG_LINES) {
        lines.shift();
      }
    };

    child.stdout.on('data', (chunk) => appendLog(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => appendLog(chunk, 'stderr'));
    child.on('error', (error) => {
      lines.push(`[error] Failed to spawn MCP for ${worktree.path}: ${error.message}`);
    });

    this.processes.set(name, child);
    return child;
  }

  /**
   * Waits until every named server is parked on the registration barrier.
   *
   * Requires {@link WorktreeHarnessOptions.registrationBarrier}. Waiting on the
   * marker rather than on a sleep is what makes the release simultaneous *by
   * construction*: each server has finished transpiling, inferring its
   * workspace and initializing the workflow root before it prints, so what is
   * left after the release is the critical section and nothing else.
   */
  async waitForRegistrationBarrier(names: string[], timeoutMs = 60000): Promise<void> {
    if (!this.options.registrationBarrier) {
      throw new Error(
        'waitForRegistrationBarrier requires the harness to be constructed with registrationBarrier: true.'
      );
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (names.every((name) => this.getLogsFor(name).includes(REGISTRATION_BARRIER_READY))) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(
      `Timed out waiting for ${names.join(', ')} to reach the registration barrier.\n` +
      this.getCapturedLogs()
    );
  }

  /**
   * Releases every named server from the barrier at one shared instant.
   *
   * The instant, not the message, is what synchronises them: the writes go out
   * in one synchronous block, but N processes waking from a blocking read is N
   * scheduling decisions and on a loaded machine those can land far enough apart
   * for one contender to finish before the next starts. `leadTimeMs` is the
   * budget that wake-up gets, after which every contender proceeds off the same
   * wall clock.
   */
  releaseRegistrationBarrier(names: string[], leadTimeMs = 250): void {
    const releaseAt = Date.now() + leadTimeMs;
    for (const name of names) {
      const child = this.processes.get(name);
      if (!child?.stdin) {
        throw new Error(`No barriered server is running for worktree "${name}".`);
      }
      child.stdin.write(`go ${releaseAt}\n`);
    }
  }

  /**
   * Waits until `expectedCount` of this fixture's worktrees are listed by the
   * dashboard.
   *
   * Matching is exact, not by suffix: both sides are `realpath`-normalized —
   * the fixture root by {@link GitFixture}, the registered path by
   * `generateProjectId`/`registerProject` — so an inexact match here would be
   * hiding a normalization bug rather than tolerating one.
   */
  async waitForProjects(
    expectedCount = this.worktrees.size,
    timeoutMs = 60000
  ): Promise<RegisteredProject[]> {
    const startedAt = Date.now();
    const url = `${this.options.dashboardApiBaseUrl}/api/projects/list`;
    const fixturePaths = new Set(this.getWorktrees().map((worktree) => worktree.path));
    let lastBody = '';

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const body = await response.json() as RegisteredProject[];
          lastBody = JSON.stringify(body);
          const worktreeProjects = body.filter((project) => fixturePaths.has(project.projectPath));

          if (worktreeProjects.length === expectedCount) {
            return worktreeProjects;
          }
        }
      } catch {
        // Dashboard may still be starting.
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(
      `Timed out waiting for ${expectedCount} MCP projects.\n` +
      `Expected worktree paths: ${[...fixturePaths].join(', ')}\n` +
      `Last /api/projects/list payload: ${lastBody}\n` +
      `Recent MCP logs:\n${this.getCapturedLogs()}`
    );
  }

  /**
   * Entries in the harness's own `activeProjects.json`, restricted to this
   * fixture's worktrees.
   *
   * The list endpoint reports `projectPath` only, so this is the only way to
   * assert the *workflow root* a server settled on — the observable that
   * separates shared mode from no-shared mode.
   */
  async readRegistry(): Promise<RegistryEntry[]> {
    const registryPath = join(this.options.specWorkflowHome, 'activeProjects.json');
    const raw = await readFile(registryPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, RegistryEntry>;
    const fixturePaths = new Set(this.getWorktrees().map((worktree) => worktree.path));
    return Object.values(parsed).filter((entry) => fixturePaths.has(entry.projectPath));
  }

  async stopMcpServer(name: string): Promise<void> {
    const child = this.processes.get(name);
    if (!child) {
      return;
    }
    await killProcess(child);
    this.processes.delete(name);
  }

  async cleanup(): Promise<void> {
    for (const name of [...this.processes.keys()]) {
      await this.stopMcpServer(name);
    }

    this.worktrees.clear();
    this.logs.clear();
    this.resolutionLogs.clear();

    if (this.fixture) {
      await this.fixture.cleanup();
      this.fixture = null;
      this.repo = null;
    }
  }
}
