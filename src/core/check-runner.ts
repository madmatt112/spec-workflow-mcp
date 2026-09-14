import { exec } from 'node:child_process';
import { scrubbedGitEnv } from './git-utils.js';

/** Per-check wall-clock budget (design Component 6, requirement 4.4). */
export const CHECK_TIMEOUT_MS = 300_000;
/** Combined stdout+stderr cap; an overflow is a `fail` (design Component 6, D22). */
export const CHECK_MAX_BUFFER = 16 * 1024 * 1024;

/** How many characters of the one output line the gate keeps (requirement 1.7). */
const MAX_OUTPUT_CHARS = 200;

export type CheckResult = {
  command: string;
  status: 'pass' | 'fail' | 'timeout';
  exitCode: number | null;
  output: string;
};

/**
 * The `child_process.exec` callback error, widened to the shape probed on the
 * runtime: on a timeout `code` is `null` (the process was signalled), and a
 * maxBuffer overflow sets `code` to the string `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`.
 * The `@types/node` `ExecException.code` is `number | undefined`, so widen it here.
 */
type ExecError = Error & {
  killed?: boolean;
  signal?: string | null;
  code?: number | string | null;
};

/**
 * The one line the gate reports for a check: the last non-empty line of the
 * combined stdout then stderr, trimmed, at most 200 characters (design D22).
 */
export function lastLine(stdout: string, stderr: string): string {
  const lines = `${stdout}\n${stderr}`.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, MAX_OUTPUT_CHARS);
    }
  }
  return '';
}

function runOne(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number },
): Promise<CheckResult> {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeout,
        killSignal: 'SIGTERM',
        maxBuffer: CHECK_MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        const output = lastLine(stdout ?? '', stderr ?? '');
        if (error === null) {
          resolve({ command, status: 'pass', exitCode: 0, output });
          return;
        }
        const err = error as ExecError;
        // Timeout: the process was killed by SIGTERM, so it has no exit code.
        if (err.killed === true && err.signal === 'SIGTERM' && err.code === null) {
          resolve({ command, status: 'timeout', exitCode: null, output });
          return;
        }
        // maxBuffer overflow: a fail with no exit code.
        if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          resolve({ command, status: 'fail', exitCode: null, output });
          return;
        }
        // A non-zero exit carries the numeric exit code.
        if (typeof err.code === 'number') {
          resolve({ command, status: 'fail', exitCode: err.code, output });
          return;
        }
        resolve({ command, status: 'fail', exitCode: null, output });
      },
    );
  });
}

/**
 * Runs each command through the platform shell in `root`, awaited in order, with
 * the git environment scrubbed. Only the strings in `commands` run (NFR Security).
 */
export async function runChecks(
  root: string,
  commands: string[],
  opts?: { timeoutMs?: number },
): Promise<CheckResult[]> {
  const timeout = opts?.timeoutMs ?? CHECK_TIMEOUT_MS;
  const env = { ...scrubbedGitEnv(), FORCE_COLOR: '0', NO_COLOR: '1' };
  const results: CheckResult[] = [];
  for (const command of commands) {
    results.push(await runOne(command, { cwd: root, env, timeout }));
  }
  return results;
}
