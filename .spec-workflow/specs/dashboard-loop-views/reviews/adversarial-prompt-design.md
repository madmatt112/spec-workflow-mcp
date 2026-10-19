# Adversarial Review — dashboard-loop-views/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-loop-views
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-loop-views design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-loop-views` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-loop-views` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-loop-views`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 97f2e9a

````diff
diff --git a/.spec-workflow/specs/dashboard-loop-views/design.md b/.spec-workflow/specs/dashboard-loop-views/design.md
index 75ec940..3687f23 100644
--- a/.spec-workflow/specs/dashboard-loop-views/design.md
+++ b/.spec-workflow/specs/dashboard-loop-views/design.md
@@ -13,7 +13,7 @@ This design adds three dashboard views: a PR panel on the Run page fed by the me
 No structure.md exists; the one new server module goes beside its siblings in `src/dashboard/shell/`, and the one new frontend component beside `UsagePage.tsx`.
 
 ### Design System (design-system.md) — if applicable
-N/A: the project has no design-system.md. The new UI uses the existing theme tokens (`src/dashboard_frontend/src/modules/theme/theme.css:97-108` light, `:172-183` dark) and the shell primitives `Group`, `Chips`, `Row` (`src/dashboard_frontend/src/modules/shell/primitives.tsx:12-102`).
+N/A: the project has no design-system.md. The new UI uses the existing theme tokens (`src/dashboard_frontend/src/modules/theme/theme.css:97-108` light, `src/dashboard_frontend/src/modules/theme/theme.css:172-183` dark) and the shell primitives `Group`, `Chips`, `Row` (`src/dashboard_frontend/src/modules/shell/primitives.tsx:12-203`).
 
 ## Architecture
 
@@ -81,7 +81,7 @@ graph LR
   - `serializeFrontmatter` (`src/core/deferral-storage.ts:42-62`) writes `owner: "matthew"` or `owner: "harness"` after the `supersedes` line only when `owner` is one of the two. It writes no `owner` line otherwise.
   - `parseMarkdown` (`src/core/deferral-storage.ts:125-165`) sets `owner` to the scalar when it is `matthew` or `harness`, else `null`.
   - `update`'s `updates` (`src/core/deferral-storage.ts:310-329`) gains `owner?: DeferralOwner`.
-- **Post-conditions:** A record with no `owner` key serializes byte-identical to base, so `reindex` (`src/core/deferral-storage.ts:428-470`) rewrites no legacy file. `resolve`, `merge` (`src/core/deferral-storage.ts:352-372`) and `update` load and re-serialize the whole record, so `owner` survives. No read path writes.
+- **Post-conditions:** A record with no `owner` key serializes byte-identical to base, so `reindex` (`src/core/deferral-storage.ts:428-470`) rewrites no legacy file. `resolve` (`src/core/deferral-storage.ts:296-308`), `merge` (`src/core/deferral-storage.ts:352-372`) and `update` load and re-serialize the whole record, so `owner` survives. No read path writes.
 
 ### C6 — `deferrals` tool owner (`src/tools/deferrals.ts`, `docs/TOOLS-REFERENCE.md`)
 - **Purpose:** Set and return `owner` (R2 AC3, AC4, AC7).
@@ -199,10 +199,10 @@ export interface UsageSpecRow {
     - `mergeable=UNKNOWN` gives `ci: 'green'` with the evaluation pending;
     - `mergeable` is absent when the view fails and present when the runs read fails;
     - `url` comes from the view and is dropped when not https.
-  - `merge.test.ts` also asserts that `runMergeStage` results carry `read` with the verdict, reasons, sha, `kind: 'run'` and `repo`. The two exact `evaluate` assertions (`:171`, `:232`) stay unchanged; no asserted value in the file changes.
+  - `merge.test.ts` also asserts that `runMergeStage` results carry `read` with the verdict, reasons, sha, `kind: 'run'` and `repo`. The two exact `evaluate` assertions (`src/controller/__tests__/merge.test.ts:171`, `src/controller/__tests__/merge.test.ts:232`) stay unchanged; no asserted value in the file changes.
   - `src/controller/__tests__/runs.test.ts` covers `withPrRead`: it replaces the entry with the same repo and number, keeps the others, and puts `run` first.
   - In the "auto: not-ready once, then merged" test (`src/controller/__tests__/runs.test.ts:465-499`), new assertions check that `prReads` holds one read after the first pass (`not-ready`, `pending`) and one read after the second (`merged`, sha `cafef00d1234`).
-  - The close-out test (`:411-434`) gains a `kind: 'closeout'` read.
+  - The close-out test (`src/controller/__tests__/runs.test.ts:411-434`) gains a `kind: 'closeout'` read.
   - `listRunsForWire` gives a row with `prReads` and no `repoDir` key. A record written without `prReads` lists with the field undefined (R1 AC13, invariant).
   - No existing assertion in `runs.test.ts` changes.
   - `src/core/__tests__/deferral-storage.test.ts` checks:
@@ -211,7 +211,7 @@ export interface UsageSpecRow {
     - `reindex` on a legacy file reports `rewritten: 0`, and on an owned file keeps the owner;
     - `resolve`, `merge` and `update` keep the owner, and `update` sets a new one.
   - `src/tools/__tests__/deferrals.test.ts` checks add and update with an owner, a bad owner giving `success: false` with no file created, and `owner` in the list and get output.
-  - `src/dashboard/harness/__tests__/run-setup.test.ts` checks that `1200` gives 1200, and that `12.5`, `abc`, `0` and an absent key give no key. The missing-file equality (`:366-375`) stays unchanged.
+  - `src/dashboard/harness/__tests__/run-setup.test.ts` checks that `1200` gives 1200, and that `12.5`, `abc`, `0` and an absent key give no key. The missing-file equality (`src/dashboard/harness/__tests__/run-setup.test.ts:366-375`) stays unchanged.
   - New `src/dashboard/shell/__tests__/usage-rows.test.ts` uses a temp project with these specs:
     - a spec closed by a HANDOFF row, with two `closeout`/`closed` rows, so the newer date wins;
     - a spec closed by a plan, falling back to the ledger `ts`;
@@ -262,3 +262,4 @@ export interface UsageSpecRow {
 ## Revision History
 
 - **v1** (2026-10-19) — Initial draft.
+  - **Lint pass.** 5 fixed: L-1 (`Row` defined at primitives.tsx:178-203, so the cite is now `:12-203`), L-27 (`resolve` is at deferral-storage.ts:296-308, not `:352-372`; cited separately), L-50/L-51/L-54 (bare `:171`, `:232`, `:411-434` given their full directory-prefixed paths; sibling bare ranges `:172-183` and `:366-375` fixed in the same pass, rule 9). rejected: L-2–L-26, L-28–L-49, L-52, L-53, L-55 — citation-identifier false positives: each flags a new export/field/local/value/keyword this design introduces, or a token the adjacent citation does not anchor, while the citation correctly anchors its existing symbol or region.

````
