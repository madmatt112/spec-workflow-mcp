# Adversarial Review Memory — requirements
Last updated: 2026-09-19 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — profiles never reach `dist/`; copy step + resolution base.
  v2 Req 3.7. Verified sound (v2, v3).
- **R1-2 (SHOULD_FIX, v1)** — usage-report counting/spawn-identity ambiguous. v2 rewrote
  Req 5.4; the rewrite regressed (R2-1/R2-2). v3 rewrote it again — token total now correct.
- **R1-3 (SHOULD_FIX, v1)** — render row cannot fit full ids + actual column. v2 Req 4.7 was
  vacuous (R2-3); v3 re-pinned the full-line 80-col fit. Verified sound.
- **R1-4 (MINOR, v1)** — supervisor row not from generated profiles. v2 Req 6.2. Sound.
- **R1-5 (MINOR, v1)** — `PHASE_ORDER` export; second-spec param. v2 Req 5.2/5.3. Sound.
- **R1-6 (MINOR, v1)** — Req 2.1 vs 2.3 collision. v2 reword. Sound.
- **R2-1 (MUST_FIX, v2)** — no `spawn.usage`-fallback token source. v3 Req 5.4 added the
  fallback (drafter/reviser/implementer worked case). **Verified**: fixture now sums
  1,963,320. Resolved.
- **R2-2 (MUST_FIX, v2)** — no start-less synthesis rule. v3 Req 5.4 added it
  (reviewer 7 / checker 2). **Verified**: start-less digit usage now counted. Resolved for
  the total, but the fix wrote R3-1 and R3-2 (below).
- **R2-3 (SHOULD_FIX, v2)** — Req 4.7 `roleW` floor pin vacuous. v3 re-pinned full-line
  80-col fit. **Verified** non-vacuous. Resolved.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R3-1 (MUST_FIX, v3)** — Req 5.4 (line 78) attributes a start-less **`spawn.end`**
  synthesis to `buildModel`'s fold at `:275-290`. That fold is `spawn.usage`-only (gate at
  `:258`); a start-less `spawn.end` is dropped at `:240-247`, never synthesized. False
  behavioural claim about the cited artifact; also inconsistent with the criterion's own
  closing summary (which lists only `spawn.usage` behaviours). Not exercised by the fixture
  (no start-less digit `spawn.end` in question-gates), so total unaffected. Compounds R2-2.
- **R3-2 (SHOULD_FIX, v3)** — Req 5.4's start-less worked rule "one spawn per **numeric**
  `spawn.usage` row" names only reviewer/checker and omits **`sdd-verifier`** (0 start / 1
  non-numeric `na` usage / 1 non-digit end). General clause covers it; worked rule read
  literally drops it → 13 vs the 14 unknown marks Req 5.9 mandates. Total unaffected
  (verifier = 0 tok). Add verifier as the start-less non-numeric case; reconcile
  "otherwise-unclaimed usage row" (all) vs "per numeric usage row" (subset). Compounds R2-2.

## Patterns & Themes

- **The usage report (Req 5.4) remains the sole weak spot.** R1-2 → R2-1/R2-2 → R3-1/R3-2.
  Each rewrite fixes the prior defect and opens a narrower one at the same seam: v2 dropped
  the fold behaviours; v3 restored them but (a) over-attributed a `spawn.end` case to a
  `spawn.usage`-only fold, and (b) under-specified the start-less non-numeric case.
- **The token total is now correct** (verified 1,963,320). Both open findings are on edges
  the fixture masks (a start-less digit `spawn.end` that does not exist here; a single `na`
  verifier row that the total ignores but Req 5.9's mark-count does not).
- **Citations elsewhere stay solid.** All v3-delta citations into `render.ts`, `harness.ts`,
  `tsconfig.json:8`, and the `:200-202`/`:241`/`:266`/`:271` ledger anchors verify at both
  ends. The one accuracy defect (R3-1) is `:275-290` over-scoped to `spawn.end`.
- **Fix-driven regressions persist.** Both round-3 findings live in the text the R2-2 fix
  wrote (line 78) — the delta, not the untouched body, carries the defects, as in round 2.

## Ledger facts verified (question-gates; do not re-probe)
- 23 digit rows = 1,963,320 (1 `spawn.end` analyst 45,675; 22 `spawn.usage`).
- Analyst: 1 start, 2 end (undef @01:10:28, 45675 @01:10:49), 0 usage.
- Start-less: reviewer 0/7 numeric usage/7 non-digit end; checker 0/2 numeric usage/2
  non-digit end; **verifier 0 start / 1 `na` usage / 1 non-digit end**.
- 14 unknown/na/0 rows are all `spawn.usage` (drafter 1, reviser 5, implementer 7,
  verifier 1); 44 absent-token rows are all `spawn.end`.
- Started agents ordered start→end→usage per spawn (windowing safe).
- buildModel: fold synthesis (`:275-290`) fires only on `spawn.usage`; `:271` overrides end
  tokens with usage tokens (opposite of the report's end-wins rule, handled by Req 7.2).

## Guidance for Next Review
- If v4 rewrites Req 5.4 again: confirm the `buildModel` attribution is `spawn.usage`-only
  (R3-1) and that the start-less rule names verifier / covers non-numeric usage (R3-2).
  Re-run the fixture: total must stay 1,963,320 AND yield 14 unknown marks (not 13).
- Well-covered, do not re-open: wire contracts (R1-1/R1-5), supervisor split (R1-4), 2.1/2.3
  wording (R1-6), Req 4.7 width fit (R2-3 resolved), the token total (R2-1 resolved), all
  citation accuracy outside R3-1, and the ledger totals.
- Lenses spent: r1 wire contracts; r2 criteria truth table; r3 both-ends citation re-read +
  raw-fixture replay. If still iterating, try the untested paths: phase attribution (Req 5.6)
  window edge cases, the two-spec compare (Req 5.3) on a missing/empty second ledger, and the
  header run-count (Req 5.5) when no `run.start` exists.
