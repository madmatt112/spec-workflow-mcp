/**
 * `resolveWorkspaceRoots` — the full precedence matrix, against real git
 * repositories (requirements 1.1-1.4, 1.7, 1.8, 1.14, 1.15, 2.1-2.11).
 *
 * These run against the real binary over task 1's fixture rather than a mocked
 * `child_process`: the gates this resolver applies are gates on what git
 * actually reports, and a mock can only return what the test already believes.
 *
 * `validateInferredWorkspace` (`src/server.ts`) is covered here too — it is the
 * async half of requirement 1.8, split out of the resolver only because
 * `validateProjectPath` cannot be awaited from a synchronous `parseArguments`.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { chmod, mkdir, writeFile } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  resolveWorkspaceRoots,
  SPEC_WORKFLOW_WORKSPACE_ENV,
  SPEC_WORKFLOW_SHARED_ROOT_ENV
} from '../core/git-utils.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../core/global-dir.js';
import { validateInferredWorkspace, settleWorkspaceRoots } from '../server.js';
import { validateProjectPath } from '../core/path-utils.js';
import { logWorkspaceResolution } from '../index.js';
import {
  GitFixture,
  GitRepoFixture,
  GitWorktreeFixture,
  BareRepoFixture,
  cleanupAllGitFixtures
} from '../core/__tests__/helpers/git-fixture.js';

let fixture: GitFixture;
let main: GitRepoFixture;
let mainSubdir: string;
let mainGitDir: string;
let worktree: GitWorktreeFixture;
let unrelated: GitRepoFixture;
let bare: BareRepoFixture;
let nonGitA: string;
let nonGitB: string;
let regularFile: string;
let worktreeSubdir: string;

const savedEnv: Record<string, string | undefined> = {};
let warnSpy: ReturnType<typeof vi.spyOn>;

/** Defaults for the options every case varies one axis of. */
function roots(overrides: {
  configuredPath: string;
  cwd: string;
  dashboardMode?: boolean;
  noInference?: boolean;
  noSharedWorktreeSpecs?: boolean;
}) {
  return resolveWorkspaceRoots({
    dashboardMode: false,
    noInference: false,
    noSharedWorktreeSpecs: false,
    ...overrides
  });
}

beforeAll(async () => {
  for (const key of [SPEC_WORKFLOW_WORKSPACE_ENV, SPEC_WORKFLOW_SHARED_ROOT_ENV]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }

  // Assign before building so a mid-construction throw is still torn down.
  fixture = await GitFixture.create('specwf-workspace-roots-');

  main = await fixture.createRepo('main');
  mainSubdir = await main.mkdirp('src/core');
  mainGitDir = join(main.path, '.git');
  worktree = await main.addWorktree('wt-a', 'sibling');
  worktreeSubdir = await worktree.mkdirp('src/core');

  unrelated = await fixture.createRepo('unrelated');
  bare = await fixture.createBareRepo('bare.git');

  nonGitA = await fixture.createNonGitDirectory('plain-a');
  nonGitB = await fixture.createNonGitDirectory('plain-b');

  regularFile = join(fixture.root, 'not-a-directory.txt');
  await writeFile(regularFile, 'file\n', 'utf-8');
});

afterAll(async () => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  // Explicit teardown: vitest's worker pool never emits process 'exit'
  // (deferral d-2124a571).
  await fixture?.cleanup();
});

afterAll(cleanupAllGitFixtures);

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  delete process.env[SPEC_WORKFLOW_WORKSPACE_ENV];
  delete process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV];
});

afterEach(() => {
  warnSpy?.mockRestore();
});

describe('inference (requirements 1.1-1.4, 1.7)', () => {
  it('adopts the cwd top-level when the two paths are different checkouts of one repository', () => {
    const result = roots({ configuredPath: main.path, cwd: worktree.path });

    expect(result.workspacePath).toBe(worktree.path);
    expect(result.source).toBe('inference');
  });

  it('adopts the cwd top-level from a subdirectory of the worktree', () => {
    const result = roots({ configuredPath: main.path, cwd: worktreeSubdir });

    expect(result.workspacePath).toBe(worktree.path);
    expect(result.source).toBe('inference');
  });

  it('does not fire when both paths resolve to the same top-level', () => {
    const result = roots({ configuredPath: mainSubdir, cwd: mainSubdir });

    expect(result.source).toBe('argument');
    // Requirement 1.2: the top-level directory, NOT the configured path
    // verbatim. Returning the subdirectory would move projectId and narrow
    // containment for every single-checkout user.
    expect(result.workspacePath).toBe(main.path);
    expect(result.workspacePath).not.toBe(mainSubdir);
  });

  it('does not fire across repositories, leaving the configured top-level (requirement 1.3)', () => {
    const result = roots({ configuredPath: main.path, cwd: unrelated.path });

    expect(result.workspacePath).toBe(main.path);
    expect(result.source).toBe('argument');
  });

  it('does not fire when the cwd has no top-level, as in a bare repository (requirement 1.7)', () => {
    // The gate's whole point: a bare repository reports a usable common
    // directory and no work tree, so without the top-level gate the differing
    // "top-levels" precondition would be satisfied by a fallback-to-input.
    const result = roots({ configuredPath: main.path, cwd: bare.path });

    expect(result.workspacePath).toBe(main.path);
    expect(result.source).toBe('argument');
  });

  it('does not fire when the configured path has no top-level, as inside a .git directory', () => {
    const result = roots({ configuredPath: mainGitDir, cwd: worktree.path });

    expect(result.source).toBe('argument');
    expect(result.workspacePath).not.toBe(worktree.path);
  });

  it('does not fire between two directories in no repository at all (requirement 1.4)', () => {
    const result = roots({ configuredPath: nonGitA, cwd: nonGitB });

    expect(result.workspacePath).toBe(nonGitA);
    expect(result.source).toBe('argument');
  });

  it('leaves a non-git configured path unchanged when the cwd is a repository', () => {
    const result = roots({ configuredPath: nonGitA, cwd: worktree.path });

    expect(result.workspacePath).toBe(nonGitA);
    expect(result.source).toBe('argument');
  });
});

describe('--no-workspace-inference (requirement 1.15)', () => {
  it('suppresses inference and uses the configured path top-level', () => {
    const result = roots({ configuredPath: main.path, cwd: worktree.path, noInference: true });

    expect(result.workspacePath).toBe(main.path);
    expect(result.source).toBe('flag');
  });

  it('still resolves the configured path to its top-level, not verbatim', () => {
    const result = roots({ configuredPath: mainSubdir, cwd: worktree.path, noInference: true });

    expect(result.workspacePath).toBe(main.path);
  });
});

describe('dashboard mode (requirements 1.14, 2.10, 2.11)', () => {
  it('skips inference', () => {
    const result = roots({ configuredPath: main.path, cwd: worktree.path, dashboardMode: true });

    expect(result.workspacePath).toBe(main.path);
    expect(result.source).toBe('argument');
  });

  it('ignores SPEC_WORKFLOW_WORKSPACE', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = worktree.path;

    const result = roots({ configuredPath: main.path, cwd: main.path, dashboardMode: true });

    expect(result.source).toBe('argument');
    expect(result.workspacePath).toBe(main.path);
  });

  it('is an input distinct from --no-workspace-inference', () => {
    // Both suppress inference; only the flag reports itself as the reason.
    expect(roots({ configuredPath: main.path, cwd: worktree.path, dashboardMode: true }).source)
      .toBe('argument');
    expect(roots({ configuredPath: main.path, cwd: worktree.path, noInference: true }).source)
      .toBe('flag');
  });
});

describe('SPEC_WORKFLOW_WORKSPACE (requirements 2.1-2.6)', () => {
  it('overrides inference and the configured path', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = worktree.path;

    const result = roots({ configuredPath: main.path, cwd: main.path });

    expect(result.workspacePath).toBe(worktree.path);
    expect(result.source).toBe('env');
  });

  it('outranks --no-workspace-inference (requirement 2.3)', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = worktree.path;

    const result = roots({ configuredPath: main.path, cwd: main.path, noInference: true });

    expect(result.workspacePath).toBe(worktree.path);
    expect(result.source).toBe('env');
  });

  it.each([['', 'empty'], ['   ', 'whitespace-only']])(
    'falls through to inference when %s (%s)',
    (value) => {
      process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = value;

      const result = roots({ configuredPath: main.path, cwd: worktree.path });

      expect(result.workspacePath).toBe(worktree.path);
      expect(result.source).toBe('inference');
    }
  );

  it('falls through when the value names a file, not a directory (requirement 2.4)', () => {
    // A file passes a mere existence test and then throws inside `initialize`,
    // killing the MCP handshake.
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = regularFile;

    const result = roots({ configuredPath: main.path, cwd: worktree.path });

    expect(result.workspacePath).toBe(worktree.path);
    expect(result.source).toBe('inference');
  });

  it('falls through when the value does not exist', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = join(fixture.root, 'no-such-directory');

    const result = roots({ configuredPath: main.path, cwd: worktree.path });

    expect(result.source).toBe('inference');
  });

  it('logs the bad value rather than aborting (requirement 2.5)', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = regularFile;

    expect(() => roots({ configuredPath: main.path, cwd: main.path })).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(SPEC_WORKFLOW_WORKSPACE_ENV));
  });

  it('warns when the value is in a different repository, and still uses it (requirement 2.6)', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = unrelated.path;

    const result = roots({ configuredPath: main.path, cwd: main.path });

    expect(result.workspacePath).toBe(unrelated.path);
    expect(result.source).toBe('env');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not in the same repository'));
  });

  it('does not warn for a worktree of the same repository', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = worktree.path;

    roots({ configuredPath: main.path, cwd: main.path });

    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('not in the same repository'));
  });

  it('does not warn when the value names the configured path itself outside any repository', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = nonGitA;

    const result = roots({ configuredPath: nonGitA, cwd: nonGitA });

    expect(result.workspacePath).toBe(nonGitA);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('not in the same repository'));
  });
});

describe('workflow root (requirements 2.7-2.9)', () => {
  it('resolves from the configured path argument by default (requirement 2.7)', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = worktree.path;

    const result = roots({ configuredPath: mainSubdir, cwd: mainSubdir });

    expect(result.workspacePath).toBe(worktree.path);
    expect(result.workflowRootPath).toBe(main.path);
  });

  it('is the main repository when the configured path is a worktree', () => {
    const result = roots({ configuredPath: worktree.path, cwd: worktree.path });

    expect(result.workspacePath).toBe(worktree.path);
    expect(result.workflowRootPath).toBe(main.path);
  });

  it('equals an inferred workspace under --no-shared-worktree-specs (requirement 2.8)', () => {
    const result = roots({
      configuredPath: main.path,
      cwd: worktree.path,
      noSharedWorktreeSpecs: true
    });

    expect(result.source).toBe('inference');
    expect(result.workflowRootPath).toBe(worktree.path);
    expect(result.workflowRootPath).toBe(result.workspacePath);
  });

  it('equals an environment workspace under --no-shared-worktree-specs (requirement 2.8)', () => {
    process.env[SPEC_WORKFLOW_WORKSPACE_ENV] = worktree.path;

    const result = roots({
      configuredPath: main.path,
      cwd: main.path,
      noSharedWorktreeSpecs: true
    });

    expect(result.workflowRootPath).toBe(worktree.path);
  });

  it('lets SPEC_WORKFLOW_SHARED_ROOT outrank --no-shared-worktree-specs (requirement 2.9)', () => {
    process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = unrelated.path;

    const result = roots({
      configuredPath: worktree.path,
      cwd: worktree.path,
      noSharedWorktreeSpecs: true
    });

    expect(result.workflowRootPath).toBe(unrelated.path);
  });

  it('resolves a relative SPEC_WORKFLOW_SHARED_ROOT to absolute (requirement 2.9)', () => {
    process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = 'relative-shared-root';

    const result = roots({ configuredPath: main.path, cwd: main.path });

    expect(result.workflowRootPath).toBe(join(process.cwd(), 'relative-shared-root'));
  });
});

describe('validateInferredWorkspace (requirement 1.8)', () => {
  it('returns the inferred path when it passes validation', async () => {
    expect(await validateInferredWorkspace(worktree.path, main.path)).toBe(worktree.path);
  });

  it('falls back to the configured top-level when the inferred path is not a directory', async () => {
    expect(await validateInferredWorkspace(regularFile, main.path)).toBe(main.path);
  });

  it('falls back when the inferred path does not exist', async () => {
    const missing = join(fixture.root, 'no-such-workspace');

    expect(await validateInferredWorkspace(missing, main.path)).toBe(main.path);
  });

  it('logs rather than throwing, so a rejected inference cannot kill the handshake', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(validateInferredWorkspace(regularFile, main.path)).resolves.toBe(main.path);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Inferred workspace path'));

    errorSpy.mockRestore();
  });

  /**
   * Requirements 1.8 and 1.18 meet here. `main()` resolves, then validates
   * inside `initialize`, then logs — in that order, because the validation can
   * overturn the inference. This composes the two seams `main()` composes and
   * asserts stderr never carries two different workspace paths as fact.
   */
  it('settles the path before the resolution is logged, so stderr never contradicts itself', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resolved = roots({ configuredPath: main.path, cwd: worktree.path });
    expect(resolved.source).toBe('inference');

    // Stand in for a worktree that `validateProjectPath` rejects.
    const settled = await validateInferredWorkspace(regularFile, main.path);
    logWorkspaceResolution({
      workspacePath: settled,
      workflowRootPath: resolved.workflowRootPath,
      source: settled === regularFile ? resolved.source : 'argument',
      noSharedWorktreeSpecs: false,
      noWorkspaceInference: false
    });

    const lines = errorSpy.mock.calls.map((call) => String(call[0]));
    const claims = lines.filter((line) => line.startsWith('workspacePath='));
    expect(claims).toEqual([`workspacePath=${main.path}`]);
    expect(lines.some((line) => line.startsWith('workspacePath=') && line.includes(regularFile))).toBe(false);

    errorSpy.mockRestore();
  });
});

/**
 * The combination the precedence matrix above leaves open: requirement 2.8 ties
 * the workflow root to the workspace under `--no-shared-worktree-specs`, and
 * requirement 1.8 then moves the workspace off a rejected inference. Settling
 * only the workspace leaves the workflow root on the rejected path, where
 * `initialize`'s `validateProjectPath(this.projectPath)` throws — aborting
 * startup before the transport connects, the one outcome requirement 1.8
 * forbids.
 */
describe('settleWorkspaceRoots (requirements 1.8, 2.8)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy?.mockRestore();
  });

  it('moves both roots off a rejected inference when --no-shared-worktree-specs tied them', async () => {
    // What resolution produces for this combination: one path, twice.
    const resolved = roots({
      configuredPath: main.path,
      cwd: worktree.path,
      noSharedWorktreeSpecs: true
    });
    expect(resolved.source).toBe('inference');
    expect(resolved.workflowRootPath).toBe(resolved.workspacePath);

    // `regularFile` stands in for an inferred workspace `validateProjectPath`
    // rejects, pinned to both roots exactly as the flag pins them.
    const settled = await settleWorkspaceRoots(regularFile, regularFile, main.path);

    expect(settled.workspacePath).toBe(main.path);
    expect(settled.workflowRootPath).toBe(main.path);
    // The predicate that used to throw here, on the root that used to be stale.
    await expect(validateProjectPath(settled.workflowRootPath)).resolves.toBeDefined();
    await expect(validateProjectPath(settled.workspacePath)).resolves.toBeDefined();
  });

  it('leaves a workflow root that resolved independently of the workspace', async () => {
    const settled = await settleWorkspaceRoots(main.path, regularFile, main.path);

    expect(settled.workspacePath).toBe(main.path);
    expect(settled.workflowRootPath).toBe(main.path);
  });

  it('leaves an explicit shared root alone while the workspace falls back', async () => {
    const settled = await settleWorkspaceRoots(unrelated.path, regularFile, main.path);

    expect(settled.workflowRootPath).toBe(unrelated.path);
    expect(settled.workspacePath).toBe(main.path);
  });

  it('touches neither root when the workspace was not inferred', async () => {
    // No fallback argument means no inference to overturn — the env-override,
    // flag and argument arms all land here, including under the flag that ties
    // the roots together.
    const settled = await settleWorkspaceRoots(worktree.path, worktree.path, undefined);

    expect(settled).toEqual({ workflowRootPath: worktree.path, workspacePath: worktree.path });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('keeps an accepted inference on both roots', async () => {
    const settled = await settleWorkspaceRoots(worktree.path, worktree.path, main.path);

    expect(settled).toEqual({ workflowRootPath: worktree.path, workspacePath: worktree.path });
  });
});

/**
 * The `finally` in `main()`, against the real CLI (requirement 1.18).
 *
 * The seam test above hands `logWorkspaceResolution` values that are *already*
 * settled, so it passes whether the `finally` reads the settled roots off the
 * server or the provisional locals it passed into `initialize`. The two only
 * diverge when a startup rejects an inference **and** throws afterwards, and
 * `main()` is not exported — so the only way to pin the distinction down is to
 * run the CLI the way a user runs it.
 *
 * The scenario: cwd is a worktree `validateProjectPath` rejects, so the
 * workspace falls back to the configured path's toplevel; the shared root names
 * a directory that does not exist, so `initialize` throws *after* that fallback
 * is in force. A failed startup is exactly when the resolved workspace most
 * needs to be visible, and what it must show is the path that is in force —
 * not the one the rejection notice on the line above already disowned.
 */
describe('main() emission when initialize throws after a rejected inference (requirement 1.18)', () => {
  const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.ts');
  // `--import tsx` resolves against the child's cwd, and the child's cwd has to
  // be the worktree for inference to fire at all. Resolve the loader from here,
  // where the repository's `node_modules` is reachable, and pass it absolute.
  const TSX_LOADER = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

  let readOnlyWorktree: GitWorktreeFixture;
  let specWorkflowHome: string;
  let missingSharedRoot: string;

  beforeAll(async () => {
    readOnlyWorktree = await main.addWorktree('wt-readonly', 'sibling');
    // A git toplevel is always an existing directory, so the write bit is the
    // only way to make an inferred workspace fail the way requirement 1.8
    // anticipates. `git rev-parse` still works from inside it.
    await chmod(readOnlyWorktree.path, 0o555);

    specWorkflowHome = join(fixture.root, 'spec-workflow-home');
    await mkdir(specWorkflowHome, { recursive: true });
    missingSharedRoot = join(fixture.root, 'no-such-shared-root');
  });

  afterAll(async () => {
    // Restore before the fixture's recursive remove: entries cannot be unlinked
    // from a directory with no write bit.
    await chmod(readOnlyWorktree.path, 0o755).catch(() => {});
  });

  function runCli(...args: string[]): Promise<{ code: number | null; stderr: string }> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, ['--import', TSX_LOADER, CLI_PATH, ...args], {
        cwd: readOnlyWorktree.path,
        env: {
          ...process.env,
          [SPEC_WORKFLOW_HOME_ENV]: specWorkflowHome,
          [SPEC_WORKFLOW_SHARED_ROOT_ENV]: missingSharedRoot
        },
        stdio: ['ignore', 'ignore', 'pipe']
      });

      let stderr = '';
      child.stderr!.setEncoding('utf-8');
      child.stderr!.on('data', (chunk: string) => { stderr += chunk; });
      child.on('error', rejectPromise);
      child.on('close', (code) => resolvePromise({ code, stderr }));
    });
  }

  it('reports the settled workspace, not the inference that was rejected', async () => {
    const { code, stderr } = await runCli(main.path);
    const lines = stderr.split('\n');

    // The scenario really occurred: inference fired, was overturned, and
    // `initialize` then threw on the other root.
    expect(stderr).toContain(`Inferred workspace path "${readOnlyWorktree.path}" was rejected`);
    expect(stderr).toContain(`Project path does not exist: ${missingSharedRoot}`);
    expect(code).toBe(1);

    // One emission, and it names the fallback. Reading the provisional local
    // here instead of `server.settledWorkspacePath` prints the worktree the
    // rejection notice just disowned.
    expect(lines.filter((line) => line.startsWith('workspacePath='))).toEqual([`workspacePath=${main.path}`]);
    expect(lines.filter((line) => line.startsWith('workflowRootPath='))).toEqual([
      `workflowRootPath=${missingSharedRoot}`
    ]);
    // The settled path also settles the `source` arm to `argument`, so the
    // inference headline cannot reappear to contradict the notice either.
    expect(stderr).not.toContain('Workspace inferred from the working directory');
  }, 60_000);
});
