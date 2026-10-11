import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  createWait,
  answerWait,
  attachAdvice,
  listOpenWaits,
  listWaitsForView,
  type ControllerWaitRecord,
} from '../waits.js';
import { readWait } from '../state.js';
import type { WaitQuestion } from '../state.js';

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
