# Adversarial Review — dashboard-loop-views/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-loop-views
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): dashboard-loop-views requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-loop-views` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-loop-views`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 6654777

````diff
diff --git a/.spec-workflow/specs/dashboard-loop-views/requirements.md b/.spec-workflow/specs/dashboard-loop-views/requirements.md
index 68bada8..7a332ba 100644
--- a/.spec-workflow/specs/dashboard-loop-views/requirements.md
+++ b/.spec-workflow/specs/dashboard-loop-views/requirements.md
@@ -17,7 +17,7 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 #### Acceptance Criteria
 
 1. WHEN the merge rule evaluates a pull request for a run (`runMergeStage` at `src/controller/merge.ts:513-519`, or `mergeByRule` for a close-out PR at `src/controller/runs.ts:908-915`) THEN the controller SHALL save on that run's record, through the existing write path `save` (`src/controller/runs.ts:521-526`), one PR read per pull request: the PR number, the repository name, the PR web URL when known, the CI state, the raw `mergeable` value, the verdict, every reason, the merge commit sha when merged, and the ISO time of the read.
-2. The verdict SHALL be the `MergeStageStatus` value that the same pass returned (`merged`, `waiting`, `not-ready`, `blocked`, `unreadable` or `failed`; `src/controller/merge.ts:95`), and the reasons SHALL be that pass's `reasons` array unchanged.
+2. The verdict SHALL be the `MergeStageStatus` value that the same pass returned (`merged`, `waiting`, `not-ready`, `blocked`, `unreadable` or `failed`; `src/controller/merge.ts:95-107`), and the reasons SHALL be that pass's `reasons` array unchanged.
 3. The CI state SHALL be one of `green`, `pending`, `red` or `unreadable`, classified from the workflow runs and commit statuses that the same evaluation read, by the classification `readCiState` applies (`src/controller/merge.ts:390-430`): any failed check gives `red`; else any pending check or a fresh head with no run gives `pending`; else `green`. IF the evaluation could not read the PR, its workflow runs or its commit statuses (`src/controller/merge.ts:297-321`) THEN the CI state SHALL be `unreadable`.
 4. IF the evaluation could not read the PR at all THEN the `mergeable` value SHALL be recorded as absent, never as a stale value from an earlier read.
 5. A later read of the same pull request SHALL replace the earlier read of that pull request; reads of different pull requests of the same run SHALL be kept side by side, the run's own PR first.
@@ -27,7 +27,7 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 9. WHILE the run status is `merging`, WHEN the merge rule re-checks (every `MERGE_POLL_INTERVAL_MS`, `src/controller/merge.ts:24`) THEN the open Run page SHALL show the new read within 5 seconds of the run-record write, with no page reload, through the existing `controller-runs` push (`src/controller/runs.ts:50-55`).
 10. WHEN the merge rule merges a PR THEN its row SHALL show the verdict `merged` and the first 7 characters of the merge sha.
 11. The dashboard server and frontend SHALL NOT call `gh` or GitHub for the panel; the panel shows only what the merge rule read.
-12. The merge rule's decision SHALL NOT change: for the same `gh` responses, `evaluate` returns the same `ready`, `pending`, `unreadable` and `reasons` as at base, and `runMergeStageStep` maps each status to the same run status and wait (`src/controller/runs.ts:634-681`). Invariant (verified, not red-first): the existing merge and runs suites pass with no asserted value changed.
+12. The merge rule's decision SHALL NOT change: for the same `gh` responses, `evaluate` (`src/controller/merge.ts:291-372`) returns the same `ready`, `pending`, `unreadable` and `reasons` as at base, and `runMergeStageStep` maps each status to the same run status and wait (`src/controller/runs.ts:585-682`). Invariant (verified, not red-first): the existing merge and runs suites pass with no asserted value changed.
 13. A run record written before this feature (with no PR read) SHALL still load, list and render. Invariant (verified, not red-first).
 
 ### Requirement 2 — Owner on a deferral record
@@ -74,7 +74,7 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 ## Non-Functional Requirements
 
 ### Performance
-- The usage route SHALL read ledgers, HANDOFF and `agent-rules.md` through a `FileCache` (`src/dashboard/shell/file-cache.ts:1-6`), so a repeat request rereads no unchanged file.
+- The usage route SHALL read ledgers, HANDOFF and `agent-rules.md` through a `FileCache` (`src/dashboard/shell/file-cache.ts:1-16`), so a repeat request rereads no unchanged file.
 - The trend chart SHALL be plain SVG in the existing frontend; no charting package is added (`package.json` has none).
 
 ### Security
@@ -109,3 +109,4 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 ## Revision History
 
 - **v1** (2026-10-18) — Initial draft.
+  - **Lint pass.** 5 fixed (L-2 widened merge.ts:95→95-107 to include `reasons`; L-5/L-6 added `evaluate` citation merge.ts:291-372 covering `pending`; L-7 widened runs.ts:634-681→585-682 to include the declaration; L-23 widened file-cache.ts:1-6→1-16 to include `class FileCache`); rejected: L-1 `mergeable` is the stored GitHub-field value, the citations govern `save`; L-3 the AC requires `repoDir` absent from those ranges, its absence is the point; L-4 `merging` is a RunStatus value, the citations govern the poll interval and push; L-8/L-9/L-10 `owner`/`matthew`/`harness` are the new field and values added to the cited Deferral interface; L-11/L-12/L-13/L-15 `owner` is the new field added to the cited storage/schema/reindex/summary code; L-14/L-16 `get`/`list` are action names, the citation governs the summary rows; L-17/L-18/L-19/L-20 `matthew`/`harness` are chip labels, the citations locate the reused panel and Chips; L-21 `jsonl` is part of the `harness-events.jsonl` filename; L-22 `usage` is the harness action name, the citations govern the fold.

````
