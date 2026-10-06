# Codebase context — dashboard-shell

## Frontend shell (src/dashboard_frontend/src/modules)
- src/dashboard_frontend/src/modules/app/App.tsx:9-20 — imports of the twelve current pages (Statistics, Specs, Harness, Overview, Steering, Tasks, Logs, Approvals, Deferrals, SpecViewer, Settings, Adversarial)
- src/dashboard_frontend/src/modules/app/App.tsx:30-191 — `Header`: project dropdown, version badge, volume, language and theme controls, mobile settings menu, changelog modal
- src/dashboard_frontend/src/modules/app/App.tsx:193-277 — `AppInner`: sidebar collapse state, `ApiProvider` scoped to `currentProjectId`, the route table at 241-255 with a catch-all redirect to `/` at 254, the no-project fallback
- src/dashboard_frontend/src/modules/app/App.tsx:279-299 — provider nesting: `I18nErrorBoundary`, `ThemeProvider`, `ProjectProvider`, `WebSocketProvider` keyed on the current project
- src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx:12-17 — `NavigationItem` (path, labelKey, icon, end)
- src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx:44-206 — `navigationItems`, the eleven sidebar entries
- src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:15-22 — context type with one `currentProjectId`
- src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:62-105 — fetch of `/api/projects/list`, first-project auto-select, 2.5 s poll
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:9-12 — `WatchView` (harness per project, or overview)
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:39-53 — view subscribe and unsubscribe messages
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:55-177 — one socket per selected project, `projectId` query parameter, reconnect with backoff
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:123-155 — `onmessage`: `initial`, global `projects-update`, global `overview-rows`/`overview-todos`, else project-scoped
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:203-223 — `watchView`, reference-counted view subscription
- src/dashboard_frontend/src/modules/api/api.tsx:209-245 — `ApiProvider`: loads specs, archived specs, approvals and info for one project
- src/dashboard_frontend/src/modules/pages/OverviewPage.tsx:49-75 — Overview page: overview view, `overview-rows` and `overview-todos` handlers, 1 s age tick
- src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:71-240 — Harness page: setup fetch 103-138, harness view subscribe 141-174, task-review summary poll every 5 s 186-209, save, launch and stop 228-240
- src/dashboard_frontend/src/modules/pages/DeferralsPage.tsx:36-60 — Deferrals page, scoped to the one `projectId` of `useApiData`
- src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:183-208 — toast and sound for new approvals
- src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:292-297 — `task-status-update` subscription
- src/dashboard_frontend/src/locales/en.json:5-17 — `nav` label keys of the eleven entries
- src/dashboard_frontend/src/i18n.ts:80 — `fallbackLng: 'en'`

## Harness server modules (src/dashboard/harness)
- src/dashboard/harness/types.ts:11-18 — `HarnessRunFile`, the saved setup
- src/dashboard/harness/types.ts:40-50 — `SetupView` (spec rows, routing, launchable, disabled reason, roles, saved file)
- src/dashboard/harness/types.ts:52-61 — `LaunchRecord` (pid, run id, state `running`/`stopping`/`stopped`/`exited`, exit code)
- src/dashboard/harness/types.ts:63 — `PointerLine`
- src/dashboard/harness/types.ts:70-75 — `OverviewRow` (state, spec, live phase, run id, last row, newest ts, waiting)
- src/dashboard/harness/types.ts:77-87 — `HarnessMessage` and `ViewMessage` unions
- src/dashboard/harness/hub.ts:29-43 — `HarnessHub`, listens to `launch-update` and `projects-update`
- src/dashboard/harness/hub.ts:53-91 — `reconcile`: one project watch per harness-subscribed project, one overview watch
- src/dashboard/harness/hub.ts:94-101 — `snapshotFor` and `overviewSnapshot`
- src/dashboard/harness/overview-watch.ts:61-72 — `newestLastRow`
- src/dashboard/harness/overview-watch.ts:79-94 — `computeWaiting`: newest `phase.end` result `gate-a`, `retro-ready` or `escalate` with no later `phase.start`
- src/dashboard/harness/overview-watch.ts:105-147 — `buildOverviewRow`: pointer line makes the row running, else idle with the HANDOFF spec; `buildModel` with empty activity at 133
- src/dashboard/harness/overview-watch.ts:190-199 — `OverviewWatch.start`
- src/dashboard/harness/overview-watch.ts:238-265 — rows for every project; one watched ledger per project (pointer spec, else HANDOFF spec)
- src/dashboard/harness/overview-watch.ts:267-291 — the state-dir, HANDOFF and ledger watchers
- src/dashboard/harness/project-watch.ts:27-40 — `parseHandoffRouting`
- src/dashboard/harness/project-watch.ts:62-65 — `parseGateSections` of `questions.md`
- src/dashboard/harness/project-watch.ts:79-81 — `WATCHED_FILES` (ledger, activity, tasks, questions, HANDOFF)
- src/dashboard/harness/project-watch.ts:170-188 — `snapshot`: `harness-model`, `harness-gates`, `harness-log`
- src/dashboard/harness/project-watch.ts:242-278 — `rebuild`: resolves the spec, builds the run model, adopts the run id
- src/dashboard/harness/project-watch.ts:292-306 — `armLogWatch`, the process log of a launch
- src/dashboard/harness/state-files.ts:16-29 — `stateHome`, `pointerPath`, `hudPath`
- src/dashboard/harness/state-files.ts:50-67 — `readPointer`
- src/dashboard/harness/run-setup.ts:118-184 — `buildSetupView`; launchable spec and disabled reason from routing at 167-168, saved file at 183
- src/dashboard/harness/launcher.ts:83-107 — `HarnessLauncher` fields and `get`
- src/dashboard/harness/launcher.ts:115-135 — `admission`: in-flight, pointer line in the store, or live record refuses

## Dashboard server (src/dashboard)
- src/dashboard/multi-server.ts:60-65 — `WebSocketConnection` (one `projectId`, `views`)
- src/dashboard/multi-server.ts:116-121 — `HarnessHub` wiring to `sendToHarness` and `sendToOverview`
- src/dashboard/multi-server.ts:230-345 — `/ws`: query `projectId` 230-235, `initial` 243-263, `subscribe` 290-313, `harness-subscribe` rebinds `projectId` 314-324, overview view 328-339
- src/dashboard/multi-server.ts:491-507 — `deferral-change` broadcast to one project's clients
- src/dashboard/multi-server.ts:515-524 — `buildDeferralsPayload`
- src/dashboard/multi-server.ts:563-588 — project info and specs list routes
- src/dashboard/multi-server.ts:739-756 — pending approvals and deferrals routes
- src/dashboard/multi-server.ts:2019-2042 — task-review summary route, latest verdict and `tdd` block per task
- src/dashboard/multi-server.ts:2183-2284 — harness setup, launch (gates forced to record) and stop routes
- src/dashboard/multi-server.ts:2315-2359 — `broadcastToProject`, `sendToHarness`, `sendToOverview`
- src/dashboard/project-manager.ts:154-177 — per-project watcher events forwarded with `projectId`
- src/dashboard/watcher.ts:36-45 — chokidar globs: spec `*.md`, steering, deferrals, `deferred.json`

## Run model (src/watch)
- src/watch/ledger.ts:87 — `PHASE_ORDER`
- src/watch/ledger.ts:89-184 — `PhaseRow`, `SpawnNode`, `TaskRow`, `RoundRow`, `PickRow`, `RunModel`
- src/watch/ledger.ts:202-218 — `parseHandoffPhaseRows`, one spec's `## Phase log` rows
- src/watch/ledger.ts:221-225 — `parseHandoffActiveSpec`
- src/watch/ledger.ts:227-238 — `parseTasks`
- src/watch/ledger.ts:245-460 — `buildModel`: scoped to the last `run.start` at 256-261, live phase 271-281, spawns 283-317, ticker of four at 454
- src/watch/index.ts:34-39 — `handoffPath`
- src/watch/index.ts:42-56 — `resolveSpec`: flag, HANDOFF header, else newest ledger

## Core (src)
- src/core/index-generator.ts:40-45 — `SpecSnapshot`
- src/core/index-generator.ts:59-91 — `IndexGenerator.snapshot`, read-only categorize and route
- src/core/spec-routing-deriver.ts:8-30 — `RoutingState`, `RoutingDecision`
- src/types.ts:126-136 — `SpecIndexEntry`
- src/types.ts:310-330 — `Deferral`, no owner or blocks field
- src/tools/approvals.ts:440-447 — approval deeplink to `/approvals?id=`

## Harness formats (harness)
- harness/skills/sdd-continue/references/formats.md:29 — `PHASE:` values
- harness/skills/sdd-continue/references/formats.md:192-204 — ledger event types and keys
- harness/skills/sdd-implementation-phase/SKILL.md:80-82 — gate note text `gate: task N pass|fail risk low|high`
- harness/skills/sdd-continue/SKILL.md:218-230 — retro routing by `retrospective-plan.md` status
- harness/skills/sdd-continue/SKILL.md:482-487 — gate A record mode HANDOFF row
- harness/skills/sdd-continue/SKILL.md:513-516 — gate B record mode writes a HANDOFF row, no ledger `phase.end`
- harness/skills/sdd-continue/SKILL.md:538-546 — `Status: DRAFT — decisions needed` and `Status: APPROVED` plan headers
- harness/skills/sdd-retrospective/SKILL.md:94-95 — `DECISION NEEDED: yes` line count

## Tests, checks and docs
- vitest.config.ts:7-8 — vitest includes `src/**` and excludes the frontend
- package.json:26 — `build` runs `validate:i18n`, `tsc` and the dashboard build
- .github/workflows/ci.yml:38-39 — CI unit tests; no Playwright step
- scripts/validate-i18n.js:43-78 — interpolation consistency across locales
- scripts/validate-i18n.js:88-90 — eleven supported locales
- e2e/batch-approvals.spec.ts:6-12 — drives the Approvals page
- e2e/worktree-no-shared.spec.ts:15-20 — drives the project dropdown
- e2e/worktree-no-shared.spec.ts:87-118 — drives the Specs and Approvals pages
- docs/SDD-HARNESS.md:261-339 — `## Dashboard control pane` (Harness and Overview pages)
- docs/USER-GUIDE.md:171-198 — approval and adversarial review steps that name the Approvals and Adversarial Analysis pages

## Design-phase additions — harness server modules
- src/dashboard/harness/hub.ts:124-132 — `onLaunchUpdate` and `onProjectsUpdate` refresh the overview watch only
- src/dashboard/harness/overview-watch.ts:325-339 — `flush`, `pushRows`, `pushTodos`: the overview watch's only send points
- src/dashboard/harness/run-setup.ts:99-109 — `readRunFile`: `harness-run.json`, null when missing or unparsable
- src/dashboard/harness/launcher.ts:208-235 — `restore`: launch records reloaded from disk at dashboard start

## Design-phase additions — dashboard server
- src/dashboard/multi-server.ts:391-398 — `projects-update` broadcast to every client
- src/dashboard/multi-server.ts:401-431 — `spec-change` debounced `spec-update` broadcast to one project's clients
- src/dashboard/multi-server.ts:2246-2249 — launch admission refusal: 409 with `runId`, `reason`, `pid`
- src/dashboard/multi-server.ts:2286-2299 — `harnessNotLaunchable`
- src/dashboard/multi-server.ts:2301-2313 — `broadcastToAll`
- src/dashboard/project-manager.ts:11-23 — `ProjectContext` (translated `projectPath`, original `workflowRootPath`)
- src/dashboard/project-manager.ts:246-258 — `getProjectsList`
- src/dashboard/watcher.ts:150-156 — change dispatch: deferral, spec, steering
- src/dashboard/watcher.ts:163-195 — `handleSpecChange`: emits `change` for any spec markdown file
- src/dashboard/parser.ts:27-45 — `getAllSpecs`: one entry per spec directory
- src/core/deferral-storage.ts:266 — `DeferralStorage.list` with `status`/`originSpec`/`tag` filters

## Design-phase additions — run model
- src/watch/ledger.ts:18-36 — `LedgerEvent`, `ActivityEvent`
- src/watch/ledger.ts:186-199 — `parseJsonl`, torn-line skip
- src/watch/ledger.ts:256-261 — current-run scoping to the last `run.start`
- src/watch/index.ts:34-39 — `handoffPath`: inside the workflow root, else beside it

## Design-phase additions — frontend
- src/dashboard_frontend/src/main.tsx:16-18 — `HashRouter` around `App`
- src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:13-30 — theme in `localStorage`, dark by default
- src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:25-57 — sound on/off and volume state in `localStorage`
- src/dashboard_frontend/src/modules/harness/types.ts:1-7 — wire types copied by hand from the server
- src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:103-125 — `fetchSetup`: form initialised from view defaults, not the saved file
- src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:211-244 — `buildInput` and `runOp`: save, launch, stop calls
- tsconfig.json:20 — root `tsc` excludes `src/dashboard_frontend/**`

## Design-phase additions — tests and probes
- src/dashboard/__tests__/harness-routes.test.ts:267-291 — live-server overview test: gate-a append seen within five seconds
- playwright.worktree.config.ts:39-61 — worktree e2e web servers and their env
- playwright.worktree-pattern.ts:21 — `WORKTREE_SPEC_PATTERN`
- e2e/worktree-shared.spec.ts:401-405 — API-only spec list checks, no page selectors
- node_modules/tailwindcss/theme.css:281 — probe (tailwindcss 4.1.18): `--breakpoint-xl: 80rem`
- node_modules/react-router/dist/lib/hooks.d.ts:79 — probe (react-router 6.30.3): `useParams`

## Tasks-phase additions — server
- src/dashboard/harness/hub.ts:34-43 — hub constructor: `sendHarness`/`sendOverview` callbacks, `launch-update` and `projects-update` listeners
- src/dashboard/harness/hub.ts:113-122 — hub `close`: removes listeners, closes every watch
- src/dashboard/harness/overview-watch.ts:44-48 — private `isInside` (target strictly inside dir)
- src/dashboard/harness/overview-watch.ts:243-246 — private `pointerForProject`: first pointer line inside the project's specs dir
- src/dashboard/harness/overview-watch.ts:319-323 — overview watch debounce: resetting `setTimeout`
- src/dashboard/harness/project-watch.ts:83-102 — `readIfExists` via fd read, undefined on error
- src/watch/ledger.ts:263-269 — phase rows: HANDOFF rows plus ledger `phase.end` rows not already present
- src/watch/ledger.ts:411-413 — `RoundRow` from current-run `round` rows
- src/watch/ledger.ts:423 — `task.done` ticker text reads the `rounds` key
- src/watch/ledger.ts:428 — `note` text key is `text`, else `note`
- src/dashboard/multi-server.ts:120 — hub overview send lambda typed `HarnessMessage`
- src/dashboard/multi-server.ts:497-501 — `deferral-change` sends `deferrals-update` through `broadcastToProject`
- src/dashboard/multi-server.ts:563-578 — project info route returns `version`
- src/core/gate-rules.ts:31 — `RISK_LINE_THRESHOLD = 200`

## Tasks-phase additions — frontend
- src/dashboard_frontend/src/modules/app/App.tsx:9-28 — imports of the legacy pages, dropdown, sidebar and header parts
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:66-156 — `connectToWebSocket`: URL with optional `projectId`, re-subscribe on open, backoff, type dispatch
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:159-177 — connect only when a `projectId` is set
- src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:27 — `useApi` for approvals, specs and task progress
- src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:127-181 — `handleTaskUpdate`
- src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:210-219 — mount effect seeding task data from specs
- src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:221-297 — `task-status-update` subscription effect
- src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:10-29 — `callHarness`: fetch that keeps a non-ok body
- src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:186-209 — task-review summary poll, only in implementation
- src/dashboard_frontend/src/modules/pages/OverviewPage.tsx:49-75 — overview view hold, row/to-do handlers, 1 s tick
- src/dashboard_frontend/src/modules/pages/DeferralsPage.tsx:1-80 — status filter, single-project load and push handler
- src/dashboard_frontend/src/modules/harness/types.ts:193-203 — frontend `HarnessMessage` and `ViewMessage` copies
- src/dashboard_frontend/src/modules/modals/ChangelogModal.tsx:28-36 — project changelog route, else the global one
- src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:13-30 — theme toggle and `localStorage` key `theme`

## Tasks-phase additions — tests, e2e and checks
- src/dashboard/harness/__tests__/project-watch.test.ts:313-318 — `ofType` message filter
- src/dashboard/harness/__tests__/project-watch.test.ts:355-376 — `makeProject`, `writeMinimalFixture`, `stubLauncher`
- src/dashboard/harness/__tests__/project-watch.test.ts:378-418 — model and gates messages equal the pure builders
- src/dashboard/harness/__tests__/project-watch.test.ts:622-641 — no send after `close()`
- src/dashboard/__tests__/harness-routes.test.ts:104-141 — `waitFor`, `connect`, `collect`, `send` helpers
- src/dashboard/__tests__/harness-routes.test.ts:153-202 — two-project live server fixture with temp `XDG_STATE_HOME`
- e2e/worktree-no-shared.spec.ts:23-63 — two-worktree harness setup and cleanup
- e2e/worktree-no-shared.spec.ts:65-119 — dropdown, specs-isolation and approvals tests
- e2e/helpers/worktree-harness.ts:162-180 — `HarnessWorktree` with `writeFile` and `mkdirp`
- playwright.worktree.config.ts:8-11 — shared `SPEC_WORKFLOW_HOME` set in the config process
- playwright.config.ts:13 — default config ignores the worktree pattern
- scripts/validate-i18n.js:127-131 — interpolation check only across locales holding a key
- .github/workflows/ci.yml:38-39 — CI runs `npm test -- --run`
- node_modules/tailwindcss/theme.css:281 — probe (tailwindcss 4.1.18): `--breakpoint-lg: 64rem`
- harness/skills/sdd-continue/SKILL.md:218-225 — retrospective blocked unless every evidence line is `passed`
- README.md:28 — Implementation Logs listed as a feature
