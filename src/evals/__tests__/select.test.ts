import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { plannedRuns, selectCases } from '../select.js';

// Design Component 7 (src/evals/select.ts, design.md:98-107), Requirement 3 ACs 1 and 6
// (requirements.md:51, requirements.md:56): selectCases(opts) chooses the eval cases a
// deploy runs between a `base` and a `target` commit of a repository, reading both commits
// through `git` only (never a checkout). Every reason design.md:101-107 names selects the
// case with its literal label: a new case directory (`case`), a changed role file (`role`),
// a changed `agent-profiles.json` entry (`profile`), a changed grader file or a file it
// imports one hop away (`grader <name>`), and — only in `mode: 'exact'` — a changed rendered
// brief (`brief <template>`, design.md:106) or — only in `mode: 'provisional'` — a changed
// brief-source file (`brief source`, design.md:107, D5, marked `provisional: true`). An
// unrelated change selects nothing. In `mode: 'exact'`, a `baseDist` whose `tools/harness.js`
// throws, or no `baseDist` at all, selects the case with `brief: base render unavailable`
// (design.md:106, Error Handling 8, design.md:212). Each test builds its own two-commit temp
// git repository holding one case (`demo`, role `sdd-test-author`, template `test-author`)
// and reaches the selector only through `selectCases`, never a module-private helper.

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function initRepo(dir: string): void {
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@test']);
  git(dir, ['config', 'user.name', 'Tester']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
}

function commitAll(dir: string, message: string): string {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
  return git(dir, ['rev-parse', 'HEAD']);
}

/** The case directory a `demo` eval case needs: `case.json` plus a `test-author`-ready fixture tree. */
function writeCaseDir(dir: string): void {
  const caseDir = join(dir, 'harness', 'evals', 'demo');
  const treeDir = join(caseDir, 'fixture', '01');
  const wf = join(treeDir, '.spec-workflow');
  mkdirSync(join(wf, 'specs', 'eval-demo'), { recursive: true });
  writeFileSync(join(wf, 'agent-rules.md'), '# Agent rules\n\nmerge: ask\n');
  writeFileSync(
    join(wf, 'specs', 'eval-demo', 'tasks.md'),
    ['# Tasks', '', '- [ ] 1. Do something', '  - Test: src/foo.test.ts — calls foo', ''].join('\n'),
  );
  writeFileSync(
    join(caseDir, 'case.json'),
    JSON.stringify(
      {
        id: 'demo',
        role: 'sdd-test-author',
        phase: 'implementation',
        spec: 'eval-demo',
        turnCap: 50,
        evidence: 'docs/example.md:1-2',
        briefs: [
          {
            template: 'test-author',
            file: 'author-brief.md',
            taskId: '1',
            values: { title: 'Demo case', job: 'Write a failing test for task 1.' },
          },
        ],
        fixture: { commits: [{ message: 'init', tree: 'fixture/01' }] },
        graders: [{ name: 'fake-grader', args: {} }],
      },
      null,
      2,
    ),
  );
}

/** Shared infrastructure (role file, profile entry, grader + its one-hop import, README) every test starts from. */
function writeStable(dir: string, opts: { includeCase: boolean }): void {
  mkdirSync(join(dir, 'harness', 'agents'), { recursive: true });
  writeFileSync(join(dir, 'harness', 'agents', 'sdd-test-author.md'), 'role body v1\n');
  writeFileSync(
    join(dir, 'harness', 'agent-profiles.json'),
    JSON.stringify({ 'sdd-test-author': { model: 'sonnet', effort: 'medium' } }, null, 2),
  );
  mkdirSync(join(dir, 'src', 'evals', 'graders'), { recursive: true });
  writeFileSync(
    join(dir, 'src', 'evals', 'graders', 'fake-grader.ts'),
    "import { helper } from './fake-shared.js';\nexport const x = helper;\n",
  );
  writeFileSync(join(dir, 'src', 'evals', 'graders', 'fake-shared.ts'), 'export const helper = 1;\n');
  mkdirSync(join(dir, 'src', 'tools'), { recursive: true });
  writeFileSync(join(dir, 'src', 'tools', 'brief-templates.ts'), '// brief templates v1\n');
  writeFileSync(join(dir, 'src', 'tools', 'harness.ts'), '// harness v1\n');
  writeFileSync(join(dir, 'README.md'), 'hello\n');
  if (opts.includeCase) writeCaseDir(dir);
}

/** A fresh temp repo with a base commit (`demo` present unless `includeCase` is false), ready for one target mutation. */
function makeBaseRepo(includeCase = true): { dir: string; base: string } {
  const dir = mkdtempSync(join(tmpdir(), 'eval-select-'));
  initRepo(dir);
  writeStable(dir, { includeCase });
  const base = commitAll(dir, 'base');
  return { dir, base };
}

/** A `tools/harness.js` under `dir` that always writes the same fixed text, ignoring its input. */
function writeOkBaseDist(dir: string): void {
  mkdirSync(join(dir, 'tools'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  writeFileSync(
    join(dir, 'tools', 'harness.js'),
    [
      "import { writeFileSync } from 'fs';",
      'export async function harnessHandler(args) {',
      "  writeFileSync(args.values.path, 'OLD BASE BRIEF TEXT\\n', 'utf-8');",
      '  return { success: true, data: { path: args.values.path } };',
      '}',
      '',
    ].join('\n'),
  );
}

/** A `tools/harness.js` under `dir` whose `harnessHandler` always throws. */
function writeThrowingBaseDist(dir: string): void {
  mkdirSync(join(dir, 'tools'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  writeFileSync(
    join(dir, 'tools', 'harness.js'),
    ['export async function harnessHandler() {', "  throw new Error('base render boom');", '}', ''].join('\n'),
  );
}

function cleanup(...dirs: string[]): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}

describe('selectCases(opts)', () => {
  // Pre-condition: a two-commit repo where `base` has no `harness/evals/demo/` at all and
  // `target` adds the whole case directory (`case.json` plus its fixture tree); role,
  // profile and grader files are present and unchanged at both commits.
  // Test: selectCases({ repo, base, target, mode: 'provisional' }).
  // Observable result: the result names `demo` with reasons exactly `['case']` and
  // `provisional: false`.
  // Expected-value source: design.md Component 7 post-condition 1 (design.md:102, "`case`:
  // ... a new case counts"); requirements.md R3 AC1 (requirements.md:51, "the case's own
  // directory"); tasks.md task 8 Prompt, "a new case dir ... select[s] the case with that
  // reason".
  it('selects a case whose directory is new between base and target', async () => {
    const { dir, base } = makeBaseRepo(false);
    writeCaseDir(dir);
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'provisional' });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['case']);
    expect(demo?.provisional).toBe(false);

    cleanup(dir);
  });

  // Pre-condition: a two-commit repo where `demo` already exists, unchanged, at both
  // commits; `target` changes only `harness/agents/sdd-test-author.md`'s content.
  // Test: selectCases({ repo, base, target, mode: 'provisional' }).
  // Observable result: the result names `demo` with reasons exactly `['role']`.
  // Expected-value source: design.md Component 7 post-condition 2 (design.md:103, "`role`:
  // harness/agents/<role>.md changed"); requirements.md R3 AC1 (requirements.md:51, "its role
  // file"); tasks.md task 8 Prompt, "a role file change ... select[s] the case with that
  // reason".
  it('selects a case whose role file changed', async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(join(dir, 'harness', 'agents', 'sdd-test-author.md'), 'role body v2\n');
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'provisional' });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['role']);

    cleanup(dir);
  });

  // Pre-condition: a two-commit repo where `demo` is unchanged; `target` changes the
  // `sdd-test-author` entry in `harness/agent-profiles.json` (`effort` from `medium` to
  // `high`).
  // Test: selectCases({ repo, base, target, mode: 'provisional' }).
  // Observable result: the result names `demo` with reasons exactly `['profile']`.
  // Expected-value source: design.md Component 7 post-condition 3 (design.md:104, "the
  // role's `harness/agent-profiles.json` entry differs after `JSON.parse`"); requirements.md
  // R3 AC1 (requirements.md:51, "its role's entry in `harness/agent-profiles.json`"); tasks.md
  // task 8 Prompt, "a changed profile entry ... select[s] the case with that reason".
  it("selects a case whose role's agent-profiles.json entry changed", async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(
      join(dir, 'harness', 'agent-profiles.json'),
      JSON.stringify({ 'sdd-test-author': { model: 'sonnet', effort: 'high' } }, null, 2),
    );
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'provisional' });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['profile']);

    cleanup(dir);
  });

  // Pre-condition: a two-commit repo where `demo` is unchanged; `target` changes the grader
  // file itself (`src/evals/graders/fake-grader.ts`) that the case's only grader names.
  // Test: selectCases({ repo, base, target, mode: 'provisional' }).
  // Observable result: the result names `demo` with reasons exactly `['grader fake-grader']`.
  // Expected-value source: design.md Component 7 post-condition 4 (design.md:105, "`grader
  // <name>`: src/evals/graders/<name>.ts changed"); requirements.md R3 AC1
  // (requirements.md:51, "the grader code it names"); tasks.md task 8 Prompt, "a grader file
  // change ... select[s] the case with that reason".
  it('selects a case whose named grader file changed', async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(
      join(dir, 'src', 'evals', 'graders', 'fake-grader.ts'),
      "import { helper } from './fake-shared.js';\nexport const x = helper;\n// v2\n",
    );
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'provisional' });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['grader fake-grader']);

    cleanup(dir);
  });

  // Pre-condition: a two-commit repo where `demo` and `fake-grader.ts` are unchanged;
  // `target` changes only `fake-shared.ts`, the file `fake-grader.ts` imports one hop away
  // (`import { helper } from './fake-shared.js'`).
  // Test: selectCases({ repo, base, target, mode: 'provisional' }).
  // Observable result: the result names `demo` with reasons exactly `['grader
  // fake-grader']` — the same reason label as a direct grader-file change.
  // Expected-value source: design.md Component 7 post-condition 4 (design.md:105, "or a file
  // it imports by relative path changed; imports read by regex from the source at `target`,
  // `.js` mapped to `.ts`, one hop (D4)"); requirements.md R3 AC1 (requirements.md:51, "the
  // shared code that grader uses"); tasks.md task 8 Prompt, "a change to a file that grader
  // imports ... select[s] the case with that reason".
  it("selects a case whose grader's one-hop import changed, under the grader's own reason", async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(join(dir, 'src', 'evals', 'graders', 'fake-shared.ts'), 'export const helper = 2;\n');
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'provisional' });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['grader fake-grader']);

    cleanup(dir);
  });

  // Pre-condition: a two-commit repo where `demo`, the role file, the profile entry and the
  // grader are unchanged; `target` changes only `src/tools/brief-templates.ts`; mode is
  // `'provisional'`.
  // Test: selectCases({ repo, base, target, mode: 'provisional' }).
  // Observable result: the result names `demo` with reasons exactly `['brief source']` and
  // `provisional: true`.
  // Expected-value source: design.md Component 7 post-condition 6 (design.md:107, "`brief
  // source` (provisional): src/tools/brief-templates.ts or src/tools/harness.ts changed; the
  // selection is marked provisional"), D5 (design.md:230); requirements.md R3 AC6
  // (requirements.md:56, "it SHALL instead diff the source of every render function and
  // shared helper ... and mark a case selected by that signal alone provisional"); tasks.md
  // task 8 Prompt, "in provisional mode a `src/tools/brief-templates.ts` change selects it
  // marked provisional".
  it('marks a case provisional when only a brief-source file changed, in provisional mode', async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(join(dir, 'src', 'tools', 'brief-templates.ts'), '// brief templates v2\n');
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'provisional' });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['brief source']);
    expect(demo?.provisional).toBe(true);

    cleanup(dir);
  });

  // Pre-condition: a two-commit repo where `demo`, the role file, the profile entry, the
  // grader and the brief-source files are all unchanged; `target` changes only the unrelated
  // `README.md`.
  // Test: selectCases({ repo, base, target, mode: 'provisional' }).
  // Observable result: the result holds no entry for `demo` (nothing is selected).
  // Expected-value source: requirements.md R3 AC1 (requirements.md:51), read by its converse:
  // none of the named things changed, so no case is selected; tasks.md task 8 Prompt, "an
  // unrelated change selects nothing".
  it('selects nothing when only an unrelated file changed', async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(join(dir, 'README.md'), 'hello v2\n');
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'provisional' });

    expect(result.find((r) => r.id === 'demo')).toBeUndefined();

    cleanup(dir);
  });

  // Pre-condition: a two-commit repo where `demo`, the role file, the profile entry, the
  // grader and the brief-source files are all unchanged (only an unrelated README bump moves
  // HEAD); mode is `'exact'`; `baseDist` renders the case's `test-author` brief as a fixed
  // string distinct from whatever this build's real `harnessHandler` renders for the same
  // case and values.
  // Test: selectCases({ repo, base, target, mode: 'exact', baseDist }).
  // Observable result: the result names `demo` with reasons exactly `['brief
  // test-author']` and `provisional: false`.
  // Expected-value source: design.md Component 7 post-condition 5 (design.md:106, "materialise
  // target's harness/evals/<id>/ ... render the case's briefs ... with baseDist's ...
  // harnessHandler ... then again with this build's, compare texts"); requirements.md R3 AC1
  // (requirements.md:51, "the text any brief template the case renders produces with the
  // case's values (each brief rendered by both commits and compared)"); tasks.md task 8
  // Prompt, "a changed template output ... select[s] the case with that reason".
  it('selects a case whose rendered brief text differs between base and target, in exact mode', async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(join(dir, 'README.md'), 'hello v2\n');
    const target = commitAll(dir, 'target');
    const baseDist = mkdtempSync(join(tmpdir(), 'eval-basedist-'));
    writeOkBaseDist(baseDist);

    const result = await selectCases({ repo: dir, base, target, mode: 'exact', baseDist });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['brief test-author']);
    expect(demo?.provisional).toBe(false);

    cleanup(dir, baseDist);
  });

  // Pre-condition: same unchanged-except-README repo as above; mode is `'exact'`; `baseDist`
  // points at a `tools/harness.js` whose `harnessHandler` always throws.
  // Test: selectCases({ repo, base, target, mode: 'exact', baseDist }).
  // Observable result: the result names `demo` with reasons exactly `['brief: base render
  // unavailable']`.
  // Expected-value source: design.md Component 7 post-condition 5 (design.md:106, "An unset
  // baseDist, a failed import or a base render throw selects the case with `brief: base
  // render unavailable`"), Error Handling 8 (design.md:212, "the case is selected with
  // `brief: base render unavailable`"); tasks.md task 8 Prompt, "a `baseDist` whose
  // `tools/harness.js` throws gives `brief: base render unavailable`".
  it('selects a case with "brief: base render unavailable" when baseDist throws, in exact mode', async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(join(dir, 'README.md'), 'hello v2\n');
    const target = commitAll(dir, 'target');
    const baseDist = mkdtempSync(join(tmpdir(), 'eval-basedist-'));
    writeThrowingBaseDist(baseDist);

    const result = await selectCases({ repo: dir, base, target, mode: 'exact', baseDist });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['brief: base render unavailable']);

    cleanup(dir, baseDist);
  });

  // Pre-condition: same unchanged-except-README repo as above; mode is `'exact'`; no
  // `baseDist` is given at all.
  // Test: selectCases({ repo, base, target, mode: 'exact' }).
  // Observable result: the result names `demo` with reasons exactly `['brief: base render
  // unavailable']` — the same reason as a throwing baseDist.
  // Expected-value source: design.md Component 7 post-condition 5 (design.md:106, "An unset
  // baseDist ... selects the case with `brief: base render unavailable`"); tasks.md task 8
  // Prompt, "an unset `baseDist` gives the same reason".
  it('selects a case with "brief: base render unavailable" when baseDist is unset, in exact mode', async () => {
    const { dir, base } = makeBaseRepo();
    writeFileSync(join(dir, 'README.md'), 'hello v2\n');
    const target = commitAll(dir, 'target');

    const result = await selectCases({ repo: dir, base, target, mode: 'exact' });

    const demo = result.find((r) => r.id === 'demo');
    expect(demo?.reasons).toEqual(['brief: base render unavailable']);

    cleanup(dir);
  });
});

// Design Component 1 (design.md:34-44), Requirement 1 ACs 1, 3 and 4 (requirements.md:19,
// requirements.md:21-22): plannedRuns(reasons) is a pure function beside the reason strings
// selectCases builds. It returns 1 when every reason equals `role` or `profile`
// (design.md:38, src/evals/select.ts:188, src/evals/select.ts:190) or starts with `brief`
// (design.md:38, covering `brief <template>` at src/evals/select.ts:153, `brief source` at
// src/evals/select.ts:200, and `brief: base render unavailable` at src/evals/select.ts:131).
// It returns 3 in every other case, including a `case` or `grader <name>` reason
// (design.md:39, src/evals/select.ts:184, src/evals/select.ts:194) and a reason it does not
// know (design.md:39, D2, requirements.md:21). Each test calls plannedRuns directly with a
// fixed reasons array; no fixture or repository is needed because the function is pure.
describe('plannedRuns(reasons)', () => {
  // Pre-condition: none; plannedRuns is a pure function of its argument.
  // Test: plannedRuns(['role']).
  // Observable result: returns 1.
  // Expected-value source: design.md Component 1 post-condition 1 (design.md:38, "equals
  // `role` or `profile` ... (`src/evals/select.ts:188-190`)"); requirements.md R1 AC1
  // (requirements.md:19, "reasons are all `role` ... THEN the gate SHALL run that case
  // exactly 1 time").
  it('returns 1 for a role-only reason', () => {
    expect(plannedRuns(['role'])).toBe(1);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['profile']).
  // Observable result: returns 1.
  // Expected-value source: design.md Component 1 post-condition 1 (design.md:38, "equals
  // `role` or `profile`"); requirements.md R1 AC1 (requirements.md:19, "`profile`
  // (`src/evals/select.ts:190`) ... THEN ... run that case exactly 1 time").
  it('returns 1 for a profile-only reason', () => {
    expect(plannedRuns(['profile'])).toBe(1);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['brief source']).
  // Observable result: returns 1.
  // Expected-value source: design.md Component 1 post-condition 1 (design.md:38, "starts
  // with `brief`. That prefix covers all three brief forms"); requirements.md R1 AC1
  // (requirements.md:19, "`brief source` (`src/evals/select.ts:200`)").
  it('returns 1 for a brief-source-only reason', () => {
    expect(plannedRuns(['brief source'])).toBe(1);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['brief test-author']).
  // Observable result: returns 1.
  // Expected-value source: design.md Component 1 post-condition 1 (design.md:38, "starts
  // with `brief`"); requirements.md R1 AC1 (requirements.md:19, "`brief <template>`
  // (`src/evals/select.ts:153`)").
  it('returns 1 for a brief-template-only reason', () => {
    expect(plannedRuns(['brief test-author'])).toBe(1);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['brief: base render unavailable']).
  // Observable result: returns 1.
  // Expected-value source: design.md Component 1 post-condition 1 (design.md:38, "starts
  // with `brief`"); requirements.md R1 AC1 (requirements.md:19, "`brief: base render
  // unavailable` (`src/evals/select.ts:131`)").
  it('returns 1 for a base-render-unavailable-only reason', () => {
    expect(plannedRuns(['brief: base render unavailable'])).toBe(1);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['role', 'profile', 'brief source']).
  // Observable result: returns 1.
  // Expected-value source: design.md Component 1 post-condition 1 (design.md:38, "It returns
  // 1 when every reason is indirect"); requirements.md R1 AC1 (requirements.md:19, "reasons
  // are all `role` ... `profile` ... or brief reasons THEN ... run that case exactly 1
  // time").
  it('returns 1 for a mix of role, profile and brief-source reasons', () => {
    expect(plannedRuns(['role', 'profile', 'brief source'])).toBe(1);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['case']).
  // Observable result: returns 3.
  // Expected-value source: design.md Component 1 post-condition 2 (design.md:39, "a `case`
  // ... reason gives 3"); requirements.md R1 AC3 (requirements.md:21, "a `case` reason
  // (`src/evals/select.ts:184`) ... THEN the gate SHALL run that case 3 times").
  it('returns 3 for a case-only reason', () => {
    expect(plannedRuns(['case'])).toBe(3);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['grader x']).
  // Observable result: returns 3.
  // Expected-value source: design.md Component 1 post-condition 2 (design.md:39, "a ...
  // `grader <name>` reason gives 3"); requirements.md R1 AC3 (requirements.md:21, "a `grader
  // <name>` reason ... THEN the gate SHALL run that case 3 times").
  it('returns 3 for a grader-only reason', () => {
    expect(plannedRuns(['grader x'])).toBe(3);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['case', 'role']).
  // Observable result: returns 3.
  // Expected-value source: design.md Component 1 post-condition 2 (design.md:39, "alone or
  // with other reasons"); requirements.md R1 AC3 (requirements.md:21, "alone or with any
  // other reason, THEN the gate SHALL run that case 3 times").
  it('returns 3 for a case reason mixed with role', () => {
    expect(plannedRuns(['case', 'role'])).toBe(3);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['grader x', 'brief source']).
  // Observable result: returns 3.
  // Expected-value source: design.md Component 1 post-condition 2 (design.md:39, "alone or
  // with other reasons"); requirements.md R1 AC3 (requirements.md:21, "a `grader <name>`
  // reason, alone or with any other reason, THEN the gate SHALL run that case 3 times").
  it('returns 3 for a grader reason mixed with brief source', () => {
    expect(plannedRuns(['grader x', 'brief source'])).toBe(3);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['unknown']).
  // Observable result: returns 3.
  // Expected-value source: design.md Component 1 post-condition 2 (design.md:39, "a reason
  // this function does not know also gives 3 (D2)"); design.md D2 (design.md:148, "a reason
  // the rule does not know gives 3 runs ... it never silently weakens the gate").
  it('returns 3 for a reason the rule does not know', () => {
    expect(plannedRuns(['unknown'])).toBe(3);
  });

  // Pre-condition: none.
  // Test: plannedRuns(['unknown', 'role']).
  // Observable result: returns 3.
  // Expected-value source: design.md Component 1 post-condition 2 (design.md:39, "a reason
  // this function does not know also gives 3"); design.md D2 (design.md:148), read together
  // with post-condition 2's "In every other case" so one unknown reason outweighs an
  // otherwise-indirect reason in the same list.
  it('returns 3 for an unknown reason mixed with role', () => {
    expect(plannedRuns(['unknown', 'role'])).toBe(3);
  });
});
