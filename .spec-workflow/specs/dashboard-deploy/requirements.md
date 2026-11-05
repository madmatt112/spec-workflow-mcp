# Requirements Document

## Introduction

This spec adds one Deploy action to the dashboard: it holds the runs, runs the staged self-update outside the service, and brings the runs back after the restart. It serves the single operator, who today deploys by hand from a shell, and changes `scripts/sdd-self-update.sh`, the controller's hold model, one new route pair, and the Now and Runs pages.

## Alignment with Product Vision

`.spec-workflow/steering/` holds no `product.md`, so this aligns to the decomposition's dashboard board plan, which puts this spec second so the three dashboard specs after it ship through the Deploy action: a deploy that needs no shell and loses no run.

## Requirements

Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A **live step** is a run with an `inFlight` process that passes the test in `scripts/sdd-self-update.sh:89-97`. **Release** is the operation in Requirement 3 AC 6.

### Requirement 1

**User Story:** As the operator, I want one press to hold the runs and start the update, so that I do not stop runs by hand or deploy under a live step.

#### Acceptance Criteria

1. WHEN the operator POSTs `/api/controller/deploy` AND no record is open THEN the controller SHALL write `deploy.json` in the controller home (`src/controller/state.ts:275-279`; `~/.local/state/sdd/deploy.json` by default) with `v: 1`, `stage: 'wait'`, `runs`, `started` (the press time) and no `error`, hold the runs, and answer 202.
2. WHEN a press holds runs THEN the controller SHALL hold every run with status `running`, `queued`, `waiting`, `merging` or `paused` that has no operator hold, set `pauseRequested` and `holdBy: 'deploy'` on each, and list exactly those ids in `runs` (D1).
3. IF a run already has an operator hold (`pauseRequested` set, `holdBy` `operator` or absent) THEN the press SHALL leave the run unchanged and SHALL NOT list it in `runs`.
4. WHEN no live step remains THEN, under its lock, the controller SHALL re-read the record, start nothing unless it is still open at `wait` (so a cancel per R5 AC2 cannot be overtaken by this tick), persist `unitStarted: true` to `deploy.json` (`src/controller/state.ts:338-343`), and only then start `scripts/sdd-self-update.sh --deploy-record <path>` as a transient user unit with `systemd-run --user`, so a crash between the persist and the spawn leaves no live unit with `unitStarted` absent. The unit is required because the service's `KillMode` is `control-group` (probe 2026-11-05: `systemctl --user show sdd-controller.service -p KillMode`), and the script resolves from the same checkout root as `src/advisor/actions.ts:363-364`.
5. WHEN the unit starts THEN it SHALL have the controller's `PATH`, `HOME` and `SDD_HOME` and the contents of `service.env` (`scripts/sdd-service.sh:82`), and SHALL NOT carry `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` (`scripts/sdd-service.sh:84`). A bare transient unit inherits none of these (probe 2026-11-05: `systemd-run --user --wait --pipe` printed a `PATH` with no node or npm and a caller variable unset, in a cgroup outside `sdd-controller.service`).
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
3. WHEN the script ends on a refusal, a timeout, a failed command under `set -e`, or any SIGTERM THEN it SHALL write `stage: 'failed'` and an `error` that starts with the stage name it was at. The script cannot tell a cancel's SIGTERM from any other, so it always writes `failed`; R5 AC1's removal of the record after the unit is gone is what leaves a cancelled deploy no `failed` record. It SHALL use the stage names `smoke` and `gate`, not the wait texts `smoke boot` and `evals` (`scripts/sdd-self-update.sh:219`, `:257`).
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
3. WHEN the controller finds an open record, on start or on its tick, AND `unitStarted` is true AND the unit is not live THEN it SHALL write `failed`, with `error` naming the stage and the unit the controller committed to starting but that is not live, and release the holds. AC 1 takes precedence at `restart` on start.
4. IF the controller starts AND the record is at `wait` AND `unitStarted` is false or absent AND no unit is live THEN it SHALL re-apply the holds and continue from Requirement 1 AC 4; AC 5 takes precedence when a unit is live (D3).
5. WHEN the controller starts AND the record is open AND the unit is live THEN it SHALL leave the record and the unit alone, keep the holds, and read the record on its tick until the deploy ends.
6. WHEN the controller releases THEN, for each run with `holdBy: 'deploy'` and only those, it SHALL clear `holdBy` and `pauseRequested`; a run `paused` with `pauseReason: 'operator'` SHALL go to `queued` as in `src/controller/controller.ts:278-281`; a `waiting` run whose latest wait is answered SHALL resume via `src/controller/controller.ts:387-390`; every other run SHALL keep its status. Release SHALL be safe to repeat.
7. WHEN a deploy ends in `done` THEN a run that was `running` at the press SHALL run again from its cursor, and a run `waiting` on an unanswered wait SHALL still be `waiting`.
8. IF the process was started with `--smoke` THEN it SHALL NOT act on any deploy record. The smoke boot works on a copy of the home (`scripts/sdd-self-update.sh:213-214`).

### Requirement 4

**User Story:** As the operator, I want a deploy hold to be distinct from my own hold, so that a deploy never releases what I paused and nothing starts during a deploy.

#### Acceptance Criteria

1. WHEN `RunRecord` is written THEN it SHALL accept `holdBy?: 'operator' | 'deploy'` beside `pauseRequested` (`src/controller/state.ts:91`). An operator pause SHALL write `operator`. A `pauseRequested` with no `holdBy` SHALL read as `operator`.
2. WHEN any writer saves a run without owning the hold THEN `holdBy` SHALL carry over from disk, by the rule `pauseRequested` follows in `src/controller/state.ts:429-433`, and a terminal status SHALL clear it (`:434-437`).
3. WHEN `settlePass` meets a run with `holdBy: 'deploy'` THEN it SHALL skip the run and write nothing (`src/controller/controller.ts:434-449`, D4).
4. IF a run has `holdBy: 'deploy'` THEN `isStartable` SHALL return false (`src/controller/controller.ts:456`), because the hold set `pauseRequested` (R1 AC2) (invariant, verified, not red-first).
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

1. WHEN the operator POSTs `/api/controller/deploy/cancel` AND the record is at `wait`, `build`, `smoke` or `gate` THEN the controller SHALL stop the unit if `unitStarted`, wait until the unit is gone, then under the same lock as R1 AC4 release the holds and remove the record, and answer 200.
2. WHEN the controller removes the record THEN no later script write SHALL recreate it, so removal SHALL come after the unit is gone, and a cancelled script SHALL leave no `failed` record. Because the removal runs under R1 AC4's lock, it is serialised against that AC's re-read → persist → spawn: the re-read is decisive, so the removal falls either before it or after a completed spawn the cancel then stops, and the controller SHALL start no unit once the record is removed.
3. IF the record is at `swap`, `restart`, `done` or `failed` THEN the route SHALL answer 409 `deploy-past-swap` and change nothing. IF no record exists THEN the route SHALL answer 404.
4. WHEN a cancel completes THEN the live checkout and `dist/` SHALL be unchanged. The staging worktree may stay; the next run resets it (`scripts/sdd-self-update.sh:191-194`).

### Requirement 6

**User Story:** As the operator, I want a small control on the Now page, so that I can press, watch and cancel a deploy without a shell.

#### Acceptance Criteria

1. WHEN the operator presses Deploy on the Now page THEN a confirm SHALL state how many runs will be held and that the restart ends the advisor opened from the dashboard, and the POST SHALL be sent only after the confirm.
2. WHEN a record exists THEN a stage strip SHALL show `wait`, `build`, `smoke`, `gate`, `swap`, `restart` and `done` with the current stage marked, read only from the record through a new shell-feed message (`src/dashboard/shell/shell-feed.ts:146-153`, `src/dashboard/shell/types.ts:230-236`). The client SHALL subscribe to it with a handler and state slot (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:76-121`) and hand-copy its payload type beside `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:215-237`), mirroring R4 AC12. The page SHALL derive nothing from the script's log.
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

- D1 — Which runs a deploy holds: every live run with no operator hold, because a merging or usage-paused run can otherwise start a step during the build that the restart would kill.
- D2 — What a press does when there is nothing new: the script refuses under the new flag, because the decomposition expects a no-op refusal but the code has none; no check runs before the press.
- D3 — Who waits for a live step: the controller waits, then starts the unit, because the decomposition keeps the script's refusal. The cost is one exception to the lost-unit rule: a record at `wait` with `unitStarted` false or absent continues after a restart and does not fail. `unitStarted` true means the controller committed to starting the unit, so R3 AC3 fails the record when no unit is live, even when the crash fell in the persist-to-spawn window.
- D4 — What a deploy hold does to status: leave status alone and skip the settle pass, because a queued, waiting or merging run keeps its status underneath (a running run with a live drive parks `paused`, R4 AC5) and a usage pause keeps its reason and resume time.
- D5 — Where the swap stage begins: before the live checkout moves, because a cancel between the two would leave the checkout ahead of the running build.
- D6 — How the page sees the restart stage: a three-second gap in the script, because otherwise the service dies before the feed delivers the stage.
- D7 — How long a finished strip stays: until the next press, because it adds no control and no timer.
- D8 — How the controller learns of a stage: its one-second tick, because the feed adds no watcher and a running controller must also finish a failed record.
- D9 — Operator actions during a deploy: Pause moves the hold to the operator and Resume is refused, because a Pause no-op would release a run the operator meant to keep and a Resume would start a step during the build.
- D10 — Launch during a deploy: refuse with a reason, because the launch guard already works this way and nothing extra needs release.
- D11 — The advisor's staged deploy: refuse it while a record is open, because two scripts must not share the staging worktree and rerouting is outside this entry.
- D12 — Reconnect after a deploy: a two-second retry during swap and restart, because the base backoff can miss the ten-second target.

## Scope notes

Added beyond the entry:
- `merging` runs and non-operator `paused` runs are held (D1).
- A no-op refusal under the flag (D2), which the entry expects but the code lacks.
- Launch, Resume and the advisor's staged deploy are refused while a record is open (D9, D10, D11).
- A field (`unitStarted`) says the controller committed to starting the unit, distinct from `started` (D3); the entry's list has no such field.

Narrowed from the entry:
- "At any stage with no live transient unit" excludes a record at `wait` with `unitStarted` false or absent (D3). Scenario 5 therefore has two cases: a live unit (it continues) and no unit with the flag unset (the restarted controller starts it); both finish the record.

Cut or deferred:
- The advisor's staged deploy keeps its detached spawn in the service cgroup; rerouting it is deferred (D11).
- The Deploy action never passes `--no-restart` or `--eval-override`. An eval override stays a shell operation.
- Hand runs and the post-merge command are not guarded against an open record.

Left to the design: the unit's name and how a second press finds it, the `wait_no_step` timeout against a long step (Requirement 1 AC 7 needs the limit), and whether the controller start lists open verification deferrals on the strip.

The entry's six end-to-end scenarios carry into the design unchanged, except scenario 5's note above. Scenario 3 needs no new seam: the staged-CLI stub already fails the gate (`src/__tests__/service-scripts.test.ts:460`). Nothing was carried from an earlier phase.

## Revision History

- **v4** (2026-11-05) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md, verdict iterate 1/1/1).
  - **R3-1 — Accepted (MUST_FIX).** Cancel's release-and-remove (R5 AC1) now runs under R1 AC4's lock, serialising it against the re-read, persist and spawn; R5 AC2 drops the unsound "re-read under its lock" claim, so the controller's own persist cannot recreate a removed record.
  - **R3-2 — Accepted (SHOULD_FIX).** R2 AC3 drops "from outside a cancel": the script writes failed on any SIGTERM, and cancel's removal of the record after the unit is gone is what leaves a cancelled deploy no failed record.
  - **R3-3 — Accepted (MINOR).** R3 AC3, D3 and the scope note read the flag as "committed to starting the unit", and D3 scopes does-not-fail to the flag false or absent.
  - **Lint pass.** 0 fixed; prior rounds' citation-identifier false positives still suppressed per rule 11.
- **v3** (2026-11-05) — Round-2 response (adversarial-analysis-requirements-r2.md, iterate 1/1/0).
  - **R2-1 — Accepted (MUST_FIX).** Persist the unit-started flag before the spawn; R3 AC4 gains no-unit-live and defers to AC5, closing the double-spawn.
  - **R2-2 — Accepted (SHOULD_FIX).** Controller re-reads under its lock and spawns only while open at wait; R5 AC2 names the reciprocal.
- **v2** (2026-11-05) — Round-1 response (adversarial-analysis-requirements.md, iterate 0/3/2).
  - **R1-1 — Accepted (SHOULD_FIX).** Deploy hold sets the pause flag and release clears it, so a released run is startable; R4 AC4 names the reason.
  - **R1-2 — Accepted (SHOULD_FIX).** Unit-started signal split into its own field, distinct from the press-time started.
  - **R1-3 — Accepted (SHOULD_FIX).** R6 AC2 pins the client half of the deploy message, mirroring the hold-by wire.
  - **R1-4 — Accepted (MINOR).** R5 AC1 answers 200 on a successful cancel.
  - **R1-5 — Accepted (MINOR).** D4 scopes "keeps its status underneath" and notes a live-drive run parks paused.
- **v1** (2026-11-05) — Initial draft.
- **Lint.** Every round: 0 fixed; L-1 onward rejected as citation-identifier false positives, each cited range re-read and anchoring.
