// src/controller/waits.ts
//
// Controller waits: a run's request for the operator (controller-design.md §7,
// controller-tasks.md "T4 waits"). One writer — the controller — through the
// T2 state store (`listWaits`/`readWait`/`writeWait`); every record carries
// `v: 1` and the atomic write lives in `state.ts`. This module adds the create,
// answer and advice operations, renders the gate receipt (`questions.md`) and
// appends the `note` ledger row the supervisor writes today, and emits a
// `change` event so the dashboard server can push the list on every mutation.
//
// The stored record is T2's `WaitRecord`. The controller also needs to know
// where a wait's receipt and note go, so `createWait` is handed a `specDir`
// and the record keeps it (`ControllerWaitRecord`); `retro-plan` waits also
// carry the `proposals` the operator approves. Neither field is part of the
// design §7 wire shape, so the server strips `specDir` before it reaches a
// browser (§17 keeps paths off the LAN) and keeps `proposals` for the sheet.
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import {
  listWaits,
  readWait,
  writeWait,
  type WaitRecord,
  type WaitQuestion,
  type WaitAnswer,
  type WaitKind,
  type WaitOpinion,
  type WaitOpinionStatus,
} from './state.js';

/**
 * A stored wait: T2's `WaitRecord` plus the spec dir its receipt and note are
 * written to, and, for a `retro-plan` wait, the proposal lines to approve. The
 * base record is T2's; this only adds fields, it does not redefine it.
 */
export interface ControllerWaitRecord extends WaitRecord {
  /** Absolute spec dir where `questions.md` and the `note` row are written. */
  specDir: string;
  /** `retro-plan` only: the proposal lines; T6 writes the plan from the answers. */
  proposals?: string[];
}

/** What the controller passes to open a wait (controller-tasks.md T4). */
export interface CreateWaitInput {
  kind: WaitKind;
  runId: string;
  projectId: string;
  spec: string;
  /** Absolute spec dir (`questions.md` and `harness-events.jsonl` live here). */
  specDir: string;
  questions: WaitQuestion[];
  /** `retro-plan` only: the proposal lines the operator approves or drops. */
  proposals?: string[];
}

/**
 * Emits `change` (with the changed `ControllerWaitRecord`) after every create,
 * answer or advice, so the server can rebroadcast the wait list. One shared
 * emitter for the one in-process controller.
 */
export const waitEvents = new EventEmitter();

/**
 * One in-process promise queue per wait id (design C7 "Wait writes", D19), so
 * `answerWait`, `attachAdvice` and `setOpinionStatus` never interleave a
 * read-then-write on the same id and an advice write never overwrites an
 * answer read before it.
 */
const writeQueues = new Map<string, Promise<unknown>>();

function enqueueWaitWrite<T>(id: string, run: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(id) ?? Promise.resolve();
  const next = previous.then(run, run);
  writeQueues.set(
    id,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

/** Open a wait: write the record (`state: open`, id `w-<8 hex>`) and emit. */
export async function createWait(input: CreateWaitInput): Promise<ControllerWaitRecord> {
  const record: ControllerWaitRecord = {
    v: 1,
    id: `w-${randomBytes(4).toString('hex')}`,
    kind: input.kind,
    run: input.runId,
    project: input.projectId,
    spec: input.spec,
    created: new Date().toISOString(),
    questions: input.questions,
    state: 'open',
    specDir: input.specDir,
  };
  if (input.proposals) record.proposals = input.proposals;
  await writeWait(record);
  waitEvents.emit('change', record);
  return record;
}

/**
 * Answer a wait: store the answers keyed by question id (`state: answered`),
 * then — for every kind but `retro-plan` — render the gate receipt and append
 * the `note` ledger row. A `retro-plan` wait only stores the record; T6 writes
 * `retrospective-plan.md` from the answers. Returns the record, or `undefined`
 * when the id is unknown.
 */
export async function answerWait(
  id: string,
  answers: Record<string, string>,
  by: string,
): Promise<ControllerWaitRecord | undefined> {
  return enqueueWaitWrite(id, async () => {
    const record = (await readWait(id)) as ControllerWaitRecord | undefined;
    if (!record) return undefined;

    const now = new Date().toISOString();
    const answer: Record<string, WaitAnswer> = { ...(record.answer ?? {}) };
    for (const [questionId, value] of Object.entries(answers)) {
      answer[questionId] = { value, by, answered: now };
    }
    record.answer = answer;
    record.state = 'answered';
    await writeWait(record);

    if (record.kind !== 'retro-plan') {
      if (record.kind === 'gate-a' || record.kind === 'gate-b') {
        await renderQuestionsMd(record);
      }
      await appendNote(record, by);
    }

    waitEvents.emit('change', record);
    return record;
  });
}

/**
 * Attach an advisor's second opinion to a wait (§7); the operator still
 * answers. `opinion` is the typed second opinion (C7, Data Models); omit it
 * for a legacy advice-only attach. Clears a prior `opinionStatus` (C7: "status
 * cleared"), since fresh advice supersedes it either way.
 */
export async function attachAdvice(
  id: string,
  advice: string,
  opinion?: WaitOpinion,
): Promise<ControllerWaitRecord | undefined> {
  return enqueueWaitWrite(id, async () => {
    const record = (await readWait(id)) as ControllerWaitRecord | undefined;
    if (!record) return undefined;
    record.advice = advice;
    if (opinion) record.opinion = opinion;
    delete record.opinionStatus;
    await writeWait(record);
    waitEvents.emit('change', record);
    return record;
  });
}

/** Set a wait's second-opinion run progress (C7, Data Models). */
export async function setOpinionStatus(
  id: string,
  status: { state: 'running' | 'failed'; reason?: string },
): Promise<ControllerWaitRecord | undefined> {
  return enqueueWaitWrite(id, async () => {
    const record = (await readWait(id)) as ControllerWaitRecord | undefined;
    if (!record) return undefined;
    const opinionStatus: WaitOpinionStatus = {
      state: status.state,
      at: new Date().toISOString(),
      ...(status.reason !== undefined ? { reason: status.reason } : {}),
    };
    record.opinionStatus = opinionStatus;
    await writeWait(record);
    waitEvents.emit('change', record);
    return record;
  });
}

/** Open waits, newest first. */
export async function listOpenWaits(): Promise<ControllerWaitRecord[]> {
  const waits = (await listWaits({ state: 'open' })) as ControllerWaitRecord[];
  return waits.sort((a, b) => b.created.localeCompare(a.created));
}

/** Open and answered waits, newest first (the GET route and the WS payload). */
export async function listWaitsForView(): Promise<ControllerWaitRecord[]> {
  const waits = (await listWaits()) as ControllerWaitRecord[];
  return waits
    .filter((w) => w.state === 'open' || w.state === 'answered')
    .sort((a, b) => b.created.localeCompare(a.created));
}

/** The view list with the local `specDir` stripped, for the wire (design §17). */
export async function listWaitsForWire(): Promise<Omit<ControllerWaitRecord, 'specDir'>[]> {
  return (await listWaitsForView()).map(({ specDir: _specDir, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// The gate receipt (`questions.md`) and the `note` ledger row.
// ---------------------------------------------------------------------------

/** `gate-a` → `Gate A`, `gate-b` → `Gate B`. */
function gateHeading(kind: WaitKind): string {
  return kind === 'gate-a' ? 'Gate A' : 'Gate B';
}

/**
 * One gate section: the heading, then per question its text, its options (when
 * it has them) and the pick, with `no answer` where the question is unanswered.
 * This is the shape the supervisor writes today (sdd-continue gate A receipt,
 * document-phase `gates.md`).
 */
function gateSection(record: ControllerWaitRecord): string {
  const parts: string[] = [`## ${gateHeading(record.kind)}`, ''];
  record.questions.forEach((q, i) => {
    parts.push(`${i + 1}. ${q.text}`);
    if (q.options && q.options.length > 0) {
      parts.push(`   Options: ${q.options.join(' | ')}`);
    }
    const pick = record.answer?.[q.id]?.value;
    parts.push(`   Answer: ${pick && pick.length > 0 ? pick : 'no answer'}`);
    parts.push('');
  });
  return parts.join('\n').replace(/\s+$/, '') + '\n';
}

/**
 * Write the gate section into `<specDir>/questions.md`, replacing an existing
 * section with the same heading and keeping any other (so answering Gate B
 * after Gate A keeps both).
 */
async function renderQuestionsMd(record: ControllerWaitRecord): Promise<void> {
  const path = join(record.specDir, 'questions.md');
  const section = gateSection(record);

  let existing = '';
  try {
    existing = await fs.readFile(path, 'utf-8');
  } catch {
    existing = '';
  }

  await fs.mkdir(record.specDir, { recursive: true });
  await fs.writeFile(path, upsertSection(existing, gateHeading(record.kind), section), 'utf-8');
}

/** Replace the `## <heading>` section with `section`, or append it when absent. */
function upsertSection(existing: string, heading: string, section: string): string {
  const trimmed = existing.replace(/\s+$/, '');
  if (!trimmed) return section;
  const chunks = trimmed.split(/\n(?=## )/);
  const kept = chunks.filter((c) => !c.startsWith(`## ${heading}`));
  kept.push(section.replace(/\n$/, ''));
  return kept.join('\n\n') + '\n';
}

/** A one-line human summary for the `note` ledger row. */
function noteText(record: ControllerWaitRecord, by: string): string {
  const picks = record.questions.map((q) => record.answer?.[q.id]?.value ?? 'no answer');
  const detail = picks.length > 0 ? `: ${picks.join('; ')}` : '';
  return `${record.kind} answered by ${by}${detail}`;
}

/**
 * Append one `note` row to the spec's `harness-events.jsonl`, in the Run-ledger
 * format (`{ts, run, spec, type:'note', text}`). Written directly, not through
 * the T3 ledger module, which is not merged.
 */
async function appendNote(record: ControllerWaitRecord, by: string): Promise<void> {
  const line = {
    ts: new Date().toISOString(),
    run: record.run,
    spec: record.spec,
    type: 'note' as const,
    text: noteText(record, by),
  };
  await fs.mkdir(record.specDir, { recursive: true });
  await fs.appendFile(join(record.specDir, 'harness-events.jsonl'), JSON.stringify(line) + '\n', 'utf-8');
}
