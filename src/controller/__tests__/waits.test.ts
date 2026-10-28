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
  type ControllerWaitRecord,
} from '../waits.js';
import { readWait, readRun, writeRun } from '../state.js';
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
