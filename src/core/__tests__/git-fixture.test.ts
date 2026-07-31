/**
 * Self-test for the unit-level git fixture (requirement 7.1).
 *
 * These are real-repository tests: they shell out to git against temporary
 * directories. They deliberately live outside `git-utils.test.ts`, which mocks
 * `child_process` wholesale and cannot host them.
 */
import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { GitFixture, cleanupAllGitFixtures } from './helpers/git-fixture.js';

const IS_WINDOWS = process.platform === 'win32';

describe('GitFixture', () => {
  let fixture: GitFixture | undefined;

  afterEach(async () => {
    await fixture?.cleanup();
    fixture = undefined;
  });

  // Backstop: vitest workers never emit process 'exit', so a fixture whose
  // construction threw before `fixture` was assigned would otherwise survive.
  afterAll(cleanupAllGitFixtures);

  async function createFixture(): Promise<GitFixture> {
    // Assign before building anything so a mid-construction throw still tears down.
    fixture = await GitFixture.create();
    return fixture;
  }

  it('creates a repository whose common dir is the literal .git', async () => {
    const f = await createFixture();
    const repo = await f.createRepo('main');

    expect(await f.readGitCommonDir(repo.path)).toBe('.git');
    expect(repo.gitCommonDir).toBe(join(repo.path, '.git'));
  });

  it('reports a relative common dir from a subdirectory at depth', async () => {
    const f = await createFixture();
    const repo = await f.createRepo('main');
    const deep = await repo.mkdirp('a/b/c');

    const raw = await f.readGitCommonDir(deep);
    expect(raw).toBe(join('..', '..', '..', '.git'));
    expect(resolve(deep, raw as string)).toBe(join(repo.path, '.git'));
  });

  it('builds sibling and nested worktree layouts sharing the main common dir', async () => {
    const f = await createFixture();
    const repo = await f.createRepo('main');

    const sibling = await repo.addWorktree('sibling-a', 'sibling');
    const nestedA = await repo.addWorktree('nested-a', 'nested');
    const nestedB = await repo.addWorktree('nested-b', 'nested');

    // Sibling sits beside the main checkout; nested sits under it, which is the
    // layout where the shared workflow root contains every sibling worktree.
    expect(sibling.path).toBe(join(f.root, 'sibling-a'));
    expect(nestedA.path).toBe(join(repo.path, 'worktrees', 'nested-a'));
    expect(nestedB.path).toBe(join(repo.path, 'worktrees', 'nested-b'));

    for (const worktree of [sibling, nestedA, nestedB]) {
      expect(worktree.gitCommonDir).toBe(repo.gitCommonDir);
      expect(await f.readGitCommonDir(worktree.path)).toBe(join(repo.path, '.git'));
    }

    const listed = await repo.git(['worktree', 'list', '--porcelain']);
    expect(listed).toContain(sibling.path);
    expect(listed).toContain(nestedA.path);
    expect(listed).toContain(nestedB.path);
  });

  it('seeds files and runs git through the worktree handle', async () => {
    const f = await createFixture();
    const repo = await f.createRepo('main');
    const worktree = await repo.addWorktree('seeded-wt', 'sibling');

    // Downstream file-resolution tests seed files inside worktrees; the handle
    // carries the same helpers as the repository handle so they need not use fs.
    const written = await worktree.writeFile('docs/nested/seeded.txt', 'seeded\n');
    expect(written).toBe(join(worktree.path, 'docs', 'nested', 'seeded.txt'));
    expect(existsSync(written)).toBe(true);
    expect(await worktree.mkdirp('empty/dir')).toBe(join(worktree.path, 'empty', 'dir'));

    expect(await worktree.git(['rev-parse', '--abbrev-ref', 'HEAD'])).toBe(worktree.branch);
    expect(await worktree.git(['status', '--porcelain', '-uall'])).toContain('docs/nested/seeded.txt');
  });

  it('creates a real submodule whose common dir is under the superproject modules dir', async () => {
    const f = await createFixture();
    const superproject = await f.createRepo('superproject');

    const submodule = await superproject.addSubmodule('vendor-lib');

    // The reason the resolution helpers must not strip `.git`: stripping turns
    // this into the superproject and makes the two compare equal.
    expect(submodule.gitCommonDir).toBe(join(superproject.path, '.git', 'modules', 'vendor-lib'));
    expect(submodule.gitCommonDir).not.toBe(superproject.gitCommonDir);
    expect(existsSync(join(superproject.path, '.gitmodules'))).toBe(true);
    expect(await superproject.git(['submodule', 'status'])).toContain('vendor-lib');
    expect(existsSync(join(submodule.path, 'README.md'))).toBe(true);
  });

  it('creates a bare repository with no work tree', async () => {
    const f = await createFixture();
    const bare = await f.createBareRepo('origin.git');

    expect(await f.readGitCommonDir(bare.path)).toBe('.');
    expect(bare.gitCommonDir).toBe(bare.path);
  });

  it('creates a --separate-git-dir repository whose common dir has no .git segment', async () => {
    const f = await createFixture();
    const separate = await f.createSeparateGitDirRepo('detached');

    expect(separate.gitCommonDir).toBe(separate.gitDir);
    expect(separate.gitCommonDir.endsWith('.git')).toBe(false);
    expect(await f.readGitCommonDir(separate.path)).toBe(separate.gitDir);
  });

  it.skipIf(IS_WINDOWS)('creates a symlinked repository root', async () => {
    const f = await createFixture();
    const repo = await f.createRepo('linked-main');
    const worktree = await repo.addWorktree('linked-wt', 'sibling');

    const linkPath = await f.createSymlink(repo.path, 'link-to-main');

    // Reached through the link git still reports the literal `.git`; resolving
    // it against the link and realpath-ing is what makes it compare equal to
    // its own linked worktree.
    expect(await f.readGitCommonDir(linkPath)).toBe('.git');
    expect(resolve(linkPath, '.git')).toBe(join(linkPath, '.git'));
    expect(worktree.gitCommonDir).toBe(join(repo.path, '.git'));
  });

  it('creates non-git directories that resolve to no repository', async () => {
    const f = await createFixture();
    const one = await f.createNonGitDirectory('plain-one');
    const two = await f.createNonGitDirectory('plain-two');

    expect(await f.readGitCommonDir(one)).toBeNull();
    expect(await f.readGitCommonDir(two)).toBeNull();
  });

  it('scrubs GIT_* variables exported after the fixture was created', async () => {
    const f = await createFixture();
    const unrelated = await f.createRepo('unrelated');
    const unrelatedHead = await unrelated.git(['rev-parse', 'HEAD']);

    // Exported *after* GitFixture.create(), so an environment snapshotted in the
    // constructor would never see them: the scrub has to happen per invocation.
    const ambient: Record<string, string> = {
      GIT_DIR: join(unrelated.path, '.git'),
      GIT_COMMON_DIR: join(unrelated.path, '.git'),
      GIT_WORK_TREE: unrelated.path,
      GIT_INDEX_FILE: join(unrelated.path, '.git', 'index')
    };
    const original = new Map(Object.keys(ambient).map((key) => [key, process.env[key]]));
    Object.assign(process.env, ambient);

    try {
      const repo = await f.createRepo('scrubbed');
      const worktree = await repo.addWorktree('scrubbed-wt', 'sibling');
      await repo.writeFile('seeded.txt', 'seeded\n');
      await repo.commitAll('Seed a file');

      // Built where it was asked to be, not where the ambient variables point.
      expect(await f.readGitCommonDir(repo.path)).toBe('.git');
      expect(repo.gitCommonDir).toBe(join(repo.path, '.git'));
      expect(worktree.gitCommonDir).toBe(join(repo.path, '.git'));
      expect(await repo.git(['rev-parse', '--show-toplevel'])).toBe(repo.path);

      // And the repository the ambient variables point at is untouched.
      expect(await unrelated.git(['rev-parse', 'HEAD'])).toBe(unrelatedHead);
      expect(await unrelated.git(['status', '--porcelain'])).toBe('');
    } finally {
      for (const [key, value] of original) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it('removes every temporary directory on cleanup', async () => {
    const f = await createFixture();
    const repo = await f.createRepo('main');
    await repo.addWorktree('sibling-a', 'sibling');
    await repo.addWorktree('nested-a', 'nested');
    await repo.addSubmodule('vendor-lib');
    await f.createBareRepo('origin.git');
    await f.createSeparateGitDirRepo('detached');
    expect(existsSync(f.root)).toBe(true);

    await f.cleanup();

    expect(existsSync(f.root)).toBe(false);
    // Idempotent, and unusable afterwards.
    await f.cleanup();
    await expect(f.createRepo('after-cleanup')).rejects.toThrow(/already been cleaned up/);
  });
});
