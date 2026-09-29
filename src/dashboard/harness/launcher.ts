// src/dashboard/harness/launcher.ts
//
// One detached, logged, recorded harness run per project (design.md C4;
// Requirement 3). `admission()` is an advisory route pre-check; `launch()` step 1
// is the atomic in-flight guard that makes two concurrent launches produce one
// run. Stop, finalise, own-exit and restore are added by task 6.
import { EventEmitter } from 'events';
import { execFile, execFileSync, spawn } from 'child_process';
import { promisify } from 'util';
import {
  openSync, closeSync, writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync,
} from 'fs';
import { join, resolve, sep } from 'path';
import {
  scrubbedGitEnv, SPEC_WORKFLOW_WORKSPACE_ENV, SPEC_WORKFLOW_SHARED_ROOT_ENV,
} from '../../core/git-utils.js';
import {
  launchesDir, logsDir, readPointer, pointerPath as defaultPointerPath,
} from './state-files.js';
import { deleteRunFileIf } from './run-setup.js';
import type { ProjectContext } from '../project-manager.js';
import type { HarnessRunFile, LaunchRecord } from './types.js';

const execFileAsync = promisify(execFile);

/** The prompt every dashboard-launched supervisor runs (docs/SDD-HARNESS.md:246-248). */
const LAUNCH_PROMPT = 'continue the sdd process';
/** Enough room for a real `npm ci` before the error detail truncates to 2,000. */
const SETUP_MAX_BUFFER = 10 * 1024 * 1024;

export type LaunchStep = 'worktree' | 'worktree-setup' | 'spawn' | 'admission';

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

export interface LauncherOptions {
  cli?: string;
  stateDir?: string;
  pointerPath?: string;
  stopGraceMs?: number;
  pollMs?: number;
  setupTimeoutMs?: number;
}

/** ISO time with the characters a filesystem may reject replaced (`:` and `.`). */
function fsSafeTime(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

export class HarnessLauncher extends EventEmitter {
  private readonly cli: string;
  private readonly pointerPathOpt: string | null;
  private readonly stopGraceMs: number;
  private readonly pollMs: number;
  private readonly setupTimeoutMs: number;

  private readonly records = new Map<string, LaunchRecord>();
  private readonly inFlight = new Set<string>();

  constructor(opts: LauncherOptions = {}) {
    super();
    this.cli = opts.cli ?? 'claude';
    this.pointerPathOpt = opts.pointerPath ?? null;
    this.stopGraceMs = opts.stopGraceMs ?? 10000;
    this.pollMs = opts.pollMs ?? 1000;
    this.setupTimeoutMs = opts.setupTimeoutMs ?? 900000;
  }

  /** The in-memory record for a project, or null. */
  get(projectId: string): LaunchRecord | null {
    return this.records.get(projectId) ?? null;
  }

  /**
   * Advisory route pre-check (Req 3 AC 7-8). Refuses while a launch is in flight
   * (the atomic guard is `launch()` step 1), then when a pointer line's resolved
   * spec dir sits under this project's specs dir, then when the project's own
   * record is live.
   */
  admission(
    project: ProjectContext,
  ): { ok: true } | { ok: false; runId: string | null; reason: string } {
    if (this.inFlight.has(project.projectId)) {
      return { ok: false, runId: null, reason: 'launch in flight' };
    }
    const specsPrefix = resolve(project.projectPath, '.spec-workflow', 'specs') + sep;
    for (const line of readPointer(this.pointerPathOpt ?? defaultPointerPath())) {
      if ((resolve(line.specDir) + sep).startsWith(specsPrefix)) {
        return { ok: false, runId: line.runId, reason: `a run is live for ${line.specDir}` };
      }
    }
    const record = this.records.get(project.projectId);
    if (record && (record.state === 'running' || record.state === 'stopping') && this.isAlive(record)) {
      return { ok: false, runId: record.runId, reason: 'a launch record is live' };
    }
    return { ok: true };
  }

  /**
   * Launch one detached supervisor for a project. Step 1 is the synchronous
   * in-flight guard, run before any await, so two concurrent calls cannot both
   * pass; the loser throws `admission` and touches nothing. Steps 2-5 build the
   * worktree, run its setup, open the log and spawn; the record is written in the
   * `spawn` handler. Any failure after step 1 deletes the run file, removes the
   * empty log and writes no record (design Error Handling 2).
   */
  async launch(
    project: ProjectContext,
    file: HarnessRunFile,
    worktreeSetup: string | null,
  ): Promise<LaunchRecord> {
    // Step 1 — atomic in-flight guard, before any await. The loser deletes no
    // file and writes no record: the run file belongs to the winner (Req 3.8).
    if (this.inFlight.has(project.projectId)) {
      throw new LaunchError('admission', 'launch in flight');
    }
    this.inFlight.add(project.projectId);

    const workflowRoot = join(project.projectPath, '.spec-workflow');
    let logPath: string | null = null;
    let fd: number | null = null;
    try {
      // Step 2-3 — worktree and its setup marker.
      const cwd = file.worktree === 'yes'
        ? await this.ensureWorktree(project, file.spec, worktreeSetup)
        : project.workspacePath;

      // Step 4 — open the log, then spawn and record.
      const launchedAt = new Date().toISOString();
      mkdirSync(logsDir(), { recursive: true });
      logPath = join(logsDir(), `${project.projectId}-${fsSafeTime(launchedAt)}.log`);
      fd = openSync(logPath, 'a');
      const record = await this.spawnRun(project, file, cwd, fd, logPath, launchedAt, workflowRoot);
      closeSync(fd);
      fd = null;
      return record;
    } catch (err) {
      // Step 5 — clean up on every failure after step 1.
      if (fd !== null) { try { closeSync(fd); } catch { /* already closed */ } }
      if (logPath !== null) { try { unlinkSync(logPath); } catch { /* never opened */ } }
      deleteRunFileIf(workflowRoot, file.writtenAt);
      throw err;
    } finally {
      this.inFlight.delete(project.projectId);
    }
  }

  /** Liveness (design D7): the process group exists and the pid still runs the prompt. */
  isAlive(record: LaunchRecord): boolean {
    try {
      process.kill(-record.pgid, 0);
    } catch {
      return false;
    }
    try {
      const out = execFileSync('ps', ['-o', 'args=', '-p', String(record.pid)], { encoding: 'utf-8' });
      return out.includes(LAUNCH_PROMPT);
    } catch {
      return false;
    }
  }

  // --- launch internals ---

  private spawnRun(
    project: ProjectContext,
    file: HarnessRunFile,
    cwd: string,
    fd: number,
    logPath: string,
    launchedAt: string,
    workflowRoot: string,
  ): Promise<LaunchRecord> {
    return new Promise((resolvePromise, rejectPromise) => {
      const args = [
        '-p', LAUNCH_PROMPT,
        '--model', file.supervisorModel,
        '--effort', 'high',
        '--permission-mode', 'auto',
      ];
      const child = spawn(this.cli, args, {
        cwd,
        detached: true,
        stdio: ['ignore', fd, fd],
        env: {
          ...scrubbedGitEnv(),
          [SPEC_WORKFLOW_WORKSPACE_ENV]: cwd,
          [SPEC_WORKFLOW_SHARED_ROOT_ENV]: project.projectPath,
        },
      });

      let settled = false;
      child.on('error', (err: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        rejectPromise(new LaunchError('spawn', err.code ?? err.message));
      });
      child.on('spawn', () => {
        if (settled) return;
        settled = true;
        // First statements, no await (carried R2-3: the only unrecorded window
        // left is the event-loop turn between spawn() and this handler).
        child.unref();
        const pid = child.pid as number;
        const record: LaunchRecord = {
          projectId: project.projectId,
          workflowRoot,
          spec: file.spec,
          pid,
          pgid: pid,
          cwd,
          worktree: file.worktree,
          logPath,
          launchedAt,
          setupWrittenAt: file.writtenAt,
          runId: null,
          state: 'running',
          exitCode: null,
          signal: null,
          stopRequestedAt: null,
          endedAt: null,
          note: null,
        };
        this.writeRecord(record);
        resolvePromise(record);
      });
    });
  }

  private writeRecord(record: LaunchRecord): void {
    this.records.set(record.projectId, record);
    const dir = launchesDir();
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${record.projectId}.json`);
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
    renameSync(tmp, path);
    this.emit('launch-update', { ...record });
  }

  /**
   * Reuse the porcelain worktree entry on `refs/heads/feat/<spec>`, else create
   * the worktree at `<checkout>/.claude/worktrees/<spec>` on that branch (design
   * D6). An unmarked worktree always re-runs its setup (Req 3.14).
   */
  private async ensureWorktree(
    project: ProjectContext,
    spec: string,
    worktreeSetup: string | null,
  ): Promise<string> {
    const workspacePath = project.workspacePath;
    const branch = `feat/${spec}`;
    const existing = await this.findWorktree(workspacePath, branch);
    let dir: string;
    if (existing) {
      dir = existing;
    } else {
      dir = join(workspacePath, '.claude', 'worktrees', spec);
      const addArgs = (await this.branchExists(workspacePath, branch))
        ? ['worktree', 'add', dir, branch]
        : ['worktree', 'add', '-b', branch, dir];
      await this.git(workspacePath, addArgs);
    }
    await this.runSetupIfNeeded(dir, worktreeSetup);
    return dir;
  }

  private async git(cwd: string, args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, { cwd, env: scrubbedGitEnv() });
      return stdout;
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stderr?: string };
      throw new LaunchError('worktree', (e.stderr || e.message || String(err)).trim());
    }
  }

  private async findWorktree(cwd: string, branch: string): Promise<string | null> {
    const out = await this.git(cwd, ['worktree', 'list', '--porcelain']);
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

  private async branchExists(cwd: string, branch: string): Promise<boolean> {
    try {
      await execFileAsync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
        cwd, env: scrubbedGitEnv(),
      });
      return true;
    } catch {
      return false;
    }
  }

  private async runSetupIfNeeded(worktreeDir: string, worktreeSetup: string | null): Promise<void> {
    const gitDir = (await this.git(worktreeDir, ['rev-parse', '--absolute-git-dir'])).trim();
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
        timeout: this.setupTimeoutMs,
        maxBuffer: SETUP_MAX_BUFFER,
      });
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      const output = ((e.stdout ?? '') + (e.stderr ?? '')).slice(-2000);
      throw new LaunchError('worktree-setup', `${e.code ?? e.message} ${output}`.trim());
    }
    writeFileSync(marker, ''); // marker only on success
  }
}
