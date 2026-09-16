# Adversarial Review Memory — tasks
Last updated: 2026-09-15 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-2 (SHOULD_FIX, v1)** — Task 7 bundled ~7 edits under sync/schema checks that read no
  content. Fixed in v2: per-skill grep done-conditions + a task5/task7 same-PR release guard.
  (Fix is real but incomplete — see R2-1.)
- **R1-3 (MINOR, v1)** — Intro called tasks 5/6 "independent". Fixed in v2: "build-independent
  — task 6 handles the events task 5 writes".

### Partially Accepted
- **R1-1 (SHOULD_FIX, v1)** — Unenumerated brief-template set. v2 pinned the task3→task7
  name contract (stable `template` name passed verbatim, checked by a grep done-condition);
  templates still not enumerated by name but the check now fails loud at task-7 time. The
  "reconcile five vs seven" half was rejected: Component 5's seven = hook-detection axis;
  D2's five = template set (recorded in Scope note). Adequate as of v2.

### Rejected
- "Reconcile five vs seven" (part of R1-1) — the two counts are different axes, not a
  contradiction. Do not reopen without new evidence (would be Recurring).

### Unresolved
- **R2-1 (SHOULD_FIX, v2, Compounds R1-2)** — Task 7 covers only half of Requirement 5.2.
  It retires the supervisor's `## Phase log` hand-write at `SKILL.md:139-143` but not the
  per-`PHASE:`-result phase-row writes at `SKILL.md:187-193` (which 5.2 and design
  Component 7 both name); the prompt even says "keep `:180-199`", which contains `:187-193`.
  Grep done-condition checks only `:139-143`. Result: phase log double-sourced (hand rows +
  ledger-derived rows), 5.2 unmet, no check catches it. Fix: add `:187-193` to task 7's
  removal instruction and grep done-condition; cite `:180-183` (keep spawns) vs `:187-193`
  (retire) separately.

## Patterns & Themes
- The recurring weak seam is sdd-continue/task-7: the supervisor writes phase-log rows and
  spawns in overlapping line ranges, and citing the coarse range `:180-199` as "keep" keeps
  sweeping in rows that must change. R1-2 and R2-1 both live here.
- Code tasks (1, 2, 4, 5, 6) are tightly cited, additively scoped, and fenced from their
  existing suites — the fresh lens (cost of touching existing components) found no regression
  risk: no test asserts the registered-tool count, the doc count is unchecked, no test drives
  `sdd-activity.sh`, and task 6 guards the old-ledger path.
- All citations verified accurate at both ends through v2, including the one lint-changed
  citation (`SKILL.md:180-199`) — its range is real but its label is imprecise (root of R2-1).

## Guidance for Next Review
- Verify the reviser added `SKILL.md:187-193` to task 7's removal instruction AND its grep
  done-condition, and split the "keep" citation to `:180-183` only (R2-1). If a phase-log
  call now replaces the per-result HANDOFF row, confirm the block is single-sourced.
- Do not reopen: the five-vs-seven reconciliation (rejected), the R1-1 template-name contract
  (adequate), or the design-side closures (retrospective-orient cut, reused-agent fold,
  not-live interrupted guard).
- Re-verify only citations a future revision changes, at both ends; Revision-History rulings
  are closed.
- Fresh lenses already spent: sub-agent-with-only-the-prompt (R1), cost-of-touching-existing
  -components (R2). Both found the same task-7 seam. A next lens could be run-time ordering of
  the phase-log rewrite vs the supervisor's own writes within a single supervisor turn.
