import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { pushSpecStore } from '../ledger.js';

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}
function initRepo(path: string): void {
  mkdirSync(path, { recursive: true });
  git(path, ['init', '-q', '-b', 'main']);
  git(path, ['config', 'user.email', 't@test']);
  git(path, ['config', 'user.name', 'Tester']);
  git(path, ['config', 'commit.gpgsign', 'false']);
}
function commit(repo: string, file: string, message: string): void {
  mkdirSync(join(repo, file, '..'), { recursive: true });
  writeFileSync(join(repo, file), `${message}\n`);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', message]);
}

let base: string;
afterEach(() => { try { rmSync(base, { recursive: true, force: true }); } catch { /* ignore */ } });

describe('pushSpecStore', () => {
  it('rebases the local store commits onto the remote and pushes; a store with no remote is skipped', () => {
    base = mkdtempSync(join(tmpdir(), 'ctrl-push-'));
    const origin = join(base, 'origin.git');
    git(base, ['init', '-q', '--bare', '-b', 'main', origin]); // CI's default branch is not main
    const store = join(base, 'store');
    initRepo(store);
    commit(store, 'README.md', 'init');
    git(store, ['remote', 'add', 'origin', origin]);
    git(store, ['push', '-q', '-u', 'origin', 'main']);
    // The remote moves on (a run's PR merged there) while the store commits locally.
    const other = join(base, 'other');
    git(base, ['clone', '-q', '-b', 'main', origin, other]);
    git(other, ['config', 'user.email', 't@test']);
    git(other, ['config', 'user.name', 'Tester']);
    git(other, ['config', 'commit.gpgsign', 'false']);
    commit(other, 'src/code.js', 'feat: merged on the remote');
    git(other, ['push', '-q', 'origin', 'main']);
    commit(store, '.spec-workflow/specs/x/harness-events.jsonl', 'docs(sdd): x harness ledger');

    const result = pushSpecStore(store);

    expect(result).toEqual({ ok: true, note: 'pushed main' });
    const log = git(origin, ['log', '--format=%s', 'main']);
    expect(log.split('\n')).toEqual(['docs(sdd): x harness ledger', 'feat: merged on the remote', 'init']);

    const lonely = join(base, 'lonely');
    initRepo(lonely);
    commit(lonely, 'README.md', 'init');
    expect(pushSpecStore(lonely)).toEqual({ ok: true, note: 'no remote' });
  });

  it('reports a rebase that conflicts, leaving the store as it was', () => {
    base = mkdtempSync(join(tmpdir(), 'ctrl-push-'));
    const origin = join(base, 'origin.git');
    git(base, ['init', '-q', '--bare', '-b', 'main', origin]); // CI's default branch is not main
    const store = join(base, 'store');
    initRepo(store);
    commit(store, 'HANDOFF.md', 'init');
    git(store, ['remote', 'add', 'origin', origin]);
    git(store, ['push', '-q', '-u', 'origin', 'main']);
    const other = join(base, 'other');
    git(base, ['clone', '-q', '-b', 'main', origin, other]);
    git(other, ['config', 'user.email', 't@test']);
    git(other, ['config', 'user.name', 'Tester']);
    git(other, ['config', 'commit.gpgsign', 'false']);
    commit(other, 'HANDOFF.md', 'theirs');
    git(other, ['push', '-q', 'origin', 'main']);
    commit(store, 'HANDOFF.md', 'ours');
    const head = git(store, ['rev-parse', 'HEAD']);

    const result = pushSpecStore(store);

    expect(result.ok).toBe(false);
    expect(result.note).toMatch(/^rebase onto origin\/main: /);
    expect(git(store, ['rev-parse', 'HEAD'])).toBe(head);
    expect(git(store, ['status', '--porcelain'])).toBe('');
  });
});
