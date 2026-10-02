// src/dashboard/harness/launcher.ts
//
// One detached, logged, recorded harness run per project (design.md C4;
// Requirement 3). `admission()` is an advisory route pre-check; `launch()` step 1
// is the atomic in-flight guard that makes two concurrent launches produce one
// run. `stop()`, `finalise`, own-exit and `restore()` follow design C4.
import { EventEmitter } from 'events';
import { execFile, execFileSync, spawn } from 'child_process';
import { promisify } from 'util';
import {
  openSync, closeSync, writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync,
  readFileSync, readdirSync, appendFileSync,
} from 'fs';
import { join, resolve, sep } from 'path';
import {
  scrubbedGitEnv, SPEC_WORKFLOW_WORKSPACE_ENV, SPEC_WORKFLOW_SHARED_ROOT_ENV,
} from '../../core/git-utils.js';
import {
  launchesDir, logsDir, readPointer, removePointerLine, pointerPath as defaultPointerPath,
} from './state-files.js';
import { deleteRunFileIf } from './run-setup.js';
import { parseJsonl } from '../../watch/ledger.js';
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

/** One ledger row of harness-events.jsonl (the fields finalise reads/writes). */
interface LedgerEvent { ts?: string; run?: string; spec?: string; type?: string; status?: string }

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readTextIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return undefined;
  }
}

/** UTC epoch ms of a `run-YYYYMMDD-HHMMSS` id, or null when it is not that form. */
function runIdTime(runId: string): number | null {
  const m = /^run-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(runId);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

export class HarnessLauncher extends EventEmitter {
  private readonly cli: string;
  private readonly pointerPathOpt: string | null;
  private readonly stopGraceMs: number;
  private readonly pollMs: number;
  private readonly setupTimeoutMs: number;

  private readonly records = new Map<string, LaunchRecord>();
  private readonly inFlight = new Set<string>();
  private readonly pending = new Map<string, Promise<LaunchRecord>>();
  private readonly livenessTimers = new Map<string, NodeJS.Timeout>();

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
  ): { ok: true } | { ok: false; runId: string | null; reason: string; pid?: number } {
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
      // Name the live launch PID: in the ~40 s before `run.start` lands the
      // pointer line, `runId` is still null, so the PID is the only identifier
      // the page can show for the run it refused to double-launch (retro P6).
      return { ok: false, runId: record.runId, reason: 'a launch record is live', pid: record.pid };
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

  /**
   * Reattach the launches on disk after a dashboard restart (design C4
   * `restore()`; Req 3 AC 12). A missing directory or an unparsable file is
   * skipped. A live `running` record stays in memory under a liveness poll; a
   * live `stopping` record resumes its stop at the signal step; a record that is
   * no longer alive gets the restart note and is finalised at once. Other states
   * load unchanged.
   */
  async restore(): Promise<void> {
    let files: string[];
    try {
      files = readdirSync(launchesDir());
    } catch {
      return; // no launches directory yet
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      let record: LaunchRecord;
      try {
        record = JSON.parse(readFileSync(join(launchesDir(), file), 'utf-8')) as LaunchRecord;
      } catch {
        continue; // an unparsable record file is skipped
      }
      if (!record || typeof record.projectId !== 'string') continue;
      this.records.set(record.projectId, record);
      if (record.state !== 'running' && record.state !== 'stopping') continue;
      if (!this.isAlive(record)) {
        record.note = 'found gone after dashboard restart';
        this.finalise(record);
      } else if (record.state === 'stopping') {
        this.trackPending(record.projectId, this.signalAndFinalise(record));
      } else {
        this.armLivenessPoll(record);
      }
    }
  }

  /**
   * Stop the run for a project (design C4 "Stop"; Req 3 AC 9-10). Rejects when no
   * record is `running` or `stopping` (task 10 maps that to 404). A second call
   * while a stop is pending returns the same promise (tasks D13).
   */
  stop(projectId: string): Promise<LaunchRecord> {
    const existing = this.pending.get(projectId);
    if (existing) return existing;
    const record = this.records.get(projectId);
    if (!record || (record.state !== 'running' && record.state !== 'stopping')) {
      return Promise.reject(new Error(`no running or stopping run for project ${projectId}`));
    }
    const p = this.runStop(record);
    this.trackPending(projectId, p);
    return p;
  }

  /**
   * Record the run id once C5 sees a `run.start` (design C4 "Run id"; Req 3 AC 6).
   * Writes and emits only when the value changes.
   */
  noteRunId(projectId: string, runId: string): void {
    const record = this.records.get(projectId);
    if (!record || record.runId === runId) return;
    record.runId = runId;
    this.writeRecord(record);
  }

  // --- stop internals ---

  private async runStop(record: LaunchRecord): Promise<LaunchRecord> {
    this.clearLivenessPoll(record.projectId);
    // Pid-reuse guard (design D7): probe liveness once before signalling.
    if (!this.isAlive(record)) {
      return this.finalise(record);
    }
    if (record.state !== 'stopping') {
      record.state = 'stopping';
      record.stopRequestedAt = new Date().toISOString();
      this.writeRecord(record);
    }
    return this.signalAndFinalise(record);
  }

  private async signalAndFinalise(record: LaunchRecord): Promise<LaunchRecord> {
    this.killGroup(record.pgid, 'SIGTERM');
    const deadline = Date.now() + this.stopGraceMs;
    let killed = false;
    while (this.groupExists(record.pgid)) {
      if (!killed && Date.now() >= deadline) {
        this.killGroup(record.pgid, 'SIGKILL');
        killed = true;
      }
      await sleep(this.pollMs);
    }
    return this.finalise(record);
  }

  /**
   * Close out a run (design C4 "Finalise", idempotent). Resolve the run id, close
   * the ledger with one `run.end`, drop this run's pointer line, delete the setup
   * file only when it is still this run's, then mark the record `stopped`.
   */
  private finalise(record: LaunchRecord): LaunchRecord {
    const runId = this.resolveRunId(record);
    if (runId !== null) {
      const ledgerPath = join(record.workflowRoot, 'specs', record.spec, 'harness-events.jsonl');
      this.appendRunEndIfNeeded(ledgerPath, runId, record.spec);
      removePointerLine(this.pointerPathOpt ?? defaultPointerPath(), runId);
    }
    deleteRunFileIf(record.workflowRoot, record.setupWrittenAt);
    record.state = 'stopped';
    record.endedAt = new Date().toISOString();
    this.writeRecord(record);
    return record;
  }

  /**
   * The run id for finalisation (design C4 "Finalise" step 1): `record.runId`,
   * else the newest ledger `run.start` at or after `launchedAt`, else a pointer
   * line for this spec dir whose run-id time is at or after `launchedAt` truncated
   * to the second.
   */
  private resolveRunId(record: LaunchRecord): string | null {
    if (record.runId !== null) return record.runId;
    const ledgerPath = join(record.workflowRoot, 'specs', record.spec, 'harness-events.jsonl');
    const events = parseJsonl<LedgerEvent>(readTextIfExists(ledgerPath));
    let newest: { run: string; ts: string } | null = null;
    for (const e of events) {
      if (e.type !== 'run.start' || typeof e.run !== 'string' || typeof e.ts !== 'string') continue;
      if (e.ts < record.launchedAt) continue;
      if (!newest || e.ts > newest.ts) newest = { run: e.run, ts: e.ts };
    }
    if (newest) return newest.run;
    const specDir = resolve(record.workflowRoot, 'specs', record.spec);
    const launchedSecond = Math.floor(Date.parse(record.launchedAt) / 1000) * 1000;
    for (const line of readPointer(this.pointerPathOpt ?? defaultPointerPath())) {
      if (resolve(line.specDir) !== specDir) continue;
      const t = runIdTime(line.runId);
      if (t !== null && t >= launchedSecond) return line.runId;
    }
    return null;
  }

  private appendRunEndIfNeeded(ledgerPath: string, runId: string, spec: string): void {
    const text = readTextIfExists(ledgerPath);
    if (text === undefined) return; // no ledger for this spec: nothing to close
    const events = parseJsonl<LedgerEvent>(text);
    const hasStart = events.some((e) => e.type === 'run.start' && e.run === runId);
    const hasEnd = events.some((e) => e.type === 'run.end' && e.run === runId);
    if (!hasStart || hasEnd) return; // absent start, or already closed (idempotent)
    const row = { ts: new Date().toISOString(), run: runId, spec, type: 'run.end', status: 'stopped from the dashboard' };
    appendFileSync(ledgerPath, JSON.stringify(row) + '\n');
  }

  private killGroup(pgid: number, signal: NodeJS.Signals): void {
    try {
      process.kill(-pgid, signal);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err; // the group already gone
    }
  }

  private groupExists(pgid: number): boolean {
    try {
      process.kill(-pgid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private armLivenessPoll(record: LaunchRecord): void {
    const projectId = record.projectId;
    const timer = setInterval(() => {
      const rec = this.records.get(projectId);
      if (!rec || rec.state !== 'running') {
        this.clearLivenessPoll(projectId);
        return;
      }
      if (!this.groupExists(rec.pgid)) {
        this.clearLivenessPoll(projectId);
        // A reattached run gone on its own shows null exit (design Scope notes).
        rec.state = 'exited';
        rec.exitCode = null;
        rec.signal = null;
        rec.endedAt = new Date().toISOString();
        this.writeRecord(rec);
      }
    }, this.pollMs);
    timer.unref?.();
    this.livenessTimers.set(projectId, timer);
  }

  private clearLivenessPoll(projectId: string): void {
    const timer = this.livenessTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.livenessTimers.delete(projectId);
    }
  }

  private trackPending(projectId: string, p: Promise<LaunchRecord>): void {
    this.pending.set(projectId, p);
    const clear = () => { if (this.pending.get(projectId) === p) this.pending.delete(projectId); };
    p.then(clear, clear);
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
        // Own exit (design C4 "Own exit"): an exit with no stop requested marks
        // the record `exited` and touches no ledger or pointer.
        child.on('exit', (code, signal) => this.onChildExit(record.projectId, code, signal));
        resolvePromise(record);
      });
    });
  }

  private onChildExit(projectId: string, code: number | null, signal: NodeJS.Signals | null): void {
    const record = this.records.get(projectId);
    if (!record) return;
    if (record.stopRequestedAt !== null) return; // the stop path finalises this run
    if (record.state !== 'running') return;
    record.state = 'exited';
    record.exitCode = code;
    record.signal = signal;
    record.endedAt = new Date().toISOString();
    this.writeRecord(record);
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
