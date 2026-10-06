# Requirements Document — dashboard-shell

Document version: v3

## Introduction

This spec replaces the dashboard shell with five pages (Now, Runs, Specs, Usage, Deferrals), a sidebar with a project filter, and a detail panel (docs/dashboard-redesign.md). It is for the operator who runs the harness on several projects and today reads a hand-written HUD and a TUI. Every row is derived from files the harness writes, and the legacy pages, the project dropdown and their translations and tests are removed (spec-decomposition/decomposition.md:784-855).

## Alignment with Product Vision

This repository has no steering `product.md`, so this document aligns with the decomposition entry and the approved redesign memo's decision that the dashboard replaces the HUD and the TUI with derived state only. Specs 16, 17 and 18 render inside this shell.

## Requirements

### Requirement 1 — The shell

**User Story:** As the operator, I want one sidebar, a project filter and a list-plus-panel layout, so that I see all projects without switching.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the system SHALL show one sidebar with exactly five routes in this order: Now (`/`), Runs (`/runs`), Specs (`/specs`), Usage (`/usage`), Deferrals (`/deferrals`). Now, Runs, Specs and Deferrals SHALL show the filtered count of waits, live runs, specs and `deferred` records; Usage shows none.
2. WHEN the dashboard loads THEN the sidebar SHALL list every registered project from `/api/projects/list` (src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:62-105) as a toggle, all on by default (a project absent from the stored toggle map counts as on), kept in `localStorage`. Every list on every page SHALL show only rows of projects whose toggle is on.
3. The system SHALL NOT render a project dropdown or any control that selects one current project, and every page SHALL render with any number of projects toggled on. Today the route table renders only when one project is selected (src/dashboard_frontend/src/modules/app/App.tsx:240-270).
4. WHEN the operator opens the gear at the foot of the sidebar THEN it SHALL show the theme (light or dark), the language, the list density and the notification sound volume.
5. Every page SHALL be a list area and a detail panel. WHEN the operator selects a row THEN the panel SHALL show that row's details.
6. Every list row SHALL render at the list density the operator selects in the gear — compact (32 CSS px per row) or comfortable (36 CSS px per row), comfortable when `localStorage` holds no density — kept in `localStorage`. Every group a page names SHALL collapse and expand on a click of its header, and the collapsed state SHALL persist per page in `localStorage`.
7. Every list SHALL have the filter chips its page names, a search box that filters rows by their text 200 ms after the last keystroke, and a pager of 20 rows per page that shows only when more than 20 rows pass the filters.
8. IF the viewport is at least 1280 CSS px wide THEN the panel SHALL sit right of the list; otherwise the panel SHALL stack under the list. At 1000 px and at 375 px no page SHALL scroll sideways.
9. Every page SHALL render in the light and the dark theme of the existing theme provider.

### Requirement 2 — Waits, derived

**User Story:** As the operator, I want each wait derived from harness files, so that nothing is written by hand.

#### Acceptance Criteria

1. IF the newest `phase.end` row of the current run (the rows of the last `run.start`) in a spec's `harness-events.jsonl` has result `gate-a` or `gate-b` and no `phase.start` row of that run follows it THEN the system SHALL derive a `gate` wait naming the gate, timed from that row. Today gate B writes only a HANDOFF row (harness/skills/sdd-continue/SKILL.md:513-516); spec 16 adds its `phase.end`.
2. IF that newest `phase.end` row has result `escalate` and no `phase.start` row of that run follows it THEN the system SHALL derive a `ruling` wait, timed from that row (D5).
3. IF a spec directory holds `retrospective-proposals.md` AND its `retrospective-plan.md` is absent or has a `Status:` line whose value starts with `DRAFT` (harness/skills/sdd-continue/SKILL.md:218-230) THEN the system SHALL derive a `retro` wait whose detail is the count of `DECISION NEEDED: yes` lines (harness/skills/sdd-retrospective/SKILL.md:94-95), timed from the proposals file's modification time.
4. IF a project's launch record has state `exited` AND its run id is null or that run has no `run.end` row in the spec's ledger THEN the system SHALL derive an `exited` wait with the exit code or signal, timed from the record's end time (src/dashboard/harness/types.ts:52-61). A new launch for the project SHALL clear it.
5. IF a project has a pointer line in its spec store AND the current run has a spawn with no matching `spawn.end` (`buildModel`, src/watch/ledger.ts:245-317) AND the spec's `harness-activity.jsonl` was last modified more than fifteen minutes ago THEN the system SHALL derive a `quiet` wait naming the open spawn's agent, timed from that modification time (D10).
6. WHEN a `quiet` condition starts or ends with no file event THEN the Now page SHALL show the change within 60 seconds.
7. The system SHALL evaluate the `gate`, `ruling` and `quiet` conditions on the spec the overview watch resolves for each project (the pointer spec, else the HANDOFF active spec; src/dashboard/harness/overview-watch.ts:238-265), and the `retro` condition on every spec directory of every registered project.
8. The system SHALL order waits by kind (`gate`, `ruling`, `retro`, `exited`, `quiet`), then oldest first.
9. WHEN a `phase.end` row with result `gate-a` is appended to a watched ledger THEN an open Now page SHALL list the wait within five seconds without a reload.
10. IF a file the derivation reads is missing, empty or holds a torn line THEN the system SHALL derive no wait from it and SHALL raise no error (the torn-line skip of src/watch/ledger.ts:186-199).
11. The wait and Specs row derivations SHALL be server modules under `src/` with vitest tests; vitest excludes the frontend (./vitest.config.ts:7-8) (D13).

### Requirement 3 — Now

**User Story:** As the operator, I want one home page of waits, runs, idle projects and closed specs, so that it replaces the HUD and the TUI.

#### Acceptance Criteria

1. WHEN the operator opens Now THEN the system SHALL show four groups in this order: Waiting on you, Live runs, Idle projects, Recently closed. Recently closed SHALL be collapsed by default.
2. Each Waiting row SHALL show the project, the spec, the wait kind, one line of detail and the age.
3. The system SHALL show one Live runs row per registered project with a pointer line in its spec store: project, spec, live phase chip, one line of detail (the newest open worker spawn's agent with its round or task, else the gate it waits on), the run's token total, and the age since `run.start`.
4. The system SHALL show one Idle projects row per registered project with no live run: the project and the launchable spec (`launchable`), else its disabled reason (`disabledReason`, src/dashboard/harness/run-setup.ts:166-168) (D12).
5. The system SHALL show one Recently closed row per spec whose HANDOFF `## Phase log` holds a `closeout` row with result `closed` dated within the last seven days (`parseHandoffPhaseRows`, src/watch/ledger.ts:202-218): project, spec, close date. A spec closed only by a `CLOSED` plan, with no dated closeout row, is omitted here because this group orders by close date, unlike the Specs page closed chip (D17).
6. WHEN the operator selects a wait THEN the panel SHALL show it read-only: `gate`, the spec's `gate-a.json` or `gate-b.json` decisions, else its `questions.md` section (src/dashboard/harness/project-watch.ts:62-65); `retro`, the `DECISION NEEDED: yes` lines; `exited`, exit code, signal, end time and log path; `quiet`, the open spawn's agent, last tool and last activity time.
7. The Now panel SHALL offer no control that answers a gate, approves a plan, dismisses a wait or relaunches a run; acting on a wait is spec 16.
8. WHEN the operator selects a Live runs row THEN the system SHALL open that project's run page.
9. WHEN a watched ledger, HANDOFF, pointer file, a spec's `retrospective-proposals.md` or `retrospective-plan.md` (seen by the existing spec-markdown watcher, src/dashboard/watcher.ts:36-45), or a launch record (the `launch-update` event, src/dashboard/harness/hub.ts:41) changes THEN an open Now page SHALL re-derive every wait kind and update within five seconds without a reload, so a `retro` or `exited` wait appears or clears on its source change.
10. The Now page SHALL NOT show the HUD to-do list (D8).

### Requirement 4 — Runs

**User Story:** As the operator, I want the Harness page's launcher, setup and live view in the new layout, so that I watch and start runs without scrolling past a form.

#### Acceptance Criteria

1. WHEN the operator opens `/runs` THEN the system SHALL list one row per registered project whose resolved spec (`resolveSpec`, src/watch/index.ts:42-56) has a ledger, grouped Live then Ended (a `stopped` or `exited` run groups under Ended): project, spec, run id, state (live, ended, stopped, exited), phase, age.
2. WHEN the operator selects a row or opens `/runs/:projectId` THEN the system SHALL show that project's current or last run from the harness view's run model (src/dashboard/harness/project-watch.ts:242-278) (D11).
3. The run page SHALL show a phase strip of the six phases of `PHASE_ORDER` (src/watch/ledger.ts:87), each with its newest version, its round count and its approval date, the live phase highlighted.
4. The run page SHALL show each open spawn's agent, role, declared and actual model, elapsed time, current tool, and an age badge (since its last activity) marked past fifteen minutes.
5. WHEN the spec has a `tasks.md` THEN the run page SHALL show a task table: id, title, status, the latest gate verdict and `tdd` block from the task-review summary route (src/dashboard/multi-server.ts:2019-2042), the risk from the newest ledger `note` whose text is `gate: task` followed by the id (harness/skills/sdd-implementation-phase/SKILL.md:80-82), and the fix rounds from `task.done`. The table SHALL have status chips and the pager.
6. The run page SHALL show the run's document rounds and its spawns as two tables, collapsed by default.
7. The run page SHALL show a tabbed log: Ledger (the current run's ledger rows), Activity (the current run's activity rows) and Process log (the launch log lines). Each tab SHALL have a text filter and a follow toggle; with follow on, a new row SHALL show within five seconds and the view SHALL scroll to it.
8. The run panel SHALL show the run's properties (run id, start, code root, worktree, headless, providers, tokens, and the pid of a dashboard launch); a Stop button calling the existing stop route (src/dashboard/multi-server.ts:2183-2284), enabled only while the launch record is `running` or `stopping`; and the saved setup as a collapsed table from `harness-run.json`, else the defaults.
9. WHEN the operator presses the Launch chip in the Runs header THEN the system SHALL show one card per filtered project: the launchable spec, the saved setup in summary, a Launch button and an Edit setup button.
10. WHEN the operator presses Launch on a card THEN the system SHALL call the existing launch route with the saved setup, exactly as the Harness page does today (src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:228-240); the system SHALL add no launch behaviour.
11. WHEN the operator presses Edit setup THEN the system SHALL show the existing setup fields as a table (supervisor model, model per role, provider for eligible roles, worktree, gates) and SHALL save through the existing setup route.
12. IF the project has no launchable spec, a pointer line in its store, or a live launch record (the admission rules of src/dashboard/harness/launcher.ts:115-135) THEN Launch SHALL be disabled and the card SHALL show the reason; IF the launch route refuses THEN the card SHALL show the route's reason (D2).
13. WHEN the run page and `--watch` read the same store THEN both SHALL show the same phase, spawn, round and task rows, because both take them from `buildModel` (src/watch/ledger.ts:245-460).

### Requirement 5 — Specs

**User Story:** As the operator, I want every spec of every project in one list with its harness state, so that only documents need my editor.

#### Acceptance Criteria

1. WHEN the operator opens `/specs` THEN the system SHALL list every spec directory of every filtered project, grouped by project, with chips live, in progress, closed, deferred and not started.
2. A spec SHALL be live when a pointer line names its directory; closed when its HANDOFF phase log holds a `closeout` row with result `closed` or its `retrospective-plan.md` status is `CLOSED`; deferred when `SpecIndexEntry.deferred` is true (src/types.ts:126-136); not started when it has no document and no ledger; in progress otherwise (D17).
3. Each row SHALL show state, spec, phase, document versions (the newest phase-log state `v` plus digits for requirements, design and tasks, shown as `R4 D3 T2`), tasks done of total, the distinct `PR #` numbers in its phase-log notes, the count of `deferred` records whose `originSpec` is the spec, the retro outcome (the plan's status word, else none) and the updated time (newest ledger row or phase-log date) (D18).
4. WHEN the operator selects a spec THEN the panel SHALL show: its number in the decomposition heading that names it, else none; the text of that entry's `**Depends on**` paragraph, else none; one row per `run.start` in its ledger with run id, start, end, status and token total; its phase table from `parseHandoffPhaseRows`; its deferral records (id, title, status); and each file at the top level of its directory.
5. Each file row SHALL have a Copy-path action that copies the file's absolute path to the clipboard; no file row SHALL offer an editor-open link (D3).
6. The Specs page SHALL render no document content, and no route SHALL render a spec document.
7. WHEN a spec markdown file, a deferral record or a HANDOFF changes THEN an open Specs page SHALL update within five seconds without a reload.

### Requirement 6 — Removed pages

**User Story:** As the maintainer, I want unused pages removed, so that each fact has one place.

#### Acceptance Criteria

1. The frontend SHALL contain none of these: Statistics, Steering, Tasks (with the Kanban components), Implementation Logs, Approvals (with the annotator and diff views), Adversarial Analysis, the cleanup-job Settings page and its job modals, the spec viewer, the MDX editor module, the project dropdown, the Harness page and the Overview page (their parts move into Runs and Now, D7).
2. WHEN the browser opens `/steering`, `/specs/view`, `/harness`, `/overview`, `/tasks`, `/logs`, `/approvals`, `/adversarial`, `/settings` or any other unknown path THEN the system SHALL redirect to Now (D9).
3. Translation keys used only by removed components SHALL be removed from all eleven locale files (scripts/validate-i18n.js:88-90), and `npm run validate:i18n` SHALL pass.
4. The approval and task-status toasts of the notification provider (src/dashboard_frontend/src/modules/notifications/NotificationProvider.tsx:183-208, 292-297) SHALL be removed.
5. Each Playwright spec that drives a removed page or the dropdown (e2e/batch-approvals.spec.ts:6-12, e2e/worktree-no-shared.spec.ts:15-20 and 87-118) SHALL be deleted or rewritten against the new pages, so that no e2e spec names a removed route or test id.
6. Invariant (verified, not red-first): every server route registered at base SHALL still be registered (decomposition entry, spec-decomposition/decomposition.md:821-822).

### Requirement 7 — Usage and Deferrals routes

**User Story:** As the operator, I want the Usage and Deferrals routes in place, so that specs 17 and 18 fill them without touching the shell.

#### Acceptance Criteria

1. WHEN the operator opens `/usage` THEN the system SHALL show a placeholder that says the usage views arrive in a later release, and SHALL fetch no data.
2. WHEN the operator opens `/deferrals` THEN the system SHALL show each filtered project's current deferrals list, grouped by project, from the existing route and `deferrals-update` push (src/dashboard/multi-server.ts:491-507, 739-756).

### Requirement 8 — Compatibility, docs and checks

**User Story:** As the maintainer, I want the TUI, ledgers and harness unchanged, so that nothing else moves.

#### Acceptance Criteria

1. Invariant (verified, not red-first): `buildModel` output for a given input, src/watch/render.ts and `--watch` SHALL be unchanged.
2. Invariant (verified, not red-first): the watch sets of the overview and project harness watches SHALL be unchanged and no new file watcher SHALL be added (src/dashboard/harness/overview-watch.ts:267-291, src/dashboard/harness/project-watch.ts:79-81).
3. Invariant (verified, not red-first): no file under `harness/` and no ledger, activity or pointer format SHALL change.
4. WHEN this spec lands THEN docs/SDD-HARNESS.md:261-339 SHALL describe the five pages, and docs/USER-GUIDE.md:171-198 SHALL send approvals to the VS Code extension and adversarial reviews to the CLI instead of the removed pages (D16).
5. WHEN this spec lands THEN `npm run build`, `npx tsc --noEmit` and `npm test` SHALL pass.

## Non-Functional Requirements

### Security
- New routes SHALL be read-only, behind the existing hooks, and SHALL return derived fields and paths inside a registered project, never document content.

### Reliability
- A missing, empty or malformed harness file SHALL make its row or wait absent, never fail the page.

## Decisions taken in this document

- D1 — The new pages keep react-i18next with English strings only; other locales fall back to English, because the gear keeps a language setting and the English fallback exists.
- D2 — One run per spec store holds for dashboard launches, because the launcher's admission already enforces it and end-to-end check 3 requires it.
- D3 — The Copy-path action copies the file's absolute path and there is no editor-open link; chosen by Gate A because copy always works, where a plain file link may not resolve under WSL.
- D4 — Lists use a user-selected density setting in the gear, not a fixed row height; chosen by Gate A. The setting has two levels, compact (32 CSS px) and comfortable (36 CSS px), comfortable by default, so the 20-row pager and the no-sideways-scroll checks assume a known row height.
- D5 — An `escalate` phase end is a `ruling` wait, because the Overview page Now replaces counts it as waiting.
- D6 — The deferral-owner wait is not derived here, because deferral records have no owner or blocks field until spec 17.
- D7 — The Harness and Overview pages are removed; their parts move into Runs and Now, because the decomposition moves them.
- D8 — Now does not show the HUD to-do list, because every row must be derived and the HUD is hand-written.
- D9 — Removed and unknown paths redirect to Now, because the approvals deeplink then lands somewhere useful.
- D10 — The quiet wait uses the activity file's modification time, re-evaluated at least every minute, because new watching is out of scope and a quiet run makes no file event.
- D11 — A run page shows a project's current or last run only; earlier runs are listed in the Specs panel, because the run model scopes to the last run.
- D12 — An idle project's routed spec comes from the routing that Launch uses, not the HANDOFF header, because Now and the Launch card then agree.
- D13 — Waits and spec rows are derived in server modules, because vitest covers only server code.
- D14 — Pager 20 rows, search debounce 200 ms, panel stacks below 1280 px, because spec 17 paginates past twenty and check 6 stacks at 1000 px.
- D15 — The gear holds theme, language, list density and sound; notification settings come with spec 16, because no notification exists before spec 16.
- D16 — The Approvals page goes; the approvals tool and its deeplink stay unchanged; docs point manual approvals at the VS Code extension, because the decomposition removes the page and the tool is a sensitive path.
- D17 — A spec is closed on a closed close-out row or a CLOSED plan, because older specs have only the plan.
- D18 — The PRs column shows HANDOFF PR numbers without state, because PR state is spec 17.

## Scope notes

- Cut: the wait for a deferral owned by the human that blocks something (decomposition, spec-decomposition/decomposition.md:804) moves to spec 17, which adds the owner field (D6).
- Cut: notification settings in the gear (decomposition, spec-decomposition/decomposition.md:797-798) move to spec 16 (D15).
- Added: the `ruling` wait (D5) and the docs update (Requirement 8 AC 4) the removal needs.
- Not in this spec: PR state, merge and the Deferrals rebuild (spec 17); usage content (spec 18); answering waits (spec 16); removing the server routes or npm dependencies only the removed pages used.
- End-to-end checks 1 to 4 and 6 need live projects and runs; the design decides which become tests and which an operator records in `verification-evidence.md`.
- Each within-N-seconds live-update criterion (Requirement 2 AC 6 and AC 9, Requirement 3 AC 9, Requirement 4 AC 7, Requirement 5 AC 7) is verified by a vitest test, a Playwright spec or a `verification-evidence.md` line, as the design decides.
- Carried items: none.

## Revision History

- **v1** (2026-10-06) — Initial draft.
  - **Lint pass.** 4 fixed (L-4 buildModel range, L-12 launchable/disabledReason fields, L-21/L-22 watch-set anchors); the rest rejected as citation-identifier false positives on prose/concept tokens (the browser API localStorage, backticked row-type/result/filename tokens, wait-kind names, the repository-root vitest.config.ts).
- **v2** (2026-10-06) — Revision from the input below.
  - **Lint pass.** 1 fixed (L-10 vitest.config.ts directory prefix); L-1..L-9 and L-11..L-18 rejected, the same prose/concept tokens v1 rejected.
  - **RI-1 — Accepted (MUST_FIX).** Gate A chose copy-path-only, so Requirement 5 AC 5 copies the absolute path with no editor-open link and D3 is restated, its false one-tap-link clause removed.
  - **RI-2 — Accepted (MUST_FIX).** Gate A chose a gear density setting, so Requirement 1 AC 6 renders rows at the selected density, AC 4 adds it to the gear, and D4 and D15 are restated; i18n and one-run-per-store unchanged.
- **v3** (2026-10-06) — SHOULD_FIX-only corrective pass.
  - **Lint pass.** 0 fixed; rejected: L-1 through L-22 (all citation-identifier re-fires on prose/concept tokens — wait-kind and state names start/stopped/exited/quiet/gate/ruling/retro/closeout/closed/CLOSED, browser API localStorage, backticked filename token jsonl — not code symbols at the cited ranges; v3's new citations at lines 63 and 72 verified accurate at both ends by the reviser). Body within the 3,500-word cap (no doc-words finding).
  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 1 AC 6 and D4 now name two density levels, compact 32 CSS px and comfortable 36 CSS px, comfortable the default when none is stored, so the pager and no-sideways-scroll checks have a known row height.
  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 3 AC 9 now re-derives every wait kind on a retrospective-file change (the spec-markdown watcher) and a launch-update event, so retro and exited refresh within five seconds with no new watcher; a Scope note maps each within-N-seconds criterion to a verification path.
  - **R1-3 — Accepted (MINOR).** Requirement 3 AC 5 now notes that a spec closed only by a CLOSED plan is omitted from Recently closed, which orders by close date.
  - **R1-4 — Accepted (MINOR).** Requirement 5 AC 5 and D3 rename the Open action to Copy-path, matching the copy-only behaviour.
  - **R1-5 — Accepted (MINOR).** Requirement 4 AC 1 now states a stopped or exited run groups under Ended.
  - **R1-6 — Accepted (MINOR).** Requirement 1 AC 2 now states a project absent from the stored toggle map counts as on.
