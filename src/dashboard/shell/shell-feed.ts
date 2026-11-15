// src/dashboard/shell/shell-feed.ts
//
// The shell feed (design.md C6/C7). One recompute of the Specs blocks on
// every trigger and every `tickMs`, so a quiet wait shows even with no file
// event (Requirement 2 AC 6, design D3, D4). `schedule` arms one
// non-resetting `throttleMs` timer, so a steady trigger stream still flushes
// within one throttle window (design D3, Requirement 2 AC 9). The feed adds
// no file watcher (Requirement 8 AC 2); it reads only through the task-4
// builder and the controller's run records.
import type { ProjectManager } from '../project-manager.js';
import { listRunsSync } from '../../controller/state.js';
import type { RunRecord } from '../../controller/state.js';
import { liveRunsByProject } from './live-runs.js';
import { buildSpecBlock } from './spec-rows.js';
import { groupByStore } from './store-groups.js';
import { FileCache } from './file-cache.js';
import { listWaitsForWire } from '../../controller/waits.js';
import { listRunsForWire } from '../../controller/runs.js';
import { listActions } from '../../advisor/actions.js';
import type { StagedAction } from '../../advisor/actions.js';
import { readDeployForWireSync } from '../../controller/deploy.js';
import type { ControllerDeploy } from '../../controller/deploy.js';
import type {
  ShellMessage, SpecBlock, ControllerWait, ControllerRun,
} from './types.js';

export class ShellFeed {
  private readonly throttleMs: number;
  private readonly tickMs: number;
  private readonly now: () => number;
  private readonly drivenRuns?: () => ReadonlySet<string>;
  private readonly cache = new FileCache();

  private timer?: NodeJS.Timeout;
  private tick?: NodeJS.Timeout;
  private closed = false;
  private last: ShellMessage[] = [];

  constructor(
    private readonly projects: ProjectManager,
    private readonly send: (m: ShellMessage) => void,
    opts: { throttleMs?: number; tickMs?: number; now?: () => number; drivenRuns?: () => ReadonlySet<string> } = {},
  ) {
    this.throttleMs = opts.throttleMs ?? 1000;
    this.tickMs = opts.tickMs ?? 30000;
    this.now = opts.now ?? Date.now;
    this.drivenRuns = opts.drivenRuns;
  }

  /** Compute and send both messages once, then arm the tick interval. */
  async start(): Promise<void> {
    await this.flush();
    if (this.closed) return;
    this.tick = setInterval(() => this.schedule(), this.tickMs);
  }

  /**
   * Arm one `throttleMs` timer only when none is armed; never reset an armed one
   * (design D3, Requirement 2 AC 9), so a steady trigger stream still flushes.
   */
  schedule(): void {
    if (this.closed || this.timer) return;
    this.timer = setTimeout(() => { void this.flush(); }, this.throttleMs);
  }

  /** The last sent pair, or `[]` before the first flush. */
  snapshot(): ShellMessage[] {
    return this.last;
  }

  /** Clear both timers; no send follows. */
  close(): void {
    this.closed = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    if (this.tick) { clearInterval(this.tick); this.tick = undefined; }
  }

  /**
   * One recompute: read the run records once, run the Specs block builder
   * once per `.spec-workflow` store, over that store's representative
   * project with the live runs of every member (design D24; a group whose
   * block throws is left out and logged once), read the controller waits,
   * runs, the advisor's staged actions and the deploy record, keep the five
   * topics and send `shell-specs`, `controller-waits`, `controller-runs`,
   * `controller-actions` then `controller-deploy` (design C5/C6). The
   * controller topics ride the same broadcast path as the other shell topics
   * (T4/T6; controller-design.md §7; design C8).
   */
  private flush = async (): Promise<void> => {
    this.timer = undefined;
    if (this.closed) return;

    const liveRuns = liveRunsByProject(listRunsSync());
    const projects = this.projects.getAllProjects();

    const blocks: SpecBlock[] = [];
    for (const group of groupByStore(projects)) {
      const groupLiveRuns = group.projects
        .map((p) => liveRuns.get(p.projectId))
        .filter((r): r is RunRecord => r !== undefined);
      try {
        blocks.push(await buildSpecBlock(group.representative, groupLiveRuns, this.cache));
      } catch (err) {
        console.error(`ShellFeed: skipping spec block for project ${group.representative.projectId}`, err);
      }
    }

    let waits: ControllerWait[] = [];
    try {
      waits = (await listWaitsForWire()) as ControllerWait[];
    } catch (err) {
      console.error('ShellFeed: skipping controller waits', err);
    }

    let runs: ControllerRun[] = [];
    try {
      runs = (await listRunsForWire(this.drivenRuns?.())) as ControllerRun[];
    } catch (err) {
      console.error('ShellFeed: skipping controller runs', err);
    }

    let actions: StagedAction[] = [];
    try {
      actions = await listActions();
    } catch (err) {
      console.error('ShellFeed: skipping controller actions', err);
    }

    if (this.closed) return;
    const deploy = readDeployForWireSync();
    const messages: ShellMessage[] = [
      { type: 'shell-specs', data: { blocks } },
      { type: 'controller-waits', data: { waits } },
      { type: 'controller-runs', data: { runs } },
      { type: 'controller-actions', data: { actions } },
      { type: 'controller-deploy', data: { deploy } },
    ];
    this.last = messages;
    for (const m of messages) this.send(m);
  };

  /**
   * Send `controller-deploy` for `deploy` at once, outside the flush/throttle
   * cycle, and replace that message in `last` so `snapshot()` holds the new
   * value in place (design D18). A no-op once closed.
   */
  pushDeploy(deploy: ControllerDeploy | null): void {
    if (this.closed) return;
    const message: ShellMessage = { type: 'controller-deploy', data: { deploy } };
    this.last = this.last.map((m) => (m.type === 'controller-deploy' ? message : m));
    this.send(message);
  }
}
