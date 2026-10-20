# Adversarial Review Memory — tasks
Last updated: 2026-10-20 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Task 7 `Success:` omitted Req 6 AC 5 (not-committed /
  "run doctor" last line). Fixed in v2 (tasks.md:81); re-checked resolved in r2.
- **R1-2 (SHOULD_FIX, v1)** — Task 8 reporter/exit contract (Req 7 AC 3) not
  assertable through `runChecks`/`serviceEnv`. Fixed in v2 by a `runDoctor` seam
  (tasks.md:87); re-checked resolved in r2.

### Partially Accepted
- (none)

### Rejected
- **R1-M1 (MINOR, v1)** — Task 7 breadth (21 req IDs, 3 phases). Ruled acceptable
  in v2 Revision History: one cohesive command/module with a declared up-front
  verifier; splitting invents shared-state seams. Closed — do not re-open.

### Unresolved
- (none)

## Patterns & Themes
- Both v1 SHOULD_FIX were the same class: a user-visible output/exit behaviour
  named in the `Task:` body but not pinned to the `Success:` clause / a `- Test:`
  seam (retro-P7 silent drop). Both now closed.
- r2 re-swept retro-P7 across all tasks: three more Task-body phrases sit outside
  their `Success:` clause (task 7 "always send both paths" D2, task 7 "realpath
  both roots" D9, task 2 "failed write rejects" D3) but each is either
  functionally redundant with an asserted path or not AC-mandated — examined and
  cleared, not raised.
- All citations accurate across v1 and v2; lint only added `src/` prefixes and one
  code span. No misstated-artifact risk.
- Coverage (AC→task, component→task) and dependency ordering complete and sound.

## Guidance for Next Review
- Clean round at v2: VERDICT converged, 0/0/0, DESIGN_READY yes. No further
  adversarial round is needed unless a new delta lands.
- If a delta does land, attack it first. The `.mcp.json` key/order-preservation
  and `was:`-clause edge cases remain the one un-stressed lens (deep-compare, env
  suppression) — use only if a future delta touches task 7's write phase.
- Do not re-raise: task 7 atomicity (R1-M1, closed), citation prefixes
  (lint-closed), R1-1/R1-2 (resolved).
