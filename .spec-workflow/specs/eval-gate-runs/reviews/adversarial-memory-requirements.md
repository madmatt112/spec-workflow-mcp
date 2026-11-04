# Adversarial Review Memory — requirements

Last updated: 2026-11-04 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet (round 1).

### Partially Accepted
- none yet.

### Rejected
- none yet.

### Unresolved (raised this round)
- **R1-1 (MUST_FIX)** — R1 AC1 brief-reason citations `(:131, :153, :200)` are rotated
  against the reasons `brief <template>` / `brief source` / `brief: base render
  unavailable`. Correct mapping: `:153` / `:200` / `:131`.
- **R1-2 (MUST_FIX)** — R2 AC1/AC2 ("SHALL exit 1") contradict R3 AC5 (overridden failed
  1-run case exits 0). Needs an "absent an `--eval-override` naming that case" carve-out;
  mirrors `gate.ts:74`.
- **R1-3 (MINOR)** — R4 AC1 example forms imply provisional ⟺ 1 run; a provisional case
  with a `case`/`role`/`grader`/`profile` reason runs 3 (AC4 governs).
- **R1-4 (MINOR)** — R2 AC1 "no further step call" is vacuous/duplicative for a 1-run case.
- **R1-5 (MINOR)** — R2 AC5 "names the failing case" over-promises for exit-2
  override-validation waits.
- **R1-6 (MINOR)** — dry-run range `HEAD..origin/main` differs from gate range
  `BASE..TARGET_COMMIT`; preview is an estimate.

## Patterns & Themes
- Citations are accurate overall (delta inline cites all verified); the one defect is a
  grouped triplet whose order breaks the inline convention of its own sentence.
- The partition rule (reason→count) is total and disjoint; invariants are well-chosen.
- The gate→runner wire contract (one record, mixed counts, uniform runs kept) is already
  pinned by R3 AC3/AC4 + R1 AC7 — the fresh wire-contract lens found no gap there.
- The recurring soft spot is override interaction: R2's story is written as if overrides
  do not exist, so its exit-code THENs collide with R3.

## Guidance for Next Review
- Confirm R1-1 reorder landed and every brief reason points at its own `select.ts` line.
- Confirm R2 AC1/AC2 gained the override carve-out and no longer contradict R3 AC5/AC6.
- Re-probe `select.ts:197-202` if the design claims provisional cases are always 1-run.
- Fresh lens next: error-handling / failure-mode completeness (classification vs grader
  fail vs "edited the live checkout" vs base-render-unavailable), since round 1 used the
  wire-contract lens.
