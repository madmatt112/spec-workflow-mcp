// src/dashboard/harness/hub.ts
//
// The harness hub (design.md C7). It owns the per-project harness watches (C5)
// and the single overview watch (C6), starting one only while a page of its view
// is open and closing it when the last subscriber of that view leaves. The server
// calls `reconcile` after every subscription change and both removal paths; the
// hub forwards each watch's messages through the two view send callbacks so a
// harness push reaches only that project's harness subscribers and an overview
// push reaches only overview subscribers.
import type { ProjectManager } from '../project-manager.js';
import type { HarnessLauncher } from './launcher.js';
import { ProjectHarnessWatch } from './project-watch.js';
import { OverviewWatch } from './overview-watch.js';
import { ShellFeed } from '../shell/shell-feed.js';
import type { HarnessMessage } from './types.js';
import type { ShellMessage } from '../shell/types.js';

/** The connection fields reconcile reads (a subset of the server's WebSocketConnection). */
interface ViewClient {
  projectId?: string;
  views?: Set<'harness' | 'overview'>;
}

/**
 * The harness hub (design.md C7). `reconcile(clients)` counts the harness
 * subscribers of each project and the overview subscribers, starts a watch for
 * each count above zero with none running and closes each at zero. A launcher
 * `launch-update` or a project-manager `projects-update` refreshes the overview
 * watch only; a project watch owns its own log re-point (C5).
 */
export class HarnessHub {
  private readonly projectWatches = new Map<string, ProjectHarnessWatch>();
  private overviewWatch: OverviewWatch | null = null;
  private shellFeed: ShellFeed | null = null;
  private closed = false;

  constructor(
    private readonly projects: ProjectManager,
    private readonly launcher: HarnessLauncher,
    private readonly sendHarness: (m: HarnessMessage) => void,
    private readonly sendOverview: (m: HarnessMessage | ShellMessage) => void,
    private readonly opts: { debounceMs?: number } = {},
  ) {
    this.launcher.on('launch-update', this.onLaunchUpdate);
    this.projects.on('projects-update', this.onProjectsUpdate);
    this.projects.on('spec-change', this.onSourceChange);
    this.projects.on('deferral-change', this.onSourceChange);
  }

  /**
   * Start or stop watches so exactly the open views have one. Counts harness
   * subscribers per project and overview subscribers, starts a `ProjectHarnessWatch`
   * for each registered project whose count is above zero with none running, closes
   * each project watch at zero, and does the same for the one `OverviewWatch`. The
   * map/field entry is set before the `await` so two concurrent reconciles cannot
   * both start the same watch.
   */
  async reconcile(clients: Iterable<ViewClient>): Promise<void> {
    if (this.closed) return;
    const harnessCounts = new Map<string, number>();
    let overviewCount = 0;
    for (const c of clients) {
      if (!c.views) continue;
      if (c.projectId && c.views.has('harness')) {
        harnessCounts.set(c.projectId, (harnessCounts.get(c.projectId) ?? 0) + 1);
      }
      if (c.views.has('overview')) overviewCount++;
    }

    // Start a harness watch for each registered project that now has subscribers.
    for (const project of this.projects.getAllProjects()) {
      const count = harnessCounts.get(project.projectId) ?? 0;
      if (count > 0 && !this.projectWatches.has(project.projectId)) {
        const watch = new ProjectHarnessWatch(project, this.launcher, this.sendHarness, this.opts);
        this.projectWatches.set(project.projectId, watch);
        await watch.start();
      }
    }
    // Close every project watch whose count fell to zero (or whose project is gone).
    for (const [projectId, watch] of [...this.projectWatches]) {
      if ((harnessCounts.get(projectId) ?? 0) === 0) {
        watch.close();
        this.projectWatches.delete(projectId);
      }
    }

    // The one overview watch and its shell feed: start above zero, close at
    // zero (design C7). The feed is created before the watch and torn down with
    // it; the watch's send callback forwards every message to `sendOverview` and
    // re-arms the feed on each `overview-rows` it emits. Both fields are set
    // before the `await` so two concurrent reconciles cannot double-start.
    if (overviewCount > 0 && !this.overviewWatch) {
      const feed = new ShellFeed(this.projects, this.launcher, this.sendOverview);
      this.shellFeed = feed;
      const watch = new OverviewWatch(this.projects, (m) => {
        this.sendOverview(m);
        if (m.type === 'overview-rows') feed.schedule();
      }, this.opts);
      this.overviewWatch = watch;
      await feed.start();
      await watch.start();
    } else if (overviewCount === 0 && this.overviewWatch) {
      this.overviewWatch.close();
      this.overviewWatch = null;
      this.shellFeed?.close();
      this.shellFeed = null;
    }
  }

  /** The harness snapshot for a project, or `[]` when no watch runs for it. */
  snapshotFor(projectId: string): HarnessMessage[] {
    return this.projectWatches.get(projectId)?.snapshot() ?? [];
  }

  /** The overview snapshot plus the shell feed's last pair, or `[]` when idle. */
  overviewSnapshot(): (HarnessMessage | ShellMessage)[] {
    return [
      ...(this.overviewWatch?.snapshot() ?? []),
      ...(this.shellFeed?.snapshot() ?? []),
    ];
  }

  /** Test accessor: the project ids with a live harness watch (tasks D12). */
  watchedProjects(): string[] {
    return [...this.projectWatches.keys()];
  }

  /** Test accessor: whether the overview watch is live (tasks D12). */
  overviewActive(): boolean {
    return this.overviewWatch !== null;
  }

  /** Close every watch and drop the launcher/project-manager listeners. */
  close(): void {
    this.closed = true;
    this.launcher.removeListener('launch-update', this.onLaunchUpdate);
    this.projects.removeListener('projects-update', this.onProjectsUpdate);
    this.projects.removeListener('spec-change', this.onSourceChange);
    this.projects.removeListener('deferral-change', this.onSourceChange);
    for (const watch of this.projectWatches.values()) watch.close();
    this.projectWatches.clear();
    this.overviewWatch?.close();
    this.overviewWatch = null;
    this.shellFeed?.close();
    this.shellFeed = null;
  }

  // A new launch re-points its project watch's log inside that watch (C5); the hub
  // refreshes the overview so a run's state change shows there too, and re-arms the
  // shell feed so its Now model picks up the launch (C7).
  private onLaunchUpdate = (): void => {
    this.overviewWatch?.refresh();
    this.shellFeed?.schedule();
  };

  private onProjectsUpdate = (): void => {
    this.overviewWatch?.refresh();
  };

  // A spec-document or deferral change re-arms the shell feed so its Specs rows
  // and Now model recompute (C7); the overview watch owns its own file triggers.
  private onSourceChange = (): void => {
    this.shellFeed?.schedule();
  };
}
