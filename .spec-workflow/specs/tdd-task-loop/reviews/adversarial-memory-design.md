# Adversarial Review Memory — design

Last updated: 2026-09-27 (round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1 just written)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved (round 1, all open)
- **R1-1 (SHOULD_FIX)** — Inbound judge answer wire unprobed and unflagged. Design flags
  only the outbound score-question `criteria` form; the per-question numeric extraction
  from `answers["<id>"]` (jev doc 38-42 shows a placeholder `{ ... }`) is presented as
  settled in Data Models `JudgeAnswers`. Fail-open turns a wrong wire into silent
  `null`, so R9 AC3 ("one judge event when a key is set") and R7 AC7 can never pass and
  the Jev-shadow deliverable yields no data. Fix: flag it unprobed; name the SDK types
  or a live-key check as the confirmation source; or drop the judge event from R9 AC3's
  required set.
- **R1-2 (SHOULD_FIX)** — Component 13 count-word command `grep -rn -i twelve …` is
  over- and under-inclusive. Verified hits: `sync-plugin-assets.cjs:91`,
  `agent-profiles.test.ts:6` (both should change), and `SDD-HARNESS.md:133` "twelve
  spawns" (false positive, must NOT change). Misses "Eight worker agents"
  (`SDD-HARNESS.md:21`, the R8 AC2 count word) and the numeral `12` in the test.
  Violates agent-rules "command that finds every member".
- **R1-3 (MINOR)** — `classifyRed` scans combined stdout+stderr; an assertion failure
  whose output holds a structural marker (e.g. "is not a function" in an asserted error
  string) records `structural-red`, biasing shadow data. Safe direction; the marker
  list is closed by R4 AC9, so flagged as inherited data-quality risk, not a re-open.
- **R1-4 (MINOR)** — Gate's source of `seams`/`testLines` (parsed task `tests[]`) is
  implicit; `tdd` arg carries only `testFiles`+`redCommit`. Gate re-parses tasks.md
  (already does at review-gate.ts:161) — state it.
- **R1-5 (MINOR)** — Design-defect stop (SKILL.md:215-216) reports "from the
  implementer's flag"; author `SEAM-DEFECT` path reuses it — reason must be
  author-sourced.
- **R1-6 (MINOR)** — `saveReview`'s unconditional sidecar attach could mis-attach a
  stale `.tdd-<id>.json` to an unmarked task after a mid-spec tasks.md edit; no
  run/commit stamp guards it.

## Rulings issued
- **R3 AC4 re-decided literal** (`redTests` optional, defaults `''`): ruled
  **refinement (closed)**. Requirements v3 R2-2 already fixed "filled every task, empty
  when unmarked, empty string passes the check"; D3/Component 5 is the mechanism, not a
  widening. Preserves harness.test.ts:170-172 / 247-253.

## Patterns & Themes
- The document is exceptionally well-grounded: every code citation (paths, ranges,
  signatures, behaviour) verified accurate on first read. Weaknesses cluster in
  **external/unprobeable wires** (Jev) and **prescribed maintenance commands** (count
  words), not in codebase claims.
- Recurring risk shape: "fail-open / safe-direction" mechanisms mask gaps by turning
  them into silent no-ops that still fail the *verification* (R1-1) rather than the
  gate.
- Spec 12 (`## Code graph`) is already merged in harness.ts — the design builds on it
  correctly.

## Guidance for Next Review
- Verify R1-1 was addressed: does the design now state the answer-extraction wire as
  unprobed and give a confirmation source, or has the judge event been removed from R9
  AC3's required scenario? Watch for the drafter over-claiming SDK behaviour without a
  probe (round prompt's library-capability MUST_FIX rule).
- Verify R1-2: is the corrected find command member-complete and does it exclude
  `SDD-HARNESS.md:133`?
- Re-check the gate→proof→block seam (R1-4) and the sidecar lifecycle (R1-6) if
  Component 8/9 text changed.
- Do not re-open R4 AC9's classification rule or the R3 AC4 ruling (both closed).
- Fresh lens used this round: wire contracts across boundaries. A future round could
  apply: concurrency/lifecycle of the base worktree and sidecar under simultaneous
  gates, or a resource/timeout budget lens (three 5-min test runs per gate).
