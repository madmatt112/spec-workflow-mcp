# Adversarial Review — dashboard-deploy/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-design.md using this format:

```markdown
# Adversarial Review Memory — design
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-deploy design v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since a540437b

````diff
diff --git a/.spec-workflow/specs/dashboard-deploy/design.md b/.spec-workflow/specs/dashboard-deploy/design.md
index 02346bd3..e379a17a 100644
--- a/.spec-workflow/specs/dashboard-deploy/design.md
+++ b/.spec-workflow/specs/dashboard-deploy/design.md
@@ -2,7 +2,7 @@
 
 ## Overview
 
-This design adds a deploy coordinator to the controller, a `--deploy-record` mode to `scripts/sdd-self-update.sh`, a `holdBy` field on the run record, two routes, one shell-feed message and one self-contained dashboard control. The coordinator lives inside the `Controller` and the script runs outside the service cgroup in a transient user unit, so the restart cannot kill it. It reuses the operator hold (`pauseRequested`), the per-run write chain, the feed's broadcast path and the script's existing checks.
+This design adds a deploy coordinator to the controller, a `--deploy-record` mode to `scripts/sdd-self-update.sh`, a `holdBy` field on the run record, two routes, one shell-feed message and one dashboard control. The coordinator lives inside the `Controller`; the script runs outside the service cgroup in a transient user unit, so the restart cannot kill it.
 
 ## Steering Document Alignment
 
@@ -10,7 +10,7 @@ This design adds a deploy coordinator to the controller, a `--deploy-record` mod
 N/A: `.spec-workflow/steering/` holds no `tech.md`; the design follows `.spec-workflow/agent-rules.md`.
 
 ### Project Structure (structure.md)
-N/A: no `structure.md`; new modules sit beside their peers (`src/controller/`, `src/dashboard_frontend/src/modules/shell/`) and tests in the adjacent `__tests__/`.
+N/A: no `structure.md`; new modules sit beside their peers and tests in the adjacent `__tests__/`.
 
 ### Design System (design-system.md) — if applicable
 N/A: no `design-system.md`; the control uses the existing `Button` and tone classes as `OpenAdvisorButton` does (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:104-138`).
@@ -68,13 +68,13 @@ Decision numbers continue from the requirements, whose decisions end at D12.
 | any other open record, unit `gone` | write `failed`, release (R3 AC3) |
 | any other open record, unit `unknown` | nothing; the tick decides |
 
-- **Release (R3 AC6).** For every run listed with `holdBy: 'deploy'`, `updateRun` re-checks `holdBy` inside the chain and clears it and `pauseRequested`. A run `paused` with `pauseReason: 'operator'` goes to `queued` with `pauseReason` and `resumeAt` cleared, as in `src/controller/controller.ts:278-281`. Any other run keeps its status. A `waiting` run then goes through `deps.resumeIfAnswered`, and `deps.schedule()` runs. A repeat finds no run.
+- **Release (R3 AC6).** For every run listed with `holdBy: 'deploy'`, `updateRun` re-checks `holdBy` inside the chain, clears it and `pauseRequested`, and emits `runEvents` `change` for it (parity with press step 6). A run `paused` with `pauseReason: 'operator'` goes to `queued` with `pauseReason` and `resumeAt` cleared, as in `src/controller/controller.ts:278-281`. Any other run keeps its status. A `waiting` run then goes through `deps.resumeIfAnswered`, and `deps.schedule()` runs. A repeat finds no run.
 - **`cancel` (R5), one hold of the lock:**
   1. Re-read. No record gives 404. Stage `swap`, `restart`, `done` or `failed` gives 409 `deploy-past-swap`.
   2. Claim: `fs.mkdir` on the claim path, not recursive. `EEXIST` gives 409 `deploy-past-swap`, because the script has claimed the swap (D15).
   3. If `unitStarted` is true or `unit.state()` is `live`: `unit.stop()`, then poll `unit.state()` until `gone`, for at most 30 seconds. Past that, answer 500 `deploy-stop-failed` and keep the record and the claim; the tick fails the record once the unit is gone.
   4. Release, remove the record, remove the claim, emit `change` with `null`, answer 200.
-- **Failed-record writes** keep the other fields. The `error` texts carry no absolute path:
+- **Failed and `done` writes** keep the record's other fields, `commit` included. The failed `error` texts carry no absolute path:
   - `wait: a live step outlasted the 5-hour limit`
   - `wait: systemd-run could not start the unit (exit N)`; the raw stderr goes to `console.error` only, because it can name a path (probe below).
   - `<stage>: unit sdd-deploy.service is not live`, with the `swap`/`restart` suffix from C4 at those stages.
@@ -112,7 +112,7 @@ Decision numbers continue from the requirements, whose decisions end at D12.
 - **Stage calls (R2 AC1):** `wait` before `scripts/sdd-self-update.sh:81`, `build` before `scripts/sdd-self-update.sh:191`, `smoke` before `scripts/sdd-self-update.sh:213`, `gate` before `scripts/sdd-self-update.sh:239`, `swap` after the claim and before `scripts/sdd-self-update.sh:276`, `restart` between `scripts/sdd-self-update.sh:305` and `scripts/sdd-self-update.sh:307`, `done` after `scripts/sdd-self-update.sh:308`.
 - **`commit` (R2 AC2):** written after `check_move` at `scripts/sdd-self-update.sh:180`.
 - **No-op refusal (R2 AC4):** at the same point, with the flag set and `behind` equal to 0: `log "refusing: nothing to deploy; the checkout is at origin/main"; exit 1`. The second `check_move` at `scripts/sdd-self-update.sh:276` does not repeat it.
-- **Claim (D15):** with the flag, immediately before `write_stage swap`: `mkdir "$DEPLOY_RECORD.claim"`. On failure: `log "refusing: a cancel holds the deploy; nothing moved"; exit 1`. After this `mkdir` a cancel cannot claim and sends no stop, so no cancel's SIGTERM reaches the checkout move or the `dist/` swap.
+- **Claim (D15):** with the flag, immediately before `write_stage swap`: `mkdir "$DEPLOY_RECORD.claim"`. On failure: `log "refusing: a cancel holds the deploy; nothing moved"; exit 1`. After this `mkdir` no cancel sends a stop, so no SIGTERM reaches the checkout move or the `dist/` swap.
 - **Failure capture (R2 AC3):** `log` (`scripts/sdd-self-update.sh:54`) also stores its text in `LAST_LOG`. With the flag: `trap 'exit 143' TERM` and an EXIT trap. When the exit code is non-zero the EXIT trap writes `stage: 'failed'` and `error`, and ignores a write failure.
   - Every refusal logs before it exits, so the existing `exit 1` sites stay as they are (R2 AC9).
   - `error` is `<STAGE>: <text>`. `<text>` is `FAIL_NOTE` when set, else `LAST_LOG`, with ` (exit N)` added when `LAST_LOG` is not a refusal.
@@ -172,7 +172,7 @@ export function systemdDeployUnit(): DeployUnit;
 ### C8. Wire rows and the advisor guard
 
 - `ControllerRunRow`, `toRow` (`src/controller/runs.ts:1428-1462`), server `ControllerRun` (`src/dashboard/shell/types.ts:194-214`) and the hand copy (`src/dashboard_frontend/src/modules/shell/types.ts:215-237`) gain `holdBy?: 'operator' | 'deploy'` (R4 AC12).
-- `execDeploy` (`src/advisor/actions.ts:362-384`): first statement reads the record. While open it returns `{ ok: false, outcome: 'refused', detail: <stage>, error: 'deploy-open' }`, spawning nothing (R4 AC10). The confirm route already returns the result body (`src/dashboard/multi-server.ts:789-794`).
+- `execDeploy` (`src/advisor/actions.ts:362-384`): first statement reads the record. While open it returns `{ ok: false, outcome: 'refused', detail: <stage>, error: 'deploy-open', state: 'refused' }`, spawning nothing (R4 AC10). The confirm route already returns the result body (`src/dashboard/multi-server.ts:789-794`).
 
 ### C9. Dashboard control
 
@@ -181,7 +181,7 @@ export function systemdDeployUnit(): DeployUnit;
 - **`src/dashboard_frontend/src/modules/shell/RunsPage.tsx`:** the `Resume now` branch gains `run.holdBy !== 'deploy'` (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:341`). `held` is false for such a run, so `Resume` hides and Pause stays (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:332-354`).
 - **`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx`:** adds `controllerDeploy: ControllerDeploy | null`, subscribes to `controller-deploy` (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:76-121`), and runs one effect calling `setRetryCap(deployRetryCap(stage))`.
 - **`src/dashboard_frontend/src/modules/shell/types.ts`:** hand copy of `ControllerDeploy` and the `ShellMessage` member (`src/dashboard_frontend/src/modules/shell/types.ts:268-274`).
-- **`DeployControl.tsx` (new):** no props; reads only `useShell()` (R6 AC10). `src/dashboard_frontend/src/modules/shell/NowPage.tsx:286` renders it beside `OpenAdvisorButton`, the only Now page change.
+- **`DeployControl.tsx` (new):** no props; reads only `useShell()` (R6 AC10). `src/dashboard_frontend/src/modules/shell/NowPage.tsx:286` renders it beside `OpenAdvisorButton`.
   - No open record: `Deploy` (test id `deploy-button`) swaps to an inline confirm, as `confirmDiscard` does (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:358-366`), stating the count and that the restart ends the advisor. The POST goes only from `deploy-confirm` (R6 AC1).
   - Open record: `Deploy` disabled with visible `Deploying: <stage>` (R6 AC3).
   - Record present: `deploy-strip` shows the seven stages, the current one with `aria-current="step"` (R6 AC2).
@@ -220,14 +220,14 @@ type ControllerDeploy = Omit<DeployRecord, 'v' | 'unitStarted'>;  // wire form
 
 Failure texts are in C1 and C4.
 
-1. **Press with a record open or a unit live:** 409 `deploy-open`; the page shows the stage.
+1. **Press, record open or unit live:** 409 `deploy-open` with the stage.
 2. **`systemd-run` fails, or a live step outlasts 5 hours:** `failed` naming `wait`, holds released (R1 AC6, AC7).
-3. **Script refusal or failure:** `failed` from the EXIT trap, the tick releases, the script's error wait stays (scenario 3).
+3. **Script refusal or failure:** `failed` from the EXIT trap, the tick releases, the error wait stays (scenario 3).
 4. **Unit killed by hand:** no trap ran; the tick or the next start writes `failed` and releases (scenario 6).
-5. **Cancel loses the claim race:** 409 `deploy-past-swap`, even if the record still reads `gate` for the instant before the script's `swap` write.
+5. **Cancel loses the claim race:** 409 `deploy-past-swap`, even if the record still reads `gate` before the `swap` write.
 6. **Cancel cannot stop the unit:** 500 `deploy-stop-failed`; the script cannot pass the claim.
-7. **`systemctl` unreadable:** `unknown`; the tick tries again.
-8. **Controller dies mid-cancel:** after the claim, the script refuses at the claim and the tick releases; after the stop, the TERM trap left `failed` and `onStart` releases.
+7. **`systemctl` unreadable:** `unknown`; the tick retries.
+8. **Controller dies mid-cancel:** after the claim the script refuses and the tick releases; after the stop the TERM trap left `failed` and `onStart` releases.
 9. **Record removed by hand while holds remain:** the tick releases them (D24).
 
 ## Testing Strategy
@@ -251,24 +251,24 @@ Script tests assert only exit codes and file contents, and `EEXIST` is read thro
 
 ## Decisions taken in this document
 
-- D13 — Unit name and how a second press finds it: a fixed name, a per-press name stored in the record, or a pid file; chosen fixed because systemd then refuses a duplicate and a press or restart needs no stored state.
-- D14 — Time limit on the controller's wait: 30 minutes, 2 hours, 5 hours, or none; chosen 5 hours because no step has a timeout, 1 percent of the 202 ledgered spawns ran over 259 minutes, and the operator can cancel throughout. The script's 30 minutes stays; the holds leave it only stragglers.
-- D15 — How a cancel and the swap exclude each other: a one-shot atomic claim, ignoring the signal from the swap on, or a blocking file lock; chosen the claim because after it no stop is sent, so nothing has to survive one, and a crash leaves no waiter.
-- D16 — The tick while a cancel holds the deploy lock: skip, or wait; chosen skip because a wait stalls the scheduler for as long as the stop takes.
-- D17 — What counts as quiet: live steps, or live steps and active drives; chosen both, because a drive between its stop check and its step, or in a merge, has no live step and would trip the script's first refusal.
-- D18 — How a stage reaches the page: arm the throttled feed, or send the one message at once; chosen at once because tick plus throttle already uses the two seconds.
-- D19 — A press that finds a finished record and a live unit: refuse, or replace; chosen refuse because the new unit could not start under the same name.
-- D20 — Open verification deferrals on the strip: add, or leave out; chosen leave out because the strip reads only the record and the Deferrals page lists them.
-- D21 — Order on start: finish the deploy before crash recovery, or after; chosen before, so recovery sees released runs and an answered wait resumes on the normal path.
-- D22 — How holds are written: read-then-save, or an update inside the per-run write chain; chosen the chain because a stale write could revert a driver's park.
-- D23 — Resume and launch against a press: read the record outside the lock, or take it; chosen take it, because otherwise a run can slip past the hold list.
-- D24 — Deploy holds with no record: leave, or release on the tick; chosen release because Resume refuses such a run and nothing else frees it.
-- D25 — Script failure text: the last log line after the stage name, or an edit at every refusal site; chosen the log line because it leaves the checks the entry keeps untouched. Error-wait failures use a fixed note, since the eval summary can hold a path.
-- D26 — Proof of the live scenarios: an evidence file after a hand deploy, or a suite test on real systemd; chosen the file because a suite must never restart the operator's service.
+- D13 — Unit name and how a second press finds it: chosen a fixed name because systemd then refuses a duplicate and a press or restart needs no stored state.
+- D14 — Time limit on the controller's wait: chosen 5 hours because no step has a timeout, 1 percent of the 202 ledgered spawns ran over 259 minutes, and the operator can cancel throughout. The script's 30 minutes stays; the holds leave it only stragglers.
+- D15 — How a cancel and the swap exclude each other: chosen a one-shot atomic claim because after it no stop is sent, so nothing has to survive one, and a crash leaves no waiter.
+- D16 — The tick while a cancel holds the deploy lock: chosen skip because a wait stalls the scheduler for as long as the stop takes.
+- D17 — What counts as quiet: chosen live steps and active drives, because a drive between its stop check and its step, or in a merge, has no live step and would trip the script's first refusal.
+- D18 — How a stage reaches the page: chosen sending the one message at once because tick plus throttle already uses the two seconds.
+- D19 — A press that finds a finished record and a live unit: chosen refuse because the new unit could not start under the same name.
+- D20 — Open verification deferrals on the strip: chosen leave out because the strip reads only the record and the Deferrals page lists them.
+- D21 — Order on start: chosen finish the deploy before crash recovery, so recovery sees released runs and an answered wait resumes on the normal path.
+- D22 — How holds are written: chosen an update inside the per-run write chain because a stale read-then-save could revert a driver's park.
+- D23 — Resume and launch against a press: chosen take the lock because otherwise a run can slip past the hold list.
+- D24 — Deploy holds with no record: chosen release on the tick because Resume refuses such a run and nothing else frees it.
+- D25 — Script failure text: chosen the last log line after the stage name because it leaves the checks the entry keeps untouched. Error-wait failures use a fixed note, since the eval summary can hold a path.
+- D26 — Proof of the live scenarios: chosen an evidence file after a hand deploy because a suite must never restart the operator's service.
 
 ## Scope notes
 
-The requirements' "left to the design" list is answered by D13, D14, D16 and D20. Nothing was carried from the requirements phase.
+The requirements' "left to the design" list is answered by D13, D14, D16 and D20.
 
 Cut: the deferrals line on the strip, which the entry poses as a question (D20).
 
@@ -280,5 +280,11 @@ Departures from a requirement's literal:
 
 ## Revision History
 
+- **v2** (2026-11-05) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/2/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Release now emits a runEvents change per cleared run, as press step 6 does, so a released row refreshes at once, not at the 30 s feed tick (C1 Release).
+  - **R1-2 — Accepted (SHOULD_FIX).** The failed and done writes now both keep the record's other fields, commit included, so the reconnect done strip keeps commit (C1, Failed and done writes).
+  - **R1-M1 — Rejected (MINOR).** R4 AC9 is met by launchBlock's deploy-specific refusal and the 409; the run-live discriminant on the enqueue-race fallback is cosmetic and reworking it would widen scope.
+  - **R1-M2 — Accepted (MINOR).** execDeploy's refusal return adds state refused, as execMerge does, so the action lands refused not failed (C8).
+  - **Lint pass.** 0 fixed; rejected: L-1–L-56 (citation-identifier false positives; each flagged token is a design name, stage/status literal, keyword, or existing symbol, and its co-located citation anchors a verified adjacent claim, not the token).
 - **v1** (2026-11-05) — Initial draft.
   - **Lint pass.** 32 citation-bare fixed; every other bare `:N` path-qualified; L-68/L-69 `./`-prefixed; L-47/L-48 resolved by the qualified ranges. Rejected L-1–L-7, L-21–L-22, L-24–L-25, L-39–L-42, L-49–L-50, L-52–L-67, L-70–L-72 (citation-identifier: symbols/values/keywords absent from the cited range).

````
