# Codebase context — dashboard-deploy

## Self-update script (scripts/sdd-self-update.sh)
- scripts/sdd-self-update.sh:32-46 — argument parsing: --dry-run, --no-restart, --eval-override
- scripts/sdd-self-update.sh:59-75 — write_error_wait: the error wait through dist/controller/waits.js
- scripts/sdd-self-update.sh:81-85 — refusal on a line in the legacy active-run pointer
- scripts/sdd-self-update.sh:89-97 — step_live: any run with a live inFlight process
- scripts/sdd-self-update.sh:100-107 — wait_no_step: 30-minute loop, 5-second poll
- scripts/sdd-self-update.sh:109-117 — first in-flight refusal
- scripts/sdd-self-update.sh:132-173 — check_move: fetch, TARGET_COMMIT, divergence and dirty-path refusals; no refusal when not behind
- scripts/sdd-self-update.sh:191-205 — staging worktree and build (SDD_STAGE_BUILD seam)
- scripts/sdd-self-update.sh:213-224 — smoke boot on a copy of the home (SDD_STAGE_SMOKE seam)
- scripts/sdd-self-update.sh:239-261 — staged eval gate and its error wait
- scripts/sdd-self-update.sh:276-292 — second check_move, then the live checkout moves (rebase or ff)
- scripts/sdd-self-update.sh:297-301 — wait_no_step, npm ci in the live checkout, rsync of dist/
- scripts/sdd-self-update.sh:302-308 — wait_no_step and systemctl --user restart

## Service unit (scripts/sdd-service.sh)
- scripts/sdd-service.sh:62-89 — controller unit text: no KillMode line, Restart=always
- scripts/sdd-service.sh:82 — EnvironmentFile=-service.env
- scripts/sdd-service.sh:84 — UnsetEnvironment of the Anthropic key and token
- scripts/sdd-service.sh:211-217 — existing systemd-run --user use with EnvironmentFile

## Run state (src/controller/state.ts)
- src/controller/state.ts:56-64 — RunStatus
- src/controller/state.ts:67 — OPERATOR_PAUSE
- src/controller/state.ts:70-111 — RunRecord
- src/controller/state.ts:275-279 — controllerHome
- src/controller/state.ts:338-343 — writeJsonAtomic
- src/controller/state.ts:419-445 — writeRunLocked: pauseRequested carry-over, terminal clear
- src/controller/state.ts:447-455 — writeRun per-run chain
- src/controller/state.ts:636-660 — processStartTime, isProcessAlive

## Controller (src/controller/controller.ts)
- src/controller/controller.ts:103-117 — start: lock, recover, tick, schedule
- src/controller/controller.ts:180-214 — enqueue: admission and queued record
- src/controller/controller.ts:224-229 — cancel
- src/controller/controller.ts:238-257 — pause; early return when already held at :242
- src/controller/controller.ts:273-300 — resumeNow; held branch at :277-284
- src/controller/controller.ts:302-307 — discard
- src/controller/controller.ts:315-327 — launchBlock
- src/controller/controller.ts:337-357 — recover
- src/controller/controller.ts:387-390 — resumeIfWaitAnswered
- src/controller/controller.ts:394-426 — schedule
- src/controller/controller.ts:434-449 — settlePass
- src/controller/controller.ts:454-467 — isStartable; pauseRequested blocks at :456
- src/controller/controller.ts:534-562 — onWaitChange; held branch at :557-560
- src/controller/controller.ts:622 — isPauseRequested dep
- src/controller/controller.ts:695-702 — save
- src/controller/controller.ts:706-709 — isLive

## Run driver (src/controller/runs.ts)
- src/controller/runs.ts:417-422 — stopReason
- src/controller/runs.ts:428-434 — patchRun
- src/controller/runs.ts:560-565 — save
- src/controller/runs.ts:573-581 — pause: a held run parks with OPERATOR_PAUSE
- src/controller/runs.ts:584-593 — waitAnd
- src/controller/runs.ts:670-676 — held run caught at the merge stage
- src/controller/runs.ts:1428-1449 — ControllerRunRow
- src/controller/runs.ts:1451-1462 — toRow
- src/controller/runs.ts:1465-1468 — listRunsForWire

## Dashboard server (src/dashboard/multi-server.ts)
- src/dashboard/multi-server.ts:101-128 — launchSpec; enqueue throw maps to 409 run-live
- src/dashboard/multi-server.ts:404-411 — controller start before listen
- src/dashboard/multi-server.ts:655-668 — setup route applies launchBlock
- src/dashboard/multi-server.ts:690 — controller routes sit under the global hooks
- src/dashboard/multi-server.ts:741-752 — advisor open: tmux spawn
- src/dashboard/multi-server.ts:789-794 — staged action confirm route
- src/dashboard/multi-server.ts:824-830 — pause route
- src/dashboard/multi-server.ts:833-839 — resume route
- src/dashboard/multi-server.ts:842-848 — redrive route

## Shell feed
- src/dashboard/shell/shell-feed.ts:44-45 — throttle 1 s, tick 30 s
- src/dashboard/shell/shell-feed.ts:61-64 — schedule
- src/dashboard/shell/shell-feed.ts:89-156 — flush and the message list
- src/dashboard/shell/types.ts:194-214 — server ControllerRun
- src/dashboard/shell/types.ts:230-236 — ShellMessage
- src/dashboard/harness/hub.ts:49-52 — source events that arm the feed
- src/dashboard/harness/hub.ts:164-166 — onSourceChange

## Frontend
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:104-138 — OpenAdvisorButton, the pattern for a small control
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:284-286 — head of the page list
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:342-361 — controller run rows with pauseNote
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:213-240 — PauseButton
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:242-268 — ControllerRunRow
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:270-372 — ControllerRunPanel; Resume buttons at :332-351
- src/dashboard_frontend/src/modules/shell/pause.ts:27-29 — isOperatorHeld
- src/dashboard_frontend/src/modules/shell/pause.ts:32-44 — pauseNote
- src/dashboard_frontend/src/modules/shell/types.ts:215-237 — hand copy of ControllerRun
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:76-121 — shell topic subscriptions
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:31-32 — retry delay constants
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104 — onclose backoff

## Other deploy entry points
- src/advisor/actions.ts:362-384 — execDeploy: detached spawn of the script from the checkout root
- src/advisor/actions.ts:403-411 — EXECUTORS
- src/index.ts:460-467 — --smoke isolation and 30-second timeout

## Tests
- src/__tests__/service-scripts.test.ts:299 — script dry-run test
- src/__tests__/service-scripts.test.ts:353 — script rebase test with stage seams
- src/__tests__/service-scripts.test.ts:460 — failing eval through the staged-CLI stub

## Design additions: controller seams
- src/controller/controller.ts:49-69 — ControllerOptions
- src/controller/controller.ts:109-115 — start order: wait listener, recover, interval, first schedule
- src/controller/controller.ts:144-146 — drivenRuns
- src/controller/controller.ts:154-171 — redrive
- src/controller/controller.ts:405-412 — usage-window branch parks queued runs
- src/controller/state.ts:417-417 — writeChains map
- src/controller/runs.ts:826-845 — runOnce entry: status set to running
- src/controller/runs.ts:860-876 — loop-top stop parks a held run
- src/controller/runs.ts:1004-1004 — step shouldStop reads stopReason

## Design additions: server and smoke
- src/dashboard/multi-server.ts:70-75 — head of MultiDashboardOptions
- src/dashboard/multi-server.ts:165-170 — HarnessHub construction
- src/dashboard/multi-server.ts:177-194 — Controller construction
- src/dashboard/multi-server.ts:360-368 — overview-subscribe sends the snapshot
- src/index.ts:452-452 — isSmokeMode read
- src/index.ts:563-568 — server construction
- src/index.ts:592-609 — smoke health check and exit
- src/advisor/actions.ts:164-167 — packageRoot
- src/dashboard/harness/hub.ts:139-154 — close drops the listeners

## Design additions: script and unit
- scripts/sdd-self-update.sh:54-54 — log
- scripts/sdd-self-update.sh:175-181 — BASE and first check_move
- scripts/sdd-self-update.sh:302-309 — restart branch and final log
- scripts/sdd-service.sh:213-214 — systemd-run with EnvironmentFile

## Design additions: frontend
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:210-210 — CTRL_LIVE_STATUSES
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:358-366 — inline confirm pattern
- src/dashboard_frontend/src/modules/shell/types.ts:268-274 — hand copy of ShellMessage
- src/dashboard_frontend/src/modules/app/ConnectionBanner.tsx:14-14 — reads nextRetryAt
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:11-26 — context type

## Design additions: tests
- vitest.config.ts:8-9 — include and exclude; the frontend tree is skipped
- tsconfig.json:19-20 — tsc include and exclude
- src/__tests__/service-scripts.test.ts:24-34 — runScript, 20-second limit
- src/__tests__/service-scripts.test.ts:49-76 — makeDivergedCheckout, stageBuildStub
- src/dashboard/shell/__tests__/shell-feed.test.ts:359-361 — exact message order
- src/controller/__tests__/pause-request.test.ts:58-59 — pauseRequested carry-over tests
- src/dashboard/__tests__/controller-dashboard-routes.test.ts:91-91 — server under test
- e2e/worktree-shell.spec.ts:417-444 — seeded run.json pattern
