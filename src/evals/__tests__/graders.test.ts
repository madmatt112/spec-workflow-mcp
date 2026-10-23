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
});
