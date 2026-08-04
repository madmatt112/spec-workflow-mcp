import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

import * as childProcess from 'node:child_process';
import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { runProjectTypecheck } from '../typecheck.js';

// The repo's own TypeScript install, used by the real-tsc integration below.
const REAL_TSC_BIN = join(
  dirname(dirname(createRequire(import.meta.url).resolve('typescript'))),
  'bin',
  'tsc',
);

const mockedExecFile = vi.mocked(childProcess.execFile);

let tempDir: string;
let warnSpy: ReturnType<typeof vi.spyOn>;

async function makeTempProject(): Promise<string> {
  return await fs.mkdtemp(join(tmpdir(), 'typecheck-test-'));
}

async function writeTsconfig(dir: string, body: string): Promise<void> {
  await fs.writeFile(join(dir, 'tsconfig.json'), body, 'utf-8');
}

async function installFakeTsc(dir: string): Promise<string> {
  const binDir = join(dir, 'node_modules', '.bin');
  await fs.mkdir(binDir, { recursive: true });
  const tscPath = join(binDir, process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  await fs.writeFile(tscPath, '', { mode: 0o755 });
  return tscPath;
}

type ExecBehavior = {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  errorCode?: string;
  hang?: boolean;
};

function setNextExecBehavior(b: ExecBehavior): void {
  mockedExecFile.mockImplementationOnce(((
    _file: string,
    _args: readonly string[],
    _opts: unknown,
    cb: (err: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
  ) => {
    let invoked = false;
    const invoke = (
      err: NodeJS.ErrnoException | null,
      stdout: string,
      stderr: string,
    ) => {
      if (invoked) return;
      invoked = true;
      cb(err, stdout, stderr);
    };
    if (!b.hang) {
      // Defer so the caller's setTimeout (the timeout watcher) is set up first
      // and can be cleared inside the callback path.
      setImmediate(() => {
        if (b.errorCode) {
          const err: NodeJS.ErrnoException = Object.assign(new Error('mock'), {
            code: b.errorCode,
          });
          invoke(err, b.stdout ?? '', b.stderr ?? '');
          return;
        }
        if (b.exitCode != null && b.exitCode !== 0) {
          // Non-zero exit: execFile callback receives an error whose `.code`
          // is the numeric exit status.
          const err = Object.assign(new Error('mock-nonzero'), {
            code: b.exitCode,
          }) as unknown as NodeJS.ErrnoException;
          invoke(err, b.stdout ?? '', b.stderr ?? '');
          return;
        }
        invoke(null, b.stdout ?? '', b.stderr ?? '');
      });
    }
    // Simulate the real-process behavior: a kill signal causes the child to
    // exit and execFile's callback to fire with an error. Without this, hang
    // tests would deadlock because the callback never runs.
    const proc = {
      kill: vi.fn((signal?: NodeJS.Signals) => {
        const err = Object.assign(new Error(`killed ${signal ?? ''}`), {
          signal,
        }) as NodeJS.ErrnoException;
        setImmediate(() => invoke(err, '', ''));
        return true;
      }),
    };
    return proc as unknown as childProcess.ChildProcess;
  }) as unknown as typeof childProcess.execFile);
}

beforeEach(async () => {
  tempDir = await makeTempProject();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  mockedExecFile.mockReset();
});

afterEach(async () => {
  warnSpy.mockRestore();
  vi.useRealTimers();
  await fs.rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Task 5.1 — spawn contract, failure-mode taxonomy, env propagation
// ---------------------------------------------------------------------------

describe('runProjectTypecheck (5.1) — failure-mode taxonomy', () => {
  it('feature-disabled short-circuits before any I/O', async () => {
    // No tsconfig, no tsc — but enabled=false should return immediately.
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: false });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('feature-disabled');
    expect(mockedExecFile).not.toHaveBeenCalled();
  });

  it('no-tsconfig when tsconfig.json is absent', async () => {
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('no-tsconfig');
  });

  it('project-references when references array is non-empty', async () => {
    await writeTsconfig(tempDir, JSON.stringify({ references: [{ path: './pkg' }] }));
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('project-references');
  });

  it('wrapper-config when files=[] and no include', async () => {
    await writeTsconfig(tempDir, JSON.stringify({ files: [] }));
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('wrapper-config');
  });

  it('tsc-not-found when binary is missing', async () => {
    await writeTsconfig(tempDir, '{}');
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('tsc-not-found');
  });

  it('output-overflow surfaces ERR_CHILD_PROCESS_STDIO_MAXBUFFER', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ errorCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' });
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('output-overflow');
  });

  it('no-parseable-output on clean exit with empty --listFiles', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ stdout: '', exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('no-parseable-output');
  });

  it('no-parseable-output on non-zero exit with zero diagnostics', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ stdout: '/some/path/foo.ts\n', exitCode: 1 });
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('no-parseable-output');
  });

  it('timeout fires when spawn never returns (intercepted setTimeout)', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    // Capture the 30s timeout handler so we can fire it without waiting wall-time.
    let timeoutFired: (() => void) | null = null;
    const realSetTimeout = global.setTimeout;
    const stSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: (...args: unknown[]) => void, ms: number, ...args: unknown[]) => {
        if (ms === 30_000 && !timeoutFired) {
          timeoutFired = () => fn();
          return { unref: () => undefined, ref: () => undefined } as unknown as ReturnType<typeof setTimeout>;
        }
        return realSetTimeout(fn, ms, ...args);
      }) as unknown as typeof setTimeout);
    setNextExecBehavior({ hang: true });
    const promise = runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    // Wait until spawn happened and the 30s timer was registered.
    while (!timeoutFired) await new Promise((r) => realSetTimeout(r, 5));
    (timeoutFired as () => void)();
    const result = await promise;
    expect(result[0].status).toBe('timeout');
    stSpy.mockRestore();
  });

  it('first-run creates the cache directory before spawn', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    let cacheDirAtSpawn: boolean | null = null;
    mockedExecFile.mockImplementationOnce(((
      _file: string,
      _args: readonly string[],
      _opts: unknown,
      cb: (err: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
    ) => {
      // Record whether the cache dir exists at the moment spawn was called.
      try {
        const st = require('node:fs').statSync(join(tempDir, '.spec-workflow', '.cache'));
        cacheDirAtSpawn = st.isDirectory();
      } catch {
        cacheDirAtSpawn = false;
      }
      setImmediate(() => cb(null, '/a/b.ts\n', ''));
      return { kill: vi.fn() } as unknown as childProcess.ChildProcess;
    }) as unknown as typeof childProcess.execFile);
    await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(cacheDirAtSpawn).toBe(true);
  });

  it('passes FORCE_COLOR=0 and NO_COLOR=1 to execFile env', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
    await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(mockedExecFile).toHaveBeenCalledTimes(1);
    const opts = mockedExecFile.mock.calls[0][2] as { env: NodeJS.ProcessEnv };
    expect(opts.env.FORCE_COLOR).toBe('0');
    expect(opts.env.NO_COLOR).toBe('1');
  });

  it('appends .spec-workflow/.cache/ to .gitignore when missing', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    await fs.writeFile(join(tempDir, '.gitignore'), 'node_modules\n');
    setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
    await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    const gi = await fs.readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(gi).toContain('.spec-workflow/.cache/');
  });

  it('does not duplicate .gitignore entry when already covered', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    await fs.writeFile(
      join(tempDir, '.gitignore'),
      'node_modules\n.spec-workflow/.cache/\n',
    );
    setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
    await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    const gi = await fs.readFile(join(tempDir, '.gitignore'), 'utf-8');
    const occurrences = gi.split('.spec-workflow/.cache/').length - 1;
    expect(occurrences).toBe(1);
  });

  it('surfaces typecheckWarning on tsbuildinfo-rebuild stderr signature', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({
      stdout: '/a.ts\n',
      exitCode: 0,
      stderr: 'error TS5083: Cannot read file ./tsc.tsbuildinfo',
    });
    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('success');
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].typecheckWarning).toMatch(/tsbuildinfo rebuild/);
  });
});

// ---------------------------------------------------------------------------
// Task 5.2 — two-pass parser
// ---------------------------------------------------------------------------

describe('runProjectTypecheck (5.2) — two-pass parser', () => {
  beforeEach(async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
  });

  async function runWithStdout(stdout: string, allFiles: string[] = []) {
    setNextExecBehavior({ stdout, exitCode: 0 });
    return runProjectTypecheck(tempDir, tempDir, allFiles, { enabled: true });
  }

  it('parses a single diagnostic header and the listFiles section', async () => {
    const stdout = [
      'src/foo.ts(3,5): error TS2322: Type \'string\' is not assignable to type \'number\'.',
      '/abs/src/foo.ts',
      '/abs/src/bar.ts',
      '',
    ].join('\n');
    const result = await runWithStdout(stdout);
    expect(result[0].status).toBe('success');
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(1);
    expect(result[0].diagnostics[0].code).toBe('TS2322');
    // tsc printed `src/foo.ts` relative to its spawn cwd; the reported `file`
    // is the workspace-anchored absolute path (requirement 2.3).
    expect(result[0].diagnostics[0].file).toBe(join(tempDir, 'src', 'foo.ts'));
    expect(result[0].diagnostics[0].line).toBe(3);
    expect(result[0].diagnostics[0].column).toBe(5);
  });

  it('appends multi-line continuation for TS2345 type-expansion (4+ lines)', async () => {
    const stdout = [
      'src/foo.ts(10,3): error TS2345: Argument of type \'A\' is not assignable to parameter of type \'B\'.',
      '  Type \'A\' is missing the following properties from type \'B\':',
      '    foo, bar, baz',
      '    quux, zorp',
      '/abs/src/foo.ts',
      '',
    ].join('\n');
    const result = await runWithStdout(stdout);
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(1);
    const msg = result[0].diagnostics[0].message;
    expect(msg).toContain('Argument of type');
    expect(msg).toContain('is missing the following properties');
    expect(msg).toContain('foo, bar, baz');
    expect(msg).toContain('quux, zorp');
    // Continuation joined with \n (head + 3 continuation lines = 4 segments).
    expect(msg.split('\n').length).toBeGreaterThanOrEqual(4);
  });

  it('TS2418/TS2417 sibling diagnostics are NOT absorbed as continuation', async () => {
    const stdout = [
      'src/a.ts(1,1): error TS2418: Type of computed property\'s value is \'X\'.',
      'src/a.ts(2,1): error TS2417: Class static side incorrectly extends base class.',
      '/abs/src/a.ts',
      '',
    ].join('\n');
    const result = await runWithStdout(stdout);
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(2);
    expect(result[0].diagnostics[0].code).toBe('TS2418');
    expect(result[0].diagnostics[1].code).toBe('TS2417');
  });

  it('caps per-diagnostic message at ~4KB with \\n<...truncated> suffix', async () => {
    const longTail = '  ' + 'x'.repeat(8000);
    const stdout = [
      'src/foo.ts(1,1): error TS2345: head.',
      longTail,
      '/abs/src/foo.ts',
      '',
    ].join('\n');
    const result = await runWithStdout(stdout);
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(1);
    const msg = result[0].diagnostics[0].message;
    expect(msg.endsWith('\n<...truncated>')).toBe(true);
    // Body byte length capped to 4096 + suffix.
    const suffixLen = '\n<...truncated>'.length;
    expect(Buffer.byteLength(msg, 'utf-8')).toBeLessThanOrEqual(4096 + suffixLen);
  });

  it('absolute path inside diagnostic message head does NOT pollute compiled set', async () => {
    // The diagnostic's HEAD line contains an absolute path text. If the parser
    // ever lifted message-embedded absolute paths into listFiles, the leaked
    // path would appear in `compiled` (since it's in allFiles too). We pass
    // the leaked path in allFiles to make the negation load-bearing — it must
    // end up in `excluded`, never `compiled`.
    const real = join(tempDir, 'foo.ts');
    await fs.writeFile(real, '');
    const leakedPath = '/abs/leaked/path.ts';
    const stdout = [
      `${real}(1,1): error TS2307: Cannot find module '${leakedPath}'.`,
      real,
      '',
    ].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(
      tempDir,
      tempDir,
      [real, leakedPath],
      { enabled: true },
    );
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics[0].message).toContain(leakedPath);
    expect(result[0].coverage.compiled).not.toContain(leakedPath);
    expect(result[0].coverage.excluded).toContain(leakedPath);
  });

  it('continuation does not absorb absolute-path-shaped lines (listFiles)', async () => {
    // An indented absolute-path line should still be classified as listFiles,
    // not continuation. We verify by giving an indented `/abs/src/x.ts` line
    // immediately after a diagnostic header.
    const stdout = [
      'src/foo.ts(1,1): error TS2345: head.',
      '  more head detail',
      '/abs/src/x.ts',
      '',
    ].join('\n');
    const result = await runWithStdout(stdout);
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics[0].message).toContain('more head detail');
    expect(result[0].diagnostics[0].message).not.toContain('/abs/src/x.ts');
  });
});

// ---------------------------------------------------------------------------
// Task 5.3 — realpath normalization, denylist filter, 100-cap, in-scope tagging
// ---------------------------------------------------------------------------

describe('runProjectTypecheck (5.3) — post-parse normalization', () => {
  beforeEach(async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
  });

  it('reports compiled vs excluded against allFiles using original paths', async () => {
    const a = join(tempDir, 'a.ts');
    const b = join(tempDir, 'b.ts');
    await fs.writeFile(a, '');
    await fs.writeFile(b, '');
    // tsc compiled only `a.ts`; b.ts was passed in allFiles but not compiled.
    const stdout = [a, ''].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [a, b], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].coverage.compiled).toContain(a);
    expect(result[0].coverage.excluded).toContain(b);
  });

  it('per-path ENOENT degrades to excluded (allFiles entry doesn\'t exist)', async () => {
    const present = join(tempDir, 'present.ts');
    const ghost = join(tempDir, 'ghost.ts');
    await fs.writeFile(present, '');
    const stdout = [present, ''].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(
      tempDir,
      tempDir,
      [present, ghost],
      { enabled: true },
    );
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].coverage.compiled).toContain(present);
    expect(result[0].coverage.excluded).toContain(ghost);
  });

  it('non-ENOENT realpath failures bucket as excluded and warn once', async () => {
    if (process.platform === 'win32') return;
    const ok = join(tempDir, 'ok.ts');
    await fs.writeFile(ok, '');
    // Symlink loop reliably triggers ELOOP on POSIX (a non-ENOENT failure).
    const loop = join(tempDir, 'loop.ts');
    await fs.symlink(loop, loop);
    setNextExecBehavior({ stdout: [ok, ''].join('\n'), exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [ok, loop], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].coverage.excluded).toContain(loop);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('typecheck realpath: ELOOP'),
    );
  });

  it('non-ENOENT realpath failure on a diagnostic file leaves inScope=false', async () => {
    if (process.platform === 'win32') return;
    const real = join(tempDir, 'real.ts');
    await fs.writeFile(real, '');
    const loop = join(tempDir, 'loop.ts');
    await fs.symlink(loop, loop);
    const stdout = [
      `${loop}(1,1): error TS2322: bad assign on unresolvable file.`,
      real,
      '',
    ].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [real], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(1);
    expect(result[0].diagnostics[0].inScope).toBe(false);
  });

  it('pnpm-style symlinked path normalizes via realpath', async () => {
    if (process.platform === 'win32') return; // symlink perms differ on win32
    const real = join(tempDir, 'real.ts');
    await fs.writeFile(real, '');
    const link = join(tempDir, 'link.ts');
    await fs.symlink(real, link);
    // tsc emits the *symlink* path; allFiles uses the real path. Both must
    // normalize to the same realpath and intersect.
    const stdout = [link, ''].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [real], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].coverage.compiled).toContain(real);
    expect(result[0].coverage.excluded).not.toContain(real);
  });

  it('tags diagnostics with inScope based on normalized allFiles intersection', async () => {
    const a = join(tempDir, 'a.ts');
    const out = join(tempDir, 'out.ts');
    await fs.writeFile(a, '');
    await fs.writeFile(out, '');
    // Real `tsc` prints diagnostic paths RELATIVE to its spawn cwd (the
    // workspace) while `--listFiles` prints absolute paths. Emitting absolute
    // diagnostic headers here is what let the inert-inScope defect survive 900+
    // passing tests, so the mock must reproduce the mixed shape.
    const stdout = [
      'a.ts(1,1): error TS2322: bad assign.',
      'out.ts(1,1): error TS2322: also bad.',
      a,
      out,
      '',
    ].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [a], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    // The relative form is anchored to the workspace, so `file` is absolute
    // (requirement 2.3) even though tsc printed a bare `a.ts`.
    const inScope = result[0].diagnostics.find((d) => d.file === a)!;
    const oos = result[0].diagnostics.find((d) => d.file === out)!;
    expect(inScope.inScope).toBe(true);
    expect(oos.inScope).toBe(false);
  });

  it('anchors relative diagnostic paths to the WORKSPACE, not the server cwd', async () => {
    // The workspace is a worktree; the server process cwd is the repo running
    // vitest. Anchoring against process.cwd() would produce a path that does
    // not exist, realpath would ENOENT, and every diagnostic would be tagged
    // inScope: false — the exact defect this task re-opened for.
    expect(tempDir).not.toBe(process.cwd());
    const a = join(tempDir, 'nested', 'a.ts');
    await fs.mkdir(dirname(a), { recursive: true });
    await fs.writeFile(a, '');
    const stdout = ['nested/a.ts(1,1): error TS2322: bad assign.', a, ''].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [a], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics[0].file).toBe(a);
    expect(result[0].diagnostics[0].inScope).toBe(true);
  });

  it('caps diagnostics at 100 with in-scope ordered first; truncated=true', async () => {
    const a = join(tempDir, 'a.ts');
    const out = join(tempDir, 'out.ts');
    await fs.writeFile(a, '');
    await fs.writeFile(out, '');
    const lines: string[] = [];
    // 60 in-scope, 60 out-of-scope — emitted in the workspace-relative form
    // real tsc uses, so the in-scope-first ordering is genuinely exercised.
    for (let i = 0; i < 60; i++) {
      lines.push(`a.ts(${i + 1},1): error TS2322: in-scope ${i}.`);
    }
    for (let i = 0; i < 60; i++) {
      lines.push(`out.ts(${i + 1},1): error TS2322: out-of-scope ${i}.`);
    }
    lines.push(a, out, '');
    setNextExecBehavior({ stdout: lines.join('\n'), exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [a], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(100);
    expect(result[0].truncated).toBe(true);
    // First 60 must all be in-scope (file === a).
    const firstSixty = result[0].diagnostics.slice(0, 60);
    expect(firstSixty.every((d) => d.file === a)).toBe(true);
    // Remaining 40 are out-of-scope.
    const tail = result[0].diagnostics.slice(60);
    expect(tail.every((d) => d.file === out)).toBe(true);
  });

  it('output-side denylist filters compiled/excluded/diagnostic files and surfaces suppressedDenylistedFiles', async () => {
    const ok = join(tempDir, 'app.ts');
    const lock = join(tempDir, 'package-lock.json');
    await fs.writeFile(ok, '');
    await fs.writeFile(lock, '{}');
    const stdout = [
      'package-lock.json(1,1): error TS2322: ignored.',
      ok,
      lock,
      '',
    ].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, tempDir, [ok, lock], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].coverage.compiled).toContain(ok);
    expect(result[0].coverage.compiled).not.toContain(lock);
    expect(result[0].coverage.excluded).not.toContain(lock);
    expect(result[0].diagnostics.some((d) => d.file === lock)).toBe(false);
    expect(result[0].suppressedDenylistedFiles).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Task 11 — the workspace is compiled; the workflow root holds the cache
// ---------------------------------------------------------------------------

describe('runProjectTypecheck — two roots', () => {
  let rootsDir: string;
  let workflowRoot: string;
  let workspacePath: string;

  beforeEach(async () => {
    rootsDir = await fs.mkdtemp(join(tmpdir(), 'typecheck-two-root-'));
    // The nested worktree layout: the workspace sits under the shared root.
    workflowRoot = join(rootsDir, 'repo');
    workspacePath = join(workflowRoot, 'worktrees', 'feature-a');
    await fs.mkdir(workspacePath, { recursive: true });
    // BOTH roots carry a tsconfig, so a run rooted at the wrong one still
    // proceeds and silently compiles the wrong tree rather than failing loudly.
    await writeTsconfig(workflowRoot, '{}');
    await writeTsconfig(workspacePath, '{}');
  });

  afterEach(async () => {
    await fs.rm(rootsDir, { recursive: true, force: true });
  });

  it('points -p and the spawn working directory at the workspace (R4 AC 2)', async () => {
    await installFakeTsc(workspacePath);
    setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
    const result = await runProjectTypecheck(
      workspacePath,
      workflowRoot,
      [],
      { enabled: true },
    );
    expect(result[0].tsconfigPath).toBe(join(workspacePath, 'tsconfig.json'));
    const call = mockedExecFile.mock.calls[0] as unknown as [
      string,
      string[],
      { cwd: string },
    ];
    const args = call[1];
    expect(args[args.indexOf('-p') + 1]).toBe(workspacePath);
    expect(call[2].cwd).toBe(workspacePath);
  });

  it.skipIf(process.platform === 'win32')(
    'compiles the tree named by -p — asserted on the compiled file list',
    async () => {
      const workspaceFile = join(workspacePath, 'in-worktree.ts');
      const workflowFile = join(workflowRoot, 'in-main.ts');
      await fs.writeFile(workspaceFile, 'export const a = 1;\n');
      await fs.writeFile(workflowFile, 'export const b = 2;\n');

      // A fake tsc that behaves like a compiler: it lists the `.ts` files of
      // the directory it was pointed at, and records its working directory.
      // Reporting the workspace `tsconfigPath` while compiling the main
      // checkout is the exact defect this asserts against — so the assertion is
      // on `coverage.compiled`, not on the reported path.
      const cwdProbe = join(rootsDir, 'cwd.txt');
      const binDir = join(workspacePath, 'node_modules', '.bin');
      await fs.mkdir(binDir, { recursive: true });
      const script = [
        '#!/bin/sh',
        `pwd > "${cwdProbe}"`,
        'root=""',
        'while [ $# -gt 0 ]; do',
        '  if [ "$1" = "-p" ]; then root="$2"; fi',
        '  shift',
        'done',
        'for f in "$root"/*.ts; do echo "$f"; done',
        'exit 0',
      ].join('\n');
      await fs.writeFile(join(binDir, 'tsc'), script, { mode: 0o755 });

      const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
      mockedExecFile.mockImplementationOnce(
        actual.execFile as unknown as typeof childProcess.execFile,
      );

      const result = await runProjectTypecheck(
        workspacePath,
        workflowRoot,
        [workspaceFile, workflowFile],
        { enabled: true },
      );
      if (result[0].status !== 'success') throw new Error('narrowing');
      expect(result[0].coverage.compiled).toEqual([workspaceFile]);
      expect(result[0].coverage.excluded).toEqual([workflowFile]);

      const observedCwd = (await fs.readFile(cwdProbe, 'utf-8')).trim();
      expect(await fs.realpath(observedCwd)).toBe(await fs.realpath(workspacePath));
    },
  );

  it('resolves the compiler from the workspace, not the workflow root', async () => {
    // A fresh worktree without `node_modules` reports tsc-not-found rather than
    // borrowing the main checkout's compiler (design Migration note).
    await installFakeTsc(workflowRoot);
    const result = await runProjectTypecheck(
      workspacePath,
      workflowRoot,
      [],
      { enabled: true },
    );
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('tsc-not-found');
    expect(result[0].tsconfigPath).toBe(join(workspacePath, 'tsconfig.json'));
    expect(mockedExecFile).not.toHaveBeenCalled();
  });

  it('writes the cache directory and the .gitignore entry to the workflow root only (R4 AC 3)', async () => {
    await installFakeTsc(workspacePath);
    await fs.writeFile(join(workflowRoot, '.gitignore'), 'node_modules\n');
    await fs.writeFile(join(workspacePath, '.gitignore'), 'node_modules\n');
    setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
    await runProjectTypecheck(workspacePath, workflowRoot, [], { enabled: true });

    const cacheDir = join(workflowRoot, '.spec-workflow', '.cache');
    expect((await fs.stat(cacheDir)).isDirectory()).toBe(true);
    // The worktree stays clean: no `.spec-workflow` inside it, and its tracked
    // `.gitignore` is byte-identical to what it was before the run.
    await expect(fs.stat(join(workspacePath, '.spec-workflow'))).rejects.toThrow();
    expect(await fs.readFile(join(workspacePath, '.gitignore'), 'utf-8')).toBe(
      'node_modules\n',
    );
    expect(await fs.readFile(join(workflowRoot, '.gitignore'), 'utf-8')).toContain(
      '.spec-workflow/.cache/',
    );
  });

  it('keys the tsbuildinfo per workspace so two worktrees do not share one (R4 AC 4)', async () => {
    const other = join(workflowRoot, 'worktrees', 'feature-b');
    await fs.mkdir(other, { recursive: true });
    await writeTsconfig(other, '{}');
    await installFakeTsc(workspacePath);
    await installFakeTsc(other);

    async function tsbuildinfoOf(ws: string): Promise<string> {
      mockedExecFile.mockReset();
      setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
      await runProjectTypecheck(ws, workflowRoot, [], { enabled: true });
      const args = mockedExecFile.mock.calls[0][1] as unknown as string[];
      return args[args.indexOf('--tsBuildInfoFile') + 1];
    }

    const a = await tsbuildinfoOf(workspacePath);
    const b = await tsbuildinfoOf(other);
    const aAgain = await tsbuildinfoOf(workspacePath);

    const cacheDir = join(workflowRoot, '.spec-workflow', '.cache');
    expect(dirname(a)).toBe(cacheDir);
    expect(dirname(b)).toBe(cacheDir);
    expect(a).not.toBe(b);
    // Stable per workspace — a key that moved between runs would rebuild every
    // time, which is the same defect as sharing one file.
    expect(aAgain).toBe(a);
  });

  it('reports the workspace tsconfigPath on the success and unavailable arms alike', async () => {
    const expected = join(workspacePath, 'tsconfig.json');

    const disabled = await runProjectTypecheck(
      workspacePath,
      workflowRoot,
      [],
      { enabled: false },
    );
    expect(disabled[0].status).toBe('unavailable');
    expect(disabled[0].tsconfigPath).toBe(expected);

    await installFakeTsc(workspacePath);
    setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
    const success = await runProjectTypecheck(
      workspacePath,
      workflowRoot,
      [],
      { enabled: true },
    );
    expect(success[0].status).toBe('success');
    expect(success[0].tsconfigPath).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Integration — exercises the real execFile spawn path end-to-end
// ---------------------------------------------------------------------------

describe('runProjectTypecheck — real spawn integration', () => {
  it('spawns a real process and parses its stdout (POSIX only)', async () => {
    if (process.platform === 'win32') return;
    await writeTsconfig(tempDir, '{}');
    const binDir = join(tempDir, 'node_modules', '.bin');
    await fs.mkdir(binDir, { recursive: true });
    const tscPath = join(binDir, 'tsc');
    // Fake tsc: emit a fixture stdout and exit 0.
    const script = [
      '#!/bin/sh',
      'cat <<EOF',
      'src/foo.ts(1,1): error TS2322: bad assign.',
      '/abs/src/foo.ts',
      'EOF',
      'exit 0',
    ].join('\n');
    await fs.writeFile(tscPath, script, { mode: 0o755 });

    // For this one test, delegate the mocked execFile to the real one.
    const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    mockedExecFile.mockImplementationOnce(actual.execFile as unknown as typeof childProcess.execFile);

    const result = await runProjectTypecheck(tempDir, tempDir, [], { enabled: true });
    expect(result[0].status).toBe('success');
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(1);
    expect(result[0].diagnostics[0].code).toBe('TS2322');
  });
});

// ---------------------------------------------------------------------------
// Task 5.3 (re-opened) — in-scope tagging proven against the REAL compiler.
//
// Every other test in this file feeds `execFile` a hand-written stdout. That is
// how the inert-`inScope` defect survived: the fixtures used absolute
// diagnostic headers, which real `tsc` does not emit. This block spawns the
// repo's actual TypeScript compiler against a throwaway project, from a server
// cwd that is deliberately NOT the workspace, and asserts the tagging on
// whatever the compiler really prints.
// ---------------------------------------------------------------------------

describe('runProjectTypecheck — REAL tsc in-scope tagging', () => {
  let rootsDir: string;
  let workflowRoot: string;
  let workspacePath: string;
  let badFile: string;
  const BAD_BASENAME = 'deliberate-type-error.ts';

  beforeEach(async () => {
    rootsDir = await fs.mkdtemp(join(tmpdir(), 'typecheck-real-tsc-'));
    // Mirror the worktree layout: the compiled workspace is not the workflow
    // root, and neither is the process cwd.
    workflowRoot = join(rootsDir, 'repo');
    workspacePath = join(workflowRoot, 'worktrees', 'feature-a');
    await fs.mkdir(join(workspacePath, 'src'), { recursive: true });
    await writeTsconfig(
      workspacePath,
      JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
    );
    badFile = join(workspacePath, 'src', BAD_BASENAME);
    await fs.writeFile(badFile, 'export const x: number = "nope";\n', 'utf-8');
    // `resolveTscBinary` only looks in <workspace>/node_modules/.bin.
    const binDir = join(workspacePath, 'node_modules', '.bin');
    await fs.mkdir(binDir, { recursive: true });
    await fs.symlink(REAL_TSC_BIN, join(binDir, 'tsc'));
  });

  afterEach(async () => {
    await fs.rm(rootsDir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === 'win32')(
    'tags a genuinely in-scope diagnostic inScope:true from a foreign server cwd',
    async () => {
      // Premise guard. If these ever coincide the test proves nothing, because
      // resolving against the process cwd would accidentally work.
      expect(process.cwd()).not.toBe(workspacePath);
      // And the pre-fix behaviour could not have passed: the workspace-relative
      // path real tsc prints does not exist under the server's cwd, so realpath
      // ENOENTs and `inScope` falls to false.
      const asServerCwdWouldSee = resolve(
        process.cwd(),
        relative(workspacePath, badFile),
      );
      await expect(fs.realpath(asServerCwdWouldSee)).rejects.toThrow();

      const actual =
        await vi.importActual<typeof import('node:child_process')>('node:child_process');
      mockedExecFile.mockImplementationOnce(
        actual.execFile as unknown as typeof childProcess.execFile,
      );

      const result = await runProjectTypecheck(
        workspacePath,
        workflowRoot,
        [badFile],
        { enabled: true },
      );
      if (result[0].status !== 'success') {
        throw new Error(`expected success, got ${JSON.stringify(result[0])}`);
      }

      const diag = result[0].diagnostics.find((d) => d.code === 'TS2322');
      expect(diag).toBeDefined();
      // Requirement 2.3: `file` is an absolute path, whatever form tsc used.
      expect(isAbsolute(diag!.file)).toBe(true);
      expect(await fs.realpath(diag!.file)).toBe(await fs.realpath(badFile));
      expect(diag!.inScope).toBe(true);
      // Not a vacuous pass: the file really was in the compiled program, so
      // `allFiles ∩ listFiles` had something to intersect.
      expect(result[0].coverage.compiled).toEqual([badFile]);
      expect(result[0].coverage.excluded).toEqual([]);
    },
    60_000,
  );

  it.skipIf(process.platform === 'win32')(
    'still tags a compiled-but-unmodified file inScope:false',
    async () => {
      // A second erroring file that the task did NOT touch: it must stay out of
      // scope, so the fix is a correct intersection rather than a blanket true.
      const untouched = join(workspacePath, 'src', 'untouched.ts');
      await fs.writeFile(untouched, 'export const y: string = 42;\n', 'utf-8');

      const actual =
        await vi.importActual<typeof import('node:child_process')>('node:child_process');
      mockedExecFile.mockImplementationOnce(
        actual.execFile as unknown as typeof childProcess.execFile,
      );

      const result = await runProjectTypecheck(
        workspacePath,
        workflowRoot,
        [badFile],
        { enabled: true },
      );
      if (result[0].status !== 'success') {
        throw new Error(`expected success, got ${JSON.stringify(result[0])}`);
      }

      const mine = result[0].diagnostics.find((d) => d.file === badFile);
      const theirs = result[0].diagnostics.find((d) => d.file === untouched);
      expect(mine?.inScope).toBe(true);
      expect(theirs?.inScope).toBe(false);
      // In-scope first under the cap ordering (R2.13).
      expect(result[0].diagnostics[0].file).toBe(badFile);
    },
    60_000,
  );
});
