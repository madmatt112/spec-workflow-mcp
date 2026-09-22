# Adversarial Review Memory — requirements

Last updated: 2026-09-22 (after v2 review — round 2, on doc v3)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v3)** — D2 split: start-refusal (no row, D5) vs mid-run missing-launcher
  (`PHASE: error`, Req 2 crit 4). Fixed in v3.
- **R1-2 (SHOULD_FIX, v3)** — Req 2 crit 5/6 now pass the `claude-*` alias the endpoint maps
  (not the DeepSeek name). Fixed in v3 — but see R2-1: the fix left the response-side
  `message.model` claims unreconciled.
- **R1-3 (SHOULD_FIX, v3)** — D5 states map/key checks finish at the roots step before run
  id / `event.sh` / pointer line / `run.start`. Verified in v3 against `SKILL.md:71-72` vs
  `76-86`. Correct.
- **R1-4 (SHOULD_FIX, v3)** — Scope note records decomposition scenario 4 still reads "with a
  note"; Req 7 "as written" = the outcome. Fixed in v3 (but only scenario 4 recorded — see
  R2-3).
- **R1-5 (SHOULD_FIX, v3)** — Req 2 crit 1 adds `HARNESS_REPO` (`SKILL.md:204`) to `launch.sh`.
  Verified accurate in v3.
- **R1-6 (SHOULD_FIX, v3)** — Req 2 crit 7 rewritten for main-checkout document-phase context;
  worktree-cwd premise dropped. Verified against `SKILL.md:270-282`. Correct.
- **R1-7 (SHOULD_FIX, v3)** — Req 2 crit 5's `agent-profiles.json` rationale reworded to "feeds
  the `--agents` JSON's ignored `model`/`effort` keys." Fixed in v3 — but the new wording is
  itself problematic (see R2-2).
- **M1 (MINOR, v3)** — Req 3 crit 3 requires a fresh `--session-id` per launcher call. Fixed.
- **M2 (MINOR, v3)** — fifth machine-read line count word; implementation-phase follow-through.

### Partially Accepted
- (none)

### Rejected
- (none — round 1 rejected none; round 2 opened no rejections)

### Unresolved (round 2, on doc v3)
- **R2-1 (MUST_FIX, Compounds: R1-2, fix-induced)** — the R1-2 alias fix makes the request
  carry `claude-opus-4-8`, but Req 4 crit 4 (credential proof) and Req 7 crit 1 (E2E assertion)
  still require the child's `message.model` to be a DeepSeek name; Req 3 crit 1 (`spawn.start`
  DeepSeek name) vs crit 2 (`spawn.end` actual `message.model`) also disagree. The response
  model field is never settled and preflight (a) does not gate on it (Req 6 crit 2). If the
  endpoint echoes the request, the credential proof voids (Anthropic and DeepSeek both report
  `claude-opus-4-8`) and the E2E test fails on a correct run. This is R1-2's own un-closed
  second half (preflight asserts nothing about `message.model`), re-manifested through the
  accepted fix.
- **R2-2 (SHOULD_FIX, Compounds: R1-7)** — Req 2 crit 5 asserts the `--agents` `model`/`effort`
  keys are "ignored" and reads `agent-profiles.json` to fill them, while Req 6 crit 5 schedules
  the preflight to discover whether `--agents` even accepts those keys. Launcher built on an
  unproven schema fact; and if the keys are ignored, the `agent-profiles.json` dependency is
  unmotivated.
- **R2-3 (MINOR, Compounds: R1-2, R1-4)** — Req 2 crit 5/6's `--model`/`ANTHROPIC_MODEL`
  contract reverses `decomposition.md:344,346` ("--model the DeepSeek name"), and the
  decomposition's "Decided" bullet (`371-373`) still says "refuses at `run.start` with a note"
  (conflicts with D5 twice). Only scenario 4 (383-384) is recorded in Scope notes; these are not.
- **R2-4 (MINOR, Compounds: R1-1)** — Reliability NFR (line 123) still groups the missing
  launcher with the start-refusals ("a missing key, launcher or bad map row stops the run"),
  the distinction R1-1 was accepted to draw. The missing launcher is the mid-run `PHASE: error`
  path (rows written), not a no-row start refusal.

## Patterns & Themes

- **Assert-what-you-also-probe.** The document repeatedly states as settled a fact that its own
  preflight is scheduled to measure: `message.model`'s value (R2-1) and `--agents` key
  handling (R2-2). This is the dominant round-2 pattern and the source of the MUST_FIX. Any
  clause that hard-codes a DeepSeek-endpoint behaviour should be checked against Req 6's probe
  list — if the preflight measures it, no earlier criterion may assume its answer.
- **Half-swept fixes.** Round 1's pattern (a decision change applied to criteria but not to
  rationale / cross-artifact claims) recurred at round 2: R1-2 fixed the request side but not
  the three response-side `message.model` clauses; R1-4 recorded scenario 4's divergence but not
  the twin at decomposition 344/346/371-373; R1-1 split D2 but left the Reliability NFR
  conflating the cases. When a fix changes a value or a path, sweep every clause that consumes
  the *result* of that value, not just the clause that sets it.
- Citations remain accurate (spec-lint clean on v3; I re-read both ends of every range the
  round-1 delta introduced). Later rounds can trust `path:line` resolution and attack meaning.

## Guidance for Next Review

- Confirm R2-1 is resolved by a real reconciliation: `message.model` made a preflight probe
  with a defined branch AND the credential proof (Req 4 crit 4) re-based on a signal that
  survives the `claude-*` alias. Do NOT accept "preflight records message.model" as a fix — that
  is the exact non-fix R1-2 already produced once.
- Check whether Req 2 crit 5 still asserts `--agents` keys are "ignored" as settled, or makes it
  contingent on Req 6 crit 5 (R2-2).
- Re-read the Reliability NFR and Scope notes for the residual decomposition divergences
  (R2-3, R2-4) — small, but they are the tail of the half-swept-fix pattern.
- Well-covered, do not re-mine: refusal ordering (R1-3, verified), worktree/main-checkout
  context (R1-6, verified), `HARNESS_REPO` in launch.sh (R1-5, verified), fresh session-id
  (M1). Round 1's wire-contract lens and this round's contradiction/truth-table lens are both
  spent; a third round should try a testability lens (can each acceptance criterion be turned
  into a passing assertion as written?) if it needs a fresh angle.
- Rulings closed by revision history: RI-1 (refused-at-start writes no ledger row) and all nine
  round-1 findings (accepted, applied in v3). Do not re-open the decisions; only their
  incomplete propagation is fair game.
