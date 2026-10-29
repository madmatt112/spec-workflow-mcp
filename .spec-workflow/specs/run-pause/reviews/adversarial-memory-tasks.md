# Adversarial Review Memory — tasks

Last updated: 2026-10-29 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (SHOULD_FIX, Novel)** — T2's merge-fix round stop (design C3 point 3,
  `src/controller/runs.ts:696`, blocked branch) is in the `_Prompt` body but has no
  `Success:` criterion and is not listed in the "Not tested directly" scope note (which
  exempts only the merge-stage-entry stop, point 4 / 624). A hold set during the blocked
  PR read on the post-implementation path (`runs.ts:947`) reaches 696 as the only guard
  before `runMergeFixRound` spawns (`runs.ts:711`); untested, so a mis-implementation
  ships uncaught and a held run can still spawn a merge-fix step (Requirement 2 AC 2/AC 3).
  Fix: add a case, or extend the not-tested note to cover point 3.
- **R1-2 (MINOR, Novel)** — T1 `_Prompt` body requires `readRunSync` to return undefined
  for a missing *or unparsable* file; the `Success:` clause asserts only the missing-id
  case. Unparsable branch not test-driven.

## Patterns & Themes
- The document's untested-code accounting (Scope notes "Not tested directly" + per-task
  Notes) is otherwise disciplined; the one lapse is treating the two merge-stage stops
  (entry 624, merge-fix 696) as one. Future rounds: check each design C3 stop point has
  either a Success criterion or an explicit exemption.
- `Success:`-clause vs `Task:`-body test parity (retro P7) is the live seam here, not
  citation accuracy — every cited artifact verified accurate on this round.

## Guidance for Next Review
- Re-verify the reviser either added a merge-fix (696) success case or an exemption note,
  and that T1's `Success:` names the unparsable file.
- Do not re-open: the D3 document-phase round-top-only stop (closed ruling, requirements +
  design Revision History); the merge-stage-entry stop (624) outcome-only test (D3).
- Atomicity (serialised per-id `writeRun`, carry-from-disk) and the requirement→task
  coverage map were fully checked and are sound; no need to redo unless a fix touches them.
