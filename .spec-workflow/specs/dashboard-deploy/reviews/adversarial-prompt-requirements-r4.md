# Adversarial Review — dashboard-deploy/requirements (v4)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v4. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-requirements-r3.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v4 review)

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-requirements-r4.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v4.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v4 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v4 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-deploy requirements v3` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v4 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
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

## Changes since be114c35

````diff
diff --git a/.spec-workflow/specs/dashboard-deploy/requirements.md b/.spec-workflow/specs/dashboard-deploy/requirements.md
index 194d674e..9b4c7e9e 100644
--- a/.spec-workflow/specs/dashboard-deploy/requirements.md
+++ b/.spec-workflow/specs/dashboard-deploy/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-This spec adds one Deploy action to the dashboard: it holds the runs, runs the staged self-update outside the service, and brings the runs back after the restart. It is for the single operator, who today deploys by hand from a shell. It changes `scripts/sdd-self-update.sh`, the controller's hold model, one new route pair, and the Now and Runs pages.
+This spec adds one Deploy action to the dashboard: it holds the runs, runs the staged self-update outside the service, and brings the runs back after the restart. It serves the single operator, who today deploys by hand from a shell, and changes `scripts/sdd-self-update.sh`, the controller's hold model, one new route pair, and the Now and Runs pages.
 
 ## Alignment with Product Vision
 
-`.spec-workflow/steering/` holds no `product.md`, so this section aligns to the dashboard board plan in the decomposition instead. That plan puts this spec second so that the three dashboard specs after it ship through the Deploy action. The operator gets a deploy that needs no shell and that loses no run.
+`.spec-workflow/steering/` holds no `product.md`, so this aligns to the decomposition's dashboard board plan, which puts this spec second so the three dashboard specs after it ship through the Deploy action: a deploy that needs no shell and loses no run.
 
 ## Requirements
 
@@ -22,7 +22,7 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 2. WHEN a press holds runs THEN the controller SHALL hold every run with status `running`, `queued`, `waiting`, `merging` or `paused` that has no operator hold, set `pauseRequested` and `holdBy: 'deploy'` on each, and list exactly those ids in `runs` (D1).
 3. IF a run already has an operator hold (`pauseRequested` set, `holdBy` `operator` or absent) THEN the press SHALL leave the run unchanged and SHALL NOT list it in `runs`.
 4. WHEN no live step remains THEN, under its lock, the controller SHALL re-read the record, start nothing unless it is still open at `wait` (so a cancel per R5 AC2 cannot be overtaken by this tick), persist `unitStarted: true` to `deploy.json` (`src/controller/state.ts:338-343`), and only then start `scripts/sdd-self-update.sh --deploy-record <path>` as a transient user unit with `systemd-run --user`, so a crash between the persist and the spawn leaves no live unit with `unitStarted` absent. The unit is required because the service's `KillMode` is `control-group` (probe 2026-11-05: `systemctl --user show sdd-controller.service -p KillMode`), and the script resolves from the same checkout root as `src/advisor/actions.ts:363-364`.
-5. WHEN the unit starts THEN it SHALL have the controller's `PATH`, `HOME` and `SDD_HOME` and the contents of `service.env` (`scripts/sdd-service.sh:82`), and SHALL NOT carry `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` (`scripts/sdd-service.sh:84`). A bare transient unit inherits none of these (probe 2026-11-05: `systemd-run --user --wait --pipe` printed a `PATH` with no node, no npm, and a caller variable unset, in a cgroup outside `sdd-controller.service`).
+5. WHEN the unit starts THEN it SHALL have the controller's `PATH`, `HOME` and `SDD_HOME` and the contents of `service.env` (`scripts/sdd-service.sh:82`), and SHALL NOT carry `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` (`scripts/sdd-service.sh:84`). A bare transient unit inherits none of these (probe 2026-11-05: `systemd-run --user --wait --pipe` printed a `PATH` with no node or npm and a caller variable unset, in a cgroup outside `sdd-controller.service`).
 6. IF the unit cannot be started THEN the controller SHALL write `failed` with the reason in `error` and release the holds.
 7. IF a live step outlasts the time limit the design pins THEN the controller SHALL write `failed` with `error` naming `wait`, and release the holds.
 8. IF a record is open WHEN the operator POSTs `/api/controller/deploy` THEN the route SHALL answer 409 `deploy-open` with the current stage and start nothing.
@@ -37,7 +37,7 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 
 1. WHEN the script runs with `--deploy-record <path>` THEN it SHALL write `stage` at each step: `wait` before the in-flight check (`scripts/sdd-self-update.sh:81`), `build` before the staging build (`:191`), `smoke` before the smoke boot (`:213`), `gate` before the eval gate (`:239`), `swap` before the live checkout moves (`:276`, D5), `restart` after the last `wait_no_step` (`:305`) and before the restart (`:307`), and `done` after the restart.
 2. WHEN the first `check_move` has set `TARGET_COMMIT` (`scripts/sdd-self-update.sh:135`) THEN the script SHALL write it to `commit`.
-3. WHEN the script ends on a refusal, a timeout, a failed command under `set -e`, or SIGTERM from outside a cancel THEN it SHALL write `stage: 'failed'` and an `error` that starts with the stage name it was at. It SHALL use the stage names `smoke` and `gate`, not the wait texts `smoke boot` and `evals` (`scripts/sdd-self-update.sh:219`, `:257`).
+3. WHEN the script ends on a refusal, a timeout, a failed command under `set -e`, or any SIGTERM THEN it SHALL write `stage: 'failed'` and an `error` that starts with the stage name it was at. The script cannot tell a cancel's SIGTERM from any other, so it always writes `failed`; R5 AC1's removal of the record after the unit is gone is what leaves a cancelled deploy no `failed` record. It SHALL use the stage names `smoke` and `gate`, not the wait texts `smoke boot` and `evals` (`scripts/sdd-self-update.sh:219`, `:257`).
 4. IF `--deploy-record` is set AND the fetched checkout is not behind `origin/main` THEN the script SHALL refuse with `failed` and an `error` that says there is nothing to deploy (D2). `check_move` does not refuse this case today (`scripts/sdd-self-update.sh:136-138`).
 5. WHEN the script writes the record THEN the write SHALL be atomic (a temp file in the same directory, then rename), SHALL keep every field it does not set, and SHALL NOT depend on any module under `dist/`, because the swap replaces `dist/`.
 6. WHEN the script writes `restart` THEN it SHALL wait 3 seconds before `systemctl --user restart`, so that the page receives the stage before the socket closes (D6).
@@ -53,10 +53,10 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 
 1. WHEN the controller starts AND the record is at `restart` or `done` THEN it SHALL release the holds and write `done`.
 2. WHEN the controller finds the record at `failed`, on start or on its tick, AND runs still have `holdBy: 'deploy'` THEN it SHALL release the holds and leave the record at `failed`.
-3. WHEN the controller finds an open record, on start or on its tick, AND `unitStarted` is true AND the unit is not live THEN it SHALL write `failed`, with `error` naming the stage and the lost unit, and release the holds. AC 1 takes precedence at `restart` on start.
+3. WHEN the controller finds an open record, on start or on its tick, AND `unitStarted` is true AND the unit is not live THEN it SHALL write `failed`, with `error` naming the stage and the unit the controller committed to starting but that is not live, and release the holds. AC 1 takes precedence at `restart` on start.
 4. IF the controller starts AND the record is at `wait` AND `unitStarted` is false or absent AND no unit is live THEN it SHALL re-apply the holds and continue from Requirement 1 AC 4; AC 5 takes precedence when a unit is live (D3).
 5. WHEN the controller starts AND the record is open AND the unit is live THEN it SHALL leave the record and the unit alone, keep the holds, and read the record on its tick until the deploy ends.
-6. WHEN the controller releases THEN, for each run with `holdBy: 'deploy'` and only those, it SHALL clear `holdBy` and `pauseRequested`; a run `paused` with `pauseReason: 'operator'` SHALL go to `queued` as in `src/controller/controller.ts:278-281`; a `waiting` run whose latest wait is answered SHALL resume through the path in `src/controller/controller.ts:387-390`; every other run SHALL keep its status. Release SHALL be safe to repeat.
+6. WHEN the controller releases THEN, for each run with `holdBy: 'deploy'` and only those, it SHALL clear `holdBy` and `pauseRequested`; a run `paused` with `pauseReason: 'operator'` SHALL go to `queued` as in `src/controller/controller.ts:278-281`; a `waiting` run whose latest wait is answered SHALL resume via `src/controller/controller.ts:387-390`; every other run SHALL keep its status. Release SHALL be safe to repeat.
 7. WHEN a deploy ends in `done` THEN a run that was `running` at the press SHALL run again from its cursor, and a run `waiting` on an unanswered wait SHALL still be `waiting`.
 8. IF the process was started with `--smoke` THEN it SHALL NOT act on any deploy record. The smoke boot works on a copy of the home (`scripts/sdd-self-update.sh:213-214`).
 
@@ -85,8 +85,8 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 
 #### Acceptance Criteria
 
-1. WHEN the operator POSTs `/api/controller/deploy/cancel` AND the record is at `wait`, `build`, `smoke` or `gate` THEN the controller SHALL stop the unit if `unitStarted`, wait until the unit is gone, release the holds, remove the record and answer 200.
-2. WHEN the controller removes the record THEN no later script write SHALL recreate it, so removal SHALL come after the unit is gone, and a cancelled script SHALL leave no `failed` record. The controller SHALL start no unit once the record is removed, by the re-read under its lock (R1 AC4).
+1. WHEN the operator POSTs `/api/controller/deploy/cancel` AND the record is at `wait`, `build`, `smoke` or `gate` THEN the controller SHALL stop the unit if `unitStarted`, wait until the unit is gone, then under the same lock as R1 AC4 release the holds and remove the record, and answer 200.
+2. WHEN the controller removes the record THEN no later script write SHALL recreate it, so removal SHALL come after the unit is gone, and a cancelled script SHALL leave no `failed` record. Because the removal runs under R1 AC4's lock, it is serialised against that AC's re-read → persist → spawn: the re-read is decisive, so the removal falls either before it or after a completed spawn the cancel then stops, and the controller SHALL start no unit once the record is removed.
 3. IF the record is at `swap`, `restart`, `done` or `failed` THEN the route SHALL answer 409 `deploy-past-swap` and change nothing. IF no record exists THEN the route SHALL answer 404.
 4. WHEN a cancel completes THEN the live checkout and `dist/` SHALL be unchanged. The staging worktree may stay; the next run resets it (`scripts/sdd-self-update.sh:191-194`).
 
@@ -125,14 +125,14 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 ## Decisions taken in this document
 
 - D1 — Which runs a deploy holds: every live run with no operator hold, because a merging or usage-paused run can otherwise start a step during the build that the restart would kill.
-- D2 — What a press does when there is nothing new: the script refuses under the new flag, because the decomposition expects the script to refuse a no-op but the code does not; no check runs before the press.
-- D3 — Who waits for a live step: the controller waits, then starts the unit, because the decomposition keeps the script's refusal. The cost is one exception to the lost-unit rule: a record at `wait` whose unit was never started continues after a restart and does not fail.
+- D2 — What a press does when there is nothing new: the script refuses under the new flag, because the decomposition expects a no-op refusal but the code has none; no check runs before the press.
+- D3 — Who waits for a live step: the controller waits, then starts the unit, because the decomposition keeps the script's refusal. The cost is one exception to the lost-unit rule: a record at `wait` with `unitStarted` false or absent continues after a restart and does not fail. `unitStarted` true means the controller committed to starting the unit, so R3 AC3 fails the record when no unit is live, even when the crash fell in the persist-to-spawn window.
 - D4 — What a deploy hold does to status: leave status alone and skip the settle pass, because a queued, waiting or merging run keeps its status underneath (a running run with a live drive parks `paused`, R4 AC5) and a usage pause keeps its reason and resume time.
 - D5 — Where the swap stage begins: before the live checkout moves, because a cancel between the two would leave the checkout ahead of the running build.
 - D6 — How the page sees the restart stage: a three-second gap in the script, because otherwise the service dies before the feed delivers the stage.
 - D7 — How long a finished strip stays: until the next press, because it adds no control and no timer.
 - D8 — How the controller learns of a stage: its one-second tick, because the feed adds no watcher and a running controller must also finish a failed record.
-- D9 — Operator actions during a deploy: Pause moves the hold to the operator and Resume is refused, because a silent no-op on Pause would release a run the operator meant to keep and a Resume would start a step during the build.
+- D9 — Operator actions during a deploy: Pause moves the hold to the operator and Resume is refused, because a Pause no-op would release a run the operator meant to keep and a Resume would start a step during the build.
 - D10 — Launch during a deploy: refuse with a reason, because the launch guard already works this way and nothing extra needs release.
 - D11 — The advisor's staged deploy: refuse it while a record is open, because two scripts must not share the staging worktree and rerouting is outside this entry.
 - D12 — Reconnect after a deploy: a two-second retry during swap and restart, because the base backoff can miss the ten-second target.
@@ -141,34 +141,37 @@ Terms. A record is **open** when its `stage` is neither `done` nor `failed`. A *
 
 Added beyond the entry:
 - `merging` runs and non-operator `paused` runs are held (D1).
-- A no-op refusal under the flag (D2). The entry's statement that the divergence check refuses a no-op does not match the code. The entry's "no check before pressing" stands.
+- A no-op refusal under the flag (D2), which the entry expects but the code lacks.
 - Launch, Resume and the advisor's staged deploy are refused while a record is open (D9, D10, D11).
-- A field (`unitStarted`) says the unit was started, distinct from `started` (D3). The entry's list has no such field.
+- A field (`unitStarted`) says the controller committed to starting the unit, distinct from `started` (D3); the entry's list has no such field.
 
 Narrowed from the entry:
-- "At any stage with no live transient unit" excludes a record at `wait` whose unit was never started (D3). End-to-end scenario 5 therefore has two cases: unit started (it continues) and unit not started (the restarted controller starts it). Both end by finishing the record.
+- "At any stage with no live transient unit" excludes a record at `wait` with `unitStarted` false or absent (D3). Scenario 5 therefore has two cases: a live unit (it continues) and no unit with the flag unset (the restarted controller starts it); both finish the record.
 
 Cut or deferred:
 - The advisor's staged deploy keeps its detached spawn in the service cgroup; rerouting it is deferred (D11).
 - The Deploy action never passes `--no-restart` or `--eval-override`. An eval override stays a shell operation.
 - Hand runs and the post-merge command are not guarded against an open record.
 
-Left to the design, as the entry says: the unit's name and how a second press finds it, the `wait_no_step` timeout against a long step (Requirement 1 AC 7 needs the limit), and whether the controller start lists open verification deferrals on the strip.
+Left to the design: the unit's name and how a second press finds it, the `wait_no_step` timeout against a long step (Requirement 1 AC 7 needs the limit), and whether the controller start lists open verification deferrals on the strip.
 
-The entry's six end-to-end scenarios carry into the design unchanged, apart from the scenario 5 note above. Scenario 3 needs no new seam: the staged-CLI stub already fails the gate (`src/__tests__/service-scripts.test.ts:460`). Nothing was carried from an earlier phase.
+The entry's six end-to-end scenarios carry into the design unchanged, except scenario 5's note above. Scenario 3 needs no new seam: the staged-CLI stub already fails the gate (`src/__tests__/service-scripts.test.ts:460`). Nothing was carried from an earlier phase.
 
 ## Revision History
 
-- **v3** (2026-11-05) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/0).
-  - **R2-1 — Accepted (MUST_FIX).** R1 AC4 persists `unitStarted: true` before the spawn, so no crash leaves a live unit with the flag absent; R3 AC4 adds no-unit-live and defers to AC5 when one is, leaving the `wait`-plus-absent-flag state to one branch.
-  - **R2-2 — Accepted (SHOULD_FIX).** R1 AC4 makes the controller re-read the record under its lock and spawn only while it is open at `wait`; R5 AC2 names the reciprocal, so a cancel cannot be overtaken by a tick.
-  - **Lint pass.** 0 fixed; rejected: L-1–L-46, citation-identifier false positives — each backtick token is a spec-introduced deploy-record field/stage/hold value, a systemd term (`KillMode`), a probe-proven env var, `service` via `service.env`/`$ENV_FILE`, or an identifier declared just outside the cited anchor line (`RunRecord` at `src/controller/state.ts:70`, `isStartable` at `src/controller/controller.ts:454`, `check_move` at `scripts/sdd-self-update.sh:132`); unchanged since v1/v2 and so suppressed per rule 11, each cited range re-read and still anchoring.
-- **v2** (2026-11-05) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/2).
-  - **R1-1 — Accepted (SHOULD_FIX).** R1 AC2 now sets `pauseRequested` with the deploy hold and R3 AC6 clears both fields on release, so a released queued or merging run is startable again; R4 AC4 names `pauseRequested` as the reason `isStartable` stays false.
-  - **R1-2 — Accepted (SHOULD_FIX).** The unit-started signal is a distinct field `unitStarted`, set true at R1 AC4; R1 AC1's `started` is marked the press time; R3 AC3/AC4 and the cancel and scope-note text now read `unitStarted`.
-  - **R1-3 — Accepted (SHOULD_FIX).** R6 AC2 now pins the client half of the deploy message — a subscription and state slot in ShellProvider and a frontend hand-copy of its payload type — mirroring the three-location wire for `holdBy`.
-  - **R1-4 — Accepted (MINOR).** R5 AC1 now answers 200 on a successful cancel.
-  - **R1-5 — Accepted (MINOR).** D4 scopes "keeps its status underneath" to queued, waiting and merging runs and notes a running run with a live drive parks paused.
-  - **Lint pass.** 0 fixed; rejected: L-1–L-45, the citation-identifier false positives v1 rejected, unchanged since and so suppressed per rule 11; cited ranges re-read and still anchoring.
+- **v4** (2026-11-05) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md, verdict iterate 1/1/1).
+  - **R3-1 — Accepted (MUST_FIX).** Cancel's release-and-remove (R5 AC1) now runs under R1 AC4's lock, serialising it against the re-read, persist and spawn; R5 AC2 drops the unsound "re-read under its lock" claim, so the controller's own persist cannot recreate a removed record.
+  - **R3-2 — Accepted (SHOULD_FIX).** R2 AC3 drops "from outside a cancel": the script writes failed on any SIGTERM, and cancel's removal of the record after the unit is gone is what leaves a cancelled deploy no failed record.
+  - **R3-3 — Accepted (MINOR).** R3 AC3, D3 and the scope note read the flag as "committed to starting the unit", and D3 scopes does-not-fail to the flag false or absent.
+  - **Lint pass.** 0 fixed; rejected: L-1–L-47 citation-identifier false positives, suppressed per rule 11.
+- **v3** (2026-11-05) — Round-2 response (adversarial-analysis-requirements-r2.md, iterate 1/1/0).
+  - **R2-1 — Accepted (MUST_FIX).** Persist the unit-started flag before the spawn; R3 AC4 gains no-unit-live and defers to AC5, closing the double-spawn.
+  - **R2-2 — Accepted (SHOULD_FIX).** Controller re-reads under its lock and spawns only while open at wait; R5 AC2 names the reciprocal.
+- **v2** (2026-11-05) — Round-1 response (adversarial-analysis-requirements.md, iterate 0/3/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Deploy hold sets the pause flag and release clears it, so a released run is startable; R4 AC4 names the reason.
+  - **R1-2 — Accepted (SHOULD_FIX).** Unit-started signal split into its own field, distinct from the press-time started.
+  - **R1-3 — Accepted (SHOULD_FIX).** R6 AC2 pins the client half of the deploy message, mirroring the hold-by wire.
+  - **R1-4 — Accepted (MINOR).** R5 AC1 answers 200 on a successful cancel.
+  - **R1-5 — Accepted (MINOR).** D4 scopes "keeps its status underneath" and notes a live-drive run parks paused.
 - **v1** (2026-11-05) — Initial draft.
-  - **Lint pass.** 0 fixed; rejected: L-1–L-44, all citation-identifier false positives — each backtick token is a spec-introduced deploy-record field/stage/hold value, a `RunStatus` name, a type or function declared just outside the cited line (`RunRecord` at `src/controller/state.ts:70`, `isStartable` at `src/controller/controller.ts:454`, `check_move` at `scripts/sdd-self-update.sh:132`), a probe-proven env var, or `service.env` via `$ENV_FILE`. Every cited range was re-read and anchors its phrase.
+- **Lint.** Every round: 0 fixed; L-1 onward rejected as citation-identifier false positives, each cited range re-read and anchoring.

````
