# Adversarial Review Memory — design

Last updated: 2026-10-02 (round 1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (SHOULD_FIX)** — `QueuedTask.testFiles` and `integration` (design.md:212, 215) are
  produced by C5's `orient` queue but consumed nowhere (gate takes `nextTask.files` only;
  `verifier` kind has no `testFiles`/`integration`; Testing Strategy doesn't test them).
  `integration` keys off `- Test (integration):`, absent from all 14 current `tasks.md` and
  not parsed by `TEST_BULLET_RE` (`src/core/task-parser.ts:14`). Name a consumer or cut both.
- **R1-2 (MINOR)** — `compareSources` (C4, design.md:81) shape unstated; pin it as
  `SourcesReport | null` in Data Models.
- **R1-3 (MINOR)** — C1 "W from the row that sets tokens (usage.ts:259-275)" vs `listSpawns`
  "the latest `spawn.end` row's W" (design.md:41) diverge on an `unknown` re-fire; state both
  come from the token-setting row.

## Patterns & Themes
- The document is unusually well-probed. Every cited range anchors its claim; the four
  scratch probes reproduce exactly (last-line W 0.000%, base 24.7%, fs symlink guards,
  8/8 baseline transcripts resolve). The one soft spot is scope creep in a data shape, not
  correctness.
- Ledger asymmetry handled correctly and deliberately: `round` rows carry `phase` (match by
  key); `task.done` rows do not (match by time window). Future rounds: do not re-flag this.
- Re-decided literals (Req 1.5, 3.3, 4.2, 6.4, 7.3) were all ruled refinement with reasons in
  the analysis; each stays within its governing requirement's intent. Do not re-open.

## Guidance for Next Review
- R1-1 is the only loop-keeping finding. On the next pass, confirm the revision either names a
  consumer for `testFiles`/`integration` (and tests it) or removes the fields, the
  `- Test (integration):` claim, and the `src/core/task-parser.ts:8-11` note for them.
- Rulings closed this round (do not re-open): the five re-decided literals as refinements; the
  two lint-pass citation changes (readUsage 68-87; C5 scenario-form note).
- Already verified against code/probes (don't re-spend budget): C3 fs probe, C4 base probe,
  D1 last-vs-first-line probe, C11 8-transcript resolution, the `round`/`task.done` phase-key
  asymmetry, the C9 report-bullet citations, Req 3.3 block coverage by C6 kinds.
- Fresh lenses not yet used (candidates for round 2): the `book.sh` idempotency algorithm
  against concurrent/duplicate rows end to end; the C6 `render()` conditional logic (phase/D)
  feasibility per kind; the skill-split heading-coverage test (Req 3.6) completeness.
