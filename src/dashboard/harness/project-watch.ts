// src/dashboard/harness/project-watch.ts
//
// The per-project harness watch (design.md C5). The two pure parsers below are
// shared by the setup view (task 4) and the `ProjectHarnessWatch` class (task 7);
// the parsers import nothing from the dashboard server.
import { openSync, closeSync, readSync, fstatSync } from 'fs';
import { once } from 'events';
import { join, dirname, basename } from 'path';
import chokidar from 'chokidar';
import {
  parseHandoffActiveSpec, buildModel, parseJsonl, AGENT_PROFILES,
} from '../../watch/ledger.js';
import type { LedgerEvent, ActivityEvent, RunModel } from '../../watch/ledger.js';
import { resolveSpec, handoffPath } from '../../watch/index.js';
import { buildRunDetail } from '../shell/run-detail.js';
import type { RunDetail } from '../shell/types.js';
import type { ProjectContext } from '../project-manager.js';
import type { HandoffRouting, HarnessMessage } from './types.js';

/**
 * The HANDOFF routing header, or null when the document names no active spec.
 * `spec` comes from `parseHandoffActiveSpec` (src/watch/ledger.ts:219-223).
 * `phase`, `state` and `result` come from the live-phase line of
 * harness/skills/sdd-continue/references/formats.md:76 (`Live phase **X**,
 * state **Y**, last result **Z**.`, with or without the leading `> ` marker);
 * each is null when the line or its field is missing.
 */
export function parseHandoffRouting(md: string | undefined): HandoffRouting | null {
  const spec = parseHandoffActiveSpec(md);
  if (!spec) return null;
  const field = (re: RegExp): string | null => {
    const m = md!.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    spec,
    phase: field(/Live phase \*\*([^*]+)\*\*/),
    state: field(/state \*\*([^*]+)\*\*/),
    result: field(/last result \*\*([^*]+)\*\*/),
  };
}

/** The trimmed body under a `## Gate A`/`## Gate B` heading, to the next `## ` heading. */
function gateSection(md: string, gate: 'A' | 'B'): string | null {
  const heading = `## Gate ${gate}`;
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.trim() === heading);
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    body.push(lines[i]);
  }
  const text = body.join('\n').trim();
  return text.length ? text : null;
}

/**
 * The `## Gate A` and `## Gate B` sections of a questions file. Each is the
 * trimmed text under its heading up to the next `## ` heading (or end of
 * input), and null when the heading or the input is missing.
 */
export function parseGateSections(md: string | undefined): { gateA: string | null; gateB: string | null } {
  if (!md) return { gateA: null, gateB: null };
  return { gateA: gateSection(md, 'A'), gateB: gateSection(md, 'B') };
}

/** The four-file watch options of the TUI watch (src/watch/index.ts:101-104). */
const WATCH_OPTS = {
  ignoreInitial: true,
  persistent: true,
  ignorePermissionErrors: true,
  awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
} as const;

/**
 * The spec-directory files and the HANDOFF whose change schedules a rebuild.
 * The watch is on the containing directory, so an event is filtered by basename.
 */
const WATCHED_FILES = new Set([
  'harness-events.jsonl', 'harness-activity.jsonl', 'tasks.md', 'questions.md', 'HANDOFF.md',
]);

/** The read-if-exists helper renderOnce uses (src/watch/index.ts:26-32). */
function readIfExists(path: string): string | undefined {
  try {
    return readSyncText(path);
  } catch {
    return undefined;
  }
}

function readSyncText(path: string): string {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const buf = Buffer.alloc(size);
    readSync(fd, buf, 0, size, 0);
    return buf.toString('utf-8');
  } finally {
    closeSync(fd);
  }
}

type FSWatcher = ReturnType<typeof chokidar.watch>;

interface GateData { spec: string | null; gateA: string | null; gateB: string | null }

/**
 * The per-project harness watch (design.md C5). It gives a project's harness
 * subscribers the run model and gates that `--watch` would show (Req 6.2). The
 * spec is `resolveSpec` on the project's `.spec-workflow`; a change to the
 * ledger, activity, `tasks.md`, HANDOFF or `questions.md` schedules one rebuild
 * after `debounceMs`. A HANDOFF that names another spec re-targets the
 * spec-file watches. The supervisor's launch log went with step (d); a step's
 * stream log is read through the controller's run log route.
 */
export class ProjectHarnessWatch {
  private readonly workflowRoot: string;
  private readonly debounceMs: number;

  private spec: string | null = null;
  private handoffWatcher?: FSWatcher;
  private specWatcher?: FSWatcher;
  private rebuildTimer?: NodeJS.Timeout;
  private closed = false;

  private lastModel: RunModel | null = null;
  private lastGates: GateData | null = null;
  private lastDetail: RunDetail | null = null;

  constructor(
    private readonly project: ProjectContext,
    private readonly send: (m: HarnessMessage) => void,
    opts: { debounceMs?: number } = {},
  ) {
    this.workflowRoot = join(project.projectPath, '.spec-workflow');
    this.debounceMs = opts.debounceMs ?? 300;
  }

  /** Resolve the spec, watch its files, and rebuild once at once. */
  async start(): Promise<void> {
    this.spec = this.resolveSpecSafe();
    this.armSpecWatch();
    // A chokidar watcher only reports changes after its initial scan; wait for
    // that so a change made right after start() is not swallowed as baseline.
    await this.whenWatchersReady();
    this.rebuild();
  }

  private async whenWatchersReady(): Promise<void> {
    const waits: Promise<unknown>[] = [];
    if (this.handoffWatcher) waits.push(once(this.handoffWatcher, 'ready'));
    if (this.specWatcher) waits.push(once(this.specWatcher, 'ready'));
    await Promise.all(waits);
  }

  /** The model, the gates and the run detail. */
  snapshot(): HarnessMessage[] {
    const projectId = this.project.projectId;
    const msgs: HarnessMessage[] = [
      {
        type: 'harness-model',
        projectId,
        data: { spec: this.spec, model: this.lastModel, profiles: AGENT_PROFILES },
      },
      {
        type: 'harness-gates',
        projectId,
        data: this.lastGates ?? { spec: this.spec, gateA: null, gateB: null },
      },
      { type: 'harness-run-detail', projectId, data: this.lastDetail },
    ];
    return msgs;
  }

  /** Close the watchers and clear timers. */
  close(): void {
    this.closed = true;
    if (this.rebuildTimer) { clearTimeout(this.rebuildTimer); this.rebuildTimer = undefined; }
    void this.handoffWatcher?.close();
    void this.specWatcher?.close();
    this.handoffWatcher = undefined;
    this.specWatcher = undefined;
  }

  private resolveSpecSafe(): string | null {
    try {
      return resolveSpec(this.workflowRoot);
    } catch {
      return null;
    }
  }

  private armSpecWatch(): void {
    void this.handoffWatcher?.close();
    void this.specWatcher?.close();
    this.specWatcher = undefined;
    // Watch the containing directories (not the file paths) and filter by
    // filename, the pattern OverviewWatch.armState uses (overview-watch.ts):
    // chokidar 3.6.0 does not report the first creation of a single file path
    // that never existed, so a ledger, activity, tasks.md or questions.md
    // created after start() would be missed. A depth-0 directory watch sees that
    // first creation at once.
    const handoff = handoffPath(this.workflowRoot);
    this.handoffWatcher = chokidar.watch(dirname(handoff), { ...WATCH_OPTS, depth: 0 });
    this.handoffWatcher.on('add', this.onWatchedFile).on('change', this.onWatchedFile).on('unlink', this.onWatchedFile);
    if (this.spec) {
      const specDir = join(this.workflowRoot, 'specs', this.spec);
      this.specWatcher = chokidar.watch(specDir, { ...WATCH_OPTS, depth: 0 });
      this.specWatcher.on('add', this.onWatchedFile).on('change', this.onWatchedFile).on('unlink', this.onWatchedFile);
    }
  }

  /** Schedule a rebuild only for the ledger, activity, tasks, questions or HANDOFF file. */
  private onWatchedFile = (changedPath: string): void => {
    if (WATCHED_FILES.has(basename(changedPath))) this.schedule();
  };

  private schedule = (): void => {
    if (this.closed) return;
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => { this.rebuildTimer = undefined; this.rebuild(); }, this.debounceMs);
  };

  private rebuild(): void {
    if (this.closed) return;
    const projectId = this.project.projectId;

    // A HANDOFF that names another spec re-targets the spec-file watches.
    const nextSpec = this.resolveSpecSafe();
    if (nextSpec !== this.spec) {
      this.spec = nextSpec;
      this.armSpecWatch();
    }

    let model: RunModel | null = null;
    let detail: RunDetail | null = null;
    let gates = { gateA: null as string | null, gateB: null as string | null };
    if (this.spec) {
      const specDir = join(this.workflowRoot, 'specs', this.spec);
      // Parse the ledger and activity once; both builders read the same arrays.
      const ledger = parseJsonl<LedgerEvent>(readIfExists(join(specDir, 'harness-events.jsonl')));
      const activity = parseJsonl<ActivityEvent>(readIfExists(join(specDir, 'harness-activity.jsonl')));
      const handoffMd = readIfExists(handoffPath(this.workflowRoot));
      model = buildModel({
        spec: this.spec,
        ledger,
        activity,
        tasksMd: readIfExists(join(specDir, 'tasks.md')),
        handoffMd,
      });
      detail = buildRunDetail({ spec: this.spec, ledger, activity, handoffMd });
      gates = parseGateSections(readIfExists(join(specDir, 'questions.md')));
    }

    this.lastModel = model;
    this.lastDetail = detail;
    this.lastGates = { spec: this.spec, gateA: gates.gateA, gateB: gates.gateB };
    this.send({ type: 'harness-model', projectId, data: { spec: this.spec, model, profiles: AGENT_PROFILES } });
    this.send({ type: 'harness-gates', projectId, data: this.lastGates });
    this.send({ type: 'harness-run-detail', projectId, data: detail });
  }

}
