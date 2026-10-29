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
