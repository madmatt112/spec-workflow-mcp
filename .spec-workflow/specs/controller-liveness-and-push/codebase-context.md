# Codebase context — controller-liveness-and-push

Paths are relative to the code root `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push`.

## Run record and state store (src/controller/state.ts)
- src/controller/state.ts:56-64 — `RunStatus` union.
- src/controller/state.ts:69-109 — `RunRecord`, the `run.json` shape (`pauseRequested`, `inFlight`, `cursor`, `updated`).
- src/controller/state.ts:140-149 — `WaitKind` and `WaitState` (`open`, `answered`, `expired`).
- src/controller/state.ts:192-212 — `WaitRecord`, the `waits/<id>.json` shape (`created`, `questions`, `state`).
- src/controller/state.ts:242-258 — `KnownProject` and `ProjectsFile` (project id to name).
- src/controller/state.ts:336-341 — `writeJsonAtomic`, temp file then rename.
- src/controller/state.ts:381-409 — `listRuns`, `readRun`, `readRunSync`.
- src/controller/state.ts:411-443 — `writeChains`, `writeRunLocked` (carries `pauseRequested` from disk unless the writer owns it), `writeRun`.
- src/controller/state.ts:449-474 — `listWaits`, `readWait`, `writeWait`.
- src/controller/state.ts:504-506 — `readProjects`.
- src/controller/state.ts:590-615 — `processStartTime`, `isProcessAlive`.

## Step process and its stream (src/controller/step.ts)
- src/controller/step.ts:40-45 — `ActivityEvent`, one tool_use for the live line.
- src/controller/step.ts:94-135 — `StepSpec` (`onActivity`, `onRateLimit`, `onSpawn` callbacks).
- src/controller/step.ts:350-529 — `runStep`, spawns `claude -p`, parses stream-json, resolves a classified `StepResult`.
- src/controller/step.ts:410-435 — `handleEvent`, fires `onActivity` only for assistant `tool_use` blocks.
- src/controller/step.ts:437-449 — `handleLine`, parses one stdout line, ignores blank and non-JSON lines.
- src/controller/step.ts:452-461 — `onStdout`, splits chunks into lines.
- src/controller/step.ts:463-499 — `finish`, settles once on `close`, resolves after the log flushes.
- src/controller/step.ts:501-528 — the spawn, `onSpawn`, `error` and `close` handlers.

## Step callers (every `runStep` site)
- src/controller/phases/document.ts:375-411 — document-phase StepSpec build, `runStep`, `onStepEnd` after the result.
- src/controller/phases/implementation.ts:463-467 — implementation StepSpec `onActivity` and `runStep`.
- src/controller/phases/retrospective.ts:161-165 — retrospective StepSpec `onActivity` and `runStep`.
- src/controller/phases/closeout.ts:311-315 — close-out StepSpec `onActivity` and `runStep`.
- src/controller/merge-fix.ts:221-225 — merge-fix StepSpec `onActivity` and `runStep`.

## Run driver (src/controller/runs.ts)
- src/controller/runs.ts:57 — `runEvents`, the run-change emitter the hub listens to.
- src/controller/runs.ts:388-413 — `RunDeps`, the driver's dependency surface.
- src/controller/runs.ts:427-433 — `patchRun`, read-modify-write from disk, emits `change`.
- src/controller/runs.ts:436-447 — `stepLifecycle`, `onStepSpawn` writes `inFlight`, `onStepEnd` clears it.
- src/controller/runs.ts:542-547 — `save`, spreads the caller's copy, emits `change`.
- src/controller/runs.ts:555-563 — `pause`.
- src/controller/runs.ts:566-575 — `waitAnd`, `createWait` then status `waiting`.
- src/controller/runs.ts:686-692 — an `error` wait with `retry`/`abandon` options (shape every error wait uses).
- src/controller/runs.ts:808-1042 — `runOnce`, the step loop; sets status `running` at 821-827.
- src/controller/runs.ts:1356-1376 — `cancelRun`.
- src/controller/runs.ts:1410-1444 — `ControllerRunRow`, `toRow`, `listRunsForWire` (the wire run row).

## Controller (src/controller/controller.ts)
- src/controller/controller.ts:75-78 — `active`, `cancelled`, `resumeTimers`, `drives`.
- src/controller/controller.ts:100-114 — `start`, lock, `recover`, tick.
- src/controller/controller.ts:205-224 — `pause`.
- src/controller/controller.ts:240-267 — `resumeNow`.
- src/controller/controller.ts:304-317 — `recover`, re-drives `running` runs, resumes answered waits.
- src/controller/controller.ts:320-332 — `reattach`, polls a live detached step pid.
- src/controller/controller.ts:381-396 — `settlePass`.
- src/controller/controller.ts:417-434 — `startDrive`, `drive`; a `runOnce` throw is only logged at 428-429.
- src/controller/controller.ts:438-466 — `onWaitChange`; `error`/`escalation` answered `abandon` cancels, else `queued`.
- src/controller/controller.ts:512-528 — `runDeps`, wires `onActivity` to `recordActivity`.
- src/controller/controller.ts:599-606 — `save`.

## Waits (src/controller/waits.ts)
- src/controller/waits.ts:38-43 — `ControllerWaitRecord` (adds `specDir`).
- src/controller/waits.ts:63 — `waitEvents`.
- src/controller/waits.ts:87-104 — `createWait`, the one wait writer; `waitAnd`, gates and merge call it.
- src/controller/waits.ts:113-141 — `answerWait`.
- src/controller/waits.ts:187-203 — `listOpenWaits`, `listWaitsForView`, `listWaitsForWire`.
- src/controller/phases/gates.ts:169 — gate-a `createWait` call (not through `waitAnd`).
- src/controller/merge.ts:732 — merge `createWait` call (not through `waitAnd`).

## Activity relay (src/controller/activity.ts)
- src/controller/activity.ts:16-25 — `ControllerActivity`.
- src/controller/activity.ts:35-48 — `recordActivity`, `listActivityForWire`, `clearRunActivity`.

## Existing phone push (src/advisor)
- src/advisor/push.ts:37-46 — `PushConfig` (`url`, `dashboardUrl`) and `PushedFile` (`ids`).
- src/advisor/push.ts:77-83 — `readPushConfig`, `push.json`; unreadable means no send.
- src/advisor/push.ts:114-218 — `WaitPusher`: watches `waits/`, one queue, dedup by `pushed.json`.
- src/advisor/push.ts:155-173 — `runStartupScan`, first start records open ids without sending.
- src/advisor/push.ts:175-186 — `handleWait`, one push per new open wait.
- src/advisor/push.ts:188-217 — `attemptPush`, `postOnce`; one retry, then a `push.failure` row.
- src/advisor/home.ts:39-53 — `pushConfigPath`, `pushedPath`, `eventsPath`.
- src/advisor/__tests__/push.test.ts — WaitPusher tests.

## Dashboard server (src/dashboard)
- src/dashboard/multi-server.ts:101-128 — `launchSpec`; creates the spec directory at 118-120, then `enqueue`.
- src/dashboard/multi-server.ts:402-410 — controller start; `WaitPusher` starts only when the lock was taken.
- src/dashboard/multi-server.ts:654-666 — setup-view route, adds `launchBlock`.
- src/dashboard/multi-server.ts:809-857 — run routes (`runs`, `cancel`, `pause`, `resume`, `discard`, `log`).
- src/dashboard/harness/hub.ts:40-53 — hub listens to `waitEvents`, `runEvents`, `activityEvents`.
- src/dashboard/harness/hub.ts:164-166 — `onSourceChange` re-arms the shell feed.
- src/dashboard/shell/shell-feed.ts:115-120 — shell feed reads `listRunsForWire`.

## Launch routing
- src/core/spec-routing-deriver.ts:8-18 — `RoutingState` union.
- src/core/spec-routing-deriver.ts:63-139 — `deriveRouting`; `all-on-disk-complete` reason at 96-106.
- src/dashboard/harness/run-setup.ts:146-217 — `buildSetupView`; unstarted lookup only for two states at 195-201.
- src/dashboard/harness/run-setup.ts:223-232 — `nextUnstartedSpec`.
- src/dashboard/harness/__tests__/run-setup.test.ts — setup-view tests.

## Watchdog
- scripts/sdd-watchdog.sh:184-199 — `write_error_wait`, writes an `error` wait via `createWait` from its own node process.
- scripts/sdd-watchdog.sh:202-211 — `notify-send` alert path.

## Tests
- src/controller/__tests__/controller.test.ts — controller drive, recovery, wait answers.
- src/controller/__tests__/runs.test.ts — `runOnce`, wire rows.
- src/controller/__tests__/state.test.ts — record writes and carry-over.
- src/controller/__tests__/step.test.ts — `runStep` stream parsing.
- src/controller/__tests__/waits.test.ts — wait create and answer.
- src/controller/__tests__/pause-request.test.ts — `pauseRequested` carry-over.
- src/dashboard/__tests__/controller-dashboard-routes.test.ts — controller run routes.
