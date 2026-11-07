import { describe, it, expect, beforeAll } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Contract for dashboard-board task 7 (design C8 "Project enable state";
// Requirements 1.6, 1.7).
//
// `enable.ts` lives under `src/dashboard_frontend/`, which the root
// `tsconfig.json` excludes (`:20`) and `vitest.config.ts` excludes from the
// run (`:9`). A static `import` of it from this file (under `src/dashboard`,
// which IS in the root program) pulls the frontend file into that program
// and fails `npx tsc --noEmit` with TS2835, because the frontend has no
// tsconfig of its own to resolve against. The module is instead loaded at
// runtime with `await import(pathToFileURL(...).href)`, a computed
// specifier TypeScript does not try to resolve statically, and cast to a
// hand-written type below (task 7 _Prompt, same pattern as
// `deploy-view.test.ts:12-17`).

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = join(HERE, '..', '..', '..', 'dashboard_frontend', 'src', 'modules');

type EnableModule = {
  isEnabled: (id: string, name: string, off: string[], on: string[]) => boolean;
  toggled: (id: string, name: string, off: string[], on: string[]) => { off: string[]; on: string[] };
  DEFAULT_OFF_NAMES: readonly string[];
};

describe('enable.ts (src/dashboard_frontend/src/modules/projects/enable.ts)', () => {
  let enable: EnableModule;

  beforeAll(async () => {
    enable = (await import(pathToFileURL(join(FE, 'projects', 'enable.ts')).href)) as EnableModule;
  });

  // Criterion "An id in `on` is enabled even when also in `off` and even
  // when named `sdd-fixture`" (design C8 "An id in `on` is enabled, else an
  // id in `off` is disabled, else ..."; task 7 Success).
  //   Pre-condition: id 'p1', name 'sdd-fixture', present in both `off` and
  //   `on`.
  //   Test: isEnabled('p1', 'sdd-fixture', ['p1'], ['p1']).
  //   Observable result: true.
  //   Expected-value source: design C8's post-condition order — `on` is
  //   checked first, so it wins over `off` and over the `DEFAULT_OFF_NAMES`
  //   fallback.
  it('treats an id in `on` as enabled even when also in `off` and even when named sdd-fixture', () => {
    expect(enable.isEnabled('p1', 'sdd-fixture', ['p1'], ['p1'])).toBe(true);
  });

  // Criterion "an id in `off` only is disabled" (design C8 "... else an id
  // in `off` is disabled ..."; task 7 Success).
  //   Pre-condition: id 'p2' present in `off` only, named a project other
  //   than sdd-fixture.
  //   Test: isEnabled('p2', 'tradr', ['p2'], []).
  //   Observable result: false.
  //   Expected-value source: design C8's post-condition's `off` branch.
  it('treats an id in `off` only as disabled', () => {
    expect(enable.isEnabled('p2', 'tradr', ['p2'], [])).toBe(false);
  });

  // Criterion "an unset `sdd-fixture` is disabled" (design C8 "... else the
  // project is enabled unless its name is in `DEFAULT_OFF_NAMES`"; task 7
  // Success; Requirement 1.7 "the operator has never set the project
  // `sdd-fixture` ... it SHALL be off").
  //   Pre-condition: id 'p3' named 'sdd-fixture', absent from both `off`
  //   and `on`.
  //   Test: isEnabled('p3', 'sdd-fixture', [], []).
  //   Observable result: false.
  //   Expected-value source: `DEFAULT_OFF_NAMES = ['sdd-fixture']` (design
  //   C8) feeding the unset-fallback branch.
  it('treats an unset sdd-fixture as disabled', () => {
    expect(enable.isEnabled('p3', 'sdd-fixture', [], [])).toBe(false);
  });

  // Criterion "any other unset project, each tradr entry included, is
  // enabled (D24)" (design C8 post-condition's unset-fallback branch;
  // design D24 "Both tradr entries default to on"; task 7 Success;
  // Requirement 1.7 "Every other unset project SHALL stay on").
  //   Pre-condition: two project ids named for the two tradr entries, plus
  //   one named for an unrelated project, all absent from both `off` and
  //   `on`.
  //   Test: isEnabled for each of the three.
  //   Observable result: true for all three.
  //   Expected-value source: the literal "any other unset project ...
  //   is enabled" clause, cross-checked against D24's "both tradr entries
  //   default to on".
  it('treats any other unset project as enabled, including both tradr entries', () => {
    expect(enable.isEnabled('tradr-1', 'tradr', [], [])).toBe(true);
    expect(enable.isEnabled('tradr-2', 'tradr-fixture', [], [])).toBe(true);
    expect(enable.isEnabled('p4', 'some-other-project', [], [])).toBe(true);
  });

  // Criterion "`toggled` on an unset `sdd-fixture` puts its id in `on`"
  // (design C8 "`toggled` flips the current value by moving the id into
  // the other list"; task 7 Success; Requirement 1.7's "stay on across
  // reloads once turned on").
  //   Pre-condition: id 'p3' named 'sdd-fixture', absent from both `off`
  //   and `on` (disabled, per the unset-fallback branch).
  //   Test: toggled('p3', 'sdd-fixture', [], []).
  //   Observable result: { off: [], on: ['p3'] }.
  //   Expected-value source: the task Success line's literal "puts its id
  //   in on" clause.
  it('puts the id in `on` when toggling an unset sdd-fixture', () => {
    expect(enable.toggled('p3', 'sdd-fixture', [], [])).toEqual({ off: [], on: ['p3'] });
  });

  // Criterion "`toggled` on an enabled project puts its id in `off` and
  // removes it from `on`" (design C8 "`toggled` flips the current value by
  // moving the id into the other list"; task 7 Success).
  //   Pre-condition: id 'p4' named 'tradr', currently enabled because it is
  //   listed in `on`.
  //   Test: toggled('p4', 'tradr', [], ['p4']).
  //   Observable result: { off: ['p4'], on: [] } — 'p4' moves into `off`
  //   and is removed from `on`.
  //   Expected-value source: the task Success line's literal "puts its id
  //   in off and removes it from on" clause.
  it('puts the id in `off` and removes it from `on` when toggling an enabled project', () => {
    expect(enable.toggled('p4', 'tradr', [], ['p4'])).toEqual({ off: ['p4'], on: [] });
  });

  // Criterion "toggling twice returns the first answer" (task 7 Success).
  //   Pre-condition: id 'p3' named 'sdd-fixture', absent from both `off`
  //   and `on` (the first `isEnabled` answer is false, R1 AC 7).
  //   Test: isEnabled before any toggle; `toggled` once; isEnabled on the
  //   result; `toggled` again on that result; isEnabled on the final
  //   result.
  //   Observable result: the first and final `isEnabled` answers are both
  //   false, even though the middle answer is true.
  //   Expected-value source: the task Success line's literal "toggling
  //   twice returns the first answer" clause.
  it('returns to the first isEnabled answer after toggling twice', () => {
    const first = enable.isEnabled('p3', 'sdd-fixture', [], []);
    expect(first).toBe(false);

    const afterOne = enable.toggled('p3', 'sdd-fixture', [], []);
    expect(enable.isEnabled('p3', 'sdd-fixture', afterOne.off, afterOne.on)).toBe(true);

    const afterTwo = enable.toggled('p3', 'sdd-fixture', afterOne.off, afterOne.on);
    expect(enable.isEnabled('p3', 'sdd-fixture', afterTwo.off, afterTwo.on)).toBe(first);
  });
});

// Contract for dashboard-board task 8 (design C9 "Board model", table rows
// `needsYou`, `running`, `stoppedAdmitted`, `nextProjects`, `nextTiles";
// Requirements 3.5-3.7, 3.9, 5.1-5.3, 7.6, 8.2, 8.4; decisions D2, D10, D11,
// D12, D17).
//
// `board.ts` lives under `src/dashboard_frontend/`, excluded from the root
// tsconfig program and the vitest run, for the same reason given in the
// header comment above for `enable.ts`. It is loaded the same way: a
// runtime `import()` behind a computed specifier TypeScript does not
// resolve statically, cast to a hand-written type below (task 8 _Prompt).
// The module does not exist yet at this commit (task 8 Note: "new module
// with no caller yet"), so every `beforeAll` here is expected to reject.
//
// `nextProjects` calls the real `storeGroups` from
// `src/dashboard_frontend/src/modules/projects/stores.ts` (D45, value
// import, not mocked); the fixtures below give it the `projectPath` /
// `workflowRootPath` shape that module reads.
//
// `needsYou`'s inputs are the controller wait and staged-action wire shapes
// (`src/dashboard_frontend/src/modules/shell/types.ts:177-191, 263-278`),
// which already carry `kind` and `created`, matching design C9's
// "as `{ kind, created, … }`" — no separate wrapper type exists, so the
// fixtures below use only the fields `needsYou` is specified to read.
// `nextTiles`'s `views` argument is the `Map<string, SetupView>`
// `useNextViews` returns (design C10); "Entries with non-null `launchable`"
// is read literally as `Map` entries, so `nextTiles` returns `[id, view]`
// tuples.

type WaitState = 'open' | 'answered' | 'expired';
type ActionState = 'staged' | 'running' | 'done' | 'refused' | 'failed' | 'dismissed';
type BoardRunStatus =
  | 'queued' | 'running' | 'merging' | 'paused' | 'waiting' | 'done' | 'abandoned' | 'error';

interface WaitFixture {
  id: string;
  kind: string;
  project: string;
  created: string;
  state: WaitState;
}

interface ActionFixture {
  id: string;
  kind: string;
  target: Record<string, unknown>;
  created: string;
  state: ActionState;
}

interface BoardRunFixture {
  id: string;
  project: string;
  status: BoardRunStatus;
  updated: string;
  lastActivity?: string;
  branchPresent?: boolean;
}

interface BoardProjectFixture {
  projectId: string;
  projectName: string;
  projectPath: string;
  workflowRootPath: string;
  instances: unknown[];
}

interface SetupViewFixture {
  launchable: string | null;
  launchableOrder: number | null;
}

type BoardModule = {
  needsYou: (
    waits: WaitFixture[],
    actions: ActionFixture[],
    enabled: (projectId: string) => boolean,
  ) => Array<WaitFixture | ActionFixture>;
  running: (
    runs: BoardRunFixture[],
    enabled: (projectId: string) => boolean,
    now: number,
  ) => BoardRunFixture[];
  stoppedAdmitted: (run: BoardRunFixture, now: number) => boolean;
  nextProjects: (
    projects: BoardProjectFixture[],
    enabled: (projectId: string) => boolean,
  ) => BoardProjectFixture[];
  nextTiles: (
    views: Map<string, SetupViewFixture>,
    projectName: (projectId: string) => string,
  ) => Array<[string, SetupViewFixture]>;
};

function waitFixture(overrides: Partial<WaitFixture> & { id: string }): WaitFixture {
  return { kind: 'gate-a', project: 'p1', created: '2026-01-01T00:00:00.000Z', state: 'open', ...overrides };
}

function actionFixture(overrides: Partial<ActionFixture> & { id: string }): ActionFixture {
  return {
    kind: 'launch', target: { project: 'p1' }, created: '2026-01-01T00:00:00.000Z', state: 'staged',
    ...overrides,
  };
}

function boardRunFixture(
  overrides: Partial<BoardRunFixture> & { id: string; status: BoardRunStatus },
): BoardRunFixture {
  return { project: 'p1', updated: '2026-01-01T00:00:00.000Z', ...overrides };
}

function boardProjectFixture(
  overrides: Partial<BoardProjectFixture> & { projectId: string; workflowRootPath: string },
): BoardProjectFixture {
  return {
    projectName: overrides.projectId, projectPath: '/none', instances: [],
    ...overrides,
  };
}

describe('board.ts (src/dashboard_frontend/src/modules/shell/board.ts)', () => {
  let board: BoardModule;

  beforeAll(async () => {
    board = (await import(pathToFileURL(join(FE, 'shell', 'board.ts')).href)) as BoardModule;
  });

  describe('needsYou(waits, actions, enabled)', () => {
    // Criterion "needsYou holds open waits and staged and running actions,
    // oldest created first, across both kinds" (design C9 "Open waits and
    // `staged` or `running` actions on enabled projects, as
    // `{ kind, created, … }`, oldest `created` first"; task 8 Success;
    // Requirement 3.6, 5.1).
    //   Pre-condition: one open wait (created 01:00) and two actions, one
    //   `staged` (created 00:00) and one `running` (created 02:00), all on
    //   an enabled project.
    //   Test: needsYou([wait], [staged, running], () => true).
    //   Observable result: the three items in created-ascending order:
    //   [staged, wait, running].
    //   Expected-value source: the literal "oldest created first, across
    //   both kinds" clause.
    it('holds open waits and staged/running actions together, oldest created first across both kinds', () => {
      const wait = waitFixture({ id: 'w1', state: 'open', created: '2026-01-01T01:00:00.000Z' });
      const staged = actionFixture({ id: 'a1', state: 'staged', created: '2026-01-01T00:00:00.000Z' });
      const running = actionFixture({ id: 'a2', state: 'running', created: '2026-01-01T02:00:00.000Z' });
      const result = board.needsYou([wait], [staged, running], () => true);
      expect(result.map((item) => item.id)).toEqual(['a1', 'w1', 'a2']);
    });

    // Criterion "it drops ... answered ... waits ... each tested" (design
    // C9; task 8 Success "it drops `answered` and `expired` waits ...
    // each tested"; Requirement 3.6 "open controller wait").
    //   Pre-condition: an open wait and an answered wait, same project,
    //   enabled.
    //   Test: needsYou([open, answered], [], () => true).
    //   Observable result: only the open wait's id.
    //   Expected-value source: the literal "drops ... answered ... waits"
    //   clause.
    it('drops an answered wait', () => {
      const open = waitFixture({ id: 'w1', state: 'open' });
      const answered = waitFixture({ id: 'w2', state: 'answered' });
      const result = board.needsYou([open, answered], [], () => true);
      expect(result.map((item) => item.id)).toEqual(['w1']);
    });

    // Criterion "it drops ... expired ... waits ... each tested" (same
    // citations as above, the `expired` branch).
    //   Pre-condition: an open wait and an expired wait, same project,
    //   enabled.
    //   Test: needsYou([open, expired], [], () => true).
    //   Observable result: only the open wait's id.
    //   Expected-value source: the literal "drops ... expired waits" clause.
    it('drops an expired wait', () => {
      const open = waitFixture({ id: 'w1', state: 'open' });
      const expired = waitFixture({ id: 'w2', state: 'expired' });
      const result = board.needsYou([open, expired], [], () => true);
      expect(result.map((item) => item.id)).toEqual(['w1']);
    });

    // Criterion "it drops ... `done`, `refused`, `failed` and `dismissed`
    // actions ... each tested" (design C9; task 8 Success; Requirement 5.2
    // "WHEN an action has any other state THEN it SHALL show no tile").
    //   Pre-condition: a `staged` action (kept) and one action in the state
    //   under test, same project, enabled.
    //   Test: needsYou([], [staged, underTest], () => true).
    //   Observable result: only the staged action's id.
    //   Expected-value source: the literal "drops ... done, refused, failed
    //   and dismissed actions" clause, each state named separately.
    it.each(['done', 'refused', 'failed', 'dismissed'] as const)(
      'drops an action in state %s',
      (state) => {
        const staged = actionFixture({ id: 'a1', state: 'staged' });
        const dropped = actionFixture({ id: 'a2', state });
        const result = board.needsYou([], [staged, dropped], () => true);
        expect(result.map((item) => item.id)).toEqual(['a1']);
      },
    );

    // Criterion "it drops a wait and an action on a disabled project"
    // (design C9 "... on enabled projects ..."; task 8 Success; Requirement
    // 3.5 "WHEN a wait, run or action belongs to a project that is off THEN
    // Home SHALL show no tile for it").
    //   Pre-condition: a wait and an action on a disabled project, and a
    //   wait and an action on an enabled project.
    //   Test: needsYou([offWait, onWait], [offAction, onAction], enabled)
    //   where `enabled` is true only for the "on" project id.
    //   Observable result: only the two "on" items' ids, oldest first.
    //   Expected-value source: the literal "on enabled projects" clause of
    //   design C9, cross-checked against Requirement 3.5's "SHALL show no
    //   tile for it".
    it('drops a wait and an action on a disabled project', () => {
      const offProject = 'p-off';
      const onProject = 'p-on';
      const offWait = waitFixture({ id: 'w1', project: offProject, created: '2026-01-01T00:00:00.000Z' });
      const onWait = waitFixture({ id: 'w2', project: onProject, created: '2026-01-01T01:00:00.000Z' });
      const offAction = actionFixture({ id: 'a1', target: { project: offProject }, created: '2026-01-01T00:00:00.000Z' });
      const onAction = actionFixture({ id: 'a2', target: { project: onProject }, created: '2026-01-01T02:00:00.000Z' });
      const enabled = (id: string) => id === onProject;
      const result = board.needsYou([offWait, onWait], [offAction, onAction], enabled);
      expect(result.map((item) => item.id)).toEqual(['w2', 'a2']);
    });

    // Criterion "an action with no string target.project stays when every
    // project is off" (design C9 "An action with no string `target.project`
    // skips the filter"; task 8 Success; Requirement 5.3 "WHEN an action's
    // target names no project THEN the tile SHALL show with no project tag
    // and SHALL ignore the project filter").
    //   Pre-condition: an action whose `target` carries no `project` key,
    //   with every project disabled.
    //   Test: needsYou([], [action], () => false).
    //   Observable result: the action's id still appears.
    //   Expected-value source: the literal "skips the filter" / "SHALL
    //   ignore the project filter" clause.
    it('keeps an action with no string target.project even when every project is off', () => {
      const action = actionFixture({ id: 'a1', target: {} });
      const result = board.needsYou([], [action], () => false);
      expect(result.map((item) => item.id)).toEqual(['a1']);
    });
  });

  describe('running(runs, enabled, now)', () => {
    // Criterion "running holds each of queued, running, merging, paused and
    // waiting" (design C9 "Moving runs by ..."; task 8 Success; Requirement
    // 3.7 "one tile per run in status `queued`, `running`, `merging`,
    // `paused` or `waiting`").
    //   Pre-condition: five runs, one per moving status, same enabled
    //   project, ascending `updated` times, none with `lastActivity`.
    //   Test: running(runs, () => true, now).
    //   Observable result: all five ids present, in `updated`-ascending
    //   order (queued, running, merging, paused, waiting).
    //   Expected-value source: the literal status list of Requirement 3 AC7.
    it('holds a run for each of the five moving statuses', () => {
      const statuses: BoardRunStatus[] = ['queued', 'running', 'merging', 'paused', 'waiting'];
      const runs = statuses.map((status, i) => boardRunFixture({
        id: `r-${status}`, status, updated: `2026-01-01T0${i}:00:00.000Z`,
      }));
      const result = board.running(runs, () => true, Date.parse('2026-01-02T00:00:00.000Z'));
      expect(result.map((r) => r.id)).toEqual(['r-queued', 'r-running', 'r-merging', 'r-paused', 'r-waiting']);
    });

    // Criterion "moving runs sort by lastActivity, else updated, oldest
    // first" (design C9 "Moving runs by `lastActivity ?? updated`
    // ascending"; task 8 Success; Requirement 3.7 "Moving runs SHALL sort
    // most stale first, by `lastActivity`, else `updated`, oldest first").
    //   Pre-condition: run A has a late `updated` (01-10) but an early
    //   `lastActivity` (01-01); run B has no `lastActivity` and an `updated`
    //   of 01-05, which sits between A's two values. Sorting by `updated`
    //   alone would put B before A; sorting by `lastActivity ?? updated`
    //   puts A before B.
    //   Test: running([runA, runB], () => true, now).
    //   Observable result: [runA, runB].
    //   Expected-value source: the literal "by lastActivity, else updated"
    //   fallback rule, distinguished from a plain `updated` sort by this
    //   fixture's crossed values.
    it('sorts moving runs by lastActivity, falling back to updated, oldest first', () => {
      const runA = boardRunFixture({
        id: 'rA', status: 'running', updated: '2026-01-10T00:00:00.000Z', lastActivity: '2026-01-01T00:00:00.000Z',
      });
      const runB = boardRunFixture({ id: 'rB', status: 'running', updated: '2026-01-05T00:00:00.000Z' });
      const result = board.running([runA, runB], () => true, Date.parse('2026-01-11T00:00:00.000Z'));
      expect(result.map((r) => r.id)).toEqual(['rA', 'rB']);
    });

    // Criterion "admitted stopped runs follow, newest updated first"
    // (design C9 "... then admitted stopped runs by `updated` descending";
    // task 8 Success; Requirement 3.7 "stopped runs SHALL sort after them,
    // newest `updated` first").
    //   Pre-condition: one moving run and two admitted stopped runs
    //   (`abandoned`, `branchPresent: true`) with different `updated`
    //   times.
    //   Test: running([stoppedOld, moving, stoppedNew], () => true, now).
    //   Observable result: [moving, stoppedNew, stoppedOld] — the moving
    //   run leads, then the stopped runs newest-updated first.
    //   Expected-value source: the literal "stopped runs follow ... newest
    //   updated first" clause.
    it('places admitted stopped runs after moving runs, newest updated first', () => {
      const moving = boardRunFixture({ id: 'rM', status: 'running', updated: '2026-01-01T00:00:00.000Z' });
      const stoppedOld = boardRunFixture({
        id: 'rS-old', status: 'abandoned', updated: '2026-01-02T00:00:00.000Z', branchPresent: true,
      });
      const stoppedNew = boardRunFixture({
        id: 'rS-new', status: 'abandoned', updated: '2026-01-03T00:00:00.000Z', branchPresent: true,
      });
      const now = Date.parse('2026-01-04T00:00:00.000Z');
      const result = board.running([stoppedOld, moving, stoppedNew], () => true, now);
      expect(result.map((r) => r.id)).toEqual(['rM', 'rS-new', 'rS-old']);
    });

    // Criterion "a disabled project's run is dropped" (design C9 "... on
    // enabled projects"; task 8 Success; Requirement 3.5).
    //   Pre-condition: a moving run on a disabled project and a moving run
    //   on an enabled project.
    //   Test: running([offRun, onRun], enabled, now) where `enabled` is
    //   true only for the "on" project id.
    //   Observable result: only the "on" run's id.
    //   Expected-value source: Requirement 3.5's "SHALL show no tile for
    //   it", applied to `running`'s own project filter.
    it('drops a moving run on a disabled project', () => {
      const offRun = boardRunFixture({ id: 'rOff', status: 'running', project: 'p-off' });
      const onRun = boardRunFixture({ id: 'rOn', status: 'running', project: 'p-on' });
      const result = board.running([offRun, onRun], (id) => id === 'p-on', Date.parse('2026-01-02T00:00:00.000Z'));
      expect(result.map((r) => r.id)).toEqual(['rOn']);
    });
  });

  describe('stoppedAdmitted(run, now)', () => {
    // Criterion "stoppedAdmitted admits abandoned and error with
    // branchPresent" (design C9 "stoppedAdmitted(run, now) | R7 AC 6";
    // task 8 Success; Requirement 7.6 "WHEN the run is `abandoned` or
    // `error` with its branch present ... THEN it SHALL have a tile").
    //   Pre-condition: a run in the status under test, `branchPresent:
    //   true`.
    //   Test: stoppedAdmitted(run, now).
    //   Observable result: true.
    //   Expected-value source: the literal "admits abandoned and error with
    //   branchPresent" clause.
    it.each(['abandoned', 'error'] as const)('admits a %s run with its branch present', (status) => {
      const run = boardRunFixture({ id: 'r1', status, branchPresent: true, updated: '2026-01-01T00:00:00.000Z' });
      expect(board.stoppedAdmitted(run, Date.parse('2026-02-01T00:00:00.000Z'))).toBe(true);
    });

    // Criterion "refuses each without it" (design C9/task 8 Success, the
    // `abandoned`/`error` refusal branch; Requirement 7.6 "Otherwise a
    // stopped run SHALL have none").
    //   Pre-condition: a run in the status under test, `branchPresent:
    //   false`, checked shortly after `updated` so age cannot be the cause.
    //   Test: stoppedAdmitted(run, now).
    //   Observable result: false.
    //   Expected-value source: the literal "refuses each without it" clause.
    it.each(['abandoned', 'error'] as const)('refuses a %s run with no branch present', (status) => {
      const run = boardRunFixture({ id: 'r1', status, branchPresent: false, updated: '2026-01-01T00:00:00.000Z' });
      expect(board.stoppedAdmitted(run, Date.parse('2026-01-01T00:01:00.000Z'))).toBe(false);
    });

    // Criterion "admits done with branchPresent at 23h59m old" (design C9;
    // task 8 Success; Requirement 7.6 "`done` with its branch present and
    // `updated` under 24 hours old"; decision D2 "keeps a tile for 24
    // hours").
    //   Pre-condition: a `done` run, `branchPresent: true`, `now` exactly
    //   23h59m after `updated`.
    //   Test: stoppedAdmitted(run, now).
    //   Observable result: true.
    //   Expected-value source: the literal "admits done ... at 23h59m old"
    //   boundary.
    it('admits a done run with its branch present at 23h59m old', () => {
      const updated = '2026-01-01T00:00:00.000Z';
      const now = Date.parse(updated) + (23 * 60 + 59) * 60 * 1000;
      const run = boardRunFixture({ id: 'r1', status: 'done', branchPresent: true, updated });
      expect(board.stoppedAdmitted(run, now)).toBe(true);
    });

    // Criterion "refuses it at exactly 24 hours" (design C9/task 8 Success;
    // Requirement 7.6's "under 24 hours old" boundary; D2's "24 hours").
    //   Pre-condition: a `done` run, `branchPresent: true`, `now` exactly
    //   24h00m after `updated`.
    //   Test: stoppedAdmitted(run, now).
    //   Observable result: false.
    //   Expected-value source: the literal "refuses it at exactly 24 hours"
    //   boundary, distinct from the no-branch case below.
    it('refuses a done run with its branch present at exactly 24 hours old', () => {
      const updated = '2026-01-01T00:00:00.000Z';
      const now = Date.parse(updated) + 24 * 60 * 60 * 1000;
      const run = boardRunFixture({ id: 'r1', status: 'done', branchPresent: true, updated });
      expect(board.stoppedAdmitted(run, now)).toBe(false);
    });

    // Criterion "and with no branch" (design C9/task 8 Success, the `done`
    // no-branch refusal, named separately from the age boundary above;
    // Requirement 7.6 "Otherwise a stopped run SHALL have none").
    //   Pre-condition: a `done` run, `branchPresent: false`, `now` only
    //   one minute after `updated` (fresh), so age cannot be the cause.
    //   Test: stoppedAdmitted(run, now).
    //   Observable result: false.
    //   Expected-value source: the literal "with no branch" clause, isolated
    //   from the age-boundary case by using a fresh `now`.
    it('refuses a done run with no branch present, even when fresh', () => {
      const updated = '2026-01-01T00:00:00.000Z';
      const now = Date.parse(updated) + 60 * 1000;
      const run = boardRunFixture({ id: 'r1', status: 'done', branchPresent: false, updated });
      expect(board.stoppedAdmitted(run, now)).toBe(false);
    });
  });

  describe('nextProjects(projects, enabled)', () => {
    // Criterion "nextProjects gives ... the representative when on" (design
    // C9 "Per `storeGroups` group with `enabled`: the representative when
    // on, else the first enabled member"; task 8 Success; Requirement 8.2
    // "using the group's representative ... when it is on").
    //   Pre-condition: two projects sharing a store; the representative
    //   (`projectPath === store`) and a member, both enabled.
    //   Test: nextProjects([rep, member], enabled).
    //   Observable result: only the representative's id.
    //   Expected-value source: the literal "the representative when on"
    //   clause.
    it('gives the store representative when it is enabled', () => {
      const store = '/store/a';
      const rep = boardProjectFixture({ projectId: 'rep', projectPath: store, workflowRootPath: store, projectName: 'rep-name' });
      const member = boardProjectFixture({ projectId: 'mem', projectPath: '/other', workflowRootPath: store, projectName: 'mem-name' });
      const enabled = (id: string) => id === 'rep' || id === 'mem';
      const result = board.nextProjects([rep, member], enabled);
      expect(result.map((p) => p.projectId)).toEqual(['rep']);
    });

    // Criterion "else the first enabled member" (design C9; task 8 Success;
    // Requirement 8.2 "else the enabled member").
    //   Pre-condition: a disabled representative and two enabled members,
    //   named and ordered so array order and project-name order agree
    //   (`mem1-name` < `mem2-name`), isolating "first" from either reading.
    //   Test: nextProjects([rep, member1, member2], enabled) where
    //   `enabled` is false for `rep` and true for both members.
    //   Observable result: only `member1`'s id.
    //   Expected-value source: the literal "the first enabled member"
    //   clause.
    it('gives the first enabled member when the representative is disabled', () => {
      const store = '/store/a';
      const rep = boardProjectFixture({ projectId: 'rep', projectPath: store, workflowRootPath: store, projectName: 'rep-name' });
      const member1 = boardProjectFixture({ projectId: 'mem1', projectPath: '/other1', workflowRootPath: store, projectName: 'mem1-name' });
      const member2 = boardProjectFixture({ projectId: 'mem2', projectPath: '/other2', workflowRootPath: store, projectName: 'mem2-name' });
      const enabled = (id: string) => id === 'mem1' || id === 'mem2';
      const result = board.nextProjects([rep, member1, member2], enabled);
      expect(result.map((p) => p.projectId)).toEqual(['mem1']);
    });

    // Criterion "and none when the group is off" (design C9; task 8
    // Success; Requirement 8.2 implies the whole store, R3 AC5's "no tile"
    // rule applied to a wholly disabled store).
    //   Pre-condition: a single project (the store's only member,
    //   disabled).
    //   Test: nextProjects([rep], () => false).
    //   Observable result: an empty array — no project for this store.
    //   Expected-value source: the literal "none when the group is off"
    //   clause.
    it('gives no project when the whole store group is disabled', () => {
      const store = '/store/a';
      const rep = boardProjectFixture({ projectId: 'rep', projectPath: store, workflowRootPath: store, projectName: 'rep-name' });
      const result = board.nextProjects([rep], () => false);
      expect(result).toEqual([]);
    });
  });

  describe('nextTiles(views, projectName)', () => {
    // Criterion "nextTiles drops a null launchable" (design C9 "Entries
    // with non-null `launchable` ..."; task 8 Success; Requirement 8.4
    // "WHEN `launchBlock` nulls `launchable` THEN the project SHALL show no
    // Next tile").
    //   Pre-condition: a Map with one entry whose `launchable` is `null`
    //   and one whose `launchable` is a spec id.
    //   Test: nextTiles(views, () => 'name').
    //   Observable result: only the non-null entry's project id.
    //   Expected-value source: the literal "non-null `launchable`" filter.
    it('drops an entry whose launchable is null', () => {
      const views = new Map<string, SetupViewFixture>([
        ['p1', { launchable: null, launchableOrder: null }],
        ['p2', { launchable: 'spec-a', launchableOrder: 0 }],
      ]);
      const result = board.nextTiles(views, () => 'name');
      expect(result.map(([id]) => id)).toEqual(['p2']);
    });

    // Criterion "sorts by launchableOrder with null last" (design C9 "by
    // `launchableOrder` (null last)"; task 8 Success; Requirement 3.9 "a
    // spec not named there SHALL sort last").
    //   Pre-condition: three non-null-launchable entries with
    //   `launchableOrder` 2, null and 0.
    //   Test: nextTiles(views, () => 'name').
    //   Observable result: ids in order [order-0, order-2, order-null].
    //   Expected-value source: the literal "by launchableOrder (null last)"
    //   clause.
    it('sorts by launchableOrder ascending, with a null order last', () => {
      const views = new Map<string, SetupViewFixture>([
        ['pC', { launchable: 'spec-c', launchableOrder: 2 }],
        ['pB', { launchable: 'spec-b', launchableOrder: null }],
        ['pA', { launchable: 'spec-a', launchableOrder: 0 }],
      ]);
      const result = board.nextTiles(views, () => 'name');
      expect(result.map(([id]) => id)).toEqual(['pA', 'pC', 'pB']);
    });

    // Criterion "breaks ties by project name" (design C9 "... then project
    // name"; task 8 Success; Requirement 3.9 "ties SHALL sort by project
    // name").
    //   Pre-condition: two entries with the same `launchableOrder` (1),
    //   whose ids resolve through `projectName` to "zebra-project" and
    //   "apple-project".
    //   Test: nextTiles(views, projectName) where `projectName` looks the
    //   name up by id.
    //   Observable result: the apple-named entry before the zebra-named
    //   one.
    //   Expected-value source: the literal "breaks ties by project name"
    //   clause.
    it('breaks a launchableOrder tie by project name', () => {
      const views = new Map<string, SetupViewFixture>([
        ['pZebra', { launchable: 'spec-z', launchableOrder: 1 }],
        ['pApple', { launchable: 'spec-a', launchableOrder: 1 }],
      ]);
      const names: Record<string, string> = { pZebra: 'zebra-project', pApple: 'apple-project' };
      const result = board.nextTiles(views, (id) => names[id]);
      expect(result.map(([id]) => id)).toEqual(['pApple', 'pZebra']);
    });
  });
});
