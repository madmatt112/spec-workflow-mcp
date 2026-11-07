# Adversarial Review Memory — tasks

Last updated: 2026-11-07 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none

### Partially Accepted
- none

### Rejected
- none

### Unresolved
- R1 produced no MUST_FIX or SHOULD_FIX. Two non-blocking MINOR observations:
  - M1 — Task 7 `_Prompt` cites task 5 (guard field) but not task 6 (sets `view.guard`
    on the route). Sequential execution covers it.
  - M2 — Task 20 Note says band-order test `e2e/worktree-board.spec.ts:348-358` changes;
    `band-stopped` is hideWhenEmpty and that test seeds no runs, so the 3-band count may
    survive. Note is hedged guidance, not a wrong claim.

## Patterns & Themes

- v1 arrived clean on the primary lens (atomicity/ordering/coverage). Coverage is
  complete (every requirement AC, design component and decomposition scenario maps to a
  task); ordering is sequential-by-number with all forward references satisfied; large
  tasks (7, 16, 18, 19) are cohesive single seams, not over-scoped.
- Citation discipline is high: all lint-pass deltas re-verified accurate, including the
  load-bearing claims that tests "keep every value" (verified `seedRun` shared `created`
  at runs.test.ts:98; verified `implementation.test.ts:484` stubs report `flag:'none'`;
  verified `classifyTarget` cases all use `Target:`).
- External artifact (tradr-hosted G1/G2 source lines 143-148, 155-159) verified verbatim.

## Guidance for Next Review

- If a round 2 is run, do not re-open the citation set re-verified here. Re-raise only
  with new evidence, marked Recurring.
- Fresh lenses not yet applied: failure-mode/error-path realism of the big controller
  tasks (16/18) against the full vitest gate (not just the named suites); frontend
  concrete-render assertions (next-guard text interpolation, run-status word) in task
  7/19/20 Success vs the design's exact strings.
- Watch task 11's REQUIRED re-gate interaction with P8/P4 (unchanged-commit circuit
  breakers) if the implementer's patch path drifts from design D3 (no commit on REQUIRED).
