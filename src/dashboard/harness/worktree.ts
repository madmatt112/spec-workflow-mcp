// src/dashboard/harness/worktree.ts
//
// The feat/<spec> worktree a run works in (design D6, controller-tasks.md T6).
// Moved out of the deleted supervisor launcher at step (d) of the foundation
// rework: the controller's run driver is its only caller.
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { scrubbedGitEnv } from '../../core/git-utils.js';

const execFileAsync = promisify(execFile);

export type LaunchStep = 'worktree' | 'worktree-setup';

export class LaunchError extends Error {
  step: LaunchStep;
  detail: string;
  constructor(step: LaunchStep, detail: string) {
    super(`${step}: ${detail}`);
    this.name = 'LaunchError';
    this.step = step;
    this.detail = detail;
  }
}

/** Enough room for a real `npm ci` before the error detail truncates to 2,000. */
const SETUP_MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_SETUP_TIMEOUT_MS = 900000;

/**
 * Reuse the porcelain worktree entry on `refs/heads/feat/<spec>`, else create
 * the worktree at `<checkout>/.claude/worktrees/<spec>` on that branch (design
 * D6). An unmarked worktree always re-runs its setup (Req 3.14).
 */
export async function ensureWorktree(
  workspacePath: string,
  spec: string,
  worktreeSetup: string | null,
  opts: { setupTimeoutMs?: number } = {},
): Promise<string> {
  const branch = `feat/${spec}`;
  const existing = await findWorktree(workspacePath, branch);
  let dir: string;
  if (existing) {
    dir = existing;
  } else {
    dir = join(workspacePath, '.claude', 'worktrees', spec);
    const addArgs = (await branchExists(workspacePath, branch))
      ? ['worktree', 'add', dir, branch]
      : ['worktree', 'add', '-b', branch, dir];
    await git(workspacePath, addArgs);
  }
  await runSetupIfNeeded(dir, worktreeSetup, opts.setupTimeoutMs ?? DEFAULT_SETUP_TIMEOUT_MS);
  return dir;
}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, env: scrubbedGitEnv() });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    throw new LaunchError('worktree', (e.stderr || e.message || String(err)).trim());
  }
}

async function findWorktree(cwd: string, branch: string): Promise<string | null> {
  const out = await git(cwd, ['worktree', 'list', '--porcelain']);
  const target = `branch refs/heads/${branch}`;
  let current: string | null = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = line.slice('worktree '.length);
    } else if (line === target && current) {
      return current;
    } else if (line === '') {
      current = null;
    }
  }
  return null;
}

async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
      cwd, env: scrubbedGitEnv(),
    });
    return true;
  } catch {
    return false;
  }
}

async function runSetupIfNeeded(worktreeDir: string, worktreeSetup: string | null, timeoutMs: number): Promise<void> {
  const gitDir = (await git(worktreeDir, ['rev-parse', '--absolute-git-dir'])).trim();
  const marker = join(gitDir, 'sdd-setup-done');
  if (existsSync(marker)) return; // already set up: reuse without re-running
  if (worktreeSetup === null) {
    writeFileSync(marker, '');
    return;
  }
  try {
    await execFileAsync('bash', ['-c', worktreeSetup], {
      cwd: worktreeDir,
      env: scrubbedGitEnv(),
      timeout: timeoutMs,
      maxBuffer: SETUP_MAX_BUFFER,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    const output = ((e.stdout ?? '') + (e.stderr ?? '')).slice(-2000);
    throw new LaunchError('worktree-setup', `${e.code ?? e.message} ${output}`.trim());
  }
  writeFileSync(marker, ''); // marker only on success
}
