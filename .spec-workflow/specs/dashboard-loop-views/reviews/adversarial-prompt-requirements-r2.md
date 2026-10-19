# Adversarial Review — dashboard-loop-views/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-loop-views
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-loop-views requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-loop-views`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since d370c83

````diff
diff --git a/.spec-workflow/specs/dashboard-loop-views/requirements.md b/.spec-workflow/specs/dashboard-loop-views/requirements.md
index 7a332ba..9ab441f 100644
--- a/.spec-workflow/specs/dashboard-loop-views/requirements.md
+++ b/.spec-workflow/specs/dashboard-loop-views/requirements.md
@@ -16,12 +16,12 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 
 #### Acceptance Criteria
 
-1. WHEN the merge rule evaluates a pull request for a run (`runMergeStage` at `src/controller/merge.ts:513-519`, or `mergeByRule` for a close-out PR at `src/controller/runs.ts:908-915`) THEN the controller SHALL save on that run's record, through the existing write path `save` (`src/controller/runs.ts:521-526`), one PR read per pull request: the PR number, the repository name, the PR web URL when known, the CI state, the raw `mergeable` value, the verdict, every reason, the merge commit sha when merged, and the ISO time of the read.
+1. WHEN the merge rule evaluates a pull request for a run (`runMergeStage` at `src/controller/merge.ts:513-519`, or `mergeByRule` for a close-out PR at `src/controller/runs.ts:908-915`) THEN the controller SHALL save on that run's record, through the existing write path `save` (`src/controller/runs.ts:521-526`), one PR read per pull request: the PR number, the repository name, the PR web URL when known, the CI state, the raw `mergeable` value, the verdict, every reason, the merge commit sha when merged, and the ISO time of the read. The CI state and the raw `mergeable` SHALL come from the merge evaluation pass itself, extended to return what it already read (`evaluate`, `src/controller/merge.ts:291-372`), carried to the `save` site; the controller SHALL make no second GitHub read for the panel.
 2. The verdict SHALL be the `MergeStageStatus` value that the same pass returned (`merged`, `waiting`, `not-ready`, `blocked`, `unreadable` or `failed`; `src/controller/merge.ts:95-107`), and the reasons SHALL be that pass's `reasons` array unchanged.
-3. The CI state SHALL be one of `green`, `pending`, `red` or `unreadable`, classified from the workflow runs and commit statuses that the same evaluation read, by the classification `readCiState` applies (`src/controller/merge.ts:390-430`): any failed check gives `red`; else any pending check or a fresh head with no run gives `pending`; else `green`. IF the evaluation could not read the PR, its workflow runs or its commit statuses (`src/controller/merge.ts:297-321`) THEN the CI state SHALL be `unreadable`.
+3. The CI state SHALL be one of `green`, `pending`, `red` or `unreadable`. The extended `evaluate` SHALL classify it from the workflow runs and commit statuses it already read, by the same rule `readCiState` embodies (`src/controller/merge.ts:390-430`): any failed check gives `red`; else any pending check or a fresh head with no run gives `pending`; else `green`. IF the evaluation could not read the PR, its workflow runs or its commit statuses (`src/controller/merge.ts:297-321`) THEN the CI state SHALL be `unreadable`.
 4. IF the evaluation could not read the PR at all THEN the `mergeable` value SHALL be recorded as absent, never as a stale value from an earlier read.
 5. A later read of the same pull request SHALL replace the earlier read of that pull request; reads of different pull requests of the same run SHALL be kept side by side, the run's own PR first.
-6. The `controller-runs` wire row (`toRow` at `src/controller/runs.ts:1189-1196`) SHALL carry the PR reads without any filesystem path (no `repoDir`; design §17 keeps paths off the LAN), and the frontend hand copy of `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:167-179`) SHALL match the server shape.
+6. The `controller-runs` wire row SHALL carry the PR reads without any filesystem path (no `repoDir`; design §17 keeps paths off the LAN), added to all three hand-kept shapes the row flows through and which SHALL stay in step: `ControllerRunRow` that `toRow` builds (`src/controller/runs.ts:1175-1196`), the server `ControllerRun` the feed casts to (`src/dashboard/shell/types.ts:137-150`), and the frontend hand copy (`src/dashboard_frontend/src/modules/shell/types.ts:167-179`).
 7. WHEN the Run page shows a controller run that has at least one PR read THEN it SHALL render a PR panel with one row per read: the PR number as a link to the PR web URL (plain text when the URL is unknown), the CI state as a chip, the `mergeable` value, the verdict, every reason as its own line, and the read time.
 8. IF the run has no PR read THEN the Run page SHALL render no PR panel.
 9. WHILE the run status is `merging`, WHEN the merge rule re-checks (every `MERGE_POLL_INTERVAL_MS`, `src/controller/merge.ts:24`) THEN the open Run page SHALL show the new read within 5 seconds of the run-record write, with no page reload, through the existing `controller-runs` push (`src/controller/runs.ts:50-55`).
@@ -38,7 +38,7 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 
 1. The deferral record (`src/types.ts:310-330`) SHALL carry an optional `owner` whose value is `matthew` or `harness`; a record with no owner reads as `owner: null`.
 2. The storage SHALL write `owner` as a frontmatter key (`serializeFrontmatter`, `src/core/deferral-storage.ts:42-62`) and read it back (`parseMarkdown`, `src/core/deferral-storage.ts:125-170`); a record with no `owner` key, or with a value other than the two allowed, SHALL read as `owner: null` and SHALL still be listed.
-3. WHEN the `deferrals` tool's `add` or `update` action receives `owner` with an allowed value THEN the record SHALL store it (`handleAdd` at `src/tools/deferrals.ts:150-190`, `handleUpdate` at `src/tools/deferrals.ts:254-275`), and the tool schema (`src/tools/deferrals.ts:22-104`) SHALL describe the field and its two values.
+3. WHEN the `deferrals` tool's `add` or `update` action receives `owner` with an allowed value THEN the record SHALL store it through the tool handlers (`handleAdd` at `src/tools/deferrals.ts:150-190`, `handleUpdate` at `src/tools/deferrals.ts:254-275`) and the storage that persists it (`create`, `src/core/deferral-storage.ts:218-259`; the `update` mutable-field list, `src/core/deferral-storage.ts:310-329`), and the tool schema (`src/tools/deferrals.ts:22-104`) SHALL describe the field and its two values.
 4. IF `add` or `update` receives `owner` with any other value THEN the tool SHALL return `success: false` with a message that names the two allowed values, and SHALL write no file.
 5. WHEN `reindex` re-serializes the store (`src/core/deferral-storage.ts:428-470`) THEN every record's `owner` SHALL survive unchanged.
 6. WHEN `resolve`, `merge` or `update` rewrites a record THEN its `owner` SHALL survive unless `update` sets a new one.
@@ -57,13 +57,13 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 
 1. The dashboard server SHALL provide one read-only route that returns, for every project the dashboard knows (`getAllProjects`, `src/dashboard/project-manager.ts:294`), one row per closed spec: project id, project name, spec, close date, total W, the count of spawns whose W is unknown, task count, W per task, the repository baseline, and W per task as a percentage of that baseline.
 2. A spec SHALL count as closed by the Specs page rule: a HANDOFF `closeout` row with result `closed`, or a retrospective plan whose `Status:` value starts with `CLOSED` (`src/dashboard/shell/spec-rows.ts:91-102`).
-3. The close date SHALL be the date of the HANDOFF `closeout`/`closed` row (as `closedOn`, `src/dashboard/shell/now-model.ts:136-144`); IF that row is absent THEN the newest `ts` in the spec's ledger; IF neither exists THEN null.
+3. The close date SHALL be the date of the HANDOFF `closeout`/`closed` row, read unwindowed by `parseHandoffPhaseRows` (`src/watch/ledger.ts:202`) exactly as the Specs page's closed rule reads that row (`src/dashboard/shell/spec-rows.ts:92`), with no 7-day window applied; IF that row is absent THEN the newest `ts` in the spec's ledger; IF neither exists THEN null.
 4. Total W SHALL be the weighted W over every `spawn.end` row of every run in the spec's `harness-events.jsonl`, by the same fold as the `harness usage` action (`buildUsageReport`, `src/watch/usage.ts:162`; per-row weights `spawnW`, `src/watch/usage.ts:68-78`). For the same ledger, the row's total W SHALL equal the `usage` action's total W exactly.
 5. The task count SHALL be the total task count of the spec's `tasks.md` from the index snapshot (`taskProgress.total`, as `src/dashboard/shell/spec-rows.ts:144`); W per task SHALL be total W divided by task count.
 6. IF the task count is 0 THEN W per task SHALL be null and the row SHALL show `no tasks`.
 7. IF one or more spawns have an unknown W THEN the row SHALL label W and W per task a floor and show the unknown spawn count (agent-rules "Run ledger": counts are floors).
 8. IF the ledger is missing or has no spawn with a known W THEN W and W per task SHALL be null and the row SHALL show `no usage recorded`.
-9. The repository baseline SHALL be the integer value of a `baseline-w-per-task: <n>` line in that project's `agent-rules.md`, read through the one parser `readAgentRules` (`src/dashboard/harness/run-setup.ts:66-127`); IF the key is absent or not an integer THEN the baseline and the percentage SHALL be null and the row SHALL show `no baseline`. The `agent-rules.md` key table in `docs/SDD-HARNESS.md:252-260` SHALL list the new key.
+9. The repository baseline SHALL be the integer value of a `baseline-w-per-task: <n>` line in that project's `agent-rules.md`, read through `readAgentRules` (`src/dashboard/harness/run-setup.ts:66-127`), whose `AgentRules` struct (`src/dashboard/harness/run-setup.ts:31-43`) gains the key; IF the key is absent or not an integer THEN the baseline and the percentage SHALL be null and the row SHALL show `no baseline`. The `agent-rules.md` key table in `docs/SDD-HARNESS.md:252-260` SHALL list the new key.
 10. The Usage page (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:61-102`) SHALL show a table of these rows grouped by project, newest close date first, with columns spec, close date, W, tasks, W per task and percentage of baseline.
 11. The Usage page SHALL show a trend chart: close date on the x axis, W per task on the y axis, one line per project through that project's rows in close-date order, each project's baseline (when set) as a horizontal reference line in that project's series colour, a legend naming each project, and a hover value per point naming the spec and its W per task. Series colours SHALL be assigned in a fixed order of project name.
 12. A row whose W per task or close date is null SHALL appear in the table and SHALL NOT be plotted.
@@ -74,7 +74,7 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 ## Non-Functional Requirements
 
 ### Performance
-- The usage route SHALL read ledgers, HANDOFF and `agent-rules.md` through a `FileCache` (`src/dashboard/shell/file-cache.ts:1-16`), so a repeat request rereads no unchanged file.
+- The usage route SHALL read ledgers and HANDOFF through a `FileCache` (`src/dashboard/shell/file-cache.ts:1-16`), so a repeat request rereads no unchanged ledger or HANDOFF; it reads each project's `agent-rules.md` through `readAgentRules` (`src/dashboard/harness/run-setup.ts:66-127`), one small uncached read per project per request.
 - The trend chart SHALL be plain SVG in the existing frontend; no charting package is added (`package.json` has none).
 
 ### Security
@@ -94,7 +94,7 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 - D6 — Owner values and default: options were optional with exactly matthew or harness and no default, defaulting absent records to harness, or making owner required on add; chosen because existing records carry no owner and a default would mislabel them, and ADR 0001 names one operator.
 - D7 — Where owner is set: options were the deferrals tool's add and update only, or an owner control on the Deferrals page; chosen because spec 15 made the page read-only and the entry asks only for a chip and a filter.
 - D8 — Unknown usage: options were a floor label with the unknown count and exclusion from the trend when nothing is known, plotting zero, or dropping the spec; chosen because agent-rules says ledger counts are floors and must name their blind spots.
-- D9 — Close date: options were the HANDOFF closeout row then the newest ledger row, or the run-end row only; chosen because the Now page already dates a close from the HANDOFF row, and older specs have no controller run-end row.
+- D9 — Close date: options were the HANDOFF closeout row then the newest ledger row, or the run-end row only; chosen because the Specs page already derives a spec's closed state from that HANDOFF row unwindowed, and older specs have no controller run-end row.
 - D10 — Chart rendering: options were plain SVG or a new charting package; chosen because one line chart with reference lines is small and the frontend has no chart dependency.
 - D11 — Money, personal data and legal posture: options were none in scope, or a posture review; chosen because the spec reads token counts and shows a fixed owner label, with no billing, deletion, erasure or personal data surface.
 
@@ -108,5 +108,12 @@ The steering `product.md` is absent from this store (`.spec-workflow/steering/`
 
 ## Revision History
 
+- **v2** (2026-10-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 2/2/1).
+  - **R1-1 — Accepted (MUST_FIX).** R3 AC3 no longer cites the Now-page close date, which only emits a date for rows closed within 7 days; the close date now reads the HANDOFF closeout/closed row unwindowed by parseHandoffPhaseRows as the Specs page's closed rule reads it (AC3, Requirement 3). Sibling D9 rationale rewritten to cite the Specs page's unwindowed derivation, not the Now page.
+  - **R1-2 — Accepted (MUST_FIX).** NFR Performance no longer claims agent-rules.md is read through the FileCache; it routes ledgers and HANDOFF through the FileCache and reads agent-rules.md through readAgentRules as one small uncached read per project per request, matching AC9.
+  - **R1-3 — Accepted (SHOULD_FIX).** R1 AC1 now states the CI state and raw mergeable come from the merge evaluation pass extended to return what it already read, carried to the save site with no second GitHub read; AC3 now says the extended evaluate classifies the CI state from its own already-read runs and statuses by the rule readCiState embodies, rather than implying evaluate already produces one.
+  - **R1-4 — Accepted (SHOULD_FIX).** R1 AC6 now enumerates all three hand-kept shapes the PR reads flow through — the ControllerRunRow toRow builds, the server ControllerRun the feed casts to, and the frontend hand copy — which must stay in step.
+  - **R1-5 — Accepted (MINOR).** AC9 drops the "one parser" overstatement and names the AgentRules struct that gains the key; R2 AC3 now cites the storage that persists owner (create and the update mutable-field list), not only the tool handlers.
+  - **Lint pass.** 0 fixed; rejected: L-1 `repoDir` is absent by design — AC6 asserts the path-free row, and the three cited shapes carry no such field; L-2 `merging` is a RunStatus value, the citations govern the poll interval and the push; L-3/L-4/L-5 `owner`/`matthew`/`harness` are the new field and its two values the spec adds to the cited Deferral interface; L-6/L-7/L-8 `owner` is the new field added to the cited storage/schema/create/update/reindex code; L-9/L-11 `get`/`list` are action names, the citation governs the summary rows; L-10 `owner` is that new summary field; L-12/L-13/L-14/L-15 `matthew`/`harness` are chip labels, the citations locate the reused panel and the Chips primitive; L-16 `jsonl` is part of the `harness-events.jsonl` filename; L-17 `usage` is the harness action name, the citations govern the fold. All unchanged since v1's rejections (rule 11).
 - **v1** (2026-10-18) — Initial draft.
   - **Lint pass.** 5 fixed (L-2 widened merge.ts:95→95-107 to include `reasons`; L-5/L-6 added `evaluate` citation merge.ts:291-372 covering `pending`; L-7 widened runs.ts:634-681→585-682 to include the declaration; L-23 widened file-cache.ts:1-6→1-16 to include `class FileCache`); rejected: L-1 `mergeable` is the stored GitHub-field value, the citations govern `save`; L-3 the AC requires `repoDir` absent from those ranges, its absence is the point; L-4 `merging` is a RunStatus value, the citations govern the poll interval and push; L-8/L-9/L-10 `owner`/`matthew`/`harness` are the new field and values added to the cited Deferral interface; L-11/L-12/L-13/L-15 `owner` is the new field added to the cited storage/schema/reindex/summary code; L-14/L-16 `get`/`list` are action names, the citation governs the summary rows; L-17/L-18/L-19/L-20 `matthew`/`harness` are chip labels, the citations locate the reused panel and Chips; L-21 `jsonl` is part of the `harness-events.jsonl` filename; L-22 `usage` is the harness action name, the citations govern the fold.

````
