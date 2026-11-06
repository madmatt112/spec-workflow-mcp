# Requirements Document

## Introduction

This spec replaces the dashboard's Now page, sidebar, right panel, Runs page and Run page with one board of large tiles under a top bar. It is for the operator, who must see what waits, moves and starts next. It changes the shell, Home, the run row and the controller behind them (R7 and R12); Specs, Usage and Deferrals keep their content until spec 34.

## Alignment with Product Vision

`.spec-workflow/steering/` holds no `product.md`, so this document aligns to the "Dashboard board specs" preamble of `decomposition.md`: fewer things, larger, colour only for state. It gives specs 33 and 34 the shell they render into.

## Requirements

### Requirement 1 — The shell

**User Story:** As the operator, I want a top bar in place of the sidebar, so that content gets the full width.

#### Acceptance Criteria

1. WHEN any page renders THEN the shell SHALL show one top bar with, in this order: the links Home, Specs, Usage and Deferrals, the Deploy control, Open advisor, and the gear. The links SHALL carry no counts.
2. WHEN the top bar renders THEN it SHALL mount `DeployControl` unchanged, with no props (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/DeployControl.tsx:12`; `.spec-workflow/specs/dashboard-deploy/requirements.md:108`).
3. WHEN Open advisor is pressed THEN it SHALL behave as `src/dashboard_frontend/src/modules/shell/NowPage.tsx:105-139` does, and its result line SHALL wrap.
4. WHEN the gear opens in the top bar THEN its panel SHALL open downward (it opens upward today, `src/dashboard_frontend/src/modules/shell/Gear.tsx:64`) and SHALL hold the theme toggle, a switch per listed project with its name, the notification setting and the version.
5. WHEN the shell builds THEN the density toggle, type, storage key and `--row-h-compact` token SHALL be gone (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:7`, `src/dashboard_frontend/src/modules/shell/Gear.tsx:75-99`). `--row-h` SHALL stay at the comfortable value, because `src/dashboard_frontend/src/modules/shell/primitives.tsx:187` still reads it.
6. WHEN a project switch changes THEN the choice SHALL persist in `localStorage` and every `enabled` filter SHALL follow it.
7. IF the operator has never set the project `sdd-fixture` THEN it SHALL be off, on the board and in the gear, but stay on across reloads once turned on. Every other unset project SHALL stay on (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:74-77`).
8. WHEN the socket is down THEN `ConnectionBanner` (`src/dashboard_frontend/src/modules/app/ConnectionBanner.tsx:13`) SHALL be the only notice; the marker at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:114-121` goes.

### Requirement 2 — What is removed

**User Story:** As the operator, I want unused pages gone, so that nothing stale stays.

#### Acceptance Criteria

1. WHEN the frontend builds THEN `Sidebar.tsx`, `RunsPage.tsx`, `RunPage.tsx` and their routes (`src/dashboard_frontend/src/modules/app/App.tsx:26-27`) SHALL be gone, and `/#/runs` and `/#/runs/` plus any id SHALL land on Home through the catch-all route (`src/dashboard_frontend/src/modules/app/App.tsx:31`).
2. WHEN the server starts THEN `GET /api/controller/runs/:id/log` (`src/dashboard/multi-server.ts:868-875`) and `GET /api/projects/:projectId/specs/:specName/task-reviews/summary` (`src/dashboard/multi-server.ts:594-617`) SHALL answer as unknown routes, and `readRunLogTail` (`src/controller/runs.ts:1494-1528`) SHALL be gone with its tests (`src/dashboard/__tests__/controller-dashboard-routes.test.ts:192`).
3. WHEN those pages go THEN every server message, builder, type and test only they read SHALL go too. At least: `shell-now` with its `NowModel` builder (`src/dashboard/shell/now-model.ts:186-191`), `sidebar-rows.ts`, the derived-wait reader `deriveProjectWaits` (`src/dashboard/shell/waits.ts:111`); `harness-model`, `harness-run-detail`, `run-detail.ts` and the hub's project watches (`src/dashboard/harness/hub.ts:78-93`); and `controller-activity` on the shell feed (`src/dashboard/shell/shell-feed.ts:150-158`). `parseHandoffRouting` SHALL survive, because `src/dashboard/harness/run-setup.ts:16` and `src/dashboard/harness/overview-watch.ts:15` import it from `project-watch.ts`.
4. WHEN the removal lands THEN `cancel`, `pause`, `resume`, `redrive` (`src/dashboard/multi-server.ts:822-856`), the advisor open route (`src/dashboard/multi-server.ts:748-759`), the action routes (`src/dashboard/multi-server.ts:796-812`), the TUI and the HUD SHALL behave as at base (invariant, verified, not red-first).
5. WHEN the removal lands THEN `e2e/worktree-shell.spec.ts`, `e2e/worktree-project-list.spec.ts`, `e2e/worktree-no-shared.spec.ts`, `e2e/worktree-deploy.spec.ts` and `e2e/worktree-visual.spec.ts` SHALL be rewritten to the board or lose the cases that test removed things (for example `e2e/worktree-shell.spec.ts:25-26`, `e2e/worktree-shell.spec.ts:243`), and `src/dashboard/__tests__/frontend-tokens.test.ts:126-127` SHALL match the token list.
6. WHEN the removal lands THEN `docs/SDD-HARNESS.md:99-100`, `docs/SDD-HARNESS.md:120` and `docs/SDD-HARNESS.md:469` SHALL name Home in place of the Runs and Now pages.

### Requirement 3 — Home is three bands

**User Story:** As the operator, I want three fixed bands, so that I read Home in one order.

#### Acceptance Criteria

1. WHEN Home renders THEN it SHALL show the bands Needs you, Running and Next, in that order, each always open, no collapse.
2. WHEN a band has no tile THEN it SHALL show one quiet line.
3. WHEN the viewport is 1024 px wide or more THEN each band SHALL lay its tiles in two columns; below that, in one.
4. WHEN Home renders THEN it SHALL have no filter, search, pagination or grouping; the project SHALL be a neutral tag on each tile.
5. WHEN a wait, run or action belongs to a project that is off THEN Home SHALL show no tile for it. This includes controller waits, which are not filtered today (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:245-248`).
6. WHEN Needs you renders THEN it SHALL hold one tile per open controller wait and per staged advisor action, oldest `created` first. Waits derived from harness files SHALL NOT appear.
7. WHEN Running renders THEN it SHALL hold one tile per run in status `queued`, `running`, `merging`, `paused` or `waiting`, and then one per stopped run that R7 AC 6 admits. Moving runs SHALL sort most stale first, by `lastActivity`, else `updated`, oldest first; stopped runs SHALL sort after them, newest `updated` first.
8. WHEN Home renders THEN it SHALL show no closed-spec list and no tile for a project with nothing launchable (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:384-415` goes).
9. WHEN Next renders THEN it SHALL sort by the launchable spec's position among the `###` headings of its own `decomposition.md`; a spec not named there SHALL sort last, and ties SHALL sort by project name.

### Requirement 4 — The wait tile

**User Story:** As the operator, I want large wait tiles, so that the oldest stands out.

#### Acceptance Criteria

1. WHEN a wait tile renders THEN it SHALL show the kind label, project tag, spec, the wait's summary line, the age in the display type size, and one action, "Answer". The summary line SHALL be `ctrlSummary` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78`): the decision, item or proposal count for `gate-a`, `gate-b` and `retro-plan`, else the first line of `questions[0].text`, else the kind's fixed line.
2. WHEN the age is under 15 minutes THEN the tile SHALL be neutral; from 15 minutes to under 1 hour, amber; at 1 hour and after, red. The colour SHALL change with no reload.
3. WHEN a `merge` wait tile renders THEN it SHALL show the PR number, the CI state and the rule verdict from the `prReads` (`src/controller/state.ts:112`) of the run named by `wait.run`. The read SHALL match the wait's question id: `merge` takes the `kind: 'run'` read (`src/controller/merge.ts:28`); `merge:` plus repo and number takes the read with that repo and number (`src/controller/merge.ts:556`). IF no read matches THEN the tile SHALL say "PR not read yet".
4. WHEN "Answer" is pressed THEN the existing answer sheet (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:500-701`) SHALL replace the board at full width, with a "Back to board" link and no panel beside it.
5. WHEN the sheet's wait is answered, here or elsewhere, THEN the board SHALL return.

### Requirement 5 — The staged action tile

**User Story:** As the operator, I want staged actions beside my waits, so that I decide in one place.

#### Acceptance Criteria

1. WHEN an action has state `staged` or `running` THEN Needs you SHALL show a tile with its kind, target, reason, age and, while `staged`, Confirm and Dismiss. The age SHALL colour the tile by the R4 AC 2 rule.
2. WHEN an action has any other state THEN it SHALL show no tile, except a tile pressed in this view stays until R9 has shown the outcome.
3. WHEN an action's target names no project THEN the tile SHALL show with no project tag and SHALL ignore the project filter.
4. WHEN a staged launch is confirmed THEN its run tile SHALL appear in Running; the launch itself is an invariant (verified, not red-first: `src/dashboard/multi-server.ts:796-801`).

### Requirement 6 — The run tile

**User Story:** As the operator, I want step, age and liveness on the tile, so that it replaces the Run page.

#### Acceptance Criteria

1. WHEN a run tile renders THEN it SHALL show the spec, project tag, step kind, the task when there is one, the step age while a step is in flight, and the pause note of `src/dashboard_frontend/src/modules/shell/pause.ts:33-48` when there is one.
2. WHEN a step is in flight THEN the tile SHALL show "last activity N ago" and a dot. The heartbeat age SHALL run from `lastActivity`, else from the step's start: under 5 minutes green, from 5 to under 15 minutes amber, at 15 minutes and after red.
3. WHEN no step is in flight THEN the dot SHALL be grey and no heartbeat line SHALL show.
4. WHEN a run has status `running` and `driven: false`, or status `waiting` with an open wait whose question id is `drive-crash` (`src/controller/waits.ts:193`), THEN the tile SHALL show red "Stalled" and Re-drive in place of the dot. `src/controller/controller.ts:205-222` accepts exactly these. No other run with `driven: false` SHALL read as stalled.
5. WHEN Re-drive is accepted THEN the tile SHALL show a green dot within 15 s of the step's spawn.
6. WHEN a pause is pending (`pauseRequested` set, status not `paused`) THEN "pause requested" SHALL become "pausing after this step" (`src/dashboard_frontend/src/modules/shell/pause.ts:42-45`): a running run's note reads just that; a waiting run keeps its waiting text with a "· pausing after this step" suffix. Once applied, the note SHALL start with "paused".
7. WHEN a run has `holdBy: 'deploy'` THEN the note SHALL read "held for deploy" and the tile SHALL offer no Resume (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/pause.ts:34-36`, `e2e/worktree-deploy.spec.ts:271`).

### Requirement 7 — Run tile actions

**User Story:** As the operator, I want run controls on the tile, so that I need no other page.

#### Acceptance Criteria

1. WHEN a run is in a status of R3 AC 7's moving list and `isOperatorHeld` is false THEN the tile SHALL offer Pause (`src/dashboard_frontend/src/modules/shell/pause.ts:27-30`).
2. WHEN `isOperatorHeld` is true, or the run is `paused` and not held by a deploy, THEN the tile SHALL offer Resume in place of Pause.
3. WHEN a run is moving THEN the tile SHALL offer Stop, which SHALL call the `cancel` route and keep the worktree, branch and PR.
4. WHEN a run is `abandoned`, `error` or `done` THEN the tile SHALL offer Discard in place of Stop, and no Pause or Resume.
5. WHEN Discard is pressed THEN the tile SHALL ask for a second press that names what goes ("This deletes the worktree and branch and closes the PR", `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360`), and only that press SHALL call the route.
6. WHEN the run is `abandoned` or `error` with its branch present, or `done` with its branch present and `updated` under 24 hours old, THEN it SHALL have a tile. Otherwise a stopped run SHALL have none.
7. IF another run in a moving status has the same `branch` and `codeRoot` THEN the tile SHALL NOT offer Discard, and the `discard` route SHALL answer 409 `branch-in-use` and change nothing. The route has no such check at base (`src/controller/runs.ts:1400-1422`).
8. WHEN a `done` run is discarded THEN its status SHALL stay `done`; `cancelRun` writes `abandoned` today (`src/controller/runs.ts:1374-1390`).

### Requirement 8 — The Next tile

**User Story:** As the operator, I want a Launch tile per startable project, so that the next spec is one press away.

#### Acceptance Criteria

1. WHEN an enabled project's setup view (`GET /api/projects/:projectId/harness/setup`, `src/dashboard/multi-server.ts:662-674`) has a non-null `launchable` THEN Next SHALL show a tile with the spec, the project tag, the setup in one line, and Launch. `NowModel.idle` SHALL NOT be the source: it omits the decomposition fallback (`src/dashboard/shell/now-model.ts:127-133`, `src/dashboard/harness/run-setup.ts:198-202`).
2. WHEN two listed projects share a store THEN Next SHALL show at most one tile for that store, using the group's representative (`src/dashboard_frontend/src/modules/projects/stores.ts:25-43`) when it is on, else the enabled member.
3. WHEN the setup line renders THEN it SHALL state the supervisor model, the role count, the worktree value, and gates as `record` (the launch route forces it, `src/dashboard/multi-server.ts:687`); `view.gates` SHALL NOT show.
4. WHEN `launchBlock` (`src/controller/controller.ts:386-399`) nulls `launchable` (`src/dashboard/multi-server.ts:671`) THEN the project SHALL show no Next tile.
5. WHEN a run ends or starts THEN Next SHALL reflect it within 5 s with no reload; the fetch on mount of `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:404` is not enough.
6. WHEN Launch is pressed THEN it SHALL post `buildLaunchInput` as at base (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/harness.tsx:40-52`). The tile SHALL have no edit control.

### Requirement 9 — Every action shows its stages

**User Story:** As the operator, I want each press to report in its tile, so that I know it worked.

#### Acceptance Criteria

1. WHEN Pause, Resume, Stop, Discard, Re-drive, Launch, Confirm or Dismiss is pressed THEN its tile SHALL show the stages pressed, running, done, or failed with the reason, and the pressed control SHALL be disabled until the stage ends.
2. WHEN the route answers non-2xx THEN the failed stage SHALL show the body's `reason`, else its `error`, else the status code. Launch refusals SHALL keep `OpErrorView` (`src/dashboard_frontend/src/modules/shell/harness.tsx:69-108`).
3. WHEN the route answers 2xx THEN the stage SHALL read running until the run row, action record or setup view shows the result, then done, then clear after 5 s.
4. WHEN a failed stage shows THEN it SHALL stay until the next press on that tile, the tile leaves, or the page reloads.

### Requirement 10 — The tab title

**User Story:** As the operator, I want the wait count and oldest age in the tab, so that I see them from other windows.

#### Acceptance Criteria

1. WHEN any page is open and open controller waits exist on enabled projects THEN `document.title` SHALL read the count, " · " and the oldest age, such as "2 · 4h20m". Staged actions SHALL NOT count.
2. WHEN the age renders in the title THEN it SHALL be `<h>h<m>m` from one hour, `<m>m` under one hour, `<d>d<h>h` from one day, and SHALL carry no spaces or seconds.
3. WHEN no such wait is open THEN the title SHALL be the base title of `src/dashboard_frontend/index.html:6`.

### Requirement 11 — Look

**User Story:** As the operator, I want large type and colour only for state, so that the board reads at a glance.

#### Acceptance Criteria

1. WHEN the tokens build THEN every colour value of `src/dashboard_frontend/src/modules/theme/tokens.css:61-160` SHALL be unchanged (invariant, verified, not red-first), and `tokens.css` SHALL stay the only file that declares token values.
2. WHEN the type scale changes THEN `tokens.css` SHALL gain a display step of at least 32 px and tile body text of at least 14 px, plus the tile spacing steps; `--sidebar-w` SHALL go. The steps at `src/dashboard_frontend/src/modules/theme/tokens.css:9-17` SHALL keep their values.
3. WHEN a tile renders THEN only the neutral surface and the success, warning, danger and neutral tones SHALL colour it, each meaning the state R4 and R6 define. Tile buttons SHALL use the `secondary` variant (`src/dashboard_frontend/src/modules/ui/ui.tsx:29-34`), except the `danger` Discard press.
4. WHEN Home renders THEN light and dark SHALL both work, and `src/dashboard/__tests__/frontend-tokens.test.ts` and `src/dashboard/__tests__/frontend-style-scan.test.ts` SHALL stay green.
5. WHEN the viewport is 390 px wide THEN no page SHALL scroll sideways: `document.documentElement.scrollWidth` SHALL not exceed the viewport width, with the deploy strip open and an advisor result showing.

### Requirement 12 — What the run row carries

**User Story:** As the operator, I want every tile field derived from records, so that no model writes status text.

#### Acceptance Criteria

1. WHEN `toRow` builds a row (`src/controller/runs.ts:1453-1465`) THEN the row SHALL also carry, with no path: whether a step is in flight, the step's ISO start time, the task id when the step works one, whether the run's branch is present (for R7 AC 6), and whether Discard is allowed (R7 AC 7). The two differ: a branchless run is absent, a branch-in-use one shows without Discard. At base the row has none: `inFlight.startTime` is a `/proc` value (`src/controller/state.ts:39-46`) and nothing writes `cursor.task` (`src/controller/state.ts:26-36`).
2. WHEN a step spawns THEN the run record SHALL hold the step's ISO start time (converted from the numeric spawn value) and, when the step works a task, its task id; both SHALL clear when the step ends. The task id is not on the spawn callback (`src/controller/runs.ts:455-458`); design SHALL route it from the implementation phase where the task is known (`src/controller/phases/implementation.ts:469`, `:616-617`).
3. IF an in-flight record predates these fields THEN the row SHALL report no start time and the tile SHALL omit the step age.
4. WHEN the row is sent THEN `driven`, `lastActivity`, `prReads`, `holdBy` and `stepKind` SHALL hold as at base (invariant, verified, not red-first), and no model SHALL write any tile field.

## Non-Functional Requirements

### Performance
- The branch-presence read SHALL run at most once per stopped run per 60 s; the feed can flush once a second (`src/dashboard/shell/shell-feed.ts:46`).

### Security
- The run row SHALL carry no filesystem path (`src/controller/runs.ts:1425`).

### Reliability
- A failed branch read SHALL report the branch as not present, so the run shows no tile. A failed setup fetch SHALL show no Next tile for that project only.

## Decisions taken in this document

- D1 — No money, billing, personal-data or legal surface, so no refunds or credits; the one deletion is Discard of the operator's own worktree, branch and PR, irreversible, behind a second press, because the operator owns it and the confirm covers it.
- D2 — A done run with its branch present keeps a tile for 24 hours, because 21 of 28 done runs still have their branch, which would otherwise fill Running with finished work.
- D3 — Home shows controller waits only, because tiles derive from records and a stale draft plan would hold a retro tile forever.
- D4 — Only the feeds the removed pages read are deleted here, not for spec 34, because the entry says removed with their components and tests, and lists the hub.
- D5 — Discard refuses when a moving run shares the branch, because a relaunch reuses it, so Discard could delete a live run's work.
- D6 — The controller records step start and task at spawn and the row carries them, because the fields do not reach the wire today. This adds controller files to the entry's list.
- D7 — Stalled means running and not driven, or waiting on a drive-crash wait, because every other driven-false run is a normal wait or pause.
- D8 — A discarded done run stays done, because it did finish.
- D9 — Specs and Deferrals keep their panels until spec 34, because spec 34 rewrites those pages.
- D10 — Next orders by heading position, then project name, because decompositions are per project.
- D11 — One Next tile per store, because the second launch would be refused.
- D12 — Staged actions take the wait age colours and order, because they are Needs-you tiles.
- D13 — The gear keeps notifications and version, dropping the project dots, because Home shows project state.
- D14 — Tile buttons are neutral, because colour means state.
- D15 — The fixture default keys on the project name, because a registry flag adds a server field for one project.
- D16 — Two columns from 1024 px, display type at least 32 px, tile text at least 14 px, old steps kept, because spec 34 has not rebuilt the others.
- D17 — Stopped runs sort after moving runs, because a stopped run would always lead.
- D18 — The tab title counts enabled waits only, because it should match the board.

## Scope notes

- Carried items: none.
- Cut: the right panel stays on Specs and Deferrals until spec 34 (D9); `done` runs keep a tile for 24 hours only (D2).
- Added: the `discard` guard (R7 AC 7), the `done` status fix (R7 AC 8) and the controller writes of R12. The entry's "Design MUST enumerate" list omits `src/controller/runs.ts`, `src/controller/state.ts` and the step-spawn path in `src/controller/phases/implementation.ts`; design adds them.
- Narrowed: "A run with `driven: false`" reads as R6 AC 4 (D7).
- Left to design: a confirm on Stop for a stalled run; the `merging` and `queued` tiles beyond R6 and R7; the enable default for the two tradr entries.

## Revision History

- **v1** (2026-11-06) — Initial draft.
  - **Lint pass.** 8 fixed; rejected: none.
- **v2** (2026-11-06) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/3/1).
  - **R1-1 — Accepted (MUST_FIX).** R12 AC 1 now carries two path-free signals, branch-present and Discard-allowed, read by R7 AC 6 and AC 7, so the three stopped-run outcomes separate.
  - **R1-2 — Accepted (SHOULD_FIX).** R12 AC 2 now converts the start time from the numeric spawn value and routes the task id from the implementation phase; the scope note adds that file.
  - **R1-3 — Accepted (SHOULD_FIX).** R4 AC 1 now reads the per-kind summary: a count for gate and retro-plan, else the first question line, else the fixed line.
  - **R1-4 — Accepted (SHOULD_FIX).** R6 AC 6 now fixes the waiting case: the suffix becomes "pausing after this step", the waiting text stays; both branches cited.
  - **R1-5 — Accepted (MINOR).** The intro now names the R7 and R12 controller changes.
