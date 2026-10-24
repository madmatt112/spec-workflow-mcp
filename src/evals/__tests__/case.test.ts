import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadCase, listCaseIds, CaseError } from '../case.js';

// Design Component 1 (src/evals/case.ts), R1 AC1, AC5: loadCase(id, root) parses
// `harness/evals/<id>/case.json` into an EvalCase, or throws one CaseError listing every
// problem it finds (never stopping at the first); listCaseIds(root) lists the sorted case
// ids a directory holds. Each test builds its own temp cases root and reaches the loader
// only through loadCase/listCaseIds, never a module-private helper.

function writeCase(caseDir: string, data: unknown): void {
  mkdirSync(caseDir, { recursive: true });
  writeFileSync(join(caseDir, 'case.json'), JSON.stringify(data, null, 2));
}

describe('loadCase(id, root)', () => {
  // Pre-condition: a case directory named `valid-case` holds a case.json with every
  // required key set and every optional key (`cwd`, `fixture.preCommitHook`,
  // `fixture.worktrees`, a brief's `taskId`, a brief's `wire`) absent. Its (phase, role)
  // pair `(implementation, sdd-test-author)` has a registered schema (task 1's
  // reportSchema), its grader `clean-tree` is registered (tasks 2-3's GRADERS), and its
  // fixture tree path `fixture/01` exists under the case directory.
  // Test: loadCase('valid-case', root).
  // Observable result: the returned EvalCase carries the required fields as given, and the
  // absent optional keys read as undefined.
  // Expected-value source: design.md Component 1 post-conditions and Data Models (EvalCase);
  // "cwd, taskId, wire, preCommitHook and worktrees are optional."
  it('loads a valid case with its optional keys absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'case-valid-'));
    const caseDir = join(root, 'valid-case');
    mkdirSync(join(caseDir, 'fixture', '01'), { recursive: true });
    writeCase(caseDir, {
      id: 'valid-case',
      role: 'sdd-test-author',
      phase: 'implementation',
      spec: 'eval-valid-case',
      turnCap: 100,
      evidence: 'docs/example.md:1-2',
      briefs: [
        { template: 'test-author', file: 'author-brief.md', values: { title: 'x' } },
      ],
      fixture: { commits: [{ message: 'init', tree: 'fixture/01' }] },
      graders: [{ name: 'clean-tree', args: { repo: '.' } }],
    });

    const loaded = loadCase('valid-case', root);

    expect(loaded.id).toBe('valid-case');
    expect(loaded.role).toBe('sdd-test-author');
    expect(loaded.phase).toBe('implementation');
    expect(loaded.spec).toBe('eval-valid-case');
    expect(loaded.turnCap).toBe(100);
    expect(loaded.graders[0].name).toBe('clean-tree');
    expect(loaded.cwd).toBeUndefined();
    expect(loaded.fixture.preCommitHook).toBeUndefined();
    expect(loaded.fixture.worktrees).toBeUndefined();
    expect(loaded.briefs[0].taskId).toBeUndefined();
    expect(loaded.briefs[0].wire).toBeUndefined();

    rmSync(root, { recursive: true, force: true });
  });

  // Pre-condition: a case directory named `invalid-case` holds a case.json with eight
  // independent problems: an unknown top-level key (`notARealKey`); an `id` that does not
  // match the directory name; a `phase` outside implementation|document|closeout
  // (`qa-phase`); a (phase, role) pair with no registered schema (the same bad `phase`
  // paired with `sdd-mystery-role`, which matches none of task 1's five pairs under any
  // phase); a `turnCap` of 0; a grader name (`totally-unregistered-grader`) absent from
  // tasks 2-3's GRADERS registry; a fixture commit `tree` path (`fixture/missing-dir`)
  // that does not exist under the case directory; and a `spec` that does not start with
  // `eval-` (`plain-spec-name`).
  // Test: loadCase('invalid-case', root).
  // Observable result: loadCase throws one CaseError whose message names every one of the
  // eight bad values, in a single call (not requiring a second call to surface the rest).
  // Expected-value source: design.md Component 1 post-conditions (seven problem
  // categories) plus tasks.md task 4's eighth, the non-`eval-` spec (task-local D1).
  it('reports all eight problems of a malformed case in one error', () => {
    const root = mkdtempSync(join(tmpdir(), 'case-invalid-'));
    const caseDir = join(root, 'invalid-case');
    writeCase(caseDir, {
      notARealKey: true,
      id: 'invalid-case-mismatch',
      role: 'sdd-mystery-role',
      phase: 'qa-phase',
      spec: 'plain-spec-name',
      turnCap: 0,
      evidence: 'docs/example.md:1-2',
      briefs: [{ template: 'test-author', file: 'author-brief.md', values: {} }],
      fixture: { commits: [{ message: 'init', tree: 'fixture/missing-dir' }] },
      graders: [{ name: 'totally-unregistered-grader', args: {} }],
    });

    let thrown: unknown;
    try {
      loadCase('invalid-case', root);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(CaseError);
    const message = (thrown as Error).message;
    expect(message).toContain('notARealKey');
    expect(message).toContain('invalid-case-mismatch');
    expect(message).toContain('qa-phase');
    expect(message).toContain('sdd-mystery-role');
    expect(message).toContain('turnCap');
    expect(message).toContain('totally-unregistered-grader');
    expect(message).toContain('fixture/missing-dir');
    expect(message).toContain('plain-spec-name');

    rmSync(root, { recursive: true, force: true });
  });
});

describe('listCaseIds(root)', () => {
  // Pre-condition: a cases root holds `case-b/case.json` and `case-a/case.json`, plus a
  // `not-a-case/` directory with no `case.json` file.
  // Test: listCaseIds(root).
  // Observable result: `['case-a', 'case-b']`, sorted, `not-a-case` skipped.
  // Expected-value source: design.md Component 1 Interfaces, "listCaseIds(root?): string[]
  // (sorted directories holding a case.json)"; tasks.md task 4, "listCaseIds returns sorted
  // ids and skips a directory without case.json".
  it('returns sorted case ids and skips a directory without case.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'case-list-'));
    writeCase(join(root, 'case-b'), {});
    writeCase(join(root, 'case-a'), {});
    mkdirSync(join(root, 'not-a-case'), { recursive: true });
    writeFileSync(join(root, 'not-a-case', 'readme.txt'), 'not a case');

    expect(listCaseIds(root)).toEqual(['case-a', 'case-b']);

    rmSync(root, { recursive: true, force: true });
  });
});
