# Adversarial Review — controller-liveness-and-push/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-design.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): controller-liveness-and-push design v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 7baf7334

````diff
diff --git a/.spec-workflow/specs/controller-liveness-and-push/design.md b/.spec-workflow/specs/controller-liveness-and-push/design.md
index 16242b13..e730317d 100644
--- a/.spec-workflow/specs/controller-liveness-and-push/design.md
+++ b/.spec-workflow/specs/controller-liveness-and-push/design.md
@@ -2,7 +2,7 @@
 
 ## Overview
 
-This spec adds a durable step heartbeat, a live `driven` fact on the run row, a crash wait, a Re-drive route, an ntfy phone push with one reminder, and a launch-routing fix. The work sits in the controller (`src/controller/`), the wait pusher (`src/advisor/push.ts`) and the dashboard server (`src/dashboard/`). It reuses the per-run write chain, the `error` wait answer path, the `WaitPusher` watch, and `nextUnstartedSpec`.
+This spec adds a durable step heartbeat, a live `driven` fact on the run row, a crash wait, a Re-drive route, an ntfy phone push with one reminder, and a launch-routing fix. The work sits in the controller (`src/controller/`), the wait pusher (`src/advisor/push.ts`) and the dashboard server (`src/dashboard/`).
 
 ## Steering Document Alignment
 
@@ -26,7 +26,7 @@ Inline code is illustrative; the post-conditions bind, not the code shape.
 ### C1 — Run record and heartbeat write (`src/controller/state.ts`)
 - **Purpose:** hold `lastActivity` and give it one writer.
 - **Interfaces:**
-  - `RunRecord` (`src/controller/state.ts:70-109`) gains `lastActivity?: string` (ISO).
+  - `RunRecord` (`src/controller/state.ts:69-109`) gains `lastActivity?: string` (ISO).
   - `writeLastActivity(id: string, value: string | undefined, updated: string): Promise<RunRecord | undefined>`.
 - **Post-conditions of `writeLastActivity`:**
   1. It queues on `writeChains` (`src/controller/state.ts:415`), behind every `writeRun` already queued for that id.
@@ -128,7 +128,7 @@ export function createStepHeartbeat(opts: {
   - Public `sweepReminders(): Promise<void>`, the timer's entry and the test seam. It runs through the existing queue (`src/advisor/push.ts:145-152`).
   - Exported pure `buildMessage(wait: WaitRecord, projectName: string, reminder: boolean): { title: string; body: string }`.
 - **Start:** `start()` reads the config once. Missing or invalid: one `console.error` saying push is off. Valid and loose: one warning. Neither line prints the url, topic or token. `attemptPush` still reads the config at each send, so a file added later needs no restart. After the start-up scan, `start()` enqueues one sweep and arms an unref'd `setInterval` of `sweepMs`; `stop()` clears it.
-- **Recording a new wait** (`runStartupScan` loop and `handleWait`, `src/advisor/push.ts:166-172`, `:175-186`): read the config. With a config, add the id to `ids` and set `firstPush[id]` to `now()`. Without one, add it to `ids` and `reminded`. Write the record, then POST. The record is written before the POST, as today, so a crash cannot double-send. A POST that fails twice leaves the reminder armed (D10).
+- **Recording a new wait** (`runStartupScan` loop and `handleWait`, `src/advisor/push.ts:166-172`, `:175-186`): read the config. With a config, add the id to `ids` and set `firstPush[id]` to `now()`. Without one, add it to `ids` and `reminded`. Write the record, then POST. The record is written before the POST, as today, so a crash cannot double-send. A POST that fails twice leaves the reminder armed (D10). The config is read here and again in `attemptPush` (`:189`); a flip between leaves the id recorded with its POST skipped — harmless for the one operator.
 - **First start** (no readable record): `ids` and `reminded` both take every open wait; nothing is sent (Requirement 4 AC 6, Requirement 5 AC 5).
 - **`sweepReminders` post-conditions:** for each id in `firstPush`, not in `reminded`, with `now() - firstPush[id] >= 3_600_000`: read the wait, add the id to `reminded`, write the record, and POST with `reminder: true` only if the wait is `open` and a config reads. The id is recorded before the POST, so a failed reminder is not rescheduled and a restart cannot send a second one. A restart past the hour sends through the sweep `start()` enqueues.
 - **POST:** `fetch(url.replace(/\/+$/, '') + '/' + topic, { method: 'POST', headers, body })`. `res.ok` false or a throw is a failure (`src/advisor/push.ts:206-217`). The retry and the `push.failure` row keep their shape (`:188-204`); `detail` names the url and whether it was a reminder, never the topic or token.
@@ -137,10 +137,10 @@ export function createStepHeartbeat(opts: {
   - Body line 1: `${kind} | ${projectName} | ${spec}`, prefixed `Reminder: ` for a reminder.
   - Body line 2: `wait.questions[0].text.trim()` cut at the first line break, with paths redacted; left out when the wait has no question.
   - Title: `SDD ${kind}`, or `SDD reminder: ${kind}`.
-  - Redaction: an absolute or `~/` file path of two or more segments becomes `[path]`. `/home/mcf/repo/x.ts` is redacted; a relative path and an `https://` URL are not. A crash message can quote a path, and Requirement 4 AC 3 allows none (D12).
+  - Redaction: a path-shaped token becomes `[path]` — an absolute path (leading `/`), a `~/` path, or a relative token with a `/` and a file extension. `/home/mcf/repo/x.ts`, `~/notify.json` and `src/controller/step.ts` all redact (D12); a bare relative directory with no extension is the one residual AC 3 does not cover.
 - **Project name:** `readProjects()` (`src/controller/state.ts:504-506`), the entry whose `id` equals `wait.project`, its `name`; else, or on a read failure, `wait.project`.
 - **Probe (node 24.13.0, local capture server):** `fetch` sent the three headers as given and a UTF-8 body intact, with `content-type: text/plain;charset=UTF-8`. A header value of `日本` threw `TypeError`. The title therefore holds only the wait kind, which is ASCII (`src/controller/state.ts:140-147`).
-- **UNCONFIRMED — Requirement 4 AC 4.** The design could not read the ntfy documentation: the fetch of `docs.ntfy.sh/publish` was denied in the drafting session, and no local copy exists. The `Authorization: Bearer` header, the `Title` and `Priority` header names, the priority value and any body size limit are therefore pinned provisionally. The task that writes the POST SHALL read that page first and record the result in its implementation log. If the page disagrees, it stops and escalates rather than shipping the header. The tests prove only what the sender emits, not what ntfy accepts.
+- **UNCONFIRMED — Requirement 4 AC 4.** The design could not read the ntfy documentation: the fetch of `docs.ntfy.sh/publish` was denied in the drafting session, and no local copy exists. The `Authorization: Bearer` header, the `Title` and `Priority` header names, the priority value and any body size limit are therefore pinned provisionally. The task that writes the POST SHALL fetch that page first (its implementer has `WebFetch`) and log the result. If the page disagrees, or the fetch is denied there too, it escalates for an operator-supplied value rather than shipping the header blind — so the gate resolves either way. The tests prove only what the sender emits, not what ntfy accepts.
 
 ### C10 — Launch routing (`src/dashboard/harness/run-setup.ts`)
 - **Change:** the guard at `src/dashboard/harness/run-setup.ts:197-199` becomes `routing.state !== 'active' ? nextUnstartedSpec(workflowRoot) : null`. The union has five members (`src/core/spec-routing-deriver.ts:8-18`), so this names exactly the four states of Requirement 6 AC 1.
@@ -156,7 +156,6 @@ export function createStepHeartbeat(opts: {
 - `settlePass` (`src/controller/controller.ts:381-396`): a stalled `running` run is not settled; a pending hold applies at Re-drive's loop-top stop.
 - `resumeNow` (`src/controller/controller.ts:240-267`): clears a hold as today and starts no drive.
 - `waitAnd` (`src/controller/runs.ts:566-575`): no push here (requirements D1).
-- `src/controller/activity.ts`: untouched; the heartbeat never calls it.
 - `launchSpec` (`src/dashboard/multi-server.ts:101-128`): the folder creation at `:118-120` already serves the new states.
 - `scripts/sdd-watchdog.sh`: unchanged; its wait reaches the pusher through the file watch.
 - `src/dashboard/shell/sidebar-rows.ts:36-44`: reads `updated`, so its column turns fresher while a step streams.
@@ -190,7 +189,7 @@ A reminder is due only for an id in `firstPush` and not in `reminded`. A file wr
 
 ## Testing Strategy
 
-Tests assert only on the `close` exit code, stdout by line (never chunk boundaries), `fs.stat` `mode` bits and `fetch` results. Node 20 is not installed locally; no timing decision rests on a probe, and CI runs node 20.
+Tests assert only on the `close` exit code, stdout by line (never chunk boundaries), `fs.stat` `mode` bits and `fetch` results. No timing decision rests on a probe, and CI runs node 20.
 
 - **Unit:**
   - New `src/controller/__tests__/heartbeat.test.ts`, on `vi.useFakeTimers()` with a fake `write` and no fs: each C3 post-condition.
@@ -199,11 +198,11 @@ Tests assert only on the `close` exit code, stdout by line (never chunk boundari
   - `waits.test.ts`: `expireWait`, `openDriveCrashWait`. `runs.test.ts`: the row carries `lastActivity`, and `driven` from the set, default `false`.
   - `src/dashboard/shell/__tests__/shell-feed.test.ts`: `drivenRuns` reaches the `controller-runs` row.
   - `src/dashboard/harness/__tests__/run-setup.test.ts`: `ambiguous` and `all-deferred` with an unstarted heading; null from `nextUnstartedSpec` keeps the routing reason. `active` and `all-on-disk-complete` are regression guards.
-  - `src/advisor/__tests__/push.test.ts`: `buildMessage` (fields, marker, no-question wait, redaction, multi-line text); bearer header present and absent; on the injected `now` plus `await sweepReminders()`: due, answered first, expired first, failed and not rescheduled, restart past and inside the hour, first start, legacy record; the no-config path; the loose-mode warning; no topic or token in a `push.failure` row or a log.
-- **Assertions that change:** at least these, widen to every assertion the rename or body change touches: `src/advisor/__tests__/push.test.ts:212`, `:304-305`; `src/advisor/__tests__/home.test.ts:67`, `:79`; `src/advisor/__tests__/summary.test.ts:409`; `src/advisor/__tests__/advisor-e2e.test.ts:438-440`. Find them with `grep -rn "pushConfigPath\|push\.json\|dashboardUrl" src/advisor/__tests__`.
+  - `src/advisor/__tests__/push.test.ts`: `buildMessage` (fields, marker, no-question wait, redaction of relative and absolute paths, multi-line text); bearer header present and absent; on the injected `now` plus `await sweepReminders()`: due, answered first, expired first, failed and not rescheduled, restart past and inside the hour, first start, legacy record; the no-config path; the loose-mode warning; no topic or token in a `push.failure` row or a log.
+- **Assertions that change:** widen every assertion the rename or body change touches; find them with `grep -rn "pushConfigPath\|push\.json\|dashboardUrl" src/advisor/__tests__`.
 - **Integration:** `controller.test.ts` with the existing stub `claude` bin: a one-shot throw through the existing `mcpConfigFor` option (`src/controller/controller.ts:54`, called at `src/controller/runs.ts:832`) gives the crash wait, `waiting`, no `inFlight`, and a change event with the id out of `drivenRuns()`; answers `retry` and `abandon` (regression guards); every `redrive` outcome, including a held run parking `paused` and a controller never started; the C5 `recover` branches. `src/dashboard/__tests__/controller-dashboard-routes.test.ts`: the route's 404, 409 and 200, and `driven` on the GET row.
-- **End-to-end** (decomposition scenarios, in a new `src/controller/__tests__/liveness-e2e.test.ts` unless noted):
-  1. A stub step streams lines: `lastActivity` appears, is absent within 1 second of the end, and a status change during the step survives. `heartbeat.test.ts` proves the 10-second cadence, not real waits.
+- **End-to-end** (in a new `src/controller/__tests__/liveness-e2e.test.ts` unless noted):
+  1. A stub step streams lines: `lastActivity` appears, is absent within 1 second of the end, and a status change during the step survives.
   2. A throw through `mcpConfigFor`: `driven: false` within 5 seconds, wait text names step and message, `redrive` resumes from the cursor; after a restart the run is driven with no action.
   3. A stub step killed by signal: retried as today, `driven` stays true (regression guard).
   4. In `push.test.ts`, a capture server stands in for ntfy: one message, one reminder on the injected clock, nothing after an early answer; an absent file writes the wait and logs.
@@ -211,32 +210,38 @@ Tests assert only on the `close` exit code, stdout by line (never chunk boundari
 
 ## Decisions taken in this document
 
-- D1 — The heartbeat is one step-scoped object on the step spec: options were two callbacks on every caller, a process-wide emitter, or one object; chosen because ending it makes every late line a no-op, with no per-run state to leak.
-- D2 — The heartbeat has its own chained writer, and the general run write always takes the field from disk: options were that, an ownership flag like the pause request, or a read-modify-write in the driver; chosen because no other caller ever owns the field.
-- D3 — The stored value is the time of the last parsed line: options were that or the time of the write; chosen because the requirement bounds the value against the last line, and a trailing write would otherwise overstate liveness.
-- D4 — RE-DECIDED: a crashed drive opens a wait only when the run is queued, running or merging: options were every throw or only those statuses; chosen because a throw on a terminal run would revive an abandoned run, and a throw after a park would stack a second wait.
-- D5 — The crash wait is recognised by a question id, not a new wait kind: options were those two; chosen because the requirement keeps the error kind, so the existing answer path applies.
-- D6 — The drive-end change event fires after the drive entry is removed: options were the drive's own finally block or the tracking promise's; chosen because only the later point guarantees the row reads not-driven at the emit.
-- D7 — RE-DECIDED: a process without the controller lock answers Re-drive with 409 not-stalled: options were that, a new 503 code, or a silent 200; chosen because that process cannot drive, a 200 would lie, and the error set stays as the requirement lists it.
-- D8 — The reminder runs from a 60-second sweep over the pushed record: options were per-wait timers re-armed on start, or a sweep; chosen because a sweep needs no arming or cancelling, covers restart with the same code, and gives the clock seam; the cost is up to 60 seconds of lateness.
-- D9 — The pushed record stays version 1 and gains two optional fields: options were a keyed shape with a migration, a separate file, or additive fields; chosen because an old file then reads correctly with no migration.
-- D10 — A failed first POST still arms the reminder, and a wait seen with no config never does: options were arming on success only, or on every recording; chosen because the reminder is the only second chance after a failed send, and with no config nothing was pushed.
-- D11 — The ntfy title is SDD plus the wait kind, priority is 4 on every message, and every required field sits in the body: options were a title with the project name, priority by kind, or the default priority; chosen because a non-Latin-1 header value throws in the probe, every wait blocks the operator, and a body-complete message survives a dropped header. Provisional until the ntfy page is read.
-- D12 — RE-DECIDED: file paths in the question's first line become a marker: options were send it verbatim, drop the line for error waits, or redact; chosen because the requirement bans paths and also asks for the first line, and a crash message can quote a path.
-- D13 — The config reader lives in the advisor home module and the hello's push state uses it: options were a new module, the pusher file, or the home module; chosen because the summary should not import the file watcher, and both readers then share one validity rule.
-- D14 — The driven set enters the row as an optional trailing argument: options were a module-level registry or an argument; chosen because the row functions stay pure and a process with no controller reads false by default.
-- D15 — The end-to-end throw uses the existing MCP-config option as its seam: options were a new test-only hook or that option; chosen because it adds no production code for tests.
+- D1 — The heartbeat is one step-scoped object on the step spec, not callbacks on every caller or a process-wide emitter: ending it makes every late line a no-op, with no per-run state to leak.
+- D2 — The heartbeat has its own chained writer and the general run write always takes the field from disk: no other caller ever owns the field.
+- D3 — The stored value is the time of the last parsed line, not the write: the requirement bounds the value against the last line, and a trailing write would overstate liveness.
+- D4 — RE-DECIDED: a crashed drive opens a wait only when the run is queued, running or merging, not on every throw: a throw on a terminal run would revive an abandoned run, and one after a park would stack a second wait.
+- D5 — The crash wait is recognised by a question id, not a new wait kind: the requirement keeps the error kind, so the existing answer path applies.
+- D6 — The drive-end change event fires after the drive entry is removed: only the later point guarantees the row reads not-driven at the emit.
+- D7 — RE-DECIDED: a process without the controller lock answers Re-drive with 409 not-stalled, not 503 or a silent 200: it cannot drive, a 200 would lie, and the error set stays as the requirement lists it.
+- D8 — The reminder runs from a 60-second sweep over the pushed record, not per-wait timers: a sweep needs no arming, covers restart with the same code, and gives the clock seam, at a cost of up to 60 seconds of lateness.
+- D9 — The pushed record stays version 1 and gains two optional fields, not a migrated shape or a separate file: an old file then reads correctly with no migration.
+- D10 — A failed first POST still arms the reminder, and a wait seen with no config never does: the reminder is the only second chance after a failed send, and with no config nothing was pushed.
+- D11 — The ntfy title is SDD plus the wait kind, priority is 4 on every message, and every required field sits in the body: a non-Latin-1 header value throws in the probe, every wait blocks the operator, and a body-complete message survives a dropped header. Provisional until the ntfy page is read.
+- D12 — RE-DECIDED: file paths in the question's first line become a marker, not sent verbatim or dropped: the requirement bans paths yet asks for the first line, and a crash message can quote a path.
+- D13 — The config reader lives in the advisor home module, used by the hello's push state: the summary should not import the file watcher, and both readers share one validity rule.
+- D14 — The driven set enters the row as an optional trailing argument, not a module-level registry: the row functions stay pure and a process with no controller reads false by default.
+- D15 — The end-to-end throw uses the existing MCP-config option as its seam, not a new test-only hook: it adds no production code for tests.
 
 ## Scope notes
 
 - Cut: nothing from the decomposition entry.
 - Deferred, as the requirements fix: deriving and rendering stalled, and any Re-drive button, belong to the later dashboard specs. No frontend code changes except the type declaration.
-- Open item: Requirement 4 AC 4 asks the design to confirm the bearer header against the ntfy documentation. That confirmation did not happen (see C9); it moves to the push task, which also settles the title, priority and body-size questions. No body length cap is pinned, because no limit could be confirmed.
-- Reminder anchor: the gate A receipt records the reminder as scheduled from the wait's created time; Requirement 5 AC 1 (v3) moved it to the first push, which this design follows. The operator should confirm that change.
+- Open item: Requirement 4 AC 4's bearer-header confirmation moves to the push task (see C9), which also settles the title, priority and body-size questions; no body-length cap is pinned, because no limit could be confirmed.
+- Reminder anchor: Requirement 5 AC 1 (v3) times the reminder from the first push, not the wait's created time, which this design follows.
 - Dropped from the message: `dashboardUrl` (Requirement 4 AC 3 allows four fields only).
 - Carried items from the requirements phase: none.
 
 ## Revision History
 
+- **v2** (2026-11-03) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/3).
+  - **R1-1 — Partially accepted (SHOULD_FIX).** C9 redaction now marks any path-shaped token — absolute, tilde, or a relative token with a slash and a file extension — so a question's first line no longer sends a repo-relative file, and AC 3's no-path rule holds for file paths. A bare relative directory is the one residual; URLs stay, since AC 3 bans paths, not URLs.
+  - **R1-2 — Accepted (MINOR).** C9 now notes the config-read race between the recording read and the send read: the id is still recorded but its POST may skip; harmless for the one operator.
+  - **R1-3 — Partially accepted (MINOR).** C9's AC 4 gate now escalates for an operator-supplied value when the task's ntfy-doc fetch is blocked, rather than shipping the provisional header.
+  - **R1-4 — Accepted (MINOR).** C1 now cites the RunRecord interface at the line range the requirement and context use.
+  - **Lint pass.** 0 fixed; rejected: L-1–L-58 citation-identifier false positives, all cited anchors resolve, suppressed per rule 11.
 - **v1** (2026-11-03) — Initial draft.
   - **Lint pass.** 3 fixed (L-25, L-34, L-42: bare ranges prefixed). Rejected L-1–L-24, L-26–L-33, L-35–L-41, L-43–L-60: citation-identifier false positives; cited anchors resolve. Reasons: /tmp/scratchpad/sdd/controller-liveness-and-push/lint.md

````
