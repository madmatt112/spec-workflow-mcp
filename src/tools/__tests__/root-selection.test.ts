/**
 * `selectRoots` — requirements 3.5 - 3.10.
 *
 * Real repositories, not mocks: every assertion about the derivation is an
 * assertion about what git actually reports for that layout. `git-utils.js` is
 * wrapped rather than replaced — the wrappers count calls and delegate to the
 * real implementations — because the memoization criterion (3.9) is a claim
 * about how many times git runs, which a stub cannot demonstrate.
 *
 * Teardown is an explicit `afterAll`: vitest's worker pool never emits the
 * process `exit` the fixture's backstop hook listens for.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import {
  GitFixture,
  GitRepoFixture,
  GitWorktreeFixture,
  cleanupAllGitFixtures,
} from '../../core/__tests__/helpers/git-fixture.js';
import { ToolContext } from '../../types.js';

const gitCalls = vi.hoisted(() => ({
  resolveGitRoot: [] as string[],
  gitCommonDirAbsolute: [] as string[],
}));

vi.mock('../../core/git-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/git-utils.js')>();
  return {
    ...actual,
    resolveGitRoot: (p: string) => {
      gitCalls.resolveGitRoot.push(p);
      return actual.resolveGitRoot(p);
    },
    gitCommonDirAbsolute: (p: string) => {
      gitCalls.gitCommonDirAbsolute.push(p);
      return actual.gitCommonDirAbsolute(p);
    },
  };
});

import {
  ROOT_SELECTION_CACHE_LIMIT,
  _resetRootSelection,
  _rootSelectionCacheSize,
  _rootSelectionWarnLedgerSize,
  selectRoots,
} from '../root-selection.js';
import { reviewTaskHandler } from '../review-task.js';
import { logImplementationHandler } from '../log-implementation.js';
import { adversarialReviewHandler } from '../adversarial-review.js';
import { adversarialResponseHandler } from '../adversarial-response.js';

let fixture: GitFixture;
let repo: GitRepoFixture;
let worktree: GitWorktreeFixture;
let elsewhere: string;
let warnSpy: ReturnType<typeof vi.spyOn>;

const savedEnv: Record<string, string | undefined> = {};

function ctx(projectPath: string, workspacePath = projectPath): ToolContext {
  return { projectPath, workspacePath };
}

function warnings(): string[] {
  return warnSpy.mock.calls.map((call: unknown[]) => String(call[0]));
}

beforeAll(async () => {
  for (const key of ['SPEC_WORKFLOW_HOME', 'SPEC_WORKFLOW_SHARED_ROOT', 'SPEC_WORKFLOW_WORKSPACE']) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  fixture = await GitFixture.create('specwf-root-selection-');
  repo = await fixture.createRepo('main-checkout');
  worktree = await repo.addWorktree('feature');
  elsewhere = await fixture.createNonGitDirectory('not-a-repo');
});

afterAll(async () => {
  warnSpy?.mockRestore();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  await fixture?.cleanup();
  await cleanupAllGitFixtures();
});

beforeEach(() => {
  _resetRootSelection();
  warnSpy.mockClear();
  gitCalls.resolveGitRoot.length = 0;
  gitCalls.gitCommonDirAbsolute.length = 0;
});

describe('selectRoots — no override (requirement 3.10)', () => {
  it('passes both context roots through untouched and asks git nothing', () => {
    const roots = selectRoots({ specName: 'x' } as any, ctx(repo.path, worktree.path));

    expect(roots).toEqual({ workflowRoot: repo.path, workspacePath: worktree.path });
    expect(gitCalls.resolveGitRoot).toEqual([]);
    expect(gitCalls.gitCommonDirAbsolute).toEqual([]);
    expect(warnings()).toEqual([]);
  });

  it('treats an empty projectPath as absent', () => {
    const roots = selectRoots({ projectPath: '' }, ctx(repo.path, worktree.path));

    expect(roots).toEqual({ workflowRoot: repo.path, workspacePath: worktree.path });
    expect(gitCalls.resolveGitRoot).toEqual([]);
  });
});

describe('selectRoots — override (requirements 3.5, 3.6)', () => {
  it('makes a worktree override the workspace and derives the main checkout as the workflow root', () => {
    const roots = selectRoots({ projectPath: worktree.path }, ctx(elsewhere, elsewhere));

    // The defect AC 3.6 prevents: `workflowRoot === worktree.path` would send
    // every `.spec-workflow` lookup inside the worktree.
    expect(roots.workspacePath).toBe(worktree.path);
    expect(roots.workflowRoot).toBe(repo.path);
  });

  it('warns naming the override, the discarded context workspacePath and the derived root', () => {
    selectRoots({ projectPath: worktree.path }, ctx(elsewhere, elsewhere));

    const warning = warnings().find((message) => message.includes('overrides the server context'));
    expect(warning).toBeDefined();
    expect(warning).toContain(worktree.path);
    expect(warning).toContain(elsewhere);
    expect(warning).toContain(repo.path);
  });

  it('does not report a degradation for a plain main checkout, whose root IS the override', () => {
    const roots = selectRoots({ projectPath: repo.path }, ctx(elsewhere, elsewhere));

    expect(roots).toEqual({ workflowRoot: repo.path, workspacePath: repo.path });
    // `resolveGitRoot` returns its input here too, but correctly: the common
    // directory is `<override>/.git`. A "could not derive" warning on this path
    // would fire for the most ordinary override there is.
    expect(warnings().filter((message) => message.includes('Could not derive'))).toEqual([]);
  });
});

describe('selectRoots — every degradation to verbatim warns (requirement 3.7)', () => {
  it('warns when git fails: the override is not inside a repository', () => {
    const roots = selectRoots({ projectPath: elsewhere }, ctx(repo.path, repo.path));

    expect(roots.workflowRoot).toBe(elsewhere);
    const warning = warnings().find((message) => message.includes('Could not derive'));
    expect(warning).toContain('not inside a git repository');
    expect(warning).toContain(elsewhere);
  });

  it('warns when the common directory has no ".git" segment (--separate-git-dir)', async () => {
    const separate = await fixture.createSeparateGitDirRepo('detached-gitdir');

    const roots = selectRoots({ projectPath: separate.path }, ctx(repo.path, repo.path));

    expect(roots.workflowRoot).toBe(separate.path);
    const warning = warnings().find((message) => message.includes('Could not derive'));
    expect(warning).toContain('--separate-git-dir');
    expect(warning).toContain(separate.gitDir);
  });

  it('warns for a bare repository, whose common directory is "."', async () => {
    const bare = await fixture.createBareRepo('bare-repo');

    const roots = selectRoots({ projectPath: bare.path }, ctx(repo.path, repo.path));

    expect(roots.workflowRoot).toBe(bare.path);
    const warning = warnings().find((message) => message.includes('Could not derive'));
    expect(warning).toContain('bare repository');
  });

  it('warns when SPEC_WORKFLOW_SHARED_ROOT outranks the derivation', () => {
    process.env.SPEC_WORKFLOW_SHARED_ROOT = repo.path;
    try {
      const roots = selectRoots({ projectPath: worktree.path }, ctx(elsewhere, elsewhere));

      expect(roots.workflowRoot).toBe(resolve(repo.path));
      expect(roots.workspacePath).toBe(worktree.path);
      const warning = warnings().find((message) => message.includes('outranks'));
      expect(warning).toContain('SPEC_WORKFLOW_SHARED_ROOT');
      expect(warning).toContain(worktree.path);
    } finally {
      delete process.env.SPEC_WORKFLOW_SHARED_ROOT;
    }
  });

  it('does not cache the shared-root arm, so unsetting the variable derives again', () => {
    process.env.SPEC_WORKFLOW_SHARED_ROOT = elsewhere;
    try {
      expect(selectRoots({ projectPath: worktree.path }, ctx(elsewhere)).workflowRoot)
        .toBe(resolve(elsewhere));
    } finally {
      delete process.env.SPEC_WORKFLOW_SHARED_ROOT;
    }

    expect(selectRoots({ projectPath: worktree.path }, ctx(elsewhere)).workflowRoot).toBe(repo.path);
  });
});

describe('selectRoots — memoization and its bound (requirement 3.9)', () => {
  it('runs the git derivation once per override value however often it is called', () => {
    const first = selectRoots({ projectPath: worktree.path }, ctx(elsewhere));
    const second = selectRoots({ projectPath: worktree.path }, ctx(elsewhere));
    const third = selectRoots({ projectPath: worktree.path }, ctx(elsewhere));

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(gitCalls.resolveGitRoot).toEqual([worktree.path]);
    expect(gitCalls.gitCommonDirAbsolute).toEqual([]);
  });

  it('caps the cache, so an agent varying the value cannot grow it without bound', () => {
    const extra = 8;
    for (let i = 0; i < ROOT_SELECTION_CACHE_LIMIT + extra; i++) {
      // Paths that do not exist: git fails immediately, no process is spawned.
      selectRoots({ projectPath: join(elsewhere, `missing-${i}`) }, ctx(elsewhere));
    }

    expect(_rootSelectionCacheSize()).toBe(ROOT_SELECTION_CACHE_LIMIT);
    expect(gitCalls.resolveGitRoot).toHaveLength(ROOT_SELECTION_CACHE_LIMIT + extra);
  });

  it('evicts oldest-first, so the newest entries survive', () => {
    for (let i = 0; i < ROOT_SELECTION_CACHE_LIMIT; i++) {
      selectRoots({ projectPath: join(elsewhere, `filler-${i}`) }, ctx(elsewhere));
    }
    selectRoots({ projectPath: worktree.path }, ctx(elsewhere));
    const callsBefore = gitCalls.resolveGitRoot.length;

    selectRoots({ projectPath: worktree.path }, ctx(elsewhere));

    expect(gitCalls.resolveGitRoot).toHaveLength(callsBefore);
    expect(_rootSelectionCacheSize()).toBe(ROOT_SELECTION_CACHE_LIMIT);
  });
});

/**
 * The warn-once ledger is the second map keyed by the agent-supplied override,
 * so the same bound applies to it: unbounded, it leaks a key per distinct
 * override for the lifetime of the process even though nothing is memoized.
 * Each override contributes two keys — the degradation warning and the override
 * warning — so half the limit's worth of overrides fills it.
 */
describe('selectRoots — the warn-once ledger and its bound (requirement 3.9)', () => {
  it('caps the warn-once ledger, so an agent varying the value cannot grow it without bound', () => {
    const extra = 8;
    for (let i = 0; i < ROOT_SELECTION_CACHE_LIMIT + extra; i++) {
      // Paths that do not exist: git fails immediately, no process is spawned.
      selectRoots({ projectPath: join(elsewhere, `missing-${i}`) }, ctx(elsewhere));
    }

    expect(_rootSelectionWarnLedgerSize()).toBe(ROOT_SELECTION_CACHE_LIMIT);
  });

  it('evicts warn keys oldest-first, so an aged-out override warns again', () => {
    const aged = join(elsewhere, 'aged-out');
    selectRoots({ projectPath: aged }, ctx(elsewhere));
    const before = warnings().filter((message) => message.includes(aged)).length;
    expect(before).toBeGreaterThan(0);

    for (let i = 0; i < Math.ceil(ROOT_SELECTION_CACHE_LIMIT / 2); i++) {
      selectRoots({ projectPath: join(elsewhere, `filler-${i}`) }, ctx(elsewhere));
    }
    selectRoots({ projectPath: aged }, ctx(elsewhere));

    // Its derivation is still cached — git is not asked again — so the repeated
    // warnings can only come from the ledger having evicted its keys.
    expect(warnings().filter((message) => message.includes(aged))).toHaveLength(before * 2);
    expect(_rootSelectionWarnLedgerSize()).toBe(ROOT_SELECTION_CACHE_LIMIT);
  });
});

/**
 * The four tools of requirement 3.8, each given a worktree as `args.projectPath`
 * while the context points at an unrelated directory. Every one of them must
 * find its `.spec-workflow` on the derived main checkout; finding it (or not)
 * is the observable, so the assertions cannot pass with the override taken
 * verbatim.
 */
describe('the four override sites (requirement 3.8)', () => {
  const specName = 'override-spec';
  let specPath: string;

  beforeAll(async () => {
    specPath = join(repo.path, '.spec-workflow', 'specs', specName);
    await fs.mkdir(join(specPath, 'reviews'), { recursive: true });
    await fs.writeFile(join(specPath, 'tasks.md'), '- [ ] 1. Do the thing\n', 'utf-8');
    await fs.writeFile(join(specPath, 'requirements.md'), '# Requirements\n', 'utf-8');
    await fs.writeFile(
      join(specPath, 'reviews', 'adversarial-analysis-requirements.md'),
      '# Analysis\n',
      'utf-8'
    );
  });

  it('review-task reads tasks.md from the derived root, not from the worktree', async () => {
    const result = await reviewTaskHandler(
      { action: 'prepare', specName, taskId: '404', projectPath: worktree.path },
      ctx(elsewhere, elsewhere)
    );

    // Reaching "task not found" means tasks.md WAS read; the verbatim override
    // would have failed earlier with "tasks.md not found for spec".
    expect(result.message).toContain("Task '404' not found");
  });

  it('log-implementation writes the log under the derived root', async () => {
    const result = await logImplementationHandler(
      {
        specName,
        taskId: '1',
        summary: 'Override-routed log',
        filesModified: [],
        filesCreated: [],
        statistics: { linesAdded: 1, linesRemoved: 0 },
        artifacts: { functions: [] },
        projectPath: worktree.path,
      },
      ctx(elsewhere, elsewhere)
    );

    expect(result.success).toBe(true);
    expect((result.projectContext as { projectPath?: string })?.projectPath).toBe(repo.path);
    const logs = await fs.readdir(join(specPath, 'Implementation Logs'));
    expect(logs.length).toBeGreaterThan(0);
  });

  it('adversarial-review targets the document on the derived root', async () => {
    const result = await adversarialReviewHandler(
      { specName, phase: 'requirements', projectPath: worktree.path },
      ctx(elsewhere, elsewhere)
    );

    expect(result.success).toBe(true);
    expect((result.data as { targetFile: string }).targetFile).toBe(
      join(specPath, 'requirements.md')
    );
    expect((result.data as { promptOutputPath: string }).promptOutputPath.startsWith(repo.path))
      .toBe(true);
  });

  it('adversarial-response finds the analysis on the derived root', async () => {
    const result = await adversarialResponseHandler(
      { specName, phase: 'requirements', projectPath: worktree.path },
      ctx(elsewhere, elsewhere)
    );

    expect(result.success).toBe(true);
    expect((result.data as { analysisFile: string }).analysisFile.startsWith(specPath)).toBe(true);
  });
});
