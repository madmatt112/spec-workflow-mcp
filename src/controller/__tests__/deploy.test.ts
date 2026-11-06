import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  deployRecordPath,
  readDeployRecord,
  isDeployOpen,
  readDeployForWireSync,
  deployUnitArgs,
  systemdDeployUnit,
  DeployCoordinator,
  deployEvents,
  type DeployRecord,
  type DeployDeps,
  type DeployUnit,
  type UnitState,
} from '../deploy.js';
import { writeRun, readRun, controllerHome, type RunRecord } from '../state.js';
import { runEvents } from '../runs.js';

// Contract for design C1 (deployRecordPath, readDeployRecord, isDeployOpen,
// readDeployForWireSync) and C5 (deployUnitArgs, systemdDeployUnit). No
// DeployCoordinator exists yet (a later task), so every call here goes
// straight through the exported function — no caller to mock.
//
// Per success criterion (task 2 _Prompt Success line):
// - `deployRecordPath` is `deploy.json` under the controller home. Pre: a temp
//   SDD_HOME. Call: `deployRecordPath()`. Result: `join(home, 'deploy.json')`.
//   Source: design C1 interface line ("`join(controllerHome(), 'deploy.json')`").
// - `readDeployRecord` is `undefined` for a missing file, `undefined` for an
//   unparsable file, and the record for a valid one. Pre: temp SDD_HOME, no
//   file / a garbage file / a valid JSON file at `deployRecordPath()`. Call:
//   `readDeployRecord()`. Result: `undefined` / `undefined` / the parsed
//   record. Source: design C1 interface line ("a missing or unparsable file is
//   `undefined`").
// - `isDeployOpen` is true for `wait`, `build`, `smoke`, `gate`, `swap` and
//   `restart`, false for `done` and `failed`. Pre: none. Call:
//   `isDeployOpen(record)` with each stage. Result: true / false per stage.
//   Source: design C1 interface line ("true when `stage` is neither `done`
//   nor `failed`").
// - `readDeployForWireSync` is `null` with no file, and a form with no `v` and
//   no `unitStarted` otherwise. Pre: temp SDD_HOME, no file / a valid record
//   file with `unitStarted: true`. Call: `readDeployForWireSync()`. Result:
//   `null` / the record minus `v` and `unitStarted`. Source: design Data
//   Models ("`type ControllerDeploy = Omit<DeployRecord, 'v' | 'unitStarted'>`").
// - `deployUnitArgs` holds each element design C5 lists and ends with the
//   script path, `--deploy-record` and the path; with an `env` holding a
//   token value, no argv element contains that value. Pre: none. Call:
//   `deployUnitArgs(opts)`. Result: the argv contains every listed flag, the
//   last three elements are the script path / `--deploy-record` / the record
//   path, and no element contains the token string. Source: design C5
//   "`deployUnitArgs` post-condition" bullet list; requirement 1 AC5; NFR
//   Security.
// - `systemdDeployUnit().state()` is `live` for `active`/`activating`/
//   `deactivating`/`reloading`, `gone` for `inactive`/`failed` on exit 0,
//   `unknown` on a non-zero exit, and `unknown` when the stub hangs past 5
//   seconds. Pre: a stub `systemctl` first on `PATH`. Call: `state()`. Result:
//   per design C5 "`state()`" bullet.
// - `systemdDeployUnit().stop()` resolves on exit 0 and exit 5, rejects on
//   another exit. Pre: a stub `systemctl` first on `PATH`. Call: `stop()`.
//   Result: per design C5 "`stop()`" bullet.
// - `systemdDeployUnit().start()` resolves on exit 0, rejects on exit 1 with
//   the code and without the stderr text (the stderr goes only to
//   `console.error`). Pre: a stub `systemd-run` first on `PATH`. Call:
//   `start(recordPath)`. Result: per design C5 illustrative interface
//   ("rejects with the exit code") and task 2 Restrictions/_Prompt text
//   ("sends the raw stderr only to `console.error`").

let home: string;
let prevHome: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'deploy-home-'));
  prevHome = process.env.SDD_HOME;
  process.env.SDD_HOME = home;
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.SDD_HOME; else process.env.SDD_HOME = prevHome;
  rmSync(home, { recursive: true, force: true });
});

describe('deployRecordPath', () => {
  it('is deploy.json under the controller home', () => {
    expect(deployRecordPath()).toBe(join(home, 'deploy.json'));
  });
});

describe('readDeployRecord', () => {
  it('returns undefined for a missing file', async () => {
    expect(await readDeployRecord()).toBeUndefined();
  });

  it('returns undefined for an unparsable file', async () => {
    writeFileSync(deployRecordPath(), '{ not json ][');
    expect(await readDeployRecord()).toBeUndefined();
  });

  it('returns the record for a valid file', async () => {
    const record: DeployRecord = {
      v: 1, stage: 'build', runs: ['run-a', 'run-b'], started: '2026-11-05T00:00:00.000Z',
    };
    writeFileSync(deployRecordPath(), JSON.stringify(record));
    expect(await readDeployRecord()).toEqual(record);
  });
});

describe('isDeployOpen', () => {
  it.each(['wait', 'build', 'smoke', 'gate', 'swap', 'restart'] as const)(
    'is true for stage %s',
    (stage) => {
      const record = { v: 1, stage, runs: [], started: '2026-11-05T00:00:00.000Z' } as DeployRecord;
      expect(isDeployOpen(record)).toBe(true);
    },
  );

  it.each(['done', 'failed'] as const)('is false for stage %s', (stage) => {
    const record = { v: 1, stage, runs: [], started: '2026-11-05T00:00:00.000Z' } as DeployRecord;
    expect(isDeployOpen(record)).toBe(false);
  });
});

describe('readDeployForWireSync', () => {
  it('returns null with no file', () => {
    expect(readDeployForWireSync()).toBeNull();
  });

  it('returns a form with no v and no unitStarted otherwise', () => {
    const record: DeployRecord = {
      v: 1, stage: 'build', runs: ['run-a'], started: '2026-11-05T00:00:00.000Z',
      unitStarted: true, commit: 'abc123',
    };
    writeFileSync(deployRecordPath(), JSON.stringify(record));

    const wire = readDeployForWireSync();

    expect(wire).not.toBeNull();
    expect(wire).not.toHaveProperty('v');
    expect(wire).not.toHaveProperty('unitStarted');
    expect(wire).toEqual({ stage: 'build', runs: ['run-a'], started: '2026-11-05T00:00:00.000Z', commit: 'abc123' });
  });
});

describe('deployUnitArgs', () => {
  const opts = {
    checkoutRoot: '/repo/checkout',
    recordPath: '/home/op/.local/state/sdd/deploy.json',
    home: '/home/op/.local/state/sdd',
    env: {
      PATH: '/usr/local/bin:/usr/bin:/bin',
      HOME: '/home/op',
      ANTHROPIC_API_KEY: 'super-secret-token-value',
    },
  };
  const args = deployUnitArgs(opts);

  it('holds each element design C5 lists', () => {
    const joined = args.join(' ');
    expect(joined).toContain('--user');
    expect(joined).toContain('--unit=sdd-deploy');
    expect(joined).toContain('--collect');
    expect(joined).toContain('--quiet');
    expect(joined).toContain('--working-directory=/repo/checkout');
    expect(joined).toContain('--setenv=PATH=/usr/local/bin:/usr/bin:/bin');
    expect(joined).toContain('--setenv=HOME=/home/op');
    expect(joined).toContain('--setenv=SDD_HOME=/home/op/.local/state/sdd');
    expect(joined).toContain('-p EnvironmentFile=-/home/op/.local/state/sdd/service.env');
    expect(joined).toContain('-p UnsetEnvironment=ANTHROPIC_API_KEY');
    expect(joined).toContain('-p UnsetEnvironment=ANTHROPIC_AUTH_TOKEN');
    expect(joined).toContain('-p TimeoutStopSec=15');
  });

  it('ends with the script path, --deploy-record and the record path', () => {
    expect(args.slice(-3)).toEqual([
      '/repo/checkout/scripts/sdd-self-update.sh',
      '--deploy-record',
      '/home/op/.local/state/sdd/deploy.json',
    ]);
  });

  it('carries no argv element containing the token value in env', () => {
    for (const element of args) {
      expect(element).not.toContain('super-secret-token-value');
    }
  });
});

describe('systemdDeployUnit', () => {
  let stubDir: string;
  let prevPath: string | undefined;

  beforeEach(() => {
    stubDir = mkdtempSync(join(tmpdir(), 'deploy-stub-'));
    writeFileSync(
      join(stubDir, 'systemctl'),
      '#!/bin/bash\n' +
        'if [ -n "${STUB_SYSTEMCTL_SLEEP:-}" ]; then sleep "$STUB_SYSTEMCTL_SLEEP"; fi\n' +
        'printf \'%s\' "${STUB_SYSTEMCTL_STDOUT:-}"\n' +
        'exit "${STUB_SYSTEMCTL_EXIT:-0}"\n',
    );
    chmodSync(join(stubDir, 'systemctl'), 0o755);
    writeFileSync(
      join(stubDir, 'systemd-run'),
      '#!/bin/bash\n' +
        'if [ -n "${STUB_SYSTEMD_RUN_STDERR:-}" ]; then printf \'%s\' "$STUB_SYSTEMD_RUN_STDERR" >&2; fi\n' +
        'exit "${STUB_SYSTEMD_RUN_EXIT:-0}"\n',
    );
    chmodSync(join(stubDir, 'systemd-run'), 0o755);
    prevPath = process.env.PATH;
    process.env.PATH = `${stubDir}:${prevPath ?? ''}`;
  });

  afterEach(() => {
    if (prevPath === undefined) delete process.env.PATH; else process.env.PATH = prevPath;
    rmSync(stubDir, { recursive: true, force: true });
    delete process.env.STUB_SYSTEMCTL_EXIT;
    delete process.env.STUB_SYSTEMCTL_STDOUT;
    delete process.env.STUB_SYSTEMCTL_SLEEP;
    delete process.env.STUB_SYSTEMD_RUN_EXIT;
    delete process.env.STUB_SYSTEMD_RUN_STDERR;
  });

  describe('state()', () => {
    it.each(['active', 'activating', 'deactivating', 'reloading'])(
      'is live for ActiveState %s',
      async (value) => {
        process.env.STUB_SYSTEMCTL_STDOUT = value;
        expect(await systemdDeployUnit().state()).toBe('live');
      },
    );

    it.each(['inactive', 'failed'])('is gone for ActiveState %s on exit 0', async (value) => {
      process.env.STUB_SYSTEMCTL_STDOUT = value;
      expect(await systemdDeployUnit().state()).toBe('gone');
    });

    it('is unknown on a non-zero exit', async () => {
      process.env.STUB_SYSTEMCTL_EXIT = '1';
      expect(await systemdDeployUnit().state()).toBe('unknown');
    });

    it('is unknown when the stub hangs past 5 seconds', async () => {
      process.env.STUB_SYSTEMCTL_SLEEP = '8';
      expect(await systemdDeployUnit().state()).toBe('unknown');
    }, 10000);
  });

  describe('stop()', () => {
    it('resolves on exit 0', async () => {
      process.env.STUB_SYSTEMCTL_EXIT = '0';
      await expect(systemdDeployUnit().stop()).resolves.toBeUndefined();
    });

    it('resolves on exit 5', async () => {
      process.env.STUB_SYSTEMCTL_EXIT = '5';
      await expect(systemdDeployUnit().stop()).resolves.toBeUndefined();
    });

    it('rejects on another exit code', async () => {
      process.env.STUB_SYSTEMCTL_EXIT = '3';
      await expect(systemdDeployUnit().stop()).rejects.toBeTruthy();
    });
  });

  describe('start()', () => {
    it('resolves on exit 0', async () => {
      process.env.STUB_SYSTEMD_RUN_EXIT = '0';
      await expect(systemdDeployUnit().start('/home/op/.local/state/sdd/deploy.json')).resolves.toBeUndefined();
    });

    it('rejects on exit 1 with the code and without the stderr text', async () => {
      const stderrText = 'stderr-marker-/should/not/leak/into/the/rejection';
      process.env.STUB_SYSTEMD_RUN_EXIT = '1';
      process.env.STUB_SYSTEMD_RUN_STDERR = stderrText;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let caught: unknown;
      try {
        await systemdDeployUnit().start('/home/op/.local/state/sdd/deploy.json');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeDefined();
      const message = String((caught as { message?: unknown })?.message ?? caught);
      expect((caught as { code?: unknown })?.code).toBe(1);
      expect(message).not.toContain(stderrText);
      expect(errorSpy.mock.calls.some((call) => call.some((arg) => String(arg).includes(stderrText)))).toBe(true);

      errorSpy.mockRestore();
    });
  });
});

// ---------------------------------------------------------------------------
// Task 3 — DeployCoordinator: lock, press, release and tick (design C1
// "Deploy lock", "press" post-conditions, "tick" table, "Starting the unit",
// "Release", "Failed and `done` writes"). `onStart` and `cancel` are task 4,
// so every call below reaches the coordinator only through `press()`,
// `tick()` and `withLock()`. `writeRun`/`readRun` (state.ts) and `runEvents`
// (runs.ts) are the real implementations — never mocked; only `DeployUnit`
// and the rest of `DeployDeps` (`isQuiet`, `resumeIfAnswered`, `schedule`,
// `now`, `waitLimitMs`) are the fakes the design names as the coordinator's
// seam.
//
// Per success criterion (task 3 _Prompt Success line), grouped by clause:
// - Press with no record writes `v: 1`, stage `wait`, `runs` and `started`
//   with no `error`, and answers ok (requirement 1 AC1). Pre: no record, no
//   runs. Call: `press()`. Result: `{ ok: true }`; the record has those
//   fields. Source: design C1 "press" step 5; requirement 1 AC1.
// - It holds a run of each holdable status with `holdBy: 'deploy'`,
//   `pauseRequested` set and status unchanged (AC2), each tested; and lists
//   exactly those ids. Pre: one run per status / five runs plus a `done`
//   distractor. Call: `press()`. Result: per-run fields; `runs` equals the
//   five ids. Source: design C1 "press" step 6; requirement 1 AC2.
// - An operator-held run (`holdBy` `operator` or absent, `pauseRequested`
//   set) stays unchanged and unlisted (AC3). Pre: such a run. Call:
//   `press()`. Result: the run is untouched; its id is absent from `runs`.
//   Source: requirement 1 AC3.
// - The record is on disk before the first hold. Pre: one holdable run whose
//   directory cannot accept a new write. Call: `press()` (rejection
//   expected). Result: the record still exists with `stage: 'wait'` and that
//   run's id in `runs`. Source: design C1 "press" step 5 ("before any hold,
//   so a crash still lists the holds to re-apply").
// - Press removes a leftover claim. Pre: a `.claim` directory beside the
//   record path. Call: `press()`. Result: the claim directory is gone.
//   Source: design C1 "press" step 3.
// - An open record gives `deploy-open` with its stage (AC8). Pre: a record at
//   `build`. Call: `press()`. Result: `{ ok: false, error: 'deploy-open',
//   stage: 'build' }`. Source: requirement 1 AC8.
// - A live unit with a finished (`done`/`failed`) record gives `deploy-open`
//   with that stage, and with no record gives stage `unit` (D19). Pre: a
//   finished record, or none; `unit.state()` resolves `live`. Call:
//   `press()`. Result: `deploy-open` with the finished stage, or `'unit'`.
//   Source: design C1 "press" step 2; D19.
// - Two presses together give one record and one `deploy-open` (AC9). Pre:
//   one holdable run. Call: `Promise.all([press(), press()])` on one
//   coordinator. Result: one `{ ok: true }`, one `deploy-open` at `wait`; one
//   record. Source: requirement 1 AC9.
// - A `done` and a `failed` record are each replaced (AC10). Pre: a finished
//   record with `commit`/`error` set. Call: `press()`. Result: a fresh
//   record (`stage: 'wait'`, no `error`, no `commit`). Source: requirement 1
//   AC10.
// - `tick` at `wait` when quiet persists `unitStarted: true` before
//   `unit.start` is called, seen by the fake reading the file (AC4). Pre: a
//   record at `wait`, `isQuiet` true. Call: `tick()`. Result: the fake's
//   `start` observes `unitStarted: true` on disk when it runs; the record has
//   it after. Source: design C1 "Starting the unit"; requirement 1 AC4.
// - Not quiet starts nothing; `unitStarted` already true starts nothing.
//   Pre/Call/Result: as named, `unit.start` never called. Source: design C1
//   tick table rows 4/5.
// - A `unit.start` rejection writes `failed` with the fixed exit-code text and
//   releases (AC6). Pre: `start` rejects with `.code`; a held run. Call:
//   `tick()`. Result: `error` is the exact fixed string; the run is
//   released. Source: requirement 1 AC6; design "Failed and done writes".
// - Past `waitLimitMs` it writes `failed` with the fixed 5-hour text (AC7),
//   and the default is 5 hours. Pre: `started` older than the limit. Call:
//   `tick()`. Result: `failed` with that exact text. Source: requirement 1
//   AC7; D14.
// - An open record with the unit `gone` writes `failed` naming the stage and
//   `sdd-deploy.service`, with the `swap`/`restart` suffix at those stages,
//   and releases (requirement 3 AC3); `live` and `unknown` do nothing. Pre: a
//   record open at each non-`wait` stage; a held run. Call: `tick()`.
//   Result: per design C1 "Failed and done writes" third bullet.
// - A `failed` and a `done` record with deploy holds release and keep their
//   stage and `commit` (requirement 3 AC2). Pre: such a record plus a held
//   run. Call: `tick()`. Result: the run is released; the record's stage and
//   `commit` are unchanged. Source: design C1 tick table row 2.
// - An absent record with deploy holds releases (D24), and Release itself:
//   moves a `paused`/`operator` run to `queued` clearing `pauseReason` and
//   `resumeAt`; keeps a usage pause's status/reason/`resumeAt`; calls
//   `resumeIfAnswered` for a `waiting` run with its hold cleared; skips a run
//   whose `holdBy` is now `operator`; emits exactly one `runEvents` `change`
//   and calls `schedule`; a repeat changes nothing (requirement 3 AC6). Pre:
//   runs held `holdBy: 'deploy'` in each state, no deploy record. Call:
//   `tick()` (twice for the repeat). Result: per design C1 "Release".
//   Source: requirement 3 AC6; D24.
// - A held lock makes `tick` return at once with no read and no write. Pre:
//   the lock held via `withLock`. Call: `tick()`. Result: `isQuiet` and
//   `unit.start` never called; the record file's bytes are unchanged. Source:
//   design C1 "Deploy lock" ("`tick` returns at once when it is held", D16).
// - `deployEvents` emits once per wire change and not on an unchanged tick.
//   Pre: a record at `build`, unit `live` (so tick acts on nothing). Call:
//   `tick()` twice. Result: one `change` event total. Source: design C1
//   "tick" ("emits `deployEvents` when the wire form changed"); NFR
//   Performance.

const PRESS_NOW = '2026-11-05T12:00:00.000Z';

function fakeUnit(overrides: Partial<DeployUnit> = {}): DeployUnit {
  return {
    start: vi.fn(async () => {}),
    state: vi.fn(async (): Promise<UnitState> => 'gone'),
    stop: vi.fn(async () => {}),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<DeployDeps> = {}): DeployDeps {
  return {
    now: () => new Date(PRESS_NOW),
    unit: fakeUnit(),
    isQuiet: vi.fn(async () => true),
    resumeIfAnswered: vi.fn(async () => {}),
    schedule: vi.fn(),
    ...overrides,
  } as DeployDeps;
}

function baseRun(id: string, status: RunRecord['status'], extra: Partial<RunRecord> = {}): RunRecord {
  return {
    v: 1, id, project: 'p', codeRoot: '/c', specStore: '/s', spec: 's',
    worktree: '/w', branch: 'b', status, created: '2026-11-01T00:00:00.000Z',
    updated: '2026-11-01T00:00:00.000Z', tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    ...extra,
  } as RunRecord;
}

async function seedRun(id: string, status: RunRecord['status'], extra: Partial<RunRecord> = {}): Promise<void> {
  await writeRun(baseRun(id, status, extra), { ownsPauseRequest: true } as any);
}

async function seedHeldRun(id: string, status: RunRecord['status'], extra: Partial<RunRecord> = {}): Promise<void> {
  await seedRun(id, status, { holdBy: 'deploy', pauseRequested: PRESS_NOW, ...extra });
}

function writeDeployRecordFile(record: DeployRecord): void {
  writeFileSync(deployRecordPath(), JSON.stringify(record));
}

describe('DeployCoordinator.press', () => {
  it('with no record writes v 1, stage wait, runs and started with no error, and answers ok', async () => {
    const coordinator = new DeployCoordinator(makeDeps());

    const result = await coordinator.press();

    expect(result).toEqual({ ok: true });
    const record = await readDeployRecord();
    expect(record?.v).toBe(1);
    expect(record?.stage).toBe('wait');
    expect(record?.runs).toEqual([]);
    expect(record?.started).toBe(PRESS_NOW);
    expect(record?.error).toBeUndefined();
  });

  it.each(['running', 'queued', 'waiting', 'merging', 'paused'] as const)(
    'holds a %s run with holdBy deploy, pauseRequested set, status unchanged',
    async (status) => {
      await seedRun('run-held', status);
      const coordinator = new DeployCoordinator(makeDeps());

      const result = await coordinator.press();

      expect(result).toEqual({ ok: true });
      const run = await readRun('run-held');
      expect(run?.status).toBe(status);
      expect(run?.holdBy).toBe('deploy');
      expect(run?.pauseRequested).toBe(PRESS_NOW);
    },
  );

  it('lists exactly the ids of the runs it held', async () => {
    const held: [string, RunRecord['status']][] = [
      ['run-running', 'running'],
      ['run-queued', 'queued'],
      ['run-waiting', 'waiting'],
      ['run-merging', 'merging'],
      ['run-paused', 'paused'],
    ];
    for (const [id, status] of held) await seedRun(id, status);
    await seedRun('run-untouched', 'done');

    const coordinator = new DeployCoordinator(makeDeps());
    const result = await coordinator.press();

    expect(result).toEqual({ ok: true });
    const record = await readDeployRecord();
    expect([...(record?.runs ?? [])].sort()).toEqual(held.map(([id]) => id).sort());
  });

  it.each(['operator', undefined] as const)(
    'an operator-held run (holdBy %s) stays unchanged and unlisted',
    async (holdBy) => {
      await seedRun('run-operator-held', 'paused', { pauseRequested: '2026-11-04T00:00:00.000Z', holdBy });
      const coordinator = new DeployCoordinator(makeDeps());

      const result = await coordinator.press();

      expect(result).toEqual({ ok: true });
      const run = await readRun('run-operator-held');
      expect(run?.holdBy).toBe(holdBy);
      expect(run?.pauseRequested).toBe('2026-11-04T00:00:00.000Z');
      expect(run?.status).toBe('paused');
      const record = await readDeployRecord();
      expect(record?.runs ?? []).not.toContain('run-operator-held');
    },
  );

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'writes the record to disk before applying the first hold',
    async () => {
      const id = 'run-locked-dir';
      await seedRun(id, 'running');
      const dir = join(controllerHome(), 'runs', id);
      chmodSync(dir, 0o555);
      try {
        await new DeployCoordinator(makeDeps()).press().catch(() => {});
        const record = await readDeployRecord();
        expect(record?.stage).toBe('wait');
        expect(record?.runs).toEqual([id]);
      } finally {
        chmodSync(dir, 0o755);
      }
    },
  );

  it('removes a leftover claim from an earlier deploy', async () => {
    const claimPath = `${deployRecordPath()}.claim`;
    mkdirSync(claimPath, { recursive: true });
    const coordinator = new DeployCoordinator(makeDeps());

    const result = await coordinator.press();

    expect(result).toEqual({ ok: true });
    expect(existsSync(claimPath)).toBe(false);
  });

  it('an open record gives deploy-open with its stage', async () => {
    writeDeployRecordFile({ v: 1, stage: 'build', runs: [], started: '2026-11-05T00:00:00.000Z' });
    const coordinator = new DeployCoordinator(makeDeps());

    const result = await coordinator.press();

    expect(result).toEqual({ ok: false, error: 'deploy-open', stage: 'build' });
  });

  it.each(['done', 'failed'] as const)(
    'a live unit with a finished %s record gives deploy-open with that stage',
    async (stage) => {
      writeDeployRecordFile({ v: 1, stage, runs: [], started: '2026-11-05T00:00:00.000Z' });
      const coordinator = new DeployCoordinator(makeDeps({ unit: fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'live') }) }));

      const result = await coordinator.press();

      expect(result).toEqual({ ok: false, error: 'deploy-open', stage });
    },
  );

  it('a live unit with no record gives stage unit', async () => {
    const coordinator = new DeployCoordinator(makeDeps({ unit: fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'live') }) }));

    const result = await coordinator.press();

    expect(result).toEqual({ ok: false, error: 'deploy-open', stage: 'unit' });
  });

  it('two presses together give one record and one deploy-open', async () => {
    await seedRun('run-x', 'running');
    const coordinator = new DeployCoordinator(makeDeps());

    const [first, second] = await Promise.all([coordinator.press(), coordinator.press()]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, error: 'deploy-open', stage: 'wait' });
    const record = await readDeployRecord();
    expect(record?.runs).toEqual(['run-x']);
  });

  it.each(['done', 'failed'] as const)('a %s record is replaced by a fresh one', async (stage) => {
    writeDeployRecordFile({
      v: 1, stage, runs: ['old-run'], started: '2020-01-01T00:00:00.000Z', commit: 'deadbeef',
      ...(stage === 'failed' ? { error: 'old error' } : {}),
    });
    const coordinator = new DeployCoordinator(makeDeps());

    const result = await coordinator.press();

    expect(result).toEqual({ ok: true });
    const record = await readDeployRecord();
    expect(record?.stage).toBe('wait');
    expect(record?.started).toBe(PRESS_NOW);
    expect(record?.error).toBeUndefined();
    expect(record?.commit).toBeUndefined();
  });
});

describe('DeployCoordinator.tick — starting the unit (R1 AC4, AC6, AC7)', () => {
  it('persists unitStarted true before calling unit.start, seen by the fake reading the file', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: [], started: PRESS_NOW });
    const sawUnitStartedFirst = { value: false };
    const unit = fakeUnit({
      start: vi.fn(async () => {
        const onDisk = JSON.parse(readFileSync(deployRecordPath(), 'utf-8')) as DeployRecord;
        sawUnitStartedFirst.value = onDisk.unitStarted === true;
      }),
    });
    const coordinator = new DeployCoordinator(makeDeps({ unit, isQuiet: vi.fn(async () => true) }));

    await coordinator.tick();

    expect(sawUnitStartedFirst.value).toBe(true);
    expect(unit.start).toHaveBeenCalledTimes(1);
    const record = await readDeployRecord();
    expect(record?.unitStarted).toBe(true);
  });

  it('does not start the unit when not quiet', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: [], started: PRESS_NOW });
    const unit = fakeUnit();
    const coordinator = new DeployCoordinator(makeDeps({ unit, isQuiet: vi.fn(async () => false) }));

    await coordinator.tick();

    expect(unit.start).not.toHaveBeenCalled();
    const record = await readDeployRecord();
    expect(record?.unitStarted).toBeFalsy();
    expect(record?.stage).toBe('wait');
  });

  it('does not start the unit again when unitStarted is already true', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: [], started: PRESS_NOW, unitStarted: true });
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'live') });
    const coordinator = new DeployCoordinator(makeDeps({ unit, isQuiet: vi.fn(async () => true) }));

    await coordinator.tick();

    expect(unit.start).not.toHaveBeenCalled();
  });

  it('writes failed with the systemd-run exit code and releases on a unit.start rejection', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: ['run-fail-start'], started: PRESS_NOW });
    await seedHeldRun('run-fail-start', 'queued');
    const error = new Error('/secret/path should not leak') as Error & { code?: number };
    error.code = 7;
    const unit = fakeUnit({ start: vi.fn(async () => { throw error; }) });
    const coordinator = new DeployCoordinator(makeDeps({ unit, isQuiet: vi.fn(async () => true) }));

    await coordinator.tick();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('failed');
    expect(record?.error).toBe('wait: systemd-run could not start the unit (exit 7)');
    const run = await readRun('run-fail-start');
    expect(run?.holdBy).toBeUndefined();
    expect(run?.pauseRequested).toBeUndefined();
  });

  it('writes failed when a live step outlasts waitLimitMs', async () => {
    const started = new Date(Date.parse(PRESS_NOW) - 2000).toISOString();
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: ['run-timeout'], started });
    await seedHeldRun('run-timeout', 'queued');
    const coordinator = new DeployCoordinator(makeDeps({ waitLimitMs: 1000 }));

    await coordinator.tick();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('failed');
    expect(record?.error).toBe('wait: a live step outlasted the 5-hour limit');
    const run = await readRun('run-timeout');
    expect(run?.holdBy).toBeUndefined();
  });

  it('defaults waitLimitMs to 5 hours', async () => {
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const notQuiet = vi.fn(async () => false);

    const justUnder = new Date(Date.parse(PRESS_NOW) - (FIVE_HOURS_MS - 1000)).toISOString();
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: [], started: justUnder });
    await new DeployCoordinator(makeDeps({ isQuiet: notQuiet })).tick();
    expect((await readDeployRecord())?.stage).toBe('wait');

    const justOver = new Date(Date.parse(PRESS_NOW) - (FIVE_HOURS_MS + 1000)).toISOString();
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: [], started: justOver });
    await new DeployCoordinator(makeDeps({ isQuiet: notQuiet })).tick();
    expect((await readDeployRecord())?.stage).toBe('failed');
  });
});

describe('DeployCoordinator.tick — a live unit gone (requirement 3 AC3)', () => {
  it.each([
    ['build', 'build: unit sdd-deploy.service is not live'],
    ['smoke', 'smoke: unit sdd-deploy.service is not live'],
    ['gate', 'gate: unit sdd-deploy.service is not live'],
    ['swap', 'swap: unit sdd-deploy.service is not live; the live checkout or dist/ may already have changed'],
    ['restart', 'restart: unit sdd-deploy.service is not live; the live checkout or dist/ may already have changed'],
  ] as const)('writes failed naming the stage at %s and releases', async (stage, expectedError) => {
    writeDeployRecordFile({ v: 1, stage, runs: ['run-gone'], started: PRESS_NOW });
    await seedHeldRun('run-gone', 'queued');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.tick();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('failed');
    expect(record?.error).toBe(expectedError);
    const run = await readRun('run-gone');
    expect(run?.holdBy).toBeUndefined();
  });

  it.each(['live', 'unknown'] as const)('does nothing when the unit is %s', async (state) => {
    writeDeployRecordFile({ v: 1, stage: 'build', runs: ['run-stay'], started: PRESS_NOW });
    await seedHeldRun('run-stay', 'queued');
    const unit = fakeUnit({ state: vi.fn(async () => state) });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.tick();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('build');
    const run = await readRun('run-stay');
    expect(run?.holdBy).toBe('deploy');
  });
});

describe('DeployCoordinator.tick — a finished record with deploy holds (requirement 3 AC2)', () => {
  it.each(['failed', 'done'] as const)(
    'releases holds on a %s record, keeping its stage and commit',
    async (stage) => {
      writeDeployRecordFile({
        v: 1, stage, runs: ['run-finished'], started: PRESS_NOW, commit: 'abc123',
        ...(stage === 'failed' ? { error: 'gate: boom' } : {}),
      });
      await seedHeldRun('run-finished', 'queued');
      const coordinator = new DeployCoordinator(makeDeps());

      await coordinator.tick();

      const record = await readDeployRecord();
      expect(record?.stage).toBe(stage);
      expect(record?.commit).toBe('abc123');
      const run = await readRun('run-finished');
      expect(run?.holdBy).toBeUndefined();
      expect(run?.pauseRequested).toBeUndefined();
    },
  );
});

describe('DeployCoordinator.tick — release with no record (D24, requirement 3 AC6)', () => {
  it('moves a paused operator-held run to queued, clearing pauseReason and resumeAt', async () => {
    await seedHeldRun('run-op', 'paused', { pauseReason: 'operator', resumeAt: '2026-11-05T01:00:00.000Z' });
    await new DeployCoordinator(makeDeps()).tick();

    const run = await readRun('run-op');
    expect(run?.status).toBe('queued');
    expect(run?.holdBy).toBeUndefined();
    expect(run?.pauseRequested).toBeUndefined();
    expect(run?.pauseReason).toBeUndefined();
    expect(run?.resumeAt).toBeUndefined();
  });

  it('keeps a usage-paused run\'s status, reason and resume time', async () => {
    await seedHeldRun('run-usage', 'paused', { pauseReason: 'usage-window', resumeAt: '2026-11-05T02:00:00.000Z' });
    await new DeployCoordinator(makeDeps()).tick();

    const run = await readRun('run-usage');
    expect(run?.status).toBe('paused');
    expect(run?.pauseReason).toBe('usage-window');
    expect(run?.resumeAt).toBe('2026-11-05T02:00:00.000Z');
    expect(run?.holdBy).toBeUndefined();
    expect(run?.pauseRequested).toBeUndefined();
  });

  it('calls resumeIfAnswered for a waiting run, with its hold cleared', async () => {
    await seedHeldRun('run-wait', 'waiting');
    const resumeIfAnswered = vi.fn(async (_run: RunRecord) => {});

    await new DeployCoordinator(makeDeps({ resumeIfAnswered })).tick();

    expect(resumeIfAnswered).toHaveBeenCalledTimes(1);
    const arg = resumeIfAnswered.mock.calls[0][0];
    expect(arg.id).toBe('run-wait');
    expect(arg.holdBy).toBeUndefined();
    const run = await readRun('run-wait');
    expect(run?.status).toBe('waiting');
    expect(run?.holdBy).toBeUndefined();
  });

  it('skips a run whose hold has become the operator\'s', async () => {
    await seedRun('run-other-op', 'queued', { holdBy: 'operator', pauseRequested: PRESS_NOW });

    await new DeployCoordinator(makeDeps()).tick();

    const run = await readRun('run-other-op');
    expect(run?.holdBy).toBe('operator');
    expect(run?.pauseRequested).toBe(PRESS_NOW);
    expect(run?.status).toBe('queued');
  });

  it('emits exactly one runEvents change and calls schedule', async () => {
    await seedHeldRun('run-a', 'queued');
    await seedHeldRun('run-b', 'queued');
    const schedule = vi.fn();
    const events: unknown[] = [];
    const handler = (e: unknown): void => { events.push(e); };
    runEvents.on('change', handler);

    try {
      await new DeployCoordinator(makeDeps({ schedule })).tick();
      expect(events.length).toBe(1);
      expect(schedule).toHaveBeenCalled();
    } finally {
      runEvents.off('change', handler);
    }
  });

  it('a repeat release changes nothing', async () => {
    await seedHeldRun('run-again', 'queued');
    const coordinator = new DeployCoordinator(makeDeps());

    await coordinator.tick();
    const after1 = await readRun('run-again');

    await coordinator.tick();
    const after2 = await readRun('run-again');

    expect(after2).toEqual(after1);
  });
});

describe('DeployCoordinator.tick — the deploy lock (D16)', () => {
  it('returns at once with no read or write when the lock is held', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: [], started: PRESS_NOW });
    const before = readFileSync(deployRecordPath(), 'utf-8');
    const isQuiet = vi.fn(async () => true);
    const unit = fakeUnit();
    const coordinator = new DeployCoordinator(makeDeps({ isQuiet, unit }));

    let releaseLock: () => void = () => {};
    let lockEntered = false;
    const locked = coordinator.withLock(() => new Promise<void>((resolve) => {
      lockEntered = true;
      releaseLock = resolve;
    }));
    const deadline = Date.now() + 2000;
    while (!lockEntered && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
    expect(lockEntered).toBe(true);

    await coordinator.tick();

    expect(isQuiet).not.toHaveBeenCalled();
    expect(unit.start).not.toHaveBeenCalled();
    expect(readFileSync(deployRecordPath(), 'utf-8')).toBe(before);

    releaseLock();
    await locked;
  });
});

describe('deployEvents (NFR Performance)', () => {
  it('emits once per wire change and not on an unchanged tick', async () => {
    writeDeployRecordFile({ v: 1, stage: 'build', runs: [], started: PRESS_NOW });
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'live') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));
    const events: unknown[] = [];
    const handler = (e: unknown): void => { events.push(e); };
    deployEvents.on('change', handler);

    try {
      await coordinator.tick();
      expect(events.length).toBe(1);

      await coordinator.tick();
      expect(events.length).toBe(1);
    } finally {
      deployEvents.off('change', handler);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 4 — `onStart` and `cancel` (design C1 "onStart" table, "cancel" steps
// 1-4, D15, D21). Neither method exists on `DeployCoordinator` yet, so every
// call below reaches the coordinator only through `onStart()` or `cancel()` —
// no caller to mock. `DeployUnit` stays the only fake; `writeRun`/`readRun`
// and `runEvents` stay the real implementations, as in task 3.
//
// Per success criterion (task 4 _Prompt Success line), grouped by clause:
// - `onStart` at `restart` and at `done` releases and ends at `done` with
//   `commit` kept (requirement 3 AC1). Pre: a record at each stage with a
//   held run and a `commit`. Call: `onStart()`. Result: record stage `done`,
//   `commit` unchanged; run released. Source: design C1 onStart table row 2.
// - `onStart` at `failed` with deploy holds releases and stays `failed`
//   (AC2). Pre: a `failed` record with `error` and a held run. Call:
//   `onStart()`. Result: record unchanged (`failed`, same `error`); run
//   released. Source: design C1 onStart table row 3.
// - `onStart` with an absent record and deploy holds on disk releases (D24).
//   Pre: no record file, a held run. Call: `onStart()`. Result: run released.
//   Source: design C1 onStart table row 1.
// - `onStart` on an open record with a live unit leaves the record, the unit
//   and the holds alone (AC5). Pre: a record at `build`, `unit.state()` live,
//   a held run. Call: `onStart()`. Result: record and run unchanged; neither
//   `unit.start` nor `unit.stop` called. Source: design C1 onStart table row
//   4; requirement 3 AC5.
// - `onStart` at `wait` with `unitStarted` not true and no live unit
//   re-applies the hold to a run that lost it, using the record's `started`
//   as `pauseRequested`, and calls no `unit.start` (AC4). Pre: such a record,
//   a run with no hold. Call: `onStart()`. Result: the run gains `holdBy:
//   'deploy'` and that `pauseRequested`; `unit.start` not called. Source:
//   design C1 onStart table row 5; requirement 3 AC4.
// - The same re-apply skips a run that is gone (not on disk), a terminal run,
//   and a run with an operator hold, each tested. Pre: the id absent / a
//   `done` run / a `paused` run with `holdBy: 'operator'`, listed in `runs`.
//   Call: `onStart()`. Result: no run created / run unchanged / run
//   unchanged. Source: design C1 onStart table row 5 ("skip a run that is
//   gone or terminal, or that has `pauseRequested` with `holdBy` other than
//   `deploy`").
// - `onStart` on any other open record with the unit `gone` writes `failed`
//   naming the stage and releases, including `wait` with `unitStarted` true
//   (AC3). Pre: a record at `build`, or at `wait` with `unitStarted: true`;
//   `unit.state()` resolves `gone`; a held run. Call: `onStart()`. Result:
//   `failed` with the fixed "unit ... is not live" text; run released.
//   Source: design C1 onStart table row 6; requirement 3 AC3.
// - `onStart` on any other open record with the unit `unknown` does nothing.
//   Pre: a record at `build`, `unit.state()` resolves `unknown`, a held run.
//   Call: `onStart()`. Result: record and run unchanged. Source: design C1
//   onStart table row 7.
// - `cancel` with no record gives 404. Pre: no record file. Call: `cancel()`.
//   Result: `status: 404`. Source: design C1 "cancel" step 1; requirement 5
//   AC3.
// - `cancel` at each of `swap`, `restart`, `done` and `failed` gives 409
//   `deploy-past-swap` and changes nothing (requirement 5 AC3), each tested.
//   Pre: a record at that stage, a held run. Call: `cancel()`. Result:
//   `status: 409`, `error: 'deploy-past-swap'`; record and run unchanged.
//   Source: design C1 "cancel" step 1; requirement 5 AC3.
// - `cancel` with an existing claim at `gate` gives 409 `deploy-past-swap`
//   with no `unit.stop` call (D15). Pre: a record at `gate`, the claim
//   directory pre-created. Call: `cancel()`. Result: `status: 409`, `error:
//   'deploy-past-swap'`; `unit.stop` not called. Source: design C1 "cancel"
//   step 2; D15.
// - `cancel` at each of `wait`, `build`, `smoke` and `gate` with `unitStarted`
//   true stops the unit, waits for `gone`, releases, removes the record and
//   the claim, emits `change` with `null`, and gives 200 (AC1), each tested.
//   Pre: a record at that stage with `unitStarted: true`, a held run. Call:
//   `cancel()`. Result: `unit.stop` called once; record and claim gone; run
//   released; a `deployEvents` `change` carrying `null`; `status: 200`.
//   Source: design C1 "cancel" steps 3-4; requirement 5 AC1.
// - `cancel` at `wait` with `unitStarted` not true and the unit `gone` calls
//   no `stop` and still gives 200. Pre: such a record. Call: `cancel()`.
//   Result: `unit.stop` not called; `status: 200`; record removed. Source:
//   design C1 "cancel" step 3 ("If `unitStarted` is true or `unit.state()`
//   is `live`").
// - A unit that never goes gives 500 `deploy-stop-failed` and keeps the
//   record and the claim. Pre: `unitStarted: true`, `unit.state()` always
//   `live`, `deps.now()` crossing the 30-second limit on its next call. Call:
//   `cancel()`. Result: `status: 500`, `error: 'deploy-stop-failed'`; record
//   and claim still present. Source: design C1 "cancel" step 3 ("Past that,
//   answer 500 ... and keep the record and the claim"); task 4 _Prompt
//   ("Measure the 30-second stop limit with `deps.now`").
// - A `tick` queued during a `cancel` recreates no record (AC2). Pre: a
//   record at `wait` with `unitStarted: true`, the unit `gone`. Call:
//   `cancel()` then `tick()` without an intervening `await`, both awaited
//   together. Result: no record on disk afterward. Source: design C1
//   "cancel" step 2 note; requirement 5 AC2.

describe('DeployCoordinator.onStart — finish or release at restart, done, failed (requirement 3 AC1, AC2)', () => {
  it.each(['restart', 'done'] as const)(
    'releases and ends at done keeping commit when the record is at %s',
    async (stage) => {
      writeDeployRecordFile({ v: 1, stage, runs: ['run-onstart'], started: PRESS_NOW, commit: 'abc123' });
      await seedHeldRun('run-onstart', 'queued');
      const coordinator = new DeployCoordinator(makeDeps());

      await coordinator.onStart();

      const record = await readDeployRecord();
      expect(record?.stage).toBe('done');
      expect(record?.commit).toBe('abc123');
      const run = await readRun('run-onstart');
      expect(run?.holdBy).toBeUndefined();
      expect(run?.pauseRequested).toBeUndefined();
    },
  );

  it('releases holds and stays failed when the record is failed', async () => {
    writeDeployRecordFile({
      v: 1, stage: 'failed', runs: ['run-onstart-f'], started: PRESS_NOW, error: 'gate: boom',
    });
    await seedHeldRun('run-onstart-f', 'queued');
    const coordinator = new DeployCoordinator(makeDeps());

    await coordinator.onStart();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('failed');
    expect(record?.error).toBe('gate: boom');
    const run = await readRun('run-onstart-f');
    expect(run?.holdBy).toBeUndefined();
    expect(run?.pauseRequested).toBeUndefined();
  });

  it('releases an absent record\'s leftover deploy holds (D24)', async () => {
    await seedHeldRun('run-onstart-absent', 'queued');
    const coordinator = new DeployCoordinator(makeDeps());

    await coordinator.onStart();

    const run = await readRun('run-onstart-absent');
    expect(run?.holdBy).toBeUndefined();
    expect(run?.pauseRequested).toBeUndefined();
  });
});

describe('DeployCoordinator.onStart — a live unit leaves everything alone (requirement 3 AC5)', () => {
  it('leaves the record, the unit and the holds alone', async () => {
    writeDeployRecordFile({ v: 1, stage: 'build', runs: ['run-onstart-live'], started: PRESS_NOW });
    await seedHeldRun('run-onstart-live', 'queued');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'live') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    expect(unit.start).not.toHaveBeenCalled();
    expect(unit.stop).not.toHaveBeenCalled();
    const record = await readDeployRecord();
    expect(record?.stage).toBe('build');
    const run = await readRun('run-onstart-live');
    expect(run?.holdBy).toBe('deploy');
    expect(run?.pauseRequested).toBe(PRESS_NOW);
  });
});

describe('DeployCoordinator.onStart — re-apply holds at wait with no live unit (requirement 3 AC4)', () => {
  it('re-applies the hold to a run that lost it, using the record\'s started time', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: ['run-recover'], started: PRESS_NOW });
    await seedRun('run-recover', 'queued');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    const run = await readRun('run-recover');
    expect(run?.holdBy).toBe('deploy');
    expect(run?.pauseRequested).toBe(PRESS_NOW);
    expect(run?.status).toBe('queued');
    expect(unit.start).not.toHaveBeenCalled();
  });

  it('skips a run that is gone (not on disk)', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: ['run-gone-id'], started: PRESS_NOW });
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    expect(await readRun('run-gone-id')).toBeUndefined();
  });

  it('skips a terminal run', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: ['run-terminal'], started: PRESS_NOW });
    await seedRun('run-terminal', 'done');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    const run = await readRun('run-terminal');
    expect(run?.status).toBe('done');
    expect(run?.holdBy).toBeUndefined();
    expect(run?.pauseRequested).toBeUndefined();
  });

  it('skips a run that has an operator hold', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: ['run-operator'], started: PRESS_NOW });
    await seedRun('run-operator', 'paused', { pauseRequested: '2026-11-04T00:00:00.000Z', holdBy: 'operator' });
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    const run = await readRun('run-operator');
    expect(run?.holdBy).toBe('operator');
    expect(run?.pauseRequested).toBe('2026-11-04T00:00:00.000Z');
  });
});

describe('DeployCoordinator.onStart — unit gone or unknown on an open record (requirement 3 AC3)', () => {
  it('writes failed and releases for a non-wait open stage', async () => {
    writeDeployRecordFile({ v: 1, stage: 'build', runs: ['run-gone-open'], started: PRESS_NOW });
    await seedHeldRun('run-gone-open', 'queued');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('failed');
    expect(record?.error).toBe('build: unit sdd-deploy.service is not live');
    const run = await readRun('run-gone-open');
    expect(run?.holdBy).toBeUndefined();
  });

  it('writes failed and releases for wait with unitStarted true', async () => {
    writeDeployRecordFile({
      v: 1, stage: 'wait', runs: ['run-gone-wait'], started: PRESS_NOW, unitStarted: true,
    });
    await seedHeldRun('run-gone-wait', 'queued');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('failed');
    expect(record?.error).toBe('wait: unit sdd-deploy.service is not live');
    const run = await readRun('run-gone-wait');
    expect(run?.holdBy).toBeUndefined();
  });

  it('does nothing when the unit is unknown', async () => {
    writeDeployRecordFile({ v: 1, stage: 'build', runs: ['run-unknown-open'], started: PRESS_NOW });
    await seedHeldRun('run-unknown-open', 'queued');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'unknown') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    await coordinator.onStart();

    const record = await readDeployRecord();
    expect(record?.stage).toBe('build');
    const run = await readRun('run-unknown-open');
    expect(run?.holdBy).toBe('deploy');
  });
});

describe('DeployCoordinator.cancel — no record or past the swap (requirement 5 AC3)', () => {
  it('with no record gives 404', async () => {
    const coordinator = new DeployCoordinator(makeDeps());

    const result = await coordinator.cancel();

    expect(result.status).toBe(404);
  });

  it.each(['swap', 'restart', 'done', 'failed'] as const)(
    'at stage %s gives 409 deploy-past-swap and changes nothing',
    async (stage) => {
      const record: DeployRecord = {
        v: 1, stage, runs: ['run-past-swap'], started: PRESS_NOW,
        ...(stage === 'failed' ? { error: 'gate: boom' } : {}),
        ...(stage === 'done' ? { commit: 'abc123' } : {}),
      };
      writeDeployRecordFile(record);
      await seedHeldRun('run-past-swap', 'queued');
      const unit = fakeUnit();
      const coordinator = new DeployCoordinator(makeDeps({ unit }));

      const result = await coordinator.cancel();

      expect(result.status).toBe(409);
      expect(result.error).toBe('deploy-past-swap');
      expect(await readDeployRecord()).toEqual(record);
      const run = await readRun('run-past-swap');
      expect(run?.holdBy).toBe('deploy');
    },
  );
});

describe('DeployCoordinator.cancel — an existing claim (D15)', () => {
  it('at gate gives 409 deploy-past-swap with no unit.stop', async () => {
    const record: DeployRecord = { v: 1, stage: 'gate', runs: ['run-claimed'], started: PRESS_NOW };
    writeDeployRecordFile(record);
    await seedHeldRun('run-claimed', 'queued');
    mkdirSync(`${deployRecordPath()}.claim`);
    const unit = fakeUnit();
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    const result = await coordinator.cancel();

    expect(result.status).toBe(409);
    expect(result.error).toBe('deploy-past-swap');
    expect(unit.stop).not.toHaveBeenCalled();
    expect(await readDeployRecord()).toEqual(record);
  });
});

describe('DeployCoordinator.cancel — stop, release, remove (requirement 5 AC1)', () => {
  it.each(['wait', 'build', 'smoke', 'gate'] as const)(
    'at stage %s with unitStarted true stops the unit, releases, removes the record and claim, emits null, gives 200',
    async (stage) => {
      writeDeployRecordFile({
        v: 1, stage, runs: ['run-cancel'], started: PRESS_NOW, unitStarted: true,
      });
      await seedHeldRun('run-cancel', 'queued');
      const unit = fakeUnit({
        state: vi.fn()
          .mockResolvedValueOnce('live' as UnitState)
          .mockResolvedValue('gone' as UnitState),
      });
      const coordinator = new DeployCoordinator(makeDeps({ unit }));
      const events: unknown[] = [];
      const handler = (e: unknown): void => { events.push(e); };
      deployEvents.on('change', handler);

      let result;
      try {
        result = await coordinator.cancel();
      } finally {
        deployEvents.off('change', handler);
      }

      expect(result).toEqual({ status: 200 });
      expect(unit.stop).toHaveBeenCalledTimes(1);
      expect(await readDeployRecord()).toBeUndefined();
      expect(existsSync(`${deployRecordPath()}.claim`)).toBe(false);
      const run = await readRun('run-cancel');
      expect(run?.holdBy).toBeUndefined();
      expect(run?.pauseRequested).toBeUndefined();
      expect(events).toContain(null);
    },
  );

  it('at wait with unitStarted not true and the unit gone calls no stop and still gives 200', async () => {
    writeDeployRecordFile({ v: 1, stage: 'wait', runs: ['run-cancel-no-stop'], started: PRESS_NOW });
    await seedHeldRun('run-cancel-no-stop', 'queued');
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    const result = await coordinator.cancel();

    expect(result).toEqual({ status: 200 });
    expect(unit.stop).not.toHaveBeenCalled();
    expect(await readDeployRecord()).toBeUndefined();
  });
});

describe('DeployCoordinator.cancel — a unit that never goes', () => {
  it('answers 500 deploy-stop-failed and keeps the record and the claim', async () => {
    writeDeployRecordFile({
      v: 1, stage: 'build', runs: ['run-stuck'], started: PRESS_NOW, unitStarted: true,
    });
    await seedHeldRun('run-stuck', 'queued');
    let calls = 0;
    const now = (): Date => {
      calls += 1;
      return calls === 1 ? new Date(PRESS_NOW) : new Date(Date.parse(PRESS_NOW) + 31000);
    };
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'live') });
    const coordinator = new DeployCoordinator(makeDeps({ unit, now }));

    const result = await coordinator.cancel();

    expect(result).toEqual({ status: 500, error: 'deploy-stop-failed' });
    const record = await readDeployRecord();
    expect(record?.stage).toBe('build');
    expect(record?.unitStarted).toBe(true);
    expect(existsSync(`${deployRecordPath()}.claim`)).toBe(true);
    const run = await readRun('run-stuck');
    expect(run?.holdBy).toBe('deploy');
  }, 15000);
});

describe('DeployCoordinator.cancel — a queued tick recreates no record (requirement 5 AC2)', () => {
  it('recreates no record when a tick is queued behind a cancel', async () => {
    writeDeployRecordFile({
      v: 1, stage: 'wait', runs: [], started: PRESS_NOW, unitStarted: true,
    });
    const unit = fakeUnit({ state: vi.fn(async (): Promise<UnitState> => 'gone') });
    const coordinator = new DeployCoordinator(makeDeps({ unit }));

    const cancelPromise = coordinator.cancel();
    const tickPromise = coordinator.tick();
    const [cancelResult] = await Promise.all([cancelPromise, tickPromise]);

    expect(cancelResult.status).toBe(200);
    expect(await readDeployRecord()).toBeUndefined();
  });
});
