import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readRun, writeRun, readRunSync, controllerHome, type RunRecord } from '../state.js';

// Contract for the durable hold (design C1; requirements 2.5, 2.7, 3.5, 5.1, NFR
// Reliability). Each test runs against a fresh temp SDD_HOME, as paused-at.test.ts
// does, so the real home is never touched.
//
// Per success criterion:
// - A normal write (no `ownsPauseRequest`) over an on-disk `pauseRequested` keeps
//   it. Pre: a run held via an owned write. Call: `writeRun(record)` with a record
//   that carries no `pauseRequested`. Result: the field survives on disk, unchanged.
//   Source: design C1 post-condition 2; Requirement 2 AC 7.
// - A write with a terminal status (`done`, `abandoned`, `error`) drops
//   `pauseRequested` whatever the options. Pre: a run held via an owned write.
//   Call: `writeRun(record, { ownsPauseRequest: true })` with that status. Result:
//   the field is absent. Source: design C1 post-condition 4; Requirements 2.5, 3.5.
// - A stale normal write and an owned set started together through `Promise.all`
//   end with the field set. Pre: a run held via an owned write (call order 1).
//   Call: `Promise.all([writeRun(owned set, opts), writeRun(stale normal)])`
//   (the normal write is call order 2, so it must read the owned write's result
//   rather than clobber it). Result: the field is present afterward. Source:
//   design C1 post-condition 1 ("serialised ... in call order"); NFR Reliability.
// - `readRunSync` returns the record `writeRun` wrote; `undefined` for a missing
//   id; `undefined` for an unparsable file. Source: design C1's `readRunSync`
//   interface line.
//
// Note (not a red test): an owned write that sets the field, and an owned write
// whose record carries no field, already behave correctly at base — `writeRun`
// today just spreads whatever the caller's record carries, so this case needs no
// red test (regression guard for the implementer brief).

const RUN_ID = 'run-pause-request';

function base(status: RunRecord['status'], extra: { pauseRequested?: string } = {}): RunRecord {
  return {
    v: 1, id: RUN_ID, project: 'p', codeRoot: '/c', specStore: '/s', spec: 's',
    worktree: '/w', branch: 'b', status, created: '2026-10-01T00:00:00.000Z',
    updated: '2026-10-01T00:00:00.000Z', tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    ...extra,
  } as RunRecord;
}

let home: string;
let prev: string | undefined;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'pause-request-'));
  prev = process.env.SDD_HOME;
  process.env.SDD_HOME = home;
});
afterEach(() => {
  if (prev === undefined) delete process.env.SDD_HOME; else process.env.SDD_HOME = prev;
  rmSync(home, { recursive: true, force: true });
});

describe('writeRun carries pauseRequested from disk unless the writer owns it', () => {
  it('a normal write over an on-disk pauseRequested keeps it', async () => {
    await writeRun(base('running', { pauseRequested: '2026-10-29T10:00:00.000Z' }), { ownsPauseRequest: true } as any);

    await writeRun(base('running')); // normal write, no opts, record carries no pauseRequested

    const record = await readRun(RUN_ID);
    expect((record as any)?.pauseRequested).toBe('2026-10-29T10:00:00.000Z');
  });

  it.each(['done', 'abandoned', 'error'] as const)(
    'a write with status %s drops pauseRequested whatever the options',
    async (status) => {
      await writeRun(base('running', { pauseRequested: '2026-10-29T10:00:00.000Z' }), { ownsPauseRequest: true } as any);

      await writeRun(base(status, { pauseRequested: '2026-10-29T10:00:00.000Z' }), { ownsPauseRequest: true } as any);

      const record = await readRun(RUN_ID);
      expect((record as any)?.pauseRequested).toBeUndefined();
    },
  );

  it('a stale normal write and an owned set started together end with the field set', async () => {
    // Repeated: a single trial can land either order at base roughly 5% of the
    // time by filesystem-scheduling luck alone; five trials make an accidental
    // all-pass at base implausible (<1e-6) while a correct, call-order-serialised
    // writeRun passes every trial deterministically.
    for (let i = 0; i < 5; i++) {
      await writeRun(base('running', { pauseRequested: `seed-${i}` }), { ownsPauseRequest: true } as any);

      const owned = writeRun(base('running', { pauseRequested: `new-${i}` }), { ownsPauseRequest: true } as any); // call order 1
      const stale = writeRun(base('running')); // call order 2: a normal write with no pauseRequested of its own
      await Promise.all([owned, stale]);

      const record = await readRun(RUN_ID);
      expect((record as any)?.pauseRequested).toBe(`new-${i}`);
    }
  });
});

describe('readRunSync', () => {
  it('returns the record writeRun wrote', async () => {
    await writeRun(base('running', { pauseRequested: '2026-10-29T10:00:00.000Z' }), { ownsPauseRequest: true } as any);

    expect(readRunSync(RUN_ID)).toEqual(await readRun(RUN_ID));
  });

  it('returns undefined for a missing run', () => {
    expect(readRunSync('no-such-run')).toBeUndefined();
  });

  it('returns undefined for an unparsable file', () => {
    const dir = join(controllerHome(), 'runs', 'bad-run');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'run.json'), '{not valid json', 'utf-8');

    expect(readRunSync('bad-run')).toBeUndefined();
  });
});
