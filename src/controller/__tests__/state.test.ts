import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, type ChildProcess } from 'child_process';
import {
  controllerHome,
  listRuns,
  readRun,
  writeRun,
  listWaits,
  readWait,
  writeWait,
  readQueue,
  writeQueue,
  readRateLimit,
  writeRateLimit,
  acquireControllerLock,
  releaseControllerLock,
  withStoreLock,
  isProcessAlive,
  processStartTime,
  type RunRecord,
  type WaitRecord,
  type QueueFile,
  type RateLimitFile,
  type ControllerLock,
} from '../state.js';

// Contract for src/controller/state.ts (controller-tasks.md "T2 state";
// controller-design.md §3, §7, §8, §9). Each test runs against a fresh temp
// SDD_HOME so the real home is never touched; controllerHome() reads the
// environment when called.

let home: string;
let savedSddHome: string | undefined;

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-ctrl-state-'));
  process.env.SDD_HOME = home;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await fs.rm(home, { recursive: true, force: true });
});

function sampleRun(id = 'run-20261011-120000'): RunRecord {
  return {
    v: 1,
    id,
    project: 'proj-1',
    codeRoot: '/code/proj-1',
    specStore: '/code/proj-1/.spec-workflow',
    spec: 'my-spec',
    worktree: '/code/proj-1/.worktrees/my-spec',
    branch: 'feat/my-spec',
    status: 'running',
    phase: 'requirements',
    cursor: { phase: 'requirements', round: 1, stepKind: 'reviewer', attempt: 1 },
    inFlight: { id: 'step-1', pid: 4242, startTime: 999, session: 'sess-abc' },
    created: '2026-10-11T12:00:00.000Z',
    updated: '2026-10-11T12:05:00.000Z',
    tokens: { input: 100, output: 20, cacheWrite: 5, cacheRead: 50 },
  };
}

describe('controllerHome', () => {
  it('honours SDD_HOME', () => {
    expect(controllerHome()).toBe(home);
  });
});

describe('run records', () => {
  it('round trips a run record', async () => {
    const run = sampleRun();
    await writeRun(run);
    expect(await readRun(run.id)).toEqual(run);
  });

  it('readRun returns undefined for a missing run', async () => {
    expect(await readRun('nope')).toBeUndefined();
  });

  it('listRuns returns every written run, [] when none', async () => {
    expect(await listRuns()).toEqual([]);
    const a = sampleRun('run-a');
    const b = sampleRun('run-b');
    await writeRun(a);
    await writeRun(b);
    const ids = (await listRuns()).map((r) => r.id).sort();
    expect(ids).toEqual(['run-a', 'run-b']);
  });
});

describe('wait records', () => {
  it('round trips a wait record', async () => {
    const wait: WaitRecord = {
      v: 1,
      id: 'wait-1',
      kind: 'gate-a',
      run: 'run-a',
      project: 'proj-1',
      spec: 'my-spec',
      created: '2026-10-11T12:00:00.000Z',
      questions: [
        { id: 'q1', text: 'Pick one', options: ['a', 'b'], recommended: 'a', reason: 'because' },
        { id: 'q2', text: 'Free answer', free: true },
      ],
      answer: { q1: { value: 'a', by: 'operator', answered: '2026-10-11T12:10:00.000Z' } },
      advice: 'a looks right',
      state: 'answered',
    };
    await writeWait(wait);
    expect(await readWait(wait.id)).toEqual(wait);
  });

  it('listWaits filters by state', async () => {
    const base: Omit<WaitRecord, 'id' | 'state'> = {
      v: 1,
      kind: 'merge',
      run: 'run-a',
      project: 'proj-1',
      spec: 'my-spec',
      created: '2026-10-11T12:00:00.000Z',
      questions: [],
    };
    await writeWait({ ...base, id: 'open-1', state: 'open' });
    await writeWait({ ...base, id: 'open-2', state: 'open' });
    await writeWait({ ...base, id: 'answered-1', state: 'answered' });

    expect((await listWaits()).length).toBe(3);
    const openIds = (await listWaits({ state: 'open' })).map((w) => w.id).sort();
    expect(openIds).toEqual(['open-1', 'open-2']);
    expect((await listWaits({ state: 'expired' }))).toEqual([]);
  });
});

describe('queue and rate limit', () => {
  it('readQueue defaults to an empty queue, then round trips', async () => {
    expect(await readQueue()).toEqual({ v: 1, runs: [] });
    const queue: QueueFile = { v: 1, runs: ['run-a', 'run-b'] };
    await writeQueue(queue);
    expect(await readQueue()).toEqual(queue);
  });

  it('rate limit round trips, undefined when absent', async () => {
    expect(await readRateLimit()).toBeUndefined();
    const rl: RateLimitFile = {
      v: 1,
      fiveHour: { utilization: 0.4, resetsAt: '2026-10-11T17:00:00.000Z' },
      sevenDay: { utilization: 0.1, resetsAt: '2026-10-18T00:00:00.000Z' },
      updated: '2026-10-11T12:00:00.000Z',
    };
    await writeRateLimit(rl);
    expect(await readRateLimit()).toEqual(rl);
  });
});

describe('atomic writes', () => {
  it('a crash mid-write (a stray temp file) leaves the old record intact', async () => {
    const run = sampleRun();
    await writeRun(run);

    // Simulate a crash between the temp write and the rename: a temp file with
    // new content is left behind, the rename never happened.
    const runJson = join(controllerHome(), 'runs', run.id, 'run.json');
    writeFileSync(`${runJson}.99999.0.tmp`, JSON.stringify({ ...run, spec: 'CORRUPT' }));

    // The old record survives; the temp file did not become run.json.
    expect(await readRun(run.id)).toEqual(run);
    expect(JSON.parse(readFileSync(runJson, 'utf-8')).spec).toBe('my-spec');
  });
});

describe('withStoreLock', () => {
  it('serialises two concurrent calls on the same store', async () => {
    const store = '/code/proj-1/.spec-workflow';
    let active = 0;
    let maxActive = 0;
    const body = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 60));
      active--;
    };
    await Promise.all([withStoreLock(store, body), withStoreLock(store, body)]);
    expect(maxActive).toBe(1);
  });

  it('returns the body result', async () => {
    const value = await withStoreLock('/some/store', async () => 42);
    expect(value).toBe(42);
  });
});

describe('controller lock', () => {
  it('acquires, refuses a second acquire while held, releases', async () => {
    expect(await acquireControllerLock()).toBe(true);
    expect(await acquireControllerLock()).toBe(false); // this process still holds it
    await releaseControllerLock();
    expect(await acquireControllerLock()).toBe(true);
    await releaseControllerLock();
  });

  it('takes over a stale lock whose pid is dead', async () => {
    // Spawn then reap a process so its pid is certainly gone.
    const dead = spawn('sleep', ['30']);
    const deadPid = dead.pid!;
    const deadStart = processStartTime(deadPid)!;
    await new Promise<void>((resolve) => {
      dead.on('exit', () => resolve());
      dead.kill('SIGKILL');
    });

    const lock: ControllerLock = { v: 1, pid: deadPid, startTime: deadStart };
    const lockPath = join(controllerHome(), 'controller.lock');
    await fs.mkdir(controllerHome(), { recursive: true });
    writeFileSync(lockPath, JSON.stringify(lock));

    // The dead holder is taken over.
    expect(await acquireControllerLock()).toBe(true);
    const held = JSON.parse(readFileSync(lockPath, 'utf-8')) as ControllerLock;
    expect(held.pid).toBe(process.pid);
    await releaseControllerLock();
  });
});

describe('process liveness', () => {
  let child: ChildProcess | undefined;

  afterEach(() => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  });

  it('reads a spawned process alive, then dead after it is killed', async () => {
    child = spawn('sleep', ['30']);
    const pid = child.pid!;
    const start = processStartTime(pid);
    expect(start).toBeTypeOf('number');
    expect(isProcessAlive(pid, start!)).toBe(true);

    // A wrong start time reads dead even while the pid is alive.
    expect(isProcessAlive(pid, start! + 1)).toBe(false);

    await new Promise<void>((resolve) => {
      child!.on('exit', () => resolve());
      child!.kill('SIGKILL');
    });

    expect(isProcessAlive(pid, start!)).toBe(false);
    expect(processStartTime(pid)).toBeUndefined();
  });
});
