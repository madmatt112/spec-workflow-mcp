# Adversarial Review — controller-liveness-and-push/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): controller-liveness-and-push design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `controller-liveness-and-push` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 8e4559af

````diff
diff --git a/.spec-workflow/specs/controller-liveness-and-push/design.md b/.spec-workflow/specs/controller-liveness-and-push/design.md
index 2b6b1bb1..16242b13 100644
--- a/.spec-workflow/specs/controller-liveness-and-push/design.md
+++ b/.spec-workflow/specs/controller-liveness-and-push/design.md
@@ -2,7 +2,7 @@
 
 ## Overview
 
-This spec adds a durable step heartbeat, a live `driven` fact on the run row, a crash wait, a Re-drive route, an ntfy phone push with one reminder, and a launch-routing fix. The work sits in the controller (`src/controller/`), the wait pusher (`src/advisor/push.ts`) and the dashboard server (`src/dashboard/`). It reuses the per-run write chain, the existing `error` wait answer path, the `WaitPusher` watch and dedup, and `nextUnstartedSpec`.
+This spec adds a durable step heartbeat, a live `driven` fact on the run row, a crash wait, a Re-drive route, an ntfy phone push with one reminder, and a launch-routing fix. The work sits in the controller (`src/controller/`), the wait pusher (`src/advisor/push.ts`) and the dashboard server (`src/dashboard/`). It reuses the per-run write chain, the `error` wait answer path, the `WaitPusher` watch, and `nextUnstartedSpec`.
 
 ## Steering Document Alignment
 
@@ -21,7 +21,7 @@ Two data paths change. A step's stream feeds a step-scoped heartbeat object, whi
 
 ## Components and Interfaces
 
-All inline code below is illustrative — verify against the test fake. The post-conditions bind; the code shape does not.
+Inline code is illustrative; the post-conditions bind, not the code shape.
 
 ### C1 — Run record and heartbeat write (`src/controller/state.ts`)
 - **Purpose:** hold `lastActivity` and give it one writer.
@@ -106,7 +106,7 @@ export function createStepHeartbeat(opts: {
 - **Interfaces:**
   - `export const DRIVE_CRASH_QUESTION = 'drive-crash'`.
   - `openDriveCrashWait(runId: string): Promise<ControllerWaitRecord | undefined>` — the open wait for that run with a question of that id, from `listOpenWaits` (`src/controller/waits.ts:187-190`).
-  - `expireWait(id: string): Promise<ControllerWaitRecord | undefined>` — through `enqueueWaitWrite` (`:73-84`); an open wait becomes `expired`, is written, and `change` is emitted; any other state returns unchanged with no write.
+  - `expireWait(id: string): Promise<ControllerWaitRecord | undefined>` — through `enqueueWaitWrite` (`src/controller/waits.ts:73-84`); an open wait becomes `expired`, is written, and `change` is emitted; any other state returns unchanged with no write.
 - **Post-condition:** `onWaitChange` ignores the expired record (`src/controller/controller.ts:439`), and `listWaitsForView` hides it (`src/controller/waits.ts:193-198`).
 - **Reuses:** `createWait` and `answerWait` unchanged (`src/controller/waits.ts:87-141`). `expireWait` writes no `questions.md` and no ledger row.
 
@@ -125,7 +125,7 @@ export function createStepHeartbeat(opts: {
 - **Purpose:** send the ntfy message and the one reminder.
 - **Interfaces:**
   - `WaitPusherOptions` (`src/advisor/push.ts:48-51`) gains `now?: () => Date` and `sweepMs?: number` (default 60,000).
-  - Public `sweepReminders(): Promise<void>`, the timer's entry and the test seam. It runs through the existing queue (`:145-152`).
+  - Public `sweepReminders(): Promise<void>`, the timer's entry and the test seam. It runs through the existing queue (`src/advisor/push.ts:145-152`).
   - Exported pure `buildMessage(wait: WaitRecord, projectName: string, reminder: boolean): { title: string; body: string }`.
 - **Start:** `start()` reads the config once. Missing or invalid: one `console.error` saying push is off. Valid and loose: one warning. Neither line prints the url, topic or token. `attemptPush` still reads the config at each send, so a file added later needs no restart. After the start-up scan, `start()` enqueues one sweep and arms an unref'd `setInterval` of `sweepMs`; `stop()` clears it.
 - **Recording a new wait** (`runStartupScan` loop and `handleWait`, `src/advisor/push.ts:166-172`, `:175-186`): read the config. With a config, add the id to `ids` and set `firstPush[id]` to `now()`. Without one, add it to `ids` and `reminded`. Write the record, then POST. The record is written before the POST, as today, so a crash cannot double-send. A POST that fails twice leaves the reminder armed (D10).
@@ -144,7 +144,7 @@ export function createStepHeartbeat(opts: {
 
 ### C10 — Launch routing (`src/dashboard/harness/run-setup.ts`)
 - **Change:** the guard at `src/dashboard/harness/run-setup.ts:197-199` becomes `routing.state !== 'active' ? nextUnstartedSpec(workflowRoot) : null`. The union has five members (`src/core/spec-routing-deriver.ts:8-18`), so this names exactly the four states of Requirement 6 AC 1.
-- **Post-conditions:** `launchable` and `disabledReason` (`:200-201`) keep their code. `harnessNotLaunchable` (`src/dashboard/multi-server.ts:79-87`) and `validateSetup` (`src/dashboard/harness/run-setup.ts:265-267`) compare against `view.launchable`, and the dashboard reads `launchable` and not `routing.state` (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:406`), so no other site changes.
+- **Post-conditions:** `launchable` and `disabledReason` (`src/dashboard/harness/run-setup.ts:200-201`) keep their code. `harnessNotLaunchable` (`src/dashboard/multi-server.ts:79-87`) and `validateSetup` (`src/dashboard/harness/run-setup.ts:265-267`) compare against `view.launchable`, and the dashboard reads `launchable` and not `routing.state` (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:406`), so no other site changes.
 
 ### C11 — Docs
 - `docs/controller-design.md:335-340`: rewrite the Push bullet of §16 for `notify.json`, the message fields, the reminder and the D2/D3 supersession.
@@ -190,7 +190,7 @@ A reminder is due only for an id in `firstPush` and not in `reminded`. A file wr
 
 ## Testing Strategy
 
-Tests assert only on the `close` exit code, stdout by line (never chunk boundaries), `fs.stat` `mode` bits and `fetch` results. Node 20 is not installed locally (only 22 and 24); no timing decision rests on a probe, and CI runs node 20.
+Tests assert only on the `close` exit code, stdout by line (never chunk boundaries), `fs.stat` `mode` bits and `fetch` results. Node 20 is not installed locally; no timing decision rests on a probe, and CI runs node 20.
 
 - **Unit:**
   - New `src/controller/__tests__/heartbeat.test.ts`, on `vi.useFakeTimers()` with a fake `write` and no fs: each C3 post-condition.
@@ -232,10 +232,11 @@ Tests assert only on the `close` exit code, stdout by line (never chunk boundari
 - Cut: nothing from the decomposition entry.
 - Deferred, as the requirements fix: deriving and rendering stalled, and any Re-drive button, belong to the later dashboard specs. No frontend code changes except the type declaration.
 - Open item: Requirement 4 AC 4 asks the design to confirm the bearer header against the ntfy documentation. That confirmation did not happen (see C9); it moves to the push task, which also settles the title, priority and body-size questions. No body length cap is pinned, because no limit could be confirmed.
-- Reminder anchor: the gate A receipt records the reminder as scheduled from the wait's created time; Requirement 5 AC 1 (v3) moved it to the first push. This design follows the requirements. The operator should confirm that change.
+- Reminder anchor: the gate A receipt records the reminder as scheduled from the wait's created time; Requirement 5 AC 1 (v3) moved it to the first push, which this design follows. The operator should confirm that change.
 - Dropped from the message: `dashboardUrl` (Requirement 4 AC 3 allows four fields only).
 - Carried items from the requirements phase: none.
 
 ## Revision History
 
 - **v1** (2026-11-03) — Initial draft.
+  - **Lint pass.** 3 fixed (L-25, L-34, L-42: bare ranges prefixed). Rejected L-1–L-24, L-26–L-33, L-35–L-41, L-43–L-60: citation-identifier false positives; cited anchors resolve. Reasons: /tmp/scratchpad/sdd/controller-liveness-and-push/lint.md

````
