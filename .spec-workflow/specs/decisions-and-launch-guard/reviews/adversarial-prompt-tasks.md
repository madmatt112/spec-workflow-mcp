# Adversarial Review — decisions-and-launch-guard/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): decisions-and-launch-guard tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `decisions-and-launch-guard` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since d3561487

````diff
diff --git a/.spec-workflow/specs/decisions-and-launch-guard/tasks.md b/.spec-workflow/specs/decisions-and-launch-guard/tasks.md
index 1e5f84a2..3014ae15 100644
--- a/.spec-workflow/specs/decisions-and-launch-guard/tasks.md
+++ b/.spec-workflow/specs/decisions-and-launch-guard/tasks.md
@@ -44,11 +44,11 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
   - File: e2e/worktree-board.spec.ts
   - Test: e2e/worktree-board.spec.ts — `page.getByTestId('project-name-save-' + projectId).click()`
-  - Note: existing e2e values stay. `(R5 AC1)` at `:871` seeds an unregistered project, so its raw id still shows: regression guard. The new POST relies on the Origin rewrite in `src/dashboard_frontend/vite.config.ts:28-31`, which needs no edit.
+  - Note: existing e2e values stay. `(R5 AC1)` at `e2e/worktree-board.spec.ts:871` seeds an unregistered project, so its raw id still shows: regression guard. The new POST relies on the Origin rewrite in `src/dashboard_frontend/vite.config.ts:28-31`, which needs no edit.
   - Purpose: Where the operator sets a name, and the last page that printed an id.
   - _Leverage: src/dashboard_frontend/src/modules/shell/Gear.tsx:75-93, src/dashboard_frontend/src/modules/shell/harness.tsx:11-24, src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:106, src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280, src/dashboard_frontend/src/modules/shell/HomePage.tsx:121-128_
   - _Requirements: 1.1, 1.6, 1.7_
-  - _Prompt: Task: Per design C1 (requirement 1 AC 1, AC 6, AC 7), give each gear project row `project-rename-<id>`, input `project-name-input-<id>` and `project-name-save-<id>`. Save posts through `callHarness` (`src/dashboard_frontend/src/modules/shell/harness.tsx:11`), then calls `refreshProjects` (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:106`) and closes. On failure it shows the route's error and keeps the input open (design Error Handling 6). `ActionTile` takes `projectName: (id: string) => string`; `actionTarget` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280`) prints it for `t.project`; `HomePage` passes its existing lookup (`:59-62`). Run `npx playwright install chromium` first | Restrictions: Keep the rename controls outside the row's `label` (`Gear.tsx:78-90`), so the switch name does not change; add no other gear control | Success: saving a name shows it in the gear row and on a wait tile of that project with no reload; a 61-character save shows `display-name-invalid` with the input still open; saving an empty value restores the generated name; a staged action on a registered named project shows the name and not the id; an action on an unknown project shows the id (regression guard); `npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_
+  - _Prompt: Task: Per design C1 (requirement 1 AC 1, AC 6, AC 7), give each gear project row `project-rename-<id>`, input `project-name-input-<id>` and `project-name-save-<id>`. Save posts through `callHarness` (`src/dashboard_frontend/src/modules/shell/harness.tsx:11`), then calls `refreshProjects` (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:106`) and closes. On failure it shows the route's error and keeps the input open (design Error Handling 6). `ActionTile` takes `projectName: (id: string) => string`; `actionTarget` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280`) prints it for `t.project`; `HomePage` passes its existing lookup (`:59-62`). Run `npx playwright install chromium` first | Restrictions: Keep the rename controls outside the row's `label` (`src/dashboard_frontend/src/modules/shell/Gear.tsx:78-90`), so the switch name does not change; add no other gear control | Success: saving a name shows it in the gear row and on a wait tile of that project with no reload; a 61-character save shows `display-name-invalid` with the input still open; saving an empty value restores the generated name; a staged action on a registered named project shows the name and not the id; an action on an unknown project shows the id (regression guard); `npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_
 
 - [ ] 5. Build the launch guard module
   - File: src/dashboard/harness/launch-guard.ts
@@ -62,7 +62,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - Purpose: Compare a spec's files with each store project's code root.
   - _Leverage: src/dashboard/harness/run-setup.ts:23, src/dashboard/harness/run-setup.ts:230-239, src/core/task-parser.ts:332-345, src/dashboard/harness/types.ts:31-41, src/dashboard_frontend/src/modules/harness/types.ts:58_
   - _Requirements: 2.3, 2.6, 2.7, 2.8, NFR Performance, NFR Security_
-  - _Prompt: Task: Per design C2, Data Models, design D4, D5 and D6 (requirement 2 AC 3, AC 6, AC 7, AC 8), create `launch-guard.ts` with `specFileList`, `evaluateLaunchGuard`, `GuardProject` and `LaunchGuard`. Add exported `decompositionEntry` to `run-setup.ts` using `DECOMPOSITION_HEADING` (`:23`). Add optional `guard` to `SetupView` in both type files | Restrictions: `existsSync` only: no git call, no model call (NFR Performance); `buildSetupView` does not change | Success: with `tasks.md`, the list is the union of `task.files`, source `tasks`; a `tasks.md` with no `File:` entries gives `no-list` and reads no decomposition; with no `tasks.md`, backticked tokens holding a `/` are read with `:12` and `:12-30` suffixes removed, source `decomposition`; a bare `tiles.tsx` is dropped; no entry gives source `none`, `no-list`; each filter drops its path: absolute, a `..` segment, leading `~`, whitespace, `*`, `<`, leading `.spec-workflow/`; all filtered gives `no-list`; a path no store project holds leaves `compared`; another project holding strictly more gives `warn` with `useProject`; equal counts give `clear`; a tie among holders breaks on `projectName`; a path under two roots counts for both; `compared` 0 gives `clear` with no `useProject`; `listed`, `compared` and `held` are exact; `npx tsc --noEmit` and `npx vitest run src/dashboard/harness/__tests__/launch-guard.test.ts src/dashboard/harness/__tests__/run-setup.test.ts` pass_
+  - _Prompt: Task: Per design C2, Data Models, design D4, D5 and D6 (requirement 2 AC 3, AC 6, AC 7, AC 8), create `launch-guard.ts` with `specFileList`, `evaluateLaunchGuard`, `GuardProject` and `LaunchGuard`. Add exported `decompositionEntry` to `src/dashboard/harness/run-setup.ts` using `DECOMPOSITION_HEADING` (`:23`). Add optional `guard` to `SetupView` in both type files | Restrictions: `existsSync` only: no git call, no model call (NFR Performance); `buildSetupView` does not change | Success: with `tasks.md`, the list is the union of `task.files`, source `tasks`; a `tasks.md` with no `File:` entries gives `no-list` and reads no decomposition; with no `tasks.md`, backticked tokens holding a `/` are read with a trailing `:n` or `:n-n` suffix removed, source `decomposition`; a bare `tiles.tsx` is dropped; no entry gives source `none`, `no-list`; each filter drops its path: absolute, a `..` segment, leading `~`, whitespace, `*`, `<`, leading `.spec-workflow/`; all filtered gives `no-list`; a path no store project holds leaves `compared`; another project holding strictly more gives `warn` with `useProject`; equal counts give `clear`; a tie among holders breaks on `projectName`; a path under two roots counts for both; `compared` 0 gives `clear` with no `useProject`; `listed`, `compared` and `held` are exact; `npx tsc --noEmit` and `npx vitest run src/dashboard/harness/__tests__/launch-guard.test.ts src/dashboard/harness/__tests__/run-setup.test.ts` pass_
 
 - [ ] 6. Set the guard on the setup route
   - File: src/dashboard/multi-server.ts
@@ -83,7 +83,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - Test: src/dashboard/shell/__tests__/board-view.test.ts — `nextProjects(projects, enabled)`
   - Test: src/dashboard/shell/__tests__/board-view.test.ts — `launchPress(view, armedSpec)`
   - Test: e2e/worktree-board.spec.ts — `page.getByTestId('next-launch-' + projectId).click()`
-  - Note: asserted values change at, at least, `board-view.test.ts:634-690` and e2e `(R8 AC2)` `:2372`, `:2397`; widen to every assertion the change touches. Requirement 2 AC 5: regression guard.
+  - Note: asserted values change at, at least, `src/dashboard/shell/__tests__/board-view.test.ts:634-690` and e2e `(R8 AC2)` `e2e/worktree-board.spec.ts:2372`, `:2397`; widen to every assertion the change touches. Requirement 2 AC 5: regression guard.
   - Purpose: The tile names its repository and stops a wrong launch.
   - _Leverage: src/dashboard_frontend/src/modules/shell/board.ts:61-76, src/dashboard_frontend/src/modules/shell/tiles.tsx:245-273, src/dashboard_frontend/src/modules/shell/HomePage.tsx:180-197, src/dashboard_frontend/src/modules/shell/harness.tsx:40-52, e2e/worktree-board.spec.ts:304-316_
   - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9_
@@ -95,7 +95,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - Test: src/tools/__tests__/harness.test.ts — `parsePlanDecisions(content)`
   - Test: src/tools/__tests__/harness.test.ts — `answerChoosesNoChange(answer)`
   - Test: src/tools/__tests__/harness.test.ts — `classifyTarget(block)`
-  - Note: `harness.test.ts` and `closeout.test.ts:139-155` keep every asserted value.
+  - Note: `harness.test.ts` and `src/controller/phases/__tests__/closeout.test.ts:139-155` keep every asserted value.
   - Purpose: The parsers the close-out flow needs.
   - _Leverage: src/tools/harness.ts:485-517, src/tools/harness.ts:541-561, src/controller/runs.ts:340-363_
   - _Requirements: 3.1, 3.5, 3.7_
@@ -119,7 +119,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - File: src/controller/__tests__/ledger.test.ts
   - Test: src/core/__tests__/task-parser-tests.test.ts — `addTaskFiles(content, taskId, files)`
   - Test: src/controller/__tests__/ledger.test.ts — `openRunLedger(options).filePatch(fields)`
-  - Note: both test files keep every asserted value; add the row to the round-trip list at `ledger.test.ts:118`.
+  - Note: both test files keep every asserted value; add the row to the round-trip list at `src/controller/__tests__/ledger.test.ts:118`.
   - Purpose: A patch changes one list and leaves a parseable trace.
   - _Leverage: src/core/task-parser.ts:332-345, src/core/task-parser.ts:424-444, src/controller/ledger.ts:53-73, src/watch/ledger.ts:419-428_
   - _Requirements: 4.2, 4.3_
@@ -133,7 +133,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - File: src/tools/__tests__/harness.test.ts
   - Test: src/controller/phases/__tests__/implementation.test.ts — `runImplementationPhase(ctxFor(fx))`
   - Test: src/tools/__tests__/harness.test.ts — `harnessHandler({ action: 'brief', template: 'fix' })`
-  - Note: both test files keep every asserted value; `implementation.test.ts:484` is the AC 7 regression guard. AC 4 and AC 8 hold at base: regression guards.
+  - Note: both test files keep every asserted value; `src/controller/phases/__tests__/implementation.test.ts:484` is the AC 7 regression guard. AC 4 and AC 8 hold at base: regression guards.
   - Purpose: A genuine off-list file no longer waits on the operator.
   - _Leverage: src/controller/phases/implementation.ts:826-842, src/controller/phases/implementation.ts:880-893, src/controller/phases/implementation.ts:912, src/controller/phases/implementation.ts:921-947, src/tools/brief-templates.ts:797-807, harness/agents/sdd-implementer.md:31_
   - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, NFR Reliability_
@@ -178,7 +178,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - File: src/controller/__tests__/runs.test.ts
   - Test: src/controller/__tests__/state.test.ts — `writeRun(record, opts)`
   - Test: src/controller/__tests__/runs.test.ts — `runOnce(deps(fx, { ensureWorktree }), runId)`
-  - Note: both test files keep every asserted value. The terminal-status cases at `state.test.ts:186` and `pause-request.test.ts:71`, `:191`, `:203` write over `running` in a fresh home, so they hold.
+  - Note: both test files keep every asserted value. The terminal-status cases at `src/controller/__tests__/state.test.ts:186` and `src/controller/__tests__/pause-request.test.ts:71`, `:191`, `:203` write over `running` in a fresh home, so they hold.
   - Purpose: No late write can replace `abandoned`.
   - _Leverage: src/controller/state.ts:431-473, src/controller/state.ts:475-503, src/controller/runs.ts:429-435, src/controller/runs.ts:566-571, src/controller/controller.ts:806-813_
   - _Requirements: 7.3, 7.4_
@@ -221,7 +221,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - File: src/controller/__tests__/liveness-e2e.test.ts
   - Test: src/controller/__tests__/liveness-e2e.test.ts — `controller.cancel(id)`
   - Test: src/controller/__tests__/runs.test.ts — `runOnce(deps(fx), runId)`
-  - Note: both test files keep every asserted value; `runs.test.ts:447` still pauses a held run.
+  - Note: both test files keep every asserted value; `src/controller/__tests__/runs.test.ts:447` still pauses a held run.
   - Purpose: No retry, wait or status write follows a cancel.
   - _Leverage: src/controller/runs.ts:418-423, src/controller/runs.ts:754, src/controller/runs.ts:846-851, src/controller/runs.ts:868, src/controller/runs.ts:989, src/controller/runs.ts:1024, src/controller/runs.ts:1345-1347, src/controller/phases/document.ts:201-206_
   - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
@@ -248,7 +248,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - File: e2e/worktree-board.spec.ts
   - Test: src/dashboard/shell/__tests__/board-view.test.ts — `stopped(runs, enabled, now)`
   - Test: e2e/worktree-board.spec.ts — `page.locator('[data-testid^="band-"]')`
-  - Note: asserted values change at, at least, `board-view.test.ts:521-535` and the band test at e2e `:348-358`; widen to every assertion the change touches. Requirement 9 AC 4 holds at base: regression guard.
+  - Note: asserted values change at, at least, `src/dashboard/shell/__tests__/board-view.test.ts:521-535` and the band test at e2e `e2e/worktree-board.spec.ts:348-358`; widen to every assertion the change touches. Requirement 9 AC 4 holds at base: regression guard.
   - Purpose: The Running count means what it says.
   - _Leverage: src/dashboard_frontend/src/modules/shell/board.ts:35-59, src/dashboard_frontend/src/modules/shell/HomePage.tsx:18-39, src/dashboard_frontend/src/modules/shell/HomePage.tsx:163-197, src/dashboard_frontend/src/modules/shell/tiles.tsx:170-194_
   - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
@@ -262,7 +262,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
   - File: e2e/worktree-board.spec.ts
   - Test: src/controller/__tests__/runs.test.ts — `listRunsForWire(driven, branchRead)`
   - Test: src/controller/__tests__/controller.test.ts — `controller.discard(runId)`
-  - Note: the vitest values stay: seeds at `runs.test.ts:946`, `:1000` and `controller.test.ts:2458` share one `created`. The e2e seed changes, as the prompt says.
+  - Note: the vitest values stay: seeds at `src/controller/__tests__/runs.test.ts:946`, `:1000` and `src/controller/__tests__/controller.test.ts:2458` share one `created`. The e2e seed changes, as the prompt says.
   - Purpose: Discard of an old run cannot delete a newer run's branch.
   - _Leverage: src/controller/runs.ts:1410-1436, src/controller/runs.ts:1482-1488, src/controller/runs.ts:1490-1511, src/controller/controller.ts:388, src/dashboard/multi-server.ts:817-823_
   - _Requirements: 9.6_
@@ -316,3 +316,4 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 
 ## Revision History
 
 - **v1** (2026-11-07) — Initial draft.
+  - **Lint pass.** 21 fixed; rejected: none.

````
