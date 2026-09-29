import { describe, it, expect } from 'vitest';
import { parseHandoffRouting, parseGateSections } from '../project-watch.js';

// Contract for src/dashboard/harness/project-watch.ts (design.md C5 interfaces;
// task 3 _Prompt; Requirements 1.3, 4.5).
//
// Criterion "full header" (task 3 _Prompt: "spec comes from
//   parseHandoffActiveSpec … phase, state and result come from the header
//   line of formats.md:76"; Requirement 1 AC 3):
//   Pre-condition: a HANDOFF routing header with the Active spec line and the
//   `Live phase **X**, state **Y**, last result **Z**.` line, both prefixed
//   with the `> ` blockquote marker as formats.md:75-76 shows.
//   Test: parseHandoffRouting(md).
//   Observable result: { spec: 'harness-control-pane', phase: 'document',
//   state: 'in-progress', result: 'gate-a' }.
//   Expected-value source: the literal field values written into the fixture
//   header, per the formats.md:75-76 line grammar.
//
// Criterion "spec with no live-phase line" (task 3 _Prompt: "each null when
//   the line or its field is missing"; Requirement 1 AC 3):
//   Pre-condition: a HANDOFF header with the Active spec line but no `Live
//   phase …` line at all.
//   Test: parseHandoffRouting(md).
//   Observable result: { spec: 'other-spec', phase: null, state: null,
//   result: null }.
//   Expected-value source: the _Prompt sentence ("each null when the line …
//   is missing").
//
// Criterion "no header" (task 3 _Prompt: "the spec comes from
//   parseHandoffActiveSpec … and null means no spec"):
//   Pre-condition: a markdown document with no "Active spec **`…`**" text at
//   all (parseHandoffActiveSpec, src/watch/ledger.ts:219-223, returns
//   undefined for it).
//   Test: parseHandoffRouting(md).
//   Observable result: null.
//   Expected-value source: the _Prompt sentence ("null means no spec").
//
// Criterion "undefined input" (task 3 _Prompt, same sentence):
//   Pre-condition: none.
//   Test: parseHandoffRouting(undefined).
//   Observable result: null.
//   Expected-value source: the _Prompt sentence ("null means no spec").
//
// Criterion "Gate A only" (task 3 _Prompt: "the trimmed text under a `## Gate
//   A` or `## Gate B` heading up to the next `## ` heading, null when the
//   heading or the input is missing"; Requirement 4 AC 5):
//   Pre-condition: a markdown document with a `## Gate A` heading and body
//   text, and no `## Gate B` heading anywhere.
//   Test: parseGateSections(md).
//   Observable result: { gateA: '1. **Question** — some question?\n   -
//   answer: yes', gateB: null }.
//   Expected-value source: the _Prompt sentence (trimmed text under the
//   heading to the next `## ` heading, or end of input; null for a missing
//   heading).
//
// Criterion "both sections" (same _Prompt sentence; Requirement 4 AC 5):
//   Pre-condition: a markdown document with both a `## Gate A` heading
//   followed by body text and a `## Gate B` heading followed by different
//   body text.
//   Test: parseGateSections(md).
//   Observable result: { gateA: 'Question A text here.', gateB: 'Question B
//   text here.' }.
//   Expected-value source: the _Prompt sentence (trimmed text under each
//   heading, Gate A stopping at the next `## ` heading, Gate B running to end
//   of input).
//
// Criterion "neither section" (same _Prompt sentence):
//   Pre-condition: a markdown document with no `## Gate A` or `## Gate B`
//   heading.
//   Test: parseGateSections(md).
//   Observable result: { gateA: null, gateB: null }.
//   Expected-value source: the _Prompt sentence ("null when the heading … is
//   missing").

describe('project-watch parsers', () => {
  describe('parseHandoffRouting', () => {
    it('reads spec, phase, state and result from a full HANDOFF header', () => {
      const md = [
        '> **READ FIRST — SDD routing (2026-09-29, harness v4).** Active spec **`harness-control-pane`**.',
        '> Live phase **document**, state **in-progress**, last result **gate-a**.',
        '> Roots: spec store `/tmp/foo/.spec-workflow`, code `/tmp/foo`.',
        '> A re-run does: continue the sdd process.',
      ].join('\n');

      expect(parseHandoffRouting(md)).toEqual({
        spec: 'harness-control-pane',
        phase: 'document',
        state: 'in-progress',
        result: 'gate-a',
      });
    });

    it('returns null phase, state and result when the header has a spec but no live-phase line', () => {
      const md = [
        '> **READ FIRST — SDD routing (2026-09-29, harness v4).** Active spec **`other-spec`**.',
        '> Roots: spec store `/tmp/foo/.spec-workflow`, code `/tmp/foo`.',
      ].join('\n');

      expect(parseHandoffRouting(md)).toEqual({
        spec: 'other-spec',
        phase: null,
        state: null,
        result: null,
      });
    });

    it('returns null when the HANDOFF has no routing header', () => {
      const md = '# Just a document\n\nSome prose with no routing header.';

      expect(parseHandoffRouting(md)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseHandoffRouting(undefined)).toBeNull();
    });
  });

  describe('parseGateSections', () => {
    it('returns the Gate A text and null Gate B when only Gate A is present', () => {
      const md = [
        '# Questions — some-spec',
        '',
        '## Gate A',
        '',
        '1. **Question** — some question?',
        '   - answer: yes',
      ].join('\n');

      expect(parseGateSections(md)).toEqual({
        gateA: '1. **Question** — some question?\n   - answer: yes',
        gateB: null,
      });
    });

    it('returns both sections trimmed, Gate A stopping at the Gate B heading', () => {
      const md = [
        '# Questions — some-spec',
        '',
        '## Gate A',
        '',
        'Question A text here.',
        '',
        '## Gate B',
        '',
        'Question B text here.',
      ].join('\n');

      expect(parseGateSections(md)).toEqual({
        gateA: 'Question A text here.',
        gateB: 'Question B text here.',
      });
    });

    it('returns null for both sections when neither heading is present', () => {
      const md = '# Questions — some-spec\n\nNo gate sections here, just prose.';

      expect(parseGateSections(md)).toEqual({ gateA: null, gateB: null });
    });
  });
});
