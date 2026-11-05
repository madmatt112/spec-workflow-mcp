# Requirements Document

## Introduction

This spec adds one Deploy action to the dashboard: it holds the runs, runs the staged self-update outside the service, and brings the runs back after the restart. It is for the single operator, who today deploys by hand from a shell. It changes `scripts/sdd-self-update.sh`, the controller's hold model, one new route pair, and the Now and Runs pages.

## Alignment with Product Vision

`.spec-workflow/steering/` holds no `product.md`, so this section aligns to the dashboard board plan in the decomposition instead. That plan puts this spec second so that the three dashboard specs after it ship through the Deploy action. The operator gets a deploy that needs no shell and that loses no run.

## Requirements

Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A **live step** is a run with an `inFlight` process that passes the test in `scripts/sdd-self-update.sh:89-97`. **Release** is the operation in Requirement 3 AC 6.

### Requirement 1

**User Story:** As the operator, I want one press to hold the runs and start the update, so that I do not stop runs by hand or deploy under a live step.

#### Acceptance Criteria

1. WHEN the operator POSTs `/api/controller/deploy` AND no record is open THEN the controller SHALL write `deploy.json` in the controller home (`src/controller/state.ts:275-279`; `~/.local/state/sdd/deploy.json` by default) with `v: 1`, `stage: 'wait'`, `runs`, `started` and no `error`, hold the runs, and answer 202.
2. WHEN a press holds runs THEN the controller SHALL hold every run with status `running`, `queued`, `waiting`, `merging` or `paused` that has no operator hold, set `holdBy: 'deploy'` on each, and list exactly those ids in `runs` (D1).
3. IF a run already has an operator hold (`pauseRequested` set, `holdBy` `operator` or absent) THEN the press SHALL leave the run unchanged and SHALL NOT list it in `runs`.
4. WHEN no live step remains THEN the controller SHALL start `scripts/sdd-self-update.sh --deploy-record <path>` as a transient user unit with `systemd-run --user`, and SHALL record in `deploy.json` that the unit was started. The unit is required because the service's `KillMode` is `control-group` (probe 2026-11-05: `systemctl --user show sdd-controller.service -p KillMode`), and the script resolves from the same checkout root as `src/advisor/actions.ts:363-364`.
5. WHEN the unit starts THEN it SHALL have the controller's `PATH`, `HOME` and `SDD_HOME` and the contents of `service.env` (`scripts/sdd-service.sh:82`), and SHALL NOT carry `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` (`scripts/sdd-service.sh:84`). A bare transient unit inherits none of these (probe 2026-11-05: `systemd-run --user --wait --pipe` printed a `PATH` with no node, no npm, and a caller variable unset, in a cgroup outside `sdd-controller.service`).
6. IF the unit cannot be started THEN the controller SHALL write `failed` with the reason in `error` and release the holds.
7. IF a live step outlasts the time limit the design pins THEN the controller SHALL write `failed` with `error` naming `wait`, and release the holds.
8. IF a record is open WHEN the operator POSTs `/api/controller/deploy` THEN the route SHALL answer 409 `deploy-open` with the current stage and start nothing.
9. WHEN two presses arrive together THEN exactly one record and one unit SHALL result, and the other press SHALL answer 409 `deploy-open`.
10. WHEN the press finds a `done` or `failed` record THEN the new record SHALL replace it.

### Requirement 2

**User Story:** As the operator, I want the script to report its own stage, so that the page shows what is true and never guesses from a log.

#### Acceptance Criteria

1. WHEN the script runs with `--deploy-record <path>` THEN it SHALL write `stage` at each step: `wait` before the in-flight check (`scripts/sdd-self-update.sh:81`), `build` before the staging build (`:191`), `smoke` before the smoke boot (`:213`), `gate` before the eval gate (`:239`), `swap` before the live checkout moves (`:276`, D5), `restart` after the last `wait_no_step` (`:305`) and before the restart (`:307`), and `done` after the restart.
2. WHEN the first `check_move` has set `TARGET_COMMIT` (`scripts/sdd-self-update.sh:135`) THEN the script SHALL write it to `commit`.
3. WHEN the script ends on a refusal, a timeout, a failed command under `set -e`, or SIGTERM from outside a cancel THEN it SHALL write `stage: 'failed'` and an `error` that starts with the stage name it was at. It SHALL use the stage names `smoke` and `gate`, not the wait texts `smoke boot` and `evals` (`scripts/sdd-self-update.sh:219`, `:257`).
4. IF `--deploy-record` is set AND the fetched checkout is not behind `origin/main` THEN the script SHALL refuse with `failed` and an `error` that says there is nothing to deploy (D2). `check_move` does not refuse this case today (`scripts/sdd-self-update.sh:136-138`).
5. WHEN the script writes the record THEN the write SHALL be atomic (a temp file in the same directory, then rename), SHALL keep every field it does not set, and SHALL NOT depend on any module under `dist/`, because the swap replaces `dist/`.
6. WHEN the script writes `restart` THEN it SHALL wait 3 seconds before `systemctl --user restart`, so that the page receives the stage before the socket closes (D6).
7. IF `--dry-run` is set with `--deploy-record` THEN the script SHALL NOT write the record.
8. IF `--deploy-record` is absent THEN the script SHALL behave as it does today, and SHALL write no record (invariant, verified, not red-first).
9. WHEN the script refuses or fails with the flag set THEN its existing checks and its `error` wait SHALL stay as they are: active-run pointer, in-flight step, divergence, dirty paths, smoke, evals, `wait_no_step` (`scripts/sdd-self-update.sh:59-75`, `:82-85`, `:100-107`, `:132-173`) (invariant, verified, not red-first).

### Requirement 3

**User Story:** As the operator, I want the restarted controller to finish the deploy, so that no run stays held when the process that held it is gone.

#### Acceptance Criteria

1. WHEN the controller starts AND the record is at `restart` or `done` THEN it SHALL release the holds and write `done`.
2. WHEN the controller finds the record at `failed`, on start or on its tick, AND runs still have `holdBy: 'deploy'` THEN it SHALL release the holds and leave the record at `failed`.
3. WHEN the controller finds an open record, on start or on its tick, AND the record says the unit was started AND the unit is not live THEN it SHALL write `failed`, with `error` naming the stage and the lost unit, and release the holds. AC 1 takes precedence at `restart` on start.
4. IF the controller starts AND the record is at `wait` AND the unit was not started THEN it SHALL re-apply the holds and continue from Requirement 1 AC 4 (D3).
5. WHEN the controller starts AND the record is open AND the unit is live THEN it SHALL leave the record and the unit alone, keep the holds, and read the record on its tick until the deploy ends.
6. WHEN the controller releases THEN, for each run with `holdBy: 'deploy'` and only those, it SHALL clear the hold; a run `paused` with `pauseReason: 'operator'` SHALL go to `queued` as in `src/controller/controller.ts:278-281`; a `waiting` run whose latest wait is answered SHALL resume through the path in `src/controller/controller.ts:387-390`; every other run SHALL keep its status. Release SHALL be safe to repeat.
7. WHEN a deploy ends in `done` THEN a run that was `running` at the press SHALL run again from its cursor, and a run `waiting` on an unanswered wait SHALL still be `waiting`.
8. IF the process was started with `--smoke` THEN it SHALL NOT act on any deploy record. The smoke boot works on a copy of the home (`scripts/sdd-self-update.sh:213-214`).

### Requirement 4

**User Story:** As the operator, I want a deploy hold to be distinct from my own hold, so that a deploy never releases what I paused and nothing starts during a deploy.

#### Acceptance Criteria

1. WHEN `RunRecord` is written THEN it SHALL accept `holdBy?: 'operator' | 'deploy'` beside `pauseRequested` (`src/controller/state.ts:91`). An operator pause SHALL write `operator`. A `pauseRequested` with no `holdBy` SHALL read as `operator`.
2. WHEN any writer saves a run without owning the hold THEN `holdBy` SHALL carry over from disk, by the rule `pauseRequested` follows in `src/controller/state.ts:429-433`, and a terminal status SHALL clear it (`:434-437`).
3. WHEN `settlePass` meets a run with `holdBy: 'deploy'` THEN it SHALL skip the run and write nothing (`src/controller/controller.ts:434-449`, D4).
4. IF a run has `holdBy: 'deploy'` THEN `isStartable` SHALL return false (`src/controller/controller.ts:456`) (invariant, verified, not red-first).
5. WHEN a deploy-held run has a live drive THEN the drive SHALL stop at its next stop point and park `paused` (`src/controller/runs.ts:417-422`, `:573-581`), and `holdBy` SHALL stay `deploy`.
6. WHEN a wait is answered on a run with `holdBy: 'deploy'` THEN the run SHALL stay `waiting`, no step SHALL start, and the answer SHALL stay on disk (`src/controller/controller.ts:557-560`). This SHALL also hold on the recovery path (`:352-353`).
7. WHEN the operator pauses a run with `holdBy: 'deploy'` THEN `holdBy` SHALL become `operator` and release SHALL leave the run held. Today the call returns early (`src/controller/controller.ts:242`).
8. WHEN the operator resumes a run with `holdBy: 'deploy'`, or any run while a record is open, THEN the route SHALL answer 409 `deploy-open` and the run SHALL not change (`src/dashboard/multi-server.ts:833-839`).
9. WHILE a record is open THEN a launch SHALL be refused: `launchBlock` SHALL return the reason and `enqueue` SHALL throw (`src/controller/controller.ts:180-214`, `:315-327`).
10. WHILE a record is open THEN confirming an advisor-staged `deploy` action SHALL fail with `deploy-open` and spawn nothing (`src/advisor/actions.ts:362-384`).
11. WHEN the operator cancels or discards a held run THEN it SHALL work as today, and release SHALL skip that run.
12. WHEN a run is sent to the page THEN the wire row SHALL carry `holdBy` (`src/controller/runs.ts:1428-1462`, `src/dashboard/shell/types.ts:194-214`, `src/dashboard_frontend/src/modules/shell/types.ts:215-237`).

### Requirement 5

**User Story:** As the operator, I want to cancel a deploy before it touches the live checkout, so that a press I regret costs nothing.

#### Acceptance Criteria

1. WHEN the operator POSTs `/api/controller/deploy/cancel` AND the record is at `wait`, `build`, `smoke` or `gate` THEN the controller SHALL stop the unit if it was started, wait until the unit is gone, release the holds and remove the record.
2. WHEN the controller removes the record THEN no later script write SHALL recreate it, so removal SHALL come after the unit is gone, and a cancelled script SHALL leave no `failed` record.
3. IF the record is at `swap`, `restart`, `done` or `failed` THEN the route SHALL answer 409 `deploy-past-swap` and change nothing. IF no record exists THEN the route SHALL answer 404.
4. WHEN a cancel completes THEN the live checkout and `dist/` SHALL be unchanged. The staging worktree may stay; the next run resets it (`scripts/sdd-self-update.sh:191-194`).

### Requirement 6

**User Story:** As the operator, I want a small control on the Now page, so that I can press, watch and cancel a deploy without a shell.

#### Acceptance Criteria

1. WHEN the operator presses Deploy on the Now page THEN a confirm SHALL state how many runs will be held and that the restart ends the advisor opened from the dashboard, and the POST SHALL be sent only after the confirm.
2. WHEN a record exists THEN a stage strip SHALL show `wait`, `build`, `smoke`, `gate`, `swap`, `restart` and `done` with the current stage marked, read only from the record through a new shell-feed message (`src/dashboard/shell/shell-feed.ts:146-153`, `src/dashboard/shell/types.ts:230-236`). The page SHALL derive nothing from the script's log.
3. WHILE a record is open THEN Deploy SHALL be disabled and SHALL show the reason with the stage.
4. WHEN a run has `holdBy: 'deploy'` THEN its rows on the Now and Runs pages SHALL read "held for deploy" (`src/dashboard_frontend/src/modules/shell/pause.ts:32-44`), `isOperatorHeld` SHALL be false (`:27-29`), and the panel SHALL show neither Resume nor Resume now (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:332-351`). Pause SHALL stay available.
5. WHILE the record is at `wait`, `build`, `smoke` or `gate` THEN the strip SHALL offer "Cancel and resume now", and from `swap` on it SHALL not.
6. WHEN the record is at `restart` THEN the strip SHALL say that the restart ends the advisor session opened from the dashboard (`src/dashboard/multi-server.ts:741-752`).
7. WHEN the record is at `failed` THEN the strip SHALL show the stage and `error`; WHEN it is at `done` THEN the strip SHALL show `done` and `commit`. Either SHALL stay on the page until the next press (D7).
8. WHILE the socket is closed AND the last record received was at `swap` or `restart` THEN the page SHALL retry at least every 2 seconds and SHALL keep the strip on screen, so that it reconnects within 10 seconds of the service accepting connections. The base backoff alone reaches 7.6 seconds and more between attempts (`src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:31-32`, `:98-103`).
9. WHEN the page reconnects THEN it SHALL receive the current record with the first feed flush.
10. WHEN the control is built THEN it SHALL be one component that takes nothing from the Now page, so that spec 32 can move it to the top bar.

## Non-Functional Requirements

### Performance
- A stage written by the script SHALL reach a connected page within 2 seconds. The feed has no file watcher and its fallback tick is 30 seconds (`src/dashboard/shell/shell-feed.ts:44-45`), so the controller SHALL read the record on its own tick (`src/controller/controller.ts:113`) and arm the feed when it changes (`src/dashboard/harness/hub.ts:164-166`) (D8).

### Security
- The two new routes SHALL sit under the same global hooks as the other controller routes and SHALL add no access exemption (`src/dashboard/multi-server.ts:690`).
- The record and its wire form SHALL hold no absolute path, because the wire stays path-free (`src/controller/runs.ts:1425`).
- The unit's token environment SHALL NOT appear in the record, the command line or a log.

### Reliability
- A controller that dies between writing the record and finishing the holds SHALL complete them on start, because Requirement 3 AC 4 re-applies them.
- A cancel that races the script's write of `swap` SHALL NOT interrupt the checkout move or the `dist/` swap. The design pins the mechanism.
- A failure at `swap` or `restart` SHALL say in `error` that the live checkout or `dist/` may already have changed.

## Decisions taken in this document

- D1 — Which runs a deploy holds: options were every live run with no operator hold, the three statuses the decomposition names, or those three plus a scheduler-wide stop; chosen every live run because a merging run or a usage-paused run can otherwise start a step during the build, and the restart would kill it.
- D2 — What a press does when there is nothing new: options were a refusal in the script under the new flag, the full pipeline and a restart, or a check before the press; chosen the script refusal because the decomposition expects the script to refuse a no-op but the code does not, and it rules out a check before the press.
- D3 — Who waits for a live step: options were the controller waits and then starts the unit, or the unit starts at once and the script waits in place of its refusal; chosen the controller because the decomposition keeps the script's refusal. The cost is one exception to the lost-unit rule: a record at wait whose unit was never started continues after a restart and does not fail.
- D4 — What a deploy hold does to status: options were leave status alone and skip the settle pass, or park as an operator pause and keep the owner; chosen leave it alone because the decomposition says a run keeps its status underneath, and a usage pause keeps its reason and resume time.
- D5 — Where the swap stage begins: options were before the live checkout moves, or at the dist copy; chosen before the move because a cancel between the two would leave the checkout ahead of the running build.
- D6 — How the page sees the restart stage: options were a three-second gap in the script, or the notice only in the confirm; chosen the gap because otherwise the service dies before the feed delivers the stage, and the decomposition wants the strip to say it.
- D7 — How long a finished strip stays: options were until the next press, an automatic hide, or a dismiss button; chosen until the next press because it adds no control and no timer.
- D8 — How the controller learns of a stage: options were its one-second tick, a file watcher, or reads on start only; chosen the tick because the feed adds no watcher and a running controller must also finish a failed record.
- D9 — Operator actions during a deploy: options were Pause moves the hold to the operator and Resume is refused, Resume converts to a deploy hold, or both act as today; chosen the first because a silent no-op on Pause would release a run the operator meant to keep, and a Resume would start a step during the build.
- D10 — Launch during a deploy: options were refuse with a reason, or queue the run held; chosen refuse because the launch guard already works this way and nothing extra needs release.
- D11 — The advisor's staged deploy: options were refuse it while a record is open, route it through the Deploy action, or leave it; chosen refuse because two scripts must not share the staging worktree, and rerouting is outside this entry.
- D12 — Reconnect after a deploy: options were a two-second retry during swap and restart, or the base backoff; chosen the retry because the base backoff can miss the ten-second target.

## Scope notes

Added beyond the entry:
- `merging` runs and non-operator `paused` runs are held (D1).
- A no-op refusal under the flag (D2). The entry's statement that the divergence check refuses a no-op does not match the code. The entry's "no check before pressing" stands.
- Launch, Resume and the advisor's staged deploy are refused while a record is open (D9, D10, D11).
- A field in the record says the unit was started (D3). The entry's list has no such field.

Narrowed from the entry:
- "At any stage with no live transient unit" excludes a record at `wait` whose unit was never started (D3). End-to-end scenario 5 therefore has two cases: unit started (it continues) and unit not started (the restarted controller starts it). Both end by finishing the record.

Cut or deferred:
- The advisor's staged deploy keeps its detached spawn in the service cgroup; rerouting it is deferred (D11).
- The Deploy action never passes `--no-restart` or `--eval-override`. An eval override stays a shell operation.
- Hand runs and the post-merge command are not guarded against an open record.

Left to the design, as the entry says: the unit's name and how a second press finds it, the `wait_no_step` timeout against a long step (Requirement 1 AC 7 needs the limit), and whether the controller start lists open verification deferrals on the strip.

The entry's six end-to-end scenarios carry into the design unchanged, apart from the scenario 5 note above. Scenario 3 needs no new seam: the staged-CLI stub already fails the gate (`src/__tests__/service-scripts.test.ts:460`). Nothing was carried from an earlier phase.

## Revision History

- **v1** (2026-11-05) — Initial draft.
