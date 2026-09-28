import { describe, it, expect } from 'vitest';
import { parseTestLine, parseTasksFromMarkdown, TEST_BULLET_RE } from '../task-parser.js';

// The Test line splits the test path from the call on a space-padded em dash
// (U+2014). Fixtures use single-quoted strings so backticks stay literal.

describe('TEST_BULLET_RE', () => {
  it('marks a Test bullet and captures the text after Test:', () => {
    const m = '- Test: tests/foo.test.ts — foo()'.match(TEST_BULLET_RE);
    expect(m?.[1]).toBe('tests/foo.test.ts — foo()');
  });
});

describe('parseTestLine', () => {
  it('parses the plain form into a path and seam', () => {
    expect(parseTestLine('tests/foo.test.ts — foo(input)')).toEqual({
      test: { path: 'tests/foo.test.ts', seam: 'foo(input)' },
    });
  });

  it('strips one wrapping backtick pair from the path and the seam', () => {
    expect(parseTestLine('`tests/foo.test.ts` — `foo(input)`')).toEqual({
      test: { path: 'tests/foo.test.ts', seam: 'foo(input)' },
    });
  });

  it('stores a ./ path root-relative with forward slashes', () => {
    expect(parseTestLine('./tests/foo.test.ts — foo()')).toEqual({
      test: { path: 'tests/foo.test.ts', seam: 'foo()' },
    });
  });

  it('stores a backslash path with forward slashes', () => {
    expect(parseTestLine('tests\\bar.test.ts — bar()')).toEqual({
      test: { path: 'tests/bar.test.ts', seam: 'bar()' },
    });
  });

  it('reports no-dash when there is no space-padded em dash', () => {
    expect(parseTestLine('readFile: x')).toEqual({ error: 'no-dash' });
  });

  it('reports empty-call when the call text is empty', () => {
    expect(parseTestLine('tests/foo.test.ts — ')).toEqual({ error: 'empty-call' });
  });

  it('reports not-test-path when the path is not a test path', () => {
    expect(parseTestLine('src/foo.ts — foo()')).toEqual({ error: 'not-test-path' });
  });
});

describe('parseTasksFromMarkdown — Test lines', () => {
  it('collects backticked and plain Test lines into tests in document order', () => {
    const md = [
      '- [ ] 1. A task',
      '  - File: src/foo.ts',
      '  - Test: `tests/foo.test.ts` — `foo(input)`',
      '  - Test: tests/bar.test.ts — bar(input)',
      '',
    ].join('\n');
    const { tasks } = parseTasksFromMarkdown(md);
    expect(tasks[0].tests).toEqual([
      { path: 'tests/foo.test.ts', seam: 'foo(input)' },
      { path: 'tests/bar.test.ts', seam: 'bar(input)' },
    ]);
  });

  it('stores a ./ path and a backslash path normalised', () => {
    const md = [
      '- [ ] 1. A task',
      '  - Test: ./tests/foo.test.ts — foo()',
      '  - Test: tests\\bar.test.ts — bar()',
      '',
    ].join('\n');
    const { tasks } = parseTasksFromMarkdown(md);
    expect(tasks[0].tests).toEqual([
      { path: 'tests/foo.test.ts', seam: 'foo()' },
      { path: 'tests/bar.test.ts', seam: 'bar()' },
    ]);
  });

  it('emits no tests key when the task holds no Test line', () => {
    const { tasks } = parseTasksFromMarkdown('- [ ] 1. A task\n  - File: src/foo.ts\n');
    expect(tasks[0].tests).toBeUndefined();
  });

  it('keeps each malformed Test line in implementationDetails, never in files', () => {
    const md = [
      '- [ ] 1. A task',
      '  - Test: readFile: x',
      '  - Test: `tests/empty.test.ts` — ``',
      '  - Test: src/foo.ts — foo()',
      '',
    ].join('\n');
    const { tasks } = parseTasksFromMarkdown(md);
    expect(tasks[0].tests).toBeUndefined();
    expect(tasks[0].files).toBeUndefined();
    expect(tasks[0].implementationDetails).toEqual([
      'Test: readFile: x',
      'Test: `tests/empty.test.ts` — ``',
      'Test: src/foo.ts — foo()',
    ]);
  });

  it('keeps a seam that holds readFile: x out of files', () => {
    const md = [
      '- [ ] 1. A task',
      '  - Test: tests/reader.test.ts — readFile: x',
      '',
    ].join('\n');
    const { tasks } = parseTasksFromMarkdown(md);
    expect(tasks[0].tests).toEqual([{ path: 'tests/reader.test.ts', seam: 'readFile: x' }]);
    expect(tasks[0].files).toBeUndefined();
  });
});
