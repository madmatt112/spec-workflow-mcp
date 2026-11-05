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
import { controllerHome } from './state.js';

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
