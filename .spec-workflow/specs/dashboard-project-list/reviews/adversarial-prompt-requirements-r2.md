# Adversarial Review — dashboard-project-list/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-project-list requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 28139eb9

````diff
diff --git a/.spec-workflow/specs/dashboard-project-list/requirements.md b/.spec-workflow/specs/dashboard-project-list/requirements.md
index cd2fab12..94d03ece 100644
--- a/.spec-workflow/specs/dashboard-project-list/requirements.md
+++ b/.spec-workflow/specs/dashboard-project-list/requirements.md
@@ -14,12 +14,12 @@ The steering directory has no `product.md`, so this spec aligns with the decompo
 
 **User Story:** As the operator, I want a run's worktree to show under the project it belongs to, so that the sidebar does not gain a row each time a run starts.
 
-Terms. A **linked worktree** is a git working tree that is not its repository's main working tree. A worktree entry **folds** into a **parent project** when the dashboard lists the parent and does not list the entry. A **listed project** is one the dashboard project set holds (`src/dashboard/project-manager.ts:11-22`) that has not itself folded.
+Terms. A **linked worktree** is a git working tree that is not its repository's main working tree. A worktree entry **folds** into a **parent project** when the dashboard lists the parent and does not list the entry. A **listed project** is one the dashboard project set holds (`src/dashboard/project-manager.ts:11-22`) that has not itself folded. The dashboard classifies an entry as a linked worktree, and finds that worktree's main working tree, by a git determination on the entry's workspace (`src/core/git-utils.ts:260-270`), not by path comparison: a separate-store main checkout (AC9) also has workspace unequal to workflow root, so the stored paths alone cannot tell the two apart. The determination runs only for an entry whose workspace and workflow root differ; an entry whose two paths are equal is a plain repo and needs none.
 
 #### Acceptance Criteria
 
 1. WHEN the dashboard builds its project set AND a registry entry's workspace is a linked worktree AND a listed project has a workspace equal to that worktree's main working tree and a workflow root equal to the entry's workflow root THEN the entry SHALL fold into that project.
-2. IF no listed project matches by criterion 1 AND a listed project has a workspace equal to the entry's workflow root THEN the entry SHALL fold into that project.
+2. IF no listed project matches by criterion 1 AND a listed project has a workspace equal to the entry's workflow root AND a workflow root equal to the entry's workflow root THEN the entry SHALL fold into that project, so a store-only match can never fold a worktree onto a project that holds a different store.
 3. IF no listed project matches by criterion 1 or 2 THEN the entry SHALL be listed as its own project, as today. Invariant (verified, not red-first): this holds at base, and `e2e/worktree-shared.spec.ts:370-414` (two worktree servers, no main project) stays green unchanged.
 4. WHEN an entry folds THEN the dashboard SHALL hold no project context for it, so it has no sidebar row, no Now idle row, no spec rows, and no second set of watchers on the parent's store (`src/dashboard/project-manager.ts:181-256`).
 5. WHEN a registry sync, a manual add or a removal changes the listed projects THEN folding SHALL be evaluated again in that same sync, so a worktree row disappears when its parent appears and reappears when its parent is removed, without a dashboard restart (`src/dashboard/project-manager.ts:134-176`).
@@ -41,9 +41,10 @@ Two listed projects **share a store** when their workflow roots are the same str
 2. WHEN the sidebar shows the Deferrals count THEN it SHALL count each pair of spec store and deferral record with status `deferred` once, however many listed projects share that store (`src/dashboard_frontend/src/modules/shell/Sidebar.tsx:42-44`).
 3. IF at least one listed project on a store is enabled in the sidebar filter THEN that store's specs and deferrals SHALL count; IF every listed project on it is disabled THEN they SHALL NOT.
 4. WHEN a run is live in a linked worktree on a store THEN the Specs and Deferrals counts SHALL equal the counts with no run live.
-5. WHEN the Specs page lists spec rows THEN it SHALL list each pair of store and spec once, so its row count under the same filter equals the Specs count (`src/dashboard/shell/shell-feed.ts:94-101`).
+5. WHEN the Specs page lists spec rows THEN it SHALL group rows by store rather than by project id and list each pair of store and spec once, so its row count under the same filter equals the Specs count (`src/dashboard/shell/shell-feed.ts:94-101`, `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:95,169`).
 6. WHEN the Deferrals page lists deferral records THEN it SHALL list each record of a store once, however many listed projects share that store.
 7. The shell feed SHALL read each distinct store once per flush for spec rows, not once per listed project.
+8. The project-list payload SHALL carry each listed project's store identity (its workflow root), and the Specs count, the Deferrals count, their page lists and the any-enabled filter of criterion 3 SHALL key on that store identity. Today the payload carries only the workspace path (`src/dashboard/project-manager.ts:301-313`), the frontend `Project` shape has no store field (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:8-13`) and each `SpecListRow` carries a single `projectId` (`src/dashboard/shell/types.ts:71-83`), so without it the count, the filter and the page lists cannot agree.
 
 ### Requirement 3 — An eval run registers nothing in the operator's files
 
@@ -70,6 +71,7 @@ Two listed projects **share a store** when their workflow roots are the same str
 5. The check SHALL run at dashboard start only. Registry reads SHALL stay free of filesystem calls per entry (`src/core/project-registry.ts:178-206`).
 6. Registry removals SHALL run under the registry lock (`src/core/project-registry.ts:317-337`).
 7. WHEN an entry is removed THEN the dashboard SHALL log one line naming the file, the project id and the missing path.
+8. The startup removal from `projects.json` SHALL NOT drop an entry the controller remembered or refreshed concurrently; `rememberProject` and `forgetProject` write that file unlocked as atomic-rename read-modify-write (`src/controller/state.ts:455-473`), so the removal SHALL serialize with those writes, the integrity the registry lock of criterion 6 gives the registry side.
 
 ### Requirement 5 — Each project row carries a status dot and a live-run count
 
@@ -87,6 +89,7 @@ Two listed projects **share a store** when their workflow roots are the same str
 8. The dot's colours SHALL come from the token file spec 22 introduced; the frontend SHALL contain no new hard-coded colour.
 9. The dot and the count SHALL update from data the sidebar already receives (the project list poll, `controller-runs`, `controller-waits` and `shell-now`), with no new route, poll or WebSocket topic.
 10. The dot SHALL be the only new visual element; row height, font and spacing SHALL stay as spec 22 left them.
+11. The sidebar filter SHALL NOT change a row's dot or its sort position (R6); the sidebar already renders a row for every listed project regardless of the filter (`src/dashboard_frontend/src/modules/shell/Sidebar.tsx:80-91`), and the filter gates the Specs and Deferrals counts and the page lists only.
 
 ### Requirement 6 — Active projects sort first
 
@@ -116,6 +119,7 @@ Two listed projects **share a store** when their workflow roots are the same str
 
 ### Performance
 - The start-time existence check costs one stat per registry and `projects.json` entry, once per dashboard start.
+- Folding costs one git determination per sync, run only for a registry entry whose workspace and workflow root differ (`src/core/git-utils.ts:260-270`); an entry whose two paths are equal needs none, and a failed determination keeps the entry listed (NFR Reliability).
 - A shell-feed flush SHALL read no more spec stores than it reads today; with a live worktree run it reads fewer.
 
 ### Security
@@ -140,6 +144,8 @@ Two listed projects **share a store** when their workflow roots are the same str
 - D10 — The filter on a shared store: the options were count it while any project on it is enabled, or follow one chosen project's toggle; chosen any-enabled because the operator toggles projects, not stores.
 - D11 — What a missing path is: the options were not-found errors only, or any stat failure; chosen not-found only so a permission error or a slow mount never deletes a real project.
 - D12 — Money, personal data and legal posture: not applicable; the spec touches no money, personal data, or legal surface, and its only deletion is of the operator's own stale local registrations.
+- D13 — Store identity on the wire: the options were add the workflow root to the project-list payload, put a store key on the spec rows, or keep per-project attribution; chosen the payload workflow root because the count, the filter and the page lists all have to key on the store to agree, and the payload is the one shape every one of them already reads.
+- D14 — The filter against the dot and the sort: the options were force a filtered-out project to idle and the bottom, or compute its dot and sort position as for any other project; chosen the latter because the sidebar already shows a row for every project whatever the filter, so the filter governs counts and page lists, not rows.
 
 ## Scope notes
 
@@ -154,3 +160,11 @@ Two listed projects **share a store** when their workflow roots are the same str
 
 - **v1** (2026-10-29) — Initial draft.
   - **Lint pass.** 1 fixed; rejected: L-2/L-3/L-4/L-5 — `waiting`/`running`/`idle` are new dot-state literals R5 AC1 defines, not code identifiers; citations anchor the row markup and wait derivation correctly.
+- **v2** (2026-10-29) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/4/2).
+  - **R1-1 — Accepted (MUST_FIX).** Added R2 AC8 requiring the project-list payload to carry each project's store identity (workflow root) so the counts, the any-enabled filter and the page lists all key on the store; restated R2 AC5 to group Specs-page rows by store, not by project id; recorded the choice as D13.
+  - **R1-2 — Accepted (SHOULD_FIX).** R1 Terms now states the dashboard classifies a linked worktree and finds its main working tree by a git determination, not path comparison, and runs it only for an entry whose two paths differ; a new NFR Performance bullet bounds the cost to one determination per such entry per sync.
+  - **R1-3 — Accepted (SHOULD_FIX).** Added R5 AC11 and D14: the filter governs counts and page lists only, never a row's dot or sort position, since the sidebar renders every project row regardless of the filter.
+  - **R1-4 — Accepted (SHOULD_FIX).** Added R4 AC8: the projects.json startup removal must serialize with the controller's unlocked remember/forget writes and never drop a concurrently added entry, naming the atomic-rename seam.
+  - **R1-5 — Accepted (SHOULD_FIX).** R1 AC2 fallback now also requires the listed project's workflow root to equal the entry's workflow root, so a store-only match can no longer fold a worktree onto a different store.
+  - **Minors — noted, no change.** R5 AC6 "1 or more" is a harmless over-generalization under the one-run-per-store guard; R5 AC8 token availability is a design-phase note.
+  - **Lint pass.** 0 fixed; rejected: L-1/L-2/L-3/L-4 — `waiting`/`running`/`idle` are dot-state literals R5 AC1 defines, not code identifiers. The citations anchor the Sidebar row markup (Sidebar.tsx:79-92) and the NowPage wait derivation (NowPage.tsx:241-280), both re-verified. Rule 11 suppresses these: the tokens are unchanged since v1's reasoned rejection.

````
