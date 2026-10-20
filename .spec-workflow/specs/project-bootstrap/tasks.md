# Tasks Document

Document version: v1

Dependency order: tasks 1 to 3 change existing controller code (the session peek, then `addProjectByPath`, then the add route that calls it); tasks 4 to 8 build the new `src/bootstrap/` modules leaf first (controller client, agent-rules facts, argument parsing, `init`, `doctor`); task 9 wires the entrypoint to them; task 10 is the end-to-end test of shipped behaviour; task 11 is the documentation. Each task leaves `npx tsc --noEmit` clean and every existing suite green, because no existing caller changes until task 9 and task 9 adds only a branch for two new first arguments. Expected verifier count: five, for the brand-new modules of tasks 4 to 8 (structural red, high risk); the other tasks route by the normal risk rules, and no task touches a sensitive path.

- [ ] 1. Add a read-only session peek to `DashboardSessionManager`
  - File: src/core/dashboard-session.ts
  - File: src/core/__tests__/dashboard-session-peek.test.ts
  - Test: src/core/__tests__/dashboard-session-peek.test.ts — DashboardSessionManager.peekDashboardSession()
  - Add `peekDashboardSession` (design C9) beside `getDashboardSession` (`src/core/dashboard-session.ts:122-141`), reading the path the constructor sets (`src/core/dashboard-session.ts:21-24`) with no `mkdir` and no unlink.
  - Purpose: Give `init` and `doctor` the controller URL without the side effects that Req 7 AC 6 forbids.
  - _Leverage: src/core/dashboard-session.ts, src/core/global-dir.ts_
  - _Requirements: 7.6, 5.2_
  - _Prompt: Task: Add the public async method peekDashboardSession to DashboardSessionManager per design C9 and design D4 (Req 7 AC 6, Req 5 AC 2). It reads the session file at the constructor's path (src/core/dashboard-session.ts:21-24) without calling ensureSessionDir (src/core/dashboard-session.ts:29-45), and returns null for an absent or unparseable file, an entry with no string url, or a pid for which process.kill(pid, 0) throws; otherwise the parsed entry. Write src/core/__tests__/dashboard-session-peek.test.ts with a per-test SPEC_WORKFLOW_HOME temp directory | Restrictions: Do not change getDashboardSession, readSession or any other method; never write, rename or unlink; no existing test file changes | Success: a live-pid session file returns the entry; a dead-pid file returns null and the file still exists afterwards; an absent home directory returns null and no directory is created; an unparseable file and an entry without a string url return null_

- [ ] 2. Let `addProjectByPath` take an explicit store root and remember it
  - File: src/dashboard/project-manager.ts
  - File: src/dashboard/__tests__/project-manager-durable.test.ts
  - Test: src/dashboard/__tests__/project-manager-durable.test.ts — ProjectManager.addProjectByPath(repo, storeRoot)
  - Add the optional trailing `workflowRootPath` parameter to `addProjectByPath` (`src/dashboard/project-manager.ts:318-343`) per design C7. The four existing tests in the durable test file call it with one argument; this task alters no value they assert, and they stay green unchanged (Req 5 AC 6, invariant, verified not red-first).
  - Purpose: Close both gaps of Req 5 AC 4: the explicit store root replaces `resolveGitRoot`, and the project is remembered although its two paths differ.
  - _Leverage: src/core/project-registry.ts, src/controller/state.ts_
  - _Requirements: 5.3, 5.4, 5.5, 5.6_
  - _Prompt: Task: Implement design C7's addProjectByPath change per Req 5 AC 3-5. Absent parameter: behaviour unchanged. Present: workspace from resolveGitWorkspaceRoot, store root the given value canonicalised with normalizeIdentityPath (src/core/git-utils.ts:101-112, design D9); reuse a registry entry whose workflowRootPath already equals it, else call registry.registerProject(workspace, process.pid, `{ workflowRootPath }`), which updates in place by id (src/core/project-registry.ts:362-378); when an in-memory context has a different store root, remove and re-add it (design D12); then await rememberProject (src/controller/state.ts:434-441) with the entry's id, both paths and name, letting a failed write reject (design D3). Extend the durable test file following the restart pattern at lines 51-71 | Restrictions: Leave the equality rule in addProject (src/dashboard/project-manager.ts:240-249) unchanged, so a worktree server is still not remembered; do not edit the four existing tests | Success: a separate-store add is in projects.json with both realpath paths; it survives a restart after unregisterProjectById; a second identical call leaves one entry and returns the same id; a re-add with a different store root updates the entry and the context in place; the four existing tests pass unchanged_

- [ ] 3. Accept `workflowRootPath` on `POST /api/projects/add`
  - File: src/dashboard/multi-server.ts
  - File: src/dashboard/__tests__/projects-add-route.test.ts
  - Test: src/dashboard/__tests__/projects-add-route.test.ts — POST /api/projects/add
  - Extend the route at `src/dashboard/multi-server.ts:453-464` per design C7 and the Data Models table. `src/dashboard/__tests__/access-routes.test.ts` registers its own stub route (line 21), so this task alters no value it asserts.
  - Purpose: Let `init` send the store root it resolved instead of the controller deriving one in its own environment.
  - _Leverage: src/dashboard/__tests__/health-route.test.ts, src/controller/access.ts_
  - _Requirements: 5.1, 5.4, 5.6_
  - _Prompt: Task: Change the add route per design C7: the body is `{ projectPath, workflowRootPath? }`; a present workflowRootPath that is not a string, not absolute, or not an existing directory gets 400 with an error naming the field; otherwise call the addProjectByPath change task 2 ships with both values. Write the new route test with a real MultiProjectDashboardServer on a free port and temp homes, as health-route.test.ts:49-71 does, posting with Authorization Bearer and the secret read from the temp home | Restrictions: A body without workflowRootPath must produce the base call and response (Req 5 AC 6, an invariant: verified, not red-first); keep the 500 path for a thrown error; no change to makeRequireAccess | Success: a non-string, a relative and a missing-directory workflowRootPath each get 400 naming the field; a valid one gets 200 with projectId and projects.json holds both paths; `{ projectPath }` alone gets 200 with `{ projectId, success: true }`; a request without the secret gets 401_

- [ ] 4. Create the controller client
  - File: src/bootstrap/controller-client.ts
  - File: src/bootstrap/__tests__/controller-client.test.ts
  - Test: src/bootstrap/__tests__/controller-client.test.ts — registerWithController(url, secret, body, timeoutMs)
  - Test: src/bootstrap/__tests__/controller-client.test.ts — controllerUrl(env)
  - Implement design C6: `controllerUrl`, `readSecret`, `registerWithController`, `checkHealth`.
  - Purpose: One module for every controller call `init` and `doctor` make, so the secret handling and the timeouts live in one place.
  - _Leverage: src/controller/access.ts, src/dashboard/utils.ts_
  - _Requirements: 5.1, 5.2, 5.7, 7.1, 7.4_
  - _Prompt: Task: Implement design C6 per Req 5 AC 1, 2 and 7 and the Security and Performance NFRs. controllerUrl uses the url of the peek method task 1 adds when it returns an entry, else http://127.0.0.1: and SDD_PORT when that is a valid port, else 5000. readSecret reads and trims secretPath() (src/controller/access.ts:25-28); missing or empty gives null. Both network calls use the global fetch with AbortSignal.timeout(timeoutMs), default 10000, the pattern of src/dashboard/utils.ts:71-73. Test against a small local HTTP server on a free port | Restrictions: Never call loadOrCreateSecret (src/controller/access.ts:40); no reason string contains the secret or a response body; add no host check (Req 5 AC 2 makes the host loopback by construction) | Success: controllerUrl picks the live session url, then SDD_PORT, then 5000, and ignores a non-numeric SDD_PORT; readSecret returns null for a missing or empty file and never creates one; registration sends the Bearer header and the JSON body, succeeds on 2xx with a string projectId, and reports no shared secret, not answering, timed out and the non-2xx status as distinct reasons; checkHealth passes only on 200 with ok true; a 200 ms timeout against a silent server fails within 1 second_

- [ ] 5. Ship the agent-rules template and the facts module
  - File: src/markdown/templates/agent-rules-template.md
  - File: src/bootstrap/agent-rules.ts
  - File: src/bootstrap/__tests__/agent-rules.test.ts
  - Test: src/bootstrap/__tests__/agent-rules.test.ts — renderAgentRules(template, facts)
  - Test: src/bootstrap/__tests__/agent-rules.test.ts — detectFacts(top, args)
  - Implement design C5. `scripts/copy-static.cjs:46-53` copies the new template to `dist/markdown/`; `src/core/workspace-initializer.ts:52-57` and `scripts/sync-store-templates.cjs` are not changed.
  - Purpose: Fill the three repository facts into a template the two existing readers accept.
  - _Leverage: src/dashboard/harness/run-setup.ts, src/core/gate-rules.ts, src/core/workspace-initializer.ts_
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9_
  - _Prompt: Task: Write the template exactly as design C5 lists it (key lines at column 0, double-brace placeholders, one comment line per heading, design D6) and implement detectFacts, renderAgentRules and templatePath per Req 4 AC 3-5 (requirements D8). Type the second parameter of detectFacts as a local structural type with the optional testCommand, worktreeSetup and mergeMethod fields of design C3's InitArgs; this is the bridge task 7 removes | Restrictions: Do not add the template to WorkspaceInitializer's list (src/core/workspace-initializer.ts:52-57); an unreadable package.json means no runner, not an error | Success: the template holds the five key lines and four headings of Req 4 AC 1; detectFacts follows the override, then package-lock, pnpm-lock, yarn.lock order, and the override, then vitest, then jest order, and defaults mergeMethod to merge; a null fact drops its line; rendered output matches no double-brace placeholder; on a rendered file readAgentRules (src/dashboard/harness/run-setup.ts:68-137) returns worktree yes, merge auto, the mergeMethod and the worktreeSetup, and parseAgentRuleKey (src/core/gate-rules.ts:125-139) returns the test command or null_

- [ ] 6. Parse the `init` and `doctor` arguments
  - File: src/bootstrap/cli.ts
  - File: src/bootstrap/__tests__/cli.test.ts
  - Test: src/bootstrap/__tests__/cli.test.ts — parseInitArgs(rest)
  - Test: src/bootstrap/__tests__/cli.test.ts — parseDoctorArgs(rest)
  - Create `cli.ts` with design C2's `BootstrapIo`, `parseInitArgs` and `parseDoctorArgs`. The runner of design C2 is task 9's.
  - Purpose: Reject every bad option before any file is touched (Req 6 AC 2).
  - _Leverage: src/index.ts_
  - _Requirements: 1.5, 1.6, 1.9_
  - _Prompt: Task: Implement the design C2 grammar per Req 1 AC 5, 6 and 9: one positional; init options --store, --test-command, --worktree-setup and --merge-method as a separate token or after = (design D13); doctor takes none. Each error case of design C2 returns `{ error }` naming the option or positional; a --test-command or --worktree-setup value with a backtick or a newline is an error (design D7). Expand ~ with the rule of expandTildePath (src/index.ts:120-125), copied, not exported. Declare a local InitArgs with the design C3 fields; this is the bridge task 7 removes | Restrictions: Parsing writes no file and does not resolve or stat the path; do not export anything from src/index.ts in this task | Success: both option forms parse; an unknown option, a value option that is last, empty after =, or followed by a double-dash token, a merge-method other than merge or squash, no positional, a second positional, and a command value with a backtick or newline each return an error naming it; a doctor option other than --help is an error; ~ expands to the home directory_

- [ ] 7. Implement `init`
  - File: src/bootstrap/init.ts
  - File: src/bootstrap/cli.ts
  - File: src/bootstrap/agent-rules.ts
  - File: src/bootstrap/__tests__/init.test.ts
  - Test: src/bootstrap/__tests__/init.test.ts — runInit(args, io, entryPath, timeoutMs)
  - Implement design C3's three phases. Move the `InitArgs` bridges of tasks 5 and 6 to the exported `InitArgs` here.
  - Purpose: Write `.mcp.json` and `agent-rules.md`, then register, with nothing written before every input is valid.
  - _Leverage: src/core/git-utils.ts, src/core/project-registry.ts_
  - _Requirements: 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.2, 4.6, 4.8, 5.1, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Prompt: Task: Implement runInit per design C3 and Req 1 AC 7-8, Req 2, Req 3, Req 4 AC 2, 6 and 8, Req 5 AC 1 and 7, Req 6, and the Reliability NFR, using the controller client of task 4 and the facts module of task 5. Top level through gitTopLevel (src/core/git-utils.ts:152-158, design D5); realpath both roots (design D9); always send both paths (design D2); keep an existing agent-rules.md (requirements D3); replace only the spec-workflow entry (requirements D2); exit 2 keeps the files (requirements D4); the not-committed last line on exit 0 and 2 (design D8). Test against a fake controller (Fastify, installAccessControl, stub add route, SDD_PORT) with an explicit entryPath. Replace the local InitArgs of tasks 5 and 6 with an import of this module's export | Restrictions: Create no store directory other than .spec-workflow (requirements D10); write through a same-directory temp file and rename; never print the secret or an env value | Success: a missing path, a non-git path, a bad --store and malformed .mcp.json each exit 1 with no file written; a subdirectory acts on its top level; other keys and servers keep value and order and a missing mcpServers is added; the changed-entry line shows the was clause without env; env is the shared root with --store, else empty; output is two-space JSON plus newline; wrote, updated and kept lines and the registered line print; an existing agent-rules.md is byte-identical and a left-out fact prints its note; a byte-identical re-run prints kept twice and exits 0; no secret, missing controller and non-2xx exit 2 with the files kept; a rename spy shows same-directory temp files; no output line contains the secret or an env value_

- [ ] 8. Implement `doctor` and export `ghBin`
  - File: src/bootstrap/doctor.ts
  - File: src/controller/merge.ts
  - File: src/bootstrap/__tests__/doctor.test.ts
  - Test: src/bootstrap/__tests__/doctor.test.ts — runChecks(top, timeoutMs)
  - Test: src/bootstrap/__tests__/doctor.test.ts — serviceEnv()
  - Implement design C4 and add only the `export` keyword to `ghBin` (`src/controller/merge.ts:47-50`, design C8). No existing merge test changes.
  - Purpose: Name the first thing wrong with a configured repository without writing anything.
  - _Leverage: src/dashboard/harness/run-setup.ts, src/core/gate-rules.ts, src/controller/state.ts, src/core/git-utils.ts, scripts/stub-gh.mjs_
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - _Prompt: Task: Implement runDoctor, runChecks and serviceEnv per design C4 and Req 7 AC 1-6: seven checks in order with the Req 7 AC 2 skips (requirements D6); the controller check through task 4's health call; the registered check through readProjects (src/controller/state.ts:425-427); the remote check with scrubbedGitEnv (src/core/git-utils.ts:45-51); the token check runs execFile on ghBin with serviceEnv and timeoutMs, reading the callback error directly, not runCommand (src/controller/merge.ts:150-172), and reports only a fixed reason or exit code (design D10, requirements D7). Validate the path as task 7 does. Run the token check against scripts/stub-gh.mjs through CONTROLLER_GH_BIN and STUB_GH_SCRIPT | Restrictions: Read the session file only through task 1's peek; create, write, rename or delete nothing; ghBin gains only export (design D11) | Success: each check passes, fails with its fix and skips per its dependency; the last line names the first failure and the exit is 1, else 0; the stub's argv sidecar shows api and the owner/repo path; a push false, a non-JSON stdout, a non-zero exit and a missing binary each fail token with a distinct reason; serviceEnv lets a file key replace the process key, keeps other keys, and returns the process env with no file; https, git@ and ssh origins parse; mtimes and listings of the repository, store and both homes are unchanged with a dead-pid session file present; a 200 ms timeout against a silent server fails within 1 second_

- [ ] 9. Wire `init` and `doctor` into the entrypoint
  - File: src/index.ts
  - File: src/bootstrap/cli.ts
  - File: src/bootstrap/__tests__/cli.test.ts
  - Test: src/bootstrap/__tests__/cli.test.ts — bootstrapCommand(args)
  - Test: src/bootstrap/__tests__/cli.test.ts — runBootstrapCommand(args, io)
  - Add design C2's runner to `cli.ts`, and design C1's `bootstrapCommand`, `main` branch and help block to `src/index.ts`. `src/__tests__/index-args.test.ts` stays unchanged: its help assertions (lines 391-396) use `toContain`, so this task alters no value it asserts exactly (Req 1 AC 4, invariant, verified not red-first).
  - Purpose: Make the two commands reachable from the binary without starting a server.
  - _Leverage: src/index.ts, src/__tests__/workspace-roots.test.ts_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.10, 1.11_
  - _Prompt: Task: Per design C1 and design D1 (Req 1 AC 1-3), branch in main before the help check (src/index.ts:378-384), dynamically import cli.ts as watch mode does (src/index.ts:400-406) and exit with the code returned. Per design C2, runBootstrapCommand prints that command's usage to stdout and returns 0 on --help anywhere (Req 1 AC 10), else parses with task 6's functions, prints one stderr line and returns 1 on an error, else runs task 7's or task 8's entry; an unexpected exception prints error and its message and returns 1. Add a SUBCOMMANDS block for both commands to showHelp (src/index.ts:22-118). Spawn the child test with the tsx loader resolved as src/__tests__/workspace-roots.test.ts:514-517 does | Restrictions: Do not change CLI_FLAGS or parseArguments; import nothing from src/bootstrap statically in src/index.ts; start no Claude Code process and read no stdin (Req 1 AC 11) | Success: bootstrapCommand returns init and doctor for a first argument, null for a later position and for init-x; runBootstrapCommand returns 0 with the usage on --help and 1 with one stderr line on a bad option; showHelp contains init and doctor; a child init --help exits 0 with the init usage and no Starting banner; index-args.test.ts passes unchanged_

- [ ] 10. End-to-end test: `init` then `doctor`
  - File: src/bootstrap/__tests__/init-doctor.e2e.test.ts
  - Write the end-to-end test of design's Testing Strategy against a real controller. It covers behaviour tasks 3, 7 and 8 already shipped and cannot fail before them, so it carries no `- Test:` line and routes implementer-only, with no red-first author.
  - Purpose: Prove Req 7 AC 7 across the real route and the real project list.
  - _Leverage: src/dashboard/__tests__/health-route.test.ts, scripts/stub-gh.mjs_
  - _Requirements: 7.7, 5.3, 5.4_
  - _Prompt: Task: Per Req 7 AC 7, start a real MultiProjectDashboardServer on a free port with temp SDD_HOME and SPEC_WORKFLOW_HOME (its session file names the URL); build a temp repository with origin https://github.com/acme/widget.git, a package-lock.json and vitest in devDependencies; point CONTROLLER_GH_BIN at scripts/stub-gh.mjs answering permissions.push true; pass an existing temp dist/index.js as entryPath. Run runInit, then runDoctor, once with --store on a sibling directory and once without | Restrictions: Change no source file; if the test fails, report the failing behaviour rather than weakening an assertion | Success: in both runs runInit exits 0 and runDoctor prints seven ok lines and exits 0; projects.json holds the repository top level and the store root as its two paths_

- [ ] 11. Document `init` and `doctor`
  - File: docs/SDD-HARNESS.md
  - Add design C10's `### Bootstrapping a project` subsection under `## Installing from a checkout` (`docs/SDD-HARNESS.md:312-331`), merge steps 4 and 5 into one step, and add the `init` note to the key table (`docs/SDD-HARNESS.md:252-270`). The step list shrinks from five to four: `grep -n "^[0-9]\. " docs/SDD-HARNESS.md` finds every numbered step; renumber the list and update any count word that names it.
  - Purpose: A fourth repository does not depend on memory.
  - _Leverage: docs/SDD-HARNESS.md_
  - _Requirements: 8.1, 8.2_
  - _Prompt: Task: Per Req 8 AC 1-2 and design C10, write the subsection with the command lines in the form node, the checkout's dist/index.js, then init or doctor and the repository (requirements D9), the four init options, exit codes 0, 1 and 2, and the seven doctor checks in order; replace steps 4 and 5 with one step, run init then doctor (design D14); note in the key table that init writes worktree-per-change, worktree-setup, tdd-test-command, merge-method and merge | Restrictions: ASD-STE100 style; no other section changes; no npx spelling | Success: the subsection holds both command lines, the four options, the three exit codes and the seven checks in Req 7 AC 1 order; the install list has four numbered steps; the key table names the five keys init writes_

## Decisions taken in this document

- D1 — The controller client gets its own unit test file: options were its own test seam, coverage only through the init and doctor tests as the design's strategy lists; chosen because a brand-new module needs a red-first seam and the client is the one place the secret and the timeouts are handled.
- D2 — The two cross-module types travel by bridge: options were a local structural type in the earlier tasks removed by the init task, moving the types into a shared module, building init before the parser; chosen because the design pins each type's home and the parser and facts module must compile before the init module exists.
- D3 — The runner and the entrypoint branch ship in one late task: options were one wiring task after init and doctor, the runner inside the parser task with stubbed branches; chosen because the runner calls both commands, so a stub would ship dead branches.
- D4 — The end-to-end test carries no test-seam line: options were no seam line with an implementer-only route, a seam line; chosen because it cannot fail before tasks 3, 7 and 8 exist, and the tasks parser recognises only the canonical seam label, so no qualified label is available.
- D5 — The add route and the project manager change are two tasks: options were two tasks, one task; chosen because each has its own test file and the route depends on the new parameter.

## Scope notes

- Carried items from design: none.
- Every design component is covered: C9 task 1, C7 tasks 2 and 3, C6 task 4, C5 task 5, C2 tasks 6 and 9, C3 task 7, C4 and C8 task 8, C1 task 9, C10 task 11; the end-to-end strategy item is task 10.
- No steering `structure.md` exists; the layout follows the agent rules file and design.
- The brief's qualified integration label is not used: the task validator rejects it, so task 10 has no seam line (D4).
- Nothing in the decomposition entry is cut beyond the cuts requirements and design already record.

## Revision History

- **v1** (2026-10-20) — Initial draft.
  - **Lint pass.** 22 fixed; rejected: L-1 (`peekDashboardSession` is the new method being added, not a claim about the cited range), L-2 (`mkdir` is described as absent, "no mkdir"), L-18 (`export` is the keyword being added; the citation anchors `ghBin`), L-26 (`init` is the command being documented; the citation anchors the subsection/key-table location). Prompt citations gained their directory prefixes (L-3 to L-25); the bare `:29-45` sibling on task 1 was repaired to `src/core/dashboard-session.ts:29-45`; the MDX acorn break (L-9) and its brace siblings on tasks 2, 3 and 6 were wrapped in code spans.
