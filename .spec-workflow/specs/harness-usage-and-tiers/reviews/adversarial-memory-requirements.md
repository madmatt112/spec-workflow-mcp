# Adversarial Review Memory — requirements
Last updated: 2026-09-19 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — profiles never reach `dist/`; no copy step, dev/test
  resolution base unspecified. v2 added Req 3.7 (copy-static copies to dist; two-step
  module-relative resolve). Fix verified sound.
- **R1-2 (SHOULD_FIX, v1)** — usage-report counting/spawn-identity ambiguous. v2 rewrote
  Req 5.4. **The rewrite regressed** — see R2-1/R2-2 below.
- **R1-3 (SHOULD_FIX, v1)** — render row cannot fit full ids + actual column. v2 added
  Req 4.7. **The pin is vacuous** — see R2-3.
- **R1-4 (MINOR, v1)** — supervisor row not from generated profiles. v2 split it in Req 6.2.
  Fix verified sound.
- **R1-5 (MINOR, v1)** — `PHASE_ORDER` non-exported; second-spec param unnamed. v2 Req
  5.2/5.3 name the export and `compareSpecName`. Fix verified sound.
- **R1-6 (MINOR, v1)** — Req 2.1 vs 2.3 collision. v2 reworded 2.1 to "the worker
  `spawn.usage` row an orchestrator writes." Fix verified sound.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (MUST_FIX, v2)** — Req 5.4's rewritten token source names only `spawn.end`; no
  `spawn.usage`-fallback when `spawn.end` carries no digits. question-gates: 22 of 23
  digit rows (1,917,645 tok, 97.7%) are `spawn.usage`; report yields 45,675 vs Req 5.9's
  mandated 1,963,320. Contradicts Req 5.9 and Req 7.3. `buildModel:266/271/285` already
  reads usage tokens; the R1-2 rewrite dropped it. Compounds R1-2.
- **R2-2 (MUST_FIX, v2)** — Req 5.4 "a spawn is identified by its `spawn.start` row";
  `sdd-reviewer` (0 start / 7 numeric usage) and `sdd-checker` (0 start / 2 numeric usage)
  have none → 9 rows / 903,976 tok (46%) orphaned. Needs a start-less synthesis rule
  (`buildModel:275-290` does this). Independent of R2-1. Compounds R1-2.
- **R2-3 (SHOULD_FIX, v2)** — Req 4.7 pins "`roleW`'s 16-char floor holding," but
  `Math.max(16,…)` at `render.ts:202` makes that unconditionally true; it does not guard
  the actual line-overflow/wrap R1-3 raised. Pin the full-line 80-col fit instead.
  Compounds R1-3.

## Patterns & Themes

- **Citations remain solid.** Every v2-delta citation verifies at both ends
  (copy-static:45-61, workspace-initializer:9, render:60/202-203, harness:46/49-92/95/109-120,
  ledger:188/200-202/241/250-291, SDD-HARNESS:288/325-328). Lint rejections (L-12/24/25)
  hold. No misstated artifact in the delta. Attack completeness/consistency, not accuracy.
- **The recurring weak spot is the usage report (Req 5.4).** R1-2 flagged it ambiguous; the
  v2 fix over-corrected — in rejecting `buildModel` wholesale it discarded the two fold
  behaviours (usage-token read; start-less synthesis) that the flagship question-gates
  fixture actually needs. The fix introduced two MUST_FIX contradictions with Req 5.9.
- **Fix-driven regressions.** Both v2 MUST_FIX findings live in text the R1-2 fix wrote;
  the SHOULD_FIX lives in R1-3's fix. The deltas, not the untouched body, carry the round-2
  defects — matches the standing expectation.
- **Ledger numbers stay verified** (do not re-probe): question-gates 1,963,320 total;
  spawn.end digit rows = 1 (analyst 45,675); spawn.usage digit rows = 22 (1,917,645);
  start-less orphans = 9 rows / 903,976; buildModel last-run 1,185,572; review-gate 6,324,447.

## Guidance for Next Review

- Confirm v3 fixes Req 5.4 so question-gates yields 1,963,320: (a) a `spawn.usage`-fallback
  token source, and (b) a synthesis rule for closing rows with no `spawn.start`. Re-run the
  truth table (six row-shapes in the r2 analysis) against the new wording; rows 3 and 4 must
  turn green.
- Confirm Req 4.7 pins a real width/fit invariant, not the `Math.max` tautology.
- Well-covered, do not re-open: wire contracts (R1-1/R1-5 seams), the supervisor split
  (R1-4), the 2.1/2.3 wording (R1-6), all citation accuracy, and the ledger totals.
- Lenses spent: r1 wire contracts; r2 criteria-only truth table. Next round, if still
  iterating, pick failure-mode/degradation paths (e.g., malformed transcript, torn ledger
  tail, `usage` on an empty/second-spec-absent ledger) or the phase-attribution rule
  (Req 5.6) which has not been stress-tested.
