// src/dashboard/shell/shell-feed.ts
//
// The shell feed (design.md C7). One recompute of the Now model and the Specs
// rows on every trigger and every `tickMs`, so a quiet wait shows even with no
// file event (Requirement 2 AC 6, design D3, D4). `schedule` arms one
// non-resetting `throttleMs` timer, so a steady trigger stream still flushes
// within one throttle window (design D3, Requirement 2 AC 9). The feed adds no
// file watcher (Requirement 8 AC 2); it reads only through the task-3 and task-4
// builders and the controller's run records.
import type { ProjectManager } from '../project-manager.js';
import { listRunsSync } from '../../controller/state.js';
import { liveRunsByProject } from './live-runs.js';
import { buildNowModel } from './now-model.js';
import { buildSpecRows } from './spec-rows.js';
import { groupByStore } from './store-groups.js';
import { FileCache } from './file-cache.js';
import { listWaitsForWire } from '../../controller/waits.js';
import { listRunsForWire } from '../../controller/runs.js';
import { listActivityForWire } from '../../controller/activity.js';
import { listActions } from '../../advisor/actions.js';
import type { StagedAction } from '../../advisor/actions.js';
import type {
  ShellMessage, SpecListRow, ControllerWait, ControllerRun, ControllerActivity,
} from './types.js';

export class ShellFeed {
  private readonly throttleMs: number;
  private readonly tickMs: number;
  private readonly now: () => number;
  private readonly cache = new FileCache();

  private timer?: NodeJS.Timeout;
  private tick?: NodeJS.Timeout;
  private closed = false;
  private last: ShellMessage[] = [];

  constructor(
    private readonly projects: ProjectManager,
    private readonly send: (m: ShellMessage) => void,
    opts: { throttleMs?: number; tickMs?: number; now?: () => number } = {},
  ) {
    this.throttleMs = opts.throttleMs ?? 1000;
    this.tickMs = opts.tickMs ?? 30000;
    this.now = opts.now ?? Date.now;
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
   * One recompute: read the run records once, run the Now builder over every project
   * and the Specs-row builder once per `.spec-workflow` store, over that store's
   * representative project (a group whose rows throw is left out and logged
   * once), read the controller waits, runs, latest-per-run
   * activity and the advisor's staged actions, keep the sextet and send
   * `shell-now`, `shell-specs`, `controller-waits`, `controller-runs`,
   * `controller-activity` then `controller-actions`. The controller topics
   * ride the same broadcast path as the other shell topics (T4/T6/T10;
   * controller-design.md §7, §4; design C8).
   */
  private flush = async (): Promise<void> => {
    this.timer = undefined;
    if (this.closed) return;

    const liveRuns = liveRunsByProject(listRunsSync());
    const now = this.now();
    const projects = this.projects.getAllProjects();

    const nowModel = await buildNowModel(projects, liveRuns, now, this.cache);

    const rows: SpecListRow[] = [];
    for (const group of groupByStore(projects)) {
      const liveProject = group.projects.find((p) => liveRuns.has(p.projectId));
      const liveSpec = liveProject ? liveRuns.get(liveProject.projectId)?.spec ?? null : null;
      try {
        rows.push(...(await buildSpecRows(group.representative, liveSpec, this.cache)));
      } catch (err) {
        console.error(`ShellFeed: skipping spec rows for project ${group.representative.projectId}`, err);
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
      runs = (await listRunsForWire()) as ControllerRun[];
    } catch (err) {
      console.error('ShellFeed: skipping controller runs', err);
    }

    let activity: ControllerActivity[] = [];
    try {
      activity = listActivityForWire() as ControllerActivity[];
    } catch (err) {
      console.error('ShellFeed: skipping controller activity', err);
    }

    let actions: StagedAction[] = [];
    try {
      actions = await listActions();
    } catch (err) {
      console.error('ShellFeed: skipping controller actions', err);
    }

    if (this.closed) return;
    const messages: ShellMessage[] = [
      { type: 'shell-now', data: nowModel },
      { type: 'shell-specs', data: { rows } },
      { type: 'controller-waits', data: { waits } },
      { type: 'controller-runs', data: { runs } },
      { type: 'controller-activity', data: { activity } },
      { type: 'controller-actions', data: { actions } },
    ];
    this.last = messages;
    for (const m of messages) this.send(m);
  };
}
