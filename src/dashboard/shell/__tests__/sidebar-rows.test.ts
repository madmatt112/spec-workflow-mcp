import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { NOW_LIVE_STATUSES, buildSidebarRows } from '../sidebar-rows.js';
import type { NowModel, Wait, LiveRunRow, ControllerWait, ControllerRun } from '../types.js';

// Contract for src/dashboard/shell/sidebar-rows.ts (design.md C9; task 10
// _Prompt; Requirements 5.1 to 5.5, 5.9, 5.11, 6.1 to 6.5).
//
// Reached only through `buildSidebarRows(projects, now, waits, runs)`.
//
// Fold notes (recorded here, not as separate tests):
//  - R5 AC1 ("exactly one dot, one of the three states") has no assertion
//    beyond the dot tests below: `dot`'s TS type is the three-literal
//    union, and each state is produced and asserted by a dedicated test
//    (criteria "waiting ...", "running ...", "idle ..." below).
//  - R5 AC9 ("no new route, poll or topic") is covered by
//    shell-feed.test.ts's new "carries a sidebar row ..." case: `sidebar`
//    rides the existing `shell-now` message, not a new one.
//  - R5 AC11 ("the sidebar filter is not an input") is covered
//    structurally: `buildSidebarRows` takes no filter parameter, and every
//    test below asserts a row count equal to the full `projects` array it
//    passed, regardless of each row's computed dot.
//
// Criterion "waiting from an open controller wait, over running" (design
//   C9 "`dot` = `waiting` when some `waits` entry has `project` P and
//   `state` `open` ... else `running` when `liveCount` is 1 or more";
//   Requirement 5.2, 5.3):
//   Pre-condition: one project with an open `ControllerWait` naming it,
//   and a live-status `ControllerRun` for the same project (which alone
//   would make the dot `running`).
//   Test: buildSidebarRows([project], now, [wait], [run]).
//   Observable result: the row's `dot` is `'waiting'`, not `'running'`.
//   Expected-value source: the literal "waiting ... else running" order
//   of the C9 interface sentence.
//
// Criterion "waiting from now.waits only" (design C9 "... or some
//   `now.waits` row has `projectId` P"; Requirement 5.2; task 10 _Prompt
//   "each dot rule including a waiting from now.waits only"):
//   Pre-condition: one project with a `now.waits` row naming it and no
//   `ControllerWait` at all.
//   Test: buildSidebarRows([project], now, [], []).
//   Observable result: the row's `dot` is `'waiting'`.
//   Expected-value source: the literal "or some now.waits row has
//   projectId P" clause of the C9 interface sentence.
//
// Criterion "running when not waiting and live" (design C9 "else `running`
//   when `liveCount` is 1 or more (R5 AC3)"; Requirement 5.3):
//   Pre-condition: one project with a live-status `ControllerRun`, no
//   open wait anywhere.
//   Test: buildSidebarRows([project], now, [], [run]).
//   Observable result: the row's `dot` is `'running'` and its `liveCount`
//   is `1`.
//   Expected-value source: the literal "running when liveCount is 1 or
//   more" clause.
//
// Criterion "idle otherwise" (design C9 "else `idle` (R5 AC4)";
//   Requirement 5.4):
//   Pre-condition: one project with a non-open (`answered`) controller
//   wait naming it (so presence of a wait record alone must not trigger
//   `waiting`) and a `done` (non-live) controller run.
//   Test: buildSidebarRows([project], now, [answeredWait], [doneRun]).
//   Observable result: the row's `dot` is `'idle'` and `liveCount` is `0`.
//   Expected-value source: the literal "else idle" clause, falsified if a
//   non-open wait or a non-live run status were read as active.
//
// Criterion "liveCount from live-status controller runs, filtered by
//   project and status" (design C9 "`liveCount` = the count of `runs`
//   with `project` P and a status in `NOW_LIVE_STATUSES`"; Requirement
//   5.5; task 10 _Prompt "liveCount from controller runs"):
//   Pre-condition: one project with two live-status runs (`running`,
//   `queued`) and one non-live run (`done`), plus a live-status run
//   belonging to a different project.
//   Test: buildSidebarRows([project], now, [], [run1, run2, run3,
//   otherProjectRun]).
//   Observable result: `liveCount` is `2` (the other project's run and
//   the `done` run are excluded).
//   Expected-value source: the `NOW_LIVE_STATUSES` set and the "with
//   project P" filter of the C9 sentence.
//
// Criterion "liveCount falls back to now.live when no controller run is
//   live" (design C9 "when that is 0, the count of `now.live` rows with
//   `projectId` P"; Requirement 5.5; task 10 _Prompt "liveCount ... from
//   now.live when no controller run is live"):
//   Pre-condition: one project with no live-status controller run (one
//   `done` run) and two `now.live` rows naming it.
//   Test: buildSidebarRows([project], now, [], [doneRun]).
//   Observable result: `liveCount` is `2` (the `now.live` count, not `0`).
//   Expected-value source: the literal "when that is 0, the count of
//   now.live rows" clause.
//
// Criterion "lastActivity is the newest updated run of any status"
//   (design C9 "`lastActivity` = the greatest `updated` among `runs` with
//   `project` P, any status, else null (R6 AC3)"; Requirement 6.3; task 10
//   _Prompt "lastActivity across done and running records"):
//   Pre-condition: one project with three runs of different statuses
//   (`done`, `running`, `abandoned`) and distinct `updated` times, the
//   newest on the `running` row.
//   Test: buildSidebarRows([project], now, [], [runDone, runRunning,
//   runAbandoned]).
//   Observable result: `lastActivity` equals the `running` row's
//   `updated`, not the latest-added row or the live one by assumption.
//   Expected-value source: the fixture's own `updated` values; "any
//   status" from the cited sentence.
//
// Criterion "lastActivity is null with no run record" (design C9 "...
//   else null"; Requirement 6.3 feeding 6.4's "no controller run record"
//   case):
//   Pre-condition: one project with no `ControllerRun` at all.
//   Test: buildSidebarRows([project], now, [], []).
//   Observable result: `lastActivity` is `null`.
//   Expected-value source: the literal "else null" clause.
//
// Criterion "active group before idle group, newest first within each"
//   (design C9 "Order: waiting and running rows before idle rows (R6
//   AC1); within each group, non-null lastActivity newest first, then
//   null (R6 AC2, AC4)"; Requirements 6.1, 6.2; task 10 _Prompt "order,
//   ties"):
//   Pre-condition: four projects — one waiting (newest activity), one
//   running (older activity), two idle with distinct, older activity
//   times, one newer than the other.
//   Test: buildSidebarRows(projects, now, [wait], runs).
//   Observable result: the returned rows' `projectId`s, in order, are
//   [waiting, running, idle-newer, idle-older].
//   Expected-value source: the literal "before ... newest first" clauses,
//   falsified by any group interleaving or reversed recency.
//
// Criterion "no-record sorts after a record in its group; ties by name
//   then id" (design C9 "ties by projectName (locale compare), then
//   projectId"; Requirement 6.4):
//   Pre-condition: four idle projects: two share one `updated` time and
//   one name ('Alpha'), differing only by id; one more has the same
//   `updated` time but a later name ('Beta'); one has no run record.
//   Test: buildSidebarRows(projects, now, [], runs).
//   Observable result: the order is [the lower-id 'Alpha', the
//   higher-id 'Alpha', 'Beta', the no-record project] — ties broken by
//   name then id, the no-record project last.
//   Expected-value source: the literal "ties by projectName ... then
//   projectId" clause; Requirement 6.4's "sort after every project in its
//   group that has one".
//
// Criterion "a total order: equal input gives equal order" (design C9
//   "It is a total order, so equal inputs give an equal order (R6 AC5)";
//   Requirement 6.5; task 10 _Prompt "an unchanged order for equal
//   input"):
//   Pre-condition: three idle projects tied on both `updated` time and
//   dot, named so no earlier tie-break but name then id distinguishes
//   them; the same value-equal (freshly built, not reused) projects/now/
//   waits/runs passed twice.
//   Test: buildSidebarRows(...) called twice with value-equal arguments.
//   Observable result: both calls' `projectId` order arrays are
//   deep-equal.
//   Expected-value source: the literal "equal inputs give an equal order"
//   clause.
//
// Criterion "the server's live-status set matches the Now page's" (design
//   D11 "The server's live-status set copies the Now page's, plus a test
//   comparing the two by reading the page source"; Testing Strategy
//   `sidebar-rows.test.ts` bullet; task 10 _Prompt "a test that reads
//   NowPage.tsx as text and asserts its CTRL_LIVE_STATUSES literal equals
//   NOW_LIVE_STATUSES"):
//   Pre-condition: the real `NowPage.tsx` source on disk.
//   Test: read the file as text, extract the `CTRL_LIVE_STATUSES` array
//   literal's string values.
//   Observable result: that list deep-equals `NOW_LIVE_STATUSES`.
//   Expected-value source: `NowPage.tsx`'s own `CTRL_LIVE_STATUSES` line,
//   read live, not copied into this file.

const T = {
  old: '2026-01-01T00:00:00.000Z',
  mid: '2026-02-01T00:00:00.000Z',
  new: '2026-03-01T00:00:00.000Z',
  newer: '2026-04-01T00:00:00.000Z',
};

function wait(overrides: Partial<ControllerWait> & { id: string; project: string }): ControllerWait {
  return {
    kind: 'question',
    run: 'run-1',
    spec: 'spec-1',
    created: T.old,
    questions: [],
    state: 'open',
    ...overrides,
  };
}

function run(overrides: Partial<ControllerRun> & { id: string; project: string }): ControllerRun {
  return {
    spec: 'spec-1',
    status: 'running',
    tokens: 0,
    created: T.old,
    updated: T.old,
    ...overrides,
  };
}

function nowWait(overrides: Partial<Wait> & { projectId: string }): Wait {
  return {
    kind: 'quiet',
    projectName: 'X',
    spec: null,
    since: T.old,
    summary: 'quiet',
    detail: { kind: 'quiet', agent: 'a', lastTool: null, lastActivityAt: T.old },
    ...overrides,
  };
}

function liveRunRow(overrides: Partial<LiveRunRow> & { projectId: string }): LiveRunRow {
  return {
    projectName: 'X',
    spec: 'spec-1',
    runId: 'r1',
    phase: null,
    detail: '',
    tokens: 0,
    startedAt: null,
    ...overrides,
  };
}

function emptyNowModel(overrides: { waits?: Wait[]; live?: LiveRunRow[] } = {}): NowModel {
  return {
    waits: overrides.waits ?? [],
    live: overrides.live ?? [],
    idle: [],
    closed: [],
    runs: [],
    sidebar: [],
    generatedAt: T.old,
  } as NowModel;
}

describe('buildSidebarRows', () => {
  it('is waiting when a controller wait is open for the project, even over a live run', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel(),
      [wait({ id: 'w1', project: 'p1', state: 'open' })],
      [run({ id: 'r1', project: 'p1', status: 'running' })],
    );
    expect(rows.find((r) => r.projectId === 'p1')?.dot).toBe('waiting');
  });

  it('is waiting when only now.waits carries a row for the project, with no ControllerWait', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel({ waits: [nowWait({ projectId: 'p1' })] }),
      [],
      [],
    );
    expect(rows.find((r) => r.projectId === 'p1')?.dot).toBe('waiting');
  });

  it('is running when not waiting and has at least one live controller run', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel(),
      [],
      [run({ id: 'r1', project: 'p1', status: 'running' })],
    );
    const row = rows.find((r) => r.projectId === 'p1');
    expect(row?.dot).toBe('running');
    expect(row?.liveCount).toBe(1);
  });

  it('is idle when a non-open wait and a non-live run exist for the project', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel(),
      [wait({ id: 'w1', project: 'p1', state: 'answered' })],
      [run({ id: 'r1', project: 'p1', status: 'done' })],
    );
    const row = rows.find((r) => r.projectId === 'p1');
    expect(row?.dot).toBe('idle');
    expect(row?.liveCount).toBe(0);
  });

  it('counts liveCount from live-status controller runs for the project, excluding other statuses and other projects', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel(),
      [],
      [
        run({ id: 'r1', project: 'p1', status: 'running' }),
        run({ id: 'r2', project: 'p1', status: 'queued' }),
        run({ id: 'r3', project: 'p1', status: 'done' }),
        run({ id: 'r4', project: 'other', status: 'running' }),
      ],
    );
    expect(rows.find((r) => r.projectId === 'p1')?.liveCount).toBe(2);
  });

  it('falls back to the now.live count when the project has no live-status controller run', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel({ live: [liveRunRow({ projectId: 'p1', runId: 'a' }), liveRunRow({ projectId: 'p1', runId: 'b' })] }),
      [],
      [run({ id: 'r1', project: 'p1', status: 'done' })],
    );
    expect(rows.find((r) => r.projectId === 'p1')?.liveCount).toBe(2);
  });

  it('sets lastActivity to the newest updated run of any status', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel(),
      [],
      [
        run({ id: 'r1', project: 'p1', status: 'done', updated: T.mid }),
        run({ id: 'r2', project: 'p1', status: 'running', updated: T.new }),
        run({ id: 'r3', project: 'p1', status: 'abandoned', updated: T.old }),
      ],
    );
    expect(rows.find((r) => r.projectId === 'p1')?.lastActivity).toBe(T.new);
  });

  it('leaves lastActivity null for a project with no controller run record', () => {
    const projects = [{ projectId: 'p1', projectName: 'Alpha' }];
    const rows = buildSidebarRows(projects, emptyNowModel(), [], []);
    expect(rows.find((r) => r.projectId === 'p1')?.lastActivity).toBeNull();
  });

  it('sorts the waiting and running group before idle, newest lastActivity first within each group', () => {
    const projects = [
      { projectId: 'idle-newer', projectName: 'Idle-Newer' },
      { projectId: 'active-running', projectName: 'Active-Running' },
      { projectId: 'idle-older', projectName: 'Idle-Older' },
      { projectId: 'active-waiting', projectName: 'Active-Waiting' },
    ];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel(),
      [wait({ id: 'w1', project: 'active-waiting', state: 'open' })],
      [
        run({ id: 'r1', project: 'idle-newer', status: 'done', updated: T.mid }),
        run({ id: 'r2', project: 'active-running', status: 'running', updated: T.new }),
        run({ id: 'r3', project: 'idle-older', status: 'abandoned', updated: T.old }),
        run({ id: 'r4', project: 'active-waiting', status: 'done', updated: T.newer }),
      ],
    );
    expect(rows.map((r) => r.projectId)).toEqual([
      'active-waiting', 'active-running', 'idle-newer', 'idle-older',
    ]);
  });

  it('sorts a no-record project after every project in its group with a record, ties by name then id', () => {
    const projects = [
      { projectId: 'id-no-record', projectName: 'Zeta' },
      { projectId: 'id-tie-c', projectName: 'Alpha' },
      { projectId: 'id-tie-b', projectName: 'Beta' },
      { projectId: 'id-tie-a', projectName: 'Alpha' },
    ];
    const rows = buildSidebarRows(
      projects,
      emptyNowModel(),
      [],
      [
        run({ id: 'r1', project: 'id-tie-c', status: 'done', updated: T.mid }),
        run({ id: 'r2', project: 'id-tie-b', status: 'done', updated: T.mid }),
        run({ id: 'r3', project: 'id-tie-a', status: 'done', updated: T.mid }),
      ],
    );
    expect(rows.map((r) => r.projectId)).toEqual([
      'id-tie-a', 'id-tie-c', 'id-tie-b', 'id-no-record',
    ]);
  });

  it('gives an equal order for value-equal input, even when the projects array arrives in a different order', () => {
    const buildProjects = (order: string[]) => order.map((id) => ({ projectId: id, projectName: id === 'id-1' ? 'Alpha' : id === 'id-2' ? 'Beta' : 'Gamma' }));
    const buildRuns = () => ['id-1', 'id-2', 'id-3'].map((id, i) => run({ id: `r${i}`, project: id, status: 'done', updated: T.mid }));

    const rows1 = buildSidebarRows(buildProjects(['id-1', 'id-2', 'id-3']), emptyNowModel(), [], buildRuns());
    const rows2 = buildSidebarRows(buildProjects(['id-3', 'id-1', 'id-2']), emptyNowModel(), [], buildRuns());

    expect(rows1.map((r) => r.projectId)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(rows2.map((r) => r.projectId)).toEqual(rows1.map((r) => r.projectId));
  });

  it("matches NowPage.tsx's CTRL_LIVE_STATUSES literal", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const nowPagePath = join(here, '..', '..', '..', 'dashboard_frontend', 'src', 'modules', 'shell', 'NowPage.tsx');
    const text = readFileSync(nowPagePath, 'utf8');
    const nameIdx = text.indexOf('CTRL_LIVE_STATUSES');
    const eqIdx = text.indexOf('=', nameIdx);
    const openIdx = text.indexOf('[', eqIdx);
    const closeIdx = text.indexOf(']', openIdx);
    const body = text.slice(openIdx + 1, closeIdx);
    const items = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);

    expect(items.length).toBeGreaterThan(0);
    expect([...NOW_LIVE_STATUSES]).toEqual(items);
  });
});
