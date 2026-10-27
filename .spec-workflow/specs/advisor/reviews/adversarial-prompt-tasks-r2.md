# Adversarial Review — advisor/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-tasks.md using this format:

```markdown
# Adversarial Review Memory — tasks
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): advisor tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 2e91e1ac

````diff
diff --git a/.spec-workflow/specs/advisor/tasks.md b/.spec-workflow/specs/advisor/tasks.md
index 193787c6..d96156af 100644
--- a/.spec-workflow/specs/advisor/tasks.md
+++ b/.spec-workflow/specs/advisor/tasks.md
@@ -1,6 +1,6 @@
 # Tasks Document
 
-Document version: v1
+Document version: v2
 
 Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19. Tasks 1-9 add standalone modules and type changes that no existing caller sees; 10-12 add the action store, then its executors, then its routes; 13-16 wire the endpoint, the second opinion, the pusher and the entry into the server; 17 is the browser surface, 18 the docs, 19 the end-to-end proof. Each task leaves `npx tsc --noEmit` clean and every existing suite green. Planned verifier spend: eleven tasks (1, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16) create a brand-new module, so each routes structural-red to high risk and one verifier; no task touches a path in the agent-rules sensitive list.
 
@@ -36,7 +36,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - Purpose: The typed second opinion rides the wait; an advice write never erases an answer.
   - _Leverage: src/controller/waits.ts (answerWait at 90, attachAdvice at 119)_
   - _Requirements: 5.2, 5.3, 5.8_
-  - _Prompt: Task: Add the WaitOpinion type and the opinion and opinionStatus fields of design Data Models to WaitRecord and both wire ControllerWait copies; give attachAdvice a trailing optional opinion argument; add an exported opinion-status setter; route answerWait, attachAdvice and the status setter through one in-process promise queue per wait id inside src/controller/waits.ts (design C7 wait writes, design D19, Requirement 5.2) | Restrictions: Existing waits.test.ts assertions at 183-191 and src/dashboard/__tests__/controller-waits-routes.test.ts:147-157 keep their exact values; the advice route keeps its body; Requirement 5.3 already holds at base (attachAdvice touches no run, controller.ts onWaitChange at 339 acts only on answered), so its test is a regression guard, not a red test | Success: waits.test.ts proves attachAdvice with an opinion stores both advice and opinion; a record with only an advice string still reads back unchanged (5.8); an answerWait and an attachAdvice started together on one id both land, answer kept; attachAdvice leaves the wait state and the run file unchanged (regression guard, 5.3); tsc clean_
+  - _Prompt: Task: Add the WaitOpinion type and the opinion and opinionStatus fields of design Data Models to WaitRecord and both wire ControllerWait copies; give attachAdvice a trailing optional opinion argument; add an exported opinion-status setter; route answerWait, attachAdvice and the status setter through one in-process promise queue per wait id inside src/controller/waits.ts (design C7 wait writes, design D19, Requirement 5.2) | Restrictions: Existing waits.test.ts assertions at 183-191 and src/dashboard/__tests__/controller-waits-routes.test.ts:147-157 keep their exact values; the advice route keeps its body; Requirement 5.3 already holds at base (attachAdvice touches no run, controller.ts onWaitChange at 339 acts only on answered), so its test is a regression guard, not a red test | Success: waits.test.ts proves attachAdvice with an opinion stores both advice and opinion; a record with only an advice string still reads back unchanged (5.8); an answerWait and an attachAdvice started together on one id both land, answer kept; the opinion-status setter started together with an answerWait on one id serialises through the queue and leaves the answer intact; attachAdvice leaves the wait state and the run file unchanged (regression guard, 5.3); tsc clean_
 
 - [ ] 4. Advisor credential and scoped access
   - File: src/controller/access.ts
@@ -120,11 +120,12 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
 - [ ] 12. Action routes and live updates
   - File: src/dashboard/multi-server.ts
   - File: src/dashboard/shell/shell-feed.ts
+  - File: src/dashboard/shell/types.ts
   - File: src/dashboard/harness/hub.ts
   - File: src/dashboard/shell/__tests__/shell-feed.test.ts
   - Test: src/dashboard/__tests__/advisor-routes.test.ts — POST /api/controller/actions/:id/confirm
-  - Register `GET /api/controller/actions`, `POST .../:id/confirm`, `POST .../:id/dismiss`; add a `controller-actions` feed message after the others (`src/dashboard/shell/shell-feed.ts:121-129`); the hub re-arms on the action events (`src/dashboard/harness/hub.ts:45-51`).
-  - Count change: run `grep -rn "quintet\|'controller-activity'" src` and move every pinned feed-message list from five to six (at least `src/dashboard/shell/__tests__/shell-feed.test.ts:275-284`).
+  - Register `GET /api/controller/actions`, `POST .../:id/confirm`, `POST .../:id/dismiss`; add the `controller-actions` member to the server `ShellMessage` union (`src/dashboard/shell/types.ts:207-212`) and the feed message after the others (`src/dashboard/shell/shell-feed.ts:121-129`); the hub re-arms on the action events (`src/dashboard/harness/hub.ts:45-51`). The dashboard surface consumes this message in the browser.
+  - Count change: run `grep -rn "quintet\|'controller-activity'" src/dashboard` and move every pinned feed-message list from five to six (at least `src/dashboard/shell/__tests__/shell-feed.test.ts:275-284`).
   - Purpose: The operator sees and confirms staged actions in the dashboard.
   - _Leverage: the action functions tasks 10-11 export; src/dashboard/__tests__/controller-waits-routes.test.ts as the route-test pattern_
   - _Requirements: 6.2, 6.3, 6.4_
@@ -174,11 +175,13 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
 
 - [ ] 17. Dashboard surface
   - File: src/dashboard_frontend/src/modules/shell/NowPage.tsx
-  - Render each pick and reason under its question in `AnswerSheet` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:351`), the opinion summary, else the legacy advice text (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:534`); add the "Second opinion" button, the "Staged by the advisor" group and the "Open advisor" button.
+  - File: src/dashboard_frontend/src/modules/shell/types.ts
+  - File: src/dashboard_frontend/src/modules/shell/ShellProvider.tsx
+  - Render each pick and reason under its question in `AnswerSheet` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:351`), the opinion summary, else the legacy advice text (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:534`); add the "Second opinion" button, the "Staged by the advisor" group and the "Open advisor" button. Own the browser consumption of the `controller-actions` message task 12 sends: the frontend `ShellMessage` union member (`src/dashboard_frontend/src/modules/shell/types.ts:224-229`), a subscription, a `controllerActions` state and a `ShellContextType` field in `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:22-32`.
   - Purpose: The operator presses for opinions and confirms actions in one place.
-  - _Leverage: src/dashboard_frontend/src/modules/shell/NowPage.tsx (DetailText at 288, the answer fetch at 367)_
+  - _Leverage: src/dashboard_frontend/src/modules/shell/NowPage.tsx (DetailText at 288, the answer fetch at 367); src/dashboard_frontend/src/modules/shell/ShellProvider.tsx (the controller-activity subscribe at 99-104, controllerActivity state at 64, ShellContextType at 22-32) as the pattern_
   - _Requirements: 5.2, 5.7, 5.8, 6.2, 6.3, 1.3, 1.4_
-  - _Prompt: Task: Per design C12, call the second-opinion route task 14 adds, the action routes task 12 adds and the open route task 16 adds; the button is disabled while opinionStatus is running and shows the failure reason when failed; the staged group shows kind, target, reason, conversation, Confirm, Dismiss and outcome, updated from the controller-actions feed message; Open advisor shows the session name or the command | Restrictions: Reuse the Now page CSS variables and primitives; no new dependency; vitest excludes src/dashboard_frontend (./vitest.config.ts:9), so there is no unit test | Success: npm run build:dashboard passes; a wait with an opinion shows each pick under its question, a wait with only advice text still shows it, the staged group lists an action and Confirm calls the confirm route_
+  - _Prompt: Task: Per design C12, call the second-opinion route task 14 adds, the action routes task 12 adds and the open route task 16 adds; the button is disabled while opinionStatus is running and shows the failure reason when failed; the staged group shows kind, target, reason, conversation, Confirm, Dismiss and outcome, live-updated from the controller-actions message — add that member to the frontend ShellMessage union, subscribe to it in ShellProvider, hold it in a controllerActions state and a ShellContextType field, and read the group in NowPage through useShell(); Open advisor shows the session name or the command | Restrictions: Reuse the Now page CSS variables and primitives; no new dependency; vitest excludes src/dashboard_frontend (./vitest.config.ts:9), so there is no unit test | Success: npm run build:dashboard passes; a wait with an opinion shows each pick under its question, a wait with only advice text still shows it, the staged group reads from the useShell() controllerActions context, lists an action and Confirm calls the confirm route_
 
 - [ ] 18. Docs and retirement steps
   - File: docs/SDD-HARNESS.md
@@ -220,5 +223,10 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
 
 ## Revision History
 
+- **v2** (2026-10-26) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/1/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Task 17 now owns the browser consumption of the new staged-action feed topic: its File list adds the browser shell wire-shapes file and the shell provider, and its prompt adds the frontend union member, the subscription, a state field and a context field read by the Now page. The staged group had no live-update owner before.
+  - **R1-2 — Accepted (MINOR).** Task 12's File list now carries the server shell wire-shapes module whose message union gains the new member, and its count-change grep is narrowed to the server dashboard tree so the frontend union stays with task 17.
+  - **R1-3 — Partially accepted (MINOR).** Task 3's success clause now asserts the opinion-status setter serialises through the per-wait queue beside a concurrent answer write; the setter's first downstream use stays in task 14, as the finding allows.
+  - **Lint pass.** 2 fixed: L-8 forward "task 17" reference reworded to name the dashboard surface by role; L-15 `ShellContextType` anchored to `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:22-32`. Rejected: L-13 task 17 is frontend-only and vitest excludes `src/dashboard_frontend` (D5), proven by `build:dashboard` + e2e, no unit-test seam; L-14 `controllerActions` is a new state field task 17 creates, not a base token. L-1/2/3/4/5/6/7/9/10/11/12 suppressed (rule 11): tokens unchanged since v1 rejected them (new symbols the task creates/extracts, or an SDK/enclosing class).
 - **v1** (2026-10-26) — Initial draft.
   - **Lint pass.** 9 fixed: L-3/L-4/L-8/L-13/L-19/L-20 bare test/component filenames given their directory prefix; L-21 root config given `./`; L-2/L-9 forward task-number references dropped (role body and purpose name consumers by role; the embedder hand-off names the verification evidence). Rejected: L-1 appendEvent, L-5 advisorSecretPath, L-6 loadOrCreateAdvisorSecret, L-7 ADVISOR_MCP_PATH, L-10 StagedAction, L-11 checkAnswerKeys, L-12 launchSpec, L-16 usageBlock — each is a new symbol this task creates or extracts, not a token the cited range anchors (writeJsonAtomic@298, makeRequireAccess@156/installAccessControl@191/loadOrCreateSecret@230-231, the moved route bodies@649-657 and @604-635, windowBlock@373-388 all verified present); L-14 Server, L-15 Controller — an SDK class and the enclosing class, not at the cited handler/method range; L-17 advisor — the new subcommand string, while the citations anchor bootstrapCommand@129-131 and the routing block; L-18 — D5 pins no frontend unit test (vitest excludes `src/dashboard_frontend`), proven by `build:dashboard` and the e2e checks.

````
