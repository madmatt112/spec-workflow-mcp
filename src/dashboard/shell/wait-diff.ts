// src/dashboard/shell/wait-diff.ts
//
// Live diff read for the ruling view (design.md C6, Data Models; Requirement
// 4 AC 2 to AC 8, AC 10). The task's diff is read from git on every open —
// never cached on the server, never stored on the wait record — capped to a
// bounded size, and path-free.
import { execFile, type ExecFileException } from 'child_process';
import { stat } from 'fs/promises';
import { scrubbedGitEnv } from '../../core/git-utils.js';
import type { DiffCommit, DiffFile, DiffHunk, WaitDiff } from './types.js';

const HASH_RE = /^[0-9a-f]{7,40}$/;
const MAX_FILES_WITH_HUNKS = 60;
const MAX_LINES_PER_FILE = 400;
const MAX_JSON_BYTES = 512 * 1024;
const MAX_BUFFER = 32 * 1024 * 1024;
const SHORT_HASH_WIDTH = 8;

type GitError = ExecFileException & { stderr?: string };
type GitResult = { stdout: string } | { error: GitError };

function runGit(args: string[], cwd: string, timeout: number): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, env: scrubbedGitEnv(), timeout: Math.max(timeout, 0), maxBuffer: MAX_BUFFER, encoding: 'utf-8' },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ error: Object.assign(error, { stderr }) as GitError });
        } else {
          resolve({ stdout: stdout as unknown as string });
        }
      }
    );
  });
}

function timeoutMessage(timeoutMs: number): string {
  return `git timed out after ${timeoutMs / 1000} s`;
}

/** Replaces the worktree path, then any other `/`-leading token, so no absolute path reaches the wire (R4 AC 10). */
function scrubPath(text: string, worktree: string): string {
  return text
    .split(worktree)
    .join('.')
    .split(' ')
    .map((token) => (token.startsWith('/') ? '[path]' : token))
    .join(' ');
}

function gitErrorMessage(error: GitError, worktree: string, timeoutMs: number): string {
  if (error.killed) return timeoutMessage(timeoutMs);
  if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'git output over 32 MiB';
  const stderr = error.stderr ?? '';
  const firstLine = stderr.split('\n').find((line) => line.trim().length > 0) ?? error.message;
  return scrubPath(firstLine, worktree);
}

/**
 * Parses `git show --no-color --no-ext-diff --format=%h%x00%s` output
 * (design.md C6 Interfaces). Pure.
 */
export function parseShow(text: string): { hash: string; subject: string; files: DiffFile[] } {
  const lines = text.split('\n');
  const [hash = '', subject = ''] = (lines[0] ?? '').split('\0');
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;

  for (const line of lines.slice(1)) {
    const headerMatch = line.match(/^diff --git a\/(.*) b\/(.*)$/);
    if (headerMatch) {
      current = { path: headerMatch[2], binary: false, hunks: [], droppedLines: 0 };
      currentHunk = null;
      files.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('--- a/')) {
      current.path = line.slice('--- a/'.length);
      continue;
    }
    if (line.startsWith('+++ b/')) {
      current.path = line.slice('+++ b/'.length);
      continue;
    }
    if (/^Binary files .* differ$/.test(line)) {
      current.binary = true;
      continue;
    }
    if (line.startsWith('@@')) {
      currentHunk = { header: line, lines: [] };
      current.hunks.push(currentHunk);
      continue;
    }
    if (!currentHunk) continue;
    if (line.startsWith('\\')) continue;
    if (line.startsWith('+')) {
      currentHunk.lines.push({ kind: 'add', text: line.slice(1) });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({ kind: 'del', text: line.slice(1) });
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({ kind: 'ctx', text: line.slice(1) });
    }
  }

  return { hash, subject, files };
}

function capFileLines(file: DiffFile): DiffFile {
  if (file.binary) return file;
  let kept = 0;
  let dropped = file.droppedLines;
  const hunks: DiffHunk[] = [];
  for (const hunk of file.hunks) {
    const remaining = MAX_LINES_PER_FILE - kept;
    if (remaining <= 0) {
      dropped += hunk.lines.length;
      continue;
    }
    if (hunk.lines.length <= remaining) {
      hunks.push(hunk);
      kept += hunk.lines.length;
    } else {
      hunks.push({ header: hunk.header, lines: hunk.lines.slice(0, remaining) });
      dropped += hunk.lines.length - remaining;
      kept += remaining;
    }
  }
  return { ...file, hunks, droppedLines: dropped };
}

function moveLastFileToOverflow(
  result: Extract<WaitDiff, { state: 'ok' }>
): Extract<WaitDiff, { state: 'ok' }> | null {
  for (let i = result.commits.length - 1; i >= 0; i--) {
    const commit = result.commits[i];
    if (commit.files.length === 0) continue;
    const files = commit.files.slice();
    const moved = files.pop()!;
    const commits = result.commits.slice();
    commits[i] = { ...commit, files };
    return {
      state: 'ok',
      commits,
      overflow: { count: result.overflow.count + 1, paths: [...result.overflow.paths, moved.path] },
    };
  }
  return null;
}

/**
 * Caps a parsed diff to the bounds in design.md C6 Interfaces: at most 60
 * files with hunks or binary (later files move to `overflow`), at most 400
 * hunk lines per kept file, and at most 512 KiB of JSON overall. Pure.
 */
export function capDiff(commits: DiffCommit[]): WaitDiff {
  const overflowPaths: string[] = [];
  let filesWithHunksSeen = 0;
  const cappedCommits: DiffCommit[] = commits.map((commit) => {
    const keptFiles: DiffFile[] = [];
    for (const file of commit.files) {
      const countsTowardCap = file.hunks.length > 0 || file.binary;
      if (countsTowardCap && filesWithHunksSeen >= MAX_FILES_WITH_HUNKS) {
        overflowPaths.push(file.path);
        continue;
      }
      if (countsTowardCap) filesWithHunksSeen++;
      keptFiles.push(capFileLines(file));
    }
    return { ...commit, files: keptFiles };
  });

  let result: Extract<WaitDiff, { state: 'ok' }> = {
    state: 'ok',
    commits: cappedCommits,
    overflow: { count: overflowPaths.length, paths: overflowPaths },
  };

  while (Buffer.byteLength(JSON.stringify(result), 'utf-8') > MAX_JSON_BYTES) {
    const moved = moveLastFileToOverflow(result);
    if (!moved) break;
    result = moved;
  }

  return result;
}

/**
 * Reads the diff for a wait's commits from the run's worktree (design.md C6
 * Interfaces; Requirement 4 AC 2 to AC 8, AC 10). One `timeoutMs` budget
 * (default 10 000) covers every git call in the request.
 */
export async function readWaitDiff(
  wait: { commits?: string[] },
  run: { worktree: string } | undefined,
  opts?: { timeoutMs?: number }
): Promise<WaitDiff> {
  if (!run) return { state: 'run-gone' };
  if (!wait.commits || wait.commits.length === 0) return { state: 'no-commits' };

  try {
    await stat(run.worktree);
  } catch {
    return { state: 'worktree-gone' };
  }

  const timeoutMs = opts?.timeoutMs ?? 10000;
  const start = Date.now();
  const commits: DiffCommit[] = [];

  for (const hash of wait.commits) {
    if (!HASH_RE.test(hash)) {
      commits.push({ hash: hash.slice(0, SHORT_HASH_WIDTH), subject: '', found: false, files: [] });
      continue;
    }

    const existsRemaining = timeoutMs - (Date.now() - start);
    if (existsRemaining <= 0) return { state: 'unreadable', error: timeoutMessage(timeoutMs) };
    const exists = await runGit(['cat-file', '-e', `${hash}^{commit}`], run.worktree, existsRemaining);
    if ('error' in exists) {
      const err = exists.error;
      if (err.killed || err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        return { state: 'unreadable', error: gitErrorMessage(err, run.worktree, timeoutMs) };
      }
      commits.push({ hash: hash.slice(0, SHORT_HASH_WIDTH), subject: '', found: false, files: [] });
      continue;
    }

    const showRemaining = timeoutMs - (Date.now() - start);
    if (showRemaining <= 0) return { state: 'unreadable', error: timeoutMessage(timeoutMs) };
    const show = await runGit(
      ['show', '--no-color', '--no-ext-diff', '--format=%h%x00%s', hash, '--'],
      run.worktree,
      showRemaining
    );
    if ('error' in show) {
      return { state: 'unreadable', error: gitErrorMessage(show.error, run.worktree, timeoutMs) };
    }

    const parsed = parseShow(show.stdout);
    commits.push({ hash: parsed.hash, subject: parsed.subject, found: true, files: parsed.files });
  }

  return capDiff(commits);
}
