# Adversarial Review — verification-loop/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): verification-loop requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `verification-loop` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 21537de

````diff
diff --git a/.spec-workflow/specs/verification-loop/requirements.md b/.spec-workflow/specs/verification-loop/requirements.md
index c7563c2..f8e07d8 100644
--- a/.spec-workflow/specs/verification-loop/requirements.md
+++ b/.spec-workflow/specs/verification-loop/requirements.md
@@ -14,12 +14,12 @@ The steering directory holds no `product.md`, so this section aligns with the 20
 
 **User Story:** As the operator, I want a red check or a merge conflict on the run's own PR to get two implementer fix rounds before it reaches me, so that I answer an `error` wait only when the harness could not fix it.
 
-Today a PR that fails the rule with nothing in flight is `blocked` (`src/controller/merge.ts:588-591`) and `runMergeStageStep` opens an `error` wait at once (`src/controller/runs.ts:669-682`).
+Today a PR that fails the rule with nothing in flight is `blocked` (`src/controller/merge.ts:588-591`) and `runMergeStageStep` opens an `error` wait at once (`src/controller/runs.ts:611-682`).
 
 #### Acceptance Criteria
 
 1. WHEN the merge stage of the run's own PR returns `blocked` AND every blocking reason is a failed workflow run, a failed commit status, or a merge conflict (`mergeable` is `CONFLICTING`) AND the run has used fewer than 2 merge fix rounds THEN the controller SHALL run one `sdd-implementer` fix round instead of opening the `error` wait.
-2. WHEN a merge fix round runs THEN it SHALL run in the run's worktree on the PR branch, and its brief SHALL name each failing check with the saved log tail of its workflow run (as `prChecksGate` saves them, `src/controller/phases/implementation.ts:1117-1126`) and, for a conflict, say that the branch conflicts with the default branch.
+2. WHEN a merge fix round runs THEN it SHALL run in the run's worktree on the PR branch, and its brief SHALL name each failing check with the saved log tail of its workflow run (as `prChecksGate` saves them, `src/controller/phases/implementation.ts:1069-1126`) and, for a conflict, say that the branch conflicts with the default branch.
 3. WHEN a merge fix round resolves a conflict THEN the implementer SHALL merge the default branch into the PR branch; the controller SHALL NOT rewrite pushed history and SHALL NOT force-push.
 4. WHEN a merge fix round ends with a new commit on the PR branch THEN the controller SHALL push the branch and set the run to `merging` with a re-check time, so the next merge pass reads the new CI state (`src/controller/runs.ts:666-668`).
 5. WHEN the implementer of a merge fix round reports `INFRA:` THEN the controller SHALL re-run the failed workflow runs (as `src/controller/phases/implementation.ts:1143-1148` does) and the round SHALL count toward the cap.
@@ -29,14 +29,14 @@ Today a PR that fails the rule with nothing in flight is `blocked` (`src/control
 9. The merge fix round count SHALL be read from this run's ledger, so a controller restart, a re-entry or an operator "retry" on the `error` wait does not reset it. A "retry" re-runs the merge pass only.
 10. WHEN a merge fix round starts THEN the ledger SHALL get the spawn rows of the step and one `note` row that names the round number and the blocking reasons.
 11. The merge rule itself SHALL stay model-free: `evaluate` and `mergeByRule` (`src/controller/merge.ts:295-297`, `:568-642`) SHALL run no model step; the fix round is a separate step the run loop starts.
-12. Invariant (verified, not red-first): a close-out PR that is `blocked` SHALL open the `error` wait with no fix round (`src/controller/runs.ts:931`).
+12. Invariant (verified, not red-first): a close-out PR that is `blocked` SHALL open the `error` wait with no fix round (`src/controller/runs.ts:927-931`).
 13. Invariant (verified, not red-first): the implementation phase's PR checks gate (reconcile rounds, verifier, adjudicator, `verify-failed`; `src/controller/phases/implementation.ts:1068-1171`) SHALL behave as today.
 
 ### Requirement 2 — implementer model by sensitive-path flag (C3)
 
 **User Story:** As the operator, I want a task gate B did not flag for a sensitive path to run its implementer on Sonnet, so that the Opus tier is spent only on the tasks where a mistake costs most.
 
-Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8` at `xhigh` (`harness/agent-profiles.json:20-25`); `StepSpec` already accepts a model and effort override (`src/controller/step.ts:108-111`).
+Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8` at `xhigh` (`harness/agent-profiles.json:20-25`); `StepSpec` already accepts a model and effort override (`src/controller/step.ts:93-111`).
 
 #### Acceptance Criteria
 
@@ -138,3 +138,4 @@ Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8`
 ## Revision History
 
 - **v1** (2026-10-21) — Initial draft.
+  - **Lint pass.** 5 fixed; rejected: L-6/L-7/L-8/L-9 (package.json section keys named by the AC, not merge.ts symbols; the citation anchors "the merge pass reads a PR").

````
