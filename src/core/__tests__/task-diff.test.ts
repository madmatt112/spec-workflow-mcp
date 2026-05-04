import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

import * as childProcess from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeTaskDiff } from '../task-diff.js';

const mockedExecFile = vi.mocked(childProcess.execFile);

let tempDir: string;
let actualExecFile: typeof childProcess.execFile;

function gitCmd(dir: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitInit(dir: string): void {
  gitCmd(dir, ['init', '-q', '-b', 'main']);
  gitCmd(dir, ['config', 'user.email', 'test@example.com']);
  gitCmd(dir, ['config', 'user.name', 'Test']);
  gitCmd(dir, ['config', 'commit.gpgsign', 'false']);
}

function gitCommitAll(dir: string, msg: string): void {
  gitCmd(dir, ['add', '-A']);
  gitCmd(dir, ['commit', '-q', '-m', msg]);
}

function installPassthrough(): void {
  mockedExecFile.mockImplementation(((
    file: string,
    args: readonly string[],
    opts: unknown,
    cb: unknown,
  ) =>
    (actualExecFile as unknown as (
      f: string,
      a: readonly string[],
      o: unknown,
      c: unknown,
    ) => childProcess.ChildProcess)(file, args, opts, cb)) as unknown as typeof childProcess.execFile);
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(join(tmpdir(), 'task-diff-test-'));
  const actual = await vi.importActual<typeof import('node:child_process')>(
    'node:child_process',
  );
  actualExecFile = actual.execFile;
  mockedExecFile.mockReset();
  installPassthrough();
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Empty / no-changes states
// ---------------------------------------------------------------------------

describe('computeTaskDiff — empty / no-changes states', () => {
  it('empty repo (no HEAD) degrades to safe state with no rejection field', async () => {
    gitInit(tempDir);
    const f = join(tempDir, 'a.ts');
    await fs.writeFile(f, 'export const x = 1;\n');
    // No commits yet — `git diff HEAD` exits non-zero.
    const result = await computeTaskDiff(tempDir, [f]);
    expect(result.diff).toBe('');
    expect(result.stats).toBeUndefined();
    expect(result.skippedPaths).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.rejection).toBeUndefined();
  });

  it('no working-tree changes returns empty diff (kept paths but nothing to diff)', async () => {
    gitInit(tempDir);
    const f = join(tempDir, 'a.ts');
    await fs.writeFile(f, 'export const x = 1;\n');
    gitCommitAll(tempDir, 'init');
    const result = await computeTaskDiff(tempDir, [f]);
    expect(result.diff).toBe('');
    expect(result.stats).toEqual({ filesChanged: 0, linesAdded: 0, linesRemoved: 0 });
    expect(result.skippedPaths).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('all paths denylisted short-circuits before invoking git', async () => {
    gitInit(tempDir);
    const lock = join(tempDir, 'package-lock.json');
    await fs.writeFile(lock, '{}\n');
    gitCommitAll(tempDir, 'init');
    await fs.writeFile(lock, '{"x":1}\n');
    mockedExecFile.mockReset(); // ensure git is not invoked
    const result = await computeTaskDiff(tempDir, [lock]);
    expect(result.diff).toBe('');
    expect(result.stats).toBeUndefined();
    expect(result.skippedPaths).toContain(lock);
    expect(result.truncated).toBe(false);
    expect(mockedExecFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Basic hunks
// ---------------------------------------------------------------------------

describe('computeTaskDiff — basic hunks', () => {
  it('returns unified-diff body and numstat-derived stats', async () => {
    gitInit(tempDir);
    const f = join(tempDir, 'a.ts');
    await fs.writeFile(f, 'export const x = 1;\n');
    gitCommitAll(tempDir, 'init');
    await fs.writeFile(f, 'export const x = 2;\nexport const y = 3;\n');
    const result = await computeTaskDiff(tempDir, [f]);
    expect(result.diff).toContain('diff --git');
    expect(result.diff).toContain('a.ts');
    expect(result.diff).toMatch(/^diff --git/m);
    expect(result.stats).toBeDefined();
    expect(result.stats!.filesChanged).toBe(1);
    expect(result.stats!.linesAdded).toBe(2);
    expect(result.stats!.linesRemoved).toBe(1);
    expect(result.skippedPaths).toEqual([]);
    expect(result.truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Denylist filtering
// ---------------------------------------------------------------------------

describe('computeTaskDiff — denylist filtering', () => {
  it('partitions denylisted paths into skippedPaths and excludes them from diff', async () => {
    gitInit(tempDir);
    const ok = join(tempDir, 'app.ts');
    const lock = join(tempDir, 'package-lock.json');
    await fs.writeFile(ok, 'export const x = 1;\n');
    await fs.writeFile(lock, '{}\n');
    gitCommitAll(tempDir, 'init');
    await fs.writeFile(ok, 'export const x = 2;\n');
    await fs.writeFile(lock, '{"x":1}\n');
    const result = await computeTaskDiff(tempDir, [ok, lock]);
    expect(result.skippedPaths).toContain(lock);
    expect(result.skippedPaths).not.toContain(ok);
    expect(result.diff).toContain('app.ts');
    expect(result.diff).not.toContain('package-lock.json');
  });
});

// ---------------------------------------------------------------------------
// Binary-section stripping
// ---------------------------------------------------------------------------

describe('computeTaskDiff — binary stripping', () => {
  it('strips "Binary files ... differ" sections from the diff body, including the section header', async () => {
    gitInit(tempDir);
    const text = join(tempDir, 'text.ts');
    const bin = join(tempDir, 'image.bin');
    await fs.writeFile(text, 'export const x = 1;\n');
    await fs.writeFile(bin, Buffer.from([0, 1, 2, 0, 255, 0, 0, 9]));
    gitCommitAll(tempDir, 'init');
    await fs.writeFile(text, 'export const x = 2;\n');
    await fs.writeFile(bin, Buffer.from([0, 1, 2, 0, 255, 0, 0, 9, 7, 7]));
    const result = await computeTaskDiff(tempDir, [text, bin]);
    expect(result.diff).not.toMatch(/Binary files .* differ/);
    // Section is dropped wholesale — both the body marker AND the diff-header
    // for the binary file should be absent. Only the text-file section remains.
    expect(result.diff).not.toContain('image.bin');
    expect(result.diff).toContain('text.ts');
  });
});

// ---------------------------------------------------------------------------
// Truncation messages (verbatim)
// ---------------------------------------------------------------------------

describe('computeTaskDiff — truncation', () => {
  it('emits per-file truncation message verbatim when added+removed > 500', async () => {
    gitInit(tempDir);
    const big = join(tempDir, 'big.ts');
    await fs.writeFile(big, 'init\n');
    gitCommitAll(tempDir, 'init');
    const lines = Array.from({ length: 600 }, (_, i) => `line ${i}`).join('\n') + '\n';
    await fs.writeFile(big, lines);
    const result = await computeTaskDiff(tempDir, [big]);
    // The truncation message uses the git-reported pathspec (relative to the
    // repo root), not the absolute path passed in `allFiles`.
    expect(result.diff).toContain('<diff truncated: big.ts per-file cap exceeded>');
    expect(result.truncated).toBe(true);
    // The original 600 hunk lines must be REPLACED, not appended-to: a leak
    // would silently pass the marker assertion above.
    expect(result.diff).not.toContain('+line 0');
    expect(result.diff).not.toContain('+line 599');
    expect(result.diff).not.toMatch(/^@@ /m);
  });

  it('emits total-budget truncation message verbatim when overall diff exceeds 50,000 bytes', async () => {
    gitInit(tempDir);
    // Three files, each well under the per-file cap (≤ 500 added+removed),
    // but together easily blowing past the 50_000-byte total budget.
    const files: string[] = [];
    for (let i = 0; i < 3; i++) {
      const p = join(tempDir, `file-${i}.ts`);
      await fs.writeFile(p, 'init\n');
      files.push(p);
    }
    gitCommitAll(tempDir, 'init');
    // 400 lines × ~120 bytes ≈ 48k per file → total > 50k after the first.
    const fat = (tag: string) =>
      Array.from({ length: 400 }, (_, k) =>
        `line ${tag}-${k} ${'x'.repeat(100)}`,
      ).join('\n') + '\n';
    for (let i = 0; i < files.length; i++) {
      await fs.writeFile(files[i], fat(String(i)));
    }
    const result = await computeTaskDiff(tempDir, files);
    expect(result.truncated).toBe(true);
    expect(result.diff).toMatch(
      /<diff truncated: .* total budget exhausted, file truncated despite size>/,
    );
    // Pin pathspec ordering: file-0 fits the budget; later files get the
    // budget-exhausted message verbatim (filename token = git pathspec).
    expect(result.diff).not.toContain(
      '<diff truncated: file-0.ts total budget exhausted, file truncated despite size>',
    );
    expect(result.diff).toContain(
      '<diff truncated: file-2.ts total budget exhausted, file truncated despite size>',
    );
  });
});

// ---------------------------------------------------------------------------
// Failure modes — never throw, always return safe state
// ---------------------------------------------------------------------------

describe('computeTaskDiff — failure modes', () => {
  it('git missing (ENOENT) → safe empty state', async () => {
    mockedExecFile.mockReset();
    mockedExecFile.mockImplementation(((
      _file: string,
      _args: readonly string[],
      _opts: unknown,
      cb: (err: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
    ) => {
      const err = Object.assign(new Error('not found'), {
        code: 'ENOENT',
      }) as NodeJS.ErrnoException;
      setImmediate(() => cb(err, '', ''));
      return { kill: vi.fn() } as unknown as childProcess.ChildProcess;
    }) as unknown as typeof childProcess.execFile);
    const f = join(tempDir, 'x.ts');
    await fs.writeFile(f, 'x');
    const result = await computeTaskDiff(tempDir, [f]);
    expect(result.diff).toBe('');
    expect(result.stats).toBeUndefined();
    expect(result.skippedPaths).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.rejection).toBeUndefined();
  });

  it('not a git repository → non-zero exit → safe empty state', async () => {
    // tempDir was never `git init`-ed.
    const f = join(tempDir, 'a.ts');
    await fs.writeFile(f, 'x');
    const result = await computeTaskDiff(tempDir, [f]);
    expect(result.diff).toBe('');
    expect(result.stats).toBeUndefined();
    expect(result.truncated).toBe(false);
    expect(result.rejection).toBeUndefined();
  });

  it('ERR_CHILD_PROCESS_STDIO_MAXBUFFER from real git via synthetic maxBuffer:1024 → safe empty state', async () => {
    gitInit(tempDir);
    const f = join(tempDir, 'a.ts');
    await fs.writeFile(f, 'init\n');
    gitCommitAll(tempDir, 'init');
    // Make a diff body comfortably larger than 1024 bytes.
    const big =
      Array.from({ length: 200 }, (_, i) => `line ${i} ${'x'.repeat(40)}`).join('\n') + '\n';
    await fs.writeFile(f, big);

    // Replace passthrough with one that overrides maxBuffer to 1024 — real
    // git runs, but the captured stdout overflows and node rejects with
    // ERR_CHILD_PROCESS_STDIO_MAXBUFFER. This exercises the genuine failure
    // mode without needing 16MB+ of synthetic content.
    const observedErrorCodes: (string | undefined)[] = [];
    mockedExecFile.mockReset();
    mockedExecFile.mockImplementation(((
      file: string,
      args: readonly string[],
      opts: { env?: NodeJS.ProcessEnv; cwd?: string; maxBuffer?: number },
      cb: (err: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
    ) => {
      const overridden = { ...opts, maxBuffer: 1024 };
      const wrappedCb = (
        err: NodeJS.ErrnoException | null,
        stdout: string,
        stderr: string,
      ) => {
        observedErrorCodes.push(err?.code);
        cb(err, stdout, stderr);
      };
      return (actualExecFile as unknown as (
        f: string,
        a: readonly string[],
        o: unknown,
        c: unknown,
      ) => childProcess.ChildProcess)(file, args, overridden, wrappedCb);
    }) as unknown as typeof childProcess.execFile);

    const result = await computeTaskDiff(tempDir, [f]);
    expect(result.diff).toBe('');
    expect(result.stats).toBeUndefined();
    expect(result.truncated).toBe(false);
    expect(result.rejection).toBeUndefined();
    // Pin the test's claim: at least one of the two git invocations actually
    // hit ERR_CHILD_PROCESS_STDIO_MAXBUFFER (not some other failure).
    expect(observedErrorCodes).toContain('ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
  });
});

// ---------------------------------------------------------------------------
// Env propagation — symmetric to the FORCE_COLOR=0 assertion in typecheck.test.ts
// ---------------------------------------------------------------------------

describe('computeTaskDiff — env propagation', () => {
  it("passes GIT_OPTIONAL_LOCKS='0' to execFile env on both git invocations", async () => {
    gitInit(tempDir);
    const f = join(tempDir, 'a.ts');
    await fs.writeFile(f, 'x\n');
    gitCommitAll(tempDir, 'init');
    await fs.writeFile(f, 'y\n');

    const capturedEnvs: NodeJS.ProcessEnv[] = [];
    mockedExecFile.mockReset();
    mockedExecFile.mockImplementation(((
      file: string,
      args: readonly string[],
      opts: { env?: NodeJS.ProcessEnv },
      cb: unknown,
    ) => {
      capturedEnvs.push(opts.env ?? {});
      return (actualExecFile as unknown as (
        f: string,
        a: readonly string[],
        o: unknown,
        c: unknown,
      ) => childProcess.ChildProcess)(file, args, opts, cb);
    }) as unknown as typeof childProcess.execFile);

    await computeTaskDiff(tempDir, [f]);
    expect(capturedEnvs.length).toBe(2);
    for (const env of capturedEnvs) {
      expect(env.GIT_OPTIONAL_LOCKS).toBe('0');
    }
  });
});
