# Codebase context — project-bootstrap

## CLI entry
- src/index.ts:22-118 — `showHelp`, the usage text printed for `--help`
- src/index.ts:143-156 — `CLI_FLAGS`, the registry of every accepted flag
- src/index.ts:185-331 — `parseArguments`, rejects unknown `--` flags and takes the first non-flag argument as the project path
- src/index.ts:374-387 — `main` start: help check, then `parseArguments`
- src/index.ts:681-686 — the entrypoint guard that runs `main`
- src/__tests__/index-args.test.ts:45-398 — the argument-parsing tests

## Controller registration route and access
- src/dashboard/multi-server.ts:420-445 — `GET /api/health`, open without the secret
- src/dashboard/multi-server.ts:453-464 — `POST /api/projects/add`, body `{ projectPath }`, calls `addProjectByPath`
- src/dashboard/project-manager.ts:181-256 — `addProject`; remembers a project in `projects.json` only when workspace and store root are equal (240-249)
- src/dashboard/project-manager.ts:318-343 — `addProjectByPath`, derives the store root with `resolveGitRoot` in the controller's own environment
- src/controller/access.ts:25-28 — `secretPath`, the file `secret` in the controller home
- src/controller/access.ts:156-180 — `makeRequireAccess`, every mutating route needs `Authorization: Bearer` with the secret
- src/dashboard/__tests__/access-routes.test.ts:21-61 — access tests that hit `POST /api/projects/add`

## Harness home and project list
- src/controller/state.ts:206-222 — `KnownProject` and `ProjectsFile` (`projects.json`, `v: 1`)
- src/controller/state.ts:236-241 — `controllerHome`, `$SDD_HOME` or the state home's `sdd`
- src/controller/state.ts:280-282 — `projectsPath`
- src/controller/state.ts:425-448 — `readProjects`, `writeProjects`, `rememberProject`, `forgetProject`
- src/dashboard/harness/state-files.ts:26-29 — `sddHome`, the home resolution rule
- src/core/dashboard-session.ts:122-141 — `getDashboardSession`, reads `activeSession.json` and deletes it when the pid is dead
- src/core/global-dir.ts:40-51 — `getGlobalDir`, `SPEC_WORKFLOW_HOME` or `~/.spec-workflow-mcp`

## Store root resolution
- src/core/git-utils.ts:194-205 — `resolveGitWorkspaceRoot`, git top level of a path
- src/core/git-utils.ts:214-251 — `resolveGitRoot`, `SPEC_WORKFLOW_SHARED_ROOT` first, else the main checkout
- src/core/workspace-initializer.ts:18-62 — `WorkspaceInitializer`, makes the store directories and copies the document templates on server start
- src/markdown/templates/ — the templates the server ships (no agent-rules template at base)
- scripts/sync-store-templates.cjs:1-50 — copies `src/markdown/templates` into this repo's store templates at build

## Agent rules readers
- src/dashboard/harness/run-setup.ts:32-45 — `AgentRules`, the run-relevant keys
- src/dashboard/harness/run-setup.ts:68-137 — `readAgentRules`, parses `worktree-per-change`, `worktree-setup`, `merge-method`, `merge`, `post-merge`, providers
- src/core/gate-rules.ts:105-139 — `parseSensitivePaths`, `parseGeneratedPaths`, `parseProsePaths`, `parseAgentRuleKey`
- docs/SDD-HARNESS.md:246-270 — the agent-rules key table

## GitHub and the service
- src/controller/merge.ts:47-50 — `ghBin`, `CONTROLLER_GH_BIN` overrides `gh`
- scripts/sdd-service.sh:24-29 — `install` copies `GH_TOKEN`/`GITHUB_TOKEN` into `service.env`
- scripts/sdd-service.sh:33 — `PORT`, `SDD_PORT` or 5000
- scripts/sdd-service.sh:57-59 — `UNIT_DIR`, `SDD_HOME_DIR`, `ENV_FILE` (`service.env` in the home)
- scripts/sdd-service.sh:201-220 — `status`: unit status, `gh auth status` under the service env, `/api/health`
- scripts/stub-gh.mjs — the `gh` stub tests swap in
- scripts/sdd-service.sh:136-147 — `write_env_file`, the `KEY=value` lines of `service.env`
- src/controller/merge.ts:150-172 — `runCommand`, the `execFile` wrapper with timeout

## CLI entry (design additions)
- src/index.ts:120-125 — `expandTildePath`, private `~` expansion
- src/index.ts:378-384 — the help check in `main`, before `parseArguments`
- src/index.ts:400-406 — watch mode, the dynamic-import branch pattern
- src/__tests__/index-args.test.ts:9-17 — partial `vi.mock` of `git-utils.js`
- src/__tests__/index-args.test.ts:391-396 — `showHelp` assertions (`toContain`)
- src/__tests__/workspace-roots.test.ts:514-517 — tsx loader resolution for child-process tests

## Project registry and durable list
- src/core/project-registry.ts:118-123 — `generateProjectId`, hash of the realpath workspace
- src/core/project-registry.ts:317-337 — `registerProject`, under the registry lock
- src/core/project-registry.ts:354-393 — `registerProjectLocked`, updates an existing entry in place by id
- src/core/project-registry.ts:454-459 — `getProject`, by workspace path
- src/dashboard/project-manager.ts:77-92 — `loadRememberedProjects`, lists `projects.json` entries at start
- src/dashboard/project-manager.ts:161-169 — `syncWithRegistry` keeps remembered projects with no instances
- src/controller/state.ts:425-427 — `readProjects`
- src/controller/state.ts:434-441 — `rememberProject`, replaces by id, sorts by name
- src/dashboard/__tests__/project-manager-durable.test.ts:24-41 — per-test `SDD_HOME`/`SPEC_WORKFLOW_HOME`
- src/dashboard/__tests__/project-manager-durable.test.ts:51-71 — restart-survival test pattern

## Controller server and session
- src/dashboard/multi-server.ts:230-231 — `loadOrCreateSecret` and `installAccessControl` in `start`
- src/dashboard/multi-server.ts:356-357 — session URL written as `http://localhost:` and the port
- src/controller/access.ts:36-67 — `loadOrCreateSecret`, creates the secret when absent
- src/core/dashboard-session.ts:21-24 — constructor, the session path
- src/core/dashboard-session.ts:50-51 — `readSession` creates the session directory
- src/core/dashboard-session.ts:122-138 — `getDashboardSession` deletes the file for a dead pid
- src/dashboard/utils.ts:71-73 — `fetch` with `AbortSignal.timeout`
- src/dashboard/__tests__/health-route.test.ts:49-71 — real server on a free port, temp homes

## Git helpers
- src/core/git-utils.ts:45-51 — `scrubbedGitEnv`
- src/core/git-utils.ts:101-112 — `normalizeIdentityPath`, realpath with fallback
- src/core/git-utils.ts:152-158 — `gitTopLevel`, realpath top level or null

## Agent-rules readers (design additions)
- src/dashboard/harness/run-setup.ts:68-79 — `readAgentRules` start, `worktree-per-change: required` match
- src/dashboard/harness/run-setup.ts:94-96 — `merge-method` regex, silent `merge` default
- src/dashboard/harness/run-setup.ts:95-106 — `^`-anchored key regexes
- src/core/gate-rules.ts:125-139 — `parseAgentRuleKey`

## Templates and build
- src/core/workspace-initializer.ts:52-57 — fixed list of copied template names
- src/core/workspace-initializer.ts:69 — template source path from the module directory
- scripts/copy-static.cjs:46-53 — copies `src/markdown` to `dist/markdown`
- scripts/sync-store-templates.cjs:34-37 — syncs only names the store already has

## Tasks format (tasks additions)
- src/core/task-parser.ts:14 — `TEST_BULLET_RE`, the only accepted `- Test:` label
- src/core/task-parser.ts:34-44 — `parseTestLine`, path and call split on a spaced em dash
- src/core/task-validator.ts:12 — `SEAM_LABEL_RE`, matches near-miss seam labels
- src/core/task-validator.ts:147-164 — rejects a non-canonical `Test`/`File` label as an error

## Test scaffolding (tasks additions)
- vitest.config.ts:7-8 — setup file and the `src/**/*.test.ts` include pattern
- vitest.setup.ts:23-24 — per-worker `SDD_HOME` and `SPEC_WORKFLOW_HOME`
- src/controller/access.ts:191-192 — `installAccessControl`, adds the access hook to an app
- src/dashboard/__tests__/health-route.test.ts:21-32 — `getFreePort`
- src/dashboard/__tests__/access-routes.test.ts:21 — its own stub `POST /api/projects/add`
- src/dashboard/__tests__/project-manager-durable.test.ts:73-88 — worktree project not remembered
- scripts/stub-gh.mjs:49-51 — the per-invocation `.argv` sidecar
- src/core/dashboard-session.ts:29-45 — `ensureSessionDir`, the `mkdir` the peek must skip
- src/controller/merge.ts:150-172 — `runCommand` drops a non-numeric error code

## Docs (tasks additions)
- docs/SDD-HARNESS.md:90-92 — the register-once bullet (`POST /api/projects/add`)
- docs/SDD-HARNESS.md:312-331 — `## Installing from a checkout`, steps 4-5 at 323-326
