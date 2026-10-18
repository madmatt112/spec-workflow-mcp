# Requirements Document

## Introduction

This spec completes three dashboard views that the controller loop needs: a PR panel on the Run page, an `owner` on each deferral record with a chip and a filter on the Deferrals page, and W per task for closed specs with a trend on the Usage page. It is for the one operator (ADR 0001) who watches runs and the efficiency plan from the dashboard instead of from the terminal and hand-computed ledger sums. It changes the run record, the deferral record, the `deferrals` tool, and three dashboard pages; it adds no new file, ledger row type, watcher, or process.

## Alignment with Product Vision

The steering `product.md` is absent from this store (`.spec-workflow/steering/` is empty), so this section aligns with the decomposition entry 23 and the controller design. The PR panel serves ADR 0003 (merge by rule): the operator sees why the rule has not merged a PR while the run sits in `merging` (`src/controller/runs.ts:638-640`). The owner and the usage trend serve the efficiency plan, which is judged on W per task per spec against a baseline.

## Requirements

### Requirement 1 — PR panel on the Run page

**User Story:** As the operator, I want the Run page to show the run's pull requests with the CI state, mergeability and the merge rule's verdict and reasons, so that I know why a run in `merging` has not merged without reading `gh` output or the step log.

#### Acceptance Criteria

1. WHEN the merge rule evaluates a pull request for a run (`runMergeStage` at `src/controller/merge.ts:513-519`, or `mergeByRule` for a close-out PR at `src/controller/runs.ts:908-915`) THEN the controller SHALL save on that run's record, through the existing write path `save` (`src/controller/runs.ts:521-526`), one PR read per pull request: the PR number, the repository name, the PR web URL when known, the CI state, the raw `mergeable` value, the verdict, every reason, the merge commit sha when merged, and the ISO time of the read.
2. The verdict SHALL be the `MergeStageStatus` value that the same pass returned (`merged`, `waiting`, `not-ready`, `blocked`, `unreadable` or `failed`; `src/controller/merge.ts:95`), and the reasons SHALL be that pass's `reasons` array unchanged.
3. The CI state SHALL be one of `green`, `pending`, `red` or `unreadable`, classified from the workflow runs and commit statuses that the same evaluation read, by the classification `readCiState` applies (`src/controller/merge.ts:390-430`): any failed check gives `red`; else any pending check or a fresh head with no run gives `pending`; else `green`. IF the evaluation could not read the PR, its workflow runs or its commit statuses (`src/controller/merge.ts:297-321`) THEN the CI state SHALL be `unreadable`.
4. IF the evaluation could not read the PR at all THEN the `mergeable` value SHALL be recorded as absent, never as a stale value from an earlier read.
5. A later read of the same pull request SHALL replace the earlier read of that pull request; reads of different pull requests of the same run SHALL be kept side by side, the run's own PR first.
6. The `controller-runs` wire row (`toRow` at `src/controller/runs.ts:1189-1196`) SHALL carry the PR reads without any filesystem path (no `repoDir`; design §17 keeps paths off the LAN), and the frontend hand copy of `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:167-179`) SHALL match the server shape.
7. WHEN the Run page shows a controller run that has at least one PR read THEN it SHALL render a PR panel with one row per read: the PR number as a link to the PR web URL (plain text when the URL is unknown), the CI state as a chip, the `mergeable` value, the verdict, every reason as its own line, and the read time.
8. IF the run has no PR read THEN the Run page SHALL render no PR panel.
9. WHILE the run status is `merging`, WHEN the merge rule re-checks (every `MERGE_POLL_INTERVAL_MS`, `src/controller/merge.ts:24`) THEN the open Run page SHALL show the new read within 5 seconds of the run-record write, with no page reload, through the existing `controller-runs` push (`src/controller/runs.ts:50-55`).
10. WHEN the merge rule merges a PR THEN its row SHALL show the verdict `merged` and the first 7 characters of the merge sha.
11. The dashboard server and frontend SHALL NOT call `gh` or GitHub for the panel; the panel shows only what the merge rule read.
12. The merge rule's decision SHALL NOT change: for the same `gh` responses, `evaluate` returns the same `ready`, `pending`, `unreadable` and `reasons` as at base, and `runMergeStageStep` maps each status to the same run status and wait (`src/controller/runs.ts:634-681`). Invariant (verified, not red-first): the existing merge and runs suites pass with no asserted value changed.
13. A run record written before this feature (with no PR read) SHALL still load, list and render. Invariant (verified, not red-first).

### Requirement 2 — Owner on a deferral record

**User Story:** As the operator, I want each deferral to say whether it is mine or the harness's, and to filter the Deferrals page by that owner, so that I see the decisions that wait on me without reading every record.

#### Acceptance Criteria

1. The deferral record (`src/types.ts:310-330`) SHALL carry an optional `owner` whose value is `matthew` or `harness`; a record with no owner reads as `owner: null`.
2. The storage SHALL write `owner` as a frontmatter key (`serializeFrontmatter`, `src/core/deferral-storage.ts:42-62`) and read it back (`parseMarkdown`, `src/core/deferral-storage.ts:125-170`); a record with no `owner` key, or with a value other than the two allowed, SHALL read as `owner: null` and SHALL still be listed.
3. WHEN the `deferrals` tool's `add` or `update` action receives `owner` with an allowed value THEN the record SHALL store it (`handleAdd` at `src/tools/deferrals.ts:150-190`, `handleUpdate` at `src/tools/deferrals.ts:254-275`), and the tool schema (`src/tools/deferrals.ts:22-104`) SHALL describe the field and its two values.
4. IF `add` or `update` receives `owner` with any other value THEN the tool SHALL return `success: false` with a message that names the two allowed values, and SHALL write no file.
5. WHEN `reindex` re-serializes the store (`src/core/deferral-storage.ts:428-470`) THEN every record's `owner` SHALL survive unchanged.
6. WHEN `resolve`, `merge` or `update` rewrites a record THEN its `owner` SHALL survive unless `update` sets a new one.
7. The `get` action SHALL return `owner`, and the `list` action's summary rows (`src/tools/deferrals.ts:199-207`) SHALL include `owner`.
8. Reading a record without an `owner` key SHALL NOT rewrite its file. Invariant (verified, not red-first): no read path of `DeferralStorage` writes at base.
9. WHEN a Deferrals page row shows a record with an owner THEN the row SHALL show an owner chip (`matthew` or `harness`), and the record panel (`DeferralPanel`, `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:206-251`) SHALL show an Owner field; a record with no owner SHALL show no chip and no field.
10. The Deferrals page SHALL add owner filter chips `matthew`, `harness` and `no owner`, each with its count across every enabled project's records, using the existing `Chips` primitive (`src/dashboard_frontend/src/modules/shell/primitives.tsx:63-102`). Selected owner chips SHALL combine with each other by OR, and with the status chips and the search box by AND; a filter change SHALL reset the pager to the first page.
11. WHEN a `deferrals-update` push arrives (`src/dashboard/multi-server.ts:366-402`) THEN the owner chips, counts and open panel SHALL refresh with no reload.
12. The Deferrals page SHALL stay read-only (`src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:8-15`): no control on it SHALL write a deferral.

### Requirement 3 — W per task and its trend on the Usage page

**User Story:** As the operator, I want the Usage page to show W per task for every closed spec against its repository's baseline, and the trend over closed specs with one line per repository, so that I judge the efficiency plan from the dashboard instead of from hand sums over ledgers.

#### Acceptance Criteria

1. The dashboard server SHALL provide one read-only route that returns, for every project the dashboard knows (`getAllProjects`, `src/dashboard/project-manager.ts:294`), one row per closed spec: project id, project name, spec, close date, total W, the count of spawns whose W is unknown, task count, W per task, the repository baseline, and W per task as a percentage of that baseline.
2. A spec SHALL count as closed by the Specs page rule: a HANDOFF `closeout` row with result `closed`, or a retrospective plan whose `Status:` value starts with `CLOSED` (`src/dashboard/shell/spec-rows.ts:91-102`).
3. The close date SHALL be the date of the HANDOFF `closeout`/`closed` row (as `closedOn`, `src/dashboard/shell/now-model.ts:136-144`); IF that row is absent THEN the newest `ts` in the spec's ledger; IF neither exists THEN null.
4. Total W SHALL be the weighted W over every `spawn.end` row of every run in the spec's `harness-events.jsonl`, by the same fold as the `harness usage` action (`buildUsageReport`, `src/watch/usage.ts:162`; per-row weights `spawnW`, `src/watch/usage.ts:68-78`). For the same ledger, the row's total W SHALL equal the `usage` action's total W exactly.
5. The task count SHALL be the total task count of the spec's `tasks.md` from the index snapshot (`taskProgress.total`, as `src/dashboard/shell/spec-rows.ts:144`); W per task SHALL be total W divided by task count.
6. IF the task count is 0 THEN W per task SHALL be null and the row SHALL show `no tasks`.
7. IF one or more spawns have an unknown W THEN the row SHALL label W and W per task a floor and show the unknown spawn count (agent-rules "Run ledger": counts are floors).
8. IF the ledger is missing or has no spawn with a known W THEN W and W per task SHALL be null and the row SHALL show `no usage recorded`.
9. The repository baseline SHALL be the integer value of a `baseline-w-per-task: <n>` line in that project's `agent-rules.md`, read through the one parser `readAgentRules` (`src/dashboard/harness/run-setup.ts:66-127`); IF the key is absent or not an integer THEN the baseline and the percentage SHALL be null and the row SHALL show `no baseline`. The `agent-rules.md` key table in `docs/SDD-HARNESS.md:252-260` SHALL list the new key.
10. The Usage page (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:61-102`) SHALL show a table of these rows grouped by project, newest close date first, with columns spec, close date, W, tasks, W per task and percentage of baseline.
11. The Usage page SHALL show a trend chart: close date on the x axis, W per task on the y axis, one line per project through that project's rows in close-date order, each project's baseline (when set) as a horizontal reference line in that project's series colour, a legend naming each project, and a hover value per point naming the spec and its W per task. Series colours SHALL be assigned in a fixed order of project name.
12. A row whose W per task or close date is null SHALL appear in the table and SHALL NOT be plotted.
13. The Usage page SHALL load the rows on mount and again on each `controller-runs` push, the refetch pattern it already uses (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:67-75`), so a spec that closes appears with no reload.
14. The two usage-window bars SHALL stay; the placeholder line (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:97-99`) SHALL be removed.
15. IF no project has a closed spec THEN the page SHALL show `No closed specs yet.` in place of the table and the chart.

## Non-Functional Requirements

### Performance
- The usage route SHALL read ledgers, HANDOFF and `agent-rules.md` through a `FileCache` (`src/dashboard/shell/file-cache.ts:1-6`), so a repeat request rereads no unchanged file.
- The trend chart SHALL be plain SVG in the existing frontend; no charting package is added (`package.json` has none).

### Security
- No new wire field SHALL carry a filesystem path. The PR web URL SHALL be shown only when it starts with `https://`.

### Reliability
- A missing, empty or torn ledger, HANDOFF or `agent-rules.md` SHALL give a row with null fields, never an error response; a project whose rows throw SHALL be left out and logged once, as the shell feed does (`src/dashboard/shell/shell-feed.ts:92-98`).
- No new file watcher, ledger row type, process or timer SHALL be added (`src/dashboard/shell/shell-feed.ts:1-9`).

## Decisions taken in this document

- D1 — Where the PR panel's data comes from: options were the merge rule's own read saved on the run record by the controller, a dashboard-side poll of GitHub, or a new ledger row per read; chosen because the entry asks for the CI state "the merge rule read", the run record already has one writer and a push path, and a second GitHub reader could disagree with the rule.
- D2 — Which pull requests the panel lists: options were the run's own PR and every close-out PR the rule read, or the run's own PR only; chosen because close-out merges also park the run in merging, and the operator then needs the same reasons.
- D3 — Meaning of "no new writer": options were no new writing component (existing writers gain fields), or no write change at all; chosen because an owner that nothing can set and a verdict that nothing saves would leave two of the three views empty.
- D4 — W per task definition: options were whole-spec weighted W over every run divided by the tasks file's task count, implementation-phase W only, or division by task-done ledger rows; chosen because the step-4 baselines are whole-spec W per task and older ledgers lack task-done rows.
- D5 — Repository baseline source: options were a new per-repository agent-rules key, the median of the repository's earlier closed specs, the first closed spec, or a value derived from the per-spec baseline key; chosen because the step-4 baselines were measured from transcripts, not ledgers, so no ledger fold can reproduce them, and the key follows the existing per-spec baseline key.
- D6 — Owner values and default: options were optional with exactly matthew or harness and no default, defaulting absent records to harness, or making owner required on add; chosen because existing records carry no owner and a default would mislabel them, and ADR 0001 names one operator.
- D7 — Where owner is set: options were the deferrals tool's add and update only, or an owner control on the Deferrals page; chosen because spec 15 made the page read-only and the entry asks only for a chip and a filter.
- D8 — Unknown usage: options were a floor label with the unknown count and exclusion from the trend when nothing is known, plotting zero, or dropping the spec; chosen because agent-rules says ledger counts are floors and must name their blind spots.
- D9 — Close date: options were the HANDOFF closeout row then the newest ledger row, or the run-end row only; chosen because the Now page already dates a close from the HANDOFF row, and older specs have no controller run-end row.
- D10 — Chart rendering: options were plain SVG or a new charting package; chosen because one line chart with reference lines is small and the frontend has no chart dependency.
- D11 — Money, personal data and legal posture: options were none in scope, or a posture review; chosen because the spec reads token counts and shows a fixed owner label, with no billing, deletion, erasure or personal data surface.

## Scope notes

- Carried from the decomposition: none.
- Cut (in the superseded entry 17 text, not in entry 23): a Now-page wait for an operator-owned deferral that blocks something, a `blocks` field, the `sdd-deferrals` skill setting owner on a "decide" triage, and the Mark resolved, Open file and Copy path actions. Entry 23 lists only the owner, its chip and its filter.
- Cut (in the superseded entry 18 text, not in entry 23): the live view (tokens today, stacked bars per live run, open spawns) and the per-spec chooser with its phase bars and role table.
- Deferred to the operator: writing a `baseline-w-per-task` value into each repository's `agent-rules.md`. This spec adds the key and reads it; it sets no value, because the step-4 figures need the operator's choice of which spec is the baseline.
- The decomposition entry gives no end-to-end verification scenario; the design names one for each requirement.

## Revision History

- **v1** (2026-10-18) — Initial draft.
