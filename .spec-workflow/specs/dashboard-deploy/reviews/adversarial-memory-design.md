# Adversarial Review Memory — design
Last updated: 2026-11-05 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Release did not emit `runEvents` like press step 6; released
  non-driven runs showed a stale "held for deploy" row until the 30 s tick. v2 added the emit
  to C1 Release. *But the fix mis-placed the emit — see R2-1 Unresolved.*
- **R1-2 (SHOULD_FIX, v1)** — controller `done` write not pinned to preserve `commit` (R6 AC7).
  v2 made "Failed and done writes keep the record's other fields, commit included." Verified
  adequate in round 2.
- **R1-M2 (MINOR, v1)** — `execDeploy` refusal omitted `state: 'refused'`. v2 added it; matches
  `execMerge` (`src/advisor/actions.ts:350`). Verified.

### Partially Accepted
- (none)

### Rejected
- **R1-M1 (MINOR, v1)** — launch-during-deploy surfaces as 409 `run-live`, not `deploy-open`.
  Rejected v2: `launchBlock`'s deploy refusal + the 409 meet R4 AC9; the enqueue-race
  discriminant is cosmetic, reworking it widens scope. Closed — do not re-open.

### Unresolved
- **R2-1 (SHOULD_FIX, round 2, Compounds R1-1, fix-induced)** — C1 Release attributes the
  `runEvents` emit to `updateRun`, but C2 places `updateRun` in `state.ts`; `runEvents` lives
  in `runs.ts:58` and `state.ts` must not import `runs.ts` (runtime-cycle guard at
  `state.ts:18`). The emit belongs in the coordinator (`deploy.ts`), as press step 6 and
  `controller.ts:211` do. Fix: re-attribute the emit to the coordinator, or relocate
  `updateRun` out of `state.ts`.

## Patterns & Themes
- **The dominant defect shape is confirmed and recurring: write/emit semantics stated
  explicitly for one path and mis-stated or implicit for the mirror path.** Round 1 found it
  twice (press-emits/release-silent; failed-keeps-fields/done-silent). The R1-1 *fix* then
  introduced a third instance (R2-1): press correctly makes the emit a coordinator step, but
  Release's fix welded it onto `updateRun`. Every future delta that touches an emit/write
  pairing should be checked for which component actually performs it and whether that
  component's layer can.
- Layering matters here: `runEvents` is a `runs.ts`/`controller.ts` (controller-layer) event;
  `state.ts` is strictly below and guarded against the cycle. Any design sentence that makes a
  `state.ts` primitive emit a controller event is wrong by construction.
- Citations remain accurate throughout; re-verifying paths is low-yield. Spend rounds on
  behaviour and component/layer responsibility.

## Guidance for Next Review
- If R2-1 is accepted, re-check only that the emit clause in C1 Release names the coordinator
  (or that `updateRun` moved out of `state.ts`), and that press step 6 wording still matches.
- Do not re-open: R1-M1 (ruling), D13–D26, the systemd probes, the live-proof deferral (D26),
  data-model/race-loser completeness (passed), error-branch discriminant+status (passed).
- Well-covered, skip: citation paths/ranges; the claim/cancel race (D15); persist-before-spawn
  (D3); onStart-before-recover (D21); chain-write hold (D22); quiet-includes-drives (D17).
- Fresh lens not yet spent: a full wire-serialization/path-leak pass on `error`/`runs` (spot-
  checked clean in round 1). Consider it only if the delta reopens those fields.
