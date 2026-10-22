// Contract blocks — one per success criterion (AC 4.1, 4.2, 4.6), per the
// task's _Prompt. Each test reaches the behaviour only through
// `diffNewDependencies` or `readNewDependencies`.
//
// 1. diffNewDependencies — added name (AC 4.1)
//    Pre: before has {dependencies:{a}}, after has {dependencies:{a,b}}.
//    Call: diffNewDependencies(before, after).
//    Result: ['b'].
//    Source: AC 4.1 "list the package names the head adds"; design C2 "the
//    union of names over the four sections of after minus the union over
//    before".
//
// 2. diffNewDependencies — name moved between sections (AC 4.2)
//    Pre: before has {dependencies:{a}}, after has {devDependencies:{a}}.
//    Call: diffNewDependencies(before, after).
//    Result: [].
//    Source: AC 4.2 "A name that is only moved between those four sections
//    ... SHALL NOT count as new".
//
// 3. diffNewDependencies — re-versioned name (AC 4.2)
//    Pre: before has {dependencies:{a:'1.0.0'}}, after has
//    {dependencies:{a:'2.0.0'}}.
//    Call: diffNewDependencies(before, after).
//    Result: [].
//    Source: AC 4.2 "a version change of an existing name SHALL NOT count as
//    new".
//
// 4. diffNewDependencies — removed name (AC 4.2/4.1)
//    Pre: before has {dependencies:{a,b}}, after has {dependencies:{a}}.
//    Call: diffNewDependencies(before, after).
//    Result: [].
//    Source: AC 4.1's "adds" and design C2's set-difference definition give
//    no entry for a name only removed.
//
// 5. diffNewDependencies — new manifest, sorted and unique (AC 4.1)
//    Pre: before is undefined (missing side), after has two sections each
//    contributing names, one name shared across sections.
//    Call: diffNewDependencies(before, after).
//    Result: ['a','b','c'] (sorted, unique).
//    Source: AC 4.1 "under dependencies, devDependencies, peerDependencies or
//    optionalDependencies of any package.json"; design C2 "sorted and
//    unique" and "a missing ... side counts as empty".
//
// 6. readNewDependencies — one added dependency on a temp git repo (AC 4.1)
//    Pre: a temp git repo with base branch `main` at a commit whose
//    package.json has dependency `a`, and a `feature` branch one commit
//    ahead whose package.json adds dependency `b`.
//    Call: readNewDependencies(repoDir, 'main', 'feature').
//    Result: { ok: true, names: ['b'] }.
//    Source: AC 4.1, read against the merge base of base and head per design
//    C2's `readNewDependencies` post-conditions.
//
// 7. readNewDependencies — lockfile-only commit gives an empty list (AC 4.2)
//    Pre: same repo shape, but the `feature` commit changes only
//    package-lock.json; package.json is unchanged.
//    Call: readNewDependencies(repoDir, 'main', 'feature').
//    Result: { ok: true, names: [] }.
//    Source: AC 4.2 "a lockfile-only change SHALL NOT count as new"; design
//    C2 "keep paths whose basename is package.json".
//
// 8. readNewDependencies — unreadable head gives ok:false with one line of
//    why (AC 4.6)
//    Pre: a temp git repo with a `main` branch and commit.
//    Call: readNewDependencies(repoDir, 'main', '0000000000000000000000000000000000000000').
//    Result: ok is false and reason is a single non-empty line.
//    Source: AC 4.6 "the pass SHALL record no list ... it SHALL NOT ...
//    throw"; design C2 "a failed git call ... gives ok: false with one line
//    of why. Never throws."

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffNewDependencies, readNewDependencies } from '../new-deps.js';

function git(dir: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function initRepo(dir: string): void {
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
}

function writeManifest(dir: string, manifest: unknown): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
}

function commitAll(dir: string, message: string): void {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', message]);
}

describe('diffNewDependencies', () => {
  it('lists a name added to a section', () => {
    const before = { dependencies: { a: '1.0.0' } };
    const after = { dependencies: { a: '1.0.0', b: '2.0.0' } };
    expect(diffNewDependencies(before, after)).toEqual(['b']);
  });

  it('does not count a name only moved between sections', () => {
    const before = { dependencies: { a: '1.0.0' } };
    const after = { devDependencies: { a: '1.0.0' } };
    expect(diffNewDependencies(before, after)).toEqual([]);
  });

  it('does not count a version change of an existing name', () => {
    const before = { dependencies: { a: '1.0.0' } };
    const after = { dependencies: { a: '2.0.0' } };
    expect(diffNewDependencies(before, after)).toEqual([]);
  });

  it('does not count a name that was removed', () => {
    const before = { dependencies: { a: '1.0.0', b: '1.0.0' } };
    const after = { dependencies: { a: '1.0.0' } };
    expect(diffNewDependencies(before, after)).toEqual([]);
  });

  it('lists a new manifest\'s names sorted and unique across sections', () => {
    const after = {
      dependencies: { b: '1.0.0', a: '1.0.0' },
      devDependencies: { a: '1.0.0', c: '1.0.0' },
    };
    expect(diffNewDependencies(undefined, after)).toEqual(['a', 'b', 'c']);
  });
});

describe('readNewDependencies', () => {
  it('finds one added dependency between base and head on a local git repo', () => {
    const dir = tmp('new-deps-added-');
    initRepo(dir);
    writeManifest(dir, { name: 'x', dependencies: { a: '1.0.0' } });
    commitAll(dir, 'init');
    git(dir, ['checkout', '-qb', 'feature']);
    writeManifest(dir, { name: 'x', dependencies: { a: '1.0.0', b: '2.0.0' } });
    commitAll(dir, 'add b');

    const result = readNewDependencies(dir, 'main', 'feature');
    expect(result).toEqual({ ok: true, names: ['b'] });
  });

  it('gives an empty list for a lockfile-only commit', () => {
    const dir = tmp('new-deps-lockfile-');
    initRepo(dir);
    writeManifest(dir, { name: 'x', dependencies: { a: '1.0.0' } });
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));
    commitAll(dir, 'init');
    git(dir, ['checkout', '-qb', 'feature']);
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, extra: true }));
    commitAll(dir, 'bump lockfile');

    const result = readNewDependencies(dir, 'main', 'feature');
    expect(result).toEqual({ ok: true, names: [] });
  });

  it('gives ok:false with one line of why for an unreadable head', () => {
    const dir = tmp('new-deps-missing-sha-');
    initRepo(dir);
    writeManifest(dir, { name: 'x' });
    commitAll(dir, 'init');

    const result = readNewDependencies(dir, 'main', '0000000000000000000000000000000000000000');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
      expect(result.reason.split('\n')).toHaveLength(1);
    }
  });
});
