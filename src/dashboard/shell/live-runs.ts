// src/dashboard/shell/live-runs.ts
//
// The controller's run records are the one source of "which project has a run
// live" since step (d) of the foundation rework replaced the supervisor's
// active-run pointer. A run is live while its status is neither `done` nor
// `abandoned`; a project with several such records (a crash left one behind)
// shows its newest.
import type { RunRecord } from '../../controller/state.js';

export function liveRunsByProject(runs: RunRecord[]): Map<string, RunRecord> {
  const out = new Map<string, RunRecord>();
  for (const run of runs) {
    if (run.status === 'done' || run.status === 'abandoned') continue;
    const current = out.get(run.project);
    if (!current || run.created > current.created) out.set(run.project, run);
  }
  return out;
}
