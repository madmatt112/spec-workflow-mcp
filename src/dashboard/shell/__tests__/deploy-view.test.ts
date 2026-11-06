import { describe, it, expect, beforeAll } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Contract for dashboard-deploy task 12 (design C9 "Dashboard control", C10
// "Reconnect"; Requirements 4.12, 6.2, 6.4, 6.5, 6.8).
//
// `deploy.ts`, `pause.ts` and `retry-delay.ts` live under
// `src/dashboard_frontend/`, which the root `tsconfig.json` excludes
// (`:20`) and `vitest.config.ts` excludes from the run (`:9`). A static
// `import` of one of them from this file (under `src/dashboard`, which IS
// in the root program) pulls the frontend file into that program and fails
// `npx tsc --noEmit` with TS2835, because the frontend has no tsconfig of
// its own to resolve against. Each module is instead loaded at runtime with
// `await import(pathToFileURL(...).href)`, a computed specifier TypeScript
// does not try to resolve statically, and cast to a hand-written type below
// (task 12 _Prompt; probe recorded 2026-11-05, tasks D28).
//
// Fold note (recorded here, not as a separate red test): the task's own Note
// line marks every other `pauseNote`/`isOperatorHeld` outcome — the
// "paused by you", "pause requested" and plain waiting/paused branches with
// no deploy hold — as holding at base already. The two
// "regression guard" tests at the bottom of the pause.ts suite below cover
// the branches holdBy leaves untouched (absent, and explicit 'operator');
// they are expected to pass on the first run, not fail.

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = join(HERE, '..', '..', '..', 'dashboard_frontend', 'src', 'modules');

type DeployStage = 'wait' | 'build' | 'smoke' | 'gate' | 'swap' | 'restart' | 'done' | 'failed';

type RunStatus =
  | 'queued' | 'running' | 'merging' | 'paused' | 'waiting' | 'done' | 'abandoned' | 'error';

interface RunFixture {
  id: string;
  project: string;
  spec: string;
  status: RunStatus;
  tokens: number;
  created: string;
  updated: string;
  driven: boolean;
  pauseReason?: string;
  pauseRequested?: string;
  pausedAt?: string;
  resumeAt?: string;
  holdBy?: 'operator' | 'deploy';
}

type DeployModule = {
  DEPLOY_STAGES: readonly DeployStage[];
  isDeployOpen: (stage: DeployStage) => boolean;
  canCancel: (stage: DeployStage) => boolean;
  deployHoldCount: (runs: RunFixture[]) => number;
  deployRetryCap: (stage?: DeployStage) => number | null;
};

type PauseModule = {
  isOperatorHeld: (run: RunFixture) => boolean;
  pauseNote: (run: RunFixture, now: number) => { text: string; overdue: boolean } | null;
};

type RetryDelayModule = {
  retryDelayFor: (delay: number, cap: number | null) => number;
};

const T0 = '2026-01-01T00:00:00.000Z';
const NOW = Date.parse('2026-11-05T12:00:00.000Z');

function runFixture(overrides: Partial<RunFixture> & { id: string; status: RunStatus }): RunFixture {
  return {
    project: 'p1',
    spec: 's1',
    tokens: 0,
    created: T0,
    updated: T0,
    driven: false,
    ...overrides,
  };
}

describe('deploy.ts (src/dashboard_frontend/src/modules/shell/deploy.ts)', () => {
  let deploy: DeployModule;

  beforeAll(async () => {
    deploy = (await import(pathToFileURL(join(FE, 'shell', 'deploy.ts')).href)) as DeployModule;
  });

  // Criterion "DEPLOY_STAGES is the seven stages in order" (design C9
  // "src/dashboard_frontend/.../deploy.ts (new, pure, type-only imports):
  // DEPLOY_STAGES ..."; task 12 Success "DEPLOY_STAGES is the seven stages
  // in order"; Requirement 6.2 "a stage strip SHALL show wait, build,
  // smoke, gate, swap, restart and done").
  //   Pre-condition: none; the constant is static.
  //   Test: read `deploy.DEPLOY_STAGES`.
  //   Observable result: deep-equals ['wait','build','smoke','gate','swap',
  //   'restart','done'], in that order.
  //   Expected-value source: the literal stage list of Requirement 6 AC2.
  it('orders the seven stages wait, build, smoke, gate, swap, restart, done', () => {
    expect(deploy.DEPLOY_STAGES).toEqual(['wait', 'build', 'smoke', 'gate', 'swap', 'restart', 'done']);
  });

  // Criterion "isDeployOpen is false for done and failed" (task 12 Success
  // "isDeployOpen is false for done and failed ... (requirement 6 AC 5)" —
  // read together with design C9's isDeployOpen; Requirement 4.3/4.4's
  // closed-stage behaviour).
  //   Pre-condition: none.
  //   Test: isDeployOpen('done'), isDeployOpen('failed').
  //   Observable result: both false.
  //   Expected-value source: the task Success line's "false for done and
  //   failed" clause.
  it('is false for the two closed stages, done and failed', () => {
    expect(deploy.isDeployOpen('done')).toBe(false);
    expect(deploy.isDeployOpen('failed')).toBe(false);
  });

  // Criterion "isDeployOpen is true for the six others" (task 12 Success
  // "and true for the six others").
  //   Pre-condition: none.
  //   Test: isDeployOpen(stage) for each of wait, build, smoke, gate, swap,
  //   restart.
  //   Observable result: true for every one.
  //   Expected-value source: the task Success line's "true for the six
  //   others" clause (8 total stages minus done and failed).
  it('is true for the six stages before done or failed', () => {
    for (const stage of ['wait', 'build', 'smoke', 'gate', 'swap', 'restart'] as const) {
      expect(deploy.isDeployOpen(stage)).toBe(true);
    }
  });

  // Criterion "canCancel is true for wait, build, smoke and gate" (design
  // C9 "canCancel(stage) (true for wait, build, smoke, gate)"; Requirement
  // 6.5 "WHILE the record is at wait, build, smoke or gate THEN the strip
  // SHALL offer Cancel and resume now").
  //   Pre-condition: none.
  //   Test: canCancel(stage) for each of wait, build, smoke, gate.
  //   Observable result: true for every one.
  //   Expected-value source: the literal stage list of Requirement 6 AC5's
  //   first sentence.
  it('allows cancel at wait, build, smoke and gate', () => {
    for (const stage of ['wait', 'build', 'smoke', 'gate'] as const) {
      expect(deploy.canCancel(stage)).toBe(true);
    }
  });

  // Criterion "canCancel is false for swap, restart, done and failed" (task
  // 12 Success "false for swap, restart, done and failed (requirement 6 AC
  // 5)"; Requirement 6.5 "and from swap on it SHALL not").
  //   Pre-condition: none.
  //   Test: canCancel(stage) for each of swap, restart, done, failed.
  //   Observable result: false for every one.
  //   Expected-value source: the task Success line's "false for swap,
  //   restart, done and failed" clause.
  it('disallows cancel from swap onward: swap, restart, done, failed', () => {
    for (const stage of ['swap', 'restart', 'done', 'failed'] as const) {
      expect(deploy.canCancel(stage)).toBe(false);
    }
  });

  // Criterion "deployHoldCount counts each of the five live statuses with
  // no pauseRequested, and skips a held and a done run" (design C9
  // "deployHoldCount(runs) (status in the five live statuses and
  // pauseRequested undefined)"; task 12 Success; Requirement 6.1 "a confirm
  // SHALL state how many runs will be held", fed by D1's "every live run
  // with no operator hold").
  //   Pre-condition: one run for each of the five live statuses (queued,
  //   running, merging, paused, waiting) with no pauseRequested, plus one
  //   already-held run (paused, pauseRequested set) and one done run.
  //   Test: deployHoldCount(runs).
  //   Observable result: 5 — the held and done rows are excluded.
  //   Expected-value source: the five-status, no-pauseRequested rule of
  //   design C9's `deployHoldCount` sentence, cross-checked against
  //   `NOW_LIVE_STATUSES`/`CTRL_LIVE_STATUSES` (queued, running, merging,
  //   paused, waiting — src/dashboard/shell/sidebar-rows.ts:9).
  it('counts a run for each of the five live statuses with no pauseRequested, skipping a held run and a done run', () => {
    const runs: RunFixture[] = [
      runFixture({ id: 'r1', status: 'queued' }),
      runFixture({ id: 'r2', status: 'running' }),
      runFixture({ id: 'r3', status: 'merging' }),
      runFixture({ id: 'r4', status: 'paused' }),
      runFixture({ id: 'r5', status: 'waiting' }),
      runFixture({ id: 'r6', status: 'paused', pauseRequested: T0, holdBy: 'operator' }),
      runFixture({ id: 'r7', status: 'done' }),
    ];
    expect(deploy.deployHoldCount(runs)).toBe(5);
  });

  // Criterion "deployRetryCap is 2000 at swap and restart" (design C9
  // "deployRetryCap(stage) (2000 at swap or restart, else null)"; task 12
  // Success "requirement 6 AC 8" — the retry cap feeding the 2-second
  // reconnect floor of R6 AC8).
  //   Pre-condition: none.
  //   Test: deployRetryCap('swap'), deployRetryCap('restart').
  //   Observable result: both 2000.
  //   Expected-value source: the literal "2000 at swap or restart" clause.
  it('caps the retry at 2000ms during swap and restart', () => {
    expect(deploy.deployRetryCap('swap')).toBe(2000);
    expect(deploy.deployRetryCap('restart')).toBe(2000);
  });

  // Criterion "deployRetryCap is null otherwise" (task 12 Success "and
  // null otherwise").
  //   Pre-condition: none.
  //   Test: deployRetryCap(stage) for each stage other than swap/restart.
  //   Observable result: null for every one.
  //   Expected-value source: the literal "else null" clause of design C9's
  //   `deployRetryCap` sentence.
  it('has no cap at any stage other than swap or restart', () => {
    for (const stage of ['wait', 'build', 'smoke', 'gate', 'done', 'failed'] as const) {
      expect(deploy.deployRetryCap(stage)).toBeNull();
    }
  });

  // Criterion "deployRetryCap is null with no stage" (task 12 Success "and
  // null with no stage (AC 8)").
  //   Pre-condition: none.
  //   Test: deployRetryCap(undefined) — the call ShellProvider makes when
  //   `controllerDeploy` is null.
  //   Observable result: null.
  //   Expected-value source: the task Success line's explicit "null with
  //   no stage" clause, named separately from the "else null" clause.
  it('has no cap with no stage', () => {
    expect(deploy.deployRetryCap(undefined)).toBeNull();
  });
});

describe('retry-delay.ts (src/dashboard_frontend/src/modules/ws/retry-delay.ts)', () => {
  let retryDelay: RetryDelayModule;

  beforeAll(async () => {
    retryDelay = (await import(pathToFileURL(join(FE, 'ws', 'retry-delay.ts')).href)) as RetryDelayModule;
  });

  // Criterion "retryDelayFor returns the delay with a null cap" (design C10
  // "New retry-delay.ts: retryDelayFor(delay, cap)"; task 12 Success;
  // Requirement 6.8's reconnect timing, uncapped outside swap/restart).
  //   Pre-condition: a null cap (no open deploy record at swap/restart).
  //   Test: retryDelayFor(5000, null).
  //   Observable result: 5000, the delay unchanged.
  //   Expected-value source: the task Success line's "the delay with a
  //   null cap" clause.
  it('returns the delay unchanged when the cap is null', () => {
    expect(retryDelay.retryDelayFor(5000, null)).toBe(5000);
  });

  // Criterion "retryDelayFor returns the cap when the delay is larger"
  // (task 12 Success "the cap when the delay is larger"; Requirement 6.8
  // "the strip SHALL ... reconnect within 10 seconds", which needs the
  // backoff capped once it would otherwise exceed the cap).
  //   Pre-condition: a 2000ms cap and a 9000ms computed backoff delay.
  //   Test: retryDelayFor(9000, 2000).
  //   Observable result: 2000, not 9000.
  //   Expected-value source: the task Success line's "the cap when the
  //   delay is larger" clause.
  it('returns the cap when the delay is larger than it', () => {
    expect(retryDelay.retryDelayFor(9000, 2000)).toBe(2000);
  });

  // Criterion "retryDelayFor returns the delay when it is smaller" (task 12
  // Success "and the delay when it is smaller").
  //   Pre-condition: a 2000ms cap and a 1000ms computed backoff delay.
  //   Test: retryDelayFor(1000, 2000).
  //   Observable result: 1000, not 2000.
  //   Expected-value source: the task Success line's "the delay when it is
  //   smaller" clause.
  it('returns the delay when it is smaller than the cap', () => {
    expect(retryDelay.retryDelayFor(1000, 2000)).toBe(1000);
  });
});

describe('pause.ts deploy hold (src/dashboard_frontend/src/modules/shell/pause.ts)', () => {
  let pause: PauseModule;

  beforeAll(async () => {
    pause = (await import(pathToFileURL(join(FE, 'shell', 'pause.ts')).href)) as PauseModule;
  });

  // Criterion "pauseNote on a deploy-held run reads 'held for deploy' for
  // paused, waiting and running, and isOperatorHeld is false for each"
  // (design C9 "isOperatorHeld is false when holdBy === 'deploy'.
  // pauseNote returns { text: 'held for deploy', overdue: false } as its
  // first branch"; task 12 Success "(AC 4)"; Requirement 6.4 "its rows ...
  // SHALL read 'held for deploy' ... isOperatorHeld SHALL be false").
  //   Pre-condition: a run with holdBy: 'deploy' and pauseRequested set
  //   (the deploy hold's own write, src/controller/deploy.ts:264), at each
  //   of the three statuses a held run can carry: paused, waiting, running.
  //   Test: pauseNote(run, now) and isOperatorHeld(run).
  //   Observable result: pauseNote returns { text: 'held for deploy',
  //   overdue: false } and isOperatorHeld returns false, for every status.
  //   Expected-value source: the literal "held for deploy" text and
  //   "isOperatorHeld SHALL be false" of Requirement 6 AC4, taking priority
  //   over the pauseReason/status branches pause.ts already has.
  it.each(['paused', 'waiting', 'running'] as const)(
    'reads "held for deploy" and is not operator-held for a %s run under a deploy hold',
    (status) => {
      const run = runFixture({ id: 'r1', status, pauseRequested: T0, holdBy: 'deploy' });
      expect(pause.pauseNote(run, NOW)).toEqual({ text: 'held for deploy', overdue: false });
      expect(pause.isOperatorHeld(run)).toBe(false);
    },
  );

  // Regression guard (task 12 Note: "the other pauseNote and isOperatorHeld
  // outcomes hold at base: regression guards"). Not a red test: this
  // branch (pauseReason === 'operator', no holdBy field at all) is
  // unmodified by this task and already passes at base
  // (src/dashboard_frontend/src/modules/shell/pause.ts:27-36).
  //   Pre-condition: a paused run held by the operator (pauseReason:
  //   'operator', pausedAt 5m before `now`), with holdBy absent.
  //   Test: pauseNote(run, now) and isOperatorHeld(run).
  //   Observable result: pauseNote's text is 'paused by you 5m 0s' and
  //   isOperatorHeld is true — unchanged by the deploy-hold branch.
  //   Expected-value source: `fmtSpan`/`pauseNote`'s existing operator
  //   branch (pause.ts:33-36), read live.
  it('keeps the operator-pause note and isOperatorHeld=true when holdBy is absent (regression guard)', () => {
    const since = new Date(NOW - 5 * 60 * 1000).toISOString();
    const run = runFixture({ id: 'r1', status: 'paused', pauseReason: 'operator', pausedAt: since });
    expect(pause.pauseNote(run, NOW)).toEqual({ text: 'paused by you 5m 0s', overdue: false });
    expect(pause.isOperatorHeld(run)).toBe(true);
  });

  // Regression guard (task 12 Note, same as above). Not a red test: an
  // explicit holdBy: 'operator' takes the same branch as holdBy absent
  // (R4 AC1: "A pauseRequested with no holdBy SHALL read as operator"),
  // so pause.ts's unmodified operator branch already covers it.
  //   Pre-condition: the same operator-paused run, with holdBy explicitly
  //   set to 'operator'.
  //   Test: pauseNote(run, now) and isOperatorHeld(run).
  //   Observable result: the same 'paused by you 5m 0s' / true pair.
  //   Expected-value source: `pauseNote`/`isOperatorHeld`'s existing
  //   operator branch, read live; the deploy-hold branch only guards
  //   holdBy === 'deploy', so 'operator' falls through unchanged.
  it('keeps the operator-pause note and isOperatorHeld=true when holdBy is "operator" (regression guard)', () => {
    const since = new Date(NOW - 5 * 60 * 1000).toISOString();
    const run = runFixture({
      id: 'r1', status: 'paused', pauseReason: 'operator', pausedAt: since, holdBy: 'operator',
    });
    expect(pause.pauseNote(run, NOW)).toEqual({ text: 'paused by you 5m 0s', overdue: false });
    expect(pause.isOperatorHeld(run)).toBe(true);
  });
});
