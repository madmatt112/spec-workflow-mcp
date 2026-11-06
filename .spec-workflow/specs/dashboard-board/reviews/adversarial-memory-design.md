# Adversarial Review Memory — design

Last updated: 2026-11-06 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved (raised this round, awaiting reviser disposition)
- **R1-1 (SHOULD_FIX)** — C10 says run-dot classes "copy `Sidebar.tsx:37-41`", but that `DOT_COLOUR` map has only waiting(amber)/running(green)/idle(grey); C9 `runDot`/R6 AC 2 need a 4th, `red`. Red dot has no cited class; `board-view.test.ts` tests runDot's return, not the rendered class, so the miss isn't gated. Fix: map `red → bg-(--tone-danger-fg)`.
- **R1-2 (MINOR)** — C7 "only the sidebar read" of `now`/`controllerActivity`/`connected` is wrong (NowPage/RunsPage/RunPage read them too); deletion still safe since all readers are deleted and `connected` on `useShell` is sidebar-only while ConnectionBanner uses `useWs`.
- **R1-3 (MINOR)** — C6 deletion range `hub.ts:119-132` spans `overviewSnapshot` (123-129, must stay) and under-covers `watchedProjects` (131-134). Named identifiers correct; range loose.
- **R1-4 (MINOR)** — C7 doesn't enumerate removing `Gear.tsx:14` `useShell().density` destructure when density/setDensity are deleted; tsc would fail if left.

## Patterns & Themes
- Citations are accurate across the board (controller, server, feed, frontend, tests). The v1 lint pass fixed paths/ranges and the grouped `tokens.css` cite rotation (`--sidebar-w`:56 / `--row-h-compact`:53) is now correct.
- The weak spots are "copy from <cite>" / "only X reads it" style shorthands where the cited source is narrower than the behaviour, or the justification over-claims — none break the build except R1-4.
- Hard parts (Discard/relaunch race under store lock + two-clause branchHeld; done-discard cache staleness; controller→dashboard/harness layering; Tailwind 4.1.18 arbitrary-token probe) are all verified sound.

## Guidance for Next Review
- Re-check R1-1: did the reviser state the red dot's class source (`--tone-danger-fg`), or fold the dot into `ui.tile(tone)`? Confirm `tiles.tsx` dot rendering covers all four runDot values.
- Spot-check that the MINORs (R1-2/3/4) were tidied only as wording, with no change to the deletion contract.
- Fresh lens not yet spent: scenario/e2e coverage completeness (does `worktree-board.spec.ts`'s scenario set actually exercise each R4/R6/R7 state transition, esp. the red dot and merging tile), and the retained-tile/stage state machine under rapid press/leave races.
