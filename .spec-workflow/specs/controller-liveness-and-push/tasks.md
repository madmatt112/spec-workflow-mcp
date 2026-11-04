# Tasks Document

Document version: v1

Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing suite green. Tasks 1-4 build the heartbeat, 5-9 build the crash wait, wire row, controller and route, and 10-13 build the ntfy push; task 14 stands alone and task 15 documents what 9-13 shipped. Two bridges hold the tree green: task 6 defaults the driven set to empty until task 9 wires it, and task 10 leaves `pushConfigPath` exported until task 12 removes it.

- [x] 1. Add lastActivity and its single writer to the run store
  - File: src/controller/state.ts
  - Test: src/controller/__tests__/state.test.ts — writeLastActivity(id, value, updated) and writeRun(record, opts)
  - Add the optional field and the chained writer; make `writeRunLocked` carry the field from disk and drop it on a terminal write.
  - Existing assertions: `state.test.ts` and `pause-request.test.ts` assert no value this changes.
  - Purpose: Give `lastActivity` one writer, so no other run write can lose or set it.
  - _Leverage: src/controller/state.ts_
  - _Requirements: 1.1, 1.5, 1.6, 1.7_
  - _Prompt: Task: Implement design C1. `RunRecord` (`src/controller/state.ts:69-109`) gains `lastActivity`. Export `writeLastActivity`, queued on `writeChains` (`:415`), with the three C1 post-conditions. Change `writeRunLocked` (`:417-433`) as C1 says, keeping the `pauseRequested` rule. | Restrictions: `writeLastActivity` does not pass through `writeRunLocked`, so `pausedAt` and `pauseRequested` stay as read. Seed the field in tests with `writeLastActivity`, because `writeRun` ignores the value on the record it gets. | Success: Each case has its own test: (a) a stale `writeRun` keeps the on-disk value; (b) the same with `ownsPauseRequest`; (c) a value on the record passed to `writeRun` is ignored; (d) a `writeRun` to `done`, to `abandoned` and to `error` each drops the field; (e) `writeLastActivity` changes only `lastActivity` and `updated`; (f) queued behind a status write, it keeps that status; (g) it resolves undefined and writes nothing for a missing run, for a terminal run, and for an undefined value on an absent field; (h) otherwise it resolves the record written_

- [x] 2. Build the step heartbeat throttle
  - File: src/controller/heartbeat.ts
  - Test: src/controller/__tests__/heartbeat.test.ts — createStepHeartbeat({ now, write, windowMs }).line() and .end()
  - Create the throttle object: no file access, no knowledge of runs.
  - Purpose: Turn stream lines into at most one write per 10 seconds.
  - _Leverage: design C3 interface block_
  - _Requirements: 1.3, 1.4_
  - _Prompt: Task: Create `src/controller/heartbeat.ts` with the design C3 interface and its five post-conditions. The value written is the time of the last recorded line, not the write time (design D3, requirement 1.3). | Restrictions: Unref the window timer. Test on `vi.useFakeTimers()` with a fake `write`, never a real wait (NFR Reliability). | Success: Each case has its own test: (a) the first `line()` writes at once with `now()`; (b) a `line()` inside an open window writes nothing then; (c) at the window's end one write carries the last line's time and a new window opens; (d) a window with no line closes with no write, and the next `line()` writes at once; (e) `end()` cancels the timer, drops the unwritten line and writes undefined once; (f) every later `line()` and `end()` is a no-op; (g) a rejected `write` is logged with `console.error` and does not reach the caller_

- [x] 3. Report stream lines and step end through the step spec
  - File: src/controller/step.ts
  - Test: src/controller/__tests__/step.test.ts — runStep(spec) with a recording heartbeat
  - Add the optional heartbeat to `StepSpec`, typed from task 2, and call it from the stream and settle paths.
  - Regression guard (holds at base): `onActivity` still fires only for `tool_use` blocks.
  - Existing assertions: `step.test.ts` asserts no value this changes.
  - Purpose: Report every parsed line and the step's end, not only tool use.
  - _Leverage: src/controller/step.ts_
  - _Requirements: 1.2, 1.4_
  - _Prompt: Task: Implement design C2. `StepSpec` (`src/controller/step.ts:94-135`) gains `heartbeat`, of the type task 2 exports. `handleLine` calls `line()` in the parsed-object branch (`:446-448`) before `handleEvent`. `finish` calls `end()` after the leftover-buffer `handleLine` (`:466-469`) and before the promise resolves; the spawn `error` handler calls it after `settled = true` (`:509-511`). | Restrictions: Do not touch `src/controller/activity.ts` (NFR Performance). Assert on lines, never chunk boundaries. | Success: Each case has its own test: (a) `line()` fires for a non-`tool_use` event; (b) it does not fire for a blank line; (c) it does not fire for a non-JSON line or a JSON scalar; (d) a last line with no newline fires `line()` before `end()`; (e) `end()` fires once on close; (f) `end()` fires once on spawn failure; (g) regression guard: `onActivity` still fires only for `tool_use` blocks_

- [x] 4. Wire the heartbeat into every run step
  - File: src/controller/runs.ts
  - File: src/controller/phases/document.ts
  - File: src/controller/phases/implementation.ts
  - File: src/controller/phases/retrospective.ts
  - File: src/controller/phases/closeout.ts
  - File: src/controller/merge-fix.ts
  - File: scripts/stub-claude.mjs
  - Test: src/controller/__tests__/runs.test.ts — setRunHeartbeat(now, runId, value)
  - Test: src/controller/__tests__/liveness-e2e.test.ts — Controller.enqueue with a stub step that streams lines
  - Add `setRunHeartbeat`, the lifecycle factory and the five context fields.
  - The stub prints every event at once (`scripts/stub-claude.mjs:137-139`), so it gains an optional pause between events; a test cannot otherwise see a step mid-stream.
  - Existing assertions: `runs.test.ts` asserts no value this changes.
  - Purpose: Make a real step write `lastActivity`.
  - _Leverage: src/controller/runs.ts, scripts/stub-claude.mjs_
  - _Requirements: 1.2, 1.4, 1.7_
  - _Prompt: Task: Implement the design C3 wiring and `setRunHeartbeat`, using the writer task 1 exports and the factory task 2 exports. `stepLifecycle` (`src/controller/runs.ts:436-447`) gains the factory; each of the five context types gains the field beside `onStepEnd`; each `StepSpec` build sets `heartbeat` from it, so every step gets a fresh object. Add an optional `eventDelayMs` run field to the stub. Create `liveness-e2e.test.ts`, copying the fixture setup from `src/controller/__tests__/controller.test.ts:95-117` and `:163-172`, with design end-to-end scenario 1. | Restrictions: Do not wire the advisor opinion step (`src/advisor/opinion.ts:154`). Emit `runEvents` `change` only when a record was written (NFR Performance). A stub run without the new field prints exactly as today. Assert the 10-second rate only in task 2's fake-timer test, never with a real wait. | Success: Each case has its own test: (a) `setRunHeartbeat` writes the value and emits one `change`; (b) it emits nothing when no record was written; (c) while a stub step streams, `lastActivity` appears in `run.json`; (d) the field is absent within 1 second of that step's end; (e) a cancel during the step leaves status `abandoned` with the field absent_

- [x] 5. Add the drive-crash wait helpers
  - File: src/controller/waits.ts
  - Test: src/controller/__tests__/waits.test.ts — expireWait(id) and openDriveCrashWait(runId)
  - Add the question id constant, the finder and the expiry.
  - Regression guard (holds at base): `listWaitsForView` hides an expired wait (`src/controller/waits.ts:193-198`).
  - Existing assertions: `waits.test.ts` asserts no value this changes.
  - Purpose: Let the controller recognise and retire a crash wait.
  - _Leverage: src/controller/waits.ts_
  - _Requirements: 2.3, 3.4, 3.7_
  - _Prompt: Task: Implement design C6 in `src/controller/waits.ts`: `DRIVE_CRASH_QUESTION`, `openDriveCrashWait` from `listOpenWaits` (`:187-190`), and `expireWait` through `enqueueWaitWrite` (`:73-84`). | Restrictions: `createWait` and `answerWait` stay unchanged. `expireWait` writes no `questions.md` and no ledger row. | Success: Each case has its own test: (a) `expireWait` turns an open wait `expired`, writes it and emits `change`; (b) an answered wait returns unchanged with no write and no emit; (c) an unknown id returns undefined; (d) no `questions.md` or ledger row appears; (e) `openDriveCrashWait` finds the open wait of that run with that question id; (f) it returns undefined for another run's wait, for an open wait with a different question id, and for an answered crash wait; (g) regression guard: `listWaitsForView` omits the expired wait_

- [x] 6. Carry driven and lastActivity on the wire row
  - File: src/controller/runs.ts
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: src/dashboard/shell/shell-feed.ts
  - File: src/dashboard/harness/hub.ts
  - File: src/dashboard/shell/__tests__/sidebar-rows.test.ts
  - Test: src/controller/__tests__/runs.test.ts — listRunsForWire(driven)
  - Test: src/dashboard/shell/__tests__/shell-feed.test.ts — new ShellFeed(projects, send, { drivenRuns }).start()
  - Bridge: no caller passes a set until task 9, so every row reads `driven: false`.
  - `driven` is required and `tsconfig.json:19` compiles tests, so the `run()` helper at `src/dashboard/shell/__tests__/sidebar-rows.test.ts:189-198` gains `driven: false`.
  - Existing assertions: `runs.test.ts`, `shell-feed.test.ts` and `sidebar-rows.test.ts` assert no value this changes.
  - Purpose: Put both facts on the row the dashboard reads.
  - _Leverage: src/controller/runs.ts, src/dashboard/shell/shell-feed.ts_
  - _Requirements: 1.9, 2.1, 2.2_
  - _Prompt: Task: Implement design C4 except its `multi-server.ts` lines, which task 9 owns. `listRunsForWire` takes the optional set and `toRow` adds `driven` and `lastActivity`. Declare both on the three shapes C4 names. Add the `drivenRuns` option to `ShellFeed` (`src/dashboard/shell/shell-feed.ts:41`), whose flush passes its result to `listRunsForWire` (`:117`), and to `HarnessHub` (`src/dashboard/harness/hub.ts:44`), which passes it to `new ShellFeed` (`:98`). | Restrictions: `driven` is never written to `run.json` (requirement 2.1). Derive and render no stalled state (requirement 2.2). The frontend change is the type declaration only. | Success: Each case has its own test: (a) a row carries `lastActivity` when the record has it; (b) a row omits it when the record does not; (c) a run in the set reads `driven: true`; (d) a run outside the set reads `driven: false`; (e) with no set every row reads `driven: false`; (f) `drivenRuns` given to `ShellFeed` reaches the `controller-runs` row. `npx tsc --noEmit` passes with `driven` required on the server shapes_

- [x] 7. Turn a crashed drive into a wait and expose the driven set
  - File: src/controller/controller.ts
  - Test: src/controller/__tests__/controller.test.ts — controller.drivenRuns() and a one-shot throw through the mcpConfigFor option
  - Add the driven-set reader, the crash wait and the drive-end change event.
  - Regression guard (requirement 2.6, holds at base): `onWaitChange` already re-queues on `retry` and cancels on `abandon`; only the wait's creation is new.
  - Existing assertions: the one `change` listener in `src/controller/__tests__/controller.test.ts:496-506` spans a pause with no drive, so the drive-end emit alters no asserted value.
  - Purpose: Make a crash a wait, never a silent `running`.
  - _Leverage: src/controller/controller.ts, src/controller/waits.ts_
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_
  - _Prompt: Task: Implement the `drivenRuns`, Drive crash and Drive end parts of design C5 in `src/controller/controller.ts`. `drivenRuns()` returns a new set of `active` plus the keys of `drives` (`:75-78`). The `catch` in `drive` (`:428-429`) keeps its log, then calls a private `openCrashWait` with the four C5 steps, using the question id task 5 exports. `startDrive`'s `.finally` (`:419`) deletes the entry, then reads the run and emits `runEvents` `change`. Throw through the `mcpConfigFor` option (`:54`), which `runOnce` calls (design D15, requirement 2.3). | Restrictions: Call `openCrashWait` inside the `try`, so `active` still holds the run. Open no wait unless the status is `queued`, `running` or `merging` (design D4, requirement 2.3). Add no test-only hook. | Success: Each case has its own test: (a) a throw opens an `error` wait with text `step <kind> failed inside the controller: <message>`, options `retry` and `abandon`, recommended `retry`, and the crash question id; (b) the run reads `waiting` with no `inFlight`; (c) a run with no cursor names step `unknown`; (d) a non-Error throw uses its string form; (e) no wait opens for a gone run, a cancelled run, or a status outside the three; (f) a failed wait write or run write is logged and the run stays as it was; (g) a change event fires after a drive ends by return, with the id out of `drivenRuns()`; (h) the same after a throw; (i) `drivenRuns()` holds the id during a drive; (j) regression guard: answering `retry` re-drives from the cursor; (k) regression guard: answering `abandon` cancels_

- [x] 8. Add Re-drive and crash-wait recovery to the controller
  - File: src/controller/controller.ts
  - Test: src/controller/__tests__/controller.test.ts — controller.redrive(runId) and controller.start() recovery
  - Test: src/controller/__tests__/liveness-e2e.test.ts — redrive after a thrown drive, a restart, and a killed stub step
  - Add `redrive`, and change `recover` and `reattach`.
  - Regression guards (hold at base): `running` runs re-drive on start (3.6); a killed step retries with the run driven (2.7); a hold parks at the loop-top stop (3.8).
  - Existing assertions: the crash-recovery test in `controller.test.ts` asserts no value this changes.
  - Purpose: Recover a stalled run with no restart, and clear stale heartbeats.
  - _Leverage: src/controller/controller.ts_
  - _Requirements: 1.8, 2.7, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - _Prompt: Task: Implement `redrive` and the `recover` and `reattach` parts of design C5: the five ordered `redrive` post-conditions, using the finder task 5 exports; `recover` clears the heartbeat through the function task 4 exports before re-driving a dead step, and expires an open drive-crash wait through task 5's expiry and then drives; `reattach` clears the heartbeat when the pid dies, and only then leaves `active` and starts a drive. Extend the file task 4 created with design end-to-end scenarios 2 and 3. | Restrictions: `redrive` reads no `pauseRequested`, so requirement 3.8 holds through the loop-top stop in `runOnce`. No other `waiting` run changes, and `resumeIfWaitAnswered` still runs for them. Change no step classification. | Success: Each case has its own test: (a) an unknown run gives `not-found`; (b) a controller never started gives `not-stalled`, with an empty driven set; (c) a driven run gives `not-stalled`, no change; (d) a stalled `running` run gives `ok` and a drive from its cursor; (e) a run `waiting` on an open crash wait gives `ok`, with that wait answered `retry` by `operator`; (f) any other status gives `not-stalled`, no change; (g) regression guard on the loop-top stop: a held stalled run parks `paused` and starts no step; (h) `recover` clears `lastActivity` on a dead step, then drives it (the drive is a regression guard, requirement 3.6); (i) a re-attached live step keeps its value until the pid dies, then the value clears before the drive; (j) `driven` stays true across that clear; (k) on start an open crash wait turns `expired` and the run drives with no action; (l) another `waiting` run is unchanged; (m) scenario 2: after a throw `driven` reads false within 5 seconds, the wait names step and message, `redrive` resumes from the cursor, and a restart drives the run with no action; (n) regression guard, scenario 3: a stub step killed by signal retries with `driven` true throughout_

- [ ] 9. Add the Re-drive route and hand the driven set to the row builders
  - File: src/dashboard/multi-server.ts
  - Test: src/dashboard/__tests__/controller-dashboard-routes.test.ts — POST /api/controller/runs/:id/redrive and GET /api/controller/runs
  - Test: src/dashboard/__tests__/shell-routes.test.ts — controller-runs row on an overview socket
  - Add the route and remove task 6's bridge.
  - Regression guard (holds at base): the app-level hooks answer 401 with no secret.
  - Existing assertions: neither test file asserts a row exactly, so no value changes.
  - Purpose: Put Re-drive and the live driven fact on the server surface.
  - _Leverage: src/dashboard/multi-server.ts_
  - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Prompt: Task: Implement design C7 and the `multi-server.ts` lines of C4. Add `POST /api/controller/runs/:id/redrive` after the resume route (`src/dashboard/multi-server.ts:832-838`), mapping the results of the method task 8 adds to the C7 answers. Remove task 6's bridge: the GET route (`:809-811`) passes the set from the reader task 7 adds, and the `HarnessHub` construction (`:165-169`) passes a closure over that reader. | Restrictions: The closure runs at flush time, so the hub stays built before the controller (`:176`). Add no per-route security code (`:275-282`). Any test that starts a drive sets `CONTROLLER_CLAUDE_BIN` to `scripts/stub-claude.mjs` with a script, so no real `claude` spawns. | Success: Each case has its own test: (a) an unknown id answers 404 `{ error: 'run-not-found' }`; (b) a driven run answers 409 `{ error: 'not-stalled' }`; (c) a `done` run answers the same 409 and changes nothing; (d) a stalled run answers 200 `{ ok: true }`; (e) a run on an open crash wait answers 200; (f) the GET row reads `driven: true` during a drive; (g) the GET row reads `driven: false` for an undriven run; (h) the `controller-runs` row on an overview socket reads `driven: true` during a drive; (i) regression guard: no secret answers 401_

- [ ] 10. Add the notify config reader and move the hello to it
  - File: src/advisor/home.ts
  - File: src/advisor/summary.ts
  - Test: src/advisor/__tests__/home.test.ts — notifyConfigPath(), readNotifyConfig() and notifyConfigIsLoose()
  - Test: src/advisor/__tests__/summary.test.ts — buildSummary({ now })
  - Add the three helpers and the `NotifyConfig` type; `pushState` reads through them.
  - Bridge: `pushConfigPath` stays exported for `src/advisor/push.ts` until task 12.
  - Existing assertions: `src/advisor/__tests__/home.test.ts:67`, `src/advisor/__tests__/home.test.ts:79` and `src/advisor/__tests__/summary.test.ts:411` still hold; this task changes no value they assert.
  - Purpose: Give both config readers one validity rule.
  - _Leverage: src/advisor/home.ts, src/advisor/summary.ts_
  - _Requirements: 4.1, 4.2_
  - _Prompt: Task: Implement design C8 in `src/advisor/home.ts` and `pushState` (`src/advisor/summary.ts:93-100`), except the removal of `pushConfigPath`, which task 12 does. `pushState` returns `on` exactly when the reader returns a value. Rename `push.json` to `notify.json` in the comment and title at `src/advisor/__tests__/summary.test.ts:404-409`. | Restrictions: The helpers never log the topic or token. | Success: Each case has its own test: (a) the path is `notify.json` under the controller home; (b) a valid file reads with a token; (c) a valid file reads without one; (d) undefined for a missing file; (e) undefined for an unparsable file; (f) undefined for `v` not 1; (g) undefined for an empty or missing `ntfy.url`; (h) undefined for an empty or missing `ntfy.topic`; (i) undefined for a non-string `ntfy.token`; (j) mode 0600 is not loose; (k) mode 0640 is loose; (l) a missing file is not loose; (m) the summary reads `on` with a valid file; (n) regression guard: it reads `off` with a malformed file; (o) regression guard: it reads `off` with no file_

- [ ] 11. Build the ntfy message from the wait's own fields
  - File: src/advisor/push.ts
  - Test: src/advisor/__tests__/push.test.ts — buildMessage(wait, projectName, reminder)
  - Export the pure builder; it has no caller yet, so the unused export compiles green on its own.
  - Existing assertions: `push.test.ts` assertions are untouched here.
  - Purpose: Fix the message text with no model and no leaked path.
  - _Leverage: src/advisor/push.ts_
  - _Requirements: 4.3, 4.8, 5.1_
  - _Prompt: Task: Export `buildMessage` from `src/advisor/push.ts` with the design C9 title, two body lines and redaction (design D12, requirement 4.3). | Restrictions: Pure: no file read, no clock. Use only the wait's kind, spec and first question, and the project name passed in. Redact any token with a `/`, URLs included, as C9 says. | Success: Each case has its own test: (a) body line 1 holds kind, project name and spec; (b) the title is `SDD ` plus the kind; (c) a reminder prefixes body line 1 and uses the reminder title; (d) body line 2 is the trimmed first line of the first question; (e) multi-line text keeps only that line; (f) a wait with no question has no line 2; (g) an absolute path redacts to `[path]`; (h) a `~/` path redacts; (i) a slash-relative path redacts; (j) a single-segment filename redacts; (k) plain words stay; (l) answer, advice and later questions never appear_

- [ ] 12. Send the ntfy POST from the pusher
  - File: src/advisor/push.ts
  - File: src/advisor/home.ts
  - File: src/advisor/__tests__/home.test.ts
  - File: src/advisor/__tests__/advisor-e2e.test.ts
  - Test: src/advisor/__tests__/push.test.ts — new WaitPusher({ retryDelayMs }).start()
  - Read `docs.ntfy.sh/publish` first (requirement 4.4): the design could not.
  - Remove task 10's bridge, so `push.json` is read nowhere.
  - Regression guards (hold at base): one retry then one `push.failure` row (4.5); first start sends nothing (4.6); the watchdog and browser notification stay outside this task's list (4.7).
  - Existing assertions: these change exactly, at least `src/advisor/__tests__/push.test.ts:211-212`, `src/advisor/__tests__/push.test.ts:304-306` and `src/advisor/__tests__/advisor-e2e.test.ts:438-441`, `src/advisor/__tests__/advisor-e2e.test.ts:461`, `src/advisor/__tests__/home.test.ts:14`, `src/advisor/__tests__/home.test.ts:67`, `src/advisor/__tests__/home.test.ts:79`.
  - Purpose: Reach the phone through ntfy.
  - _Leverage: src/advisor/push.ts_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, NFR_
  - _Prompt: Task: First fetch `https://docs.ntfy.sh/publish` with WebFetch and record in the implementation log what it says of `Authorization: Bearer`, `Title`, `Priority` and any body limit; if it disagrees with design C9, or the fetch is denied, escalate for an operator-supplied value and do not ship the header blind (requirement 4.4). Then implement the C9 Start, POST, Headers and Project name parts: read the config through the reader task 10 exports, send the title and body from the builder task 11 exports, and remove `pushConfigPath`. Extend the capture server in `push.test.ts` to record path and headers. | Restrictions: Change neither `scripts/sdd-watchdog.sh` nor the shell's browser notification (requirement 4.7). No log line or `push.failure` row holds the topic or token. Widen the listed assertion sites to every hit of `grep -rn "pushConfigPath\|push\.json\|dashboardUrl" src/advisor/__tests__`, except the unrelated `dashboardUrl` variable in `cli.test.ts`. | Success: Each case has its own test: (a) a new open wait POSTs once to `url/topic`; (b) a trailing slash on `url` is trimmed; (c) the body and `Title` come from the builder, with `Priority: 4`; (d) a token sends `Authorization: Bearer`; (e) no token sends no such header; (f) the code sets no JSON content type; (g) the project name comes from the project list; (h) an unknown project uses its id; (i) an unreadable list uses the id; (j) a missing or malformed file sends nothing and logs one push-off line per start, and the wait is still written; (k) a loose file logs one warning and still sends; (l) a file added after start sends with no restart; (m) neither log nor `push.failure` row holds the topic or token; (n) regression guard: a failed POST retries once, then logs one `push.failure` row and leaves the wait open; (o) regression guard: first start sends nothing. `grep -rn pushConfigPath src` then finds nothing; only the header comment task 15 rewrites may still name `push.json`_

- [ ] 13. Add the one-hour reminder
  - File: src/advisor/push.ts
  - Test: src/advisor/__tests__/push.test.ts — WaitPusher.sweepReminders() on the injected now
  - Widen `pushed.json` additively, record first pushes, and add the sweep.
  - Existing assertions: `readPushedIds` in `push.test.ts` reads `ids`, which keeps its value.
  - Purpose: One reminder per missed wait, across restarts.
  - _Leverage: src/advisor/push.ts_
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - _Prompt: Task: Implement the design C9 parts Recording a new wait, First start and `sweepReminders`, the `now` and `sweepMs` options, and the `pushed.json` shape in Data Models, on the sender task 12 left. A reminder sends the builder's reminder form, and its `push.failure` detail says it was a reminder. Add design end-to-end scenario 4 to `push.test.ts`. | Restrictions: Reminder clock is the injected `now`, never a real wait (requirement 5.6). The record is written before each POST. `v` stays 1 and no migration runs (design D9, requirement 5.4). | Success: Each case has its own test: (a) a wait open one hour after its first push gets one reminder with the marker; (b) none before the hour; (c) the hour runs from the first push, so a wait created long before it gets no immediate reminder; (d) a first push on the start scan arms the reminder; (e) a first push on a live wait arms it; (f) none after an answer; (g) none after expiry; (h) a failed reminder retries once, logs one `push.failure` row and is never rescheduled; (i) a failed first POST leaves the reminder armed (design D10, requirement 5.1); (j) a wait seen with no config never gets one (design D10, requirement 5.1); (k) a restart past the hour sends at the start sweep; (l) a restart inside the hour sends only after it; (m) a restart after a reminder sends no second one; (n) first start marks every open wait reminded and sends nothing; (o) a legacy record gets no reminder and still reads; (p) a file with no `ids` array counts as a first start; (q) a write prunes a gone wait from all three fields; (r) `stop()` clears the sweep timer; (s) scenario 4: against a capture server one message, then one reminder, then nothing; (t) scenario 4: a wait answered early gets no reminder_

- [ ] 14. Route launch to the next decomposition spec
  - File: src/dashboard/harness/run-setup.ts
  - Test: src/dashboard/harness/__tests__/run-setup.test.ts — buildSetupView(project, {})
  - Test: src/controller/__tests__/liveness-e2e.test.ts — launchSpec(project, input, controller)
  - Widen the guard to every state that names no spec.
  - Regression guards (hold at base): `active` keeps its spec (6.3); a null name keeps the routing reason (6.4); the two states already consulted stay as they are. `launchSpec`'s directory code is unchanged (6.5), but scenario 5 is red until the guard widens.
  - Existing assertions: `src/dashboard/harness/__tests__/run-setup.test.ts:505-511` and `src/dashboard/harness/__tests__/run-setup.test.ts:516-529` keep their values.
  - Purpose: Never block Launch on a routing state that names no spec.
  - _Leverage: src/dashboard/harness/run-setup.ts, src/core/index-generator.ts_
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Prompt: Task: Implement design C10: change the guard at `src/dashboard/harness/run-setup.ts:197-199`. Add design end-to-end scenario 5 to the file task 4 created. For `ambiguous`, seed a decomposition that names only an unstarted heading plus two unnamed specs on disk; for `all-deferred`, defer the one spec with `IndexGenerator.defer` (`src/core/index-generator.ts:113`). | Restrictions: `launchable` and `disabledReason` (`:200-201`), `harnessNotLaunchable`, `validateSetup` and `launchSpec` keep their code. | Success: Each case has its own test: (a) `ambiguous` with an unstarted heading gives that name and a null reason; (b) `all-deferred` the same; (c) scenario 5: on that `ambiguous` project `launchSpec` creates the directory and enqueues; (d) regression guard: `no-specs` with a heading gives its name; (e) regression guard: `all-on-disk-complete` with a heading gives its name; (f) regression guard: `ambiguous` with no heading keeps launchable null and the routing reason; (g) regression guard: `all-deferred` with no heading, the same; (h) regression guard: `all-on-disk-complete` with no heading keeps its reason; (i) regression guard: `active` stays the routed spec_

- [ ] 15. Update the docs for the push and the route
  - File: docs/controller-design.md
  - File: docs/SDD-HARNESS.md
  - File: src/advisor/push.ts
  - Rewrite the push text and add the route; no seam, because nothing here executes.
  - Purpose: Keep the docs true after requirements D2 and D3 supersede the advisor spec.
  - _Leverage: docs/controller-design.md, docs/SDD-HARNESS.md_
  - _Requirements: 3.1, 4.2_
  - _Prompt: Task: Implement design C11. Rewrite the Push bullet of `docs/controller-design.md` §16 (`:335-340`) and of `docs/SDD-HARNESS.md` (`:576-578`) for `notify.json`, the message fields, the reminder and the supersession of the advisor spec's no-question-text rule. Rename the file in the home list (`docs/SDD-HARNESS.md:76`). Add the Re-drive route beside cancel and discard (`:166`). Rewrite the header comment of `src/advisor/push.ts`. Find every member with `grep -rn "push\.json" docs src/advisor/push.ts`. | Restrictions: Use ASD-STE100 style. The home list keeps its count: one name replaces another. Never print a real topic. | Success: The grep finds no `push.json`; each rewritten bullet names `notify.json`, the four message fields and the one reminder; the route is named; `npx tsc --noEmit` passes_

## Decisions taken in this document

- D1 — The config rename spans two tasks: options were one task that renames and rewrites the sender, or an additive task with the removal later; chosen because the existing push tests write the old file shape, and the additive step keeps every suite green until the sender moves.
- D2 — Each end-to-end scenario lands in the task that makes it pass: options were that, or one final guard task; chosen because a guard-only task costs a test-author spawn that can only report red-impossible.
- D3 — The shared stub gains an optional pause between events: options were that, or a private stub in the new test; chosen because every existing run field already lives there, and an absent field changes nothing.
- D4 — The status change in scenario 1 is a cancel mid-step: options were a cancel or a hand-written status; chosen because a cancel is the real concurrent writer, and it proves a pending heartbeat cannot revive a terminal run.
- D5 — The 10-second rate is asserted only on fake timers: options were that, or a real wait in the end-to-end test; chosen because the requirements bar real waits in a timing test.
- D6 — A URL token in a question's first line redacts: options were the body of the design, which marks any token with a slash, or its older revision note that URLs stay; chosen because the v3 body supersedes that note.
- D7 — The hub hand-off is proved over an overview socket: options were that, or a compile check; chosen because the option is optional, so the compiler cannot catch a dropped pass-through.
- D8 — The design's controller component splits into two tasks: options were one task or two; chosen because the crash path and the Re-drive path each carry enough cases for their own red proof, and the second needs the first.

## Scope notes

- Cut: nothing from the decomposition entry, the requirements or the design.
- Deferred, as the requirements fix: deriving and rendering stalled, and any Re-drive button. The only frontend edit is the type declaration in task 6.
- Open item: requirement 4.4's ntfy check runs first in task 12, which escalates if the page disagrees or the fetch is denied.
- The decomposition's "at most every 10 s" check is proved in task 2 on fake timers (D5), not in the end-to-end file.
- Known gap, not in scope: the Now page's idle row reads the routing state directly (`src/dashboard/shell/now-model.ts:131-132`), so it can still show a disabled reason where the setup view now offers a spec. Requirement 6 names `buildSetupView` (`src/dashboard/harness/run-setup.ts:146-217`) only.
- Carried items from design: none.

## Revision History

- **v1** (2026-11-03) — Initial draft.
  - **Lint pass.** 16 fixed; rejected: L-1 ("Enumerated, no change" is a design meta-section of deliberately untouched components — no task implements it, and settlePass/launchSpec/sidebar-rows already appear as regression-guard references in tasks 8, 9, 14), L-2 (`tsconfig.json` is the sole tsconfig at the code root; `tsconfig.json` is its path from the root, with no directory to prefix and nothing to re-resolve wrong), L-18 (task 15's only source edit is the non-executing `src/advisor/push.ts` header comment; the task declares no seam and verifies via tsc and the `push.json` grep).
