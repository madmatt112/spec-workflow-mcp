/**
 * Real-repository tests for the git resolution primitives (requirement 7.4).
 *
 * These cannot live in `git-utils.test.ts`, which mocks `child_process`
 * wholesale — a mocked `execSync` can only return what the test already
 * believes git says, which is exactly the belief these cases exist to check.
 * They run against the real binary, over layouts built by task 1's fixture.
 *
 * Requirement 7.4's ten layouts, and where each is covered:
 *
 *  1. repository root ................ `sameRepository` › root vs itself
 *  2. subdirectory at depth .......... `sameRepository` › subdirectory at depth
 *  3. linked worktree ................ `sameRepository` › sibling worktree
 *  4. nested worktree ................ `sameRepository` › nested worktree
 *  5. submodule ...................... `sameRepository` › submodule
 *  6. bare repository ................ `sameRepository` › bare repository
 *  7. --separate-git-dir ............. `sameRepository` › --separate-git-dir
 *  8. symlinked repository root ...... `sameRepository` › symlinked root
 *  9. inherited GIT_DIR .............. `sameRepository` › with GIT_DIR exported
 * 10. two non-git directories ........ `sameRepository` › two non-git directories
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { join, resolve } from 'path';
import { realpathSync } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import {
  gitCommonDirAbsolute,
  gitTopLevel,
  sameRepository,
  normalizeIdentityPath
} from '../git-utils.js';
import {
  GitFixture,
  GitRepoFixture,
  GitWorktreeFixture,
  BareRepoFixture,
  SeparateGitDirFixture,
  cleanupAllGitFixtures
} from './helpers/git-fixture.js';

const isWindows = process.platform === 'win32';

let fixture: GitFixture;

/** `<root>/main` — one commit, plus a sibling and a nested worktree. */
let main: GitRepoFixture;
/** `<main>/src/core/deep` — the subdirectory-at-depth case. */
let mainDeepSubdir: string;
/** `<main>/.git` reached as a working directory — `--show-toplevel` fails here. */
let mainGitDir: string;
let siblingWorktree: GitWorktreeFixture;
let nestedWorktree: GitWorktreeFixture;
/** A symlink whose target is `main`. */
let mainViaSymlink: string;

/** A second, unrelated repository. */
let unrelated: GitRepoFixture;

/** `<root>/super` with a submodule at `<super>/vendored`. */
let superproject: GitRepoFixture;
let submodulePath: string;

let bare: BareRepoFixture;
let separateGitDir: SeparateGitDirFixture;
let separateGitDirSubdir: string;

let nonGitA: string;
let nonGitB: string;

beforeAll(async () => {
  // Assign before building anything: a mid-construction throw must still be
  // cleaned up by the afterAll hook.
  fixture = await GitFixture.create('specwf-git-resolution-');

  main = await fixture.createRepo('main');
  mainDeepSubdir = await main.mkdirp('src/core/deep');
  mainGitDir = join(main.path, '.git');
  siblingWorktree = await main.addWorktree('sibling-wt', 'sibling');
  nestedWorktree = await main.addWorktree('nested-wt', 'nested');

  unrelated = await fixture.createRepo('unrelated');

  superproject = await fixture.createRepo('super');
  const submodule = await superproject.addSubmodule('vendored');
  submodulePath = submodule.path;

  bare = await fixture.createBareRepo('bare.git');

  separateGitDir = await fixture.createSeparateGitDirRepo('separate');
  separateGitDirSubdir = join(separateGitDir.path, 'nested', 'dir');
  await mkdir(separateGitDirSubdir, { recursive: true });

  nonGitA = await fixture.createNonGitDirectory('plain-a');
  nonGitB = await fixture.createNonGitDirectory('plain-b');

  if (!isWindows) {
    mainViaSymlink = await fixture.createSymlink(main.path, 'main-link');
  }
});

afterAll(async () => {
  await fixture?.cleanup();
});

// Backstop: vitest's worker pool terminates without emitting process 'exit',
// so the fixture module's exit hook never fires here (deferral d-2124a571).
afterAll(cleanupAllGitFixtures);

describe('gitCommonDirAbsolute', () => {
  it('returns <repo>/.git from a repository root', () => {
    expect(gitCommonDirAbsolute(main.path)).toBe(join(main.path, '.git'));
  });

  it('returns the same value from a subdirectory at depth', () => {
    // git reports `../../../.git` here; resolving it against the cwd — with no
    // component stripped — must land on the same directory as the root case.
    expect(gitCommonDirAbsolute(mainDeepSubdir)).toBe(join(main.path, '.git'));
  });

  it('returns the main repository .git from a sibling linked worktree', () => {
    expect(gitCommonDirAbsolute(siblingWorktree.path)).toBe(join(main.path, '.git'));
  });

  it('returns the main repository .git from a nested worktree', () => {
    expect(gitCommonDirAbsolute(nestedWorktree.path)).toBe(join(main.path, '.git'));
  });

  it('returns <super>/.git/modules/<name> from a submodule, not the superproject', () => {
    const submoduleCommonDir = gitCommonDirAbsolute(submodulePath);

    expect(submoduleCommonDir).toBe(join(superproject.path, '.git', 'modules', 'vendored'));
    // The distinction requirement 1.5 turns on: stripping to a parent collapses
    // these two into one.
    expect(submoduleCommonDir).not.toBe(gitCommonDirAbsolute(superproject.path));
  });

  it('returns the repository directory itself in a bare repository', () => {
    // git reports the literal `.` here.
    expect(gitCommonDirAbsolute(bare.path)).toBe(bare.path);
  });

  it('returns the external git directory under --separate-git-dir', () => {
    // This common directory contains no `.git` segment at all, so any
    // `.git`-substring normalization produces a nonexistent path.
    expect(gitCommonDirAbsolute(separateGitDir.path)).toBe(separateGitDir.gitDir);
    expect(separateGitDir.gitDir).not.toContain('.git');
  });

  it('returns <repo>/.git from inside a .git directory', () => {
    expect(gitCommonDirAbsolute(mainGitDir)).toBe(join(main.path, '.git'));
  });

  it.skipIf(isWindows)('normalizes a symlinked repository root to its physical path', () => {
    // Without the realpath, git's bare `.git` resolves against the symlinked
    // cwd and yields a different string from the worktree's absolute answer —
    // and inference is silently suppressed (requirement 1.6).
    expect(gitCommonDirAbsolute(mainViaSymlink)).toBe(join(main.path, '.git'));
  });

  it('returns null for a directory that is not in a repository', () => {
    expect(gitCommonDirAbsolute(nonGitA)).toBeNull();
  });

  it('returns null for a path that does not exist', () => {
    expect(gitCommonDirAbsolute(join(fixture.root, 'no-such-directory'))).toBeNull();
  });
});

describe('gitTopLevel', () => {
  it('returns the checkout root from a repository root', () => {
    expect(gitTopLevel(main.path)).toBe(main.path);
  });

  it('returns the checkout root from a subdirectory at depth', () => {
    expect(gitTopLevel(mainDeepSubdir)).toBe(main.path);
  });

  it('returns the worktree itself from a linked worktree', () => {
    expect(gitTopLevel(siblingWorktree.path)).toBe(siblingWorktree.path);
  });

  it('returns null in a bare repository', () => {
    // The gate requirement 1.7 exists for: --git-common-dir succeeds here.
    expect(gitCommonDirAbsolute(bare.path)).not.toBeNull();
    expect(gitTopLevel(bare.path)).toBeNull();
  });

  it('returns null from inside a .git directory', () => {
    expect(gitCommonDirAbsolute(mainGitDir)).not.toBeNull();
    expect(gitTopLevel(mainGitDir)).toBeNull();
  });

  it('returns null for a directory that is not in a repository', () => {
    expect(gitTopLevel(nonGitA)).toBeNull();
  });

  it.skipIf(isWindows)('normalizes a symlinked repository root to its physical path', () => {
    expect(gitTopLevel(mainViaSymlink)).toBe(main.path);
  });
});

describe('sameRepository', () => {
  it('is true for a repository root compared with itself', () => {
    expect(sameRepository(main.path, main.path)).toBe(true);
  });

  it('is true for a subdirectory at depth and its repository root', () => {
    expect(sameRepository(mainDeepSubdir, main.path)).toBe(true);
  });

  it('is true for a repository and its sibling linked worktree', () => {
    expect(sameRepository(main.path, siblingWorktree.path)).toBe(true);
    expect(sameRepository(siblingWorktree.path, main.path)).toBe(true);
  });

  it('is true for a repository and its nested worktree', () => {
    expect(sameRepository(main.path, nestedWorktree.path)).toBe(true);
  });

  it('is true for two worktrees of the same repository', () => {
    expect(sameRepository(siblingWorktree.path, nestedWorktree.path)).toBe(true);
  });

  it('is false for a superproject and its submodule', () => {
    expect(sameRepository(superproject.path, submodulePath)).toBe(false);
    expect(sameRepository(submodulePath, superproject.path)).toBe(false);
  });

  it('is false for a bare repository and an unrelated checkout', () => {
    expect(sameRepository(bare.path, main.path)).toBe(false);
  });

  it('is false for a --separate-git-dir repository and an unrelated checkout', () => {
    expect(sameRepository(separateGitDir.path, main.path)).toBe(false);
  });

  it('is true for a --separate-git-dir repository and its own subdirectory', () => {
    expect(sameRepository(separateGitDir.path, separateGitDirSubdir)).toBe(true);
  });

  it.skipIf(isWindows)('is true for a symlinked root and its own linked worktree', () => {
    expect(sameRepository(mainViaSymlink, siblingWorktree.path)).toBe(true);
  });

  it('is false for two unrelated repositories', () => {
    expect(sameRepository(main.path, unrelated.path)).toBe(false);
  });

  it('is false for two non-git directories', () => {
    expect(sameRepository(nonGitA, nonGitB)).toBe(false);
  });

  it('is false for one non-git directory compared with itself', () => {
    // Not "the same repository" — there is no repository. Returning true here
    // would let inference fire between two directories in no repository at all.
    expect(sameRepository(nonGitA, nonGitA)).toBe(false);
  });

  it('is false for a non-git directory and a repository', () => {
    expect(sameRepository(nonGitA, main.path)).toBe(false);
    expect(sameRepository(main.path, nonGitA)).toBe(false);
  });

  it('is false for paths that do not exist', () => {
    const missing = join(fixture.root, 'no-such-directory');
    expect(sameRepository(missing, main.path)).toBe(false);
  });

  describe('with GIT_DIR exported to an unrelated repository', () => {
    const original = process.env.GIT_DIR;

    beforeAll(() => {
      process.env.GIT_DIR = join(unrelated.path, '.git');
    });

    afterAll(() => {
      if (original === undefined) {
        delete process.env.GIT_DIR;
      } else {
        process.env.GIT_DIR = original;
      }
    });

    it('is effective when not scrubbed (control)', () => {
      // Proves the variable actually reaches git in this environment, so the
      // assertions below cannot pass merely because GIT_DIR was ignored.
      // Unscrubbed, a *non-repository* reports the exported value.
      const leaked = execSync('git rev-parse --git-common-dir', {
        cwd: nonGitA,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      }).trim();

      expect(resolve(nonGitA, leaked)).toBe(join(unrelated.path, '.git'));
    });

    it('is false for two unrelated repositories', () => {
      expect(sameRepository(main.path, superproject.path)).toBe(false);
    });

    it('is false for two non-git directories', () => {
      expect(sameRepository(nonGitA, nonGitB)).toBe(false);
    });

    it('still reports each repository its own common directory', () => {
      expect(gitCommonDirAbsolute(main.path)).toBe(join(main.path, '.git'));
      expect(gitCommonDirAbsolute(nonGitA)).toBeNull();
    });
  });

  describe('with GIT_WORK_TREE, GIT_COMMON_DIR and GIT_INDEX_FILE exported', () => {
    const originals = {
      GIT_WORK_TREE: process.env.GIT_WORK_TREE,
      GIT_COMMON_DIR: process.env.GIT_COMMON_DIR,
      GIT_INDEX_FILE: process.env.GIT_INDEX_FILE
    };

    beforeAll(() => {
      process.env.GIT_WORK_TREE = unrelated.path;
      process.env.GIT_COMMON_DIR = join(unrelated.path, '.git');
      process.env.GIT_INDEX_FILE = join(unrelated.path, '.git', 'index');
    });

    afterAll(() => {
      for (const [name, value] of Object.entries(originals)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    });

    it('resolves each repository independently', () => {
      expect(sameRepository(main.path, unrelated.path)).toBe(false);
      expect(gitTopLevel(main.path)).toBe(main.path);
      expect(gitCommonDirAbsolute(main.path)).toBe(join(main.path, '.git'));
    });
  });
});

describe('normalizeIdentityPath', () => {
  it.skipIf(isWindows)('returns the physical path for a path reached through a symlink', () => {
    expect(normalizeIdentityPath(mainViaSymlink)).toBe(main.path);
  });

  it('returns an existing directory unchanged', () => {
    expect(normalizeIdentityPath(main.path)).toBe(main.path);
  });

  it('makes a relative path absolute', () => {
    expect(normalizeIdentityPath('.')).toBe(realpathSync(resolve('.')));
  });

  it('is idempotent', () => {
    const once = normalizeIdentityPath(mainDeepSubdir);
    expect(normalizeIdentityPath(once)).toBe(once);
  });

  it('strips redundant segments', () => {
    expect(normalizeIdentityPath(join(main.path, 'src', '..'))).toBe(main.path);
  });

  describe('when realpath fails', () => {
    it('falls back to the un-normalized absolute path', () => {
      const missing = join(fixture.root, 'removed-worktree');

      expect(normalizeIdentityPath(missing)).toBe(missing);
    });

    it('is deterministic, so two computations of the same input agree', () => {
      // Requirement 1.12's determinism clause, and only that clause: repeated
      // normalization of one input returns one value. It does not say a value
      // normalized before a path stopped resolving matches one normalized
      // after — see the symlinked-component case below.
      const missing = join(fixture.root, 'removed-worktree');

      expect(normalizeIdentityPath(missing)).toBe(normalizeIdentityPath(missing));
    });

    it.skipIf(isWindows)(
      'no longer matches the pre-removal value once a symlinked component disappears',
      async () => {
        const link = await fixture.createSymlink(main.path, 'vanishing-link');
        const viaLink = join(link, 'src');

        const beforeRemoval = normalizeIdentityPath(viaLink);
        expect(beforeRemoval).toBe(join(main.path, 'src'));

        await unlink(link);
        const afterRemoval = normalizeIdentityPath(viaLink);

        // The honest outcome: realpath resolved the link while it existed and
        // cannot once it is gone, so the two spellings differ. Acceptable
        // because identity is never recomputed for this purpose — requirement
        // 1.13 unregisters by the identifier cached at registration, precisely
        // because normalizing the same path again can yield a different value.
        expect(afterRemoval).toBe(viaLink);
        expect(afterRemoval).not.toBe(beforeRemoval);
      }
    );

    it('still returns an absolute path for relative input', () => {
      expect(normalizeIdentityPath('no-such-relative-directory')).toBe(
        resolve('no-such-relative-directory')
      );
    });

    it.skipIf(isWindows)('does not resolve symlinks in the surviving prefix', () => {
      // Whole-path realpath failed, so the fallback is `resolve` alone. Stated
      // rather than discovered: a caller must not assume the fallback is
      // partially normalized.
      const missing = join(mainViaSymlink, 'no-such-child');

      expect(normalizeIdentityPath(missing)).toBe(missing);
    });
  });
});
