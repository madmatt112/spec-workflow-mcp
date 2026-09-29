// src/dashboard/harness/project-watch.ts
//
// The per-project harness watch (design.md C5). The two pure parsers below are
// shared by the setup view (task 4) and the `ProjectHarnessWatch` class (task 7);
// the parsers import nothing from the dashboard server.
import { openSync, closeSync, readSync, fstatSync } from 'fs';
import { once } from 'events';
import { join } from 'path';
import chokidar from 'chokidar';
import {
  parseHandoffActiveSpec, buildModel, parseJsonl, AGENT_PROFILES,
} from '../../watch/ledger.js';
import type { LedgerEvent, ActivityEvent, RunModel } from '../../watch/ledger.js';
import { resolveSpec, handoffPath } from '../../watch/index.js';
import type { ProjectContext } from '../project-manager.js';
import type { HarnessLauncher } from './launcher.js';
import type { HandoffRouting, HarnessMessage, LaunchRecord } from './types.js';

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
 * subscribers the run model, gates and log lines that `--watch` would show
 * (Req 6.2). The spec is `resolveSpec` on the project's `.spec-workflow`; a
 * change to the ledger, activity, `tasks.md`, HANDOFF, `questions.md` or the
 * launch log schedules one rebuild after `debounceMs`. A HANDOFF that names
 * another spec re-targets the spec-file watches. Only a `launch-update` whose
 * `logPath` differs (a new launch) resets the log offset and sends a
 * `reset: true` batch; a within-run stop, exit or finalise resets nothing.
 */
export class ProjectHarnessWatch {
  private readonly workflowRoot: string;
  private readonly debounceMs: number;

  private spec: string | null = null;
  private specWatcher?: FSWatcher;
  private logWatcher?: FSWatcher;
  private rebuildTimer?: NodeJS.Timeout;
  private closed = false;

  private logPath: string | null = null;
  private launchedAt: string | null = null;
  private logOffset = 0;
  private logTail = '';
  private keptLines: string[] = [];

  private lastModel: RunModel | null = null;
  private lastGates: GateData | null = null;

  constructor(
    private readonly project: ProjectContext,
    private readonly launcher: HarnessLauncher,
    private readonly send: (m: HarnessMessage) => void,
    opts: { debounceMs?: number } = {},
  ) {
    this.workflowRoot = join(project.projectPath, '.spec-workflow');
    this.debounceMs = opts.debounceMs ?? 300;
  }

  /** Resolve the spec, watch its files and the launch, and rebuild once at once. */
  async start(): Promise<void> {
    this.spec = this.resolveSpecSafe();
    this.armSpecWatch();
    this.launcher.on('launch-update', this.onLaunchUpdate);
    const record = this.launcher.get(this.project.projectId);
    if (record) this.armLogWatch(record, false);
    // A chokidar watcher only reports changes after its initial scan; wait for
    // that so a change made right after start() is not swallowed as baseline.
    await this.whenWatchersReady();
    this.rebuild();
  }

  private async whenWatchersReady(): Promise<void> {
    const waits: Promise<unknown>[] = [];
    if (this.specWatcher) waits.push(once(this.specWatcher, 'ready'));
    if (this.logWatcher) waits.push(once(this.logWatcher, 'ready'));
    await Promise.all(waits);
  }

  /** The model, the gates and, when a launch exists, the kept log lines with `reset: true`. */
  snapshot(): HarnessMessage[] {
    const projectId = this.project.projectId;
    const msgs: HarnessMessage[] = [
      {
        type: 'harness-model',
        projectId,
        data: { spec: this.spec, model: this.lastModel, profiles: AGENT_PROFILES, launch: this.launcher.get(projectId) },
      },
      {
        type: 'harness-gates',
        projectId,
        data: this.lastGates ?? { spec: this.spec, gateA: null, gateB: null },
      },
    ];
    if (this.logPath !== null && this.launchedAt !== null) {
      msgs.push({ type: 'harness-log', projectId, data: { launchedAt: this.launchedAt, lines: [...this.keptLines], reset: true } });
    }
    return msgs;
  }

  /** Close the watchers, clear timers and remove the launcher listener. */
  close(): void {
    this.closed = true;
    if (this.rebuildTimer) { clearTimeout(this.rebuildTimer); this.rebuildTimer = undefined; }
    this.launcher.removeListener('launch-update', this.onLaunchUpdate);
    void this.specWatcher?.close();
    void this.logWatcher?.close();
    this.specWatcher = undefined;
    this.logWatcher = undefined;
  }

  private resolveSpecSafe(): string | null {
    try {
      return resolveSpec(this.workflowRoot);
    } catch {
      return null;
    }
  }

  private armSpecWatch(): void {
    void this.specWatcher?.close();
    const paths = [handoffPath(this.workflowRoot)];
    if (this.spec) {
      const specDir = join(this.workflowRoot, 'specs', this.spec);
      paths.push(
        join(specDir, 'harness-events.jsonl'),
        join(specDir, 'harness-activity.jsonl'),
        join(specDir, 'tasks.md'),
        join(specDir, 'questions.md'),
      );
    }
    this.specWatcher = chokidar.watch(paths, WATCH_OPTS);
    this.specWatcher.on('add', this.schedule).on('change', this.schedule).on('unlink', this.schedule);
  }

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

    const launch = this.launcher.get(projectId);
    let model: RunModel | null = null;
    let gates = { gateA: null as string | null, gateB: null as string | null };
    if (this.spec) {
      const specDir = join(this.workflowRoot, 'specs', this.spec);
      model = buildModel({
        spec: this.spec,
        ledger: parseJsonl<LedgerEvent>(readIfExists(join(specDir, 'harness-events.jsonl'))),
        activity: parseJsonl<ActivityEvent>(readIfExists(join(specDir, 'harness-activity.jsonl'))),
        tasksMd: readIfExists(join(specDir, 'tasks.md')),
        handoffMd: readIfExists(handoffPath(this.workflowRoot)),
      });
      gates = parseGateSections(readIfExists(join(specDir, 'questions.md')));
      // Req 3.6: adopt the run id once the model's run started at or after this
      // launch and the record does not already carry it.
      if (model.runId && model.runStartedAt && launch &&
          model.runStartedAt >= launch.launchedAt && launch.runId !== model.runId) {
        this.launcher.noteRunId(projectId, model.runId);
      }
    }

    this.lastModel = model;
    this.lastGates = { spec: this.spec, gateA: gates.gateA, gateB: gates.gateB };
    this.send({ type: 'harness-model', projectId, data: { spec: this.spec, model, profiles: AGENT_PROFILES, launch } });
    this.send({ type: 'harness-gates', projectId, data: this.lastGates });
  }

  private onLaunchUpdate = (record: LaunchRecord): void => {
    if (this.closed) return;
    if (!record || record.projectId !== this.project.projectId) return;
    this.schedule();
    // Only a new launch (a changed logPath) resets the log; a within-run stop,
    // exit or finalise leaves logPath unchanged and resets nothing (design C5).
    if (record.logPath !== this.logPath) {
      const current = this.launcher.get(this.project.projectId);
      if (current) this.armLogWatch(current, true);
    }
  };

  private armLogWatch(record: LaunchRecord, sendReset: boolean): void {
    void this.logWatcher?.close();
    this.logPath = record.logPath;
    this.launchedAt = record.launchedAt;
    this.logOffset = 0;
    this.logTail = '';
    this.keptLines = [];
    const lines = this.readNewLogLines();
    if (lines.length) { this.keptLines.push(...lines); this.trimKept(); }
    if (sendReset) {
      this.send({ type: 'harness-log', projectId: this.project.projectId, data: { launchedAt: this.launchedAt, lines, reset: true } });
    }
    this.logWatcher = chokidar.watch(this.logPath, WATCH_OPTS);
    this.logWatcher.on('add', this.onLogChange).on('change', this.onLogChange);
  }

  private onLogChange = (): void => {
    if (this.closed || this.launchedAt === null) return;
    const lines = this.readNewLogLines();
    if (!lines.length) return;
    this.keptLines.push(...lines);
    this.trimKept();
    this.send({ type: 'harness-log', projectId: this.project.projectId, data: { launchedAt: this.launchedAt, lines, reset: false } });
  };

  /** Complete lines appended past the byte offset; a partial tail waits for its newline. */
  private readNewLogLines(): string[] {
    if (this.logPath === null) return [];
    let chunk: string;
    try {
      const fd = openSync(this.logPath, 'r');
      try {
        const size = fstatSync(fd).size;
        if (size < this.logOffset) this.logOffset = 0; // truncated: read from the start
        const len = size - this.logOffset;
        if (len <= 0) return [];
        const buf = Buffer.alloc(len);
        readSync(fd, buf, 0, len, this.logOffset);
        this.logOffset = size;
        chunk = buf.toString('utf-8');
      } finally {
        closeSync(fd);
      }
    } catch {
      return [];
    }
    const parts = (this.logTail + chunk).split('\n');
    this.logTail = parts.pop() ?? '';
    return parts;
  }

  private trimKept(): void {
    if (this.keptLines.length > 200) this.keptLines = this.keptLines.slice(-200);
  }
}
