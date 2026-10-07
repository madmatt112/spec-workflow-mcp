// src/dashboard/shell/shell-feed.ts
//
// The shell feed (design.md C7). One recompute of the Now model and the Specs
// rows on every trigger and every `tickMs`, so a quiet wait shows even with no
// file event (Requirement 2 AC 6, design D3, D4). `schedule` arms one
// non-resetting `throttleMs` timer, so a steady trigger stream still flushes
// within one throttle window (design D3, Requirement 2 AC 9). The feed adds no
// file watcher (Requirement 8 AC 2); it reads only through the task-3 and task-4
// builders and the shared pointer file.
import { readPointer, pointerPath } from '../harness/state-files.js';
import type { ProjectManager } from '../project-manager.js';
import type { HarnessLauncher } from '../harness/launcher.js';
import { buildNowModel } from './now-model.js';
import { buildSpecRows } from './spec-rows.js';
import { FileCache } from './file-cache.js';
import type { ShellMessage, SpecListRow } from './types.js';

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
    private readonly launcher: HarnessLauncher,
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
   * One recompute: read the pointer once, run the Now builder over every project
   * and the Specs-row builder per project (a project whose rows throw is left out
   * and logged once), keep the pair and send `shell-now` then `shell-specs`.
   */
  private flush = async (): Promise<void> => {
    this.timer = undefined;
    if (this.closed) return;

    const pointers = readPointer(pointerPath());
    const now = this.now();
    const projects = this.projects.getAllProjects();

    const nowModel = await buildNowModel(projects, pointers, (id) => this.launcher.get(id), now, this.cache);

    const rows: SpecListRow[] = [];
    for (const project of projects) {
      try {
        rows.push(...(await buildSpecRows(project, pointers, this.cache)));
      } catch (err) {
        console.error(`ShellFeed: skipping spec rows for project ${project.projectId}`, err);
      }
    }

    if (this.closed) return;
    const pair: ShellMessage[] = [
      { type: 'shell-now', data: nowModel },
      { type: 'shell-specs', data: { rows } },
    ];
    this.last = pair;
    this.send(pair[0]);
    this.send(pair[1]);
  };
}
