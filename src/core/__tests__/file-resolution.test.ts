/**
 * `safeRealpath` and `resolveLoggedFiles` — requirements 4.8-4.18 and 7.5-7.6.
 *
 * Real-repository layouts come from the task-1 git fixture rather than bare
 * temp directories, because the containment rules this module implements are
 * about worktree topology: a `.spec-workflow` directory that sits *above* the
 * workspace, and a sibling worktree that a nested layout puts *below* the
 * shared workflow root.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs, realpathSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import { tmpdir } from 'os';

import {
  safeRealpath,
  resolveLoggedFiles,
  _resetValidateWarnings,
  type DropCause,
} from '../file-resolution.js';
import {
  GitFixture,
  cleanupAllGitFixtures,
  type GitRepoFixture,
  type GitWorktreeFixture,
} from './helpers/git-fixture.js';

function warnText(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
}

/** Every cause that is not named is asserted zero, so a miscount cannot hide. */
function expectDrops(
  drops: Record<DropCause, number>,
  expected: Partial<Record<DropCause, number>>
): void {
  const all: DropCause[] = [
    'not-array',
    'not-string',
    'resolve-threw',
    'missing',
    'realpath-failed',
    'outside-roots',
  ];
  const full = Object.fromEntries(all.map(c => [c, expected[c] ?? 0]));
  expect(drops).toEqual(full);
}

describe('safeRealpath', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    _resetValidateWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tempDir = await fs.mkdtemp(join(tmpdir(), 'safe-realpath-test-'));
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns ok with the realpath for an existing file', () => {
    const filePath = join(tempDir, 'a.txt');
    writeFileSync(filePath, '');
    // Expected as a function of the input rather than a literal, so the
    // assertion stays honest where `/tmp` is itself a symlink.
    expect(safeRealpath(filePath)).toEqual({ ok: true, path: realpathSync(filePath) });
  });

  it('reports ENOENT silently for a missing file', () => {
    const missing = join(tempDir, 'does-not-exist.txt');
    const result = safeRealpath(missing);
    expect(result).toEqual({ ok: false, code: 'ENOENT' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warn-once on non-ENOENT error (ELOOP from symlink cycle)', () => {
    const a = join(tempDir, 'a-link');
    const b = join(tempDir, 'b-link');
    symlinkSync(b, a);
    symlinkSync(a, b);

    const r1 = safeRealpath(a);
    expect(r1).toEqual({ ok: false, code: 'ELOOP' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/safeRealpath: ELOOP/);

    // Same path + same code: deduped.
    const r2 = safeRealpath(a);
    expect(r2).toEqual({ ok: false, code: 'ELOOP' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('resolveLoggedFiles', () => {
  let fixture: GitFixture;
  let repo: GitRepoFixture;
  let worktree: GitWorktreeFixture;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  /** The shared workflow root is the main checkout; the workspace is the worktree. */
  let roots: { workspacePath: string; workflowRoot: string };

  beforeEach(async () => {
    _resetValidateWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Assign before building so a mid-construction throw is still torn down.
    fixture = await GitFixture.create('specwf-file-resolution-');
    repo = await fixture.createRepo('main-checkout');
    await repo.writeFile('src/shared.ts', 'export const shared = 1;\n');
    await repo.writeFile('src/only-in-main.ts', 'export const m = 1;\n');
    await repo.commitAll('seed');

    worktree = await repo.addWorktree('feature');
    await worktree.writeFile('src/only-in-worktree.ts', 'export const w = 1;\n');

    // Written after the worktree exists, and never committed: the shared
    // `.spec-workflow` lives in the main checkout only, which is the premise of
    // the whole two-root arrangement.
    await repo.writeFile('.spec-workflow/specs/demo/notes.md', 'notes\n');

    roots = { workspacePath: worktree.path, workflowRoot: repo.path };
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await fixture?.cleanup();
  });

  afterAll(cleanupAllGitFixtures);

  it('anchors a bare relative path to the workspace', () => {
    const result = resolveLoggedFiles(['src/only-in-worktree.ts'], roots);
    expect(result.files).toEqual([
      { path: join(worktree.path, 'src/only-in-worktree.ts'), root: 'workspace', ambiguous: false },
    ]);
    expect(result.workspaceFiles).toEqual([join(worktree.path, 'src/only-in-worktree.ts')]);
    expect(result.workflowFiles).toEqual([]);
    expectDrops(result.drops, {});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('marks a relative entry that anchors under both roots ambiguous', () => {
    // `src/shared.ts` is committed, so the worktree has its own copy too.
    const result = resolveLoggedFiles(['src/shared.ts'], roots);
    expect(result.files).toEqual([
      { path: join(worktree.path, 'src/shared.ts'), root: 'workspace', ambiguous: true },
    ]);
  });

  it('classifies an absolute path under the workspace, NOT ambiguous', () => {
    const abs = join(worktree.path, 'src/shared.ts');
    const result = resolveLoggedFiles([abs], roots);
    expect(result.files).toEqual([{ path: abs, root: 'workspace', ambiguous: false }]);
  });

  it('classifies an absolute .spec-workflow path under the workflow root, NOT ambiguous', () => {
    const abs = join(repo.path, '.spec-workflow/specs/demo/notes.md');
    const result = resolveLoggedFiles([abs], roots);
    expect(result.files).toEqual([{ path: abs, root: 'workflow', ambiguous: false }]);
    expect(result.workflowFiles).toEqual([abs]);
    expect(result.workspaceFiles).toEqual([]);
  });

  it('anchors a relative .spec-workflow entry to the workflow root', () => {
    const result = resolveLoggedFiles(['.spec-workflow/specs/demo/notes.md'], roots);
    expect(result.files).toEqual([
      { path: join(repo.path, '.spec-workflow/specs/demo/notes.md'), root: 'workflow', ambiguous: false },
    ]);
  });

  describe('the six drop causes, counted separately', () => {
    it('counts not-array', () => {
      for (const bad of [null, 'not-an-array', { length: 1, 0: 'x' }]) {
        _resetValidateWarnings();
        const result = resolveLoggedFiles(bad, roots);
        expect(result.files).toEqual([]);
        expectDrops(result.drops, { 'not-array': 1 });
      }
      expect(warnText(warnSpy)).toMatch(/allFiles is not an array/);
    });

    it('counts not-string', () => {
      const result = resolveLoggedFiles(
        [42, Symbol('s'), BigInt(0), null, undefined, 'src/shared.ts'],
        roots
      );
      expect(result.files).toHaveLength(1);
      expectDrops(result.drops, { 'not-string': 5 });
      expect(warnText(warnSpy)).toMatch(/non-string entry at index 0/);
    });

    it('counts realpath-failed — not resolve-threw — for a NUL byte', () => {
      const result = resolveLoggedFiles(['src/shared.ts', 'bad\0.ts'], roots);
      expect(result.files).toHaveLength(1);
      // Asserted separately, never as a sum: `path.resolve` accepts NUL bytes
      // (it validates argument *type* only), so the rejection comes one step
      // later from `realpathSync`. A summed assertion would let the two causes
      // stand in for each other and hide that `resolve-threw` never fires.
      expectDrops(result.drops, { 'realpath-failed': 1 });
      expect(warnText(warnSpy)).toMatch(/safeRealpath: /);
      expect(warnText(warnSpy)).not.toMatch(/path\.resolve threw/);
    });

    it('never counts resolve-threw: `path.resolve` cannot throw for these inputs', () => {
      // The cause is kept because R4 AC 12 enumerates it, but it is defensive
      // and unreachable: `path.resolve` throws only ERR_INVALID_ARG_TYPE, for a
      // non-string argument, and both of its arguments are strings by
      // construction — the entry passed the `typeof` guard, the roots are typed.
      // Pinned here so the zero is a stated fact rather than an untested gap.
      expect(() => path.resolve(roots.workspacePath, 'bad\0.ts')).not.toThrow();
      const hostile = [
        'bad\0.ts',
        '../'.repeat(2000) + 'x.ts',
        'a'.repeat(5000) + '.ts',
        '\0\0',
      ];
      const result = resolveLoggedFiles(hostile, roots);
      expect(result.files).toEqual([]);
      expect(result.drops['resolve-threw']).toBe(0);
    });

    it('counts missing, silently', () => {
      const result = resolveLoggedFiles(['src/shared.ts', 'src/never-written.ts'], roots);
      expect(result.files).toHaveLength(1);
      expectDrops(result.drops, { missing: 1 });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('counts realpath-failed for a non-ENOENT realpath error (ELOOP)', async () => {
      const a = join(worktree.path, 'a-link');
      const b = join(worktree.path, 'b-link');
      symlinkSync(b, a);
      symlinkSync(a, b);

      const result = resolveLoggedFiles(['a-link'], roots);
      expect(result.files).toEqual([]);
      expectDrops(result.drops, { 'realpath-failed': 1 });
      expect(warnText(warnSpy)).toMatch(/safeRealpath: ELOOP/);
    });

    it('counts outside-roots and states the replacement warning text', async () => {
      const outsideDir = await fixture.createNonGitDirectory('outside-the-repo');
      const outside = join(outsideDir, 'stranger.ts');
      await fs.writeFile(outside, 'export const s = 1;\n', 'utf-8');

      const result = resolveLoggedFiles([outside, 'src/shared.ts'], roots);
      expect(result.files).toHaveLength(1);
      expectDrops(result.drops, { 'outside-roots': 1 });
      expect(warnText(warnSpy)).toContain(
        `[spec-workflow] resolveLoggedFiles: path outside the workspace and the shared .spec-workflow directory: ${outside}`
      );
      // The phrase that named the one-root world is gone.
      expect(warnText(warnSpy)).not.toMatch(/outside projectPath/);
    });
  });

  it('drops a file deleted in the workspace but present in the workflow root, without substituting', async () => {
    await fs.rm(join(worktree.path, 'src/shared.ts'));

    const result = resolveLoggedFiles(['src/shared.ts'], roots);
    expect(result.files).toEqual([]);
    // Never the main checkout's undeleted copy.
    expect(result.workspaceFiles).toEqual([]);
    expect(result.workflowFiles).toEqual([]);
    expectDrops(result.drops, { missing: 1 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('dedupes two spellings of one path to a single entry', () => {
    const result = resolveLoggedFiles(
      ['src/shared.ts', './src/shared.ts', join(worktree.path, 'src/shared.ts')],
      roots
    );
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe(join(worktree.path, 'src/shared.ts'));
    expectDrops(result.drops, {});
  });

  it('dedupes a symlink against its target: the key is the realpath, not the resolve spelling', () => {
    // The dedupe test above uses spellings that share one `path.resolve` result,
    // so it passes whether the key is the realpath or the resolved spelling —
    // it cannot tell the two apart. Here they genuinely differ: the link and its
    // target resolve to different absolute paths but realpath to one file. Only
    // a realpath key collapses them, which is what R4 AC 11 states.
    symlinkSync(join(worktree.path, 'src/shared.ts'), join(worktree.path, 'link-to-shared.ts'));

    const viaTarget = path.resolve(worktree.path, 'src/shared.ts');
    const viaLink = path.resolve(worktree.path, 'link-to-shared.ts');
    // The premise of the test, asserted rather than assumed: the two keys differ.
    expect(viaLink).not.toBe(viaTarget);
    expect(realpathSync(viaLink)).toBe(realpathSync(viaTarget));

    const result = resolveLoggedFiles(['src/shared.ts', 'link-to-shared.ts'], roots);
    expect(result.files).toEqual([{ path: viaTarget, root: 'workspace', ambiguous: true }]);
    expect(result.workspaceFiles).toEqual([viaTarget]);
    expectDrops(result.drops, {});
  });

  it('lets the first-seen entry win the ambiguous flag under dedupe', () => {
    // `src/shared.ts` anchors under both roots, so the relative spelling is
    // ambiguous; the absolute spelling of the same file has one candidate and
    // is never ambiguous (R4 AC 10). They dedupe to one record, and that record
    // is the first entry's — flag included. Pinned in both orders so a later
    // refactor cannot silently change which entry wins.
    const abs = join(worktree.path, 'src/shared.ts');

    const relativeFirst = resolveLoggedFiles(['src/shared.ts', abs], roots);
    expect(relativeFirst.files).toEqual([{ path: abs, root: 'workspace', ambiguous: true }]);

    const absoluteFirst = resolveLoggedFiles([abs, 'src/shared.ts'], roots);
    expect(absoluteFirst.files).toEqual([{ path: abs, root: 'workspace', ambiguous: false }]);
  });

  it('emits the `path.resolve` spelling, not the realpath (R3 AC 11)', async () => {
    // Containment is decided on the realpath — that is what makes a symlinked
    // root work at all — but the string handed back is the one pre-change
    // behaviour handed back: `path.resolve(root, entry)`, symlink intact.
    const linkedWorkspace = await fixture.createSymlink(worktree.path, 'feature-link');

    const result = resolveLoggedFiles(['src/only-in-worktree.ts'], {
      workspacePath: linkedWorkspace,
      workflowRoot: repo.path,
    });

    expect(result.files).toEqual([
      {
        path: path.resolve(linkedWorkspace, 'src/only-in-worktree.ts'),
        root: 'workspace',
        ambiguous: false,
      },
    ]);
    expect(result.files[0].path).not.toBe(realpathSync(result.files[0].path));
  });

  it('resolves a symlink to its target before classifying it', async () => {
    const outsideDir = await fixture.createNonGitDirectory('symlink-target-dir');
    const target = join(outsideDir, 'elsewhere.ts');
    await fs.writeFile(target, 'export const e = 1;\n', 'utf-8');
    symlinkSync(target, join(worktree.path, 'link.ts'));

    const result = resolveLoggedFiles(['link.ts'], roots);
    expect(result.files).toEqual([]);
    expectDrops(result.drops, { 'outside-roots': 1 });
  });

  describe('containment', () => {
    it('accepts .spec-workflow above the workspace', () => {
      // The sibling worktree sits beside the main checkout, so the shared
      // `.spec-workflow` is not below the workspace at all.
      const abs = join(repo.path, '.spec-workflow/specs/demo/notes.md');
      expect(abs.startsWith(worktree.path)).toBe(false);
      const result = resolveLoggedFiles([abs], roots);
      expect(result.files.map(f => f.root)).toEqual(['workflow']);
    });

    it('rejects a sibling worktree in a nested layout', async () => {
      // Nested layout: the workflow root CONTAINS every sibling worktree, so a
      // containment base of the workflow root itself would accept them all.
      const nestedA = await repo.addWorktree('nested-a', 'nested');
      const nestedB = await repo.addWorktree('nested-b', 'nested');
      await nestedB.writeFile('src/sibling.ts', 'export const s = 1;\n');

      const sibling = join(nestedB.path, 'src/sibling.ts');
      const result = resolveLoggedFiles([sibling], {
        workspacePath: nestedA.path,
        workflowRoot: repo.path,
      });

      expect(result.files).toEqual([]);
      expectDrops(result.drops, { 'outside-roots': 1 });
    });

    it('rejects a sibling worktree in a nested layout under a symlinked workflow root', async () => {
      const nestedA = await repo.addWorktree('sym-nested-a', 'nested');
      const nestedB = await repo.addWorktree('sym-nested-b', 'nested');
      await nestedB.writeFile('src/sibling.ts', 'export const s = 1;\n');
      const linkedRoot = await fixture.createSymlink(repo.path, 'main-checkout-link');

      const specFile = join(linkedRoot, '.spec-workflow/specs/demo/notes.md');
      const sibling = join(nestedB.path, 'src/sibling.ts');
      const result = resolveLoggedFiles([specFile, sibling], {
        workspacePath: nestedA.path,
        workflowRoot: linkedRoot,
      });

      // Both bases realpath-normalized: the `.spec-workflow` path reached
      // through the link is accepted (it would be rejected against an
      // unnormalized base), and the sibling worktree is still rejected.
      // The path handed back is the caller's spelling — through the link —
      // because containment is decided on the realpath but the emitted string
      // stays `path.resolve`d (R3 AC 11).
      expect(result.files).toEqual([
        { path: join(linkedRoot, '.spec-workflow/specs/demo/notes.md'), root: 'workflow', ambiguous: false },
      ]);
      expect(result.files[0].path).not.toBe(join(repo.path, '.spec-workflow/specs/demo/notes.md'));
      expectDrops(result.drops, { 'outside-roots': 1 });
    });

    it('rejects an absolute main-checkout code path', () => {
      // `src/only-in-main.ts` is committed but the worktree's copy is irrelevant
      // here: the entry is absolute, so it is classified by containment alone.
      // It sits under the workflow root and outside `.spec-workflow`, which is
      // exactly the base the resolver refuses to use — in a nested layout the
      // workflow root contains every sibling worktree.
      const abs = join(repo.path, 'src/only-in-main.ts');
      const result = resolveLoggedFiles([abs], roots);
      expect(result.files).toEqual([]);
      expect(result.workflowFiles).toEqual([]);
      expectDrops(result.drops, { 'outside-roots': 1 });
      expect(warnText(warnSpy)).toContain(abs);
    });
  });

  it('treats equal roots as one root: nothing is ambiguous', () => {
    const equal = { workspacePath: repo.path, workflowRoot: repo.path };
    const result = resolveLoggedFiles(
      ['src/shared.ts', '.spec-workflow/specs/demo/notes.md'],
      equal
    );
    expect(result.files).toEqual([
      { path: join(repo.path, 'src/shared.ts'), root: 'workspace', ambiguous: false },
      { path: join(repo.path, '.spec-workflow/specs/demo/notes.md'), root: 'workspace', ambiguous: false },
    ]);
    expectDrops(result.drops, {});
  });

  it('preserves first-seen order', () => {
    const result = resolveLoggedFiles(
      ['src/only-in-worktree.ts', 'src/shared.ts'],
      roots
    );
    expect(result.files.map(f => f.path)).toEqual([
      join(worktree.path, 'src/only-in-worktree.ts'),
      join(worktree.path, 'src/shared.ts'),
    ]);
  });

  it('resolves a relative path with an explicit ./ prefix identically', () => {
    const result = resolveLoggedFiles(['./src/only-in-worktree.ts'], roots);
    expect(result.files.map(f => f.path)).toEqual([
      path.resolve(worktree.path, 'src/only-in-worktree.ts'),
    ]);
  });
});
