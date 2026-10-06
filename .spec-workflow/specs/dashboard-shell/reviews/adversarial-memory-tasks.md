# Adversarial Review Memory — tasks

Last updated: 2026-10-06 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet

### Partially Accepted
- none

### Rejected
- none

### Unresolved (raised Round 1, awaiting disposition)
- R1-1 (MINOR) — Dependency-order paragraph says only "task 3 uses the task 2 waits"; it
  omits that tasks 3 and 4 both consume the task-2 pointer-matching helper. Build order
  holds; prompts carry the edges.
- R1-2 (MINOR) — `NowModel.generatedAt` is a required Data Models field but task 3 names
  no value or test for it. `tsc` forces population; Now page ages tick from browser time.
- R1-3 (MINOR) — Requirement 2 AC 4 "a new launch clears the exited wait" is not a named
  case in task 2's `waits.test.ts` enumeration (covered implicitly by state ≠ exited).

## Patterns & Themes
- Coverage is complete: every Requirement 1–8 AC and every design component C1–C12 (plus
  invariants/operator evidence) maps to a task; no orphan AC, no scope invention.
- Delta (lint-pass) citations are cosmetic path fixes only; all re-verified clean at both
  ends. No MUST_FIX artifact errors.
- Context-file probes that mattered (level-2 spawn, run-setup 167-168, ledger 423/428,
  multi-server route grep style, new /api/shell route absent at base) all held.
- The three MINORs are documentation/test-naming polish, not implementation defects.
- D2 (stub-then-replace) and D4 (no frontend unit test) are the accepted reasons task 8 is
  large and frontend tasks carry no red-first test — do not re-litigate as atomicity bugs.

## Guidance for Next Review
- v1 converged at the tasks phase (0 MUST, 0 SHOULD). If a v2 appears, attack the diff
  first; the three MINORs may or may not be folded in — do not treat their absence as a
  regression.
- Do not re-open lint rulings L-1/L-2 (prose names in gate-rules range) or L-6 (task 4
  Restrictions bridge to task 7); recorded closed in the document's Revision History.
- Fresh lens still unused by a later round: cross-task test-fixture consistency (do the
  two-project / two-worktree fixtures named across tasks 7, 8, 12, 14 agree on test ids and
  seeded spec names).
