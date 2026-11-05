# Adversarial Review — dashboard-deploy/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-deploy design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-deploy` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 24e037f0

````diff
diff --git a/.spec-workflow/specs/dashboard-deploy/design.md b/.spec-workflow/specs/dashboard-deploy/design.md
index 45f4e386..02346bd3 100644
--- a/.spec-workflow/specs/dashboard-deploy/design.md
+++ b/.spec-workflow/specs/dashboard-deploy/design.md
@@ -78,45 +78,45 @@ Decision numbers continue from the requirements, whose decisions end at D12.
   - `wait: a live step outlasted the 5-hour limit`
   - `wait: systemd-run could not start the unit (exit N)`; the raw stderr goes to `console.error` only, because it can name a path (probe below).
   - `<stage>: unit sdd-deploy.service is not live`, with the `swap`/`restart` suffix from C4 at those stages.
-- **Reuses:** `writeJsonAtomic` (`src/controller/state.ts:338-343`), `isProcessAlive` (`:657-660`).
+- **Reuses:** `writeJsonAtomic` (`src/controller/state.ts:338-343`), `isProcessAlive` (`src/controller/state.ts:657-660`).
 
 ### C2. Hold model (`src/controller/state.ts`)
 
 - **Interfaces:**
   - `RunRecord.holdBy?: 'operator' | 'deploy'` beside `pauseRequested` (`src/controller/state.ts:91`); absent reads as `operator`.
-  - `writeRunLocked` treats `holdBy` exactly as `pauseRequested` (`:424-437`): carried from disk unless the writer has `ownsPauseRequest`, cleared on a terminal status (R4 AC2).
-  - New `updateRun(id, fn: (run: RunRecord) => RunRecord | undefined): Promise<RunRecord | undefined>`. It runs inside the id's write chain (`:447-455`), re-reads the record, applies `fn`, and writes with `ownsPauseRequest: true`; `fn` returning `undefined` writes nothing. Holds and releases use it, so a stale copy never reverts a driver's status write (D22).
+  - `writeRunLocked` treats `holdBy` exactly as `pauseRequested` (`src/controller/state.ts:424-437`): carried from disk unless the writer has `ownsPauseRequest`, cleared on a terminal status (R4 AC2).
+  - New `updateRun(id, fn: (run: RunRecord) => RunRecord | undefined): Promise<RunRecord | undefined>`. It runs inside the id's write chain (`src/controller/state.ts:447-455`), re-reads the record, applies `fn`, and writes with `ownsPauseRequest: true`; `fn` returning `undefined` writes nothing. Holds and releases use it, so a stale copy never reverts a driver's status write (D22).
 
 ### C3. Controller wiring (`src/controller/controller.ts`)
 
 - **Post-conditions:**
   - `ControllerOptions` gains `deployUnit?: DeployUnit`, `deployWaitLimitMs?: number`, `deployDisabled?: boolean`.
   - `pressDeploy()`, `cancelDeploy()`, `deployRecord()` delegate to C1. With `deployDisabled`, `start()` skips `onStart` and `schedule` skips `tick` (R3 AC8).
-  - `start()`: `await deploy.onStart()` between `waitEvents.on` and `recover()` (`:109-111`) (D21).
-  - `schedule()`: `await deploy.tick()` first, after the `started` guard (`:395`).
-  - `settlePass`: skip a run with `holdBy: 'deploy'`, write nothing (R4 AC3, `:434-449`).
-  - The usage-window branch (`:405-409`) skips a `deploy`-held queued run, so its status stays as D4 says.
-  - `isStartable` is unchanged: `:456` already refuses (R4 AC4).
-  - `onWaitChange`: after the status guard (`:546`), return when `run.holdBy === 'deploy'`, before the abandon branch and the patch. Release replays the answer through `resumeIfWaitAnswered` (`:387-390`), and `recover` meets the same guard (R4 AC6, `:352-353`).
-  - `pause`: the early return at `:242` becomes `run.pauseRequested && run.holdBy !== 'deploy'`, and the patch always sets `holdBy: 'operator'` (R4 AC1, AC7). A `deploy`-held run falls through to the operator.
-  - `resumeNow(runId)`: returns the new sentinel `'deploy-open'`, under the deploy lock, when the run exists and it has `holdBy: 'deploy'` or a record is open (R4 AC8). Its held branch also clears `holdBy` (`:277-284`).
-  - `enqueue`: the admission (`:191-209`) runs inside `deploy.withLock`, and throws `enqueue: a deploy is open (stage <stage>)` while a record is open (R4 AC9, D23). `launchSpec` already maps the throw to 409 (`src/dashboard/multi-server.ts:122-127`).
-  - `launchBlock`: returns `A deploy is in progress (<stage>); launch waits until it ends.` first while a record is open (`:315-327`).
+  - `start()`: `await deploy.onStart()` between `waitEvents.on` and `recover()` (`src/controller/controller.ts:109-111`) (D21).
+  - `schedule()`: `await deploy.tick()` first, after the `started` guard (`src/controller/controller.ts:395`).
+  - `settlePass`: skip a run with `holdBy: 'deploy'`, write nothing (R4 AC3, `src/controller/controller.ts:434-449`).
+  - The usage-window branch (`src/controller/controller.ts:405-409`) skips a `deploy`-held queued run, so its status stays as D4 says.
+  - `isStartable` is unchanged: `src/controller/controller.ts:456` already refuses (R4 AC4).
+  - `onWaitChange`: after the status guard (`src/controller/controller.ts:546`), return when `run.holdBy === 'deploy'`, before the abandon branch and the patch. Release replays the answer through `resumeIfWaitAnswered` (`src/controller/controller.ts:387-390`), and `recover` meets the same guard (R4 AC6, `src/controller/controller.ts:352-353`).
+  - `pause`: the early return at `src/controller/controller.ts:242` becomes `run.pauseRequested && run.holdBy !== 'deploy'`, and the patch always sets `holdBy: 'operator'` (R4 AC1, AC7). A `deploy`-held run falls through to the operator.
+  - `resumeNow(runId)`: returns the new sentinel `'deploy-open'`, under the deploy lock, when the run exists and it has `holdBy: 'deploy'` or a record is open (R4 AC8). Its held branch also clears `holdBy` (`src/controller/controller.ts:277-284`).
+  - `enqueue`: the admission (`src/controller/controller.ts:191-209`) runs inside `deploy.withLock`, and throws `enqueue: a deploy is open (stage <stage>)` while a record is open (R4 AC9, D23). `launchSpec` already maps the throw to 409 (`src/dashboard/multi-server.ts:122-127`).
+  - `launchBlock`: returns `A deploy is in progress (<stage>); launch waits until it ends.` first while a record is open (`src/controller/controller.ts:315-327`).
   - Cancel and discard are unchanged: a terminal status clears the hold (R4 AC11).
-- **Unchanged in `src/controller/runs.ts`:** `stopReason` (`:417-422`) and `pause` (`:573-581`) already park a held run, and `writeRunLocked` keeps `holdBy` (R4 AC5).
+- **Unchanged in `src/controller/runs.ts`:** `stopReason` (`src/controller/runs.ts:417-422`) and `pause` (`src/controller/runs.ts:573-581`) already park a held run, and `writeRunLocked` keeps `holdBy` (R4 AC5).
 
 ### C4. Self-update script (`scripts/sdd-self-update.sh`)
 
-- **Argument:** `--deploy-record <path>` in the parser (`:32-46`) and both usage lines. With `--dry-run` the path is dropped (R2 AC7). Without a path, nothing below applies: no trap, record, claim or gap (R2 AC8).
+- **Argument:** `--deploy-record <path>` in the parser (`scripts/sdd-self-update.sh:32-46`) and both usage lines. With `--dry-run` the path is dropped (R2 AC7). Without a path, nothing below applies: no trap, record, claim or gap (R2 AC8).
 - **`write_stage <stage>`:** sets `STAGE`, then updates the record through an inline `node -e` using only `fs`, with the path and fields passed through the environment. It merges the given fields into the existing file through a temp file and rename in the same directory, and exits non-zero when the file is absent, so a script write never recreates a removed record (R2 AC5, R5 AC2).
-- **Stage calls (R2 AC1):** `wait` before `:81`, `build` before `:191`, `smoke` before `:213`, `gate` before `:239`, `swap` after the claim and before `:276`, `restart` between `:305` and `:307`, `done` after `:308`.
-- **`commit` (R2 AC2):** written after `check_move` at `:180`.
-- **No-op refusal (R2 AC4):** at the same point, with the flag set and `behind` equal to 0: `log "refusing: nothing to deploy; the checkout is at origin/main"; exit 1`. The second `check_move` at `:276` does not repeat it.
+- **Stage calls (R2 AC1):** `wait` before `scripts/sdd-self-update.sh:81`, `build` before `scripts/sdd-self-update.sh:191`, `smoke` before `scripts/sdd-self-update.sh:213`, `gate` before `scripts/sdd-self-update.sh:239`, `swap` after the claim and before `scripts/sdd-self-update.sh:276`, `restart` between `scripts/sdd-self-update.sh:305` and `scripts/sdd-self-update.sh:307`, `done` after `scripts/sdd-self-update.sh:308`.
+- **`commit` (R2 AC2):** written after `check_move` at `scripts/sdd-self-update.sh:180`.
+- **No-op refusal (R2 AC4):** at the same point, with the flag set and `behind` equal to 0: `log "refusing: nothing to deploy; the checkout is at origin/main"; exit 1`. The second `check_move` at `scripts/sdd-self-update.sh:276` does not repeat it.
 - **Claim (D15):** with the flag, immediately before `write_stage swap`: `mkdir "$DEPLOY_RECORD.claim"`. On failure: `log "refusing: a cancel holds the deploy; nothing moved"; exit 1`. After this `mkdir` a cancel cannot claim and sends no stop, so no cancel's SIGTERM reaches the checkout move or the `dist/` swap.
-- **Failure capture (R2 AC3):** `log` (`:54`) also stores its text in `LAST_LOG`. With the flag: `trap 'exit 143' TERM` and an EXIT trap. When the exit code is non-zero the EXIT trap writes `stage: 'failed'` and `error`, and ignores a write failure.
+- **Failure capture (R2 AC3):** `log` (`scripts/sdd-self-update.sh:54`) also stores its text in `LAST_LOG`. With the flag: `trap 'exit 143' TERM` and an EXIT trap. When the exit code is non-zero the EXIT trap writes `stage: 'failed'` and `error`, and ignores a write failure.
   - Every refusal logs before it exits, so the existing `exit 1` sites stay as they are (R2 AC9).
   - `error` is `<STAGE>: <text>`. `<text>` is `FAIL_NOTE` when set, else `LAST_LOG`, with ` (exit N)` added when `LAST_LOG` is not a refusal.
-  - `write_error_wait` (`:59-75`) sets `FAIL_NOTE="the step failed; see the error wait"`. The eval summary stays out of the record because it can hold a path (`src/__tests__/service-scripts.test.ts:510`), and `STAGE` supplies `smoke` and `gate`, not the wait texts.
+  - `write_error_wait` (`scripts/sdd-self-update.sh:59-75`) sets `FAIL_NOTE="the step failed; see the error wait"`. The eval summary stays out of the record because it can hold a path (`src/__tests__/service-scripts.test.ts:510`), and `STAGE` supplies `smoke` and `gate`, not the wait texts.
   - At `swap` or `restart` the text gains `; the live checkout or dist/ may already have changed`.
 - **Restart gap (R2 AC6):** with the flag, `sleep 3` after `write_stage restart`.
 
@@ -137,7 +137,7 @@ export function deployUnitArgs(opts: { checkoutRoot: string; recordPath: string;
 export function systemdDeployUnit(): DeployUnit;
 ```
 
-- **Name:** `sdd-deploy`, fixed (D13). `scripts/sdd-service.sh` needs no edit: the unit reads the same `service.env` (`:82`) and repeats the key removal of `:84`.
+- **Name:** `sdd-deploy`, fixed (D13). `scripts/sdd-service.sh` needs no edit: the unit reads the same `service.env` (`scripts/sdd-service.sh:82`) and repeats the key removal of `scripts/sdd-service.sh:84`.
 - **`deployUnitArgs` post-condition.** The `systemd-run` argv holds, in any order:
   - `--user`, `--unit=sdd-deploy`, `--collect`, `--quiet`, `--working-directory=<checkoutRoot>`
   - `--setenv=PATH=<env.PATH>`, `--setenv=HOME=<env.HOME>`, `--setenv=SDD_HOME=<home>`
@@ -153,12 +153,12 @@ export function systemdDeployUnit(): DeployUnit;
 
 ### C6. Routes (`src/dashboard/multi-server.ts`)
 
-- **Interfaces** (the new routes sit under the same global hooks with no exemption, `:690`):
+- **Interfaces** (the new routes sit under the same global hooks with no exemption, `src/dashboard/multi-server.ts:690`):
   - `POST /api/controller/deploy`: 202 `{ ok: true }`, or 409 `{ error: 'deploy-open', stage }`.
   - `POST /api/controller/deploy/cancel`: 200 `{ ok: true }`; 404 `{ error: 'no-deploy' }`; 409 `{ error: 'deploy-past-swap', stage }`; 500 `{ error: 'deploy-stop-failed' }`.
-  - `POST /api/controller/runs/:id/resume` (`:833-839`): the `'deploy-open'` sentinel maps to 409 `{ error: 'deploy-open' }`.
-  - `MultiDashboardOptions` (`:70-75`) gains `smoke?: boolean` and `deployUnit?: DeployUnit`, passed to the `Controller` (`:177-194`) as `deployDisabled` and `deployUnit`. `src/index.ts:563-568` passes `smoke: isSmokeMode`.
-- **Unchanged:** the advisor tmux spawn (`:741-752`).
+  - `POST /api/controller/runs/:id/resume` (`src/dashboard/multi-server.ts:833-839`): the `'deploy-open'` sentinel maps to 409 `{ error: 'deploy-open' }`.
+  - `MultiDashboardOptions` (`src/dashboard/multi-server.ts:70-75`) gains `smoke?: boolean` and `deployUnit?: DeployUnit`, passed to the `Controller` (`src/dashboard/multi-server.ts:177-194`) as `deployDisabled` and `deployUnit`. `src/index.ts:563-568` passes `smoke: isSmokeMode`.
+- **Unchanged:** the advisor tmux spawn (`src/dashboard/multi-server.ts:741-752`).
 
 ### C7. Feed and hub
 
@@ -166,7 +166,7 @@ export function systemdDeployUnit(): DeployUnit;
   - `ShellMessage` gains `{ type: 'controller-deploy'; data: { deploy: ControllerDeploy | null } }` (`src/dashboard/shell/types.ts:230-236`).
   - `ShellFeed.flush` appends it as the seventh and last message, read with `readDeployForWireSync()` directly before `messages` is built (`src/dashboard/shell/shell-feed.ts:145-153`). No `await` separates that read from the sends, so a flush cannot send a stale stage after a push. The first flush and `overviewSnapshot` (`src/dashboard/multi-server.ts:360-368`) carry the record (R6 AC9).
   - New `ShellFeed.pushDeploy(deploy)`: when not closed, sends the message at once and replaces it in `last`.
-  - `HarnessHub` subscribes to `deployEvents` beside its other listeners (`src/dashboard/harness/hub.ts:49-52`) and removes the listener in `close` (`:139-154`). The handler calls `this.shellFeed?.pushDeploy(deploy)`.
+  - `HarnessHub` subscribes to `deployEvents` beside its other listeners (`src/dashboard/harness/hub.ts:49-52`) and removes the listener in `close` (`src/dashboard/harness/hub.ts:139-154`). The handler calls `this.shellFeed?.pushDeploy(deploy)`.
 - **Timing:** tick 1 s plus an unthrottled send meets the 2-second limit (D18). `controller.start()` runs before `listen` (`src/dashboard/multi-server.ts:404-417`), so a reconnecting page's first flush shows `done`.
 
 ### C8. Wire rows and the advisor guard
@@ -177,10 +177,10 @@ export function systemdDeployUnit(): DeployUnit;
 ### C9. Dashboard control
 
 - **`src/dashboard_frontend/src/modules/shell/deploy.ts` (new, pure, type-only imports):** `DEPLOY_STAGES`, `isDeployOpen(stage)`, `canCancel(stage)` (true for `wait`, `build`, `smoke`, `gate`), `deployHoldCount(runs)` (status in the five live statuses and `pauseRequested` undefined), `deployRetryCap(stage)` (2000 at `swap` or `restart`, else `null`).
-- **`src/dashboard_frontend/src/modules/shell/pause.ts`:** `isOperatorHeld` is false when `holdBy === 'deploy'`. `pauseNote` returns `{ text: 'held for deploy', overdue: false }` as its first branch (`:27-44`). Rows on both pages pick this up through `pauseNote` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:352-355`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:249`).
-- **`src/dashboard_frontend/src/modules/shell/RunsPage.tsx`:** the `Resume now` branch gains `run.holdBy !== 'deploy'` (`:341`). `held` is false for such a run, so `Resume` hides and Pause stays (`:332-354`).
-- **`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx`:** adds `controllerDeploy: ControllerDeploy | null`, subscribes to `controller-deploy` (`:76-121`), and runs one effect calling `setRetryCap(deployRetryCap(stage))`.
-- **`src/dashboard_frontend/src/modules/shell/types.ts`:** hand copy of `ControllerDeploy` and the `ShellMessage` member (`:268-274`).
+- **`src/dashboard_frontend/src/modules/shell/pause.ts`:** `isOperatorHeld` is false when `holdBy === 'deploy'`. `pauseNote` returns `{ text: 'held for deploy', overdue: false }` as its first branch (`src/dashboard_frontend/src/modules/shell/pause.ts:27-44`). Rows on both pages pick this up through `pauseNote` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:352-355`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:249`).
+- **`src/dashboard_frontend/src/modules/shell/RunsPage.tsx`:** the `Resume now` branch gains `run.holdBy !== 'deploy'` (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:341`). `held` is false for such a run, so `Resume` hides and Pause stays (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:332-354`).
+- **`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx`:** adds `controllerDeploy: ControllerDeploy | null`, subscribes to `controller-deploy` (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:76-121`), and runs one effect calling `setRetryCap(deployRetryCap(stage))`.
+- **`src/dashboard_frontend/src/modules/shell/types.ts`:** hand copy of `ControllerDeploy` and the `ShellMessage` member (`src/dashboard_frontend/src/modules/shell/types.ts:268-274`).
 - **`DeployControl.tsx` (new):** no props; reads only `useShell()` (R6 AC10). `src/dashboard_frontend/src/modules/shell/NowPage.tsx:286` renders it beside `OpenAdvisorButton`, the only Now page change.
   - No open record: `Deploy` (test id `deploy-button`) swaps to an inline confirm, as `confirmDiscard` does (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:358-366`), stating the count and that the restart ends the advisor. The POST goes only from `deploy-confirm` (R6 AC1).
   - Open record: `Deploy` disabled with visible `Deploying: <stage>` (R6 AC3).
@@ -193,7 +193,7 @@ export function systemdDeployUnit(): DeployUnit;
 ### C10. Reconnect (`src/dashboard_frontend/src/modules/ws/`)
 
 - New `retry-delay.ts`: `retryDelayFor(delay: number, cap: number | null): number`.
-- `src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx`: `setRetryCap(ms: number | null)` on the context sets a ref. `onclose` (`:94-104`) computes the delay once through `retryDelayFor`, and uses it for both `nextRetryAt` and the timer. The record stays in `ShellProvider` state through the outage, so the strip stays on screen (R6 AC8).
+- `src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx`: `setRetryCap(ms: number | null)` on the context sets a ref. `onclose` (`src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104`) computes the delay once through `retryDelayFor`, and uses it for both `nextRetryAt` and the timer. The record stays in `ShellProvider` state through the outage, so the strip stays on screen (R6 AC8).
 
 ## Data Models
 
@@ -236,12 +236,12 @@ Script tests assert only exit codes and file contents, and `EEXIST` is read thro
 
 - **Unit:**
   - `src/controller/__tests__/deploy.test.ts` (new), fake `DeployUnit`: both tables, two concurrent presses, persist before spawn, cancel at each stage, claim loss, a tick skipping a held lock, the limit through `deployWaitLimitMs`, release idempotence, `deployUnitArgs`.
-  - `src/controller/__tests__/pause-request.test.ts` beside `:58`: `holdBy` carry-over, `updateRun`, terminal clear.
+  - `src/controller/__tests__/pause-request.test.ts` beside `src/controller/__tests__/pause-request.test.ts:58`: `holdBy` carry-over, `updateRun`, terminal clear.
   - `src/controller/__tests__/controller.test.ts`: `settlePass` skip, `onWaitChange` and recovery on a held run, Pause transfer, Resume and launch refusal, `deployDisabled`.
   - `src/advisor/__tests__/actions.test.ts`: the staged deploy refusal.
-  - `src/dashboard/shell/__tests__/shell-feed.test.ts`: seven messages, `controller-deploy` last (the exact list at `:359-361` changes), and `pushDeploy`.
-  - `src/dashboard/shell/__tests__/deploy-view.test.ts` (new): imports `pause.ts`, `deploy.ts` and `retry-delay.ts` from the frontend tree, because the root vitest config skips that tree (`vitest.config.ts:8-9`). Probe 2026-11-05: vitest imported `pause.ts` this way. `tsc` covers this test (`tsconfig.json:19-20`), so those modules stay free of DOM types.
-- **Script:** `src/__tests__/service-scripts.test.ts`, on `makeDivergedCheckout` and `stageBuildStub` (`:49-76`), with a stub directory first on `PATH` holding `systemctl` and `npm`: the toy `package.json` has no lockfile, so a real `npm ci` stops the script at `scripts/sdd-self-update.sh:299`. No test may reach the real `systemctl`. Cases: stage sequence, `commit`, no-op refusal, each failure stage, TERM, claim refusal, a record not recreated, dry-run, flag absent, and the 3-second gap (the stub records the time).
+  - `src/dashboard/shell/__tests__/shell-feed.test.ts`: seven messages, `controller-deploy` last (the exact list at `src/dashboard/shell/__tests__/shell-feed.test.ts:359-361` changes), and `pushDeploy`.
+  - `src/dashboard/shell/__tests__/deploy-view.test.ts` (new): imports `pause.ts`, `deploy.ts` and `retry-delay.ts` from the frontend tree, because the root vitest config skips that tree (`./vitest.config.ts:8-9`). Probe 2026-11-05: vitest imported `pause.ts` this way. tsc covers this test (`./tsconfig.json:19-20`), so those modules stay free of DOM types.
+- **Script:** `src/__tests__/service-scripts.test.ts`, on `makeDivergedCheckout` and `stageBuildStub` (`src/__tests__/service-scripts.test.ts:49-76`), with a stub directory first on `PATH` holding `systemctl` and `npm`: the toy `package.json` has no lockfile, so a real `npm ci` stops the script at `scripts/sdd-self-update.sh:299`. No test may reach the real `systemctl`. Cases: stage sequence, `commit`, no-op refusal, each failure stage, TERM, claim refusal, a record not recreated, dry-run, flag absent, and the 3-second gap (the stub records the time).
 - **Integration:**
   - `src/dashboard/__tests__/controller-dashboard-routes.test.ts`, with `deployUnit` passed to the server: route status codes.
   - `src/controller/__tests__/deploy-e2e.test.ts` (new, after `liveness-e2e.test.ts`): scenarios 1 to 6 with a real `Controller`, a temp `SDD_HOME` and the real script in a toy checkout, under a `DeployUnit` that spawns the script as a child. Scenario 1's restart stops one `Controller` and starts another on the same home; scenario 5 runs both cases of the requirements' scope note.
@@ -281,3 +281,4 @@ Departures from a requirement's literal:
 ## Revision History
 
 - **v1** (2026-11-05) — Initial draft.
+  - **Lint pass.** 32 citation-bare fixed; every other bare `:N` path-qualified; L-68/L-69 `./`-prefixed; L-47/L-48 resolved by the qualified ranges. Rejected L-1–L-7, L-21–L-22, L-24–L-25, L-39–L-42, L-49–L-50, L-52–L-67, L-70–L-72 (citation-identifier: symbols/values/keywords absent from the cited range).

````
