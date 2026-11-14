# Adversarial Review Memory — requirements

Last updated: 2026-11-14 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (v1) SHOULD_FIX** — run-id path for the usage-log line + no-run case. v2 added the null-`run` clause to Req 3 AC1 and named the run-id path in Left-to-the-design.
- **R1-2 (v1) SHOULD_FIX** — burn/fit transport. v2 named the transport options and reworded Req 4 AC8.
- **R1-3 (v1) SHOULD_FIX** — D7 burn deviation missing from the decomposition-delta note. v2 added it. Resolved.
- **R1-4 (v1) MINOR** — resolve POST `projectId` for a shared store. v2 named the representative and the shared-store justification (verified true). Resolved.
- **R1-5 (v1) MINOR** — controller-runs push account-wide. v2 stated it (verified). Resolved.

### Partially Accepted
- (none)

### Rejected
- Lint L-1..L-7 (both v1 and v2 lint passes): citation-identifier false positives. Closed in Revision History; do not re-open.

### Unresolved (round 2)
- **R2-1 [drafting] SHOULD_FIX** — fix-induced, `Compounds: R1-1`. The v2 Introduction says the log "threads the emitting run's id through the rate-limit callback", committing to the `onRateLimit`-signature option; the v2 Left-to-the-design bullet leaves that path open (signature change OR a direct `step.ts:499-502` write that never touches the callback). Introduction pre-decides what Scope defers. Fix: reword the Introduction's parenthetical; no requirement/scope change.
- **R2-2 [drafting] MINOR** — `Compounds: R1-2`. Req 4 AC8 "refetch … from the usage route" (singular) presumes one transport; AC1–AC3 source the window from `rate-limit.json` and Left-to-the-design permits a separate burn/fit route (two routes). Loose wording only.

## Patterns & Themes
- Round 1 found omissions (missing mechanism/transport). Round 2's one live defect is the mirror: the R1-1 fix *over-corrected* — the Introduction now asserts a mechanism the same fix's Scope bullet deliberately left open. Fix-induced inconsistency between two clauses of one edit; this is the class the prompt flags for round 2+.
- Citations remain uniformly accurate across both versions (every v2-touched citation re-verified both ends; new `step.ts:461`, `runs.ts:405-406`, `stores.ts:16-22/39` all accurate).
- Shared-store resolve (R1-4) and account-wide push (R1-5) claims verified true in code, not just asserted.

## Guidance for Next Review
- Confirm the reviser reworded the Introduction so it no longer names the rate-limit callback as the run-id path (must match the two-option Left-to-the-design bullet). That is the only loop-keeper.
- Optionally confirm 4 AC8 no longer presumes a single "usage route" if the design has not picked the extend option.
- Do not re-verify v1/v2 citations unless a line range moves — all confirmed accurate.
- Well-covered, no re-examination needed: null-`run`/burn/fit logic (consistent), D5/D7/D8 option trims (rationale intact), state-word precedence (round 1, fine), security/ESCALATE surface (resolve route only, clean).
