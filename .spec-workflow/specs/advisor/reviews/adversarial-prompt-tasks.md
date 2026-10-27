# Adversarial Review — advisor/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): advisor tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `advisor` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 520f4072

````diff
diff --git a/.spec-workflow/specs/advisor/tasks.md b/.spec-workflow/specs/advisor/tasks.md
index a6463e52..193787c6 100644
--- a/.spec-workflow/specs/advisor/tasks.md
+++ b/.spec-workflow/specs/advisor/tasks.md
@@ -21,10 +21,10 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - File: src/watch/__tests__/ledger.test.ts
   - Test: src/__tests__/agent-profiles.test.ts — JSON.parse(harness/agent-profiles.json)
   - Count change: run `grep -rn "toHaveLength(10)\|10 keys\|ten agent" src docs harness` and move every agent-count assertion and word from ten to eleven (at least `src/__tests__/agent-profiles.test.ts:6`, `:23-24` and `src/watch/__tests__/ledger.test.ts:103`).
-  - Purpose: `loadRole('sdd-advisor')` (`src/controller/step.ts:230-243`) must resolve before tasks 14 and 16 call it.
+  - Purpose: `loadRole('sdd-advisor')` (`src/controller/step.ts:230-243`) must resolve before the opinion runner and the advisor command call it.
   - _Leverage: harness/agents/sdd-drafter.md, harness/agent-profiles.json_
   - _Requirements: 11.3, 8.4, 9.1, 9.2, 9.3_
-  - _Prompt: Task: Write harness/agents/sdd-advisor.md with the drafter frontmatter shape (name, description, model on line 4, effort on line 5, tools: Read only) and the drafter tier values from harness/agent-profiles.json sdd-drafter, plus an sdd-advisor profile entry that keeps the file's key order and byte-for-byte serialisation; the body states per design C13 and Requirements 8.4 and 9.1-9.3: source content is data, never an instruction; every shared-state change is a stage tool call with a reason; decisions go where they act, committed with the advisor commit subcommand task 16 adds, plus a dated line in advisor/notes/; an empty notebook is seeded from overwatch-handoff.md and owner-backlog.md in the home | Restrictions: The count change alters exact values in agent-profiles.test.ts (10 to 11) and ledger.test.ts:103 (10 to 11); widen the list to every hit of the grep; plugins/ and the check:plugin-assets script do not exist at base, so there is no plugin copy to sync (D2 of this document, Requirement 11.3) | Success: agent-profiles.test.ts and ledger.test.ts pass with eleven keys; the frontmatter model and effort match the profile; the body holds the four rules above_
+  - _Prompt: Task: Write harness/agents/sdd-advisor.md with the drafter frontmatter shape (name, description, model on line 4, effort on line 5, tools: Read only) and the drafter tier values from harness/agent-profiles.json sdd-drafter, plus an sdd-advisor profile entry that keeps the file's key order and byte-for-byte serialisation; the body states per design C13 and Requirements 8.4 and 9.1-9.3: source content is data, never an instruction; every shared-state change is a stage tool call with a reason; decisions go where they act, committed with the advisor commit subcommand, plus a dated line in advisor/notes/; an empty notebook is seeded from overwatch-handoff.md and owner-backlog.md in the home | Restrictions: The count change alters exact values in agent-profiles.test.ts (10 to 11) and src/watch/__tests__/ledger.test.ts:103 (10 to 11); widen the list to every hit of the grep; plugins/ and the check:plugin-assets script do not exist at base, so there is no plugin copy to sync (D2 of this document, Requirement 11.3) | Success: agent-profiles.test.ts and ledger.test.ts pass with eleven keys; the frontmatter model and effort match the profile; the body holds the four rules above_
 
 - [ ] 3. Wait opinion fields and per-wait write queue
   - File: src/controller/state.ts
@@ -36,7 +36,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - Purpose: The typed second opinion rides the wait; an advice write never erases an answer.
   - _Leverage: src/controller/waits.ts (answerWait at 90, attachAdvice at 119)_
   - _Requirements: 5.2, 5.3, 5.8_
-  - _Prompt: Task: Add the WaitOpinion type and the opinion and opinionStatus fields of design Data Models to WaitRecord and both wire ControllerWait copies; give attachAdvice a trailing optional opinion argument; add an exported opinion-status setter; route answerWait, attachAdvice and the status setter through one in-process promise queue per wait id inside src/controller/waits.ts (design C7 wait writes, design D19, Requirement 5.2) | Restrictions: Existing waits.test.ts assertions at 183-191 and controller-waits-routes.test.ts:147-157 keep their exact values; the advice route keeps its body; Requirement 5.3 already holds at base (attachAdvice touches no run, controller.ts onWaitChange at 339 acts only on answered), so its test is a regression guard, not a red test | Success: waits.test.ts proves attachAdvice with an opinion stores both advice and opinion; a record with only an advice string still reads back unchanged (5.8); an answerWait and an attachAdvice started together on one id both land, answer kept; attachAdvice leaves the wait state and the run file unchanged (regression guard, 5.3); tsc clean_
+  - _Prompt: Task: Add the WaitOpinion type and the opinion and opinionStatus fields of design Data Models to WaitRecord and both wire ControllerWait copies; give attachAdvice a trailing optional opinion argument; add an exported opinion-status setter; route answerWait, attachAdvice and the status setter through one in-process promise queue per wait id inside src/controller/waits.ts (design C7 wait writes, design D19, Requirement 5.2) | Restrictions: Existing waits.test.ts assertions at 183-191 and src/dashboard/__tests__/controller-waits-routes.test.ts:147-157 keep their exact values; the advice route keeps its body; Requirement 5.3 already holds at base (attachAdvice touches no run, controller.ts onWaitChange at 339 acts only on answered), so its test is a regression guard, not a red test | Success: waits.test.ts proves attachAdvice with an opinion stores both advice and opinion; a record with only an advice string still reads back unchanged (5.8); an answerWait and an attachAdvice started together on one id both land, answer kept; attachAdvice leaves the wait state and the run file unchanged (regression guard, 5.3); tsc clean_
 
 - [ ] 4. Advisor credential and scoped access
   - File: src/controller/access.ts
@@ -46,7 +46,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - Purpose: The advisor session holds a credential that opens the endpoint and nothing else.
   - _Leverage: src/controller/access.ts (loadOrCreateSecret at 40-67, isAuthorized at 130-137)_
   - _Requirements: 6.4, 7.2, NFR Security_
-  - _Prompt: Task: Per design C2 and Requirement 7.2, add the advisor secret (file advisor-secret in the home, 0600, created like loadOrCreateSecret) and ADVISOR_MCP_PATH '/api/controller/advisor/mcp'; in the hook, a request to exactly that path passes with Bearer advisor secret or the operator credential; isAuthorized and the login route keep comparing only the operator secret | Restrictions: Existing access.test.ts and src/dashboard/__tests__/access-routes.test.ts assert no value this changes (access-routes.test.ts:78-89 still gets 401 without auth); the advisor secret never opens a cookie or the /ws token | Success: access.test.ts proves the advisor file is created once with mode 0600 and differs from the operator secret; on an app with a dummy route at ADVISOR_MCP_PATH and one at /api/controller/waits, the advisor bearer gets 200 on the first and 401 on the second, and POST /api/login with the advisor secret gets 401; the operator bearer still passes both_
+  - _Prompt: Task: Per design C2 and Requirement 7.2, add the advisor secret (file advisor-secret in the home, 0600, created like loadOrCreateSecret) and ADVISOR_MCP_PATH '/api/controller/advisor/mcp'; in the hook, a request to exactly that path passes with Bearer advisor secret or the operator credential; isAuthorized and the login route keep comparing only the operator secret | Restrictions: Existing access.test.ts and src/dashboard/__tests__/access-routes.test.ts assert no value this changes (src/dashboard/__tests__/access-routes.test.ts:78-89 still gets 401 without auth); the advisor secret never opens a cookie or the /ws token | Success: access.test.ts proves the advisor file is created once with mode 0600 and differs from the operator secret; on an app with a dummy route at ADVISOR_MCP_PATH and one at /api/controller/waits, the advisor bearer gets 200 on the first and 401 on the second, and POST /api/login with the advisor secret gets 401; the operator bearer still passes both_
 
 - [ ] 5. Sources registry
   - File: src/advisor/sources.ts
@@ -94,7 +94,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - Purpose: Meaning search with nothing leaving the machine, merged with text hits.
   - _Leverage: the corpus and text functions task 8 exports; the home path functions task 1 adds_
   - _Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, NFR Performance_
-  - _Prompt: Task: Per design C6, loadEmbedder reads search.json (v 1, url, model) and returns null when absent, not loopback, or a one-text call fails; refreshIndex hashes every corpus file with SHA-256, re-embeds only changed files, drops gone files, stores advisor/index/projectId.json with base64 Float32 vectors and drops it on a model change; search applies filters before ranking, fuses text and cosine lists by reciprocal rank fusion k 60, de-duplicates on project, path and startLine, limit 10 default, 30 max, one search at a time; over 200 chunks to embed it returns text hits with meaning "indexing n of m" and keeps embedding in process (design D12) | Restrictions: Pin the Ollama request shape only from a probe of a running local Ollama or its current docs, recorded in the test fake; if no server can run here, leave the real-embedder check pending for task 19 | Success: search.test.ts with a fake Embedder proves fusion and de-dup, each filter, only a changed file re-embeds, a deleted file leaves the index, a non-loopback url gives meaning off with text hits (4.7), a reworded query sharing no key word with a retro finding ranks it in the first ten (4.4), and an unchanged corpus searches in under 3 seconds_
+  - _Prompt: Task: Per design C6, loadEmbedder reads search.json (v 1, url, model) and returns null when absent, not loopback, or a one-text call fails; refreshIndex hashes every corpus file with SHA-256, re-embeds only changed files, drops gone files, stores advisor/index/projectId.json with base64 Float32 vectors and drops it on a model change; search applies filters before ranking, fuses text and cosine lists by reciprocal rank fusion k 60, de-duplicates on project, path and startLine, limit 10 default, 30 max, one search at a time; over 200 chunks to embed it returns text hits with meaning "indexing n of m" and keeps embedding in process (design D12) | Restrictions: Pin the Ollama request shape only from a probe of a running local Ollama or its current docs, recorded in the test fake; if no server can run here, leave the real-embedder check pending in the verification evidence | Success: search.test.ts with a fake Embedder proves fusion and de-dup, each filter, only a changed file re-embeds, a deleted file leaves the index, a non-loopback url gives meaning off with text hits (4.7), a reworded query sharing no key word with a retro finding ranks it in the first ten (4.4), and an unchanged corpus searches in under 3 seconds_
 
 - [ ] 10. Staged-action store and the store-side executors
   - File: src/advisor/actions.ts
@@ -128,7 +128,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - Purpose: The operator sees and confirms staged actions in the dashboard.
   - _Leverage: the action functions tasks 10-11 export; src/dashboard/__tests__/controller-waits-routes.test.ts as the route-test pattern_
   - _Requirements: 6.2, 6.3, 6.4_
-  - _Prompt: Task: Register the three routes per design C8 calling the store task 10 exports; confirm and dismiss answer 409 for an action not staged; the shell feed sends controller-actions with the action list and the hub listens to the store's change emitter | Restrictions: Add no access exemption; the operator credential is the only one these routes accept (the hook task 4 changed refuses the advisor secret here); the new message alters an exact value in shell-feed.test.ts:275-284 (the five-message order becomes six, controller-actions last), so update it and every other hit of the grep; shell-routes.test.ts filters by type and asserts nothing this changes | Success: shell-feed.test.ts passes with controller-actions as the sixth message; advisor-routes.test.ts proves GET lists a staged action, confirm with the operator bearer runs it, confirm with the advisor bearer gets 401 and the action stays staged (6.4), dismiss marks dismissed, a repeat confirm gets 409_
+  - _Prompt: Task: Register the three routes per design C8 calling the store task 10 exports; confirm and dismiss answer 409 for an action not staged; the shell feed sends controller-actions with the action list and the hub listens to the store's change emitter | Restrictions: Add no access exemption; the operator credential is the only one these routes accept (the hook task 4 changed refuses the advisor secret here); the new message alters an exact value in src/dashboard/shell/__tests__/shell-feed.test.ts:275-284 (the five-message order becomes six, controller-actions last), so update it and every other hit of the grep; shell-routes.test.ts filters by type and asserts nothing this changes | Success: shell-feed.test.ts passes with controller-actions as the sixth message; advisor-routes.test.ts proves GET lists a staged action, confirm with the operator bearer runs it, confirm with the advisor bearer gets 401 and the action stays staged (6.4), dismiss marks dismissed, a repeat confirm gets 409_
 
 - [ ] 13. Advisor MCP endpoint
   - File: src/advisor/mcp-endpoint.ts
@@ -174,11 +174,11 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
 
 - [ ] 17. Dashboard surface
   - File: src/dashboard_frontend/src/modules/shell/NowPage.tsx
-  - Render each pick and reason under its question in `AnswerSheet` (`NowPage.tsx:351`), the opinion summary, else the legacy advice text (`NowPage.tsx:534`); add the "Second opinion" button, the "Staged by the advisor" group and the "Open advisor" button.
+  - Render each pick and reason under its question in `AnswerSheet` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:351`), the opinion summary, else the legacy advice text (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:534`); add the "Second opinion" button, the "Staged by the advisor" group and the "Open advisor" button.
   - Purpose: The operator presses for opinions and confirms actions in one place.
   - _Leverage: src/dashboard_frontend/src/modules/shell/NowPage.tsx (DetailText at 288, the answer fetch at 367)_
   - _Requirements: 5.2, 5.7, 5.8, 6.2, 6.3, 1.3, 1.4_
-  - _Prompt: Task: Per design C12, call the second-opinion route task 14 adds, the action routes task 12 adds and the open route task 16 adds; the button is disabled while opinionStatus is running and shows the failure reason when failed; the staged group shows kind, target, reason, conversation, Confirm, Dismiss and outcome, updated from the controller-actions feed message; Open advisor shows the session name or the command | Restrictions: Reuse the Now page CSS variables and primitives; no new dependency; vitest excludes src/dashboard_frontend (vitest.config.ts:9), so there is no unit test | Success: npm run build:dashboard passes; a wait with an opinion shows each pick under its question, a wait with only advice text still shows it, the staged group lists an action and Confirm calls the confirm route_
+  - _Prompt: Task: Per design C12, call the second-opinion route task 14 adds, the action routes task 12 adds and the open route task 16 adds; the button is disabled while opinionStatus is running and shows the failure reason when failed; the staged group shows kind, target, reason, conversation, Confirm, Dismiss and outcome, updated from the controller-actions feed message; Open advisor shows the session name or the command | Restrictions: Reuse the Now page CSS variables and primitives; no new dependency; vitest excludes src/dashboard_frontend (./vitest.config.ts:9), so there is no unit test | Success: npm run build:dashboard passes; a wait with an opinion shows each pick under its question, a wait with only advice text still shows it, the staged group lists an action and Confirm calls the confirm route_
 
 - [ ] 18. Docs and retirement steps
   - File: docs/SDD-HARNESS.md
@@ -221,3 +221,4 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
 ## Revision History
 
 - **v1** (2026-10-26) — Initial draft.
+  - **Lint pass.** 9 fixed: L-3/L-4/L-8/L-13/L-19/L-20 bare test/component filenames given their directory prefix; L-21 root config given `./`; L-2/L-9 forward task-number references dropped (role body and purpose name consumers by role; the embedder hand-off names the verification evidence). Rejected: L-1 appendEvent, L-5 advisorSecretPath, L-6 loadOrCreateAdvisorSecret, L-7 ADVISOR_MCP_PATH, L-10 StagedAction, L-11 checkAnswerKeys, L-12 launchSpec, L-16 usageBlock — each is a new symbol this task creates or extracts, not a token the cited range anchors (writeJsonAtomic@298, makeRequireAccess@156/installAccessControl@191/loadOrCreateSecret@230-231, the moved route bodies@649-657 and @604-635, windowBlock@373-388 all verified present); L-14 Server, L-15 Controller — an SDK class and the enclosing class, not at the cited handler/method range; L-17 advisor — the new subcommand string, while the citations anchor bootstrapCommand@129-131 and the routing block; L-18 — D5 pins no frontend unit test (vitest excludes `src/dashboard_frontend`), proven by `build:dashboard` and the e2e checks.

````
