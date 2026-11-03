# Adversarial Review — controller-liveness-and-push/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): controller-liveness-and-push requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 73247f76

````diff
diff --git a/.spec-workflow/specs/controller-liveness-and-push/requirements.md b/.spec-workflow/specs/controller-liveness-and-push/requirements.md
index a6559e40..2612ae77 100644
--- a/.spec-workflow/specs/controller-liveness-and-push/requirements.md
+++ b/.spec-workflow/specs/controller-liveness-and-push/requirements.md
@@ -2,7 +2,7 @@
 
 ## Introduction
 
-This spec gives the controller a durable step heartbeat (`lastActivity`), a true "stalled" fact (`driven`), a Re-drive action, a phone push through ntfy, and a launch-routing fix. It is for the one operator (ADR 0001), who today cannot tell a dead run from a slow one and learns of a wait only when the dashboard is open. It changes the run record, the wire run row, the drive's exception path, the existing wait pusher and the setup view.
+This spec gives the controller a durable step heartbeat (`lastActivity`), a true "stalled" fact (`driven`), a Re-drive action, a phone push through ntfy, and a launch-routing fix. It is for the one operator (ADR 0001), who today cannot tell a dead run from a slow one and learns of a wait only when the dashboard is open.
 
 ## Alignment with Product Vision
 
@@ -24,7 +24,7 @@ The steering directory holds no `product.md`, so this spec aligns with the ADRs
 6. A `lastActivity` write SHALL change no field but `lastActivity` (and `updated`). WHEN a status change is written while a throttled heartbeat write is pending THEN the status change SHALL survive the heartbeat write.
 7. WHEN a run reaches `done`, `abandoned` or `error` THEN `lastActivity` SHALL be absent.
 8. WHEN recovery on start (`src/controller/controller.ts:304-317`) finds a `running` run whose recorded step is dead THEN `lastActivity` SHALL be cleared before the run is re-driven. A step the controller re-attaches to (`src/controller/controller.ts:320-332`) keeps its last stored value until that step exits, because the restarted controller does not read its stream.
-9. The wire run row (`ControllerRunRow`, `src/controller/runs.ts:1410-1427`) SHALL carry `lastActivity` when the record has one.
+9. The wire run row SHALL carry `lastActivity` when the record has one, on all three hand-mirrored run-row shapes named in Requirement 2 AC 1.
 
 ### Requirement 2 — "stalled" is a controller fact
 
@@ -32,8 +32,8 @@ The steering directory holds no `product.md`, so this spec aligns with the ADRs
 
 #### Acceptance Criteria
 
-1. The wire run row SHALL carry `driven: boolean`: true while the controller holds the run in its `active` set or has a drive or a re-attach poll for it (`src/controller/controller.ts:75-78`, `:320-332`, `:417-434`), else false. The row is built in `src/controller/runs.ts:1429-1444` and read by the shell feed at `src/dashboard/shell/shell-feed.ts:115-120`.
-2. A run SHALL be stalled when its status is `running` and `driven` is false. The row SHALL carry `driven`; the dashboard derives stalled from the two fields.
+1. The wire run row SHALL carry `driven: boolean`: true while the lock-holding controller holds the run in its in-memory `active` set or has a drive or a re-attach poll for it (`src/controller/controller.ts:75-78`, `:320-332`, `:417-434`), else false. This truth lives only in controller memory: `toRow` and `listRunsForWire` (`src/controller/runs.ts:1429-1444`) are pure over the disk `RunRecord` and the shell feed (`src/dashboard/shell/shell-feed.ts:38-46`, `:115-120`) holds no controller handle, so the design SHALL hand the controller's live driven-set to the row build at both the GET route (`src/dashboard/multi-server.ts:809-811`) and the feed. `driven` SHALL NOT be persisted to `run.json`, because a stored flag goes stale when its controller dies and reintroduces the dead-run-reads-running bug this requirement exists to kill. A dashboard process that does not hold the controller lock has no drive state and SHALL report `driven: false`. `driven` here and `lastActivity` (Requirement 1) SHALL both be declared on all three hand-mirrored run-row shapes — `ControllerRunRow` (`src/controller/runs.ts:1410-1427`), `ControllerRun` (`src/dashboard/shell/types.ts:194-210`), `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:215-233`) — or the client cannot read them typed; the server copy already drifts (it lacks `pauseRequested`).
+2. Stalled, a derived fact, SHALL mean a run's status is `running` while `driven` is false. This spec ships `driven` on the wire row; deriving and rendering stalled in the dashboard is deferred to the later dashboard specs (D6), and the end-to-end check verifies the wire row (`driven: false` within 5 seconds, AC 5), not a rendered dashboard.
 3. WHEN a drive ends because `runOnce` threw (today only logged, `src/controller/controller.ts:427-429`) THEN the controller SHALL open an `error` wait whose question text is "step `stepKind` failed inside the controller: `message`" (the cursor's step kind and the error's message) with options `retry` and `abandon`, recommended `retry`, and SHALL set the run `waiting` with no `inFlight`. The wait SHALL carry a question id the controller recognises as a drive-crash wait (design names it).
 4. WHEN the drive-crash wait or the run write in AC 3 itself fails THEN the controller SHALL log the failure and leave the run as it is; the row SHALL then read stalled (status `running`, `driven` false).
 5. WHEN a drive ends, by return or by throw, THEN the controller SHALL emit a run change, so the shell feed re-sends the row and the row shows `driven: false` within 5 seconds.
@@ -62,7 +62,7 @@ The steering directory holds no `product.md`, so this spec aligns with the ADRs
 #### Acceptance Criteria
 
 1. The controller SHALL read `notify.json` in the controller home (`~/.local/state/sdd/notify.json` on this machine) with the shape `{ v: 1, ntfy: { url, topic, token? } }`. A missing, unreadable or malformed file SHALL mean no message is sent, and the controller SHALL log once per start that push is off.
-2. The existing wait pusher (`WaitPusher`, `src/advisor/push.ts:114-218`) SHALL be the one sender: it already runs only in the controller that holds the lock (`src/dashboard/multi-server.ts:402-410`), watches the `waits/` directory so a wait written by another process is seen, and records pushed ids so a restart does not resend (`src/advisor/push.ts:155-186`). `notify.json` SHALL replace `push.json` (`src/advisor/home.ts:39-41`) as its config; `push.json` SHALL no longer be read.
+2. The existing wait pusher (`WaitPusher`, `src/advisor/push.ts:114-218`) SHALL be the one sender: it already runs only in the controller that holds the lock (`src/dashboard/multi-server.ts:402-410`), watches the `waits/` directory so a wait written by another process is seen, and records pushed ids so a restart does not resend (`src/advisor/push.ts:155-186`). `notify.json` SHALL replace `push.json` (`src/advisor/home.ts:39-41`) as the config for both of its readers — the pusher and `pushState` in the advisor hello summary (`src/advisor/summary.ts:93-100`), which else reports push off while push is on — so `push.json` SHALL no longer be read anywhere.
 3. WHEN a wait with state `open` is written and its id is not yet recorded THEN the pusher SHALL POST one message to `url` + `/` + `topic`. The message SHALL hold the wait kind, the project name (from the durable project list, `src/controller/state.ts:504-506`, else the project id), the spec, and the first line of the first question's text, and nothing else: no answer, no advice, no path, no file content.
 4. IF `token` is present THEN the POST SHALL send it as an `Authorization: Bearer` credential; the design SHALL confirm this header against the ntfy documentation before it is pinned.
 5. WHEN the POST fails (a network error or a non-2xx answer) THEN the pusher SHALL retry once as today and then append one `push.failure` row to the home event log (`src/advisor/push.ts:188-204`). A failed or skipped push SHALL never block, delay or change the wait or the run. Invariant (verified, not red-first): the decoupling holds at base because the pusher runs off the file watch, not inside the wait write.
@@ -120,18 +120,24 @@ The steering directory holds no `product.md`, so this spec aligns with the ADRs
 - D7 — The heartbeat throttle writes the first activity at once and then at most one trailing write per 10-second window: options were leading and trailing, leading only, or a fixed 10-second interval timer; chosen because it keeps the stored value within 10 seconds of the last line with no idle writes.
 - D8 — The message names the project by its name from the durable project list, falling back to the id: options were the name or the hashed id the pusher sends today; chosen because a hash means nothing on a phone.
 - D9 — A config file readable by group or other is warned about and still used: options were warn and send, refuse to send, or ignore; chosen because the operator writes the file and a refusal would silently stop pushes.
-- D10 — Stalled is derived on the dashboard from the status and driven fields, and the route also accepts a run parked on an open drive-crash wait: options were derive from the two fields, or add a separate stalled field; chosen because the decomposition names driven as the exposed field and one fact on the wire cannot disagree with another.
+- D10 — Stalled is derived on the dashboard from the status and driven fields, and the route also accepts a run parked on an open drive-crash wait: options were derive from the two fields, or add a separate stalled field; chosen because the decomposition names driven as the exposed field and one fact on the wire cannot disagree with another; the field is sourced live from the controller and never persisted (Requirement 2 AC 1), so it cannot go stale after a crash.
 
 ## Scope notes
 
 - Cut: nothing from the decomposition entry.
-- Placement re-decided: the decomposition places the push in the run driver's wait helper and lists that helper under the waits module; the helper lives in `src/controller/runs.ts:566-575`, and gate and merge waits call `createWait` directly (`src/controller/phases/gates.ts:169`, `src/controller/merge.ts:732`). D1 puts the push in the pusher instead, so every wait is covered.
+- Placement re-decided: the decomposition places the push in the run driver's wait helper; the helper lives in `src/controller/runs.ts:566-575`, and gate and merge waits call `createWait` directly (`src/controller/phases/gates.ts:169`, `src/controller/merge.ts:732`). D1 puts the push in the pusher instead, so every wait is covered.
 - Earlier spec re-decided: D2 and D3 supersede the advisor spec's Requirement 10 AC 1 (no question text) and AC 4 (`push.json`). The design SHALL update `docs/controller-design.md` §16 and the advisor docs that describe `push.json`.
-- Left to design, per the entry: the ntfy title and priority, and the exact shape of the reminded-ids record.
+- Left to design, per the entry: the ntfy title and priority, the plain-text message body (the ntfy `<url>/<topic>` publish endpoint sends the request body as the notification text, so the fields compose into one plain-text body, not the JSON body the sender posts today at `src/advisor/push.ts:206-217`), and the exact shape of the reminded-ids record.
 - Known gap, not in scope: the watchdog writes its controller-down `error` wait while no controller runs (`scripts/sdd-watchdog.sh:184-199`), so that wait reaches the phone only when a controller starts again and its pusher scans. The entry keeps the watchdog unchanged.
 - Carried items from the decomposition: none.
 
 ## Revision History
 
+- **v2** (2026-11-03) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/1).
+  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 2 AC 1 no longer pins driven's build to the disk-only row function; it now names live controller memory as the only truth source, requires the design to hand that live set to the GET route and the feed, forbids persisting it to the run record (stale-after-crash), and makes a no-lock dashboard process report not-driven. D10 amended to match.
+  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 2 AC 1 now requires driven and lastActivity on all three hand-mirrored run-row shapes and cites the server copy's existing drift; Requirement 1 AC 9 points to that list. AC 2 now defines stalled as a derived fact, states rendering is deferred to later dashboard specs, and that the end-to-end check verifies the wire row, not a renderer.
+  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 4 AC 2 now migrates both readers of the old config — the pusher and the advisor hello summary's push-state probe — so the hello cannot report push off while push is on.
+  - **R1-4 — Accepted (MINOR).** The design-deferred list now names the plain-text message body and that the fields compose into it, not the JSON body the current sender posts.
+  - **Lint pass.** 1 fixed (L-6, SHALL added to Requirement 2 AC 2); rejected: L-1..L-5, L-7..L-23 — new fields/tokens the ACs introduce, cites anchor base code (rule 11, unchanged since v1).
 - **v1** (2026-11-03) — Initial draft.
   - **Lint pass.** 1 fixed; rejected: L-1..L-4 (`lastActivity` is the new field these ACs add; cites correctly locate the record and its writers at base, which lack it), L-6..L-11 (`stepKind`/`message`/`retry`/`abandon`/`waiting`/`inFlight` name the new drive-crash wait's content; cite anchors only "today only logged"), L-12 (`retry` is handled by `onWaitChange`'s non-`abandon` else branch at `:461-463`; cite anchors the invariant, literal token aside), L-13/L-14 (`pauseRequested` is the RunRecord field the loop-top stop reads via `isPauseRequested`; `paused` is the status the `pause()` call at `:856` sets), L-15..L-17 (`open` is a WaitState, `url`/`topic` are `notify.json` fields from AC 1; unrelated to the durable-project-list cite), L-18..L-20 (`nextUnstartedSpec`/`launchable`/`disabledReason` belong to run-setup.ts; cite anchors only the all-on-disk-complete reason), L-21 (`launchSpec` is the enclosing function at `:101`; cite anchors its create-before-enqueue body), L-22 (`ambiguous` is a RoutingState from AC 1; unrelated to the launchSpec cite).

````
