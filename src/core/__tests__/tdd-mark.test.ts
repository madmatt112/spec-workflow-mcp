import { describe, it, expect } from 'vitest';
import { isTddMarked } from '../tdd-mark.js';
import { parseTasksFromMarkdown, taskBlock } from '../task-parser.js';

// retro F5/P5: the controller and the brief tool now route on this one predicate,
// so for any block they return the same marking. This battery drives the shared
// predicate the way both surfaces do — parse the task, slice its block, call
// isTddMarked(task, block) — so a divergence like the task-7 crash cannot recur.

/** Parse `md`, take task `id`, and return isTddMarked over its own block. */
function markingOf(md: string, id: string): boolean {
  const task = parseTasksFromMarkdown(md).tasks.find((t) => t.id === id)!;
  return isTddMarked(task, taskBlock(md, id)!);
}

const SEAM = '  - Test: src/__tests__/a.test.ts — `a()`';

describe('isTddMarked (the single routing predicate)', () => {
  it('false when the task has no Test seam', () => {
    const md = ['- [ ] 1. Do it', '  - File: src/a.ts', '  - Purpose: do it.'].join('\n');
    expect(markingOf(md, '1')).toBe(false);
  });

  it('true for a plain TDD task (a Test seam, no e2e marker)', () => {
    const md = ['- [ ] 1. Do it', '  - File: src/a.ts', SEAM, '  - Purpose: do it.'].join('\n');
    expect(markingOf(md, '1')).toBe(true);
  });

  it('false when a standalone kind: e2e marker line is present', () => {
    const md = ['- [ ] 1. Do it', '  - File: src/a.ts', SEAM, '  - kind: e2e', '  - Purpose: do it.'].join('\n');
    expect(markingOf(md, '1')).toBe(false);
  });

  it('true when prose only quotes `kind: e2e` in a code span', () => {
    const md = ['- [ ] 1. Do it', '  - File: src/a.ts', SEAM, '  - Purpose: do it, not `kind: e2e`.'].join('\n');
    expect(markingOf(md, '1')).toBe(true);
  });

  it('matches the marker on its own non-bulleted line too', () => {
    const md = ['- [ ] 1. Do it', '  - File: src/a.ts', SEAM, '  kind: e2e', '  - Purpose: do it.'].join('\n');
    expect(markingOf(md, '1')).toBe(false);
  });
});
