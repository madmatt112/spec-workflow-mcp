/**
 * Veto rules: the pure gate-B class (a) module (design Component 1,
 * requirements 4.2, 4.4, 4.5; NFR Reliability).
 *
 * One module so a retrospective can tune every class-(a) keyword and the path
 * match in one place, mirroring `gate-rules.ts`. Pure functions only, no I/O:
 * `core` never imports `tools`. Class (a) reuses `isSensitivePath` but
 * deliberately does not reuse `gate-rules.ts`'s `NO_LIST_REASON` "every path is
 * sensitive" convention, which would flood the veto list (requirement 4.5).
 */
import { isSensitivePath } from './gate-rules.js';

// --- Component 1: tunable class-(a) keyword patterns ------------------------

/**
 * The six tunable action-keyword patterns class (a) scans each task block for
 * (D7 of requirements): migration, delete/drop, auth, billing, config, external
 * write. Kept here beside the reused gate-rules predicates so a retrospective
 * tunes them in one place.
 */
export const CLASS_A_KEYWORDS: Record<string, RegExp> = {
  migration: /\bmigrat\w*/i,
  delete: /\b(?:delet|drop)\w*/i,
  auth: /\bauth\w*/i,
  billing: /\bbill(?:ing)?\b/i,
  config: /\bconfig\w*/i,
  'external-write': /\bexternal\s+writ\w*/i,
};

// --- Component 1: types -----------------------------------------------------

/** One task's inputs to class (a): its id, title, declared files and block. */
export type TaskVetoInput = {
  id: string;
  title: string;
  files: string[];
  block: string;
};

/**
 * A computed class-(a) item. `score` is `2` for a `sensitive-path` item and `1`
 * for a `keyword` item — the only ranking input class (a) contributes to the
 * orchestrator's cross-class ordering (D5).
 */
export type ClassAItem = {
  taskId: string;
  title: string;
  kind: 'sensitive-path' | 'keyword';
  reason: string;
  score: number;
};

// --- Component 1: computation ----------------------------------------------

/**
 * Compute gate-B class (a). For each task: when `sensitive` is a list, push one
 * `sensitive-path` item (score 2) if any declared file matches `isSensitivePath`;
 * always scan `block` for each keyword and push a `keyword` item (score 1) per
 * match. When `sensitive` is `null`, push no path item (empty match, requirement
 * 4.5) yet still scan keywords, never emitting `gate-rules.ts`'s `NO_LIST_REASON`.
 * Returns the items sorted by `score` descending (path-matches before keywords).
 */
export function computeClassA(
  tasks: TaskVetoInput[],
  sensitive: string[] | null
): ClassAItem[] {
  const items: ClassAItem[] = [];

  for (const task of tasks) {
    if (sensitive !== null) {
      const match = task.files.find((f) => isSensitivePath(f, sensitive));
      if (match !== undefined) {
        items.push({
          taskId: task.id,
          title: task.title,
          kind: 'sensitive-path',
          reason: `sensitive-path: ${match}`,
          score: 2,
        });
      }
    }

    for (const [name, pattern] of Object.entries(CLASS_A_KEYWORDS)) {
      if (pattern.test(task.block)) {
        items.push({
          taskId: task.id,
          title: task.title,
          kind: 'keyword',
          reason: `keyword: ${name}`,
          score: 1,
        });
      }
    }
  }

  // Stable sort keeps insertion order within a score, so path items stay in task
  // order ahead of the keyword items, also in task order.
  return items.sort((a, b) => b.score - a.score);
}
