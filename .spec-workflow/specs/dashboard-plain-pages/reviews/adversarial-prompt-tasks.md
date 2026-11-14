# Adversarial Review — dashboard-plain-pages/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam, task-e2e-marker on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-plain-pages tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-plain-pages` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 6cd635dc

````diff
diff --git a/.spec-workflow/specs/dashboard-plain-pages/tasks.md b/.spec-workflow/specs/dashboard-plain-pages/tasks.md
index 674ae1c9..a5798b26 100644
--- a/.spec-workflow/specs/dashboard-plain-pages/tasks.md
+++ b/.spec-workflow/specs/dashboard-plain-pages/tasks.md
@@ -36,7 +36,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
   - Test: src/dashboard/harness/__tests__/run-setup.test.ts — `decompositionHeadings(text)`
   - Test: src/dashboard/harness/__tests__/run-setup.test.ts — `launchableSpec(routing, workflowRoot, text)`
   - Test: src/dashboard/harness/__tests__/run-setup.test.ts — `nextUnstartedSpec(workflowRoot, text)`
-  - Note: the `buildSetupView` cases (`src/dashboard/harness/__tests__/run-setup.test.ts:552`) keep every asserted value: regression guards for the moved expression. `nextUnstartedSpec` called with no text holds at base: a regression guard.
+  - Note: the `buildSetupView` cases (`src/dashboard/harness/__tests__/run-setup.test.ts:552`) keep every asserted value: regression guards for the moved expression. `nextUnstartedSpec` (`src/dashboard/harness/run-setup.ts:230`) called with no text holds at base: a regression guard.
   - Purpose: The Specs builder and the setup view read one heading rule and one "next" rule.
   - _Leverage: src/dashboard/harness/run-setup.ts:23, src/dashboard/harness/run-setup.ts:202-205, src/dashboard/harness/run-setup.ts:230-239, src/core/spec-routing-deriver.ts:20_
   - _Requirements: 1.2, 2.5, 2.8_
@@ -47,7 +47,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
   - File: src/dashboard/shell/types.ts
   - File: src/dashboard/shell/__tests__/spec-rows.test.ts
   - Test: src/dashboard/shell/__tests__/spec-rows.test.ts — `buildSpecBlock(project, liveRuns, cache)`
-  - Note: `buildSpecRows` and `buildSpecDetail` stay until tasks 5 and 10; their suites keep every asserted value. The `isSpecClosed` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:620`) is a regression guard.
+  - Note: `buildSpecRows` (`src/dashboard/shell/__tests__/spec-rows.test.ts:279`) and `buildSpecDetail` (`src/dashboard/shell/__tests__/spec-rows.test.ts:483`) stay until tasks 5 and 10; their suites keep every asserted value. The `isSpecClosed` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:620`) is a regression guard.
   - Purpose: The decomposition of one store as numbered lines with one state word and one fact.
   - _Leverage: src/dashboard/shell/spec-rows.ts:78-82, src/dashboard/shell/spec-rows.ts:149-154, src/dashboard/harness/run-setup.ts:246-261, src/core/index-generator.ts:59-91, src/core/deferral-storage.ts:277-305_
   - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
@@ -94,7 +94,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
   - File: e2e/worktree-visual.spec.ts
   - File: e2e/worktree-board.spec.ts
   - Test: src/dashboard/__tests__/shell-routes.test.ts — `GET /api/shell/usage`
-  - Note: the closed-specs route and its cases stay until task 10. `src/dashboard/__tests__/controller-dashboard-routes.test.ts:172` is a regression guard. The visual parity test drops the `row` kind (D29): after this task one view at most renders a row.
+  - Note: the closed-specs route and its cases stay until the removal task. `src/dashboard/__tests__/controller-dashboard-routes.test.ts:172` is a regression guard. The visual parity test (`e2e/worktree-visual.spec.ts:415`) drops the `row` kind (D29): after this task one view at most renders a row.
   - Purpose: The Usage page answers how much of the week is left and how fast it goes.
   - _Leverage: src/dashboard/multi-server.ts:887-889, src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102, src/dashboard_frontend/src/modules/shell/UsagePage.tsx:117-120, e2e/worktree-board.spec.ts:3531-3581, e2e/worktree-visual.spec.ts:415-420_
   - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 8.1_
@@ -143,7 +143,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
 
 - [ ] 11. Run the end-to-end verification
   - File: e2e/worktree-shell.spec.ts
-  - Note: verification task: no `- Test:` seam, implementer-only; it changes no file. Requirement 3 AC 6 and requirement 8 AC 7 hold at base: `src/tools/__tests__/harness.test.ts` and `src/tools/__tests__/spec-index.test.ts` are their regression guards.
+  - Note: verification task: no `- Test:` seam, implementer-only; it changes no file. Requirement 3 AC 6 and requirement 8 AC 7 hold at base: `src/tools/__tests__/harness.test.ts` and `src/tools/__tests__/spec-index.test.ts` are their regression guards. The design's "Unchanged artifacts the decomposition names" — the overview and project watchers, the spec-index and deferrals tools, the usage action and the rate-limit file — stay unchanged, as the full suite confirms.
   - Purpose: Prove the entry's four verification steps on the merged tree.
   - _Leverage: ./playwright.worktree.config.ts, src/tools/__tests__/harness.test.ts, src/tools/__tests__/spec-index.test.ts_
   - _Requirements: 3.6, 8.6, 8.7_
@@ -170,3 +170,4 @@ Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 
 ## Revision History
 
 - **v1** (2026-11-14) — Initial draft.
+  - **Lint pass.** 6 fixed (L-1,L-2,L-3,L-4,L-6,L-7). L-1 — task 11 now names the design component "Unchanged artifacts the decomposition names", so coverage resolves. L-2/L-3/L-4/L-7 — anchored each stray identifier to its base location (`nextUnstartedSpec`→run-setup.ts:230, `buildSpecRows`→spec-rows.test.ts:279, `buildSpecDetail`→:483 full path, `row`→worktree-visual.spec.ts:415) so each resolves in its line's joined ranges. L-6 — reworded task 7's "task 10" to "the removal task" (cleanup note, not a dependency; house idiom). Rejected: L-5 — `blocks` is the to-be-built wire key this task introduces (retro F5/F9 class), no base range holds it; `rows` resolves at the cited cases; suppression carries it. L-8 — task 10 is a deletion task routed implementer-only per agent-rules (retro P10), so no `- Test:` line is correct.

````
