# Design Document

## Overview

This design rebuilds the Specs, Usage and Deferrals pages of the dashboard shell and adds one controller writer, the usage log, plus two server routes, a usage view and a deferral resolve. The Specs page reads one block per spec store from the existing `shell-specs` push, and the Usage page reads one new route that computes the window, the burn and the per-run fits on the server.

## Steering Document Alignment

### Technical Standards (tech.md)
`.spec-workflow/steering/` holds no `tech.md`; the design follows `agent-rules.md`: tests sit in `__tests__/` next to the module, and checks are `npx tsc --noEmit` plus the touched test files.

### Project Structure (structure.md)
No `structure.md` exists; new server files go next to their neighbours (`src/controller/usage-log.ts`, `src/dashboard/shell/usage-view.ts`) and frontend pages stay in `src/dashboard_frontend/src/modules/shell/`.

### Design System (design-system.md) — if applicable
N/A: the project has no `design-system.md`. Pages reuse `Pill` and `Tone` from `src/dashboard_frontend/src/modules/ui/ui.tsx:10` and `:76`, so the visual suite's pill style parity (`e2e/worktree-visual.spec.ts:342-344`) still applies.

## Architecture

Three slices share the shell. (1) Specs: `ShellFeed.flush` (`src/dashboard/shell/shell-feed.ts:87-137`) calls a new `buildSpecBlock` per store group in place of `buildSpecRows`, and sends `shell-specs` with `{ blocks }`; the page renders the blocks of enabled stores. (2) Usage: the controller's rate-limit callback appends one line to `usage-log.jsonl`; a new `GET /api/shell/usage` reads `rate-limit.json`, the log, the run records, the run ledgers and `tasks.md`, and returns the window, the burn and one line per live run; the page fetches it on every `controller-runs` push. (3) Deferrals: the page renders the open records of each enabled store from the existing `deferrals-update` payloads, and a new `POST /api/projects/:projectId/deferrals/:deferralId/resolve` resolves one record through the deferrals tool; the watcher's `deferral-change` push (`src/dashboard/multi-server.ts:436-451`) then removes the row.


## Components and Interfaces

### C1 — Usage log writer and reader (`src/controller/usage-log.ts`, new)
- **Purpose:** Append one line per rate-limit reading, bound the file, and reduce it for the usage view (Requirement 3, D7, D8).
- **Interfaces:**
  - `usageLogPath(): string` — `join(controllerHome(), 'usage-log.jsonl')`.
  - `appendUsageLine(line: UsageLogLine, now?: () => Date): void` — synchronous. Appends `JSON.stringify(line) + '\n'` with `appendFileSync`. Then, when the file is larger than 256 KiB, it rewrites the file with only the lines whose `ts` is at or after `now() − 8 days` (write a temporary file in the same directory, then `renameSync`). Any thrown error is caught and logged with one `console.error` call; nothing is rethrown, so the step is not failed, paused or retried (Requirement 3 AC3).
  - `readUsageLog(nowMs: number): UsageLogLine[]` — reads the whole file, skips each line that does not parse or lacks a numeric `sevenDay.utilization` and a string `ts`, drops lines older than `nowMs − 8 days`, and returns the rest sorted by `ts` ascending. A missing file gives `[]`.
  - `computeBurn(lines: UsageLogLine[], nowMs: number): number | null` — D7. The anchor is the newest line with `ts` at or before `nowMs − 24 h`; `null` when there is none. The result is the sum over consecutive pairs from the anchor to the newest line of `max(0, later − earlier)` in utilisation, times 100 (percentage points).
  - `attributedUse(lines: UsageLogLine[], runId: string): number` — D8 numerator: the sum over consecutive pairs of all lines of `max(0, later − earlier)` where the later line's `run` equals `runId`, in utilisation (0..1).
- **Post-conditions:** two calls of `appendUsageLine` give two whole lines. The controller runs in one process and the call is synchronous, so two readings never interleave (Requirement 3 AC4). Probe: on node v24.13.0, two `appendFileSync` calls on one path gave two whole lines (scratch, not committed). Nothing here depends on node-20 stream timing.
- **Dependencies:** `controllerHome` (`src/controller/state.ts:292-297`), which honours `SDD_HOME` (Requirement 3 AC5).
- **Reuses:** the append-a-JSON-line pattern of the run ledger (`src/controller/ledger.ts:107` writes through `appendFileSync`).

### C2 — Run id on the rate-limit callback (`src/controller/step.ts`, `src/controller/runs.ts`, `src/controller/controller.ts`)
- **Purpose:** Carry the emitting run's id to the log line (Requirement 3 AC1, D13).
- **Interfaces:**
  - `StepSpec.onRateLimit?: (windows: RateLimitWindows, run?: string | null) => void` — widened with an optional trailing parameter (`src/controller/step.ts:135`).
  - The `rate_limit_event` branch (`src/controller/step.ts:499-502`) calls `spec.onRateLimit?.(lastRateLimit, spec.runId ?? null)`; `spec.runId` is the optional field at `src/controller/step.ts:127`.
  - `RunDeps.onRateLimit(windows: RateLimitWindows, run?: string | null): void` (`src/controller/runs.ts:405-406`).
  - `Controller.runDeps().onRateLimit` (`src/controller/controller.ts:732`) becomes `(w, run) => { void this.persistRateLimit(w); appendUsageLine({ v: 1, ts: this.now().toISOString(), sevenDay: { utilization: w.sevenDay.utilization }, run: run ?? null }, this.now); }`.
- **Post-conditions:** `persistRateLimit` (`src/controller/controller.ts:790-803`) writes the same `rate-limit.json` content as at base (Requirement 3 AC2). The phase contexts that forward `ctx.onRateLimit` (`src/controller/phases/document.ts:182`, `src/controller/phases/implementation.ts:96`, `src/controller/phases/closeout.ts:62`, `src/controller/phases/retrospective.ts:41`, `src/controller/merge-fix.ts:50`) keep their one-parameter type: an extra optional parameter stays assignable, and the runtime function is the controller's, so `step.ts` passes the run id through. No phase file changes.
- **Reuses:** `RateLimitFile` (`src/controller/state.ts:238-253`) stays unchanged.

### C3 — Spec block builder (`src/dashboard/shell/spec-rows.ts`, rewritten in place)
- **Purpose:** One Specs block per store (Requirements 1 and 2).
- **Interfaces:** `buildSpecBlock(project: ProjectContext, liveRuns: RunRecord[], cache?: FileCache): Promise<SpecBlock>`. `project` is the store's representative; `liveRuns` holds the live run of each project of the store (D24).
- **Steps:**
  1. Read `decomposition.md` once through `cache.text` and list its headings with `decompositionHeadings` (C4). No text or no heading gives `lines: []`, which the page shows as "No decomposition" (Requirement 1 AC4).
  2. Read the index snapshot once (`IndexGenerator.snapshot`, `src/core/index-generator.ts:59-91`), the HANDOFF text once through the cache, and the open deferral records once (`DeferralStorage.list({ status: 'deferred' })`, newest first per `src/core/deferral-storage.ts:277-305`).
  3. Compute `next` once: `launchableSpec(snapshot.routing, workflowRoot, decompositionText)` (C4).
  4. For each heading in file order (D3), the first matching rule sets the word and the fact (D1, Requirement 2 AC1):
     - **live:** a run in `liveRuns` has `spec` equal to the heading's spec. The fact is the run's `phase`, else its status. In the `implementation` phase it is followed by `done/total` from the snapshot entry's `taskProgress`. When the run's status is not `running`, the fact ends with ` · ` and the status (D16), for example "implementation 3/7 · paused".
     - **closed:** `isSpecClosed(phaseRows, retroPlanText)` (`src/dashboard/shell/spec-rows.ts:78-82`). The fact is the distinct "PR #n" numbers of the spec's phase-log notes, ascending, each written `#n` and joined by a space (the rule of `src/dashboard/shell/spec-rows.ts:149-154`), else "no PR recorded".
     - **deferred:** the heading's tail carries `(deferred)` (case-insensitive, as `src/dashboard/harness/run-setup.ts:235` tests it), or the snapshot entry has `deferred: true`. The fact follows D5: the first open record whose `originSpec` is the spec, else the first `d-` id plus eight hex characters in `decompositionEntry` text (`src/dashboard/harness/run-setup.ts:246-261`), else "no record".
     - **next:** the spec equals the launchable spec; no fact.
     - **stopped:** the spec directory holds `requirements.md`, `design.md`, `tasks.md` or `harness-events.jsonl`, read through the cache. The fact is the phase of the newest phase-log row by date, else the snapshot entry's `currentPhase`.
     - **not started:** otherwise; no fact.
- **Post-conditions:** an unnamed spec directory gives no line (D4); at most one line reads "next", as one launchable spec exists per store (Requirement 2 AC8); a missing file gives an empty field, never a throw.
- **Deletions in this file:** `buildSpecRows`, `buildSpecDetail`, `parseDecomposition`, `buildRuns`, `listTopLevelFiles`, `newestRunAbandoned` and `SPEC_NAME_RE`/`VERSION_RE` go. `isSpecClosed`, `timeOf`, `newestBy` and `firstStatusValue` stay.
- **Reuses:** `parseHandoffPhaseRows` and `handoffPath` (imported at `src/dashboard/shell/spec-rows.ts:11-13`), `FileCache` (`src/dashboard/shell/file-cache.ts:16-48`).

### C4 — Decomposition helpers (`src/dashboard/harness/run-setup.ts`)
- **Purpose:** Share the heading list and launchable rule with C3, so "next" matches the setup view before its guards (Requirement 2 AC5).
- **Interfaces:**
  - `decompositionHeadings(text: string): { number: string; spec: string; deferredTag: boolean }[]` — every line that matches `DECOMPOSITION_HEADING` (`src/dashboard/harness/run-setup.ts:23`), in file order. `number` is the digits after `###`, read with `/^###\s+(\d+)\./`; `deferredTag` is `/\(deferred\)/i` on the tail group.
  - `nextUnstartedSpec(workflowRoot: string, text?: string): string | null` — gains an optional trailing `text`. When it is given, the function uses it in place of reading the file (`src/dashboard/harness/run-setup.ts:230-239`).
  - `launchableSpec(routing: RoutingDecision, workflowRoot: string, text?: string): string | null` (`RoutingDecision` of `src/core/spec-routing-deriver.ts:20`) — the expression at `src/dashboard/harness/run-setup.ts:202-205`, moved into a function. `buildSetupView` calls it, so the setup view keeps its behaviour.
- **Post-conditions:** `decompositionEntry`, `decompositionPosition` unchanged.

### C5 — Shell feed (`src/dashboard/shell/shell-feed.ts`)
- **Purpose:** Send the blocks.
- **Interfaces:** `flush` builds `blocks: SpecBlock[]`. For each `groupByStore` group (`src/dashboard/shell/store-groups.ts:25-42`) it passes the live runs of every member project from `liveRunsByProject` (`src/dashboard/shell/live-runs.ts:10-18`), not only the first member's. The message is `{ type: 'shell-specs', data: { blocks } }` (D21). A group whose builder throws is left out and logged, as at `src/dashboard/shell/shell-feed.ts:98-102`. The order of the five topics does not change.

### C6 — Usage view builder (`src/dashboard/shell/usage-view.ts`, new)
- **Purpose:** The server side of the Usage page (Requirements 4 and 5).
- **Interfaces:** `buildUsageView(projects: ProjectContext[], nowMs?: number): Promise<UsageView>`. `nowMs` is an optional trailing clock seam that defaults to `Date.now()`.
- **Steps:**
  1. `window` = `readRateLimit()`'s `sevenDay` (`src/controller/state.ts:593-599`), else `null`.
  2. `lines = readUsageLog(nowMs)`; `burn = computeBurn(lines, nowMs)`.
  3. Live runs = the values of `liveRunsByProject(listRunsSync())`, for every registered project, enabled or not (D11). Each run gives one `UsageRunLine` with the project name from `projects` (else the run's project id), the spec, the phase and `tokens = totalW(run.tokens)`. `totalW` (`src/controller/runs.ts:585-587`) becomes an export.
  4. Fit (D8), only when `run.phase === 'implementation'`. `done` = the count of distinct `task` values in `task.done` rows whose `run` is the run's id, in `<specStore>/.spec-workflow/specs/<spec>/harness-events.jsonl` (D18). `remaining` = `total − completed` of `parseTaskProgress` (`src/core/task-parser.ts:553-568`) over that spec's `tasks.md`. `use = attributedUse(lines, run.id)`. `headroom = 1 − u`, where `u` is the newest log line's utilisation (D26). When `done ≥ 1`, `use > 0`, `window` is not null and `window.resetsAt` is in the future, the fit is `'fits'` if `use / done × remaining ≤ headroom`, else `'does-not-fit'`. Otherwise the fit is `null`, which reads "not known yet" (Requirement 5 AC3; D20).
- **Post-conditions:** never throws; a missing ledger or `tasks.md` gives a `null` field (NFR Reliability).

### C7 — Server routes (`src/dashboard/multi-server.ts`)
- **Purpose:** Serve the usage view and resolve; drop the dead routes (Requirement 8).
- **Interfaces:**
  - `GET /api/shell/usage` → `UsageView`, from `buildUsageView(this.projectManager.getAllProjects())` (D15).
  - `POST /api/projects/:projectId/deferrals/:deferralId/resolve`, body `{ resolution: string }` → `200 { ok: true }`. The route runs these checks in order and writes nothing until every check passes (D19):
    1. `resolution` is not a string, or its trimmed text is empty or longer than 2,000 characters → 400 `{ error: 'invalid-resolution' }`.
    2. The project is unknown → 404 `{ error: 'Project not found' }`.
    3. `deferralId` does not match `^[A-Za-z0-9_-]+$` → 404 `{ error: 'Deferral not found' }`. This keeps a crafted id out of the file path that `DeferralStorage.filePath` builds.
    4. `storage.get(id)` is null and `storage.fileExists(id)` is false → 404. `get` is null but the file exists → 409 with the reindex message of `src/core/deferral-storage.ts:196-199`.
    5. The record's `status` is not `deferred` → 409 `{ error: 'Deferral <id> is already <status>' }`.
    6. Call `deferralsHandler({ action: 'resolve', projectPath: project.projectPath, id, resolution: trimmed }, { projectPath: project.projectPath, workspacePath: project.workspacePath })` (`src/tools/deferrals.ts:116-153`, which reaches `handleResolve` at `:258-270` and `DeferralStorage.resolve` at `src/core/deferral-storage.ts:307-319`). If it returns `success: false` (a race after the checks), the route replies 409 with its `message`.
  - Deleted: `GET /api/shell/projects/:projectId/specs/:specName` (`src/dashboard/multi-server.ts:611-618`), `GET /api/shell/usage/closed-specs` (`:625-643`), the `usageCache` field (`:161-163`) and the imports at `:32-33`.
- **Post-conditions:** the resolve route sits under the same `onRequest` hooks and access control as every route (`src/dashboard/multi-server.ts:284-300`). It reads only `resolution`; no text reaches a shell. The write fires the watcher's `deferral-change` (`src/dashboard/watcher.ts:216-222`, forwarded at `src/dashboard/project-manager.ts:207-209`), so each member project of the store gets a `deferrals-update` push.

### C8 — Specs page (`src/dashboard_frontend/src/modules/shell/SpecsPage.tsx`, rewritten)
- **Purpose:** Render the blocks (Requirement 1).
- **Interfaces:** reads `specBlocks` from `useShell()`. It shows a block only when `storeOf(projects, block.projectId)` is the store of an enabled `storeGroups` group (`src/dashboard_frontend/src/modules/projects/stores.ts:25-49`), in the order of `storeGroups`, titled with the representative's `projectName`. Each line shows the number, the word as a `Pill` (tone `accent` for live, `success` for closed, `neutral` otherwise; the tones of `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-39`), the spec and the fact. Lines are plain, unselectable and unlinked (D17).
- **Test ids:** `specs-block-<projectId>`, `spec-line-<projectId>-<spec>`, `spec-word-<projectId>-<spec>`, `specs-no-decomposition-<projectId>`, where `projectId` is the block's representative.
- **Deleted:** chips, search, pager, `SpecPanel`, `FileRow`, and the `PageLayout` and `primitives` imports.

### C9 — Usage page (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx`, rewritten)
- **Purpose:** Render `UsageView` (Requirements 4, 5).
- **Interfaces:** fetch `/api/shell/usage` on mount and whenever `controllerRuns` changes, the cue of `src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102`. Keep the one-second tick of `src/dashboard_frontend/src/modules/shell/UsagePage.tsx:117-120` for the time to reset. When `window` is `null`, show "No usage window seen yet". When `resetsAt` is at or before the tick, show "window reset — no reading since" (D9). Otherwise show the per cent left (`100 − round(utilization × 100)`) in large type, the reset time with `toLocaleString()`, the time to reset, and one bar filled to the utilisation. The burn shows `burn` rounded to one decimal place plus " pts in 24 h", or "not known yet". Each run line shows project, spec, phase, tokens and, in implementation, the remaining tasks and "fits before the reset", "does not fit before the reset" or "not known yet". No five-hour window, table or trend.
- **Test ids:** `usage-window`, `usage-left`, `usage-no-window`, `usage-burn`, `usage-run-<runId>`, `usage-fit-<runId>`.

### C10 — Deferrals page (`src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx`, rewritten)
- **Purpose:** One open-record queue with Resolve (Requirements 6 and 7).
- **Interfaces:** for each enabled store group, take the records of the first member with a payload (the rule of `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:54-57`), keep `status === 'deferred'`, and tag each with the group's representative. Sort by `createdAt` ascending, then by `id`. Columns: age (under 24 h `Nh`, else `Nd`, D22), id, project, spec (`originSpec`, else "project"), tag (`tags.join(', ')`), owner (empty when absent), summary (`title`). With no open record, show "Queue empty". Resolve opens an in-row box with a text field, a confirm and a Cancel. The confirm is disabled while the trimmed text is empty or a request is in flight. It POSTs to the representative project's route. On an error reply the box stays open with the reply's `error` text and keeps the typed text. On 200 the box closes, and the row leaves when the next `deferrals-update` replaces the payload.
- **Test ids:** `deferral-row-<projectId>-<id>` (kept from `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:211`), `deferral-resolve-<id>`, `deferral-resolution-<id>`, `deferral-resolve-confirm-<id>`, `deferral-resolve-cancel-<id>`, `deferral-resolve-error-<id>`, `deferrals-empty`.

### C11 — Shell provider and wire copies
- `ShellProvider` (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:60`) stores `specBlocks` from `shell-specs` `data.blocks`, in place of `specRows`.
- The server types (`src/dashboard/shell/types.ts`) and the frontend hand copy (`src/dashboard_frontend/src/modules/shell/types.ts`) lose `SpecListRow`, `SpecDetail` and `UsageSpecRow` (server `:11-51`, frontend `:11-48`). They gain `SpecBlock`, `SpecLine`, `UsageView` and `UsageRunLine`, and `ShellMessage`'s `shell-specs` arm carries `{ blocks: SpecBlock[] }`.

### C12 — Removals (Requirement 8)
- Delete `UsageTrend.tsx`, `PageLayout.tsx`, `primitives.tsx` (no importer remains after C8 to C10), `src/dashboard/shell/usage-rows.ts` and `src/dashboard/shell/__tests__/usage-rows.test.ts`.

### Unchanged artifacts the decomposition names
- Unchanged: `src/dashboard/harness/overview-watch.ts` and `project-watch.ts` (the pages are fed by `ShellFeed`, the `deferrals-update` push and the new route); `src/tools/spec-index.ts` (C3 reads states through `IndexGenerator.snapshot`, read-only); `src/tools/deferrals.ts` (called by C7); the usage action at `src/tools/harness.ts:1397-1451` (Requirement 3 AC6, Requirement 8 AC7); `RateLimitFile` at `src/controller/state.ts:246-253`.

## Data Models

Illustrative — verify against the test fake.

```ts
// src/controller/usage-log.ts
interface UsageLogLine { v: 1; ts: string; sevenDay: { utilization: number }; run: string | null }

// src/dashboard/shell/types.ts (and the frontend copy)
type SpecWord = 'live' | 'closed' | 'deferred' | 'next' | 'stopped' | 'not started';
interface SpecLine { number: string; spec: string; word: SpecWord; fact: string | null }
interface SpecBlock { projectId: string; projectName: string; lines: SpecLine[] }

interface UsageRunLine {
  runId: string; projectId: string; projectName: string; spec: string;
  phase: string | null; tokens: number;
  remaining: number | null;                 // null outside the implementation phase
  fit: 'fits' | 'does-not-fit' | null;      // null reads "not known yet"
}
interface UsageView {
  window: { utilization: number; resetsAt: string } | null;
  burn: number | null;                      // percentage points over 24 h
  runs: UsageRunLine[];
}
```

## Error Handling

1. **Usage log append fails:** C1 logs once and returns; `rate-limit.json` is still written and the step goes on.
2. **Torn log line:** skipped; the lines around it still count.
3. **No `rate-limit.json`:** `window: null`; "No usage window seen yet", and every fit is `null`.
4. **Resolve with bad input or state:** 400, 404 or 409 per C7, nothing written; the box shows the reason and keeps the text.
5. **Usage route fetch fails:** the page keeps the last view.

## Testing Strategy

- **Unit:**
  - `src/controller/__tests__/usage-log.test.ts` (new), with `SDD_HOME` set to a temporary directory. It asserts the line shape (`v`, `ts`, `sevenDay.utilization`, `run` or null); that an unwritable path does not throw and logs once; that two appends give two parsable lines; compaction above 256 KiB; and that torn lines are skipped. `computeBurn` cases: two lines exactly 24 h apart with the clock at the second line equals the difference in points (Requirement 4 AC6); a reset inside the span sums only the positive steps; no anchor gives `null`. `attributedUse` cases: two runs alternate, and each run gets only the steps that end on its own lines.
  - `src/controller/__tests__/step.test.ts`: extend the `onRateLimit` fake at `:79` to record the second argument; assert the run id when `runId` is set and `null` when it is not.
  - `src/controller/__tests__/controller.test.ts`: a fake step that fires `onRateLimit` leaves `rate-limit.json` with the base content and one log line with the run id.
  - `src/dashboard/shell/__tests__/spec-rows.test.ts`: replace the `buildSpecRows` and `buildSpecDetail` suites with `buildSpecBlock` cases. Cover each of the six words with its fact; precedence when rules overlap; file order with non-sequential numbers; an unnamed directory left out; the `(deferred)` tag and the marker; the D5 fallback chain; at most one "next"; and no decomposition. Keep the `isSpecClosed` suite (`:588-644`) as a regression guard.
  - `src/dashboard/harness/__tests__/run-setup.test.ts`: `decompositionHeadings` and `launchableSpec`. `buildSetupView`'s existing assertions are regression guards.
  - `src/dashboard/shell/__tests__/usage-view.test.ts` (new): fit "fits" and "does not fit" for an implementation run with three tasks done and attributed lines; `null` for a document-phase run, for zero tasks done, for no attributed line, and for a passed reset; burn passthrough; live runs of every project.
  - `src/dashboard/shell/__tests__/shell-feed.test.ts`: assert `shell-specs` carries `blocks`, one per store, and keep the five-topic order.
- **Integration:**
  - `src/dashboard/__tests__/deferral-resolve-route.test.ts` (new): 200 with the file holding `status: resolved`, the trimmed text and `resolvedAt`; 400 for empty and for 2,001 characters; 404 for an unknown project, an unknown id and an id with a slash; 409 for a resolved record and for a corrupt file. Each error case leaves the file bytes unchanged.
  - `src/dashboard/__tests__/shell-routes.test.ts`: delete the spec detail and closed-specs cases; add `GET /api/shell/usage` returning `window: null`, `burn: null` and `runs: []` on an empty home. Its `shell-specs` push cases stay as regression guards.
  - `src/dashboard/__tests__/frontend-style-scan.test.ts`: delete the `UsageTrend` series suite (`:448-466`).
  - `src/dashboard/__tests__/controller-dashboard-routes.test.ts:172`: the rate-limit route case stays, a regression guard.
- **End-to-end** (Playwright, worktree config; each suite seeds a `decomposition.md` that names its specs):
  - `e2e/worktree-shell.spec.ts:228-305`: Specs blocks and the toggle; the `(deferred)` heading shows "deferred" with its record id; Deferrals oldest first, Resolve writes `status: resolved` to the record file, and the row leaves after the push (wait for the row count to drop, then assert the file); Usage shows the weekly figure, a burn from two seeded log lines 24 h apart, a fit for a seeded implementation run with three `task.done` rows, and "not known yet" for a document-phase run. Lines 307-309 change the Usage marker to `usage-window` and the list marker to the page's own root test id.
  - `e2e/worktree-visual.spec.ts:57-78`: each view waits for its block, `usage-window` or row; no panel opens.
  - `e2e/worktree-shared.spec.ts:399-414`: replace the spec detail call with `GET /api/projects/:projectId/harness/setup`, and assert that each project's `specs` names the shared spec (D23).
  - `e2e/worktree-no-shared.spec.ts:70-88` and `e2e/worktree-project-list.spec.ts:57-59`: count or locate `spec-line-` and `specs-block-` in place of `spec-row-`.

## Decisions taken in this document

- D13 — The run id reaches the log as an optional second argument of the rate-limit callback, passed where the step stream sees the event: options were change only the run-deps signature and thread the id through every phase, or write the line from the step module; chosen because the step already holds the run id, and the five phase and merge-fix contexts forward the same function untouched.
- D14 — The log is compacted on append once it passes 256 KiB, keeping 8 days, and the reader reads the whole file: options were a backward tail read, no rotation, or this compaction; chosen because the measured rate is about 42 readings a day (291 in the last 7 days of step logs), so the file stays small and one synchronous writer makes the rewrite safe.
- D15 — A new usage route carries the window, the burn and the run lines: options were extend the rate-limit route or add a route; chosen because the rate-limit route has its own test of its exact shape and the health route reads the same file.
- D16 — A paused, waiting or held run keeps "live", its fact ending with the run status: options were a seventh word, or "live" plus the status; chosen because the requirements fix six words and the run still holds its slot.
- D17 — A Specs line links nowhere: options were the decomposition entry, the Home tile, or nothing; chosen because no detail view remains.
- D18 — The tasks a run has finished are the distinct task ids of the run's task-done ledger rows: options were the run's step records or its ledger; chosen because the ledger row is written at the point the task is marked done and carries the run id.
- D19 — The resolve route classifies the request with store reads first, then calls the deferrals tool: options were map the tool's error strings to codes, call the store's resolve directly, or check first and then call the tool; chosen because the requirements name the tool's resolve path, and string matching on its messages is brittle.
- D20 — A fit is "not known yet" also when the window's reset has passed: options were treat the headroom as full or unknown; chosen because no reading confirms the new window, the same reason as D9.
- D21 — The Specs push keeps its topic and carries blocks: options were a new topic or the same one; chosen because the hub and the WebSocket routing already carry it.
- D22 — Age reads in hours under one day, else whole days: options were always days, always hours, or this split; chosen because a fresh record would read zero days.
- D23 — The shared-store end-to-end scenario uses the run-setup route in place of the deleted spec detail route: options were keep the detail route, or move the test; chosen because the setup view reads the same store and D12 deletes the route.
- D24 — The feed passes the live runs of every project of a store, not only the first member's: options were the first live member, or all; chosen because two projects can share a store and the live spec could belong to either.
- D25 — The builder reads the decomposition file once through the cache, and the index snapshot keeps its own read: options were change the index generator to take the text, or accept the second read; chosen because the snapshot's read is unchanged base behaviour, and the spec-index tool must keep its behaviour.
- D26 — The fit's headroom uses the newest log line's utilisation: options were the rate-limit file or the newest log line; chosen because the fit's numerator comes from the same log, so both sides read one series.

## Scope notes

- Carried items from requirements: none.
- The decomposition's three open points are settled here: a paused or held run (D16), the line link (D17), and the log's growth (D14).
- Departures from the requirements' literal, flagged for the reviewer: the performance NFR's "reads decomposition.md once per flush" holds for the builder's own read, but the index snapshot reads it again (D25); Requirement 5 AC3 gains one more "not known yet" case, a passed reset (D20).
- Added to the Requirement 8 AC5 list because it names the deleted spec detail route: `e2e/worktree-shared.spec.ts:399-414`. Also added because they assert `spec-row-` ids: `e2e/worktree-no-shared.spec.ts` and `e2e/worktree-project-list.spec.ts`.
- Cut: nothing.

## Revision History

- **v1** (2026-11-14) — Initial draft.
  - **Lint pass.** 11 fixed (ranges/prefixes corrected): L-3,4,5,6,7,9,37,38,39,40,41. Rejected: L-1,10,11,12,18,30,43,44,46,47,48,49 new identifiers; L-2,15,17,19,20,21,22,23,24,25,26,29,54 filename fragment or design-local var/field; L-8,13,14,16,27,28,31,32,33,34,35,36,42,45,50,51,52,53,55,56,57 token cited elsewhere (multi-citation line match).
