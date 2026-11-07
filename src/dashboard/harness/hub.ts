// src/dashboard/harness/hub.ts
//
// The harness hub (design.md C7). It owns the single overview watch (C6),
// starting it only while a page of the overview view is open and closing it
// when the last overview subscriber leaves. The server calls `reconcile`
// after every subscription change and both removal paths; the hub forwards
// the watch's messages through the overview send callback.
import type { ProjectManager } from '../project-manager.js';
import { OverviewWatch } from './overview-watch.js';
import { ShellFeed } from '../shell/shell-feed.js';
import { waitEvents } from '../../controller/waits.js';
import { runEvents } from '../../controller/runs.js';
import { actionEvents } from '../../advisor/actions.js';
import { deployEvents } from '../../controller/deploy.js';
import type { ControllerDeploy } from '../../controller/deploy.js';
import type { HarnessMessage } from './types.js';
import type { ShellMessage } from '../shell/types.js';

/** The connection fields reconcile reads (a subset of the server's WebSocketConnection). */
interface ViewClient {
  projectId?: string;
  views?: Set<'overview'>;
}

/**
 * The harness hub (design.md C7). `reconcile(clients)` counts the overview
 * subscribers, starting the one overview watch above zero and closing it at
 * zero. A launcher `launch-update` or a project-manager `projects-update`
 * refreshes the overview watch.
 */
export class HarnessHub {
  private overviewWatch: OverviewWatch | null = null;
  private shellFeed: ShellFeed | null = null;
  private closed = false;

  constructor(
    private readonly projects: ProjectManager,
    private readonly sendOverview: (m: HarnessMessage | ShellMessage) => void,
    private readonly opts: { debounceMs?: number; drivenRuns?: () => ReadonlySet<string> } = {},
  ) {
    this.projects.on('projects-update', this.onProjectsUpdate);
    this.projects.on('spec-change', this.onSourceChange);
    this.projects.on('deferral-change', this.onSourceChange);
    waitEvents.on('change', this.onSourceChange);
    runEvents.on('change', this.onSourceChange);
    actionEvents.on('change', this.onSourceChange);
    deployEvents.on('change', this.onDeployChange);
  }

  /**
   * Start or stop the one overview watch so it runs exactly while the
   * overview view is open. The field is set before the `await` so two
   * concurrent reconciles cannot both start it.
   */
  async reconcile(clients: Iterable<ViewClient>): Promise<void> {
    if (this.closed) return;
    let overviewCount = 0;
    for (const c of clients) {
      if (!c.views) continue;
      if (c.views.has('overview')) overviewCount++;
    }

    // The one overview watch and its shell feed: start above zero, close at
    // zero (design C7). The feed is created before the watch and torn down with
    // it; the watch's send callback forwards every message to `sendOverview` and
    // re-arms the feed on each `overview-rows` it emits. Both fields are set
    // before the `await` so two concurrent reconciles cannot double-start.
    if (overviewCount > 0 && !this.overviewWatch) {
      const feed = new ShellFeed(this.projects, this.sendOverview, { drivenRuns: this.opts.drivenRuns });
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

  /** The overview snapshot plus the shell feed's last pair, or `[]` when idle. */
  overviewSnapshot(): (HarnessMessage | ShellMessage)[] {
    return [
      ...(this.overviewWatch?.snapshot() ?? []),
      ...(this.shellFeed?.snapshot() ?? []),
    ];
  }

  /** Test accessor: whether the overview watch is live (tasks D12). */
  overviewActive(): boolean {
    return this.overviewWatch !== null;
  }

  /** Close the overview watch and drop the project-manager and controller listeners. */
  close(): void {
    this.closed = true;
    this.projects.removeListener('projects-update', this.onProjectsUpdate);
    this.projects.removeListener('spec-change', this.onSourceChange);
    this.projects.removeListener('deferral-change', this.onSourceChange);
    waitEvents.removeListener('change', this.onSourceChange);
    runEvents.removeListener('change', this.onSourceChange);
    actionEvents.removeListener('change', this.onSourceChange);
    deployEvents.removeListener('change', this.onDeployChange);
    this.overviewWatch?.close();
    this.overviewWatch = null;
    this.shellFeed?.close();
    this.shellFeed = null;
  }

  private onProjectsUpdate = (): void => {
    this.overviewWatch?.refresh();
  };

  // A spec-document, deferral, controller-wait, controller-run or
  // advisor-action change re-arms the shell feed so its Specs rows,
  // controller waits, runs and actions recompute (C7; T4/T6; design C8); the
  // overview watch owns its own file triggers.
  private onSourceChange = (): void => {
    this.shellFeed?.schedule();
  };

  /** A deploy record change pushes `controller-deploy` at once (C7, D18, NFR Performance). */
  private onDeployChange = (deploy: ControllerDeploy | null): void => {
    this.shellFeed?.pushDeploy(deploy);
  };
}
