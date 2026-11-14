# Codebase context — dashboard-plain-pages

## Frontend pages (src/dashboard_frontend/src/modules/shell)
- src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:74-210 — Specs list: store groups, six state chips, search box, pager, row with versions, tasks, PRs, deferrals, retro, updated
- src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:239-385 — SpecPanel: fetches the spec detail route, shows runs, phases, deferrals, files
- src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:387-436 — FileRow: Copy path with a clipboard fallback field
- src/dashboard_frontend/src/modules/shell/UsagePage.tsx:42-64 — UsageBar: one window's utilisation bar and reset text
- src/dashboard_frontend/src/modules/shell/UsagePage.tsx:86-174 — UsagePage: five-hour and seven-day bars, closed-spec table, UsageTrend
- src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102 — fetch of the rate-limit route on every controller-runs push
- src/dashboard_frontend/src/modules/shell/UsagePage.tsx:105-115 — fetch of the closed-specs usage route (the only frontend caller)
- src/dashboard_frontend/src/modules/shell/UsageTrend.tsx:36-132 — plain-SVG W-per-task trend per project
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:88-236 — Deferrals list: status and owner chips, search, pager, store groups, row select
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:258-304 — DeferralPanel: the whole record, read-only
- src/dashboard_frontend/src/modules/shell/PageLayout.tsx:9-28 — list-plus-panel frame; callers are the three pages only
- src/dashboard_frontend/src/modules/shell/primitives.tsx:5-195 — ROWS_PER_PAGE, Group, Chips, SearchBox, Pager, Row; callers are the three pages only
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:43-136 — subscribes shell-specs, controller-runs, deferrals-update; fetches per-project deferrals
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:109-124 — initial GET of each project's deferrals payload
- src/dashboard_frontend/src/modules/shell/types.ts:11-24 — frontend hand copy of SpecListRow
- src/dashboard_frontend/src/modules/shell/types.ts:142-143 — ControllerRunStatus union
- src/dashboard_frontend/src/modules/shell/types.ts:161-195 — ControllerRun wire row (tokens, phase, task, holdBy, driven)
- src/dashboard_frontend/src/modules/app/App.tsx:23-29 — routes for Home, /specs, /usage, /deferrals
- src/dashboard_frontend/src/modules/projects/stores.ts:25-43 — storeGroups: one group per workflowRootPath, enabled when any member is enabled
- src/dashboard_frontend/vite.config.ts:27-46 — dev proxy rewrites Origin on proxied requests (mutating fetch support)

## Shell feed and builders (src/dashboard/shell)
- src/dashboard/shell/shell-feed.ts:87-137 — flush: builds spec rows per store, waits, runs, actions, deploy; sends shell-specs first
- src/dashboard/shell/spec-rows.ts:78-82 — isSpecClosed: closeout/closed phase-log row or plan Status CLOSED
- src/dashboard/shell/spec-rows.ts:90-183 — buildSpecRows: one row per spec directory, state precedence live, closed, deferred, not-started, abandoned, in-progress
- src/dashboard/shell/spec-rows.ts:149-154 — PR numbers from phase-log notes matching PR #n
- src/dashboard/shell/spec-rows.ts:186-215 — parseDecomposition: order number and Depends on paragraph for one spec
- src/dashboard/shell/spec-rows.ts:269-295 — buildSpecDetail: panel data for the detail route
- src/dashboard/shell/usage-rows.ts:33-84 — buildUsageRows: closed-spec W, W per task, baseline percentage
- src/dashboard/shell/live-runs.ts:10-18 — liveRunsByProject: newest run per project whose status is not done or abandoned
- src/dashboard/shell/types.ts:11-23 — SpecListRow wire type
- src/dashboard/shell/types.ts:25-32 — SpecDetail wire type
- src/dashboard/shell/types.ts:40-51 — UsageSpecRow wire type

## Dashboard server routes (src/dashboard/multi-server.ts)
- src/dashboard/multi-server.ts:436-451 — deferral-change listener pushes deferrals-update with the project's payload
- src/dashboard/multi-server.ts:459-468 — buildDeferralsPayload: all records, duplicate groups, deferred specs
- src/dashboard/multi-server.ts:600-607 — GET /api/projects/:projectId/deferrals
- src/dashboard/multi-server.ts:611-618 — GET spec detail route (SpecPanel's only caller)
- src/dashboard/multi-server.ts:625-643 — GET /api/shell/usage/closed-specs
- src/dashboard/multi-server.ts:704-718 — POST wait answer: pattern for a mutating route with 400 and 404 replies
- src/dashboard/multi-server.ts:887-889 — GET /api/controller/rate-limit returns rate-limit.json or null

## Harness watchers (src/dashboard/harness)
- src/dashboard/harness/hub.ts:36-48 — reschedules the feed on spec-change, deferral-change, wait, run, action changes
- src/dashboard/harness/hub.ts:55-84 — starts ShellFeed and OverviewWatch while an overview client is open; overview-rows re-arms the feed
- src/dashboard/harness/overview-watch.ts:107-149 — buildOverviewRow: running or idle per project from run records and HANDOFF
- src/dashboard/harness/overview-watch.ts:158-300 — OverviewWatch: HANDOFF and ledger watchers, overview-rows push
- src/dashboard/harness/project-watch.ts:18-31 — parseHandoffRouting: active spec, phase, state, result from HANDOFF
- src/dashboard/harness/run-setup.ts:23 — DECOMPOSITION_HEADING regex for numbered backticked headings
- src/dashboard/harness/run-setup.ts:199-207 — launchable spec: routing active spec, else nextUnstartedSpec
- src/dashboard/harness/run-setup.ts:230-239 — nextUnstartedSpec: first heading with no directory and no (deferred) tag
- src/dashboard/harness/run-setup.ts:246-261 — decompositionEntry: heading through the next ### line
- src/dashboard/harness/run-setup.ts:269-281 — decompositionPosition: zero-based heading index

## Spec index and routing (src/core, src/tools)
- src/core/index-generator.ts:59-91 — snapshot: entries per spec directory with deferred marker, task progress, status
- src/core/index-generator.ts:142-159 — listDeferredSpecs: deferred.json markers
- src/core/index-generator.ts:161-185 — categorize: active in decomposition mention order, deferred, other
- src/core/index-generator.ts:256-261 — mentionIndex: first whole-token mention in decomposition.md
- src/core/spec-routing-deriver.ts:63-139 — deriveRouting: active, ambiguous, all-on-disk-complete, all-deferred, no-specs
- src/tools/spec-index.ts:64-131 — spec-index tool handler: generate, defer, undefer

## Deferrals (src/tools, src/core)
- src/tools/deferrals.ts:129-148 — action switch
- src/tools/deferrals.ts:258-270 — handleResolve: requires id and resolution, calls storage.resolve
- src/core/deferral-storage.ts:192-202 — loadForWrite: not found and corrupt errors
- src/core/deferral-storage.ts:277-305 — list: filters, newest createdAt first
- src/core/deferral-storage.ts:307-319 — resolve: refuses a non-deferred record, writes status, resolution, resolvedAt
- src/controller/phases/document.ts:682-694 — gate A do nothing: tags the decomposition heading (deferred)
- src/controller/phases/document.ts:1143-1159 — deferInDecomposition: appends (deferred) and an italic reason line

## Controller usage window (src/controller)
- src/controller/step.ts:50-61 — RateLimitWindow and RateLimitWindows from a rate_limit_event
- src/controller/step.ts:290-303 — mapWindows: unifiedWindows five_hour and seven_day
- src/controller/step.ts:499-502 — rate_limit_event branch calls spec.onRateLimit
- src/controller/runs.ts:405-406 — RunDeps.onRateLimit takes windows only, no run id
- src/controller/controller.ts:692-707 — windowBlock: reads rate-limit.json, a passed reset reads as reset
- src/controller/controller.ts:722-738 — runDeps: onRateLimit calls persistRateLimit
- src/controller/controller.ts:790-803 — persistRateLimit: writes rate-limit.json (v, fiveHour, sevenDay, updated)
- src/controller/state.ts:60-74 — RunStatus union and isLive
- src/controller/state.ts:80-123 — RunRecord: project, spec, status, phase, holdBy, inFlight, tokens
- src/controller/state.ts:239-253 — RateLimitWindow and RateLimitFile
- src/controller/state.ts:293-297 — controllerHome: SDD_HOME or state home sdd
- src/controller/state.ts:328-330 — rateLimitPath under the controller home
- src/controller/state.ts:593-599 — readRateLimit and writeRateLimit

## Usage tool action (src/tools/harness.ts)
- src/tools/harness.ts:1397-1451 — usageAction: per-spec ledger usage report, compare, sources

## Tests that cover the three pages
- src/dashboard/shell/__tests__/spec-rows.test.ts:1-644 — buildSpecRows and buildSpecDetail
- src/dashboard/shell/__tests__/usage-rows.test.ts:1-260 — buildUsageRows
- src/dashboard/shell/__tests__/shell-feed.test.ts:1-463 — feed topics and order
- src/dashboard/__tests__/shell-routes.test.ts:1-637 — shell routes incl. closed-specs and spec detail
- src/dashboard/__tests__/frontend-style-scan.test.ts:1-467 — static scan naming UsageTrend
- e2e/worktree-shell.spec.ts:228-305 — Specs toggle, panel stacking, Deferrals owner chips, Usage trend lines
- e2e/worktree-visual.spec.ts:23-75 — visual views: spec-panel, usage-closed-specs, deferral-panel

## Controller rate-limit callback path (design phase)
- src/controller/step.ts:127 — StepSpec.runId, optional
- src/controller/step.ts:135 — StepSpec.onRateLimit, windows only
- src/controller/runs.ts:585-587 — totalW: private sum of the four token kinds
- src/controller/runs.ts:1595-1601 — listRunsForWire: wire rows newest first
- src/controller/phases/document.ts:182 — ctx.onRateLimit type, forwarded to the step
- src/controller/phases/implementation.ts:96 — ctx.onRateLimit type
- src/controller/phases/closeout.ts:62 — ctx.onRateLimit type
- src/controller/phases/retrospective.ts:41 — ctx.onRateLimit type
- src/controller/merge-fix.ts:50 — ctx.onRateLimit type
- src/controller/ledger.ts:160-166 — taskDone writes a task.done row with task, rounds, outcome
- src/controller/__tests__/step.test.ts:70-92 — runner helper with the onRateLimit fake

## Decomposition helpers (src/dashboard/harness/run-setup.ts)
- src/dashboard/harness/run-setup.ts:53-59 — readIfExists
- src/dashboard/harness/run-setup.ts:150-224 — buildSetupView: snapshot, routing, launchable, roles
- src/dashboard/harness/run-setup.ts:202-205 — launchable expression: routed spec, else nextUnstartedSpec
- src/core/spec-routing-deriver.ts:20 — RoutingDecision interface
- src/core/index-generator.ts:40 — SpecSnapshot interface with routing

## Shell support modules (src/dashboard/shell)
- src/dashboard/shell/store-groups.ts:25-42 — groupByStore: one group per workflowRootPath with representative
- src/dashboard/shell/file-cache.ts:20-48 — FileCache.text and jsonl, mtime/size keyed
- src/dashboard/shell/spec-rows.ts:11-13 — imports of parseHandoffPhaseRows and handoffPath
- src/dashboard/shell/spec-rows.ts:186-295 — parseDecomposition, buildRuns, listTopLevelFiles, buildSpecDetail (detail-only code)
- src/core/task-parser.ts:553-568 — parseTaskProgress: total, completed from tasks.md text

## Deferral write path
- src/core/deferral-storage.ts:34-36 — filePath joins the id into the deferrals directory
- src/core/deferral-storage.ts:179-189 — read: ok, missing or corrupt
- src/core/deferral-storage.ts:485-492 — fileExists
- src/tools/deferrals.ts:116-153 — deferralsHandler: validates the path, dispatches by action
- src/types.ts:58-76 — ToolContext: projectPath and workspacePath
- src/dashboard/watcher.ts:216-222 — handleDeferralChange emits deferral-change
- src/dashboard/project-manager.ts:207-209 — forwards deferral-change with projectId, one watcher per project
- src/dashboard/multi-server.ts:284-300 — onRequest hooks and access control for every route
- src/dashboard/multi-server.ts:652-673 — GET harness/setup route

## Frontend UI and page details
- src/dashboard_frontend/src/modules/ui/ui.tsx:10 — Tone union
- src/dashboard_frontend/src/modules/ui/ui.tsx:76 — Pill component
- src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-39 — STATE_TONE map
- src/dashboard_frontend/src/modules/shell/UsagePage.tsx:117-120 — one-second tick
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:54-57 — recordsOf: first member with a payload
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:211 — deferral-row test id
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:60 — shell-specs handler sets specRows
- src/dashboard_frontend/src/modules/shell/types.ts:11-48 — hand copies of SpecListRow, SpecDetail, UsageSpecRow

## Tests and suites the change touches (design phase)
- src/dashboard/shell/__tests__/spec-rows.test.ts:588-644 — isSpecClosed suite
- src/dashboard/__tests__/frontend-style-scan.test.ts:448-466 — UsageTrend SERIES suite
- src/dashboard/__tests__/controller-dashboard-routes.test.ts:172 — rate-limit route case
- src/dashboard/harness/__tests__/run-setup.test.ts — run-setup helpers suite
- e2e/worktree-shared.spec.ts:399-414 — shared spec scenario on the spec detail route
- e2e/worktree-no-shared.spec.ts:70-88 — spec-row ids and the project toggle
- e2e/worktree-project-list.spec.ts:57-59 — specRowCount on spec-row ids
- e2e/worktree-project-list.spec.ts:124-164 — shared store counts once on Specs and Deferrals
- e2e/worktree-shell.spec.ts:307-309 — page markers usage-closed-specs and page-list
- e2e/worktree-visual.spec.ts:57-78 — openView per view, opens panels
- e2e/worktree-visual.spec.ts:342-354 — pill, button and row style capture
- e2e/helpers/worktree-harness.ts:436-442 — seeds a spec dir with requirements.md, no decomposition
- e2e/helpers/shell-seed.ts:83-100 — seedVisualSuite fixture
