import { describe, it, expect } from 'vitest';
import { routeForTask } from '../implementer-route.js';
import { loadRole } from '../step.js';

// Contract (design C5 "Implementer model route", R2 AC 1, 2, 3, 5, 7):
//
// S1 a `sensitive-path` item for the task gives the `sdd-implementer` profile
//    and the item's own reason (the Opus tier).
//    Pre: items holds one `sensitive-path` item whose `taskId` is the queried task.
//    Call: routeForTask(items, taskId).
//    Observable: { model, effort, reason } equal to loadRole('sdd-implementer')'s
//    model/effort and the item's `reason` string.
//    Source: design C5 Interfaces, `routeForTask`; R2 AC 2.
//
// S2 a `keyword`-only item for the task is ignored; the task takes the Sonnet
//    route (R2 AC 3: a keyword item never routes to the Opus tier).
//    Pre: items holds one `keyword` item for the task, no `sensitive-path` item.
//    Call: routeForTask(items, taskId).
//    Observable: { model, effort } equal to loadRole('sdd-test-author')'s
//    model/effort; reason is "no sensitive-path flag".
//    Source: design C5 Interfaces, `routeForTask`; R2 AC 1, 3, 7.
//
// S3 no items for any task gives the same Sonnet route (R2 AC 1: no
//    `sensitive-path` item for the task means the Sonnet route; R2 AC 5: no
//    `## Sensitive paths` list means `computeClassA` gives no path item, so
//    the items array class (a) returns is empty and every task takes this
//    route).
//    Pre: items is an empty array.
//    Call: routeForTask(items, taskId).
//    Observable: same as S2.
//    Source: design C5 Interfaces, `routeForTask`; R2 AC 1, 5, 7.
//
// S4 `null` (the class-a call failed) gives the `sdd-implementer` profile and
//    reason "class-a unavailable" (design D7, strict-path error handling).
//    Pre: items is `null`.
//    Call: routeForTask(null, taskId).
//    Observable: { model, effort } equal to loadRole('sdd-implementer')'s
//    model/effort; reason is "class-a unavailable".
//    Source: design C5 Interfaces, `routeForTask`; design Error Handling 1.
//
// S5 a `sensitive-path` item whose `taskId` is another task is ignored, so a
//    query with only such an item returns the Sonnet route (R2 AC 1: the
//    flag is per task, not per query).
//    Pre: items holds one `sensitive-path` item for a different taskId.
//    Call: routeForTask(items, taskId).
//    Observable: same as S2.
//    Source: design C5 Interfaces, `routeForTask`; R2 AC 1.

describe('routeForTask', () => {
  const implementer = loadRole('sdd-implementer');
  const testAuthor = loadRole('sdd-test-author');

  it('S1: a sensitive-path item for the task gives the sdd-implementer profile and its reason', () => {
    const items = [
      { taskId: '8', kind: 'sensitive-path', reason: 'touches src/tools/review-task.ts' },
    ];
    const route = routeForTask(items, '8');
    expect(route).toEqual({
      model: implementer.model,
      effort: implementer.effort,
      reason: 'touches src/tools/review-task.ts',
    });
  });

  it('S2: a keyword-only item for the task gives the sdd-test-author profile and "no sensitive-path flag"', () => {
    const items = [
      { taskId: '8', kind: 'keyword', reason: 'matched keyword "config"' },
    ];
    const route = routeForTask(items, '8');
    expect(route).toEqual({
      model: testAuthor.model,
      effort: testAuthor.effort,
      reason: 'no sensitive-path flag',
    });
  });

  it('S3: no items gives the sdd-test-author profile and "no sensitive-path flag"', () => {
    const route = routeForTask([], '8');
    expect(route).toEqual({
      model: testAuthor.model,
      effort: testAuthor.effort,
      reason: 'no sensitive-path flag',
    });
  });

  it('S4: null gives the sdd-implementer profile and "class-a unavailable"', () => {
    const route = routeForTask(null, '8');
    expect(route).toEqual({
      model: implementer.model,
      effort: implementer.effort,
      reason: 'class-a unavailable',
    });
  });

  it('S5: a sensitive-path item for another task is ignored, giving the sdd-test-author profile', () => {
    const items = [
      { taskId: '9', kind: 'sensitive-path', reason: 'touches harness/hooks/' },
    ];
    const route = routeForTask(items, '8');
    expect(route).toEqual({
      model: testAuthor.model,
      effort: testAuthor.effort,
      reason: 'no sensitive-path flag',
    });
  });
});
