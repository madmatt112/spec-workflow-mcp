import { describe, it, expect, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { specFileList, evaluateLaunchGuard } from '../launch-guard.js';
import type { GuardProject } from '../launch-guard.js';

// Contract for src/dashboard/harness/launch-guard.ts (design.md C2, Data
// Models, D4, D5, D6; task 5 _Prompt; Requirements 2.3, 2.6, 2.7, 2.8).
//
// Criterion "tasks union, source tasks" (AC 7):
//   Pre-condition: tasks.md with two tasks, `File:` lines `src/a.ts`, then
//   `src/b.ts` and `src/c.ts` on a second task.
//   Test: specFileList(workflowRoot, spec).
//   Observable result: { source: 'tasks', paths: ['src/a.ts', 'src/b.ts',
//   'src/c.ts'] }.
//   Expected-value source: design C2 bullet 1 ("the union of task.files ...
//   source tasks").
//
// Criterion "no File: entries gives no-list, reads no decomposition" (AC 7):
//   Pre-condition: tasks.md with one task carrying no `File:` line;
//   decomposition.md holding a heading for the same spec with a real
//   `File:` path.
//   Test: specFileList(workflowRoot, spec), then
//   evaluateLaunchGuard(spec, project, [project]) with project's code root
//   holding nothing.
//   Observable result: specFileList gives { source: 'tasks', paths: [] };
//   evaluateLaunchGuard gives state 'no-list', source 'tasks', listed 0 (the
//   decomposition path is never reached, so it cannot appear).
//   Expected-value source: design C2 bullet 1 ("The decomposition is read
//   only when tasks.md is absent, so an existing tasks.md with no File:
//   entries gives no-list").
//
// Criterion "decomposition source, suffix stripped" (AC 7):
//   Pre-condition: no tasks.md; decomposition.md heading for the spec whose
//   body holds backticked tokens `src/foo/bar.ts:12-20`, `src/other.ts:5`
//   and `src/plain.ts`, followed by a next heading for a different spec
//   naming its own file.
//   Test: specFileList(workflowRoot, spec).
//   Observable result: { source: 'decomposition', paths: ['src/foo/bar.ts',
//   'src/other.ts', 'src/plain.ts'] } — the next heading's path is absent.
//   Expected-value source: design C2 bullet 2 ("backticked tokens holding a
//   /, with a trailing :<line> or :<start>-<end> removed").
//
// Criterion "a bare name is dropped" (AC 7):
//   Pre-condition: no tasks.md; decomposition.md heading for the spec whose
//   body holds backticked tokens `tiles.tsx` (no slash) and `src/kept.ts`.
//   Test: specFileList(workflowRoot, spec).
//   Observable result: { source: 'decomposition', paths: ['src/kept.ts'] }.
//   Expected-value source: design C2 bullet 2 ("A bare name such as
//   tiles.tsx names no location and is dropped").
//
// Criterion "no entry gives source none, no-list" (AC 7):
//   Pre-condition: no tasks.md; decomposition.md with headings for other
//   specs only.
//   Test: specFileList(workflowRoot, spec), then
//   evaluateLaunchGuard(spec, project, [project]).
//   Observable result: specFileList gives { source: 'none', paths: [] };
//   evaluateLaunchGuard gives state 'no-list', source 'none'.
//   Expected-value source: design C2 bullet 3 ("Otherwise source none,
//   state no-list").
//
// Criterion "each filter drops its path" (NFR Security), one case per bad
//   path (absolute, a .. segment, leading ~, whitespace, a *, a <, leading
//   .spec-workflow/):
//   Pre-condition: tasks.md listing the bad path plus the good path
//   `src/good.ts`; project's own code root holds `src/good.ts`.
//   Test: evaluateLaunchGuard(spec, project, [project]).
//   Observable result: listed 1, compared 1, held 1, state 'clear' — the
//   bad path never reaches `listed`.
//   Expected-value source: design C2 "Filters on both sources (NFR
//   Security)" bullet, enumerating exactly these seven drops.
//
// Criterion "all filtered gives no-list":
//   Pre-condition: tasks.md listing only an absolute path and a path with a
//   `..` segment.
//   Test: evaluateLaunchGuard(spec, project, [project]).
//   Observable result: listed 0, state 'no-list', source 'tasks'.
//   Expected-value source: design C2 "If nothing survives, the state is
//   no-list".
//
// Criterion "an unheld path leaves compared":
//   Pre-condition: tasks.md listing `src/held.ts` (exists under the
//   project's code root) and `src/missing.ts` (exists nowhere).
//   Test: evaluateLaunchGuard(spec, project, [project]).
//   Observable result: listed 2, compared 1, held 1.
//   Expected-value source: design C2 ("A path no store project holds is new
//   or stale and is dropped; the rest are compared").
//
// Criterion "strictly more gives warn with useProject" (AC 3, 6):
//   Pre-condition: tasks.md listing three paths; one exists only under
//   project A's code root, two exist only under sibling project B's code
//   root.
//   Test: evaluateLaunchGuard(spec, projectA, [projectA, projectB]).
//   Observable result: state 'warn', useProject === projectB.projectId,
//   held 1, compared 3.
//   Expected-value source: design C2 ("State warn when another store
//   project holds strictly more compared paths ... useProject holds the
//   most").
//
// Criterion "equal counts give clear":
//   Pre-condition: tasks.md listing two paths, one held only under A's code
//   root, one held only under B's code root (one each).
//   Test: evaluateLaunchGuard(spec, projectA, [projectA, projectB]).
//   Observable result: state 'clear', useProject undefined, held 1,
//   compared 2.
//   Expected-value source: design C2 ("else clear").
//
// Criterion "a tie among holders breaks on projectName":
//   Pre-condition: tasks.md listing four paths; two exist only under
//   sibling B's code root (projectName 'Zulu'), two exist only under
//   sibling C's code root (projectName 'Alpha'); A's own code root holds
//   none of them.
//   Test: evaluateLaunchGuard(spec, projectA, [projectA, projectB, projectC]).
//   Observable result: state 'warn', useProject === projectC.projectId (the
//   alphabetically-first name among the tied holders).
//   Expected-value source: design C2 ("ties break on projectName") — the
//   tie-break direction (ascending) is the test author's reading, since the
//   design states the key but not the order.
//
// Criterion "a path under two roots counts for both":
//   Pre-condition: tasks.md listing `src/shared.ts` (exists under both A's
//   and B's code roots) and `src/b-only.ts` (exists only under B's).
//   Test: evaluateLaunchGuard(spec, projectA, [projectA, projectB]).
//   Observable result: state 'warn', useProject === projectB.projectId,
//   held (A) 1, compared 2 — B's held count (2) beats A's (1) only if the
//   shared path counts toward both, proving it is not attributed to one
//   holder alone.
//   Expected-value source: design C2 ("A path under two roots counts for
//   both, so a shared package.json cannot hide a wrong tile").
//
// Criterion "compared 0 gives clear with no useProject":
//   Pre-condition: tasks.md listing one well-formed path that exists under
//   no code root in the store.
//   Test: evaluateLaunchGuard(spec, projectA, [projectA, projectB]).
//   Observable result: state 'clear', useProject undefined, compared 0,
//   held 0.
//   Expected-value source: design C2 ("With compared at 0, the state is
//   clear and no project is named").
//
// Criterion "listed, compared and held are exact":
//   Pre-condition: tasks.md listing five raw paths: two filtered out
//   (absolute, holding `<`), one held under A only, one held under B only,
//   one held nowhere.
//   Test: evaluateLaunchGuard(spec, projectA, [projectA, projectB]).
//   Observable result: listed 3, compared 2, held 1 (exact numbers, not an
//   approximation).
//   Expected-value source: design Data Models (`listed`, `compared`,
//   `held` field comments) and the fixture's literal path counts.

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

async function mkTemp(prefix: string): Promise<string> {
  const dir = await fsp.mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function makeWorkflowRoot(): Promise<{ storePath: string; workflowRoot: string }> {
  const storePath = await mkTemp('launch-guard-store-');
  const workflowRoot = join(storePath, '.spec-workflow');
  await fsp.mkdir(join(workflowRoot, 'specs'), { recursive: true });
  return { storePath, workflowRoot };
}

async function writeTasks(workflowRoot: string, spec: string, content: string): Promise<void> {
  const dir = join(workflowRoot, 'specs', spec);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(join(dir, 'tasks.md'), content);
}

async function writeDecomposition(workflowRoot: string, content: string): Promise<void> {
  const dir = join(workflowRoot, 'spec-decomposition');
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(join(dir, 'decomposition.md'), content);
}

function tasksMdWithFiles(paths: string[]): string {
  return [
    '# Tasks', '',
    '- [ ] 1. Task',
    `  - File: ${paths.join(', ')}`,
    '',
  ].join('\n');
}

async function makeCodeRoot(): Promise<string> {
  return mkTemp('launch-guard-code-');
}

async function touch(codeRoot: string, relPath: string): Promise<void> {
  const full = join(codeRoot, relPath);
  await fsp.mkdir(dirname(full), { recursive: true });
  await fsp.writeFile(full, '');
}

function guardProject(id: string, name: string, storePath: string, codeRoot: string): GuardProject {
  return { projectId: id, projectName: name, projectPath: storePath, workspacePath: codeRoot };
}

describe('specFileList', () => {
  it('reads the union of task.files from tasks.md, source tasks', async () => {
    const { workflowRoot } = await makeWorkflowRoot();
    await writeTasks(workflowRoot, 'spec1', [
      '# Tasks', '',
      '- [ ] 1. First',
      '  - File: src/a.ts', '',
      '- [ ] 2. Second',
      '  - File: src/b.ts, src/c.ts', '',
    ].join('\n'));

    const result = specFileList(workflowRoot, 'spec1');

    expect(result).toEqual({ source: 'tasks', paths: ['src/a.ts', 'src/b.ts', 'src/c.ts'] });
  });

  it('gives source tasks with no paths when tasks.md has no File: entries, and reads no decomposition', async () => {
    const { workflowRoot } = await makeWorkflowRoot();
    await writeTasks(workflowRoot, 'spec2', [
      '# Tasks', '',
      '- [ ] 1. First',
      '  - Purpose: a thing with no file list', '',
    ].join('\n'));
    await writeDecomposition(workflowRoot, [
      '### 1. `spec2` — build thing', '',
      '_Prompt: touches `src/should-not-be-read.ts`_', '',
    ].join('\n'));

    const result = specFileList(workflowRoot, 'spec2');

    expect(result).toEqual({ source: 'tasks', paths: [] });
  });

  it('reads backticked decomposition paths with no tasks.md, stripping a trailing line suffix', async () => {
    const { workflowRoot } = await makeWorkflowRoot();
    await writeDecomposition(workflowRoot, [
      '### 1. `spec3` — build thing', '',
      '_Prompt: uses `src/foo/bar.ts:12-20` and `src/other.ts:5` and `src/plain.ts`._', '',
      '### 2. `otherspec` — unrelated', '',
      '_Prompt: touches `src/not-spec3.ts`_', '',
    ].join('\n'));

    const result = specFileList(workflowRoot, 'spec3');

    expect(result).toEqual({
      source: 'decomposition',
      paths: ['src/foo/bar.ts', 'src/other.ts', 'src/plain.ts'],
    });
  });

  it('drops a bare backticked token with no slash', async () => {
    const { workflowRoot } = await makeWorkflowRoot();
    await writeDecomposition(workflowRoot, [
      '### 1. `spec4` — build thing', '',
      '_Prompt: edits `tiles.tsx` and `src/kept.ts`._', '',
    ].join('\n'));

    const result = specFileList(workflowRoot, 'spec4');

    expect(result).toEqual({ source: 'decomposition', paths: ['src/kept.ts'] });
  });

  it('gives source none when no decomposition heading names the spec', async () => {
    const { workflowRoot } = await makeWorkflowRoot();
    await writeDecomposition(workflowRoot, [
      '### 1. `otherspec` — unrelated', '',
      '_Prompt: touches `src/not-spec5.ts`_', '',
    ].join('\n'));

    const result = specFileList(workflowRoot, 'spec5');

    expect(result).toEqual({ source: 'none', paths: [] });
  });
});

describe('evaluateLaunchGuard', () => {
  it('reads no-list from an empty tasks.md file list, even with a decomposition fallback present', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    await writeTasks(workflowRoot, 'spec2', [
      '# Tasks', '',
      '- [ ] 1. First',
      '  - Purpose: a thing with no file list', '',
    ].join('\n'));
    await writeDecomposition(workflowRoot, [
      '### 1. `spec2` — build thing', '',
      '_Prompt: touches `src/should-not-be-read.ts`_', '',
    ].join('\n'));
    const codeRoot = await makeCodeRoot();
    const project = guardProject('a', 'Alpha', storePath, codeRoot);

    const guard = evaluateLaunchGuard('spec2', project, [project]);

    expect(guard.state).toBe('no-list');
    expect(guard.source).toBe('tasks');
    expect(guard.listed).toBe(0);
  });

  it('reads no-list with source none when nothing gives a file list', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    await writeDecomposition(workflowRoot, [
      '### 1. `otherspec` — unrelated', '',
      '_Prompt: touches `src/not-spec5.ts`_', '',
    ].join('\n'));
    const codeRoot = await makeCodeRoot();
    const project = guardProject('a', 'Alpha', storePath, codeRoot);

    const guard = evaluateLaunchGuard('spec5', project, [project]);

    expect(guard.state).toBe('no-list');
    expect(guard.source).toBe('none');
  });

  const BAD_PATHS: Array<[string, string]> = [
    ['absolute', '/etc/passwd'],
    ['holding a .. segment', '../secret.ts'],
    ['starting with ~', '~/secret.ts'],
    ['holding whitespace', 'src/ba d.ts'],
    ['holding a *', 'src/*.ts'],
    ['holding a <', 'src/<bad>.ts'],
    ['starting with .spec-workflow/', '.spec-workflow/secret.md'],
  ];

  it.each(BAD_PATHS)('drops a path %s', async (_label, badPath) => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRoot = await makeCodeRoot();
    await touch(codeRoot, 'src/good.ts');
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles([badPath, 'src/good.ts']));
    const project = guardProject('a', 'Alpha', storePath, codeRoot);

    const guard = evaluateLaunchGuard('spec', project, [project]);

    expect(guard.listed).toBe(1);
    expect(guard.compared).toBe(1);
    expect(guard.held).toBe(1);
    expect(guard.state).toBe('clear');
  });

  it('gives no-list when every listed path is filtered out', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRoot = await makeCodeRoot();
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles(['/abs/path.ts', '../bad.ts']));
    const project = guardProject('a', 'Alpha', storePath, codeRoot);

    const guard = evaluateLaunchGuard('spec', project, [project]);

    expect(guard.listed).toBe(0);
    expect(guard.state).toBe('no-list');
    expect(guard.source).toBe('tasks');
  });

  it('drops an unheld path from compared, keeping it in listed', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRoot = await makeCodeRoot();
    await touch(codeRoot, 'src/held.ts');
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles(['src/held.ts', 'src/missing.ts']));
    const project = guardProject('a', 'Alpha', storePath, codeRoot);

    const guard = evaluateLaunchGuard('spec', project, [project]);

    expect(guard.listed).toBe(2);
    expect(guard.compared).toBe(1);
    expect(guard.held).toBe(1);
  });

  it('warns and names the project holding strictly more compared paths', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRootA = await makeCodeRoot();
    const codeRootB = await makeCodeRoot();
    await touch(codeRootA, 'src/a-only.ts');
    await touch(codeRootB, 'src/b-only-1.ts');
    await touch(codeRootB, 'src/b-only-2.ts');
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles([
      'src/a-only.ts', 'src/b-only-1.ts', 'src/b-only-2.ts',
    ]));
    const projectA = guardProject('a', 'Alpha', storePath, codeRootA);
    const projectB = guardProject('b', 'Beta', storePath, codeRootB);

    const guard = evaluateLaunchGuard('spec', projectA, [projectA, projectB]);

    expect(guard.state).toBe('warn');
    expect(guard.useProject).toBe('b');
    expect(guard.held).toBe(1);
    expect(guard.compared).toBe(3);
  });

  it('gives clear when the held counts are equal', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRootA = await makeCodeRoot();
    const codeRootB = await makeCodeRoot();
    await touch(codeRootA, 'src/a-only.ts');
    await touch(codeRootB, 'src/b-only.ts');
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles(['src/a-only.ts', 'src/b-only.ts']));
    const projectA = guardProject('a', 'Alpha', storePath, codeRootA);
    const projectB = guardProject('b', 'Beta', storePath, codeRootB);

    const guard = evaluateLaunchGuard('spec', projectA, [projectA, projectB]);

    expect(guard.state).toBe('clear');
    expect(guard.useProject).toBeUndefined();
    expect(guard.held).toBe(1);
    expect(guard.compared).toBe(2);
  });

  it('breaks a tie among the most-held holders on projectName', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRootA = await makeCodeRoot();
    const codeRootB = await makeCodeRoot();
    const codeRootC = await makeCodeRoot();
    await touch(codeRootB, 'src/b-1.ts');
    await touch(codeRootB, 'src/b-2.ts');
    await touch(codeRootC, 'src/c-1.ts');
    await touch(codeRootC, 'src/c-2.ts');
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles([
      'src/b-1.ts', 'src/b-2.ts', 'src/c-1.ts', 'src/c-2.ts',
    ]));
    const projectA = guardProject('a', 'Alpha-self', storePath, codeRootA);
    const projectB = guardProject('b', 'Zulu', storePath, codeRootB);
    const projectC = guardProject('c', 'Alpha', storePath, codeRootC);

    const guard = evaluateLaunchGuard('spec', projectA, [projectA, projectB, projectC]);

    expect(guard.state).toBe('warn');
    expect(guard.useProject).toBe('c');
  });

  it('counts a path under two roots toward both holders', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRootA = await makeCodeRoot();
    const codeRootB = await makeCodeRoot();
    await touch(codeRootA, 'src/shared.ts');
    await touch(codeRootB, 'src/shared.ts');
    await touch(codeRootB, 'src/b-only.ts');
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles(['src/shared.ts', 'src/b-only.ts']));
    const projectA = guardProject('a', 'Alpha', storePath, codeRootA);
    const projectB = guardProject('b', 'Beta', storePath, codeRootB);

    const guard = evaluateLaunchGuard('spec', projectA, [projectA, projectB]);

    expect(guard.state).toBe('warn');
    expect(guard.useProject).toBe('b');
    expect(guard.held).toBe(1);
    expect(guard.compared).toBe(2);
  });

  it('gives clear with no useProject when compared is 0', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRootA = await makeCodeRoot();
    const codeRootB = await makeCodeRoot();
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles(['src/nowhere.ts']));
    const projectA = guardProject('a', 'Alpha', storePath, codeRootA);
    const projectB = guardProject('b', 'Beta', storePath, codeRootB);

    const guard = evaluateLaunchGuard('spec', projectA, [projectA, projectB]);

    expect(guard.state).toBe('clear');
    expect(guard.useProject).toBeUndefined();
    expect(guard.compared).toBe(0);
    expect(guard.held).toBe(0);
  });

  it('reports exact listed, compared and held counts', async () => {
    const { storePath, workflowRoot } = await makeWorkflowRoot();
    const codeRootA = await makeCodeRoot();
    const codeRootB = await makeCodeRoot();
    await touch(codeRootA, 'src/a-only.ts');
    await touch(codeRootB, 'src/b-only.ts');
    await writeTasks(workflowRoot, 'spec', tasksMdWithFiles([
      '/abs/bad.ts', 'src/<bad>.ts', 'src/a-only.ts', 'src/b-only.ts', 'src/nowhere.ts',
    ]));
    const projectA = guardProject('a', 'Alpha', storePath, codeRootA);
    const projectB = guardProject('b', 'Beta', storePath, codeRootB);

    const guard = evaluateLaunchGuard('spec', projectA, [projectA, projectB]);

    expect(guard.listed).toBe(3);
    expect(guard.compared).toBe(2);
    expect(guard.held).toBe(1);
  });
});
