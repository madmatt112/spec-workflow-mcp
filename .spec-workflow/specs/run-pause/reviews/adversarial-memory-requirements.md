# Adversarial Review Memory — requirements

Last updated: 2026-10-29 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet; dispositions land after the reviser round)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MUST_FIX, Novel)** — Two response-body citations exclude the artifact line.
  `src/dashboard/multi-server.ts:808-813` anchors `404 { error: 'run-not-found' }` but the body is
  at 814; `:816-822` anchors `409 { error: 'not-paused' }` but the body is at 823. Wrong line
  ranges. Fix: anchor at 814 and 823.
- **R1-2 (SHOULD_FIX, Novel)** — R4 AC2 "Resume re-enters the merge stage" has no durable signal.
  R2 AC2's pause write sets `status:'paused'`, erasing `status:'merging'` (the only thing
  `resumingMerge` keys on, `runs.ts:779`). A `not-ready` merging run (`runs.ts:677`) keeps cursor
  `stepKind:'implementation'` (`runs.ts:926`) and opens no merge wait, so on Resume `resumingMerge`
  is false and `routeRun` skips merge → PR never merges. Requirement must name a persistent
  merge-resume marker.
- **R1-3 (MINOR, Novel)** — R6 AC2 requires row-level Pause busy + error display, but
  `ControllerRunRow` (`RunsPage.tsx:209-233`) is stateless with no error surface; "as the panel's
  other actions do" has no target on a row. Specify the row error/busy surface or defer the render
  location explicitly.

## Patterns & Themes
- Citation precision: body/response anchors drift one line off the quoted artifact (lands on the
  handler opener, not the body line). Re-check every response-shape citation against the exact line.
- The `merging → paused` transition is the fragile seam: it overwrites the only on-disk
  merge-resume signal. Any AC that resumes a paused-from-merging run must say how the signal
  survives.
- Scheduler red-first points (`isStartable:333-339`, `schedule:316-327`) are correctly flagged by
  the drafter; do not re-litigate.

## Guidance for Next Review
- Deltas verified clean this round (access.ts anchor, handleDocumentOutcome anchor). Start from the
  reviser's disposition of R1-1/R1-2/R1-3.
- Fix-induced re-check: if the reviser nudges the two body anchors, verify only that 814/823 now
  fall inside the ranges — not a full re-read.
- Next fresh lens candidate (if not reused): failure-mode / crash-recovery ordering (R5 AC3-AC5)
  vs the live-step re-attach path (`controller.ts:261-289`).
- Confirmed-sound areas not worth re-attacking without new evidence: live/terminal status
  partition (R1), `runEvents` emission (R1 AC7), R4 AC3 window re-park via `runs.ts:831-836`.
