import { describe, it, expect } from 'vitest';
import {
  fencedLines,
  blocks,
  criteria,
  taskBlocks,
  type Block,
} from '../lint-markdown.js';

const split = (s: string): string[] => s.split('\n');

describe('fencedLines', () => {
  it('masks the fence delimiters and their contents, inclusive', () => {
    const lines = split(['text', '```ts', 'code', '```', 'after'].join('\n'));
    expect(fencedLines(lines)).toEqual([false, true, true, true, false]);
  });

  it('masks an indented fence and masks to EOF when unclosed', () => {
    const lines = split(['  ```', 'inside', 'still inside'].join('\n'));
    expect(fencedLines(lines)).toEqual([true, true, true]);
  });
});

describe('blocks', () => {
  const run = (text: string): Block[] => {
    const lines = split(text);
    return blocks(lines, fencedLines(lines));
  };

  it('starts a block at a non-blank line after a blank line', () => {
    const result = run(['', 'a paragraph', 'still the paragraph', '', 'next'].join('\n'));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ start: 2, end: 3, lines: ['a paragraph', 'still the paragraph'] });
    expect(result[1]).toEqual({ start: 5, end: 5, lines: ['next'] });
  });

  it('starts a block at a non-blank line after a fenced line', () => {
    const result = run(['```', 'code', '```', 'right after fence'].join('\n'));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ start: 4, end: 4, lines: ['right after fence'] });
  });

  it('starts a new block at each list item even without a blank line', () => {
    const result = run(['- one', '- two', '  continued'].join('\n'));
    expect(result.map((b) => b.start)).toEqual([1, 2]);
    expect(result[1].lines).toEqual(['- two', '  continued']);
  });

  it('starts a new block at a table row and at a heading', () => {
    const result = run(['| a | b |', '| c | d |', '## Heading'].join('\n'));
    expect(result.map((b) => b.start)).toEqual([1, 2, 3]);
    expect(result[2].lines).toEqual(['## Heading']);
  });
});

describe('criteria', () => {
  it('collects numbered items under Acceptance Criteria with their requirement', () => {
    const text = [
      '### Requirement 1 — The tool',
      '#### Acceptance Criteria',
      '1. The server SHALL do a thing.',
      '2. The server SHALL do another.',
    ].join('\n');
    const result = criteria(split(text));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ requirement: 1, number: 1, line: 3, text: 'The server SHALL do a thing.' });
    expect(result[1].number).toBe(2);
  });

  it('joins continuation lines with a single space', () => {
    const text = [
      '### Requirement 2',
      '#### Acceptance Criteria',
      '1. First line',
      '   second line',
      '   third line',
    ].join('\n');
    const result = criteria(split(text));
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('First line second line third line');
  });

  it('ignores numbered items outside an Acceptance Criteria section and before any requirement', () => {
    const text = [
      '1. not a criterion',
      '#### Acceptance Criteria',
      '1. counts with null requirement',
      '## Other section',
      '2. no longer counts',
    ].join('\n');
    const result = criteria(split(text));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ requirement: null, number: 1, line: 3 });
  });
});

describe('taskBlocks', () => {
  it('bounds a block at the next checkbox line', () => {
    const text = ['- [ ] 1. First', '  - Purpose: x', '- [ ] 2. Second'].join('\n');
    const result = taskBlocks(split(text));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ line: 1, id: '1', lines: ['- [ ] 1. First', '  - Purpose: x'] });
    expect(result[1]).toMatchObject({ line: 3, id: '2' });
  });

  it('bounds a block at the next h2 heading and ignores h3', () => {
    const text = ['- [ ] 3.1 Task', '### Component 1', 'still block', '## Decisions', 'after'].join('\n');
    const result = taskBlocks(split(text));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ line: 1, id: '3.1' });
    expect(result[0].lines).toEqual(['- [ ] 3.1 Task', '### Component 1', 'still block']);
  });

  it('bounds the last block at EOF and reports null id for an unnumbered checkbox', () => {
    const text = ['- [ ] no number here', '  - File: x.ts'].join('\n');
    const result = taskBlocks(split(text));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ line: 1, id: null });
    expect(result[0].lines).toEqual(['- [ ] no number here', '  - File: x.ts']);
  });

  it('captures a single-line prompt only', () => {
    const text = ['- [ ] 1. Task', '  - _Prompt: Do it | Restrictions: none | Success: green_', '  - Purpose: x'].join('\n');
    const result = taskBlocks(split(text));
    expect(result[0].promptLines).toEqual(['  - _Prompt: Do it | Restrictions: none | Success: green_']);
  });

  it('captures a multi-line prompt up to a stop line', () => {
    const text = [
      '- [ ] 1. Task',
      '  - _Prompt: Do it',
      '    across two lines',
      '  - Purpose: stop here',
    ].join('\n');
    const result = taskBlocks(split(text));
    expect(result[0].promptLines).toEqual(['  - _Prompt: Do it', '    across two lines']);
  });
});
