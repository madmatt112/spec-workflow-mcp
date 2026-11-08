import { describe, it, expect } from 'vitest';
import { parseTestLine, parseTasksFromMarkdown, addTaskFiles, TEST_BULLET_RE } from '../task-parser.js';

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

  it('drops a parenthetical note that holds a comma from a File entry', () => {
    const md = [
      '- [ ] 1. A task',
      '  - File: specs/x/probe-YYYY-MM-DD.txt (create, run date in the name)',
      '  - Files: src/a.ts (modify), src/b.ts',
      '',
    ].join('\n');
    const { tasks } = parseTasksFromMarkdown(md);
    expect(tasks[0].files).toEqual(['specs/x/probe-YYYY-MM-DD.txt', 'src/a.ts', 'src/b.ts']);
  });

  it('drops a trailing dash description from a File entry', () => {
    const md = [
      '- [ ] 1. A task',
      '  - File: ind-register.txt (create, at the repo root) — design Component 6, the committed register copy',
      '',
    ].join('\n');
    const { tasks } = parseTasksFromMarkdown(md);
    expect(tasks[0].files).toEqual(['ind-register.txt']);
  });
});

describe('addTaskFiles', () => {
  it('inserts a new File: line after the task\'s only File: line, and the parser lists it', () => {
    const md = [
      '- [ ] 1. A task',
      '  - File: src/a.ts',
      '  - Purpose: do a thing',
      '',
    ].join('\n');
    const patched = addTaskFiles(md, '1', ['src/b.ts']);
    expect(patched).toBe([
      '- [ ] 1. A task',
      '  - File: src/a.ts',
      '  - File: src/b.ts',
      '  - Purpose: do a thing',
      '',
    ].join('\n'));
    const { tasks } = parseTasksFromMarkdown(patched!);
    expect(tasks[0].files).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('follows the last of two File:/Files: lines, leaving every other line byte-identical', () => {
    const md = [
      '- [ ] 1. A task',
      '  - File: src/a.ts',
      '  - Files: src/b.ts, src/c.ts',
      '  - Purpose: do a thing',
      '',
    ].join('\n');
    const patched = addTaskFiles(md, '1', ['src/d.ts']);
    expect(patched).toBe([
      '- [ ] 1. A task',
      '  - File: src/a.ts',
      '  - Files: src/b.ts, src/c.ts',
      '  - File: src/d.ts',
      '  - Purpose: do a thing',
      '',
    ].join('\n'));
  });

  it('inserts after the checkbox line when the task has no File: line', () => {
    const md = [
      '- [ ] 1. A task',
      '  - Purpose: do a thing',
      '',
    ].join('\n');
    const patched = addTaskFiles(md, '1', ['src/a.ts']);
    expect(patched).toBe([
      '- [ ] 1. A task',
      '  - File: src/a.ts',
      '  - Purpose: do a thing',
      '',
    ].join('\n'));
  });

  it('adds two files as two separate File: lines, and the parser lists both, every other line byte-identical', () => {
    const md = [
      '- [ ] 1. A task',
      '  - File: src/a.ts',
      '  - Purpose: do a thing',
      '- [ ] 2. Another task',
      '  - File: src/other.ts',
      '',
    ].join('\n');
    const patched = addTaskFiles(md, '1', ['src/b.ts', 'src/c.ts']);
    expect(patched).toBe([
      '- [ ] 1. A task',
      '  - File: src/a.ts',
      '  - File: src/b.ts',
      '  - File: src/c.ts',
      '  - Purpose: do a thing',
      '- [ ] 2. Another task',
      '  - File: src/other.ts',
      '',
    ].join('\n'));
    const { tasks } = parseTasksFromMarkdown(patched!);
    expect(tasks[0].files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(tasks[1].files).toEqual(['src/other.ts']);
  });

  it('returns undefined for an unknown task id', () => {
    const md = '- [ ] 1. A task\n  - File: src/a.ts\n';
    expect(addTaskFiles(md, '99', ['src/b.ts'])).toBeUndefined();
  });

  it('returns undefined for a path holding a comma', () => {
    const md = '- [ ] 1. A task\n  - File: src/a.ts\n';
    expect(addTaskFiles(md, '1', ['src/b.ts, src/c.ts'])).toBeUndefined();
  });

  it('returns undefined for a path holding a parenthesis', () => {
    const md = '- [ ] 1. A task\n  - File: src/a.ts\n';
    expect(addTaskFiles(md, '1', ['src/b(1).ts'])).toBeUndefined();
  });

  it('returns undefined for a path holding whitespace', () => {
    const md = '- [ ] 1. A task\n  - File: src/a.ts\n';
    expect(addTaskFiles(md, '1', ['src/b file.ts'])).toBeUndefined();
  });
});
