import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileCache } from '../file-cache.js';

// Contract for src/dashboard/shell/file-cache.ts (design.md C2; task 1 _Prompt;
// Requirement 2 AC 10).
//
// Criterion "reuse while mtime and size are unchanged" (design.md C2: "An
//   entry is reused while the file's statSync mtimeMs and size are
//   unchanged"):
//   Pre-condition: a file holding text A, mtime forced to a fixed time T via
//   utimesSync, read once through a FileCache instance's text(path). The
//   file is then overwritten with text B of the same byte length as A and
//   its mtime forced back to T.
//   Call: the same instance's text(path) a second time.
//   Observable result: returns A (the first read), not B.
//   Expected-value source: design.md C2 cache-reuse sentence.
//
// Criterion "a changed length busts the cache" (design.md C2, same sentence,
//   inverse branch; task 1 _Prompt "write text of another length and assert
//   the new text"):
//   Pre-condition: continuing from the case above, the file is overwritten
//   with text C of a different byte length than B (natural mtime, not
//   forced back to T).
//   Call: the same instance's text(path) a third time.
//   Observable result: returns C, the new text, not the cached A.
//   Expected-value source: design.md C2 cache-reuse sentence and the
//   _Prompt sentence.
//
// Criterion "a missing path never throws" (design.md C2: "a missing or
//   unreadable file gives undefined, [] or null and never throws"; task 1
//   _Prompt "a missing path gives undefined, [] and null"; Requirement 2 AC
//   10's "missing" file clause):
//   Pre-condition: a path under a freshly created temp dir that is never
//   written.
//   Call: new FileCache().text(path), .jsonl(path), .mtimeMs(path).
//   Observable result: undefined, [] and null respectively; none throws.
//   Expected-value source: design.md C2 and Requirement 2 AC 10.
//
// Criterion "a directory path gives undefined" (design.md C2 "unreadable
//   file" clause; task 1 _Prompt "a directory path gives undefined"):
//   Pre-condition: a path that is an existing directory, not a file.
//   Call: new FileCache().text(dirPath).
//   Observable result: undefined; no throw.
//   Expected-value source: the _Prompt sentence.
//
// Criterion "a torn trailing line is skipped" (Requirement 2 AC 10: "IF a
//   file the derivation reads is missing, empty or holds a torn line THEN
//   the system SHALL derive no wait from it and SHALL raise no error (the
//   torn-line skip of src/watch/ledger.ts:186-199)"):
//   Pre-condition: a file with two well-formed JSON lines followed by a
//   truncated, non-JSON final line and no trailing newline.
//   Call: new FileCache().jsonl(path).
//   Observable result: exactly the two well-formed rows, parsed; the torn
//   line is dropped; no throw.
//   Expected-value source: Requirement 2 AC 10 and the parseJsonl
//   torn-line skip it cites (src/watch/ledger.ts:186-199).
//
// Criterion "an empty file gives []" (Requirement 2 AC 10's "empty" file
//   clause; task 1 _Prompt "an empty file gives []"):
//   Pre-condition: a file created with zero bytes.
//   Call: new FileCache().jsonl(path).
//   Observable result: [].
//   Expected-value source: Requirement 2 AC 10 and the _Prompt sentence.

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'sdd-file-cache-'));
}

describe('FileCache', () => {
  it('reuses the cached text while mtime and size are unchanged', () => {
    const path = join(tmpDir(), 'a.txt');
    const T = new Date('2026-01-01T00:00:00.000Z');
    writeFileSync(path, 'aaaa');
    utimesSync(path, T, T);

    const cache = new FileCache();
    expect(cache.text(path)).toBe('aaaa');

    writeFileSync(path, 'bbbb'); // same byte length as 'aaaa'
    utimesSync(path, T, T);
    expect(cache.text(path)).toBe('aaaa');
  });

  it('returns fresh text once the file length changes', () => {
    const path = join(tmpDir(), 'a.txt');
    const T = new Date('2026-01-01T00:00:00.000Z');
    writeFileSync(path, 'aaaa');
    utimesSync(path, T, T);

    const cache = new FileCache();
    expect(cache.text(path)).toBe('aaaa');

    writeFileSync(path, 'a much longer replacement text');
    expect(cache.text(path)).toBe('a much longer replacement text');
  });

  it('never throws on a missing path', () => {
    const path = join(tmpDir(), 'missing.txt');
    const cache = new FileCache();
    expect(cache.text(path)).toBeUndefined();
    expect(cache.jsonl(path)).toEqual([]);
    expect(cache.mtimeMs(path)).toBeNull();
  });

  it('gives undefined for a directory path', () => {
    const dir = tmpDir();
    expect(new FileCache().text(dir)).toBeUndefined();
  });

  it('skips a torn trailing line in jsonl', () => {
    const path = join(tmpDir(), 'events.jsonl');
    writeFileSync(path, '{"a":1}\n{"a":2}\n{"a":3');
    expect(new FileCache().jsonl<{ a: number }>(path)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('gives [] for an empty file', () => {
    const path = join(tmpDir(), 'empty.jsonl');
    writeFileSync(path, '');
    expect(new FileCache().jsonl(path)).toEqual([]);
  });
});
