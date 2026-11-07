# Adversarial Review Memory — tasks

Last updated: 2026-11-06 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none

### Partially Accepted
- none

### Rejected
- none

### Unresolved
- **R1-1 (MINOR, Novel)** — Dependency-order line omits real edges `3→8` and `5→8`
  (task 8 reads `branchPresent`/`discardAllowed`/`launchableOrder`) and overstates
  `10→11` (task 11 does not wire `useStages`; task 12 does). Harmless: number order is a
  valid topological sort and governs the sequential implementer.
- **R1-2 (MINOR, Novel)** — The "suites go red at task 11" claim is one task late: task 9's
  `pause.ts` string flip makes `worktree-shell.spec.ts:468/:553` latently red. No effect:
  those suites are not run until tasks 20–22.
- **R1-3 (MINOR, Novel)** — R6 AC 5 (green dot within 15 s of Re-drive) is tagged only on
  docs task 23, not on the mechanism tasks 1/13/14. Mechanism traced and satisfied
  (spawn→stepStarted→change push→runDot green within the 1 s throttle); live-only by D50.

## Patterns & Themes
- Document is unusually precise: every code citation checked (both ends) was accurate,
  including the lint-pass prose-path expansions (47, all cosmetic). Coverage is complete
  (every AC → task, every C-component → task). No new deps, no gate-b/gate-c, no security
  or data surface.
- The only soft spot is the informal **dependency-chain annotation** vs the governing
  "run in number order" rule: the chain under- and over-states edges but cannot misdirect
  the sequential implementer.

## Guidance for Next Review
- The lint pass was clean; do not re-verify the 47 path expansions. Re-check only lines a
  future revision commit touches.
- If a reviser edits the dependency line, confirm number order stays a valid topological
  sort (no backward edge: no task may need a higher-numbered task).
- Do not re-open R1-1/R1-2/R1-3 as SHOULD_FIX without new evidence that number order or a
  per-task green contract actually breaks — all three are MINOR and non-loop-keeping.
- Closed requirements rulings live in requirements Revision History (v2/v3): R12 AC1/AC2,
  R4 AC1 — do not relitigate.
