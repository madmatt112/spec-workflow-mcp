# Adversarial Review Memory — design

Last updated: 2026-11-07 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — C5 drafting-only cap omits `D += 1`. reviserStep('drafting-only')
  writes v(D+1); the flow then lintStep(D)/narrowCheck(D)/approve(D) and the note `v<D>`
  target the stale pre-revision version. Parallel should-fix-only path (document.ts:892-903)
  increments D. Fix: increment and name v(D+1).
- **R1-2 (SHOULD_FIX, destructive)** — C9 "a direct POST deletes nothing" is false unless
  `Controller.discard` (controller.ts:388) adds a `branchReused` check. Today it uses
  `branchHeld`, which is live-only (runs.ts:1484); the canonical dashboard-deploy reuser is
  not live, so discardRun would delete the branch + close the PR (AC 6 violation).
  "branchHeld keeps its meaning" muddies the mechanism.

## Patterns & Themes
- Citations are uniformly accurate (all ~30 checked, both ends; lint-pass deltas clean).
  Attack the LOGIC deltas, not the artifacts.
- Both findings are "mirror an adjacent correct path but drop one step": C5 omits the D++
  the should-fix path has; C9 relies on a live-only predicate where an any-status one is
  needed. Round 2 should check every place a new primitive (branchReused, drafting-only)
  must be wired that the prose only names once.
- Data Models / error-branch / library-capability directives: all satisfied in v1.

## Guidance for Next Review
- Verify the reviser added `D += 1` to the drafting-only block and corrected the note +
  approve to v(D+1); scope that as a fix-induced re-check against document.ts:892-903.
- Verify `Controller.discard`'s guard explicitly gains `branchReused`, and that the
  controller.test.ts reused-run fixture uses a non-live reuser.
- MINORs not blocking: C2 empty-tasks.md precedence; writeRunLocked terminal-read phrasing;
  C3 Reference-plan P6/P11 examples vs the real option-lifecycle-events `## Decisions`.
- Rulings recorded in Revision History are closed. No fresh lens assigned for round 1.
