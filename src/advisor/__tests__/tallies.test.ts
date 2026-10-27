import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { controllerHome, writeProjects } from '../../controller/state.js';
import type { KnownProject } from '../../controller/state.js';
import { openRunLedger } from '../../controller/ledger.js';
import { appendEvent } from '../home.js';
import { buildTallies } from '../tallies.js';

// Contract for src/advisor/tallies.ts (design.md C5; requirements.md
// Requirement 3 AC 1-4; tasks.md task 6). buildTallies(q) reads every known
// project's `specs/*/harness-events.jsonl` and `specs/*/retrospective.md`
// (found via readProjects(), src/controller/state.ts:427, under
// `<workflowRootPath>/.spec-workflow/specs/*`) plus the home `events.jsonl`,
// and buckets by ISO week into `Tallies.weeks[week]`. Each test runs against
// a fresh temp SDD_HOME and fresh temp project roots so the real home and
// repo are never touched. Fixture rows are written through the real
// production writers (`openRunLedger`, `appendEvent`), never hand-mocked.

let home: string;
let savedSddHome: string | undefined;
let extraDirs: string[];

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-advisor-tallies-home-'));
  process.env.SDD_HOME = home;
  extraDirs = [];
});

afterEach(() => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  rmSync(home, { recursive: true, force: true });
  for (const dir of extraDirs) rmSync(dir, { recursive: true, force: true });
});

function projectRoot(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  extraDirs.push(dir);
  return dir;
}

function specDirFor(root: string, spec: string): string {
  const dir = join(root, '.spec-workflow', 'specs', spec);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeProject(idAndName: string, root: string): KnownProject {
  return {
    id: idAndName,
    name: idAndName,
    workspacePath: root,
    workflowRootPath: root,
    seen: '2026-01-01T00:00:00.000Z',
  };
}

function git(repo: string, args: string[], env?: Record<string, string>): void {
  execFileSync('git', ['-C', repo, ...args], { env: { ...process.env, ...env } });
}

describe('src/advisor/tallies.ts buildTallies', () => {
  // AC 3.1 (tokens per role/spec) + AC 3.2 (ISO week bucketing over a date
  // range). Pre-condition: one known project with one spec whose
  // harness-events.jsonl holds two spawn.end rows for the same agent and
  // spec, one at 2025-12-29T10:00:00.000Z (ISO week 2026-W01 under the
  // Gregorian-year-crossing ISO 8601 rule) and one at
  // 2026-01-05T10:00:00.000Z (ISO week 2026-W02). Test: buildTallies({ from:
  // '2025-12-20T00:00:00.000Z', to: '2026-01-10T00:00:00.000Z' }). Observable
  // result: weeks['2026-W01'].tokens.byAgent/bySpec holds the first row's sum
  // (100) and weeks['2026-W02'] holds the second row's sum (200), each under
  // its own week key, not merged. Expected value source: design C5 ("bucketed
  // by ISO week ... each spawn.end row adds tokens to its agent and spec")
  // and the ISO 8601 week-numbering rule itself (independently computed, not
  // from the module under test).
  it('buckets spawn.end tokens by ISO week across a year boundary', async () => {
    const root = projectRoot('sdd-advisor-tallies-proj-');
    const specDir = specDirFor(root, 'spec-year');
    await writeProjects({ v: 1, projects: [makeProject('proj-year', root)] });

    const timestamps = ['2025-12-29T10:00:00.000Z', '2026-01-05T10:00:00.000Z'];
    let i = 0;
    const led = openRunLedger({ specDir, runId: 'run-year', spec: 'spec-year', now: () => new Date(timestamps[i++]) });
    led.spawnEnd({ agent: 'sdd-implementer', usage: { input: 60, output: 20, cacheRead: 10, cacheWrite5m: 5, cacheWrite1h: 5 } });
    led.spawnEnd({ agent: 'sdd-implementer', usage: { input: 120, output: 40, cacheRead: 20, cacheWrite5m: 10, cacheWrite1h: 10 } });

    const result: any = await buildTallies({ from: '2025-12-20T00:00:00.000Z', to: '2026-01-10T00:00:00.000Z' });

    expect(result.weeks['2026-W01'].tokens.byAgent['sdd-implementer']).toBe(100);
    expect(result.weeks['2026-W01'].tokens.bySpec['spec-year']).toBe(100);
    expect(result.weeks['2026-W02'].tokens.byAgent['sdd-implementer']).toBe(200);
    expect(result.weeks['2026-W02'].tokens.bySpec['spec-year']).toBe(200);
  });

  // AC 3.4: a second-opinion step's usage counts under role sdd-advisor.
  // Pre-condition: the home events.jsonl holds one advisor.opinion row
  // (written through appendEvent, the real C1 writer) with
  // input/output/cacheRead/cacheWrite5m/cacheWrite1h = 10/20/5/3/2 at
  // 2026-03-10T09:00:00.000Z (ISO week 2026-W11). Test:
  // buildTallies({ from: '2026-03-01T00:00:00.000Z', to:
  // '2026-03-20T00:00:00.000Z' }). Observable result:
  // weeks['2026-W11'].tokens.byAgent['sdd-advisor'] equals the row's five
  // fields summed (40). Expected value source: design C5 ("each
  // advisor.opinion row adds to role sdd-advisor", Requirement 3 AC 4) and
  // requirements.md Requirement 3 AC 4.
  it('counts an advisor.opinion row under role sdd-advisor', async () => {
    await appendEvent({
      v: 1,
      ts: '2026-03-10T09:00:00.000Z',
      type: 'advisor.opinion',
      wait: 'wait-1',
      outcome: 'ok',
      input: 10,
      output: 20,
      cacheRead: 5,
      cacheWrite5m: 3,
      cacheWrite1h: 2,
    });

    const result: any = await buildTallies({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-20T00:00:00.000Z' });

    expect(result.weeks['2026-W11'].tokens.byAgent['sdd-advisor']).toBe(40);
  });

  // AC 3.1 (failures by classification) with design D14. Pre-condition: one
  // project's harness-events.jsonl holds three spawn.usage rows at the same
  // timestamp (2026-04-13T09:00:00.000Z, ISO week 2026-W16): result 'ok'
  // (not a failure), result 'turn-cap' (a real, non-ok StepClassification,
  // src/controller/step.ts:71-77), and result 'success' (the CLI subtype the
  // document phase writes, src/controller/phases/document.ts:375, which is
  // not a StepClassification value). Test: buildTallies covering that week.
  // Observable result: weeks['2026-W16'].failures['turn-cap'] === 1,
  // weeks['2026-W16'].failures.unknown === 1 (the CLI-subtype row), and
  // failures.ok / failures.success are both undefined (ok never counts as a
  // failure; the literal CLI subtype string is never its own bucket).
  // Expected value source: design C5 and D14 ("a ledger result that is not a
  // step classification counts as unknown") plus the task's own Scope note
  // ("the document phase keeps writing the CLI subtype ... D14 counts it as
  // unknown").
  it('counts a non-ok StepClassification under its own name and a CLI-subtype result as unknown', async () => {
    const root = projectRoot('sdd-advisor-tallies-proj-');
    const specDir = specDirFor(root, 'spec-failures');
    await writeProjects({ v: 1, projects: [makeProject('proj-failures', root)] });

    const TS = '2026-04-13T09:00:00.000Z';
    const led = openRunLedger({ specDir, runId: 'run-fail', spec: 'spec-failures', now: () => new Date(TS) });
    led.spawnUsage({ agent: 'sdd-implementer', role: 'implement task 1', result: 'ok', phase: 'implementation', task: '1' });
    led.spawnUsage({ agent: 'sdd-implementer', role: 'implement task 2', result: 'turn-cap', phase: 'implementation', task: '2' });
    led.spawnUsage({ agent: 'sdd-drafter', role: 'draft', result: 'success', phase: 'document' });

    const result: any = await buildTallies({ from: '2026-04-01T00:00:00.000Z', to: '2026-04-20T00:00:00.000Z' });

    expect(result.weeks['2026-W16'].failures['turn-cap']).toBe(1);
    expect(result.weeks['2026-W16'].failures.unknown).toBe(1);
    expect(result.weeks['2026-W16'].failures.ok).toBeUndefined();
    expect(result.weeks['2026-W16'].failures.success).toBeUndefined();
  });

  // AC 3.3: a row missing a needed field counts as unknown and sets
  // floor:true on that column, never dropped. Pre-condition: one project's
  // harness-events.jsonl holds one spawn.end row at 2026-05-11T09:00:00.000Z
  // (ISO week 2026-W20) whose usage has an unknown cacheRead, so the ledger's
  // own sumStr (src/controller/ledger.ts:81-88) writes the row's `tokens`
  // field as the literal string "unknown" rather than a number — the
  // documented case of a ledger column that cannot observe a whole class of
  // events (agent-rules "Run ledger"). Test: buildTallies covering that
  // week. Observable result: weeks['2026-W20'].floor.tokens === true.
  // Expected value source: design C5 ("A row missing a needed field counts
  // as unknown, and that column carries floor: true") and requirements.md
  // Requirement 3 AC 3.
  it('sets floor.tokens when a spawn.end row has no usable tokens value', async () => {
    const root = projectRoot('sdd-advisor-tallies-proj-');
    const specDir = specDirFor(root, 'spec-floor');
    await writeProjects({ v: 1, projects: [makeProject('proj-floor', root)] });

    const TS = '2026-05-11T09:00:00.000Z';
    const led = openRunLedger({ specDir, runId: 'run-floor', spec: 'spec-floor', now: () => new Date(TS) });
    led.spawnEnd({ agent: 'sdd-implementer', usage: { input: 10, output: 5, cacheRead: 'unknown', cacheWrite5m: 0, cacheWrite1h: 0 } });

    const result: any = await buildTallies({ from: '2026-05-01T00:00:00.000Z', to: '2026-05-20T00:00:00.000Z' });

    expect(result.weeks['2026-W20'].floor.tokens).toBe(true);
  });

  // AC 3.1 (retro findings per category). Pre-condition: one project is a
  // git repo whose specs/spec-findings/retrospective.md has two level-2
  // headings ("## Gotchas" with two "- **F" lines, "## Process" with one),
  // committed once with GIT_AUTHOR_DATE/GIT_COMMITTER_DATE
  // 2026-06-15T12:00:00+00:00 (ISO week 2026-W25). Test: buildTallies
  // covering that week. Observable result:
  // weeks['2026-W25'].findings['Gotchas'] === 2 and
  // weeks['2026-W25'].findings['Process'] === 1. Expected value source:
  // design C5 ("each `- **F` line counts under the level-2 heading above
  // it, dated by the file's last commit") and requirements.md Requirement 3
  // AC 1 (retro findings per category, "a category is a level-2 heading of
  // retrospective.md").
  it('counts retrospective findings per level-2 heading, dated by the last commit', async () => {
    const root = projectRoot('sdd-advisor-tallies-proj-');
    const specDir = specDirFor(root, 'spec-findings');
    await writeProjects({ v: 1, projects: [makeProject('proj-findings', root)] });

    writeFileSync(join(specDir, 'harness-events.jsonl'), '');
    writeFileSync(
      join(specDir, 'retrospective.md'),
      [
        '# Retrospective — spec-findings',
        '',
        '## Gotchas',
        '',
        '- **F1 — Title one.** Body text about finding one for coverage.',
        '- **F2 — Title two.** Body text about finding two for coverage.',
        '',
        '## Process',
        '',
        '- **F3 — Title three.** Body text about finding three for coverage.',
        '',
      ].join('\n'),
    );

    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'test@example.com']);
    git(root, ['config', 'user.name', 'Test']);
    git(root, ['add', '-A']);
    const commitDate = '2026-06-15T12:00:00+00:00';
    git(root, ['commit', '-q', '-m', 'retro'], { GIT_AUTHOR_DATE: commitDate, GIT_COMMITTER_DATE: commitDate });

    const result: any = await buildTallies({ from: '2026-06-01T00:00:00.000Z', to: '2026-06-20T00:00:00.000Z' });

    expect(result.weeks['2026-W25'].findings['Gotchas']).toBe(2);
    expect(result.weeks['2026-W25'].findings['Process']).toBe(1);
  });

  // AC 3.2 (the optional project narrows the result). Pre-condition: two
  // known projects, 'alpha' and 'beta' (id and name both set to the same
  // string per project, so the filter matches whichever field the
  // implementation keys on), each with one spawn.end row at the same
  // timestamp 2026-07-06T09:00:00.000Z (ISO week 2026-W28) for a distinct
  // agent and spec. Test: buildTallies({ from, to, project: 'alpha' }).
  // Observable result: weeks['2026-W28'].tokens.byAgent / bySpec hold only
  // alpha's agent/spec (111); beta's agent/spec are absent. Expected value
  // source: design C5 ("buildTallies(q: { from, to, project? })") and
  // requirements.md Requirement 3 AC 2 ("an optional project").
  it('narrows the result to the named project when a project filter is given', async () => {
    const rootAlpha = projectRoot('sdd-advisor-tallies-alpha-');
    const rootBeta = projectRoot('sdd-advisor-tallies-beta-');
    const specDirAlpha = specDirFor(rootAlpha, 'spec-alpha');
    const specDirBeta = specDirFor(rootBeta, 'spec-beta');
    await writeProjects({
      v: 1,
      projects: [makeProject('alpha', rootAlpha), makeProject('beta', rootBeta)],
    });

    const TS = '2026-07-06T09:00:00.000Z';
    const ledAlpha = openRunLedger({ specDir: specDirAlpha, runId: 'run-alpha', spec: 'spec-alpha', now: () => new Date(TS) });
    ledAlpha.spawnEnd({ agent: 'agent-a', usage: { input: 100, output: 10, cacheRead: 1, cacheWrite5m: 0, cacheWrite1h: 0 } });
    const ledBeta = openRunLedger({ specDir: specDirBeta, runId: 'run-beta', spec: 'spec-beta', now: () => new Date(TS) });
    ledBeta.spawnEnd({ agent: 'agent-b', usage: { input: 200, output: 20, cacheRead: 2, cacheWrite5m: 0, cacheWrite1h: 0 } });

    const result: any = await buildTallies({ from: '2026-07-01T00:00:00.000Z', to: '2026-07-20T00:00:00.000Z', project: 'alpha' });

    expect(result.weeks['2026-W28'].tokens.byAgent['agent-a']).toBe(111);
    expect(result.weeks['2026-W28'].tokens.bySpec['spec-alpha']).toBe(111);
    expect(result.weeks['2026-W28'].tokens.byAgent['agent-b']).toBeUndefined();
    expect(result.weeks['2026-W28'].tokens.bySpec['spec-beta']).toBeUndefined();
  });
});
