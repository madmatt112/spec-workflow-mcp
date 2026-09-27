# Adversarial Review Memory — requirements

Last updated: 2026-09-27 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — R6 anchor moved to `TasksPage.tsx:1364-1406` and AC3 names
  the always-shown task row, not the `verdict !== 'pass'` findings expander. Verified in v2:
  1364 is the `!task.isHeader` block, 1384 is the expander. Resolved.
- **R1-2 (SHOULD_FIX, v1)** — R4 AC9 now classifies the base run's full captured
  stdout/stderr, not the one-line `runChecks` output. Resolved.
- **R1-3 (SHOULD_FIX, v1)** — R3 AC4 names the injection channel (implementer template
  `brief`-filled slot; fix brief via reviser `{{job}}`). Partially resolved — see R2-2, the
  fix introduced a required-placeholder break.
- **R1-4 (SHOULD_FIX, v1)** — R4 AC14 scopes "command" to the two configurable agent-rules
  keys, git plumbing excepted. Resolved.
- **R1-5 (MINOR, v1)** — R4 AC13 derives `seams` from the parsed task's `tests[]`. Resolved
  at the requirement level — see R2-3, edge when `testFiles` exceeds the `Test:` lines.
- **R1-6 (MINOR, v1)** — R1 AC3 states a malformed `Test:` line stays an
  `implementationDetails` bullet. **Fix introduced R2-1** — the added non-promotion clause
  contradicts AC1's structural promotion trigger.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (MUST_FIX, fix-induced, Compounds R1-6)** — R1 AC1 promotes any structurally valid
  `- Test:` line (path + em dash + call text) to `tests[]`; the R1-6 fix made AC3 withhold
  promotion for a non-test path, leaving it in `implementationDetails`. The line
  `- Test: src/foo.ts — createWidget()` fires both. AC1's WHEN must gain "a test path", or
  AC3's non-promotion clause must go. Also introduces a hidden parser→`gate-rules`
  (`isTestPath`, `gate-rules.ts:192-198`) coupling AC1 never mentions.
- **R2-2 (SHOULD_FIX, fix-induced, Compounds R1-3)** — the R1-3 fix's "`brief`-filled slot"
  on the implementer template becomes a required placeholder (`harness.ts:665-675`: every
  non-`SERVER_BRIEF_KEYS` key is required, missing → `success:false`, no file). AC8 has the
  orchestrator pass nothing for unmarked tasks, so the unmarked (kill-switch) implementer
  brief fails to write. Needs the slot server-defaulted or an empty caller value stated.
- **R2-3 (MINOR)** — R4 AC13 `seams` has no entry when `testFiles` (author's committed
  files) is a superset of the `Test:` lines; state the fallback.
- **R2-4 (MINOR)** — R8 AC3's TOOLS-REFERENCE list does not require documenting the new
  implementer-template slot the R3 AC4 fix added.
- **Design-must-resolve (carried, not numbered)** — R5 AC7 + D10: cross-call persistence of
  "the latest proof" between the gate and the verifier's `review-task record`
  (`review-task.ts:858`); no store/key named. Also `test-author` has no standing brief;
  path/git context must reach it via `job` (R2 AC4/AC10).

## Patterns & Themes

- **Fixes re-open the seams they touch.** Both round-2 findings sit in text the round-1 fix
  wrote: R1-6's parser-destination clause created a contradiction (R2-1); R1-3's slot named
  a mechanism the `brief` action makes mandatory (R2-2). The delta-first, fix-induced
  pattern the prompt warned about held exactly.
- **The parser and the gate rules are being coupled implicitly.** AC3 now needs `isTestPath`
  (a `gate-rules` export) at parse time without saying so.
- **The server/orchestrator boundary is still the weak seam** (carried from v1): every field
  the orchestrator must inject into a server-authored brief needs an explicit, optional
  channel, or it breaks either the marked or the unmarked path.
- Citations remain clean: the one anchor the delta moved (R6) is accurate at both ends.

## Guidance for Next Review

- Re-check R2-1 and R2-2 against v3's disposition; classify Recurring/Compounding/Novel.
- If AC1/AC3 is reconciled, confirm the chosen owner (AC1 gains "test path" vs AC3 drops
  non-promotion) does not orphan the lint warning or the `tests[]` seam derivation (R2-3).
- If the implementer slot is reworded, confirm it is server-defaulted or the orchestrator
  passes an empty value, and that the unmarked path still writes a brief (`harness.ts:665`).
- Well-covered, do not re-mine: R6 render gate (R1-1), AC9 full-output (R1-2), AC14 command
  scope (R1-4), the base/head outcome enumeration and risk-tier truth table (checked clean
  this round).
- Fresh lenses used: v1 wire contracts; v2 internal-contradiction truth table. A future
  round could apply base-worktree failure/rollback paths (partial `finally` cleanup,
  `git worktree prune` racing a concurrent gate) or the cost of editing `review-task.ts` (a
  sensitive path that forces a verifier on its own tasks).
