import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readRun, writeRun, type RunRecord } from '../state.js';

const base = (status: RunRecord['status']): RunRecord => ({
  v: 1, id: 'run-paused-at', project: 'p', codeRoot: '/c', specStore: '/s', spec: 's',
  worktree: '/w', branch: 'b', status, created: '2026-10-01T00:00:00.000Z',
  updated: '2026-10-01T00:00:00.000Z', tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
});

describe('writeRun stamps pausedAt while a run is stopped', () => {
  let home: string;
  let prev: string | undefined;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'paused-at-'));
    prev = process.env.SDD_HOME;
    process.env.SDD_HOME = home;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.SDD_HOME; else process.env.SDD_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  });

  it('sets it on the write that pauses, keeps it while paused or waiting, clears it on the move', async () => {
    await writeRun(base('running'));
    expect((await readRun('run-paused-at'))?.pausedAt).toBeUndefined();

    await writeRun({ ...(await readRun('run-paused-at'))!, status: 'paused', pauseReason: 'usage-window' });
    const stamped = (await readRun('run-paused-at'))!.pausedAt;
    expect(typeof stamped).toBe('string');

    await writeRun({ ...(await readRun('run-paused-at'))!, status: 'waiting', pauseReason: undefined });
    expect((await readRun('run-paused-at'))!.pausedAt).toBe(stamped);

    await writeRun({ ...(await readRun('run-paused-at'))!, status: 'running' });
    expect((await readRun('run-paused-at'))!.pausedAt).toBeUndefined();
  });
});
