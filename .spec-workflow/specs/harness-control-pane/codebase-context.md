# Codebase context — harness-control-pane

## Run model and TUI (src/watch)
- src/watch/ledger.ts:53-84 — `loadAgentProfiles` and `AGENT_PROFILES`, the declared model, effort and role per agent from `agent-profiles.json`
- src/watch/ledger.ts:87 — `PHASE_ORDER`, the phase rail order
- src/watch/ledger.ts:157-182 — `RunModel`, the shape the TUI renders (run header, phases, spawns, rounds, tasks, picks, ticker, tokens, providers)
- src/watch/ledger.ts:184-197 — `parseJsonl`, skips a torn tail line
- src/watch/ledger.ts:219-223 — `parseHandoffActiveSpec`, the HANDOFF routing header regex
- src/watch/ledger.ts:243-457 — `buildModel`, scopes to the last `run.start` and folds ledger, activity, `tasks.md` and HANDOFF into `RunModel`
- src/watch/index.ts:35-39 — `handoffPath`, HANDOFF inside the workflow root else beside it
- src/watch/index.ts:42-59 — `resolveSpec`, spec from flag, HANDOFF header, or newest ledger
- src/watch/index.ts:61-71 — `renderOnce`, reads the four inputs and calls `buildModel` then `render`
- src/watch/index.ts:101-104 — the chokidar watch of the four files with `awaitWriteFinish`
- src/watch/render.ts:60-190 — `render`, the TUI frame (header, providers line, phase rows, live phase, spawn tree, footer); not touched by this spec

## Dashboard server (src/dashboard)
- src/dashboard/multi-server.ts:70-117 — `MultiProjectDashboardServer` fields and constructor (project manager, adversarial runner, client set, localhost bind check)
- src/dashboard/multi-server.ts:203-295 — the `/ws` endpoint: per-connection `projectId`, `initial` and `projects-update` sends, `subscribe` message
- src/dashboard/multi-server.ts:337-344 — `projects-update` broadcast to all clients
- src/dashboard/multi-server.ts:419-426 — adversarial `job-update` forwarded to project clients
- src/dashboard/multi-server.ts:1931-1944 — per-task review list route, returns each review's `tdd` block
- src/dashboard/multi-server.ts:1965-1989 — task-review summary route, latest verdict and `tdd` block per task
- src/dashboard/multi-server.ts:2125-2137 — `broadcastToAll`
- src/dashboard/multi-server.ts:2139-2151 — `broadcastToProject`
- src/dashboard/adversarial-runner.ts:46-47 — job timeout and per-project concurrency constants
- src/dashboard/adversarial-runner.ts:156-220 — `runAgent`, spawns `claude --print` with scrubbed git env, `cwd` the workspace and both roots on the env
- src/dashboard/adversarial-runner.ts:222-234 — `cancelJob`, SIGTERM through `cleanupProcess`
- src/dashboard/adversarial-runner.ts:250-254 — `shutdown`, kills every child on dashboard stop
- src/dashboard/project-manager.ts:11-23 — `ProjectContext`, workflow root and workspace paths per registered project
- src/dashboard/project-manager.ts:71-93 — `startRegistryWatcher`, chokidar on the registry file
- src/dashboard/project-manager.ts:140-202 — `addProject`, builds parser, watcher and approval storage per project and forwards their events
- src/dashboard/project-manager.ts:232-258 — `getProject`, `getAllProjects`, `getProjectsList`

## Core helpers (src/core)
- src/core/git-utils.ts:5-6 — `SPEC_WORKFLOW_SHARED_ROOT` and `SPEC_WORKFLOW_WORKSPACE` env names
- src/core/git-utils.ts:45-51 — `scrubbedGitEnv`, process env minus the git location variables
- src/core/project-registry.ts:141-151 — `ProjectRegistry`, `activeProjects.json` in the global dir
- src/core/global-dir.ts:40-51 — `getGlobalDir`, `SPEC_WORKFLOW_HOME` else `~/.spec-workflow-mcp`
- src/core/index-generator.ts:44-82 — `IndexGenerator.generate`, categorizes specs in decomposition order, derives routing, writes INDEX.md
- src/core/spec-routing-deriver.ts:20-30 — `RoutingDecision` shape
- src/core/spec-routing-deriver.ts:63-139 — `deriveRouting`, the active-spec rule the supervisor follows

## Dashboard frontend (src/dashboard_frontend)
- src/dashboard_frontend/src/modules/app/App.tsx:239-251 — the page routes
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:26-57 — one websocket per selected project, `projectId` query parameter

## Harness supervisor and formats (harness)
- harness/agent-profiles.json:1-80 — thirteen agents with declared model, effort, role and cache lifetime
- harness/skills/sdd-continue/SKILL.md:85-96 — `sdd-providers.sh` preflight, `PROVIDERS` value, refusal before any ledger row
- harness/skills/sdd-continue/SKILL.md:100-129 — run id, `event.sh`, pointer line append, `run.start` keys
- harness/skills/sdd-continue/SKILL.md:226-228 — orchestrators spawned with no `model` parameter
- harness/skills/sdd-continue/SKILL.md:287-295 — model pre-flight: every orchestrator must be `claude-opus-4-8`
- harness/skills/sdd-continue/SKILL.md:336-345 — worktree rule; headless runs rely on the driver to place the worktree
- harness/skills/sdd-continue/SKILL.md:355-370 — gate mode resolution (`gates:` key, else AskUserQuestion availability)
- harness/skills/sdd-continue/SKILL.md:488-500 — status line, `run.end`, ledger commit, pointer line removal with `deregister.mjs`
- harness/skills/sdd-document-phase/SKILL.md:23-33 — workers spawned with no `model` parameter; DeepSeek workers through the launcher
- harness/skills/sdd-continue/references/formats.md:29-50 — `PHASE:` values and supervisor actions
- harness/skills/sdd-continue/references/formats.md:190-204 — ledger event types and keys
- harness/skills/sdd-continue/references/sdd-providers.sh:21-29 — eligible roles and allowed providers and DeepSeek models
- harness/hooks/sdd-activity.sh:1-12 — pointer file path and line format

## Docs
- docs/SDD-HARNESS.md:244-248 — the documented headless command
- docs/SDD-HARNESS.md:304-307 — `## Providers` section rules
