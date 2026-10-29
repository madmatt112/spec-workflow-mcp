# Codebase context — dashboard-project-list

## MCP process registry (`activeProjects.json`)
- src/core/project-registry.ts:118-123 — `generateProjectId`, realpath-normalized SHA-1 of the workspace path.
- src/core/project-registry.ts:130-139 — `generateProjectDisplayName`, "repo" or "repo · worktree" from the two paths.
- src/core/project-registry.ts:207-263 — `readRegistry`, resolve-only read, no filesystem check per entry.
- src/core/project-registry.ts:317-337 — `registerProject`, locked read-modify-write; continues unregistered on lock timeout.
- src/core/project-registry.ts:354-393 — `registerProjectLocked`, one entry per workspace id, instances by pid.
- src/core/project-registry.ts:421-441 — `unregisterProjectById`, drops one pid or the whole entry.
- src/core/project-registry.ts:474-504 — `cleanupStaleProjects`, the startup pass; removes dead pids only, never checks paths.
- src/core/global-dir.ts:40-51 — `getGlobalDir`, `SPEC_WORKFLOW_HOME` else `~/.spec-workflow-mcp`.
- src/server.ts:185-195 — the MCP server registers its workspace with its workflow root at startup.
- src/server.ts:280-306 — `stop`, unregisters its own pid by the cached id (skipped in Docker mode).

## Dashboard project set
- src/dashboard/project-manager.ts:11-22 — `ProjectContext`, one per listed project, with parser, watcher and approval storage.
- src/dashboard/project-manager.ts:39-57 — `initialize`: registry cleanup, registry load, remembered load, registry watcher.
- src/dashboard/project-manager.ts:77-92 — `loadRememberedProjects`; adds every remembered project, no existence check (comment says skipped).
- src/dashboard/project-manager.ts:134-176 — `syncWithRegistry`, on registry file change; keeps remembered projects with no instances.
- src/dashboard/project-manager.ts:181-256 — `addProject`; remembers only when workspace equals workflow root (:240-249).
- src/dashboard/project-manager.ts:301-313 — `getProjectsList`, the `/api/projects/list` and `projects-update` payload; no workflow root on it.
- src/dashboard/project-manager.ts:323-384 — `addProjectByPath`; explicit store root is remembered even when paths differ.
- src/dashboard/project-manager.ts:389-393 — `removeProjectById`, unregister and forget.
- src/dashboard/approval-storage.ts:204-227 — approval file candidates: workspace base first, then the shared store.
- src/core/path-utils.ts:108 — `PathUtils.translatePath`, host-to-container path translation for Docker.

## Controller state (`projects.json`, runs, waits)
- src/controller/state.ts:56-64 — `RunStatus`.
- src/controller/state.ts:66-101 — `RunRecord`; `project` is the launch project id, `updated` is ISO.
- src/controller/state.ts:228-244 — `KnownProject` and `ProjectsFile` (`projects.json`).
- src/controller/state.ts:451-474 — `readProjects`, `rememberProject`, `forgetProject`.
- src/controller/controller.ts:147-181 — `enqueue`; one live run per project and per store (:159-162).
- src/controller/runs.ts:1336-1369 — `ControllerRunRow`, `toRow`, `listRunsForWire` (every run, newest first).
- src/controller/waits.ts:201-203 — `listWaitsForWire`, every wait record minus `specDir`.

## Eval harness
- src/evals/fixture.ts:37-82 — `buildFixture`, a git repo at `mkdtemp(eval-fixture-)/repo`.
- src/evals/fixture.ts:85-87 — `disposeFixture`, deletes the mkdtemp parent.
- src/evals/runner.ts:42-49 — `RunCasesOpts`, with an injectable `step`.
- src/evals/runner.ts:179-198 — step call; inline MCP config starts `dist/index.js` on the fixture root, no env override.

## Shell feed (server side of the sidebar)
- src/dashboard/shell/shell-feed.ts:84-142 — `flush`; spec rows built once per listed project (:94-101).
- src/dashboard/shell/live-runs.ts:10-18 — `liveRunsByProject`, newest non-done, non-abandoned run per project.
- src/dashboard/shell/now-model.ts:91-176 — `collectProject`, waits, live, idle, closed and runs rows per project.
- src/dashboard/shell/now-model.ts:186-219 — `buildNowModel` over every listed project.
- src/dashboard/shell/spec-rows.ts:78-99 — `buildSpecRows`, one row per spec directory of the project's store.
- src/dashboard/shell/types.ts:71-83 — `SpecListRow`.
- src/dashboard/shell/types.ts:149-163 — `ControllerWait` wire shape (`project`, `state`).
- src/dashboard/shell/types.ts:186-202 — `ControllerRun` wire shape (`project`, `status`, `updated`).
- src/dashboard/multi-server.ts:441-456 — `deferral-change` broadcast per project.
- src/dashboard/multi-server.ts:464-473 — `buildDeferralsPayload`, per store path.
- src/dashboard/multi-server.ts:515-517 — `GET /api/projects/list`.
- src/dashboard/multi-server.ts:547-555 — `DELETE /api/projects/:projectId`.
- src/dashboard/multi-server.ts:576-583 — `GET /api/projects/:projectId/deferrals`.

## Sidebar (frontend)
- src/dashboard_frontend/src/modules/shell/Sidebar.tsx:35-100 — `SidebarContent`, nav items and project rows.
- src/dashboard_frontend/src/modules/shell/Sidebar.tsx:39-44 — nav counts; Specs and Deferrals summed per project.
- src/dashboard_frontend/src/modules/shell/Sidebar.tsx:79-92 — project rows: toggle and name, in list order.
- src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:8-13 — frontend `Project` shape.
- src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:40-101 — polls `/api/projects/list` every 2.5 s; toggle in localStorage.
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:123-138 — fetches deferrals once per listed project.
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:27 — `CTRL_LIVE_STATUSES`.
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:241-280 — open controller waits plus derived waits make the "Waiting on you" count.

## Tests
- src/core/__tests__/project-registry.test.ts:1-380 — registry unit tests.
- src/dashboard/__tests__/project-manager-durable.test.ts:1-223 — durable list, worktree-not-remembered case.
- src/dashboard/__tests__/projects-add-route.test.ts:1-160 — manual add route.
- src/controller/__tests__/state.test.ts:1-258 — state records.
- src/evals/__tests__/fixture.test.ts:1-237 — fixture build and dispose.
- src/evals/__tests__/runner.test.ts:1-352 — runner with a stub step.
- src/dashboard/shell/__tests__/shell-feed.test.ts:1-360 — shell feed.
- vitest.setup.ts:23-24 — per-worker `SDD_HOME` and `SPEC_WORKFLOW_HOME`.
- e2e/worktree-shared.spec.ts:370-414 — two worktree servers on one store register two entries and two listed projects (no main project registered).
- e2e/worktree-shared.spec.ts:748-795 — concurrent registration race on the registry file.
- e2e/worktree-shell.spec.ts:24 — nav order test ids.

## Prior spec
- .spec-workflow/specs/worktree-execution-context/requirements.md:43 — R1: a worktree registers as its own project.
- .spec-workflow/specs/worktree-execution-context/requirements.md:149-151 — R6: concurrent worktree registration keeps every entry.

## Git helpers (design phase)
- src/core/git-utils.ts:7-11 — `GIT_EXEC_OPTIONS`, every git call has a 5000 ms timeout.
- src/core/git-utils.ts:64-71 — `gitCapture`, trimmed stdout or null, never throws.
- src/core/git-utils.ts:101-112 — `normalizeIdentityPath`, realpath with absolute-path fallback.
- src/core/git-utils.ts:133-139 — `gitCommonDirAbsolute`, realpath of the resolved common dir.
- src/core/git-utils.ts:214-252 — `resolveGitRoot`, honours `SPEC_WORKFLOW_SHARED_ROOT` first.
- src/core/git-utils.ts:260-270 — `isGitWorktree`, raw common dir not equal to `.git`.

## Locks and atomic writes (design phase)
- src/core/registry-lock.ts:371-412 — `withRegistryLock`, exclusive lock file, returns `acquired` instead of throwing.
- src/controller/state.ts:302-304 — `projectsPath`, `projects.json` in the controller home.
- src/controller/state.ts:318-323 — `writeJsonAtomic`, temp file then rename.
- src/controller/state.ts:559-570 — `withStoreLock`, the registry lock reused as a per-path lock; throws on no lock.

## MCP server start and CLI (design phase)
- src/index.ts:37-65 — help text OPTIONS block.
- src/index.ts:164-177 — `CLI_FLAGS`, the single flag registry.
- src/index.ts:206-221 — `parseArguments` return shape.
- src/index.ts:662-668 — the `server.initialize` call in MCP server mode.
- src/server.ts:160-165 — `initialize` signature.
- src/server.ts:185-195 — registration and the registered/not-registered log line.
- src/server.ts:280-306 — `stop`; unregisters only when `registeredProjectId` is set (:289).

## Eval step seam (design phase)
- src/controller/step.ts:113-114 — `StepSpec.mcpConfig`, path or inline object.
- src/controller/step.ts:372-374 — `--mcp-config` and `--strict-mcp-config` on the claude command.
- src/controller/step.ts:388-394 — step env: inherited env plus workspace and shared-root overrides.
- src/evals/runner.ts:141-147 — `runCases` options, `step` defaults to `runStep`.
- src/evals/runner.ts:190-197 — the inline MCP server entry: `process.execPath`, `dist/index.js`, fixture root.

## Frontend wire copies and pages (design phase)
- src/dashboard_frontend/src/modules/shell/types.ts:86-93 — frontend `NowModel`.
- src/dashboard_frontend/src/modules/shell/types.ts:169-183 — frontend `ControllerWait`.
- src/dashboard_frontend/src/modules/shell/types.ts:207-223 — frontend `ControllerRun`.
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:100-102 — `deferrals-update` stored by project id.
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:257-264 — controller live runs, ledger live rows only for projects without one.
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:280 — `waitCount`, open controller waits plus derived waits.
- src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:82-144 — counts, items, groups and selection keyed by project id.
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:88-165 — counts, items, groups and selection keyed by project id.
- src/dashboard_frontend/src/modules/theme/tokens.css:86-97 — light tone tokens.
- src/dashboard_frontend/src/modules/theme/tokens.css:135-146 — dark tone tokens.

## Build and test config (design phase)
- tsconfig.json:4-5 — `module` and `moduleResolution` are `node16`.
- tsconfig.json:20 — root compile excludes `src/dashboard_frontend/**`.
- vitest.config.ts:9 — vitest excludes test files under `src/dashboard_frontend`.
- playwright.worktree.config.ts:46-70 — worktree e2e web servers with `SPEC_WORKFLOW_HOME` and `XDG_STATE_HOME`.

## Tests touched (design phase)
- src/dashboard/__tests__/project-manager-durable.test.ts:73-88 — worktree entry listed beside its main project (:87 expects 2).
- src/dashboard/__tests__/project-manager-durable.test.ts:103-117 — remembered project with a deleted dir stays remembered (:115).
- src/__tests__/server-shutdown.test.ts:1-147 — in-process `initialize` and `stop` against a temp registry.
- src/__tests__/index-args.test.ts:1-398 — CLI argument parsing.
- src/dashboard/shell/__tests__/now-model.test.ts:1-397 — Now model builder tests.
- e2e/worktree-shell.spec.ts:108 — shell e2e uses the no-shared harness (one store per worktree).
- e2e/worktree-shell.spec.ts:174 — seeds a controller `run.json` under the state home.
