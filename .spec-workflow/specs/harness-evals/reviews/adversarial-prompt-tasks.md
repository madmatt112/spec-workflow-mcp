# Adversarial Review — harness-evals/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): harness-evals tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `harness-evals` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 01c3c1d8

````diff
diff --git a/.spec-workflow/specs/harness-evals/tasks.md b/.spec-workflow/specs/harness-evals/tasks.md
index 11d2544f..047b69f5 100644
--- a/.spec-workflow/specs/harness-evals/tasks.md
+++ b/.spec-workflow/specs/harness-evals/tasks.md
@@ -132,7 +132,7 @@ Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the grade
   - Purpose: the first cases guard the drafter and test-author failures (R5 AC1); `npm test` validates every case (R1 AC5).
   - _Leverage: design Component 13 (case-author contract, fixtures, turn caps), src/tools/harness.ts:707-712 (test-author `- Test:` check)_
   - _Requirements: 1.5, 5.1, 5.4_
-  - _Prompt: Task: Per R5 AC1, R1 AC5 and design Component 13, write each case's `case.json`, fixture trees and pre-commit hook, with the evidence its R5 AC1 entry cites and `spec` values starting `eval-` (D1). cases.test.ts runs for every listed id: `loadCase` succeeds, `harness/agents/<role>.md` exists, the fixture builds, every brief renders with no missing key, every grader is in the registry; it also asserts the three ids are listed. Regression guard, not red-first: R5 AC4's base pass of the two test-author cases is a live check, recorded by task 16, not a unit test | Restrictions: no model; the drafter `docPath` equals the grader's `doc` arg; the hook runs `node --test` with no tests-only carve-out; no agent-rules plugin sync applies (no `plugins/` tree at base) | Success: the three cases load, build and render; cases.test.ts asserts their ids and passes_
+  - _Prompt: Task: Per R5 AC1, R1 AC5 and design Component 13, write each case's `case.json`, fixture trees and pre-commit hook, with the evidence its R5 AC1 entry cites and `spec` values starting `eval-` (D1). cases.test.ts runs for every listed id: `loadCase` succeeds, `harness/agents/<role>.md` exists, the fixture builds, every brief renders with no missing key, every grader is in the registry; it also asserts the three ids are listed. Regression guard, not red-first: R5 AC4's base pass of the two test-author cases is a live check, recorded by the pending verification record, not a unit test | Restrictions: no model; the drafter `docPath` equals the grader's `doc` arg; the hook runs `node --test` with no tests-only carve-out; no agent-rules plugin sync applies (no `plugins/` tree at base) | Success: the three cases load, build and render; cases.test.ts asserts their ids and passes_
 
 - [ ] 12. Seed cases: close-out
   - File: harness/evals/closeout-landing-root/case.json
@@ -143,13 +143,13 @@ Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the grade
   - Purpose: guard the landing-root and reversing-proposal failures (R5 AC1).
   - _Leverage: src/tools/brief-templates.ts:1584-1590 (`closeout-standing` and `closeout-batch` required keys), design Component 13 rows 4-5_
   - _Requirements: 5.1, 5.3, 5.4_
-  - _Prompt: Task: Per R5 AC1 and design Component 13, write both cases with fixture trees: landing-root has worktree `landing` and an item naming `{{fixture}}/docs/notes.md`, batch `root` `{{fixture}}/.claude/worktrees/landing`, cwd that worktree; reversing-proposal's fixture design records a decision its item reverses without naming it. Both render `closeout-standing` then `closeout-batch` with `standing` wired and `commitScript` `{{scratch}}/closeout-commit.sh`. Widen cases.test.ts to assert exactly the five seed ids and to assert each close-out batch brief names its rendered standing path. Regression guard, not red-first: R5 AC4's base results are a live check recorded by task 16 | Restrictions: keep task 11's cases and assertions; turn cap 150 | Success: `listCaseIds()` returns exactly the five seed ids; both close-out cases load, build and render with the standing path wired; cases.test.ts passes_
+  - _Prompt: Task: Per R5 AC1 and design Component 13, write both cases with fixture trees: landing-root has worktree `landing` and an item naming `{{fixture}}/docs/notes.md`, batch `root` `{{fixture}}/.claude/worktrees/landing`, cwd that worktree; reversing-proposal's fixture design records a decision its item reverses without naming it. Both render `closeout-standing` then `closeout-batch` with `standing` wired and `commitScript` `{{scratch}}/closeout-commit.sh`. Widen cases.test.ts to assert exactly the five seed ids and to assert each close-out batch brief names its rendered standing path. Regression guard, not red-first: R5 AC4's base results are a live check recorded by the pending verification record | Restrictions: keep task 11's cases and assertions; turn cap 150 | Success: `listCaseIds()` returns exactly the five seed ids; both close-out cases load, build and render with the standing path wired; cases.test.ts passes_
 
 - [ ] 13. Brief and role text
   - File: src/tools/brief-templates.ts
   - File: harness/agents/sdd-retro-analyst.md
   - File: src/tools/__tests__/harness.test.ts
-  - Test: src/tools/__tests__/harness.test.ts — harnessHandler({ action: 'brief', template, values })
+  - Test: src/tools/__tests__/harness.test.ts — `harnessHandler({ action: 'brief', template, values })`
   - Apply design Component 11: the drafter sentence (`src/tools/brief-templates.ts:129-133`), the `Eval case:` line in the proposal format (`src/tools/brief-templates.ts:1381-1391`) and the role file (`harness/agents/sdd-retro-analyst.md:18-24`), and two rules in `renderCloseoutStanding` (`src/tools/brief-templates.ts:1472-1499`).
   - Purpose: the drafter brief matches its role, and a retro defect arrives with a case (R5 AC2, R6).
   - _Leverage: src/tools/__tests__/harness.test.ts:368 (`drafterValues`)_
@@ -201,3 +201,4 @@ Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the grade
 ## Revision History
 
 - **v1** (2026-10-22) — Initial draft.
+  - **Lint pass.** 3 fixed; rejected: none.

````
