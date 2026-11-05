# Adversarial Review Memory — tasks

Last updated: 2026-11-05 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MINOR, gate-c:T9)** — `SDD_DEPLOY_DISABLED` env switch is beyond the approved
  requirements and design (confirmed absent from both by grep); a second production disable path
  past R3 AC8's `--smoke`. Declared in D27 / Scope notes. Carried to the human gate C; not rework.
- **R1-2 (MINOR)** — task 7 Success omits the `wait` stage write (R2 AC1 sub-case); redundant with
  the controller's seeded `stage:'wait'` and unobservable through the stage seams.
- **R1-3 (MINOR)** — task 12 cites whole C9/C10 but defers RunsPage/ShellProvider/WebSocketProvider/
  DeployControl to task 13 (which lists them). Consistent with the doc's multi-task split
  convention (C1→2/3/4, C3→5/6, C4→7/8); not a lost or out-of-scope edit.

## Patterns & Themes
- Document is tightly tracked to a mature design (req v5, design v3). Coverage of ACs and
  components is complete; ordering chain is conservative and the one implicit edge (R4 AC6
  recovery path) is sound because `recover`→`resumeIfWaitAnswered`→`onWaitChange`.
- Lint-pass deltas were cosmetic (component labels, `./`-prefixed config citations, bridge-missing
  forward-number drops). All verified correct against the code.
- The doc uses a uniform "Per design <whole component>" + restriction-deferral style across every
  multi-task split; do not flag one instance of it as a scope defect without flagging all.

## Guidance for Next Review
- Deltas to re-verify will be whatever the v2 reviser changes; this round is converged.
- If a round reopens R1-1, note it is a human gate-C decision, not a reviewer rework demand.
- Do not re-raise R1-3 as a File-list violation — it is the document's accepted split convention.
- Base facts confirmed this round: base has 6 ShellMessage types ("sextet", `shell-feed.ts:83`);
  `state.ts:91` = `pauseRequested`; `writeRunLocked` 419-445 / `writeRun` 447-455;
  `controller.ts:546` status guard, `:353` recover→resumeIfWaitAnswered; resume route `:833-839`
  does only `===` checks (sentinel-safe).
