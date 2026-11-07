# Adversarial Review Memory — design

Last updated: 2026-11-07 (after v2 review, round 2)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX)** — C5 drafting-only cap omitted `D += 1`; lint/check/approve/note
  named the stale version. Fixed in v2: block now mirrors should-fix-only path
  (reviserStep → `D += 1` → lintStep(D) → narrowCheck(D) → approve(D), note v(D+1)).
  Re-verified round 2 against document.ts:452-468/892-903. CLOSED.
- **R1-2 (SHOULD_FIX, destructive)** — C9 "direct POST deletes nothing" was false while
  the reuser was non-live (branchHeld is live-only). Fixed in v2: both `toRow` and
  `Controller.discard` (controller.ts:388) guards gain `|| branchReused`; toRow forces
  `branchPresent:false` (no branch read) so the reused run leaves the band. Re-verified
  round 2 against controller.ts:388, runs.ts:1509, board.ts:39. CLOSED.
- **R1-3 (MINOR)** — C2 empty-tasks.md fall-through. Fixed in v2: decomposition read only
  when tasks.md absent; existing tasks.md with no File: entries gives no-list (matches
  Req 2 AC 7). CLOSED.
- **R1-4 (MINOR)** — C7 writeRunLocked terminal-read phrasing. Fixed in v2: disk read now
  covers terminal writes (if (!terminal) gate at state.ts:442 lifted), so a losing
  error/done write cannot clobber abandoned (Req 7 AC 3). CLOSED.

### Partially Accepted
- (none)

### Rejected
- **R1-5 (MINOR)** — close-out reference plan examples (P6/P11/G1/G2). Ruled illustrative;
  the close-out integration test pins concrete behaviour. Recorded in Revision History v2.
  Closed by ruling — do not re-open without new evidence (Recurring only).

### Unresolved
- (none)

## Patterns & Themes
- Citations remain uniformly accurate across v1 and v2 (all new v2 citations —
  controller.ts:388, state.ts:442, document.ts:452-468/892-903, board.ts:38-44 —
  verified both ends). The citation-identifier lint class is a standing false positive
  (46 at v1, 54 at v2, all rejected under rule 11); none is a misstated artifact.
- Both round-1 SHOULD_FIX were "mirror an adjacent correct path but drop one step"
  (C5 missing D++, C9 live-only predicate where any-status needed). v2 fixed both by
  aligning to the adjacent path. Round 2 confirmed the alignment is exact.
- v2 deltas were tight and surgical; no fix-induced regression. The remaining C7/C8/C11/
  D10/D11/C1 changes are lossless prose simplifications.
- Data Models / error-branch / library-capability directives: all satisfied since v1.

## Guidance for Next Review
- This round converged (0 MUST_FIX, 0 SHOULD_FIX, DESIGN_READY yes). No further review
  round is needed unless the document changes again.
- If re-opened: the only implementation-layer items the design defers are the
  writeRunLocked void→boolean return threaded through writeRun/save/patchRun, and the
  toRow branch-read skip for a reused run — both stated, feasible, tasks-phase work.
- Well-covered, do not re-examine: all citations (accurate), the C5 version chain,
  the C9 discard/stopped-band seam, the C7 abandoned guard, the C2 source precedence.
- Rulings in Revision History (R1-5) are closed. No fresh lens assigned.
