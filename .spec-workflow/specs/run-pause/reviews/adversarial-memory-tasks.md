# Adversarial Review Memory — tasks

Last updated: 2026-10-29 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — T2's merge-fix round stop (design C3 point 3,
  `src/controller/runs.ts:696`, blocked branch) was in the `_Prompt` body but had no
  `Success:` case and no exemption. RESOLVED in v2: task 2 gained a Success case (line 27)
  for a run that enters the merge stage unheld, reaches a blocked fix-eligible PR, and is
  held before the 696 stop — ends paused/operator with cursor stepKind merge and no
  merge-fix round spawned. Re-verified correct against the code (696 cancel guard, 689-691
  cursor save, 711 spawn, 779-781 merge-resume read). Accounting now distinguishes the
  entry stop (624, exempted) from the merge-fix stop (696, tested).
- **R1-2 (MINOR, v1)** — T1 `Success:` asserted only the missing-id `readRunSync` case,
  not the unparsable file the body promised. RESOLVED in v2: Success widened (line 16) to
  "undefined for an unparsable file". Matches body, design C1, and `listRunsSync` catch-all.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- (none)

## Patterns & Themes
- The document's untested-code accounting (Scope-notes "Not tested directly" + per-task
  Notes) is disciplined; the one round-1 lapse (conflating the two merge-stage stops) is
  fixed. Every design C3 stop point now has either a Success criterion or an explicit
  exemption.
- `Success:`-clause vs `Task:`-body parity (retro P7) was the live seam; both lapses closed.
- Citation accuracy is perfect across every round so far — all cited ranges verified.

## Guidance for Next Review
- The document is converged at v2 (0/0/0). No open findings to re-check.
- Do not re-open: the D3 document-phase round-top-only stop (closed ruling); the
  merge-stage-entry stop (624) outcome-only test (D3); R1-1 and R1-2 (resolved).
- Atomicity (serialised per-id `writeRun`, carry-from-disk), ordering (1→9) and the
  requirement→task coverage map were fully checked and are sound; redo only if a fix
  touches them.
