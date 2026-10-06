# Adversarial Review Memory — design

Last updated: 2026-10-06 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet (round 1 just completed; awaiting reviser disposition)

### Partially Accepted
- none

### Rejected
- none

### Unresolved (raised this round)
- **R1-1 (MINOR)** — FileCache (C2) bypassed on the hot flush path: `getAllSpecs`,
  `DeferralStorage.list`, `IndexGenerator.snapshot` take no cache, so a ~1s throttled
  flush re-parses every spec of every project under a steady ledger stream. Correct but
  churny. Fix in tasks: route those reads through the cache or memoize per flush.
- **R1-2 (MINOR)** — `harness-run-detail` wire arm not written in Data Models (only the
  `ShellMessage` union is). `RunDetail` is fully pinned; add the envelope arm.
- **R1-3 (MINOR)** — Overview "two additive sends" undersells the C7 hub rewrite
  (ShellFeed ownership, two listeners, wrapped sendOverview, widened type, extended
  overviewSnapshot). Not false; a clarity risk.

## Patterns & Themes
- Citations are accurate: all lint-pass deltas and every reuse/probe range read at both
  ends matched the code. The 90 rejected citation-identifier warnings are genuine false
  positives (new shell type names + prose field names).
- Reuse boundaries are clean: ProjectManager emits the two events the hub needs; the
  overview-subscribe snapshot path is the right seat for the ShellFeed's first paint;
  the deferrals REST route and push share buildDeferralsPayload.
- Library-capability claims (react-router useParams, tailwind xl=80rem) were probed
  against installed versions (6.30.3, 4.1.18) and verified true.
- The weakest area is runtime cost (R1-1), not correctness. No MUST_FIX/SHOULD_FIX.

## Guidance for Next Review
- If a round 2 runs: confirm R1-1 is resolved in Data Models/C-sections or explicitly
  deferred to tasks with a named decision; confirm R1-2 arm added. Do not re-open the
  accurate citations or the reuse wiring — they are verified.
- Fresh lenses not yet used: frontend state-management/race conditions (localStorage
  toggle vs per-project payload sync), i18n key-removal completeness (C11 vs
  validate:i18n), e2e assertion feasibility under the worktree config.
- Rulings closed: none recorded yet.
