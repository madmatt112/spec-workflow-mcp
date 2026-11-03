# Design Document

## Overview

This spec adds a durable step heartbeat, a live `driven` fact on the run row, a crash wait, a Re-drive route, an ntfy phone push with one reminder, and a launch-routing fix. The work sits in the controller (`src/controller/`), the wait pusher (`src/advisor/push.ts`) and the dashboard server (`src/dashboard/`). It reuses the per-run write chain, the existing `error` wait answer path, the `WaitPusher` watch and dedup, and `nextUnstartedSpec`.

## Steering Document Alignment

### Technical Standards (tech.md)
N/A: the steering directory is empty. The design follows `.spec-workflow/agent-rules.md` (tests beside the module, node 20 and 24).

### Project Structure (structure.md)
N/A: the steering directory is empty. The one new source file is `src/controller/heartbeat.ts`, beside the driver it serves.

### Design System (design-system.md) — if applicable
N/A: this spec has no visual surface (Requirement 2 AC 2 defers rendering).

## Architecture

Two data paths change. A step's stream feeds a step-scoped heartbeat object, which writes `lastActivity` through the per-run write chain, so a heartbeat write and a status write never interleave. The `driven` fact stays in controller memory and enters the wire row as an argument at the two row-build sites. The pusher stays a separate reader of the `waits/` directory; it gains the ntfy message, a reminder sweep and a wider `pushed.json`.

## Components and Interfaces

All inline code below is illustrative — verify against the test fake. The post-conditions bind; the code shape does not.

### C1 — Run record and heartbeat write (`src/controller/state.ts`)
- **Purpose:** hold `lastActivity` and give it one writer.
- **Interfaces:**
  - `RunRecord` (`src/controller/state.ts:70-109`) gains `lastActivity?: string` (ISO).
  - `writeLastActivity(id: string, value: string | undefined, updated: string): Promise<RunRecord | undefined>`.
- **Post-conditions of `writeLastActivity`:**
  1. It queues on `writeChains` (`src/controller/state.ts:415`), behind every `writeRun` already queued for that id.
  2. Inside the chain it reads `run.json` fresh and writes atomically; only `lastActivity` and `updated` differ from the record it read. `pausedAt` and `pauseRequested` stay as read, because it does not pass through `writeRunLocked`.
  3. It resolves `undefined` and writes nothing when the run is missing, when the status is `done`, `abandoned` or `error`, or when `value` is undefined and the field is already absent. Else it resolves the record written.
- **Change to `writeRunLocked`** (`src/controller/state.ts:417-433`): for a non-terminal write it reads disk once and takes `lastActivity` from disk, always ignoring the value on the record passed in; a terminal write drops the field. `pauseRequested` keeps its rule (`ownsPauseRequest` keeps the caller's value). This covers `patchRun`, both `save` functions and `cancelRun` (Requirement 1 AC 5, AC 7), because all call `writeRun`. A test seeds the field with `writeLastActivity`.
- **Reuses:** `writeJsonAtomic` (`src/controller/state.ts:336-341`).

### C2 — Step stream seam (`src/controller/step.ts`)
- **Purpose:** report every parsed stream line and the step's end.
- **Interfaces:** `StepSpec` (`src/controller/step.ts:94-135`) gains `heartbeat?: StepHeartbeat`.
- **Post-conditions:**
  1. `handleLine` calls `spec.heartbeat?.line()` in the branch that holds a parsed object (`src/controller/step.ts:446-448`), before `handleEvent`; a blank or non-JSON line does not call it.
  2. `finish` calls `spec.heartbeat?.end()` after the leftover-buffer `handleLine` (`src/controller/step.ts:466-469`) and before the promise resolves. The spawn `error` handler calls it after `settled = true` (`:509-511`). Each settled path calls it once.
  3. `onActivity` still fires only for `tool_use` blocks; the heartbeat does not touch `src/controller/activity.ts`.

### C3 — Heartbeat throttle (`src/controller/heartbeat.ts`, new) and its wiring
- **Purpose:** turn stream lines into at most one write per 10 seconds.
- **Interfaces:**

```ts
export const HEARTBEAT_WINDOW_MS = 10_000;
export interface StepHeartbeat { line(): void; end(): void; }
export function createStepHeartbeat(opts: {
  now(): Date;
  write(value: string | undefined): Promise<unknown>;
  windowMs?: number;
}): StepHeartbeat;
```

- **Post-conditions:**
  1. The first `line()` of the object calls `write` at once with `now()` and opens a window.
  2. A `line()` inside an open window records its time and writes nothing.
  3. At the window's end, if a line was recorded, `write` runs once with the time of the last recorded line and a new window opens; if none, the window closes and writes nothing (no idle writes).
  4. `end()` cancels the window timer, drops any unwritten line, calls `write(undefined)` once, and turns every later `line()` and `end()` into a no-op.
  5. The timer is unref'd. A rejected `write` is logged with `console.error` and never reaches the stream handler.
- **Wiring:** `stepLifecycle` (`src/controller/runs.ts:436-447`) gains `stepHeartbeat: () => StepHeartbeat`. Every phase context already spreads `...stepLifecycle(...)` (`src/controller/runs.ts:753`, `:963`, `:984`, `:1015`, `:1033`, `:1319`), so no call site in `runs.ts` changes. Each of the five context types gains `stepHeartbeat?: () => StepHeartbeat` beside `onStepEnd` (`src/controller/phases/document.ts:185`, `src/controller/phases/implementation.ts:96`, `src/controller/phases/retrospective.ts:44`, `src/controller/phases/closeout.ts:63`, `src/controller/merge-fix.ts:51`). Each `StepSpec` build sets `heartbeat: ctx.stepHeartbeat?.()` (`src/controller/phases/document.ts:377-396`, `src/controller/phases/implementation.ts:463-465`, `src/controller/phases/retrospective.ts:161-163`, `src/controller/phases/closeout.ts:311-313`, `src/controller/merge-fix.ts:221-223`).
- **`setRunHeartbeat(now: () => Date, runId: string, value: string | undefined): Promise<void>`**, exported from `src/controller/runs.ts`: calls `writeLastActivity` and emits `runEvents` `change` only when a record was written.
- **Not wired:** the advisor opinion step (`src/advisor/opinion.ts:154`) belongs to no run and sets no heartbeat.
- **Steps of one run are serial:** no `Promise.all` exists in `src/controller/phases/` or `src/controller/merge-fix.ts`.

### C4 — Wire row
- **Purpose:** carry `driven` and `lastActivity` to the dashboard.
- **Interfaces:**
  - `listRunsForWire(driven: ReadonlySet<string> = new Set())` (`src/controller/runs.ts:1441-1444`); `toRow` (`:1429-1438`) takes the set and adds `driven: driven.has(run.id)` and `lastActivity: run.lastActivity`.
  - `driven: boolean` and `lastActivity?: string` are declared on `ControllerRunRow` (`src/controller/runs.ts:1410-1427`), `ControllerRun` (`src/dashboard/shell/types.ts:194-210`) and `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:215-233`).
  - `ShellFeed` opts (`src/dashboard/shell/shell-feed.ts:41`) gain `drivenRuns?: () => ReadonlySet<string>`; `flush` passes its result to `listRunsForWire` (`:117`).
  - `HarnessHub` opts (`src/dashboard/harness/hub.ts:44`) gain the same field and pass it to `new ShellFeed` (`:98`).
  - `src/dashboard/multi-server.ts:165-169` passes `{ drivenRuns: () => this.controller.drivenRuns() }`. The closure runs at flush time, so the hub may keep being built before the controller (`:176`).
  - The GET route (`src/dashboard/multi-server.ts:809-811`) calls `listRunsForWire(this.controller.drivenRuns())`.
- **Post-conditions:** `driven` is never written to `run.json`. A process without the lock has empty `active` and `drives`, so every row reads `driven: false` with no extra branch.

### C5 — Controller (`src/controller/controller.ts`)
- **Purpose:** expose the driven set, turn a crashed drive into a wait, and re-drive.
- **Interfaces:**
  - `drivenRuns(): ReadonlySet<string>` — a new set holding the ids in `active` and the keys of `drives` (`src/controller/controller.ts:75-78`). `reattach` adds to `active` (`:321`), so a re-attach poll counts.
  - `redrive(runId: string): Promise<'ok' | 'not-found' | 'not-stalled'>`.
- **Drive crash.** The `catch` in `drive` (`src/controller/controller.ts:428-429`) keeps its log and then calls a private `openCrashWait(runId, err)`, inside the `try` so `active` still holds the run:
  1. It re-reads the run. It returns with no wait when the run is gone, when `cancelled` holds the id, or when the status is not `queued`, `running` or `merging` (D4).
  2. It calls `createWait` with kind `error`, `specDir` from `PathUtils.getSpecPath(run.specStore, run.spec)`, and one question: id `DRIVE_CRASH_QUESTION`, text `step ${stepKind} failed inside the controller: ${message}`, options `['retry', 'abandon']`, recommended `retry`. `stepKind` is `run.cursor?.stepKind ?? 'unknown'`, since a throw from `ensureWorktree` on a fresh run has no cursor. `message` is `err.message` for an `Error`, else `String(err)`.
  3. It re-reads the run and calls `this.save` with `{ status: 'waiting', inFlight: undefined }`.
  4. Any throw in steps 1-3 is caught and logged; the run stays as it is (Requirement 2 AC 4).
- **Drive end.** `startDrive`'s `.finally` (`src/controller/controller.ts:419`) deletes the `drives` entry, then reads the run and emits `runEvents` `change` with it. Post-condition: at that emit `drivenRuns()` no longer holds the id, for a return and for a throw. A failed read is logged. The feed then flushes within its 1-second throttle, inside the 5-second bound.
- **`redrive` post-conditions**, in order:
  1. No run: `not-found`.
  2. `this.started` false, or `drivenRuns()` holds the id: `not-stalled`, no change.
  3. Status `running`: `startDrive(runId)`, `ok`. A pending hold parks at the loop-top stop (`src/controller/runs.ts:850-858`), because `startDrive` does not read `pauseRequested`; Requirement 3 AC 8 holds with no new code.
  4. Status `waiting` with `openDriveCrashWait(runId)` found: `answerWait(wait.id, { [DRIVE_CRASH_QUESTION]: 'retry' }, 'operator')`, `ok`. `onWaitChange` (`src/controller/controller.ts:438-466`) re-queues the run, or parks it when held.
  5. Otherwise `not-stalled`, no change.
- **`recover`** (`src/controller/controller.ts:304-317`):
  - `running`, step dead or none: `await setRunHeartbeat(this.now, run.id, undefined)`, then `startDrive`.
  - `running`, step alive: `reattach` unchanged at entry, so the stored value stays.
  - `waiting` with an open drive-crash wait: `await expireWait(wait.id)`, then `startDrive(run.id)`. No other `waiting` run changes; `resumeIfWaitAnswered` still runs for them.
- **`reattach`** (`src/controller/controller.ts:320-332`): when the pid dies, the poll clears its timer, awaits `setRunHeartbeat(..., undefined)` (logging a failure), and only then deletes from `active` and calls `startDrive`. `active` holds the run across the await, so `driven` never reads false in that gap.

### C6 — Wait helpers (`src/controller/waits.ts`)
- **Interfaces:**
  - `export const DRIVE_CRASH_QUESTION = 'drive-crash'`.
  - `openDriveCrashWait(runId: string): Promise<ControllerWaitRecord | undefined>` — the open wait for that run with a question of that id, from `listOpenWaits` (`src/controller/waits.ts:187-190`).
  - `expireWait(id: string): Promise<ControllerWaitRecord | undefined>` — through `enqueueWaitWrite` (`:73-84`); an open wait becomes `expired`, is written, and `change` is emitted; any other state returns unchanged with no write.
- **Post-condition:** `onWaitChange` ignores the expired record (`src/controller/controller.ts:439`), and `listWaitsForView` hides it (`src/controller/waits.ts:193-198`).
- **Reuses:** `createWait` and `answerWait` unchanged (`src/controller/waits.ts:87-141`). `expireWait` writes no `questions.md` and no ledger row.

### C7 — Re-drive route (`src/dashboard/multi-server.ts`)
- **Interfaces:** `POST /api/controller/runs/:id/redrive`, placed after the resume route (`src/dashboard/multi-server.ts:832-838`). `not-found` answers 404 `{ error: 'run-not-found' }`, `not-stalled` answers 409 `{ error: 'not-stalled' }`, `ok` answers 200 `{ ok: true }`.
- **Post-condition:** the app-level `onRequest` hooks (`src/dashboard/multi-server.ts:275-282`) cover it with no per-route code.

### C8 — Notify config (`src/advisor/home.ts`, `src/advisor/summary.ts`)
- **Interfaces:**
  - `notifyConfigPath()` replaces `pushConfigPath()` (`src/advisor/home.ts:39-41`) and returns `join(controllerHome(), 'notify.json')`. The old name is removed, so a leftover reader fails `tsc`.
  - `readNotifyConfig(): Promise<NotifyConfig | undefined>` in `src/advisor/home.ts`.
  - `notifyConfigIsLoose(): Promise<boolean>` — true when `fs.stat(...).mode & 0o077` is non-zero; false when the file cannot be read.
- **Post-conditions:** `readNotifyConfig` returns `undefined` for a missing or unparsable file, `v` not 1, `ntfy.url` or `ntfy.topic` not a non-empty string, or `ntfy.token` present and not a string. `pushState` (`src/advisor/summary.ts:93-100`) returns `on` exactly when `readNotifyConfig` returns a value, so the hello and the sender cannot disagree on a malformed file.

### C9 — Wait pusher (`src/advisor/push.ts`)
- **Purpose:** send the ntfy message and the one reminder.
- **Interfaces:**
  - `WaitPusherOptions` (`src/advisor/push.ts:48-51`) gains `now?: () => Date` and `sweepMs?: number` (default 60,000).
  - Public `sweepReminders(): Promise<void>`, the timer's entry and the test seam. It runs through the existing queue (`:145-152`).
  - Exported pure `buildMessage(wait: WaitRecord, projectName: string, reminder: boolean): { title: string; body: string }`.
- **Start:** `start()` reads the config once. Missing or invalid: one `console.error` saying push is off. Valid and loose: one warning. Neither line prints the url, topic or token. `attemptPush` still reads the config at each send, so a file added later needs no restart. After the start-up scan, `start()` enqueues one sweep and arms an unref'd `setInterval` of `sweepMs`; `stop()` clears it.
- **Recording a new wait** (`runStartupScan` loop and `handleWait`, `src/advisor/push.ts:166-172`, `:175-186`): read the config. With a config, add the id to `ids` and set `firstPush[id]` to `now()`. Without one, add it to `ids` and `reminded`. Write the record, then POST. The record is written before the POST, as today, so a crash cannot double-send. A POST that fails twice leaves the reminder armed (D10).
- **First start** (no readable record): `ids` and `reminded` both take every open wait; nothing is sent (Requirement 4 AC 6, Requirement 5 AC 5).
- **`sweepReminders` post-conditions:** for each id in `firstPush`, not in `reminded`, with `now() - firstPush[id] >= 3_600_000`: read the wait, add the id to `reminded`, write the record, and POST with `reminder: true` only if the wait is `open` and a config reads. The id is recorded before the POST, so a failed reminder is not rescheduled and a restart cannot send a second one. A restart past the hour sends through the sweep `start()` enqueues.
- **POST:** `fetch(url.replace(/\/+$/, '') + '/' + topic, { method: 'POST', headers, body })`. `res.ok` false or a throw is a failure (`src/advisor/push.ts:206-217`). The retry and the `push.failure` row keep their shape (`:188-204`); `detail` names the url and whether it was a reminder, never the topic or token.
- **Headers:** `Title`, `Priority: 4`, and `Authorization: Bearer <token>` only when `token` is present. No `content-type` is set.
- **`buildMessage`:**
  - Body line 1: `${kind} | ${projectName} | ${spec}`, prefixed `Reminder: ` for a reminder.
  - Body line 2: `wait.questions[0].text.trim()` cut at the first line break, with paths redacted; left out when the wait has no question.
  - Title: `SDD ${kind}`, or `SDD reminder: ${kind}`.
  - Redaction: an absolute or `~/` file path of two or more segments becomes `[path]`. `/home/mcf/repo/x.ts` is redacted; a relative path and an `https://` URL are not. A crash message can quote a path, and Requirement 4 AC 3 allows none (D12).
- **Project name:** `readProjects()` (`src/controller/state.ts:504-506`), the entry whose `id` equals `wait.project`, its `name`; else, or on a read failure, `wait.project`.
- **Probe (node 24.13.0, local capture server):** `fetch` sent the three headers as given and a UTF-8 body intact, with `content-type: text/plain;charset=UTF-8`. A header value of `日本` threw `TypeError`. The title therefore holds only the wait kind, which is ASCII (`src/controller/state.ts:140-147`).
- **UNCONFIRMED — Requirement 4 AC 4.** The design could not read the ntfy documentation: the fetch of `docs.ntfy.sh/publish` was denied in the drafting session, and no local copy exists. The `Authorization: Bearer` header, the `Title` and `Priority` header names, the priority value and any body size limit are therefore pinned provisionally. The task that writes the POST SHALL read that page first and record the result in its implementation log. If the page disagrees, it stops and escalates rather than shipping the header. The tests prove only what the sender emits, not what ntfy accepts.

### C10 — Launch routing (`src/dashboard/harness/run-setup.ts`)
- **Change:** the guard at `src/dashboard/harness/run-setup.ts:197-199` becomes `routing.state !== 'active' ? nextUnstartedSpec(workflowRoot) : null`. The union has five members (`src/core/spec-routing-deriver.ts:8-18`), so this names exactly the four states of Requirement 6 AC 1.
- **Post-conditions:** `launchable` and `disabledReason` (`:200-201`) keep their code. `harnessNotLaunchable` (`src/dashboard/multi-server.ts:79-87`) and `validateSetup` (`src/dashboard/harness/run-setup.ts:265-267`) compare against `view.launchable`, and the dashboard reads `launchable` and not `routing.state` (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:406`), so no other site changes.

### C11 — Docs
- `docs/controller-design.md:335-340`: rewrite the Push bullet of §16 for `notify.json`, the message fields, the reminder and the D2/D3 supersession.
- `docs/SDD-HARNESS.md:76`, `:576-578`: same; `:166` adds the Re-drive route.
- `src/advisor/push.ts:1-18`: the header comment names `notify.json` and the new body.

### Enumerated, no change
- `isProcessAlive` (`src/controller/state.ts:612-615`): recovery still decides with it.
- `settlePass` (`src/controller/controller.ts:381-396`): a stalled `running` run is not settled; a pending hold applies at Re-drive's loop-top stop.
- `resumeNow` (`src/controller/controller.ts:240-267`): clears a hold as today and starts no drive.
- `waitAnd` (`src/controller/runs.ts:566-575`): no push here (requirements D1).
- `src/controller/activity.ts`: untouched; the heartbeat never calls it.
- `launchSpec` (`src/dashboard/multi-server.ts:101-128`): the folder creation at `:118-120` already serves the new states.
- `scripts/sdd-watchdog.sh`: unchanged; its wait reaches the pusher through the file watch.
- `src/dashboard/shell/sidebar-rows.ts:36-44`: reads `updated`, so its column turns fresher while a step streams.

## Data Models

### `notify.json` (operator-written, mode 0600)
```
{ v: 1, ntfy: { url: string, topic: string, token?: string } }
```

### `pushed.json` (additive; `v` stays 1)
```
{
  v: 1,
  ids: string[],                        // every wait seen
  firstPush?: Record<string, string>,   // id -> ISO of the first push attempt
  reminded?: string[]                   // ids that get no (further) reminder
}
```
A reminder is due only for an id in `firstPush` and not in `reminded`. A file written by today's code has neither new field, so its ids never get a reminder and no migration runs. A file with no `ids` array counts as unreadable (a first start). Each write drops, from all three fields, any id whose wait file is gone (`src/advisor/push.ts:104-111`).

## Error Handling

1. **Heartbeat write fails:** logged; the step continues and the next window tries again.
2. **Crash wait or run write fails:** logged, run unchanged, row reads `running` with `driven: false`; Re-drive recovers it.
3. **`createWait` succeeds, the run write fails:** the run reads stalled and an open wait remains. Re-drive takes the `running` branch; a later answer to that wait is ignored, because `onWaitChange` returns unless the run is `waiting` (`src/controller/controller.ts:449-450`).
4. **`notify.json` missing or malformed:** one log line per start; ids are still recorded; waits and runs are unaffected.
5. **POST fails twice:** one `push.failure` row. A first-push reminder stays armed; a failed reminder is not rescheduled.
6. **`pushed.json` corrupt:** a first start. **Project list unreadable:** the message uses the project id.

## Testing Strategy

Tests assert only on the `close` exit code, stdout by line (never chunk boundaries), `fs.stat` `mode` bits and `fetch` results. Node 20 is not installed locally (only 22 and 24); no timing decision rests on a probe, and CI runs node 20.

- **Unit:**
  - New `src/controller/__tests__/heartbeat.test.ts`, on `vi.useFakeTimers()` with a fake `write` and no fs: each C3 post-condition.
  - `state.test.ts`: each C1 post-condition; carry-over through a stale `writeRun`, with and without `ownsPauseRequest`; a heartbeat queued after a status write keeps the status.
  - `step.test.ts`: `line()` fires for a non-`tool_use` event and not for noise; `end()` fires once on close and once on spawn failure.
  - `waits.test.ts`: `expireWait`, `openDriveCrashWait`. `runs.test.ts`: the row carries `lastActivity`, and `driven` from the set, default `false`.
  - `src/dashboard/shell/__tests__/shell-feed.test.ts`: `drivenRuns` reaches the `controller-runs` row.
  - `src/dashboard/harness/__tests__/run-setup.test.ts`: `ambiguous` and `all-deferred` with an unstarted heading; null from `nextUnstartedSpec` keeps the routing reason. `active` and `all-on-disk-complete` are regression guards.
  - `src/advisor/__tests__/push.test.ts`: `buildMessage` (fields, marker, no-question wait, redaction, multi-line text); bearer header present and absent; on the injected `now` plus `await sweepReminders()`: due, answered first, expired first, failed and not rescheduled, restart past and inside the hour, first start, legacy record; the no-config path; the loose-mode warning; no topic or token in a `push.failure` row or a log.
- **Assertions that change:** at least these, widen to every assertion the rename or body change touches: `src/advisor/__tests__/push.test.ts:212`, `:304-305`; `src/advisor/__tests__/home.test.ts:67`, `:79`; `src/advisor/__tests__/summary.test.ts:409`; `src/advisor/__tests__/advisor-e2e.test.ts:438-440`. Find them with `grep -rn "pushConfigPath\|push\.json\|dashboardUrl" src/advisor/__tests__`.
- **Integration:** `controller.test.ts` with the existing stub `claude` bin: a one-shot throw through the existing `mcpConfigFor` option (`src/controller/controller.ts:54`, called at `src/controller/runs.ts:832`) gives the crash wait, `waiting`, no `inFlight`, and a change event with the id out of `drivenRuns()`; answers `retry` and `abandon` (regression guards); every `redrive` outcome, including a held run parking `paused` and a controller never started; the C5 `recover` branches. `src/dashboard/__tests__/controller-dashboard-routes.test.ts`: the route's 404, 409 and 200, and `driven` on the GET row.
- **End-to-end** (decomposition scenarios, in a new `src/controller/__tests__/liveness-e2e.test.ts` unless noted):
  1. A stub step streams lines: `lastActivity` appears, is absent within 1 second of the end, and a status change during the step survives. `heartbeat.test.ts` proves the 10-second cadence, not real waits.
  2. A throw through `mcpConfigFor`: `driven: false` within 5 seconds, wait text names step and message, `redrive` resumes from the cursor; after a restart the run is driven with no action.
  3. A stub step killed by signal: retried as today, `driven` stays true (regression guard).
  4. In `push.test.ts`, a capture server stands in for ntfy: one message, one reminder on the injected clock, nothing after an early answer; an absent file writes the wait and logs.
  5. An `ambiguous` project with an unstarted heading: `launchable` is that name, and `launchSpec` creates the directory.

## Decisions taken in this document

- D1 — The heartbeat is one step-scoped object on the step spec: options were two callbacks on every caller, a process-wide emitter, or one object; chosen because ending it makes every late line a no-op, with no per-run state to leak.
- D2 — The heartbeat has its own chained writer, and the general run write always takes the field from disk: options were that, an ownership flag like the pause request, or a read-modify-write in the driver; chosen because no other caller ever owns the field.
- D3 — The stored value is the time of the last parsed line: options were that or the time of the write; chosen because the requirement bounds the value against the last line, and a trailing write would otherwise overstate liveness.
- D4 — RE-DECIDED: a crashed drive opens a wait only when the run is queued, running or merging: options were every throw or only those statuses; chosen because a throw on a terminal run would revive an abandoned run, and a throw after a park would stack a second wait.
- D5 — The crash wait is recognised by a question id, not a new wait kind: options were those two; chosen because the requirement keeps the error kind, so the existing answer path applies.
- D6 — The drive-end change event fires after the drive entry is removed: options were the drive's own finally block or the tracking promise's; chosen because only the later point guarantees the row reads not-driven at the emit.
- D7 — RE-DECIDED: a process without the controller lock answers Re-drive with 409 not-stalled: options were that, a new 503 code, or a silent 200; chosen because that process cannot drive, a 200 would lie, and the error set stays as the requirement lists it.
- D8 — The reminder runs from a 60-second sweep over the pushed record: options were per-wait timers re-armed on start, or a sweep; chosen because a sweep needs no arming or cancelling, covers restart with the same code, and gives the clock seam; the cost is up to 60 seconds of lateness.
- D9 — The pushed record stays version 1 and gains two optional fields: options were a keyed shape with a migration, a separate file, or additive fields; chosen because an old file then reads correctly with no migration.
- D10 — A failed first POST still arms the reminder, and a wait seen with no config never does: options were arming on success only, or on every recording; chosen because the reminder is the only second chance after a failed send, and with no config nothing was pushed.
- D11 — The ntfy title is SDD plus the wait kind, priority is 4 on every message, and every required field sits in the body: options were a title with the project name, priority by kind, or the default priority; chosen because a non-Latin-1 header value throws in the probe, every wait blocks the operator, and a body-complete message survives a dropped header. Provisional until the ntfy page is read.
- D12 — RE-DECIDED: file paths in the question's first line become a marker: options were send it verbatim, drop the line for error waits, or redact; chosen because the requirement bans paths and also asks for the first line, and a crash message can quote a path.
- D13 — The config reader lives in the advisor home module and the hello's push state uses it: options were a new module, the pusher file, or the home module; chosen because the summary should not import the file watcher, and both readers then share one validity rule.
- D14 — The driven set enters the row as an optional trailing argument: options were a module-level registry or an argument; chosen because the row functions stay pure and a process with no controller reads false by default.
- D15 — The end-to-end throw uses the existing MCP-config option as its seam: options were a new test-only hook or that option; chosen because it adds no production code for tests.

## Scope notes

- Cut: nothing from the decomposition entry.
- Deferred, as the requirements fix: deriving and rendering stalled, and any Re-drive button, belong to the later dashboard specs. No frontend code changes except the type declaration.
- Open item: Requirement 4 AC 4 asks the design to confirm the bearer header against the ntfy documentation. That confirmation did not happen (see C9); it moves to the push task, which also settles the title, priority and body-size questions. No body length cap is pinned, because no limit could be confirmed.
- Reminder anchor: the gate A receipt records the reminder as scheduled from the wait's created time; Requirement 5 AC 1 (v3) moved it to the first push. This design follows the requirements. The operator should confirm that change.
- Dropped from the message: `dashboardUrl` (Requirement 4 AC 3 allows four fields only).
- Carried items from the requirements phase: none.

## Revision History

- **v1** (2026-11-03) — Initial draft.
