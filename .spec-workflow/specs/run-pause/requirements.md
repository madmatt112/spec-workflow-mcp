# Requirements Document

## Introduction

The operator can pause a controller run from the dashboard: the step in flight finishes, no next step starts, and the run stays paused until the operator presses Resume. This is for the operator who needs a gap between steps, for example to deploy the controller with `scripts/sdd-self-update.sh` while a long run is live. It adds a Pause button, a pause route, an operator pause reason on the run record, and a Resume path for that reason; it does not change cancel or the usage-window pause.

## Alignment with Product Vision

The steering directory holds no `product.md`, so this document aligns with `docs/controller-design.md` instead. That design makes the controller the only driver of runs and the dashboard the operator's only control surface (`docs/controller-design.md:8-17`). Today the only way to get a gap between steps is to fake a full usage window in `rate-limit.json`; this feature gives the operator a real control with the same step-boundary semantics as the window pause (`docs/controller-design.md:176-195`).

## Terms

- **Step**: one model step process that the controller spawns through `runStep` (`src/controller/step.ts:350`). Code work around a step (ledger rows, checkpoint commits, the lint step, approval writes, creating a wait) is not a step.
- **Step boundary**: the point after one step's result has been acted on and before the run spawns its next step.
- **Operator pause**: a pause the operator asked for. Its reason on the run record is `operator`.
- **Usage pause**: a pause whose reason is `usage-window` or `usage-limit`, as written by `pause` (`src/controller/runs.ts:540-542`).
- **Pending pause**: an operator pause the controller has accepted but not yet applied, because a step is in flight or a wait is open.
- **Live status**: `queued`, `running`, `paused`, `waiting` or `merging` (`src/controller/controller.ts:532-536`).

## Requirements

### Requirement 1 — The pause route

**User Story:** As the operator, I want a pause route beside cancel, resume and discard, so that the dashboard and a script can pause a run the same way.

#### Acceptance Criteria

1. WHEN a client sends `POST /api/controller/runs/:id/pause` with the shared secret for a run in a live status THEN the server SHALL record the operator pause (applied or pending) and answer `200 { ok: true }`.
2. WHEN the pause route is called THEN the server SHALL answer without waiting for an in-flight step to end and without sending a signal to any step process.
3. IF no run has the id THEN the server SHALL answer `404 { error: 'run-not-found' }`, the same body as the cancel route (`src/dashboard/multi-server.ts:814`).
4. IF the run's status is `done`, `abandoned` or `error` THEN the server SHALL answer `409 { error: 'not-pausable' }` and leave the record unchanged.
5. IF the run already carries an operator pause, applied or pending, THEN the server SHALL answer `200 { ok: true }` and leave the record unchanged (the call is idempotent).
6. WHEN a non-GET request to the pause route has no valid secret THEN the server SHALL answer `401`. Invariant (verified, not red-first): `makeRequireAccess` already rejects every non-GET under `/api/controller/` without the secret (`src/controller/access.ts:186-208`).
7. WHEN the pause is recorded THEN the run's wire row SHALL change at once over the runs topic, through the same `runEvents` change event the other run writes emit.

### Requirement 2 — A running run pauses at the next step boundary

**User Story:** As the operator, I want Pause to let the current step finish and start nothing after it, so that I never lose a step's work.

#### Acceptance Criteria

1. WHEN the operator pauses a `running` run with a step in flight THEN the controller SHALL let that step run to its normal end, SHALL act on its result as it does today (ledger rows, checkpoint commit, the lint step, an approval or a wait), and SHALL not signal or kill the step.
2. WHEN that run reaches its next step boundary with the pause still pending THEN the controller SHALL write `status: 'paused'`, `pauseReason: 'operator'`, no `resumeAt`, and no `inFlight`, and SHALL spawn no further step.
3. The step boundary in AC 2 SHALL hold in every phase that spawns steps: the document phase (between the drafter, lint-fix reviser, reviewer, reviser and narrow-check steps, and before the fresh retry in `handleDocumentOutcome`, `src/controller/runs.ts:1209-1262`), the implementation phase, the merge-fix round, the retrospective and the close-out. Today the document phase has no stop check at all (`src/controller/phases/document.ts:159-198`), and the other phases check only cancel and the usage window (`src/controller/runs.ts:933`, `src/controller/runs.ts:964`, `src/controller/runs.ts:982`).
4. WHEN the step that finishes under a pending pause opens a wait (for example gate A after the drafter, `src/controller/phases/document.ts:790-796`) THEN the run SHALL become `waiting` as today and the pause SHALL stay pending under Requirement 3 AC 4.
5. WHEN the step that finishes under a pending pause ends the run (`done`) or the operator cancels the run THEN the pending pause SHALL be dropped and the run SHALL end as it does today.
6. WHEN the step that finishes under a pending pause fails with a usage limit THEN the run SHALL take the operator pause, not a usage pause, so that only Resume ends it.
7. IF a driver write that spreads an older copy of the run record lands after the pause was recorded THEN the pending pause SHALL survive it. Today `save` writes the driver's in-memory copy over the file (`src/controller/runs.ts:532-537`), so a pause recorded by the route between two driver writes can be lost unless the design guards it.

### Requirement 3 — Pause on a run with no step in flight

**User Story:** As the operator, I want Pause to work on any live run, so that I can stop the whole queue before a deploy without checking each run's state first.

#### Acceptance Criteria

1. WHEN the operator pauses a `queued` run THEN the controller SHALL make it `paused` with reason `operator` at once, and the scheduler SHALL not start it.
2. WHEN the operator pauses a run that is `paused` for a usage reason THEN the controller SHALL replace the reason with `operator` and clear `resumeAt`, so that the window reset or the usage-limit timer no longer resumes it.
3. WHEN the operator pauses a `merging` run between merge re-checks THEN the controller SHALL make it `paused` with reason `operator` and no `resumeAt` at once (so the 30 s merge poll's `resumeAt` cannot self-resume it, matching AC 2), SHALL set the run's `merge` cursor so Resume re-enters the merge stage (Requirement 4 AC 2; today a `not-ready` merging run keeps a `stepKind: 'implementation'` cursor, `src/controller/runs.ts:926`), and SHALL run no merge re-check and no merge until Resume.
4. WHEN the operator pauses a `waiting` run THEN the wait SHALL stay open and answerable as today, the pause SHALL be pending, and when the wait is answered the controller SHALL write the answer as today and then make the run `paused` with reason `operator` instead of `queued` (`src/controller/controller.ts:369-392`).
5. IF that wait is an `error` or `escalation` wait answered `abandon` THEN the run SHALL be cancelled as today and the pending pause dropped.
6. WHEN a usage window goes over the threshold and later recovers THEN a run paused with reason `operator` SHALL stay paused with reason `operator`. The window-blocked branch already touches only `queued` runs (invariant, verified, not red-first: `src/controller/controller.ts:306-313`); the recovery branch today starts any paused run with no `resumeAt` (`src/controller/controller.ts:333-339`), so the recovery half is red-first.
7. WHEN the operator cancels or discards a run paused with reason `operator` THEN the run SHALL be abandoned (and, for discard, cleaned up) as today. Invariant (verified, not red-first): `cancelRun` and `discardRun` act on any status (`src/controller/runs.ts:1282-1330`).

### Requirement 4 — Resume

**User Story:** As the operator, I want Resume to start a run I paused from its next step, so that the run carries on as if it had never stopped.

#### Acceptance Criteria

1. WHEN the operator calls `POST /api/controller/runs/:id/resume` on a run paused with reason `operator` THEN the controller SHALL clear the reason and the pause, and the scheduler SHALL start the run from its next step; the step that finished before the pause SHALL not run again.
2. WHEN that run was paused from `merging`, or its last stage was the merge stage, THEN Resume SHALL re-enter the merge stage and SHALL not rerun the implementation phase. The paused write clears `status: 'merging'`, so the durable re-entry marker is the `merge` cursor (set when a `merging` run is paused, Requirement 3 AC 3) that `runOnce`'s merge-resume check reads (`src/controller/runs.ts:770-781`), the same marker the merge `blocked` path sets for a window resume (`src/controller/runs.ts:679-691`).
3. IF a usage window is over the threshold when the operator resumes an operator-paused run THEN the run SHALL be parked with reason `usage-window` by the existing window check and resume on its own at the reset; Resume SHALL not reset `rate-limit.json` for an operator pause.
4. WHEN the operator calls the resume route on a run whose operator pause is still pending (a `running` run with a step in flight, or a `waiting` run) THEN the controller SHALL withdraw the pending pause, answer `200 { ok: true }`, and the run SHALL carry on as if it had never been paused.
5. WHEN the operator calls the resume route on a run paused for a usage reason THEN the behaviour of `resumeNow` SHALL be unchanged (`src/controller/controller.ts:207-224`). Regression guard (verified, not red-first).
6. IF the run is neither paused nor carrying a pending pause THEN the resume route SHALL answer `409 { error: 'not-paused' }` as today (`src/dashboard/multi-server.ts:823`). Regression guard.

### Requirement 5 — The pause survives a controller restart

**User Story:** As the operator, I want a paused run to stay paused when the controller restarts, so that a deploy does not wake it.

#### Acceptance Criteria

1. The operator pause and a pending pause SHALL be stored in the run record on disk (`src/controller/state.ts:67-101`), not only in controller memory; the in-memory sets in `src/controller/controller.ts:75-81` are lost on restart.
2. WHEN the controller starts and finds a run paused with reason `operator` THEN it SHALL leave the run paused: crash recovery and the scheduler SHALL not start it, and SHALL not clear its reason (`src/controller/controller.ts:261-274`, `src/controller/controller.ts:316-327`).
3. WHEN the controller starts and finds a `running` run with a pending pause whose step process is alive THEN it SHALL re-attach as today and, when the step ends, SHALL apply the pause at the boundary instead of starting the next step.
4. WHEN the controller starts and finds a `running` run with a pending pause whose step process is gone THEN it SHALL make the run `paused` with reason `operator` without spawning a step.
5. WHEN the controller starts and finds a `waiting` run with a pending pause whose wait was answered while the controller was down THEN it SHALL make the run `paused` with reason `operator` instead of `queued`.

### Requirement 6 — The Runs page row and the run panel

**User Story:** As the operator, I want Pause and Resume buttons on the run row and the run panel, and a row that says which kind of pause it is, so that I can act and check without opening logs.

#### Acceptance Criteria

1. WHEN a controller run row (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233`) or the run panel (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:235-324`) shows a run in a live status with no operator pause, applied or pending, THEN it SHALL show a **Pause** button that calls the pause route.
2. WHEN the operator clicks Pause on a row THEN the click SHALL not also select the row or open the panel, and the button SHALL show a busy state until the route answers. A failed call SHALL surface its error to the operator; because the run row is a stateless presentational component with no error surface today (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233`), unlike the panel's error line (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:321`), where a failed row Pause shows its error is left to design, which SHALL not open the panel.
3. WHILE an operator pause is pending THEN the row and the panel SHALL show the note "pause requested", and the panel SHALL show **Resume** (which withdraws the request, Requirement 4 AC 4) instead of Pause.
4. WHILE a run is paused with reason `operator` THEN the row, the panel and the Now page note (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:351-352`) SHALL read "paused by you" followed by the pause age from `pausedAt`, with no "resumes in" or "overdue" part, and the panel SHALL show **Resume** and not **Resume now**.
5. WHILE a run is paused for a usage reason THEN the note and the **Resume now** button SHALL stay as today (`src/dashboard_frontend/src/modules/shell/pause.ts:27-44`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:296-306`). Regression guard (verified, not red-first).
6. The pause age SHALL count from the moment the run became paused, not from the click. Invariant (verified, not red-first): `writeRun` stamps `pausedAt` on the write that makes a run `paused` (`src/controller/state.ts:388-394`).
7. The wire row (`src/controller/runs.ts:1336-1363`) and the frontend `ControllerRun` type (`src/dashboard_frontend/src/modules/shell/types.ts:215-231`) SHALL carry whatever the frontend needs to tell a pending pause from an applied one, and SHALL carry no filesystem path.

### Requirement 7 — The deploy scenario end to end

**User Story:** As the operator, I want to pause a live run, deploy and restart the controller, then resume, so that a deploy never waits hours for a natural gap.

#### Acceptance Criteria

1. WHEN the operator pauses a run with a step in flight THEN the pause route SHALL answer at once, the step SHALL finish and commit as normal, no next step SHALL start, and the row SHALL show "paused by you".
2. WHEN that run is paused and no other step is in flight THEN `scripts/sdd-self-update.sh` SHALL pass its in-flight check, deploy and restart the controller. Invariant (verified, not red-first): `step_live` reads only live `inFlight` processes (`scripts/sdd-self-update.sh:89-97`), and an applied pause clears `inFlight`.
3. WHEN the controller has restarted THEN the run SHALL still be paused with reason `operator` (Requirement 5 AC 2).
4. WHEN the operator presses Resume THEN the run SHALL start its next step (Requirement 4 AC 1).
5. WHEN the operator pauses a run with no step in flight THEN the pause SHALL take effect at once (Requirement 3).

## Non-Functional Requirements

### Performance
- The pause route SHALL answer after one run-record write; it SHALL not wait on a step, a process signal or a `gh` call.

### Security
- The pause route SHALL sit under `/api/controller/` behind the same shared secret as cancel, resume and discard; no new exemption.
- The wire row SHALL stay path-free (`src/controller/runs.ts:1333-1334`).

### Reliability
- Every pause state SHALL be written with the existing atomic `writeRun`; a crash between the route's write and the next driver write SHALL leave either the old record or the paused one, never a half-written file.
- No new timer: an operator pause has no `resumeAt` and SHALL never end by itself.

## Decisions taken in this document

- D1 — Pause applies to a queued run that has not started: options were apply it (paused at once, never started until Resume), refuse it with a 409, leave a queued run to start and pause later; chosen apply because an operator preparing a deploy wants the whole queue held, and a queued run has no step to finish.
- D2 — Pause on a waiting run keeps the wait open and parks the run when the wait is answered: options were keep the wait answerable and park on the answer, refuse the pause while a wait is open, close or expire the wait; chosen keep-and-park because the operator can still answer the gate during the deploy and the answer is never lost.
- D3 — Pause on a run paused for a usage reason replaces the reason with operator and drops the resume time: options were replace the reason, refuse with a 409, keep the usage reason and ignore the pause; chosen replace because otherwise a window reset during the deploy would wake the run the operator meant to hold.
- D4 — Resume while a pause is still pending withdraws the request: options were withdraw it, answer 409 not-paused until the run parks, make the operator wait and then resume; chosen withdraw because a mistaken click should be undoable at once without a second wait.
- D5 — Resume reuses the existing resume route and branches on the pause reason: options were reuse the route, add a separate operator-resume route; chosen reuse because the decomposition adds only the pause route and the reason already tells the two cases apart.
- D6 — The record's reason value is the word operator and the row reads "paused by you": options were the word operator, the word manual, showing the raw reason as today; chosen because the row must say which kind of pause it is in the operator's words while the record keeps a short machine value.
- D7 — A step is a model step process; code work after a finished step (ledger rows, the checkpoint commit, the lint step, approvals, opening a wait) still runs before the run parks: options were park before that code work, park after it; chosen after because the decomposition requires the step to finish and commit as normal and gate waits must still open.
- D8 — A usage-limit failure of the last step under a pending pause becomes an operator pause: options were operator pause, usage pause with a timer; chosen operator because only Resume may end an operator pause.
- D9 — A merging run pauses at once and Resume re-enters the merge stage: options were pause at once, refuse while merging, let the merge finish first; chosen pause at once because an auto-merge can trigger the self-update the operator is trying to control.
- D10 — Pause on a terminal run is a 409 and a repeated pause is a no-op 200: options were 409 and idempotent 200, 409 for both; chosen because a script that pauses every run before a deploy should not fail on a run it already paused.
- D11 — Money, personal-data-and-erasure and legal posture: options were not applicable, a posture review before design; chosen not applicable because the spec touches no money, billing, deletion of personal data or legal surface.

## Scope notes

- Carried items from the decomposition: none.
- Deferred to design, as the decomposition entry asks: whether `scripts/sdd-self-update.sh` should pause every live run itself, wait for their steps to end, deploy and resume them, instead of polling for a gap. This document requires only that the operator-driven flow in Requirement 7 works; the script needs no change for it (Requirement 7 AC 2 is an invariant).
- Deferred to design: where a failed row Pause shows its error, since the run row holds no error state today (Requirement 6 AC 2). The behaviour (an error surfaced without opening the panel) is fixed here; only the render location is open.
- Decided here rather than deferred: what waits that open while a pause is pending look like (D2, Requirement 2 AC 4, Requirement 3 AC 4) and whether Pause applies to a queued run (D1). Design may refine the display but not the behaviour.
- Out of scope: the advisor's second-opinion step on an open wait (`src/advisor/opinion.ts:154`) is not a run step and is not tracked in `run.inFlight`; an operator pause does not stop it.
- Out of scope: a pause timer or scheduled resume, pausing every run with one click, and any change to cancel or discard.

## Revision History

- **v3** (2026-10-29) — SHOULD_FIX-only corrective pass.
  - **R2-1 — Accepted (SHOULD_FIX).** A merging run always carries a 30 s `resumeAt`, and a non-usage paused run is startable once `resumeAt` passes, so the pause could self-resume mid-deploy. Requirement 3 AC 3 now makes the paused-from-merging write clear `resumeAt`, matching Requirement 3 AC 2 and Requirement 2 AC 2; it is the only paused-write AC that had omitted the field.
  - **Lint pass.** 0 fixed; rejected: L-1–L-5 the flagged words (`merging`/`paused`/`operator`/`resumeAt`/`merge`) are the new behaviour this AC sets, the cite `src/controller/runs.ts:926` anchors today's `stepKind: 'implementation'` cursor it replaces; L-6/L-7 `paused`/`operator` are the new status/reason, the cite anchors `onWaitChange`'s current `queued` move; L-8 `operator` is new, the cites anchor the existing window-blocked and startable branches; L-9 `operator` new, the cite anchors `cancelRun`/`discardRun` acting on any status; L-10 `operator` new, the cites anchor `recover` and the startable reason-clear; L-11/L-12 the cite anchors the Now-page `pauseNote` render site, not `operator`/`pausedAt`; L-13 the text states the advisor step is not tracked in `inFlight`, so its absence from the cited call is the point.
- **v2** (2026-10-29) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/1/1).
  - **R1-1 — Accepted (MUST_FIX).** Both response-body anchors sat one line short of the artifact; Requirement 1 AC 3 now anchors the run-not-found body on the cancel route's body line, and Requirement 4 AC 6 anchors the not-paused body on the resume route's body line.
  - **R1-2 — Accepted (SHOULD_FIX).** The paused write clears the merging status, the only signal Resume keyed on. Requirement 3 AC 3 now sets the merge cursor when a merging run is paused, and Requirement 4 AC 2 names that cursor as the durable re-entry marker the merge-resume check reads, the same marker the blocked path already sets. Seam fixed at both the pause and resume ends.
  - **R1-3 — Accepted (MINOR).** The run row is a stateless component with no error surface, so "as the panel does" had no target. Requirement 6 AC 2 now states a failed row Pause must surface its error without opening the panel and defers the render location to design; a matching deferral is noted in Scope notes.
  - **Lint pass.** 2 fixed; rejected L-1–L-8, L-11–L-14. Fixed: L-9/L-10 widened the two merge-resume cites to `src/controller/runs.ts:770-781` and `src/controller/runs.ts:679-691`, so each now contains the named `runOnce`/`case 'blocked'`. Rejected: each cite anchors existing code the invariant describes (the current `stepKind: 'implementation'` cursor, the queued-move, the window/recover/cancel branches, the pauseNote render site, the untracked advisor step); the flagged word is the new reason/status/field, so its absence is the point.
- **v1** (2026-10-29) — Initial draft.
  - **Lint pass.** 2 fixed; rejected: L-3/L-4 `paused`/`operator` are the new status/reason this AC sets, the citation anchors the current `queued` branch (`src/controller/controller.ts:390`) it replaces; L-5/L-6/L-7 `operator` is the new reason, the citations anchor the existing window/startable/recover behaviour the invariants describe; L-8/L-9 the citation anchors the Now-page `pauseNote` render site, not `operator`/`pausedAt` (a record field); L-10 the text states the advisor step is not tracked in `inFlight`, so its absence from the cited call is the point.
