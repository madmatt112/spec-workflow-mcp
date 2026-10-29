# Adversarial Review — dashboard-project-list/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-project-list tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-project-list` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since cef30246

````diff
diff --git a/.spec-workflow/specs/dashboard-project-list/tasks.md b/.spec-workflow/specs/dashboard-project-list/tasks.md
index e76fe5be..18f29ec6 100644
--- a/.spec-workflow/specs/dashboard-project-list/tasks.md
+++ b/.spec-workflow/specs/dashboard-project-list/tasks.md
@@ -72,7 +72,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - File: src/__tests__/index-args.test.ts
   - File: src/__tests__/server-shutdown.test.ts
   - Test: src/__tests__/index-args.test.ts — parseArguments(['--no-register'])
-  - Test: src/__tests__/server-shutdown.test.ts — new SpecWorkflowMCPServer().initialize(root, root, undefined, undefined, { register: false })
+  - Test: src/__tests__/server-shutdown.test.ts — `new SpecWorkflowMCPServer().initialize(root, root, undefined, undefined, { register: false })`
   - Count change: one more boolean flag. Find every list with `grep -rn -- "--no-workspace-inference" src/__tests__ docs/CONFIGURATION.md README.md`; update the exact flag list at `src/__tests__/index-args.test.ts:167-169` and the boolean-flag sentence at `docs/CONFIGURATION.md:29`.
   - Purpose: Let a launcher start a server that writes nothing to the registry.
   - _Leverage: src/index.ts (help OPTIONS at 37-65, CLI_FLAGS at 164-177, parseArguments at 206-221, initialize call at 662-668), src/server.ts (initialize at 160-165, registration at 185-195, stop at 280-306)_
@@ -83,8 +83,8 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - File: src/evals/runner.ts
   - File: src/evals/__tests__/runner.test.ts
   - File: src/evals/__tests__/runner-registry.test.ts (new)
-  - Test: src/evals/__tests__/runner.test.ts — runCases(ids, { step })
-  - Test: src/evals/__tests__/runner-registry.test.ts — runCases(ids, { step })
+  - Test: src/evals/__tests__/runner.test.ts — `runCases(ids, { step })`
+  - Test: src/evals/__tests__/runner-registry.test.ts — `runCases(ids, { step })`
   - R3 AC2 holds by construction (only the dashboard writes `projects.json`); it is not asserted.
   - Purpose: An eval run leaves the operator's registry untouched.
   - _Leverage: src/evals/runner.ts (RunCasesOpts at 42-49, runCases at 141-147, inline server entry at 190-197), src/evals/__tests__/runner.test.ts (makeLiveCheckout at 99, writeScript at 90, the stub-step case at 162), src/server.ts (startup lines at 195, stdin end at 234-236), vitest.setup.ts (per-worker home at 23-24)_
@@ -128,6 +128,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
   - File: e2e/worktree-project-list.spec.ts (new)
   - Test: e2e/worktree-project-list.spec.ts — test("a shared store counts once")
   - Run `npx playwright install chromium` first (agent-rules).
+  - Bridge: this task leaves the frontend NowModel without the row type and sidebar field; task 12 copies them in (C12, D6).
   - Purpose: Key the Specs and Deferrals counts, the filter and both page lists on the store.
   - _Leverage: ProjectProvider.tsx (Project at 8-13), Sidebar.tsx (counts at 39-44), SpecsPage.tsx (82-144), DeferralsPage.tsx (88-165), e2e/worktree-shell.spec.ts (harness setup at 100-115), e2e/helpers/worktree-harness.ts (resetSpecWorkflowHome at 246, waitForProjects at 614)_
   - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_
@@ -175,3 +176,4 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1
 ## Revision History
 
 - **v1** (2026-10-29) — Initial draft.
+  - **Lint pass.** 2 fixed; rejected: L-3 task 13 has `File: none` and changes no source, so the task-test-seam rule does not apply.

````
