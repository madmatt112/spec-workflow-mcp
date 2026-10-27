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
// then POSTed with exactly `kind`, `project`, `spec` and `dashboardUrl` — no
// question text, advice, file content or path (NFR Security). A failed POST
// retries once after `retryDelayMs`, then logs one `push.failure` row; the
// wait and the run are unaffected. Each write to `pushed.json` drops ids whose
// wait file is gone. No `push.json` means no send.
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { once } from 'events';
import chokidar from 'chokidar';
import { controllerHome, readWait, writeJsonAtomic, type WaitRecord } from '../controller/state.js';
import { listOpenWaits } from '../controller/waits.js';
import { pushConfigPath, pushedPath, appendEvent } from './home.js';

/** The four-file watch options shared with `src/dashboard/harness/overview-watch.ts:24-29`. */
const WATCH_OPTS = {
  ignoreInitial: true,
  persistent: true,
  ignorePermissionErrors: true,
  awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
} as const;

const DEFAULT_RETRY_DELAY_MS = 60_000;

interface PushConfig {
  v: 1;
  url: string;
  dashboardUrl: string;
}

interface PushedFile {
  v: 1;
  ids: string[];
}

export interface WaitPusherOptions {
  /** Delay before the one retry; the production default is one minute (10.5). */
  retryDelayMs?: number;
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

/** An unreadable `push.json` counts as absent (no config, no send). */
async function readPushConfig(): Promise<PushConfig | undefined> {
  try {
    return JSON.parse(await fs.readFile(pushConfigPath(), 'utf-8')) as PushConfig;
  } catch {
    return undefined;
  }
}

/**
 * Read `pushed.json`. Returns `undefined` when it is missing or fails to
 * parse — an unreadable file counts as absent, same as a missing one (error
 * handling #8), not as a valid file with zero ids.
 */
async function readPushedIdsRaw(): Promise<Set<string> | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(pushedPath(), 'utf-8')) as PushedFile;
    return new Set(parsed.ids);
  } catch {
    return undefined;
  }
}

async function readPushedIds(): Promise<Set<string>> {
  return (await readPushedIdsRaw()) ?? new Set();
}

/** Write `pushed.json` atomically, first dropping any id whose wait file is gone. */
async function writePushedIds(ids: Set<string>): Promise<void> {
  const pruned: string[] = [];
  for (const id of ids) {
    if (await fileExists(waitPath(id))) pruned.push(id);
  }
  const file: PushedFile = { v: 1, ids: pruned };
  await writeJsonAtomic(pushedPath(), file);
}

/** `WaitPusher { start(); stop() }` (design C11). */
export class WaitPusher {
  private readonly retryDelayMs: number;
  private watcher?: FSWatcher;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(opts: WaitPusherOptions = {}) {
    this.retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  /** Arm the `waits/` watch, then run the start-up scan (D2, D3) through the same queue. */
  async start(): Promise<void> {
    this.watcher = chokidar.watch(waitsDir(), WATCH_OPTS);
    this.watcher.on('add', this.onFile).on('change', this.onFile);
    await once(this.watcher, 'ready');

    await this.enqueue(() => this.runStartupScan());
  }

  stop(): void {
    this.closed = true;
    void this.watcher?.close();
    this.watcher = undefined;
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

  /** D3: no readable `pushed.json` -> record every open id, push none; else push each open wait not recorded. */
  private async runStartupScan(): Promise<void> {
    if (this.closed) return;
    const existingPushedIds = await readPushedIdsRaw();
    const openWaits = await listOpenWaits();

    if (!existingPushedIds) {
      await writePushedIds(new Set(openWaits.map((w) => w.id)));
      return;
    }

    const pushedIds = existingPushedIds;
    for (const wait of openWaits) {
      if (this.closed) return;
      if (pushedIds.has(wait.id)) continue;
      pushedIds.add(wait.id);
      await writePushedIds(pushedIds);
      await this.attemptPush(wait);
    }
  }

  private async handleWait(id: string): Promise<void> {
    if (this.closed) return;
    const pushedIds = await readPushedIds();
    if (pushedIds.has(id)) return;

    const wait = await readWait(id);
    if (!wait || wait.state !== 'open') return;

    pushedIds.add(id);
    await writePushedIds(pushedIds);
    await this.attemptPush(wait);
  }

  private async attemptPush(wait: WaitRecord): Promise<void> {
    const config = await readPushConfig();
    if (!config) return;

    if (await this.postOnce(config, wait)) return;
    await sleep(this.retryDelayMs);
    if (this.closed) return;
    if (await this.postOnce(config, wait)) return;

    await appendEvent({
      v: 1,
      ts: new Date().toISOString(),
      type: 'push.failure',
      wait: wait.id,
      detail: `push to ${config.url} failed twice`,
    });
  }

  private async postOnce(config: PushConfig, wait: WaitRecord): Promise<boolean> {
    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: wait.kind, project: wait.project, spec: wait.spec, dashboardUrl: config.dashboardUrl }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
