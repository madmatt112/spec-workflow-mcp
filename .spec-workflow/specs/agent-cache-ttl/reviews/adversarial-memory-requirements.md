# Adversarial Review Memory — requirements

Last updated: 2026-09-24 (after v2 review — round 2, target v3)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX)** — Req 6 crit 7 block-until-restart was unsatisfiable (pre-merge "ready"
  gated on post-merge evidence). v3 retargeted the block to the post-merge retrospective start;
  PR merges on (4)/(6) alone. Round 2 verified: satisfiable, mandatory preserved, D10 agrees.
  RESOLVED.
- **R1-2 (SHOULD_FIX)** — Req 1 crit 4: generic split leaves `1h }`. v3 names the token-between-
  `cacheTtl:`-and-`}` extraction; crit 5 pins `"1h"` independently. RESOLVED.
- **R1-3 (SHOULD_FIX)** — Req 4 crit 6: "Anthropic spawn count" undefined for total rows. v3
  names `providers.anthropic.spawns` per cell type. Partially resolved — the count source is now
  right, but the collapse test has two unguarded boundaries (see R2-1, R2-2).
- **R1-4 (MINOR)** — Req 2 crit 4: tier-line separator at pad-23. v3 requires a kept separating
  space, width to design. RESOLVED.
- **R1-5 (MINOR)** — Req 5 crit 2.2/4: numeric version compare stated; `unknown` warning split
  from override warning. RESOLVED.
- **R1-6 (MINOR)** — Req 5 crit 6: test now stages code-root fixture + three settings tiers;
  crit 2.5 defines code root = script cwd. RESOLVED.

### Partially Accepted
- (none)

### Rejected
- **RI-2 (v2)** — no contradiction in the recorded Gate A choices (D1/D2/D3/D5). Closed.

### Unresolved
- **R2-1 (SHOULD_FIX)** — Req 4 crit 6: `cacheUnknown == count` fires on `0 == 0` for an
  all-DeepSeek phase/grand total → prints `unknown` where `-`/`0` is correct. Needs a `count > 0`
  guard and a stated all-DeepSeek-total output. Compounds R1-3 (the reworded clause).
- **R2-2 (SHOULD_FIX)** — Req 3 crit 7 vs Req 4 crit 2/6: `cacheUnknown` conflates writes-unknown
  with gap-only-unknown. A cell of all crit-7 rows (writes known, gaps unknown) prints
  `cw5m`/`cw1h` as `unknown`, discarding sums crit 7 deliberately keeps. Needs per-column unknown
  handling or a split counter. Compounds R1-3.
- **R2-3 (MINOR)** — Req 6 crit 7 names no artifact/owner for the post-merge live-half evidence
  the retrospective gates on. Compounds R1-1.

## Patterns & Themes
- The gaps cluster on wire-contract / display seams, now concentrated in Req 4 crit 6: the
  producer (hook, `reduceSpawn`) is fine, but the collapse-to-`unknown` glue keys three columns
  off one overloaded counter (`cacheUnknown` = writes-unknown + gap-unknown) and an unguarded
  equality (`== count`, including `0 == 0`).
- v3 resolved all six round-1 findings cleanly; the two round-2 SHOULD_FIX are the *next layer*
  of the same crit-6 clause R1-3 touched — fixing the count source exposed the boundary logic.
- The R1-1 Gate A mechanism is now sound; do not re-litigate it (Gate A block-vs-defer is a
  closed human ruling and the mechanism is verified satisfiable).

## Guidance for Next Review
- Re-verify Req 4 crit 6 first: does it now guard `count > 0` (R2-1) and give `gapRewrites` its
  own unknown handling or split `cacheUnknown` so known writes are never blanked (R2-2)? Check a
  fixture with an all-DeepSeek phase and a fixture with all-crit-7 (timestamp-only-unknown) rows.
- Confirm any crit-6 change keeps the mixed-cell second branch (`0 < cacheUnknown < count` →
  sums + ` (+N unknown)`) intact — that branch is correct today.
- If R2-3 is addressed, confirm the named live-half evidence record is a real, tracked artifact
  the retrospective reads.
- Well-covered, do not re-examine unless changed: R1-1 gate mechanism (verified), the crit-4
  extraction + crit-5 test, the tier-line separator, the version compare and settings-tier test,
  and scope vs decomposition entry 13 (numbers checked, "92 of 95", "35%", Decided list all match).
- L-1..L-29 citation-identifier addition-point warnings remain closed; do not re-raise without
  new evidence.
