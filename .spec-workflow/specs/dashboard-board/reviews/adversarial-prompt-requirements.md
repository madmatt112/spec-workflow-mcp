# Adversarial Review — dashboard-board/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-board
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): dashboard-board requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-board` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-board`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since eef0ab82

````diff
diff --git a/.spec-workflow/specs/dashboard-board/requirements.md b/.spec-workflow/specs/dashboard-board/requirements.md
index 6c442c59..88c2c643 100644
--- a/.spec-workflow/specs/dashboard-board/requirements.md
+++ b/.spec-workflow/specs/dashboard-board/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and Run page with one board of large tiles under a top bar. It is for the operator, who needs to see what waits, what moves and what can start next. It changes the shell, Home and the run row; Specs, Usage and Deferrals keep their content until spec 34.
+This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and Run page with one board of large tiles under a top bar. It is for the operator, who needs to see what waits, what moves and what starts next. It changes the shell, Home and the run row; Specs, Usage and Deferrals keep their content until spec 34.
 
 ## Alignment with Product Vision
 
-`.spec-workflow/steering/` holds no `product.md`, so this document aligns to the "Dashboard board specs" preamble of `decomposition.md` in its place. That preamble asks for fewer things, larger, with colour only for state. This spec gives specs 33 and 34 the shell they render into.
+`.spec-workflow/steering/` holds no `product.md`, so this document aligns to the "Dashboard board specs" preamble of `decomposition.md`. That preamble asks for fewer things, larger, with colour only for state. This spec gives specs 33 and 34 the shell they render into.
 
 ## Requirements
 
@@ -23,7 +23,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 5. WHEN the shell builds THEN the density toggle, type, storage key and `--row-h-compact` token SHALL be gone (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:7`, `src/dashboard_frontend/src/modules/shell/Gear.tsx:75-99`). `--row-h` SHALL stay at the comfortable value, because `src/dashboard_frontend/src/modules/shell/primitives.tsx:187` still reads it.
 6. WHEN a project switch changes THEN the choice SHALL persist in `localStorage` and every `enabled` filter SHALL follow it.
 7. IF the operator has never set a project named `sdd-fixture` THEN that project SHALL be off, on the board and in the gear. IF the operator turns it on THEN it SHALL stay on across reloads. Every other unset project SHALL stay on (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:74-77`).
-8. WHEN the socket is down THEN `ConnectionBanner` SHALL be the only notice; the marker at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:114-121` goes.
+8. WHEN the socket is down THEN `ConnectionBanner` (`src/dashboard_frontend/src/modules/app/ConnectionBanner.tsx:13`) SHALL be the only notice; the marker at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:114-121` goes.
 
 ### Requirement 2 — What is removed
 
@@ -33,7 +33,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 1. WHEN the frontend builds THEN `Sidebar.tsx`, `RunsPage.tsx`, `RunPage.tsx` and their routes (`src/dashboard_frontend/src/modules/app/App.tsx:26-27`) SHALL be gone, and `/#/runs` and `/#/runs/` plus any id SHALL land on Home through the catch-all route (`src/dashboard_frontend/src/modules/app/App.tsx:31`).
 2. WHEN the server starts THEN `GET /api/controller/runs/:id/log` (`src/dashboard/multi-server.ts:868-875`) and `GET /api/projects/:projectId/specs/:specName/task-reviews/summary` (`src/dashboard/multi-server.ts:594-617`) SHALL answer as unknown routes, and `readRunLogTail` (`src/controller/runs.ts:1494-1528`) SHALL be gone with its tests (`src/dashboard/__tests__/controller-dashboard-routes.test.ts:192`).
-3. WHEN those pages go THEN every server message, builder, type and test only they read SHALL go too. At least: `shell-now` with its `NowModel` builder, `sidebar-rows.ts`, the derived-wait reader `deriveProjectWaits`; `harness-model`, `harness-run-detail`, `run-detail.ts` and the hub's project watches (`src/dashboard/harness/hub.ts:78-93`); and `controller-activity` on the shell feed (`src/dashboard/shell/shell-feed.ts:150-158`). `parseHandoffRouting` SHALL survive, because `src/dashboard/harness/run-setup.ts:16` and `src/dashboard/harness/overview-watch.ts:15` import it from `project-watch.ts`.
+3. WHEN those pages go THEN every server message, builder, type and test only they read SHALL go too. At least: `shell-now` with its `NowModel` builder (`src/dashboard/shell/now-model.ts:186-191`), `sidebar-rows.ts`, the derived-wait reader `deriveProjectWaits` (`src/dashboard/shell/waits.ts:111`); `harness-model`, `harness-run-detail`, `run-detail.ts` and the hub's project watches (`src/dashboard/harness/hub.ts:78-93`); and `controller-activity` on the shell feed (`src/dashboard/shell/shell-feed.ts:150-158`). `parseHandoffRouting` SHALL survive, because `src/dashboard/harness/run-setup.ts:16` and `src/dashboard/harness/overview-watch.ts:15` import it from `project-watch.ts`.
 4. WHEN the removal lands THEN `cancel`, `pause`, `resume`, `redrive` (`src/dashboard/multi-server.ts:822-856`), the advisor open route (`src/dashboard/multi-server.ts:748-759`), the action routes (`src/dashboard/multi-server.ts:796-812`), the TUI and the HUD SHALL behave as at base (invariant, verified, not red-first).
 5. WHEN the removal lands THEN `e2e/worktree-shell.spec.ts`, `e2e/worktree-project-list.spec.ts`, `e2e/worktree-no-shared.spec.ts`, `e2e/worktree-deploy.spec.ts` and `e2e/worktree-visual.spec.ts` SHALL be rewritten to the board or lose the cases that test removed things (for example `e2e/worktree-shell.spec.ts:25-26`, `e2e/worktree-shell.spec.ts:243`), and `src/dashboard/__tests__/frontend-tokens.test.ts:126-127` SHALL match the token list.
 6. WHEN the removal lands THEN `docs/SDD-HARNESS.md:99-100`, `docs/SDD-HARNESS.md:120` and `docs/SDD-HARNESS.md:469` SHALL name Home in place of the Runs and Now pages.
@@ -62,7 +62,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 1. WHEN a wait tile renders THEN it SHALL show the kind label, project tag, spec, the first line of `questions[0].text`, the age in the display type size, and one action, "Answer". IF the wait has no questions THEN it SHALL show the kind's fallback line (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78`).
 2. WHEN the age is under 15 minutes THEN the tile SHALL be neutral; from 15 minutes to under 1 hour, amber; at 1 hour and after, red. The colour SHALL change with no reload.
-3. WHEN a `merge` wait tile renders THEN it SHALL show the PR number, the CI state and the rule verdict from the `prReads` of the run named by `wait.run`. The read SHALL match the wait's question id: `merge` takes the `kind: 'run'` read (`src/controller/merge.ts:28`); `merge:` plus repo and number takes the read with that repo and number (`src/controller/merge.ts:556`). IF no read matches THEN the tile SHALL say "PR not read yet".
+3. WHEN a `merge` wait tile renders THEN it SHALL show the PR number, the CI state and the rule verdict from the `prReads` (`src/controller/state.ts:112`) of the run named by `wait.run`. The read SHALL match the wait's question id: `merge` takes the `kind: 'run'` read (`src/controller/merge.ts:28`); `merge:` plus repo and number takes the read with that repo and number (`src/controller/merge.ts:556`). IF no read matches THEN the tile SHALL say "PR not read yet".
 4. WHEN "Answer" is pressed THEN the existing answer sheet (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:500-701`) SHALL replace the board at full width, with a "Back to board" link. No panel SHALL sit beside it.
 5. WHEN the sheet's wait is answered, here or elsewhere, THEN the board SHALL return.
 
@@ -88,7 +88,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 3. WHEN no step is in flight THEN the dot SHALL be grey and no heartbeat line SHALL show.
 4. WHEN a run has status `running` and `driven: false`, or status `waiting` with an open wait whose question id is `drive-crash` (`src/controller/waits.ts:193`), THEN the tile SHALL show red "Stalled" and Re-drive in place of the dot. `src/controller/controller.ts:205-222` accepts exactly these. No other run with `driven: false` SHALL read as stalled.
 5. WHEN Re-drive is accepted THEN the tile SHALL show a green dot within 15 s of the step's spawn.
-6. WHEN a pause is pending (`pauseRequested` set, status not `paused`) THEN the note SHALL read "pausing after this step", replacing "pause requested" at `src/dashboard_frontend/src/modules/shell/pause.ts:43`; applied, it SHALL start with "paused".
+6. WHEN a pause is pending (`pauseRequested` set, status not `paused`) THEN the note SHALL read "pausing after this step", replacing "pause requested" at `src/dashboard_frontend/src/modules/shell/pause.ts:42-43`; applied, it SHALL start with "paused".
 7. WHEN a run has `holdBy: 'deploy'` THEN the note SHALL read "held for deploy" and the tile SHALL offer no Resume (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/pause.ts:34-36`, `e2e/worktree-deploy.spec.ts:271`).
 
 ### Requirement 7 — Run tile actions
@@ -104,7 +104,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 5. WHEN Discard is pressed THEN the tile SHALL ask for a second press that names what goes ("This deletes the worktree and branch and closes the PR", `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360`), and only that press SHALL call the route.
 6. WHEN the run is `abandoned` or `error` with its branch present, or `done` with its branch present and `updated` under 24 hours old, THEN it SHALL have a tile. Otherwise a stopped run SHALL have none.
 7. IF another run in a moving status has the same `branch` and `codeRoot` THEN the tile SHALL NOT offer Discard, and the `discard` route SHALL answer 409 `branch-in-use` and change nothing. The route has no such check at base (`src/controller/runs.ts:1400-1422`).
-8. WHEN a `done` run is discarded THEN its status SHALL stay `done`; `cancelRun` writes `abandoned` today (`src/controller/runs.ts:1390`).
+8. WHEN a `done` run is discarded THEN its status SHALL stay `done`; `cancelRun` writes `abandoned` today (`src/controller/runs.ts:1374-1390`).
 
 ### Requirement 8 — The Next tile
 
@@ -115,7 +115,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 1. WHEN an enabled project's setup view (`GET /api/projects/:projectId/harness/setup`, `src/dashboard/multi-server.ts:662-674`) has a non-null `launchable` THEN Next SHALL show a tile with the spec, the project tag, the setup in one line, and Launch. `NowModel.idle` SHALL NOT be the source: it omits the decomposition fallback (`src/dashboard/shell/now-model.ts:127-133`, `src/dashboard/harness/run-setup.ts:198-202`).
 2. WHEN two listed projects share a store THEN Next SHALL show at most one tile for that store, using the group's representative (`src/dashboard_frontend/src/modules/projects/stores.ts:25-43`) when it is on, else the enabled member.
 3. WHEN the setup line renders THEN it SHALL state the supervisor model, the role count, the worktree value, and gates as `record`, because the launch route forces that value (`src/dashboard/multi-server.ts:687`); `view.gates` SHALL NOT show.
-4. WHEN `launchBlock` nulls `launchable` (`src/controller/controller.ts:386-399`) THEN the project SHALL show no Next tile.
+4. WHEN `launchBlock` (`src/controller/controller.ts:386-399`) nulls `launchable` (`src/dashboard/multi-server.ts:671`) THEN the project SHALL show no Next tile.
 5. WHEN a run ends or starts THEN Next SHALL reflect it within 5 s with no reload; the fetch on mount of `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:404` is not enough.
 6. WHEN Launch is pressed THEN it SHALL post `buildLaunchInput` as at base (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/harness.tsx:40-52`). The tile SHALL have no edit control.
 
@@ -177,7 +177,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 ## Decisions taken in this document
 
 - D1 — Posture on money, personal data, deletion and legal: no money, billing, personal data or legal surface, so no refunds, forfeiture or credits apply; the one deletion is Discard of the operator's own worktree, local branch and PR, irreversible, behind a second press that names what goes; options were that stance, one press with no confirm, a soft delete that keeps the branch for a period; chosen because the operator owns the data and the existing confirm wording covers it.
-- D2 — A done run with its branch present keeps a tile for 24 hours; options were 24 hours then no tile, every done run with a branch as the entry says, no tile for done runs at all, a 7-day window; chosen because 21 of the 28 done runs on this machine still have their branch, so the literal rule fills Running with finished work.
+- D2 — A done run with its branch present keeps a tile for 24 hours; options were 24 hours then no tile, every done run with a branch as the entry says, no tile for done runs at all, a 7-day window; chosen because 21 of the 28 done runs still have their branch, so the literal rule fills Running with finished work.
 - D3 — Home shows controller waits only; options were controller waits only, both kinds as today; chosen because the entry derives tiles from records, and a stale draft plan would hold a derived retro tile forever.
 - D4 — Server feeds only the removed pages read are deleted here; options were delete them in this spec, leave them for spec 34; chosen because the entry says removed with their components and tests, and lists the hub.
 - D5 — Discard refuses when a moving run shares the branch; options were tile and route, tile only, no guard; chosen because a relaunched spec reuses its branch and worktree, so a Discard could delete a live run's work.
@@ -199,10 +199,11 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 - Carried items: none.
 - Cut: the right panel stays on Specs and Deferrals until spec 34 (D9); `done` runs keep a tile for 24 hours only (D2).
-- Added: the `discard` guard (R7 AC 7), the `done` status fix (R7 AC 8) and the controller writes of R12. The entry's "Design MUST enumerate" list omits `src/controller/runs.ts` and `src/controller/state.ts`; design must add them.
+- Added: the `discard` guard (R7 AC 7), the `done` status fix (R7 AC 8) and the controller writes of R12. The entry's "Design MUST enumerate" list omits `src/controller/runs.ts` and `src/controller/state.ts`; design adds them.
 - Narrowed: "A run with `driven: false`" reads as R6 AC 4 (D7).
-- Left to design, as the entry asks: a confirm on Stop for a stalled run; the `merging` and `queued` tiles beyond R6 and R7; the enable default for the two tradr entries.
+- Left to design: a confirm on Stop for a stalled run; the `merging` and `queued` tiles beyond R6 and R7; the enable default for the two tradr entries.
 
 ## Revision History
 
 - **v1** (2026-11-06) — Initial draft.
+  - **Lint pass.** 8 fixed; rejected: none.

````
