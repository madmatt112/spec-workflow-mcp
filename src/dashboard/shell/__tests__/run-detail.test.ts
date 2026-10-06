import { describe, it, expect } from 'vitest';
import { buildRunDetail } from '../run-detail.js';
import type { LedgerEvent, ActivityEvent } from '../../../watch/ledger.js';

// Contract for src/dashboard/shell/run-detail.ts (design.md C6; task 5 _Prompt;
// Requirements 4.3, 4.5, 4.7).
//
// Reached only through buildRunDetail(input: { spec, ledger, activity,
// handoffMd?, rowCap? }).
//
// Criterion "strip version: the state of the last merged row of that phase
//   matching /^v\d+$/, else null" (task 5 _Prompt: "`version` is the state of
//   the last merged row of that phase matching `/^v\d+$/`, else null"):
//   Pre-condition: a HANDOFF `## Phase log` with two `requirements` rows
//   (State `v1` then, later in the table, `v2`) and one `design` row (State
//   `in-progress`, no match).
//   Test: buildRunDetail({ spec: 'spec-a', ledger: [], activity: [],
//   handoffMd }).
//   Observable result: phaseStrip's `requirements` entry has `version`
//   `'v2'`; its `design` entry has `version` `null`.
//   Expected-value source: the literal State cells of the fixture HANDOFF
//   table, per the _Prompt's version rule (`/^v\d+$/`, "last merged row").
//
// Criterion "rounds counted across two runs" (task 5 _Prompt: "`rounds`
//   counts ledger `round` rows of that phase across all runs"):
//   Pre-condition: a ledger with two `run.start` rows (`run-1`, `run-2`) and
//   `round` rows for phase `implementation` in both runs (two in `run-1`, one
//   in `run-2`) plus one `round` row for phase `design` in `run-2`.
//   Test: buildRunDetail({ spec: 'spec-b', ledger, activity: [] }).
//   Observable result: phaseStrip's `implementation` entry has `rounds` `3`;
//   its `design` entry has `rounds` `1`.
//   Expected-value source: the count of `round` rows written into the fixture
//   ledger for each phase, summed across both run ids, per the _Prompt's
//   "across all runs" rule.
//
// Criterion "approval date: the date of the newest row of that phase whose
//   result is approved, complete or closed, else null, not the date of a
//   later non-matching row" (task 5 _Prompt: "`approvedOn` is the date of the
//   last row of that phase matching result is `approved`, `complete` or
//   `closed`, else null"):
//   Pre-condition: a HANDOFF `## Phase log` with three `design` rows in file
//   order: result `approved` dated 2026-04-01, result `complete` dated
//   2026-04-05, result `in-progress` dated 2026-04-10 (no match, latest row).
//   Test: buildRunDetail({ spec: 'spec-c', ledger: [], activity: [],
//   handoffMd }).
//   Observable result: phaseStrip's `design` entry has `approvedOn`
//   `'2026-04-05'` (the last matching row), not `'2026-04-10'` (the latest
//   row overall) and not `'2026-04-01'` (the first matching row).
//   Expected-value source: the literal Date cell of the fixture's second
//   `design` row, per the _Prompt's "last row … matching" rule.
//
// Criterion "live flag: true only for buildModel's live phase" (task 5
//   _Prompt: "`live` is true for the live phase"):
//   Pre-condition: a ledger with a `run.start` and a `phase.start` for
//   `implementation` with no later `phase.end` and no `run.end` (buildModel's
//   live-phase condition, src/watch/ledger.ts:271-281).
//   Test: buildRunDetail({ spec: 'spec-d', ledger, activity: [] }).
//   Observable result: phaseStrip's `implementation` entry has `live`
//   `true`; its `requirements` entry has `live` `false`.
//   Expected-value source: the fixture's `phase.start` row naming
//   `implementation` as the only open phase, per the _Prompt's live rule.
//
// Criterion "risk: the newest gate note's risk token for each task, low and
//   high" (task 5 _Prompt: "`risk` from the newest `note` whose `text` key
//   matches `gate: task ID pass|fail risk low|high`"):
//   Pre-condition: a ledger with three `note` rows: task `1` risk `high`
//   then, later, task `1` risk `low`; task `2` risk `high` (single row).
//   Test: buildRunDetail({ spec: 'spec-e', ledger, activity: [] }).
//   Observable result: taskMeta['1'].risk is `'low'` (the newer of the two
//   task-1 notes, not `'high'`); taskMeta['2'].risk is `'high'`.
//   Expected-value source: the literal risk tokens of the fixture `note`
//   rows' `text` fields, per the _Prompt's "newest note" rule.
//
// Criterion "fix rounds: the number in the newest task.done row's rounds key
//   for that task, null when no note matches that task" (task 5 _Prompt:
//   "`fixRounds` the number in the newest `task.done` row's `rounds` key for
//   that task … each null when absent"):
//   Pre-condition: a ledger with two `task.done` rows for task `5` (`rounds`
//   `1` then, later, `rounds` `3`) and one `task.done` row for task `6`
//   (`rounds` `2`); no `note` row for either task.
//   Test: buildRunDetail({ spec: 'spec-f', ledger, activity: [] }).
//   Observable result: taskMeta['5'].fixRounds is `3` (the newer of the two
//   task-5 rows, not `1`); taskMeta['6'].fixRounds is `2`; taskMeta['5'].risk
//   is `null` (no gate note for task 5).
//   Expected-value source: the literal `rounds` values of the fixture
//   `task.done` rows, per the _Prompt's "newest task.done" rule, and the
//   _Prompt's "null when absent" rule for the missing note.
//
// Criterion "cap: ledgerRows and activityRows keep the newest rowCap
//   current-run rows, oldest first, and drop an earlier run's rows" (task 5
//   _Prompt: "`ledgerRows`, `activityRows`: the current run's rows … oldest
//   first, the newest `rowCap` kept"):
//   Pre-condition: a ledger and activity file with an earlier run (`run-old`,
//   4 ledger rows, 2 activity rows) followed by the current run (`run-new`,
//   6 ledger rows, 5 activity rows); `rowCap: 3`.
//   Test: buildRunDetail({ spec: 'spec-g', ledger, activity, rowCap: 3 }).
//   Observable result: `ledgerRows` has length 3, holding exactly the newest
//   three `run-new` ledger rows in oldest-first order (none from `run-old`);
//   `activityRows` has length 3, holding exactly the newest three `run-new`
//   activity rows in oldest-first order (none from `run-old`).
//   Expected-value source: the literal `ts` ordering of the fixture's
//   `run-new` rows, per the _Prompt's "current run … oldest first, newest
//   rowCap kept" rule (current-run scoping matching buildModel,
//   src/watch/ledger.ts:256-260).

function handoffPhaseLog(rows: { date: string; spec: string; phase: string; state: string; result: string; note: string }[]): string {
  const lines = [
    '## Phase log',
    '',
    '| Date | Spec | Phase | State | Result | Note |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.date} | ${r.spec} | ${r.phase} | ${r.state} | ${r.result} | ${r.note} |`),
  ];
  return lines.join('\n');
}

describe('buildRunDetail', () => {
  it('sets phaseStrip version to the state of the last matching merged row, else null', () => {
    const handoffMd = handoffPhaseLog([
      { date: '2026-01-01', spec: 'spec-a', phase: 'requirements', state: 'v1', result: 'approved', note: 'first' },
      { date: '2026-01-02', spec: 'spec-a', phase: 'requirements', state: 'v2', result: 'approved', note: 'second' },
      { date: '2026-01-03', spec: 'spec-a', phase: 'design', state: 'in-progress', result: 'pending', note: 'wip' },
    ]);

    const detail = buildRunDetail({ spec: 'spec-a', ledger: [], activity: [], handoffMd });

    expect(detail.phaseStrip.find((p) => p.phase === 'requirements')?.version).toBe('v2');
    expect(detail.phaseStrip.find((p) => p.phase === 'design')?.version).toBeNull();
  });

  it('counts phaseStrip rounds as ledger round rows of that phase across all runs', () => {
    const ledger = [
      { ts: '2026-03-01T00:00:00.000Z', type: 'run.start', run: 'run-1', spec: 'spec-b' },
      { ts: '2026-03-01T00:05:00.000Z', type: 'round', run: 'run-1', phase: 'implementation', round: '1', verdict: 'needs-work' },
      { ts: '2026-03-01T00:10:00.000Z', type: 'round', run: 'run-1', phase: 'implementation', round: '2', verdict: 'approved' },
      { ts: '2026-03-02T00:00:00.000Z', type: 'run.start', run: 'run-2', spec: 'spec-b' },
      { ts: '2026-03-02T00:05:00.000Z', type: 'round', run: 'run-2', phase: 'implementation', round: '1', verdict: 'approved' },
      { ts: '2026-03-02T00:06:00.000Z', type: 'round', run: 'run-2', phase: 'design', round: '1', verdict: 'approved' },
    ] satisfies LedgerEvent[];

    const detail = buildRunDetail({ spec: 'spec-b', ledger, activity: [] });

    expect(detail.phaseStrip.find((p) => p.phase === 'implementation')?.rounds).toBe(3);
    expect(detail.phaseStrip.find((p) => p.phase === 'design')?.rounds).toBe(1);
  });

  it('sets phaseStrip approvedOn to the date of the last approved/complete/closed row, not a later non-matching row', () => {
    const handoffMd = handoffPhaseLog([
      { date: '2026-04-01', spec: 'spec-c', phase: 'design', state: 'v1', result: 'approved', note: 'first' },
      { date: '2026-04-05', spec: 'spec-c', phase: 'design', state: 'v1', result: 'complete', note: 'second' },
      { date: '2026-04-10', spec: 'spec-c', phase: 'design', state: 'v1', result: 'in-progress', note: 'revision requested' },
    ]);

    const detail = buildRunDetail({ spec: 'spec-c', ledger: [], activity: [], handoffMd });

    expect(detail.phaseStrip.find((p) => p.phase === 'design')?.approvedOn).toBe('2026-04-05');
  });

  it('marks only buildModel\'s live phase true in phaseStrip', () => {
    const ledger = [
      { ts: '2026-05-01T00:00:00.000Z', type: 'run.start', run: 'run-x', spec: 'spec-d' },
      { ts: '2026-05-01T00:01:00.000Z', type: 'phase.start', run: 'run-x', phase: 'implementation', mode: 'auto', state: 'in-progress' },
    ] satisfies LedgerEvent[];

    const detail = buildRunDetail({ spec: 'spec-d', ledger, activity: [] });

    expect(detail.phaseStrip.find((p) => p.phase === 'implementation')?.live).toBe(true);
    expect(detail.phaseStrip.find((p) => p.phase === 'requirements')?.live).toBe(false);
  });

  it('sets taskMeta risk from the newest gate note for each task', () => {
    const ledger = [
      { ts: '2026-06-01T00:00:00.000Z', type: 'run.start', run: 'run-y', spec: 'spec-e' },
      { ts: '2026-06-01T00:01:00.000Z', type: 'note', run: 'run-y', text: 'gate: task 1 fail risk high' },
      { ts: '2026-06-01T00:02:00.000Z', type: 'note', run: 'run-y', text: 'gate: task 1 pass risk low' },
      { ts: '2026-06-01T00:03:00.000Z', type: 'note', run: 'run-y', text: 'gate: task 2 fail risk high' },
    ] satisfies LedgerEvent[];

    const detail = buildRunDetail({ spec: 'spec-e', ledger, activity: [] });

    expect(detail.taskMeta['1']?.risk).toBe('low');
    expect(detail.taskMeta['2']?.risk).toBe('high');
  });

  it('sets taskMeta fixRounds from the newest task.done rounds for that task, null risk when no note matches', () => {
    const ledger = [
      { ts: '2026-07-01T00:00:00.000Z', type: 'run.start', run: 'run-z', spec: 'spec-f' },
      { ts: '2026-07-01T00:01:00.000Z', type: 'task.done', run: 'run-z', task: '5', rounds: '1', outcome: 'adjudicated' },
      { ts: '2026-07-01T00:02:00.000Z', type: 'task.done', run: 'run-z', task: '5', rounds: '3', outcome: 'pass' },
      { ts: '2026-07-01T00:03:00.000Z', type: 'task.done', run: 'run-z', task: '6', rounds: '2', outcome: 'pass' },
    ] satisfies LedgerEvent[];

    const detail = buildRunDetail({ spec: 'spec-f', ledger, activity: [] });

    expect(detail.taskMeta['5']?.fixRounds).toBe(3);
    expect(detail.taskMeta['6']?.fixRounds).toBe(2);
    expect(detail.taskMeta['5']?.risk).toBeNull();
  });

  it('caps ledgerRows and activityRows to the newest rowCap current-run rows, oldest first, dropping an earlier run', () => {
    const ledger = [
      { ts: '2026-08-01T00:00:00.000Z', type: 'run.start', run: 'run-old', spec: 'spec-g' },
      { ts: '2026-08-01T00:01:00.000Z', type: 'phase.start', run: 'run-old', phase: 'document', mode: 'auto', state: 'in-progress' },
      { ts: '2026-08-01T00:02:00.000Z', type: 'phase.end', run: 'run-old', phase: 'document', result: 'approved', state: 'v1' },
      { ts: '2026-08-01T00:03:00.000Z', type: 'run.end', run: 'run-old', status: 'ok' },
      { ts: '2026-08-02T00:00:00.000Z', type: 'run.start', run: 'run-new', spec: 'spec-g' },
      { ts: '2026-08-02T00:01:00.000Z', type: 'phase.start', run: 'run-new', phase: 'design', mode: 'auto', state: 'in-progress' },
      { ts: '2026-08-02T00:02:00.000Z', type: 'round', run: 'run-new', phase: 'design', round: '1', verdict: 'approved' },
      { ts: '2026-08-02T00:03:00.000Z', type: 'phase.end', run: 'run-new', phase: 'design', result: 'approved', state: 'v1' },
      { ts: '2026-08-02T00:04:00.000Z', type: 'phase.start', run: 'run-new', phase: 'implementation', mode: 'auto', state: 'in-progress' },
      { ts: '2026-08-02T00:05:00.000Z', type: 'spawn.start', run: 'run-new', agent: 'sdd-implementation-orchestrator', role: 'orchestrator', phase: 'implementation' },
    ] satisfies LedgerEvent[];
    const activity = [
      { ts: '2026-08-01T00:01:30.000Z', agent: 'sdd-document-orchestrator', event: 'agent.start', run: 'run-old' },
      { ts: '2026-08-01T00:01:45.000Z', agent: 'sdd-document-orchestrator', event: 'agent.stop', run: 'run-old', tokens: 100 },
      { ts: '2026-08-02T00:01:30.000Z', agent: 'sdd-design-orchestrator', event: 'agent.start', run: 'run-new' },
      { ts: '2026-08-02T00:02:30.000Z', agent: 'sdd-design-orchestrator', event: 'tool', tool: 'Read', run: 'run-new' },
      { ts: '2026-08-02T00:03:30.000Z', agent: 'sdd-design-orchestrator', event: 'tool', tool: 'Edit', run: 'run-new' },
      { ts: '2026-08-02T00:04:30.000Z', agent: 'sdd-design-orchestrator', event: 'agent.stop', run: 'run-new', tokens: 500 },
      { ts: '2026-08-02T00:05:30.000Z', agent: 'sdd-implementation-orchestrator', event: 'agent.start', run: 'run-new' },
    ] satisfies ActivityEvent[];

    const detail = buildRunDetail({ spec: 'spec-g', ledger, activity, rowCap: 3 });

    expect(detail.ledgerRows.map((r) => r.ts)).toEqual([
      '2026-08-02T00:03:00.000Z',
      '2026-08-02T00:04:00.000Z',
      '2026-08-02T00:05:00.000Z',
    ]);
    expect(detail.ledgerRows.every((r) => r.run === 'run-new')).toBe(true);

    expect(detail.activityRows.map((r) => r.ts)).toEqual([
      '2026-08-02T00:03:30.000Z',
      '2026-08-02T00:04:30.000Z',
      '2026-08-02T00:05:30.000Z',
    ]);
    expect(detail.activityRows.every((r) => r.run === 'run-new')).toBe(true);
  });
});
