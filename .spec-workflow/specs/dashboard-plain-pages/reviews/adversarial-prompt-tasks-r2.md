# Adversarial Review — dashboard-plain-pages/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-tasks.md using this format:

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
- Label every MUST_FIX and SHOULD_FIX, in the analysis and the report arrays, with a `[drafting] ` or `[design] ` prefix. A drafting defect is one the reviser can fix with no change to a requirement, a design choice or the scope: a wrong citation, a stale count, wording, or a lint failure. Every other item is a design defect.
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam, task-e2e-marker on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-plain-pages tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 38062ac4

````diff
diff --git a/.spec-workflow/specs/dashboard-plain-pages/tasks.md b/.spec-workflow/specs/dashboard-plain-pages/tasks.md
index a5798b26..d8041d14 100644
--- a/.spec-workflow/specs/dashboard-plain-pages/tasks.md
+++ b/.spec-workflow/specs/dashboard-plain-pages/tasks.md
@@ -1,6 +1,6 @@
 # Tasks Document
 
-Document version: v1
+Document version: v2
 
 Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 → 7; 3 → 4 → 5; 8 → 9; tasks 5, 7 and 9 → 10; task 11 runs last. Each page task (5, 7, 9) changes its wire or route, its frontend page and the end-to-end suites that read that page in one commit, so no page is left empty between tasks. Each task leaves `npx tsc --noEmit` and every vitest suite green; tsc does not cover `src/dashboard_frontend/` (`./tsconfig.json:20`), so frontend tasks prove their code through `src/dashboard/__tests__/frontend-build.test.ts` (a vite build) and Playwright. Line citations are to base 1054a946; where an earlier task here edited the file, the named symbol is the anchor and the implementer re-resolves the line. If SPEC_WORKFLOW_SHARED_ROOT is set in the session, run vitest as `env -u SPEC_WORKFLOW_SHARED_ROOT -u SPEC_WORKFLOW_WORKSPACE npx vitest run …`. Tasks 1 and 6 add new modules, so expect at least two verifier spawns. Task 9 carries `kind: e2e`; tasks 10 and 11 carry no `- Test:` seam; all three route implementer-only.
 
@@ -47,7 +47,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
   - File: src/dashboard/shell/types.ts
   - File: src/dashboard/shell/__tests__/spec-rows.test.ts
   - Test: src/dashboard/shell/__tests__/spec-rows.test.ts — `buildSpecBlock(project, liveRuns, cache)`
-  - Note: `buildSpecRows` (`src/dashboard/shell/__tests__/spec-rows.test.ts:279`) and `buildSpecDetail` (`src/dashboard/shell/__tests__/spec-rows.test.ts:483`) stay until tasks 5 and 10; their suites keep every asserted value. The `isSpecClosed` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:620`) is a regression guard.
+  - Note: `buildSpecRows` (`src/dashboard/shell/__tests__/spec-rows.test.ts:279`) and `buildSpecDetail` (`src/dashboard/shell/__tests__/spec-rows.test.ts:483`) stay until the feed task and the removal task; their suites keep every asserted value. The `isSpecClosed` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:620`) is a regression guard.
   - Purpose: The decomposition of one store as numbered lines with one state word and one fact.
   - _Leverage: src/dashboard/shell/spec-rows.ts:78-82, src/dashboard/shell/spec-rows.ts:149-154, src/dashboard/harness/run-setup.ts:246-261, src/core/index-generator.ts:59-91, src/core/deferral-storage.ts:277-305_
   - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
@@ -72,7 +72,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
   - Purpose: The Specs page shows each enabled store's decomposition and nothing else.
   - _Leverage: src/dashboard/shell/shell-feed.ts:91-103, src/dashboard/shell/store-groups.ts:25-42, src/dashboard_frontend/src/modules/projects/stores.ts:25-49, src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-39, src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:60_
   - _Requirements: 1.1, 1.6, 1.7, 1.8, 2.9, 8.3_
-  - _Prompt: Task: Per design C5, C8, C11 and design D17, D21, D24 (requirement 1 AC 1, AC 6 to AC 8, requirement 2 AC 9), make `flush` (`src/dashboard/shell/shell-feed.ts:91-103`) call the builder task 4 exports per store group with the live runs of every member, and send `{ blocks }`. Delete `buildSpecRows`, `newestRunAbandoned`, `pickNewer`, both `SpecListRow` copies and the `buildSpecRows` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:279`). `ShellProvider` stores `specBlocks`; rewrite `SpecsPage.tsx` per design C8 with its test ids, keeping `data-testid="page-list"` on the page root (D27); `SpecPanel` and `FileRow` go. Move the toggle case (`e2e/worktree-shell.spec.ts:228-246`) to `spec-line-` ids and delete the panel-stacking case (`:248-260`). Each e2e suite seeds a `decomposition.md` naming its specs before its servers start (D30); the visual Specs view waits for a block, no panel | Restrictions: Keep the five-topic order; do not change `e2e/helpers/worktree-harness.ts`; run `npx playwright install chromium` first | Success: `shell-specs` carries `blocks`, one per store; two projects on one store give one block with the representative's id; a group whose builder throws is left out while the other group's block is sent; the topic order is unchanged; on the page, toggling project B off hides its `spec-line-` and survives a reload; a `(deferred)` heading whose entry names `d-0000abcd` shows `deferred` and `d-0000abcd`; `grep -rn "buildSpecRows\|SpecListRow\|SpecPanel" src --include='*.ts' --include='*.tsx' --exclude-dir=__tests__` finds nothing; `npx tsc --noEmit`, `npx vitest run src/dashboard/shell/__tests__/shell-feed.test.ts src/dashboard/shell/__tests__/spec-rows.test.ts src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-no-shared.spec.ts e2e/worktree-project-list.spec.ts e2e/worktree-visual.spec.ts` pass_
+  - _Prompt: Task: Per design C5, C8, C11 and design D17, D21, D24 (requirement 1 AC 1, AC 6 to AC 8, requirement 2 AC 9), make `flush` (`src/dashboard/shell/shell-feed.ts:91-103`) call the builder task 4 exports per store group with the live runs of every member, and send `{ blocks }`. Delete `buildSpecRows`, `newestRunAbandoned`, `pickNewer`, both `SpecListRow` copies and the `buildSpecRows` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:279`). `ShellProvider` stores `specBlocks`; rewrite `SpecsPage.tsx` per design C8 with its test ids, keeping `data-testid="page-list"` on the page root (D27); `SpecPanel` and `FileRow` go. Move the toggle case (`e2e/worktree-shell.spec.ts:228-246`) to `spec-line-` ids and delete the panel-stacking case (`:248-260`). Each e2e suite seeds a `decomposition.md` naming its specs before its servers start (D30); the visual Specs view waits for a block, no panel | Restrictions: Keep the five-topic order; do not change `e2e/helpers/worktree-harness.ts`; run `npx playwright install chromium` first | Success: `shell-specs` carries `blocks`, one per store; two projects on one store give one block with the representative's id; a group whose builder throws is left out while the other group's block is sent; the topic order is unchanged; on the page, toggling project B off hides its `spec-line-` and survives a reload; a `(deferred)` heading whose entry names `d-0000abcd` shows `deferred` and `d-0000abcd`; `grep -rn "buildSpecRows\|SpecListRow\|SpecPanel" src --include='*.ts' --include='*.tsx' --exclude-dir=__tests__ --exclude=usage-rows.ts` finds nothing (`usage-rows.ts` keeps a `buildSpecRows` comment until the removal task deletes it); `npx tsc --noEmit`, `npx vitest run src/dashboard/shell/__tests__/shell-feed.test.ts src/dashboard/shell/__tests__/spec-rows.test.ts src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-no-shared.spec.ts e2e/worktree-project-list.spec.ts e2e/worktree-visual.spec.ts` pass_
 
 - [ ] 6. Build the usage view on the server
   - File: src/dashboard/shell/usage-view.ts
@@ -83,7 +83,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
   - Purpose: The window, the burn and one line per live run with its fit, computed in one place.
   - _Leverage: src/controller/state.ts:593-595, src/dashboard/shell/live-runs.ts:10-18, src/controller/runs.ts:585-587, src/core/task-parser.ts:553, src/controller/ledger.ts:160-166_
   - _Requirements: 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_
-  - _Prompt: Task: Per design C6 and design D8, D11, D18, D20, D26 (requirement 4 AC 4, AC 5, requirement 5 AC 1 to AC 5), create `src/dashboard/shell/usage-view.ts` with `buildUsageView` as design C6 pins it, reading the log through the reader, burn and attribution functions task 1 exports. Export `totalW` (`src/controller/runs.ts:585-587`) unchanged. Add `UsageView` and `UsageRunLine` (design Data Models) to `src/dashboard/shell/types.ts` | Restrictions: Read-only; never throw; the test sets `SDD_HOME` to a temporary directory and seeds run records, `rate-limit.json`, the log, a spec's `tasks.md` and `harness-events.jsonl` | Success: an implementation run with three distinct `task.done` rows, attributed log lines and a future reset reads `fits` when use per task times remaining is within the headroom and `does-not-fit` when not; the fit is `null` for a document-phase run, for zero tasks done, for no attributed line, for a passed reset and for a missing `tasks.md`; a repeated `task.done` row for one task counts once and a row of another run does not count; no `rate-limit.json` gives `window: null`; `burn` equals the task 1 burn of the same lines; a live run of a project absent from `projects` is listed with its project id as name; done and abandoned runs are not listed; `tokens` is the sum of the four kinds; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/usage-view.test.ts` pass_
+  - _Prompt: Task: Per design C6 and design D8, D11, D18, D20, D26 (requirement 4 AC 4, AC 5, requirement 5 AC 1 to AC 5), create `src/dashboard/shell/usage-view.ts` with `buildUsageView` as design C6 pins it, reading the log through the reader, burn and attribution functions task 1 exports. Export `totalW` (`src/controller/runs.ts:585-587`) unchanged. Add `UsageView` and `UsageRunLine` (design Data Models) to `src/dashboard/shell/types.ts` | Restrictions: Read-only; never throw; the test sets `SDD_HOME` to a temporary directory and seeds run records, `rate-limit.json`, the log, a spec's `tasks.md` and `harness-events.jsonl` | Success: an implementation run with three distinct `task.done` rows, attributed log lines and a future reset reads `fits` when use per task times remaining is within the headroom and `does-not-fit` when not; the fit is `null` for a document-phase run, for zero tasks done, for no attributed line, for a passed reset, for a missing `tasks.md` and for a null window (no `rate-limit.json`); a repeated `task.done` row for one task counts once and a row of another run does not count; no `rate-limit.json` gives `window: null`; `burn` equals the task 1 burn of the same lines; a live run of a project absent from `projects` is listed with its project id as name; done and abandoned runs are not listed; `tokens` is the sum of the four kinds; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/usage-view.test.ts` pass_
 
 - [ ] 7. Serve the usage view and render the Usage page
   - File: src/dashboard/multi-server.ts
@@ -119,7 +119,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
   - Purpose: One table of open records, oldest first, each with Resolve.
   - _Leverage: src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:54-57, src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:211, src/dashboard_frontend/vite.config.ts:27-46, e2e/worktree-shell.spec.ts:262-288_
   - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.7, 7.8, 7.9_
-  - _Prompt: Task: Per design C10 and design D22 (requirement 6, requirement 7 AC 1 to AC 3, AC 7 to AC 9), rewrite `DeferralsPage.tsx` with the columns, sort, Resolve box and test ids design C10 pins, posting to the route task 8 adds; keep `data-testid="page-list"` on the page root (D27) and render a non-empty owner as a neutral `Pill` (D28). Replace the owner-chip case (`e2e/worktree-shell.spec.ts:262-288`) with the queue and Resolve cases; the visual Deferrals view waits for a row, no panel. Run `npx playwright install chromium` first | Restrictions: No chips, search, pager or panel; never assert a row's absence before its settling signal | Success: three open rows show oldest first with age, id, project, spec, tag, owner and summary in that order; `matthew` shows in its owner cell; no `chip-` test id exists; Cancel closes the box and the file stays `deferred`; the confirm is disabled with empty text; confirm with text writes `status: resolved` and the text, and after the row count drops to 2 (the `deferrals-update` settling signal) the file is asserted; a routed 409 shows its `error`, keeps the typed text and the box open; with every project toggled off the page shows `Queue empty`, and the toggles are turned back on before the case ends; `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-visual.spec.ts e2e/worktree-project-list.spec.ts` pass_
+  - _Prompt: Task: Per design C10 and design D22 (requirement 6, requirement 7 AC 1 to AC 3, AC 7 to AC 9), rewrite `DeferralsPage.tsx` with the columns, sort, Resolve box and test ids design C10 pins, posting to the route task 8 adds; keep `data-testid="page-list"` on the page root (D27) and render a non-empty owner as a neutral `Pill` (D28). Replace the owner-chip case (`e2e/worktree-shell.spec.ts:262-288`) with the queue and Resolve cases; the visual Deferrals view waits for a row, no panel. Run `npx playwright install chromium` first | Restrictions: No chips, search, pager or panel; never assert a row's absence before its settling signal | Success: three open rows show oldest first with age, id, project, spec, tag, owner and summary in that order; `matthew` shows in its owner cell; no `chip-` test id exists; Cancel closes the box and the file stays `deferred`; the confirm is disabled with empty text, and disabled while a resolve request is in flight (delay the route, click confirm, assert it disabled before the reply, so one press sends one request); confirm with text writes `status: resolved` and the text, and after the row count drops to 2 (the `deferrals-update` settling signal) the file is asserted; a routed 409 shows its `error`, keeps the typed text and the box open; with every project toggled off the page shows `Queue empty`, and the toggles are turned back on before the case ends; `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-visual.spec.ts e2e/worktree-project-list.spec.ts` pass_
 
 - [ ] 10. Remove the dead routes, builders, types and components
   - File: src/dashboard/multi-server.ts
@@ -169,5 +169,11 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
 
 ## Revision History
 
+- **v2** (2026-11-14) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 1/1/2).
+  - **R1-1 — Accepted (MUST_FIX).** Task 5's removal grep matched the retired name in the usage-rows comment prose, a file task 10 deletes and not on task 5's File list, so it would stall file-outside-list. Scoped the grep to exclude that file by name and noted why; it still walks every task-5-owned file, so a real residual is still caught (line 75). The sibling scrub grep in task 10 was re-checked and is clean.
+  - **R1-2 — Accepted (SHOULD_FIX).** Task 9's Success named only the empty-text disable, dropping requirement 7's in-flight trigger; task 9 is implementer-only so nothing backstopped it. Added the in-flight sub-case as a positive assertion that delays the route and asserts the confirm disabled before the reply, with its settling wait (line 122).
+  - **R1-3 — Accepted (MINOR).** Task 6's fit-null enumeration omitted the null-window case that design pins. Added "for a null window (no rate-limit file)" to the fit-null list (line 86).
+  - **R1-4 — Rejected (MINOR).** The empty-state display strings stay unpinned: the builder nulls are tested and the page Success lines already assert the primary rendered strings; pinning every empty-state string across the three pages adds end-to-end breadth beyond the finding's value, which the analysis itself treated as a pattern note, not a loop-keeper.
+  - **Lint pass.** 1 fixed (L-1); rejected: L-2 (`blocks` is the to-be-built wire key this task introduces; base ranges hold `rows`, rejected v1 as L-5, rule 11 suppresses the re-fire), L-3 (task 10 is a deletion task routed implementer-only per agent-rules P10, so no `- Test:` seam is correct). L-1 — reworded task 5's forward `task 10` to `the removal task` (house idiom per v1 L-6 and D33); fixed the sibling forward reference in task 4's Note (`tasks 5 and 10` → `the feed task and the removal task`).
 - **v1** (2026-11-14) — Initial draft.
   - **Lint pass.** 6 fixed (L-1,L-2,L-3,L-4,L-6,L-7). L-1 — task 11 now names the design component "Unchanged artifacts the decomposition names", so coverage resolves. L-2/L-3/L-4/L-7 — anchored each stray identifier to its base location (`nextUnstartedSpec`→run-setup.ts:230, `buildSpecRows`→spec-rows.test.ts:279, `buildSpecDetail`→:483 full path, `row`→worktree-visual.spec.ts:415) so each resolves in its line's joined ranges. L-6 — reworded task 7's "task 10" to "the removal task" (cleanup note, not a dependency; house idiom). Rejected: L-5 — `blocks` is the to-be-built wire key this task introduces (retro F5/F9 class), no base range holds it; `rows` resolves at the cited cases; suppression carries it. L-8 — task 10 is a deletion task routed implementer-only per agent-rules (retro P10), so no `- Test:` line is correct.

````
