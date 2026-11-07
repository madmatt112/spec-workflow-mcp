# Codebase context — decisions-and-launch-guard

## Project names (registry and durable list)
- src/core/project-registry.ts:14-20 — `ProjectRegistryEntry`, holds `projectName`
- src/core/project-registry.ts:130-139 — `generateProjectDisplayName`, the `repo · worktree` name
- src/core/project-registry.ts:234 — read path, fills a missing `projectName` with the generated name
- src/core/project-registry.ts:354-393 — `registerProjectLocked`, overwrites `projectName` on each registration (:360, :376)
- src/core/project-registry.ts:118-123 — `generateProjectId`, id is a hash of the path, not the name
- src/controller/state.ts:256-266 — `KnownProject`, the `projects.json` row with `name`
- src/controller/state.ts:619-628 — `rememberProject`, replaces a row by id
- src/dashboard/project-manager.ts:127 — a remembered project with no registry entry takes `name`
- src/dashboard/project-manager.ts:145 — sync copies `entry.projectName` onto the live context
- src/dashboard/project-manager.ts:235 — `addProject` remembers the name
- src/dashboard/project-manager.ts:302 — `getProjectsList`, `projectPath` is the workspace path (the code root)
- src/dashboard/multi-server.ts:507-508 — `GET /api/projects/list`
- src/advisor/push.ts:88-96 — push text reads the name from `projects.json`
- src/dashboard_frontend/src/modules/shell/HomePage.tsx:59-62 — id-to-name lookup for tiles
- src/dashboard_frontend/src/modules/shell/Gear.tsx:82 — gear list shows `projectName`
- src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280 — `actionTarget`, prints raw `target.project`
- src/advisor/actions.ts:402-411 — `execLaunch`, `target.project` is a project id

## Launch and the Next tile
- src/dashboard/multi-server.ts:105-132 — `launchSpec`, shared by the route and the advisor
- src/dashboard/multi-server.ts:620-626 — `GET .../harness/setup`
- src/dashboard/multi-server.ts:637-646 — `POST .../harness/launch`
- src/dashboard/harness/run-setup.ts:150-224 — `buildSetupView`, reads only `project.projectPath` (the store)
- src/dashboard/harness/run-setup.ts:230-239 — `nextUnstartedSpec`, a launchable spec may have no directory
- src/controller/controller.ts:232-272 — `enqueue`, one run per store; `codeRoot` is `project.workspacePath` (:259)
- src/core/task-parser.ts:332-345 — `File:` line parsing
- src/dashboard_frontend/src/modules/projects/stores.ts:15-22 — `pickRepresentative`, prefers the project that is the store
- src/dashboard_frontend/src/modules/shell/board.ts:61-76 — `nextProjects`, one project per store group
- src/dashboard_frontend/src/modules/shell/board.ts:78-88 — `nextTiles`, sort order
- src/dashboard_frontend/src/modules/shell/useNextViews.ts:1-61 — setup fetch per tracked project, 30 s poll
- src/dashboard_frontend/src/modules/shell/tiles.tsx:245-273 — `NextTile`
- src/dashboard_frontend/src/modules/shell/tiles.tsx:224-234 — Discard two-press pattern
- src/dashboard_frontend/src/modules/shell/harness.tsx:40-52 — `buildLaunchInput`
- src/dashboard_frontend/src/modules/shell/HomePage.tsx:180-196 — Next band

## Close-out
- src/controller/phases/closeout.ts:262-266 — `openItems`, classes each plan item
- src/controller/phases/closeout.ts:274-282 — `closeoutLine`
- src/controller/phases/closeout.ts:362-375 — Step 1, class `none` items, the `no change chosen` fallback (:372)
- src/controller/phases/closeout.ts:404 — `itemsText`, the batch brief text, item block only
- src/controller/phases/closeout.ts:629-634 — final item lines per batch
- src/tools/harness.ts:488-517 — `parsePlanItems`
- src/tools/harness.ts:520-534 — `parseCloseoutDone`
- src/tools/harness.ts:541-561 — `classifyTarget`, reads `Target:` only (:542)
- src/controller/runs.ts:340-363 — `buildRetroPlanMarkdown`, writes `## Decisions` lines

## Implementation fix rounds
- src/controller/phases/implementation.ts:805-806 — gate call with `task.files`
- src/controller/phases/implementation.ts:826-842 — P8 unchanged-commit `file-outside-list` escalation
- src/controller/phases/implementation.ts:858-871 — gate result routing, verifier at high risk
- src/controller/phases/implementation.ts:880-893 — round count, cap, adjudicator
- src/controller/phases/implementation.ts:921-947 — `routeImplementerFlags`, `REQUIRED` stops as design defect (:929-936)
- src/controller/phases/implementation.ts:361-363 — `setTask`, edits `tasks.md` in place
- src/core/gate-rules.ts:520-530 — `file-outside-list` reason
- src/tools/brief-templates.ts:797-807 — round 1 fix brief text on `REQUIRED`
- harness/agents/sdd-implementer.md:31 — agent rule on `REQUIRED`
- harness/evals/implementer-file-outside-list-classify/case.json:29 — eval asserts the `REQUIRED:` prefix

## Document review loop
- src/controller/phases/document.ts:201-206 — `shouldStop`, documented as operator hold only
- src/controller/phases/document.ts:253-265 — `REVIEWER_SCHEMA`, findings are plain strings
- src/controller/phases/document.ts:475-500 — `narrowCheck`
- src/controller/phases/document.ts:813-929 — the review round loop
- src/controller/phases/document.ts:861-864 — escalate return
- src/controller/phases/document.ts:885-888 — converged approve
- src/controller/phases/document.ts:892-903 — SHOULD_FIX-only corrective pass, needs `D >= 2`
- src/tools/adversarial-review.ts:318-325 — `HARNESS_VERDICT_SECTION`, severity rules

## Cancel and the run driver
- src/controller/controller.ts:90 — `cancelled`, an in-memory set
- src/controller/controller.ts:283-288 — `Controller.cancel`
- src/controller/controller.ts:562-575 — `isStartable`
- src/controller/controller.ts:611-638 — `openCrashWait`, already skips a cancelled run
- src/controller/controller.ts:661-665 — an `abandon` answer calls cancel
- src/controller/runs.ts:418-423 — `stopReason`, cancel first
- src/controller/runs.ts:566-571 — `save`, spreads the caller's record
- src/controller/runs.ts:590-599 — `waitAnd`
- src/controller/runs.ts:849-851 — `runOnce` entry, sets `running`
- src/controller/runs.ts:866-868 — loop-top stop
- src/controller/runs.ts:989 — document `shouldStop`, pause only
- src/controller/runs.ts:1136-1139 — close-out error wait
- src/controller/runs.ts:1261-1265 — implementation error wait
- src/controller/runs.ts:1288-1291 — retrospective error wait
- src/controller/runs.ts:1331-1358 — document retry and error wait, no cancel check
- src/controller/runs.ts:1380-1400 — `cancelRun`
- src/controller/runs.ts:1410-1436 — `discardRun`, deletes the branch and closes the PR by name
- src/controller/runs.ts:1482-1488 — `branchHeld`, sees moving runs only
- src/controller/state.ts:431-435 — `writeRunLocked`, no guard on `abandoned`
- src/controller/state.ts:512-513 — heartbeat write skips a terminal run
- src/controller/phases/document.ts:401 — `runStep` call
- src/controller/phases/implementation.ts:472 — `runStep` call
- src/controller/phases/retrospective.ts:169 — `runStep` call
- src/controller/phases/closeout.ts:319 — `runStep` call
- src/controller/merge-fix.ts:229 — `runStep` call

## Board and run tiles
- src/controller/runs.ts:1490-1511 — `toRow`, the wire row from the run record
- src/dashboard_frontend/src/modules/shell/types.ts:115-150 — `ControllerRun`, has `phase`
- src/dashboard_frontend/src/modules/shell/board.ts:35-44 — `MOVING_STATUSES`, `stoppedAdmitted`
- src/dashboard_frontend/src/modules/shell/board.ts:46-59 — `running`, moving plus stopped
- src/dashboard_frontend/src/modules/shell/board.ts:90-94 — `ageTone`
- src/dashboard_frontend/src/modules/shell/board.ts:96-104 — `runDot`
- src/dashboard_frontend/src/modules/shell/board.ts:109-117 — `isStalled`
- src/dashboard_frontend/src/modules/shell/board.ts:119-132 — `runControls`
- src/dashboard_frontend/src/modules/shell/tiles.tsx:33-47 — `Tile`, sets `data-tone`
- src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79 — `WaitTile` age tone
- src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150 — `RunTile` age tone
- src/dashboard_frontend/src/modules/shell/tiles.tsx:165-174 — step kind, task and step age
- src/dashboard_frontend/src/modules/shell/tiles.tsx:308-309 — `ActionTile` age tone
- src/dashboard_frontend/src/modules/shell/HomePage.tsx:18-39 — `Band`
- src/dashboard_frontend/src/modules/shell/HomePage.tsx:163-179 — Running band
- src/dashboard_frontend/src/modules/ui/ui.tsx:132-136 — `TILE_TONE`
- src/dashboard/shell/__tests__/board-view.test.ts:1-1888 — board and tile unit tests

## Top bar
- src/dashboard_frontend/src/modules/shell/TopBar.tsx:27-48 — `TopBar`, `items-center` row
- src/dashboard_frontend/src/modules/shell/DeployControl.tsx:57 — the `mb-3` wrapper

## Rules
- .spec-workflow/agent-rules.md:24-39 — `## Checks`
- src/dashboard/harness/run-setup.ts:72-141 — `readAgentRules`, the machine-read keys
