import { describe, it, expect, beforeAll } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Contract for dashboard-ruling-view task 10 (design C8 "Ruling view
// (frontend)" and C9 "Answer stage and the retained view"; Requirements
// 5.6, 5.7, 6.1-6.5, 6.9, 6.11).
//
// `ruling.ts` and `stage.ts` live under `src/dashboard_frontend/`, which the
// root `tsconfig.json` excludes and `vitest.config.ts` excludes from the
// run (same reason given at `board-view.test.ts:1-17`). Both are loaded at
// runtime with `await import(pathToFileURL(...).href)` and cast to a
// hand-written type, the pattern at `board-view.test.ts:19-33`. `ruling.ts`
// does not exist at this commit, so every `rulingModule` test below is
// expected to fail; `stage.ts` exists but has no `'answer'` `StageName` or
// `resolved` case yet, so the `resolved(stage, seen)` for `answer` tests
// below are expected to fail too (the switch falls through with no
// matching case and returns `undefined`, not `true`/`false`).
//
// Per success criterion below: pre-condition, the call through the seam,
// the observable result, and the source of the expected value.

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = join(HERE, '..', '..', '..', 'dashboard_frontend', 'src', 'modules');

interface RulingQuestionFixture {
  id: string;
  text?: string;
  options?: string[];
  free?: boolean;
  recommended?: string;
  reason?: string;
  task?: string;
}

type RulingWaitKind = 'gate-a' | 'gate-b' | 'retro-plan' | 'merge' | 'escalation' | 'error' | 'question';

interface RulingWaitFixture {
  id: string;
  kind: RulingWaitKind;
  questions: RulingQuestionFixture[];
  proposals?: string[];
}

function rulingWaitFixture(
  overrides: Partial<RulingWaitFixture> & { id: string; kind: RulingWaitKind },
): RulingWaitFixture {
  return { questions: [], ...overrides };
}

type RulingModule = {
  rulingLayout: (wait: RulingWaitFixture) => string;
  initialValues: (wait: RulingWaitFixture) => Record<string, string>;
  answerOf: (q: RulingQuestionFixture, pick: string, text: string) => string;
  canSubmit: (
    wait: RulingWaitFixture,
    picks: Record<string, string>,
    texts: Record<string, string>,
  ) => boolean;
  answerPayload: (
    wait: RulingWaitFixture,
    picks: Record<string, string>,
    texts: Record<string, string>,
    notes: string,
  ) => { answers: Record<string, string>; note?: string };
  securityLines: (text: string) => { lead: string; findings: string[]; tail: string };
  offersAbandon: (wait: RulingWaitFixture) => boolean;
};

interface AnswerStageFixture {
  name: string;
}

interface AnswerObservedFixture {
  run?: { status: string };
}

type AnswerStageModule = {
  resolved: (stage: AnswerStageFixture, seen: AnswerObservedFixture) => boolean;
};

describe('ruling.ts (src/dashboard_frontend/src/modules/shell/ruling.ts)', () => {
  let ruling: RulingModule;

  beforeAll(async () => {
    ruling = (await import(pathToFileURL(join(FE, 'shell', 'ruling.ts')).href)) as RulingModule;
  });

  describe('rulingLayout(wait)', () => {
    // Criterion "rulingLayout ... 'security' when any question id is
    // security" (design C8 "rulingLayout(wait) returns 'security' when any
    // question id is security"; Requirement 5 AC 6).
    //   Pre-condition: an `escalation` wait whose only question has id
    //   `security`.
    //   Test: rulingLayout(wait).
    //   Observable result: the string 'security'.
    //   Expected-value source: design.md:98's literal 'security' branch.
    it("gives 'security' when any question id is security", () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'escalation',
        questions: [{ id: 'security', options: ['accept', 'retry', 'abandon'] }],
      });
      expect(ruling.rulingLayout(wait)).toBe('security');
    });

    // Criterion "rulingLayout ... 'task' for an escalation or error whose
    // first question has task" (design.md:98; Requirement 5 AC 7).
    //   Pre-condition: an `escalation` wait whose first question carries a
    //   `task` tag and whose id is not `security`.
    //   Test: rulingLayout(wait).
    //   Observable result: the string 'task'.
    //   Expected-value source: design.md:98's literal 'task' branch.
    it("gives 'task' for an escalation whose first question has task", () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'escalation',
        questions: [{ id: 'ruling', task: '5.2' }],
      });
      expect(ruling.rulingLayout(wait)).toBe('task');
    });

    // Criterion "rulingLayout ... 'taskless' for any other escalation or
    // error" (design.md:98; Requirement 5 AC 7).
    //   Pre-condition: an `error` wait whose first question has no `task`
    //   tag and whose id is not `security`.
    //   Test: rulingLayout(wait).
    //   Observable result: the string 'taskless'.
    //   Expected-value source: design.md:98's literal 'taskless' branch.
    it("gives 'taskless' for an error whose first question has no task", () => {
      const wait = rulingWaitFixture({ id: 'w1', kind: 'error', questions: [{ id: 'q1' }] });
      expect(ruling.rulingLayout(wait)).toBe('taskless');
    });

    // Criterion "rulingLayout ... 'gate' for gate-a and gate-b" (design.md:98).
    //   Pre-condition: a `gate-a` wait.
    //   Test: rulingLayout(wait).
    //   Observable result: the string 'gate'.
    //   Expected-value source: design.md:98's literal 'gate' branch.
    it("gives 'gate' for a gate-a wait", () => {
      const wait = rulingWaitFixture({ id: 'w1', kind: 'gate-a', questions: [{ id: 'q1', options: ['a', 'b'] }] });
      expect(ruling.rulingLayout(wait)).toBe('gate');
    });

    // Criterion "rulingLayout ... else the kind (retro-plan, merge,
    // question)" for retro-plan (design.md:98).
    //   Pre-condition: a `retro-plan` wait.
    //   Test: rulingLayout(wait).
    //   Observable result: the string 'retro-plan'.
    //   Expected-value source: design.md:98's "else the kind" fallback.
    it("gives 'retro-plan' for a retro-plan wait", () => {
      const wait = rulingWaitFixture({ id: 'w1', kind: 'retro-plan', questions: [{ id: 'q1' }] });
      expect(ruling.rulingLayout(wait)).toBe('retro-plan');
    });

    // Criterion "rulingLayout ... else the kind" for merge (design.md:98).
    //   Pre-condition: a `merge` wait.
    //   Test: rulingLayout(wait).
    //   Observable result: the string 'merge'.
    //   Expected-value source: design.md:98's "else the kind" fallback.
    it("gives 'merge' for a merge wait", () => {
      const wait = rulingWaitFixture({ id: 'w1', kind: 'merge', questions: [] });
      expect(ruling.rulingLayout(wait)).toBe('merge');
    });

    // Criterion "rulingLayout ... else the kind" for question (design.md:98).
    //   Pre-condition: a `question` wait.
    //   Test: rulingLayout(wait).
    //   Observable result: the string 'question'.
    //   Expected-value source: design.md:98's "else the kind" fallback.
    it("gives 'question' for a question wait", () => {
      const wait = rulingWaitFixture({ id: 'w1', kind: 'question', questions: [{ id: 'answer' }] });
      expect(ruling.rulingLayout(wait)).toBe('question');
    });
  });

  describe('initialValues(wait)', () => {
    // Criterion "initialValues(wait): each question's recommended"
    // (design.md:99; Requirement 6 AC 2).
    //   Pre-condition: a wait with one question carrying `recommended`.
    //   Test: initialValues(wait).
    //   Observable result: a map from that question's id to its
    //   `recommended` value.
    //   Expected-value source: design.md:99's literal "each question's
    //   recommended".
    it("gives the question's recommended value when present", () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'gate-a',
        questions: [{ id: 'q1', options: ['approve', 'reject'], recommended: 'approve' }],
      });
      expect(ruling.initialValues(wait)).toEqual({ q1: 'approve' });
    });

    // Criterion "initialValues(wait): ... else ''" (design.md:99;
    // Requirement 6 AC 2).
    //   Pre-condition: a wait with one question carrying no `recommended`.
    //   Test: initialValues(wait).
    //   Observable result: a map from that question's id to ''.
    //   Expected-value source: design.md:99's literal "else ''".
    it('gives an empty string when the question has no recommended value', () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'gate-a', questions: [{ id: 'q1', options: ['approve', 'reject'] }],
      });
      expect(ruling.initialValues(wait)).toEqual({ q1: '' });
    });
  });

  describe('answerOf(q, pick, text)', () => {
    // Criterion "answerOf prefers non-empty text over the pick on a free
    // question with options" (task 10 Success; design.md:100 "options and
    // free give text.trim() when non-empty, else pick").
    //   Pre-condition: a question with options and `free: true`, a pick and
    //   non-empty typed text.
    //   Test: answerOf(q, pick, text).
    //   Observable result: the typed text, not the pick.
    //   Expected-value source: design.md:100's "options and free give
    //   text.trim() when non-empty" clause.
    it('prefers non-empty text over the pick on a free question with options', () => {
      const q: RulingQuestionFixture = { id: 'q1', options: ['approve', 'reject'], free: true };
      expect(ruling.answerOf(q, 'approve', 'a custom ruling')).toBe('a custom ruling');
    });
  });

  describe('canSubmit(wait, picks, texts)', () => {
    // Criterion "canSubmit ... false with an unpicked radio" (task 10
    // Success; design.md:101 "false while a question with options has
    // neither a pick nor ... non-empty text"; Requirement 6 AC 2).
    //   Pre-condition: a wait with one radio question (options, not free)
    //   and no pick recorded for it.
    //   Test: canSubmit(wait, picks, texts) with picks and texts empty.
    //   Observable result: false.
    //   Expected-value source: design.md:101's unpicked-radio clause.
    it('is false with an unpicked radio', () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'gate-a', questions: [{ id: 'q1', options: ['approve', 'reject'] }],
      });
      expect(ruling.canSubmit(wait, {}, {})).toBe(false);
    });

    // Criterion "canSubmit ... false with an empty ruling text" (task 10
    // Success; design.md:101 "or while a ruling question's text is empty
    // after trim"; Requirement 6 AC 3).
    //   Pre-condition: a wait whose question id is `ruling`, with a texts
    //   entry that is whitespace only.
    //   Test: canSubmit(wait, picks, texts).
    //   Observable result: false.
    //   Expected-value source: design.md:101's ruling-text clause.
    it('is false with an empty ruling text', () => {
      const wait = rulingWaitFixture({ id: 'w1', kind: 'error', questions: [{ id: 'ruling', free: true }] });
      expect(ruling.canSubmit(wait, {}, { ruling: '   ' })).toBe(false);
    });

    // Criterion "canSubmit ... true when every radio is picked" (task 10
    // Success; design.md:101).
    //   Pre-condition: a wait with two radio questions, each with a pick
    //   recorded.
    //   Test: canSubmit(wait, picks, texts).
    //   Observable result: true.
    //   Expected-value source: design.md:101 — canSubmit is false only
    //   under the two named clauses, so a wait with neither unpicked radios
    //   nor an empty ruling text leaves it true.
    it('is true when every radio is picked', () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'gate-a',
        questions: [
          { id: 'q1', options: ['approve', 'reject'] },
          { id: 'q2', options: ['yes', 'no'] },
        ],
      });
      expect(ruling.canSubmit(wait, { q1: 'approve', q2: 'yes' }, {})).toBe(true);
    });
  });

  describe('answerPayload(wait, picks, texts, notes)', () => {
    // Criterion "answerPayload appends a blank line, Notes: and the notes
    // to the first typed answer" (task 10 Success; design.md:102;
    // Requirement 6 AC 4).
    //   Pre-condition: a `question` wait with two free-text questions and
    //   non-empty notes.
    //   Test: answerPayload(wait, picks, texts, notes).
    //   Observable result: the first question's answer, in question order,
    //   carries the typed text, a blank line, 'Notes: ' and the notes; no
    //   `note` field.
    //   Expected-value source: Requirement 6 AC 4's literal "the text, a
    //   blank line, 'Notes: ' and the notes".
    it('appends a blank line, Notes: and the notes to the first typed answer', () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'question',
        questions: [{ id: 'q1', free: true }, { id: 'q2', free: true }],
      });
      const result = ruling.answerPayload(wait, {}, { q1: 'alpha', q2: 'beta' }, 'extra context');
      expect(result).toEqual({ answers: { q1: 'alpha\n\nNotes: extra context', q2: 'beta' } });
    });

    // Criterion "answerPayload ... puts notes in note when every answer is
    // a pick" (task 10 Success; design.md:102; Requirement 6 AC 5).
    //   Pre-condition: a `gate-a` wait with one radio question answered by
    //   a pick, and non-empty notes.
    //   Test: answerPayload(wait, picks, texts, notes).
    //   Observable result: the answer stays the bare pick and the notes
    //   travel in a separate `note` field.
    //   Expected-value source: Requirement 6 AC 5's literal "the value sent
    //   SHALL be the option alone, and the note SHALL travel as a separate
    //   note field".
    it('puts notes in note when every answer is a pick', () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'gate-a', questions: [{ id: 'q1', options: ['approve', 'reject'] }],
      });
      const result = ruling.answerPayload(wait, { q1: 'approve' }, {}, 'fyi');
      expect(result).toEqual({ answers: { q1: 'approve' }, note: 'fyi' });
    });

    // Criterion "answerPayload ... adds proposal: keys for retro-plan"
    // (task 10 Success; design.md:102 "A retro-plan wait adds the
    // proposal:<i> keys as today (AnswerSheet.tsx:254-257)").
    //   Pre-condition: a `retro-plan` wait with two proposals and picks
    //   already carrying `proposal:0`/`proposal:1` values.
    //   Test: answerPayload(wait, picks, texts, notes) with empty notes.
    //   Observable result: the returned answers include `proposal:0` and
    //   `proposal:1` with the picks' values, alongside the question answer.
    //   Expected-value source: design.md:102's proposal-key clause, read
    //   against the base behaviour it carries forward at
    //   AnswerSheet.tsx:254-257 (`answers[proposal:${i}] = approved[i] ?
    //   'approve' : 'drop'`).
    it('adds proposal: keys for retro-plan', () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'retro-plan', questions: [{ id: 'q1', free: true }],
        proposals: ['first proposal', 'second proposal'],
      });
      const result = ruling.answerPayload(
        wait, { 'proposal:0': 'approve', 'proposal:1': 'drop' }, { q1: 'ok' }, '',
      );
      expect(result.answers).toEqual({ q1: 'ok', 'proposal:0': 'approve', 'proposal:1': 'drop' });
    });
  });

  describe('securityLines(text)', () => {
    // Criterion "securityLines splits lead, findings and tail" (task 10
    // Success; design.md:103 "this matches the text written at
    // src/controller/runs.ts:1285-1287").
    //   Pre-condition: a security wait's text in the exact shape written by
    //   `runs.ts:1285-1289` — a header line ending ':', one or more finding
    //   lines, then a closing instruction line.
    //   Test: securityLines(text).
    //   Observable result: `lead` holds the header line, `findings` holds
    //   the finding lines in order, `tail` holds the closing line.
    //   Expected-value source: the literal text built at
    //   src/controller/runs.ts:1285-1289.
    it('splits lead, findings and tail', () => {
      const text =
        'Security findings survived the loop (tasks 3/5):\n'
        + 'Finding A (file.ts): npm test\n'
        + 'Finding B (file2.ts): npm lint\n'
        + 'Accept to record them, retry the pass, or abandon the run.';
      expect(ruling.securityLines(text)).toEqual({
        lead: 'Security findings survived the loop (tasks 3/5):',
        findings: ['Finding A (file.ts): npm test', 'Finding B (file2.ts): npm lint'],
        tail: 'Accept to record them, retry the pass, or abandon the run.',
      });
    });
  });

  describe('offersAbandon(wait)', () => {
    // Criterion "offersAbandon is true only for an escalation or error with
    // no abandon option" (task 10 Success; design.md:104; Requirement 6
    // AC 9), true branch.
    //   Pre-condition: an `error` wait whose first question has no
    //   `abandon` option.
    //   Test: offersAbandon(wait).
    //   Observable result: true.
    //   Expected-value source: design.md:104's literal condition.
    it('is true for an escalation or error with no abandon option', () => {
      const wait = rulingWaitFixture({ id: 'w1', kind: 'error', questions: [{ id: 'ruling', free: true }] });
      expect(ruling.offersAbandon(wait)).toBe(true);
    });

    // Criterion "offersAbandon is true ONLY for ..." (task 10 Success;
    // design.md:104; Requirement 6 AC 9), negative branch proving the
    // "only" qualifier.
    //   Pre-condition: the security escalation, whose first question
    //   already lists `abandon` among its options (Requirement 5 AC 6).
    //   Test: offersAbandon(wait).
    //   Observable result: false.
    //   Expected-value source: design.md:104's "no abandon option" clause —
    //   a wait whose first question already has `abandon` fails the
    //   condition.
    it('is false for an escalation whose first question already has an abandon option', () => {
      const wait = rulingWaitFixture({
        id: 'w1', kind: 'escalation',
        questions: [{ id: 'security', options: ['accept', 'retry', 'abandon'] }],
      });
      expect(ruling.offersAbandon(wait)).toBe(false);
    });
  });
});

describe("stage.ts resolved(stage, seen) for 'answer' (src/dashboard_frontend/src/modules/shell/stage.ts)", () => {
  let stage: AnswerStageModule;

  beforeAll(async () => {
    stage = (await import(pathToFileURL(join(FE, 'shell', 'stage.ts')).href)) as AnswerStageModule;
  });

  // Criterion "resolved for answer is true with the run gone" (task 10
  // Success; design.md:116 "case 'answer': return seen.run === undefined ||
  // seen.run.status !== 'waiting';"; Requirement 6 AC 11).
  //   Pre-condition: an `answer` stage and an `Observed` with no `run`.
  //   Test: resolved({ name: 'answer' }, { run: undefined }).
  //   Observable result: true.
  //   Expected-value source: design.md:116's literal `seen.run ===
  //   undefined` disjunct.
  it('is true with the run gone', () => {
    expect(stage.resolved({ name: 'answer' }, { run: undefined })).toBe(true);
  });

  // Criterion "resolved for answer is true with ... not waiting" (task 10
  // Success; design.md:116; Requirement 6 AC 11).
  //   Pre-condition: an `answer` stage and an `Observed` whose run's status
  //   is not `waiting`.
  //   Test: resolved({ name: 'answer' }, { run: { status: 'running' } }).
  //   Observable result: true.
  //   Expected-value source: design.md:116's literal `seen.run.status !==
  //   'waiting'` disjunct.
  it('is true with the run no longer waiting', () => {
    expect(stage.resolved({ name: 'answer' }, { run: { status: 'running' } })).toBe(true);
  });

  // Criterion "resolved for answer is ... false while waiting" (task 10
  // Success; design.md:116; Requirement 6 AC 11).
  //   Pre-condition: an `answer` stage and an `Observed` whose run's status
  //   is `waiting`.
  //   Test: resolved({ name: 'answer' }, { run: { status: 'waiting' } }).
  //   Observable result: false.
  //   Expected-value source: design.md:116 — both disjuncts are false when
  //   the run is present and still waiting.
  it('is false while the run is still waiting', () => {
    expect(stage.resolved({ name: 'answer' }, { run: { status: 'waiting' } })).toBe(false);
  });
});
