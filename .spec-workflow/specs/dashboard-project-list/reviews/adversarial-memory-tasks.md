# Adversarial Review Memory — tasks

Last updated: 2026-10-29 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MINOR, Novel)** — Task 7 body says `--no-register=1 is rejected by the existing loop
  at 172`; that loop asserts `=true`/`=false` only. Outcome correct (parser rejects any
  `=value`; registry-driven loop auto-covers the new flag), exemplar imprecise.
- **R1-2 (MINOR, Novel)** — Preamble "Tasks 1 to 5 … with no caller, so behaviour is unchanged"
  overstates tasks 4/5: both wrap live-called functions in a lock now. Observable behaviour
  unchanged; phrasing loose.

## Patterns & Themes
- v1 is unusually clean: every code citation (both ends of each range) resolves against the
  worktree tree; full AC coverage (R3 AC2 by-construction only); success-clause coverage holds
  for all 12 implementing tasks; ordering (1-5→6, 7→8, 9→10, 10/11→12, →13) is sound.
- Both open items are wording imprecision, not logic/coverage defects.
- Highest-risk unit is task 6 (central reconcile, 9 scenarios) — already planned for a verifier.
- Shared e2e file across tasks 11/12 (D2) is the most brittle test surface but not a defect.

## Guidance for Next Review
- If a round 2 runs, re-verify only lines a reviser's fix touched (scope fix-induced re-checks to
  the diff, per the prompt). The two MINORs, if fixed, are pure prose edits — confirm the reword
  did not move any citation off its phrase.
- Do not re-open: task-6 size (minimal cohesive unit), task-13 no-seam (D7 correct), tsx-as-test
  dependency (already a devDependency, no gate-b).
- Watch task 10's `sidebar` key vs. any NEW shell-feed deep-equal a reviser might add.
