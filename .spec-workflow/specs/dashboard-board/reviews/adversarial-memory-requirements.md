# Adversarial Review Memory — requirements

Last updated: 2026-11-06 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MUST_FIX)** — R12 AC 1's single "Discard allowed" row field cannot encode R7 AC 6/AC 7's three stopped-run outcomes (no-branch → no tile; branch-in-use → tile, no Discard; free → tile+Discard). `ControllerRunRow` (runs.ts:1428-1451) carries no `branch` field and Security NFR forbids paths, so the frontend has no other branch-presence signal. Needs a second signal or an explicit server-side filter rule for `controller-runs`.
- **R1-2 (SHOULD_FIX)** — R12 AC 2 cites runs.ts:455-458 (`onStepSpawn`) for the task-id write, but that callback gets only {step id, pid, numeric startTime}. Task id lives in phases/implementation.ts (runTask / step-id string). Scope note's enumerate additions (runs.ts, state.ts) omit the phase file / `onStepSpawn` contract. ISO-vs-/proc startTime conversion also unstated.
- **R1-3 (SHOULD_FIX)** — R4 AC 1 "first line of questions[0].text" + "kind's fallback line" is undefined for gate-a/gate-b/retro-plan: `ctrlSummary` (NowPage.tsx:66-78) summarises those by count/proposals, never by questions[0].text, and has no fallback branch there.
- **R1-4 (SHOULD_FIX)** — R6 AC 6 covers running (pause.ts:43) and waiting (pause.ts:45) pending-pause, but cites only :42-43 and doesn't say whether the waiting composite note collapses to "pausing after this step" or keeps its resume-time context.
- **R1-5 (MINOR)** — Intro ("changes the shell, Home and the run row") undersells R7/R8/R12 controller-lifecycle changes; scope note partly repairs.

## Patterns & Themes
- Wire-contract under-specification where a single new row field is asked to carry a multi-valued state (R1-1), and where a cited write site lacks the data the AC names (R1-2). The row deliberately carries no path/branch (Security NFR, R12 AC 4), so any frontend decision needing branch state must be an explicit new signal.
- Universal-rule ACs that ignore kind-specific existing behaviour (R4 AC 1 vs ctrlSummary's gate/retro branches).
- All artifact citations are accurate this round — the lint pass left paths/ranges correct; the gaps are logical, not factual.

## Guidance for Next Review
- Confirm the reviser picked ONE mechanism for stopped-run tile visibility vs Discard permission (second row field, or server filters `controller-runs`); if a second field was added, check it is path-free and that R3 AC 7 / R7 AC 6-7 all read from the right signal. Treat any regression of that wording as a fix-induced re-check scoped to the diff.
- Re-probe R12 AC 2's write-source once design names it (verify the task id actually reaches the row; watch for the step-id parse vs contract change).
- Next fresh lens to rotate in (not used round 1): failure modes / error paths (failed branch read, failed setup fetch, socket-down selection), or testability of the ACs that assert "within N s with no reload".
- Citations verified accurate round 1; re-verify only ranges the reviser touches.
