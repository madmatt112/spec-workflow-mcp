import { describe, it, expect } from 'vitest';
import {
  classifySecurityReport, e2ePassStands, readSecurityState, suspicionKey,
  type SecurityFinding,
} from '../security-pass.js';

// Contract (design C6 "Completion gate: e2e record and security pass", R3 AC 4-5, 9, 13):
//
// S1 classifySecurityReport — a finding reported with no reproduce command or
//    no output becomes a suspicion.
//    Pre: a report with one finding missing `command`, and one missing `output`.
//    Call: classifySecurityReport(report).
//    Observable: the finding is absent from `findings`, present in `suspicions`
//    with `why: 'reported without a reproduction'`.
//    Source: design C6 Interfaces, `classifySecurityReport`; R3 AC 5.
//
// S2 classifySecurityReport — a finding's output is cut to 400 characters.
//    Pre: a report with one finding whose `output` is 450 characters.
//    Call: classifySecurityReport(report).
//    Observable: `findings[0].output.length === 400`, equal to the first 400
//    characters of the input.
//    Source: design C6 Interfaces, `classifySecurityReport`; R3 AC 4.
//
// S3 e2ePassStands — true when the e2e pass note is the newer of the two
//    marker notes, false when a `completion handoff written` note is newer.
//    Pre: ledger note rows in each order, and with the pass note absent.
//    Call: e2ePassStands(rows).
//    Observable: boolean.
//    Source: design C6 Interfaces, `e2ePassStands`; R3 AC 13.
//
// S4 readSecurityState — `next` follows the last `security:` stage note,
//    reaching every value design C6 lists.
//    Pre: cumulative note sequences through the pass/fix/recheck/adjudicate
//    lifecycle, and the explicit `done` note.
//    Call: readSecurityState(rows).
//    Observable: `.next`.
//    Source: design C6 Interfaces, `readSecurityState`; R3 AC 6, 7, 9.
//
// S5 readSecurityState — the round count and open findings are read only
//    from rows after the newest `security: epoch` note.
//    Pre: a full round-1 fix/recheck sequence under epoch 1, then an
//    `escalated`, an `answer ... retry`, then `security: epoch 2` with no
//    further notes.
//    Call: readSecurityState(rows).
//    Observable: `.epoch === 2`, `.fixRounds === 0`, `.open` empty, `.next === 'pass'`.
//    Source: design C6 Interfaces, `readSecurityState`; R3 AC 9 ("the round
//    count and findings SHALL be read only from rows after that marker").
//
// S6 readSecurityState — an answered wait id is listed in `answered`.
//    Pre: an `escalated` note followed by `security: answer <waitId> accept`.
//    Call: readSecurityState(rows).
//    Observable: `.answered` contains that waitId.
//    Source: design C6 Interfaces, `readSecurityState`; R3 AC 9.
//
// S7 suspicionKey — stable (equal) for equal file and title.
//    Pre: two suspicions with the same file and title but a different `why`.
//    Call: suspicionKey(s).
//    Observable: the two keys are equal; a suspicion with a different file
//    or title gives a different key.
//    Source: design C6 Interfaces, `suspicionKey`.

const RUN = 'run-20261022-000000';
const SPEC = 'verification-loop';

function note(text: string): Record<string, string> {
  return { ts: '2026-10-22T00:00:00.000Z', run: RUN, spec: SPEC, type: 'note', text };
}

function rowsFor(texts: string[]): Record<string, string>[] {
  return texts.map(note);
}

const FINDING: SecurityFinding = { title: 't', file: 'f.ts', command: 'npm test', output: 'o' };
const OPEN_ONE = `security: open ${JSON.stringify([FINDING])}`;
const OPEN_NONE = 'security: open []';

describe('classifySecurityReport', () => {
  it.each<[string, Record<string, unknown>]>([
    ['no command', { title: 't', file: 'f.ts', output: 'o' }],
    ['no output', { title: 't', file: 'f.ts', command: 'npm test' }],
  ])('a finding with %s is returned as a suspicion, not a finding', (_label, finding) => {
    const result = classifySecurityReport({ findings: [finding], suspicions: [] });
    expect(result.findings).toEqual([]);
    expect(result.suspicions).toEqual([
      { title: 't', file: 'f.ts', why: 'reported without a reproduction' },
    ]);
  });
});

describe('classifySecurityReport — output length', () => {
  it('cuts a finding\'s output to 400 characters', () => {
    const longOutput = 'x'.repeat(450);
    const result = classifySecurityReport({
      findings: [{ title: 't', file: 'f.ts', command: 'npm test', output: longOutput }],
      suspicions: [],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].output).toHaveLength(400);
    expect(result.findings[0].output).toBe(longOutput.slice(0, 400));
  });
});

describe('e2ePassStands', () => {
  it.each<[string, string[], boolean]>([
    ['only the e2e pass note', ['e2e verification passed'], true],
    ['the e2e pass note before a completion handoff note', ['e2e verification passed', 'completion handoff written'], false],
    ['no e2e pass note at all', [], false],
  ])('%s', (_label, texts, expected) => {
    expect(e2ePassStands(rowsFor(texts))).toBe(expected);
  });
});

describe('readSecurityState — next', () => {
  it.each<[string, string[], string]>([
    ['only the epoch marker', ['security: epoch 1'], 'pass'],
    ['a pass with open findings, under the fix cap', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
    ], 'fix'],
    ['a fix round', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
    ], 'recheck'],
    ['a recheck with open findings, under the fix cap', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
      'security: recheck 1: findings 1, suspicions 0', OPEN_ONE,
    ], 'fix'],
    ['a second fix round', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
      'security: recheck 1: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 2: findings 1, suspicions 0',
    ], 'recheck'],
    ['a recheck with open findings, at the fix cap', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
      'security: recheck 1: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 2: findings 1, suspicions 0',
      'security: recheck 2: findings 1, suspicions 0', OPEN_ONE,
    ], 'adjudicate'],
    ['an adjudicator step', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
      'security: recheck 1: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 2: findings 1, suspicions 0',
      'security: recheck 2: findings 1, suspicions 0', OPEN_ONE,
      'security: adjudicator: findings 1, suspicions 0',
    ], 'recheck-adjudicated'],
    ['a recheck-adjudicated with open findings', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
      'security: recheck 1: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 2: findings 1, suspicions 0',
      'security: recheck 2: findings 1, suspicions 0', OPEN_ONE,
      'security: adjudicator: findings 1, suspicions 0', OPEN_ONE,
      'security: recheck adjudicated: findings 1, suspicions 0', OPEN_ONE,
    ], 'escalate'],
    ['an escalated note', [
      'security: epoch 1', 'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
      'security: recheck 1: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 2: findings 1, suspicions 0',
      'security: recheck 2: findings 1, suspicions 0', OPEN_ONE,
      'security: adjudicator: findings 1, suspicions 0', OPEN_ONE,
      'security: recheck adjudicated: findings 1, suspicions 0', OPEN_ONE,
      'security: escalated',
    ], 'await-answer'],
    ['a pass with no open findings', [
      'security: epoch 1', 'security: pass: findings 0, suspicions 0', OPEN_NONE,
    ], 'done'],
    ['an explicit done note', ['security: epoch 1', 'security: done'], 'done'],
  ])('%s', (_label, texts, expected) => {
    expect(readSecurityState(rowsFor(texts)).next).toBe(expected);
  });
});

describe('readSecurityState — epoch scoping', () => {
  it('reads the round count and open findings only from rows after the newest epoch marker', () => {
    const rows = rowsFor([
      'security: epoch 1',
      'security: pass: findings 1, suspicions 0', OPEN_ONE,
      'security: fix round 1: findings 1, suspicions 0',
      'security: recheck 1: findings 1, suspicions 0', OPEN_ONE,
      'security: escalated',
      'security: answer wait-1 retry',
      'security: epoch 2',
    ]);
    const state = readSecurityState(rows);
    expect(state.epoch).toBe(2);
    expect(state.fixRounds).toBe(0);
    expect(state.open).toEqual([]);
    expect(state.next).toBe('pass');
  });
});

describe('readSecurityState — answered', () => {
  it('lists an answered wait id in `answered`', () => {
    const rows = rowsFor([
      'security: epoch 1',
      'security: escalated',
      'security: answer wait-42 accept',
      'security: accepted []',
      'security: done',
    ]);
    expect(readSecurityState(rows).answered).toContain('wait-42');
  });
});

describe('suspicionKey', () => {
  it('is equal for the same file and title, and differs otherwise', () => {
    const a = suspicionKey({ title: 'Leak', file: 'src/a.ts', why: 'one reason' });
    const b = suspicionKey({ title: 'Leak', file: 'src/a.ts', why: 'a different reason' });
    expect(a).toBe(b);
    const differentFile = suspicionKey({ title: 'Leak', file: 'src/b.ts', why: 'one reason' });
    const differentTitle = suspicionKey({ title: 'Other', file: 'src/a.ts', why: 'one reason' });
    expect(differentFile).not.toBe(a);
    expect(differentTitle).not.toBe(a);
  });
});
