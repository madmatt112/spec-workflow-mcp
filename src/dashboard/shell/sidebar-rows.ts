// src/dashboard/shell/sidebar-rows.ts
//
// Each listed project's sidebar dot, live-run count, last activity and sort
// position (design.md C9, Requirements 5, 6). Computed on the server from
// data the feed already reads: no new route, poll or topic.
import type { NowModel, ControllerWait, ControllerRun, SidebarProjectRow } from './types.js';

/** The server copy of `CTRL_LIVE_STATUSES` (NowPage.tsx:27). */
export const NOW_LIVE_STATUSES: readonly string[] = ['queued', 'running', 'merging', 'paused', 'waiting'];

/** Milliseconds of an ISO timestamp, or `null` when absent/unparsable. */
function ms(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? null : n;
}

export function buildSidebarRows(
  projects: { projectId: string; projectName: string }[],
  now: NowModel,
  waits: ControllerWait[],
  runs: ControllerRun[],
): SidebarProjectRow[] {
  const rows = projects.map(({ projectId, projectName }) => {
    const projectRuns = runs.filter((r) => r.project === projectId);

    let liveCount = projectRuns.filter((r) => NOW_LIVE_STATUSES.includes(r.status)).length;
    if (liveCount === 0) {
      liveCount = now.live.filter((l) => l.projectId === projectId).length;
    }

    const isWaiting = waits.some((w) => w.project === projectId && w.state === 'open')
      || now.waits.some((w) => w.projectId === projectId);
    const dot: SidebarProjectRow['dot'] = isWaiting ? 'waiting' : liveCount >= 1 ? 'running' : 'idle';

    let lastActivity: string | null = null;
    let lastActivityMs = -Infinity;
    for (const r of projectRuns) {
      const t = ms(r.updated);
      if (t !== null && t >= lastActivityMs) {
        lastActivityMs = t;
        lastActivity = r.updated;
      }
    }

    return { projectId, projectName, dot, liveCount, lastActivity };
  });

  rows.sort((a, b) => {
    const activeA = a.dot !== 'idle';
    const activeB = b.dot !== 'idle';
    if (activeA !== activeB) return activeA ? -1 : 1;

    const ta = ms(a.lastActivity);
    const tb = ms(b.lastActivity);
    if (ta !== tb) {
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    }

    const nameCmp = a.projectName.localeCompare(b.projectName);
    if (nameCmp !== 0) return nameCmp;
    return a.projectId.localeCompare(b.projectId);
  });

  return rows.map(({ projectId, dot, liveCount, lastActivity }) => ({ projectId, dot, liveCount, lastActivity }));
}
