import { describe, it, expect, vi } from 'vitest';
import { branchPresent, forgetBranchPresence, type BranchRead } from '../branch-presence.js';
import type { RunRecord } from '../state.js';

type Run = Pick<RunRecord, 'id' | 'branch' | 'codeRoot'>;

function run(id: string, branch = 'feat/x', codeRoot = '/code/root'): Run {
  return { id, branch, codeRoot };
}

describe('branchPresent', () => {
  // Contract: pre-condition — a run id with no cache entry (forgetBranchPresence
  // called first); call — two overlapping branchPresent(run, read, now) calls with
  // no await between them; observable result — the injected read ran once and both
  // promises resolve to its value; source — design C2 post-conditions ("two
  // overlapping flushes share one read") and NFR Performance.
  it('calls the read once for two overlapping calls on one run, and both resolve to its value', async () => {
    const r = run('run-overlap');
    forgetBranchPresence(r.id);
    let resolveRead!: (v: boolean) => void;
    const read: BranchRead = vi.fn(() => new Promise<boolean>((resolve) => { resolveRead = resolve; }));
    const now = () => 0;

    const p1 = branchPresent(r, read, now);
    const p2 = branchPresent(r, read, now);
    resolveRead(true);

    await expect(p1).resolves.toBe(true);
    await expect(p2).resolves.toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(r.codeRoot, r.branch);
  });

  // Contract: pre-condition — a run with a cached read from a prior call at t=0;
  // call — branchPresent(run, read, now) at t=59999; observable result — the
  // read is not called again and the cached value is returned; source — design
  // C2 ("an entry older than 60,000 ms is re-read") and NFR Performance ("at
  // most once per stopped run per 60 s").
  it('calls no read for a second call 59,999 ms after the first', async () => {
    const r = run('run-under-60s');
    forgetBranchPresence(r.id);
    const read = vi.fn<BranchRead>().mockResolvedValue(true);
    const clock = { value: 0 };
    const now = () => clock.value;

    await expect(branchPresent(r, read, now)).resolves.toBe(true);
    clock.value = 59_999;
    await expect(branchPresent(r, read, now)).resolves.toBe(true);

    expect(read).toHaveBeenCalledTimes(1);
  });

  // Contract: pre-condition — a run with a cached read from a prior call at t=0;
  // call — branchPresent(run, read, now) at t=60000; observable result — the
  // read runs again; source — design C2 ("an entry older than 60,000 ms is
  // re-read") and NFR Performance.
  it('reads again for a second call 60,000 ms after the first', async () => {
    const r = run('run-at-60s');
    forgetBranchPresence(r.id);
    const read = vi.fn<BranchRead>().mockResolvedValue(true);
    const clock = { value: 0 };
    const now = () => clock.value;

    await expect(branchPresent(r, read, now)).resolves.toBe(true);
    clock.value = 60_000;
    await expect(branchPresent(r, read, now)).resolves.toBe(true);

    expect(read).toHaveBeenCalledTimes(2);
  });

  // Contract: pre-condition — a run with a cached read from a prior call;
  // call — forgetBranchPresence(run.id) then branchPresent(run, read, now) at
  // the same instant; observable result — the read runs again even though the
  // entry is not expired; source — the task's own Success line ("forgetBranchPresence
  // makes the next call read").
  it('forgetBranchPresence makes the next call read again', async () => {
    const r = run('run-forget');
    forgetBranchPresence(r.id);
    const read = vi.fn<BranchRead>().mockResolvedValue(true);
    const now = () => 0;

    await expect(branchPresent(r, read, now)).resolves.toBe(true);
    forgetBranchPresence(r.id);
    await expect(branchPresent(r, read, now)).resolves.toBe(true);

    expect(read).toHaveBeenCalledTimes(2);
  });

  // Contract: pre-condition — a run whose branch is the empty string; call —
  // branchPresent(run, read, now); observable result — resolves false and the
  // read is never called; source — design C2 post-conditions ("An empty branch
  // gives false with no read").
  it('gives false with no read for an empty branch', async () => {
    const r = run('run-empty-branch', '');
    forgetBranchPresence(r.id);
    const read = vi.fn<BranchRead>().mockResolvedValue(true);
    const now = () => 0;

    await expect(branchPresent(r, read, now)).resolves.toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  // Contract: pre-condition — a run whose read rejects; call —
  // branchPresent(run, read, now); observable result — resolves false, never
  // throws; source — design C2 post-conditions ("A rejected read gives false")
  // and NFR Reliability ("A failed branch read SHALL report the branch as not
  // present").
  it('gives false for a rejected read', async () => {
    const r = run('run-rejects');
    forgetBranchPresence(r.id);
    const read: BranchRead = vi.fn(() => Promise.reject(new Error('git failed')));
    const now = () => 0;

    await expect(branchPresent(r, read, now)).resolves.toBe(false);
  });

  // Contract: pre-condition — two distinct run ids with fresh cache entries;
  // call — branchPresent for each, then a repeat call for the first at the same
  // instant; observable result — each run id's first call reads, and the
  // repeat for the first run id does not re-read (its entry is independent of
  // the second run id's); source — the task's own Success line ("two run ids
  // hold separate entries").
  it('holds separate cache entries per run id', async () => {
    const a = run('run-a');
    const b = run('run-b');
    forgetBranchPresence(a.id);
    forgetBranchPresence(b.id);
    const read = vi.fn<BranchRead>().mockResolvedValue(true);
    const now = () => 0;

    await expect(branchPresent(a, read, now)).resolves.toBe(true);
    await expect(branchPresent(b, read, now)).resolves.toBe(true);
    await expect(branchPresent(a, read, now)).resolves.toBe(true);

    expect(read).toHaveBeenCalledTimes(2);
  });
});
