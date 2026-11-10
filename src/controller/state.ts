// src/controller/state.ts
//
// The controller's machine state in the harness home (controller-design.md §3,
// §7, §8, §9). One writer: the controller. Every record carries `v: 1`. Writes
// are atomic (a temp file in the same directory, then rename). Readers treat a
// missing file as absent, never an error.
//
// The home path is an internal detail; the only exported path is
// `controllerHome()`. The home resolution rule (`SDD_HOME` first, then the
// existing XDG rule) lives in `state-files.ts` so the controller does not
// duplicate it.
import { promises as fs, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import { sddHome } from '../dashboard/harness/state-files.js';
import { withRegistryLock } from '../core/registry-lock.js';
import { guardTestHome } from '../core/test-home-guard.js';
// Type-only so no runtime cycle forms: `merge.ts` imports `state.ts` at runtime.
import type { MergeStageStatus } from './merge.js';

// ---------------------------------------------------------------------------
// Records (controller-design.md §3 and §7). Every one carries `v: 1`.
// ---------------------------------------------------------------------------

/** A run's phase-and-step position (controller-tasks.md T2: "step cursor"). */
export interface StepCursor {
  phase: string;
  /** The adversarial round, when the phase runs rounds. */
  round?: number;
  /** The task id, when the phase works a task queue. */
  task?: string;
  /** Which role/step produced this cursor (drafter, reviewer, implementer, …). */
  stepKind: string;
  /** How many times this step has been attempted. */
  attempt: number;
}

/** The step process currently running for a run (§8: PID and start time). */
export interface InFlightStep {
  id: string;
  pid: number;
  /** `/proc/<pid>/stat` field 22 at spawn, so a reused pid reads dead. */
  startTime: number;
  /** The Claude Code session id, for `--resume`. */
  session?: string;
  /** Wall-clock start of this step, for the tile's step age (design C1). */
  startedAt?: string;
  /** The task id this step is working, for the tile's task label (design C1). */
  task?: string;
}

/** Running token totals for a run. */
export interface TokenTotals {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'waiting'
  | 'merging'
  | 'done'
  | 'abandoned'
  | 'error';

/** A run that still holds (or is owed) a slot. */
export function isLive(status: RunStatus): boolean {
  return status === 'queued' || status === 'running' || status === 'paused'
    || status === 'waiting' || status === 'merging';
}

/** The `pauseReason` value of an applied operator pause. `pauseReason` stays a free string. */
export const OPERATOR_PAUSE = 'operator';

/** `runs/<id>/run.json`: the machine state of one run. */
export interface RunRecord {
  v: 1;
  id: string;
  /** Project id. */
  project: string;
  codeRoot: string;
  specStore: string;
  spec: string;
  worktree: string;
  branch: string;
  /** The open PR's number, once the implementation phase recorded it (T7 merge). */
  pr?: number;
  /** The pull requests (or branches) the close-out phase opened, one per repository. */
  closeoutPrs?: { repoDir: string; branch: string; number?: number; url?: string }[];
  status: RunStatus;
  /** Why the run is paused, when `status` is `paused`. */
  pauseReason?: string;
  /**
   * ISO time of the operator's pause request: set while the hold is pending
   * or applied, cleared only by Resume or the run ending (design C1).
   */
  pauseRequested?: string;
  /** Who is holding the run: an operator pause or the deploy gate (design C2, D22). */
  holdBy?: 'operator' | 'deploy';
  /**
   * ISO time the run may resume: a usage window's `resetsAt` when `paused`, or
   * the next merge-rule re-check when `merging` (T7's `MERGE_POLL_INTERVAL_MS`).
   */
  resumeAt?: string;
  /** ISO time the run last became `paused` or `waiting`; absent while it moves. */
  pausedAt?: string;
  /** ISO time of the run's last observed liveness signal (design C1); written only by `writeLastActivity`. */
  lastActivity?: string;
  phase?: string;
  cursor?: StepCursor;
  inFlight?: InFlightStep;
  /** ISO. */
  created: string;
  /** ISO. */
  updated: string;
  tokens: TokenTotals;
  /** One read per pull request the merge pass has evaluated (design C2, D4). */
  prReads?: PrRead[];
}

/** A pull request head's CI state, as the merge pass read it (design C1/C2). */
export type PrCiState = 'green' | 'pending' | 'red' | 'unreadable';

/**
 * One read of a pull request by the merge pass (design C1/C2 "PrRead"): the
 * verdict and what it rested on, carried from the merge pass to its callers.
 * Holds no path — `repo` is a basename.
 */
export interface PrRead {
  /** `run` for the run's own PR, `closeout` for a close-out PR. */
  kind: 'run' | 'closeout';
  /** The repo's basename; never the path. */
  repo: string;
  number: number;
  /** The PR's web URL; kept only when https. */
  url?: string;
  ci: PrCiState;
  /** The raw `gh` mergeable value; absent when the view was unreadable. */
  mergeable?: string;
  verdict: MergeStageStatus;
  reasons: string[];
  /** The merge commit sha, when `verdict` is `merged`. */
  sha?: string;
  /** The package names this PR head adds over its base (design C2, R4); absent when empty or unread. */
  newDependencies?: string[];
  /** ISO time of the read. */
  at: string;
}

export type WaitKind =
  | 'gate-a'
  | 'gate-b'
  | 'retro-plan'
  | 'merge'
  | 'escalation'
  | 'error'
  | 'question';

export type WaitState = 'open' | 'answered' | 'expired';

/** One question in a wait (§7). */
export interface WaitQuestion {
  id: string;
  text: string;
  /** The choices; absent when the question is free text. */
  options?: string[];
  /** True when the operator types an answer rather than picking. */
  free?: boolean;
  /** The run's recommended pick. */
  recommended?: string;
  reason?: string;
  /**
   * The task this question is about, when it has one (an implementation-phase
   * escalation/design-defect ruling). The answer is carried only into that
   * task's next brief, never a sibling's (tax-lots retro P7).
   */
  task?: string;
}

/** The operator's answer to one question (§7: with `by` and `answered`). */
export interface WaitAnswer {
  value: string;
  by: string;
  /** ISO. */
  answered: string;
}

/** The advisor's typed second opinion (C7, Data Models). */
export interface WaitOpinion {
  picks: { question: string; pick: string; reason: string }[];
  summary: string;
}

/** The second-opinion run's progress on a wait (C7, Data Models). */
export interface WaitOpinionStatus {
  state: 'running' | 'failed';
  /** ISO. */
  at: string;
  reason?: string;
}

/** `waits/<id>.json`: a run's request for the operator (§7). */
export interface WaitRecord {
  v: 1;
  id: string;
  kind: WaitKind;
  run: string;
  project: string;
  spec: string;
  /** ISO. */
  created: string;
  questions: WaitQuestion[];
  /** Answers keyed by question id; absent until answered. */
  answer?: Record<string, WaitAnswer>;
  /** Optional second opinion from an advisor step. */
  advice?: string;
  /** The typed second opinion the advisor attached, alongside `advice`. */
  opinion?: WaitOpinion;
  /** The second-opinion run's progress; cleared once the opinion attaches. */
  opinionStatus?: WaitOpinionStatus;
  state: WaitState;
  /** The worker report for the task under ruling. */
  detail?: string;
  /** The task's commits, for an escalation ruling. */
  commits?: string[];
}

/** `queue.json`: run ids waiting for a slot, in order. */
export interface QueueFile {
  v: 1;
  runs: string[];
}

/** One usage window's utilisation and reset (§9). */
export interface RateLimitWindow {
  /** 0..1. */
  utilization: number;
  /** ISO. */
  resetsAt: string;
}

/** `rate-limit.json`: the latest five-hour and seven-day windows (§9). */
export interface RateLimitFile {
  v: 1;
  fiveHour: RateLimitWindow;
  sevenDay: RateLimitWindow;
  /** ISO time these values were last seen. */
  updated: string;
}

/**
 * One project the controller knows, kept in `projects.json` in the home
 * (controller-design.md §3: the controller owns a durable project list; the MCP
 * process registry only says which servers are alive right now).
 */
export interface KnownProject {
  /** The registry's project id (a hash of the workspace path). */
  id: string;
  /** The workspace / main checkout. */
  workspacePath: string;
  /** The root that holds `.spec-workflow` (the spec store). */
  workflowRootPath: string;
  name: string;
  /** Operator-set name; `rememberProject` never overwrites it (design C1). */
  displayName?: string;
  /** ISO time the project was last seen (registered, added or listed). */
  seen: string;
}

/** `projects.json`: every project the dashboard has seen, until removed. */
export interface ProjectsFile {
  v: 1;
  projects: KnownProject[];
}

/** `controller.lock`: the single live controller (pid and start time). */
export interface ControllerLock {
  v: 1;
  pid: number;
  /** `/proc/<pid>/stat` field 22, so a reused pid reads dead. */
  startTime: number;
}

// ---------------------------------------------------------------------------
// Home and layout. Internal except `controllerHome()`.
// ---------------------------------------------------------------------------

/** The controller's home directory (`$SDD_HOME` or `<state home>/sdd`). */
export function controllerHome(): string {
  const resolved = sddHome();
  guardTestHome(resolved, 'controllerHome');
  return resolved;
}

function runsDir(): string {
  return join(controllerHome(), 'runs');
}

function runDir(id: string): string {
  return join(runsDir(), id);
}

/** A run's per-step stream logs (design §3: machine state lives in the home). */
export function runStepsDir(id: string): string {
  return join(runDir(id), 'steps');
}

function runPath(id: string): string {
  return join(runDir(id), 'run.json');
}

function waitsDir(): string {
  return join(controllerHome(), 'waits');
}

function waitPath(id: string): string {
  return join(waitsDir(), `${id}.json`);
}

function queuePath(): string {
  return join(controllerHome(), 'queue.json');
}

function rateLimitPath(): string {
  return join(controllerHome(), 'rate-limit.json');
}

function controllerLockPath(): string {
  return join(controllerHome(), 'controller.lock');
}

function projectsPath(): string {
  return join(controllerHome(), 'projects.json');
}

function projectsLockPath(): string {
  return `${projectsPath()}.lock`;
}

function storeLockPath(specStoreRoot: string): string {
  const key = createHash('sha256').update(specStoreRoot).digest('hex').slice(0, 16);
  return join(controllerHome(), 'locks', `${key}.lock`);
}

// ---------------------------------------------------------------------------
// Atomic JSON I/O.
// ---------------------------------------------------------------------------

let tmpCounter = 0;

/** Write JSON atomically: a temp file in the same directory, then rename. */
export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${tmpCounter++}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  await fs.rename(tmp, path);
}

/** Read and parse a JSON file; `undefined` when it does not exist. */
async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf-8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Runs.
// ---------------------------------------------------------------------------

/**
 * `listRuns` for synchronous readers (the dashboard's overview rows and shell
 * feed, which rebuild on a file event). A directory without a readable
 * `run.json` is skipped; a missing runs directory is `[]`.
 */
export function listRunsSync(): RunRecord[] {
  let names: string[];
  try {
    names = readdirSync(runsDir(), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const out: RunRecord[] = [];
  for (const name of names) {
    try {
      out.push(JSON.parse(readFileSync(runPath(name), 'utf-8')) as RunRecord);
    } catch {
      // A record mid-write or malformed: skip it this pass.
    }
  }
  return out;
}

export async function listRuns(): Promise<RunRecord[]> {
  let entries;
  try {
    entries = await fs.readdir(runsDir(), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const out: RunRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const record = await readRun(entry.name);
    if (record) out.push(record);
  }
  return out;
}

export function readRun(id: string): Promise<RunRecord | undefined> {
  return readJson<RunRecord>(runPath(id));
}

/** Synchronous `readRun`, for the driver's per-check reads (C3, C1). */
export function readRunSync(id: string): RunRecord | undefined {
  try {
    return JSON.parse(readFileSync(runPath(id), 'utf-8')) as RunRecord;
  } catch {
    return undefined;
  }
}

// Serialises `writeRun` per run id, so the read-then-write below never races
// another `writeRun` for the same id (design C1 post-condition 1). Chained
// with a promise that never rejects, so a failed write does not stall later
// writes for that id.
const writeChains = new Map<string, Promise<void>>();

// Status guard (design C7, Requirement 7 AC 3, AC 4): once disk holds
// `abandoned`, no later write with a different status may replace it.
async function writeRunLocked(record: RunRecord, opts?: { ownsPauseRequest?: boolean }): Promise<boolean> {
  const onDisk = await readRun(record.id);
  if (onDisk?.status === 'abandoned' && record.status !== 'abandoned') return false;

  // Every writer spreads the record it read, so `pausedAt` carries over while the
  // run stays stopped and is stamped only on the write that stops it.
  const stopped = record.status === 'paused' || record.status === 'waiting';
  const terminal = record.status === 'done' || record.status === 'abandoned' || record.status === 'error';
  let pauseRequested = record.pauseRequested;
  let holdBy = record.holdBy;
  // `lastActivity` has one writer (`writeLastActivity`); every other write to a
  // run carries it over from disk unchanged, ignoring whatever the caller's
  // record holds (design C1).
  let lastActivity = record.lastActivity;
  if (!terminal) {
    if (!opts?.ownsPauseRequest) {
      pauseRequested = onDisk?.pauseRequested;
      holdBy = onDisk?.holdBy;
    }
    lastActivity = onDisk?.lastActivity;
  }
  if (terminal) {
    pauseRequested = undefined;
    holdBy = undefined;
    lastActivity = undefined;
  }
  const out = {
    ...record,
    pausedAt: stopped ? (record.pausedAt ?? new Date().toISOString()) : undefined,
    pauseRequested,
    holdBy,
    lastActivity,
  };
  await writeJsonAtomic(runPath(record.id), out);
  return true;
}

/** Resolves `false`, writing nothing, when the status guard drops the write. */
export function writeRun(record: RunRecord, opts?: { ownsPauseRequest?: boolean }): Promise<boolean> {
  const prior = writeChains.get(record.id) ?? Promise.resolve();
  const settled = prior.then(
    () => writeRunLocked(record, opts),
    () => writeRunLocked(record, opts),
  );
  writeChains.set(record.id, settled.then(() => undefined, () => undefined));
  return settled;
}

async function updateRunLocked(
  id: string,
  fn: (run: RunRecord) => RunRecord | undefined,
): Promise<RunRecord | undefined> {
  const record = await readRun(id);
  if (!record) return undefined;
  const next = fn(record);
  if (next === undefined) return undefined;
  await writeRunLocked(next, { ownsPauseRequest: true });
  return readRun(id);
}

/**
 * Read-modify-write one run inside its own write chain (design C2, D22): calls
 * `writeRunLocked` directly, never `writeRun`, since queuing behind its own
 * chain link would deadlock. `fn` sees the freshly re-read record even when
 * raced against a `writeRun` for the same id; returning `undefined` from `fn`
 * writes nothing. A missing id resolves `undefined` without calling `fn`.
 */
export function updateRun(
  id: string,
  fn: (run: RunRecord) => RunRecord | undefined,
): Promise<RunRecord | undefined> {
  const prior = writeChains.get(id) ?? Promise.resolve();
  const run = () => updateRunLocked(id, fn);
  const settled = prior.then(run, run);
  writeChains.set(id, settled.then(() => undefined, () => undefined));
  return settled;
}

async function writeLastActivityLocked(
  id: string,
  value: string | undefined,
  updated: string,
): Promise<RunRecord | undefined> {
  const record = await readRun(id);
  if (!record) return undefined;
  const terminal = record.status === 'done' || record.status === 'abandoned' || record.status === 'error';
  if (terminal) return undefined;
  if (value === undefined && record.lastActivity === undefined) return undefined;
  const out: RunRecord = { ...record, lastActivity: value, updated };
  await writeJsonAtomic(runPath(id), out);
  return out;
}

/**
 * The single writer of `lastActivity` (design C1). Queued on the same
 * per-run chain as `writeRun`, so a status write and a heartbeat write for
 * the same run settle in call order. Does not pass through `writeRunLocked`,
 * so `pausedAt` and `pauseRequested` stay as read.
 */
export function writeLastActivity(
  id: string,
  value: string | undefined,
  updated: string,
): Promise<RunRecord | undefined> {
  const prior = writeChains.get(id) ?? Promise.resolve();
  const run = () => writeLastActivityLocked(id, value, updated);
  const settled = prior.then(run, run);
  writeChains.set(id, settled.then(() => undefined, () => undefined));
  return settled;
}

// ---------------------------------------------------------------------------
// Waits.
// ---------------------------------------------------------------------------

export async function listWaits(opts: { state?: WaitState } = {}): Promise<WaitRecord[]> {
  let files: string[];
  try {
    files = await fs.readdir(waitsDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const out: WaitRecord[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const record = await readWait(file.slice(0, -'.json'.length));
    if (!record) continue;
    if (opts.state && record.state !== opts.state) continue;
    out.push(record);
  }
  return out;
}

export function readWait(id: string): Promise<WaitRecord | undefined> {
  return readJson<WaitRecord>(waitPath(id));
}

export function writeWait(record: WaitRecord): Promise<void> {
  return writeJsonAtomic(waitPath(record.id), record);
}

// ---------------------------------------------------------------------------
// Queue and rate limit.
// ---------------------------------------------------------------------------

export async function readQueue(): Promise<QueueFile> {
  return (await readJson<QueueFile>(queuePath())) ?? { v: 1, runs: [] };
}

export function writeQueue(queue: QueueFile): Promise<void> {
  return writeJsonAtomic(queuePath(), queue);
}

export function readRateLimit(): Promise<RateLimitFile | undefined> {
  return readJson<RateLimitFile>(rateLimitPath());
}

export function writeRateLimit(rateLimit: RateLimitFile): Promise<void> {
  return writeJsonAtomic(rateLimitPath(), rateLimit);
}

// ---------------------------------------------------------------------------
// The durable project list (design §3). The dashboard lists a project from the
// MCP process registry only while a server process for it is alive, so after a
// controller restart a project with no open session vanished and a launch read
// "Project not found" (2026-10-13). The controller remembers every project it
// has seen here and forgets one only when the operator removes it.
// ---------------------------------------------------------------------------

export async function readProjects(): Promise<ProjectsFile> {
  return (await readJson<ProjectsFile>(projectsPath())) ?? { v: 1, projects: [] };
}

export function writeProjects(file: ProjectsFile): Promise<void> {
  return writeJsonAtomic(projectsPath(), file);
}

/**
 * Serialises `projects.json` writers (design C5), the same way `withStoreLock`
 * serialises spec-store writers: throws when the lock is not acquired rather
 * than silently skipping the write.
 */
async function withProjectsLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = await withRegistryLock(projectsLockPath(), fn);
  if (!result.acquired) {
    throw new Error(`could not acquire the projects lock at ${projectsLockPath()}: ${result.reason}`);
  }
  return result.value;
}

/** Add or refresh one project (matched by id); keeps the file sorted by name. */
export async function rememberProject(project: Omit<KnownProject, 'seen'>, now: () => Date = () => new Date()): Promise<void> {
  await withProjectsLock(async () => {
    const file = await readProjects();
    const existing = file.projects.find((p) => p.id === project.id);
    const next: KnownProject = { ...project, seen: now().toISOString() };
    if (existing?.displayName !== undefined) next.displayName = existing.displayName;
    const rest = file.projects.filter((p) => p.id !== project.id);
    rest.push(next);
    rest.sort((a, b) => a.name.localeCompare(b.name));
    await writeProjects({ v: 1, projects: rest });
  });
}

/** The name shown in the project list: the operator's `displayName` when set, else `name`. */
export function shownName(project: { name: string; displayName?: string }): string {
  return project.displayName ?? project.name;
}

/**
 * Set or clear one project's operator display name (design C1). `null` removes
 * the key entirely rather than storing an empty/undefined value. Returns false
 * and writes nothing for an unknown id.
 */
export async function setProjectDisplayName(id: string, displayName: string | null): Promise<boolean> {
  return withProjectsLock(async () => {
    const file = await readProjects();
    const index = file.projects.findIndex((p) => p.id === id);
    if (index === -1) return false;
    const existing = file.projects[index];
    const next: KnownProject = { ...existing };
    if (displayName === null) delete next.displayName;
    else next.displayName = displayName;
    const projects = [...file.projects];
    projects[index] = next;
    await writeProjects({ v: 1, projects });
    return true;
  });
}

/** Drop one project by id; a missing id is a no-op. */
export async function forgetProject(id: string): Promise<void> {
  await withProjectsLock(async () => {
    const file = await readProjects();
    const rest = file.projects.filter((p) => p.id !== id);
    if (rest.length !== file.projects.length) await writeProjects({ v: 1, projects: rest });
  });
}

/**
 * Drop every remembered project whose workspace or spec-store root is gone
 * (design C5; requirement 4 AC2, AC7, AC8). Runs inside the same lock as
 * `rememberProject`/`forgetProject`, so a remember that starts while a prune
 * is still waiting on `isMissing` is serialised after it rather than lost. A
 * lock miss logs and returns no drops instead of throwing, since the startup
 * prune has no caller to report failure to.
 */
export async function pruneMissingProjects(
  isMissing: (path: string) => Promise<boolean>,
): Promise<KnownProject[]> {
  try {
    return await withProjectsLock(async () => {
      const file = await readProjects();
      const kept: KnownProject[] = [];
      const dropped: Array<{ project: KnownProject; missingPath: string }> = [];
      for (const project of file.projects) {
        const missingPath = (await isMissing(project.workspacePath))
          ? project.workspacePath
          : (await isMissing(project.workflowRootPath))
            ? project.workflowRootPath
            : undefined;
        if (missingPath === undefined) kept.push(project);
        else dropped.push({ project, missingPath });
      }
      if (dropped.length > 0) {
        await writeProjects({ v: 1, projects: kept });
        for (const { project, missingPath } of dropped) {
          console.error(`[state] pruned project ${project.id} from ${projectsPath()}: missing path ${missingPath}`);
        }
      }
      return dropped.map((d) => d.project);
    });
  } catch (error) {
    console.error(`[state] could not prune ${projectsPath()}: ${(error as Error).message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Process liveness. `/proc/<pid>/stat` field 22 (starttime, clock ticks) so a
// reused pid with a different start time is not mistaken for the step.
// ---------------------------------------------------------------------------

/** Field 22 of `/proc/<pid>/stat`, or `undefined` if the process is gone. */
export function processStartTime(pid: number): number | undefined {
  let stat: string;
  try {
    stat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
  } catch {
    return undefined;
  }
  // `comm` (field 2) is parenthesised and may contain spaces or ')', so parse
  // from the last ')'. After it, the fields are space-separated starting at
  // field 3 (state); field 22 is therefore index 19.
  const close = stat.lastIndexOf(')');
  if (close < 0) return undefined;
  const fields = stat.slice(close + 1).trim().split(/\s+/);
  const starttime = Number(fields[19]);
  return Number.isFinite(starttime) ? starttime : undefined;
}

/**
 * Is `pid` the same process that was spawned with start time `startTime`?
 * False when the process is gone or the pid was reused (a different start time).
 */
export function isProcessAlive(pid: number, startTime: number): boolean {
  const current = processStartTime(pid);
  return current !== undefined && current === startTime;
}

// ---------------------------------------------------------------------------
// The controller lock: one live controller. O_EXCL create; a lock whose pid is
// dead (by the liveness check above) is taken over. Staleness is liveness, not
// mtime — the opposite of the registry lock, which deliberately never trusts
// `isProcessAlive`.
// ---------------------------------------------------------------------------

export async function acquireControllerLock(): Promise<boolean> {
  const path = controllerLockPath();
  await fs.mkdir(dirname(path), { recursive: true });
  const payload: ControllerLock = {
    v: 1,
    pid: process.pid,
    startTime: processStartTime(process.pid) ?? 0,
  };
  // Two attempts: the second runs only after a stale lock has been removed.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(path, 'wx');
      try {
        await handle.writeFile(JSON.stringify(payload, null, 2) + '\n', 'utf-8');
      } finally {
        await handle.close();
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const holder = await readJson<ControllerLock>(path);
    if (holder && isProcessAlive(holder.pid, holder.startTime)) {
      return false; // a live controller holds it
    }
    await fs.rm(path, { force: true }); // dead or unreadable: take it over
  }
  return false;
}

export async function releaseControllerLock(): Promise<void> {
  const holder = await readJson<ControllerLock>(controllerLockPath());
  if (holder && holder.pid === process.pid) {
    await fs.rm(controllerLockPath(), { force: true });
  }
}

// ---------------------------------------------------------------------------
// The per-store lock. Reuses the registry lock as a generic per-path lock
// (controller-design.md §11: "one lock per store"). Serialises writers to one
// spec store across runs. The lock file lives in the home, keyed by the store
// path, so it never lands inside the git store itself.
// ---------------------------------------------------------------------------

export async function withStoreLock<T>(
  specStoreRoot: string,
  fn: () => Promise<T>,
): Promise<T> {
  const result = await withRegistryLock(storeLockPath(specStoreRoot), fn);
  if (!result.acquired) {
    throw new Error(
      `could not acquire the store lock for ${specStoreRoot}: ${result.reason}`,
    );
  }
  return result.value;
}
