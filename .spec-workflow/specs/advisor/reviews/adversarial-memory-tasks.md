# Adversarial Review Memory — tasks

Last updated: 2026-10-26 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX)** — the `controller-actions` live-update path to the browser was owned by no task. Fixed in v2: task 17 File list adds `dashboard_frontend/.../types.ts` + `ShellProvider.tsx`; prompt names the union member, subscription, `controllerActions` state, `ShellContextType` field, read via `useShell()`. Re-checked v2: CLOSED.
- **R1-2 (MINOR)** — task 12 omitted the server `ShellMessage` union file (`src/dashboard/shell/types.ts`). Fixed in v2: added to File list + prompt, grep narrowed to `src/dashboard`. Re-checked v2: CLOSED, split verified clean.

### Partially Accepted
- **R1-3 (MINOR)** — task 3's opinion-status setter asserted only indirectly. v2: task 3 Success now asserts the setter serialises through the per-wait queue beside a concurrent answer; first downstream use stays in task 14 (allowed). CLOSED.

### Rejected
- none

### Unresolved
- none

## Patterns & Themes
- Citation accuracy remains high through v2: every delta citation verified accurate at both ends (server union 207-212, frontend union 224-229, `ShellContextType` 22-32, `controllerActivity` state 64, subscribe block 99-104).
- The one recurring weak class is silent frontend drift (D5 = no frontend unit test): the fix for R1-1 removed the structural gap; the residual (M2-1, frontend staged-action hand-copy shape not named) is tsc-forced to exist and path-safe, so it collapses to the accepted project-wide "keep hand copies in step" convention.
- `StagedAction` confirmed path-free (design.md:111-120) — no wire/path-leak concern in the `controller-actions` feed.

## Guidance for Next Review
- v2 is clean: MUST_FIX 0, SHOULD_FIX 0. Only M2-1 (MINOR) open — do not escalate it to a loop-keeper without new evidence.
- Do not re-open: all delta citations verified accurate; the task 12/17 ordering (unsubscribed type ignored between tasks) is sound; grep narrowing split is clean.
- If a later version renames or re-shapes `StagedAction`, re-check the frontend hand-copy drift (M2-1) and the server feed payload type.
- Fresh lenses still unused: test-fixture realism (stub-gh/stub-claude branch coverage in tasks 11/14/19).
