// src/controller/deploy.ts
//
// Design C1 (record and lock) and C5 (the `DeployUnit` seam hiding
// `systemd-run`/`systemctl`). This task adds only the record's readers and
// the unit seam; `DeployCoordinator` is a later task, so nothing here has a
// caller yet.
import { promises as fs, readFileSync } from 'fs';
import { execFile, spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { controllerHome, listRuns, updateRun, writeJsonAtomic, OPERATOR_PAUSE, type RunRecord } from './state.js';
import { runEvents } from './runs.js';

export type DeployStage = 'wait' | 'build' | 'smoke' | 'gate' | 'swap' | 'restart' | 'done' | 'failed';

export interface DeployRecord {
  v: 1;
  stage: DeployStage;
  runs: string[];
  /** ISO press time; base of the 5-hour limit. */
  started: string;
  commit?: string;
  error?: string;
  unitStarted?: boolean;
}

/** Wire form: no `v`, no `unitStarted`. */
export type ControllerDeploy = Omit<DeployRecord, 'v' | 'unitStarted'>;

/** Emits `change` with the wire form (`ControllerDeploy | null`). */
export const deployEvents = new EventEmitter();

export function deployRecordPath(): string {
  return join(controllerHome(), 'deploy.json');
}

/** A missing or unparsable file is `undefined`. */
export async function readDeployRecord(): Promise<DeployRecord | undefined> {
  try {
    return JSON.parse(await fs.readFile(deployRecordPath(), 'utf-8')) as DeployRecord;
  } catch {
    return undefined;
  }
}

export function isDeployOpen(record: DeployRecord): boolean {
  return record.stage !== 'done' && record.stage !== 'failed';
}

export function readDeployForWireSync(): ControllerDeploy | null {
  try {
    const record = JSON.parse(readFileSync(deployRecordPath(), 'utf-8')) as DeployRecord;
    const { v, unitStarted, ...wire } = record;
    void v;
    void unitStarted;
    return wire;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// C5. Transient unit.
// ---------------------------------------------------------------------------

export type UnitState = 'live' | 'gone' | 'unknown';

export interface DeployUnit {
  /** Rejects with an error carrying the exit code as `code`. */
  start(recordPath: string): Promise<void>;
  state(): Promise<UnitState>;
  stop(): Promise<void>;
}

const UNIT_NAME = 'sdd-deploy';

/** The package root this module runs from, the pattern `src/advisor/actions.ts:165-167` uses. */
function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function deployUnitArgs(opts: {
  checkoutRoot: string;
  recordPath: string;
  home: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const { checkoutRoot, recordPath, home, env } = opts;
  return [
    '--user',
    `--unit=${UNIT_NAME}`,
    '--collect',
    '--quiet',
    `--working-directory=${checkoutRoot}`,
    `--setenv=PATH=${env.PATH ?? ''}`,
    `--setenv=HOME=${env.HOME ?? ''}`,
    `--setenv=SDD_HOME=${home}`,
    '-p',
    `EnvironmentFile=-${join(home, 'service.env')}`,
    '-p',
    'UnsetEnvironment=ANTHROPIC_API_KEY',
    '-p',
    'UnsetEnvironment=ANTHROPIC_AUTH_TOKEN',
    '-p',
    'TimeoutStopSec=15',
    join(checkoutRoot, 'scripts', 'sdd-self-update.sh'),
    '--deploy-record',
    recordPath,
  ];
}

const ACTIVE_STATES = new Set(['active', 'activating', 'deactivating', 'reloading']);

export function systemdDeployUnit(): DeployUnit {
  return {
    start(recordPath: string): Promise<void> {
      const checkoutRoot = process.env.CONTROLLER_HARNESS_REPO ?? packageRoot();
      const home = controllerHome();
      const args = deployUnitArgs({ checkoutRoot, recordPath, home, env: process.env });
      return new Promise<void>((resolve, reject) => {
        const child = spawn('systemd-run', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.once('error', (err) => reject(err));
        child.once('close', (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          if (stderr) console.error(stderr);
          const error = new Error(`systemd-run exited with code ${code}`) as Error & { code?: number };
          error.code = code ?? undefined;
          reject(error);
        });
      });
    },
    state(): Promise<UnitState> {
      return new Promise<UnitState>((resolve) => {
        execFile(
          'systemctl',
          ['--user', 'show', `${UNIT_NAME}.service`, '-p', 'ActiveState', '--value'],
          { timeout: 5000 },
          (err, stdout) => {
            if (err) {
              resolve('unknown');
              return;
            }
            resolve(ACTIVE_STATES.has(stdout.trim()) ? 'live' : 'gone');
          },
        );
      });
    },
    stop(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        execFile(
          'systemctl',
          ['--user', 'stop', `${UNIT_NAME}.service`],
          { timeout: 30000 },
          (err) => {
            if (!err) {
              resolve();
              return;
            }
            const code = (err as NodeJS.ErrnoException & { code?: number }).code;
            if (code === 0 || code === 5) {
              resolve();
              return;
            }
            reject(err);
          },
        );
      });
    },
  };
}

// ---------------------------------------------------------------------------
// C1. Deploy coordinator: lock, press, tick, release.
// ---------------------------------------------------------------------------

const DEFAULT_WAIT_LIMIT_MS = 5 * 60 * 60 * 1000;

const HOLDABLE_STATUSES = new Set<RunRecord['status']>(['running', 'queued', 'waiting', 'merging', 'paused']);

function toWireForm(record: DeployRecord | undefined): ControllerDeploy | null {
  if (!record) return null;
  const { v, unitStarted, ...wire } = record;
  void v;
  void unitStarted;
  return wire;
}

function unitGoneMessage(stage: DeployStage): string {
  const suffix = stage === 'swap' || stage === 'restart'
    ? '; the live checkout or dist/ may already have changed'
    : '';
  return `${stage}: unit ${UNIT_NAME}.service is not live${suffix}`;
}

export interface DeployDeps {
  now(): Date;
  unit: DeployUnit;
  isQuiet(): Promise<boolean>;
  resumeIfAnswered(run: RunRecord): Promise<void>;
  schedule(): void;
  waitLimitMs?: number;
}

export class DeployCoordinator {
  private queue: Promise<unknown> = Promise.resolve();
  private locked = false;
  private sawWire = false;
  private lastWire: ControllerDeploy | null = null;

  constructor(private readonly deps: DeployDeps) {}

  /** One promise-chain mutex in the instance (design "Deploy lock"). */
  withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.locked = true;
      try {
        return await fn();
      } finally {
        this.locked = false;
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async press(): Promise<{ ok: true } | { ok: false; error: 'deploy-open'; stage: string }> {
    return this.withLock(async () => {
      const current = await readDeployRecord();
      if (current && isDeployOpen(current)) {
        return { ok: false, error: 'deploy-open', stage: current.stage } as const;
      }

      const unitState = await this.deps.unit.state();
      if (unitState === 'live') {
        return { ok: false, error: 'deploy-open', stage: current ? current.stage : 'unit' } as const;
      }

      await fs.rm(`${deployRecordPath()}.claim`, { recursive: true, force: true });

      const runs = await listRuns();
      const ids = runs
        .filter((run) => HOLDABLE_STATUSES.has(run.status) && !run.pauseRequested)
        .map((run) => run.id);

      const started = this.deps.now().toISOString();
      const record: DeployRecord = { v: 1, stage: 'wait', runs: ids, started };
      await writeJsonAtomic(deployRecordPath(), record);

      for (const id of ids) {
        await updateRun(id, (run) => {
          if (run.pauseRequested) return undefined;
          if (run.status === 'done' || run.status === 'abandoned' || run.status === 'error') return undefined;
          return { ...run, pauseRequested: started, holdBy: 'deploy' };
        });
      }

      runEvents.emit('change');
      this.deps.schedule();
      return { ok: true } as const;
    });
  }

  /** `tick` returns at once when the lock is held; the next tick retries (D16). */
  async tick(): Promise<void> {
    if (this.locked) return;
    await this.withLock(async () => {
      const record = await readDeployRecord();
      this.emitIfChanged(record);

      if (!record) {
        await this.release();
        return;
      }
      if (record.stage === 'failed' || record.stage === 'done') {
        await this.release();
        return;
      }
      if (record.stage === 'wait' && record.unitStarted !== true) {
        const limit = this.deps.waitLimitMs ?? DEFAULT_WAIT_LIMIT_MS;
        const elapsed = this.deps.now().getTime() - Date.parse(record.started);
        if (elapsed > limit) {
          await this.writeFailed(record, 'wait: a live step outlasted the 5-hour limit');
          return;
        }
        if (await this.deps.isQuiet()) {
          await this.startUnit();
        }
        return;
      }

      const state = await this.deps.unit.state();
      if (state === 'gone') {
        const fresh = await readDeployRecord();
        if (fresh && isDeployOpen(fresh)) {
          await this.writeFailed(fresh, unitGoneMessage(fresh.stage));
        }
      }
    });
  }

  private emitIfChanged(record: DeployRecord | undefined): void {
    const wire = toWireForm(record);
    if (this.sawWire && JSON.stringify(wire) === JSON.stringify(this.lastWire)) return;
    this.sawWire = true;
    this.lastWire = wire;
    deployEvents.emit('change', wire);
  }

  /** Starting the unit (R1 AC4, AC6): already under the lock. */
  private async startUnit(): Promise<void> {
    const fresh = await readDeployRecord();
    if (!fresh || fresh.stage !== 'wait' || fresh.unitStarted === true) return;
    const next: DeployRecord = { ...fresh, unitStarted: true };
    await writeJsonAtomic(deployRecordPath(), next);
    try {
      await this.deps.unit.start(deployRecordPath());
    } catch (error) {
      const code = (error as { code?: number }).code;
      await this.writeFailed(next, `wait: systemd-run could not start the unit (exit ${code})`);
    }
  }

  private async writeFailed(record: DeployRecord, error: string): Promise<void> {
    await writeJsonAtomic(deployRecordPath(), { ...record, stage: 'failed', error });
    await this.release();
  }

  /** Release (R3 AC6): every run with `holdBy: 'deploy'`, found live, not from the record. */
  private async release(): Promise<void> {
    const runs = await listRuns();
    const held = runs.filter((run) => run.holdBy === 'deploy');
    if (held.length === 0) return;

    for (const run of held) {
      const after = await updateRun(run.id, (current) => {
        if (current.holdBy !== 'deploy') return undefined;
        const patch: Partial<RunRecord> = { holdBy: undefined, pauseRequested: undefined };
        if (current.status === 'paused' && current.pauseReason === OPERATOR_PAUSE) {
          patch.status = 'queued';
          patch.pauseReason = undefined;
          patch.resumeAt = undefined;
        }
        return { ...current, ...patch };
      });
      if (after?.status === 'waiting') {
        await this.deps.resumeIfAnswered(after);
      }
    }

    runEvents.emit('change');
    this.deps.schedule();
  }
}
