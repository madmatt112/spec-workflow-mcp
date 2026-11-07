# Tasks Document

Document version: v1

Dependency order: run the tasks in number order; the chains are 1 and 2 → 3 → 4, 5 → 15, 6 → 11, 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19, then 16 to 19 → 20 to 22 → 23. Each task leaves `npx tsc --noEmit` and every vitest suite green, and the frontend stays buildable, but the Playwright suites other than `e2e/worktree-board.spec.ts` go red at task 11 and stay red until tasks 20 to 22 rewrite them (D41). Line citations are to base `59fc65f3`; where an earlier task here edited the file, the named symbol is the anchor and the implementer re-resolves the line.

- [x] 1. Record the step's wall-clock start and task on the in-flight record
  - File: src/controller/state.ts
  - File: src/controller/runs.ts
  - File: src/controller/phases/implementation.ts
  - File: src/controller/__tests__/runs.test.ts
  - File: src/controller/phases/__tests__/implementation.test.ts
  - Test: src/controller/__tests__/runs.test.ts — `stepLifecycle(deps, runId).onStepSpawn(step)`
  - Test: src/controller/phases/__tests__/implementation.test.ts — `runImplementationPhase(ctxFor(fx, { onStepSpawn }))`
  - Note: both test files keep every asserted value. The clear on step end (`src/controller/__tests__/runs.test.ts:296`) holds at base: regression guard.
  - Purpose: The run record holds what the tile's step age and task read.
  - _Leverage: src/controller/state.ts:39-46, src/controller/runs.ts:449-465, src/controller/phases/implementation.ts:95, src/controller/phases/implementation.ts:444-469, src/controller/phases/__tests__/implementation.test.ts:209_
  - _Requirements: 12.2_
  - _Prompt: Task: Per design C1 and D27, add optional `startedAt` and `task` strings to `InFlightStep` (`src/controller/state.ts:39-46`). Make `stepLifecycle`'s `onStepSpawn` (`src/controller/runs.ts:449-465`) accept an optional `task` and write both into `inFlight`, with `startedAt` from `deps.now().toISOString()` (requirement 12 AC 2). Export `stepLifecycle` so the test can call it (D46). Add `task?: string` to `onStepSpawn` on `ImplementationPhaseContext` (`src/controller/phases/implementation.ts:95`) and pass `opts.task` at the `onSpawn` call (`:469`) | Restrictions: Change no other phase's context (`document.ts`, `closeout.ts`, `retrospective.ts`, `merge-fix.ts` keep their narrower callback); add no new clear site; `startTime` stays the `/proc` value | Success: `onStepSpawn` with a task writes `inFlight.startedAt` equal to the injected clock's ISO string and `inFlight.task` equal to that task; `onStepSpawn` with no task writes `startedAt` and no `task` key; `onStepEnd` leaves `inFlight` undefined, so both fields clear (regression guard); during a task step the `onStepSpawn` passed to `runImplementationPhase` receives that task's id; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/runs.test.ts src/controller/phases/__tests__/implementation.test.ts` pass_

- [x] 2. Add the cached branch-presence read
  - File: src/controller/branch-presence.ts
  - File: src/dashboard/harness/worktree.ts
  - File: src/controller/__tests__/branch-presence.test.ts
  - Test: src/controller/__tests__/branch-presence.test.ts — `branchPresent(run, read, now)`
  - Note: new module with no caller yet. `src/dashboard/harness/__tests__/worktree.test.ts` keeps every asserted value.
  - Purpose: One git read per stopped run per 60 s, shared by the feed and the GET route.
  - _Leverage: src/dashboard/harness/worktree.ts:119-128, src/controller/state.ts:15_
  - _Requirements: 12.1, NFR Performance, NFR Reliability_
  - _Prompt: Task: Per design C2 and D28, create `src/controller/branch-presence.ts` with `branchPresent`, `forgetBranchPresence` and the `BranchRead` type as design pins them. The default read is `branchExists` (`src/dashboard/harness/worktree.ts:119-128`), exported as is. The cache maps run id to the time and the read's promise | Restrictions: Change nothing else in `worktree.ts`; assert only the read's success or failure, never `child_process` fields; each test calls `forgetBranchPresence` first, because the cache outlives a test | Success: Two overlapping calls for one run call the read once and both resolve to its value; a call 59,999 ms after the first calls no read; a call 60,000 ms or more after it reads again (NFR Performance); `forgetBranchPresence` makes the next call read; an empty branch gives `false` with no read; a rejected read gives `false` (NFR Reliability); two run ids hold separate entries; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/branch-presence.test.ts src/dashboard/harness/__tests__/worktree.test.ts` pass_

- [x] 3. Carry the tile fields on the run row
  - File: src/controller/state.ts
  - File: src/controller/controller.ts
  - File: src/controller/runs.ts
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: src/controller/__tests__/runs.test.ts
  - Test: src/controller/__tests__/runs.test.ts — `listRunsForWire(driven, branchRead)`
  - Note: existing `listRunsForWire` tests read single fields, so no asserted value changes. `driven`, `lastActivity`, `prReads`, `holdBy` and `stepKind` are regression guards.
  - Purpose: Every tile field reaches the wire with no path.
  - _Leverage: src/controller/runs.ts:1428-1471, src/controller/controller.ts:788-791, src/controller/__tests__/runs.test.ts:506, src/dashboard/shell/types.ts:195, src/dashboard_frontend/src/modules/shell/types.ts:215-239_
  - _Requirements: 7.6, 7.7, 12.1, 12.3, 12.4, NFR Security_
  - _Prompt: Task: Per design C3, Data Models and D25, move `isLive` (`src/controller/controller.ts:788-791`) to `state.ts` as an export and import it back. Export `branchHeld(run, runs)` from `runs.ts`. Give `listRunsForWire` the optional trailing `branchRead` parameter: it resolves presence for `done`, `abandoned` and `error` runs through the read task 2 exports, then maps `toRow`. Add the five Data Models fields to `ControllerRunRow` and to both hand copies | Restrictions: No filesystem path on the row (`src/controller/runs.ts:1425`); no read for a moving run; both existing callers keep passing one argument | Success: A row with `inFlight` set reads `inFlight: true`, and one without reads `false`; `stepStarted` and `task` come from the record's `inFlight`; an `inFlight` with no `startedAt` gives no `stepStarted` (requirement 12 AC 3); a stopped run's `branchPresent` is the read's value for each of `done`, `abandoned` and `error`; a rejected read gives `false`; a moving run with a branch gives `true` and a moving run with `branch: ''` gives `false`, each with the read not called; `branchHeld` is true for another moving run with the same `codeRoot` and branch; true for a moving run with an empty branch, the same `codeRoot` and the same spec (D25); false for a different `codeRoot`, a stopped other run, and the run itself; `discardAllowed` is its negation; `JSON.stringify(row)` holds neither `codeRoot` nor `worktree`; the five base fields keep their values (regression guards); `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/runs.test.ts` pass_

- [x] 4. Guard Discard and keep a done run done
  - File: src/controller/controller.ts
  - File: src/controller/runs.ts
  - File: src/dashboard/multi-server.ts
  - File: src/controller/__tests__/runs.test.ts
  - File: src/controller/__tests__/controller.test.ts
  - File: src/dashboard/__tests__/controller-dashboard-routes.test.ts
  - Test: src/controller/__tests__/runs.test.ts — `discardRun(deps, runId)`
  - Test: src/controller/__tests__/controller.test.ts — `controller.discard(runId)`
  - Test: src/dashboard/__tests__/controller-dashboard-routes.test.ts — `POST /api/controller/runs/:id/discard`
  - Note: `src/controller/__tests__/controller.test.ts:2402-2403` needs narrowing for the new return type, because tsc covers tests; its value `abandoned` stays. `runs.test.ts` and the route test keep every asserted value.
  - Purpose: Discard cannot delete a branch a live run uses.
  - _Leverage: src/controller/controller.ts:231-245, src/controller/controller.ts:373-378, src/controller/runs.ts:1374-1422, src/dashboard/multi-server.ts:859-864, src/controller/state.ts:751-762_
  - _Requirements: 7.7, 7.8_
  - _Prompt: Task: Per design C4 and D26, make `Controller.discard` return the record, undefined or the sentinel `branch-in-use`. Inside `withStoreLock(run.specStore, …)` it re-reads the run, checks the guard task 3 exports, then discards; the first read only finds the store. The discard route answers 409 `{ error: 'branch-in-use' }` on the sentinel. `discardRun` skips `cancelRun` when the run is `done` (requirement 7 AC 8). After the git and `gh` cleanup it calls the forget function task 2 exports, then emits `runEvents` `change` | Restrictions: On `branch-in-use` touch nothing: no `cancelled` entry, no queue edit, no write; the 404 stays for a missing run | Success: A `done` run discarded stays `done` on disk with its worktree and branch gone; an `abandoned` run discarded stays `abandoned`, and a `running` run ends `abandoned` as today (regression guards); `change` fires after the cleanup, seen as the branch already gone when the listener runs; the next presence read after discard calls the read again; `controller.discard` on a run whose branch a moving run holds returns the sentinel, leaves the run file byte-identical, leaves the queue unchanged and leaves the run out of `cancelled`; the same call with an empty-branch queued relaunch of that spec returns the sentinel; the route answers 409 with that body; a missing id answers 404 (regression guard); `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/runs.test.ts src/controller/__tests__/controller.test.ts src/dashboard/__tests__/controller-dashboard-routes.test.ts` pass_

- [x] 5. Add the launchable spec's decomposition position to the setup view
  - File: src/dashboard/harness/types.ts
  - File: src/dashboard_frontend/src/modules/harness/types.ts
  - File: src/dashboard/harness/run-setup.ts
  - File: src/dashboard/harness/__tests__/run-setup.test.ts
  - Test: src/dashboard/harness/__tests__/run-setup.test.ts — `buildSetupView(project, {})`
  - Note: the `buildView` fixture (`src/dashboard/harness/__tests__/run-setup.test.ts:317-323`) gains the field so tsc passes; no asserted value changes.
  - Purpose: Next can sort by decomposition order with no new route.
  - _Leverage: src/dashboard/harness/run-setup.ts:146-233, src/dashboard/harness/types.ts:33-42, src/dashboard_frontend/src/modules/harness/types.ts:149-158_
  - _Requirements: 3.9_
  - _Prompt: Task: Per design C5 and D29, add `launchableOrder: number or null` to `SetupView` and its hand copy, and a `decompositionPosition(workflowRoot, spec)` that `buildSetupView` uses. Reuse the heading regex of `nextUnstartedSpec` (`src/dashboard/harness/run-setup.ts:224-233`) through one shared constant | Restrictions: Leave `nextUnstartedSpec`'s behaviour alone; no new route | Success: A launchable spec named in the third heading gives `2`; a heading tagged `(deferred)` counts toward the index; a launchable spec no heading names gives `null`; a null `launchable` gives `null`; a store with no `decomposition.md` gives `null`; the decomposition fallback spec gets its position too; `npx tsc --noEmit` and `npx vitest run src/dashboard/harness/__tests__/run-setup.test.ts` pass_

- [x] 6. Add the display, tile and band tokens and the tile class
  - File: src/dashboard_frontend/src/modules/theme/tokens.css
  - File: src/dashboard_frontend/src/modules/ui/ui.tsx
  - File: src/dashboard/__tests__/frontend-tokens.test.ts
  - Test: src/dashboard/__tests__/frontend-tokens.test.ts — `THEME_INDEPENDENT_NAMES` against the `@theme static` block
  - Note: adds only. `--sidebar-w` and `--row-h-compact` stay as a bridge until task 17, because `Sidebar.tsx` and `ShellProvider.tsx` still read them. Colour values are a regression guard. The name list grows; `frontend-build.test.ts` and `frontend-style-scan.test.ts` keep their values. Count grep: `grep -n panel-w src/dashboard/__tests__/frontend-tokens.test.ts`.
  - Purpose: The type and spacing scale the tiles use.
  - _Leverage: src/dashboard_frontend/src/modules/theme/tokens.css:4-59, src/dashboard_frontend/src/modules/ui/ui.tsx:132-157, src/dashboard/__tests__/frontend-tokens.test.ts:126-127, src/dashboard/__tests__/frontend-tokens.test.ts:193-197_
  - _Requirements: 11.1, 11.2_
  - _Prompt: Task: Per design C12 and D16, add to `@theme static` the seven names design pins: `--text-display` 32px with its line height 40px, `--text-tile` 15px with its line height 22px, `--tile-pad` 20px, `--tile-gap` 16px, `--band-gap` 32px. Add them to the test's name list. Add `tile(tone)` to the `ui` constants for `neutral`, `warning` and `danger`: `--surface-panel` stays the fill and the tone colours the border (design C10) | Restrictions: Delete no token here; change no line of `src/dashboard_frontend/src/modules/theme/tokens.css:9-17` or `:61-160`; declare no value outside `tokens.css` | Success: The seven names are declared in `@theme static` once each; `--text-display` is at least 32px and `--text-tile` at least 14px (requirement 11 AC 2); the steps at `:9-17` keep their values; every colour value keeps its value (regression guard, requirement 11 AC 1); `npx vitest run src/dashboard/__tests__/frontend-tokens.test.ts src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` passes_

- [x] 7. Add the project enable rules and the explicit-on key
  - File: src/dashboard_frontend/src/modules/projects/enable.ts
  - File: src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx
  - File: src/dashboard/shell/__tests__/board-view.test.ts
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `isEnabled(id, name, off, on)`
  - Note: no renderer exists for `ProjectProvider.tsx` (D42); task 16's browser cases prove it (a deliberate bridge). Every `enabled` and `toggle` caller keeps its signature.
  - Purpose: `sdd-fixture` is off until the operator turns it on, and the choice survives a reload.
  - _Leverage: src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:28-39, src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:74-91, src/dashboard/shell/__tests__/deploy-view.test.ts:12-17_
  - _Requirements: 1.6, 1.7_
  - _Prompt: Task: Per design C8, D15, D24 and D32, create pure `enable.ts` with `isEnabled`, `toggled` and `DEFAULT_OFF_NAMES`. `ProjectProvider` reads a second key `shell.projects.on` beside `shell.projects`, and `enabled(id)` and `toggle(id)` look the name up in `projects`. Create `board-view.test.ts` loading frontend modules at runtime as `deploy-view.test.ts` does, because a static import fails tsc | Restrictions: `shell.projects` keeps its meaning; an id not yet listed is enabled, as at base; no migration | Success: An id in `on` is enabled even when also in `off` and even when named `sdd-fixture`; an id in `off` only is disabled; an unset `sdd-fixture` is disabled; any other unset project, each tradr entry included, is enabled (D24); `toggled` on an unset `sdd-fixture` puts its id in `on`; `toggled` on an enabled project puts its id in `off` and removes it from `on`; toggling twice returns the first answer; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/board-view.test.ts src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` pass_

- [x] 8. Add the board's band lists
  - File: src/dashboard_frontend/src/modules/shell/board.ts
  - File: src/dashboard/shell/__tests__/board-view.test.ts
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `needsYou(waits, actions, enabled)`
  - Note: new module with no caller yet, so the build does not reach it until task 11 (a deliberate bridge). Value imports of `pause.ts` and `stores.ts` are allowed (D45).
  - Purpose: Which tiles exist, and in what order, as pure functions.
  - _Leverage: src/dashboard_frontend/src/modules/shell/deploy.ts:7-28, src/dashboard_frontend/src/modules/projects/stores.ts:25-43, src/dashboard_frontend/src/modules/shell/types.ts:177-268_
  - _Requirements: 3.5, 3.6, 3.7, 3.9, 5.1, 5.2, 5.3, 7.6, 8.2, 8.4_
  - _Prompt: Task: Per design C9, create `board.ts` with `needsYou`, `running`, `stoppedAdmitted`, `nextProjects` and `nextTiles` as the table pins them, for requirement 3 AC 5 to 7 and 9, requirement 5 AC 1 to 3, requirement 7 AC 6 and requirement 8 AC 2 and 4 (D2, D10, D11, D12, D17). Reuse `storeGroups` | Restrictions: No React import; no `fetch`; no field a run row does not carry | Success: `needsYou` holds open waits and `staged` and `running` actions, oldest `created` first, across both kinds; it drops `answered` and `expired` waits, and `done`, `refused`, `failed` and `dismissed` actions, each tested; it drops a wait and an action on a disabled project; an action with no string `target.project` stays when every project is off; `running` holds each of `queued`, `running`, `merging`, `paused` and `waiting`; moving runs sort by `lastActivity`, else `updated`, oldest first; admitted stopped runs follow, newest `updated` first; a disabled project's run is dropped; `stoppedAdmitted` admits `abandoned` and `error` with `branchPresent`; refuses each without it; admits `done` with `branchPresent` at 23h59m old; refuses it at exactly 24 hours and with no branch; `nextProjects` gives one project per store: the representative when on, else the first enabled member, and none when the group is off; `nextTiles` drops a null `launchable`, sorts by `launchableOrder` with null last, and breaks ties by project name; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/board-view.test.ts` pass_

- [x] 9. Add the tile facts and the pausing note
  - File: src/dashboard_frontend/src/modules/shell/board.ts
  - File: src/dashboard_frontend/src/modules/shell/pause.ts
  - File: src/dashboard/shell/__tests__/board-view.test.ts
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `runControls(run, waits)`
  - Note: `src/dashboard/shell/__tests__/deploy-view.test.ts` asserts neither changed string, so it keeps every value. `e2e/worktree-shell.spec.ts:468` and `:553` assert the old text; task 20 rewrites them (a deliberate bridge).
  - Purpose: Every tone, dot, control and line a tile shows, as pure functions.
  - _Leverage: src/dashboard_frontend/src/modules/shell/pause.ts:27-48, src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78, src/controller/waits.ts:193, src/controller/merge.ts:28, src/controller/merge.ts:556, src/controller/controller.ts:205-222_
  - _Requirements: 3.7, 4.1, 4.2, 4.3, 6.2, 6.3, 6.4, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 8.3, 10.1, 10.2, 10.3_
  - _Prompt: Task: Per design C9, add to `board.ts` `ageTone`, `runDot`, `isStalled`, `runControls`, `mergeRead`, `waitSummary`, `setupLine`, `compactAge` and `tabTitle` as the table pins them. `waitSummary` is `ctrlSummary` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78`) verbatim. In `src/dashboard_frontend/src/modules/shell/pause.ts` the strings at `:43` and `:45` become `pausing after this step` (requirement 6 AC 6) | Restrictions: Nothing else in `pause.ts` changes; leave `NowPage.tsx` alone, its copy goes with the file; `DRIVE_CRASH_QUESTION` is a hand copy of `src/controller/waits.ts:193` | Success: `ageTone` is `neutral` at 899,999 ms, `warning` at 900,000 and 3,599,999, `danger` at 3,600,000; `runDot` is `grey` with no step in flight and with no heartbeat base (D38), green at 299,999 ms, amber at 300,000 and 899,999, red at 900,000; the age runs from `lastActivity` when set, else `stepStarted`; `isStalled` is true for `running` with `driven: false` and for `waiting` with an open `drive-crash` wait; false for `waiting`, `paused`, `queued` and `merging` with `driven: false` and no such wait (D7); `runControls` gives pause and stop for a moving unheld run, resume and stop for an operator-held one, resume for a usage pause, no resume and pause for a deploy-held run (requirement 6 AC 7, regression guard for the note), stop never on a stopped run, discard for a stopped run only when `discardAllowed`, and redrive only when stalled; `mergeRead` takes the `kind: 'run'` read for question id `merge`, the matching read for `merge:repo#7`, and `null` when none matches; `waitSummary` gives the count text for `gate-a`, `gate-b` and `retro-plan`, the whole first question text for the others, and each kind's fixed line with no question; `setupLine` reads `supervisor m · 2 roles · worktree yes · gates record` and says `record` when `view.gates` is `block`; `compactAge` gives `59m`, `1h0m`, `4h20m`, `1d0h`, with no space or seconds; `tabTitle` gives `2 · 4h20m` for two open enabled waits, ignores answered waits and disabled projects, and returns `base` when none is left; `pauseNote` reads `pausing after this step` for a running run and ends `· pausing after this step` for a waiting run; an applied operator pause reads `paused by you` and a deploy hold `held for deploy` (regression guards); `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/board-view.test.ts src/dashboard/shell/__tests__/deploy-view.test.ts` pass_

- [x] 10. Add the press stages
  - File: src/dashboard_frontend/src/modules/shell/stage.ts
  - File: src/dashboard_frontend/src/modules/shell/useStages.ts
  - File: src/dashboard/shell/__tests__/board-view.test.ts
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `advance(stage, seen, now)`
  - Note: the hook has no unit test (D42); task 12's browser cases prove it (a deliberate bridge). The response rules sit in `stage.ts` so a unit test reaches them (D47).
  - Purpose: One rule set for pressed, running, done and failed.
  - _Leverage: src/dashboard_frontend/src/modules/shell/harness.tsx:11-24, src/dashboard_frontend/src/modules/shell/pause.ts:27-30, src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:431-465_
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - _Prompt: Task: Per design C11, D20, D34 and D37, create pure `stage.ts` with the design's `failReason`, `resolved` and `advance`, plus a pure function that turns a `callHarness` result or a rejected fetch into the next stage, and the hook `useStages.ts` with `stages`, `press` and `retained`. The stalled test comes from what task 9 exports | Restrictions: The hook holds no tile knowledge; `failed` never clears on a timer; the design's sample code is illustrative, its post-conditions bind | Success: `failReason` gives the body's `reason`, else its `error`, else the status code; a non-2xx gives `failed`; a rejected fetch gives `failed`; a `launch` non-2xx keeps `opError`; a 2xx with `ok === false` gives `failed` with the body's `error` (D34); any other 2xx gives `running`; `resolved` is tested true and false for each of `pause`, `resume`, `stop`, `discard`, `redrive`, `launch`, `confirm` and `dismiss` per the design table; `advance` moves `running` to `done` when resolved; a `confirm` resolving as `refused` or `failed` gives `failed` with the outcome detail; `running` at 30,000 ms gives `failed` with `no change seen in 30 s` and at 29,999 stays (D20); `done` at 5,000 ms gives `null` and at 4,999 stays; `failed` stays at any age; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/board-view.test.ts` pass_

- [x] 11. Mount Home with its bands, wait tiles and answer sheet
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx
  - File: src/dashboard_frontend/src/modules/app/App.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('band-needs-you')`
  - Note: run `npx playwright install chromium` first. `NowPage.tsx` loses its importer and stays until task 17. The Deploy control and Open advisor leave the page until task 16 (D41); both are deliberate bridges.
  - Purpose: Home replaces the Now page, and waits are large tiles.
  - _Leverage: src/dashboard_frontend/src/modules/shell/NowPage.tsx:196-228, src/dashboard_frontend/src/modules/shell/NowPage.tsx:433-701, src/dashboard_frontend/src/modules/app/App.tsx:25, e2e/worktree-deploy.spec.ts:49-52, e2e/worktree-shell.spec.ts:426-428, src/controller/state.ts:300-305_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 11.3, 11.4_
  - _Prompt: Task: Per design C10, D31 and D33, create `HomePage.tsx` with the one-second tick, `openWaitId` and the three `section`s and test ids design names, rendering no tile while `useProjects().loading` is true. Create `tiles.tsx` with the `Tile` frame and `WaitTile`, using the class task 6 adds and the list and fact functions tasks 8 and 9 export. Copy `AnswerSheet`, `SecondOpinionButton` and their helpers into `AnswerSheet.tsx` with no behaviour change. Route `/` to `HomePage`. Create the browser spec, seeding `run.json` and wait records under the home as the leveraged specs do, and project filters through `localStorage` | Restrictions: Do not edit `NowPage.tsx`; `WaitDetail`, `WaitPanel` and the `Wait` branches do not move; tile buttons are `secondary`; colour only from the tile tones | Success: Home shows Needs you, Running and Next in that order with no collapse control; an empty band shows one quiet line; tiles sit in two columns at 1024 px and one at 1023 px; no filter, search, pagination or closed-spec list exists; a disabled project's wait has no tile (requirement 3 AC 5); only controller waits show: a `gate-a` ledger row with no controller wait gives no tile; two waits sort oldest first; the tile shows kind, project tag, spec, summary, age and Answer; `data-tone` is `neutral` at 5 minutes, `warning` at 20 and `danger` at 2 hours; a wait seeded just under 15 minutes old turns `warning` with no reload; a `merge` wait shows PR number, CI state and verdict for `merge` and for `merge:` plus repo and number; with no read it says `PR not read yet`; Answer replaces the board with the sheet at full width and a `Back to board` link; the link returns the board; answering in the sheet returns the board; a wait answered through the route while the sheet is open returns it too; light and dark both render the tile; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` and `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts src/dashboard/__tests__/frontend-tokens.test.ts` pass_

- [x] 12. Add the action tile and its stages
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('action-tile-' + id)`
  - Note: run `npx playwright install chromium` first. Task 11's cases keep their values. Stub Confirm with `page.route`, because the real route runs the executor (D52). A rewritten record reaches an open page on the next flush; a real Dismiss on a second seeded action forces one.
  - Purpose: Staged actions sit beside the waits and report their stages.
  - _Leverage: src/dashboard_frontend/src/modules/shell/NowPage.tsx:98-102, src/dashboard_frontend/src/modules/shell/NowPage.tsx:142-193, src/advisor/actions.ts:76-78, src/dashboard/multi-server.ts:796-812_
  - _Requirements: 5.1, 5.2, 5.3, 9.1, 9.2, 9.3, 9.4_
  - _Prompt: Task: Per design C10, C11 and D35, add `ActionTile` and `StageLine` to `tiles.tsx`, moving `actionTarget` in. Add the retained-tile snapshot to `HomePage` through the hook task 10 exports. Seed action records where `actionPath` puts them | Restrictions: Controls hide on a retained tile; Confirm and Dismiss are `secondary`; a pressed tile's stage controls disable until the stage ends (D37) | Success: A `staged` action shows kind, target, reason, age, Confirm and Dismiss; a `running` one shows no Confirm or Dismiss; a `done`, `refused`, `failed` or `dismissed` one left alone has no tile; the age colours the tile by the wait rule (D12); an action with no project shows no tag and stays with every project off; pressing Confirm shows pressed, then running, with the control disabled; a seeded `done` action moves the stage to done and it clears after 5 s; the tile stays until then (requirement 5 AC 2); a 500 with a `reason` shows that reason, one with only `error` shows the error, one with neither shows the status code; a 200 with `ok: false` shows failed and the tile stays until reload (D35); Dismiss on a real route ends with no tile; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` and `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` pass_

- [x] 13. Add the run tile's facts
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('run-tile-' + id)`
  - Note: run `npx playwright install chromium` first. The `held for deploy` case is a regression guard for the note. A seeded file reaches an open page only on the 30 s tick, so seed before `page.goto`.
  - Purpose: The tile replaces the Run page's read-only facts.
  - _Leverage: src/dashboard_frontend/src/modules/shell/Sidebar.tsx:37-41, src/dashboard_frontend/src/modules/theme/tokens.css:92, src/dashboard_frontend/src/modules/shell/pause.ts:33-48, src/dashboard/shell/shell-feed.ts:56_
  - _Requirements: 3.7, 6.1, 6.2, 6.3, 6.4, 6.7, 11.3, 12.3_
  - _Prompt: Task: Per design C10, D22, D23 and D38, add `RunTile`'s read side and fill the Running band with the list task 8 exports. It shows spec, project tag, `stepKind`, `task`, step age, the pause note, `last activity N ago` and a dot, or red `Stalled` in place of the dot. The dot maps green, amber and grey to the classes of `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:37-41`, and red to `bg-(--tone-danger-fg)`. A `merging` run adds its PR, CI, verdict and `next check in N`. A `queued` run shows `queued` | Restrictions: No press wiring here, task 14 adds it as a bridge; no heartbeat line with no step in flight | Success: A run with `inFlight`, `startedAt`, `task` and a recent `lastActivity` shows step kind, task, step age, `last activity`, and a green dot; an activity 10 minutes old shows amber; 20 minutes old shows red; with no `lastActivity` the age runs from the step's start; an `inFlight` with no `startedAt` omits the step age (requirement 12 AC 3); a run between steps shows a grey dot and no heartbeat line; `running` with no driver shows red `Stalled` and no dot; `waiting` with an open `drive-crash` wait shows the same; a plain `waiting` run with `driven: false` does not; moving runs sort most stale first; a `merging` tile shows the PR line; a `queued` tile shows `queued` and a grey dot; a deploy-held run reads `held for deploy` (regression guard); `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` and `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` pass_

- [x] 14. Add the run tile's actions and stopped runs
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('run-tile-' + id).getByRole('button')`
  - Note: run `npx playwright install chromium` first. Pause, Stop and Discard use the real routes through the dev proxy (`src/dashboard_frontend/vite.config.ts:28-36`); stub Re-drive and Confirm (D52). Green within 15 s is task 23's live line. Any real press forces the flush a rewritten record needs.
  - Purpose: Every run control lives on the tile.
  - _Leverage: src/dashboard_frontend/src/modules/shell/RunsPage.tsx:270-372, src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360, src/dashboard/multi-server.ts:822-864, src/controller/controller.ts:299-318, src/controller/controller.ts:205-222_
  - _Requirements: 5.4, 6.4, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.1, 9.2, 9.3, 9.4, 11.3_
  - _Prompt: Task: Per design C10, C11, D21 and D36, wire Pause, Resume, Stop, Discard and Re-drive to the routes through the stage hook, from what the controls function task 9 exports allows. Discard's first press is `secondary` and arms local state; the armed button is `danger` with the text of `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360`, and only that press posts. `discardAllowed: false` shows the quiet line `branch in use by a live run`. A stopped-run test seeds `codeRoot` as a temporary git repository with no remote and a real branch, because a failed read shows no tile | Restrictions: Stop has no confirm (D21); no Pause or Resume on a stopped run; Resume never shows on a deploy-held run | Success: Pause on a `running` run reads `pausing after this step`; Pause on a `queued` run reads `paused`; Resume on a held run shows the stage and returns Pause; a usage pause offers Resume; Stop posts `cancel`, and the tile turns `abandoned` with its branch kept; an `abandoned`, an `error` and a recent `done` run with a branch each show Discard and no Stop, Pause or Resume; a branchless one shows no tile; a 25-hour-old `done` run shows no tile; stopped runs sort after moving ones, newest first; the first Discard press posts nothing and shows the armed text; the second posts, the branch and worktree are gone and the tile leaves; a run sharing its branch with a moving run shows no Discard and the quiet line; a stubbed 409 `branch-in-use` shows that as the failed reason and it stays until the next press; Re-drive on a stalled tile shows its stages; a stubbed Confirm plus a seeded run shows that run's tile in Running (requirement 5 AC 4); `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` and `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` pass_

- [x] 15. Add the Next tiles
  - File: src/dashboard_frontend/src/modules/shell/useNextViews.ts
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('next-tile-' + projectId)`
  - Note: run `npx playwright install chromium` first. Launch posting `buildLaunchInput` holds at base: regression guard. Stub Launch (D52). A real Pause on a seeded `queued` run pushes a run change within the throttle.
  - Purpose: The next spec is one press away.
  - _Leverage: src/dashboard_frontend/src/modules/shell/RunsPage.tsx:385-473, src/dashboard_frontend/src/modules/shell/harness.tsx:40-52, src/dashboard_frontend/src/modules/shell/harness.tsx:69-108, src/dashboard/multi-server.ts:662-694, src/dashboard/shell/shell-feed.ts:63-66_
  - _Requirements: 3.8, 3.9, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.2, NFR Reliability_
  - _Prompt: Task: Per design C10, D29 and D30, create `useNextViews(projects, runKey)` with the mount, `runKey` and 30 s fetches, the per-project sequence number, and removal on a failed fetch. Add `NextTile` with spec, project tag, the setup line task 9 exports, and Launch through the stage hook; a refusal renders `OpErrorView`. Fill the Next band with the store and sort functions task 8 exports | Restrictions: No edit control; `NowModel.idle` is not a source; `view.gates` never shows | Success: A project with a launchable spec shows spec, tag, one setup line stating `gates record`, and Launch; a project with none shows no tile; a `launchBlock` that nulls `launchable` shows no tile; two projects on one store show one tile: the representative when on, else the enabled member; tiles follow `launchableOrder`, unnamed last, ties by project name; a setup fetch answering 500 drops that project's tile and leaves the other (NFR Reliability); a run status change refetches and the tile updates within 5 s with no reload (requirement 8 AC 5); pressing Launch posts the `buildLaunchInput` body once (regression guard); a stubbed 409 shows `OpErrorView`; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` and `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` pass_

- [x] 16. Replace the sidebar with the top bar, the gear and the tab title
  - File: src/dashboard_frontend/src/modules/shell/TopBar.tsx
  - File: src/dashboard_frontend/src/modules/shell/OpenAdvisor.tsx
  - File: src/dashboard_frontend/src/modules/shell/TabTitle.tsx
  - File: src/dashboard_frontend/src/modules/shell/Gear.tsx
  - File: src/dashboard_frontend/src/modules/app/App.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.locator('[data-testid^="nav-"]')`
  - Note: run `npx playwright install chromium` first. `DeployControl.tsx` and `ConnectionBanner.tsx` do not change: regression guards. `Sidebar.tsx`, `RunsPage.tsx` and `RunPage.tsx` lose their importers and stay as a bridge until task 17.
  - Purpose: Content gets the full width, and the tab shows the waits.
  - _Leverage: src/dashboard_frontend/src/modules/app/App.tsx:17-37, src/dashboard_frontend/src/modules/shell/NowPage.tsx:105-139, src/dashboard_frontend/src/modules/shell/Gear.tsx:12-136, src/dashboard_frontend/src/modules/shell/Sidebar.tsx:137-152, src/dashboard_frontend/src/modules/shell/DeployControl.tsx:12-85, src/dashboard_frontend/index.html:6_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 10.1, 10.2, 10.3, 11.5_
  - _Prompt: Task: Per design C7, C10 (`TabTitle`), D13 and D18, create `TopBar` and `OpenAdvisor` as design pins them, and a null-rendering `TabTitle.tsx` that sets `document.title` from the title function task 9 exports. In `App.tsx`, `Shell` renders `TopBar` then `main` with `TabTitle` beside it, and the two `/runs` routes go; the catch-all stays. In `src/dashboard_frontend/src/modules/shell/Gear.tsx`, the panel opens downward, `:75-99` and the `:14` destructure go, and one switch per project joins it, sorted by name, keeping test id `project-toggle-` plus the id; its header comment stops naming the sidebar and density | Restrictions: `DeployControl` takes no props; the links carry no counts; no project dot or live count in the gear (D13); the gear does not read `useShell` for density | Success: The header holds Home, Specs, Usage, Deferrals, Deploy, Open advisor and the gear in that order; no link shows a count; Open advisor posts as before and a long result wraps; the gear panel opens below its button; it holds the theme toggle, a named switch per project, the notification setting and the version; no density control exists; a switch persists across a reload and removes that project's wait, run and Next tiles; unset `sdd-fixture` is off on the board and in the gear; turned on it stays on across a reload; another unset project stays on; no `disconnected-marker` exists and `ConnectionBanner` still shows (regression guard); `/#/runs` and `/#/runs/x` land on Home; the title reads `2 · 4h20m` with two open waits; a staged action and a disabled project's wait do not count; with none it is the `index.html` title; at 390 px with the deploy strip open and an advisor result showing, `scrollWidth` does not exceed the viewport on Home, Specs, Usage and Deferrals; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` and `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` pass_

- [ ] 17. Delete the old pages and what only they read in the frontend
  - File: src/dashboard_frontend/src/modules/shell/NowPage.tsx
  - File: src/dashboard_frontend/src/modules/shell/RunsPage.tsx
  - File: src/dashboard_frontend/src/modules/shell/RunPage.tsx
  - File: src/dashboard_frontend/src/modules/shell/Sidebar.tsx
  - File: src/dashboard_frontend/src/modules/shell/ShellProvider.tsx
  - File: src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: src/dashboard_frontend/src/modules/harness/types.ts
  - File: src/dashboard_frontend/src/modules/projects/stores.ts
  - File: src/dashboard_frontend/src/modules/theme/tokens.css
  - File: src/dashboard/__tests__/frontend-tokens.test.ts
  - File: src/dashboard/__tests__/frontend-style-scan.test.ts
  - Test: src/dashboard/__tests__/frontend-tokens.test.ts — `declaredNames(themeBlock)`
  - Note: count grep: `grep -rn -e sidebar-w -e row-h-compact src e2e`. `src/dashboard/__tests__/frontend-tokens.test.ts:126-127` and `src/dashboard/__tests__/frontend-style-scan.test.ts:338` change value; the literal paths at `:249` and `:311` do not.
  - Purpose: Nothing stale stays in the frontend.
  - _Leverage: src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:5-63, src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:153-161, src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:37-51, src/dashboard/__tests__/frontend-style-scan.test.ts:181, src/dashboard/__tests__/frontend-style-scan.test.ts:351-356_
  - _Requirements: 1.5, 2.1, 2.3, 2.5, 11.2, 11.4_
  - _Prompt: Task: Per design C6 (Types), C7 and C12, delete the four pages. In `ShellProvider.tsx` delete `Density`, `DENSITY_KEY`, `readDensity`, `density`, `setDensity`, the `--row-h` effect, `now`, `controllerActivity`, `connected`, and the two subscriptions. `WatchView` becomes `{ kind: 'overview' }`, and `viewKey`, `subscribeMessage` and `unsubscribeMessage` lose the harness branch. From both frontend type files delete every type left with no reader, at least `Wait` through `NowModel`, `RunDetail`, `ControllerActivity`, `RunModel`, the `shell-now`, `controller-activity` and `harness-*` message arms and the `harness-*` view messages; keep `PhaseRow`. Delete `--sidebar-w` and `--row-h-compact` from `tokens.css` and from the test list. Move the sample at `src/dashboard/__tests__/frontend-style-scan.test.ts:338` to `--panel-w`. Delete the row-height exemption at `:181` and its test (D49). Change the header comment of `stores.ts`, which names the sidebar | Restrictions: `--row-h` stays at `src/dashboard_frontend/src/modules/theme/tokens.css:54`; `PageLayout.tsx`, `primitives.tsx`, `harness.tsx` and `--panel-w` stay; no server file changes here | Success: A new token test fails while `--sidebar-w` or `--row-h-compact` is declared, and passes once both are gone; no source file names a deleted symbol, checked by `grep -rn -e NowPage -e RunsPage -e RunPage -e Sidebar -e density src/dashboard_frontend/src`; the Specs, Usage and Deferrals pages still build; `npx vitest run src/dashboard/__tests__/frontend-tokens.test.ts src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts src/dashboard/shell/__tests__/board-view.test.ts src/dashboard/shell/__tests__/deploy-view.test.ts` and `npx tsc --noEmit` pass, and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` stays green (regression guard)_

- [ ] 18. Drop the Now, sidebar and activity topics from the feed
  - File: src/dashboard/shell/shell-feed.ts
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard/harness/hub.ts
  - File: src/dashboard/shell/now-model.ts
  - File: src/dashboard/shell/sidebar-rows.ts
  - File: src/dashboard/shell/waits.ts
  - File: src/dashboard/shell/__tests__/now-model.test.ts
  - File: src/dashboard/shell/__tests__/sidebar-rows.test.ts
  - File: src/dashboard/shell/__tests__/waits.test.ts
  - File: src/dashboard/shell/__tests__/shell-feed.test.ts
  - File: src/dashboard/__tests__/shell-routes.test.ts
  - File: src/controller/__tests__/ledger.test.ts
  - Test: src/dashboard/shell/__tests__/shell-feed.test.ts — `feed.snapshot()`
  - Note: count grep: `grep -n -e 'toHaveLength(7)' -e septet -e seven src/dashboard/shell/__tests__/shell-feed.test.ts`. `ledger.test.ts` and every kept case elsewhere keep their asserted values.
  - Purpose: The feed sends only what the board reads.
  - _Leverage: src/dashboard/shell/shell-feed.ts:92-161, src/dashboard/harness/hub.ts:53, src/dashboard/harness/hub.ts:149, src/controller/__tests__/ledger.test.ts:10, src/controller/__tests__/ledger.test.ts:241-245_
  - _Requirements: 2.3, 2.4_
  - _Prompt: Task: Per design C6, `flush` sends `shell-specs`, `controller-waits`, `controller-runs`, `controller-actions` and `controller-deploy`. Delete `now-model.ts`, `sidebar-rows.ts`, `waits.ts` and their tests. Delete `Wait` through `NowModel`, `ControllerActivity` and their message arms from `src/dashboard/shell/types.ts`. Remove the hub's `activityEvents` listener in `src/dashboard/harness/hub.ts` at `:53` and `:149`. In `src/controller/__tests__/ledger.test.ts` drop the `gateOrRuling` import and the read at `:243-245`, keeping the `phase.end` row at `:242` (D48). Update the tests, at least these and widen to every assertion the change touches: in `src/dashboard/shell/__tests__/shell-feed.test.ts` the topic list `:408`, the length `:553`, the reads at `:301`, and delete the quiet, activity and sidebar cases at `:305`, `:413` and `:496`; in `src/dashboard/__tests__/shell-routes.test.ts` the waits at `:344` and `:445` move to `shell-specs`, and the cases at `:348` and `:369` go | Restrictions: `src/controller/activity.ts` stays (design Scope notes); `liveRunsByProject` stays; `project-watch.ts` is task 19's bridge; the page's push path stays: `setRunHeartbeat` still emits `change` | Success: `feed.snapshot()` holds exactly the five topics in that order; no message is `shell-now` or `controller-activity`; an overview subscriber gets `shell-specs` and no `shell-now`; a `pushDeploy` keeps the snapshot five long; a run heartbeat still pushes `controller-runs` (regression guard); the cancel, pause, resume, redrive, advisor and action route tests pass unchanged (regression guards, requirement 2 AC 4); `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/shell-feed.test.ts src/dashboard/__tests__/shell-routes.test.ts src/controller/__tests__/ledger.test.ts src/dashboard/__tests__/controller-dashboard-routes.test.ts src/dashboard/__tests__/advisor-routes.test.ts` pass_

- [ ] 19. Remove the project watches, the run log and the task-review summary
  - File: src/dashboard/harness/hub.ts
  - File: src/dashboard/harness/project-watch.ts
  - File: src/dashboard/harness/types.ts
  - File: src/dashboard/shell/run-detail.ts
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard/multi-server.ts
  - File: src/controller/runs.ts
  - File: src/dashboard/shell/__tests__/run-detail.test.ts
  - File: src/dashboard/harness/__tests__/project-watch.test.ts
  - File: src/dashboard/__tests__/harness-routes.test.ts
  - File: src/dashboard/__tests__/shell-routes.test.ts
  - File: src/dashboard/__tests__/controller-dashboard-routes.test.ts
  - Test: src/dashboard/__tests__/controller-dashboard-routes.test.ts — `GET /api/controller/runs/:id/log`
  - Note: `HarnessHub` loses an argument, so `src/dashboard/__tests__/shell-routes.test.ts:694` changes; its asserted values stay. Kept cases in every named test file keep their values. The Success grep also reaches test comments, so clean those.
  - Purpose: The server keeps no feed or route only the removed pages read.
  - _Leverage: src/dashboard/harness/hub.ts:37-134, src/dashboard/multi-server.ts:170-175, src/dashboard/multi-server.ts:353-366, src/dashboard/multi-server.ts:593-617, src/dashboard/multi-server.ts:866-875, src/dashboard/multi-server.ts:938-952, src/controller/runs.ts:1487-1536_
  - _Requirements: 2.2, 2.3, 2.4_
  - _Prompt: Task: Per design C6 and D39, delete from `hub.ts` `projectWatches`, `sendHarness`, `snapshotFor`, `watchedProjects` and the watch loops, keeping `overviewSnapshot` and `OverviewWatch`. In `multi-server.ts` delete the hub's first callback, both `harness-*` branches, `sendToHarness`, the log and summary routes, and imports only they use; `views` narrows to `Set<'overview'>`. Delete `readRunLogTail` and `safeMtime`. Keep `parseHandoffRouting` in `project-watch.ts` and delete the rest. Delete `run-detail.ts` and its test, `RunDetail`, and the `harness-*` message arms and view messages, keeping `overview-rows`. In `src/dashboard/harness/__tests__/project-watch.test.ts` keep only the `parseHandoffRouting` describe (`:86`). In `src/dashboard/__tests__/harness-routes.test.ts` delete the cases at `:206`, `:226` and `:249` and `getHub`, keeping `:265`. Delete the log test at `src/dashboard/__tests__/controller-dashboard-routes.test.ts:192` | Restrictions: `sendToProjectOrOverview` keeps `connection.projectId` (`src/dashboard/multi-server.ts:318-320`); keep `stepLogDir` and `listStepLogs`; change no kept route | Success: `GET /api/controller/runs/:id/log` for a real run and `GET /api/projects/:projectId/specs/:specName/task-reviews/summary` for a real spec each answer exactly as an unknown control path under `/api` does; a `harness-subscribe` message changes nothing and sends no reply; `run-setup.ts` and `overview-watch.ts` still import `parseHandoffRouting`; an overview subscriber still gets its snapshot; cancel, pause, resume, redrive, discard, the advisor open route and the action routes keep their tests (regression guards, requirement 2 AC 4); `grep -rn -e readRunLogTail -e ProjectHarnessWatch -e buildRunDetail -e harness-subscribe src` finds nothing; `npx tsc --noEmit` and `npx vitest run src/dashboard/__tests__/controller-dashboard-routes.test.ts src/dashboard/__tests__/harness-routes.test.ts src/dashboard/__tests__/shell-routes.test.ts src/dashboard/harness/__tests__/project-watch.test.ts src/dashboard/__tests__/advisor-routes.test.ts src/controller/__tests__/runs.test.ts` pass_

- [ ] 20. Rewrite the shell browser suite for the board
  - File: e2e/worktree-shell.spec.ts
  - Test: e2e/worktree-shell.spec.ts — `page.locator('[data-testid^="nav-"]')`
  - Note: run `npx playwright install chromium` first. Regression guard: every case covers behaviour tasks 11 to 17 shipped, so this task is implementer-only and the test author and verifier are skipped. Failures are defects in those tasks.
  - Purpose: The shell suite tests what the shell now is.
  - _Leverage: e2e/worktree-shell.spec.ts:25-26, e2e/worktree-shell.spec.ts:205-296, e2e/worktree-shell.spec.ts:311-346, e2e/worktree-shell.spec.ts:392-646_
  - _Requirements: 2.5_
  - _Prompt: Task: Rewrite `e2e/worktree-shell.spec.ts` per requirement 2 AC 5 and design Testing Strategy, reading test ids from the merged code. At least these, and widen to every case the change touches: `NAV_ORDER` and `SHELL_PAGES` (`:25-26`) drop the Now and Runs entries, and the redirect case adds `/runs` and `/runs/x` and looks for a band; project toggles open the gear first; delete the density (`:243`), collapsed-group (`:259`), derived gate wait (`:273`) and Run page PR panel (`:311`) cases; the pause note cases (`:417`, `:446`, `:477`) read the run tile, and `:446` becomes `pausing after this step`; the row Pause cases (`:516`, `:558`) and panel Resume cases (`:590`, `:620`) press the tile; keep the Specs panel, Deferrals and Usage cases | Restrictions: Test files only; a product defect found here is reported, not fixed; do not edit `e2e/worktree-board.spec.ts` | Success: No case names a removed page, row, panel or density control, checked by `grep -n -e nav-now -e nav-runs -e ctrl-run -e density -e group-now e2e/worktree-shell.spec.ts`; the four links read in order; a failed tile Pause shows its reason; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts` passes_

- [ ] 21. Rewrite the project-list and no-shared browser suites
  - File: e2e/worktree-project-list.spec.ts
  - File: e2e/worktree-no-shared.spec.ts
  - Test: e2e/worktree-project-list.spec.ts — `page.getByTestId('project-toggle-' + id)`
  - Test: e2e/worktree-no-shared.spec.ts — `page.getByTestId('project-toggle-' + id)`
  - Note: run `npx playwright install chromium` first. Regression guard: implementer-only, test author and verifier skipped. The nav links carry no counts now, so `navCount` goes.
  - Purpose: The shared-store rules stay proven through the gear and the pages.
  - _Leverage: e2e/worktree-project-list.spec.ts:72-75, e2e/worktree-project-list.spec.ts:136, e2e/worktree-project-list.spec.ts:238, e2e/worktree-no-shared.spec.ts:56-86_
  - _Requirements: 1.1, 1.4, 2.5_
  - _Prompt: Task: Per requirement 2 AC 5, read test ids from the merged code. In `e2e/worktree-project-list.spec.ts` replace `navCount` (`:72-75`) with counts of rows on the Specs and Deferrals pages, open the gear before a toggle, and delete the describe at `:238`, whose dots, live counts and sidebar order no longer exist (D13). In `e2e/worktree-no-shared.spec.ts` the case at `:56` finds the toggles in the gear and the case at `:69` opens the gear before `:82`. Update file comments that name the sidebar | Restrictions: Test files only; keep the shared-store expectation that one store counts once; a product defect found here is reported, not fixed | Success: A shared store shows its spec and deferral once with every project on, and once with the representative off; turning both off shows none; both projects show as gear switches; a toggle hides that project's specs; `grep -n -e navCount -e project-dot -e project-live-count -e Sidebar e2e/worktree-project-list.spec.ts e2e/worktree-no-shared.spec.ts` finds nothing; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-project-list.spec.ts e2e/worktree-no-shared.spec.ts` passes_

- [ ] 22. Rewrite the deploy and visual browser suites
  - File: e2e/worktree-deploy.spec.ts
  - File: e2e/worktree-visual.spec.ts
  - File: e2e/helpers/shell-seed.ts
  - File: e2e/helpers/worktree-harness.ts
  - Test: e2e/worktree-deploy.spec.ts — `page.getByTestId('deploy-strip')`
  - Test: e2e/worktree-visual.spec.ts — `page.getByTestId('nav-specs')`
  - Note: run `npx playwright install chromium` first. Regression guard: implementer-only, test author and verifier skipped. Count grep: `grep -n -e VIEWS -e nav-runs e2e/worktree-visual.spec.ts`. The helpers hold comments only.
  - Purpose: Deploy and the visual rules hold on the board.
  - _Leverage: e2e/worktree-deploy.spec.ts:271, e2e/worktree-visual.spec.ts:23, e2e/worktree-visual.spec.ts:277, e2e/helpers/shell-seed.ts:88, e2e/helpers/worktree-harness.ts:240-242_
  - _Requirements: 1.2, 2.5, 6.7, 11.4, 11.5_
  - _Prompt: Task: Per requirement 2 AC 5, read test ids from the merged code. In `e2e/worktree-deploy.spec.ts` rewrite the case at `:271` to the run tile: it reads `held for deploy` and offers no Resume; a deploy-held run keeps Pause (design C9). Fix the header comment naming the Now and Runs pages. The stage cases keep their asserted values. In `e2e/worktree-visual.spec.ts` `VIEWS` (`:23`) becomes home, specs, usage and deferrals, every per-view branch for `now`, `runs` and `run` goes, and the read of `nav-runs` at `:277` moves to `nav-specs`. Change the sidebar comments at `e2e/helpers/shell-seed.ts:88` and `e2e/helpers/worktree-harness.ts:240-242` to name the gear | Restrictions: Test and helper comment edits only; no helper behaviour changes; a product defect found here is reported, not fixed | Success: The deploy stage, confirm and error cases pass with their values unchanged (regression guards); the held run reads as the case states on one page; no view scrolls sideways at the five widths in both themes; reduced motion, focus ring and the content cap hold on the four views; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-deploy.spec.ts e2e/worktree-visual.spec.ts` passes_

- [ ] 23. Name Home in the docs and write the live verification file
  - File: docs/SDD-HARNESS.md
  - File: .spec-workflow/specs/dashboard-board/verification-evidence.md
  - Note: no `- Test:` seam: a docs edit plus evidence that exists only after an operator runs a real step (D50). Write the evidence file to `/tmp/scratchpad/sdd/dashboard-board/` and `cp` it into place, per agent-rules Git. The orchestrator relocates it to the main spec store at the merge gate.
  - Purpose: The docs match the page, and the one live scenario stays tracked.
  - _Leverage: docs/SDD-HARNESS.md:99-100, docs/SDD-HARNESS.md:120, docs/SDD-HARNESS.md:469, .spec-workflow/specs/dashboard-deploy/verification-evidence.md_
  - _Requirements: 2.6, 6.5_
  - _Prompt: Task: Per requirement 2 AC 6, change `docs/SDD-HARNESS.md:99-100`, `:120` and `:469` to name Home: the Launch tile on Home, and the answer sheet opened from a wait tile. Write `verification-evidence.md` in the format of the `dashboard-deploy` file: a short preamble saying the automated cases live in the unit and browser suites and every line must read `passed` before the retrospective opens, then one `pending` line for requirement 6 AC 5: on a fixture run whose drive threw, Re-drive moves the tile to a green dot within 15 s of the step's spawn | Restrictions: No code change; leave `docs/INTERFACES.md` and `docs/technical-documentation/file-structure.md` (design Scope notes); do not run the scenario or restart the service | Success: `grep -n -e 'Runs page' -e 'Now page' docs/SDD-HARNESS.md` finds nothing; the evidence file exists with the preamble and one `pending` line naming the 15 s target_

## Scope notes

- Carried from design: none.
- Every design component has a task: C1 (1), C2 (2), C3 (3), C4 (4), C5 (5), C6 (17, 18, 19), C7 (16, 17), C8 (7), C9 (8, 9), C10 (11 to 16), C11 (10, 12, 14), C12 (6, 17).
- No task touches a sensitive path. Expect at least seven verifiers: tasks 2, 7, 8, 10, 11, 15 and 16 add modules with no code at base, and tasks 11 and 16 also hit `isWiringTask` (`src/controller/phases/implementation.ts:266-272`) through `App.tsx`. Tasks 20 to 22 skip the verifier by design.
- Added beyond design: `src/controller/__tests__/ledger.test.ts` loses its read of the deleted `waits.ts` (D48); the row-height exemption and its scanner test go (D49); `verification-evidence.md` tracks the one live scenario (D50).
- Changed from design: `board.ts` holds value imports of `pause.ts` and `stores.ts`, where design says type-only (D45). `stepLifecycle` gains an export (D46). `e2e/helpers/shell-seed.ts` and `e2e/helpers/worktree-harness.ts` hold no nav reads, only sidebar comments, so task 22 edits comments.
- `TabTitle` gets its own file; design names the component but no file.
- The ESLint Success check is left out (D43). The frontend has no type check; its gate is the build test and the style scan (D44).
- Entry scenario 7's `npm run build` and `npm test` run at the end-to-end verification gate, per agent-rules Checks, not in a task.
- Cut, as design sets: `src/controller/activity.ts` stays with no reader; `docs/INTERFACES.md` and `docs/technical-documentation/file-structure.md` stay unedited.

## Decisions taken in this document

Numbers continue from the design document.

- D40 — How the work splits: options were one task per design component, or smaller slices; chosen slices for the board model and Home, so a test author meets one bounded behaviour set at a time.
- D41 — When the old browser suites go green again: options were rewriting each suite inside the task that breaks it, keeping old and new pages side by side, or one red window; chosen the window from task 11 to tasks 20 to 22, because the agent rules run a browser suite only when a task names it, and the new suite proves each slice meanwhile. The page has no Deploy control or advisor button between tasks 11 and 16; the branch is not deployed in that window.
- D42 — The seam for tile tasks: options were adding a DOM renderer to the unit runner, no seam, or the worktree browser suite; chosen the browser suite because no renderer is installed and design names that spec.
- D43 — The standing ESLint Success check: options were listing it or leaving it out; chosen leaving it out because this repository has no ESLint binary, config or dependency, so the check would red every task.
- D44 — The frontend compile gate: options were adding a frontend type check, or the build test and style scan; chosen the existing tests, because a new type check is outside this spec.
- D45 — The board module's imports: options were type-only with copied rules, or value imports of two pure modules; chosen value imports because the hold rule and store grouping must not fork, and a probe under vitest 4.0.16 loaded an extensionless import and the real store module at runtime.
- D46 — How the step-spawn write is tested: options were a full stubbed implementation drive, or exporting the private helper; chosen the export because the drive adds minutes and proves nothing more.
- D47 — Where the response rules live: options were inside the hook, or a pure function; chosen a pure function so a unit test reaches them with no renderer.
- D48 — The ledger test's read of a deleted module: options were keeping the helper in a new file, or dropping the read; chosen dropping it because no product code reads it once the derived waits go.
- D49 — The row-height scanner exemption: options were keeping it, or removing it with its sample; chosen removal because the call it exempts is deleted.
- D50 — How the 15-second Re-drive target is proven: options were a stubbed browser case, or a tracked live line; chosen the live line because only a real step spawn proves it.
- D51 — Frontend before server removal: options were either order; chosen frontend first, so no page ever waits on a message that has stopped.
- D52 — Which browser presses are stubbed: options were all real, all stubbed, or stubbing only what starts a drive; chosen stubbing Re-drive, Launch and Confirm, because the suite runs a real controller, and leaving Pause, Stop and Discard real so the proxy path is exercised.

## Revision History

- **v1** (2026-11-06) — Initial draft.
  - **Lint pass.** 47 fixed; rejected: none.
