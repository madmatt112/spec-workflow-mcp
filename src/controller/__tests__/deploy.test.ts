import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  deployRecordPath,
  readDeployRecord,
  isDeployOpen,
  readDeployForWireSync,
  deployUnitArgs,
  systemdDeployUnit,
  type DeployRecord,
} from '../deploy.js';

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
