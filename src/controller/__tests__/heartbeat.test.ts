import { describe, it, expect, vi } from 'vitest';
import { createStepHeartbeat } from '../heartbeat.js';

// Contract for src/controller/heartbeat.ts (design.md C3; requirements 1.3, 1.4).
// `now` and `write` are fake per test; `vi.useFakeTimers()` drives the window
// timer so no test waits on a real clock. Each case names its criterion letter
// from task 2's Success line.
//
// (a) pre: a fresh heartbeat, no line() yet.
//     call: hb.line().
//     result: write() runs once, synchronously, with now()'s ISO value.
//     source: design C3 post-condition 1 ("the first line() ... calls write
//     at once with now() and opens a window").
// (b) pre: a window already open from a first line().
//     call: hb.line() again inside that window.
//     result: write() is not called by the second line().
//     source: design C3 post-condition 2.
// (c) pre: a window open with one line recorded in it.
//     call: the window's timer fires (vi.advanceTimersByTime).
//     result: write() runs once with the recorded line's time, and the
//     window that reopens is itself open (a line() right after it does not
//     write immediately).
//     source: design C3 post-condition 3, first branch.
// (d) pre: a window open with no line recorded in it.
//     call: the window's timer fires, then hb.line().
//     result: the timer fires with no write; the next line() writes at once.
//     source: design C3 post-condition 3, second branch, and post-condition 1.
// (e) pre: a window open with one unwritten line recorded.
//     call: hb.end().
//     result: write() runs once with undefined; the cancelled timer firing
//     later causes no further write.
//     source: design C3 post-condition 4 and the timer-cancel half of 5.
// (f) pre: a heartbeat already ended.
//     call: hb.line() and hb.end() again.
//     result: neither calls write().
//     source: design C3 post-condition 4 ("every later line() and end()").
// (g) pre: write() is wired to reject.
//     call: hb.line().
//     result: line() does not throw; the rejection is logged with
//     console.error and never surfaces to the caller.
//     source: design C3 post-condition 5, second half.

function fakeNow(...values: Date[]) {
  const now = vi.fn<() => Date>();
  for (const value of values) now.mockReturnValueOnce(value);
  return now;
}

describe('createStepHeartbeat', () => {
  it('(a) writes at once for the first line() and opens a window', () => {
    const t0 = new Date('2024-01-01T00:00:00.000Z');
    const now = fakeNow(t0);
    const write = vi.fn().mockResolvedValue(undefined);
    const hb = createStepHeartbeat({ now, write, windowMs: 1000 });

    hb.line();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(t0.toISOString());
  });

  it('(b) records a line inside an open window and writes nothing for it', () => {
    const t0 = new Date('2024-01-01T00:00:00.000Z');
    const t1 = new Date('2024-01-01T00:00:00.500Z');
    const now = fakeNow(t0, t1);
    const write = vi.fn().mockResolvedValue(undefined);
    const hb = createStepHeartbeat({ now, write, windowMs: 1000 });

    hb.line();
    write.mockClear();
    hb.line();

    expect(write).not.toHaveBeenCalled();
  });

  it('(c) writes once at the window end with the last line time, then opens a new window', () => {
    vi.useFakeTimers();
    try {
      const t0 = new Date('2024-01-01T00:00:00.000Z');
      const t1 = new Date('2024-01-01T00:00:00.500Z');
      const t2 = new Date('2024-01-01T00:00:00.700Z');
      const now = fakeNow(t0, t1, t2);
      const write = vi.fn().mockResolvedValue(undefined);
      const hb = createStepHeartbeat({ now, write, windowMs: 1000 });

      hb.line();
      hb.line();
      write.mockClear();

      vi.advanceTimersByTime(1000);

      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(t1.toISOString());

      write.mockClear();
      hb.line();

      expect(write).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('(d) closes an idle window with no write, then writes at once on the next line()', () => {
    vi.useFakeTimers();
    try {
      const t0 = new Date('2024-01-01T00:00:00.000Z');
      const t1 = new Date('2024-01-01T00:00:01.500Z');
      const now = fakeNow(t0, t1);
      const write = vi.fn().mockResolvedValue(undefined);
      const hb = createStepHeartbeat({ now, write, windowMs: 1000 });

      hb.line();
      write.mockClear();

      vi.advanceTimersByTime(1000);
      expect(write).not.toHaveBeenCalled();

      hb.line();
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(t1.toISOString());
    } finally {
      vi.useRealTimers();
    }
  });

  it('(e) end() cancels the timer, drops the unwritten line, and writes undefined once', () => {
    vi.useFakeTimers();
    try {
      const t0 = new Date('2024-01-01T00:00:00.000Z');
      const t1 = new Date('2024-01-01T00:00:00.500Z');
      const now = fakeNow(t0, t1);
      const write = vi.fn().mockResolvedValue(undefined);
      const hb = createStepHeartbeat({ now, write, windowMs: 1000 });

      hb.line();
      hb.line();
      write.mockClear();

      hb.end();

      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(undefined);

      write.mockClear();
      vi.advanceTimersByTime(1000);

      expect(write).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('(f) turns every later line() and end() into a no-op', () => {
    const t0 = new Date('2024-01-01T00:00:00.000Z');
    const now = fakeNow(t0, t0, t0, t0);
    const write = vi.fn().mockResolvedValue(undefined);
    const hb = createStepHeartbeat({ now, write, windowMs: 1000 });

    hb.line();
    hb.end();
    write.mockClear();

    hb.line();
    hb.end();

    expect(write).not.toHaveBeenCalled();
  });

  it('(g) logs a rejected write with console.error and keeps it from the caller', async () => {
    const t0 = new Date('2024-01-01T00:00:00.000Z');
    const now = fakeNow(t0);
    const failure = new Error('boom');
    const write = vi.fn().mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hb = createStepHeartbeat({ now, write, windowMs: 1000 });

    expect(() => hb.line()).not.toThrow();

    const pending = write.mock.results[0]!.value as Promise<unknown>;
    await pending.catch(() => {});
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
