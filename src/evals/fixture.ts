import { execFileSync } from 'child_process';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scrubbedGitEnv } from '../core/git-utils.js';
import type { EvalCase } from './case.js';

export interface Fixture {
  root: string;
  parent: string;
  bases: Record<string, string>;
}

export class FixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureError';
  }
}

const AUTHOR_ENV = {
  GIT_AUTHOR_NAME: 'Eval Fixture',
  GIT_AUTHOR_EMAIL: 'eval-fixture@local',
  GIT_COMMITTER_NAME: 'Eval Fixture',
  GIT_COMMITTER_EMAIL: 'eval-fixture@local'
};

function git(cwd: string, args: string[], extraEnv?: NodeJS.ProcessEnv): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8',
    env: { ...scrubbedGitEnv(), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

/** Builds a fresh git repository for one eval run under a new mkdtemp parent (Component 2, R1 AC3). */
export function buildFixture(c: EvalCase, caseDir: string): Fixture {
  const parent = mkdtempSync(join(tmpdir(), 'eval-fixture-'));
  try {
    const root = join(parent, 'repo');
    mkdirSync(root, { recursive: true });
    git(root, ['init', '-q']);

    if (c.fixture.preCommitHook) {
      const hookDest = join(root, '.git', 'hooks', 'pre-commit');
      cpSync(join(caseDir, c.fixture.preCommitHook), hookDest);
      chmodSync(hookDest, 0o755);
    }

    for (const commit of c.fixture.commits) {
      const treeDir = join(caseDir, commit.tree);
      if (!existsSync(treeDir)) {
        throw new FixtureError(`fixture tree does not exist: ${commit.tree}`);
      }
      cpSync(treeDir, root, { recursive: true });
      git(root, ['add', '-A']);
      git(root, ['-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', commit.message], AUTHOR_ENV);
    }

    const bases: Record<string, string> = { '.': git(root, ['rev-parse', 'HEAD']) };

    for (const worktree of c.fixture.worktrees ?? []) {
      const rel = join('.claude', 'worktrees', worktree.dir);
      git(root, ['worktree', 'add', '-b', worktree.branch, rel]);
      bases[rel] = git(join(root, rel), ['rev-parse', 'HEAD']);
    }
    if ((c.fixture.worktrees?.length ?? 0) > 0) {
      appendFileSync(join(root, '.git', 'info', 'exclude'), '\n.claude/worktrees/\n');
    }

    return { root, parent, bases };
  } catch (err) {
    rmSync(parent, { recursive: true, force: true });
    if (err instanceof FixtureError) throw err;
    throw new FixtureError(err instanceof Error ? err.message : String(err));
  }
}

/** Removes the fixture's mkdtemp parent. */
export function disposeFixture(f: Fixture): void {
  rmSync(f.parent, { recursive: true, force: true });
}
