# Adversarial Review Memory — requirements

Last updated: 2026-10-21 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1 just written)

### Partially Accepted
- (none)

### Rejected
- Lint pass L-6/L-7/L-8/L-9 (pre-review): package.json section keys are named by the
  AC, not by merge.ts symbols; the R4 AC1 citation anchors "the merge pass reads a PR".
  Recorded in Revision History; do not re-open without new evidence.

### Unresolved (round 1 findings, awaiting reviser disposition)
- R1-1 (SHOULD_FIX) — R2 AC7: "Sonnet route" names no source key; the ten-key /
  frontmatter / byte-for-byte pins of `agent-profiles.test.ts:23-47` forbid a dedicated
  key, forcing an unstated coupling to `sdd-test-author`/`sdd-checker`.
- R1-2 (SHOULD_FIX) — R1 AC1/AC8: classifying blocking reasons by kind (fixable
  check/conflict vs unfixable trailer/wrong-head) has no structured source; `blocked`
  emits only free-text `reasons[]` + `ci` + `mergeable`, so detection needs brittle
  string-matching of merge.ts wording.
- R1-3 (SHOULD_FIX) — R2 AC10 omits R3's security fix round from its non-task
  implementer enumeration; its tier (Sonnet vs Opus) is ambiguous.
- R1-4 (SHOULD_FIX) — R1 AC5: no run-state transition specified after an `INFRA:`
  merge fix round (AC4 = commit case, AC6 excludes INFRA); should be `merging` + re-check.
- R1-5 (SHOULD_FIX, borderline MINOR) — R2 AC8 requires `spawn.end` to carry effort,
  but `spawnEnd` (ledger.ts:130-143) has no effort field (model only).
- R1-6 (MINOR) — R3 AC8 lists `abandon` but AC9 specifies only accept/retry.
- R1-7 (MINOR) — R4 AC1 "between base and head" vs R3 AC3 "merge base": basis unstated.
- R1-8 (MINOR) — Alignment section omits R4 from its grill-decision-1 mapping.

## Patterns & Themes
- Routing/model wiring (R2) repeatedly asserts behavior against existing pinned
  artifacts (profile test, ledger rows) without closing the gap those pins create.
- The merge stage's free-text `reasons[]` is the recurring weak contract: R1 needs
  structured reason kinds the code does not expose.
- Cross-requirement enumerations (AC10's step list) go stale when a sibling
  requirement (R3) adds a new step.

## Guidance for Next Review
- Delta citations and all doc citations verified accurate in round 1 — do not re-walk
  them unless the reviser changed them.
- R4's wire contract (PrRead → ControllerRunRow → shell passthrough → two hand copies
  → PrPanel) was verified sound; re-check only if the reviser alters the field's optionality.
- Fresh lens used this round: wire contracts. Next round pick a different lens
  (e.g. failure/idempotency on re-entry: R3 AC13 and the security-wait accept/retry
  cycle re-running the full e2e verification each time).
- Confirm the reviser names a concrete Sonnet profile key (R1-1) and a reason-kind
  mechanism (R1-2); these are the two most likely to be deferred incorrectly.
