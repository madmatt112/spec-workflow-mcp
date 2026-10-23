import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, statSync, existsSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { buildFixture, disposeFixture, FixtureError } from '../fixture.js';
import type { EvalCase, EvalFixtureSpec } from '../case.js';

// Design Component 2 (src/evals/fixture.ts), R1 AC3: buildFixture(c, caseDir) builds a
// fresh git repository for one eval run under a new mkdtemp parent and returns the
// Fixture { root, parent, bases }; disposeFixture(f) removes the parent. Each test builds
// its own case directory with fixture trees and reaches the builder only through
// buildFixture/disposeFixture, never a module-private helper. Assertions read files, git
// output and file modes only (node 20 fields).

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8' }).trim();
}

function baseCase(fixture: EvalFixtureSpec): EvalCase {
  return {
    id: 'fixture-test-case',
    role: 'sdd-test-author',
    phase: 'implementation',
    spec: 'eval-fixture-test-case',
    turnCap: 100,
    evidence: 'docs/example.md:1-2',
    briefs: [],
    fixture,
    graders: [],
  };
}

function writeTree(caseDir: string, treeName: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const p = join(caseDir, treeName, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
}

describe('buildFixture(c, caseDir)', () => {
  // Pre-condition: a case directory holds two fixture trees, `fixture/01` (one file) and
  // `fixture/02` (a second file); the case's fixture.commits names them in order with
  // messages "first commit" and "second commit", no hook and no worktrees.
  // Test: buildFixture(c, caseDir).
  // Observable result: `git log --format=%s --reverse` on the fixture root reads
  // ["first commit", "second commit"], the order the commits were given; every commit's
  // author is "Eval Fixture".
  // Expected-value source: design.md Component 2 post-condition 2, "Each fixture.commits
  // entry, in order, copies its tree directory over the root and commits everything with
  // its message, author Eval Fixture"; tasks.md task 5 Prompt, "two commits land in order
  // with their messages and author Eval Fixture".
  it('lands commits in order with their messages and author Eval Fixture', () => {
    const caseDir = mkdtempSync(join(tmpdir(), 'fixture-case-'));
    writeTree(caseDir, 'fixture/01', { 'a.txt': 'one\n' });
    writeTree(caseDir, 'fixture/02', { 'b.txt': 'two\n' });
    const c = baseCase({
      commits: [
        { message: 'first commit', tree: 'fixture/01' },
        { message: 'second commit', tree: 'fixture/02' },
      ],
    });

    const f = buildFixture(c, caseDir);

    expect(git(f.root, 'log', '--format=%s', '--reverse').split('\n')).toEqual(['first commit', 'second commit']);
    expect(git(f.root, 'log', '--format=%an').split('\n')).toEqual(['Eval Fixture', 'Eval Fixture']);

    disposeFixture(f);
    rmSync(caseDir, { recursive: true, force: true });
  });

  // Pre-condition: a case directory holds one fixture tree and a pre-commit hook source
  // file whose script is `#!/bin/sh\nexit 1\n` (it blocks any commit that actually runs
  // it); the case's fixture names one setup commit and the hook.
  // Test: buildFixture(c, caseDir).
  // Observable result: `.git/hooks/pre-commit` under the fixture root exists at mode 755,
  // and the setup commit still landed (`git log --format=%s` lists it) — proving the
  // failing hook did not run against it.
  // Expected-value source: design.md Component 2 post-condition 3, "fixture.preCommitHook
  // is installed as .git/hooks/pre-commit, mode 755"; tasks.md task 5 Prompt, "the hook has
  // mode 755 and setup commits do not run it".
  it('installs the pre-commit hook at mode 755 and runs setup commits with hooks off', () => {
    const caseDir = mkdtempSync(join(tmpdir(), 'fixture-case-'));
    writeTree(caseDir, 'fixture/01', { 'a.txt': 'one\n' });
    writeFileSync(join(caseDir, 'pre-commit'), '#!/bin/sh\nexit 1\n');
    const c = baseCase({
      commits: [{ message: 'init', tree: 'fixture/01' }],
      preCommitHook: 'pre-commit',
    });

    const f = buildFixture(c, caseDir);

    const hookMode = statSync(join(f.root, '.git', 'hooks', 'pre-commit')).mode & 0o777;
    expect(hookMode).toBe(0o755);
    expect(git(f.root, 'log', '--format=%s').split('\n')).toEqual(['init']);

    disposeFixture(f);
    rmSync(caseDir, { recursive: true, force: true });
  });

  // Pre-condition: a case directory holds one fixture tree and one worktree entry
  // `{ dir: 'landing', branch: 'chore/demo-retro' }`.
  // Test: buildFixture(c, caseDir).
  // Observable result: `<root>/.claude/worktrees/landing` exists and its
  // `git rev-parse --abbrev-ref HEAD` reads "chore/demo-retro"; the root's
  // `git status --porcelain` prints nothing (the worktree directory is excluded, not
  // untracked clutter).
  // Expected-value source: design.md Component 2 post-condition 4, "Each fixture.worktrees
  // entry gets `git worktree add -b <branch> .claude/worktrees/<dir>`, and
  // `.claude/worktrees/` goes into `.git/info/exclude` ... git status --porcelain printed
  // nothing"; tasks.md task 5 Prompt, "a worktree is on its branch and the root's git
  // status --porcelain prints nothing".
  it('puts a worktree on its branch and leaves the root status clean', () => {
    const caseDir = mkdtempSync(join(tmpdir(), 'fixture-case-'));
    writeTree(caseDir, 'fixture/01', { 'a.txt': 'one\n' });
    const c = baseCase({
      commits: [{ message: 'init', tree: 'fixture/01' }],
      worktrees: [{ dir: 'landing', branch: 'chore/demo-retro' }],
    });

    const f = buildFixture(c, caseDir);

    const worktreeDir = join(f.root, '.claude', 'worktrees', 'landing');
    expect(existsSync(worktreeDir)).toBe(true);
    expect(git(worktreeDir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('chore/demo-retro');
    expect(git(f.root, 'status', '--porcelain')).toBe('');

    disposeFixture(f);
    rmSync(caseDir, { recursive: true, force: true });
  });

  // Pre-condition: same fixture as the worktree test above: one setup commit, one
  // worktree `{ dir: 'landing', branch: 'chore/demo-retro' }`.
  // Test: buildFixture(c, caseDir).
  // Observable result: `f.bases['.']` equals the root's own `git rev-parse HEAD`, and
  // `f.bases['.claude/worktrees/landing']` equals that worktree's own `git rev-parse HEAD`
  // — the same relative-path keys a grader's `repo` argument resolves through
  // `join(fixture.root, repo)` (src/evals/graders/shared.ts `gitIn`) and looks up in
  // `fixture.bases[repo]` (src/evals/graders/no-new-commit.ts).
  // Expected-value source: design.md Component 2 post-condition 5, "f.bases records HEAD
  // of the root and of each worktree after setup"; Data Models, "bases maps the root and
  // each worktree dir to its post-setup HEAD"; tasks.md task 5 Prompt, "bases holds the
  // root and each worktree".
  it('records bases for the root and each worktree', () => {
    const caseDir = mkdtempSync(join(tmpdir(), 'fixture-case-'));
    writeTree(caseDir, 'fixture/01', { 'a.txt': 'one\n' });
    const c = baseCase({
      commits: [{ message: 'init', tree: 'fixture/01' }],
      worktrees: [{ dir: 'landing', branch: 'chore/demo-retro' }],
    });

    const f = buildFixture(c, caseDir);

    expect(f.bases['.']).toBe(git(f.root, 'rev-parse', 'HEAD'));
    expect(f.bases['.claude/worktrees/landing']).toBe(
      git(join(f.root, '.claude', 'worktrees', 'landing'), 'rev-parse', 'HEAD')
    );

    disposeFixture(f);
    rmSync(caseDir, { recursive: true, force: true });
  });

  // Pre-condition: one case directory with one fixture tree, built twice from the same
  // case and caseDir.
  // Test: buildFixture(c, caseDir) called twice.
  // Observable result: the two calls' `root` (and `parent`) differ.
  // Expected-value source: design.md Component 2 post-condition 1, "No two calls share a
  // directory"; tasks.md task 5 Prompt, "two calls never share a directory".
  it('never shares a directory between two calls', () => {
    const caseDir = mkdtempSync(join(tmpdir(), 'fixture-case-'));
    writeTree(caseDir, 'fixture/01', { 'a.txt': 'one\n' });
    const c = baseCase({ commits: [{ message: 'init', tree: 'fixture/01' }] });

    const f1 = buildFixture(c, caseDir);
    const f2 = buildFixture(c, caseDir);

    expect(f1.parent).not.toBe(f2.parent);
    expect(f1.root).not.toBe(f2.root);

    disposeFixture(f1);
    disposeFixture(f2);
    rmSync(caseDir, { recursive: true, force: true });
  });

  // Pre-condition: a case names a fixture.commits entry whose tree, "fixture/missing",
  // does not exist anywhere under the case directory.
  // Test: buildFixture(c, caseDir).
  // Observable result: the call throws FixtureError, and no new entry appears under the
  // system temp directory (`os.tmpdir()`) after the throw — the mkdtemp parent the design
  // says a failure removes.
  // Expected-value source: design.md Component 2 post-condition 6, "A failure throws
  // FixtureError and removes the parent"; tasks.md task 5 Prompt, "a missing tree throws
  // FixtureError and leaves no parent directory".
  it('throws FixtureError and leaves no parent directory for a missing tree', () => {
    const caseDir = mkdtempSync(join(tmpdir(), 'fixture-case-'));
    const c = baseCase({ commits: [{ message: 'init', tree: 'fixture/missing' }] });
    const before = new Set(readdirSync(tmpdir()));

    let thrown: unknown;
    try {
      buildFixture(c, caseDir);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(FixtureError);
    const leftBehind = readdirSync(tmpdir()).filter((name) => !before.has(name));
    expect(leftBehind).toEqual([]);

    rmSync(caseDir, { recursive: true, force: true });
  });
});

describe('disposeFixture(f)', () => {
  // Pre-condition: a fixture built from one setup commit and no extras.
  // Test: disposeFixture(f).
  // Observable result: `f.parent` no longer exists.
  // Expected-value source: design.md Component 2 Interfaces, "disposeFixture(f: Fixture):
  // void"; Data Models, "parent is the mkdtemp directory disposeFixture removes"; tasks.md
  // task 5 Prompt, "disposeFixture removes the parent".
  it('removes the parent directory', () => {
    const caseDir = mkdtempSync(join(tmpdir(), 'fixture-case-'));
    writeTree(caseDir, 'fixture/01', { 'a.txt': 'one\n' });
    const c = baseCase({ commits: [{ message: 'init', tree: 'fixture/01' }] });
    const f = buildFixture(c, caseDir);

    disposeFixture(f);

    expect(existsSync(f.parent)).toBe(false);

    rmSync(caseDir, { recursive: true, force: true });
  });
});
