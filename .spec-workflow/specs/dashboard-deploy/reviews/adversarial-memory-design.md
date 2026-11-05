# Adversarial Review Memory — design

Last updated: 2026-11-05 (round 1)

## Cumulative Findings Summary

### Accepted
- (none yet; round 1 just raised)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Release (R3 AC6) does not emit `runEvents` the way press step 6 does.
  The hub pushes only the strip on `deployEvents`; run rows refresh on `runEvents` or the 30 s
  fallback. A run `paused` for `usage-window`, held and then released keeping its status, shows a
  stale "held for deploy" row for up to 30 s after the strip reads `done`/`failed`.
- **R1-2 (SHOULD_FIX)** — The controller's `done` write (onStart, R3 AC1) is not pinned to preserve
  `commit`. R6 AC7 requires `commit` on the done strip; C1 states field preservation only for the
  failed write. A reconnecting page reads the controller's `done` record (C7 Timing), which could
  drop `commit`.
- **R1-M1 (MINOR)** — Launch during a deploy surfaces as 409 `run-live` (launchSpec catch), not the
  resume route's `deploy-open` discriminant.
- **R1-M2 (MINOR)** — `execDeploy`'s proposed refusal return omits `state: 'refused'` (execMerge sets
  it); landing state only, R4 AC10 met regardless.

## Patterns & Themes
- The design is precise on its hard concurrency problems (claim/cancel race D15, persist-before-spawn
  D3, chain write D22, quiet-includes-drives D17, release-by-scan D24). Both SHOULD_FIX findings are
  the same shape: write/emit semantics stated **explicitly for one path (press, failed) and left
  implicit for the mirror path (release, done)**. Look for that asymmetry in future rounds.
- Every cited artifact verified accurate; the v1 lint pass path-qualification was mechanical and
  correct. Citation re-verification is low-yield here — spend the next round on behaviour, not paths.

## Guidance for Next Review
- If R1-1/R1-2 are accepted, re-check only the fix diffs: that release emits `runEvents` for touched
  runs, and that the done/release writes preserve `commit` (and `runs` until release completes).
- Do not re-open the systemd probes or D13–D26 (recorded rulings carried from requirements v2–v5).
- Live-scenario proof is deferred to `verification-evidence.md` (D26) by design — not a finding.
- Fresh lens not yet used: data-model/race-loser shape completeness was checked and passed
  (`DeployRecord`, `ControllerDeploy`, press/cancel unions, the four route error branches all pinned
  with discriminant + status). A future round could take a wire-serialization/path-leak lens on the
  `error` and `runs` fields (checked once here: error texts sanitized, run ids path-free — passed).
```
