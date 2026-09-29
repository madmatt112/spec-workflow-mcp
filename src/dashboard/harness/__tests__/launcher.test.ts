import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, chmodSync } from 'fs';
import { promises as fsp } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { HarnessLauncher, LaunchError } from '../launcher.js';
import { writeRunFile } from '../run-setup.js';
import { launchesDir, logsDir } from '../state-files.js';
import type { HarnessRunFile } from '../types.js';
import type { ProjectContext } from '../../project-manager.js';

// Contract for src/dashboard/harness/launcher.ts (design.md C4; task 5
// _Prompt; Requirements 3.1, 3.2, 3.3, 3.4, 3.7, 3.8, 3.14). Every test drives
// the real `HarnessLauncher` against a fake `cli` bash script that prints its
// argv then backgrounds `sleep 30` and `wait`s (never `exec`s), so the process
// group stays alive for the `ps` liveness check, matching the task 5 _Prompt
// "Tests" paragraph; the worktree criteria drive a real temp git repository.
// No collaborator inside launcher.ts is mocked.
//
// Criterion "record fields, pgid, log holds the argument list" (design.md C4
//   "spawn the cli option with exactly [...]", "write the record ... pgid
//   equals pid ... Records go to launchesDir()/PROJECTID.json"; task 5
//   _Prompt "Cover:"; Requirements 3.1, 3.2, 3.4):
//   Pre-condition: a project with `file.worktree` 'no' and the fake cli.
//   Test: `new HarnessLauncher({ cli: fakeCli }).launch(project, file, null)`.
//   Observable result: the resolved record's projectId, workflowRoot, spec,
//   cwd, worktree, setupWrittenAt, runId, state, exitCode, signal,
//   stopRequestedAt, endedAt and note match the task 5 _Prompt's field list;
//   `record.pgid === record.pid`; the log file at `record.logPath` contains
//   the exact flag list `-p continue the sdd process --model
//   claude-test-model --effort high --permission-mode auto`; `launcher.get`
//   returns the same record; `launchesDir()/<projectId>.json` on disk
//   deep-equals it.
//   Expected-value source: design.md C4 and the task 5 _Prompt field list.
//
// Criterion "admission refused by a pointer line inside the project, not by
//   another project's line" (design.md C4 "Admission"; task 5 _Prompt; Req 3
//   AC 7):
//   Pre-condition: a pointer file with one line whose spec dir is
//   `<theirProjectPath>/.spec-workflow/specs/their-spec` and run id
//   'run-theirs'.
//   Test: `launcher.admission(theirs)` and `launcher.admission(mine)` on the
//   same launcher/pointer file.
//   Observable result: `admission(theirs)` is `{ ok: false, runId:
//   'run-theirs', reason: <string> }`; `admission(mine)` is `{ ok: true }`.
//   Expected-value source: design.md C4 ("refuse when a pointer line's
//   resolved spec dir starts with <projectPath>/.spec-workflow/specs/ ...
//   return its run id") and task 5 _Prompt.
//
// Criterion "refused by a live record" (design.md C4 "Admission"; task 5
//   _Prompt; Req 3 AC 8):
//   Pre-condition: a project with one completed `launch()` call, whose fake
//   cli is still alive (process group).
//   Test: `launcher.admission(project)` right after `launch()` resolves.
//   Observable result: `{ ok: false, runId: record.runId, reason: <string> }`.
//   Expected-value source: design.md C4 ("else the refusal with the record's
//   run id when the project's record is running or stopping and alive").
//
// Criterion "two launch() calls in one tick give one record and one
//   LaunchError step admission, and the run file still exists" (design.md
//   C4 "Launch" step 1; task 5 _Prompt; Req 3 AC 8):
//   Pre-condition: `harness-run.json` written to the workflow root, as the
//   route layer would before calling `launch()`.
//   Test: `Promise.allSettled([launcher.launch(project, file, null),
//   launcher.launch(project, file, null)])`.
//   Observable result: exactly one settled result is fulfilled with a
//   `LaunchRecord` and exactly one is rejected with a `LaunchError` whose
//   `step` is 'admission' and `detail` is 'launch in flight'; `launcher.get`
//   returns the winner's record; `<workflowRoot>/harness-run.json` still
//   exists.
//   Expected-value source: design.md C4 ("when the project is in flight it
//   throws LaunchError step admission, detail launch in flight, and deletes
//   no file and writes no record") and the task 5 _Prompt.
//
// Criterion "admission() during an in-flight launch returns runId: null"
//   (design.md C4 "Admission"; task 5 _Prompt; Req 3 AC 8):
//   Pre-condition: an unawaited `launch()` call in progress for a project.
//   Test: `launcher.admission(project)` called synchronously right after
//   `launcher.launch(...)` (not yet awaited).
//   Observable result: `{ ok: false, runId: null, reason: 'launch in
//   flight' }`.
//   Expected-value source: task 5 _Prompt ("admission(project) ... returns
//   the refusal with runId: null and reason launch in flight while the
//   project's in-flight flag is set").
//
// Criterion "a missing cli gives step spawn with ENOENT, no record, no log
//   and no run file" (design.md C4 "Launch" step 5, Error Handling 2; task 5
//   _Prompt; Req 3 AC 14):
//   Pre-condition: `opts.cli` an absolute path that does not exist;
//   `harness-run.json` written beforehand.
//   Test: `launcher.launch(project, file, null)`.
//   Observable result: the rejection is a `LaunchError` with `step: 'spawn'`
//   and `detail: 'ENOENT'`; `launcher.get(projectId)` is null;
//   `<workflowRoot>/harness-run.json` no longer exists; `logsDir()` holds no
//   files.
//   Expected-value source: task 5 _Prompt ("An error event before spawn
//   throws LaunchError step spawn with the error code as detail. On every
//   failure after step 1: deleteRunFileIf ..., unlink the empty log, write
//   no record").
//
// Criterion "a non-git workspace gives step worktree" (design.md C4 "Launch"
//   step 2; task 5 _Prompt; Req 3 AC 3):
//   Pre-condition: `file.worktree` 'yes'; `project.workspacePath` a plain
//   temp directory with no `.git`.
//   Test: `launcher.launch(project, file, null)`.
//   Observable result: the rejection is a `LaunchError` with `step:
//   'worktree'` and a non-empty string `detail`; `launcher.get(projectId)`
//   is null.
//   Expected-value source: design.md C4 ("git through promisified execFile
//   ... reuse the porcelain worktree entry ... else git worktree add") and
//   Error Handling 2 ("Worktree, setup or spawn failure ... git stderr").
//
// Criterion "a failing setup command gives step worktree-setup, no marker,
//   and a second launch runs the setup again" (design.md C4 "Launch" step 3;
//   task 5 _Prompt; Req 3 AC 14):
//   Pre-condition: a real temp git repo at `workspacePath`; `worktreeSetup`
//   appends a line to a counter file, prints 'FAILSETUP-MARK', then exits 7.
//   Test: `launcher.launch(project, file, worktreeSetup)` twice in sequence.
//   Observable result: both calls reject with a `LaunchError` `step:
//   'worktree-setup'` whose `detail` contains '7' and 'FAILSETUP-MARK'; the
//   git dir under the worktree has no `sdd-setup-done` file after the first
//   call; the counter file holds two lines after the second call (the setup
//   ran twice, so the worktree was not skipped).
//   Expected-value source: task 5 _Prompt ("run the setup with execFile('bash',
//   ['-c', worktreeSetup]) ... write the marker only on success ... an
//   unmarked worktree re-runs the setup, never skips it") and design.md
//   Error Handling 2.
//
// Criterion "a passing setup that appends to a counter file writes the
//   marker and a second launch reuses the worktree without re-running it"
//   (design.md C4 "Launch" step 3; task 5 _Prompt; Req 3 AC 14):
//   Pre-condition: a real temp git repo at `workspacePath`; `worktreeSetup`
//   appends one line to a counter file and exits 0.
//   Test: `launcher.launch(project, file, worktreeSetup)` twice in sequence.
//   Observable result: after the first call, the git dir under the worktree
//   has a `sdd-setup-done` file and the counter file holds one line; after
//   the second call, the second record's `cwd` is the same worktree path and
//   the counter file still holds exactly one line (the setup did not run
//   again).
//   Expected-value source: task 5 _Prompt ("write the marker only on
//   success ... an unmarked worktree re-runs the setup, never skips it") and
//   design.md C4 step 2 ("Reuse the porcelain worktree entry").

const FAKE_CLI_SCRIPT = `#!/usr/bin/env bash
echo "$@"
sleep 30 &
wait
`;

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

function makeRunFile(spec: string, overrides: Partial<HarnessRunFile> = {}): HarnessRunFile {
  return {
    spec,
    writtenAt: new Date().toISOString(),
    supervisorModel: 'claude-test-model',
    worktree: 'no',
    gates: 'record',
    roles: {},
    ...overrides,
  };
}

async function catchLaunchError(
  launcher: HarnessLauncher,
  project: ProjectContext,
  file: HarnessRunFile,
  worktreeSetup: string | null,
): Promise<LaunchError> {
  try {
    await launcher.launch(project, file, worktreeSetup);
  } catch (e) {
    return e as LaunchError;
  }
  throw new Error('expected launch() to reject');
}

describe('HarnessLauncher', () => {
  const originalEnv = { ...process.env };
  let base: string;
  let fakeCli: string;
  let pgidsToKill: number[];

  beforeEach(async () => {
    base = await fsp.mkdtemp(join(tmpdir(), 'launcher-test-'));
    process.env.SPEC_WORKFLOW_HOME = join(base, 'home');
    process.env.XDG_STATE_HOME = join(base, 'xdg');
    mkdirSync(process.env.SPEC_WORKFLOW_HOME, { recursive: true });
    mkdirSync(process.env.XDG_STATE_HOME, { recursive: true });
    fakeCli = join(base, 'fake-cli.sh');
    writeFileSync(fakeCli, FAKE_CLI_SCRIPT);
    chmodSync(fakeCli, 0o755);
    pgidsToKill = [];
  });

  afterEach(async () => {
    for (const pgid of pgidsToKill) {
      try {
        process.kill(-pgid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
    process.env = { ...originalEnv };
    await fsp.rm(base, { recursive: true, force: true });
  });

  async function makeProject(): Promise<{ project: ProjectContext; projectPath: string; workflowRoot: string }> {
    const projectPath = await fsp.mkdtemp(join(base, 'proj-'));
    const workflowRoot = join(projectPath, '.spec-workflow');
    await fsp.mkdir(join(workflowRoot, 'specs'), { recursive: true });
    const project = {
      projectId: randomUUID(),
      projectPath,
      workspacePath: projectPath,
    } as ProjectContext;
    return { project, projectPath, workflowRoot };
  }

  it('records pid, pgid, cwd and writes the argument list to the log', async () => {
    const { project, workflowRoot } = await makeProject();
    const file = makeRunFile('demo-spec', { worktree: 'no' });
    const launcher = new HarnessLauncher({ cli: fakeCli });

    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    expect(record).toMatchObject({
      projectId: project.projectId,
      workflowRoot,
      spec: 'demo-spec',
      cwd: project.workspacePath,
      worktree: 'no',
      setupWrittenAt: file.writtenAt,
      runId: null,
      state: 'running',
      exitCode: null,
      signal: null,
      stopRequestedAt: null,
      endedAt: null,
      note: null,
    });
    expect(record.pgid).toBe(record.pid);
    expect(typeof record.pid).toBe('number');

    expect(existsSync(record.logPath)).toBe(true);
    const logText = readFileSync(record.logPath, 'utf-8');
    expect(logText).toContain(
      '-p continue the sdd process --model claude-test-model --effort high --permission-mode auto',
    );

    expect(launcher.get(project.projectId)).toEqual(record);

    const onDisk = JSON.parse(readFileSync(join(launchesDir(), `${project.projectId}.json`), 'utf-8'));
    expect(onDisk).toEqual(record);
  });

  it("admission is refused by a pointer line inside the project, and unaffected by another project's line", async () => {
    const { project: mine } = await makeProject();
    const { project: theirs, projectPath: theirPath } = await makeProject();
    const pointerFile = join(base, 'pointer');
    const theirSpecDir = join(theirPath, '.spec-workflow', 'specs', 'their-spec');
    writeFileSync(pointerFile, `main\t${theirSpecDir}\trun-theirs\n`);
    const launcher = new HarnessLauncher({ cli: fakeCli, pointerPath: pointerFile });

    expect(launcher.admission(theirs)).toEqual({ ok: false, runId: 'run-theirs', reason: expect.any(String) });
    expect(launcher.admission(mine)).toEqual({ ok: true });
  });

  it('admission is refused by a live launch record', async () => {
    const { project } = await makeProject();
    const launcher = new HarnessLauncher({ cli: fakeCli });
    const file = makeRunFile('demo-spec');

    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    expect(launcher.admission(project)).toEqual({ ok: false, runId: record.runId, reason: expect.any(String) });
  });

  it('two launch() calls in one tick give one record and one admission LaunchError, and the run file survives', async () => {
    const { project, workflowRoot } = await makeProject();
    const file = makeRunFile('demo-spec');
    writeRunFile(workflowRoot, file);
    const launcher = new HarnessLauncher({ cli: fakeCli });

    const results = await Promise.allSettled([
      launcher.launch(project, file, null),
      launcher.launch(project, file, null),
    ]);

    const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winner = fulfilled[0].value;
    pgidsToKill.push(winner.pgid);
    const err = rejected[0].reason;
    expect(err).toBeInstanceOf(LaunchError);
    expect(err.step).toBe('admission');
    expect(err.detail).toBe('launch in flight');

    expect(launcher.get(project.projectId)).toEqual(winner);
    expect(existsSync(join(workflowRoot, 'harness-run.json'))).toBe(true);
  });

  it('admission() during an in-flight launch returns runId: null', async () => {
    const { project } = await makeProject();
    const file = makeRunFile('demo-spec');
    const launcher = new HarnessLauncher({ cli: fakeCli });

    const pending = launcher.launch(project, file, null);
    expect(launcher.admission(project)).toEqual({ ok: false, runId: null, reason: 'launch in flight' });

    const record = await pending;
    pgidsToKill.push(record.pgid);
  });

  it('a missing cli gives step spawn with ENOENT, no record, no log and no run file', async () => {
    const { project, workflowRoot } = await makeProject();
    const file = makeRunFile('demo-spec');
    writeRunFile(workflowRoot, file);
    const launcher = new HarnessLauncher({ cli: join(base, 'does-not-exist-cli') });

    await expect(launcher.launch(project, file, null)).rejects.toMatchObject({
      step: 'spawn',
      detail: 'ENOENT',
    });

    expect(launcher.get(project.projectId)).toBeNull();
    expect(existsSync(join(workflowRoot, 'harness-run.json'))).toBe(false);
    const logs = existsSync(logsDir()) ? readdirSync(logsDir()) : [];
    expect(logs).toHaveLength(0);
  });

  it('a non-git workspace gives step worktree', async () => {
    const { project } = await makeProject();
    const file = makeRunFile('demo-spec', { worktree: 'yes' });
    const launcher = new HarnessLauncher({ cli: fakeCli });

    const err = await catchLaunchError(launcher, project, file, null);
    expect(err.step).toBe('worktree');
    expect(typeof err.detail).toBe('string');
    expect(err.detail.length).toBeGreaterThan(0);
    expect(launcher.get(project.projectId)).toBeNull();
  });

  it('a failing setup command gives step worktree-setup, no marker, and a second launch runs the setup again', async () => {
    const { project } = await makeProject();
    initGitRepo(project.workspacePath);
    const counterFile = join(base, 'setup-counter-fail.txt');
    const worktreeSetup = `echo run >> ${counterFile}; echo FAILSETUP-MARK; exit 7`;
    const file = makeRunFile('demo-spec', { worktree: 'yes' });
    const launcher = new HarnessLauncher({ cli: fakeCli });

    const err1 = await catchLaunchError(launcher, project, file, worktreeSetup);
    expect(err1.step).toBe('worktree-setup');
    expect(err1.detail).toContain('7');
    expect(err1.detail).toContain('FAILSETUP-MARK');

    const worktreePath = join(project.workspacePath, '.claude', 'worktrees', 'demo-spec');
    const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();
    expect(existsSync(join(gitDir, 'sdd-setup-done'))).toBe(false);

    const err2 = await catchLaunchError(launcher, project, file, worktreeSetup);
    expect(err2.step).toBe('worktree-setup');

    const lines = readFileSync(counterFile, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it('a passing setup writes the marker; a second launch reuses the worktree without re-running it', async () => {
    const { project } = await makeProject();
    initGitRepo(project.workspacePath);
    const counterFile = join(base, 'setup-counter-pass.txt');
    const worktreeSetup = `echo run >> ${counterFile}`;
    const file = makeRunFile('demo-spec', { worktree: 'yes' });
    const launcher = new HarnessLauncher({ cli: fakeCli });

    const record1 = await launcher.launch(project, file, worktreeSetup);
    pgidsToKill.push(record1.pgid);

    const worktreePath = join(project.workspacePath, '.claude', 'worktrees', 'demo-spec');
    const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();
    expect(existsSync(join(gitDir, 'sdd-setup-done'))).toBe(true);
    expect(readFileSync(counterFile, 'utf-8').trim().split('\n').filter(Boolean)).toHaveLength(1);

    const record2 = await launcher.launch(project, file, worktreeSetup);
    pgidsToKill.push(record2.pgid);

    expect(record2.cwd).toBe(worktreePath);
    expect(readFileSync(counterFile, 'utf-8').trim().split('\n').filter(Boolean)).toHaveLength(1);
  });
});
