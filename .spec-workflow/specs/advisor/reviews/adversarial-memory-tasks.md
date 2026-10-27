# Adversarial Review Memory — tasks

Last updated: 2026-10-26 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet

### Partially Accepted
- none yet

### Rejected
- none yet

### Unresolved
- **R1-1 (SHOULD_FIX)** — The `controller-actions` live-update path to the browser is owned by no task. Task 17's File list is `NowPage.tsx` only, yet it must render a staged group "updated from the controller-actions feed message"; the carrying plumbing (frontend `ShellMessage` union in `src/dashboard_frontend/src/modules/shell/types.ts`, the `subscribe`/`controllerActions` state/`ShellContextType` field in `ShellProvider.tsx`) is in neither task 12's nor task 17's File list. With D5 giving task 17 no frontend test, a fetch-only implementation ships silently. `grep controllerActions src/dashboard_frontend` = empty today.
- **R1-2 (MINOR)** — Task 12 adds `controller-actions` to `shell-feed.ts:122`'s `ShellMessage[]` but omits `src/dashboard/shell/types.ts` (server union, line 212) from its File list; the `tsc` gate forces the edit, so compiler-caught.
- **R1-3 (MINOR)** — Task 3 exports an opinion-status setter but asserts it only indirectly; first exercised in task 14's `Success:`.

## Patterns & Themes
- Citation accuracy is high: every structural anchor checked (access.ts, controller.ts, state.ts, waits.ts, step.ts, merge.ts, ledger.ts, index.ts, NowPage.tsx, both count-change greps, retro finding format) is correct.
- The one weak spot is cross-file UI wiring for *new* feed messages: the drafter correctly handled fields that ride existing records (the opinion on the wait) but under-scoped the all-new `controller-actions` message's browser consumption path. File lists are treated as authoritative elsewhere (task 3 lists all four files), so omissions there are real gaps, not convention.

## Guidance for Next Review
- If v2 adds the frontend plumbing to a task, scope the fix-induced re-check to that task's File list and prompt against R1-1 — do not re-review the whole document.
- Re-confirm the server `ShellMessage` union file landed in task 12's File list (R1-2).
- Do not re-open: all structural citations are verified accurate; do not re-litigate them without new evidence.
- Fresh lenses not yet used: data-model field-level coverage (do the `StagedAction`/`HomeEvent`/`AdvisorSummary` shapes each have a task that writes every field?); test-fixture realism (stub-gh/stub-claude coverage of executor branches).
