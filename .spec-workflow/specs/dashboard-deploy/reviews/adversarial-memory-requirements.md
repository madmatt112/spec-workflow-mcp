# Adversarial Review Memory — requirements

Last updated: 2026-11-05 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — The `holdBy: 'deploy'` ↔ `pauseRequested` coupling is never
  stated. R1 AC2 sets only `holdBy`; R3 AC6 "clear the hold" omits `pauseRequested`. But
  R1 AC3 (hold definition), R4 AC4 (invariant via `controller.ts:456`), R4 AC7 (`:242`
  early-return) and R6 AC4 (`pause.ts:27-29`) all require the hold to set and release to
  clear `pauseRequested` in lockstep with `holdBy`.
- **R1-2 (SHOULD_FIX)** — `started` (R1 AC1, populated at creation) vs "the unit was
  started" (R1 AC4, R3 AC3/AC4, D3) is undisambiguated: either `started` is overloaded
  (AC1 vs AC4 conflict) or a second field exists that AC1 never lists. R3's lost-unit
  recovery (AC3 fail vs AC4 continue) depends on reading it correctly.
- **R1-3 (SHOULD_FIX, wire lens)** — The new deploy feed message pins only its server half
  (`shell/types.ts:230-236`, `shell-feed.ts:146-153`); no AC pins the client contract
  (a `ShellProvider.tsx:76-121` subscription/handler/state + a frontend hand-copy payload
  type), unlike R4 AC12's three-location `holdBy` enumeration.
- **R1-4 (MINOR)** — Cancel route success HTTP status unspecified (deploy POST pins `202`).
- **R1-5 (MINOR)** — D4 "leave status alone"/"keeps its status underneath" overstates; a
  running deploy-held run parks `paused` (R4 AC5). ACs correct; D4 prose loose.

## Patterns & Themes
- Under-specified field/state semantics: two of three SHOULD_FIX (R1-1, R1-2) are the same
  shape — a field or flag the mechanism silently depends on but no AC establishes.
- Wire-contract asymmetry: R4 AC12 enumerates every wire location for `holdBy`, but the new
  deploy message's client half is omitted (R1-3). The pattern exists; apply it uniformly.
- Citations are accurate. The v1 lint pass's "no citation misstated" survived spot-checks of
  every grouped citation and both ends of each range. No MUST_FIX from misstated artifacts.
- Scope deltas vs the decomposition (D1/D2/D4) are all declared and justified; D2 correctly
  reverses a false decomposition premise about the divergence check.

## Guidance for Next Review
- Confirm the reviser stated the `pauseRequested` set-on-hold / clear-on-release lifecycle
  (R1-1) and that R3 AC6 "clear the hold" now clears both fields for queued/merging runs.
- Confirm the record schema names the unit-started field distinctly from `started` (R1-2).
- Confirm a client-side wire entry for the new deploy message (R1-3).
- Fresh lens used this round: wire contracts. Next round apply a different lens (e.g. crash
  ordering / idempotency of the script↔controller two-writer handoff on restart, or the
  cancel/`swap` race mechanics) and re-check any fix as a scoped fix-induced re-check.
- Re-probe nothing new required; KillMode and systemd-run env probes corroborated by code.
