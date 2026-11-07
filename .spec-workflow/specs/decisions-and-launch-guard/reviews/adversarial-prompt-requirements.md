# Adversarial Review — decisions-and-launch-guard/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): decisions-and-launch-guard requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `decisions-and-launch-guard` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since c988b71b

````diff
diff --git a/.spec-workflow/specs/decisions-and-launch-guard/requirements.md b/.spec-workflow/specs/decisions-and-launch-guard/requirements.md
index de73b592..a5dc304b 100644
--- a/.spec-workflow/specs/decisions-and-launch-guard/requirements.md
+++ b/.spec-workflow/specs/decisions-and-launch-guard/requirements.md
@@ -17,7 +17,7 @@ This spec fixes eleven operator-reported defects in launch, close-out, cancel an
 #### Acceptance Criteria
 
 1. WHEN a project has a stored display name THEN Home, Specs, Usage, Deferrals, the gear and the advisor push text SHALL show it in place of the generated name (`src/core/project-registry.ts:130-139`, `src/advisor/push.ts:88-96`).
-2. WHEN a server re-registers a project THEN the stored display name SHALL stay. `registerProjectLocked` overwrites `projectName` at base (`src/core/project-registry.ts:360`, `:376`).
+2. WHEN a server re-registers a project THEN the stored display name SHALL stay. `registerProjectLocked` overwrites `projectName` at base (`src/core/project-registry.ts:354-360`, `:376`).
 3. WHEN the controller restarts, or the project has no live registry entry THEN the display name SHALL stay. The durable row is in `projects.json` (`src/controller/state.ts:619-628`, `src/dashboard/project-manager.ts:127`).
 4. IF a project has no display name THEN it SHALL show the generated name (invariant, verified, not red-first: `src/core/project-registry.ts:234`).
 5. WHEN a display name changes THEN the project id, runs and waits SHALL not change (invariant, verified, not red-first: the id hashes the path, `src/core/project-registry.ts:118-123`).
@@ -56,7 +56,7 @@ Verification: with task files only in the app repository, the `tradr infra` tile
 4. IF an item has a recorded answer and its target gives no landing class THEN its line SHALL be `to-do (human) — ` and a reason that states the answer and why no batch can build it.
 5. IF the recorded answer itself chooses no change THEN the line SHALL be `skipped — ` and the answer text. The design states the test for this case.
 6. WHEN an item with a recorded answer does not land THEN its line SHALL be `to-do (human) — ` and the reason. `src/controller/phases/closeout.ts:633` writes `skipped` at base. The commit revert for an item that did not land SHALL not change.
-7. WHEN an approved item carries a `Target document:` line THEN the close-out SHALL read it as the item's target. `classifyTarget` and Step 1 match only `Target:` (`src/tools/harness.ts:542`, `src/controller/phases/closeout.ts:368`), so G1 and G2 read as class `none`.
+7. WHEN an approved item carries a `Target document:` line THEN the close-out SHALL read it as the item's target. `classifyTarget` and Step 1 match only `Target:` (`src/tools/harness.ts:541-546`, `src/controller/phases/closeout.ts:368`), so G1 and G2 read as class `none`.
 8. WHEN an approved item has no recorded answer and its target says no change THEN its line SHALL stay `skipped — no change chosen` (invariant, verified, not red-first).
 
 Verification: a plan shaped like the option-lifecycle-events plan never writes `skipped — no change chosen` for P6, P11, G1 or G2.
@@ -98,7 +98,7 @@ Verification: a plan shaped like the option-lifecycle-events plan never writes `
 
 #### Acceptance Criteria
 
-1. The G1 and G2 text (`/home/mcf/repo/tradr-hosted/.spec-workflow/specs/option-lifecycle-events/retrospective-plan.md:143-148`, `:155-159`) SHALL go verbatim into `## Checks` of `.spec-workflow/agent-rules.md`.
+1. The G1 and G2 text (lines 143-148 and 155-159 of the `option-lifecycle-events` retrospective-plan.md in the tradr-hosted spec store, outside this code root) SHALL go verbatim into `## Checks` of `.spec-workflow/agent-rules.md`.
 2. `readAgentRules` SHALL read the same keys after the edit (invariant, verified, not red-first: `src/dashboard/harness/run-setup.ts:72-141`).
 3. WHEN this spec closes THEN `d-83cc3ac1`, `d-37e510db`, `d-4f6a6271` and, for its launch half, `d-aaf54e29` SHALL be resolved.
 
@@ -109,8 +109,8 @@ Verification: a plan shaped like the option-lifecycle-events plan never writes `
 #### Acceptance Criteria
 
 1. WHEN a run is cancelled THEN no new step SHALL start for it in any phase, at any of the five `runStep` call sites (`src/controller/phases/document.ts:401`, `src/controller/phases/implementation.ts:472`, `src/controller/phases/retrospective.ts:169`, `src/controller/phases/closeout.ts:319`, `src/controller/merge-fix.ts:229`). At base the document phase reads only the pause hold (`src/controller/runs.ts:989`, `src/controller/phases/document.ts:201-206`), and the retry at `src/controller/runs.ts:1331-1354` starts a second drafter.
-2. WHEN a step ends because of a cancel THEN the driver SHALL open no `error` or `escalation` wait and start no retry. Each handler opens a wait at base (`src/controller/runs.ts:1136-1139`, `:1261-1265`, `:1288-1291`, `:1355-1358`).
-3. WHEN a run is `abandoned` on disk THEN no later write SHALL change that status. At base `save` spreads the caller's record (`src/controller/runs.ts:566-571`), `runOnce` sets `running` on entry (`:849-851`) and `writeRunLocked` has no guard (`src/controller/state.ts:431-435`).
+2. WHEN a step ends because of a cancel THEN the driver SHALL open no `error` or `escalation` wait and start no retry. Each handler opens a wait at base (`src/controller/runs.ts:1136-1139`, `:1261-1265`, `:1288-1291`, `:1314-1315`, `:1355-1358`).
+3. WHEN a run is `abandoned` on disk THEN no later write SHALL change that status. At base `save` spreads the caller's record (`src/controller/runs.ts:566-571`), `runOnce` (`:832`) sets `running` on entry (`:849-851`) and `writeRunLocked` has no guard (`src/controller/state.ts:431-435`).
 4. AC 1 to AC 3 SHALL hold after a controller restart, when the in-memory set is empty (`src/controller/controller.ts:90`).
 5. WHEN a merge stage is in progress at the cancel THEN it SHALL open no wait and write no status.
 6. A cancel SHALL keep the worktree, branch and PR (invariant, verified, not red-first: `src/controller/runs.ts:1380-1400`).
@@ -124,7 +124,7 @@ Verification: a cancel during a live step leaves the run `abandoned`, with no se
 
 #### Acceptance Criteria
 
-1. WHEN a moving run has a `phase` THEN its tile SHALL show it. `RunTile` shows `stepKind` and `task` only at base (`src/dashboard_frontend/src/modules/shell/tiles.tsx:165-169`).
+1. WHEN a moving run has a `phase` THEN its tile SHALL show it. `RunTile` shows `stepKind` and `task` only at base (`src/dashboard_frontend/src/modules/shell/tiles.tsx:126`, `:165-169`).
 2. WHEN a run tile renders THEN it SHALL show the age since `created`. At base `created` sets only the tone, and the visible age is the step's (`src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150`, `:170-174`). The step age SHALL stay.
 3. The tile SHALL read phase and age from the run's own `controller-runs` row, never from a ledger (invariant, verified, not red-first: `src/controller/runs.ts:1490-1511`).
 4. IF a run has no `phase` THEN the tile SHALL show no phase text.
@@ -137,12 +137,12 @@ Verification: a run 2 minutes into requirements, on a project with an older run
 
 #### Acceptance Criteria
 
-1. WHEN Running renders THEN it SHALL hold only runs in `queued`, `running`, `merging`, `paused` or `waiting`, in the base order. This replaces dashboard-board Requirement 3 AC 7 (`src/dashboard_frontend/src/modules/shell/board.ts:46-59`).
+1. WHEN Running renders THEN it SHALL hold only runs in `queued`, `running`, `merging`, `paused` or `waiting`, in the base order. This replaces dashboard-board Requirement 3 AC 7 (`src/dashboard_frontend/src/modules/shell/board.ts:35`, `:46-59`).
 2. WHEN `stoppedAdmitted` admits a run THEN it SHALL appear in a separate stopped band, newest `updated` first, with a plain status word: `done`, `abandoned` or `error`.
 3. The stopped band SHALL sit below Next, SHALL have less visual weight than Running, and SHALL not render when it is empty.
 4. `runControls` SHALL not change for a stopped run (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/board.ts:119-132`).
 5. The design SHALL state how long an abandoned run stays in the band. At base an abandoned run stays while a branch of its name exists (`src/dashboard_frontend/src/modules/shell/board.ts:38-44`).
-6. IF a later run reused an older run's branch name THEN Discard of the older run SHALL NOT delete that branch or close that PR. `discardRun` acts by name and `branchHeld` sees moving runs only (`src/controller/runs.ts:1423-1431`, `:1482-1488`). The design states the rule, using `dashboard-deploy` run-20261104-205502 as the case.
+6. IF a later run reused an older run's branch name THEN Discard of the older run SHALL NOT delete that branch or close that PR. `discardRun` acts by name and `branchHeld` sees moving runs only (`src/controller/runs.ts:1410-1431`, `:1482-1488`). The design states the rule, using `dashboard-deploy` run-20261104-205502 as the case.
 
 Verification: with one running run, one done run and one abandoned run, each stopped run with its branch present, Running holds only the running run and the stopped band holds the other two.
 
@@ -152,7 +152,7 @@ Verification: with one running run, one done run and one abandoned run, each sto
 
 #### Acceptance Criteria
 
-1. WHEN a run tile renders THEN its tone SHALL come from `isStalled` and `runDot`, not `ageTone` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150`): stalled or red is `danger`, amber is `warning`, green or grey is `neutral`.
+1. WHEN a run tile renders THEN its tone SHALL come from `isStalled` and `runDot`, not `ageTone` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150`, `src/dashboard_frontend/src/modules/shell/board.ts:90-117`): stalled or red is `danger`, amber is `warning`, green or grey is `neutral`.
 2. WHEN a healthy run is older than 1 hour THEN its tone SHALL be `neutral`.
 3. WHEN a run is stalled THEN its tone SHALL NOT be `neutral`.
 4. Wait tiles and action tiles SHALL keep `ageTone` (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79`, `:308-309`).
@@ -211,3 +211,4 @@ Carried items: none.
 ## Revision History
 
 - **v1** (2026-11-07) — Initial draft.
+  - **Lint pass.** 18 fixed; rejected: L-4, L-5, L-6, L-7 (`drafting`/`design` are the labels Requirement 5 introduces, absent from base code by design), L-12 (`phase` is the field this AC adds to the tile, absent from the base render by design).

````
