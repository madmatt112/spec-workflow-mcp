// src/controller/activity.ts
//
// T10 of the controller (docs/controller-tasks.md "T10 `dashboard`",
// controller-design.md §4 "A step", §6). The live step-activity feed the Run
// page's "Live now" line reads. A step fires `onActivity` for each assistant
// tool_use (step.ts); the controller forwards it here as one
// `{ runId, stepId, role, tool, inputSummary, ts }` record. Only the latest
// record per run is kept, so a connecting dashboard gets a bounded snapshot and
// each new record re-arms the shell feed (hub.ts) to push `controller-activity`.
//
// No model runs here; this is a tiny in-memory relay, the memory rule's
// "deterministic code for mechanics".
import { EventEmitter } from 'events';

/** One assistant tool_use, enriched with the run and step it belongs to. */
export interface ControllerActivity {
  runId: string;
  stepId: string;
  /** The role (agent name) the step runs, e.g. `sdd-drafter`. */
  role: string;
  tool: string;
  inputSummary: string;
  /** The assistant message timestamp, when the stream carried one. */
  ts?: string;
}

/** Emits `activity` with a {@link ControllerActivity} after each record. */
export const activityEvents = new EventEmitter();

// The latest activity per run. Bounded by the number of runs; a finished run's
// entry is dropped by `clearRunActivity`.
const latest = new Map<string, ControllerActivity>();

/** Record one step's activity as the latest for its run and emit `activity`. */
export function recordActivity(activity: ControllerActivity): void {
  latest.set(activity.runId, activity);
  activityEvents.emit('activity', activity);
}

/** The latest activity per run — the snapshot the shell feed sends. */
export function listActivityForWire(): ControllerActivity[] {
  return [...latest.values()];
}

/** Drop a run's activity once it ends, so the snapshot never grows unbounded. */
export function clearRunActivity(runId: string): void {
  latest.delete(runId);
}

/** Test seam: forget every recorded activity. */
export function _resetActivityForTests(): void {
  latest.clear();
}
