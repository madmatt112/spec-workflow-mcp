# Adversarial Review — dashboard-visual-refresh/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-visual-refresh tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-visual-refresh` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since ee601036

````diff
diff --git a/.spec-workflow/specs/dashboard-visual-refresh/tasks.md b/.spec-workflow/specs/dashboard-visual-refresh/tasks.md
index 74ab5b61..b3229fb0 100644
--- a/.spec-workflow/specs/dashboard-visual-refresh/tasks.md
+++ b/.spec-workflow/specs/dashboard-visual-refresh/tasks.md
@@ -84,7 +84,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6. Task 1 adds the visual e2e su
   - File: src/dashboard_frontend/src/modules/theme/tokens.css
   - File: src/dashboard_frontend/src/modules/theme/tailwind.css
   - Test: src/dashboard/__tests__/frontend-style-scan.test.ts — npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts
-  - Notes: red at this task's start on what tasks 2-4 leave, at least `UsageTrend.tsx:13` and `RunPage.tsx:223`, not the full base set (RE-DECIDED, Scope notes). The log view keeps filter, follow and scroll (Requirement 4.7): regression guard through the existing suites.
+  - Notes: red at this task's start on what tasks 2-4 leave, at least `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx:13` and `src/dashboard_frontend/src/modules/shell/RunPage.tsx:223`, not the full base set (RE-DECIDED, Scope notes). The log view keeps filter, follow and scroll (Requirement 4.7): regression guard through the existing suites.
   - Purpose: Finish the sweep and lock it with the scan.
   - _Leverage: the input, tab and class constants task 3 exports, the Reference section of this document, src/dashboard_frontend/src/modules/shell/UsageTrend.tsx (SERIES 13, attributes 88-125)_
   - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.2, 4.1, 4.7_
@@ -101,7 +101,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6. Task 1 adds the visual e2e su
 
 ## Reference — T1 scan rules
 
-Copied from the design-phase prototype `/tmp/scratchpad/sdd/dashboard-visual-refresh/probe/scan/scan.cjs:4-12` (83 hits outside the theme module at base, no false positive). Task 5 ports them to TypeScript unchanged.
+Copied from the design-phase prototype `/tmp/scratchpad/sdd/dashboard-visual-refresh/probe/scan/scan.cjs` (scratch, see Scope notes; 83 hits outside the theme module at base, no false positive). Task 5 ports them to TypeScript unchanged.
 
 ```js
 ['hex', /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g],
@@ -141,3 +141,4 @@ Copied from the design-phase prototype `/tmp/scratchpad/sdd/dashboard-visual-ref
 ## Revision History
 
 - **v1** (2026-10-28) — Initial draft.
+  - **Lint pass.** 3 fixed; rejected: L-1 task 1 creates e2e harness/spec files, not src/ source, and is explicitly implementer-only per agent-rules, so no Test line is correct; L-4 task 6 makes no source change (screenshots and evidence only) and is implementer-only for the same reason.

````
