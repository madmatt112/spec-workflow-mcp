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

## Design-phase additions: dashboard server (src/dashboard)
- src/dashboard/multi-server.ts:56-60 — `WebSocketConnection` (socket, single `projectId`, `isAlive`)
- src/dashboard/multi-server.ts:91 — `SPEC_BROADCAST_DEBOUNCE_MS` = 300
- src/dashboard/multi-server.ts:184-192 — global `onRequest` hooks: security headers, rate limiter, audit logger
- src/dashboard/multi-server.ts:252-260 — per-connection cleanup on close, error, disconnect, end
- src/dashboard/multi-server.ts:263-293 — the `message` handler, only `subscribe` is understood
- src/dashboard/multi-server.ts:509-514 — route pattern: unknown project gives 404
- src/dashboard/multi-server.ts:804-909 — adversarial-review route, the existing route that spawns `claude`, 409 on in-flight
- src/dashboard/multi-server.ts:2153-2166 — `scheduleConnectionCleanup`, the second client-removal path
- src/dashboard/multi-server.ts:2247-2289 — `stop()`, calls both runners' `shutdown()` at 2271-2272
- src/dashboard/adversarial-runner.ts:185-189 — the per-job SIGTERM timeout (constant is 15 min, message says 10)
- src/dashboard/project-manager.ts:239-241 — `getAllProjects`
- src/dashboard/__tests__/multi-server.test.ts:80-92 — server test setup: temp `SPEC_WORKFLOW_HOME`, registry entry, stubbed fetch, real `start()`

## Design-phase additions: index and watch (src/core, src/watch)
- src/core/index-generator.ts:66-72 — categorize, route, render, then the INDEX.md write
- src/core/index-generator.ts:133-157 — `categorize`, the active, deferred and other buckets
- src/types.ts:126-136 — `SpecIndexEntry`
- src/watch/ledger.ts:38-44 — `AgentProfile`
- src/watch/ledger.ts:294 — orchestrator rule: agent name ends `-orchestrator`
- src/watch/render.ts:192-238 — `agentLines`, declared model and effort from `AGENT_PROFILES`, actual model and provider

## Design-phase additions: frontend (src/dashboard_frontend)
- src/dashboard_frontend/src/modules/app/App.tsx:226-237 — page shell and `main` padding
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:8-13 — context shape (`connected`, `initial`, `subscribe`, `unsubscribe`), no send
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:88-113 — `onmessage`: `initial`, global `projects-update`, else project-scoped by `projectId`
- src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx:44-59 — `navigationItems` entry shape (path, labelKey, icon)
- src/dashboard_frontend/src/modules/api/api.tsx:116-137 — `getJson`, `postJson`, `postJsonWithData` fetch helpers
- src/dashboard_frontend/src/i18n.ts:80 — `fallbackLng: 'en'`
- scripts/validate-i18n.js:43-78 — build-time check: interpolation variables consistent across locales only
- vitest.config.ts:7-8 — vitest includes `src/**` tests and excludes the frontend

## Design-phase additions: harness supervisor and phase skills (harness)
- harness/skills/sdd-continue/SKILL.md:35-37 — supervisor model preflight (Opus 5.5 or Fable 5.1)
- harness/skills/sdd-continue/SKILL.md:138-152 — by-hand routing for pending retro or close-out and the decomposition fallback
- harness/skills/sdd-continue/SKILL.md:237-260 — orchestrator launch prompt lines
- harness/skills/sdd-continue/references/formats.md:75-76 — HANDOFF header fields (active spec, live phase, state, last result)
- harness/skills/sdd-continue/references/formats.md:170-183 — `event.sh`, the ledger row shape at 178
- harness/skills/sdd-continue/references/formats.md:218-247 — `launch.sh` wrapper, `SDD_PROVIDERS` at 236
- harness/skills/sdd-continue/references/formats.md:249-282 — `deregister.mjs`, filter on field 3, temp file plus rename
- harness/skills/sdd-continue/references/sdd-providers.sh:42 — `## Providers` row grammar
- harness/skills/sdd-continue/references/sdd-providers.sh:54-75 — eligibility, provider, model and key checks, output value
- harness/skills/sdd-document-phase/SKILL.md:24-34 — worker spawn rule and DeepSeek launcher exception
- harness/skills/sdd-implementation-phase/SKILL.md:26-28 — worker spawn rule
- harness/skills/sdd-closeout-phase/SKILL.md:28-29 — worker spawn rule
- harness/skills/sdd-retrospective/SKILL.md:17-18 — analyst spawn rule
- src/__tests__/providers-map.test.ts:1-30 — `execFileSync` test pattern for `sdd-providers.sh`
- docs/SDD-HARNESS.md:244-251 — headless command and the model refusal note

## Tasks-phase additions: server, watch and tests (src)
- src/watch/index.ts:7-9 — `WatchOptions.workflowRoot`, the directory ending in `.spec-workflow`
- src/dashboard/multi-server.ts:62-68 — `MultiDashboardOptions`, the options the constructor takes
- src/dashboard/multi-server.ts:93-118 — constructor, creates the manager, scheduler and both runners
- src/dashboard/multi-server.ts:300-320 — event setup, route registration, port check and `listen` at 317
- src/dashboard/multi-server.ts:872-876 — a runner in-flight error mapped to 409
- src/dashboard/__tests__/multi-server.test.ts:74-107 — per-test temp global dir, stubbed fetch, `start()` and `stop()`
- src/__tests__/providers-map.test.ts:17-34 — script path and the `execFileSync` run helper
- src/__tests__/providers-map.test.ts:45-65 — temp dir, key and no-key env, rules-file writer
- tsconfig.json:20 — the root compile excludes the frontend
- package.json:26-33 — `build`, `build:dashboard` and `validate:i18n` scripts

## Tasks-phase additions: frontend (src/dashboard_frontend)
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:59-63 — `onopen`, resets the retry delay
- src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:154-159 — the context value
- src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx:12-17 — `NavigationItem` shape
- src/dashboard_frontend/src/modules/api/api.tsx:139-142 — `putJson`, returns null data on a non-ok response
- src/dashboard_frontend/src/locales/en.json:5-15 — the `nav` label keys

## Tasks-phase additions: harness (harness)
- harness/skills/sdd-continue/references/sdd-providers.sh:1-20 — header comment pattern for a reference script
- harness/skills/sdd-continue/references/sdd-providers.sh:31-41 — `none()` and `bad()`, short-circuits at 33, 35 and 41
- harness/skills/sdd-continue/references/sdd-providers.sh:66-77 — zero-row short-circuit, key check (exit 3), output, argument pass
- harness/skills/sdd-continue/SKILL.md:175-182 — retrospective blocked while an evidence line is not `passed`
- harness/skills/sdd-implementation-phase/references/briefs.md:12-15 — spec-store commits through a script that changes directory
- docs/SDD-HARNESS.md:253 — `## Workspace contract`, the heading after the headless command
