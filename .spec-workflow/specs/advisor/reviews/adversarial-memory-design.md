# Adversarial Review Memory — design

Last updated: 2026-10-26 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MUST_FIX, Novel).** C7 cites `controller.ts:85-86` for the usage-window
  threshold; threshold is assigned at 87-88 (85-86 is `this.opts`/`this.slots`).
  Companion: `windowBlock` range 373-388 should be 375-390. Wrong line range.
- **R1-2 (SHOULD_FIX, Novel).** Data Models omits `AdvisorSummary`, `Tallies` and
  search `Hit` — the three read-tool responses Reqs 2/3/4/7 AC1 reference. `Tallies`
  has no structure for the `floor: true` column Req 3 AC 3 requires.
- **R1-3 (MINOR, Novel).** C8 no-run merge omits required `MergeTarget` fields
  (`questionId`, `label`, `spec`, `projectId`) and the synthetic `ledger` backing
  `MergeStageDeps`; cosmetic under `merge: 'auto'`, under-told.
- **R1-4 (MINOR, Novel).** C10 says mcp.json `headers` key "is probed" but cites no
  probe and the scope-note probe list omits it. Capability is real.
- **R1-5 (MINOR, Novel).** Second-opinion `runStep` not scheduled through controller
  and no `onRateLimit` wired, so its token spend never updates `rate-limit.json`.

## Patterns & Themes
- Citations are overwhelmingly accurate (~40 verified clean); the one error is a
  2-line constructor off-by (85-86 vs 87-88) inherited from codebase-context.md L73.
- Library-capability discipline is good: SDK 1.27.1 / fastify 5.8.1 / claude 2.1.311
  all match the installed tree and the named APIs exist.
- The weak spot is Data Models completeness for the *code-built* responses (summary,
  tallies, hit) — described in prose, not pinned. Error-branch/race-loser shapes
  (the retro P3 risk) are handled well.

## Guidance for Next Review
- Re-verify R1-1 as a fix-induced re-check: confirm the citation now reads 87-88 (and
  375-390 for windowBlock) — do not re-review the whole threshold reuse.
- For R1-2, confirm Data Models gains typed `AdvisorSummary`/`Tallies`/`Hit` (or at
  least the `Tallies` bucket+floor shape); check the test-fake note still points at it.
- Do not re-open any clean-verified citation without new evidence.
- Fresh lens not yet spent: a tasks-decomposition/TDD-feasibility lens (count-changing
  tasks, new-module structural-red/verifier spend) if a later round needs one.
