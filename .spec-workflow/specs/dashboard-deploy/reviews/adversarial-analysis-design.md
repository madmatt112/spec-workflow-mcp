# Adversarial Analysis — dashboard-deploy/design (v1), round 1

First review. Primary surface: feasibility, consistency, edge cases. Fresh lens: none.

## What I checked and how

The diff since the `v1` checkpoint is almost entirely the lint pass path-qualifying bare
`:N` citations. I re-read both ends of every load-bearing citation in the `## Changes since`
scope against the worktree:

- Script insertion points in `scripts/sdd-self-update.sh`: line 81 (`wait`, before the
  in-flight check), 191 (build), 213 (smoke), 239 (gate), 276 (second `check_move`, `swap`
  before it), 305–308 (restart/done), 180 (first `check_move`/`commit`), 299 (`npm ci`), 54
  (`log`), 59–75 (`write_error_wait`). All accurate.
- `scripts/sdd-service.sh:82` (`EnvironmentFile=-$ENV_FILE`, and `ENV_FILE=$SDD_HOME_DIR/service.env`
  — the design's `<home>/service.env` is right), `:84` (`UnsetEnvironment` of both keys), `:213`
  (`-p "EnvironmentFile=-$ENV_FILE"`). Accurate. No `KillMode` line in the unit (62–89), so the
  `control-group` default probe is consistent.
- `src/controller/state.ts`: `writeJsonAtomic` 338–343, `isProcessAlive` 657–660, `writeRunLocked`
  pauseRequested carry/clear 424–437, `writeRun` chain 447–455, `pauseRequested` field at 91,
  `writeChains` at 417. Accurate.
- `src/controller/controller.ts`: start insertion 109–111, schedule guard 395, settlePass 434–449,
  usage-window branch 405–409, isStartable refusal 456, onWaitChange status guard 546 and held
  patch 557–560, recover 337–357 and resumeIfAnswered path 352–353/387–390, pause early-return 242,
  resumeNow held branch 277–284, enqueue admission 191–209, launchBlock 315–327, isPauseRequested
  dep 622 (reads `pauseRequested` → a deploy hold does trip stopReason). Accurate.
- `src/controller/runs.ts`: stopReason 417–422, pause 573–581, loop-top stop 860–876, ControllerRunRow
  1428–1449, toRow 1451–1462, listRunsForWire 1465–1468. Accurate.
- `src/dashboard/multi-server.ts`: launchSpec catch→409 122–127, resume route 833–839, overview
  snapshot 360–368, controller.start before listen 404–417, global-hooks comment 690,
  MultiDashboardOptions 70–76. Accurate.
- Frontend: `pause.ts` isOperatorHeld 27–29 / pauseNote 32–44, `held = isOperatorHeld(run)` at
  RunsPage 278, panel Resume/Resume-now/Pause 332–354, confirmDiscard inline-confirm 358–366, row
  pauseNote 249, NowPage OpenAdvisorButton 286 and row pauseNote 352–355. Accurate.
- Tests/config: `vitest.config.ts:8-9` (frontend tree excluded), `tsconfig.json:19-20` (included
  `src/**`, excluded frontend — imported-but-excluded modules are still type-checked, so the
  DOM-free guard holds), `shell-feed.ts:44-45` (throttle 1 s / tick 30 s), `shell-feed.test.ts:359-361`
  (the 6-type list that changes to 7), `service-scripts.test.ts:510` (the stub summary literally
  contains `/x` — confirms the eval summary can hold a path). Accurate.

`execDeploy`'s proposed `{ outcome: 'refused', error: 'deploy-open' }` fits `ExecResult` (`execMerge`
already returns `outcome: 'refused'`). No library-capability assertion is unproven: the systemd
probes (C5, R1 AC4/AC5) state verified behaviour with dates, and D26 routes the live scenarios to a
tracked evidence file. No misstated artifact → no MUST_FIX from citations.

The design is strong and internally consistent on its hard problems — the claim/cancel race (D15),
the persist-before-spawn window (D3), onStart-before-recover (D21), the chain-write hold (D22),
quiet including active drives (D17), release-by-scan not by record list (D24). Two real gaps remain.

## Attack 1 — "Release" write path is under-specified where the requirements are explicit

C1 "`press` post-conditions" step 6 ends with **"Emit `runEvents` `change`."** C1 "Release" (R3 AC6)
and the onStart/tick table rows that call it specify no such emit. The hub pushes only the strip on
`deployEvents` (C7: the handler calls `pushDeploy(deploy)`, one message); run rows refresh only on
`runEvents` → `onSourceChange` → the throttled feed, or the 30 s fallback tick (`shell-feed.ts:45`).
`updateRun` (C2) is a `state.ts` primitive and the separate "Emit `runEvents`" sentence on press
implies it does not emit on its own.

- Challenge the asymmetry: press emits, release does not, yet both change `holdBy`/`pauseRequested`
  on the same rows the Now/Runs pages render through `pauseNote`.
- Stress-test the released-but-not-resumed run. A run `paused` for `usage-window` at press is held
  (R1 AC2) and on release keeps its status (R3 AC6, D4). Its hold clears on disk but nothing drives
  it, so no `save`→`runEvents` fires. Its row keeps "held for deploy" until the 30 s tick — while the
  strip already reads `done`. Failure scenario: deploy finishes `done`, strip shows done, a
  usage-window run row shows "held for deploy" for up to 30 seconds.
- Challenge the claim that resuming runs cover this. Running→drive and waiting→onWaitChange do emit,
  but the usage-window-paused and any queued-but-unstarted case do not.
- Direct the fix: Release must emit `runEvents` for every run it touched (or `updateRun` must emit),
  the same way press does.

**R1-1 (SHOULD_FIX).** Release does not emit `runEvents`; released runs that are not immediately
driven show a stale "held for deploy" row after the deploy ends.

## Attack 2 — `commit` preservation on the controller's `done` write is unstated

R6 AC7: at `done` the strip shows `done` and `commit`. `commit` is written by the script (R2 AC2,
after the first `check_move`). The reconnecting page reads the record after `controller.start()`
(C7 Timing), i.e. after onStart's `done` write (R3 AC1 "write `done` if not already"). C1 states
field preservation **only** for the failed path ("Failed-record writes keep the other fields") — the
done write and the release writes say nothing.

- Challenge the asymmetry: the design is explicit that failed keeps other fields but silent for the
  done write, which is exactly the record the strip renders at the end state R6 AC7 pins.
- Stress-test a literal implementer: `writeRecord({ v:1, stage:'done', runs, started })` satisfies
  "write done" and drops `commit`; the done strip then shows no commit, failing R6 AC7.
- Failure scenario: scenario-1 reconnect — page's first flush after restart carries the controller's
  `done` record; if that write did not carry `commit` forward, R6 AC7 is not met.
- Direct the fix: state that the controller's `done` write (and release writes) preserve the record's
  other fields, `commit` included, the way the failed write and the script's merge do.

**R1-2 (SHOULD_FIX).** The controller's `done` write is not pinned to preserve `commit`, which R6 AC7
requires on the done strip.

## Attack 3 — Minor consistency notes (do not keep the loop alive)

- Launch during a deploy surfaces through `launchSpec`'s existing `catch` as 409 `{ error: 'run-live' }`
  (`multi-server.ts:122-127`), not `deploy-open`; the deploy reason rides in `reason`. Fine for R4 AC9
  (409 + refusal), and the disabled `launchBlock` reason is the primary path, but the error
  *discriminant* differs from the resume route's `deploy-open`. MINOR.
- `execDeploy`'s proposed return omits `state: 'refused'`, which `execMerge` sets to land the action as
  `refused` rather than `failed`. R4 AC10 ("fail with deploy-open, spawn nothing") is met either way;
  the landing state is cosmetic. MINOR.

## Closing deliverables

**Top risks/gaps (short doc → 3)**
1. R1-1: stale "held for deploy" rows after release (no `runEvents` emit).
2. R1-2: `commit` may be dropped from the controller's `done` write → R6 AC7 miss.
3. Live-only proof (D26): the six entry scenarios, the 2 s stage delivery and the 10 s reconnect are
   verified only by a hand deploy against real systemd. The suite cannot exercise them. Carry the
   tracked `verification-evidence.md` as the gate it is; nothing here is a design defect, but it is
   the largest unverified surface.

**Top 3 conclusions to challenge or reverse**
1. "Press emits `runEvents`; release's emit is implied." Reverse: make release's emit explicit, or the
   page lags for non-resuming runs (R1-1).
2. "Failed-record writes keep the other fields" as the only preservation statement. Extend it to the
   done and release writes, or `commit` is at risk (R1-2).
3. "`launchSpec` already maps the throw to 409" settles R4 AC9. It does — but as `run-live`, not a
   deploy discriminant. Decide whether the inconsistency with the resume route's `deploy-open` matters
   before tasks pin route assertions.

**What's missing before acting**
- One sentence making release emit `runEvents` (parity with press step 6).
- One sentence pinning field preservation (incl. `commit`) on the controller's `done`/release writes.
- No new seam, data-model, or decision is needed; both are wording pins against existing ACs.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
