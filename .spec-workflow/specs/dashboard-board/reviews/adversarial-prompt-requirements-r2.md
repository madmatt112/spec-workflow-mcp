# Adversarial Review — dashboard-board/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-board
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-board requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-board`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 7d6b62ef

````diff
diff --git a/.spec-workflow/specs/dashboard-board/requirements.md b/.spec-workflow/specs/dashboard-board/requirements.md
index 88c2c643..260cbdbc 100644
--- a/.spec-workflow/specs/dashboard-board/requirements.md
+++ b/.spec-workflow/specs/dashboard-board/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and Run page with one board of large tiles under a top bar. It is for the operator, who needs to see what waits, what moves and what starts next. It changes the shell, Home and the run row; Specs, Usage and Deferrals keep their content until spec 34.
+This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and Run page with one board of large tiles under a top bar. It is for the operator, who must see what waits, moves and starts next. It changes the shell, Home, the run row and the controller behind them (R7 and R12); Specs, Usage and Deferrals keep their content until spec 34.
 
 ## Alignment with Product Vision
 
-`.spec-workflow/steering/` holds no `product.md`, so this document aligns to the "Dashboard board specs" preamble of `decomposition.md`. That preamble asks for fewer things, larger, with colour only for state. This spec gives specs 33 and 34 the shell they render into.
+`.spec-workflow/steering/` holds no `product.md`, so this document aligns to the "Dashboard board specs" preamble of `decomposition.md`: fewer things, larger, colour only for state. It gives specs 33 and 34 the shell they render into.
 
 ## Requirements
 
@@ -19,10 +19,10 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 1. WHEN any page renders THEN the shell SHALL show one top bar with, in this order: the links Home, Specs, Usage and Deferrals, the Deploy control, Open advisor, and the gear. The links SHALL carry no counts.
 2. WHEN the top bar renders THEN it SHALL mount `DeployControl` unchanged, with no props (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/DeployControl.tsx:12`; `.spec-workflow/specs/dashboard-deploy/requirements.md:108`).
 3. WHEN Open advisor is pressed THEN it SHALL behave as `src/dashboard_frontend/src/modules/shell/NowPage.tsx:105-139` does, and its result line SHALL wrap.
-4. WHEN the gear opens in the top bar THEN its panel SHALL open downward (it opens upward today, `src/dashboard_frontend/src/modules/shell/Gear.tsx:64`) and SHALL hold the theme toggle, one switch per listed project with its name, the notification setting and the version.
+4. WHEN the gear opens in the top bar THEN its panel SHALL open downward (it opens upward today, `src/dashboard_frontend/src/modules/shell/Gear.tsx:64`) and SHALL hold the theme toggle, a switch per listed project with its name, the notification setting and the version.
 5. WHEN the shell builds THEN the density toggle, type, storage key and `--row-h-compact` token SHALL be gone (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:7`, `src/dashboard_frontend/src/modules/shell/Gear.tsx:75-99`). `--row-h` SHALL stay at the comfortable value, because `src/dashboard_frontend/src/modules/shell/primitives.tsx:187` still reads it.
 6. WHEN a project switch changes THEN the choice SHALL persist in `localStorage` and every `enabled` filter SHALL follow it.
-7. IF the operator has never set a project named `sdd-fixture` THEN that project SHALL be off, on the board and in the gear. IF the operator turns it on THEN it SHALL stay on across reloads. Every other unset project SHALL stay on (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:74-77`).
+7. IF the operator has never set the project `sdd-fixture` THEN it SHALL be off, on the board and in the gear, but stay on across reloads once turned on. Every other unset project SHALL stay on (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:74-77`).
 8. WHEN the socket is down THEN `ConnectionBanner` (`src/dashboard_frontend/src/modules/app/ConnectionBanner.tsx:13`) SHALL be the only notice; the marker at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:114-121` goes.
 
 ### Requirement 2 — What is removed
@@ -44,7 +44,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 #### Acceptance Criteria
 
-1. WHEN Home renders THEN it SHALL show the bands Needs you, Running and Next, in that order, each always open with no collapse control.
+1. WHEN Home renders THEN it SHALL show the bands Needs you, Running and Next, in that order, each always open, no collapse.
 2. WHEN a band has no tile THEN it SHALL show one quiet line.
 3. WHEN the viewport is 1024 px wide or more THEN each band SHALL lay its tiles in two columns; below that, in one.
 4. WHEN Home renders THEN it SHALL have no filter, search, pagination or grouping; the project SHALL be a neutral tag on each tile.
@@ -60,10 +60,10 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 #### Acceptance Criteria
 
-1. WHEN a wait tile renders THEN it SHALL show the kind label, project tag, spec, the first line of `questions[0].text`, the age in the display type size, and one action, "Answer". IF the wait has no questions THEN it SHALL show the kind's fallback line (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78`).
+1. WHEN a wait tile renders THEN it SHALL show the kind label, project tag, spec, the wait's summary line, the age in the display type size, and one action, "Answer". The summary line SHALL be `ctrlSummary` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78`): the decision, item or proposal count for `gate-a`, `gate-b` and `retro-plan`, else the first line of `questions[0].text`, else the kind's fixed line.
 2. WHEN the age is under 15 minutes THEN the tile SHALL be neutral; from 15 minutes to under 1 hour, amber; at 1 hour and after, red. The colour SHALL change with no reload.
 3. WHEN a `merge` wait tile renders THEN it SHALL show the PR number, the CI state and the rule verdict from the `prReads` (`src/controller/state.ts:112`) of the run named by `wait.run`. The read SHALL match the wait's question id: `merge` takes the `kind: 'run'` read (`src/controller/merge.ts:28`); `merge:` plus repo and number takes the read with that repo and number (`src/controller/merge.ts:556`). IF no read matches THEN the tile SHALL say "PR not read yet".
-4. WHEN "Answer" is pressed THEN the existing answer sheet (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:500-701`) SHALL replace the board at full width, with a "Back to board" link. No panel SHALL sit beside it.
+4. WHEN "Answer" is pressed THEN the existing answer sheet (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:500-701`) SHALL replace the board at full width, with a "Back to board" link and no panel beside it.
 5. WHEN the sheet's wait is answered, here or elsewhere, THEN the board SHALL return.
 
 ### Requirement 5 — The staged action tile
@@ -73,7 +73,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 #### Acceptance Criteria
 
 1. WHEN an action has state `staged` or `running` THEN Needs you SHALL show a tile with its kind, target, reason, age and, while `staged`, Confirm and Dismiss. The age SHALL colour the tile by the R4 AC 2 rule.
-2. WHEN an action has any other state THEN it SHALL show no tile, except that a tile pressed in this page view SHALL stay until R9 has shown the outcome.
+2. WHEN an action has any other state THEN it SHALL show no tile, except a tile pressed in this view stays until R9 has shown the outcome.
 3. WHEN an action's target names no project THEN the tile SHALL show with no project tag and SHALL ignore the project filter.
 4. WHEN a staged launch is confirmed THEN its run tile SHALL appear in Running; the launch itself is an invariant (verified, not red-first: `src/dashboard/multi-server.ts:796-801`).
 
@@ -88,7 +88,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 3. WHEN no step is in flight THEN the dot SHALL be grey and no heartbeat line SHALL show.
 4. WHEN a run has status `running` and `driven: false`, or status `waiting` with an open wait whose question id is `drive-crash` (`src/controller/waits.ts:193`), THEN the tile SHALL show red "Stalled" and Re-drive in place of the dot. `src/controller/controller.ts:205-222` accepts exactly these. No other run with `driven: false` SHALL read as stalled.
 5. WHEN Re-drive is accepted THEN the tile SHALL show a green dot within 15 s of the step's spawn.
-6. WHEN a pause is pending (`pauseRequested` set, status not `paused`) THEN the note SHALL read "pausing after this step", replacing "pause requested" at `src/dashboard_frontend/src/modules/shell/pause.ts:42-43`; applied, it SHALL start with "paused".
+6. WHEN a pause is pending (`pauseRequested` set, status not `paused`) THEN "pause requested" SHALL become "pausing after this step" (`src/dashboard_frontend/src/modules/shell/pause.ts:42-45`): a running run's note reads just that; a waiting run keeps its waiting text with a "· pausing after this step" suffix. Once applied, the note SHALL start with "paused".
 7. WHEN a run has `holdBy: 'deploy'` THEN the note SHALL read "held for deploy" and the tile SHALL offer no Resume (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/pause.ts:34-36`, `e2e/worktree-deploy.spec.ts:271`).
 
 ### Requirement 7 — Run tile actions
@@ -114,7 +114,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 1. WHEN an enabled project's setup view (`GET /api/projects/:projectId/harness/setup`, `src/dashboard/multi-server.ts:662-674`) has a non-null `launchable` THEN Next SHALL show a tile with the spec, the project tag, the setup in one line, and Launch. `NowModel.idle` SHALL NOT be the source: it omits the decomposition fallback (`src/dashboard/shell/now-model.ts:127-133`, `src/dashboard/harness/run-setup.ts:198-202`).
 2. WHEN two listed projects share a store THEN Next SHALL show at most one tile for that store, using the group's representative (`src/dashboard_frontend/src/modules/projects/stores.ts:25-43`) when it is on, else the enabled member.
-3. WHEN the setup line renders THEN it SHALL state the supervisor model, the role count, the worktree value, and gates as `record`, because the launch route forces that value (`src/dashboard/multi-server.ts:687`); `view.gates` SHALL NOT show.
+3. WHEN the setup line renders THEN it SHALL state the supervisor model, the role count, the worktree value, and gates as `record` (the launch route forces it, `src/dashboard/multi-server.ts:687`); `view.gates` SHALL NOT show.
 4. WHEN `launchBlock` (`src/controller/controller.ts:386-399`) nulls `launchable` (`src/dashboard/multi-server.ts:671`) THEN the project SHALL show no Next tile.
 5. WHEN a run ends or starts THEN Next SHALL reflect it within 5 s with no reload; the fetch on mount of `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:404` is not enough.
 6. WHEN Launch is pressed THEN it SHALL post `buildLaunchInput` as at base (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/harness.tsx:40-52`). The tile SHALL have no edit control.
@@ -136,7 +136,7 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 #### Acceptance Criteria
 
-1. WHEN any page is open and open controller waits exist on enabled projects THEN `document.title` SHALL read the count, " · " and the oldest age, for example "2 · 4h20m". Staged actions SHALL NOT count.
+1. WHEN any page is open and open controller waits exist on enabled projects THEN `document.title` SHALL read the count, " · " and the oldest age, such as "2 · 4h20m". Staged actions SHALL NOT count.
 2. WHEN the age renders in the title THEN it SHALL be `<h>h<m>m` from one hour, `<m>m` under one hour, `<d>d<h>h` from one day, and SHALL carry no spaces or seconds.
 3. WHEN no such wait is open THEN the title SHALL be the base title of `src/dashboard_frontend/index.html:6`.
 
@@ -158,8 +158,8 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 #### Acceptance Criteria
 
-1. WHEN `toRow` builds a row (`src/controller/runs.ts:1453-1465`) THEN the row SHALL also carry, with no path: whether a step is in flight, the step's ISO start time, the task id when the step works one, and whether Discard is allowed under R7 AC 6 and AC 7. At base the row has none: `inFlight.startTime` is a `/proc` value (`src/controller/state.ts:39-46`) and nothing writes `cursor.task` (`src/controller/state.ts:26-36`).
-2. WHEN a step spawns THEN the run record SHALL hold its ISO start time and task id (`src/controller/runs.ts:455-458`), and both SHALL clear when the step ends.
+1. WHEN `toRow` builds a row (`src/controller/runs.ts:1453-1465`) THEN the row SHALL also carry, with no path: whether a step is in flight, the step's ISO start time, the task id when the step works one, whether the run's branch is present (for R7 AC 6), and whether Discard is allowed (R7 AC 7). The two differ: a branchless run is absent, a branch-in-use one shows without Discard. At base the row has none: `inFlight.startTime` is a `/proc` value (`src/controller/state.ts:39-46`) and nothing writes `cursor.task` (`src/controller/state.ts:26-36`).
+2. WHEN a step spawns THEN the run record SHALL hold the step's ISO start time (converted from the numeric spawn value) and, when the step works a task, its task id; both SHALL clear when the step ends. The task id is not on the spawn callback (`src/controller/runs.ts:455-458`); design SHALL route it from the implementation phase where the task is known (`src/controller/phases/implementation.ts:469`, `:616-617`).
 3. IF an in-flight record predates these fields THEN the row SHALL report no start time and the tile SHALL omit the step age.
 4. WHEN the row is sent THEN `driven`, `lastActivity`, `prReads`, `holdBy` and `stepKind` SHALL hold as at base (invariant, verified, not red-first), and no model SHALL write any tile field.
 
@@ -172,34 +172,34 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 - The run row SHALL carry no filesystem path (`src/controller/runs.ts:1425`).
 
 ### Reliability
-- A failed branch read SHALL report Discard as not allowed. A failed setup fetch SHALL show no Next tile for that project only.
+- A failed branch read SHALL report the branch as not present, so the run shows no tile. A failed setup fetch SHALL show no Next tile for that project only.
 
 ## Decisions taken in this document
 
-- D1 — Posture on money, personal data, deletion and legal: no money, billing, personal data or legal surface, so no refunds, forfeiture or credits apply; the one deletion is Discard of the operator's own worktree, local branch and PR, irreversible, behind a second press that names what goes; options were that stance, one press with no confirm, a soft delete that keeps the branch for a period; chosen because the operator owns the data and the existing confirm wording covers it.
-- D2 — A done run with its branch present keeps a tile for 24 hours; options were 24 hours then no tile, every done run with a branch as the entry says, no tile for done runs at all, a 7-day window; chosen because 21 of the 28 done runs still have their branch, so the literal rule fills Running with finished work.
-- D3 — Home shows controller waits only; options were controller waits only, both kinds as today; chosen because the entry derives tiles from records, and a stale draft plan would hold a derived retro tile forever.
-- D4 — Server feeds only the removed pages read are deleted here; options were delete them in this spec, leave them for spec 34; chosen because the entry says removed with their components and tests, and lists the hub.
-- D5 — Discard refuses when a moving run shares the branch; options were tile and route, tile only, no guard; chosen because a relaunched spec reuses its branch and worktree, so a Discard could delete a live run's work.
-- D6 — The controller records step start and task at spawn and the row carries them; options were new row fields, parsing the step id in the browser, reading the ledger; chosen because the entry's fields do not reach the wire today. This adds controller files to the entry's list.
-- D7 — Stalled means running and not driven, or waiting on a drive-crash wait; options were those two states, any run with driven false; chosen because every waiting or paused run has driven false.
-- D8 — A discarded done run stays done; options were keep done, become abandoned as the code does; chosen because the run did finish.
-- D9 — Specs and Deferrals keep their panels until spec 34; options were keep, strip now; chosen because spec 34 rewrites those pages.
-- D10 — Next orders by heading position, then project name; options were that, project name only; chosen because decompositions are per project.
-- D11 — One Next tile per store; options were per store, per listed project; chosen because the second launch would be refused.
-- D12 — Staged actions take the wait age colours and order; options were the same rules, a separate group; chosen because the entry makes them Needs-you tiles.
-- D13 — The gear keeps notifications and version and drops the project dots; options were drop, move the dots; chosen because Home shows project state.
-- D14 — Tile buttons are neutral; options were neutral, accent for the main action; chosen because colour means state.
-- D15 — The fixture default keys on the project name; options were the name, a registry flag; chosen because a flag adds a server field for one project.
-- D16 — Two columns from 1024 px, display type at least 32 px, tile text at least 14 px, old steps kept; options were these, replacing the whole scale now; chosen because spec 34 has not rebuilt the other pages.
-- D17 — Stopped runs sort after moving runs; options were after, one order for all; chosen because a stopped run would always lead.
-- D18 — The tab title counts enabled waits only; options were enabled waits, all waits, waits and actions; chosen because it should match the board.
+- D1 — No money, billing, personal-data or legal surface, so no refunds or credits; the one deletion is Discard of the operator's own worktree, branch and PR, irreversible, behind a second press, because the operator owns it and the confirm covers it.
+- D2 — A done run with its branch present keeps a tile for 24 hours, because 21 of 28 done runs still have their branch, which would otherwise fill Running with finished work.
+- D3 — Home shows controller waits only, because tiles derive from records and a stale draft plan would hold a retro tile forever.
+- D4 — Only the feeds the removed pages read are deleted here, not for spec 34, because the entry says removed with their components and tests, and lists the hub.
+- D5 — Discard refuses when a moving run shares the branch, because a relaunch reuses it, so Discard could delete a live run's work.
+- D6 — The controller records step start and task at spawn and the row carries them, because the fields do not reach the wire today. This adds controller files to the entry's list.
+- D7 — Stalled means running and not driven, or waiting on a drive-crash wait, because every other driven-false run is a normal wait or pause.
+- D8 — A discarded done run stays done, because it did finish.
+- D9 — Specs and Deferrals keep their panels until spec 34, because spec 34 rewrites those pages.
+- D10 — Next orders by heading position, then project name, because decompositions are per project.
+- D11 — One Next tile per store, because the second launch would be refused.
+- D12 — Staged actions take the wait age colours and order, because they are Needs-you tiles.
+- D13 — The gear keeps notifications and version, dropping the project dots, because Home shows project state.
+- D14 — Tile buttons are neutral, because colour means state.
+- D15 — The fixture default keys on the project name, because a registry flag adds a server field for one project.
+- D16 — Two columns from 1024 px, display type at least 32 px, tile text at least 14 px, old steps kept, because spec 34 has not rebuilt the others.
+- D17 — Stopped runs sort after moving runs, because a stopped run would always lead.
+- D18 — The tab title counts enabled waits only, because it should match the board.
 
 ## Scope notes
 
 - Carried items: none.
 - Cut: the right panel stays on Specs and Deferrals until spec 34 (D9); `done` runs keep a tile for 24 hours only (D2).
-- Added: the `discard` guard (R7 AC 7), the `done` status fix (R7 AC 8) and the controller writes of R12. The entry's "Design MUST enumerate" list omits `src/controller/runs.ts` and `src/controller/state.ts`; design adds them.
+- Added: the `discard` guard (R7 AC 7), the `done` status fix (R7 AC 8) and the controller writes of R12. The entry's "Design MUST enumerate" list omits `src/controller/runs.ts`, `src/controller/state.ts` and the step-spawn path in `src/controller/phases/implementation.ts`; design adds them.
 - Narrowed: "A run with `driven: false`" reads as R6 AC 4 (D7).
 - Left to design: a confirm on Stop for a stalled run; the `merging` and `queued` tiles beyond R6 and R7; the enable default for the two tradr entries.
 
@@ -207,3 +207,9 @@ This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and
 
 - **v1** (2026-11-06) — Initial draft.
   - **Lint pass.** 8 fixed; rejected: none.
+- **v2** (2026-11-06) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/3/1).
+  - **R1-1 — Accepted (MUST_FIX).** R12 AC 1 now carries two path-free signals, branch-present and Discard-allowed, read by R7 AC 6 and AC 7, so the three stopped-run outcomes separate.
+  - **R1-2 — Accepted (SHOULD_FIX).** R12 AC 2 now converts the start time from the numeric spawn value and routes the task id from the implementation phase; the scope note adds that file.
+  - **R1-3 — Accepted (SHOULD_FIX).** R4 AC 1 now reads the per-kind summary: a count for gate and retro-plan, else the first question line, else the fixed line.
+  - **R1-4 — Accepted (SHOULD_FIX).** R6 AC 6 now fixes the waiting case: the suffix becomes "pausing after this step", the waiting text stays; both branches cited.
+  - **R1-5 — Accepted (MINOR).** The intro now names the R7 and R12 controller changes.

````
