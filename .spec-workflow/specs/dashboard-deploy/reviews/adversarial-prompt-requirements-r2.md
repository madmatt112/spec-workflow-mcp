# Adversarial Review — dashboard-deploy/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-deploy requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 913e1571

````diff
diff --git a/.spec-workflow/specs/dashboard-deploy/requirements.md b/.spec-workflow/specs/dashboard-deploy/requirements.md
index 0e6d6b2e..1a3c52e2 100644
--- a/.spec-workflow/specs/dashboard-deploy/requirements.md
+++ b/.spec-workflow/specs/dashboard-deploy/requirements.md
@@ -18,10 +18,10 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 
 #### Acceptance Criteria
 
-1. WHEN the operator POSTs `/api/controller/deploy` AND no record is open THEN the controller SHALL write `deploy.json` in the controller home (`src/controller/state.ts:275-279`; `~/.local/state/sdd/deploy.json` by default) with `v: 1`, `stage: 'wait'`, `runs`, `started` and no `error`, hold the runs, and answer 202.
-2. WHEN a press holds runs THEN the controller SHALL hold every run with status `running`, `queued`, `waiting`, `merging` or `paused` that has no operator hold, set `holdBy: 'deploy'` on each, and list exactly those ids in `runs` (D1).
+1. WHEN the operator POSTs `/api/controller/deploy` AND no record is open THEN the controller SHALL write `deploy.json` in the controller home (`src/controller/state.ts:275-279`; `~/.local/state/sdd/deploy.json` by default) with `v: 1`, `stage: 'wait'`, `runs`, `started` (the press time) and no `error`, hold the runs, and answer 202.
+2. WHEN a press holds runs THEN the controller SHALL hold every run with status `running`, `queued`, `waiting`, `merging` or `paused` that has no operator hold, set `pauseRequested` and `holdBy: 'deploy'` on each, and list exactly those ids in `runs` (D1).
 3. IF a run already has an operator hold (`pauseRequested` set, `holdBy` `operator` or absent) THEN the press SHALL leave the run unchanged and SHALL NOT list it in `runs`.
-4. WHEN no live step remains THEN the controller SHALL start `scripts/sdd-self-update.sh --deploy-record <path>` as a transient user unit with `systemd-run --user`, and SHALL record in `deploy.json` that the unit was started. The unit is required because the service's `KillMode` is `control-group` (probe 2026-11-05: `systemctl --user show sdd-controller.service -p KillMode`), and the script resolves from the same checkout root as `src/advisor/actions.ts:363-364`.
+4. WHEN no live step remains THEN the controller SHALL start `scripts/sdd-self-update.sh --deploy-record <path>` as a transient user unit with `systemd-run --user`, and SHALL set `unitStarted: true` in `deploy.json`. The unit is required because the service's `KillMode` is `control-group` (probe 2026-11-05: `systemctl --user show sdd-controller.service -p KillMode`), and the script resolves from the same checkout root as `src/advisor/actions.ts:363-364`.
 5. WHEN the unit starts THEN it SHALL have the controller's `PATH`, `HOME` and `SDD_HOME` and the contents of `service.env` (`scripts/sdd-service.sh:82`), and SHALL NOT carry `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` (`scripts/sdd-service.sh:84`). A bare transient unit inherits none of these (probe 2026-11-05: `systemd-run --user --wait --pipe` printed a `PATH` with no node, no npm, and a caller variable unset, in a cgroup outside `sdd-controller.service`).
 6. IF the unit cannot be started THEN the controller SHALL write `failed` with the reason in `error` and release the holds.
 7. IF a live step outlasts the time limit the design pins THEN the controller SHALL write `failed` with `error` naming `wait`, and release the holds.
@@ -53,10 +53,10 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 
 1. WHEN the controller starts AND the record is at `restart` or `done` THEN it SHALL release the holds and write `done`.
 2. WHEN the controller finds the record at `failed`, on start or on its tick, AND runs still have `holdBy: 'deploy'` THEN it SHALL release the holds and leave the record at `failed`.
-3. WHEN the controller finds an open record, on start or on its tick, AND the record says the unit was started AND the unit is not live THEN it SHALL write `failed`, with `error` naming the stage and the lost unit, and release the holds. AC 1 takes precedence at `restart` on start.
-4. IF the controller starts AND the record is at `wait` AND the unit was not started THEN it SHALL re-apply the holds and continue from Requirement 1 AC 4 (D3).
+3. WHEN the controller finds an open record, on start or on its tick, AND `unitStarted` is true AND the unit is not live THEN it SHALL write `failed`, with `error` naming the stage and the lost unit, and release the holds. AC 1 takes precedence at `restart` on start.
+4. IF the controller starts AND the record is at `wait` AND `unitStarted` is false or absent THEN it SHALL re-apply the holds and continue from Requirement 1 AC 4 (D3).
 5. WHEN the controller starts AND the record is open AND the unit is live THEN it SHALL leave the record and the unit alone, keep the holds, and read the record on its tick until the deploy ends.
-6. WHEN the controller releases THEN, for each run with `holdBy: 'deploy'` and only those, it SHALL clear the hold; a run `paused` with `pauseReason: 'operator'` SHALL go to `queued` as in `src/controller/controller.ts:278-281`; a `waiting` run whose latest wait is answered SHALL resume through the path in `src/controller/controller.ts:387-390`; every other run SHALL keep its status. Release SHALL be safe to repeat.
+6. WHEN the controller releases THEN, for each run with `holdBy: 'deploy'` and only those, it SHALL clear `holdBy` and `pauseRequested`; a run `paused` with `pauseReason: 'operator'` SHALL go to `queued` as in `src/controller/controller.ts:278-281`; a `waiting` run whose latest wait is answered SHALL resume through the path in `src/controller/controller.ts:387-390`; every other run SHALL keep its status. Release SHALL be safe to repeat.
 7. WHEN a deploy ends in `done` THEN a run that was `running` at the press SHALL run again from its cursor, and a run `waiting` on an unanswered wait SHALL still be `waiting`.
 8. IF the process was started with `--smoke` THEN it SHALL NOT act on any deploy record. The smoke boot works on a copy of the home (`scripts/sdd-self-update.sh:213-214`).
 
@@ -69,7 +69,7 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 1. WHEN `RunRecord` is written THEN it SHALL accept `holdBy?: 'operator' | 'deploy'` beside `pauseRequested` (`src/controller/state.ts:91`). An operator pause SHALL write `operator`. A `pauseRequested` with no `holdBy` SHALL read as `operator`.
 2. WHEN any writer saves a run without owning the hold THEN `holdBy` SHALL carry over from disk, by the rule `pauseRequested` follows in `src/controller/state.ts:429-433`, and a terminal status SHALL clear it (`:434-437`).
 3. WHEN `settlePass` meets a run with `holdBy: 'deploy'` THEN it SHALL skip the run and write nothing (`src/controller/controller.ts:434-449`, D4).
-4. IF a run has `holdBy: 'deploy'` THEN `isStartable` SHALL return false (`src/controller/controller.ts:456`) (invariant, verified, not red-first).
+4. IF a run has `holdBy: 'deploy'` THEN `isStartable` SHALL return false (`src/controller/controller.ts:456`), because the hold set `pauseRequested` (R1 AC2) (invariant, verified, not red-first).
 5. WHEN a deploy-held run has a live drive THEN the drive SHALL stop at its next stop point and park `paused` (`src/controller/runs.ts:417-422`, `:573-581`), and `holdBy` SHALL stay `deploy`.
 6. WHEN a wait is answered on a run with `holdBy: 'deploy'` THEN the run SHALL stay `waiting`, no step SHALL start, and the answer SHALL stay on disk (`src/controller/controller.ts:557-560`). This SHALL also hold on the recovery path (`:352-353`).
 7. WHEN the operator pauses a run with `holdBy: 'deploy'` THEN `holdBy` SHALL become `operator` and release SHALL leave the run held. Today the call returns early (`src/controller/controller.ts:242`).
@@ -85,7 +85,7 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 
 #### Acceptance Criteria
 
-1. WHEN the operator POSTs `/api/controller/deploy/cancel` AND the record is at `wait`, `build`, `smoke` or `gate` THEN the controller SHALL stop the unit if it was started, wait until the unit is gone, release the holds and remove the record.
+1. WHEN the operator POSTs `/api/controller/deploy/cancel` AND the record is at `wait`, `build`, `smoke` or `gate` THEN the controller SHALL stop the unit if `unitStarted`, wait until the unit is gone, release the holds, remove the record and answer 200.
 2. WHEN the controller removes the record THEN no later script write SHALL recreate it, so removal SHALL come after the unit is gone, and a cancelled script SHALL leave no `failed` record.
 3. IF the record is at `swap`, `restart`, `done` or `failed` THEN the route SHALL answer 409 `deploy-past-swap` and change nothing. IF no record exists THEN the route SHALL answer 404.
 4. WHEN a cancel completes THEN the live checkout and `dist/` SHALL be unchanged. The staging worktree may stay; the next run resets it (`scripts/sdd-self-update.sh:191-194`).
@@ -97,7 +97,7 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 #### Acceptance Criteria
 
 1. WHEN the operator presses Deploy on the Now page THEN a confirm SHALL state how many runs will be held and that the restart ends the advisor opened from the dashboard, and the POST SHALL be sent only after the confirm.
-2. WHEN a record exists THEN a stage strip SHALL show `wait`, `build`, `smoke`, `gate`, `swap`, `restart` and `done` with the current stage marked, read only from the record through a new shell-feed message (`src/dashboard/shell/shell-feed.ts:146-153`, `src/dashboard/shell/types.ts:230-236`). The page SHALL derive nothing from the script's log.
+2. WHEN a record exists THEN a stage strip SHALL show `wait`, `build`, `smoke`, `gate`, `swap`, `restart` and `done` with the current stage marked, read only from the record through a new shell-feed message (`src/dashboard/shell/shell-feed.ts:146-153`, `src/dashboard/shell/types.ts:230-236`). The client SHALL subscribe to it with a handler and state slot (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:76-121`) and hand-copy its payload type beside `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:215-237`), mirroring R4 AC12. The page SHALL derive nothing from the script's log.
 3. WHILE a record is open THEN Deploy SHALL be disabled and SHALL show the reason with the stage.
 4. WHEN a run has `holdBy: 'deploy'` THEN its rows on the Now and Runs pages SHALL read "held for deploy" (`src/dashboard_frontend/src/modules/shell/pause.ts:32-44`), `isOperatorHeld` SHALL be false (`:27-29`), and the panel SHALL show neither Resume nor Resume now (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:332-351`). Pause SHALL stay available.
 5. WHILE the record is at `wait`, `build`, `smoke` or `gate` THEN the strip SHALL offer "Cancel and resume now", and from `swap` on it SHALL not.
@@ -127,7 +127,7 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 - D1 — Which runs a deploy holds: options were every live run with no operator hold, the three statuses the decomposition names, or those three plus a scheduler-wide stop; chosen every live run because a merging run or a usage-paused run can otherwise start a step during the build, and the restart would kill it.
 - D2 — What a press does when there is nothing new: options were a refusal in the script under the new flag, the full pipeline and a restart, or a check before the press; chosen the script refusal because the decomposition expects the script to refuse a no-op but the code does not, and it rules out a check before the press.
 - D3 — Who waits for a live step: options were the controller waits and then starts the unit, or the unit starts at once and the script waits in place of its refusal; chosen the controller because the decomposition keeps the script's refusal. The cost is one exception to the lost-unit rule: a record at wait whose unit was never started continues after a restart and does not fail.
-- D4 — What a deploy hold does to status: options were leave status alone and skip the settle pass, or park as an operator pause and keep the owner; chosen leave it alone because the decomposition says a run keeps its status underneath, and a usage pause keeps its reason and resume time.
+- D4 — What a deploy hold does to status: options were leave status alone and skip the settle pass, or park as an operator pause and keep the owner; chosen leave it alone because a queued, waiting or merging run keeps its status underneath (a running run with a live drive parks `paused`, R4 AC5), and a usage pause keeps its reason and resume time.
 - D5 — Where the swap stage begins: options were before the live checkout moves, or at the dist copy; chosen before the move because a cancel between the two would leave the checkout ahead of the running build.
 - D6 — How the page sees the restart stage: options were a three-second gap in the script, or the notice only in the confirm; chosen the gap because otherwise the service dies before the feed delivers the stage, and the decomposition wants the strip to say it.
 - D7 — How long a finished strip stays: options were until the next press, an automatic hide, or a dismiss button; chosen until the next press because it adds no control and no timer.
@@ -143,7 +143,7 @@ Added beyond the entry:
 - `merging` runs and non-operator `paused` runs are held (D1).
 - A no-op refusal under the flag (D2). The entry's statement that the divergence check refuses a no-op does not match the code. The entry's "no check before pressing" stands.
 - Launch, Resume and the advisor's staged deploy are refused while a record is open (D9, D10, D11).
-- A field in the record says the unit was started (D3). The entry's list has no such field.
+- A field (`unitStarted`) says the unit was started, distinct from `started` (D3). The entry's list has no such field.
 
 Narrowed from the entry:
 - "At any stage with no live transient unit" excludes a record at `wait` whose unit was never started (D3). End-to-end scenario 5 therefore has two cases: unit started (it continues) and unit not started (the restarted controller starts it). Both end by finishing the record.
@@ -159,5 +159,12 @@ The entry's six end-to-end scenarios carry into the design unchanged, apart from
 
 ## Revision History
 
+- **v2** (2026-11-05) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** R1 AC2 now sets `pauseRequested` with the deploy hold and R3 AC6 clears both fields on release, so a released queued or merging run is startable again; R4 AC4 names `pauseRequested` as the reason `isStartable` stays false.
+  - **R1-2 — Accepted (SHOULD_FIX).** The unit-started signal is a distinct field `unitStarted`, set true at R1 AC4; R1 AC1's `started` is marked the press time; R3 AC3/AC4 and the cancel and scope-note text now read `unitStarted`.
+  - **R1-3 — Accepted (SHOULD_FIX).** R6 AC2 now pins the client half of the deploy message — a subscription and state slot in ShellProvider and a frontend hand-copy of its payload type — mirroring the three-location wire for `holdBy`.
+  - **R1-4 — Accepted (MINOR).** R5 AC1 now answers 200 on a successful cancel.
+  - **R1-5 — Accepted (MINOR).** D4 scopes "keeps its status underneath" to queued, waiting and merging runs and notes a running run with a live drive parks paused.
+  - **Lint pass.** 0 fixed; rejected: L-1–L-45, the citation-identifier false positives v1 rejected, unchanged since and so suppressed per rule 11; cited ranges re-read and still anchoring.
 - **v1** (2026-11-05) — Initial draft.
-  - **Lint pass.** 0 fixed; rejected: L-1–L-44, all citation-identifier false positives. Each flagged backtick token is a spec-introduced deploy-record field or stage value (`stage`, `done`, `failed`, `runs`, `started`, `error`, `commit`, `build`, `smoke`, `gate`, `swap`, `restart`), a hold value or `RunStatus` name (`holdBy`, `deploy`, `operator`, `waiting`), a type or function name declared just outside the cited line (`RunRecord` at `src/controller/state.ts:70`, `isStartable` at `src/controller/controller.ts:454`, `check_move` at `scripts/sdd-self-update.sh:132`), an env var proven by the 2026-11-05 probe (`PATH`, `HOME`, `SDD_HOME`, `KillMode`), or a value resolved from config (`service.env` via `$ENV_FILE` at `scripts/sdd-service.sh:82`). Every cited range was re-read against the tree and correctly anchors the phrase it follows, so no citation is misstated.
+  - **Lint pass.** 0 fixed; rejected: L-1–L-44, all citation-identifier false positives — each backtick token is a spec-introduced deploy-record field/stage/hold value, a `RunStatus` name, a type or function declared just outside the cited line (`RunRecord` at `src/controller/state.ts:70`, `isStartable` at `src/controller/controller.ts:454`, `check_move` at `scripts/sdd-self-update.sh:132`), a probe-proven env var, or `service.env` via `$ENV_FILE`. Every cited range was re-read and anchors its phrase.

````
