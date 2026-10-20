# Requirements Document

## Introduction

This spec adds two deterministic subcommands to the server binary: `init`, which puts a repository on the controller, and `doctor`, which checks that a repository is still correctly on it. They are for the one operator of ADR 0001, who today edits `.mcp.json`, hand-writes `agent-rules.md` and registers the project through `POST /api/projects/add` (`src/dashboard/multi-server.ts:453-464`). After this spec one command does all three and a second command names the first thing that is wrong.

## Alignment with Product Vision

The steering directory has no `product.md`; this spec aligns with the re-planned entry 24 of `decomposition.md` and with ADR 0001 (one operator, several projects). It removes the last by-hand step between a new repository and its first controller run. No model runs in either command, which keeps the mechanics deterministic.

## Requirements

### Requirement 1 — the `init` and `doctor` subcommands

**User Story:** As the operator, I want `init` and `doctor` on the binary I already run, so that I do not install or learn a second tool.

#### Acceptance Criteria

1. WHEN the first argument to the binary is `init` THEN the binary SHALL run the init command and SHALL NOT start the MCP server or the dashboard.
2. WHEN the first argument to the binary is `doctor` THEN the binary SHALL run the doctor command and SHALL NOT start the MCP server or the dashboard.
3. WHEN `init` or `doctor` appears in any position other than the first THEN the binary SHALL treat the arguments as it does at base (`src/index.ts:185-331`).
4. WHEN the first argument is neither `init` nor `doctor` THEN the binary SHALL parse the arguments and start exactly as it does at base. This is an invariant (verified, not red-first): the existing tests in `src/__tests__/index-args.test.ts` stay green unchanged.
5. `init` SHALL take one positional argument, the repository path (`~` expanded, resolved to absolute), and these options: `--store <path>`, `--test-command <command>`, `--worktree-setup <command>`, `--merge-method merge|squash`.
6. `doctor` SHALL take one positional argument, the repository path, and no options other than `--help`.
7. IF the repository path is missing, does not exist, or is not inside a git work tree THEN `init` and `doctor` SHALL print one line naming the path and the reason and SHALL exit 1 without writing a file.
8. IF a path inside the repository is given THEN `init` and `doctor` SHALL act on the git top level of that path (`resolveGitWorkspaceRoot`, `src/core/git-utils.ts:194-205`).
9. IF `init` receives an unknown option, an option without its value, or a `--merge-method` value other than `merge` or `squash` THEN it SHALL print one line naming the option and SHALL exit 1 without writing a file.
10. WHEN `init --help` or `doctor --help` is run THEN the binary SHALL print that command's usage and exit 0; the top-level `--help` text (`src/index.ts:22-118`) SHALL list both subcommands.
11. Neither command SHALL start a Claude Code process, call a model, prompt on standard input, commit, or push.

### Requirement 2 — the store root

**User Story:** As the operator, I want to say where the spec store lives, so that a repository with a separate store repository (tradr and tradr-hosted) is set up the same way as one with an in-repo store.

#### Acceptance Criteria

1. WHEN `--store` is not given THEN the store root SHALL be the repository's git top level, and the store SHALL be `.spec-workflow/` under it.
2. WHEN `--store <path>` is given THEN the store root SHALL be that path resolved to absolute, with the same meaning as `SPEC_WORKFLOW_SHARED_ROOT` (`src/core/git-utils.ts:214-221`): the directory that holds `.spec-workflow/`.
3. IF the `--store` path does not exist or is not a directory THEN `init` SHALL print one line naming it and SHALL exit 1 without writing a file.
4. WHEN `init` runs and the store's `.spec-workflow/` directory does not exist THEN `init` SHALL create it. `init` SHALL create no other directory of the store layout; the server makes the rest on its first start (`src/core/workspace-initializer.ts:18-62`).

### Requirement 3 — `.mcp.json`

**User Story:** As the operator, I want `init` to point the repository's MCP server at this checkout, so that every Claude Code session in the repository talks to the build the controller runs.

#### Acceptance Criteria

1. WHEN `init` runs THEN it SHALL write `.mcp.json` at the repository's git top level with a `mcpServers.spec-workflow` entry whose `type` is `stdio`, whose `command` is `node`, and whose `args` are exactly one element: the absolute path of this checkout's `dist/index.js`, resolved from the running binary's own location.
2. WHEN `--store` is given THEN the entry's `env` SHALL be `{ "SPEC_WORKFLOW_SHARED_ROOT": "<store root>" }`; WHEN it is not given THEN the entry's `env` SHALL be `{}`.
3. IF `.mcp.json` exists THEN `init` SHALL replace only the `mcpServers.spec-workflow` entry and SHALL keep every other key and every other server entry with its value unchanged. WHEN the file has no `mcpServers` key THEN `init` SHALL add one holding only the spec-workflow entry.
4. IF the existing `mcpServers.spec-workflow` entry differs from the one `init` writes THEN `init` SHALL print the previous entry's `command` and `args` on the line that reports the file; it SHALL NOT print the previous `env` values.
5. IF `.mcp.json` exists and is not valid JSON, or has a `mcpServers` key that is present and is not an object THEN `init` SHALL print one line naming the file and SHALL exit 1 without writing any file. An absent `mcpServers` key is not an error (AC 3 creates it).
6. The written file SHALL be valid JSON, indented with two spaces, ending in one newline.

### Requirement 4 — `agent-rules.md` from a shipped template

**User Story:** As the operator, I want `init` to write the store's `agent-rules.md` with the repository's facts already in it, so that the controller's first run reads correct keys.

#### Acceptance Criteria

1. The package SHALL ship an agent-rules template. The template SHALL contain the key lines `worktree-per-change: required`, `worktree-setup:`, `tdd-test-command:`, `merge-method:` and `merge: auto`, and the headings `## Checks`, `## Sensitive paths`, `## Generated paths` and `## Prose paths`, each with a one-line comment that tells the operator what to put under it.
2. WHEN `init` runs and the store has no `agent-rules.md` THEN `init` SHALL write `.spec-workflow/agent-rules.md` in the store from the template, with the three facts of AC 3 to 5 filled in.
3. The `worktree-setup` value SHALL be `--worktree-setup` when given; else `npm ci` when the repository top level has `package-lock.json`, `pnpm install` when it has `pnpm-lock.yaml`, `yarn install` when it has `yarn.lock` (checked in that order); else the line SHALL be left out.
4. The `tdd-test-command` value SHALL be `--test-command` when given; else `npx vitest run {files}` when the top-level `package.json` lists `vitest` in `dependencies` or `devDependencies`, `npx jest {files}` when it lists `jest` there (checked in that order); else the line SHALL be left out.
5. The `merge-method` value SHALL be `--merge-method` when given, else `merge`.
6. WHEN a fact line is left out under AC 3 or AC 4 THEN `init` SHALL print one line naming the key and the option that sets it.
7. WHEN `init` has written `agent-rules.md` THEN `readAgentRules` (`src/dashboard/harness/run-setup.ts:68-137`) on the store SHALL return `worktree: 'yes'`, `merge: 'auto'`, the written `mergeMethod` and, when written, the `worktreeSetup` value; and `parseAgentRuleKey(text, 'tdd-test-command')` (`src/core/gate-rules.ts:125-139`) SHALL return the written test command, or null when the line was left out.
8. IF the store already has an `agent-rules.md` THEN `init` SHALL leave it byte-for-byte unchanged and SHALL print that it kept it.
9. The written file SHALL contain no unfilled template placeholder; a test SHALL grep the written file for the template's placeholder syntax and find none.

### Requirement 5 — register with the running controller

**User Story:** As the operator, I want `init` to register the project with the controller, so that the project appears on the dashboard and stays there after a controller restart.

#### Acceptance Criteria

1. WHEN `init` has written its files THEN it SHALL register the project through the controller's HTTP API, authenticated with `Authorization: Bearer` and the shared secret read from the controller home (`secretPath`, `src/controller/access.ts:25-28`). `init` SHALL NOT write `projects.json` or the MCP process registry itself.
2. `init` SHALL find the controller at the URL of the live dashboard session file (`src/core/dashboard-session.ts:122-141`), else at `http://127.0.0.1:` followed by `SDD_PORT`, else port 5000 (the service's default, `scripts/sdd-service.sh:33`). IF the resolved URL's host is not a loopback address (the dashboard was bound with a non-localhost `--host`, `src/index.ts:39-42`) THEN `init` SHALL NOT send the secret to it and SHALL use `http://127.0.0.1:` followed by that URL's port, so the secret stays on loopback (Security NFR).
3. WHEN registration succeeds THEN `projects.json` in the controller home SHALL hold one entry whose `workspacePath` is the repository's git top level and whose `workflowRootPath` is the store root of Requirement 2, with or without `--store`.
4. WHEN registration succeeds with `--store` THEN the entry of AC 3 SHALL still be in `projects.json` after the controller restarts. At base a project whose workspace and store root differ is not remembered (`src/dashboard/project-manager.ts:240-249`), and `addProjectByPath` derives the store root in the controller's own environment (`src/dashboard/project-manager.ts:318-343`); the design SHALL close both gaps.
5. IF the project is already registered with the same two paths THEN `init` SHALL leave one entry, not two, and SHALL report the existing project id.
6. WHEN `POST /api/projects/add` is called with only `{ projectPath }` THEN the route SHALL behave as at base. This is an invariant (verified, not red-first).
7. IF the secret file is missing, the controller does not answer, or the API returns a non-2xx status THEN `init` SHALL keep the files it wrote, SHALL print one line naming the failure and the command that starts the controller (`scripts/sdd-service.sh install`), and SHALL exit 2.

### Requirement 6 — what `init` prints, idempotence and exit codes

**User Story:** As the operator, I want `init` to tell me exactly what it did, so that I can review and commit the result myself.

#### Acceptance Criteria

1. `init` SHALL print one line per file it touched, of the form `wrote`, `updated` or `kept`, followed by the absolute path, and one line `registered` followed by the project id.
2. `init` SHALL validate every input (Requirement 1 AC 7 and 9, Requirement 2 AC 3, Requirement 3 AC 5) before it writes any file.
3. WHEN `init` is run a second time with the same arguments on a repository it has already set up THEN it SHALL change no file byte and SHALL print `kept` for every file; WHEN the controller is also reachable and registration succeeds THEN it SHALL exit 0; a registration failure on that re-run still exits 2 (Requirement 5 AC 7).
4. `init` SHALL exit 0 when every file is written and the project is registered, 1 on an input error, and 2 on a registration failure.
5. WHEN `init` has finished THEN its last line SHALL say that the written files are not committed and SHALL name `doctor` as the next command.

### Requirement 7 — `doctor`

**User Story:** As the operator, I want one command that checks a configured repository, so that a broken repository is caught before a run fails on it.

#### Acceptance Criteria

1. `doctor` SHALL run these checks in this order, and print one line per check with `ok`, `fail` or `skip`, the check's name and, on `fail`, the fix:
   1. `mcp` — `.mcp.json` has a `mcpServers.spec-workflow` entry whose `args[0]` is an existing `dist/index.js`, and whose `SPEC_WORKFLOW_SHARED_ROOT`, when set, is an existing directory.
   2. `store` — the store root (from the entry's `SPEC_WORKFLOW_SHARED_ROOT`, else the repository top level) holds `.spec-workflow/`.
   3. `agent-rules` — the store has `agent-rules.md`, it has the line `worktree-per-change: required`, and its `merge-method` line, when present, is `merge` or `squash`.
   4. `controller` — the controller's `GET /api/health` (`src/dashboard/multi-server.ts:420-445`) answers with `ok: true`, at the URL of Requirement 5 AC 2.
   5. `registered` — `projects.json` in the controller home has an entry with the repository top level as `workspacePath` and the store root as `workflowRootPath`.
   6. `remote` — the repository's `origin` remote URL names a `github.com` repository.
   7. `token` — `gh api repos/<owner>/<repo>` for that repository returns `permissions.push` true.
2. IF a check's input comes from an earlier check that failed THEN that check SHALL print `skip`: `store` and `agent-rules` depend on `mcp`; `agent-rules` depends on `store`; `registered` depends on `store`; `token` depends on `remote`.
3. WHEN at least one check fails THEN the last line SHALL name the first failed check and its fix, and `doctor` SHALL exit 1; WHEN all pass THEN it SHALL exit 0.
4. The `token` check SHALL run `gh` with the environment the controller service runs with: the doctor's own environment, overlaid with the variables of `service.env` in the controller home when that file exists (`scripts/sdd-service.sh:57-59`).
5. The `token` check SHALL resolve the `gh` binary through `CONTROLLER_GH_BIN` when it is set, as the controller does (`src/controller/merge.ts:47-50`), so tests run it against `scripts/stub-gh.mjs`.
6. `doctor` SHALL write, rename or delete no file, including the dashboard session file.
7. WHEN `init` has just exited 0 on a repository whose `origin` is a GitHub repository the token can push to THEN `doctor` on that repository SHALL print `ok` for every check and exit 0.

### Requirement 8 — documentation

**User Story:** As the operator, I want the bootstrap written down where the harness is described, so that a fourth repository does not depend on memory.

#### Acceptance Criteria

1. `docs/SDD-HARNESS.md` SHALL gain a section that gives the `init` and `doctor` command lines (as `node <checkout>/dist/index.js init <repo>`), the options of Requirement 1 AC 5, the exit codes of Requirement 6 AC 4, and the check list of Requirement 7 AC 1.
2. The agent-rules key table (`docs/SDD-HARNESS.md:246-270`) SHALL say that `init` writes `worktree-per-change`, `worktree-setup`, `tdd-test-command`, `merge-method` and `merge`.

## Non-Functional Requirements

### Security
- Neither command SHALL print, log or write the shared secret, `GH_TOKEN`, `GITHUB_TOKEN`, or any `env` value of an existing `.mcp.json` server entry.
- `init` SHALL send the secret only to a loopback address.

### Reliability
- `init` SHALL write each file through a temporary file in the same directory and a rename, so an interrupted `init` leaves either the old file or the new one.
- Tests SHALL run against a temporary `SDD_HOME` and a temporary repository, under the existing test-home guard (`src/core/test-home-guard.ts`).

### Performance
- `doctor` SHALL finish within 30 seconds; each network call (health, `gh`) SHALL time out at 10 seconds and report `fail` with the reason.

## Decisions taken in this document

- D1 — Inputs come from options only, with no prompts: options were flags only, interactive questions with detected defaults (superseded entry 21), questions plus a yes-to-all mode; chosen because the entry says deterministic and no model runs, and one operator can pass flags.
- D2 — The spec-workflow entry in the MCP config file is replaced and every other key kept: options were replace the entry and keep the rest, refuse when an entry exists, overwrite the whole file; chosen because moving the npx-at-latest entries of the older repositories onto the checkout is the point of the command, and other servers in that file carry their own secrets.
- D3 — An existing agent rules file is never overwritten: options were keep it always, overwrite it, overwrite with a force flag; chosen because the existing rule files (tradr's above all) hold hand-written rules that a template cannot rebuild.
- D4 — A registration failure keeps the written files and exits 2: options were write and exit 2, validate the controller before writing anything, write and exit 0 with a warning; chosen because the files are correct without a running controller and a re-run is idempotent, while exit 0 would hide an unregistered project.
- D5 — Registration goes through the controller's API with the shared secret: options were the API, writing the project list file directly, both; chosen because the controller is the one writer of its home and the entry says to register with the running controller.
- D6 — The doctor runs every check, marks dependent checks skip, and names the first failure last: options were run all with skips, stop at the first failure; chosen because one run shows the whole state while the last line still names the first thing wrong.
- D7 — The token check runs under the service's environment and asks for push permission on the repository: options were the service environment, the shell environment, both; chosen because the controller's children use the service environment, and push permission is what a run needs.
- D8 — Facts are detected from the lockfile and the manifest's test runner, default merge method merge: options were lockfile and manifest only, also the Makefile and CI workflows (superseded entry 21), ask; chosen because the three repositories in use are all Node projects and the flags cover every other case.
- D9 — The commands are subcommands of the existing binary, recognised only as the first argument, and documented with the checkout's node entry: options were subcommands of the binary, a second binary, the npx form named in the entry; chosen because the MCP config written here points at the checkout, so the checkout's build is the one to run.
- D10 — The initialiser creates only the store directory and the agent rules file: options were that only, the full store layout; chosen because the server already makes the layout on its first start and a second writer would drift.
- D11 — The store option names the directory that holds the store directory, the same meaning as the shared-root environment variable: options were that, the store directory itself; chosen because it is the value written into the MCP config unchanged.

## Scope notes

- The decomposition entry writes `npx spec-workflow-mcp init`; this document pins the subcommand on the package binary and documents the checkout's node entry (D9). The npx spelling is not tested.
- The entry names "test command, worktree setup, merge method" as the filled facts; `merge: auto` and `worktree-per-change: required` are template constants, not detected facts.
- Not in scope, as the re-plan dropped them: the `/sdd-init` judgement half (steering documents, a first decomposition), `uninstall`, store placements beyond in-repo and separate-store (no `excluded`), `.gitignore` edits, and the `init-manifest.json` of superseded entry 21.
- The controller-design note that `doctor` "also checks the service" is met by the `controller` health check (Requirement 7 AC 1.4); `doctor` does not query systemd, because the health route is what a run depends on.
- Carried items from the decomposition: none.

## Revision History

- **v2** (2026-10-20) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/1).
  - **R1-1 — Accepted (SHOULD_FIX).** Req 3 AC 5 now errors only when a `mcpServers` key is present and not an object, and states an absent key is not an error; Req 3 AC 3 now adds a `mcpServers` key holding only the spec-workflow entry when the existing file has none.
  - **R1-2 — Accepted (SHOULD_FIX).** Req 5 AC 2 now requires that when the resolved controller URL's host is not loopback, `init` falls back to the loopback host on that port before sending the secret, keeping the Security NFR true.
  - **R1-3 — Accepted (SHOULD_FIX).** Req 6 AC 3 now qualifies exit 0 to a reachable controller and successful registration, and points a registration failure on the re-run to the exit-2 rule, removing the contradiction with Req 5 AC 7.
  - **R1-M1 — Rejected (MINOR).** The detection flags extending the decomposition command line are already justified by D8 and the Scope notes; the reviewer marked them acceptable, so no change.
- **v1** (2026-10-20) — Initial draft.
  - **Lint pass.** 0 fixed; rejected: L-1..L-9, L-13 (`init`/`doctor` are the spec's own new subcommands, absent from base code by definition; each cited range correctly supports the adjacent existing-code claim and verifies against the tree); L-10..L-12 (`controller`/`token` are doctor check names in the prose, not code identifiers; the citations anchor the existing route/helper they reference — `GET /api/health`, `service.env`, `ghBin`/`CONTROLLER_GH_BIN` — all verified).
