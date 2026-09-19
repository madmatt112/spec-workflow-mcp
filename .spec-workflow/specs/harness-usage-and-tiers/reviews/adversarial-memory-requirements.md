# Adversarial Review Memory — requirements
Last updated: 2026-09-19 (after v4 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — profiles never reach `dist/`; copy step + resolution base.
  v2 Req 3.7. Verified sound (v2, v3).
- **R1-2 (SHOULD_FIX, v1)** — usage-report counting/spawn-identity ambiguous. v2 rewrote
  Req 5.4; regressed (R2-1/R2-2); v3 rewrote again; v4 corrected the fold attribution
  (R3-1/R3-2). Token total verified 1,963,320 at v3 and v4.
- **R1-3 (SHOULD_FIX, v1)** — render row cannot fit full ids + actual column. v3 Req 4.7
  re-pinned full-line 80-col fit. Sound.
- **R1-4 (MINOR, v1)** — supervisor row not from generated profiles. v2 Req 6.2. Sound.
- **R1-5 (MINOR, v1)** — `PHASE_ORDER` export; second-spec param. v2 Req 5.2/5.3. Sound.
- **R1-6 (MINOR, v1)** — Req 2.1 vs 2.3 collision. v2 reword. Sound.
- **R2-1 (MUST_FIX, v2)** — no `spawn.usage`-fallback token source. v3 Req 5.4. Resolved.
- **R2-2 (MUST_FIX, v2)** — no start-less synthesis rule. v3 Req 5.4. Resolved.
- **R2-3 (SHOULD_FIX, v2)** — Req 4.7 floor pin vacuous. v3 re-pinned. Resolved.
- **R3-1 (MUST_FIX, v3)** — Req 5.4 over-attributed start-less `spawn.end` synthesis to the
  `spawn.usage`-only fold. v4 dropped the false claim; now says synthesis is `spawn.usage`
  only and a start-less `spawn.end` is dropped at `:240-247`. **Verified against code both
  ends (:258 gate, :275-290 body, :240-247 pairing).** Resolved.
- **R3-2 (SHOULD_FIX, v3)** — Req 5.4 worked start-less rule omitted `sdd-verifier` and said
  "per numeric usage row." v4 added verifier (1 `na` usage → unknown) and changed to "one
  spawn per `spawn.usage` row." **Verified: fold synthesizes one node per unmatched usage
  row; total still 1,963,320.** Resolved.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R4-1 (MUST_FIX, v4)** — Req 5.4 clause 1 + D8 make "a spawn whose only values are …
  **absent** … print `<sum> (+n unknown)`." On question-gates the 7 orchestrator spawns
  (spawn.start + absent-token spawn.end, no usage) are absent-only, so the algorithm as
  written yields **21** unknown marks, not the **14** Req 5.9 mandates. Contradicts both Req
  5.9 and Req 5.4's own closing clause "`unknown` appears only where a source row says so."
  `0` state has the same latent defect (a digit string, read as known zero by the
  token-source rule AND listed as unknown by clause 1; double-classified; 27 `0` rows exist
  on other specs; question-gates has none so Req 5.9's "and `0`" is vacuous). Fix: define the
  mark on one boundary (source-stated `unknown`/`na` only); absent = count-but-no-mark;
  `0` = known zero. Novel.
- **R4-2 (SHOULD_FIX, v4)** — Req 5.5's mandated header "run count" is undefined when a
  covered run has no `run.start`. question-gates has 2 distinct `run` ids but 1 `run.start`;
  count is 1 (run.start events) or 2 (distinct run ids) with no rule to choose. Fix: define
  run count as distinct `run` ids (=2 here). Novel.

## Patterns & Themes

- **Req 5.4 is the sole recurring weak spot.** R1-2 → R2-1/R2-2 → R3-1/R3-2 → R4-1. Each
  rewrite fixes the prior defect and opens a narrower one at the same seam. v4 fixed the fold
  attribution correctly; R4-1 is a *different* seam — not the fold, but the token-state
  taxonomy the criterion defines for itself (the four states `unknown`/`na`/`0`/absent are
  not consistently bucketed for the `(+n unknown)` mark).
- **The token total is correct and stable** (1,963,320, verified v3 and v4). The open defects
  are on the *mark count*, not the sum: absent-only orchestrator spawns (7) that the sum
  ignores but the `(+n unknown)` rule counts, and the run-count header.
- **All citations are now accurate.** Every v4-delta `buildModel` citation
  (`:200-202`/`:240-247`/`:241`/`:250-291`/`:258`/`:266`/`:271`/`:275-290`) verifies at both
  ends. R3-1 (the last accuracy defect) is fixed. No false code claim remains.
- **Fix-driven regressions have stopped in the delta but the criterion's older prose carries
  R4-1.** R4-1 lives in clause 1 / D8 text unchanged since v3, surfaced only by the
  four-state truth-table lens; it is not in the v4 delta.

## Ledger facts verified (question-gates; do not re-probe)
- 188 rows; 2 run ids (`run-20260916-194812`, `run-20260916-225339`); **1 `run.start`**,
  1 `run.end`.
- 23 digit rows = 1,963,320 (1 `spawn.end` analyst 45,675 at 01:10:49; 22 `spawn.usage`).
- 45 `spawn.end`: **44 absent-token**, 1 digit (analyst). 0 `spawn.end` carry
  `unknown`/`na`/`0`.
- 36 `spawn.usage`: 22 digit, 14 non-digit (drafter 1 `unknown`, reviser 5 `unknown`,
  implementer 6 `na` + 1 `unknown`, verifier 1 `na`). **No `0`-token rows anywhere.**
- Start-less: reviewer 0/7 digit usage; checker 0/2 digit usage; verifier 0 start / 1 `na`
  usage. All start-less `spawn.end` are absent-token (dropped by the report and by buildModel).
- **7 orchestrator spawns are absent-only** (spawn.start w/ phase + absent spawn.end, no
  usage): document 3, implementation 1, retro 1, closeout 2. Analyst is NOT absent-only
  (its later end is digit 45,675).
- Started multi-spawn agents ordered start→end→usage per spawn (windowing safe on fixture).
- Algorithm-as-written over all runs: total 1,963,320 (correct); spawns with no digit
  tokens = **21** (14 worker + 7 orchestrator), vs Req 5.9's mandated 14.
- buildModel: fold synthesis (`:275-290`, gate `:258`) fires on `spawn.usage` only, one node
  per unmatched usage row; `:240-247` drops a start-less `spawn.end`; `:271` overrides end
  tokens with usage tokens (report's end-wins handled by Req 7.2).

## Guidance for Next Review
- This was the final budgeted round (v4); an iterate triggers a post-cap corrective pass that
  is not re-reviewed. If a v5 ever runs: re-run the algorithm and confirm the mark count is
  14 (not 21) AND the total stays 1,963,320; confirm Req 5.4 defines the `(+n unknown)` mark
  on exactly one token-state boundary and Req 5.5 defines the run count.
- Well-covered, do not re-open: the token total (R2-1/R2-2/R3-1/R3-2 resolved), all citation
  accuracy (every range verified both ends), wire contracts (R1-1/R1-5), supervisor split
  (R1-4), 2.1/2.3 wording (R1-6), Req 4.7 width fit (R2-3), the ledger totals.
- Lenses spent: r1 wire contracts; r2 criteria truth table; r3 both-ends citation re-read +
  raw-fixture replay; r4 four-token-state truth table + full-algorithm replay counting marks,
  and the all-runs header. Untested if still iterating: phase attribution (Req 5.6) window
  edge cases; two-spec compare (Req 5.3) on a missing/empty second ledger; whether the
  windowing rule (started agents) diverges from buildModel on a ledger NOT ordered
  start→end→usage.
