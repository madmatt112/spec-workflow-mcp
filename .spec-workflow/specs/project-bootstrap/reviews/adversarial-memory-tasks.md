# Adversarial Review Memory — tasks

Last updated: 2026-10-20 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet; round 1 just raised)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Task 7 `Success:` omits Req 6 AC 5 (the not-committed /
  "run doctor" last line named in the `Task:` body); retro-P7 silent drop.
- **R1-2 (SHOULD_FIX)** — Task 8 success criterion "last line names first failure, exit
  1 else 0" (Req 7 AC 3) is not assertable through its seams (`runChecks`, `serviceEnv`);
  `runDoctor` has no `- Test:` line and task 10 covers only exit 0.
- **R1-M1 (MINOR)** — Task 7 breadth (21 req IDs, 3 phases); acceptable, noted only.

## Patterns & Themes

- Both SHOULD_FIX findings are the same class: a user-visible output/exit behaviour named
  in requirements and in the prompt body, but not pinned to the `Success:` clause / a
  `- Test:` seam, so red-first testing drops it. Watch terminal-line and exit-code
  contracts specifically.
- All citations in v1 are accurate; the lint pass only added `src/` prefixes and code
  spans. No misstated-artifact risk this round.
- Coverage (AC→task, component→task) and dependency ordering are complete and sound.

## Guidance for Next Review

- Re-check R1-1/R1-2 against the fix diff only (fix-induced re-check), not a full
  re-review: confirm task 7's `Success:` gains the terminal-line assertion and task 8
  gains a `runDoctor` seam (or a narrowed `Success:`).
- Fresh lens not yet used: the `.mcp.json` key/order-preservation and `was:`-clause
  edge cases (deep-compare, env suppression) — a round-2 lens if deltas warrant.
- Do not re-raise: task 7 atomicity (ruled acceptable), citation prefixes (lint-closed).
