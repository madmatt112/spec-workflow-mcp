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
