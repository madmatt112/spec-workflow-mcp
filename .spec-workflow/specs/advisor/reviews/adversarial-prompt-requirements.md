# Adversarial Review — advisor/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): advisor requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `advisor` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 954f0d03

````diff
diff --git a/.spec-workflow/specs/advisor/requirements.md b/.spec-workflow/specs/advisor/requirements.md
index 00a1705d..44c1a532 100644
--- a/.spec-workflow/specs/advisor/requirements.md
+++ b/.spec-workflow/specs/advisor/requirements.md
@@ -29,7 +29,7 @@ The steering directory holds no `product.md`, so this spec aligns with ADR 0004
 
 #### Acceptance Criteria
 
-1. WHEN the advisor asks for the summary THEN the controller SHALL return, built by code with no model: open waits (kind, project, spec, age), stuck runs (a run in `error`, or `running` with no step output for fifteen minutes), open PRs with the merge rule's last verdict (`PrRead`, `src/controller/state.ts:104-128`), deferrals with `owner: matthew` (`src/core/deferral-storage.ts:150-152`), live runs with phase and step, the two usage windows, and this week's tallies (Requirement 3).
+1. WHEN the advisor asks for the summary THEN the controller SHALL return, built by code with no model: open waits (kind, project, spec, age), stuck runs (a run in `error`, or `running` with no step output for fifteen minutes; `RunStatus`, `src/controller/state.ts:56-64`), open PRs with the merge rule's last verdict (`PrRead`, `src/controller/state.ts:104-128`), deferrals with `owner: matthew` (`src/core/deferral-storage.ts:150-152`), live runs with phase and step, the two usage windows, and this week's tallies (Requirement 3).
 2. WHEN a wait is open at the moment of the request THEN the summary SHALL list it (end-to-end check 1); the summary SHALL be built from current state on each request, never from a file older than the request.
 3. The summary SHALL cover harness projects only; a project or source the operator marks as personal (the job search) SHALL appear only when the advisor asks for it by name.
 4. The summary SHALL fit in 400 words of rendered text with every list capped and a "N more" line when capped.
@@ -193,3 +193,4 @@ The steering directory holds no `product.md`, so this spec aligns with ADR 0004
 ## Revision History
 
 - **v1** (2026-10-26) — Initial draft.
+  - **Lint pass.** 2 fixed; rejected: none.

````
