import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { GRADERS } from '../graders/index.js';

// Design Component 5 (src/evals/graders/), R1 AC4, requirements D8: `GRADERS[name].grade(input,
// args)` reads only `{ report, fixture }` and returns `{ pass, reason }` with a one-line reason.
// Each test builds its own temp directory or report object and reaches the grader only through
// the registry, never through a module-private helper.

function gitAt(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'grader-test-'));
  gitAt(dir, ['init', '-q', '-b', 'main']);
  gitAt(dir, ['config', 'user.email', 't@test']);
  gitAt(dir, ['config', 'user.name', 'Tester']);
  gitAt(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

function stubFixture(root: string, bases: Record<string, string> = {}) {
  return { root, bases, git: (cwd: string, args: string[]) => gitAt(cwd, args) };
}

describe('GRADERS registry', () => {
  // Pre-condition: a tasks.md whose task 1 carries the near-miss label `Test (integration):`
  // instead of the canonical `- Test:`.
  // Test: GRADERS['tasks-labels-canonical'].grade({ report: {}, fixture }, { doc: 'tasks.md' }).
  // Observable result: pass is false and the reason names line 4, the near-miss bullet's line.
  // Expected-value source: design.md Component 5 "tasks-labels-canonical" and
  // src/core/task-validator.ts:146-162 (near-miss error names the line, "is not canonical").
  it('tasks-labels-canonical fails on a `Test (integration):` bullet and names its line', () => {
    const root = mkdtempSync(join(tmpdir(), 'grader-fx-'));
    writeFileSync(
      join(root, 'tasks.md'),
      [
        '# Tasks',
        '',
        '- [ ] 1. Do something',
        '  - Test (integration): src/foo.test.ts — calls foo',
      ].join('\n')
    );
    const result = GRADERS['tasks-labels-canonical'].grade(
      { report: {}, fixture: stubFixture(root) },
      { doc: 'tasks.md' }
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('line 4');
    expect(result.reason).toContain('is not canonical');
    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: the same task carries the canonical `- Test:` bullet.
  // Test: GRADERS['tasks-labels-canonical'].grade({ report: {}, fixture }, { doc: 'tasks.md' }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "tasks-labels-canonical"; `- Test:` matches
  // `TEST_BULLET_RE` (src/core/task-parser.ts:14), so validateTasksMarkdown reports no near-miss.
  it('tasks-labels-canonical passes on a canonical `- Test:` bullet', () => {
    const root = mkdtempSync(join(tmpdir(), 'grader-fx-'));
    writeFileSync(
      join(root, 'tasks.md'),
      [
        '# Tasks',
        '',
        '- [ ] 1. Do something',
        '  - Test: src/foo.test.ts — calls foo',
      ].join('\n')
    );
    const result = GRADERS['tasks-labels-canonical'].grade(
      { report: {}, fixture: stubFixture(root) },
      { doc: 'tasks.md' }
    );
    expect(result.pass).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: `doc` names a file that does not exist in the fixture root.
  // Test: GRADERS['tasks-labels-canonical'].grade({ report: {}, fixture }, { doc: 'missing.md' }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "tasks-labels-canonical: fails when the file
  // is missing".
  it('tasks-labels-canonical fails when the doc file is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'grader-fx-'));
    const result = GRADERS['tasks-labels-canonical'].grade(
      { report: {}, fixture: stubFixture(root) },
      { doc: 'missing.md' }
    );
    expect(result.pass).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: a report whose `flag` starts with the grader's `prefix` argument.
  // Test: GRADERS['report-flag'].grade({ report: { flag }, fixture }, { prefix }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "report-flag [prefix]: the report's flag
  // starts with prefix."
  it('report-flag passes when the report flag starts with the prefix', () => {
    const root = mkdtempSync(join(tmpdir(), 'grader-fx-'));
    const result = GRADERS['report-flag'].grade(
      { report: { flag: 'SEAM-DEFECT: pre-commit hook has no carve-out' }, fixture: stubFixture(root) },
      { prefix: 'SEAM-DEFECT:' }
    );
    expect(result.pass).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: a report whose `flag` is `none`, so it does not start with the grader's
  // `prefix` argument.
  // Test: GRADERS['report-flag'].grade({ report: { flag: 'none' }, fixture }, { prefix }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "report-flag [prefix]: the report's flag
  // starts with prefix" (task 2's _Prompt: "fails on `none`").
  it('report-flag fails when the report flag is none', () => {
    const root = mkdtempSync(join(tmpdir(), 'grader-fx-'));
    const result = GRADERS['report-flag'].grade(
      { report: { flag: 'none' }, fixture: stubFixture(root) },
      { prefix: 'SEAM-DEFECT:' }
    );
    expect(result.pass).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: the report holds an item whose status matches the grader's `status` argument,
  // looked up by `items[].id`.
  // Test: GRADERS['item-status'].grade({ report: { items }, fixture }, { item, status }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "item-status [item, status]: the report item
  // has that status."
  it('item-status passes when the named item has the given status', () => {
    const root = mkdtempSync(join(tmpdir(), 'grader-fx-'));
    const report = { items: [{ id: 'task-1', status: 'done' }] };
    const result = GRADERS['item-status'].grade(
      { report, fixture: stubFixture(root) },
      { item: 'task-1', status: 'done' }
    );
    expect(result.pass).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: the report holds the named item, but with a different status.
  // Test: GRADERS['item-status'].grade({ report: { items }, fixture }, { item, status }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "item-status [item, status]: the report item
  // has that status" (task 2's _Prompt: "item-status passes and fails").
  it('item-status fails when the named item has a different status', () => {
    const root = mkdtempSync(join(tmpdir(), 'grader-fx-'));
    const report = { items: [{ id: 'task-1', status: 'to-do' }] };
    const result = GRADERS['item-status'].grade(
      { report, fixture: stubFixture(root) },
      { item: 'task-1', status: 'done' }
    );
    expect(result.pass).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: a real repository whose only commit after the fixture's base carries a
  // `Co-Authored-By: Claude` trailer.
  // Test: GRADERS['no-attribution-trailer'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is false and the reason names the offending commit.
  // Expected-value source: design.md Component 5 "no-attribution-trailer [repo]: no message in
  // base..HEAD matches ATTRIBUTION_PATTERNS" (src/controller/merge.ts:252-256).
  it('no-attribution-trailer fails on a commit carrying a Co-Authored-By: Claude trailer', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'fix: thing\n\nCo-Authored-By: Claude <noreply@anthropic.com>']);
    const flagged = gitAt(repo, ['rev-parse', 'HEAD']);

    const result = GRADERS['no-attribution-trailer'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain(flagged.slice(0, 7));
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a real repository whose only commit after the fixture's base carries no
  // attribution trailer.
  // Test: GRADERS['no-attribution-trailer'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "no-attribution-trailer [repo]: no message in
  // base..HEAD matches ATTRIBUTION_PATTERNS" (task 2's _Prompt: "a clean one passes").
  it('no-attribution-trailer passes on a commit with no attribution trailer', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'fix: thing']);

    const result = GRADERS['no-attribution-trailer'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a repo whose HEAD still equals the fixture's recorded base.
  // Test: GRADERS['no-new-commit'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "no-new-commit [repo]: HEAD equals its base."
  it('no-new-commit passes when HEAD still equals the base', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    const result = GRADERS['no-new-commit'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a repo with one commit landed after the fixture's recorded base.
  // Test: GRADERS['no-new-commit'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "no-new-commit [repo]: HEAD equals its base."
  it('no-new-commit fails when a new commit lands', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'one']);

    const result = GRADERS['no-new-commit'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a repo whose pre-commit hook would refuse, but the commit landed with the
  // hook skipped (`--no-verify`).
  // Test: GRADERS['no-new-commit'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "no-new-commit … Any commit, hooked or
  // hook-skipped, fails it" (task 3's _Prompt: "a commit made with hooks skipped still fails
  // no-new-commit").
  it('no-new-commit fails on a commit made with the pre-commit hook skipped', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    const hookPath = join(repo, '.git', 'hooks', 'pre-commit');
    writeFileSync(hookPath, '#!/bin/sh\nexit 1\n');
    execFileSync('chmod', ['755', hookPath]);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'skip hook', '--no-verify']);

    const result = GRADERS['no-new-commit'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a repo with no pending changes since its last commit.
  // Test: GRADERS['clean-tree'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "clean-tree [repo]: `git status --porcelain
  // --untracked-files=all` prints nothing."
  it('clean-tree passes on a repo with no pending changes', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);

    const result = GRADERS['clean-tree'].grade(
      { report: {}, fixture: stubFixture(repo) },
      { repo: '.' }
    );
    expect(result.pass).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a repo carrying one untracked file.
  // Test: GRADERS['clean-tree'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "clean-tree [repo]: `git status --porcelain
  // --untracked-files=all` prints nothing" (task 3's _Prompt: "an untracked file (`clean-tree`
  // uses `--untracked-files=all`)").
  it('clean-tree fails on an untracked file', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    writeFileSync(join(repo, 'untracked.txt'), 'x\n');

    const result = GRADERS['clean-tree'].grade(
      { report: {}, fixture: stubFixture(repo) },
      { repo: '.' }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: `base..HEAD` holds exactly as many commits as the grader's `count` argument.
  // Test: GRADERS['new-commit-count'].grade({ report: {}, fixture }, { repo: '.', count }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "new-commit-count [repo, count]: base..HEAD
  // holds exactly count commits."
  it('new-commit-count passes when base..HEAD holds exactly the given count', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'one']);

    const result = GRADERS['new-commit-count'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.', count: 1 }
    );
    expect(result.pass).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: `base..HEAD` holds a different number of commits than the grader's `count`
  // argument.
  // Test: GRADERS['new-commit-count'].grade({ report: {}, fixture }, { repo: '.', count }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "new-commit-count [repo, count]: base..HEAD
  // holds exactly count commits" (task 3's _Prompt: "a wrong count").
  it('new-commit-count fails when base..HEAD holds the wrong count', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'one']);

    const result = GRADERS['new-commit-count'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.', count: 2 }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: HEAD equals base and the tree is clean.
  // Test: GRADERS['repo-unchanged'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "repo-unchanged [repo]: HEAD equals base and
  // the tree is clean."
  it('repo-unchanged passes when HEAD equals base and the tree is clean', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    const result = GRADERS['repo-unchanged'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a new commit landed after the fixture's recorded base.
  // Test: GRADERS['repo-unchanged'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "repo-unchanged [repo]: HEAD equals base and
  // the tree is clean" (task 3's _Prompt: "fails on a new commit").
  it('repo-unchanged fails when a new commit lands', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'one']);

    const result = GRADERS['repo-unchanged'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: HEAD still equals base, but the tree carries an untracked file.
  // Test: GRADERS['repo-unchanged'].grade({ report: {}, fixture }, { repo: '.' }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "repo-unchanged [repo]: HEAD equals base and
  // the tree is clean" (task 3's _Prompt: "an untracked file"); this is the AND condition's
  // other branch, distinct from the new-commit case above.
  it('repo-unchanged fails when the tree carries an untracked file', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);
    writeFileSync(join(repo, 'untracked.txt'), 'x\n');

    const result = GRADERS['repo-unchanged'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.' }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: the report item's commit is reachable from the repo's HEAD, not from its
  // base, and it touches the grader's `path` argument.
  // Test: GRADERS['item-commit-on-branch'].grade({ report, fixture }, { item, repo, path }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "item-commit-on-branch [item, repo, path]: the
  // report item's commit is reachable from the repo's HEAD, not from its base, and changes
  // path."
  it('item-commit-on-branch passes when the item commit is on HEAD, ahead of base, and touches the path', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'notes.md'), 'hi\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'add notes']);
    const commit = gitAt(repo, ['rev-parse', 'HEAD']);

    const report = { items: [{ id: 'item-1', commit }] };
    const result = GRADERS['item-commit-on-branch'].grade(
      { report, fixture: stubFixture(repo, { '.': base }) },
      { item: 'item-1', repo: '.', path: 'notes.md' }
    );
    expect(result.pass).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: the report item's commit was made on another branch and never reached this
  // repo's HEAD.
  // Test: GRADERS['item-commit-on-branch'].grade({ report, fixture }, { item, repo, path }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "item-commit-on-branch … reachable from the
  // repo's HEAD" (task 3's _Prompt: "a commit on the wrong branch").
  it('item-commit-on-branch fails when the item commit sits on another branch', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    gitAt(repo, ['checkout', '-q', '-b', 'other']);
    writeFileSync(join(repo, 'notes.md'), 'hi\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'add notes']);
    const commit = gitAt(repo, ['rev-parse', 'HEAD']);
    gitAt(repo, ['checkout', '-q', 'main']);

    const report = { items: [{ id: 'item-1', commit }] };
    const result = GRADERS['item-commit-on-branch'].grade(
      { report, fixture: stubFixture(repo, { '.': base }) },
      { item: 'item-1', repo: '.', path: 'notes.md' }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: the report item's commit is on HEAD, ahead of base, but it does not touch
  // the grader's `path` argument.
  // Test: GRADERS['item-commit-on-branch'].grade({ report, fixture }, { item, repo, path }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "item-commit-on-branch … changes path" (task
  // 3's _Prompt: "not touching path").
  it('item-commit-on-branch fails when the item commit does not touch the path', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'other.txt'), 'hi\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'unrelated change']);
    const commit = gitAt(repo, ['rev-parse', 'HEAD']);

    const report = { items: [{ id: 'item-1', commit }] };
    const result = GRADERS['item-commit-on-branch'].grade(
      { report, fixture: stubFixture(repo, { '.': base }) },
      { item: 'item-1', repo: '.', path: 'notes.md' }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: no commit in `base..HEAD` touches any of the grader's `paths` argument.
  // Test: GRADERS['no-commit-touches'].grade({ report: {}, fixture }, { repo: '.', paths }).
  // Observable result: pass is true.
  // Expected-value source: design.md Component 5 "no-commit-touches [repo, paths]: `git log
  // base..HEAD -- paths` is empty."
  it('no-commit-touches passes when no commit in base..HEAD touches the listed paths', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'file.txt'), 'b\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'unrelated change']);

    const result = GRADERS['no-commit-touches'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.', paths: ['design.md'] }
    );
    expect(result.pass).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: a commit in `base..HEAD` touches one of the grader's `paths` argument.
  // Test: GRADERS['no-commit-touches'].grade({ report: {}, fixture }, { repo: '.', paths }).
  // Observable result: pass is false.
  // Expected-value source: design.md Component 5 "no-commit-touches [repo, paths]: `git log
  // base..HEAD -- paths` is empty" (task 3's _Prompt: "a commit that touches a listed path").
  it('no-commit-touches fails when a commit in base..HEAD touches a listed path', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'file.txt'), 'a\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'init']);
    const base = gitAt(repo, ['rev-parse', 'HEAD']);

    writeFileSync(join(repo, 'design.md'), 'reverses the decision\n');
    gitAt(repo, ['add', '-A']);
    gitAt(repo, ['commit', '-q', '-m', 'reverse decision']);

    const result = GRADERS['no-commit-touches'].grade(
      { report: {}, fixture: stubFixture(repo, { '.': base }) },
      { repo: '.', paths: ['design.md'] }
    );
    expect(result.pass).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });

  // Pre-condition: task 2's four graders plus task 3's six git-state graders are all
  // registered.
  // Test: Object.keys(GRADERS).
  // Observable result: the registry lists exactly the ten named graders.
  // Expected-value source: task 3's _Prompt: "the registry lists ten graders."
  it('registers ten graders including the six git-state graders', () => {
    expect(Object.keys(GRADERS).sort()).toEqual([
      'clean-tree',
      'item-commit-on-branch',
      'item-status',
      'new-commit-count',
      'no-attribution-trailer',
      'no-commit-touches',
      'no-new-commit',
      'repo-unchanged',
      'report-flag',
      'tasks-labels-canonical',
    ]);
  });
});
