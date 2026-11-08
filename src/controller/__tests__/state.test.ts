import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, type ChildProcess } from 'child_process';
import {
  controllerHome,
  listRuns,
  readRun,
  writeRun,
  updateRun,
  writeLastActivity,
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
  readProjects,
  rememberProject,
  pruneMissingProjects,
  shownName,
  setProjectDisplayName,
  type RunRecord,
  type WaitRecord,
  type QueueFile,
  type RateLimitFile,
  type ControllerLock,
  type KnownProject,
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

/**
 * Contract for `writeLastActivity` and the `lastActivity` carry-over in
 * `writeRun` (design C1; task 1; Requirements 1.1, 1.5, 1.6, 1.7). Per
 * success criterion of the task's Success line:
 *
 * (a) "a stale writeRun keeps the on-disk value": pre — a run whose
 *     `lastActivity` was set by `writeLastActivity`; call — `writeRun(record)`
 *     with a record read before that write (no `lastActivity` of its own,
 *     no opts); result — the on-disk value survives; source — design C1's
 *     `writeRunLocked` change ("takes lastActivity from disk"), Requirement
 *     1.5.
 * (b) "the same with ownsPauseRequest": as (a) but
 *     `writeRun(record, { ownsPauseRequest: true })`; result — the on-disk
 *     `lastActivity` still survives, because the option governs only
 *     `pauseRequested`; source — design C1 ("pauseRequested keeps its
 *     rule"), Requirement 1.5.
 * (c) "a value on the record passed to writeRun is ignored": pre — a run
 *     whose `lastActivity` was set by `writeLastActivity`; call —
 *     `writeRun(record)` where `record.lastActivity` carries a different,
 *     explicit value; result — the disk value is kept, not the record's;
 *     source — design C1 ("always ignoring the value on the record passed
 *     in").
 * (d) "a writeRun to done, to abandoned and to error each drops the field":
 *     pre — a run whose `lastActivity` is set; call — `writeRun(record)`
 *     with that terminal status; result — `lastActivity` absent; source —
 *     Requirement 1.7.
 * (e) "writeLastActivity changes only lastActivity and updated": pre — a run
 *     with `phase`, `cursor` and `pauseRequested` set; call —
 *     `writeLastActivity(id, value, updated)`; result — every other field
 *     unchanged, `lastActivity` and `updated` hold the new values; source —
 *     Requirement 1.6, design C1 post-condition 2.
 * (f) "queued behind a status write, it keeps that status": pre — a
 *     `running` run; call — `writeRun(record with a new status)`, then
 *     without awaiting it, `writeLastActivity(id, value, updated)` for the
 *     same id; result — the settled record carries the new status and the
 *     new `lastActivity`; source — Requirement 1.6 ("the status change
 *     shall survive the heartbeat write"), design C1 post-condition 1
 *     (queued behind `writeRun` on `writeChains`).
 * (g) "it resolves undefined and writes nothing", three sub-cases — a
 *     missing run, a terminal run, and an undefined value on an
 *     already-absent field; source — design C1 post-condition 3.
 * (h) "otherwise it resolves the record written": pre — a non-terminal run;
 *     call — `writeLastActivity(id, value, updated)`; result — resolves the
 *     full written record; source — design C1 post-condition 3.
 */
describe('writeLastActivity and the lastActivity carry-over in writeRun', () => {
  function runWith(overrides: Record<string, unknown> = {}): RunRecord {
    return { ...sampleRun('run-heartbeat'), ...overrides } as RunRecord;
  }

  it('(a) a stale writeRun keeps the on-disk lastActivity value', async () => {
    const run = runWith({ status: 'running' });
    await writeRun(run);
    await writeLastActivity(run.id, '2026-11-03T10:00:00.000Z', '2026-11-03T10:00:00.000Z');

    await writeRun(runWith({ status: 'running' })); // stale: no lastActivity, no opts

    const record = (await readRun(run.id)) as any;
    expect(record.lastActivity).toBe('2026-11-03T10:00:00.000Z');
  });

  it('(b) the same holds for a stale write that owns pauseRequested', async () => {
    const run = runWith({ status: 'running' });
    await writeRun(run);
    await writeLastActivity(run.id, '2026-11-03T10:00:00.000Z', '2026-11-03T10:00:00.000Z');

    await writeRun(runWith({ status: 'running' }), { ownsPauseRequest: true });

    const record = (await readRun(run.id)) as any;
    expect(record.lastActivity).toBe('2026-11-03T10:00:00.000Z');
  });

  it('(c) a value on the record passed to writeRun is ignored', async () => {
    const run = runWith({ status: 'running' });
    await writeRun(run);
    await writeLastActivity(run.id, '2026-11-03T10:00:00.000Z', '2026-11-03T10:00:00.000Z');

    await writeRun(runWith({ status: 'running', lastActivity: '1999-01-01T00:00:00.000Z' }));

    const record = (await readRun(run.id)) as any;
    expect(record.lastActivity).toBe('2026-11-03T10:00:00.000Z');
  });

  it.each(['done', 'abandoned', 'error'] as const)(
    '(d) a writeRun to %s drops lastActivity',
    async (status) => {
      const run = runWith({ status: 'running' });
      await writeRun(run);
      await writeLastActivity(run.id, '2026-11-03T10:00:00.000Z', '2026-11-03T10:00:00.000Z');

      await writeRun(runWith({ status }));

      const record = (await readRun(run.id)) as any;
      expect(record.lastActivity).toBeUndefined();
    },
  );

  it('(e) writeLastActivity changes only lastActivity and updated', async () => {
    const run = runWith({
      status: 'running',
      phase: 'implementation',
      pauseRequested: '2026-11-03T09:00:00.000Z',
    });
    await writeRun(run, { ownsPauseRequest: true });

    const written = (await writeLastActivity(
      run.id,
      '2026-11-03T10:30:00.000Z',
      '2026-11-03T10:30:05.000Z',
    )) as any;

    expect(written?.lastActivity).toBe('2026-11-03T10:30:00.000Z');
    expect(written?.updated).toBe('2026-11-03T10:30:05.000Z');
    expect(written?.phase).toBe('implementation');
    expect(written?.pauseRequested).toBe('2026-11-03T09:00:00.000Z');
    expect(written?.cursor).toEqual(run.cursor);
    expect(written?.status).toBe('running');
  });

  it('(f) queued behind a status write, it keeps that status', async () => {
    const run = runWith({ status: 'running' });
    await writeRun(run);

    const statusWrite = writeRun(runWith({ status: 'waiting' }));
    const heartbeatWrite = writeLastActivity(run.id, '2026-11-03T11:00:00.000Z', '2026-11-03T11:00:00.000Z');
    await Promise.all([statusWrite, heartbeatWrite]);

    const record = (await readRun(run.id)) as any;
    expect(record.status).toBe('waiting');
    expect(record.lastActivity).toBe('2026-11-03T11:00:00.000Z');
  });

  describe('(g) resolves undefined and writes nothing', () => {
    it('for a missing run', async () => {
      const result = await writeLastActivity('no-such-run', '2026-11-03T10:00:00.000Z', '2026-11-03T10:00:00.000Z');

      expect(result).toBeUndefined();
      expect(await readRun('no-such-run')).toBeUndefined();
    });

    it('for a terminal run', async () => {
      const run = runWith({ status: 'done' });
      await writeRun(run);

      const result = await writeLastActivity(run.id, '2026-11-03T10:00:00.000Z', '2026-11-03T10:00:00.000Z');

      expect(result).toBeUndefined();
      const record = (await readRun(run.id)) as any;
      expect(record.lastActivity).toBeUndefined();
      expect(record.updated).toBe(run.updated);
    });

    it('for an undefined value on an already-absent field', async () => {
      const run = runWith({ status: 'running' });
      await writeRun(run);

      const result = await writeLastActivity(run.id, undefined, '2026-11-03T12:00:00.000Z');

      expect(result).toBeUndefined();
      const record = (await readRun(run.id)) as any;
      expect(record.lastActivity).toBeUndefined();
      expect(record.updated).toBe(run.updated);
    });
  });

  it('(h) otherwise it resolves the record written', async () => {
    const run = runWith({ status: 'running' });
    await writeRun(run);

    const written = await writeLastActivity(run.id, '2026-11-03T13:00:00.000Z', '2026-11-03T13:00:05.000Z');

    expect(written).toEqual({
      ...run,
      lastActivity: '2026-11-03T13:00:00.000Z',
      updated: '2026-11-03T13:00:05.000Z',
    });
  });
});

// Contract for the abandoned-final status guard (design C7 "Status guard",
// D10; requirement 7 AC 3, AC 4). Per success criterion:
// - A `running`, `waiting`, `queued`, `done` or `error` write over an
//   `abandoned` run resolves `false` and leaves the on-disk record
//   byte-identical. Pre: a run on disk at `abandoned`. Call:
//   `writeRun(record)` with that status. Result: `false`, raw file bytes
//   unchanged. Source: design C7 "Status guard"; Requirement 7 AC 3.
// - An `abandoned` write over an `abandoned` run resolves `true`. Pre: a run
//   on disk at `abandoned`. Call: `writeRun(record)` with status
//   `abandoned`. Result: `true`. Source: design C7 "Status guard".
// - A first write (no on-disk record yet) resolves `true`. Pre: no record
//   for the id. Call: `writeRun(record)`. Result: `true`. Source: design C7
//   "Status guard" (the guard only fires when disk already holds
//   `abandoned`).
// - A write over a non-abandoned run resolves `true`. Pre: a run on disk at
//   `running`. Call: `writeRun(record)` with status `waiting`. Result:
//   `true`. Source: design C7 "Status guard".
// - `updateRun` whose `fn` sets `running` on an abandoned run returns the
//   abandoned record, unwritten. Pre: a run on disk at `abandoned`. Call:
//   `updateRun(id, (run) => ({ ...run, status: 'running' }))`. Result: the
//   resolved record's `status` is `abandoned`. Source: design C7 "Status
//   guard" ("`updateRun` passes through it"); Requirement 7 AC 3, AC 4.
describe('writeRun resolves whether it wrote (design C7, Requirement 7 AC 3, AC 4)', () => {
  it.each(['running', 'waiting', 'queued', 'done', 'error'] as const)(
    'a %s write over an abandoned run resolves false and leaves the record byte-identical',
    async (status) => {
      const id = `run-abandoned-guard-${status}`;
      await writeRun({ ...sampleRun(id), status: 'abandoned' });
      const runJson = join(controllerHome(), 'runs', id, 'run.json');
      const before = readFileSync(runJson, 'utf-8');

      const wrote = await writeRun({ ...sampleRun(id), status });

      expect(wrote).toBe(false);
      expect(readFileSync(runJson, 'utf-8')).toBe(before);
    },
  );

  it('an abandoned write over an abandoned run resolves true', async () => {
    const id = 'run-abandoned-over-abandoned';
    await writeRun({ ...sampleRun(id), status: 'abandoned' });

    const wrote = await writeRun({ ...sampleRun(id), status: 'abandoned' });

    expect(wrote).toBe(true);
  });

  it('a first write for a new run resolves true', async () => {
    const wrote = await writeRun(sampleRun('run-first-write'));

    expect(wrote).toBe(true);
  });

  it('a write over a non-abandoned run resolves true', async () => {
    const id = 'run-non-abandoned-overwrite';
    await writeRun({ ...sampleRun(id), status: 'running' });

    const wrote = await writeRun({ ...sampleRun(id), status: 'waiting' });

    expect(wrote).toBe(true);
  });

  it('updateRun setting running on an abandoned run returns the abandoned record, unwritten', async () => {
    const id = 'run-updateRun-abandoned';
    await writeRun({ ...sampleRun(id), status: 'abandoned' });

    const result = await updateRun(id, (run) => ({ ...run, status: 'running' }));

    expect(result?.status).toBe('abandoned');
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

/**
 * Task 5 — `pruneMissingProjects` (design C5; requirement 4's acceptance
 * criteria 2, 7 and 8).
 *
 * Contract per case:
 * - AC2/AC7 ("remove from projects.json every entry whose path does not
 *   exist, and shall not list it" / "log one line naming the file, the
 *   project id and the missing path"): pre-condition is two remembered
 *   projects, one whose path the predicate calls missing; call
 *   `pruneMissingProjects(isMissing)`; observable result is the returned
 *   dropped-entry array, `readProjects()` no longer listing the dropped id,
 *   and a `console.error` line naming the id, the `projects.json` path and
 *   the missing path; expected values come from design C5's log format and
 *   AC2's "shall not list it".
 * - AC2 ("writes once if anything dropped" — the converse): pre-condition is
 *   a remembered project the predicate never calls missing; call
 *   `pruneMissingProjects(isMissing)`; observable result is the file's inode
 *   unchanged (no atomic-rename write happened) and an empty returned array;
 *   expected value comes from design C5's "writes once if anything dropped".
 * - AC8 ("the startup removal shall not drop an entry the controller
 *   remembered ... concurrently ... shall serialize with those writes"):
 *   pre-condition is a prune blocked mid-flight on a deferred `isMissing`
 *   result while a `rememberProject` call starts; call both, then resolve
 *   the deferred; observable result is `readProjects()` after both settle
 *   listing the remembered project and omitting the dropped one; expected
 *   value comes from AC8 itself.
 * - AC8 lock-miss side ("throws when the lock is not acquired, like
 *   `withStoreLock`"): pre-condition is `projects.json.lock` held by another
 *   writer; call `pruneMissingProjects` and `rememberProject` concurrently;
 *   observable result is the prune resolving to `[]` and the remember call
 *   rejecting; expected value comes from design C5's lock-miss clause.
 */
describe('pruneMissingProjects', () => {
  const fixedNow = () => new Date('2026-10-20T00:00:00.000Z');

  function sampleKnown(overrides: Partial<Omit<KnownProject, 'seen'>>): Omit<KnownProject, 'seen'> {
    return {
      id: 'proj-a',
      workspacePath: '/code/proj-a',
      workflowRootPath: '/code/proj-a',
      name: 'Proj A',
      ...overrides,
    };
  }

  it('drops and returns the entry whose path is missing, keeps the other, and logs the id, the projects.json path and the missing path', async () => {
    const a = sampleKnown({ id: 'proj-a', workspacePath: '/code/proj-a', workflowRootPath: '/code/proj-a', name: 'Proj A' });
    const b = sampleKnown({ id: 'proj-b', workspacePath: '/code/proj-b', workflowRootPath: '/code/proj-b', name: 'Proj B' });
    await rememberProject(a, fixedNow);
    await rememberProject(b, fixedNow);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const isMissing = async (path: string) => path === '/code/proj-a';

      const dropped = await pruneMissingProjects(isMissing);

      expect(dropped).toEqual([{ ...a, seen: '2026-10-20T00:00:00.000Z' }]);

      const file = await readProjects();
      expect(file.projects.map((p) => p.id)).toEqual(['proj-b']);

      const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('proj-a');
      expect(logged).toContain(join(home, 'projects.json'));
      expect(logged).toContain('/code/proj-a');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('writes nothing and returns [] when nothing is missing', async () => {
    const a = sampleKnown({ id: 'proj-a', workspacePath: '/code/proj-a', workflowRootPath: '/code/proj-a', name: 'Proj A' });
    await rememberProject(a, fixedNow);

    const projectsFile = join(home, 'projects.json');
    const before = await fs.stat(projectsFile);
    const bytesBefore = await fs.readFile(projectsFile, 'utf-8');

    const dropped = await pruneMissingProjects(async () => false);

    expect(dropped).toEqual([]);
    const after = await fs.stat(projectsFile);
    expect(after.ino).toBe(before.ino);
    expect(await fs.readFile(projectsFile, 'utf-8')).toBe(bytesBefore);
  });

  it('a rememberProject started while a prune waits on a deferred isMissing result is present after both settle', async () => {
    const a = sampleKnown({ id: 'proj-a', workspacePath: '/code/proj-a', workflowRootPath: '/code/proj-a', name: 'Proj A' });
    const b = sampleKnown({ id: 'proj-b', workspacePath: '/code/proj-b', workflowRootPath: '/code/proj-b', name: 'Proj B' });
    await rememberProject(a, fixedNow);
    await rememberProject(b, fixedNow);

    let resolveStarted!: () => void;
    const started = new Promise<void>((r) => { resolveStarted = r; });
    let resolveMissing!: (value: boolean) => void;
    const missing = new Promise<boolean>((r) => { resolveMissing = r; });

    const isMissing = async (path: string): Promise<boolean> => {
      if (path === '/code/proj-a') {
        resolveStarted();
        return missing;
      }
      return false;
    };

    const prunePromise = pruneMissingProjects(isMissing);
    await started; // the prune holds the lock and is now awaiting our deferred

    const newProject = sampleKnown({ id: 'proj-new', workspacePath: '/code/new', workflowRootPath: '/code/new', name: 'New Project' });
    const rememberPromise = rememberProject(newProject, fixedNow);

    // Give the queued rememberProject a chance to attempt (and block on) the lock.
    await new Promise((r) => setTimeout(r, 50));
    resolveMissing(true);

    const [dropped] = await Promise.all([prunePromise, rememberPromise]);

    expect(dropped.map((p: KnownProject) => p.id)).toEqual(['proj-a']);
    const file = await readProjects();
    expect(file.projects.map((p) => p.id).sort()).toEqual(['proj-b', 'proj-new']);
  });

  it(
    'with the lock held, pruneMissingProjects returns [] and rememberProject rejects',
    async () => {
      const lockPath = join(home, 'projects.json.lock');
      await fs.mkdir(home, { recursive: true });
      await fs.writeFile(lockPath, JSON.stringify({ pid: 999999, hostname: 'other-host', token: 'other' }), 'utf-8');

      const a = sampleKnown({ id: 'proj-a', workspacePath: '/code/proj-a', workflowRootPath: '/code/proj-a', name: 'Proj A' });

      const [pruneOutcome, rememberOutcome] = await Promise.allSettled([
        pruneMissingProjects(async () => true),
        rememberProject(a, fixedNow),
      ]);

      expect(pruneOutcome).toEqual({ status: 'fulfilled', value: [] });
      expect(rememberOutcome.status).toBe('rejected');
    },
    15000
  );
});

// Contract for design C1 (requirement 1 AC 3): a durable displayName that
// re-registration and a restart cannot touch.
//
// shownName(p) — pure, no seam I/O.
//   - pre: p = { name: 'Proj A', displayName: 'tradr app' }
//     call: shownName(p)
//     result: 'tradr app' (design C1: "returns `displayName` when set")
//   - pre: p = { name: 'Proj A' } (no displayName)
//     call: shownName(p)
//     result: 'Proj A' (design C1: "... and `name` when not")
//
// setProjectDisplayName(id, displayName) — under withProjectsLock.
//   - pre: projects.json has a row with id 'proj-a'
//     call: setProjectDisplayName('proj-a', 'tradr app')
//     result: resolves true; the row in projects.json gains displayName
//       'tradr app' (Success: "stores a name and returns true")
//   - pre: the row for 'proj-a' already has displayName 'tradr app'
//     call: setProjectDisplayName('proj-a', null)
//     result: resolves true; the row has no `displayName` key at all
//       (Success: "null removes the key and returns true"; Restriction:
//       "never write a displayName key on a row that has none")
//   - pre: projects.json has no row with id 'does-not-exist'
//     call: setProjectDisplayName('does-not-exist', 'X')
//     result: resolves false; projects.json's bytes and inode are
//       unchanged (Success: "an unknown id returns false and writes
//       nothing")
//
// rememberProject(project, now) — keeps an existing row's displayName.
//   - pre: the row for 'proj-a' has displayName 'tradr app' and name 'Old Name'
//     call: rememberProject({ id: 'proj-a', ..., name: 'New Generated Name' }, later)
//     result: the row keeps displayName 'tradr app', and name/seen are
//       refreshed to 'New Generated Name' / later's ISO time (Success:
//       "rememberProject on a named row keeps displayName and refreshes
//       name and seen")
//   - pre: the row for 'proj-a' has no displayName
//     call: rememberProject({ id: 'proj-a', ..., name: 'New Generated Name' }, now)
//     result: the row still has no `displayName` key (Success: "rememberProject
//       on an unnamed row adds no key")
describe('display names (design C1)', () => {
  const fixedNow = () => new Date('2026-11-07T00:00:00.000Z');
  const laterNow = () => new Date('2026-11-07T01:00:00.000Z');

  function sampleKnown(overrides: Partial<Omit<KnownProject, 'seen'>>): Omit<KnownProject, 'seen'> {
    return {
      id: 'proj-a',
      workspacePath: '/code/proj-a',
      workflowRootPath: '/code/proj-a',
      name: 'Proj A',
      ...overrides,
    };
  }

  describe('shownName', () => {
    it('returns the display name when set', () => {
      expect(shownName({ name: 'Proj A', displayName: 'tradr app' })).toBe('tradr app');
    });

    it('returns the generated name when no display name is set', () => {
      expect(shownName({ name: 'Proj A' })).toBe('Proj A');
    });
  });

  describe('setProjectDisplayName', () => {
    it('stores a name and returns true', async () => {
      await rememberProject(sampleKnown({}), fixedNow);

      const result = await setProjectDisplayName('proj-a', 'tradr app');

      expect(result).toBe(true);
      const file = await readProjects();
      const row = file.projects.find((p) => p.id === 'proj-a');
      expect(row?.displayName).toBe('tradr app');
    });

    it('null removes the key and returns true', async () => {
      await rememberProject(sampleKnown({}), fixedNow);
      await setProjectDisplayName('proj-a', 'tradr app');

      const result = await setProjectDisplayName('proj-a', null);

      expect(result).toBe(true);
      const file = await readProjects();
      const row = file.projects.find((p) => p.id === 'proj-a');
      expect(row).toBeDefined();
      expect(Object.keys(row!)).not.toContain('displayName');
    });

    it('an unknown id returns false and writes nothing', async () => {
      await rememberProject(sampleKnown({}), fixedNow);
      const projectsFile = join(home, 'projects.json');
      const before = await fs.stat(projectsFile);
      const bytesBefore = await fs.readFile(projectsFile, 'utf-8');

      const result = await setProjectDisplayName('does-not-exist', 'X');

      expect(result).toBe(false);
      const after = await fs.stat(projectsFile);
      expect(after.ino).toBe(before.ino);
      expect(await fs.readFile(projectsFile, 'utf-8')).toBe(bytesBefore);
    });
  });

  describe('rememberProject keeps an existing displayName', () => {
    it('on a named row keeps displayName and refreshes name and seen', async () => {
      await rememberProject(sampleKnown({ name: 'Old Name' }), fixedNow);
      await setProjectDisplayName('proj-a', 'tradr app');

      await rememberProject(sampleKnown({ name: 'New Generated Name' }), laterNow);

      const file = await readProjects();
      const row = file.projects.find((p) => p.id === 'proj-a');
      expect(row?.displayName).toBe('tradr app');
      expect(row?.name).toBe('New Generated Name');
      expect(row?.seen).toBe('2026-11-07T01:00:00.000Z');
    });

    it('on an unnamed row adds no key', async () => {
      await rememberProject(sampleKnown({ name: 'Old Name' }), fixedNow);

      await rememberProject(sampleKnown({ name: 'New Generated Name' }), fixedNow);

      const file = await readProjects();
      const row = file.projects.find((p) => p.id === 'proj-a');
      expect(row).toBeDefined();
      expect(Object.keys(row!)).not.toContain('displayName');
    });
  });
});
