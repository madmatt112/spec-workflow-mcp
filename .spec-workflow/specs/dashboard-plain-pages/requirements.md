# Requirements Document

## Introduction

This spec rebuilds the three plain pages of the dashboard: Specs becomes the decomposition as an ordered list, Usage becomes the weekly window with a burn and a fit, and Deferrals becomes one queue table with a Resolve action. It is for the one operator who reads the dashboard to answer three questions: where each project is, how much of the week is left, and what is in the queue. It adds one controller writer (the usage log), one server route (resolve), and removes the panels, filters, the cost tab and the trend.

## Alignment with Product Vision

`.spec-workflow/steering/product.md` does not exist in this repository, so this section aligns with the decomposition's dashboard-board block instead. That block sets the rule "fewer things, larger, colour only for state, and three plain pages" and makes this spec the last of 30 to 34. Every field on the three pages is derived from files on disk by deterministic code; no model writes any text.

## Requirements

### Requirement 1 — Specs page: the decomposition as a list

**User Story:** As the operator, I want each project's decomposition as one ordered list with a state word, so that I see where each project is without opening anything.

#### Acceptance Criteria

1. WHEN the Specs page renders THEN the dashboard SHALL show one block per enabled spec store (D2), titled with the store's representative project name (rule of `src/dashboard_frontend/src/modules/projects/stores.ts:16-22`).
2. WHEN a block renders THEN it SHALL list one line per `decomposition.md` heading that matches the heading regex at `src/dashboard/harness/run-setup.ts:23`, in the order the headings appear in the file (D3).
3. WHEN a line renders THEN it SHALL show exactly four things: the heading's number as written, one state word from Requirement 2, the spec name, and the one fact Requirement 2 assigns to that word (or nothing where Requirement 2 assigns none).
4. IF a store has no `decomposition.md` or the file has no matching heading THEN its block SHALL show one quiet line, "No decomposition".
5. WHEN a spec directory exists that no heading names THEN the Specs page SHALL NOT list it (D4).
6. WHEN the Specs page renders THEN it SHALL show no state chips, no search box, no pager, no document versions, no phase table and no detail panel; a line is not a selectable row.
7. WHEN a project is disabled in the gear THEN its store's block SHALL be absent, unless another enabled project shares the store (the enabled rule of `src/dashboard_frontend/src/modules/projects/stores.ts:39`).
8. WHEN `decomposition.md`, a spec directory, a HANDOFF phase-log row or a run record changes THEN the Specs page SHALL show the new state within one shell-feed tick (30 s, `src/dashboard/shell/shell-feed.ts:44`) with no reload.

### Requirement 2 — State words and facts

**User Story:** As the operator, I want one state word and one fact per spec, so that a glance tells me what happened to it.

#### Acceptance Criteria

1. WHEN a line's state is computed THEN the first matching rule SHALL win, in this order: live, closed, deferred, next, stopped, not started (D1).
2. IF a run for any project of the store is live by the rule of `src/dashboard/shell/live-runs.ts:10-18` and its spec is the heading's spec THEN the word SHALL be "live" and the fact SHALL be the run's phase and, in the implementation phase, the spec's task progress as done/total (for example "implementation 3/7").
3. IF the spec is closed by `isSpecClosed` (`src/dashboard/shell/spec-rows.ts:78-82`) THEN the word SHALL be "closed" and the fact SHALL be the distinct PR numbers found as "PR #n" in the spec's HANDOFF phase-log notes, ascending (the rule of `src/dashboard/shell/spec-rows.ts:149-154`), or "no PR recorded" when there are none (D6).
4. IF the heading line carries `(deferred)` (the tag `src/controller/phases/document.ts:1156-1158` writes) or the spec directory holds a `deferred.json` marker (`src/core/index-generator.ts:263-278`) THEN the word SHALL be "deferred" and the fact SHALL be a deferral record id chosen by D5, or "no record" when D5 finds none.
5. IF the spec is the store's launchable spec as the setup view computes it before the launch guards (`src/dashboard/harness/run-setup.ts:199-207`) THEN the word SHALL be "next" with no fact.
6. IF the spec directory holds any of `requirements.md`, `design.md`, `tasks.md` or `harness-events.jsonl` (the test at `src/dashboard/shell/spec-rows.ts:124-126`) and no earlier rule matched THEN the word SHALL be "stopped" and the fact SHALL be the phase it stopped in: the newest HANDOFF phase-log row's phase, else the index entry's current phase.
7. IF no earlier rule matched THEN the word SHALL be "not started" with no fact.
8. WHEN a store's state words are computed THEN at most one line SHALL read "next".
9. WHEN a word renders THEN its colour SHALL come from the existing state tones (`src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-39`): live in the accent tone, closed in the success tone, every other word neutral (colour means state only).

### Requirement 3 — The usage log

**User Story:** As the operator, I want each rate-limit reading kept with its time and run, so that the dashboard can compute a burn and a fit without a model.

#### Acceptance Criteria

1. WHEN a step's stream emits a `rate_limit_event` (`src/controller/step.ts:499-502`) THEN the controller SHALL append one JSON line to `usage-log.jsonl` in the controller home (`src/controller/state.ts:293-297`; by default `~/.local/state/sdd/usage-log.jsonl`) holding `v: 1`, `ts` (the controller clock, ISO), `sevenDay.utilization` (0..1, as received) and `run` (the id of the run whose step emitted the event) (D10).
2. WHEN the line is appended THEN the existing `rate-limit.json` write (`src/controller/controller.ts:790-803`) SHALL still happen with the same content; the log does not replace it.
3. IF the append fails THEN the controller SHALL log the error once per failure and SHALL NOT fail, pause or retry the step.
4. WHEN two events arrive at once THEN each SHALL land as one whole line; no line is interleaved with another.
5. WHEN the controller home is set by `SDD_HOME` THEN the log SHALL live under that home, so a test never writes the operator's real log.
6. WHEN the usage tool action (`src/tools/harness.ts:1397-1451`) runs THEN its output SHALL be unchanged by this spec. This is an invariant (verified, not red-first).

### Requirement 4 — Usage page: the weekly window and the burn

**User Story:** As the operator, I want to see in one large figure how much of the week is left and how fast it is going, so that I know whether to start more work.

#### Acceptance Criteria

1. WHEN the Usage page renders and `rate-limit.json` holds a seven-day window THEN the page SHALL show, in large type, the per cent left (100 minus the utilisation in per cent, rounded), the reset time in local time, the time to reset, and one bar filled to the utilisation.
2. IF the window's `resetsAt` is in the past THEN the page SHALL show "window reset — no reading since" in place of the per cent left, matching how the controller reads a passed reset (`src/controller/controller.ts:695-701`) (D9).
3. IF `rate-limit.json` is absent THEN the page SHALL show one quiet line, "No usage window seen yet".
4. WHEN the page renders THEN it SHALL show the burn over the last 24 h as one figure in percentage points of the weekly window, computed by the server per D7.
5. IF the log holds no line at or before 24 h ago THEN the burn SHALL read "not known yet".
6. WHEN two log lines 24 h apart are the only lines and the clock (a test seam) reads the second line's time THEN the burn SHALL equal the second utilisation minus the first, in percentage points.
7. WHEN the page renders THEN it SHALL NOT show the five-hour window.
8. WHEN a `controller-runs` push arrives THEN the page SHALL refetch its figures, as the current page does (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102`).

### Requirement 5 — Usage page: live runs and the fit

**User Story:** As the operator, I want one line per live run that tells me whether its remaining tasks fit before the reset, so that I can hold or let a run continue.

#### Acceptance Criteria

1. WHEN the page renders THEN it SHALL show one line per live run of every registered project (D11), each with the project name, the spec, the phase and the run's tokens so far (`tokens` of the run row, `src/dashboard_frontend/src/modules/shell/types.ts:174`).
2. IF the run is in the implementation phase and has finished at least one task THEN its line SHALL show the remaining tasks (total minus done from the spec's `tasks.md`) and either "fits before the reset" or "does not fit before the reset", by the formula of D8.
3. IF the run is in a document phase, or has finished no task, or the log holds no line for the run THEN the fit SHALL read "not known yet".
4. WHEN a live implementation run has three tasks done and log lines attributed to it THEN its line SHALL show a fit; WHEN a live document-phase run is listed THEN its line SHALL read "not known yet".
5. WHEN the server computes the burn and the fit THEN the page SHALL only render them; the frontend reads no log.

### Requirement 6 — Deferrals page: the queue

**User Story:** As the operator, I want every open deferral across my projects in one table, oldest first, so that I work the queue from the top.

#### Acceptance Criteria

1. WHEN the Deferrals page renders THEN it SHALL show one table of every record whose status is `deferred` across every enabled spec store, each store read once (D2).
2. WHEN a row renders THEN it SHALL show, in this order: age (now minus `createdAt`, as days or hours), id, project (the store's representative name), spec (`originSpec`, or "project" when null), tag (the record's tags joined by ", "), owner (`matthew`, `harness` or empty), summary (the record's `title`).
3. WHEN the table renders THEN rows SHALL sort by age, oldest first; ties sort by id.
4. WHEN the page renders THEN it SHALL show no status chips, no owner chips, no search box, no pager and no detail panel.
5. IF no open record exists THEN the page SHALL show one quiet line, "Queue empty".
6. WHEN a `deferrals-update` push arrives (`src/dashboard/multi-server.ts:436-451`) THEN the table SHALL refresh with no reload. This push path exists at base and is an invariant (verified, not red-first).

### Requirement 7 — Resolve

**User Story:** As the operator, I want to resolve a deferral from its row, so that I do not have to open a session to close a queue item.

#### Acceptance Criteria

1. WHEN the page renders THEN every row SHALL carry a Resolve button.
2. WHEN Resolve is pressed THEN a resolution box SHALL open in the row with a text field, a Resolve confirm and a Cancel; Cancel closes it and writes nothing.
3. WHEN the confirm is pressed with non-empty text THEN the frontend SHALL POST `{ resolution }` to `/api/projects/:projectId/deferrals/:deferralId/resolve`.
4. WHEN the route receives a valid request THEN it SHALL resolve the record through the deferrals tool's resolve path (`src/tools/deferrals.ts:258-270`, which calls `src/core/deferral-storage.ts:307-319`), so the record file holds `status: resolved`, the trimmed text as `resolution`, and `resolvedAt`; it SHALL reply 200.
5. IF the trimmed resolution is empty or longer than 2,000 characters THEN the route SHALL reply 400 and write nothing.
6. IF the project or the record does not exist THEN the route SHALL reply 404; IF the record is not `deferred` THEN it SHALL reply 409; IF the record's frontmatter cannot be parsed THEN it SHALL reply 409 with the reindex message. No case writes the file.
7. WHEN the write succeeds THEN the row SHALL leave the table after the `deferrals-update` push for that project arrives; a test asserting the row's absence first waits for that push.
8. IF the route replies with an error THEN the box SHALL stay open and show the reason; the text the operator typed SHALL be kept.
9. WHEN the box's request is in flight THEN the confirm SHALL be disabled, so one press sends one request.

### Requirement 8 — Removals

**User Story:** As the operator, I want the parts no page uses gone, so that the dashboard carries no dead code.

#### Acceptance Criteria

1. WHEN this spec lands THEN `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx` SHALL be deleted, and the Usage page SHALL show no per-spec cost table and no trend.
2. WHEN this spec lands THEN the closed-specs route (`src/dashboard/multi-server.ts:625-643`), `src/dashboard/shell/usage-rows.ts`, its test, and both copies of `UsageSpecRow` SHALL be deleted (D12).
3. WHEN this spec lands THEN the spec detail route (`src/dashboard/multi-server.ts:611-618`), `buildSpecDetail`, both copies of `SpecDetail`, `SpecPanel` and `FileRow` SHALL be deleted (D12).
4. WHEN this spec lands THEN `PageLayout.tsx` and `primitives.tsx` SHALL be deleted if no module imports them; today the three pages are their only importers.
5. WHEN a test or a static scan names a deleted file, route, type or test id THEN it SHALL be updated or deleted in the same change (at least `src/dashboard/__tests__/shell-routes.test.ts`, `src/dashboard/__tests__/frontend-style-scan.test.ts`, `e2e/worktree-shell.spec.ts:228-305`, `e2e/worktree-visual.spec.ts:63-75`).
6. WHEN this spec lands THEN `npm run build`, `npx tsc --noEmit` and `npm test` SHALL be green.
7. WHEN this spec lands THEN `src/tools/spec-index.ts`, the `harness-events.jsonl` ledgers and `src/tools/harness.ts` usage action SHALL keep their behaviour. This is an invariant (verified, not red-first).

## Non-Functional Requirements

### Performance
- The server's read of `usage-log.jsonl` for one Usage page request covers at most the lines of the last 8 days; the design picks rotation or a tail read (decomposition "the log's growth and rotation").
- The Specs builder reads each store's `decomposition.md` once per feed flush, through the existing file cache (`src/dashboard/shell/shell-feed.ts:31`).

### Security
- The resolve route sits behind the same auth and CORS hooks as every other mutating `/api` route and accepts only the `resolution` string; no request text reaches a shell. The dev proxy already rewrites `Origin` for a mutating fetch (`src/dashboard_frontend/vite.config.ts:27-46`).

### Reliability
- A missing, empty or torn `decomposition.md`, `usage-log.jsonl` line or deferral file yields an empty or "not known yet" field and never a thrown error or a 500.
- A log line that does not parse is skipped; the lines around it still count.

## Decisions taken in this document

- D1 — Add a sixth state word, "stopped", for a spec with documents that is not live, closed, deferred or next: options were keep five words and show such a spec as "not started", show it as "next", or add "stopped"; chosen because "not started" is false for a spec with documents and routing allows only one "next".
- D2 — One block (Specs) and one read (Deferrals) per spec store, not per registered project: options were one block per enabled project, or one per store; chosen because two registered projects share one tradr store and per-project blocks would list the same decomposition and records twice.
- D3 — List headings in file order and show each heading's number as written: options were file order, or sort by number; chosen because the decomposition file is the build order and its numbers are not in sequence.
- D4 — Leave out spec directories that no heading names: options were list them after the headings under "other", or leave them out; chosen because the page shows the decomposition and nothing else.
- D5 — The deferred line's record id is the newest open record whose origin spec is the spec, else the first deferral id written in the heading's entry text, else "no record": options were only the origin-spec record, only the entry text, or this fallback chain; chosen because a gate-A deferral writes no record and older deferrals name their record only in the entry text.
- D6 — A closed line's fact is every PR number in the spec's HANDOFF phase-log notes, else "no PR recorded": options were the run record's PR, the close-out PRs, or the phase-log notes; chosen because run records can be removed and the phase log is the durable record the current page already reads.
- D7 — Burn is the sum of the positive steps between consecutive log lines from the newest line at or before 24 h ago up to the newest line, in percentage points, and "not known yet" when the log does not reach back 24 h: options were the plain difference of two lines, the same over a shorter span with its length shown, or the sum of positive steps; chosen because a weekly reset inside the 24 h makes a plain difference negative, and the sum equals the plain difference when no reset falls inside.
- D8 — A run's fit uses its own attributed utilisation: the sum of positive steps between consecutive log lines where the later line carries the run's id, divided by the tasks the run has finished, times the remaining tasks, compared with the headroom (1 minus the latest utilisation); "fits" when the product is at most the headroom: options were the window delta since the run started (it counts other runs' spend), or per-run attribution; chosen because two runs often share the window and the delta since start would charge one run for both.
- D9 — A passed reset shows "window reset — no reading since": options were show the stale reading, show 100 per cent left, or say the window reset; chosen because the controller itself reads a passed reset as reset and no reading confirms the new value yet.
- D10 — The log lives in the controller home with a version field: options were a fixed home path or the controller home; chosen because the controller home is where the rate-limit file lives and the home variable keeps tests off the real file.
- D11 — The Usage page lists live runs of every registered project, enabled or not: options were enabled projects only, or every project; chosen because the weekly window is account-wide and a run in a hidden project still spends it.
- D12 — Delete the closed-specs route, the spec detail route and their builders and types with their pages' callers: options were keep the routes for a later caller, or delete them; chosen because no caller remains and the usage tool action keeps the data.

## Scope notes

- Carried items from the decomposition: none.
- Cut or changed against the decomposition entry: D1 adds the word "stopped" to the five the entry lists; D2 groups by spec store where the entry says "one block per enabled project".
- Left to the design, as the entry asks: the state word or fact for a live run that is paused or held; whether a Specs line links anywhere; the log's growth and rotation; the source of "tasks the run has finished" for D8 (the run's ledger or its step records).
- Out of scope: the Home board, the ruling view and the top bar (specs 32 and 33); the TUI and the HUD; any change to the deferrals tool's behaviour or to `spec-index`.
- Steering: `product.md` is absent, so the alignment section cites the decomposition block instead.

## Revision History

- **v1** (2026-11-13) — Initial draft.
  - **Lint pass.** 0 fixed; rejected (all citation-identifier false positives — each flagged token names an artifact this spec defines or a deletion target the context file maps, while the adjacent citation correctly anchors a different phrase): L-1/L-2/L-3 the new log-line names `usage-log.jsonl`, `sevenDay.utilization` and `run` (D10), absent from the cited event-trigger (`src/controller/step.ts:499-502`) and controller-home (`src/controller/state.ts:293-297`) ranges by design; L-4 `UsageSpecRow`, a type deleted from `src/dashboard/shell/types.ts:40-51` and its frontend copy, not the cited closed-specs route `src/dashboard/multi-server.ts:625-643`; L-5/L-6 `SpecPanel` and `FileRow`, deleted components at `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:239-385` and `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:387-436`, not the cited spec-detail route `src/dashboard/multi-server.ts:611-618`; L-7 `resolution`, the resolve route's request field (Requirement 7), not the cited Origin-rewrite range `src/dashboard_frontend/vite.config.ts:27-46`.
