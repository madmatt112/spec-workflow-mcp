// src/dashboard/harness/overview-watch.ts
//
// The Overview watch (design.md C6). One watcher set feeds every Overview client
// the per-project rows, pushed on change (Req 5). The pure `buildOverviewRow`
// reads a project's HANDOFF and its resolved spec ledger; `OverviewWatch` watches
// the pointer file and each project's HANDOFF and row ledger, and pushes
// `overview-rows` on change.
import { readFileSync } from 'fs';
import { once } from 'events';
import { join, relative, isAbsolute } from 'path';
import chokidar from 'chokidar';
import { buildModel, parseJsonl } from '../../watch/ledger.js';
import type { LedgerEvent } from '../../watch/ledger.js';
import { handoffPath } from '../../watch/index.js';
import { parseHandoffRouting } from './project-watch.js';
import { listRunsSync } from '../../controller/state.js';
import type { RunRecord } from '../../controller/state.js';
import { runEvents } from '../../controller/runs.js';
import { liveRunsByProject } from '../shell/live-runs.js';
import type { ProjectContext, ProjectManager } from '../project-manager.js';
import type { HarnessMessage, OverviewRow } from './types.js';

/** The four-file watch options shared with the TUI watch (src/watch/index.ts:101-104). */
const WATCH_OPTS = {
  ignoreInitial: true,
  persistent: true,
  ignorePermissionErrors: true,
  awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
} as const;

type FSWatcher = ReturnType<typeof chokidar.watch>;

function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return undefined;
  }
}

/** Milliseconds of a timestamp; a missing or unparsable value sorts first (0). */
function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/** True when `target` resolves inside `dir` (not equal, not an ancestor). */
function isInside(dir: string, target: string): boolean {
  const rel = relative(dir, target);
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
}

/** A note whose text mentions gate A or gate B, case-insensitively. */
function mentionsGate(text: string | undefined): boolean {
  if (!text) return false;
  return /gate a/i.test(text) || /gate b/i.test(text);
}

/**
 * The newest ledger row that qualifies as the row's `lastRow`: any `phase.start`
 * or `phase.end` (its text is the phase and result), or a `note` whose text
 * mentions a gate (Req 5.1). Null when no row qualifies.
 */
function newestLastRow(sorted: LedgerEvent[]): OverviewRow['lastRow'] {
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    if (e.type === 'phase.start' || e.type === 'phase.end') {
      return { ts: e.ts, type: e.type, text: `${e.phase ?? ''} ${e.result ?? ''}`.trim() };
    }
    if (e.type === 'note' && mentionsGate(e.text)) {
      return { ts: e.ts, type: e.type, text: e.text ?? '' };
    }
  }
  return null;
}

/**
 * Requirements D7 / Req 5.3: among the rows of the last `run.start`'s run (all
 * rows when there is none), the newest `phase.end` has result `gate-a`,
 * `retro-ready` or `escalate` and no `phase.start` follows it.
 */
function computeWaiting(sorted: LedgerEvent[]): boolean {
  const runStart = [...sorted].reverse().find((e) => e.type === 'run.start');
  const runId = runStart?.run;
  const runEvents = runId ? sorted.filter((e) => e.run === runId) : sorted;
  let lastEndIdx = -1;
  for (let i = runEvents.length - 1; i >= 0; i--) {
    if (runEvents[i].type === 'phase.end') { lastEndIdx = i; break; }
  }
  if (lastEndIdx === -1) return false;
  const result = runEvents[lastEndIdx].result;
  if (result !== 'gate-a' && result !== 'retro-ready' && result !== 'escalate') return false;
  for (let i = lastEndIdx + 1; i < runEvents.length; i++) {
    if (runEvents[i].type === 'phase.start') return false;
  }
  return true;
}

/**
 * One Overview row for a project (design.md C6). The project's live controller
 * run makes the row `running` with its spec and run id; otherwise it is `idle`
 * with the HANDOFF routing spec and a null run id (Req 5.2). From that spec's `harness-events.jsonl`:
 * `lastRow` is the newest phase or gate row, `livePhase` is `buildModel`'s live
 * phase (else the HANDOFF phase), `waiting` applies requirements D7, and
 * `newestTs` is the newest row's timestamp.
 */
export function buildOverviewRow(project: ProjectContext, live: Pick<RunRecord, 'spec' | 'id'> | undefined): OverviewRow {
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  const routing = parseHandoffRouting(readIfExists(handoffPath(workflowRoot)));

  let state: 'running' | 'idle';
  let spec: string | null;
  let runId: string | null;
  let specDir: string | null;

  if (live) {
    state = 'running';
    spec = live.spec;
    runId = live.id;
    specDir = join(specsDir, live.spec);
  } else {
    state = 'idle';
    spec = routing?.spec ?? null;
    runId = null;
    specDir = spec ? join(specsDir, spec) : null;
  }

  const ledger = specDir
    ? parseJsonl<LedgerEvent>(readIfExists(join(specDir, 'harness-events.jsonl')))
    : [];
  const sorted = [...ledger].sort((a, b) => ms(a.ts) - ms(b.ts));

  let livePhase: string | null = null;
  if (spec) livePhase = buildModel({ spec, ledger, activity: [] }).livePhase?.phase ?? null;
  if (!livePhase) livePhase = routing?.phase ?? null;

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    state,
    spec,
    livePhase,
    runId,
    lastRow: newestLastRow(sorted),
    newestTs: sorted.length ? sorted[sorted.length - 1].ts : null,
    waiting: computeWaiting(sorted),
  };
}

/**
 * The Overview watch (design.md C6). One watcher set — the controller's run
 * records (through `runEvents`) and each project's HANDOFF and resolved row
 * ledger — feeds every Overview client. A run or HANDOFF change recomputes the
 * ledger set and pushes `overview-rows`; a ledger change pushes `overview-rows`. `snapshot()` returns that message;
 * `close()` stops the watchers and timers.
 */
export class OverviewWatch {
  private readonly debounceMs: number;
  private closed = false;

  private handoffWatcher?: FSWatcher;     // each project's HANDOFF
  private ledgerWatcher?: FSWatcher;      // each project's resolved row ledger

  private timer?: NodeJS.Timeout;
  private rowsDirty = false;
  private reArmLedgers = false;

  constructor(
    private readonly projects: ProjectManager,
    private readonly send: (m: HarnessMessage) => void,
    opts: { debounceMs?: number } = {},
  ) {
    this.debounceMs = opts.debounceMs ?? 300;
  }

  /**
   * Subscribe to the controller's run changes, arm the file watchers, wait for
   * their initial scan, then push the rows.
   */
  async start(): Promise<void> {
    runEvents.on('change', this.onRuns);
    this.armHandoffs();
    this.armLedgers();
    await this.whenReady();
    this.pushRows();
  }

  /** The current rows, recomputed from disk (design.md C6). */
  snapshot(): HarnessMessage[] {
    return [
      { type: 'overview-rows', data: { rows: this.buildRows() } },
    ];
  }

  /** Re-arm the watch set (projects may have changed) and push the rows. */
  refresh(): void {
    if (this.closed) return;
    this.armHandoffs();
    this.armLedgers();
    this.pushRows();
  }

  /** Close every watcher and clear the debounce timer. */
  close(): void {
    this.closed = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    runEvents.removeListener('change', this.onRuns);
    void this.handoffWatcher?.close();
    void this.ledgerWatcher?.close();
    this.handoffWatcher = undefined;
    this.ledgerWatcher = undefined;
  }

  private async whenReady(): Promise<void> {
    const waits: Promise<unknown>[] = [];
    for (const w of [this.handoffWatcher, this.ledgerWatcher]) {
      if (w) waits.push(once(w, 'ready'));
    }
    await Promise.all(waits);
  }

  private buildRows(): OverviewRow[] {
    const live = liveRunsByProject(listRunsSync());
    return this.projects.getAllProjects().map((p) => buildOverviewRow(p, live.get(p.projectId)));
  }

  private handoffPaths(): string[] {
    return this.projects.getAllProjects().map((p) => handoffPath(join(p.projectPath, '.spec-workflow')));
  }

  private ledgerPaths(): string[] {
    const live = liveRunsByProject(listRunsSync());
    const paths: string[] = [];
    for (const project of this.projects.getAllProjects()) {
      const workflowRoot = join(project.projectPath, '.spec-workflow');
      const specsDir = join(workflowRoot, 'specs');
      const spec = live.get(project.projectId)?.spec
        ?? parseHandoffRouting(readIfExists(handoffPath(workflowRoot)))?.spec ?? null;
      if (spec) paths.push(join(specsDir, spec, 'harness-events.jsonl'));
    }
    return paths;
  }

  private armHandoffs(): void {
    void this.handoffWatcher?.close();
    this.handoffWatcher = chokidar.watch(this.handoffPaths(), WATCH_OPTS);
    this.handoffWatcher.on('add', this.onStructure).on('change', this.onStructure).on('unlink', this.onStructure);
  }

  private armLedgers(): void {
    void this.ledgerWatcher?.close();
    this.ledgerWatcher = undefined;
    // chokidar 3.6.0 never emits `ready` for an empty path list, which would hang
    // whenReady(); skip the watcher when no project resolves to a ledger.
    const paths = this.ledgerPaths();
    if (paths.length === 0) return;
    this.ledgerWatcher = chokidar.watch(paths, WATCH_OPTS);
    this.ledgerWatcher.on('add', this.onLedger).on('change', this.onLedger).on('unlink', this.onLedger);
  }

  // A controller run record changed (a run started, moved phase or ended): the
  // row's running/idle state and its ledger path may have changed with it.
  private onRuns = (): void => {
    if (this.closed) return;
    this.rowsDirty = true;
    this.reArmLedgers = true;
    this.schedule();
  };

  private onStructure = (): void => {
    if (this.closed) return;
    this.rowsDirty = true;
    this.reArmLedgers = true;
    this.schedule();
  };

  private onLedger = (): void => {
    if (this.closed) return;
    this.rowsDirty = true;
    this.schedule();
  };

  private schedule(): void {
    if (this.closed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.flush, this.debounceMs);
  }

  private flush = (): void => {
    this.timer = undefined;
    if (this.closed) return;
    if (this.reArmLedgers) { this.reArmLedgers = false; this.armLedgers(); }
    if (this.rowsDirty) { this.rowsDirty = false; this.pushRows(); }
  };

  private pushRows(): void {
    this.send({ type: 'overview-rows', data: { rows: this.buildRows() } });
  }
}
