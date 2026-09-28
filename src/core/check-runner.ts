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

/** The scrubbed environment every check runs under: no git state, no colour. */
function checkEnv(): NodeJS.ProcessEnv {
  return { ...scrubbedGitEnv(), FORCE_COLOR: '0', NO_COLOR: '1' };
}

/**
 * Runs one command and resolves the `CheckResult` together with the raw stdout
 * and stderr, so a caller can classify the whole output rather than the one
 * reported line (design Component 6).
 */
function runOne(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number },
): Promise<{ result: CheckResult; stdout: string; stderr: string }> {
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
      (error, rawStdout, rawStderr) => {
        const stdout = rawStdout ?? '';
        const stderr = rawStderr ?? '';
        const output = lastLine(stdout, stderr);
        const done = (result: CheckResult) => resolve({ result, stdout, stderr });
        if (error === null) {
          done({ command, status: 'pass', exitCode: 0, output });
          return;
        }
        const err = error as ExecError;
        // Timeout: the process was killed by SIGTERM, so it has no exit code.
        if (err.killed === true && err.signal === 'SIGTERM' && err.code === null) {
          done({ command, status: 'timeout', exitCode: null, output });
          return;
        }
        // maxBuffer overflow: a fail with no exit code.
        if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          done({ command, status: 'fail', exitCode: null, output });
          return;
        }
        // A non-zero exit carries the numeric exit code.
        if (typeof err.code === 'number') {
          done({ command, status: 'fail', exitCode: err.code, output });
          return;
        }
        done({ command, status: 'fail', exitCode: null, output });
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
  const env = checkEnv();
  const results: CheckResult[] = [];
  for (const command of commands) {
    results.push((await runOne(command, { cwd: root, env, timeout })).result);
  }
  return results;
}

/**
 * Runs one command with the same scrubbed environment, colour variables, buffer
 * cap and timeout default as `runChecks`, and returns its result together with
 * the full raw stdout and stderr (design Component 6, requirement 4.9).
 */
export async function runCaptured(
  cwd: string,
  command: string,
  opts?: { timeoutMs?: number },
): Promise<CheckResult & { stdout: string; stderr: string }> {
  const timeout = opts?.timeoutMs ?? CHECK_TIMEOUT_MS;
  const { result, stdout, stderr } = await runOne(command, {
    cwd,
    env: checkEnv(),
    timeout,
  });
  return { ...result, stdout, stderr };
}
