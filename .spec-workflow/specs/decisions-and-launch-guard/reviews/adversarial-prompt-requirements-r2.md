# Adversarial Review — decisions-and-launch-guard/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): decisions-and-launch-guard requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since bdd4ae9a

````diff
diff --git a/.spec-workflow/specs/decisions-and-launch-guard/requirements.md b/.spec-workflow/specs/decisions-and-launch-guard/requirements.md
index a5dc304b..ec676891 100644
--- a/.spec-workflow/specs/decisions-and-launch-guard/requirements.md
+++ b/.spec-workflow/specs/decisions-and-launch-guard/requirements.md
@@ -2,7 +2,7 @@
 
 ## Introduction
 
-This spec fixes eleven operator-reported defects in launch, close-out, cancel and the Home board. It serves the operator who runs specs from the dashboard across projects that share one spec store. It adds project display names and a launch warning, builds recorded retro decisions, and makes a cancel final.
+This spec fixes eleven operator items in launch, close-out, cancel and the Home board. It serves the operator who runs specs from the dashboard across projects that share one spec store.
 
 ## Alignment with Product Vision
 
@@ -35,14 +35,14 @@ This spec fixes eleven operator-reported defects in launch, close-out, cancel an
 2. WHEN two enabled projects share a store and the spec is launchable THEN Next SHALL show one tile per enabled project. This replaces dashboard-board Requirement 8 AC 2 and `nextProjects` (`src/dashboard_frontend/src/modules/shell/board.ts:61-76`).
 3. WHEN the spec's files do not exist under the tile's code root THEN the tile SHALL show a warning that names that code root and the project to use.
 4. WHEN the warning shows THEN a first press of Launch SHALL send no request and SHALL arm the tile, and a second press SHALL post the same `buildLaunchInput` body (`src/dashboard_frontend/src/modules/shell/harness.tsx:40-52`).
-5. WHEN no warning shows THEN one press SHALL launch (invariant, verified, not red-first).
+5. WHEN no warning shows THEN one press SHALL launch (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/HomePage.tsx:188-194`).
 6. IF no project of the store holds the files THEN the warning rule in AC 8 SHALL apply, and the tile SHALL never name a project that does not hold them.
 7. A launchable spec often has no `tasks.md` and no directory (`src/dashboard/harness/run-setup.ts:230-239`), so this is the common case at launch. WHEN `tasks.md` exists THEN the guard SHALL read its `File:` entries (`src/core/task-parser.ts:332-345`). WHEN it does not exist THEN the guard SHALL read the source the design states, and that source SHALL give a comparison for a decomposition entry that names repository paths. WHEN no source gives a file list THEN the tile SHALL say so and Launch SHALL need one press.
 8. The design SHALL state the rule for a spec that creates mostly new files. A path that exists under no project of the store SHALL NOT count against a tile.
 9. IF the guard's read fails THEN the tile SHALL still render, with no warning.
 10. The launch route, `launchSpec` and `enqueue` admission SHALL not change (invariant, verified, not red-first: `src/dashboard/multi-server.ts:105-132`).
 
-Verification: with task files only in the app repository, the `tradr infra` tile warns and a first press does not launch, and the `tradr app` tile shows no warning.
+Verification: with task files only in the app repository, the `tradr infra` tile warns and a first press does not launch, and the `tradr app` tile shows no warning. A second scenario, a launchable spec with no `tasks.md`, exercises the design-stated source on the common branch and holds the same warning rule.
 
 ### Requirement 3 — Close-out builds recorded decisions
 
@@ -50,11 +50,11 @@ Verification: with task files only in the app repository, the `tradr infra` tile
 
 #### Acceptance Criteria
 
-1. WHEN the close-out reads a plan THEN it SHALL read the `## Decisions` lines that `buildRetroPlanMarkdown` writes (`src/controller/runs.ts:340-363`). An answer of `no answer` SHALL count as not recorded.
+1. WHEN the close-out reads a plan THEN it SHALL read the `## Decisions` lines that `buildRetroPlanMarkdown` writes (`src/controller/runs.ts:340-363`). Each decision is one line (`src/controller/runs.ts:356`) and the read takes that line; an answer of `no answer` SHALL count as not recorded.
 2. WHEN an approved proposal has a recorded answer THEN its close-out line SHALL NOT be `skipped — no change chosen`. At base the fallback at `src/controller/phases/closeout.ts:362-375` writes that line for a class `none` item with no `Decision:` line and no human target.
 3. WHEN an item with a recorded answer goes to a batch THEN the brief SHALL carry the answer. `itemsText` holds only the item block at base (`src/controller/phases/closeout.ts:404`).
 4. IF an item has a recorded answer and its target gives no landing class THEN its line SHALL be `to-do (human) — ` and a reason that states the answer and why no batch can build it.
-5. IF the recorded answer itself chooses no change THEN the line SHALL be `skipped — ` and the answer text. The design states the test for this case.
+5. IF the recorded answer itself chooses no change THEN the line SHALL be `skipped — ` and the answer text. The match over free text is heuristic; the design pins and tests it.
 6. WHEN an item with a recorded answer does not land THEN its line SHALL be `to-do (human) — ` and the reason. `src/controller/phases/closeout.ts:633` writes `skipped` at base. The commit revert for an item that did not land SHALL not change.
 7. WHEN an approved item carries a `Target document:` line THEN the close-out SHALL read it as the item's target. `classifyTarget` and Step 1 match only `Target:` (`src/tools/harness.ts:541-546`, `src/controller/phases/closeout.ts:368`), so G1 and G2 read as class `none`.
 8. WHEN an approved item has no recorded answer and its target says no change THEN its line SHALL stay `skipped — no change chosen` (invariant, verified, not red-first).
@@ -180,23 +180,23 @@ Verification: with one running run, one done run and one abandoned run, each sto
 
 ## Decisions taken in this document
 
-- D1 — The doc review cap fixes the findings before it approves: options were one corrective reviser version, lint and narrow check, then approve; approve at once with the findings open; carry the findings to the next phase; chosen because a MUST_FIX never stays open, and the corrective path already exists.
-- D2 — Next shows one tile per enabled project in a shared store: options were one tile per enabled project; keep one tile per store with the warning only; keep one tile and add a project picker; chosen because the verification names both tiles, and with one tile the representative is the infra project, so the warning has no tile to send the operator to. This overrides dashboard-board D11.
-- D3 — After a patch the controller re-runs the gate on the same commit: options were re-gate the existing commit; spawn a new implementer; chosen because a REQUIRED report makes no commit and the off-list change is already in the task commit. The controller builds the patch from the gate reasons, so the gate output does not change, although the retro said the gate emits it. The ledger row and the spec-store commit keep a wrong patch visible and revertible, which answers the retro risk note.
-- D4 — A recorded answer that no batch can build becomes a to-do with its reason: options were a to-do with the reason; infer a landing class from the answer text; send it to the store batch; chosen because the decomposition asks for a to-do and a guessed landing could put code in the wrong repository.
-- D5 — The launch guard warns and never refuses: options were a warning with a second press; refuse at the server; hide the tile; chosen because both projects stay and some specs change the infra repository.
-- D6 — The advisor launch path gets no guard: options were leave it; add the check to the shared launch function; chosen because its Confirm press is already a second press and the decomposition places the guard on the tile.
-- D7 — Cancel applies in every phase, including document phases: options were stop in every phase; stop only in the driver loop; chosen because the reproductions were in the requirements phase. This overrides run-pause design D7 for cancel only; the usage window stays out of the document stop.
-- D8 — The doc review cap applies to round 1 only and an unlabelled finding counts as design: options were round 1 only; any round; chosen because the operator's decision says round 1, and a missing label must not skip a review.
-- D9 — The stopped band is a fourth band below Next, absent when empty, with the admission rule unchanged: options were below Next; between Running and Next; inside Running with a divider; chosen because the operator asked for a separate, quieter band. This overrides dashboard-board Requirement 3's three fixed bands.
-- D10 — Tone maps stalled and red to danger, amber to warning, and green and grey to neutral: options were this map; danger only for stalled; chosen because the entry says the outline follows the same signal as the dot. Action tiles keep age tone because the entry changes only run tiles.
-- D11 — A run tile adds phase and run age and keeps step kind and step age: options were add and keep; replace the step fields; chosen because the entry asks for phase and age and nothing else.
-- D12 — An approved item with a Target document line is read as having a target: options were read that line; require the analyst to write the plain Target line; chosen because existing approved plans already use it, and G1 and G2 carry no Decisions line.
-- D13 — G1 and G2 land in this store's rules file only: options were this store only; this store and the tradr store; chosen because the entry names this file and a run here commits nothing in the tradr store.
+- D1 — The doc review cap fixes the findings before it approves, because a MUST_FIX never stays open and the corrective path already exists.
+- D2 — Next shows one tile per enabled project in a shared store, because with one tile the representative is the infra project, leaving no tile for the warning the verification names. Overrides dashboard-board D11.
+- D3 — After a patch the controller re-runs the gate on the same commit, because a REQUIRED report makes no commit and the off-list change is already in the task commit. The patch is built from the gate reasons, so the gate output does not change; the ledger row and the spec-store commit keep a wrong patch revertible.
+- D4 — A recorded answer that no batch can build becomes a to-do with its reason, because the decomposition asks for a to-do and a guessed landing could put code in the wrong repository.
+- D5 — The launch guard warns and never refuses, because both projects stay and some specs change the infra repository.
+- D6 — The advisor launch path gets no guard, because its Confirm press is already a second press and the decomposition places the guard on the tile.
+- D7 — Cancel applies in every phase, including document phases, because the reproductions were in the requirements phase. Overrides run-pause design D7 for cancel only; the usage window stays out of the document stop.
+- D8 — The doc review cap applies to round 1 only and an unlabelled finding counts as design, because the operator's decision says round 1 and a missing label must not skip a review.
+- D9 — The stopped band is a fourth band below Next, absent when empty, with the admission rule unchanged, because the operator asked for a separate, quieter band. Overrides dashboard-board Requirement 3's three fixed bands.
+- D10 — Tone maps stalled and red to danger, amber to warning, and green and grey to neutral, because the outline follows the same signal as the dot. Action tiles keep age tone, as the entry changes only run tiles.
+- D11 — A run tile adds phase and run age and keeps step kind and step age, because the entry asks for phase and age and nothing else.
+- D12 — An approved item with a Target document line is read as having a target, because existing approved plans already use it and G1 and G2 carry no Decisions line.
+- D13 — G1 and G2 land in this store's rules file only, because the entry names this file and a run here commits nothing in the tradr store.
 
 ## Scope notes
 
-Left to the design, as the decomposition asks: how a reviewer labels a finding, where the display name is set, the guard's source with no `tasks.md`, the new-files rule, how long an abandoned run stays in the stopped band, and Discard on a reused branch name. Requirements 1, 2, 5 and 9 set limits on these.
+Left to the design, as the decomposition asks: how a reviewer labels a finding, where the display name is set, the guard's source with no `tasks.md` and how it disambiguates a path present under more than one store code root, the new-files rule, how long an abandoned run stays in the stopped band, and Discard on a reused branch name. Requirements 1, 2, 5 and 9 set limits on these.
 
 Cut or deferred:
 
@@ -204,7 +204,6 @@ Cut or deferred:
 - The no-PR half of `d-aaf54e29` (related `d-c3c57b89`): out of scope, as the entry resolves only the launch half.
 - The spec folder that a later ledger write recreated in the first `d-4f6a6271` reproduction: not listed in the entry and did not recur in the second. Requirement 7 removes the later steps, and no separate requirement covers it.
 - Retro P1 and P11: P1 launch checks are covered by Requirement 2. P11 stays on tradr deferral `d-8619948d`.
-- `.spec-workflow/steering/product.md`: absent, so nothing was loaded.
 
 Carried items: none.
 
@@ -212,3 +211,10 @@ Carried items: none.
 
 - **v1** (2026-11-07) — Initial draft.
   - **Lint pass.** 18 fixed; rejected: L-4, L-5, L-6, L-7 (`drafting`/`design` are the labels Requirement 5 introduces, absent from base code by design), L-12 (`phase` is the field this AC adds to the tile, absent from the base render by design).
+- **v2** (2026-11-07) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/1/4).
+  - **R1-1 — Accepted (SHOULD_FIX).** Req 2 Verification now adds a second scenario, a launchable spec with no tasks.md on the common design-stated-source branch; the under-two-roots path disambiguation is deferred to the design in Scope notes.
+  - **R1-2 — Accepted (MINOR).** Req 2 AC5 now cites the base one-press path, HomePage.tsx lines 188-194.
+  - **R1-3 — Accepted (MINOR).** Req 3 AC1 now states each decision is one line and the read takes that line, so a multi-line answer cannot truncate silently.
+  - **R1-4 — Accepted (MINOR).** Req 3 AC5 now flags the no-change match as heuristic over free text, pinned and tested in the design.
+  - **R1-5 — Accepted (MINOR).** Introduction now reads eleven operator items, not operator-reported defects, since items 4 and 5 are retro efficiency decisions.
+  - **Lint pass.** 0 fixed; rejected: L-1–L-5 (`drafting`/`design`/`phase` = labels/field Reqs 5, 8 add; absent from cited base ranges by design; v1 rejected same class as L-4–L-7, L-12).

````
