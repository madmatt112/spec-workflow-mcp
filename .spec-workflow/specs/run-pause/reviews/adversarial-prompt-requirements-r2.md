# Adversarial Review — run-pause/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): run-pause requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 116ac6e4

````diff
diff --git a/.spec-workflow/specs/run-pause/requirements.md b/.spec-workflow/specs/run-pause/requirements.md
index 16f83f0d..fd6708bd 100644
--- a/.spec-workflow/specs/run-pause/requirements.md
+++ b/.spec-workflow/specs/run-pause/requirements.md
@@ -27,7 +27,7 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 
 1. WHEN a client sends `POST /api/controller/runs/:id/pause` with the shared secret for a run in a live status THEN the server SHALL record the operator pause (applied or pending) and answer `200 { ok: true }`.
 2. WHEN the pause route is called THEN the server SHALL answer without waiting for an in-flight step to end and without sending a signal to any step process.
-3. IF no run has the id THEN the server SHALL answer `404 { error: 'run-not-found' }`, the same body as the cancel route (`src/dashboard/multi-server.ts:808-813`).
+3. IF no run has the id THEN the server SHALL answer `404 { error: 'run-not-found' }`, the same body as the cancel route (`src/dashboard/multi-server.ts:814`).
 4. IF the run's status is `done`, `abandoned` or `error` THEN the server SHALL answer `409 { error: 'not-pausable' }` and leave the record unchanged.
 5. IF the run already carries an operator pause, applied or pending, THEN the server SHALL answer `200 { ok: true }` and leave the record unchanged (the call is idempotent).
 6. WHEN a non-GET request to the pause route has no valid secret THEN the server SHALL answer `401`. Invariant (verified, not red-first): `makeRequireAccess` already rejects every non-GET under `/api/controller/` without the secret (`src/controller/access.ts:186-208`).
@@ -55,7 +55,7 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 
 1. WHEN the operator pauses a `queued` run THEN the controller SHALL make it `paused` with reason `operator` at once, and the scheduler SHALL not start it.
 2. WHEN the operator pauses a run that is `paused` for a usage reason THEN the controller SHALL replace the reason with `operator` and clear `resumeAt`, so that the window reset or the usage-limit timer no longer resumes it.
-3. WHEN the operator pauses a `merging` run between merge re-checks THEN the controller SHALL make it `paused` with reason `operator` at once, and SHALL run no merge re-check and no merge until Resume.
+3. WHEN the operator pauses a `merging` run between merge re-checks THEN the controller SHALL make it `paused` with reason `operator` at once, SHALL set the run's `merge` cursor so Resume re-enters the merge stage (Requirement 4 AC 2; today a `not-ready` merging run keeps a `stepKind: 'implementation'` cursor, `src/controller/runs.ts:926`), and SHALL run no merge re-check and no merge until Resume.
 4. WHEN the operator pauses a `waiting` run THEN the wait SHALL stay open and answerable as today, the pause SHALL be pending, and when the wait is answered the controller SHALL write the answer as today and then make the run `paused` with reason `operator` instead of `queued` (`src/controller/controller.ts:369-392`).
 5. IF that wait is an `error` or `escalation` wait answered `abandon` THEN the run SHALL be cancelled as today and the pending pause dropped.
 6. WHEN a usage window goes over the threshold and later recovers THEN a run paused with reason `operator` SHALL stay paused with reason `operator`. The window-blocked branch already touches only `queued` runs (invariant, verified, not red-first: `src/controller/controller.ts:306-313`); the recovery branch today starts any paused run with no `resumeAt` (`src/controller/controller.ts:333-339`), so the recovery half is red-first.
@@ -68,11 +68,11 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 #### Acceptance Criteria
 
 1. WHEN the operator calls `POST /api/controller/runs/:id/resume` on a run paused with reason `operator` THEN the controller SHALL clear the reason and the pause, and the scheduler SHALL start the run from its next step; the step that finished before the pause SHALL not run again.
-2. WHEN that run was paused from `merging`, or its last stage was the merge stage, THEN Resume SHALL re-enter the merge stage and SHALL not rerun the implementation phase.
+2. WHEN that run was paused from `merging`, or its last stage was the merge stage, THEN Resume SHALL re-enter the merge stage and SHALL not rerun the implementation phase. The paused write clears `status: 'merging'`, so the durable re-entry marker is the `merge` cursor (set when a `merging` run is paused, Requirement 3 AC 3) that `runOnce`'s merge-resume check reads (`src/controller/runs.ts:770-781`), the same marker the merge `blocked` path sets for a window resume (`src/controller/runs.ts:679-691`).
 3. IF a usage window is over the threshold when the operator resumes an operator-paused run THEN the run SHALL be parked with reason `usage-window` by the existing window check and resume on its own at the reset; Resume SHALL not reset `rate-limit.json` for an operator pause.
 4. WHEN the operator calls the resume route on a run whose operator pause is still pending (a `running` run with a step in flight, or a `waiting` run) THEN the controller SHALL withdraw the pending pause, answer `200 { ok: true }`, and the run SHALL carry on as if it had never been paused.
 5. WHEN the operator calls the resume route on a run paused for a usage reason THEN the behaviour of `resumeNow` SHALL be unchanged (`src/controller/controller.ts:207-224`). Regression guard (verified, not red-first).
-6. IF the run is neither paused nor carrying a pending pause THEN the resume route SHALL answer `409 { error: 'not-paused' }` as today (`src/dashboard/multi-server.ts:816-822`). Regression guard.
+6. IF the run is neither paused nor carrying a pending pause THEN the resume route SHALL answer `409 { error: 'not-paused' }` as today (`src/dashboard/multi-server.ts:823`). Regression guard.
 
 ### Requirement 5 — The pause survives a controller restart
 
@@ -93,7 +93,7 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 #### Acceptance Criteria
 
 1. WHEN a controller run row (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233`) or the run panel (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:235-324`) shows a run in a live status with no operator pause, applied or pending, THEN it SHALL show a **Pause** button that calls the pause route.
-2. WHEN the operator clicks Pause on a row THEN the click SHALL not also select the row or open the panel, and the button SHALL show a busy state until the route answers; a failed call SHALL show the error as the panel's other actions do.
+2. WHEN the operator clicks Pause on a row THEN the click SHALL not also select the row or open the panel, and the button SHALL show a busy state until the route answers. A failed call SHALL surface its error to the operator; because the run row is a stateless presentational component with no error surface today (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233`), unlike the panel's error line (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:321`), where a failed row Pause shows its error is left to design, which SHALL not open the panel.
 3. WHILE an operator pause is pending THEN the row and the panel SHALL show the note "pause requested", and the panel SHALL show **Resume** (which withdraws the request, Requirement 4 AC 4) instead of Pause.
 4. WHILE a run is paused with reason `operator` THEN the row, the panel and the Now page note (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:351-352`) SHALL read "paused by you" followed by the pause age from `pausedAt`, with no "resumes in" or "overdue" part, and the panel SHALL show **Resume** and not **Resume now**.
 5. WHILE a run is paused for a usage reason THEN the note and the **Resume now** button SHALL stay as today (`src/dashboard_frontend/src/modules/shell/pause.ts:27-44`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:296-306`). Regression guard (verified, not red-first).
@@ -143,11 +143,17 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 
 - Carried items from the decomposition: none.
 - Deferred to design, as the decomposition entry asks: whether `scripts/sdd-self-update.sh` should pause every live run itself, wait for their steps to end, deploy and resume them, instead of polling for a gap. This document requires only that the operator-driven flow in Requirement 7 works; the script needs no change for it (Requirement 7 AC 2 is an invariant).
+- Deferred to design: where a failed row Pause shows its error, since the run row holds no error state today (Requirement 6 AC 2). The behaviour (an error surfaced without opening the panel) is fixed here; only the render location is open.
 - Decided here rather than deferred: what waits that open while a pause is pending look like (D2, Requirement 2 AC 4, Requirement 3 AC 4) and whether Pause applies to a queued run (D1). Design may refine the display but not the behaviour.
 - Out of scope: the advisor's second-opinion step on an open wait (`src/advisor/opinion.ts:154`) is not a run step and is not tracked in `run.inFlight`; an operator pause does not stop it.
 - Out of scope: a pause timer or scheduled resume, pausing every run with one click, and any change to cancel or discard.
 
 ## Revision History
 
+- **v2** (2026-10-29) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/1/1).
+  - **R1-1 — Accepted (MUST_FIX).** Both response-body anchors sat one line short of the artifact; Requirement 1 AC 3 now anchors the run-not-found body on the cancel route's body line, and Requirement 4 AC 6 anchors the not-paused body on the resume route's body line.
+  - **R1-2 — Accepted (SHOULD_FIX).** The paused write clears the merging status, the only signal Resume keyed on. Requirement 3 AC 3 now sets the merge cursor when a merging run is paused, and Requirement 4 AC 2 names that cursor as the durable re-entry marker the merge-resume check reads, the same marker the blocked path already sets. Seam fixed at both the pause and resume ends.
+  - **R1-3 — Accepted (MINOR).** The run row is a stateless component with no error surface, so "as the panel does" had no target. Requirement 6 AC 2 now states a failed row Pause must surface its error without opening the panel and defers the render location to design; a matching deferral is noted in Scope notes.
+  - **Lint pass.** 2 fixed; rejected L-1–L-8, L-11–L-14. Fixed: L-9/L-10 widened the two merge-resume cites to `src/controller/runs.ts:770-781` and `src/controller/runs.ts:679-691`, so each now contains the named `runOnce`/`case 'blocked'`. Rejected: each cite anchors existing code the invariant describes (the current `stepKind: 'implementation'` cursor, the queued-move, the window/recover/cancel branches, the pauseNote render site, the untracked advisor step); the flagged word is the new reason/status/field, so its absence is the point.
 - **v1** (2026-10-29) — Initial draft.
   - **Lint pass.** 2 fixed; rejected: L-3/L-4 `paused`/`operator` are the new status/reason this AC sets, the citation anchors the current `queued` branch (`src/controller/controller.ts:390`) it replaces; L-5/L-6/L-7 `operator` is the new reason, the citations anchor the existing window/startable/recover behaviour the invariants describe; L-8/L-9 the citation anchors the Now-page `pauseNote` render site, not `operator`/`pausedAt` (a record field); L-10 the text states the advisor step is not tracked in `inFlight`, so its absence from the cited call is the point.

````
