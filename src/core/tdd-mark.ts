/**
 * The single TDD-routing predicate (retro F5/P5). The controller
 * (`src/controller/phases/implementation.ts`) and the brief tool
 * (`src/tools/harness.ts`) both decide the same routing — does a task with a
 * `- Test:` seam go to the test author, or is it implementer-only? — so they
 * import this one predicate rather than each applying its own rule. When they
 * disagreed, a `kind: e2e` task crashed the implementer brief with
 * "required values 'authorFiles', 'authorReport' missing".
 *
 * Pure module, no I/O; `core` never imports `controller` or `tools`.
 */
import type { ParsedTask } from './task-parser.js';

/**
 * The `kind: e2e` marker, anchored to its own line in the task block (retro F4/P4):
 * a standalone `kind: e2e` line (optionally a `- `/`* ` bullet), never an inline
 * mention or a code-span quote inside prose. The block-wide match it replaces flipped
 * a real TDD task whenever prose merely quoted the marker.
 */
export const E2E_MARKER_RE = /^\s*[-*]?\s*kind:\s*e2e\b/im;

/**
 * Is this a `[-]`/`[ ]` task whose `- Test:` seam routes it to the test author? A
 * task with a seam is TDD-marked unless its block carries a standalone `kind: e2e`
 * marker line; prose that merely quotes the marker does not route (retro F4/P4).
 */
export function isTddMarked(task: ParsedTask, block: string): boolean {
  if (!task.tests || task.tests.length === 0) return false;
  return !E2E_MARKER_RE.test(block);
}
