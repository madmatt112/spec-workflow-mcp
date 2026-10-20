# Adversarial Review — project-bootstrap/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Atomicity, ordering, coverage

**Example attack angles to consider:** Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don't map to any requirement

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): project-bootstrap tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `project-bootstrap` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since c777435

````diff
diff --git a/.spec-workflow/specs/project-bootstrap/tasks.md b/.spec-workflow/specs/project-bootstrap/tasks.md
index 110f1e4..e27bd13 100644
--- a/.spec-workflow/specs/project-bootstrap/tasks.md
+++ b/.spec-workflow/specs/project-bootstrap/tasks.md
@@ -12,7 +12,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Give `init` and `doctor` the controller URL without the side effects that Req 7 AC 6 forbids.
   - _Leverage: src/core/dashboard-session.ts, src/core/global-dir.ts_
   - _Requirements: 7.6, 5.2_
-  - _Prompt: Task: Add the public async method peekDashboardSession to DashboardSessionManager per design C9 and design D4 (Req 7 AC 6, Req 5 AC 2). It reads the session file at the constructor's path (dashboard-session.ts:21-24) without calling ensureSessionDir (:29-45), and returns null for an absent or unparseable file, an entry with no string url, or a pid for which process.kill(pid, 0) throws; otherwise the parsed entry. Write src/core/__tests__/dashboard-session-peek.test.ts with a per-test SPEC_WORKFLOW_HOME temp directory | Restrictions: Do not change getDashboardSession, readSession or any other method; never write, rename or unlink; no existing test file changes | Success: a live-pid session file returns the entry; a dead-pid file returns null and the file still exists afterwards; an absent home directory returns null and no directory is created; an unparseable file and an entry without a string url return null_
+  - _Prompt: Task: Add the public async method peekDashboardSession to DashboardSessionManager per design C9 and design D4 (Req 7 AC 6, Req 5 AC 2). It reads the session file at the constructor's path (src/core/dashboard-session.ts:21-24) without calling ensureSessionDir (src/core/dashboard-session.ts:29-45), and returns null for an absent or unparseable file, an entry with no string url, or a pid for which process.kill(pid, 0) throws; otherwise the parsed entry. Write src/core/__tests__/dashboard-session-peek.test.ts with a per-test SPEC_WORKFLOW_HOME temp directory | Restrictions: Do not change getDashboardSession, readSession or any other method; never write, rename or unlink; no existing test file changes | Success: a live-pid session file returns the entry; a dead-pid file returns null and the file still exists afterwards; an absent home directory returns null and no directory is created; an unparseable file and an entry without a string url return null_
 
 - [ ] 2. Let `addProjectByPath` take an explicit store root and remember it
   - File: src/dashboard/project-manager.ts
@@ -22,7 +22,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Close both gaps of Req 5 AC 4: the explicit store root replaces `resolveGitRoot`, and the project is remembered although its two paths differ.
   - _Leverage: src/core/project-registry.ts, src/controller/state.ts_
   - _Requirements: 5.3, 5.4, 5.5, 5.6_
-  - _Prompt: Task: Implement design C7's addProjectByPath change per Req 5 AC 3-5. Absent parameter: behaviour unchanged. Present: workspace from resolveGitWorkspaceRoot, store root the given value canonicalised with normalizeIdentityPath (git-utils.ts:101-112, design D9); reuse a registry entry whose workflowRootPath already equals it, else call registry.registerProject(workspace, process.pid, { workflowRootPath }), which updates in place by id (project-registry.ts:362-378); when an in-memory context has a different store root, remove and re-add it (design D12); then await rememberProject (state.ts:434-441) with the entry's id, both paths and name, letting a failed write reject (design D3). Extend the durable test file following the restart pattern at lines 51-71 | Restrictions: Leave the equality rule in addProject (project-manager.ts:240-249) unchanged, so a worktree server is still not remembered; do not edit the four existing tests | Success: a separate-store add is in projects.json with both realpath paths; it survives a restart after unregisterProjectById; a second identical call leaves one entry and returns the same id; a re-add with a different store root updates the entry and the context in place; the four existing tests pass unchanged_
+  - _Prompt: Task: Implement design C7's addProjectByPath change per Req 5 AC 3-5. Absent parameter: behaviour unchanged. Present: workspace from resolveGitWorkspaceRoot, store root the given value canonicalised with normalizeIdentityPath (src/core/git-utils.ts:101-112, design D9); reuse a registry entry whose workflowRootPath already equals it, else call registry.registerProject(workspace, process.pid, `{ workflowRootPath }`), which updates in place by id (src/core/project-registry.ts:362-378); when an in-memory context has a different store root, remove and re-add it (design D12); then await rememberProject (src/controller/state.ts:434-441) with the entry's id, both paths and name, letting a failed write reject (design D3). Extend the durable test file following the restart pattern at lines 51-71 | Restrictions: Leave the equality rule in addProject (src/dashboard/project-manager.ts:240-249) unchanged, so a worktree server is still not remembered; do not edit the four existing tests | Success: a separate-store add is in projects.json with both realpath paths; it survives a restart after unregisterProjectById; a second identical call leaves one entry and returns the same id; a re-add with a different store root updates the entry and the context in place; the four existing tests pass unchanged_
 
 - [ ] 3. Accept `workflowRootPath` on `POST /api/projects/add`
   - File: src/dashboard/multi-server.ts
@@ -32,7 +32,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Let `init` send the store root it resolved instead of the controller deriving one in its own environment.
   - _Leverage: src/dashboard/__tests__/health-route.test.ts, src/controller/access.ts_
   - _Requirements: 5.1, 5.4, 5.6_
-  - _Prompt: Task: Change the add route per design C7: the body is { projectPath, workflowRootPath? }; a present workflowRootPath that is not a string, not absolute, or not an existing directory gets 400 with an error naming the field; otherwise call the addProjectByPath change task 2 ships with both values. Write the new route test with a real MultiProjectDashboardServer on a free port and temp homes, as health-route.test.ts:49-71 does, posting with Authorization Bearer and the secret read from the temp home | Restrictions: A body without workflowRootPath must produce the base call and response (Req 5 AC 6, an invariant: verified, not red-first); keep the 500 path for a thrown error; no change to makeRequireAccess | Success: a non-string, a relative and a missing-directory workflowRootPath each get 400 naming the field; a valid one gets 200 with projectId and projects.json holds both paths; { projectPath } alone gets 200 with { projectId, success: true }; a request without the secret gets 401_
+  - _Prompt: Task: Change the add route per design C7: the body is `{ projectPath, workflowRootPath? }`; a present workflowRootPath that is not a string, not absolute, or not an existing directory gets 400 with an error naming the field; otherwise call the addProjectByPath change task 2 ships with both values. Write the new route test with a real MultiProjectDashboardServer on a free port and temp homes, as health-route.test.ts:49-71 does, posting with Authorization Bearer and the secret read from the temp home | Restrictions: A body without workflowRootPath must produce the base call and response (Req 5 AC 6, an invariant: verified, not red-first); keep the 500 path for a thrown error; no change to makeRequireAccess | Success: a non-string, a relative and a missing-directory workflowRootPath each get 400 naming the field; a valid one gets 200 with projectId and projects.json holds both paths; `{ projectPath }` alone gets 200 with `{ projectId, success: true }`; a request without the secret gets 401_
 
 - [ ] 4. Create the controller client
   - File: src/bootstrap/controller-client.ts
@@ -43,7 +43,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: One module for every controller call `init` and `doctor` make, so the secret handling and the timeouts live in one place.
   - _Leverage: src/controller/access.ts, src/dashboard/utils.ts_
   - _Requirements: 5.1, 5.2, 5.7, 7.1, 7.4_
-  - _Prompt: Task: Implement design C6 per Req 5 AC 1, 2 and 7 and the Security and Performance NFRs. controllerUrl uses the url of the peek method task 1 adds when it returns an entry, else http://127.0.0.1: and SDD_PORT when that is a valid port, else 5000. readSecret reads and trims secretPath() (access.ts:25-28); missing or empty gives null. Both network calls use the global fetch with AbortSignal.timeout(timeoutMs), default 10000, the pattern of utils.ts:71-73. Test against a small local HTTP server on a free port | Restrictions: Never call loadOrCreateSecret (access.ts:40); no reason string contains the secret or a response body; add no host check (Req 5 AC 2 makes the host loopback by construction) | Success: controllerUrl picks the live session url, then SDD_PORT, then 5000, and ignores a non-numeric SDD_PORT; readSecret returns null for a missing or empty file and never creates one; registration sends the Bearer header and the JSON body, succeeds on 2xx with a string projectId, and reports no shared secret, not answering, timed out and the non-2xx status as distinct reasons; checkHealth passes only on 200 with ok true; a 200 ms timeout against a silent server fails within 1 second_
+  - _Prompt: Task: Implement design C6 per Req 5 AC 1, 2 and 7 and the Security and Performance NFRs. controllerUrl uses the url of the peek method task 1 adds when it returns an entry, else http://127.0.0.1: and SDD_PORT when that is a valid port, else 5000. readSecret reads and trims secretPath() (src/controller/access.ts:25-28); missing or empty gives null. Both network calls use the global fetch with AbortSignal.timeout(timeoutMs), default 10000, the pattern of src/dashboard/utils.ts:71-73. Test against a small local HTTP server on a free port | Restrictions: Never call loadOrCreateSecret (src/controller/access.ts:40); no reason string contains the secret or a response body; add no host check (Req 5 AC 2 makes the host loopback by construction) | Success: controllerUrl picks the live session url, then SDD_PORT, then 5000, and ignores a non-numeric SDD_PORT; readSecret returns null for a missing or empty file and never creates one; registration sends the Bearer header and the JSON body, succeeds on 2xx with a string projectId, and reports no shared secret, not answering, timed out and the non-2xx status as distinct reasons; checkHealth passes only on 200 with ok true; a 200 ms timeout against a silent server fails within 1 second_
 
 - [ ] 5. Ship the agent-rules template and the facts module
   - File: src/markdown/templates/agent-rules-template.md
@@ -55,7 +55,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Fill the three repository facts into a template the two existing readers accept.
   - _Leverage: src/dashboard/harness/run-setup.ts, src/core/gate-rules.ts, src/core/workspace-initializer.ts_
   - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9_
-  - _Prompt: Task: Write the template exactly as design C5 lists it (key lines at column 0, double-brace placeholders, one comment line per heading, design D6) and implement detectFacts, renderAgentRules and templatePath per Req 4 AC 3-5 (requirements D8). Type the second parameter of detectFacts as a local structural type with the optional testCommand, worktreeSetup and mergeMethod fields of design C3's InitArgs; this is the bridge task 7 removes | Restrictions: Do not add the template to WorkspaceInitializer's list (workspace-initializer.ts:52-57); an unreadable package.json means no runner, not an error | Success: the template holds the five key lines and four headings of Req 4 AC 1; detectFacts follows the override, then package-lock, pnpm-lock, yarn.lock order, and the override, then vitest, then jest order, and defaults mergeMethod to merge; a null fact drops its line; rendered output matches no double-brace placeholder; on a rendered file readAgentRules (run-setup.ts:68-137) returns worktree yes, merge auto, the mergeMethod and the worktreeSetup, and parseAgentRuleKey (gate-rules.ts:125-139) returns the test command or null_
+  - _Prompt: Task: Write the template exactly as design C5 lists it (key lines at column 0, double-brace placeholders, one comment line per heading, design D6) and implement detectFacts, renderAgentRules and templatePath per Req 4 AC 3-5 (requirements D8). Type the second parameter of detectFacts as a local structural type with the optional testCommand, worktreeSetup and mergeMethod fields of design C3's InitArgs; this is the bridge task 7 removes | Restrictions: Do not add the template to WorkspaceInitializer's list (src/core/workspace-initializer.ts:52-57); an unreadable package.json means no runner, not an error | Success: the template holds the five key lines and four headings of Req 4 AC 1; detectFacts follows the override, then package-lock, pnpm-lock, yarn.lock order, and the override, then vitest, then jest order, and defaults mergeMethod to merge; a null fact drops its line; rendered output matches no double-brace placeholder; on a rendered file readAgentRules (src/dashboard/harness/run-setup.ts:68-137) returns worktree yes, merge auto, the mergeMethod and the worktreeSetup, and parseAgentRuleKey (src/core/gate-rules.ts:125-139) returns the test command or null_
 
 - [ ] 6. Parse the `init` and `doctor` arguments
   - File: src/bootstrap/cli.ts
@@ -66,7 +66,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Reject every bad option before any file is touched (Req 6 AC 2).
   - _Leverage: src/index.ts_
   - _Requirements: 1.5, 1.6, 1.9_
-  - _Prompt: Task: Implement the design C2 grammar per Req 1 AC 5, 6 and 9: one positional; init options --store, --test-command, --worktree-setup and --merge-method as a separate token or after = (design D13); doctor takes none. Each error case of design C2 returns { error } naming the option or positional; a --test-command or --worktree-setup value with a backtick or a newline is an error (design D7). Expand ~ with the rule of expandTildePath (index.ts:120-125), copied, not exported. Declare a local InitArgs with the design C3 fields; this is the bridge task 7 removes | Restrictions: Parsing writes no file and does not resolve or stat the path; do not export anything from src/index.ts in this task | Success: both option forms parse; an unknown option, a value option that is last, empty after =, or followed by a double-dash token, a merge-method other than merge or squash, no positional, a second positional, and a command value with a backtick or newline each return an error naming it; a doctor option other than --help is an error; ~ expands to the home directory_
+  - _Prompt: Task: Implement the design C2 grammar per Req 1 AC 5, 6 and 9: one positional; init options --store, --test-command, --worktree-setup and --merge-method as a separate token or after = (design D13); doctor takes none. Each error case of design C2 returns `{ error }` naming the option or positional; a --test-command or --worktree-setup value with a backtick or a newline is an error (design D7). Expand ~ with the rule of expandTildePath (src/index.ts:120-125), copied, not exported. Declare a local InitArgs with the design C3 fields; this is the bridge task 7 removes | Restrictions: Parsing writes no file and does not resolve or stat the path; do not export anything from src/index.ts in this task | Success: both option forms parse; an unknown option, a value option that is last, empty after =, or followed by a double-dash token, a merge-method other than merge or squash, no positional, a second positional, and a command value with a backtick or newline each return an error naming it; a doctor option other than --help is an error; ~ expands to the home directory_
 
 - [ ] 7. Implement `init`
   - File: src/bootstrap/init.ts
@@ -78,7 +78,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Write `.mcp.json` and `agent-rules.md`, then register, with nothing written before every input is valid.
   - _Leverage: src/core/git-utils.ts, src/core/project-registry.ts_
   - _Requirements: 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.2, 4.6, 4.8, 5.1, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5_
-  - _Prompt: Task: Implement runInit per design C3 and Req 1 AC 7-8, Req 2, Req 3, Req 4 AC 2, 6 and 8, Req 5 AC 1 and 7, Req 6, and the Reliability NFR, using the controller client of task 4 and the facts module of task 5. Top level through gitTopLevel (git-utils.ts:152-158, design D5); realpath both roots (design D9); always send both paths (design D2); keep an existing agent-rules.md (requirements D3); replace only the spec-workflow entry (requirements D2); exit 2 keeps the files (requirements D4); the not-committed last line on exit 0 and 2 (design D8). Test against a fake controller (Fastify, installAccessControl, stub add route, SDD_PORT) with an explicit entryPath. Replace the local InitArgs of tasks 5 and 6 with an import of this module's export | Restrictions: Create no store directory other than .spec-workflow (requirements D10); write through a same-directory temp file and rename; never print the secret or an env value | Success: a missing path, a non-git path, a bad --store and malformed .mcp.json each exit 1 with no file written; a subdirectory acts on its top level; other keys and servers keep value and order and a missing mcpServers is added; the changed-entry line shows the was clause without env; env is the shared root with --store, else empty; output is two-space JSON plus newline; wrote, updated and kept lines and the registered line print; an existing agent-rules.md is byte-identical and a left-out fact prints its note; a byte-identical re-run prints kept twice and exits 0; no secret, missing controller and non-2xx exit 2 with the files kept; a rename spy shows same-directory temp files; no output line contains the secret or an env value_
+  - _Prompt: Task: Implement runInit per design C3 and Req 1 AC 7-8, Req 2, Req 3, Req 4 AC 2, 6 and 8, Req 5 AC 1 and 7, Req 6, and the Reliability NFR, using the controller client of task 4 and the facts module of task 5. Top level through gitTopLevel (src/core/git-utils.ts:152-158, design D5); realpath both roots (design D9); always send both paths (design D2); keep an existing agent-rules.md (requirements D3); replace only the spec-workflow entry (requirements D2); exit 2 keeps the files (requirements D4); the not-committed last line on exit 0 and 2 (design D8). Test against a fake controller (Fastify, installAccessControl, stub add route, SDD_PORT) with an explicit entryPath. Replace the local InitArgs of tasks 5 and 6 with an import of this module's export | Restrictions: Create no store directory other than .spec-workflow (requirements D10); write through a same-directory temp file and rename; never print the secret or an env value | Success: a missing path, a non-git path, a bad --store and malformed .mcp.json each exit 1 with no file written; a subdirectory acts on its top level; other keys and servers keep value and order and a missing mcpServers is added; the changed-entry line shows the was clause without env; env is the shared root with --store, else empty; output is two-space JSON plus newline; wrote, updated and kept lines and the registered line print; an existing agent-rules.md is byte-identical and a left-out fact prints its note; a byte-identical re-run prints kept twice and exits 0; no secret, missing controller and non-2xx exit 2 with the files kept; a rename spy shows same-directory temp files; no output line contains the secret or an env value_
 
 - [ ] 8. Implement `doctor` and export `ghBin`
   - File: src/bootstrap/doctor.ts
@@ -90,7 +90,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Name the first thing wrong with a configured repository without writing anything.
   - _Leverage: src/dashboard/harness/run-setup.ts, src/core/gate-rules.ts, src/controller/state.ts, src/core/git-utils.ts, scripts/stub-gh.mjs_
   - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
-  - _Prompt: Task: Implement runDoctor, runChecks and serviceEnv per design C4 and Req 7 AC 1-6: seven checks in order with the Req 7 AC 2 skips (requirements D6); the controller check through task 4's health call; the registered check through readProjects (state.ts:425-427); the remote check with scrubbedGitEnv (git-utils.ts:45-51); the token check runs execFile on ghBin with serviceEnv and timeoutMs, reading the callback error directly, not runCommand (merge.ts:150-172), and reports only a fixed reason or exit code (design D10, requirements D7). Validate the path as task 7 does. Run the token check against scripts/stub-gh.mjs through CONTROLLER_GH_BIN and STUB_GH_SCRIPT | Restrictions: Read the session file only through task 1's peek; create, write, rename or delete nothing; ghBin gains only export (design D11) | Success: each check passes, fails with its fix and skips per its dependency; the last line names the first failure and the exit is 1, else 0; the stub's argv sidecar shows api and the owner/repo path; a push false, a non-JSON stdout, a non-zero exit and a missing binary each fail token with a distinct reason; serviceEnv lets a file key replace the process key, keeps other keys, and returns the process env with no file; https, git@ and ssh origins parse; mtimes and listings of the repository, store and both homes are unchanged with a dead-pid session file present; a 200 ms timeout against a silent server fails within 1 second_
+  - _Prompt: Task: Implement runDoctor, runChecks and serviceEnv per design C4 and Req 7 AC 1-6: seven checks in order with the Req 7 AC 2 skips (requirements D6); the controller check through task 4's health call; the registered check through readProjects (src/controller/state.ts:425-427); the remote check with scrubbedGitEnv (src/core/git-utils.ts:45-51); the token check runs execFile on ghBin with serviceEnv and timeoutMs, reading the callback error directly, not runCommand (src/controller/merge.ts:150-172), and reports only a fixed reason or exit code (design D10, requirements D7). Validate the path as task 7 does. Run the token check against scripts/stub-gh.mjs through CONTROLLER_GH_BIN and STUB_GH_SCRIPT | Restrictions: Read the session file only through task 1's peek; create, write, rename or delete nothing; ghBin gains only export (design D11) | Success: each check passes, fails with its fix and skips per its dependency; the last line names the first failure and the exit is 1, else 0; the stub's argv sidecar shows api and the owner/repo path; a push false, a non-JSON stdout, a non-zero exit and a missing binary each fail token with a distinct reason; serviceEnv lets a file key replace the process key, keeps other keys, and returns the process env with no file; https, git@ and ssh origins parse; mtimes and listings of the repository, store and both homes are unchanged with a dead-pid session file present; a 200 ms timeout against a silent server fails within 1 second_
 
 - [ ] 9. Wire `init` and `doctor` into the entrypoint
   - File: src/index.ts
@@ -102,7 +102,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Make the two commands reachable from the binary without starting a server.
   - _Leverage: src/index.ts, src/__tests__/workspace-roots.test.ts_
   - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.10, 1.11_
-  - _Prompt: Task: Per design C1 and design D1 (Req 1 AC 1-3), branch in main before the help check (index.ts:378-384), dynamically import cli.ts as watch mode does (index.ts:400-406) and exit with the code returned. Per design C2, runBootstrapCommand prints that command's usage to stdout and returns 0 on --help anywhere (Req 1 AC 10), else parses with task 6's functions, prints one stderr line and returns 1 on an error, else runs task 7's or task 8's entry; an unexpected exception prints error and its message and returns 1. Add a SUBCOMMANDS block for both commands to showHelp (index.ts:22-118). Spawn the child test with the tsx loader resolved as workspace-roots.test.ts:514-517 does | Restrictions: Do not change CLI_FLAGS or parseArguments; import nothing from src/bootstrap statically in src/index.ts; start no Claude Code process and read no stdin (Req 1 AC 11) | Success: bootstrapCommand returns init and doctor for a first argument, null for a later position and for init-x; runBootstrapCommand returns 0 with the usage on --help and 1 with one stderr line on a bad option; showHelp contains init and doctor; a child init --help exits 0 with the init usage and no Starting banner; index-args.test.ts passes unchanged_
+  - _Prompt: Task: Per design C1 and design D1 (Req 1 AC 1-3), branch in main before the help check (src/index.ts:378-384), dynamically import cli.ts as watch mode does (src/index.ts:400-406) and exit with the code returned. Per design C2, runBootstrapCommand prints that command's usage to stdout and returns 0 on --help anywhere (Req 1 AC 10), else parses with task 6's functions, prints one stderr line and returns 1 on an error, else runs task 7's or task 8's entry; an unexpected exception prints error and its message and returns 1. Add a SUBCOMMANDS block for both commands to showHelp (src/index.ts:22-118). Spawn the child test with the tsx loader resolved as src/__tests__/workspace-roots.test.ts:514-517 does | Restrictions: Do not change CLI_FLAGS or parseArguments; import nothing from src/bootstrap statically in src/index.ts; start no Claude Code process and read no stdin (Req 1 AC 11) | Success: bootstrapCommand returns init and doctor for a first argument, null for a later position and for init-x; runBootstrapCommand returns 0 with the usage on --help and 1 with one stderr line on a bad option; showHelp contains init and doctor; a child init --help exits 0 with the init usage and no Starting banner; index-args.test.ts passes unchanged_
 
 - [ ] 10. End-to-end test: `init` then `doctor`
   - File: src/bootstrap/__tests__/init-doctor.e2e.test.ts
@@ -139,3 +139,4 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
 ## Revision History
 
 - **v1** (2026-10-20) — Initial draft.
+  - **Lint pass.** 22 fixed; rejected: L-1 (`peekDashboardSession` is the new method being added, not a claim about the cited range), L-2 (`mkdir` is described as absent, "no mkdir"), L-18 (`export` is the keyword being added; the citation anchors `ghBin`), L-26 (`init` is the command being documented; the citation anchors the subsection/key-table location). Prompt citations gained their directory prefixes (L-3 to L-25); the bare `:29-45` sibling on task 1 was repaired to `src/core/dashboard-session.ts:29-45`; the MDX acorn break (L-9) and its brace siblings on tasks 2, 3 and 6 were wrapped in code spans.

````
