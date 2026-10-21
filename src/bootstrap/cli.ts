// src/bootstrap/cli.ts
//
// Argument parsing and the runner for the bootstrap `init` and `doctor`
// commands (design C2, Req 1 AC 5, 6, 9, 10). Two parsers are exported here:
// parseInitArgs and parseDoctorArgs. Both are pure and synchronous — parsing
// writes no file and never resolves or stats the path; it rejects every bad
// option before any file is touched (Req 6 AC 2). runBootstrapCommand dispatches
// to runInit (C3) or runDoctor (C4).
//
// The `~` rule is a two-line copy of the private expandTildePath
// (src/index.ts:120-125), not an import of the entrypoint (design C2 "Reuses").
import { homedir } from 'os';
import { runInit } from './init.js';
import { runDoctor } from './doctor.js';
import type { InitArgs } from './init.js';

/** Collaborator for the command output; default wiring is the runner's (C2). */
export interface BootstrapIo {
  out(line: string): void;
  err(line: string): void;
}

/** The `~` rule of expandTildePath (src/index.ts:120-125), copied. */
function expandTilde(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace('~', homedir());
  }
  return path;
}

const INIT_VALUE_OPTIONS = ['--store', '--test-command', '--worktree-setup', '--merge-method'] as const;

/**
 * Parse the `init` arguments (design C2 grammar, Req 1 AC 5, 6, 9): exactly one
 * positional, and the value options above as `--opt value` or `--opt=value`
 * (D13). Every error case returns `{ error }` naming the option or positional.
 */
export function parseInitArgs(rest: string[]): InitArgs | { error: string } {
  const positionals: string[] = [];
  let store: string | undefined;
  let testCommand: string | undefined;
  let worktreeSetup: string | undefined;
  let mergeMethod: 'merge' | 'squash' | undefined;

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const eq = token.indexOf('=');
    const name = eq === -1 ? token : token.slice(0, eq);
    if (!(INIT_VALUE_OPTIONS as readonly string[]).includes(name)) {
      return { error: `unknown option ${name}` };
    }

    let value: string;
    if (eq !== -1) {
      value = token.slice(eq + 1);
      if (value === '') {
        return { error: `${name} needs a value` };
      }
    } else {
      const next = rest[i + 1];
      // A following `--` token (or no token) counts as a missing value (D13).
      if (next === undefined || next.startsWith('--')) {
        return { error: `${name} needs a value` };
      }
      value = next;
      i++;
    }

    switch (name) {
      case '--store':
        store = value;
        break;
      case '--test-command':
      case '--worktree-setup':
        // A command value with a backtick or newline is an input error (D7).
        if (value.includes('`') || value.includes('\n')) {
          return { error: `${name} must not contain a backtick or a newline` };
        }
        if (name === '--test-command') {
          testCommand = value;
        } else {
          worktreeSetup = value;
        }
        break;
      case '--merge-method':
        if (value !== 'merge' && value !== 'squash') {
          return { error: `${name} must be merge or squash` };
        }
        mergeMethod = value;
        break;
    }
  }

  if (positionals.length === 0) {
    return { error: 'init needs a repository path' };
  }
  if (positionals.length > 1) {
    return { error: `unexpected argument ${positionals[1]}` };
  }

  return { repoPath: expandTilde(positionals[0]), store, testCommand, worktreeSetup, mergeMethod };
}

/**
 * Parse the `doctor` arguments (design C2 grammar): exactly one positional and
 * the optional `--help`; any other option returns `{ error }` naming it.
 */
export function parseDoctorArgs(rest: string[]): { repoPath: string } | { error: string } {
  const positionals: string[] = [];

  for (const token of rest) {
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    if (token !== '--help') {
      return { error: `unknown option ${token}` };
    }
  }

  if (positionals.length === 0) {
    return { error: 'doctor needs a repository path' };
  }
  if (positionals.length > 1) {
    return { error: `unexpected argument ${positionals[1]}` };
  }

  return { repoPath: expandTilde(positionals[0]) };
}

/** One usage block per command; `--help` prints these to stdout (Req 1 AC 10). */
const USAGE: Record<'init' | 'doctor', string> = {
  init: `Usage: spec-workflow-mcp init <repo> [options]

Register a git repository with the spec-workflow controller: write .mcp.json and
.spec-workflow/agent-rules.md, then register with the controller.

Arguments:
  <repo>                  Path to the git repository (supports ~)

Options:
  --store <path>          Shared .spec-workflow root (default: the repo itself)
  --test-command <cmd>    Command the harness runs for tests
  --worktree-setup <cmd>  Command the harness runs to set up a worktree
  --merge-method <m>      merge or squash
  --help                  Show this help and exit`,
  doctor: `Usage: spec-workflow-mcp doctor <repo>

Report the first thing wrong with a configured repository. Writes nothing.

Arguments:
  <repo>                  Path to the git repository (supports ~)

Options:
  --help                  Show this help and exit`,
};

/** The command output; the default wiring is console.log and console.error (C2). */
const defaultIo: BootstrapIo = {
  out: (line: string) => console.log(line),
  err: (line: string) => console.error(line),
};

/**
 * Run the bootstrap command named by `args[0]` (design C2). `--help` anywhere
 * prints that command's usage to stdout and returns 0 (Req 1 AC 10). Otherwise
 * the rest is parsed with the functions above: one stderr line and 1 on an
 * error, else runInit (C3) or runDoctor (C4). An unexpected exception prints
 * `error: ` and its message on stderr and returns 1.
 */
export async function runBootstrapCommand(args: string[], io: BootstrapIo = defaultIo): Promise<number> {
  const command = args[0] as 'init' | 'doctor';
  const rest = args.slice(1);

  if (rest.includes('--help')) {
    io.out(USAGE[command]);
    return 0;
  }

  try {
    if (command === 'init') {
      const parsed = parseInitArgs(rest);
      if ('error' in parsed) {
        io.err(parsed.error);
        return 1;
      }
      return await runInit(parsed, io);
    }
    const parsed = parseDoctorArgs(rest);
    if ('error' in parsed) {
      io.err(parsed.error);
      return 1;
    }
    return await runDoctor(parsed.repoPath, io);
  } catch (error: any) {
    io.err(`error: ${error?.message ?? error}`);
    return 1;
  }
}
