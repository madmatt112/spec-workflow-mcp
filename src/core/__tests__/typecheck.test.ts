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
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runProjectTypecheck } from '../typecheck.js';

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
    const result = await runProjectTypecheck(tempDir, [], { enabled: false });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('feature-disabled');
    expect(mockedExecFile).not.toHaveBeenCalled();
  });

  it('no-tsconfig when tsconfig.json is absent', async () => {
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('no-tsconfig');
  });

  it('project-references when references array is non-empty', async () => {
    await writeTsconfig(tempDir, JSON.stringify({ references: [{ path: './pkg' }] }));
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('project-references');
  });

  it('wrapper-config when files=[] and no include', async () => {
    await writeTsconfig(tempDir, JSON.stringify({ files: [] }));
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('wrapper-config');
  });

  it('tsc-not-found when binary is missing', async () => {
    await writeTsconfig(tempDir, '{}');
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('tsc-not-found');
  });

  it('output-overflow surfaces ERR_CHILD_PROCESS_STDIO_MAXBUFFER', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ errorCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' });
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('output-overflow');
  });

  it('no-parseable-output on clean exit with empty --listFiles', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ stdout: '', exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(result[0].status).toBe('unavailable');
    if (result[0].status !== 'unavailable') throw new Error('narrowing');
    expect(result[0].reason).toBe('no-parseable-output');
  });

  it('no-parseable-output on non-zero exit with zero diagnostics', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ stdout: '/some/path/foo.ts\n', exitCode: 1 });
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
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
    const promise = runProjectTypecheck(tempDir, [], { enabled: true });
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
    await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(cacheDirAtSpawn).toBe(true);
  });

  it('passes FORCE_COLOR=0 and NO_COLOR=1 to execFile env', async () => {
    await writeTsconfig(tempDir, '{}');
    await installFakeTsc(tempDir);
    setNextExecBehavior({ stdout: '/a.ts\n', exitCode: 0 });
    await runProjectTypecheck(tempDir, [], { enabled: true });
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
    await runProjectTypecheck(tempDir, [], { enabled: true });
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
    await runProjectTypecheck(tempDir, [], { enabled: true });
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
    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
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
    return runProjectTypecheck(tempDir, allFiles, { enabled: true });
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
    expect(result[0].diagnostics[0].file).toBe('src/foo.ts');
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
    const result = await runProjectTypecheck(tempDir, [a, b], { enabled: true });
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
    const result = await runProjectTypecheck(tempDir, [ok, loop], { enabled: true });
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
    const result = await runProjectTypecheck(tempDir, [real], { enabled: true });
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
    const result = await runProjectTypecheck(tempDir, [real], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].coverage.compiled).toContain(real);
    expect(result[0].coverage.excluded).not.toContain(real);
  });

  it('tags diagnostics with inScope based on normalized allFiles intersection', async () => {
    const a = join(tempDir, 'a.ts');
    const out = join(tempDir, 'out.ts');
    await fs.writeFile(a, '');
    await fs.writeFile(out, '');
    const stdout = [
      `${a}(1,1): error TS2322: bad assign.`,
      `${out}(1,1): error TS2322: also bad.`,
      a,
      out,
      '',
    ].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, [a], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    const inScope = result[0].diagnostics.find((d) => d.file === a)!;
    const oos = result[0].diagnostics.find((d) => d.file === out)!;
    expect(inScope.inScope).toBe(true);
    expect(oos.inScope).toBe(false);
  });

  it('caps diagnostics at 100 with in-scope ordered first; truncated=true', async () => {
    const a = join(tempDir, 'a.ts');
    const out = join(tempDir, 'out.ts');
    await fs.writeFile(a, '');
    await fs.writeFile(out, '');
    const lines: string[] = [];
    // 60 in-scope, 60 out-of-scope.
    for (let i = 0; i < 60; i++) {
      lines.push(`${a}(${i + 1},1): error TS2322: in-scope ${i}.`);
    }
    for (let i = 0; i < 60; i++) {
      lines.push(`${out}(${i + 1},1): error TS2322: out-of-scope ${i}.`);
    }
    lines.push(a, out, '');
    setNextExecBehavior({ stdout: lines.join('\n'), exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, [a], { enabled: true });
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
      `${lock}(1,1): error TS2322: ignored.`,
      ok,
      lock,
      '',
    ].join('\n');
    setNextExecBehavior({ stdout, exitCode: 0 });
    const result = await runProjectTypecheck(tempDir, [ok, lock], { enabled: true });
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].coverage.compiled).toContain(ok);
    expect(result[0].coverage.compiled).not.toContain(lock);
    expect(result[0].coverage.excluded).not.toContain(lock);
    expect(result[0].diagnostics.some((d) => d.file === lock)).toBe(false);
    expect(result[0].suppressedDenylistedFiles).toBeGreaterThan(0);
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

    const result = await runProjectTypecheck(tempDir, [], { enabled: true });
    expect(result[0].status).toBe('success');
    if (result[0].status !== 'success') throw new Error('narrowing');
    expect(result[0].diagnostics).toHaveLength(1);
    expect(result[0].diagnostics[0].code).toBe('TS2322');
  });
});
