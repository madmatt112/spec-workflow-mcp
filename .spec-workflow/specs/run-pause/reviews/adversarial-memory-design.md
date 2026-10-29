# Adversarial Review Memory — design

Last updated: 2026-10-29 (Round 1)

## Cumulative Findings Summary

### Accepted
- none yet (round 1 pending disposition)

### Partially Accepted
- none

### Rejected
- none

### Unresolved
- **R1-1 (SHOULD_FIX)** — No operator stop between implementation `complete` and the merge
  stage. `runOnce` calls `runMergeStageStep` at `runs.ts:947` with no `isPauseRequested` check;
  `runMergeStage` merges a rule-passing PR (`runs.ts:663,672-675`) before the only operator
  guard, which sits in the `blocked` branch (C3 point 3). A `running` run held during its last
  implementation step auto-merges its PR, defeating D9/Req 7. Fix: stop at the merge-stage entry
  (save `merge` cursor + `pause(OPERATOR_PAUSE)`) and fix C3 point 1's "boundary between phases".
- **R1-2 (MINOR)** — C2 says the pause route reuses the cancel route's handler shape, but the
  three-way `undefined→404 / null→409 / record→200` is the resume route's shape; cancel has no
  409. Wording only.
- **R1-3 (MINOR)** — `isPauseRequested` adds a per-check synchronous `readRunSync` (alongside the
  existing `windowBlock` sync read); the added per-check I/O is unstated. Safe for implementation.

## Patterns & Themes

- The design is well-grounded: every cited path/range/signature matches the code, and the
  hard races (writeRun carry rule D2, resume-vs-pause-write Error Handling 4, 30 s merge poll
  vs. the new `isStartable` first-rule) are traced and sound.
- The single real gap is a stop-point *enumeration* omission, not a false claim: the design
  guards every phase reached through the `runOnce` loop top and the merge-*resume* path, but
  the implementation→merge *entry* at `runs.ts:947` is a direct call that bypasses the loop top.
  Pattern to watch next round: any other direct inter-phase call in `runOnce` (none found
  besides 947; done-routing close-out merge at 850-858 is reached via the loop top, so safe).

## Guidance for Next Review

- If R1-1 is accepted and fixed, re-check: (a) the new merge-entry stop saves the `merge`
  cursor so Resume re-enters the merge stage (Req 4 AC 2, C5), not the implementation phase;
  (b) the Testing-Strategy case for an immediately-mergeable held PR was added; (c) C3 point 1's
  wording was corrected.
- Do not re-raise the `writeRun` serialisation, the document round-top RE-DECIDED (D3), or the
  merge-poll/`isStartable` interaction — all checked and sound this round.
- Verify the `resumeNow` held branch lands *first* (before the `status !== 'paused'` return,
  `controller.ts:210`); mis-ordering silently regresses Req 4 AC 4 to a 409.
