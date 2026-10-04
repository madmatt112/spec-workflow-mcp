import { describe, it, expect } from 'vitest';
import { breakdownTranscript } from '../sources.js';

/**
 * Contract (design C2, Requirement 1 criteria 4, 5 and 10).
 *
 * AC 1.4 — "The sources SHALL be: base, skill, worker-report, read (spec-store share
 * broken out), mcp:<tool>.<action>, bash, tool:<name>, prompt and own-output."
 *   Pre-condition: an inline transcript whose blocks exercise one labelled source kind.
 *   Call: `breakdownTranscript(text)`.
 *   Observable: `result.rows` carries a row whose `source` is the documented label.
 *   Expected value: computed by hand from design C2 steps 4-6 (ctx/inW formulas) for the
 *   fixture's own token and character counts (see per-test comments).
 *   Covered by: the `describe('breakdownTranscript — source labels (AC 1.4)', ...)` block.
 *
 * AC 1.5 — "Each call SHALL be counted once per message.id... output W... to
 * own-output; its input W... split over its context sources in proportion to size; base
 * sized once as the first call's context tokens minus its visible characters over 3.5
 * chars/token."
 *   Pre-condition: a two-call transcript with known ctx/chars so the split and base
 *   formulas resolve to exact numbers.
 *   Call: `breakdownTranscript(text)`.
 *   Observable: `result.base` and the matching row's `w`.
 *   Expected value: design C2 step 5's formula, evaluated by hand for the fixture.
 *   Covered by: `'sizes base from the first call's residual context (AC 1.5)'` and
 *   `'attributes every W to base when a later call has no preceding characters (AC 1.5)'`.
 *
 * AC 1.10 — "The breakdown... SHALL be [a] pure function... fed fixture transcripts:
 * one per source kind, a multi-line message counted once, a missing transcript, and a
 * sum check against W." (The "missing transcript" fixture belongs to the C3 transcript
 * locator, a different module; this file covers the rest.)
 *   Pre-condition: a transcript whose assistant message spans multiple lines sharing one
 *   `message.id`, or one with no assistant `message.usage` at all, or a multi-source one.
 *   Call: `breakdownTranscript(text)`.
 *   Observable: `result.calls`, `result.rows` and `result.w`, or `null`.
 *   Expected value: design C2 step 2 (last line's usage wins) and the stated invariant
 *   "source totals equal w by construction".
 *   Covered by: `'counts a multi-line message once, keeping its last usage (AC 1.10)'`,
 *   `'returns null when no assistant line carries message.usage (AC 1.10)'` and
 *   `'sums rows to w and sorts them highest W first (AC 1.10)'`.
 */

function line(obj: unknown): string {
  return JSON.stringify(obj);
}

/** A single-source two-call fixture: call 1 sizes `base` with no preceding chars, call 2
 * carries exactly one block of `preChars` before it, labelled by `preBlock`. */
function twoCallFixture(preBlockLines: string[], call2Input = 2000): string {
  const lines = [
    line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [] } }),
    ...preBlockLines,
    line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: call2Input, output_tokens: 0 }, content: [] } }),
  ];
  return lines.join('\n');
}

describe('breakdownTranscript — source labels (AC 1.4)', () => {
  it('labels the orchestrator\'s own prior text as own-output', () => {
    // call1 emits a 50-char text block; it becomes call2's only preceding block.
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [{ type: 'text', text: 'X'.repeat(50) }] } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // base = max(0, 1000 - 0/3.5) = 1000; call1 fully base (ctx1=1000=b1).
    // call2: ctx2=2000, b2=min(1000,2000)=1000, remainder inW=1000, all to own-output.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'own-output');
    expect(row?.w).toBeCloseTo(1000, 6);
  });

  it('labels an Agent tool result as worker-report', () => {
    const pre = [
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'R'.repeat(48) }] } }),
    ];
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [{ type: 'tool_use', id: 'tu1', name: 'Agent', input: {} }] } }),
      ...pre,
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // C2 = 2 (own JSON "{}") + 48 (result) = 50. remainder=1000. worker-report = 1000*48/50 = 960.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'worker-report');
    expect(row?.w).toBeCloseTo(960, 4);
  });

  it('labels isMeta user text as skill', () => {
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [] } }),
      line({ type: 'user', isMeta: true, message: { content: 'S'.repeat(48) } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // C2 = 48, remainder = 1000, all to skill.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'skill');
    expect(row?.w).toBeCloseTo(1000, 6);
  });

  it('splits a Read result into read:spec-store by its file_path', () => {
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [{ type: 'tool_use', id: 'tu2', name: 'Read', input: { file_path: '.spec-workflow/specs/x/requirements.md' } }] } }),
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu2', content: 'R'.repeat(48) }] } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // JSON.stringify({file_path:'.spec-workflow/specs/x/requirements.md'}).length = 54.
    // C2 = 54 + 48 = 102; remainder = 1000; read:spec-store = 1000*48/102.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'read:spec-store');
    expect(row?.w).toBeCloseTo(1000 * 48 / 102, 4);
  });

  it('splits a Read result elsewhere into read:other', () => {
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [{ type: 'tool_use', id: 'tu3', name: 'Read', input: { file_path: '/tmp/notes.txt' } }] } }),
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu3', content: 'R'.repeat(48) }] } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // JSON.stringify({file_path:'/tmp/notes.txt'}).length = 30. C2 = 30+48=78.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'read:other');
    expect(row?.w).toBeCloseTo(1000 * 48 / 78, 4);
  });

  it('labels an mcp tool result as mcp:<tool>.<action>', () => {
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [{ type: 'tool_use', id: 'tu4', name: 'mcp__spec-workflow__harness', input: { action: 'orient' } }] } }),
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu4', content: 'R'.repeat(48) }] } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // JSON.stringify({action:'orient'}).length = 19. C2 = 19+48=67.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'mcp:harness.orient');
    expect(row?.w).toBeCloseTo(1000 * 48 / 67, 4);
  });

  it('labels a Bash result as bash', () => {
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [{ type: 'tool_use', id: 'tu5', name: 'Bash', input: { command: 'ls -la' } }] } }),
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu5', content: 'R'.repeat(48) }] } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // JSON.stringify({command:'ls -la'}).length = 20. C2 = 20+48=68.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'bash');
    expect(row?.w).toBeCloseTo(1000 * 48 / 68, 4);
  });

  it('labels any other tool result as tool:<name>', () => {
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [{ type: 'tool_use', id: 'tu6', name: 'Write', input: { file_path: '/tmp/out.txt', content: 'hi' } }] } }),
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu6', content: 'R'.repeat(48) }] } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    // JSON.stringify({file_path:'/tmp/out.txt',content:'hi'}).length = 43. C2=43+48=91.
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'tool:Write');
    expect(row?.w).toBeCloseTo(1000 * 48 / 91, 4);
  });

  it('labels other user text as prompt', () => {
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [] } }),
      line({ type: 'user', message: { content: 'P'.repeat(48) } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 2000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    const result = breakdownTranscript(text);
    const row = result?.rows.find(r => r.source === 'prompt');
    expect(row?.w).toBeCloseTo(1000, 6);
  });
});

describe('breakdownTranscript — call grouping, base sizing and totals (AC 1.5, AC 1.10)', () => {
  it('counts a multi-line message once, keeping its last usage (AC 1.10)', () => {
    // Two transcript lines share message.id "m1": the first usage (input 5, output 999)
    // must be discarded in favour of the last (input 1000, output 10), as readUsage keeps
    // one usage per id (harness/hooks/sdd-activity.sh:68-98).
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 5, output_tokens: 999 }, content: [{ type: 'text', text: 'partial' }] } }),
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 10 }, content: [{ type: 'text', text: 'final' }] } }),
    ].join('\n');
    // ctx = 1000, C_preceding = 0 so base = max(0, 1000 - 0) = 1000 = inW's whole share.
    // w = inW(1000) + 5*output(10) = 1050.
    const result = breakdownTranscript(text);
    expect(result?.calls).toBe(1);
    expect(result?.peak).toBe(1000);
    expect(result?.w).toBeCloseTo(1050, 6);
  });

  it('returns null when no assistant line carries message.usage (AC 1.10)', () => {
    const text = [
      'not json at all',
      line({ type: 'user', message: { content: 'hello' } }),
      line({ type: 'assistant', message: { id: 'm1', content: [{ type: 'text', text: 'no usage field' }] } }),
    ].join('\n');
    const result = breakdownTranscript(text);
    expect(result).toBeNull();
  });

  it('sizes base from the first call\'s residual context (AC 1.5)', () => {
    // A single call: ctx1=100, C1=70 (a 70-char launch prompt).
    // base = max(0, 100 - 70/3.5) = 80. Remainder 20 goes to the prompt source.
    const text = [
      line({ type: 'user', message: { content: 'L'.repeat(70) } }),
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 100, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    const result = breakdownTranscript(text);
    expect(result?.base).toBeCloseTo(80, 6);
    const row = result?.rows.find(r => r.source === 'prompt');
    expect(row?.w).toBeCloseTo(20, 6);
  });

  it('attributes every W to base when a later call has no preceding characters (AC 1.5)', () => {
    // call1: ctx1=1000, C1=0 -> base=1000 (all of call1's inW).
    // call2: ctx2=5000 (bigger than base) but C2=0 (no blocks at all precede it): the
    // zero-characters rule sends its whole inW (5000) to base too, not the
    // chars-proportioned split the general formula would otherwise apply.
    const text = twoCallFixture([], 5000);
    const result = breakdownTranscript(text);
    expect(result?.base).toBeCloseTo(6000, 6);
    expect(result?.w).toBeCloseTo(6000, 6);
  });

  it('sums rows to w and sorts them highest W first (AC 1.10)', () => {
    // call1: ctx1=1000, C1=0 -> base=1000 (all call1 inW).
    // call2: ctx2=5000, b2=min(1000,5000)=1000, remainder=4000 split over an 80-char
    // skill block and a 20-char prompt block: skill=3200, prompt=800.
    // base total = 1000 (call1) + 1000 (call2's own b-share) = 2000.
    // w = 1000 + 5000 = 6000 = 2000 (base) + 3200 (skill) + 800 (prompt).
    const text = [
      line({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1000, output_tokens: 0 }, content: [] } }),
      line({ type: 'user', isMeta: true, message: { content: 'S'.repeat(80) } }),
      line({ type: 'user', message: { content: 'P'.repeat(20) } }),
      line({ type: 'assistant', message: { id: 'm2', usage: { input_tokens: 5000, output_tokens: 0 }, content: [] } }),
    ].join('\n');
    const result = breakdownTranscript(text);
    expect(result?.calls).toBe(2);
    expect(result?.peak).toBe(5000);
    const total = result?.rows.reduce((a, r) => a + r.w, 0) ?? NaN;
    expect(total).toBeCloseTo(result?.w ?? NaN, 6);
    const sources = result?.rows.map(r => r.source);
    expect(sources).toEqual(['skill', 'base', 'prompt']);
  });
});
