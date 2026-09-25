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

// --- Component 1: gate-B keyword-saturation fallback (retro P15) -------------

/**
 * Verbs that destroy production data. When the class-(a) keyword net saturates
 * (retro P15) only tasks whose block carries one of these survive. Kept beside
 * `CLASS_A_KEYWORDS` so a retrospective tunes both in one place.
 */
export const DESTRUCTIVE_VERBS: RegExp =
  /\b(?:drop(?:s|ped|ping)?|truncat(?:e|es|ed|ing|ion)?|purg(?:e|es|ed|ing)?|hard[-\s]?delet\w*)\b/i;

/**
 * The fraction of keyword-matched tasks above which the class-(a) keyword net is
 * treated as non-discriminating (retro P15). "More than 60%" is a strict `>`.
 */
export const KEYWORD_SATURATION = 0.6;

/**
 * The gate-B keyword-saturation fallback (retro P15). When more than
 * `KEYWORD_SATURATION` of the tasks matched at least one class-(a) keyword the
 * net has stopped discriminating, so drop every keyword item and instead flag
 * only tasks whose block carries a destructive verb against production data
 * (drop, truncate, purge, hard-delete). Sensitive-path items are untouched. At
 * or below the threshold `items` is returned unchanged. The result stays sorted
 * by `score` descending, path items ahead of keyword items.
 */
export function applyKeywordSaturationFallback(
  items: ClassAItem[],
  tasks: TaskVetoInput[]
): ClassAItem[] {
  if (tasks.length === 0) return items;
  const keywordTaskIds = new Set(
    items.filter((i) => i.kind === 'keyword').map((i) => i.taskId)
  );
  if (keywordTaskIds.size / tasks.length <= KEYWORD_SATURATION) return items;

  const kept = items.filter((i) => i.kind !== 'keyword');
  const destructive: ClassAItem[] = [];
  for (const task of tasks) {
    const match = task.block.match(DESTRUCTIVE_VERBS);
    if (match) {
      destructive.push({
        taskId: task.id,
        title: task.title,
        kind: 'keyword',
        reason: `destructive: ${match[0].toLowerCase()}`,
        score: 1,
      });
    }
  }
  return [...kept, ...destructive].sort((a, b) => b.score - a.score);
}
