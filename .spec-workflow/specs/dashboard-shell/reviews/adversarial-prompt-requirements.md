# Adversarial Review — dashboard-shell/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-shell/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-shell/reviews/adversarial-analysis-requirements.md

## This round

- Read `.spec-workflow/specs/dashboard-shell/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path,citation-range,citation-unchecked,citation-bare,citation-identifier,mdx,caps-invalid,ears-shape,doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): L-1 (warning, citation-identifier, line 22): 'localStorage' absent from cited range (src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:62-105)
L-2 (warning, citation-identifier, line 37): 'start' absent (harness/skills/sdd-continue/SKILL.md:513-516)
L-3 (warning, citation-identifier, line 37): 'jsonl' absent (same range)
L-4 (warning, citation-identifier, line 41): 'jsonl' absent (src/watch/ledger.ts:245-317)
L-5 (warning, citation-identifier, line 41): 'quiet' absent (same range)
L-6 (warning, citation-identifier, line 43): 'gate' absent (src/dashboard/harness/overview-watch.ts:238-265)
L-7 (warning, citation-identifier, line 43): 'ruling' absent (same range)
L-8 (warning, citation-identifier, line 43): 'quiet' absent (same range)
L-9 (warning, citation-identifier, line 43): 'retro' absent (same range)
L-11 (warning, citation-identifier, line 59): 'closeout' absent (src/watch/ledger.ts:202-218)
L-12 (warning, citation-identifier, line 59): 'closed' absent (same range)
L-13 (warning, citation-identifier, line 60): 'retro' absent (src/dashboard/harness/project-watch.ts:62-65)
L-14 (warning, citation-identifier, line 60): 'exited' absent (same range)
L-15 (warning, citation-identifier, line 60): 'quiet' absent (same range)
L-16 (warning, citation-identifier, line 93): 'closeout' absent (src/types.ts:126-136)
L-17 (warning, citation-identifier, line 93): 'closed' absent (same range)
L-18 (warning, citation-identifier, line 93): 'CLOSED' absent (same range) — all L-n above are prose/concept tokens (browser API, backticked tokens, wait-kind names) rejected with reasons in v1 and v2 lint passes, not code symbols at the cited range.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-shell requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: testability of acceptance criteria
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at f004fae4fb9092354e673510044e90b169ed99c4, 1 commits behind HEAD.
A `file:line` from the graph is a hint to confirm, not a citation.

## Changes since e147823

````diff
diff --git a/.spec-workflow/specs/dashboard-shell/requirements.md b/.spec-workflow/specs/dashboard-shell/requirements.md
index 198a386..ab3b20e 100644
--- a/.spec-workflow/specs/dashboard-shell/requirements.md
+++ b/.spec-workflow/specs/dashboard-shell/requirements.md
@@ -1,6 +1,6 @@
 # Requirements Document — dashboard-shell
 
-Document version: v1
+Document version: v2
 
 ## Introduction
 
@@ -21,9 +21,9 @@ This repository has no steering `product.md`, so this document aligns with the d
 1. WHEN the dashboard loads THEN the system SHALL show one sidebar with exactly five routes in this order: Now (`/`), Runs (`/runs`), Specs (`/specs`), Usage (`/usage`), Deferrals (`/deferrals`). Now, Runs, Specs and Deferrals SHALL show the filtered count of waits, live runs, specs and `deferred` records; Usage shows none.
 2. WHEN the dashboard loads THEN the sidebar SHALL list every registered project from `/api/projects/list` (src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:62-105) as a toggle, all on by default, kept in `localStorage`. Every list on every page SHALL show only rows of projects whose toggle is on.
 3. The system SHALL NOT render a project dropdown or any control that selects one current project, and every page SHALL render with any number of projects toggled on. Today the route table renders only when one project is selected (src/dashboard_frontend/src/modules/app/App.tsx:240-270).
-4. WHEN the operator opens the gear at the foot of the sidebar THEN it SHALL show the theme (light or dark), the language and the notification sound volume.
+4. WHEN the operator opens the gear at the foot of the sidebar THEN it SHALL show the theme (light or dark), the language, the list density and the notification sound volume.
 5. Every page SHALL be a list area and a detail panel. WHEN the operator selects a row THEN the panel SHALL show that row's details.
-6. Every list row SHALL be 36 CSS px high. Every group a page names SHALL collapse and expand on a click of its header, and the collapsed state SHALL persist per page in `localStorage`.
+6. Every list row SHALL render at the list density the operator selects in the gear, kept in `localStorage`. Every group a page names SHALL collapse and expand on a click of its header, and the collapsed state SHALL persist per page in `localStorage`.
 7. Every list SHALL have the filter chips its page names, a search box that filters rows by their text 200 ms after the last keystroke, and a pager of 20 rows per page that shows only when more than 20 rows pass the filters.
 8. IF the viewport is at least 1280 CSS px wide THEN the panel SHALL sit right of the list; otherwise the panel SHALL stack under the list. At 1000 px and at 375 px no page SHALL scroll sideways.
 9. Every page SHALL render in the light and the dark theme of the existing theme provider.
@@ -44,7 +44,7 @@ This repository has no steering `product.md`, so this document aligns with the d
 8. The system SHALL order waits by kind (`gate`, `ruling`, `retro`, `exited`, `quiet`), then oldest first.
 9. WHEN a `phase.end` row with result `gate-a` is appended to a watched ledger THEN an open Now page SHALL list the wait within five seconds without a reload.
 10. IF a file the derivation reads is missing, empty or holds a torn line THEN the system SHALL derive no wait from it and SHALL raise no error (the torn-line skip of src/watch/ledger.ts:186-199).
-11. The wait and Specs row derivations SHALL be server modules under `src/` with vitest tests; vitest excludes the frontend (vitest.config.ts:7-8) (D13).
+11. The wait and Specs row derivations SHALL be server modules under `src/` with vitest tests; vitest excludes the frontend (./vitest.config.ts:7-8) (D13).
 
 ### Requirement 3 — Now
 
@@ -93,7 +93,7 @@ This repository has no steering `product.md`, so this document aligns with the d
 2. A spec SHALL be live when a pointer line names its directory; closed when its HANDOFF phase log holds a `closeout` row with result `closed` or its `retrospective-plan.md` status is `CLOSED`; deferred when `SpecIndexEntry.deferred` is true (src/types.ts:126-136); not started when it has no document and no ledger; in progress otherwise (D17).
 3. Each row SHALL show state, spec, phase, document versions (the newest phase-log state `v` plus digits for requirements, design and tasks, shown as `R4 D3 T2`), tasks done of total, the distinct `PR #` numbers in its phase-log notes, the count of `deferred` records whose `originSpec` is the spec, the retro outcome (the plan's status word, else none) and the updated time (newest ledger row or phase-log date) (D18).
 4. WHEN the operator selects a spec THEN the panel SHALL show: its number in the decomposition heading that names it, else none; the text of that entry's `**Depends on**` paragraph, else none; one row per `run.start` in its ledger with run id, start, end, status and token total; its phase table from `parseHandoffPhaseRows`; its deferral records (id, title, status); and each file at the top level of its directory.
-5. Each file row SHALL have a Copy path button that copies the absolute path and an Open link of the form `vscode://file` followed by the absolute path (D3).
+5. Each file row SHALL have an Open action that copies the file's absolute path to the clipboard; no file row SHALL offer an editor-open link (D3).
 6. The Specs page SHALL render no document content, and no route SHALL render a spec document.
 7. WHEN a spec markdown file, a deferral record or a HANDOFF changes THEN an open Specs page SHALL update within five seconds without a reload.
 
@@ -143,8 +143,8 @@ This repository has no steering `product.md`, so this document aligns with the d
 
 - D1 — The new pages keep react-i18next with English strings only; other locales fall back to English: options were keep react-i18next with English only, drop i18n from the new pages, translate every new string into all eleven locales; chosen because the gear keeps a language setting and the English fallback exists.
 - D2 — One run per spec store holds for dashboard launches: options were keep one run per spec store, allow one run per spec; chosen because the launcher's admission already enforces it and end-to-end check 3 requires it.
-- D3 — Open in editor is a VS Code file link with a Copy path button beside it: options were a link plus copy path, a VS Code link only, copy path only; chosen because copy always works (under WSL a plain file link may not resolve) and the link is one tap where it does.
-- D4 — Row density is fixed at 36 px with no density setting: options were 36 px fixed, a density setting in the gear, 32 px rows; chosen because the decomposition delivers 36 px rows.
+- D3 — The Open action copies the file's absolute path and there is no editor-open link: options were a link plus copy path, a VS Code link only, copy path only; chosen by Gate A because copy always works, where a plain file link may not resolve under WSL.
+- D4 — Lists use a user-selected density setting in the gear, not a fixed row height: options were 36 px fixed, a density setting in the gear, 32 px rows; chosen by Gate A, which picked the gear density setting.
 - D5 — An `escalate` phase end is a `ruling` wait: options were include it as a ruling wait, leave it out of Now; chosen because the Overview page Now replaces counts it as waiting.
 - D6 — The deferral-owner wait is not derived here: options were defer it to spec 17, derive it from deferral tags, show every open deferral; chosen because deferral records have no owner or blocks field until spec 17.
 - D7 — The Harness and Overview pages are removed; their parts move into Runs and Now: options were remove them, keep them as hidden routes; chosen because the decomposition moves them.
@@ -155,7 +155,7 @@ This repository has no steering `product.md`, so this document aligns with the d
 - D12 — An idle project's routed spec comes from the routing that Launch uses, not the HANDOFF header: options were the launch routing, the HANDOFF header; chosen because Now and the Launch card then agree.
 - D13 — Waits and spec rows are derived in server modules: options were server modules, browser code; chosen because vitest covers only server code.
 - D14 — Pager 20 rows, search debounce 200 ms, panel stacks below 1280 px: options were these values, 25 rows with 300 ms and 1024 px; chosen because spec 17 paginates past twenty and check 6 stacks at 1000 px.
-- D15 — The gear holds theme, language and sound; notification settings come with spec 16: options were defer them, ship an empty section; chosen because no notification exists before spec 16.
+- D15 — The gear holds theme, language, list density and sound; notification settings come with spec 16: options were defer them, ship an empty section; chosen because no notification exists before spec 16.
 - D16 — The Approvals page goes; the approvals tool and its deeplink stay unchanged; docs point manual approvals at the VS Code extension: options were accept the removal, keep the Approvals page, change the tool's deeplink here; chosen because the decomposition removes the page and the tool is a sensitive path.
 - D17 — A spec is closed on a closed close-out row or a CLOSED plan: options were either signal, the close-out row only; chosen because older specs have only the plan.
 - D18 — The PRs column shows HANDOFF PR numbers without state: options were numbers only, numbers with state from the PR host; chosen because PR state is spec 17.
@@ -173,3 +173,7 @@ This repository has no steering `product.md`, so this document aligns with the d
 
 - **v1** (2026-10-06) — Initial draft.
   - **Lint pass.** 4 fixed (L-4 buildModel range, L-12 launchable/disabledReason fields, L-21/L-22 watch-set anchors); rejected: L-1 (localStorage is the browser API the new toggle uses, outside the cited /api/projects/list range); L-2, L-3, L-5, L-6, L-13, L-14, L-18, L-19, L-20 (backticked row-type, result-value and filename tokens, not code symbols at the cited range; parseHandoffPhaseRows and SpecIndexEntry resolve); L-7, L-8, L-9, L-10, L-15, L-16, L-17 (wait-kind names, prose); L-11 (vitest.config.ts is a repository-root file with no directory prefix; line 8 confirms the frontend exclude).
+- **v2** (2026-10-06) — Revision from the input below.
+  - **Lint pass.** 1 fixed (L-10 vitest.config.ts directory prefix); rejected: L-1 through L-9 and L-11 through L-18 (citation-identifier re-fires on prose/concept tokens — browser API localStorage, backticked jsonl, wait-kind names start/quiet/gate/ruling/retro/closeout/closed/exited/CLOSED — all unchanged since v1 rejected them with reasons).
+  - **RI-1 — Accepted (MUST_FIX).** Gate A chose copy-path-only, so Requirement 5 AC 5 now reads that each file row has an Open action that copies the file's absolute path to the clipboard and offers no editor-open link; D3 is restated to that choice and its false clause claiming the link is one tap is removed.
+  - **RI-2 — Accepted (MUST_FIX).** Gate A chose a gear density setting, so Requirement 1 AC 6 now renders rows at the list density the operator selects in the gear, AC 4 adds the list density to the gear menu, and D4 and D15 are restated to that choice; i18n and the one-run-per-store rule are left unchanged as recorded.
````
