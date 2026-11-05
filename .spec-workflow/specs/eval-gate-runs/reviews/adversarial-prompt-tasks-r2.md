# Adversarial Review — eval-gate-runs/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/eval-gate-runs
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/reviews/adversarial-memory-tasks.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): eval-gate-runs tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/eval-gate-runs`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 95a5b4e2

````diff
diff --git a/.spec-workflow/specs/eval-gate-runs/tasks.md b/.spec-workflow/specs/eval-gate-runs/tasks.md
index 4b5784ed..5951b7af 100644
--- a/.spec-workflow/specs/eval-gate-runs/tasks.md
+++ b/.spec-workflow/specs/eval-gate-runs/tasks.md
@@ -1,6 +1,6 @@
 # Tasks Document
 
-Document version: v1
+Document version: v2
 
 Dependency order: 1 → 2 → 3 → 4 → 5 → 6. Tasks 1 and 2 add the rule and the runner option with no caller, task 3 applies them in the gate, task 4 reports them from the CLI, task 5 guards the deploy script's output, and task 6 updates the docs. Each task leaves `npx tsc --noEmit` and every existing suite green, and no file is edited by two tasks, so every line citation below stays valid. No task touches a sensitive path or creates a module; task 4 edits `src/evals/cli.ts`, so `isWiringTask` routes it a verifier (`src/controller/phases/implementation.ts:266-272`, `src/controller/phases/implementation.ts:850`).
 
@@ -48,8 +48,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6. Tasks 1 and 2 add the rule an
 
 - [ ] 5. Guard the dry run and the error wait in the script tests
   - File: src/__tests__/service-scripts.test.ts
-  - Test: src/__tests__/service-scripts.test.ts — `runScript(selfUpdateSh, ['--dry-run'], env)`
-  - Note: regression guard, not a red test. Earlier tasks shipped the dry-run output and requirement 2.5 holds at base, so every criterion passes before this task. Expected route: the author reports RED-IMPOSSIBLE and the implementer writes the tests.
+  - Note: implementer-only, no test author and no verifier. Every acceptance criterion is a regression guard: earlier tasks shipped the dry-run output and requirement 2.5 holds at base, so there is no red to prove. The implementer writes the two guard tests directly (`.spec-workflow/agent-rules.md:176-178`).
   - Note: the tests at `src/__tests__/service-scripts.test.ts:251-273` and :382-406 do not change; no value they assert changes.
   - Purpose: Prove design Component 5: `scripts/sdd-self-update.sh` shows the counts and the failing case with no script edit.
   - _Leverage: src/__tests__/service-scripts.test.ts:24-34, src/__tests__/service-scripts.test.ts:49-69, src/__tests__/service-scripts.test.ts:74-76, scripts/sdd-self-update.sh:59-75, scripts/sdd-self-update.sh:231-237_
@@ -84,3 +83,6 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6. Tasks 1 and 2 add the rule an
 
 - **v1** (2026-11-04) — Initial draft.
   - **Lint pass.** 1 fixed; rejected: none.
+- **v2** (2026-11-04) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/1/0).
+  - **R1-1 — Accepted (SHOULD_FIX).** Removed task 5's Test seam and marked the task implementer-only up front, stating the test-author and verifier skip, so its all-regression-guard criteria no longer spawn a test author that reports red-impossible and re-routes mid-run; the dry run and error wait stay named in its Success clause. No sibling task carries this construct — tasks 1 to 4 each add genuinely new behaviour.
+  - **Lint pass.** 1 fixed; rejected: none.

````
