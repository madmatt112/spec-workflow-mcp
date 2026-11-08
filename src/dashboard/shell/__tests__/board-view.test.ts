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
// `nextProjects` is a straight filter over `projects` by `enabled`
// (decisions-and-launch-guard design C2 "Next tiles": `projects.filter((p)
// => enabled(p.projectId))`, overriding D2/D11's per-store representative
// rule; `storeGroups` is no longer read). The fixtures below still carry
// `projectPath` / `workflowRootPath` because `BoardProjectFixture` mirrors
// the frontend `Project` shape; `nextProjects` itself reads only
// `projectId`.
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

interface LaunchPressViewFixture {
  launchable: string;
  guard?: { state: 'clear' | 'warn' | 'no-list' };
}

type Tone = 'neutral' | 'warning' | 'danger';
type Dot = 'grey' | 'green' | 'amber' | 'red';

interface CtrlWaitFixture {
  id: string;
  kind: string;
  run: string;
  project: string;
  created: string;
  questions: Array<{ id: string; text?: string }>;
  state: WaitState;
  proposals?: string[];
}

interface PrReadFixture {
  kind: 'run' | 'closeout';
  repo: string;
  number: number;
  ci: string;
  verdict: string;
  reasons: string[];
  at: string;
}

interface CtrlRunFixture {
  id: string;
  project: string;
  status: BoardRunStatus;
  driven: boolean;
  created: string;
  updated: string;
  pauseReason?: string;
  pauseRequested?: string;
  pausedAt?: string;
  resumeAt?: string;
  holdBy?: 'operator' | 'deploy';
  lastActivity?: string;
  inFlight?: boolean;
  stepStarted?: string;
  branchPresent?: boolean;
  discardAllowed?: boolean;
  prReads?: PrReadFixture[];
}

interface SetupLineViewFixture {
  supervisor: { model: string };
  roles: unknown[];
  worktree: 'yes' | 'no';
  gates: 'block' | 'record';
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
  ) => BoardRunFixture[];
  stopped: (
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
  launchPress: (view: LaunchPressViewFixture, armedSpec: string | null) => 'arm' | 'launch';
  ageTone: (ms: number) => Tone;
  runDot: (run: CtrlRunFixture, now: number) => Dot;
  isStalled: (run: CtrlRunFixture, waits: CtrlWaitFixture[]) => boolean;
  runTone: (run: CtrlRunFixture, waits: CtrlWaitFixture[], now: number) => Tone;
  runControls: (run: CtrlRunFixture, waits: CtrlWaitFixture[]) => {
    pause: boolean; resume: boolean; stop: boolean; discard: boolean; redrive: boolean;
  };
  mergeRead: (wait: CtrlWaitFixture, runs: CtrlRunFixture[]) => PrReadFixture | null;
  waitSummary: (wait: CtrlWaitFixture) => string;
  setupLine: (view: SetupLineViewFixture) => string;
  compactAge: (ms: number) => string;
  tabTitle: (
    waits: CtrlWaitFixture[],
    enabled: (projectId: string) => boolean,
    now: number,
    base: string,
  ) => string;
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

function ctrlWaitFixture(overrides: Partial<CtrlWaitFixture> & { id: string }): CtrlWaitFixture {
  return {
    kind: 'gate-a', run: 'r1', project: 'p1', created: '2026-01-01T00:00:00.000Z',
    questions: [], state: 'open', ...overrides,
  };
}

function prReadFixture(overrides: Partial<PrReadFixture> & { kind: 'run' | 'closeout' }): PrReadFixture {
  return {
    repo: 'repo', number: 1, ci: 'green', verdict: 'merged', reasons: [],
    at: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

function ctrlRunFixture(
  overrides: Partial<CtrlRunFixture> & { id: string; status: BoardRunStatus },
): CtrlRunFixture {
  return {
    project: 'p1', driven: true, created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
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

  describe('running(runs, enabled)', () => {
    // Criterion "running holds each of queued, running, merging, paused and
    // waiting" (design C9 "Moving runs by ..."; task 8 Success; Requirement
    // 3.7 "one tile per run in status `queued`, `running`, `merging`,
    // `paused` or `waiting`").
    //   Pre-condition: five runs, one per moving status, same enabled
    //   project, ascending `updated` times, none with `lastActivity`.
    //   Test: running(runs, () => true).
    //   Observable result: all five ids present, in `updated`-ascending
    //   order (queued, running, merging, paused, waiting).
    //   Expected-value source: the literal status list of Requirement 3 AC7.
    it('holds a run for each of the five moving statuses', () => {
      const statuses: BoardRunStatus[] = ['queued', 'running', 'merging', 'paused', 'waiting'];
      const runs = statuses.map((status, i) => boardRunFixture({
        id: `r-${status}`, status, updated: `2026-01-01T0${i}:00:00.000Z`,
      }));
      const result = board.running(runs, () => true);
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
    //   Test: running([runA, runB], () => true).
    //   Observable result: [runA, runB].
    //   Expected-value source: the literal "by lastActivity, else updated"
    //   fallback rule, distinguished from a plain `updated` sort by this
    //   fixture's crossed values.
    it('sorts moving runs by lastActivity, falling back to updated, oldest first', () => {
      const runA = boardRunFixture({
        id: 'rA', status: 'running', updated: '2026-01-10T00:00:00.000Z', lastActivity: '2026-01-01T00:00:00.000Z',
      });
      const runB = boardRunFixture({ id: 'rB', status: 'running', updated: '2026-01-05T00:00:00.000Z' });
      const result = board.running([runA, runB], () => true);
      expect(result.map((r) => r.id)).toEqual(['rA', 'rB']);
    });

    // Criterion "running holds only moving runs, dropping a stopped run"
    // (design C9 "Interfaces": "`running(runs, enabled)` returns moving
    // runs in the base order"; task 20 Success "running drops a stopped
    // run and keeps the base order"; Requirement 9 AC 1 "it SHALL hold
    // only runs in queued, running, merging, paused or waiting", replacing
    // dashboard-board Requirement 3 AC 7's mixed running+stopped list).
    //   Pre-condition: one moving run and two admitted stopped runs
    //   (`abandoned`, `branchPresent: true`) with different `updated`
    //   times, so a leftover mixing behaviour would still have an
    //   observable (wrong) order to report.
    //   Test: running([stoppedOld, moving, stoppedNew], () => true).
    //   Observable result: [moving] only — both stopped runs are dropped.
    //   Expected-value source: Requirement 9 AC 1's "only" clause: a run
    //   outside the five moving statuses SHALL NOT appear, however it
    //   would otherwise sort.
    it('drops a stopped run, holding only moving runs', () => {
      const moving = boardRunFixture({ id: 'rM', status: 'running', updated: '2026-01-01T00:00:00.000Z' });
      const stoppedOld = boardRunFixture({
        id: 'rS-old', status: 'abandoned', updated: '2026-01-02T00:00:00.000Z', branchPresent: true,
      });
      const stoppedNew = boardRunFixture({
        id: 'rS-new', status: 'abandoned', updated: '2026-01-03T00:00:00.000Z', branchPresent: true,
      });
      const result = board.running([stoppedOld, moving, stoppedNew], () => true);
      expect(result.map((r) => r.id)).toEqual(['rM']);
    });

    // Criterion "a disabled project's run is dropped" (design C9 "... on
    // enabled projects"; task 8 Success; Requirement 3.5).
    //   Pre-condition: a moving run on a disabled project and a moving run
    //   on an enabled project.
    //   Test: running([offRun, onRun], enabled) where `enabled` is
    //   true only for the "on" project id.
    //   Observable result: only the "on" run's id.
    //   Expected-value source: Requirement 3.5's "SHALL show no tile for
    //   it", applied to `running`'s own project filter.
    it('drops a moving run on a disabled project', () => {
      const offRun = boardRunFixture({ id: 'rOff', status: 'running', project: 'p-off' });
      const onRun = boardRunFixture({ id: 'rOn', status: 'running', project: 'p-on' });
      const result = board.running([offRun, onRun], (id) => id === 'p-on');
      expect(result.map((r) => r.id)).toEqual(['rOn']);
    });
  });

  describe('stopped(runs, enabled, now)', () => {
    // Criterion "stopped holds admitted runs, newest updated first"
    // (design C9 "Interfaces": "New `stopped(runs, enabled, now)` returns
    // `stoppedAdmitted` runs, newest `updated` first"; task 20 Success
    // "`stopped` holds admitted runs, newest `updated` first"; Requirement
    // 9 AC 2 "it SHALL appear in a separate stopped band, newest `updated`
    // first").
    //   Pre-condition: one moving run (which `stoppedAdmitted` never
    //   admits) and two admitted stopped runs (`abandoned`,
    //   `branchPresent: true`) with different `updated` times.
    //   Test: stopped([stoppedOld, moving, stoppedNew], () => true, now).
    //   Observable result: [stoppedNew, stoppedOld] — the moving run is
    //   absent and the two stopped runs sort newest-updated first.
    //   Expected-value source: the literal "newest updated first" clause,
    //   distinguished from a plain input-order pass-through by this
    //   fixture's out-of-order input.
    it('holds admitted stopped runs, newest updated first, and excludes a moving run', () => {
      const moving = boardRunFixture({ id: 'rM', status: 'running', updated: '2026-01-01T00:00:00.000Z' });
      const stoppedOld = boardRunFixture({
        id: 'rS-old', status: 'abandoned', updated: '2026-01-02T00:00:00.000Z', branchPresent: true,
      });
      const stoppedNew = boardRunFixture({
        id: 'rS-new', status: 'abandoned', updated: '2026-01-03T00:00:00.000Z', branchPresent: true,
      });
      const now = Date.parse('2026-01-04T00:00:00.000Z');
      const result = board.stopped([stoppedOld, moving, stoppedNew], () => true, now);
      expect(result.map((r) => r.id)).toEqual(['rS-new', 'rS-old']);
    });

    // Criterion "stopped drops a disabled project's run" (design C9
    // "Interfaces"; task 20 Success "and drops a disabled project's run";
    // Requirement 9.2 reached through the same `enabled` filter
    // Requirement 3.5 states for `running`).
    //   Pre-condition: an admitted stopped run on a disabled project and
    //   an admitted stopped run on an enabled project.
    //   Test: stopped([offRun, onRun], enabled, now) where `enabled` is
    //   true only for the "on" project id.
    //   Observable result: only the "on" run's id.
    //   Expected-value source: Requirement 3.5's "SHALL show no tile for
    //   it", applied to `stopped`'s own project filter.
    it("drops a disabled project's stopped run", () => {
      const now = Date.parse('2026-01-02T00:00:00.000Z');
      const offRun = boardRunFixture({
        id: 'rOff', status: 'abandoned', project: 'p-off', branchPresent: true, updated: '2026-01-01T00:00:00.000Z',
      });
      const onRun = boardRunFixture({
        id: 'rOn', status: 'abandoned', project: 'p-on', branchPresent: true, updated: '2026-01-01T00:00:00.000Z',
      });
      const result = board.stopped([offRun, onRun], (id) => id === 'p-on', now);
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
    // Criterion "nextProjects becomes a plain filter: two enabled projects
    // on one store give two projects and a disabled one is left out"
    // (decisions-and-launch-guard design C2 "Next tiles": "`nextProjects`
    // ... becomes `projects.filter((p) => enabled(p.projectId))`"; task 7
    // Success "two enabled projects on one store give two projects and a
    // disabled one is left out"; Requirement 2 AC 2 "WHEN two enabled
    // projects share a store and the spec is launchable THEN Next SHALL
    // show one tile per enabled project").
    //   Pre-condition: three projects sharing one store, in array order
    //   [enabled-a, disabled, enabled-b], so the dropped middle entry
    //   cannot be mistaken for a slice of the array.
    //   Test: nextProjects([a, disabled, b], enabled) where `enabled` is
    //   true for 'a' and 'b' and false for 'disabled'.
    //   Observable result: exactly ['a', 'b'] — both enabled projects, in
    //   their original order, the disabled one left out.
    //   Expected-value source: the literal `projects.filter((p) =>
    //   enabled(p.projectId))` body design C2 gives `nextProjects`.
    it('gives every enabled project on a shared store and leaves a disabled one out', () => {
      const store = '/store/a';
      const a = boardProjectFixture({ projectId: 'a', projectPath: '/code/a', workflowRootPath: store, projectName: 'a-name' });
      const disabled = boardProjectFixture({ projectId: 'disabled', projectPath: '/code/d', workflowRootPath: store, projectName: 'disabled-name' });
      const b = boardProjectFixture({ projectId: 'b', projectPath: '/code/b', workflowRootPath: store, projectName: 'b-name' });
      const enabled = (id: string) => id === 'a' || id === 'b';
      const result = board.nextProjects([a, disabled, b], enabled);
      expect(result.map((p) => p.projectId)).toEqual(['a', 'b']);
    });
  });

  // Contract for decisions-and-launch-guard task 7 (design C2 "NextTile",
  // "Two press (AC 4)"; Requirement 2 AC 4, AC 5, AC 9).
  //
  // `launchPress` is pure: it reads only `view.guard?.state` and
  // `view.launchable` against the caller's local `armedSpec`, so these
  // fixtures carry no more than those two fields.
  describe('launchPress(view, armedSpec)', () => {
    // Criterion "launchPress gives 'launch' with no guard, on `clear` and
    // on `no-list`" (design C2 "On `warn`, a press with `armedSpec !==
    // view.launchable` only sets it" — every other state launches
    // outright; task 7 Success "launchPress gives `'launch'` with no
    // guard, on `clear` and on `no-list`"; Requirement 2 AC 5 "WHEN no
    // warning shows THEN one press SHALL launch"; Requirement 2 AC 9 "IF
    // the guard's read fails THEN the tile SHALL still render, with no
    // warning" — a failed read is the no-`guard` case).
    //   Pre-condition: three views for the same spec, differing only in
    //   `guard` — absent, `{ state: 'clear' }` and `{ state: 'no-list' }` —
    //   with `armedSpec` unarmed (`null`) in every case, so arming cannot
    //   be the cause of a `'launch'` answer.
    //   Test: launchPress(view, null) for each of the three views.
    //   Observable result: `'launch'` in every case.
    //   Expected-value source: the task Success line's literal "gives
    //   `'launch'` with no guard, on `clear` and on `no-list`" clause.
    const noWarnGuards: Array<[string, LaunchPressViewFixture['guard']]> = [
      ['no guard', undefined],
      ['clear', { state: 'clear' }],
      ['no-list', { state: 'no-list' }],
    ];
    it.each(noWarnGuards)('gives \'launch\' when the guard is %s', (_label, guard) => {
      const view: LaunchPressViewFixture = { launchable: 'spec-a', guard };
      expect(board.launchPress(view, null)).toBe('launch');
    });

    // Criterion "launchPress gives 'arm' on `warn` unarmed" (design C2 "a
    // press with `armedSpec !== view.launchable` only sets it"; task 7
    // Success; Requirement 2 AC 4 "a first press of Launch SHALL send no
    // request and SHALL arm the tile").
    //   Pre-condition: a `warn` view, `armedSpec` is `null` (never
    //   pressed).
    //   Test: launchPress(view, null).
    //   Observable result: `'arm'`.
    //   Expected-value source: the literal "'arm' on `warn` unarmed"
    //   clause.
    it('gives \'arm\' on warn when unarmed', () => {
      const view: LaunchPressViewFixture = { launchable: 'spec-a', guard: { state: 'warn' } };
      expect(board.launchPress(view, null)).toBe('arm');
    });

    // Criterion "launchPress gives 'arm' on `warn` armed for another spec"
    // (design C2 "Keying on the spec clears the arm when the spec
    // changes"; task 7 Success; Requirement 2 AC 4).
    //   Pre-condition: a `warn` view for 'spec-a'; `armedSpec` is
    //   'spec-b' — armed, but for a different spec.
    //   Test: launchPress(view, 'spec-b').
    //   Observable result: `'arm'`.
    //   Expected-value source: the literal "armed for another spec"
    //   clause, cross-checked against design C2's spec-keyed clearing
    //   rule.
    it('gives \'arm\' on warn when armed for a different spec', () => {
      const view: LaunchPressViewFixture = { launchable: 'spec-a', guard: { state: 'warn' } };
      expect(board.launchPress(view, 'spec-b')).toBe('arm');
    });

    // Criterion "launchPress gives 'launch' on `warn` armed for this spec"
    // (design C2 "the armed press calls `onLaunch`, so the body stays
    // `buildLaunchInput(view)`"; task 7 Success; Requirement 2 AC 4 "a
    // second press SHALL post the same `buildLaunchInput` body").
    //   Pre-condition: a `warn` view for 'spec-a'; `armedSpec` is
    //   'spec-a' — the same spec is already armed.
    //   Test: launchPress(view, 'spec-a').
    //   Observable result: `'launch'`.
    //   Expected-value source: the literal "'launch' on `warn` armed for
    //   this spec" clause.
    it('gives \'launch\' on warn when armed for this spec', () => {
      const view: LaunchPressViewFixture = { launchable: 'spec-a', guard: { state: 'warn' } };
      expect(board.launchPress(view, 'spec-a')).toBe('launch');
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

  // Contract for dashboard-board task 9 (design C9 "Board model", table rows
  // `ageTone`, `runDot`, `isStalled`, `runControls`, `mergeRead`,
  // `waitSummary`, `setupLine`, `compactAge`, `tabTitle`; Requirements 3.7,
  // 4.1-4.3, 6.2-6.4, 6.6-6.7, 7.1-7.4, 8.3, 10.1-10.3).
  //
  // `isStalled`, `runControls` and `mergeRead` take wire-shaped run and wait
  // fixtures (`CtrlRunFixture`, `CtrlWaitFixture`, `PrReadFixture` above),
  // matching `ControllerRun`/`ControllerWait`/`ControllerPrRead`
  // (`src/dashboard_frontend/src/modules/shell/types.ts:177-249`).

  describe('ageTone(ms)', () => {
    // Criterion "ageTone is neutral under 900,000ms" (design C9 "neutral,
    // `warning` from 900,000 ms, `danger` from 3,600,000 ms"; task 9
    // Success "neutral at 899,999 ms").
    //   Pre-condition: none.
    //   Test: ageTone(899999).
    //   Observable result: 'neutral'.
    //   Expected-value source: the literal 899,999ms boundary of the task
    //   Success line.
    it('is neutral just under 900000ms', () => {
      expect(board.ageTone(899999)).toBe('neutral');
    });

    // Criterion "ageTone is warning from 900,000ms to under 3,600,000ms"
    // (design C9; task 9 Success "warning at 900,000 and 3,599,999").
    //   Pre-condition: none.
    //   Test: ageTone(900000), ageTone(3599999).
    //   Observable result: 'warning' for both.
    //   Expected-value source: the literal 900,000 and 3,599,999ms
    //   boundaries of the task Success line.
    it('is warning from 900000ms up to just under 3600000ms', () => {
      expect(board.ageTone(900000)).toBe('warning');
      expect(board.ageTone(3599999)).toBe('warning');
    });

    // Criterion "ageTone is danger from 3,600,000ms" (design C9; task 9
    // Success "danger at 3,600,000").
    //   Pre-condition: none.
    //   Test: ageTone(3600000).
    //   Observable result: 'danger'.
    //   Expected-value source: the literal 3,600,000ms boundary of the task
    //   Success line.
    it('is danger from 3600000ms', () => {
      expect(board.ageTone(3600000)).toBe('danger');
    });
  });

  describe('runDot(run, now)', () => {
    const NOW = Date.parse('2026-01-02T00:00:00.000Z');

    // Criterion "runDot is grey with no step in flight" (design C9 "`grey`
    // with no step in flight or no heartbeat base"; task 9 Success "grey
    // with no step in flight ... (D38)").
    //   Pre-condition: `inFlight: false`, with a recent `lastActivity` set
    //   (so a wrong implementation reading only the heartbeat would wrongly
    //   go green).
    //   Test: runDot(run, now).
    //   Observable result: 'grey'.
    //   Expected-value source: the literal "grey with no step in flight"
    //   clause.
    it('is grey with no step in flight, even with a recent lastActivity', () => {
      const run = ctrlRunFixture({
        id: 'r1', status: 'running', inFlight: false, lastActivity: new Date(NOW - 1000).toISOString(),
      });
      expect(board.runDot(run, NOW)).toBe('grey');
    });

    // Criterion "runDot is grey with no heartbeat base (D38)" (design C9;
    // task 9 Success "and with no heartbeat base (D38)"; design D38 "no
    // heartbeat and no start shows a grey dot").
    //   Pre-condition: `inFlight: true`, no `lastActivity`, no
    //   `stepStarted`.
    //   Test: runDot(run, now).
    //   Observable result: 'grey'.
    //   Expected-value source: design D38's literal "grey dot ... not the
    //   updated time" rule.
    it('is grey with a step in flight but no lastActivity or stepStarted (D38)', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'running', inFlight: true });
      expect(board.runDot(run, NOW)).toBe('grey');
    });

    // Criterion "runDot is green under 300,000ms and amber at 300,000 and
    // 899,999ms" (design C9 "green, amber, red by the age of
    // `lastActivity ?? stepStarted` at 300,000 and 900,000 ms"; task 9
    // Success "green at 299,999 ms, amber at 300,000 and 899,999").
    //   Pre-condition: `inFlight: true`, `lastActivity` set to each tested
    //   age before `now`.
    //   Test: runDot(run, now) at ages 299999, 300000, 899999ms.
    //   Observable result: 'green', 'amber', 'amber'.
    //   Expected-value source: the literal 299,999/300,000/899,999ms
    //   boundaries of the task Success line.
    it('is green just under 300000ms and amber at 300000 and 899999ms', () => {
      const at = (ms: number) => ctrlRunFixture({
        id: 'r1', status: 'running', inFlight: true, lastActivity: new Date(NOW - ms).toISOString(),
      });
      expect(board.runDot(at(299999), NOW)).toBe('green');
      expect(board.runDot(at(300000), NOW)).toBe('amber');
      expect(board.runDot(at(899999), NOW)).toBe('amber');
    });

    // Criterion "runDot is red at 900,000ms" (design C9; task 9 Success
    // "red at 900,000").
    //   Pre-condition: `inFlight: true`, `lastActivity` 900,000ms before
    //   `now`.
    //   Test: runDot(run, now).
    //   Observable result: 'red'.
    //   Expected-value source: the literal 900,000ms boundary of the task
    //   Success line.
    it('is red at 900000ms', () => {
      const run = ctrlRunFixture({
        id: 'r1', status: 'running', inFlight: true, lastActivity: new Date(NOW - 900000).toISOString(),
      });
      expect(board.runDot(run, NOW)).toBe('red');
    });

    // Criterion "the age runs from stepStarted when lastActivity is absent"
    // (design C9 "the age of `lastActivity ?? stepStarted`"; task 9 Success
    // "the age runs from `lastActivity` when set, else `stepStarted`").
    //   Pre-condition: `inFlight: true`, no `lastActivity`, `stepStarted`
    //   1,000ms before `now` (green zone).
    //   Test: runDot(run, now).
    //   Observable result: 'green'.
    //   Expected-value source: the literal "else `stepStarted`" fallback
    //   clause.
    it('falls back to stepStarted when lastActivity is absent', () => {
      const run = ctrlRunFixture({
        id: 'r1', status: 'running', inFlight: true, stepStarted: new Date(NOW - 1000).toISOString(),
      });
      expect(board.runDot(run, NOW)).toBe('green');
    });

    // Criterion "the age runs from lastActivity when set, taking priority
    // over stepStarted" (design C9's `??` operator; task 9 Success "the age
    // runs from `lastActivity` when set").
    //   Pre-condition: `inFlight: true`, `stepStarted` 900,000ms before
    //   `now` (red zone), `lastActivity` 1,000ms before `now` (green zone).
    //   Test: runDot(run, now).
    //   Observable result: 'green' — `lastActivity` wins, not `stepStarted`.
    //   Expected-value source: the literal "`lastActivity` when set" clause,
    //   isolated from the fallback case by giving the two fields conflicting
    //   ages.
    it('prefers lastActivity over stepStarted when both are present', () => {
      const run = ctrlRunFixture({
        id: 'r1', status: 'running', inFlight: true,
        stepStarted: new Date(NOW - 900000).toISOString(),
        lastActivity: new Date(NOW - 1000).toISOString(),
      });
      expect(board.runDot(run, NOW)).toBe('green');
    });
  });

  describe('isStalled(run, waits)', () => {
    // Criterion "isStalled is true for running with driven false" (design
    // C9 "R6 AC 4"; task 9 Success "true for `running` with `driven: false`
    // ... (D7)"; Requirement 6.4).
    //   Pre-condition: a `running` run, `driven: false`, no waits.
    //   Test: isStalled(run, []).
    //   Observable result: true.
    //   Expected-value source: the literal "true for `running` with
    //   `driven: false`" clause.
    it('is true for a running run with driven false', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: false });
      expect(board.isStalled(run, [])).toBe(true);
    });

    // Criterion "isStalled is true for waiting with an open drive-crash
    // wait" (design C9 "`DRIVE_CRASH_QUESTION = 'drive-crash'`"; task 9
    // Success "true ... for `waiting` with an open `drive-crash` wait";
    // Requirement 6.4 citing `src/controller/waits.ts:193`).
    //   Pre-condition: a `waiting` run, `driven: false`, and a wait on that
    //   run's id, state `open`, with a question id `drive-crash`.
    //   Test: isStalled(run, [wait]).
    //   Observable result: true.
    //   Expected-value source: the literal "open `drive-crash` wait" clause,
    //   with `DRIVE_CRASH_QUESTION` read live from
    //   `src/controller/waits.ts:193` ('drive-crash').
    it('is true for a waiting run with an open drive-crash wait', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'waiting', driven: false });
      const wait = ctrlWaitFixture({
        id: 'w1', kind: 'error', run: 'r1', state: 'open', questions: [{ id: 'drive-crash', text: 'Retry?' }],
      });
      expect(board.isStalled(run, [wait])).toBe(true);
    });

    // Criterion "isStalled is false for waiting, paused, queued and merging
    // with driven false and no such wait" (design C9; task 9 Success "false
    // for `waiting`, `paused`, `queued` and `merging` with `driven: false`
    // and no such wait (D7)"; design D7 "every other driven-false run is a
    // normal wait or pause").
    //   Pre-condition: a run in the status under test, `driven: false`, no
    //   waits.
    //   Test: isStalled(run, []).
    //   Observable result: false.
    //   Expected-value source: the literal status list of the task Success
    //   line's false clause, each tested separately.
    it.each(['waiting', 'paused', 'queued', 'merging'] as const)(
      'is false for a %s run with driven false and no drive-crash wait',
      (status) => {
        const run = ctrlRunFixture({ id: 'r1', status, driven: false });
        expect(board.isStalled(run, [])).toBe(false);
      },
    );
  });

  // Contract for decisions-and-launch-guard task 19 (design C10 "Tile
  // colour"; Requirement 10 AC 1-3).
  describe('runTone(run, waits, now)', () => {
    const NOW = Date.parse('2026-01-02T00:00:00.000Z');

    // Criterion "runTone is danger for a stalled run whatever its dot"
    // (design C10 "`danger` when `isStalled`"; task 19 Success "`danger`
    // for a stalled run whatever its dot"; Requirement 10 AC 1 "a stalled
    // run is `danger`", AC 3 "WHEN a run is stalled THEN its tone SHALL be
    // `danger`").
    //   Pre-condition: a `running` run with `driven: false` (stalled, per
    //   `isStalled`), tested once with a fresh `lastActivity` (green dot)
    //   and once with a 900,000ms-old one (red dot).
    //   Test: runTone(run, [], now) for each.
    //   Observable result: 'danger' both times — the dot does not change
    //   the answer.
    //   Expected-value source: the task Success line's literal "whatever
    //   its dot" clause, isolated by giving the two cases opposite dots.
    it('is danger for a stalled run whatever its dot', () => {
      const greenDot = ctrlRunFixture({
        id: 'r1', status: 'running', driven: false, inFlight: true,
        lastActivity: new Date(NOW - 1000).toISOString(),
      });
      const redDot = ctrlRunFixture({
        id: 'r2', status: 'running', driven: false, inFlight: true,
        lastActivity: new Date(NOW - 900000).toISOString(),
      });
      expect(board.runTone(greenDot, [], NOW)).toBe('danger');
      expect(board.runTone(redDot, [], NOW)).toBe('danger');
    });

    // Criterion "runTone is warning for a not-stalled run with an amber or
    // a red dot" (design C10 "else `warning` when `runDot` is `amber` or
    // `red`"; task 19 Success; Requirement 10 AC 1 "`warning` when
    // `runDot` is `amber` or `red`").
    //   Pre-condition: a `running` run with `driven: true` (not stalled),
    //   tested once with `lastActivity` 300,000ms old (amber) and once
    //   900,000ms old (red).
    //   Test: runTone(run, [], now) for each.
    //   Observable result: 'warning' both times.
    //   Expected-value source: the task Success line's literal "amber or a
    //   red dot" clause.
    it('is warning for a not-stalled run with an amber or a red dot', () => {
      const amberDot = ctrlRunFixture({
        id: 'r1', status: 'running', driven: true, inFlight: true,
        lastActivity: new Date(NOW - 300000).toISOString(),
      });
      const redDot = ctrlRunFixture({
        id: 'r2', status: 'running', driven: true, inFlight: true,
        lastActivity: new Date(NOW - 900000).toISOString(),
      });
      expect(board.runTone(amberDot, [], NOW)).toBe('warning');
      expect(board.runTone(redDot, [], NOW)).toBe('warning');
    });

    // Criterion "runTone is neutral for green and grey" (design C10
    // "else `neutral`"; task 19 Success; Requirement 10 AC 1 "`neutral`
    // when it is `green` or `grey`").
    //   Pre-condition: a `running` run with `driven: true` (not stalled),
    //   tested once with a fresh `lastActivity` (green) and once with no
    //   `inFlight` at all (grey).
    //   Test: runTone(run, [], now) for each.
    //   Observable result: 'neutral' both times.
    //   Expected-value source: the task Success line's literal "neutral
    //   for green and grey" clause.
    it('is neutral for a not-stalled run with a green or a grey dot', () => {
      const greenDot = ctrlRunFixture({
        id: 'r1', status: 'running', driven: true, inFlight: true,
        lastActivity: new Date(NOW - 1000).toISOString(),
      });
      const greyDot = ctrlRunFixture({ id: 'r2', status: 'running', driven: true, inFlight: false });
      expect(board.runTone(greenDot, [], NOW)).toBe('neutral');
      expect(board.runTone(greyDot, [], NOW)).toBe('neutral');
    });
  });

  describe('runControls(run, waits)', () => {
    // Criterion "runControls gives pause and stop for a moving unheld run"
    // (design C9 "`pause = moving && !resume`; `stop = moving`"; task 9
    // Success "pause and stop for a moving unheld run").
    //   Pre-condition: a `running` run, `driven: true`, no pause, no hold.
    //   Test: runControls(run, []).
    //   Observable result: `{ pause: true, resume: false, stop: true,
    //   discard: false, redrive: false }`.
    //   Expected-value source: design C9's `runControls` formula applied to
    //   an unheld moving run.
    it('gives pause and stop, no resume/discard/redrive, for a moving unheld run', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: true });
      expect(board.runControls(run, [])).toEqual({ pause: true, resume: false, stop: true, discard: false, redrive: false });
    });

    // Criterion "runControls gives resume and stop for an operator-held
    // run" (design C9 "`resume = isOperatorHeld(run) || ...`"; task 9
    // Success "resume and stop for an operator-held one").
    //   Pre-condition: a `running` run with `pauseRequested` set (operator
    //   hold pending), no `holdBy`.
    //   Test: runControls(run, []).
    //   Observable result: `{ pause: false, resume: true, stop: true,
    //   discard: false, redrive: false }`.
    //   Expected-value source: design C9's formula with
    //   `isOperatorHeld(run)` true.
    it('gives resume and stop, no pause, for an operator-held run', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: true, pauseRequested: '2026-01-01T00:00:00.000Z' });
      expect(board.runControls(run, [])).toEqual({ pause: false, resume: true, stop: true, discard: false, redrive: false });
    });

    // Criterion "runControls gives resume for a usage pause" (design C9
    // "`resume = ... || (status === 'paused' && holdBy !== 'deploy')`";
    // task 9 Success "resume for a usage pause").
    //   Pre-condition: a `paused` run with `pauseReason: 'usage-window'`,
    //   no `pauseRequested`, no `holdBy`.
    //   Test: runControls(run, []).
    //   Observable result: `resume: true`.
    //   Expected-value source: design C9's second `resume` clause, with
    //   `holdBy` absent (not `'deploy'`).
    it('gives resume for a usage-window pause', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'paused', driven: true, pauseReason: 'usage-window' });
      expect(board.runControls(run, [])).toMatchObject({ resume: true });
    });

    // Criterion "runControls gives no resume and pause for a deploy-held
    // run" (design C9's note "A deploy-held run keeps Pause, because pause
    // moves the hold to the operator"; task 9 Success "no resume and pause
    // for a deploy-held run (requirement 6 AC 7, regression guard for the
    // note)"; Requirement 6.7, 7.2).
    //   Pre-condition: a `paused` run with `holdBy: 'deploy'` and
    //   `pauseRequested` set, as the deploy hold writes
    //   (`src/controller/deploy.ts:264`).
    //   Test: runControls(run, []).
    //   Observable result: `{ pause: true, resume: false }`.
    //   Expected-value source: design C9's formula: `isOperatorHeld` is
    //   false for `holdBy === 'deploy'`, and the second `resume` clause is
    //   false because `holdBy === 'deploy'`.
    it('gives pause and no resume for a deploy-held run', () => {
      const run = ctrlRunFixture({
        id: 'r1', status: 'paused', driven: true, holdBy: 'deploy', pauseRequested: '2026-01-01T00:00:00.000Z',
      });
      expect(board.runControls(run, [])).toMatchObject({ pause: true, resume: false });
    });

    // Criterion "runControls never gives stop on a stopped run" (design C9
    // "`stop = moving`"; task 9 Success "stop never on a stopped run").
    //   Pre-condition: an `abandoned` run (a stopped status).
    //   Test: runControls(run, []).
    //   Observable result: `{ pause: false, resume: false, stop: false }`.
    //   Expected-value source: the literal "stop never on a stopped run"
    //   clause.
    it('never gives stop, pause or resume on a stopped run', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'abandoned', driven: true, discardAllowed: false });
      expect(board.runControls(run, [])).toMatchObject({ pause: false, resume: false, stop: false });
    });

    // Criterion "runControls gives discard for a stopped run only when
    // discardAllowed" (design C9 "`discard = stopped && discardAllowed`";
    // task 9 Success "discard for a stopped run only when
    // discardAllowed").
    //   Pre-condition: two `abandoned` runs, one with `discardAllowed:
    //   true`, one with `discardAllowed: false`.
    //   Test: runControls(run, []) for each.
    //   Observable result: `discard: true` for the first, `discard: false`
    //   for the second.
    //   Expected-value source: the literal "only when discardAllowed"
    //   clause.
    it('gives discard on a stopped run only when discardAllowed is true', () => {
      const allowed = ctrlRunFixture({ id: 'r1', status: 'abandoned', driven: true, discardAllowed: true });
      const blocked = ctrlRunFixture({ id: 'r2', status: 'abandoned', driven: true, discardAllowed: false });
      expect(board.runControls(allowed, [])).toMatchObject({ discard: true });
      expect(board.runControls(blocked, [])).toMatchObject({ discard: false });
    });

    // Criterion "runControls gives redrive only when stalled" (design C9
    // "`redrive = isStalled`"; task 9 Success "redrive only when stalled").
    //   Pre-condition: a stalled `running` run (`driven: false`) and a
    //   non-stalled `running` run (`driven: true`).
    //   Test: runControls(run, []) for each.
    //   Observable result: `redrive: true` for the stalled run,
    //   `redrive: false` for the other.
    //   Expected-value source: the literal "redrive only when stalled"
    //   clause.
    it('offers redrive only when the run reads as stalled', () => {
      const stalled = ctrlRunFixture({ id: 'r1', status: 'running', driven: false });
      const notStalled = ctrlRunFixture({ id: 'r2', status: 'running', driven: true });
      expect(board.runControls(stalled, [])).toMatchObject({ redrive: true });
      expect(board.runControls(notStalled, [])).toMatchObject({ redrive: false });
    });
  });

  describe('mergeRead(wait, runs)', () => {
    // Criterion "mergeRead takes the kind: 'run' read for question id
    // 'merge'" (design C9 "R4 AC 3: question id `merge` takes the
    // `kind: 'run'` read"; task 9 Success; Requirement 4.3).
    //   Pre-condition: a run with two `prReads`, one `kind: 'run'` and one
    //   `kind: 'closeout'`, same repo/number; a `merge` wait naming that
    //   run, question id `merge`.
    //   Test: mergeRead(wait, [run]).
    //   Observable result: the `kind: 'run'` read, not the `closeout` one.
    //   Expected-value source: the literal "takes the `kind: 'run'` read"
    //   clause.
    it("takes the run's own PR read for question id 'merge'", () => {
      const runRead = prReadFixture({ kind: 'run', repo: 'repo', number: 3 });
      const closeoutRead = prReadFixture({ kind: 'closeout', repo: 'repo', number: 3 });
      const run = ctrlRunFixture({ id: 'r1', status: 'merging', driven: true, prReads: [runRead, closeoutRead] });
      const wait = ctrlWaitFixture({ id: 'w1', kind: 'merge', run: 'r1', questions: [{ id: 'merge', text: 'Merge PR #3?' }] });
      expect(board.mergeRead(wait, [run])).toEqual(runRead);
    });

    // Criterion "mergeRead takes the matching read for merge:repo#7"
    // (design C9 "`merge:` plus `repo#n` takes the matching read"; task 9
    // Success "the matching read for `merge:repo#7`"; Requirement 4.3).
    //   Pre-condition: a run with a `closeout` read for repo 'repo' number
    //   7, plus an unrelated `run`-kind read; a wait naming that run,
    //   question id `merge:repo#7`.
    //   Test: mergeRead(wait, [run]).
    //   Observable result: the closeout read for repo 'repo', number 7.
    //   Expected-value source: the literal "`merge:` plus `repo#n`" clause,
    //   with the exact id `merge:repo#7` from the task Success line.
    it("takes the matching closeout read for question id 'merge:repo#7'", () => {
      const runRead = prReadFixture({ kind: 'run', repo: 'repo', number: 3 });
      const closeoutRead = prReadFixture({ kind: 'closeout', repo: 'repo', number: 7 });
      const run = ctrlRunFixture({ id: 'r1', status: 'merging', driven: true, prReads: [runRead, closeoutRead] });
      const wait = ctrlWaitFixture({
        id: 'w1', kind: 'merge', run: 'r1', questions: [{ id: 'merge:repo#7', text: 'Merge close-out PR #7 of repo?' }],
      });
      expect(board.mergeRead(wait, [run])).toEqual(closeoutRead);
    });

    // Criterion "mergeRead gives null when none matches" (design C9 "else
    // `null`"; task 9 Success "and `null` when none matches").
    //   Pre-condition: a run with no `prReads`, named by a `merge` wait.
    //   Test: mergeRead(wait, [run]).
    //   Observable result: null.
    //   Expected-value source: the literal "null when none matches" clause.
    it('gives null when no read matches', () => {
      const run = ctrlRunFixture({ id: 'r1', status: 'merging', driven: true, prReads: [] });
      const wait = ctrlWaitFixture({ id: 'w1', kind: 'merge', run: 'r1', questions: [{ id: 'merge', text: 'Merge PR #3?' }] });
      expect(board.mergeRead(wait, [run])).toBeNull();
    });
  });

  describe('waitSummary(wait)', () => {
    // Criterion "waitSummary gives the count text for gate-a and gate-b"
    // (design C9 "`ctrlSummary`, moved verbatim"; task 9 Success "the count
    // text for `gate-a`, `gate-b` and `retro-plan`"; source text
    // `src/dashboard_frontend/src/modules/shell/NowPage.tsx:69-70`).
    //   Pre-condition: a wait of the kind under test, with `questions` of
    //   the given length.
    //   Test: waitSummary(wait).
    //   Observable result: the literal count string.
    //   Expected-value source: `ctrlSummary`'s literal `gate-a`/`gate-b`
    //   template strings, read live at NowPage.tsx:69-70.
    it.each([
      ['gate-a', 3, 'Gate A — 3 decision(s)'],
      ['gate-b', 2, 'Gate B — 2 item(s)'],
    ] as const)('gives the count text for a %s wait', (kind, n, expected) => {
      const wait = ctrlWaitFixture({
        id: 'w1', kind, questions: Array.from({ length: n }, (_, i) => ({ id: `q${i}` })),
      });
      expect(board.waitSummary(wait)).toBe(expected);
    });

    // Criterion "waitSummary gives the count text for retro-plan, from
    // proposals not questions" (design C9; task 9 Success; source text
    // `NowPage.tsx:71`).
    //   Pre-condition: a `retro-plan` wait with an empty `questions` array
    //   and a `proposals` array of length 2 (isolating the count source from
    //   `questions.length`).
    //   Test: waitSummary(wait).
    //   Observable result: 'Retro plan — 2 proposal(s)'.
    //   Expected-value source: `ctrlSummary`'s literal `retro-plan` template
    //   string, read live at NowPage.tsx:71.
    it('gives the count text for a retro-plan wait, counting proposals not questions', () => {
      const wait = ctrlWaitFixture({ id: 'w1', kind: 'retro-plan', questions: [], proposals: ['p1', 'p2'] });
      expect(board.waitSummary(wait)).toBe('Retro plan — 2 proposal(s)');
    });

    // Criterion "waitSummary gives the whole first question text for the
    // others" (design C9; task 9 Success "the whole first question text for
    // the others"; Requirement 4.1, revision O3 "the whole of the first
    // question text ... not its first line").
    //   Pre-condition: a wait of each other kind (`merge`, `escalation`,
    //   `error`, `question`), with a `questions[0].text` spanning two lines.
    //   Test: waitSummary(wait).
    //   Observable result: the exact two-line text, untruncated.
    //   Expected-value source: the literal "whole first question text"
    //   clause, isolated from a first-line-only reading by a multi-line
    //   fixture text.
    it.each(['merge', 'escalation', 'error', 'question'] as const)(
      'gives the whole first question text, unmodified, for a %s wait',
      (kind) => {
        const text = 'Line one of the question.\nLine two, which a first-line-only reader would drop.';
        const wait = ctrlWaitFixture({ id: 'w1', kind, questions: [{ id: 'q0', text }] });
        expect(board.waitSummary(wait)).toBe(text);
      },
    );

    // Criterion "waitSummary gives each kind's fixed line with no question"
    // (design C9; task 9 Success; source text `NowPage.tsx:72-76`).
    //   Pre-condition: a wait of each kind with an empty `questions` array.
    //   Test: waitSummary(wait).
    //   Observable result: the literal fixed line for that kind.
    //   Expected-value source: `ctrlSummary`'s literal fallback strings,
    //   read live at NowPage.tsx:72-76.
    it.each([
      ['merge', 'Ready to merge'],
      ['escalation', 'A reviewer escalated'],
      ['error', 'A step needs a decision'],
      ['question', 'A step needs one fact'],
    ] as const)('gives the fixed line for a %s wait with no question', (kind, expected) => {
      const wait = ctrlWaitFixture({ id: 'w1', kind, questions: [] });
      expect(board.waitSummary(wait)).toBe(expected);
    });
  });

  describe('setupLine(view)', () => {
    // Criterion "setupLine reads supervisor, role count, worktree and gates
    // record" (design C9 "`supervisor <model> · <n> roles · worktree
    // <value> · gates record`"; task 9 Success).
    //   Pre-condition: a view with `supervisor.model: 'm'`, two roles,
    //   `worktree: 'yes'`, `gates: 'record'`.
    //   Test: setupLine(view).
    //   Observable result: 'supervisor m · 2 roles · worktree yes · gates
    //   record'.
    //   Expected-value source: the literal template string of design C9.
    it('reads supervisor, role count, worktree and gates record', () => {
      const view: SetupLineViewFixture = { supervisor: { model: 'm' }, roles: [{}, {}], worktree: 'yes', gates: 'record' };
      expect(board.setupLine(view)).toBe('supervisor m · 2 roles · worktree yes · gates record');
    });

    // Criterion "setupLine says record when view.gates is block" (design
    // C9; task 9 Success "and says `record` when `view.gates` is `block`";
    // Requirement 8.3 "`view.gates` SHALL NOT show").
    //   Pre-condition: the same view, `gates: 'block'`.
    //   Test: setupLine(view).
    //   Observable result: the line still ends "gates record", not "gates
    //   block".
    //   Expected-value source: the literal "says `record` when `view.gates`
    //   is `block`" clause.
    it('still reads gates record when view.gates is block', () => {
      const view: SetupLineViewFixture = { supervisor: { model: 'm' }, roles: [{}, {}], worktree: 'yes', gates: 'block' };
      expect(board.setupLine(view)).toBe('supervisor m · 2 roles · worktree yes · gates record');
    });
  });

  describe('compactAge(ms)', () => {
    // Criterion "compactAge gives <m>m under one hour" (design C9 "R10 AC
    // 2"; task 9 Success "`59m` ... with no space or seconds"; Requirement
    // 10.2 "`<m>m` under one hour").
    //   Pre-condition: none.
    //   Test: compactAge(59 * 60 * 1000).
    //   Observable result: '59m'.
    //   Expected-value source: the literal '59m' example of the task
    //   Success line.
    it('gives <m>m under one hour', () => {
      expect(board.compactAge(59 * 60 * 1000)).toBe('59m');
    });

    // Criterion "compactAge gives <h>h<m>m from one hour" (design C9;
    // task 9 Success "`1h0m`, `4h20m` ... with no space or seconds";
    // Requirement 10.2 "`<h>h<m>m` from one hour").
    //   Pre-condition: none.
    //   Test: compactAge(60*60*1000), compactAge(4h20m in ms).
    //   Observable result: '1h0m', '4h20m'.
    //   Expected-value source: the literal '1h0m' and '4h20m' examples of
    //   the task Success line.
    it('gives <h>h<m>m from one hour', () => {
      expect(board.compactAge(60 * 60 * 1000)).toBe('1h0m');
      expect(board.compactAge(4 * 3600 * 1000 + 20 * 60 * 1000)).toBe('4h20m');
    });

    // Criterion "compactAge gives <d>d<h>h from one day" (design C9;
    // task 9 Success "`1d0h` ... with no space or seconds"; Requirement
    // 10.2 "`<d>d<h>h` from one day").
    //   Pre-condition: none.
    //   Test: compactAge(24*60*60*1000).
    //   Observable result: '1d0h'.
    //   Expected-value source: the literal '1d0h' example of the task
    //   Success line.
    it('gives <d>d<h>h from one day', () => {
      expect(board.compactAge(24 * 60 * 60 * 1000)).toBe('1d0h');
    });
  });

  describe('tabTitle(waits, enabled, now, base)', () => {
    // Criterion "tabTitle gives '2 · 4h20m' for two open enabled waits"
    // (design C9 "R10"; task 9 Success; Requirement 10.1 "the count, ' ·
    // ' and the oldest age, such as '2 · 4h20m'").
    //   Pre-condition: two open waits on an enabled project, the older
    //   created 4h20m before `now`.
    //   Test: tabTitle([old, newer], () => true, now, base).
    //   Observable result: '2 · 4h20m'.
    //   Expected-value source: the literal '2 · 4h20m' example of
    //   Requirement 10.1.
    it('reads the count and oldest age for two open enabled waits', () => {
      const now = Date.parse('2026-01-02T00:00:00.000Z');
      const old = ctrlWaitFixture({ id: 'w1', created: new Date(now - (4 * 3600 + 20 * 60) * 1000).toISOString() });
      const newer = ctrlWaitFixture({ id: 'w2', created: new Date(now - 60 * 1000).toISOString() });
      expect(board.tabTitle([old, newer], () => true, now, 'Base')).toBe('2 · 4h20m');
    });

    // Criterion "tabTitle ignores answered waits and disabled projects"
    // (design C9; task 9 Success; Requirement 10.1 "open controller waits
    // ... on enabled projects").
    //   Pre-condition: the same two open/enabled waits, plus an `answered`
    //   wait and a wait on a disabled project, both older than the two
    //   counted waits (so a bug that counted them would also change the
    //   oldest age).
    //   Test: tabTitle([old, newer, answered, offProject], enabled, now,
    //   base).
    //   Observable result: '2 · 4h20m', unchanged from the filtered-out
    //   waits.
    //   Expected-value source: the literal "on enabled projects" clause and
    //   the `state === 'open'` filter, isolated by making the dropped waits
    //   older (so they would otherwise change the reported age).
    it('ignores an answered wait and a wait on a disabled project', () => {
      const now = Date.parse('2026-01-02T00:00:00.000Z');
      const old = ctrlWaitFixture({
        id: 'w1', project: 'p-on', created: new Date(now - (4 * 3600 + 20 * 60) * 1000).toISOString(),
      });
      const newer = ctrlWaitFixture({ id: 'w2', project: 'p-on', created: new Date(now - 60 * 1000).toISOString() });
      const answered = ctrlWaitFixture({
        id: 'w3', project: 'p-on', state: 'answered', created: new Date(now - 10 * 3600 * 1000).toISOString(),
      });
      const offProject = ctrlWaitFixture({
        id: 'w4', project: 'p-off', created: new Date(now - 20 * 3600 * 1000).toISOString(),
      });
      const enabled = (id: string) => id === 'p-on';
      const result = board.tabTitle([old, newer, answered, offProject], enabled, now, 'Base');
      expect(result).toBe('2 · 4h20m');
    });

    // Criterion "tabTitle returns base when none is left" (design C9; task
    // 9 Success; Requirement 10.3 "the title SHALL be the base title").
    //   Pre-condition: a single `answered` wait (filtered out, leaving no
    //   open enabled wait).
    //   Test: tabTitle([answered], () => true, now, base).
    //   Observable result: the `base` string, unchanged.
    //   Expected-value source: the literal "returns `base` when none is
    //   left" clause.
    it('returns the base title when no open enabled wait is left', () => {
      const now = Date.parse('2026-01-02T00:00:00.000Z');
      const answered = ctrlWaitFixture({ id: 'w1', state: 'answered' });
      expect(board.tabTitle([answered], () => true, now, 'Base Title')).toBe('Base Title');
    });
  });
});

// Contract for dashboard-board task 9 (continued): pause.ts (design C9
// "The two strings at `:43` and `:45` become `pausing after this step`";
// Requirement 6.6).
//
// `pause.ts` lives under `src/dashboard_frontend/`, loaded the same way as
// `board.ts` above (runtime `import()`, cast to a hand-written type) for the
// same tsconfig/vitest-exclude reason given in the file header comment.
// `deploy-view.test.ts` already imports this module for the deploy-hold
// branch (holdBy === 'deploy') and the two operator-pause regression guards
// (pauseReason === 'operator', with and without an explicit holdBy:
// 'operator'); it asserts neither of the two strings this task changes, so
// task 9's own Note holds and those two deploy-view.test.ts cases are not
// duplicated here.
//
// Fold note: task 9 Success's "an applied operator pause reads 'paused by
// you' and a deploy hold 'held for deploy' (regression guards)" is covered
// by `deploy-view.test.ts:294-340` (the deploy-hold `it.each` and the two
// operator-pause regression-guard tests) — not re-tested here.

type PauseStringsModule = {
  pauseNote: (run: CtrlRunFixture, now: number) => { text: string; overdue: boolean } | null;
};

describe('pause.ts "pausing after this step" (src/dashboard_frontend/src/modules/shell/pause.ts)', () => {
  let pause: PauseStringsModule;

  beforeAll(async () => {
    pause = (await import(pathToFileURL(join(FE, 'shell', 'pause.ts')).href)) as PauseStringsModule;
  });

  // Criterion "pauseNote reads 'pausing after this step' for a running run"
  // (design C9 "the two strings at `:43` and `:45` become `pausing after
  // this step`"; task 9 Success "`pauseNote` reads 'pausing after this
  // step' for a running run"; Requirement 6.6 "a running run's note reads
  // just that").
  //   Pre-condition: a `running` run with `pauseRequested` set (a pending
  //   pause request, not yet applied).
  //   Test: pauseNote(run, now).
  //   Observable result: `{ text: 'pausing after this step', overdue:
  //   false }`.
  //   Expected-value source: the literal "pausing after this step" string of
  //   Requirement 6.6, replacing the current "pause requested" text
  //   (pause.ts:43).
  it("reads 'pausing after this step' for a running run with a pending pause", () => {
    const run = ctrlRunFixture({ id: 'r1', status: 'running', pauseRequested: '2026-01-01T00:00:00.000Z' });
    const result = pause.pauseNote(run, Date.parse('2026-01-01T00:05:00.000Z'));
    expect(result).toEqual({ text: 'pausing after this step', overdue: false });
  });

  // Criterion "pauseNote ends '· pausing after this step' for a waiting
  // run" (design C9; task 9 Success "ends '· pausing after this step' for a
  // waiting run"; Requirement 6.6 "a waiting run keeps its waiting text with
  // a '· pausing after this step' suffix").
  //   Pre-condition: a `waiting` run with `pauseRequested` and `pausedAt`
  //   both set to the same time, 5 minutes before `now` (so the waiting
  //   text reads "waiting 5m 0s").
  //   Test: pauseNote(run, now).
  //   Observable result: `{ text: 'waiting 5m 0s · pausing after this
  //   step', overdue: false }`.
  //   Expected-value source: the literal "· pausing after this step" suffix
  //   of Requirement 6.6, appended to the unchanged waiting text computed by
  //   `pausedOrWaitingNote` (pause.ts, unmodified by this task).
  it("ends '· pausing after this step' for a waiting run, keeping its waiting text", () => {
    const pausedAt = '2026-01-01T00:00:00.000Z';
    const run = ctrlRunFixture({ id: 'r1', status: 'waiting', pauseRequested: pausedAt, pausedAt });
    const result = pause.pauseNote(run, Date.parse('2026-01-01T00:05:00.000Z'));
    expect(result).toEqual({ text: 'waiting 5m 0s · pausing after this step', overdue: false });
  });
});

// Contract for dashboard-board task 10 (design C11 "Stages", D20, D34, D37;
// task 10 Note D42, D47; Requirements 9.1-9.4).
//
// `stage.ts` lives under `src/dashboard_frontend/`, loaded the same way as
// `board.ts` and `pause.ts` above (runtime `import()`, cast to a
// hand-written type) for the same tsconfig/vitest-exclude reason given in
// the file header comment. The module does not exist yet at this commit, so
// every `beforeAll` here is expected to reject (same bridge as task 8's
// `board.ts` note).
//
// Design C11 marks the `Stage`/`Observed` interfaces illustrative ("verify
// against the test fake"); only `failReason`, `resolved` and `advance` are
// pinned by name. The task's own `_Prompt` names a fourth, unnamed pure
// function — "a pure function that turns a `callHarness` result or a
// rejected fetch into the next stage" — so this test file names it
// `responseStage(name, result, now)` and passes `result: null` for the
// rejected-fetch case; the implementer may pick any name, but must satisfy
// this seam (D47 — the response rules sit in `stage.ts` precisely so a unit
// test can reach them with no renderer).
//
// `Observed`'s fields are likewise this test's own choice, built from design
// C11's `resolved` table row by row: `run` (undefined for "row gone") reuses
// the `CtrlRunFixture` shape already defined above (it already carries
// `status`, `pauseRequested`, `branchPresent`, `driven`, matching the
// table's "pauseRequested set or status paused", "status abandoned, or row
// gone" and "branchPresent false, or row gone" clauses verbatim), `waits`
// is the same `CtrlWaitFixture[]` task 9's `isStalled` reads (the task Note
// — "the stalled test comes from what task 9 exports" — pins `redrive`'s
// rule to that real, already-tested function, not a restated one),
// `controllerRuns` and `actionState`/`actionDetail` cover the `launch` and
// `confirm`/`dismiss` rows.

type StageName = 'pause' | 'resume' | 'stop' | 'discard' | 'redrive' | 'launch' | 'confirm' | 'dismiss';
type StagePhase = 'pressed' | 'running' | 'done' | 'failed';

interface StageFixture {
  name: StageName;
  phase: StagePhase;
  at: number;
  reason?: string;
  opError?: { status: number; body: any } | null;
  runId?: string;
}

interface ObservedFixture {
  run?: CtrlRunFixture;
  waits?: CtrlWaitFixture[];
  controllerRuns?: string[];
  actionState?: ActionState;
  actionDetail?: string;
}

interface HarnessResultFixture {
  ok: boolean;
  status: number;
  data: any;
}

type StageModule = {
  failReason: (status: number, body: any) => string;
  resolved: (stage: StageFixture, seen: ObservedFixture) => boolean;
  advance: (stage: StageFixture, seen: ObservedFixture, now: number) => StageFixture | null;
  responseStage: (name: StageName, result: HarnessResultFixture | null, now: number) => StageFixture;
};

function stageFixture(
  overrides: Partial<StageFixture> & { name: StageName; phase: StagePhase; at: number },
): StageFixture {
  return { ...overrides };
}

describe('stage.ts (src/dashboard_frontend/src/modules/shell/stage.ts)', () => {
  let stage: StageModule;

  beforeAll(async () => {
    stage = (await import(pathToFileURL(join(FE, 'shell', 'stage.ts')).href)) as StageModule;
  });

  describe('failReason(status, body)', () => {
    // Criterion "failReason gives the body's reason" (design C11
    // "function failReason(status, body): string; // reason, else error,
    // else status"; task 10 Success; Requirement 9.2).
    //   Pre-condition: a body carrying both `reason` and `error`.
    //   Test: failReason(500, { reason, error }).
    //   Observable result: the `reason` string, not the `error` string.
    //   Expected-value source: the design comment's literal priority order.
    it("gives the body's reason even when an error is also present", () => {
      expect(stage.failReason(500, { reason: 'bad state', error: 'ignored' })).toBe('bad state');
    });

    // Criterion "failReason gives ... else its error" (same citations).
    //   Pre-condition: a body with `error` only, no `reason`.
    //   Test: failReason(500, { error }).
    //   Observable result: the `error` string.
    //   Expected-value source: the design comment's "else error" fallback.
    it("gives the body's error when no reason is present", () => {
      expect(stage.failReason(500, { error: 'boom' })).toBe('boom');
    });

    // Criterion "failReason gives ... else the status code" (same
    // citations).
    //   Pre-condition: a body with neither `reason` nor `error`.
    //   Test: failReason(500, {}).
    //   Observable result: '500' (the design's declared string return type
    //   forces the status to be read as text).
    //   Expected-value source: the design comment's "else status" fallback.
    it('gives the status code when neither reason nor error is present', () => {
      expect(stage.failReason(500, {})).toBe('500');
    });
  });

  describe('responseStage(name, result, now) — the callHarness-result-to-stage rule', () => {
    // Criterion "a non-2xx gives failed" (design C11 "A rejected fetch or a
    // non-2xx gives failed with failReason"; task 10 Success; Requirement
    // 9.2).
    //   Pre-condition: a non-launch stage, a non-2xx HarnessResult.
    //   Test: responseStage('pause', { ok: false, status: 400, data }, now).
    //   Observable result: phase 'failed'.
    //   Expected-value source: the literal "a non-2xx gives failed" clause.
    it('gives failed for a non-2xx response', () => {
      const result = stage.responseStage('pause', { ok: false, status: 400, data: { error: 'bad' } }, 1000);
      expect(result.phase).toBe('failed');
    });

    // Criterion "a rejected fetch gives failed" (same citations).
    //   Pre-condition: `result` is `null`, this test file's chosen
    //   representation of a rejected fetch (header comment above).
    //   Test: responseStage('pause', null, now).
    //   Observable result: phase 'failed'.
    //   Expected-value source: the literal "a rejected fetch gives failed"
    //   clause.
    it('gives failed for a rejected fetch', () => {
      const result = stage.responseStage('pause', null, 1000);
      expect(result.phase).toBe('failed');
    });

    // Criterion "a launch non-2xx keeps opError" (design C11 "for launch it
    // also keeps opError so the tile renders OpErrorView"; task 10 Success;
    // Requirement 9.2's "Launch refusals SHALL keep OpErrorView").
    //   Pre-condition: name 'launch', a non-2xx HarnessResult.
    //   Test: responseStage('launch', { ok: false, status: 409, data }, now).
    //   Observable result: phase 'failed'; opError equals
    //   { status: 409, body: data }.
    //   Expected-value source: the literal "keeps opError" clause, and
    //   harness.tsx's `OpError = { status, body }` shape (task 10 Leverage).
    it('keeps opError on a launch non-2xx response', () => {
      const result = stage.responseStage('launch', { ok: false, status: 409, data: { error: 'run-live' } }, 1000);
      expect(result.phase).toBe('failed');
      expect(result.opError).toEqual({ status: 409, body: { error: 'run-live' } });
    });

    // Criterion "a 2xx with ok === false gives failed with the body's error
    // (D34)" (design C11 "A 2xx whose body has ok === false gives failed
    // with the body's error, because confirm answers 200 when its executor
    // fails"; D34; task 10 Success).
    //   Pre-condition: name 'confirm', a 2xx HarnessResult whose body has
    //   `ok: false` and an `error` string (the real shape of
    //   `confirmAction`'s failure response, src/advisor/actions.ts:463).
    //   Test: responseStage('confirm', { ok: true, status: 200, data }, now).
    //   Observable result: phase 'failed'; reason 'refused'.
    //   Expected-value source: the literal "failed with the body's error"
    //   clause.
    it("gives failed with the body's error for a 2xx response whose body has ok === false", () => {
      const result = stage.responseStage('confirm', { ok: true, status: 200, data: { ok: false, error: 'refused' } }, 1000);
      expect(result.phase).toBe('failed');
      expect(result.reason).toBe('refused');
    });

    // Criterion "any other 2xx gives running" (design C11; task 10 Success;
    // Requirement 9.3 "the stage SHALL read running").
    //   Pre-condition: a 2xx HarnessResult whose body has no `ok: false`
    //   (an empty body, not just an explicit `ok: true`, to prove the rule
    //   is "not strictly false", not "strictly true").
    //   Test: responseStage('pause', { ok: true, status: 200, data: {} }, now).
    //   Observable result: phase 'running'.
    //   Expected-value source: the literal "any other 2xx gives running"
    //   clause.
    it('gives running for any other 2xx response', () => {
      const result = stage.responseStage('pause', { ok: true, status: 200, data: {} }, 1000);
      expect(result.phase).toBe('running');
    });
  });

  describe('resolved(stage, seen)', () => {
    // Criterion "resolved is tested true ... for pause" (design C11 table
    // row "pause | pauseRequested set or status paused"; task 10 Success).
    //   Pre-condition: a running pause stage; a run with `pauseRequested`
    //   set.
    //   Test: resolved(stage, { run }).
    //   Observable result: true.
    //   Expected-value source: the design table's `pause` row.
    it('resolves pause true when the run has pauseRequested set', () => {
      const s = stageFixture({ name: 'pause', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running', pauseRequested: '2026-01-01T00:00:00.000Z' });
      expect(stage.resolved(s, { run })).toBe(true);
    });

    // Criterion "resolved is tested ... false for pause" (same citations).
    //   Pre-condition: the same stage; a run with no `pauseRequested` and a
    //   status other than `paused`.
    //   Test: resolved(stage, { run }).
    //   Observable result: false.
    //   Expected-value source: the design table's `pause` row, negated.
    it('resolves pause false when the run has no pauseRequested and is not paused', () => {
      const s = stageFixture({ name: 'pause', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running' });
      expect(stage.resolved(s, { run })).toBe(false);
    });

    // Criterion "resolved is tested true ... for resume" (design C11 table
    // row "resume | not isOperatorHeld and status not paused"; task 10
    // Success; task 10 Leverage pause.ts:27-30).
    //   Pre-condition: a running resume stage; a run with no pause hold and
    //   status 'running'.
    //   Test: resolved(stage, { run }).
    //   Observable result: true.
    //   Expected-value source: the design table's `resume` row.
    it('resolves resume true when the run is not operator-held and not paused', () => {
      const s = stageFixture({ name: 'resume', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running' });
      expect(stage.resolved(s, { run })).toBe(true);
    });

    // Criterion "resolved is tested ... false for resume" (same citations).
    //   Pre-condition: the same stage; a run operator-held and paused.
    //   Test: resolved(stage, { run }).
    //   Observable result: false.
    //   Expected-value source: the design table's `resume` row, negated via
    //   `isOperatorHeld` (pause.ts:27-30): `status === 'paused' &&
    //   pauseReason === 'operator'`.
    it('resolves resume false when the run is operator-held and paused', () => {
      const s = stageFixture({ name: 'resume', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'paused', pauseReason: 'operator' });
      expect(stage.resolved(s, { run })).toBe(false);
    });

    // Criterion "resolved is tested true ... for stop" (design C11 table
    // row "stop | status abandoned, or row gone"; task 10 Success).
    //   Pre-condition: a running stop stage; a run with status 'abandoned'.
    //   Test: resolved(stage, { run }).
    //   Observable result: true.
    //   Expected-value source: the design table's `stop` row.
    it('resolves stop true when the run status is abandoned', () => {
      const s = stageFixture({ name: 'stop', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'abandoned' });
      expect(stage.resolved(s, { run })).toBe(true);
    });

    // Criterion "resolved is tested ... false for stop" (same citations).
    //   Pre-condition: the same stage; a run still present and 'running'.
    //   Test: resolved(stage, { run }).
    //   Observable result: false.
    //   Expected-value source: the design table's `stop` row, negated.
    it('resolves stop false when the run is still present and running', () => {
      const s = stageFixture({ name: 'stop', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running' });
      expect(stage.resolved(s, { run })).toBe(false);
    });

    // Criterion "resolved is tested true ... for discard" (design C11 table
    // row "discard | branchPresent false, or row gone"; task 10 Success).
    //   Pre-condition: a running discard stage; a run with
    //   `branchPresent: false`.
    //   Test: resolved(stage, { run }).
    //   Observable result: true.
    //   Expected-value source: the design table's `discard` row.
    it('resolves discard true when the run has branchPresent false', () => {
      const s = stageFixture({ name: 'discard', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'done', branchPresent: false });
      expect(stage.resolved(s, { run })).toBe(true);
    });

    // Criterion "resolved is tested ... false for discard" (same
    // citations).
    //   Pre-condition: the same stage; a run still present with
    //   `branchPresent: true`.
    //   Test: resolved(stage, { run }).
    //   Observable result: false.
    //   Expected-value source: the design table's `discard` row, negated.
    it('resolves discard false when the run is still present with its branch present', () => {
      const s = stageFixture({ name: 'discard', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'done', branchPresent: true });
      expect(stage.resolved(s, { run })).toBe(false);
    });

    // Criterion "resolved is tested true ... for redrive" (design C11 table
    // row "redrive | not isStalled"; task 10 Success and Note "the stalled
    // test comes from what task 9 exports").
    //   Pre-condition: a running redrive stage; a run 'running' and
    //   `driven: true` — not stalled, per `board.ts`'s own `isStalled`
    //   (task 9 Success: "true for running with driven: false").
    //   Test: resolved(stage, { run }).
    //   Observable result: true.
    //   Expected-value source: the design table's `redrive` row.
    it('resolves redrive true when the run is no longer stalled', () => {
      const s = stageFixture({ name: 'redrive', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: true });
      expect(stage.resolved(s, { run, waits: [] })).toBe(true);
    });

    // Criterion "resolved is tested ... false for redrive" (same
    // citations).
    //   Pre-condition: the same stage; a run 'running' with `driven: false`
    //   — stalled, per `board.ts`'s `isStalled`.
    //   Test: resolved(stage, { run }).
    //   Observable result: false.
    //   Expected-value source: the design table's `redrive` row, negated.
    it('resolves redrive false when the run is still stalled', () => {
      const s = stageFixture({ name: 'redrive', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: false });
      expect(stage.resolved(s, { run, waits: [] })).toBe(false);
    });

    // Criterion "resolved is tested true ... for launch" (design C11 table
    // row "launch | the response's runId is in controllerRuns"; task 10
    // Success).
    //   Pre-condition: a running launch stage carrying `runId: 'r1'`;
    //   `controllerRuns` containing that id.
    //   Test: resolved(stage, { controllerRuns }).
    //   Observable result: true.
    //   Expected-value source: the design table's `launch` row.
    it("resolves launch true when the stage's runId is among controllerRuns", () => {
      const s = stageFixture({ name: 'launch', phase: 'running', at: 0, runId: 'r1' });
      expect(stage.resolved(s, { controllerRuns: ['r1', 'r2'] })).toBe(true);
    });

    // Criterion "resolved is tested ... false for launch" (same citations).
    //   Pre-condition: the same stage; `controllerRuns` without that id.
    //   Test: resolved(stage, { controllerRuns }).
    //   Observable result: false.
    //   Expected-value source: the design table's `launch` row, negated.
    it("resolves launch false when the stage's runId is absent from controllerRuns", () => {
      const s = stageFixture({ name: 'launch', phase: 'running', at: 0, runId: 'r1' });
      expect(stage.resolved(s, { controllerRuns: ['r2'] })).toBe(false);
    });

    // Criterion "resolved is tested true ... for confirm" (design C11 table
    // row "confirm | action state done, refused or failed"; task 10
    // Success).
    //   Pre-condition: a running confirm stage; `actionState: 'done'`.
    //   Test: resolved(stage, { actionState }).
    //   Observable result: true.
    //   Expected-value source: the design table's `confirm` row.
    it('resolves confirm true when the action state is done', () => {
      const s = stageFixture({ name: 'confirm', phase: 'running', at: 0 });
      expect(stage.resolved(s, { actionState: 'done' })).toBe(true);
    });

    // Criterion "resolved is tested ... false for confirm" (same
    // citations).
    //   Pre-condition: the same stage; `actionState: 'staged'`.
    //   Test: resolved(stage, { actionState }).
    //   Observable result: false.
    //   Expected-value source: the design table's `confirm` row, negated.
    it('resolves confirm false when the action is still staged', () => {
      const s = stageFixture({ name: 'confirm', phase: 'running', at: 0 });
      expect(stage.resolved(s, { actionState: 'staged' })).toBe(false);
    });

    // Criterion "resolved is tested true ... for dismiss" (design C11 table
    // row "dismiss | action state dismissed"; task 10 Success).
    //   Pre-condition: a running dismiss stage; `actionState: 'dismissed'`.
    //   Test: resolved(stage, { actionState }).
    //   Observable result: true.
    //   Expected-value source: the design table's `dismiss` row.
    it('resolves dismiss true when the action state is dismissed', () => {
      const s = stageFixture({ name: 'dismiss', phase: 'running', at: 0 });
      expect(stage.resolved(s, { actionState: 'dismissed' })).toBe(true);
    });

    // Criterion "resolved is tested ... false for dismiss" (same
    // citations).
    //   Pre-condition: the same stage; `actionState: 'staged'`.
    //   Test: resolved(stage, { actionState }).
    //   Observable result: false.
    //   Expected-value source: the design table's `dismiss` row, negated.
    it('resolves dismiss false when the action is still staged', () => {
      const s = stageFixture({ name: 'dismiss', phase: 'running', at: 0 });
      expect(stage.resolved(s, { actionState: 'staged' })).toBe(false);
    });
  });

  describe('advance(stage, seen, now)', () => {
    // Criterion "advance moves running to done when resolved" (design C11
    // "running plus resolved gives done"; task 10 Success; Requirement
    // 9.3's "then done").
    //   Pre-condition: a running redrive stage; a run that resolves
    //   `redrive` true (not stalled).
    //   Test: advance(stage, seen, now).
    //   Observable result: a stage with phase 'done'.
    //   Expected-value source: the literal "running plus resolved gives
    //   done" clause.
    it('moves a resolved running stage to done', () => {
      const s = stageFixture({ name: 'redrive', phase: 'running', at: 1000 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: true });
      const result = stage.advance(s, { run, waits: [] }, 1500);
      expect(result).toMatchObject({ name: 'redrive', phase: 'done' });
    });

    // Criterion "a confirm resolving as refused ... gives failed with the
    // outcome detail" (design C11 "except a confirm that resolves as
    // refused or failed, which gives failed with the outcome detail"; task
    // 10 Success).
    //   Pre-condition: a running confirm stage; `actionState: 'refused'`
    //   with a detail string.
    //   Test: advance(stage, seen, now).
    //   Observable result: phase 'failed'; reason equal to the detail.
    //   Expected-value source: the literal "failed with the outcome
    //   detail" clause.
    it('fails a running confirm that resolves as refused, with the outcome detail as reason', () => {
      const s = stageFixture({ name: 'confirm', phase: 'running', at: 1000 });
      const result = stage.advance(s, { actionState: 'refused', actionDetail: 'declined by operator' }, 1500);
      expect(result).toMatchObject({ phase: 'failed', reason: 'declined by operator' });
    });

    // Criterion "a confirm resolving as ... failed gives failed with the
    // outcome detail" (same citations).
    //   Pre-condition: the same stage; `actionState: 'failed'` with a
    //   detail string.
    //   Test: advance(stage, seen, now).
    //   Observable result: phase 'failed'; reason equal to the detail.
    //   Expected-value source: the literal "failed with the outcome
    //   detail" clause.
    it('fails a running confirm that resolves as failed, with the outcome detail as reason', () => {
      const s = stageFixture({ name: 'confirm', phase: 'running', at: 1000 });
      const result = stage.advance(s, { actionState: 'failed', actionDetail: 'executor threw' }, 1500);
      expect(result).toMatchObject({ phase: 'failed', reason: 'executor threw' });
    });

    // Criterion "running at 30,000 ms gives failed with 'no change seen in
    // 30 s'" (design C11 "running older than 30,000 ms gives failed with
    // 'no change seen in 30 s'"; D20; task 10 Success).
    //   Pre-condition: a running redrive stage at `at: 0`, still unresolved
    //   (stalled), now 30,000 ms later.
    //   Test: advance(stage, seen, now).
    //   Observable result: phase 'failed'; reason 'no change seen in 30 s'.
    //   Expected-value source: the literal message string, D20.
    it('fails an unresolved running stage at exactly 30,000 ms with the timeout message', () => {
      const s = stageFixture({ name: 'redrive', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: false });
      const result = stage.advance(s, { run, waits: [] }, 30000);
      expect(result).toMatchObject({ phase: 'failed', reason: 'no change seen in 30 s' });
    });

    // Criterion "... and at 29,999 stays" (same citations).
    //   Pre-condition: the same stage, same unresolved seen, now 29,999 ms
    //   after `at`.
    //   Test: advance(stage, seen, now).
    //   Observable result: a non-null stage still at phase 'running'.
    //   Expected-value source: the literal "at 29,999 stays" clause.
    it('leaves an unresolved running stage running at 29,999 ms', () => {
      const s = stageFixture({ name: 'redrive', phase: 'running', at: 0 });
      const run = ctrlRunFixture({ id: 'r1', status: 'running', driven: false });
      const result = stage.advance(s, { run, waits: [] }, 29999);
      expect(result?.phase).toBe('running');
    });

    // Criterion "done at 5,000 ms gives null" (design C11 "done older than
    // 5,000 ms gives null"; task 10 Success; Requirement 9.3's "clear
    // after 5 s").
    //   Pre-condition: a done stage at `at: 0`, now 5,000 ms later.
    //   Test: advance(stage, seen, now).
    //   Observable result: null.
    //   Expected-value source: the literal "gives null" clause.
    it('clears a done stage at exactly 5,000 ms', () => {
      const s = stageFixture({ name: 'pause', phase: 'done', at: 0 });
      expect(stage.advance(s, {}, 5000)).toBeNull();
    });

    // Criterion "... and at 4,999 stays" (same citations).
    //   Pre-condition: the same done stage, now 4,999 ms later.
    //   Test: advance(stage, seen, now).
    //   Observable result: a non-null stage still at phase 'done'.
    //   Expected-value source: the literal "at 4,999 stays" clause.
    it('keeps a done stage done at 4,999 ms', () => {
      const s = stageFixture({ name: 'pause', phase: 'done', at: 0 });
      expect(stage.advance(s, {}, 4999)?.phase).toBe('done');
    });

    // Criterion "failed stays at any age" (design C11 "failed stays until
    // the next press on that key or until the tile leaves"; task 10
    // Success; Requirement 9.4).
    //   Pre-condition: a failed stage at `at: 0`, now far in the future.
    //   Test: advance(stage, seen, now).
    //   Observable result: a non-null stage still at phase 'failed'.
    //   Expected-value source: the literal "failed stays at any age"
    //   clause.
    it('leaves a failed stage failed at any age', () => {
      const s = stageFixture({ name: 'pause', phase: 'failed', at: 0, reason: 'boom' });
      expect(stage.advance(s, {}, 10_000_000)?.phase).toBe('failed');
    });
  });
});
