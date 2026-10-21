// Contract for src/bootstrap/cli.ts (design C2, Req 1 AC 5, 6, 9). Two exports
// under test: parseInitArgs, parseDoctorArgs. Both are pure synchronous
// parsers (no I/O, no collaborator to mock); the `~` rule under test is a
// copy of src/index.ts:120-125, not an import of it (design C2 "Reuses").
//
// parseInitArgs(rest):
// 1. Both option forms (`--opt value` and `--opt=value`) parse together.
//    Pre:  none.
//    Call: parseInitArgs(['/repo', '--store', '/the/store',
//            '--test-command=npm run test', '--worktree-setup', 'npm ci',
//            '--merge-method=squash'])
//    Want: { repoPath: '/repo', store: '/the/store', testCommand: 'npm run test',
//            worktreeSetup: 'npm ci', mergeMethod: 'squash' } — no `error` key.
//    Src:  design.md C2 "as `--opt value` or `--opt=value` (D13)"; D13.
// 2. An unknown option returns one error naming it.
//    Pre:  none.
//    Call: parseInitArgs(['/repo', '--bogus'])
//    Want: { error: <string containing '--bogus'> }
//    Src:  design.md C2 grammar "an unknown option, named in the line";
//          brief "Each error case of design C2 returns { error } naming the
//          option or positional".
// 3. A value option that is last (no following token) returns one error
//    naming it.
//    Pre:  none.
//    Call: parseInitArgs(['/repo', '--store'])
//    Want: { error: <string containing '--store'> }
//    Src:  design.md C2 grammar "a value option that is last ...".
// 4. A value option with an empty `=` value returns one error naming it.
//    Pre:  none.
//    Call: parseInitArgs(['/repo', '--store='])
//    Want: { error: <string containing '--store'> }
//    Src:  design.md C2 grammar "... has an empty `=` value ...".
// 5. A value option followed by a token that starts with `--` returns one
//    error naming it (the value is treated as missing).
//    Pre:  none.
//    Call: parseInitArgs(['/repo', '--store', '--worktree-setup', 'npm ci'])
//    Want: { error: <string containing '--store'> }
//    Src:  design.md C2 grammar "... or is followed by a token that starts
//          with `--`"; D13.
// 6. A `--merge-method` value other than `merge` or `squash` returns one
//    error naming the option.
//    Pre:  none.
//    Call: parseInitArgs(['/repo', '--merge-method', 'rebase'])
//    Want: { error: <string containing '--merge-method'> }
//    Src:  design.md C2 grammar "a --merge-method value other than merge or
//          squash"; requirements.md Req 1 AC 9 "naming the option".
// 7. No positional argument returns an error (shape only: the design C2
//    return type is `InitArgs | { error: string }`, and nothing concrete
//    exists to name when the positional itself is absent).
//    Pre:  none.
//    Call: parseInitArgs(['--store', '/tmp'])
//    Want: an object with a string `error` property and no `repoPath`.
//    Src:  design.md C2 grammar "no positional ... named in the line";
//          requirements.md Req 1 AC 5 "SHALL take one positional argument".
// 8. A second positional argument returns one error naming it.
//    Pre:  none.
//    Call: parseInitArgs(['/repo1', '/repo2'])
//    Want: { error: <string containing '/repo2'> }
//    Src:  design.md C2 grammar "... or a second positional, named in the
//          line".
// 9. A `--test-command` or `--worktree-setup` value with a backtick or a
//    newline returns one error naming the option (D7), for both options.
//    Pre:  none.
//    Call: parseInitArgs(['/repo', '--test-command', 'echo `hi`'])
//          parseInitArgs(['/repo', '--worktree-setup', 'echo\nhi'])
//    Want: { error: <string containing '--test-command'> };
//          { error: <string containing '--worktree-setup'> }
//    Src:  design.md C2 grammar "a --test-command or --worktree-setup value
//          with a backtick or a newline (D7)"; D7.
//
// parseDoctorArgs(rest):
// 10. `--help` is accepted (not an error) alongside the positional.
//     Pre:  none.
//     Call: parseDoctorArgs(['/repo', '--help'])
//     Want: { repoPath: '/repo' } — no `error` key.
//     Src:  brief Success clause "a doctor option other than --help is an
//           error" (implying --help itself is not).
// 11. Any other option returns one error naming it.
//     Pre:  none.
//     Call: parseDoctorArgs(['/repo', '--bogus'])
//     Want: { error: <string containing '--bogus'> }
//     Src:  design.md C2 grammar "`doctor` takes only `--help`"; brief
//           Success clause "a doctor option other than --help is an error".
//
// Shared `~` rule (exercised through parseDoctorArgs):
// 12. A leading `~/` expands to the home directory.
//     Pre:  none.
//     Call: parseDoctorArgs(['~/myrepo'])
//     Want: { repoPath: `${homedir()}/myrepo` }
//     Src:  design.md C2 "Reuses: the ~ rule of the private expandTildePath
//           (src/index.ts:120-125), copied"; src/index.ts:120-125.
//
// Contract for task 9 (design C1 in src/index.ts, design C2's runner in
// src/bootstrap/cli.ts; Req 1 AC 1-4, 10, 11).
//
// bootstrapCommand(args) (src/index.ts):
// 13. The first argument, when exactly `init` or `doctor`, is returned.
//     Pre:  none.
//     Call: bootstrapCommand(['init', '/repo']); bootstrapCommand(['doctor', '/repo'])
//     Want: 'init'; 'doctor'
//     Src:  design.md C1 "returns args[0] when it is exactly init or doctor,
//           else null"; brief Success "bootstrapCommand returns init and
//           doctor for a first argument".
// 14. `null` when the name is in a later position, or is a near-miss first
//     token.
//     Pre:  none.
//     Call: bootstrapCommand(['--port', '5000', 'init']); bootstrapCommand(['init-x'])
//     Want: null; null
//     Src:  design.md C1 "else null"; requirements.md Req 1 AC 3; brief
//           Success "null for a later position and for init-x".
//
// runBootstrapCommand(args, io) (src/bootstrap/cli.ts):
// 15. `--help` anywhere prints that command's usage to stdout and returns 0,
//     for both commands, with no stderr line.
//     Pre:  io is a fake collecting the out/err lines it is called with.
//     Call: runBootstrapCommand(['init', '--help'], io);
//           runBootstrapCommand(['doctor', '--help'], io)
//     Want: 0 both times; at least one stdout line naming the command; no
//           stderr line.
//     Src:  design.md C2 grammar "--help anywhere prints that command's
//           usage to stdout and returns 0 (Req 1 AC 10)"; requirements.md
//           Req 1 AC 10.
// 16. A bad option prints exactly one stderr line naming it and returns 1,
//     with no stdout line.
//     Pre:  io is a fake collecting the out/err lines it is called with.
//     Call: runBootstrapCommand(['init', '--bogus'], io)
//     Want: 1; io.err called exactly once, with a line containing '--bogus';
//           io.out not called.
//     Src:  design.md C2 "prints one stderr line and returns 1 on an error";
//           brief Success "1 with one stderr line on a bad option".
//
// showHelp (src/index.ts):
// 17. The SUBCOMMANDS block names both `init` and `doctor`.
//     Pre:  console.error spied.
//     Call: showHelp()
//     Want: the combined output contains 'init' and 'doctor'.
//     Src:  design.md C1 "Help text: showHelp gains a SUBCOMMANDS: block
//           with one line each for init <repo> and doctor <repo> (Req 1 AC
//           10)"; requirements.md Req 1 AC 10.
//
// Child process (real binary, Req 1 AC 1, 10):
// 18. `init --help` run as a child process exits 0, prints the init usage,
//     and never prints the server-startup banner.
//     Pre:  none (spawns `node --import <tsx loader> src/index.ts init --help`,
//           loader resolved as src/__tests__/workspace-roots.test.ts:514-517
//           does).
//     Call: runCli('init', '--help')
//     Want: exit code 0; stdout contains 'init'; stderr does not contain
//           'Starting Spec Workflow MCP Server'.
//     Src:  design.md Testing Strategy "A child node --import <tsx loader>
//           src/index.ts init --help ... exits 0 with the init usage and no
//           Starting banner"; brief Success "a child init --help exits 0
//           with the init usage and no Starting banner".

import { describe, it, expect, vi } from 'vitest';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { parseInitArgs, parseDoctorArgs, runBootstrapCommand } from '../cli.js';
import { bootstrapCommand, showHelp } from '../../index.js';

describe('parseInitArgs', () => {
  it('parses both --opt value and --opt=value forms together', () => {
    const result = parseInitArgs([
      '/repo',
      '--store', '/the/store',
      '--test-command=npm run test',
      '--worktree-setup', 'npm ci',
      '--merge-method=squash',
    ]);
    expect(result).toEqual({
      repoPath: '/repo',
      store: '/the/store',
      testCommand: 'npm run test',
      worktreeSetup: 'npm ci',
      mergeMethod: 'squash',
    });
  });

  it('rejects an unknown option, naming it', () => {
    const result = parseInitArgs(['/repo', '--bogus']) as { error: string };
    expect(result.error).toContain('--bogus');
  });

  it('rejects a value option that is last, naming it', () => {
    const result = parseInitArgs(['/repo', '--store']) as { error: string };
    expect(result.error).toContain('--store');
  });

  it('rejects a value option with an empty = value, naming it', () => {
    const result = parseInitArgs(['/repo', '--store=']) as { error: string };
    expect(result.error).toContain('--store');
  });

  it('rejects a value option followed by a double-dash token, naming it', () => {
    const result = parseInitArgs(['/repo', '--store', '--worktree-setup', 'npm ci']) as { error: string };
    expect(result.error).toContain('--store');
  });

  it('rejects a --merge-method value other than merge or squash, naming the option', () => {
    const result = parseInitArgs(['/repo', '--merge-method', 'rebase']) as { error: string };
    expect(result.error).toContain('--merge-method');
  });

  it('rejects no positional argument', () => {
    const result = parseInitArgs(['--store', '/tmp']) as { error?: string; repoPath?: string };
    expect(typeof result.error).toBe('string');
    expect(result.repoPath).toBeUndefined();
  });

  it('rejects a second positional argument, naming it', () => {
    const result = parseInitArgs(['/repo1', '/repo2']) as { error: string };
    expect(result.error).toContain('/repo2');
  });

  it('rejects a --test-command or --worktree-setup value with a backtick or newline, naming the option', () => {
    const backtick = parseInitArgs(['/repo', '--test-command', 'echo `hi`']) as { error: string };
    expect(backtick.error).toContain('--test-command');

    const newline = parseInitArgs(['/repo', '--worktree-setup', 'echo\nhi']) as { error: string };
    expect(newline.error).toContain('--worktree-setup');
  });
});

describe('parseDoctorArgs', () => {
  it('accepts --help as a non-error option', () => {
    const result = parseDoctorArgs(['/repo', '--help']);
    expect(result).toEqual({ repoPath: '/repo' });
  });

  it('rejects any option other than --help, naming it', () => {
    const result = parseDoctorArgs(['/repo', '--bogus']) as { error: string };
    expect(result.error).toContain('--bogus');
  });

  it('expands a leading ~/ to the home directory', () => {
    const result = parseDoctorArgs(['~/myrepo']);
    expect(result).toEqual({ repoPath: `${homedir()}/myrepo` });
  });
});

describe('bootstrapCommand', () => {
  it('returns the command name for a first-position init or doctor argument', () => {
    expect(bootstrapCommand(['init', '/repo'])).toBe('init');
    expect(bootstrapCommand(['doctor', '/repo'])).toBe('doctor');
  });

  it('returns null when init or doctor appears in a later position, and for a near-miss first token', () => {
    expect(bootstrapCommand(['--port', '5000', 'init'])).toBeNull();
    expect(bootstrapCommand(['init-x'])).toBeNull();
  });
});

function createFakeIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }, out, err };
}

describe('runBootstrapCommand', () => {
  it("prints that command's usage to stdout and returns 0 on --help, for both commands", async () => {
    const init = createFakeIo();
    const initCode = await runBootstrapCommand(['init', '--help'], init.io);
    expect(initCode).toBe(0);
    expect(init.out.length).toBeGreaterThan(0);
    expect(init.out.join('\n')).toContain('init');
    expect(init.err.length).toBe(0);

    const doctor = createFakeIo();
    const doctorCode = await runBootstrapCommand(['doctor', '--help'], doctor.io);
    expect(doctorCode).toBe(0);
    expect(doctor.out.length).toBeGreaterThan(0);
    expect(doctor.out.join('\n')).toContain('doctor');
    expect(doctor.err.length).toBe(0);
  });

  it('prints one stderr line and returns 1 on a bad option', async () => {
    const fake = createFakeIo();
    const code = await runBootstrapCommand(['init', '--bogus'], fake.io);
    expect(code).toBe(1);
    expect(fake.err.length).toBe(1);
    expect(fake.err[0]).toContain('--bogus');
    expect(fake.out.length).toBe(0);
  });
});

describe('showHelp SUBCOMMANDS block', () => {
  it('names both init and doctor', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      showHelp();
      const output = errorSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
      expect(output).toContain('init');
      expect(output).toContain('doctor');
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('child process: init --help', () => {
  const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.ts');
  // `--import tsx` resolved absolute, as src/__tests__/workspace-roots.test.ts:514-517 does.
  const TSX_LOADER = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

  function runCli(...args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, ['--import', TSX_LOADER, CLI_PATH, ...args], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      child.stdout!.setEncoding('utf-8');
      child.stdout!.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr!.setEncoding('utf-8');
      child.stderr!.on('data', (chunk: string) => { stderr += chunk; });
      child.on('error', rejectPromise);
      child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
    });
  }

  it('exits 0 with the init usage and no Starting banner', async () => {
    const { code, stdout, stderr } = await runCli('init', '--help');
    expect(code).toBe(0);
    expect(stdout.toLowerCase()).toContain('init');
    expect(stderr).not.toContain('Starting Spec Workflow MCP Server');
  }, 30_000);
});
