# Requirements Document

## Introduction

This spec gives the controller a durable step heartbeat (`lastActivity`), a true "stalled" fact (`driven`), a Re-drive action, a phone push through ntfy, and a launch-routing fix. It is for the one operator (ADR 0001), who today cannot tell a dead run from a slow one and learns of a wait only when the dashboard is open. It changes the run record, the wire run row, the drive's exception path, the existing wait pusher and the setup view.

## Alignment with Product Vision

The steering directory holds no `product.md`, so this spec aligns with the ADRs in `docs/adr/`. ADR 0004 makes the controller the always-on process that holds and resumes runs, so a run the controller silently stopped driving breaks its main promise; this spec makes that state visible and recoverable. ADR 0002 makes waits the only channel from a run to the operator, so a crash becomes a wait and a wait reaches the phone with no session or tab open.

## Requirements

### Requirement 1 — a durable step heartbeat

**User Story:** As the operator, I want each run record to say when its step last wrote to its stream, so that I can tell a working step from a hung one.

#### Acceptance Criteria

1. `RunRecord` (`src/controller/state.ts:69-109`) SHALL gain an optional ISO field `lastActivity`.
2. WHEN a step's stdout yields a line that `handleLine` (`src/controller/step.ts:437-449`) parses as a JSON object, of any event type (not only the `tool_use` blocks that fire `onActivity` at `src/controller/step.ts:410-426`), THEN the controller SHALL treat it as activity for that step's run.
3. The controller SHALL write `lastActivity` for one run at most once per 10 seconds. The first activity of a step SHALL be written at once; activity inside a 10-second window SHALL be written once at the window's end, so while a step streams the stored value is never more than 10 seconds behind its last line.
4. WHEN a step ends (its process closes or fails to spawn) THEN the controller SHALL cancel any pending `lastActivity` write for that run and clear the field; no `lastActivity` write SHALL land after the step's exit event. The field SHALL be absent from `run.json` within 1 second of the step's end.
5. Every other writer of `run.json` (`patchRun` at `src/controller/runs.ts:427-433`, `save` at `src/controller/runs.ts:542-547` and `src/controller/controller.ts:599-606`, `cancelRun` at `src/controller/runs.ts:1356-1376`) SHALL carry `lastActivity` over from disk, the way `writeRunLocked` (`src/controller/state.ts:417-433`) carries `pauseRequested`. Only the heartbeat writer and the step-end clear SHALL set it.
6. A `lastActivity` write SHALL change no field but `lastActivity` (and `updated`). WHEN a status change is written while a throttled heartbeat write is pending THEN the status change SHALL survive the heartbeat write.
7. WHEN a run reaches `done`, `abandoned` or `error` THEN `lastActivity` SHALL be absent.
8. WHEN recovery on start (`src/controller/controller.ts:304-317`) finds a `running` run whose recorded step is dead THEN `lastActivity` SHALL be cleared before the run is re-driven. A step the controller re-attaches to (`src/controller/controller.ts:320-332`) keeps its last stored value until that step exits, because the restarted controller does not read its stream.
9. The wire run row SHALL carry `lastActivity` when the record has one, on all three hand-mirrored run-row shapes named in Requirement 2 AC 1.

### Requirement 2 — "stalled" is a controller fact

**User Story:** As the operator, I want the run row to say whether the controller is driving the run, and a crashed drive to open a wait, so that a dead run never reads as "running".

#### Acceptance Criteria

1. The wire run row SHALL carry `driven: boolean`: true while the lock-holding controller holds the run in its in-memory `active` set or has a drive or a re-attach poll for it (`src/controller/controller.ts:75-78`, `:320-332`, `:417-434`), else false. This truth lives only in controller memory: `toRow` and `listRunsForWire` (`src/controller/runs.ts:1429-1444`) are pure over the disk `RunRecord` and the shell feed (`src/dashboard/shell/shell-feed.ts:38-46`, `:115-120`) holds no controller handle, so the design SHALL hand the controller's live driven-set to the row build at both the GET route (`src/dashboard/multi-server.ts:809-811`) and the feed. `driven` SHALL NOT be persisted to `run.json`, because a stored flag goes stale when its controller dies and reintroduces the dead-run-reads-running bug this requirement exists to kill. A dashboard process that does not hold the controller lock has no drive state and SHALL report `driven: false`. `driven` here and `lastActivity` (Requirement 1) SHALL both be declared on all three hand-mirrored run-row shapes — `ControllerRunRow` (`src/controller/runs.ts:1410-1427`), `ControllerRun` (`src/dashboard/shell/types.ts:194-210`), `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:215-233`) — or the client cannot read them typed; the server copy already drifts (it lacks `pauseRequested`).
2. Stalled is the derived fact that a run's status is `running` while `driven` is false. This spec ships `driven` on the wire row; deriving and rendering stalled in the dashboard is deferred to the later dashboard specs (D6), and the end-to-end check verifies the wire row (`driven: false` within 5 seconds, AC 5), not a rendered dashboard.
3. WHEN a drive ends because `runOnce` threw (today only logged, `src/controller/controller.ts:427-429`) THEN the controller SHALL open an `error` wait whose question text is "step `stepKind` failed inside the controller: `message`" (the cursor's step kind and the error's message) with options `retry` and `abandon`, recommended `retry`, and SHALL set the run `waiting` with no `inFlight`. The wait SHALL carry a question id the controller recognises as a drive-crash wait (design names it).
4. WHEN the drive-crash wait or the run write in AC 3 itself fails THEN the controller SHALL log the failure and leave the run as it is; the row SHALL then read stalled (status `running`, `driven` false).
5. WHEN a drive ends, by return or by throw, THEN the controller SHALL emit a run change, so the shell feed re-sends the row and the row shows `driven: false` within 5 seconds.
6. WHEN the drive-crash wait is answered `retry` THEN the run SHALL be re-queued and re-driven from its cursor, and WHEN it is answered `abandon` THEN the run SHALL be cancelled. Both hold at base for every `error` wait through `onWaitChange` (`src/controller/controller.ts:438-466`): invariant (verified, not red-first) for the answer handling; only the wait's creation is new.
7. WHEN a step process is killed by hand THEN the controller SHALL classify and retry it as today (`runStep` resolves a classified result on `close`, `src/controller/step.ts:463-499`, `:527`) and the row SHALL never read stalled during the retry. Invariant (verified, not red-first): this holds at base and is a regression guard.

### Requirement 3 — Re-drive

**User Story:** As the operator, I want one action that starts driving a stalled run again, so that I do not need to restart the controller to recover it.

#### Acceptance Criteria

1. `POST /api/controller/runs/:id/redrive` SHALL be added beside the run routes (`src/dashboard/multi-server.ts:809-857`), under the same security hooks as they are.
2. IF the run does not exist THEN the route SHALL answer 404 `run-not-found`.
3. IF the run is stalled (Requirement 2 AC 2) THEN the controller SHALL start a drive from the run's cursor and the route SHALL answer 200 `{ ok: true }`.
4. IF the run is not driven and is `waiting` on an open drive-crash wait (Requirement 2 AC 3) THEN the route SHALL answer that wait `retry` (by `operator`), which re-drives the run through the existing answer path, and SHALL answer 200.
5. IF neither AC 3 nor AC 4 applies (the run is driven, or in any other status) THEN the route SHALL answer 409 `not-stalled` and change nothing.
6. WHEN the controller starts THEN it SHALL re-drive every `running` run as today (`src/controller/controller.ts:304-311`). Invariant (verified, not red-first) for `running` runs.
7. WHEN the controller starts and finds a run `waiting` on an open drive-crash wait THEN it SHALL set that wait `expired` and re-drive the run from its cursor, with no operator action.
8. A Re-drive of a run whose operator hold is pending (`pauseRequested`) SHALL go through the driver's loop-top stop (`src/controller/runs.ts:850-858`), so the run parks `paused` instead of starting a step.

### Requirement 4 — push to the phone through ntfy

**User Story:** As the operator, I want my phone to get one message when a run waits on me, so that I answer without keeping the dashboard open.

#### Acceptance Criteria

1. The controller SHALL read `notify.json` in the controller home (`~/.local/state/sdd/notify.json` on this machine) with the shape `{ v: 1, ntfy: { url, topic, token? } }`. A missing, unreadable or malformed file SHALL mean no message is sent, and the controller SHALL log once per start that push is off.
2. The existing wait pusher (`WaitPusher`, `src/advisor/push.ts:114-218`) SHALL be the one sender: it already runs only in the controller that holds the lock (`src/dashboard/multi-server.ts:402-410`), watches the `waits/` directory so a wait written by another process is seen, and records pushed ids so a restart does not resend (`src/advisor/push.ts:155-186`). `notify.json` SHALL replace `push.json` (`src/advisor/home.ts:39-41`) as the config for both of its readers — the pusher and `pushState` in the advisor hello summary (`src/advisor/summary.ts:93-100`), which else reports push off while push is on — so `push.json` SHALL no longer be read anywhere.
3. WHEN a wait with state `open` is written and its id is not yet recorded THEN the pusher SHALL POST one message to `url` + `/` + `topic`. The message SHALL hold the wait kind, the project name (from the durable project list, `src/controller/state.ts:504-506`, else the project id), the spec, and the first line of the first question's text, and nothing else: no answer, no advice, no path, no file content.
4. IF `token` is present THEN the POST SHALL send it as an `Authorization: Bearer` credential; the design SHALL confirm this header against the ntfy documentation before it is pinned.
5. WHEN the POST fails (a network error or a non-2xx answer) THEN the pusher SHALL retry once as today and then append one `push.failure` row to the home event log (`src/advisor/push.ts:188-204`). A failed or skipped push SHALL never block, delay or change the wait or the run. Invariant (verified, not red-first): the decoupling holds at base because the pusher runs off the file watch, not inside the wait write.
6. On the pusher's first start with no readable pushed-id record, it SHALL record every open wait without sending, as today (`src/advisor/push.ts:155-163`). Invariant (verified, not red-first): regression guard.
7. The shell's browser notification SHALL stay as it is, and the watchdog's `notify-send` (`scripts/sdd-watchdog.sh:202-211`) SHALL not change.
8. No model SHALL write the message text; it SHALL be built from the wait's own fields.

### Requirement 5 — one reminder per wait

**User Story:** As the operator, I want one reminder when a wait is still open an hour later, so that a missed message does not stall a run all day.

#### Acceptance Criteria

1. WHEN a wait is still `open` one hour after its `created` time THEN the pusher SHALL send one reminder message with the same fields as Requirement 4 AC 3 and a marker that it is a reminder.
2. The controller SHALL send at most two messages per wait: the first and one reminder. A failed reminder SHALL follow Requirement 4 AC 5 and SHALL not be rescheduled.
3. WHEN a wait is answered or expired before its hour is up THEN no reminder SHALL be sent.
4. The reminder SHALL survive a controller restart: on start the pusher SHALL read each open wait's `created` and schedule its reminder for `created` plus one hour, or send it at once if that time has passed. It SHALL record which waits it has reminded, so a restart never sends a second reminder.
5. On the pusher's first start with no readable pushed-id record (Requirement 4 AC 6), every open wait SHALL be recorded as already reminded, so a first start sends nothing.
6. The reminder clock SHALL be injectable, so a test advances one hour without waiting (the decomposition's clock seam).

### Requirement 6 — launch routing names the next decomposition spec

**User Story:** As the operator, I want the setup view to offer the next spec the decomposition names whenever nothing on disk is live, so that Launch is never blocked by a routing state that names no spec.

#### Acceptance Criteria

1. `buildSetupView` (`src/dashboard/harness/run-setup.ts:146-217`) SHALL call `nextUnstartedSpec` (`src/dashboard/harness/run-setup.ts:223-232`) for every routing state that names no spec: `all-on-disk-complete`, `no-specs`, `ambiguous` and `all-deferred` (`src/core/spec-routing-deriver.ts:8-18`). Today it does so for the first two only (`src/dashboard/harness/run-setup.ts:195-201`).
2. WHEN the routing state is one of those four and `nextUnstartedSpec` returns a name THEN `launchable` SHALL be that name and `disabledReason` SHALL be null.
3. WHEN the routing state is `active` THEN `launchable` SHALL stay the routed spec. Invariant (verified, not red-first).
4. WHEN `nextUnstartedSpec` returns null THEN `launchable` SHALL be null and `disabledReason` SHALL be the routing reason. The reason that says every spec on disk is complete (`src/core/spec-routing-deriver.ts:96-106`) therefore appears only when the decomposition has no unstarted, undeferred heading. Invariant (verified, not red-first) for `all-on-disk-complete`.
5. WHEN Launch is pressed for a launchable spec with no directory THEN `launchSpec` SHALL create `specs/` + name before it enqueues (`src/dashboard/multi-server.ts:118-123`). Invariant (verified, not red-first): regression guard for the `ambiguous` case of the end-to-end check.

## Non-Functional Requirements

### Performance
- The heartbeat SHALL cost at most one `run.json` write per run per 10 seconds; it SHALL not touch the activity relay (`src/controller/activity.ts:35-48`) or emit a shell-feed push of its own beyond the run change its write emits.

### Security
- `notify.json` holds the ntfy topic, which is the secret. IF the file's mode grants any group or other permission THEN the controller SHALL log one warning per start and still send. The controller SHALL never write, copy or log the topic or token, and SHALL never put them on the wire to the dashboard.
- The first line of a question leaves the machine to the configured ntfy server (Decision D3). Nothing else from the wait does.

### Reliability
- A missing `notify.json`, a failed POST or a down ntfy server SHALL never block a wait, a run or the controller start.
- The heartbeat writer SHALL never overwrite a field another writer set (Requirement 1 AC 5-6).
- Node 20 (CI) and node 24 (local) SHALL both pass every test; a timing test SHALL use the injected clock, not real waits.

## Decisions taken in this document

- D1 — The phone push is sent by the existing wait pusher, extended, not by a new sender in the wait-opening helper: options were the existing pusher, a sender inside the run driver's wait helper as the decomposition placed it, or both; chosen because the pusher already dedups across restarts and sees waits written by other processes and by the gate and merge paths, which bypass the driver's helper.
- D2 — The ntfy config file replaces the earlier push config file, which is no longer read: options were replace it, keep both targets, or read the ntfy file first with the old file as fallback; chosen because the old file is not configured on the operator's machine and one config means one path to test.
- D3 — The message carries the first line of the first question, which supersedes the advisor spec's Requirement 10 rule of no question text: options were the first line as the decomposition decided, kind, project and spec only as the advisor spec decided, or the full question text; chosen because a phone message without the question cannot be triaged and the decomposition entry decided it.
- D4 — A crashed drive opens an error wait with retry and abandon, the run goes to waiting, Re-drive answers that wait retry, and a restart expires it and re-drives: options were a retry/abandon error wait, an acknowledge-only wait with Re-drive as the only resume, or no wait and the stalled flag only; chosen because the existing answer handler already resumes on retry and cancels on abandon, so the crash wait needs no new answer path.
- D5 — The reminder survives a controller restart, scheduled from the wait's created time with reminded ids recorded: options were survive restart, an in-memory timer only, or no reminder; chosen because a deploy restart (spec 31) inside the hour would otherwise drop the reminder silently.
- D6 — The wire run row carries the heartbeat as well as driven: options were expose it on the row or keep it on the record only; chosen because the dashboard specs after this one read liveness from the row.
- D7 — The heartbeat throttle writes the first activity at once and then at most one trailing write per 10-second window: options were leading and trailing, leading only, or a fixed 10-second interval timer; chosen because it keeps the stored value within 10 seconds of the last line with no idle writes.
- D8 — The message names the project by its name from the durable project list, falling back to the id: options were the name or the hashed id the pusher sends today; chosen because a hash means nothing on a phone.
- D9 — A config file readable by group or other is warned about and still used: options were warn and send, refuse to send, or ignore; chosen because the operator writes the file and a refusal would silently stop pushes.
- D10 — Stalled is derived on the dashboard from the status and driven fields, and the route also accepts a run parked on an open drive-crash wait: options were derive from the two fields, or add a separate stalled field; chosen because the decomposition names driven as the exposed field and one fact on the wire cannot disagree with another; the field is sourced live from the controller and never persisted (Requirement 2 AC 1), so it cannot go stale after a crash.

## Scope notes

- Cut: nothing from the decomposition entry.
- Placement re-decided: the decomposition places the push in the run driver's wait helper and lists that helper under the waits module; the helper lives in `src/controller/runs.ts:566-575`, and gate and merge waits call `createWait` directly (`src/controller/phases/gates.ts:169`, `src/controller/merge.ts:732`). D1 puts the push in the pusher instead, so every wait is covered.
- Earlier spec re-decided: D2 and D3 supersede the advisor spec's Requirement 10 AC 1 (no question text) and AC 4 (`push.json`). The design SHALL update `docs/controller-design.md` §16 and the advisor docs that describe `push.json`.
- Left to design, per the entry: the ntfy title and priority, the plain-text message body (the ntfy `<url>/<topic>` publish endpoint sends the request body as the notification text, so the fields compose into one plain-text body, not the JSON body the sender posts today at `src/advisor/push.ts:206-217`), and the exact shape of the reminded-ids record.
- Known gap, not in scope: the watchdog writes its controller-down `error` wait while no controller runs (`scripts/sdd-watchdog.sh:184-199`), so that wait reaches the phone only when a controller starts again and its pusher scans. The entry keeps the watchdog unchanged.
- Carried items from the decomposition: none.

## Revision History

- **v2** (2026-11-03) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/1).
  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 2 AC 1 no longer pins driven's build to the disk-only row function; it now names live controller memory as the only truth source, requires the design to hand that live set to the GET route and the feed, forbids persisting it to the run record (stale-after-crash), and makes a no-lock dashboard process report not-driven. D10 amended to match.
  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 2 AC 1 now requires driven and lastActivity on all three hand-mirrored run-row shapes and cites the server copy's existing drift; Requirement 1 AC 9 points to that list. AC 2 now defines stalled as a derived fact, states rendering is deferred to later dashboard specs, and that the end-to-end check verifies the wire row, not a renderer.
  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 4 AC 2 now migrates both readers of the old config — the pusher and the advisor hello summary's push-state probe — so the hello cannot report push off while push is on.
  - **R1-4 — Accepted (MINOR).** The design-deferred list now names the plain-text message body and that the fields compose into it, not the JSON body the current sender posts.
- **v1** (2026-11-03) — Initial draft.
  - **Lint pass.** 1 fixed; rejected: L-1..L-4 (`lastActivity` is the new field these ACs add; cites correctly locate the record and its writers at base, which lack it), L-6..L-11 (`stepKind`/`message`/`retry`/`abandon`/`waiting`/`inFlight` name the new drive-crash wait's content; cite anchors only "today only logged"), L-12 (`retry` is handled by `onWaitChange`'s non-`abandon` else branch at `:461-463`; cite anchors the invariant, literal token aside), L-13/L-14 (`pauseRequested` is the RunRecord field the loop-top stop reads via `isPauseRequested`; `paused` is the status the `pause()` call at `:856` sets), L-15..L-17 (`open` is a WaitState, `url`/`topic` are `notify.json` fields from AC 1; unrelated to the durable-project-list cite), L-18..L-20 (`nextUnstartedSpec`/`launchable`/`disabledReason` belong to run-setup.ts; cite anchors only the all-on-disk-complete reason), L-21 (`launchSpec` is the enclosing function at `:101`; cite anchors its create-before-enqueue body), L-22 (`ambiguous` is a RoutingState from AC 1; unrelated to the launchSpec cite).
