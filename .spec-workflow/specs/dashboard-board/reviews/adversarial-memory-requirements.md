# Adversarial Review Memory — requirements

Last updated: 2026-11-06 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — R12 AC 1 single "Discard allowed" field couldn't encode R7 AC 6/AC 7's three stopped-run outcomes. v2 added a second signal ("branch present" + "Discard allowed"). Verified resolved against code (round 2).
- **R1-3 (SHOULD_FIX, v1)** — R4 AC 1 tile text undefined for gate-a/gate-b/retro-plan. v2 made it `ctrlSummary` (count, else q0, else fixed line). Verified matches `NowPage.tsx:66-78` (round 2).
- **R1-4 (SHOULD_FIX, v1)** — R6 AC 6 waiting-run pending-pause note unspecified. v2 split running vs waiting and cited `pause.ts:42-45`. Verified accurate (round 2).
- **R1-5 (MINOR, v1)** — Intro undersold controller surface. v2 names R7 and R12. Resolved.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (MUST_FIX, v2) — Compounds R1-2, fix-induced.** R12 AC 2's v2 wording "the step's ISO start time (converted from the numeric spawn value)" directs the wrong source. The numeric spawn value is `/proc/<pid>/stat` field 22 (clock ticks since boot; `state.ts:685-688`, `step.ts:511`, used only by `isProcessAlive`), not convertible to wall-clock ISO from the value alone. Correct source: `now().toISOString()` stamped in the `onStepSpawn` callback. Cascades into R6 AC 1/AC 2 step age. R1-2 (prior round) was the "ISO-vs-/proc conversion unstated" note; v2 resolved it the wrong way.

### Observations carried (MINOR, not loop-keepers)
- O1 — Reliability NFR: failed branch read → no tile hides an un-Discardable stopped run for one 60 s cycle; deliberate fail-safe, confirm intended.
- O2 — R7 AC 6 tile predicate is branch-presence only; an orphan worktree with no branch can't be Discarded from the board. Unverified whether close-out produces that state.
- O3 — R4 AC 1 says "first line of questions[0].text" but `ctrlSummary` returns full `q0`; binding clause pins real behaviour, harmless.

## Patterns & Themes
- **Fix-induced claim errors are the round-2 risk, as predicted.** R1-2's "unstated conversion" was closed by asserting a conversion that the cited numeric value cannot support (R2-1). When a prior round says "X is unstated," check that the fix states X *correctly*, not just that it states something.
- Wire-contract under-specification (R1-1) and universal-rule ACs ignoring kind-specific behaviour (R1-3) are now resolved; the row deliberately carries no path/branch (Security NFR), so any frontend decision needing branch state is an explicit server-computed bit — v2 did this correctly for tile/Discard.
- Citations remain accurate every round; the live defects are logical, in parenthetical "how" clauses the reviser added.

## Guidance for Next Review
- Re-check only the R2-1 fix diff (fix-induced re-check): confirm R12 AC 2 names the wall-clock spawn stamp, not a conversion of `/proc` `startTime`, and that it stays distinct from the `startTime` the row must not carry (Security NFR). Scope to that clause + R6 AC 1/AC 2, not a whole re-review.
- Well-covered, do not re-examine: R1-1 two-signal row model, R4 AC 1 ctrlSummary mapping, R6 AC 6 pause branches, all artifact citations (verified accurate both rounds).
- If R2-1 is accepted and clean, the document is a candidate for converged (0/0) next round unless the fix text introduces a new error.
- Unused fresh lenses for a later round if needed: testability of "within N s with no reload" ACs (R8 AC 5), socket-down project-filter selection.
