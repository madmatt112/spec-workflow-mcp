/**
 * Red tests for `src/dashboard/shell/wait-diff.ts` (task 8; design.md C6;
 * requirements.md Requirement 4 AC 2 to AC 8, AC 10).
 *
 * Reached only through `parseShow(text)`, `capDiff(commits)` and
 * `readWaitDiff(wait, run, opts)`. The `readWaitDiff` cases run on a real
 * temporary git repository (task 8 Note); `child_process` is mocked only to
 * count `execFile` invocations (passthrough to the real implementation, the
 * pattern `src/core/__tests__/git-utils-worktree.test.ts` uses for `execSync`),
 * never to fake git's output.
 *
 * Contract, per case below — pre-condition, the call through the seam, the
 * observable result, and the source of the expected value:
 *
 * 1. `parseShow` on a captured `git show --format=%h%x00%s` text with a
 *    context, a removed and an added line, and a trailing `\` line.
 *    Call: `parseShow(text)`.
 *    Result: `hash`/`subject` from line one; one file with one hunk holding
 *    the three lines in order, kinds `ctx`/`del`/`add`; the `\` line produces
 *    no fourth line.
 *    Source: design.md C6 Interfaces — "line one splits on NUL into hash and
 *    subject ... `+` is add, `-` is del, space is ctx, `\` lines are
 *    skipped"; task 8 Success — "reads hash and subject, an added, a removed
 *    and a context line, skips a `\` line".
 * 2. `parseShow` on a captured text whose only file is reported binary.
 *    Call: `parseShow(text)`.
 *    Result: that file has `binary: true` and no hunks.
 *    Source: design.md C6 Interfaces — "`Binary files … differ` sets
 *    binary"; task 8 Success — "marks a binary file".
 * 3. `capDiff` on one commit with 61 files, each with one hunk.
 *    Call: `capDiff(commits)`.
 *    Result: the commit keeps hunks for the first 60 files; the 61st's path
 *    moves to `overflow.paths` with `overflow.count` 1.
 *    Source: design.md C6 Interfaces — "hunks are kept for the first 60
 *    files with hunks or binary; each later file leaves its commit and its
 *    path goes to `overflow.paths`"; task 8 Success.
 * 4. `capDiff` on one commit with one file whose hunk holds 450 lines.
 *    Call: `capDiff(commits)`.
 *    Result: the kept file holds 400 lines and `droppedLines` 50.
 *    Source: design.md C6 Interfaces — "each kept file keeps 400 hunk lines
 *    and `droppedLines` counts the rest"; task 8 Success.
 * 5. `capDiff` on one commit with 20 files whose JSON exceeds 512 KiB.
 *    Call: `capDiff(commits)`.
 *    Result: the result's JSON size is at most 512 KiB; the last file moved
 *    to `overflow`.
 *    Source: design.md C6 Interfaces — "while `JSON.stringify` of the result
 *    is over 512 KiB, kept files move from the end into `overflow`"; task 8
 *    Success.
 * 6. `readWaitDiff` with one commit that added a line, on a real repo.
 *    Call: `readWaitDiff({ commits: [commit2] }, { worktree: repoDir })`.
 *    Result: `state: 'ok'`; the commit is `found`, its `hash` is a prefix of
 *    the full hash, its `subject` is the commit message, and its files hold
 *    an `add` line with the new text.
 *    Source: requirements.md R4 AC 2; task 8 Success — "readWaitDiff gives
 *    ok with the commit's short hash, subject and added lines".
 * 7. `readWaitDiff` with the real commit and a well-formed hash absent from
 *    the repo (a rewrite).
 *    Call: `readWaitDiff({ commits: [commit1, bogus] }, { worktree: repoDir })`.
 *    Result: the real commit is `found: true` with files; the bogus one is
 *    `found: false`.
 *    Source: requirements.md R4 AC 6; task 8 Success — "a rewritten hash is
 *    listed not found while the other commit renders".
 * 8. `readWaitDiff` with a hash that fails `^[0-9a-f]{7,40}$`.
 *    Call: `readWaitDiff({ commits: ['zzzzzzz'] }, { worktree: repoDir })`.
 *    Result: that commit is `found: false`, and `execFile` is never called.
 *    Source: requirements.md R4 AC 3; design.md C6 Interfaces — "a hash
 *    failing `^[0-9a-f]{7,40}$` never reaches git"; task 8 Success.
 * 9. `readWaitDiff` with `run` undefined.
 *    Call: `readWaitDiff({ commits: [commit1] }, undefined)`.
 *    Result: `{ state: 'run-gone' }`.
 *    Source: requirements.md R4 AC 7; task 8 Success — "no run gives
 *    run-gone".
 * 10. `readWaitDiff` with no `commits` on the wait.
 *    Call: `readWaitDiff({}, { worktree: repoDir })`.
 *    Result: `{ state: 'no-commits' }`.
 *    Source: requirements.md R4 AC 7; task 8 Success — "no commits gives
 *    no-commits".
 * 11. `readWaitDiff` with a worktree path that does not exist.
 *    Call: `readWaitDiff({ commits: [commit1] }, { worktree: <missing> })`.
 *    Result: `{ state: 'worktree-gone' }`.
 *    Source: requirements.md R4 AC 5; task 8 Success — "a missing worktree
 *    gives worktree-gone".
 * 12. `readWaitDiff` on a real repo with `opts.timeoutMs` 1.
 *    Call: `readWaitDiff({ commits: [commit1] }, { worktree: repoDir }, { timeoutMs: 1 })`.
 *    Result: `state: 'unreadable'`; `error` names no absolute path (does not
 *    contain the worktree path and does not start with `/`).
 *    Source: requirements.md R4 AC 8, AC 10; task 8 Success — "timeoutMs: 1
 *    gives unreadable whose error holds no absolute path".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scrubbedGitEnv } from '../../../core/git-utils.js';
import type { DiffCommit, DiffFile } from '../types.js';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, execFile: vi.fn(actual.execFile) };
});

import * as childProcess from 'child_process';
import { parseShow, capDiff, readWaitDiff } from '../wait-diff.js';

const mockedExecFile = vi.mocked(childProcess.execFile);

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', env: scrubbedGitEnv() }).trim();
}

function makeFile(path: string): DiffFile {
  return {
    path,
    binary: false,
    hunks: [{ header: '@@ -1,1 +1,1 @@', lines: [{ kind: 'add', text: 'x' }] }],
    droppedLines: 0,
  };
}

describe('parseShow', () => {
  it('reads hash and subject, an added, a removed and a context line, and skips a \\ line', () => {
    const text = [
      'abc1234\0Add a greeting',
      '',
      'diff --git a/file.txt b/file.txt',
      'index 1111111..2222222 100644',
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1,3 +1,3 @@',
      ' context line',
      '-removed line',
      '+added line',
      '\\ No newline at end of file',
      '',
    ].join('\n');

    const result = parseShow(text);

    expect(result.hash).toBe('abc1234');
    expect(result.subject).toBe('Add a greeting');
    expect(result.files).toEqual([
      {
        path: 'file.txt',
        binary: false,
        droppedLines: 0,
        hunks: [
          {
            header: '@@ -1,3 +1,3 @@',
            lines: [
              { kind: 'ctx', text: 'context line' },
              { kind: 'del', text: 'removed line' },
              { kind: 'add', text: 'added line' },
            ],
          },
        ],
      },
    ]);
  });

  it('marks a binary file', () => {
    const text = [
      'def5678\0Add binary asset',
      '',
      'diff --git a/image.png b/image.png',
      'new file mode 100644',
      'index 0000000..3333333',
      'Binary files /dev/null and b/image.png differ',
      '',
    ].join('\n');

    const result = parseShow(text);

    expect(result.files).toEqual([{ path: 'image.png', binary: true, hunks: [], droppedLines: 0 }]);
  });
});

describe('capDiff', () => {
  it('keeps hunks for the first 60 files and lists the 61st under overflow with its count', () => {
    const files = Array.from({ length: 61 }, (_, i) => makeFile(`file${i}.ts`));
    const commits: DiffCommit[] = [{ hash: 'abc1234', subject: 'many files', found: true, files }];

    const result = capDiff(commits);

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') throw new Error('unreachable');
    expect(result.commits[0].files).toHaveLength(60);
    expect(result.commits[0].files.map((f) => f.path)).toEqual(files.slice(0, 60).map((f) => f.path));
    expect(result.overflow).toEqual({ count: 1, paths: ['file60.ts'] });
  });

  it('keeps 400 lines of a longer file with droppedLines the rest', () => {
    const lines = Array.from({ length: 450 }, (_, i) => ({ kind: 'add' as const, text: `line ${i}` }));
    const file: DiffFile = {
      path: 'big.ts',
      binary: false,
      hunks: [{ header: '@@ -1,450 +1,450 @@', lines }],
      droppedLines: 0,
    };
    const commits: DiffCommit[] = [{ hash: 'abc1234', subject: 'long file', found: true, files: [file] }];

    const result = capDiff(commits);

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') throw new Error('unreachable');
    const kept = result.commits[0].files[0];
    const keptLineCount = kept.hunks.reduce((n, h) => n + h.lines.length, 0);
    expect(keptLineCount).toBe(400);
    expect(kept.droppedLines).toBe(50);
  });

  it('moves files to overflow while the JSON is over 512 KiB', () => {
    const bigText = 'x'.repeat(1000);
    const files: DiffFile[] = Array.from({ length: 20 }, (_, i) => ({
      path: `big${i}.ts`,
      binary: false,
      hunks: [
        {
          header: '@@ -1,50 +1,50 @@',
          lines: Array.from({ length: 50 }, () => ({ kind: 'add' as const, text: bigText })),
        },
      ],
      droppedLines: 0,
    }));
    const commits: DiffCommit[] = [{ hash: 'abc1234', subject: 'huge diff', found: true, files }];

    const result = capDiff(commits);

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') throw new Error('unreachable');
    const size = Buffer.byteLength(JSON.stringify(result), 'utf-8');
    expect(size).toBeLessThanOrEqual(512 * 1024);
    expect(result.overflow.count).toBeGreaterThan(0);
    expect(result.overflow.paths).toContain('big19.ts');
    expect(result.commits[0].files.some((f) => f.path === 'big19.ts')).toBe(false);
  });
});

describe('readWaitDiff', () => {
  let repoDir: string;
  let commit1: string;
  let commit2: string;

  beforeEach(() => {
    mockedExecFile.mockClear();
    repoDir = mkdtempSync(join(tmpdir(), 'wait-diff-'));
    git(repoDir, ['init', '-q', '-b', 'main', '.']);
    git(repoDir, ['config', 'user.email', 'fixture@example.com']);
    git(repoDir, ['config', 'user.name', 'Fixture']);

    writeFileSync(join(repoDir, 'greeting.txt'), 'context line\nremoved line\n');
    git(repoDir, ['add', 'greeting.txt']);
    git(repoDir, ['commit', '-q', '-m', 'Initial commit']);
    commit1 = git(repoDir, ['rev-parse', 'HEAD']);

    writeFileSync(join(repoDir, 'greeting.txt'), 'context line\nadded line\n');
    git(repoDir, ['add', 'greeting.txt']);
    git(repoDir, ['commit', '-q', '-m', 'Add a greeting']);
    commit2 = git(repoDir, ['rev-parse', 'HEAD']);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('gives ok with the commit short hash, subject and added lines', async () => {
    const result = await readWaitDiff({ commits: [commit2] }, { worktree: repoDir });

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') throw new Error('unreachable');
    expect(result.commits).toHaveLength(1);
    const [commit] = result.commits;
    expect(commit.found).toBe(true);
    expect(commit.hash.length).toBeGreaterThanOrEqual(7);
    expect(commit2.startsWith(commit.hash)).toBe(true);
    expect(commit.subject).toBe('Add a greeting');
    const addedLines = commit.files
      .flatMap((f) => f.hunks.flatMap((h) => h.lines))
      .filter((l) => l.kind === 'add')
      .map((l) => l.text);
    expect(addedLines).toContain('added line');
  });

  it('lists a rewritten hash as not found while the other commit renders', async () => {
    const bogus = 'deadbeef';
    const result = await readWaitDiff({ commits: [commit1, bogus] }, { worktree: repoDir });

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') throw new Error('unreachable');
    expect(result.commits).toHaveLength(2);
    expect(result.commits[0].found).toBe(true);
    expect(result.commits[0].files.length).toBeGreaterThan(0);
    expect(result.commits[1].found).toBe(false);
  });

  it('lists an invalid hash as not found without reaching git', async () => {
    const result = await readWaitDiff({ commits: ['zzzzzzz'] }, { worktree: repoDir });

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') throw new Error('unreachable');
    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].found).toBe(false);
    expect(mockedExecFile).not.toHaveBeenCalled();
  });

  it('gives run-gone with no run', async () => {
    const result = await readWaitDiff({ commits: [commit1] }, undefined);
    expect(result).toEqual({ state: 'run-gone' });
  });

  it('gives no-commits with no commits on the wait', async () => {
    const result = await readWaitDiff({}, { worktree: repoDir });
    expect(result).toEqual({ state: 'no-commits' });
  });

  it('gives worktree-gone for a missing worktree', async () => {
    const result = await readWaitDiff({ commits: [commit1] }, { worktree: join(repoDir, 'nope') });
    expect(result).toEqual({ state: 'worktree-gone' });
  });

  it('gives unreadable with no absolute path in error when timeoutMs is 1', async () => {
    const result = await readWaitDiff({ commits: [commit1] }, { worktree: repoDir }, { timeoutMs: 1 });

    expect(result.state).toBe('unreadable');
    if (result.state !== 'unreadable') throw new Error('unreachable');
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
    expect(result.error).not.toContain(repoDir);
    expect(result.error.startsWith('/')).toBe(false);
  });
});
