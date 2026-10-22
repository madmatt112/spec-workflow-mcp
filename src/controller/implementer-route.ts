// src/controller/implementer-route.ts
//
// The implementer model route (design C5, R2 AC 1-3, 5, 7). Given the class (a)
// items for a run (the `sensitive-path` / `keyword` flags `computeClassA`
// produces) and a task id, `routeForTask` picks the model and effort the task's
// implementer steps run at: the Opus `sdd-implementer` profile when the task has
// a `sensitive-path` flag or the class-a call failed, else the Sonnet
// `sdd-test-author` profile. The module is pure; both profiles come from
// `loadRole`, never literal model strings.
import { loadRole } from './step.js';

/** The model, effort and human-readable reason for a task's implementer steps. */
export interface ImplementerRoute {
  model: string;
  effort: string;
  reason: string;
}

/** A class (a) item from `computeClassA`: a per-task sensitivity flag. */
type ClassAItem = { taskId: string; kind: string; reason: string };

/**
 * Picks the implementer route for `taskId` from the class (a) `items`.
 *
 * - The first `sensitive-path` item for the task gives the `sdd-implementer`
 *   profile and the item's own `reason` (R2 AC 2). `keyword` items are ignored
 *   (R2 AC 3), as are `sensitive-path` items for other tasks (R2 AC 1).
 * - No matching item gives the `sdd-test-author` profile and `no sensitive-path
 *   flag` (R2 AC 1, 5, 7).
 * - `null` (the class-a call failed) takes the strict path (design D7): the
 *   `sdd-implementer` profile and `class-a unavailable`.
 */
export function routeForTask(items: ClassAItem[] | null, taskId: string): ImplementerRoute {
  if (items === null) {
    const impl = loadRole('sdd-implementer');
    return { model: impl.model, effort: impl.effort, reason: 'class-a unavailable' };
  }
  const sensitive = items.find((item) => item.taskId === taskId && item.kind === 'sensitive-path');
  if (sensitive) {
    const impl = loadRole('sdd-implementer');
    return { model: impl.model, effort: impl.effort, reason: sensitive.reason };
  }
  const author = loadRole('sdd-test-author');
  return { model: author.model, effort: author.effort, reason: 'no sensitive-path flag' };
}
