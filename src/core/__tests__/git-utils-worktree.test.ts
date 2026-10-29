/**
 * Red tests for `linkedWorktreeInfo` (task 1; design.md C1; requirements.md
 * R1 Terms, AC1, AC2, NFR Performance).
 *
 * Contract, per case below — pre-condition, the call through the seam, the
 * observable result, and the source of the expected value:
 *
 * 1. Main checkout, no worktree.
 *    Call: `linkedWorktreeInfo(main.path)`.
 *    Result: `linked === false`.
 *    Source: requirements.md R1 Terms — "the common directory is non-`.git`
 *    for a worktree"; a main checkout's raw `--git-common-dir` is the literal
 *    `.git`.
 *
 * 2. Sibling linked worktree (`git worktree add`).
 *    Call: `linkedWorktreeInfo(worktree.path)`.
 *    Result: `linked === true`, `mainTree === <realpath of the main checkout>`.
 *    Source: design.md C1 Interfaces — "mainTree is the parent of the
 *    realpath-normalized common directory ... when its base name is `.git`".
 *
 * 3. Plain, non-git temporary directory.
 *    Call: `linkedWorktreeInfo(nonGit)`.
 *    Result: `{ linked: false, mainTree: null }`.
 *    Source: task 1 `_Prompt` — "A null output gives linked false and
 *    mainTree null."
 *
 * 4. The same sibling worktree, with `SPEC_WORKFLOW_SHARED_ROOT` set to an
 *    unrelated directory.
 *    Call: `linkedWorktreeInfo(worktree.path)`.
 *    Result: `mainTree === <realpath of the main checkout>`, not the shared
 *    root.
 *    Source: requirements.md R1 Terms — "taken directly rather than through
 *    `resolveGitRoot` ..., which returns the `SPEC_WORKFLOW_SHARED_ROOT`
 *    override — the store, not the main tree".
 *
 * 5. One git invocation per call.
 *    Call: `linkedWorktreeInfo(worktree.path)`, with `execSync` passed
 *    through a counting spy.
 *    Result: `execSync` called exactly once.
 *    Source: design.md C1 Interfaces — "runs `git rev-parse --git-common-dir`
 *    once through `gitCapture`"; requirements.md NFR Performance — "Folding
 *    costs one `git rev-parse --git-common-dir` call per sync".
 *
 * `git-utils.test.ts` mocks `child_process` wholesale and cannot exercise a
 * real worktree layout; this file runs against real temporary repositories
 * instead, built with the same fixture `git-resolution.test.ts` uses.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, execSync: vi.fn() };
});

import * as childProcess from 'child_process';
import { linkedWorktreeInfo, SPEC_WORKFLOW_SHARED_ROOT_ENV } from '../git-utils.js';
import {
  GitFixture,
  GitRepoFixture,
  GitWorktreeFixture,
  cleanupAllGitFixtures
} from './helpers/git-fixture.js';

const mockedExecSync = vi.mocked(childProcess.execSync);
let actualExecSync: typeof childProcess.execSync;

function installPassthrough(): void {
  mockedExecSync.mockImplementation(((command: string, options: unknown) =>
    (actualExecSync as unknown as (c: string, o: unknown) => string)(command, options)
  ) as unknown as typeof childProcess.execSync);
}

const ORIGINAL_SHARED_ROOT = process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV];

function restoreSharedRootEnv(): void {
  if (ORIGINAL_SHARED_ROOT === undefined) {
    delete process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV];
  } else {
    process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = ORIGINAL_SHARED_ROOT;
  }
}

let fixture: GitFixture;
let main: GitRepoFixture;
let worktree: GitWorktreeFixture;
let nonGit: string;

beforeAll(async () => {
  fixture = await GitFixture.create('specwf-git-worktree-info-');
  main = await fixture.createRepo('main');
  worktree = await main.addWorktree('sibling-wt', 'sibling');
  nonGit = await fixture.createNonGitDirectory('plain');
});

afterAll(async () => {
  await fixture?.cleanup();
});

// Backstop for vitest's worker pool, which never emits `process.on('exit')`.
afterAll(cleanupAllGitFixtures);

beforeEach(async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  actualExecSync = actual.execSync;
  mockedExecSync.mockReset();
  installPassthrough();
  restoreSharedRootEnv();
});

describe('linkedWorktreeInfo', () => {
  it('a main checkout gives linked false', () => {
    expect(linkedWorktreeInfo(main.path).linked).toBe(false);
  });

  it('a linked worktree gives linked true, with the main checkout as mainTree', () => {
    const result = linkedWorktreeInfo(worktree.path);

    expect(result.linked).toBe(true);
    expect(result.mainTree).toBe(main.path);
  });

  it('a non-git temporary directory gives linked false and mainTree null', () => {
    expect(linkedWorktreeInfo(nonGit)).toEqual({ linked: false, mainTree: null });
  });

  describe('with SPEC_WORKFLOW_SHARED_ROOT set to an unrelated directory', () => {
    let sharedRoot: string;

    beforeAll(async () => {
      sharedRoot = await fixture.createNonGitDirectory('shared-root-store');
    });

    afterEach(() => {
      restoreSharedRootEnv();
    });

    it('still gives the main checkout as mainTree, not the shared root', () => {
      process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = sharedRoot;

      const result = linkedWorktreeInfo(worktree.path);

      expect(result.mainTree).toBe(main.path);
      expect(result.mainTree).not.toBe(sharedRoot);
    });
  });

  it('issues exactly one git call per invocation', () => {
    mockedExecSync.mockClear();

    linkedWorktreeInfo(worktree.path);

    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });
});
