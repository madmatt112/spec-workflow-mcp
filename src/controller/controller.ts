// src/controller/controller.ts
//
// T6 of the controller (docs/controller-tasks.md "T6 `runs`", design §1-3, §6,
// §8, §9, §13). The `Controller` is a module of the dashboard server process: it
// holds the queue, starts runs when it has a slot and the usage window allows,
// drives each run through `runOnce` (`runs.ts`), performs crash recovery on
// start, parks and resumes on the usage window, and answers the operator through
// waits. No model runs here; every model call is a step or the supervisor the
// driver spawns.
import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { sddHome } from '../dashboard/harness/state-files.js';
import { PathUtils } from '../core/path-utils.js';
import { newRunId } from './ledger.js';
import {
  acquireControllerLock, releaseControllerLock,
  readQueue, writeQueue, listRuns, readRun, writeRun,
  writeRateLimit, listWaits, withStoreLock,
  isProcessAlive,
  type RunRecord, type RateLimitFile, type RateLimitWindow,
} from './state.js';
import { waitEvents, type ControllerWaitRecord } from './waits.js';
import { readMergeRules, type MergeRules } from './merge.js';
import { recordActivity, clearRunActivity } from './activity.js';
import { NO_OP_GATES, type DocumentGates } from './phases/document.js';
import type { RateLimitWindows } from './step.js';
import {
  runOnce, cancelRun, discardRun, writeApprovedRetroPlan, runEvents,
  type RunDeps, type CancelDeps,
} from './runs.js';

// No global cap by default: one run per spec store already bounds concurrency to one run
// per project, and the window threshold guards usage. CONTROLLER_SLOTS sets a cap.
const DEFAULT_SLOTS = Number.POSITIVE_INFINITY;
const DEFAULT_WINDOW_THRESHOLD = 0.95;
const DEFAULT_TICK_MS = 1000;

export interface ControllerProject {
  /** The spec store root (holds `.spec-workflow`); project.projectPath. */
  projectPath: string;
  /** The code root / main checkout; project.workspacePath. */
  workspacePath: string;
}

export interface ControllerOptions {
  /** Resolve a project's roots; the one seam the server and tests both supply. */
  resolveProject(projectId: string): ControllerProject | undefined;
  /** The document-phase gates (T5b's `createDocumentGates`); defaults to no-ops. */
  gates?: DocumentGates;
  /** Create (or reuse) a run's worktree and branch; defaults to no worktree. */
  ensureWorktree?(opts: { projectPath: string; workspacePath: string; spec: string }): Promise<{ worktree: string; branch: string }>;
  /** `--mcp-config` for a run's steps; defaults to reading the project's `.mcp.json`. */
  mcpConfigFor?(opts: { projectPath: string; workspacePath: string }): string | Record<string, unknown> | undefined;
  slots?: number;
  windowThreshold?: number;
  tickMs?: number;
  /** The merge re-check delay while `not-ready` (ms); tests shorten it. */
  mergePollMs?: number;
  now?(): Date;
  /** Unused since step (c3): every step reads `CONTROLLER_CLAUDE_BIN` itself. Kept for the server's call. */
  claudeBin?(): string;
  ghBin?(): string;
  /** Cancel grace before SIGKILL (ms). */
  graceMs?: number;
}

export class Controller extends EventEmitter {
  private readonly opts: ControllerOptions;
  private readonly slots: number;
  private readonly windowThreshold: number;
  private readonly tickMs: number;
  private readonly now: () => Date;

  private readonly active = new Set<string>();
  private readonly cancelled = new Set<string>();
  private readonly resumeTimers = new Set<NodeJS.Timeout>();
  private readonly drives = new Map<string, Promise<void>>();
  private tickTimer?: NodeJS.Timeout;
  private started = false;
  private locked = false;

  constructor(opts: ControllerOptions) {
    super();
    this.opts = opts;
    this.slots = opts.slots ?? (Number(process.env.CONTROLLER_SLOTS) || DEFAULT_SLOTS);
    this.windowThreshold = opts.windowThreshold
      ?? (Number(process.env.CONTROLLER_WINDOW_THRESHOLD) || DEFAULT_WINDOW_THRESHOLD);
    this.tickMs = opts.tickMs ?? DEFAULT_TICK_MS;
    this.now = opts.now ?? ((): Date => new Date());
  }

  // --- lifecycle -----------------------------------------------------------

  /**
   * Acquire the controller lock, recover in-flight runs, subscribe to wait
   * answers, and start the scheduler tick (design §8). Returns false when another
   * live controller holds the lock.
   */
  async start(): Promise<boolean> {
    if (this.started) return true;
    this.locked = await acquireControllerLock();
    if (!this.locked) return false;
    this.started = true;

    waitEvents.on('change', this.onWaitChange);

    await this.recover();

    this.tickTimer = setInterval(() => { void this.schedule(); }, this.tickMs);
    this.tickTimer.unref?.();
    await this.schedule();
    return true;
  }

  /**
   * Release the lock and stop the timers and listeners; runs survive (design §8).
   * In-flight drives are drained (bounded), so a stopped controller stops writing
   * — a detached supervisor step survives either way (design §8).
   */
  async stop(): Promise<void> {
    this.started = false;
    waitEvents.removeListener('change', this.onWaitChange);
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = undefined; }
    for (const t of this.resumeTimers) clearTimeout(t);
    this.resumeTimers.clear();
    const drained = Promise.allSettled([...this.drives.values()]);
    await Promise.race([drained, new Promise((r) => setTimeout(r, 5000))]);
    if (this.locked) {
      await releaseControllerLock();
      this.locked = false;
    }
  }

  /** Drive the scheduler once (a test seam and the backstop the interval calls). */
  async pump(): Promise<void> {
    await this.schedule();
  }

  // --- enqueue (design §9; Launch admission) -------------------------------

  /**
   * Validate like today's Launch admission (the routed spec exists, one run per
   * spec store, no live run on the project), write a `queued` run record and the
   * queue, and return the run id.
   */
  async enqueue(input: { projectId: string; spec: string }): Promise<string> {
    const project = this.opts.resolveProject(input.projectId);
    if (!project) throw new Error(`enqueue: unknown project ${input.projectId}`);

    const specDir = PathUtils.getSpecPath(project.projectPath, input.spec);
    if (!existsSync(specDir)) {
      throw new Error(`enqueue: spec ${input.spec} has no directory at ${specDir}`);
    }

    // Serialise the admission-and-write per spec store so two concurrent launches
    // cannot both pass the one-run guard (design §9, §11).
    const record = await withStoreLock(project.projectPath, async () => {
      const live = (await listRuns()).filter((r) => isLive(r.status));
      if (live.some((r) => r.project === input.projectId || r.specStore === project.projectPath)) {
        throw new Error(`enqueue: a run is already live for project ${input.projectId}`);
      }
      const id = await this.freshRunId();
      const iso = this.now().toISOString();
      const rec: RunRecord = {
        v: 1, id, project: input.projectId,
        codeRoot: project.workspacePath, specStore: project.projectPath, spec: input.spec,
        worktree: '', branch: '', status: 'queued',
        created: iso, updated: iso, tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      };
      await writeRun(rec);
      const queue = await readQueue();
      if (!queue.runs.includes(id)) queue.runs.push(id);
      await writeQueue(queue);
      return rec;
    });

    runEvents.emit('change', record);
    void this.schedule();
    return record.id;
  }

  private async freshRunId(): Promise<string> {
    let id = newRunId(this.now());
    for (let n = 2; await readRun(id); n++) id = `${newRunId(this.now())}-${n}`;
    return id;
  }

  // --- cancel and discard (design §13) -------------------------------------

  async cancel(runId: string): Promise<RunRecord | undefined> {
    this.cancelled.add(runId);
    await this.dropFromQueue(runId);
    clearRunActivity(runId);
    return cancelRun(this.cancelDeps(), runId);
  }

  /**
   * The operator's Resume now on a paused run. Only a running step refreshes the
   * usage-window file, so an early reset (a plan upgrade) stays invisible while
   * every run is parked on the window: mark each window over the threshold as
   * reset now and schedule. The window is account-wide, so this releases every
   * run parked on it; if it is in fact still full, the next step's rate-limit
   * reading writes it back and the runs park again. Any other pause drops its
   * resume time. `undefined` = no such run, `null` = the run is not paused.
   */
  async resumeNow(runId: string): Promise<RunRecord | null | undefined> {
    const run = await readRun(runId);
    if (!run) return undefined;
    if (run.status !== 'paused') return null;
    if (run.pauseReason === 'usage-window') {
      const file = readRateLimitSync();
      if (file) {
        const now = this.now().toISOString();
        const reset = (w: RateLimitWindow): RateLimitWindow =>
          (w.utilization > this.windowThreshold ? { utilization: 0, resetsAt: now } : w);
        await writeRateLimit({ ...file, fiveHour: reset(file.fiveHour), sevenDay: reset(file.sevenDay), updated: now });
      }
    } else {
      await this.save(run, { resumeAt: undefined });
    }
    void this.schedule();
    return run;
  }

  async discard(runId: string): Promise<RunRecord | undefined> {
    this.cancelled.add(runId);
    await this.dropFromQueue(runId);
    clearRunActivity(runId);
    return discardRun(this.cancelDeps(), runId);
  }

  /**
   * The controller's Launch guard, or `null` when a run could start now (T10;
   * design §9). Surfaced on the setup-view route so the Launch card can disable
   * with the reason: a queued or live run on this store, a usage window over the
   * threshold, or every slot in use.
   */
  async launchBlock(projectId: string, specStore: string): Promise<string | null> {
    const live = (await listRuns()).filter((r) => isLive(r.status));
    if (live.some((r) => r.project === projectId || r.specStore === specStore)) {
      return 'This store already has a queued or live run.';
    }
    if (this.windowBlock().blocked) {
      return 'A usage window is above the threshold; launch is paused until it resets.';
    }
    if (this.active.size >= this.slots) {
      return `All ${this.slots} run slots are in use.`;
    }
    return null;
  }

  private async dropFromQueue(runId: string): Promise<void> {
    const queue = await readQueue();
    const next = queue.runs.filter((r) => r !== runId);
    if (next.length !== queue.runs.length) await writeQueue({ v: 1, runs: next });
  }

  // --- crash recovery (design §8) ------------------------------------------

  private async recover(): Promise<void> {
    for (const run of await listRuns()) {
      if (run.status === 'running') {
        if (run.inFlight && isProcessAlive(run.inFlight.pid, run.inFlight.startTime)) {
          this.reattach(run); // alive: wait on the pid, then re-drive
        } else {
          this.startDrive(run.id); // dead or none: resume from its cursor
        }
      } else if (run.status === 'waiting') {
        // A wait answered while the controller was down still resumes the run.
        await this.resumeIfWaitAnswered(run);
      }
    }
  }

  /** Re-attach to a live detached step: poll the pid, then re-drive on its exit. */
  private reattach(run: RunRecord): void {
    this.active.add(run.id);
    const timer = setInterval(() => {
      if (!run.inFlight || !isProcessAlive(run.inFlight.pid, run.inFlight.startTime)) {
        clearInterval(timer);
        this.resumeTimers.delete(timer);
        this.active.delete(run.id);
        this.startDrive(run.id);
      }
    }, this.tickMs);
    timer.unref?.();
    this.resumeTimers.add(timer);
  }

  private async resumeIfWaitAnswered(run: RunRecord): Promise<void> {
    const wait = await this.latestWaitFor(run.id);
    if (wait && wait.state === 'answered') await this.onWaitChange(wait);
  }

  // --- scheduler (design §9) -----------------------------------------------

  private async schedule(): Promise<void> {
    if (!this.started) return;

    const window = this.windowBlock();
    const runs = await listRuns();

    // The usage window is over the threshold: park every run that would start and
    // re-check at the reset (design §9).
    if (window.blocked) {
      for (const run of runs) {
        if (run.status === 'queued' && !this.active.has(run.id)) {
          await this.save(run, { status: 'paused', pauseReason: 'usage-window', resumeAt: window.resumeAt });
        }
      }
      this.armResume(window.resumeAt);
      return;
    }

    const startable = runs
      .filter((r) => this.isStartable(r))
      .sort((a, b) => a.created.localeCompare(b.created));

    for (const run of startable) {
      if (this.active.size >= this.slots) break;
      if (this.active.has(run.id)) continue;
      if (run.status === 'paused') {
        await this.save(run, { pauseReason: undefined, resumeAt: undefined });
      }
      this.startDrive(run.id);
    }
  }

  // Called only in the scheduler's not-blocked branch, so a run parked on the
  // usage window is startable again (the window has recovered); a run paused on a
  // usage-limit step waits for its own `resumeAt`.
  private isStartable(run: RunRecord): boolean {
    if (this.active.has(run.id) || this.cancelled.has(run.id)) return false;
    if (run.status === 'queued') return true;
    if (run.status === 'paused') {
      if (run.pauseReason === 'usage-window') return true;
      return !run.resumeAt || Date.parse(run.resumeAt) <= this.now().getTime();
    }
    // A merge left `not-ready`: re-enter at the re-check time (T7, design §10).
    if (run.status === 'merging') {
      return !run.resumeAt || Date.parse(run.resumeAt) <= this.now().getTime();
    }
    return false;
  }

  /** Launch a drive and track its promise so `stop()` can drain it. */
  private startDrive(runId: string): void {
    if (this.active.has(runId) || this.drives.has(runId) || !this.started) return;
    const p = this.drive(runId).finally(() => this.drives.delete(runId));
    this.drives.set(runId, p);
  }

  private async drive(runId: string): Promise<void> {
    if (this.active.has(runId)) return;
    this.active.add(runId);
    try {
      await runOnce(this.runDeps(), runId);
    } catch (err) {
      console.error(`[controller] run ${runId} errored`, err);
    } finally {
      this.active.delete(runId);
    }
    if (this.started) void this.schedule();
  }

  // --- wait answers (design §7) --------------------------------------------

  private onWaitChange = async (record: ControllerWaitRecord): Promise<void> => {
    if (record.state !== 'answered') return;

    if (record.kind === 'retro-plan') {
      try {
        writeApprovedRetroPlan(record, this.now);
      } catch (err) {
        console.error(`[controller] could not write the retro plan for ${record.run}`, err);
      }
    }

    const run = await readRun(record.run);
    if (!run || run.status !== 'waiting') return;

    // An `error`/`escalation` wait answered `abandon` ends the run; anything else
    // resumes it (the gate/plan answer is already on disk).
    const answers = Object.values(record.answer ?? {}).map((a) => a.value.trim().toLowerCase());
    if ((record.kind === 'error' || record.kind === 'escalation') && answers.includes('abandon')) {
      await this.cancel(record.run);
      return;
    }
    await this.save(run, { status: 'queued', pauseReason: undefined, resumeAt: undefined });
    void this.schedule();
  };

  private async latestWaitFor(runId: string): Promise<ControllerWaitRecord | undefined> {
    const waits = (await listWaits()) as ControllerWaitRecord[];
    return waits
      .filter((w) => w.run === runId)
      .sort((a, b) => b.created.localeCompare(a.created))[0];
  }

  // --- the usage window ----------------------------------------------------

  /** The controller's own usage-window check, for the second opinion (C7, Requirement 5.5). */
  usageBlock(): { blocked: boolean; resumeAt?: string } {
    return this.windowBlock();
  }

  private windowBlock(): { blocked: boolean; resumeAt?: string } {
    const file = readRateLimitSync();
    if (!file) return { blocked: false };
    // Only a running step refreshes the file, and nothing runs while blocked, so a
    // window whose reset time has passed is read as reset, not at its stale utilization.
    const now = this.now().getTime();
    const over: string[] = [];
    for (const w of [file.fiveHour, file.sevenDay]) {
      const resetsAt = Date.parse(w.resetsAt);
      if (Number.isFinite(resetsAt) && resetsAt <= now) continue;
      if (w.utilization > this.windowThreshold) over.push(w.resetsAt);
    }
    if (over.length === 0) return { blocked: false };
    const resumeAt = over.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    return { blocked: true, resumeAt };
  }

  private armResume(resumeAt?: string): void {
    const at = resumeAt ? Date.parse(resumeAt) : NaN;
    const delay = Number.isFinite(at) ? Math.max(0, at - this.now().getTime()) : this.tickMs;
    const timer = setTimeout(() => {
      this.resumeTimers.delete(timer);
      void this.schedule();
    }, Math.min(delay, 2 ** 30));
    timer.unref?.();
    this.resumeTimers.add(timer);
  }

  // --- the RunDeps / CancelDeps the driver reads ---------------------------

  private runDeps(): RunDeps {
    return {
      gates: this.opts.gates ?? NO_OP_GATES,
      now: this.now,
      mergeRules: (run) => this.mergeRules(run),
      mergePollMs: this.opts.mergePollMs,
      mcpConfigFor: (run) => this.mcpConfigFor(run),
      ensureWorktree: (run) => this.ensureWorktree(run),
      tokenCap: (run) => this.tokenCap(run),
      windowBlock: () => this.windowBlock(),
      onRateLimit: (w) => { void this.persistRateLimit(w); },
      onActivity: (a) => recordActivity(a),
      isCancelled: (id) => this.cancelled.has(id),
      setInFlight: () => { /* the driver persists run.inFlight itself */ },
    };
  }

  private cancelDeps(): CancelDeps {
    return {
      now: this.now,
      ghBin: () => this.ghBin(),
      graceMs: this.opts.graceMs,
    };
  }

  private async ensureWorktree(run: RunRecord): Promise<{ worktree: string; branch: string }> {
    if (this.opts.ensureWorktree) {
      return this.opts.ensureWorktree({ projectPath: run.specStore, workspacePath: run.codeRoot, spec: run.spec });
    }
    // Default: no worktree isolation — the run works in the code root.
    return { worktree: run.codeRoot, branch: `feat/${run.spec}` };
  }

  private mcpConfigFor(run: RunRecord): string | Record<string, unknown> | undefined {
    if (this.opts.mcpConfigFor) {
      return this.opts.mcpConfigFor({ projectPath: run.specStore, workspacePath: run.codeRoot });
    }
    // Default: the spec-workflow server entry from the project's `.mcp.json`.
    for (const root of [run.specStore, run.codeRoot]) {
      try {
        const parsed = JSON.parse(readFileSync(`${root}/.mcp.json`, 'utf-8')) as {
          mcpServers?: Record<string, unknown>;
        };
        const entry = parsed.mcpServers?.['spec-workflow'];
        if (entry) return { mcpServers: { 'spec-workflow': entry } };
      } catch {
        // Try the next root.
      }
    }
    return undefined;
  }

  private mergeRules(run: RunRecord): MergeRules {
    return readMergeRules(PathUtils.getWorkflowRoot(run.specStore));
  }

  private tokenCap(run: RunRecord): number | undefined {
    try {
      const rules = readFileSync(`${PathUtils.getWorkflowRoot(run.specStore)}/agent-rules.md`, 'utf-8');
      const m = rules.match(/^baseline-w-per-spec:\s*(\d+)/m);
      if (m) return Number(m[1]) * 2;
    } catch {
      // No agent-rules.md or no key: no cap.
    }
    return undefined;
  }

  private async persistRateLimit(w: RateLimitWindows): Promise<void> {
    const iso = (resetsAt: number): string => {
      if (!resetsAt) return this.now().toISOString();
      const ms = resetsAt < 1e12 ? resetsAt * 1000 : resetsAt; // seconds vs ms
      return new Date(ms).toISOString();
    };
    const file: RateLimitFile = {
      v: 1,
      fiveHour: { utilization: w.fiveHour.utilization, resetsAt: iso(w.fiveHour.resetsAt) },
      sevenDay: { utilization: w.sevenDay.utilization, resetsAt: iso(w.sevenDay.resetsAt) },
      updated: this.now().toISOString(),
    };
    await writeRateLimit(file);
  }

  private ghBin(): string {
    return this.opts.ghBin ? this.opts.ghBin() : (process.env.CONTROLLER_GH_BIN || 'gh');
  }

  private async save(run: RunRecord, patch: Partial<RunRecord>): Promise<RunRecord> {
    const next: RunRecord = { ...run, ...patch, updated: this.now().toISOString() };
    await writeRun(next);
    runEvents.emit('change', next);
    return next;
  }
}

/** A run that still holds (or is owed) a slot. */
function isLive(status: RunRecord['status']): boolean {
  return status === 'queued' || status === 'running' || status === 'paused'
    || status === 'waiting' || status === 'merging';
}

/**
 * Read `rate-limit.json` synchronously for the window check (the write path stays
 * the async `writeRateLimit`). The home is resolved the same way the state module
 * does (`sddHome`). A missing or unparsable file is "no window seen".
 */
function readRateLimitSync(): RateLimitFile | undefined {
  try {
    return JSON.parse(readFileSync(join(sddHome(), 'rate-limit.json'), 'utf-8')) as RateLimitFile;
  } catch {
    return undefined;
  }
}
