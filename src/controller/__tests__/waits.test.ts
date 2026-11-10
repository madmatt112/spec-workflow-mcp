import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  createWait,
  answerWait,
  attachAdvice,
  setOpinionStatus,
  listOpenWaits,
  listWaitsForView,
  listWaitsForWire,
  expireWait,
  openDriveCrashWait,
  DRIVE_CRASH_QUESTION,
  waitEvents,
  RunAbandonedError,
  type ControllerWaitRecord,
} from '../waits.js';
import { readWait, readRun, writeRun, writeWait } from '../state.js';
import type { WaitQuestion, WaitOpinion, RunRecord } from '../state.js';

// Contract for src/controller/waits.ts (controller-tasks.md "T4 waits";
// controller-design.md §7). Each test runs against a fresh temp SDD_HOME so the
// real home is never touched; the spec dir is a separate temp dir.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

let home: string;
let specDir: string;
let savedSddHome: string | undefined;

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-ctrl-waits-'));
  specDir = await fs.mkdtemp(join(tmpdir(), 'sdd-ctrl-specdir-'));
  process.env.SDD_HOME = home;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(specDir, { recursive: true, force: true });
});

const GATE_A_QUESTIONS: WaitQuestion[] = [
  {
    id: 'q1',
    text: 'Should the dashboard own the merge decision?',
    options: ['Yes, auto-merge', 'No, ask first'],
    recommended: 'No, ask first',
  },
  {
    id: 'q2',
    text: 'Which window drives pausing?',
    options: ['Five-hour', 'Seven-day', 'Both'],
    recommended: 'Both',
  },
  {
    id: 'q3',
    text: 'Any scope to cut from this spec?',
    options: ['Keep all', 'Cut the retro'],
  },
];

describe('createWait and the round trip', () => {
  it('writes a record with a w-<8 hex> id that reads back unchanged', async () => {
    const record = await createWait({
      kind: 'gate-a',
      runId: 'run-20261011-120000',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: GATE_A_QUESTIONS,
    });

    expect(record.id).toMatch(/^w-[0-9a-f]{8}$/);
    expect(record.state).toBe('open');
    expect(record.v).toBe(1);
    expect(record.specDir).toBe(specDir);

    const read = (await readWait(record.id)) as ControllerWaitRecord | undefined;
    expect(read).toEqual(record);
  });

  it('lists an open wait, and drops it from the open list once answered', async () => {
    const record = await createWait({
      kind: 'question',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'q', text: 'Which org owns the token?', free: true }],
    });

    expect((await listOpenWaits()).map((w) => w.id)).toEqual([record.id]);

    await answerWait(record.id, { q: 'acme' }, 'operator');
    expect(await listOpenWaits()).toEqual([]);
    expect((await listWaitsForView()).map((w) => w.id)).toEqual([record.id]);
  });
});

describe('createWait stores the ruling evidence (design C1, Requirement 2 AC 1)', () => {
  it('writes detail and commits when both are given, and both read back', async () => {
    const record = await createWait({
      kind: 'escalation',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'ruling', text: 'Rule on task 3', free: true }],
      detail: '## Worker report\n\nfixed it',
      commits: ['abc1234', 'def5678'],
    });

    expect(record.detail).toBe('## Worker report\n\nfixed it');
    expect(record.commits).toEqual(['abc1234', 'def5678']);

    const read = (await readWait(record.id)) as ControllerWaitRecord;
    expect(read.detail).toBe('## Worker report\n\nfixed it');
    expect(read.commits).toEqual(['abc1234', 'def5678']);
  });

  it('stores no commits key when commits is an empty array', async () => {
    const record = await createWait({
      kind: 'escalation',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'ruling', text: 'Rule on task 3', free: true }],
      commits: [],
    });

    expect('commits' in record).toBe(false);

    const read = (await readWait(record.id)) as ControllerWaitRecord;
    expect('commits' in (read as object)).toBe(false);
  });

  it('stores no detail or commits key when neither is given (regression guard, holds at base)', async () => {
    const record = await createWait({
      kind: 'escalation',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'ruling', text: 'Rule on task 3', free: true }],
    });

    expect('detail' in record).toBe(false);
    expect('commits' in record).toBe(false);
  });
});

describe('listWaitsForWire strips commits and specDir (design C1, Requirement 2 AC 12)', () => {
  it('returns the wait with detail, and with no commits or specDir', async () => {
    const record = await createWait({
      kind: 'escalation',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'ruling', text: 'Rule on task 3', free: true }],
      detail: '## Worker report\n\nfixed it',
      commits: ['abc1234'],
    });

    const wire = await listWaitsForWire();
    const found = wire.find((w) => w.id === record.id);

    expect(found?.detail).toBe('## Worker report\n\nfixed it');
    expect(found && 'commits' in found).toBe(false);
    expect(found && 'specDir' in found).toBe(false);
  });
});

describe('answerWait renders the gate receipt', () => {
  it('writes questions.md equal to the gate-a fixture (two answered, one unanswered)', async () => {
    const record = await createWait({
      kind: 'gate-a',
      runId: 'run-20261011-120000',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: GATE_A_QUESTIONS,
    });

    await answerWait(record.id, { q1: 'No, ask first', q2: 'Both' }, 'operator');

    const written = await fs.readFile(join(specDir, 'questions.md'), 'utf-8');
    const fixture = await fs.readFile(join(FIXTURES, 'questions-gate-a.md'), 'utf-8');
    expect(written).toBe(fixture);

    const stored = (await readWait(record.id)) as ControllerWaitRecord;
    expect(stored.state).toBe('answered');
    expect(stored.answer?.q1.value).toBe('No, ask first');
    expect(stored.answer?.q1.by).toBe('operator');
  });

  it('appends one note row to the spec harness-events.jsonl', async () => {
    const record = await createWait({
      kind: 'gate-a',
      runId: 'run-20261011-120000',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: GATE_A_QUESTIONS,
    });

    await answerWait(record.id, { q1: 'No, ask first', q2: 'Both' }, 'operator');

    const ledger = await fs.readFile(join(specDir, 'harness-events.jsonl'), 'utf-8');
    const lines = ledger.trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const note = JSON.parse(lines[0]);
    expect(note.type).toBe('note');
    expect(note.run).toBe('run-20261011-120000');
    expect(note.spec).toBe('controller-waits');
    expect(typeof note.text).toBe('string');
    expect(note.text.length).toBeGreaterThan(0);
    expect(typeof note.ts).toBe('string');
  });
});

describe('retro-plan is stored only', () => {
  it('writes the record but renders no receipt and appends no note', async () => {
    const record = await createWait({
      kind: 'retro-plan',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'd1', text: 'Graduate the lean fixture?', options: ['Yes', 'No'], recommended: 'Yes' }],
      proposals: ['P1 — split the budget', 'P2 — cache the prefix'],
    });

    const result = await answerWait(record.id, { d1: 'Yes', 'proposal:0': 'approve', 'proposal:1': 'drop' }, 'operator');
    expect(result?.state).toBe('answered');

    await expect(fs.readFile(join(specDir, 'questions.md'), 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.readFile(join(specDir, 'harness-events.jsonl'), 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });

    const stored = (await readWait(record.id)) as ControllerWaitRecord;
    expect(stored.proposals).toEqual(['P1 — split the budget', 'P2 — cache the prefix']);
    expect(stored.answer?.['proposal:1'].value).toBe('drop');
  });
});

describe('attachAdvice', () => {
  it('stores advice on the wait', async () => {
    const record = await createWait({
      kind: 'merge',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'merge', text: 'Merge PR #42?', options: ['merge', 'hold'], recommended: 'merge' }],
    });

    const updated = await attachAdvice(record.id, 'Checks are green; merging is safe.');
    expect(updated?.advice).toBe('Checks are green; merging is safe.');

    const stored = (await readWait(record.id)) as ControllerWaitRecord;
    expect(stored.advice).toBe('Checks are green; merging is safe.');
  });

  it('returns undefined for an unknown id', async () => {
    expect(await attachAdvice('w-deadbeef', 'x')).toBeUndefined();
    expect(await answerWait('w-deadbeef', {}, 'operator')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Task 3 — wait opinion fields and per-wait write queue (design C7 "Wait
// writes", D19; Requirement 5.2, 5.3, 5.8).
//
// Contract:
// - 5.2 "stores the opinion beside the advice" — Pre: an open `merge` wait
//   with no advice/opinion. Call: `attachAdvice(id, opinion.summary,
//   opinion)`. Observable: the returned and re-read record both carry
//   `advice === opinion.summary` and `opinion` deep-equal to the typed
//   `WaitOpinion`. Source: design Data Models (`WaitOpinion`, the
//   `attachAdvice` trailing optional argument), Requirement 5.2.
// - 5.8 (regression guard, folded here) "a legacy advice-only record still
//   reads back unchanged" — Pre: the same open wait. Call: `attachAdvice(id,
//   advice)` with no third argument. Observable: `opinion` stays `undefined`
//   on both the returned and the re-read record. Source: Requirement 5.8;
//   already true at base (base `attachAdvice` has no opinion argument at
//   all), so this is a regression guard, not a red test — see the report.
// - "an answerWait and an attachAdvice started together on one id both land,
//   answer kept" — Pre: an open `merge` wait. Call: `answerWait(id, ...)` and
//   `attachAdvice(id, ...)` started together via `Promise.all`. Observable:
//   the re-read record carries both the answer and the advice. Source:
//   design C7 "Wait writes" / D19 (the per-wait queue), task 3 Success.
// - "the opinion-status setter started together with an answerWait on one id
//   serialises through the queue and leaves the answer intact" — Pre: an
//   open `merge` wait. Call: `answerWait(id, ...)` and `setOpinionStatus(id,
//   { state: 'running' })` started together via `Promise.all`. Observable:
//   the re-read record carries both the answer and `opinionStatus.state ===
//   'running'`. Source: design D19, task 3 Success (the exported
//   opinion-status setter).
// - 5.3 (regression guard) "attachAdvice leaves the wait state and the run
//   file unchanged" — Pre: an open wait whose `run` field names a run record
//   on disk. Call: `attachAdvice(id, advice)`. Observable: the wait's
//   `state` stays `open` (not `answered`) and the run record re-read is
//   unchanged. Source: Requirement 5.3; already true at base
//   (`attachAdvice` touches no run and never sets `state`, `controller.ts`
//   `onWaitChange` at 339 acts only on `answered`), so this is a regression
//   guard, not a red test — see the report.

const MERGE_QUESTIONS: WaitQuestion[] = [
  { id: 'merge', text: 'Merge PR #42?', options: ['merge', 'hold'], recommended: 'merge' },
];

describe('attachAdvice carries a typed opinion (5.2)', () => {
  it('stores the opinion beside the advice summary and reads it back', async () => {
    const record = await createWait({
      kind: 'merge',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: MERGE_QUESTIONS,
    });

    const opinion: WaitOpinion = {
      picks: [{ question: 'merge', pick: 'merge', reason: 'Checks are green; CI is clean.' }],
      summary: 'Merging is safe.',
    };
    const updated = await attachAdvice(record.id, opinion.summary, opinion);
    expect(updated?.advice).toBe('Merging is safe.');
    expect(updated?.opinion).toEqual(opinion);

    const stored = (await readWait(record.id)) as ControllerWaitRecord;
    expect(stored.advice).toBe('Merging is safe.');
    expect(stored.opinion).toEqual(opinion);
  });
});

describe('a legacy advice-only attach still reads back unchanged (5.8, regression guard)', () => {
  it('leaves opinion undefined when only advice is given', async () => {
    const record = await createWait({
      kind: 'merge',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: MERGE_QUESTIONS,
    });

    const updated = await attachAdvice(record.id, 'Looks fine.');
    expect(updated?.advice).toBe('Looks fine.');
    expect(updated?.opinion).toBeUndefined();

    const stored = (await readWait(record.id)) as ControllerWaitRecord;
    expect(stored.advice).toBe('Looks fine.');
    expect(stored.opinion).toBeUndefined();
  });
});

describe('wait writes serialise per wait id (design C7 "Wait writes", D19)', () => {
  it('an answerWait and an attachAdvice started together on one id both land; the answer is kept', async () => {
    const record = await createWait({
      kind: 'merge',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: MERGE_QUESTIONS,
    });

    await Promise.all([
      answerWait(record.id, { merge: 'merge' }, 'operator'),
      attachAdvice(record.id, 'Checks are green.'),
    ]);

    const stored = (await readWait(record.id)) as ControllerWaitRecord;
    expect(stored.answer?.merge?.value).toBe('merge');
    expect(stored.advice).toBe('Checks are green.');
  });

  it('the opinion-status setter started together with an answerWait on one id serialises through the queue, leaving the answer intact', async () => {
    const record = await createWait({
      kind: 'merge',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: MERGE_QUESTIONS,
    });

    await Promise.all([
      answerWait(record.id, { merge: 'merge' }, 'operator'),
      setOpinionStatus(record.id, { state: 'running' }),
    ]);

    const stored = (await readWait(record.id)) as ControllerWaitRecord;
    expect(stored.answer?.merge?.value).toBe('merge');
    expect(stored.opinionStatus?.state).toBe('running');
    expect(typeof stored.opinionStatus?.at).toBe('string');
  });
});

describe('attachAdvice leaves the wait state and the run file unchanged (5.3, regression guard)', () => {
  it('does not flip the wait to answered and does not touch the run record', async () => {
    const run: RunRecord = {
      v: 1,
      id: 'run-5.3',
      project: 'proj-1',
      codeRoot: '/tmp/advisor-5-3-code',
      specStore: '/tmp/advisor-5-3-store',
      spec: 'controller-waits',
      worktree: '/tmp/advisor-5-3-worktree',
      branch: 'feat/controller-waits',
      status: 'waiting',
      created: '2026-10-01T00:00:00.000Z',
      updated: '2026-10-01T00:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    await writeRun(run);
    const before = await readRun(run.id); // writeRun stamps pausedAt on a waiting run

    const record = await createWait({
      kind: 'merge',
      runId: run.id,
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: MERGE_QUESTIONS,
    });

    await attachAdvice(record.id, 'Checks are green.');

    const storedWait = (await readWait(record.id)) as ControllerWaitRecord;
    expect(storedWait.state).toBe('open');

    const storedRun = await readRun(run.id);
    expect(storedRun).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Task 5 — the drive-crash wait helpers (design C6; Requirement 2.3, 3.4,
// 3.7).
//
// Contract:
// - (a)+(d) "expireWait turns an open wait expired, writes it, emits change,
//   and writes no receipt or ledger row" — Pre: an open `error` wait whose
//   one question has id `DRIVE_CRASH_QUESTION`. Call: `expireWait(id)`.
//   Observable: the returned record and the re-read record both have
//   `state === 'expired'`; a `waitEvents` `change` listener attached before
//   the call fires once with a record of that id and `state: 'expired'`;
//   `<specDir>/questions.md` and `<specDir>/harness-events.jsonl` are both
//   still absent (ENOENT). Source: design C6 ("an open wait becomes
//   `expired`, is written, and `change` is emitted" / "`expireWait` writes no
//   `questions.md` and no ledger row").
// - (b) "an answered wait returns unchanged with no write and no emit" —
//   Pre: the same kind of wait, already `answerWait`-ed (state `answered`).
//   Call: `expireWait(id)` with a `change` listener attached first.
//   Observable: the return value deep-equals the pre-call stored record (no
//   `expired` flip); the re-read record also deep-equals the pre-call
//   snapshot; the listener is never called. Source: design C6 ("any other
//   state returns unchanged with no write").
// - (c) "an unknown id returns undefined" — Pre: none. Call:
//   `expireWait('w-deadbeef')`. Observable: `undefined`. Source: design C6
//   ("any other state returns unchanged"), mirrored on the existing unknown-id
//   cases for `attachAdvice`/`answerWait` above.
// - (e) "openDriveCrashWait finds the open wait of that run with that
//   question id" — Pre: an open `error` wait for run `run-crash-a` whose
//   question id is `DRIVE_CRASH_QUESTION`. Call:
//   `openDriveCrashWait('run-crash-a')`. Observable: the returned record's
//   `id` equals the created record's `id`. Source: design C6
//   ("the open wait for that run with a question of that id, from
//   `listOpenWaits`").
// - (f.1) "returns undefined for another run's wait" — Pre: the open crash
//   wait for `run-crash-a` from the previous case. Call:
//   `openDriveCrashWait('run-crash-b')`. Observable: `undefined`. Source:
//   design C6, Success (f).
// - (f.2) "returns undefined for an open wait with a different question id"
//   — Pre: an open `error` wait for `run-crash-a` whose question id is not
//   `DRIVE_CRASH_QUESTION`. Call: `openDriveCrashWait('run-crash-a')`.
//   Observable: `undefined`. Source: design C6, Success (f).
// - (f.3) "returns undefined for an answered crash wait" — Pre: an `error`
//   wait for `run-crash-a` with a `DRIVE_CRASH_QUESTION` question, answered
//   (state `answered`). Call: `openDriveCrashWait('run-crash-a')`.
//   Observable: `undefined`, because `listOpenWaits` only returns `state:
//   'open'` records. Source: design C6, Success (f).
// - (g) regression guard (holds at base; task text names it explicitly) —
//   Pre: a wait whose stored `state` is `expired`, written directly through
//   `writeWait` (not through `expireWait`, so the guard stands on its own
//   and does not depend on this task's new code). Call: `listWaitsForView()`.
//   Observable: the result's ids do not include that wait's id. Source:
//   task 5 "Regression guard (holds at base): `listWaitsForView` hides an
//   expired wait (`src/controller/waits.ts:193-198`)."; not forced red — see
//   the report.

const CRASH_QUESTION: WaitQuestion = {
  id: DRIVE_CRASH_QUESTION,
  text: 'step implementation failed inside the controller: boom',
  options: ['retry', 'abandon'],
  recommended: 'retry',
};

describe('expireWait (design C6)', () => {
  it('turns an open wait expired, writes it, emits change, and writes no receipt or ledger row (a, d)', async () => {
    const record = await createWait({
      kind: 'error',
      runId: 'run-crash-a',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [CRASH_QUESTION],
    });

    const seen: ControllerWaitRecord[] = [];
    const onChange = (changed: ControllerWaitRecord) => seen.push(changed);
    waitEvents.on('change', onChange);
    try {
      const result = await expireWait(record.id);
      expect(result?.state).toBe('expired');

      const stored = (await readWait(record.id)) as ControllerWaitRecord;
      expect(stored.state).toBe('expired');

      expect(seen).toHaveLength(1);
      expect(seen[0].id).toBe(record.id);
      expect(seen[0].state).toBe('expired');
    } finally {
      waitEvents.off('change', onChange);
    }

    await expect(fs.readFile(join(specDir, 'questions.md'), 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.readFile(join(specDir, 'harness-events.jsonl'), 'utf-8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('returns an answered wait unchanged with no write and no emit (b)', async () => {
    const record = await createWait({
      kind: 'error',
      runId: 'run-crash-a',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [CRASH_QUESTION],
    });
    await answerWait(record.id, { [DRIVE_CRASH_QUESTION]: 'retry' }, 'operator');
    const before = (await readWait(record.id)) as ControllerWaitRecord;
    expect(before.state).toBe('answered');

    const seen: ControllerWaitRecord[] = [];
    const onChange = (changed: ControllerWaitRecord) => seen.push(changed);
    waitEvents.on('change', onChange);
    try {
      const result = await expireWait(record.id);
      expect(result).toEqual(before);

      const after = (await readWait(record.id)) as ControllerWaitRecord;
      expect(after).toEqual(before);

      expect(seen).toHaveLength(0);
    } finally {
      waitEvents.off('change', onChange);
    }
  });

  it('returns undefined for an unknown id (c)', async () => {
    expect(await expireWait('w-deadbeef')).toBeUndefined();
  });
});

describe('openDriveCrashWait (design C6)', () => {
  it("finds the open wait of that run with that question id (e)", async () => {
    const record = await createWait({
      kind: 'error',
      runId: 'run-crash-a',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [CRASH_QUESTION],
    });

    const found = await openDriveCrashWait('run-crash-a');
    expect(found?.id).toBe(record.id);
  });

  it("returns undefined for another run's wait (f.1)", async () => {
    await createWait({
      kind: 'error',
      runId: 'run-crash-a',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [CRASH_QUESTION],
    });

    expect(await openDriveCrashWait('run-crash-b')).toBeUndefined();
  });

  it('returns undefined for an open wait with a different question id (f.2)', async () => {
    await createWait({
      kind: 'error',
      runId: 'run-crash-a',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [{ id: 'some-other-question', text: 'unrelated', options: ['a', 'b'] }],
    });

    expect(await openDriveCrashWait('run-crash-a')).toBeUndefined();
  });

  it('returns undefined for an answered crash wait (f.3)', async () => {
    const record = await createWait({
      kind: 'error',
      runId: 'run-crash-a',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [CRASH_QUESTION],
    });
    await answerWait(record.id, { [DRIVE_CRASH_QUESTION]: 'retry' }, 'operator');

    expect(await openDriveCrashWait('run-crash-a')).toBeUndefined();
  });
});

describe("listWaitsForView hides an expired wait (regression guard, holds at base)", () => {
  it('omits a wait whose stored state is expired', async () => {
    const record = await createWait({
      kind: 'error',
      runId: 'run-crash-a',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [CRASH_QUESTION],
    });
    const expired = (await readWait(record.id)) as ControllerWaitRecord;
    expired.state = 'expired';
    await writeWait(expired);

    const ids = (await listWaitsForView()).map((w) => w.id);
    expect(ids).not.toContain(record.id);
  });
});

// ---------------------------------------------------------------------------
// Task 17 — the wait guard refuses a wait on an abandoned run (design C7
// "Wait guard", D11; Requirement 7 AC 2, AC 5).
//
// Contract:
// - "createWait on an abandoned run rejects with code 'run-abandoned' and
//   writes no wait record" — Pre: a run record on disk (`writeRun`) with
//   `status: 'abandoned'`, named by `runId`; no open wait exists yet
//   (`listOpenWaits()` empty). Call: `createWait({ ..., runId })` for that
//   run. Observable: the call rejects with a `RunAbandonedError` whose
//   `code` is `'run-abandoned'`; `listOpenWaits()` is still empty afterward
//   (no record written). Source: design C7 "Wait guard" ("`createWait`
//   throws `RunAbandonedError` for an `abandoned` run"), Data Models
//   (`class RunAbandonedError extends Error { readonly code =
//   'run-abandoned'; }`), task 17 Success.
// - [regression guard] "on a running run ... it writes the wait" — Pre: a
//   run record on disk with `status: 'running'`, named by `runId`. Call:
//   `createWait({ ..., runId })`. Observable: the call resolves with a
//   record whose `state` is `'open'`, and `listOpenWaits()` includes its
//   id. Source: task 17 Success ("on a running run and on an unknown id it
//   writes the wait (regression guard)"). This sub-case holds at base (no
//   status guard exists yet) and after the guard lands (the guard only
//   fires on `abandoned`); no existing assertion in this file calls
//   `createWait` against a `running` disk record — the closest, "attachAdvice
//   leaves the wait state and the run file unchanged (5.3)" above, uses
//   `status: 'waiting'` — so this is a fresh guard test named for the
//   implementer brief, not a red test (see the report). The sibling
//   sub-case, "an unknown id (no disk record) still writes the wait",
//   is covered branch-exact by the existing "createWait and the round
//   trip" tests above (e.g. `waits.test.ts` "writes a record with a w-<8
//   hex> id that reads back unchanged", which calls `createWait` with a
//   `runId` that has no backing run record on disk): no new test added for
//   it.
describe('createWait refuses an abandoned run (design C7 "Wait guard", Requirement 7 AC 2, AC 5)', () => {
  function guardRun(id: string, status: RunRecord['status']): RunRecord {
    return {
      v: 1,
      id,
      project: 'proj-1',
      codeRoot: '/tmp/guard-code',
      specStore: '/tmp/guard-store',
      spec: 'controller-waits',
      worktree: '/tmp/guard-worktree',
      branch: 'feat/controller-waits',
      status,
      created: '2026-11-07T00:00:00.000Z',
      updated: '2026-11-07T00:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
  }

  it('rejects with a RunAbandonedError (code run-abandoned) and writes no wait record', async () => {
    const runId = 'run-17-abandoned';
    await writeRun(guardRun(runId, 'abandoned'));
    expect(await listOpenWaits()).toEqual([]);

    await expect(
      createWait({
        kind: 'gate-a',
        runId,
        projectId: 'proj-1',
        spec: 'controller-waits',
        specDir,
        questions: GATE_A_QUESTIONS,
      }),
    ).rejects.toMatchObject({ code: 'run-abandoned' });

    await expect(
      createWait({
        kind: 'gate-a',
        runId,
        projectId: 'proj-1',
        spec: 'controller-waits',
        specDir,
        questions: GATE_A_QUESTIONS,
      }),
    ).rejects.toBeInstanceOf(RunAbandonedError);

    expect(await listOpenWaits()).toEqual([]);
  });

  it('[regression guard] a running run still writes the wait', async () => {
    const runId = 'run-17-running';
    await writeRun(guardRun(runId, 'running'));

    const record = await createWait({
      kind: 'gate-a',
      runId,
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: GATE_A_QUESTIONS,
    });

    expect(record.state).toBe('open');
    expect((await listOpenWaits()).map((w) => w.id)).toEqual([record.id]);
  });
});
