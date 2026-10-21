# Adversarial Review Memory — requirements
Last updated: 2026-10-21 (after v2 review)

## Cumulative Findings Summary

### Accepted
- R1-1 (SHOULD_FIX, v1) — R2 AC7 named no Sonnet source key. Fixed in v2: reads the
  `sdd-test-author` profile entry (`agent-profiles.json:50-55`), no new key, pins stay
  green, coupling stated. Verified closed in v2 review.
- R1-2 (SHOULD_FIX, v1) — R1 AC1/AC8 classified blocking reasons with no structured
  source. Fixed in v2: AC1 requires the merge evaluation to tag each reason with a kind
  (check/conflict/trailer/head/other) from signals `merge.ts:361-405` already computes
  positionally; AC8 keyed to kind. Verified closed and implementable in v2 review.
- R1-3 (SHOULD_FIX, v1) — R2 AC10 omitted R3's security fix round. Fixed in v2.
- R1-4 (SHOULD_FIX, v1) — R1 AC5 no state after INFRA round. Fixed: merging + re-check.
- R1-6 (MINOR, v1) — R3 AC9 abandon branch. Fixed in v2.
- R1-7 (MINOR, v1) — R4 AC1 merge-base basis. Fixed in v2.
- R1-8 (MINOR, v1) — Alignment omitted R4. Fixed in v2.

### Partially Accepted
- R1-5 (SHOULD_FIX, v1) — R2 AC8 required effort on `spawn.end`, which has none.
  Resolved in v2 by scoping effort to `spawn.start`, model to both rows; no field
  added to `spawnEnd`. Verified against `ledger.ts:130-143`.

### Rejected
- Lint pass L-6/L-7/L-8/L-9 (pre-review, v1): package.json section keys are named by
  the AC, not merge.ts symbols. Recorded in Revision History; do not re-open.
- Lint pass L-1..L-11 (v2): AC-named/new terms or package.json keys; not symbols in the
  anchored range. Recorded in Revision History.

### Unresolved (round-2 finding, awaiting reviser disposition)
- R2-1 (SHOULD_FIX, Novel, carried) — R3 completion-gate re-entry: AC13 guards only the
  security pass, not the e2e verification (`implementation.ts:884-911`, unconditional;
  phase does `return completionGate()` at `:517`) that AC1 gates it behind. On
  `accept`/`retry`/restart the gate re-runs e2e against post-security-fix code (AC6
  commits), which can flip to fail and strand the operator's answer; AC9 "from round 1"
  is under-determined against AC13's ledger-read (what resets the AC12 round rows).

## Patterns & Themes
- The two round-1 structural risks (profile-pin coupling, free-text reason kinds) are
  now closed cleanly — the reviser named concrete sources, not deferrals.
- New theme: R3 inserts the FIRST wait in the middle of the completion gate (before
  HANDOFF, after code-changing fix rounds). The gate has no mid-gate resume machinery;
  it restarts at e2e every entry. Any wait inserted there inherits an unguarded,
  possibly-flipping e2e re-run.

## Guidance for Next Review
- Delta citations and all v1 citations verified accurate through v2 — do not re-walk
  unless the reviser changes them.
- Lenses used: wire contracts (r1), idempotency/re-entry (r2). If a round 3 is needed,
  it should verify only the reviser's R2-1 fix (the gate resume contract) against the
  e2e loop — scope to that diff, not a re-review.
- Do NOT re-raise R1-1/R1-2 or the conflict-kind conservatism; all confirmed sound.
