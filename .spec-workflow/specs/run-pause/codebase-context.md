# Codebase context — run-pause

## Controller scheduler (src/controller/controller.ts)
- src/controller/controller.ts:75-81 — in-memory `active`, `cancelled`, `resumeTimers`, `drives` sets; lost on restart.
- src/controller/controller.ts:191-196 — `cancel`: marks cancelled, drops from queue, calls `cancelRun`.
- src/controller/controller.ts:207-224 — `resumeNow`: usage-window reason resets over-threshold windows in `rate-limit.json`; any other pause reason only drops `resumeAt`; `null` when not paused.
- src/controller/controller.ts:261-274 — `recover`: on start re-attaches or re-drives `running` runs, re-checks `waiting` runs; `paused` runs are left to the scheduler.
- src/controller/controller.ts:298-328 — `schedule`: window-blocked branch parks `queued` runs as `usage-window`; else starts every startable run and clears `pauseReason`/`resumeAt` on a paused one.
- src/controller/controller.ts:333-345 — `isStartable`: a `paused` run with no `resumeAt` (or a past one) is startable whatever its reason.
- src/controller/controller.ts:369-392 — `onWaitChange`: an answered wait moves a `waiting` run to `queued` (or cancels on `abandon`).
- src/controller/controller.ts:408-423 — `windowBlock`: the usage-window check against `rate-limit.json`.
- src/controller/controller.ts:438-453 — `runDeps`: wires `windowBlock` and `isCancelled` into the driver.
- src/controller/controller.ts:532-536 — `isLive`: queued, running, paused, waiting, merging hold the store's one-run slot.

## Run record and home state (src/controller/state.ts)
- src/controller/state.ts:56-64 — `RunStatus` union.
- src/controller/state.ts:67-101 — `RunRecord`; `pauseReason` (free string) at 83, `resumeAt` at 88, `pausedAt` at 90.
- src/controller/state.ts:388-394 — `writeRun`: stamps `pausedAt` on the write that makes a run paused or waiting, clears it otherwise.

## Run driver (src/controller/runs.ts)
- src/controller/runs.ts:401-410 — `RunDeps.windowBlock` and `RunDeps.isCancelled` ("checked between steps").
- src/controller/runs.ts:417-423 — `patchRun`: read-modify-write of a run field set.
- src/controller/runs.ts:426-437 — `stepLifecycle`: sets and clears `run.inFlight` around each step process.
- src/controller/runs.ts:540-542 — `pause`: writes `status: paused`, `pauseReason`, `resumeAt`, clears `inFlight`.
- src/controller/runs.ts:545-554 — `waitAnd`: creates a wait and marks the run `waiting`.
- src/controller/runs.ts:770-789 — `runOnce` entry: merge-resume detection, sets status `running`.
- src/controller/runs.ts:804-836 — loop top: cancel check, token cap, usage-window check before routing.
- src/controller/runs.ts:904-918 — document phase call; no `shouldStop` passed.
- src/controller/runs.ts:920-950 — implementation phase call with `shouldStop` (cancel or window), then the merge stage.
- src/controller/runs.ts:952-987 — retrospective and close-out calls with `shouldStop`.
- src/controller/runs.ts:1120-1181 — `handleImplementationOutcome`: `stopped` pauses only for `usage-window`.
- src/controller/runs.ts:1209-1262 — `handleDocumentOutcome`, including the in-place fresh retry of `runDocumentPhase`.
- src/controller/runs.ts:1282-1302 — `cancelRun`: SIGTERM/SIGKILL the in-flight step, mark `abandoned`.
- src/controller/runs.ts:1336-1363 — `ControllerRunRow` wire shape and `toRow` (carries `pauseReason`, `resumeAt`, `pausedAt`).

## Phase loops and step spawn sites
- src/controller/phases/document.ts:159-198 — `DocumentPhaseContext`; has no `shouldStop`.
- src/controller/phases/document.ts:364-404 — `runModelStep`: the document phase's one spawn wrapper around `runStep`.
- src/controller/phases/document.ts:771-797 — draft v1, checkpoint commit, lint, gate A wait.
- src/controller/phases/document.ts:802-827 — review-round loop: prompt build and reviewer spawn.
- src/controller/phases/implementation.ts:104 — `shouldStop` on the implementation context.
- src/controller/phases/implementation.ts:571-573 — per-task loop top `shouldStop` check.
- src/controller/phases/implementation.ts:462 — implementation phase `runStep` call.
- src/controller/phases/retrospective.ts:47 — `shouldStop` on the retrospective context.
- src/controller/phases/retrospective.ts:192-193 — retrospective `shouldStop` check.
- src/controller/phases/closeout.ts:66 — `shouldStop` on the close-out context.
- src/controller/phases/closeout.ts:380-381 — close-out `shouldStop` check.
- src/controller/merge-fix.ts:225 — merge-fix round `runStep` call.
- src/controller/step.ts:350 — `runStep`: spawns one `claude -p` step process.
- src/advisor/opinion.ts:154 — advisor second-opinion `runStep` call (not tracked in `run.inFlight`).

## Dashboard routes and access
- src/dashboard/multi-server.ts:803-830 — GET runs, POST cancel, POST resume (404 `run-not-found`, 409 `not-paused`), POST discard.
- src/controller/access.ts:186-211 — `makeRequireAccess`: every non-GET under `/api/controller/` needs the shared secret.

## Dashboard frontend
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:185-194 — status tone map (`paused` is warning).
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233 — `ControllerRunRow`: clickable row with the pause note.
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:235-324 — `ControllerRunPanel`: Open run page, Resume now, Cancel, Discard.
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:296-306 — Resume now button, shown for any `paused` run.
- src/dashboard_frontend/src/modules/shell/pause.ts:27-44 — `pauseNote`: label is the raw `pauseReason`, plus pause age and resume time.
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:351-352 — Now page also renders `pauseNote`.
- src/dashboard_frontend/src/modules/shell/types.ts:215-231 — `ControllerRun` wire type.

## Self-update script
- scripts/sdd-self-update.sh:89-97 — `step_live`: true when any run's `inFlight` process is alive.
- scripts/sdd-self-update.sh:100-107 — `wait_no_step`: polls up to 30 minutes.
- scripts/sdd-self-update.sh:109-117 — first in-flight refusal.
- scripts/sdd-self-update.sh:297-308 — wait, swap `dist/`, restart `sdd-controller.service`.

## Tests
- src/controller/__tests__/controller.test.ts:235-295 — window park/release and `resumeNow` tests.
- src/controller/__tests__/controller.test.ts:415 — resume of a run left running mid document phase.
- src/controller/__tests__/runs.test.ts:348-349 — `runOnce` usage-limit pause test.
- src/controller/__tests__/paused-at.test.ts:13-38 — `pausedAt` stamping.
- src/dashboard/__tests__/controller-dashboard-routes.test.ts:1-184 — controller route tests.

## Design reference
- docs/controller-design.md:168-195 — §8 liveness and §9 usage window and pause.

## Design phase additions — state and driver
- src/controller/state.ts:322-327 — `writeJsonAtomic`: temp file then rename.
- src/controller/state.ts:330-338 — `readJson`: async read, `undefined` on ENOENT.
- src/controller/runs.ts:388-411 — `RunDeps` interface (test fakes build it).
- src/controller/runs.ts:621-768 — `runMergeStageStep`; `blocked` branch saves the `merge` cursor at 689-691 and guards the merge-fix round at 692-710.
- src/controller/runs.ts:770-781 — `runOnce` merge-resume detection (`merging` status or `merge` cursor).
- src/controller/runs.ts:850-887 — `done` routing: close-out merge step, run end, store push, `done` write.
- src/controller/runs.ts:1000-1035 — `runCloseoutMergeStep`: close-out PRs; `merging` on not-ready.
- src/controller/runs.ts:1038-1063 — `handleCloseoutOutcome`.
- src/controller/runs.ts:1184-1206 — `handleRetrospectiveOutcome`.
- src/controller/controller.ts:524-529 — `Controller.save`: spread, `writeRun`, emit change.

## Design phase additions — phase stop points
- src/controller/phases/document.ts:200-213 — `DocumentPhaseOutcome` result union.
- src/controller/phases/document.ts:686-713 — orient (`D`), idempotent approved return, `phase.start`.
- src/controller/phases/document.ts:771-797 — draft only when `D === 0`.
- src/controller/phases/document.ts:802-911 — review-round loop: reviewer, standoff, should-fix-only, circling, cap, reviser, lint.
- src/controller/phases/implementation.ts:100-104 — `shouldStop` doc: reason ends the phase `stopped`, resume from `tasks.md`.
- src/controller/phases/implementation.ts:636-637 — `shouldStop` before the test-author spawn.
- src/controller/phases/implementation.ts:705-706 — `shouldStop` before the implementer spawn.
- src/controller/phases/implementation.ts:786-787 — `shouldStop` at the gate-loop top.
- src/controller/phases/implementation.ts:989-990 — `shouldStop` in the security loop.
- src/controller/phases/implementation.ts:1130-1131 — `shouldStop` in the end-to-end repair loop.
- src/controller/phases/implementation.ts:1339-1340 — `shouldStop` in the CI poll.
- src/controller/phases/retrospective.ts:218-219 — second retrospective `shouldStop` check.

## Design phase additions — frontend and access
- src/controller/access.ts:186-211 — `makeRequireAccess` full body.
- src/dashboard/harness/overview-watch.ts:181-187 — subscribes to `runEvents` change and pushes rows.
- src/dashboard_frontend/src/modules/shell/primitives.tsx:168-193 — `Row`: div with role button and `onClick`.
- src/dashboard_frontend/src/modules/ui/ui.tsx:41-61 — `Button`: passes native button props.
- src/dashboard_frontend/src/modules/shell/pause.ts:46-49 — `pauseNoteClass` tone classes.
- src/dashboard_frontend/src/modules/shell/types.ts:196-197 — `ControllerRunStatus` union.
- src/dashboard_frontend/src/modules/shell/Sidebar.tsx:197 — existing `stopPropagation` use.
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:340-356 — Now page controller live rows with `pauseNote`.

## Design phase additions — tests and fixtures
- vitest.config.ts:8-9 — vitest includes `src/**/*.test.ts`, excludes `src/dashboard_frontend/**`.
- scripts/stub-claude.mjs:17 — stub run `delayMs` option.
- scripts/stub-claude.mjs:110-111 — stub waits `delayMs` before emitting.
- e2e/worktree-shell.spec.ts:164-173 — seeds a controller `run.json` directly.
- e2e/worktree-shell.spec.ts:310-319 — opens a controller run row on `/#/runs`.
- src/controller/__tests__/controller.test.ts:414-449 — crash-recovery test pattern.
- src/controller/__tests__/runs.test.ts:348-349 — usage-limit pause test start.
