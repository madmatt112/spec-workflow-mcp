// src/advisor/push.ts
//
// The wait pusher (design.md C11, D2, D3; requirements.md Requirement 10,
// NFR Security). Started only when `controller.start()`
// (`src/controller/controller.ts:98`, called at
// `src/dashboard/multi-server.ts:341`) took the lock, so there is one pusher.
// On the first start (no readable `pushed.json`, including a corrupt one) it
// records every open wait id without pushing (D3); otherwise it pushes each
// open wait not yet recorded. It then watches the home `waits/` directory
// (`add`, `change`) so a wait written by
// another process (the watchdog's own `createWait` call,
// `scripts/sdd-watchdog.sh:185-201`) is seen too. Every event runs through one
// queue: an open wait not yet recorded is added to `pushed.json`, written,
// then POSTed with `kind`, `project`, `spec` and the first line of its first
// question, any path-shaped word blanked out — no advice or file content
// (NFR Security; this supersedes the advisor spec's no-question-text rule,
// per D2/D3). A failed POST retries once after `retryDelayMs`, then logs one
// `push.failure` row; the wait and the run are unaffected. Each write to
// `pushed.json` drops ids whose wait file is gone. No `notify.json` means no
// send. A wait with a config at its first push is reminded once, an hour
// later, through `sweepReminders()` (the `setInterval` entry and the test
// seam); a wait first seen with no config never gets one.
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { once } from 'events';
import chokidar from 'chokidar';
import { controllerHome, readProjects, readWait, writeJsonAtomic, type WaitRecord } from '../controller/state.js';
import { listOpenWaits } from '../controller/waits.js';
import { notifyConfigIsLoose, pushedPath, readNotifyConfig, appendEvent, type NotifyConfig } from './home.js';

/** The four-file watch options shared with `src/dashboard/harness/overview-watch.ts:24-29`. */
const WATCH_OPTS = {
  ignoreInitial: true,
  persistent: true,
  ignorePermissionErrors: true,
  awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
} as const;

const DEFAULT_RETRY_DELAY_MS = 60_000;
const DEFAULT_SWEEP_MS = 60_000;
const HOUR_MS = 3_600_000;

interface PushedFile {
  v: 1;
  ids: string[];
  firstPush?: Record<string, string>;
  reminded?: string[];
}

interface PushedState {
  ids: Set<string>;
  firstPush: Map<string, string>;
  reminded: Set<string>;
}

export interface WaitPusherOptions {
  /** Delay before the one retry; the production default is one minute (10.5). */
  retryDelayMs?: number;
  /** Injectable clock for the reminder sweep; defaults to `() => new Date()`. */
  now?: () => Date;
  /** Sweep interval; the production default is one minute. */
  sweepMs?: number;
}

type FSWatcher = ReturnType<typeof chokidar.watch>;

function waitsDir(): string {
  return join(controllerHome(), 'waits');
}

function waitPath(id: string): string {
  return join(waitsDir(), `${id}.json`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/** The entry in the durable project list whose id is `wait.project`, its `name`; else, or on a read failure, `wait.project` (design C9). */
async function projectName(wait: WaitRecord): Promise<string> {
  try {
    const { projects } = await readProjects();
    return projects.find((p) => p.id === wait.project)?.name ?? wait.project;
  } catch {
    return wait.project;
  }
}

/**
 * Read `pushed.json`. Returns `undefined` when it is missing, fails to
 * parse, or has no `ids` array — an unreadable file counts as absent, same
 * as a missing one (error handling #8, design C9 `pushed.json`), not as a
 * valid file with zero ids.
 */
async function readPushedStateRaw(): Promise<PushedState | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(pushedPath(), 'utf-8')) as PushedFile;
    if (!Array.isArray(parsed.ids)) return undefined;
    return {
      ids: new Set(parsed.ids),
      firstPush: new Map(Object.entries(parsed.firstPush ?? {})),
      reminded: new Set(parsed.reminded ?? []),
    };
  } catch {
    return undefined;
  }
}

async function readPushedState(): Promise<PushedState> {
  return (await readPushedStateRaw()) ?? { ids: new Set(), firstPush: new Map(), reminded: new Set() };
}

/** Write `pushed.json` atomically, first dropping any id whose wait file is gone from all three fields. */
async function writePushedState(state: PushedState): Promise<void> {
  const aliveIds = new Set<string>();
  for (const id of state.ids) {
    if (await fileExists(waitPath(id))) aliveIds.add(id);
  }
  const firstPush: Record<string, string> = {};
  for (const [id, ts] of state.firstPush) {
    if (aliveIds.has(id)) firstPush[id] = ts;
  }
  const reminded = [...state.reminded].filter((id) => aliveIds.has(id));
  const file: PushedFile = { v: 1, ids: [...aliveIds], firstPush, reminded };
  await writeJsonAtomic(pushedPath(), file);
}

/** A path-shaped token redacts: an absolute path, a `~/` path, any token with a `/`, or any token with a file extension (design C9, D12). */
function isPathShaped(token: string): boolean {
  return token.startsWith('/') || token.startsWith('~/') || token.includes('/') || /\.[A-Za-z0-9]+$/.test(token);
}

function redactPaths(line: string): string {
  return line.replace(/\S+/g, (token) => (isPathShaped(token) ? '[path]' : token));
}

/** Pure ntfy message builder (design C9): reads only `wait.kind`, `wait.spec` and `wait.questions[0]`. */
export function buildMessage(wait: WaitRecord, projectName: string, reminder: boolean): { title: string; body: string } {
  const prefix = reminder ? 'Reminder: ' : '';
  const line1 = `${prefix}${wait.kind} | ${projectName} | ${wait.spec}`;
  const question = wait.questions[0];
  const line2 = question ? redactPaths(question.text.trim().split('\n')[0]) : undefined;
  return {
    title: reminder ? `SDD reminder: ${wait.kind}` : `SDD ${wait.kind}`,
    body: line2 !== undefined ? `${line1}\n${line2}` : line1,
  };
}

/** `WaitPusher { start(); stop() }` (design C11). */
export class WaitPusher {
  private readonly retryDelayMs: number;
  private readonly now: () => Date;
  private readonly sweepMs: number;
  private watcher?: FSWatcher;
  private sweepTimer?: ReturnType<typeof setInterval>;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(opts: WaitPusherOptions = {}) {
    this.retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.now = opts.now ?? (() => new Date());
    this.sweepMs = opts.sweepMs ?? DEFAULT_SWEEP_MS;
  }

  /** Arm the `waits/` watch, log the config state once, run the start-up scan (D2, D3), then run and arm the reminder sweep (C9 Start). */
  async start(): Promise<void> {
    // The directory must exist before the watch is armed: chokidar misses a
    // file written just after it creates a directory it was waiting for.
    await fs.mkdir(waitsDir(), { recursive: true });
    this.watcher = chokidar.watch(waitsDir(), WATCH_OPTS);
    this.watcher.on('add', this.onFile).on('change', this.onFile);
    await once(this.watcher, 'ready');

    await this.logStartupConfigState();
    await this.enqueue(() => this.runStartupScan());

    await this.enqueue(() => this.runSweep());
    this.sweepTimer = setInterval(() => void this.sweepReminders(), this.sweepMs);
    this.sweepTimer.unref?.();
  }

  /** Public test seam and timer entry (design C9); runs through the same queue as every other wait operation. */
  async sweepReminders(): Promise<void> {
    await this.enqueue(() => this.runSweep());
  }

  /** Neither line ever names the url, topic or token (NFR Security). */
  private async logStartupConfigState(): Promise<void> {
    const config = await readNotifyConfig();
    if (!config) {
      console.error('push is off: notify.json is missing or invalid');
      return;
    }
    if (await notifyConfigIsLoose()) {
      console.warn('notify.json has loose file permissions');
    }
  }

  stop(): void {
    this.closed = true;
    void this.watcher?.close();
    this.watcher = undefined;
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  private onFile = (path: string): void => {
    if (this.closed || !path.endsWith('.json')) return;
    const id = basename(path, '.json');
    void this.enqueue(() => this.handleWait(id));
  };

  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  /** D3: no readable `pushed.json` -> record every open id as reminded, push none; else push each open wait not recorded. */
  private async runStartupScan(): Promise<void> {
    if (this.closed) return;
    const existingState = await readPushedStateRaw();
    const openWaits = await listOpenWaits();

    if (!existingState) {
      const ids = new Set(openWaits.map((w) => w.id));
      await writePushedState({ ids, firstPush: new Map(), reminded: new Set(ids) });
      return;
    }

    const state = existingState;
    for (const wait of openWaits) {
      if (this.closed) return;
      if (state.ids.has(wait.id)) continue;
      await this.recordNewWait(wait.id, state);
      await this.attemptPush(wait);
    }
  }

  private async handleWait(id: string): Promise<void> {
    if (this.closed) return;
    const state = await readPushedState();
    if (state.ids.has(id)) return;

    const wait = await readWait(id);
    if (!wait || wait.state !== 'open') return;

    await this.recordNewWait(id, state);
    await this.attemptPush(wait);
  }

  /** Recording a new wait (design C9): with a config, arm the reminder; without one, it never gets one (D10). The record is written before any push attempt. */
  private async recordNewWait(id: string, state: PushedState): Promise<void> {
    const config = await readNotifyConfig();
    state.ids.add(id);
    if (config) {
      state.firstPush.set(id, this.now().toISOString());
    } else {
      state.reminded.add(id);
    }
    await writePushedState(state);
  }

  /** sweepReminders post-conditions (design C9): each due id is marked reminded and written before the conditional POST, so a crash or a failed send never causes a second reminder. */
  private async runSweep(): Promise<void> {
    if (this.closed) return;
    const state = await readPushedState();
    const now = this.now().getTime();
    const dueIds = [...state.firstPush.entries()]
      .filter(([id, ts]) => !state.reminded.has(id) && now - new Date(ts).getTime() >= HOUR_MS)
      .map(([id]) => id);

    for (const id of dueIds) {
      if (this.closed) return;
      const wait = await readWait(id);
      state.reminded.add(id);
      await writePushedState(state);
      if (wait && wait.state === 'open') {
        await this.attemptPush(wait, true);
      }
    }
  }

  /** attemptPush re-reads the config at each send, so a file added after start needs no restart. */
  private async attemptPush(wait: WaitRecord, reminder = false): Promise<void> {
    const config = await readNotifyConfig();
    if (!config) return;

    const message = buildMessage(wait, await projectName(wait), reminder);

    if (await this.postOnce(config, message)) return;
    await sleep(this.retryDelayMs);
    if (this.closed) return;
    if (await this.postOnce(config, message)) return;

    await appendEvent({
      v: 1,
      ts: new Date().toISOString(),
      type: 'push.failure',
      wait: wait.id,
      detail: `push to ${config.ntfy.url} failed twice${reminder ? ' (reminder)' : ''}`,
    });
  }

  private async postOnce(config: NotifyConfig, message: { title: string; body: string }): Promise<boolean> {
    try {
      const headers: Record<string, string> = { Title: message.title, Priority: '4' };
      if (config.ntfy.token) headers.Authorization = `Bearer ${config.ntfy.token}`;
      const url = config.ntfy.url.replace(/\/+$/, '') + '/' + config.ntfy.topic;
      const res = await fetch(url, { method: 'POST', headers, body: message.body });
      return res.ok;
    } catch {
      return false;
    }
  }
}
