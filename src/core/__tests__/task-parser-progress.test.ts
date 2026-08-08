import { describe, it, expect } from 'vitest';
import { parseTaskProgress } from '../task-parser.js';

describe('parseTaskProgress', () => {
  it('counts in-progress tasks separately from pending and completed', () => {
    expect(parseTaskProgress('- [x] 1. Done\n- [-] 2. Underway\n- [ ] 3. Todo\n')).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      pending: 1,
      unparsed: 0,
    });
  });

  // A checkbox with no leading task number is dropped by the parser. It counts toward
  // nothing, so without `unparsed` a spec can read Complete while tasks.md lists open work.
  it('counts open checkbox lines it could not parse', () => {
    const progress = parseTaskProgress('- [x] 1. Done\n- [ ] Forgot to number this one\n');
    expect(progress).toMatchObject({ total: 1, completed: 1, unparsed: 1 });
  });

  it('counts an in-progress unnumbered checkbox as unparsed', () => {
    expect(parseTaskProgress('- [x] 1. Done\n- [-] Started but unnumbered\n').unparsed).toBe(1);
  });

  // Specs commonly close with an "Implementation log" of `- [x] Task 3 — ...` entries.
  // Those are a record of finished work, not counts the parser is missing; warning on
  // them fires on most real specs and trains the reader to ignore the warning.
  it('ignores completed unnumbered checkboxes, as used by implementation logs', () => {
    const progress = parseTaskProgress(
      '- [x] 1. Done\n- [ ] 2. Todo\n\n## Implementation log\n\n- [x] Task 1 — did the thing\n- [x] Task 2 — did the other thing\n'
    );
    expect(progress).toMatchObject({ total: 2, completed: 1, unparsed: 0 });
  });

  it('counts a bare checkbox with no text when still open', () => {
    expect(parseTaskProgress('- [ ]\n').unparsed).toBe(1);
    expect(parseTaskProgress('- [x]\n').unparsed).toBe(0);
  });

  it('reports no unparsed lines for a well-formed list', () => {
    expect(parseTaskProgress('- [x] 1. Done\n- [ ] 2. Todo\n').unparsed).toBe(0);
  });

  it('reports zeroes for an empty task list', () => {
    expect(parseTaskProgress('# Tasks\n\nNothing yet.\n')).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      unparsed: 0,
    });
  });
});
