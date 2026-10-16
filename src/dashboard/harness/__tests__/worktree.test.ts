import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { promises as fsp } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureWorktree, LaunchError } from '../worktree.js';

// Contract for src/dashboard/harness/worktree.ts (design D6; controller-tasks.md
// T6 "reuse ensureWorktree"). The three cases carried over from the deleted
// launcher test (step (d) of the foundation rework): a non-git workspace fails
// at the `worktree` step; a failing setup command fails at `worktree-setup`,
// leaves no marker and runs again next time; a passing setup writes the marker
// and a second call reuses the worktree without re-running it.

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
}

function initGitRepo(dir: string): void {
  execFileSync('git', ['init', '-q'], { cwd: dir, env: gitEnv() });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd: dir, env: gitEnv() });
}

async function catchError(p: Promise<unknown>): Promise<LaunchError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(LaunchError);
    return err as LaunchError;
  }
  throw new Error('expected ensureWorktree to throw');
}

describe('ensureWorktree', () => {
  let base: string;

  beforeEach(async () => {
    base = await fsp.mkdtemp(join(tmpdir(), 'worktree-test-'));
  });

  afterEach(async () => {
    await fsp.rm(base, { recursive: true, force: true });
  });

  it('a non-git workspace gives step worktree', async () => {
    const workspace = join(base, 'plain');
    mkdirSync(workspace, { recursive: true });

    const err = await catchError(ensureWorktree(workspace, 'demo-spec', null));
    expect(err.step).toBe('worktree');
    expect(err.detail.length).toBeGreaterThan(0);
  });

  it('a failing setup command gives step worktree-setup, no marker, and a second call runs the setup again', async () => {
    const workspace = join(base, 'repo-fail');
    mkdirSync(workspace, { recursive: true });
    initGitRepo(workspace);
    const counterFile = join(base, 'setup-counter-fail.txt');
    const worktreeSetup = `echo run >> ${counterFile}; echo FAILSETUP-MARK; exit 7`;

    const err1 = await catchError(ensureWorktree(workspace, 'demo-spec', worktreeSetup));
    expect(err1.step).toBe('worktree-setup');
    expect(err1.detail).toContain('7');
    expect(err1.detail).toContain('FAILSETUP-MARK');

    const worktreePath = join(workspace, '.claude', 'worktrees', 'demo-spec');
    const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: worktreePath, encoding: 'utf-8' }).trim();
    expect(existsSync(join(gitDir, 'sdd-setup-done'))).toBe(false);

    const err2 = await catchError(ensureWorktree(workspace, 'demo-spec', worktreeSetup));
    expect(err2.step).toBe('worktree-setup');
    expect(readFileSync(counterFile, 'utf-8').trim().split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('a passing setup writes the marker; a second call reuses the worktree without re-running it', async () => {
    const workspace = join(base, 'repo-pass');
    mkdirSync(workspace, { recursive: true });
    initGitRepo(workspace);
    const counterFile = join(base, 'setup-counter-pass.txt');
    const worktreeSetup = `echo run >> ${counterFile}`;

    const dir1 = await ensureWorktree(workspace, 'demo-spec', worktreeSetup);
    const worktreePath = join(workspace, '.claude', 'worktrees', 'demo-spec');
    expect(dir1).toBe(worktreePath);
    const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: worktreePath, encoding: 'utf-8' }).trim();
    expect(existsSync(join(gitDir, 'sdd-setup-done'))).toBe(true);
    expect(readFileSync(counterFile, 'utf-8').trim().split('\n').filter(Boolean)).toHaveLength(1);

    const dir2 = await ensureWorktree(workspace, 'demo-spec', worktreeSetup);
    expect(dir2).toBe(worktreePath);
    expect(readFileSync(counterFile, 'utf-8').trim().split('\n').filter(Boolean)).toHaveLength(1);
  });
});
