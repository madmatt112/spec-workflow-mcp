# Adversarial Review Memory — tasks

Last updated: 2026-09-25 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- None yet.

### Partially Accepted
- None yet.

### Rejected
- None raised this round.

### Unresolved
- None. Round 1 produced no MUST_FIX and no SHOULD_FIX findings; the round converged.

## Patterns & Themes
- The tasks document is unusually tight: every design component (C1-C7) and every
  requirement AC (R1-R7) maps to a task, dependency order is producer-before-consumer
  with no bridge or stub, and the heavy task (T3) enumerates its assertion edits
  precisely and backs them with a `grep -n cacheUnknownGap` widening instruction.
- Verified codebase facts a later round can reuse without re-checking:
  - `reduceSpawn(s, phaseStarts, phaseEnds)` already takes both phase arrays
    (src/watch/usage.ts:239), so the `windowPhase` extraction needs no signature change.
  - `emptyCell` (usage.ts:75-77) is the ONLY `UsageCell` constructor in source; adding
    `graph: 0` there keeps `tsc` clean.
  - Full-cell literals needing a hand-added `graph: 0`: harness.test.ts:533, 596, 597.
    All usage.test.ts cells flow through the `ce` helper (usage.test.ts:8-11), incl. the
    whole-report `toEqual` at :474 and :180 — editing `ce` covers them.
  - Compare-table string assertions in usage.test.ts: 333, 335, 336, 337, 352, 353, 467
    (from the two-arg formatUsageTable calls at lines 330, 351, 466). This is the
    complete set; T3 lists all seven.
  - One-report `toContain` assertions are prefix substrings that survive appending the
    graph column before the `  orch`/kinds text (300-305, 417, 426-428, 439-440, 451-454).
  - Template enumeration grep `^  [a-z]*: \[` returns exactly 5 BRIEF_TEMPLATES
    (harness.ts:486, 495, 507, 516, 525).
  - `ToolContext` carries `projectPath` and `workspacePath` (harness.test.ts:22), so
    scenario (5)'s context object is valid.
- The line-35 citation-identifier lint warnings (L-1..L-24) are a false positive: line 35
  cites assertion-to-update lines (usage.test.ts:333, harness.test.ts:533), not
  identifier definitions; identifiers are covered by `_Leverage`. Rejection upheld.

## Guidance for Next Review
- No open findings to re-check. If a v2 appears, diff it against v1 and re-verify only
  changed citations; the coverage/ordering/atomicity spine was fully checked this round.
- If a later round wants a fresh angle, probe the SKILL.md prose edits (T5, T7) for
  logical consistency of the refresh conditions (worktree gating, run.start ordering)
  rather than citation correctness, which is already confirmed.
- Do not re-open L-1..L-24 (citation-identifier) or the D1/D2/D4/D8 decisions; ruled
  and verified.
