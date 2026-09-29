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
import type { HarnessRunFile, LaunchRecord } from '../types.js';
import type { ProjectContext } from '../../project-manager.js';

// Contract additions for task 6 (design.md C4 "Stop", "Finalise", "Own exit",
// "Run id"; task 6 _Prompt; Requirements 3.6, 3.9, 3.10, 3.11, 3.12, 3.13). Every
// test below drives the real `HarnessLauncher` against a fake `cli` bash script
// (no collaborator inside launcher.ts is mocked); the "ignore TERM" and
// "self-exit" scripts are new fixtures alongside task 5's `FAKE_CLI_SCRIPT`.
//
// Criterion "own exit sets exited, exitCode, signal and endedAt, writes and
//   emits, and touches no ledger or pointer" (design.md C4 "Own exit"; task 6
//   _Prompt "Tests" item 6; Req 3.11):
//   Pre-condition: a launched child that exits on its own with code 7 (no stop
//   requested); a ledger file and a pointer line pre-populated with unrelated
//   content.
//   Test: `launcher.launch(project, file, null)`, then wait for
//   `launcher.get(projectId).state === 'exited'`.
//   Observable result: `state` `'exited'`, `exitCode` `7`, `signal` `null`,
//   `endedAt` a string; the on-disk record equals the in-memory one; the
//   ledger file and pointer file are byte-for-byte unchanged.
//   Expected-value source: task 6 _Prompt ("an exit with no stop requested
//   sets state exited, exitCode, signal and endedAt ... and touches no ledger
//   or pointer") and design.md C4 "Own exit".
//
// Criterion "stop() rejects with an Error when there is no record in running
//   or stopping state" (task 6 _Prompt; Req 3.10):
//   Pre-condition: a fresh launcher with no launch for the project id.
//   Test: `launcher.stop('no-such-project')`.
//   Observable result: the call rejects with an `Error`.
//   Expected-value source: task 6 _Prompt ("stop(projectId) rejects with an
//   Error when there is no record in running or stopping state").
//
// Criterion "a second stop() call while a stop is pending returns the same
//   pending promise" (design.md tasks D13; task 6 _Prompt; Req 3.10):
//   Pre-condition: a launched child that ignores SIGTERM, so the first
//   `stop()` call has not yet resolved.
//   Test: call `launcher.stop(projectId)` twice without awaiting the first.
//   Observable result: the second call's return value `===` the first call's
//   return value (`toBe`); both resolve to the same finalised record.
//   Expected-value source: task 6 _Prompt ("a second call while a stop is
//   pending returns the pending promise (tasks D13; Req 3.10)").
//
// Criterion "stop() on a child that honours TERM sends only SIGTERM,
//   transitions stopping then stopped, and finishes well under the grace
//   period" (design.md C4 "Stop"; task 6 _Prompt "Tests" item 1; Req 3.9):
//   Pre-condition: a launched child using task 5's `FAKE_CLI_SCRIPT`, which
//   dies on SIGTERM; `stopGraceMs: 5000`.
//   Test: `launcher.stop(projectId)`, having subscribed to `launch-update`
//   first.
//   Observable result: the resolved record's `state` is `'stopped'`; elapsed
//   time is well under `stopGraceMs`; an emitted update has `state`
//   `'stopping'` with a string `stopRequestedAt`; the last emitted update has
//   `state` `'stopped'` with a string `endedAt`.
//   Expected-value source: design.md C4 ("state: 'stopping', SIGTERM to
//   -pgid, poll every pollMs, SIGKILL ... if alive after stopGraceMs,
//   finalise once gone") and task 6 _Prompt Tests item 1 ("a fake that
//   honours TERM ends with no SIGKILL").
//
// Criterion "stop() sends SIGKILL after the grace period when the group
//   ignores SIGTERM" (design.md C4 "Stop"; task 6 _Prompt "Tests" item 2;
//   Req 3.9):
//   Pre-condition: a launched child that traps and ignores SIGTERM;
//   `stopGraceMs: 300`, `pollMs: 30`.
//   Test: `launcher.stop(projectId)`.
//   Observable result: the resolved record's `state` is `'stopped'`; elapsed
//   time is at least 300 ms; `process.kill(-record.pgid, 0)` now throws
//   (the group is gone).
//   Expected-value source: task 6 _Prompt Tests item 2 ("a fake with trap ''
//   TERM and a 300 ms grace is killed") and design.md C4 ("SIGKILL to -pgid
//   if alive after stopGraceMs").
//
// Criterion "finalise appends one run.end for the run's run.start and
//   removes only its own pointer line" (design.md C4 "Finalise" steps 2-3;
//   task 6 _Prompt "Tests" item 3; Req 3.10, 3.13):
//   Pre-condition: a launched record with `noteRunId` set to a known run id;
//   a ledger holding that run's `run.start`; a pointer file with two lines,
//   one for this run and one for another.
//   Test: `launcher.stop(projectId)`.
//   Observable result: the ledger gains exactly one new line, `{ run,
//   spec: 'demo-spec', type: 'run.end', status: 'stopped from the
//   dashboard' }`; the pointer file keeps exactly the other line.
//   Expected-value source: design.md C4 ("append { ts, run, spec, type:
//   'run.end', status: 'stopped from the dashboard' } ... removePointerLine
//   for that run id") and harness/skills/sdd-continue/references/formats.md:178.
//
// Criterion "finalise is idempotent: a second restore over an
//   already-finalised run appends no duplicate run.end" (design.md C4
//   "Finalise (... idempotent)"; task 6 _Prompt "Tests" item 4; Req 3.10):
//   Pre-condition: a crafted dead record (pid the test process, so `isAlive`
//   is false) whose run has a `run.start` in the ledger and a pointer line;
//   one `restore()` finalises it; the persisted record file is then rewritten
//   back to `running` to force a second finalise attempt.
//   Test: `restore()` on two successive `HarnessLauncher` instances over the
//   same directories.
//   Observable result: the ledger holds exactly one `run.end` line after
//   both restores, not two.
//   Expected-value source: task 6 _Prompt Tests item 4 ("a second finalise
//   adds nothing") and design.md C4 "Finalise (Req 3 AC 10; idempotent)".
//
// Criterion "finalise spares a newer setup file written after launch"
//   (design.md C4 "Finalise" step 4, D14; task 6 _Prompt "Tests" item 5;
//   Req 3.10):
//   Pre-condition: a launched record; after launch, a new `harness-run.json`
//   with a later `writtenAt` is written to the workflow root (a setup saved
//   for the next run).
//   Test: `launcher.stop(projectId)`.
//   Observable result: `harness-run.json` still exists after stop, with the
//   newer `writtenAt` unchanged.
//   Expected-value source: task 6 _Prompt Tests item 5 ("deleteRunFileIf
//   spares a newer file") and design.md D14 ("Finalisation deletes the setup
//   file only when its written-at time matches").
//
// Criterion "finalise with no run id found skips the ledger and pointer
//   steps" (design.md C4 "Finalise" step 1; task 6 _Prompt; Req 3.10):
//   Pre-condition: a launched record with no `noteRunId` call, no ledger file
//   for the spec, and no pointer line.
//   Test: `launcher.stop(projectId)`.
//   Observable result: the call resolves with `state: 'stopped'` and neither
//   the ledger file nor the pointer file is created.
//   Expected-value source: task 6 _Prompt ("With no run id found, skip the
//   ledger and pointer steps").
//
// Criterion "restore() reattaches a live record (whose stop then works) and
//   finalises a dead record with a note, in one pass" (design.md C4
//   "restore()"; task 6 _Prompt "Tests" item 7; Req 3.12):
//   Pre-condition: one launched (alive) record for one project; one crafted
//   record for another project whose pid is the test process (so the `ps`
//   liveness check fails); both records on disk under the same `launchesDir`.
//   Test: `restore()` on a new `HarnessLauncher` instance over the same
//   directories, then `stop()` on the reattached project.
//   Observable result: the live project reattaches with `state: 'running'`
//   and the same `pid`, and its subsequent `stop()` resolves `'stopped'`; the
//   dead project's record is `state: 'stopped'` with `note: 'found gone
//   after dashboard restart'`.
//   Expected-value source: task 6 _Prompt ("a running or stopping record
//   that is alive stays in memory ... a record that is not alive gets note
//   'found gone after dashboard restart' and finalises") and Tests item 7.
//
// Criterion "restore() skips a missing launches directory and a malformed
//   record file, without throwing" (task 6 _Prompt "restore()"; Req 3.12):
//   Pre-condition: no `launchesDir()` on disk; then a directory holding one
//   unparsable JSON file.
//   Test: `launcher.restore()` in each situation.
//   Observable result: both calls resolve without throwing.
//   Expected-value source: task 6 _Prompt ("reads every JSON file in
//   launchesDir() (a missing dir or a bad file is skipped)").
//
// Criterion "noteRunId sets, writes and emits once for a value, and not
//   again for a repeat of the same value" (design.md C4 "Run id"; task 6
//   _Prompt "Tests" item 8; Req 3.6):
//   Pre-condition: a launched record with `runId: null`.
//   Test: `launcher.noteRunId(projectId, runId)` called twice with the same
//   `runId`, counting `launch-update` emissions.
//   Observable result: exactly one emission total; `launcher.get(projectId)`
//   and the on-disk record both show the new `runId` after the first call.
//   Expected-value source: design.md C4 ("noteRunId sets, writes and emits
//   only when the value changes") and task 6 _Prompt Tests item 8.

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

// Traps and ignores SIGTERM at the group leader, so only SIGKILL ends it
// (task 6 _Prompt Tests item 2).
const IGNORE_TERM_CLI_SCRIPT = `#!/usr/bin/env bash
trap '' TERM
echo "$@"
while true; do sleep 0.2; done
`;

// Exits on its own with a known code, no stop involved (task 6 _Prompt Tests
// item 6).
const SELF_EXIT_CLI_SCRIPT = `#!/usr/bin/env bash
echo "$@"
exit 7
`;

async function waitFor(predicate: () => boolean, timeoutMs = 3000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor: timed out');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

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
    // The detached child writes its argv to the log asynchronously, after the
    // `spawn` event resolves launch(); node 20 does not guarantee that write has
    // landed by then (agent-rules.md:31-33), so wait for the log to hold it.
    const wantArgs =
      '-p continue the sdd process --model claude-test-model --effort high --permission-mode auto';
    await waitFor(() => readFileSync(record.logPath, 'utf-8').includes(wantArgs));
    expect(readFileSync(record.logPath, 'utf-8')).toContain(wantArgs);

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

  it('the child exiting on its own sets exited, exitCode and endedAt, and touches no ledger or pointer', async () => {
    const { project, workflowRoot } = await makeProject();
    const selfExitCli = join(base, 'self-exit-cli.sh');
    writeFileSync(selfExitCli, SELF_EXIT_CLI_SCRIPT);
    chmodSync(selfExitCli, 0o755);
    const file = makeRunFile('demo-spec');
    const pointerFile = join(base, 'pointer-t1');
    const specDir = join(workflowRoot, 'specs', 'demo-spec');
    mkdirSync(specDir, { recursive: true });
    const ledgerPath = join(specDir, 'harness-events.jsonl');
    const ledgerBefore = JSON.stringify({
      ts: new Date().toISOString(), run: 'run-unrelated', spec: 'demo-spec', type: 'run.start',
    }) + '\n';
    writeFileSync(ledgerPath, ledgerBefore);
    const pointerBefore = `main\t${specDir}\trun-unrelated\n`;
    writeFileSync(pointerFile, pointerBefore);

    const launcher = new HarnessLauncher({ cli: selfExitCli, pointerPath: pointerFile });
    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    await waitFor(() => launcher.get(project.projectId)?.state === 'exited');

    const final = launcher.get(project.projectId) as LaunchRecord;
    expect(final.state).toBe('exited');
    expect(final.exitCode).toBe(7);
    expect(final.signal).toBeNull();
    expect(typeof final.endedAt).toBe('string');

    const onDisk = JSON.parse(readFileSync(join(launchesDir(), `${project.projectId}.json`), 'utf-8'));
    expect(onDisk).toEqual(final);

    expect(readFileSync(ledgerPath, 'utf-8')).toBe(ledgerBefore);
    expect(readFileSync(pointerFile, 'utf-8')).toBe(pointerBefore);
  });

  it('stop() rejects with an Error when there is no record in running or stopping state', async () => {
    const launcher = new HarnessLauncher({ cli: fakeCli });
    await expect(launcher.stop('no-such-project')).rejects.toBeInstanceOf(Error);
  });

  it('a second stop() call while a stop is pending returns the same pending promise', async () => {
    const { project } = await makeProject();
    const ignoreTermCli = join(base, 'ignore-term-cli-pending.sh');
    writeFileSync(ignoreTermCli, IGNORE_TERM_CLI_SCRIPT);
    chmodSync(ignoreTermCli, 0o755);
    const file = makeRunFile('demo-spec');
    const launcher = new HarnessLauncher({ cli: ignoreTermCli, stopGraceMs: 300, pollMs: 30 });

    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    const first = launcher.stop(project.projectId);
    const second = launcher.stop(project.projectId);
    expect(second).toBe(first);

    const resolved = await first;
    expect(resolved.state).toBe('stopped');
  });

  it('stop() on a child that honours TERM sends only SIGTERM, and finishes well under the grace period', async () => {
    const { project } = await makeProject();
    const file = makeRunFile('demo-spec');
    const launcher = new HarnessLauncher({ cli: fakeCli, stopGraceMs: 5000, pollMs: 30 });
    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    const events: LaunchRecord[] = [];
    launcher.on('launch-update', (rec: LaunchRecord) => {
      if (rec.projectId === project.projectId) events.push(rec);
    });

    const start = Date.now();
    const result = await launcher.stop(project.projectId);
    const elapsed = Date.now() - start;

    expect(result.state).toBe('stopped');
    expect(elapsed).toBeLessThan(2000);
    const stoppingEvent = events.find((e) => e.state === 'stopping');
    expect(stoppingEvent).toBeDefined();
    expect(typeof stoppingEvent?.stopRequestedAt).toBe('string');
    const lastEvent = events[events.length - 1];
    expect(lastEvent.state).toBe('stopped');
    expect(typeof lastEvent.endedAt).toBe('string');
  });

  it('stop() sends SIGKILL after the grace period when the group ignores SIGTERM', async () => {
    const { project } = await makeProject();
    const ignoreTermCli = join(base, 'ignore-term-cli-kill.sh');
    writeFileSync(ignoreTermCli, IGNORE_TERM_CLI_SCRIPT);
    chmodSync(ignoreTermCli, 0o755);
    const file = makeRunFile('demo-spec');
    const launcher = new HarnessLauncher({ cli: ignoreTermCli, stopGraceMs: 300, pollMs: 30 });
    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    const start = Date.now();
    const result = await launcher.stop(project.projectId);
    const elapsed = Date.now() - start;

    expect(result.state).toBe('stopped');
    expect(elapsed).toBeGreaterThanOrEqual(300);
    expect(() => process.kill(-record.pgid, 0)).toThrow();
  });

  it("finalise appends one run.end for the run's run.start and removes only its own pointer line", async () => {
    const { project, workflowRoot } = await makeProject();
    const file = makeRunFile('demo-spec');
    const pointerFile = join(base, 'pointer-t6');
    const launcher = new HarnessLauncher({
      cli: fakeCli, stopGraceMs: 2000, pollMs: 30, pointerPath: pointerFile,
    });
    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    const runId = 'run-20260101-010101';
    launcher.noteRunId(project.projectId, runId);

    const specDir = join(workflowRoot, 'specs', 'demo-spec');
    mkdirSync(specDir, { recursive: true });
    const ledgerPath = join(specDir, 'harness-events.jsonl');
    writeFileSync(ledgerPath, JSON.stringify({
      ts: new Date().toISOString(), run: runId, spec: 'demo-spec', type: 'run.start',
    }) + '\n');

    const otherSpecDir = join(workflowRoot, 'specs', 'other-spec');
    writeFileSync(pointerFile, `main\t${specDir}\t${runId}\nmain\t${otherSpecDir}\trun-other\n`);

    await launcher.stop(project.projectId);

    const ledgerLines = readFileSync(ledgerPath, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(ledgerLines).toHaveLength(2);
    expect(ledgerLines[1]).toMatchObject({
      run: runId, spec: 'demo-spec', type: 'run.end', status: 'stopped from the dashboard',
    });

    const pointerLines = readFileSync(pointerFile, 'utf-8').trim().split('\n').filter(Boolean);
    expect(pointerLines).toHaveLength(1);
    expect(pointerLines[0]).toBe(`main\t${otherSpecDir}\trun-other`);
  });

  it('finalise is idempotent: a second restore over an already-finalised run appends no duplicate run.end', async () => {
    const { project, workflowRoot } = await makeProject();
    const specDir = join(workflowRoot, 'specs', 'demo-spec');
    mkdirSync(specDir, { recursive: true });
    const ledgerPath = join(specDir, 'harness-events.jsonl');
    const runId = 'run-20260101-030303';
    writeFileSync(ledgerPath, JSON.stringify({
      ts: new Date().toISOString(), run: runId, spec: 'demo-spec', type: 'run.start',
    }) + '\n');

    const pointerFile = join(base, 'pointer-t7');
    writeFileSync(pointerFile, `main\t${specDir}\t${runId}\n`);

    mkdirSync(launchesDir(), { recursive: true });
    const recordPath = join(launchesDir(), `${project.projectId}.json`);
    const deadRecord = {
      projectId: project.projectId, workflowRoot, spec: 'demo-spec',
      pid: process.pid, pgid: process.pid, cwd: project.workspacePath, worktree: 'no',
      logPath: join(base, 'dead-t7.log'), launchedAt: new Date().toISOString(),
      setupWrittenAt: new Date().toISOString(), runId,
      state: 'running', exitCode: null, signal: null,
      stopRequestedAt: null, endedAt: null, note: null,
    };
    writeFileSync(recordPath, JSON.stringify(deadRecord, null, 2) + '\n');

    const launcherA = new HarnessLauncher({ cli: fakeCli, pointerPath: pointerFile });
    await launcherA.restore();
    expect(launcherA.get(project.projectId)?.state).toBe('stopped');

    const linesAfterFirst = readFileSync(ledgerPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(linesAfterFirst).toHaveLength(2);

    // Force a second finalise attempt over the same run: rewrite the
    // persisted record back to 'running' (design.md C4 "Finalise ...
    // idempotent").
    writeFileSync(recordPath, JSON.stringify({ ...deadRecord, state: 'running' }, null, 2) + '\n');

    const launcherB = new HarnessLauncher({ cli: fakeCli, pointerPath: pointerFile });
    await launcherB.restore();

    const linesAfterSecond = readFileSync(ledgerPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(linesAfterSecond).toHaveLength(2);
  });

  it('finalise spares a newer setup file written after launch', async () => {
    const { project, workflowRoot } = await makeProject();
    const file = makeRunFile('demo-spec');
    const launcher = new HarnessLauncher({ cli: fakeCli, stopGraceMs: 2000, pollMs: 30 });
    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    const newerFile = makeRunFile('demo-spec', { writtenAt: new Date(Date.now() + 60000).toISOString() });
    writeRunFile(workflowRoot, newerFile);

    await launcher.stop(project.projectId);

    expect(existsSync(join(workflowRoot, 'harness-run.json'))).toBe(true);
    const onDisk = JSON.parse(readFileSync(join(workflowRoot, 'harness-run.json'), 'utf-8'));
    expect(onDisk.writtenAt).toBe(newerFile.writtenAt);
  });

  it('finalise with no run id found skips the ledger and pointer steps', async () => {
    const { project, workflowRoot } = await makeProject();
    const file = makeRunFile('demo-spec');
    const pointerFile = join(base, 'pointer-t9');
    const launcher = new HarnessLauncher({
      cli: fakeCli, stopGraceMs: 2000, pollMs: 30, pointerPath: pointerFile,
    });
    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    const specDir = join(workflowRoot, 'specs', 'demo-spec');

    const result = await launcher.stop(project.projectId);

    expect(result.state).toBe('stopped');
    expect(existsSync(join(specDir, 'harness-events.jsonl'))).toBe(false);
    expect(existsSync(pointerFile)).toBe(false);
  });

  it('restore() reattaches a live record (whose stop then works) and finalises a dead record with a note, in one pass', async () => {
    const { project: liveProject } = await makeProject();
    const { project: deadProject, workflowRoot: deadRoot } = await makeProject();
    const file = makeRunFile('demo-spec');
    const launcherA = new HarnessLauncher({ cli: fakeCli, stopGraceMs: 2000, pollMs: 30 });
    const liveRecord = await launcherA.launch(liveProject, file, null);
    pgidsToKill.push(liveRecord.pgid);

    mkdirSync(launchesDir(), { recursive: true });
    const deadRecord = {
      projectId: deadProject.projectId, workflowRoot: deadRoot, spec: 'demo-spec',
      pid: process.pid, pgid: process.pid, cwd: deadProject.workspacePath, worktree: 'no',
      logPath: join(base, 'dead-t10.log'), launchedAt: new Date().toISOString(),
      setupWrittenAt: new Date().toISOString(), runId: null,
      state: 'running', exitCode: null, signal: null,
      stopRequestedAt: null, endedAt: null, note: null,
    };
    writeFileSync(join(launchesDir(), `${deadProject.projectId}.json`), JSON.stringify(deadRecord, null, 2) + '\n');

    const launcherB = new HarnessLauncher({ cli: fakeCli, stopGraceMs: 2000, pollMs: 30 });
    await launcherB.restore();

    expect(launcherB.get(liveProject.projectId)).toMatchObject({ state: 'running', pid: liveRecord.pid });
    const stopped = await launcherB.stop(liveProject.projectId);
    expect(stopped.state).toBe('stopped');

    const deadAfter = launcherB.get(deadProject.projectId);
    expect(deadAfter?.state).toBe('stopped');
    expect(deadAfter?.note).toBe('found gone after dashboard restart');
  });

  it('restore() skips a missing launches directory and a malformed record file, without throwing', async () => {
    const { project } = await makeProject();
    const launcherA = new HarnessLauncher({ cli: fakeCli });
    await expect(launcherA.restore()).resolves.toBeUndefined();
    expect(launcherA.get(project.projectId)).toBeNull();

    mkdirSync(launchesDir(), { recursive: true });
    writeFileSync(join(launchesDir(), 'not-json.json'), '{ this is not json');

    const launcherB = new HarnessLauncher({ cli: fakeCli });
    await expect(launcherB.restore()).resolves.toBeUndefined();
  });

  it('noteRunId sets, writes and emits once for a value, and not again for a repeat of the same value', async () => {
    const { project } = await makeProject();
    const file = makeRunFile('demo-spec');
    const launcher = new HarnessLauncher({ cli: fakeCli });
    const record = await launcher.launch(project, file, null);
    pgidsToKill.push(record.pgid);

    const events: LaunchRecord[] = [];
    launcher.on('launch-update', (rec: LaunchRecord) => {
      if (rec.projectId === project.projectId) events.push(rec);
    });

    launcher.noteRunId(project.projectId, 'run-20260101-020202');
    expect(events).toHaveLength(1);
    expect(launcher.get(project.projectId)?.runId).toBe('run-20260101-020202');
    const onDisk = JSON.parse(readFileSync(join(launchesDir(), `${project.projectId}.json`), 'utf-8'));
    expect(onDisk.runId).toBe('run-20260101-020202');

    launcher.noteRunId(project.projectId, 'run-20260101-020202');
    expect(events).toHaveLength(1);
  });
});
