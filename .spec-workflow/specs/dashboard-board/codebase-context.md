# Codebase context — dashboard-board

## Shell and routes
- src/dashboard_frontend/src/modules/app/App.tsx:17-37 — shell frame, sidebar mount and the route table
- src/dashboard_frontend/src/modules/app/ConnectionBanner.tsx:13-51 — disconnection notice with retry
- src/dashboard_frontend/index.html:6 — base page title
- src/dashboard_frontend/src/main.tsx:14-16 — HashRouter mount
- src/dashboard_frontend/src/modules/shell/Sidebar.tsx:65-163 — nav rows, counts, project switches, dots, gear mount
- src/dashboard_frontend/src/modules/shell/Sidebar.tsx:165-206 — desktop aside, mobile bar and drawer
- src/dashboard_frontend/src/modules/shell/Gear.tsx:12-136 — settings popover: theme, density, notifications, version
- src/dashboard_frontend/src/modules/shell/PageLayout.tsx:9-33 — list-plus-panel frame and ScrollBox
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:60-178 — topic subscriptions, density, wait notifications
- src/dashboard_frontend/src/modules/shell/DeployControl.tsx:12-85 — propless Deploy button, confirm and error
- src/dashboard_frontend/src/modules/shell/DeployControl.tsx:87-128 — deploy stage strip
- src/dashboard_frontend/src/modules/shell/deploy.ts:7-28 — pure deploy stage helpers

## Home today
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78 — one-line wait summary per kind
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:105-139 — OpenAdvisorButton
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:142-193 — StagedActionCard
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:196-228 — SecondOpinionButton
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:230-431 — the page and its five groups
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:500-701 — AnswerSheet, one branch per wait kind
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:703-785 — read-only derived wait panel

## Runs pages
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:80-181 — Runs list page
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:213-240 — PauseButton
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:270-372 — run panel: Resume, Pause, Cancel, Discard confirm
- src/dashboard_frontend/src/modules/shell/RunsPage.tsx:385-473 — LaunchCard
- src/dashboard_frontend/src/modules/shell/RunPage.tsx:48-208 — Run page, log tail and task-review polls
- src/dashboard_frontend/src/modules/shell/harness.tsx:11-24 — callHarness keeps non-ok bodies
- src/dashboard_frontend/src/modules/shell/harness.tsx:40-52 — buildLaunchInput
- src/dashboard_frontend/src/modules/shell/harness.tsx:69-108 — OpErrorView
- src/dashboard_frontend/src/modules/shell/pause.ts:7-17 — fmtSpan
- src/dashboard_frontend/src/modules/shell/pause.ts:27-30 — isOperatorHeld
- src/dashboard_frontend/src/modules/shell/pause.ts:33-48 — pauseNote
- src/dashboard_frontend/src/modules/shell/types.ts:177-191 — ControllerWait hand copy
- src/dashboard_frontend/src/modules/shell/types.ts:215-239 — ControllerRun hand copy
- src/dashboard_frontend/src/modules/shell/types.ts:256-268 — StagedAction hand copy

## Projects
- src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:28-39 — localStorage off-list under shell.projects
- src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:74-91 — enabled and toggle
- src/dashboard_frontend/src/modules/projects/stores.ts:25-43 — storeGroups and representative

## Theme and primitives
- src/dashboard_frontend/src/modules/theme/tokens.css:4-59 — theme-independent tokens, type scale, widths
- src/dashboard_frontend/src/modules/theme/tokens.css:61-110 — light colours
- src/dashboard_frontend/src/modules/theme/tokens.css:112-160 — dark colours
- src/dashboard_frontend/src/modules/ui/ui.tsx:29-61 — Button variants
- src/dashboard_frontend/src/modules/ui/ui.tsx:132-157 — shared class constants
- src/dashboard_frontend/src/modules/shell/primitives.tsx:13-60 — collapsible Group
- src/dashboard_frontend/src/modules/shell/primitives.tsx:168-195 — Row, reads --row-h

## Server routes
- src/dashboard/multi-server.ts:106-133 — launchSpec
- src/dashboard/multi-server.ts:594-617 — task-review summary route
- src/dashboard/multi-server.ts:662-674 — setup view route with launchBlock
- src/dashboard/multi-server.ts:679-694 — launch route, forces gates record
- src/dashboard/multi-server.ts:705-718 — wait answer route
- src/dashboard/multi-server.ts:748-759 — advisor open route
- src/dashboard/multi-server.ts:796-812 — action confirm and dismiss
- src/dashboard/multi-server.ts:822-864 — cancel, pause, resume, redrive, discard
- src/dashboard/multi-server.ts:868-875 — run log route
- src/dashboard/harness/run-setup.ts:146-218 — buildSetupView
- src/dashboard/harness/run-setup.ts:224-233 — nextUnstartedSpec
- src/dashboard/harness/hub.ts:66-116 — watch reconcile
- src/dashboard/harness/project-watch.ts:28 — parseHandoffRouting, imported by run-setup and overview-watch
- src/dashboard/harness/project-watch.ts:63 — parseGateSections
- src/dashboard/shell/shell-feed.ts:92-161 — one flush, seven topics
- src/dashboard/shell/now-model.ts:91-176 — per-project Now groups
- src/dashboard/shell/sidebar-rows.ts:18-68 — sidebar dots
- src/dashboard/shell/run-detail.ts:19-72 — run detail builder
- src/dashboard/shell/waits.ts:111-184 — derived waits

## Controller
- src/controller/state.ts:26-36 — StepCursor, task never written
- src/controller/state.ts:39-46 — InFlightStep
- src/controller/state.ts:70-113 — RunRecord
- src/controller/state.ts:123-142 — PrRead
- src/controller/runs.ts:441-446 — setRunHeartbeat emits change
- src/controller/runs.ts:449-465 — stepLifecycle, onStepSpawn patch
- src/controller/runs.ts:1374-1394 — cancelRun writes abandoned
- src/controller/runs.ts:1400-1422 — discardRun
- src/controller/runs.ts:1428-1465 — wire row and toRow
- src/controller/runs.ts:1494-1528 — readRunLogTail
- src/controller/controller.ts:168-170 — drivenRuns
- src/controller/controller.ts:205-222 — redrive
- src/controller/controller.ts:299-318 — pause
- src/controller/controller.ts:337-371 — resumeNow
- src/controller/controller.ts:373-378 — discard
- src/controller/controller.ts:386-399 — launchBlock
- src/controller/controller.ts:582-609 — openCrashWait
- src/controller/waits.ts:193 — DRIVE_CRASH_QUESTION
- src/controller/merge.ts:28 — own-PR merge question id
- src/controller/merge.ts:554-557 — close-out merge question id
- src/advisor/actions.ts:34 — ActionState
- src/advisor/actions.ts:112 — listActions
- src/advisor/actions.ts:431 — confirmAction

## Tests
- src/dashboard/__tests__/frontend-tokens.test.ts:126-127 — token name list
- src/dashboard/__tests__/frontend-style-scan.test.ts:32-34 — scanner roots
- src/dashboard/__tests__/controller-dashboard-routes.test.ts:192 — log route test
- src/dashboard/__tests__/shell-routes.test.ts:337 — shell-now subscriber test
- src/dashboard/shell/__tests__/deploy-view.test.ts:1-3 — vitest over a frontend pure module
- e2e/worktree-shell.spec.ts:25-26 — nav and page lists
- e2e/worktree-shell.spec.ts:243 — density test
- e2e/worktree-deploy.spec.ts:271 — held-for-deploy test
- e2e/worktree-visual.spec.ts:277 — nav-runs read

## Docs
- docs/SDD-HARNESS.md:99-100 — Launch on the Runs page
- docs/SDD-HARNESS.md:120 — answer on the Now page
- docs/SDD-HARNESS.md:469 — Now page acknowledgement
