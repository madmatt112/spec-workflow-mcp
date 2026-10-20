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

import { describe, it, expect } from 'vitest';
import { homedir } from 'os';
import { parseInitArgs, parseDoctorArgs } from '../cli.js';

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
