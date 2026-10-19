# Requirements Document

## Introduction

This spec completes three dashboard views that the controller loop needs: a PR panel on the Run page, an `owner` on each deferral record with a chip and a filter on the Deferrals page, and W per task for closed specs with a trend on the Usage page. It is for the one operator (ADR 0001) who watches runs and the efficiency plan from the dashboard instead of from the terminal and hand-computed ledger sums. It changes the run record, the deferral record, the `deferrals` tool, and three dashboard pages.

## Alignment with Product Vision

The steering `product.md` is absent from this store (`.spec-workflow/steering/` is empty), so this section aligns with the decomposition entry 23 and the controller design. The PR panel serves ADR 0003 (merge by rule): the operator sees why the rule has not merged a PR while the run sits in `merging` (`src/controller/runs.ts:638-640`). The owner and the usage trend serve the efficiency plan, which is judged on W per task per spec against a baseline.

## Requirements

### Requirement 1 — PR panel on the Run page

**User Story:** As the operator, I want the Run page to show the run's pull requests with the CI state, mergeability and the merge rule's verdict and reasons, so that I know why a run in `merging` has not merged without reading `gh` output or the step log.

#### Acceptance Criteria

1. WHEN the merge rule evaluates a pull request for a run (`runMergeStage` at `src/controller/merge.ts:513-519`, or `mergeByRule` for a close-out PR at `src/controller/runs.ts:908-915`) THEN the controller SHALL save on that run's record, through the existing write path `save` (`src/controller/runs.ts:521-526`), one PR read per pull request: the PR number, the repository display name (the last segment of `repoDir`, resolved server-side as `closeoutMergeTarget` does at `src/controller/merge.ts:457-459`, never the path itself), the PR web URL when known, the CI state, the raw `mergeable` value, the verdict, every reason, the merge commit sha when merged, and the ISO time of the read. The CI state and the raw `mergeable` SHALL come from the merge evaluation pass itself, extended to return what it already read (`evaluate`, `src/controller/merge.ts:291-372`), carried to the `save` site; the controller SHALL make no second GitHub read for the panel.
2. The verdict SHALL be the `MergeStageStatus` value that the same pass returned (`merged`, `waiting`, `not-ready`, `blocked`, `unreadable` or `failed`; `src/controller/merge.ts:95-107`), and the reasons SHALL be that pass's `reasons` array unchanged.
3. The CI state SHALL be one of `green`, `pending`, `red` or `unreadable`. The extended `evaluate` SHALL classify it from the workflow runs and commit statuses it already read, by the same rule `readCiState` embodies (`src/controller/merge.ts:390-430`): any failed check gives `red`; else any pending check or a fresh head with no run gives `pending`; else `green`. IF the evaluation could not read the PR, its workflow runs or its commit statuses (`src/controller/merge.ts:297-321`) THEN the CI state SHALL be `unreadable`.
4. IF the evaluation could not read the PR at all THEN the `mergeable` value SHALL be recorded as absent, never as a stale value from an earlier read.
5. A later read of the same pull request SHALL replace the earlier read of that pull request; reads of different pull requests of the same run SHALL be kept side by side, the run's own PR first.
6. The `controller-runs` wire row SHALL carry the PR reads without any filesystem path (no `repoDir`; design §17 keeps paths off the LAN), added to all three hand-kept shapes the row flows through and which SHALL stay in step: `ControllerRunRow` that `toRow` builds (`src/controller/runs.ts:1175-1196`), the server `ControllerRun` the feed casts to (`src/dashboard/shell/types.ts:137-150`), and the frontend hand copy (`src/dashboard_frontend/src/modules/shell/types.ts:167-179`).
7. WHEN the Run page shows a controller run that has at least one PR read THEN it SHALL render a PR panel with one row per read: the repository display name, the PR number as a link to the PR web URL (plain text when the URL is unknown), the CI state as a chip, the `mergeable` value, the verdict, every reason as its own line, and the read time.
8. IF the run has no PR read THEN the Run page SHALL render no PR panel.
9. WHILE the run status is `merging`, WHEN the merge rule re-checks (every `MERGE_POLL_INTERVAL_MS`, `src/controller/merge.ts:24`) THEN the open Run page SHALL show the new read within 5 seconds of the run-record write, with no page reload, through the existing `controller-runs` push (`src/controller/runs.ts:50-55`).
10. WHEN the merge rule merges a PR THEN its row SHALL show the verdict `merged` and the first 7 characters of the merge sha.
11. The dashboard server and frontend SHALL NOT call `gh` or GitHub for the panel; the panel shows only what the merge rule read.
12. The merge rule's decision SHALL NOT change: for the same `gh` responses, `evaluate` (`src/controller/merge.ts:291-372`) returns the same `ready`, `pending`, `unreadable` and `reasons` as at base, and `runMergeStageStep` maps each status to the same run status and wait (`src/controller/runs.ts:585-682`). Invariant (verified, not red-first): the existing merge and runs suites pass with no asserted value changed.
13. A run record written before this feature (with no PR read) SHALL still load, list and render. Invariant (verified, not red-first).

### Requirement 2 — Owner on a deferral record

**User Story:** As the operator, I want each deferral to say whether it is mine or the harness's, and to filter the Deferrals page by that owner, so that I see the decisions that wait on me without reading every record.

#### Acceptance Criteria

1. The deferral record (`src/types.ts:310-330`) SHALL carry an optional `owner` whose value is `matthew` or `harness`; a record with no owner reads as `owner: null`.
2. The storage SHALL write `owner` as a frontmatter key (`serializeFrontmatter`, `src/core/deferral-storage.ts:42-62`) and read it back (`parseMarkdown`, `src/core/deferral-storage.ts:125-170`); a record with no `owner` key, or with a value other than the two allowed, SHALL read as `owner: null` and SHALL still be listed.
3. WHEN the `deferrals` tool's `add` or `update` action receives `owner` with an allowed value THEN the record SHALL store it through the tool handlers (`handleAdd` at `src/tools/deferrals.ts:150-190`, `handleUpdate` at `src/tools/deferrals.ts:254-275`) and the storage that persists it (`create`, `src/core/deferral-storage.ts:218-259`; the `update` mutable-field list, `src/core/deferral-storage.ts:310-329`), and the tool schema (`src/tools/deferrals.ts:22-104`) SHALL describe the field and its two values.
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
3. The close date SHALL be the date of the newest HANDOFF `closeout`/`closed` row (a reopened-then-reclosed spec has more than one), read unwindowed by `parseHandoffPhaseRows` (`src/watch/ledger.ts:202`) exactly as the Specs page's closed rule reads that row (`src/dashboard/shell/spec-rows.ts:92`), with no 7-day window applied; IF that row is absent THEN the newest `ts` in the spec's ledger; IF neither exists THEN null.
4. Total W SHALL be the weighted W over every `spawn.end` row of every run in the spec's `harness-events.jsonl`, by the same fold as the `harness usage` action (`buildUsageReport`, `src/watch/usage.ts:162`; per-row weights `spawnW`, `src/watch/usage.ts:68-78`). For the same ledger, the row's total W SHALL equal the `usage` action's total W exactly.
5. The task count SHALL be the total task count of the spec's `tasks.md` from the index snapshot (`taskProgress.total`, as `src/dashboard/shell/spec-rows.ts:144`); W per task SHALL be total W divided by task count.
6. IF the task count is 0 THEN W per task SHALL be null and the row SHALL show `no tasks`.
7. IF one or more spawns have an unknown W THEN the row SHALL label W and W per task a floor and show the unknown spawn count (agent-rules "Run ledger": counts are floors).
8. IF the ledger is missing or has no spawn with a known W THEN W and W per task SHALL be null and the row SHALL show `no usage recorded`.
9. The repository baseline SHALL be the integer value of a `baseline-w-per-task: <n>` line in that project's `agent-rules.md`, read through `readAgentRules` (`src/dashboard/harness/run-setup.ts:66-127`), whose `AgentRules` struct (`src/dashboard/harness/run-setup.ts:31-43`) gains the key; IF the key is absent or not an integer THEN the baseline and the percentage SHALL be null and the row SHALL show `no baseline`. The `agent-rules.md` key table in `docs/SDD-HARNESS.md:252-260` SHALL list the new key.
10. The Usage page (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:61-102`) SHALL show a table of these rows grouped by project, newest close date first and rows with a null close date last, with columns spec, close date, W, tasks, W per task and percentage of baseline.
11. The Usage page SHALL show a trend chart: close date on the x axis, W per task on the y axis, one line per project through that project's rows in close-date order, each project's baseline (when set) as a horizontal reference line in that project's series colour, a legend naming each project, and a hover value per point naming the spec and its W per task. Series colours SHALL be assigned in a fixed order of project name.
12. A row whose W per task or close date is null SHALL appear in the table and SHALL NOT be plotted.
13. The Usage page SHALL load the rows on mount and again on each `controller-runs` push, the refetch pattern it already uses (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:67-75`), so a spec that closes appears with no reload.
14. The two usage-window bars SHALL stay; the placeholder line (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:97-99`) SHALL be removed.
15. IF no project has a closed spec THEN the page SHALL show `No closed specs yet.` in place of the table and the chart.

## Non-Functional Requirements

### Performance
- The usage route SHALL read ledgers and HANDOFF through a `FileCache` (`src/dashboard/shell/file-cache.ts:1-16`), so a repeat request rereads no unchanged ledger or HANDOFF; it reads each project's `agent-rules.md` through `readAgentRules` (`src/dashboard/harness/run-setup.ts:66-127`), one small uncached read per project per request.
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
- D9 — Close date: options were the HANDOFF closeout row then the newest ledger row, or the run-end row only; chosen because the Specs page already derives a spec's closed state from that HANDOFF row unwindowed, and older specs have no controller run-end row.
- D10 — Chart rendering: options were plain SVG or a new charting package; chosen because one line chart with reference lines is small and the frontend has no chart dependency.
- D11 — Money, personal data and legal posture: options were none in scope, or a posture review; chosen because the spec reads token counts and shows a fixed owner label, with no billing, deletion, erasure or personal data surface.

## Scope notes

- Carried from the decomposition: none.
- Cut (in the superseded entry 17 text, not in entry 23): a Now-page wait for an operator-owned deferral that blocks something, a `blocks` field, the `sdd-deferrals` skill setting owner on a "decide" triage, and the Mark resolved, Open file and Copy path actions. Entry 23 lists only the owner, its chip and its filter.
- Cut (in the superseded entry 18 text, not in entry 23): the live view (tokens today, stacked bars per live run, open spawns) and the per-spec chooser with its phase bars and role table.
- Deferred to the operator: writing a `baseline-w-per-task` value into each repository's `agent-rules.md`. This spec adds the key and reads it; it sets no value, because the step-4 figures need the operator's choice of which spec is the baseline.
- The decomposition entry gives no end-to-end verification scenario; the design names one for each requirement.

## Revision History

- **v3** (2026-10-19) — SHOULD_FIX-only corrective pass.
  - **R2-1 — Accepted (SHOULD_FIX).** R1 AC1 now saves a repository display name — the last segment of repoDir resolved server-side as closeoutMergeTarget already does, never the path — so no second GitHub read and no path on the wire (AC1); R1 AC7 renders that name so the operator tells the run's own PR from the different-repository close-out PRs D2 lists side by side (AC7). Save-set and render-set reconciled.
  - **M1 — Accepted (MINOR).** R3 AC3 now dates a spec from the newest HANDOFF closeout/closed row, the tie-break the singular wording left open (AC3); R3 AC10 sorts null-close-date rows last, the position AC12 left undefined (AC10).
  - **M2 — Rejected (MINOR).** The plan-closed fallback to the newest ledger timestamp is already stated in AC3 and acknowledged in D9 as a chosen approximation for older specs; the analysis calls it a design note, not a requirements block.
  - **Lint pass.** 0 fixed; rejected L-1–L-17 — v2's citation-identifier false positives on unchanged tokens; suppressed under rule 11.
- **v2** (2026-10-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 2/2/1).
  - **R1-1 — Accepted (MUST_FIX).** R3 AC3 no longer cites the Now-page close date, which only emits a date for rows closed within 7 days; the close date now reads the HANDOFF closeout/closed row unwindowed by parseHandoffPhaseRows as the Specs page's closed rule reads it (AC3, Requirement 3). Sibling D9 rationale rewritten to cite the Specs page's unwindowed derivation, not the Now page.
  - **R1-2 — Accepted (MUST_FIX).** NFR Performance no longer claims agent-rules.md is read through the FileCache; it routes ledgers and HANDOFF through the FileCache and reads agent-rules.md through readAgentRules as one small uncached read per project per request, matching AC9.
  - **R1-3 — Accepted (SHOULD_FIX).** R1 AC1 now states the CI state and raw mergeable come from the merge evaluation pass extended to return what it already read, carried to the save site with no second GitHub read; AC3 now says the extended evaluate classifies the CI state from its own already-read runs and statuses by the rule readCiState embodies, rather than implying evaluate already produces one.
  - **R1-4 — Accepted (SHOULD_FIX).** R1 AC6 now enumerates all three hand-kept shapes the PR reads flow through — the ControllerRunRow toRow builds, the server ControllerRun the feed casts to, and the frontend hand copy — which must stay in step.
  - **R1-5 — Accepted (MINOR).** AC9 drops the "one parser" overstatement and names the AgentRules struct that gains the key; R2 AC3 now cites the storage that persists owner (create and the update mutable-field list), not only the tool handlers.
  - **Lint pass.** 0 fixed; rejected: L-1 `repoDir` is absent by design — AC6 asserts the path-free row, and the three cited shapes carry no such field; L-2 `merging` is a RunStatus value, the citations govern the poll interval and the push; L-3/L-4/L-5 `owner`/`matthew`/`harness` are the new field and its two values the spec adds to the cited Deferral interface; L-6/L-7/L-8 `owner` is the new field added to the cited storage/schema/create/update/reindex code; L-9/L-11 `get`/`list` are action names, the citation governs the summary rows; L-10 `owner` is that new summary field; L-12/L-13/L-14/L-15 `matthew`/`harness` are chip labels, the citations locate the reused panel and the Chips primitive; L-16 `jsonl` is part of the `harness-events.jsonl` filename; L-17 `usage` is the harness action name, the citations govern the fold. All unchanged since v1's rejections (rule 11).
- **v1** (2026-10-18) — Initial draft.
  - **Lint pass.** 5 fixed (L-2 widened merge.ts:95→95-107 to include `reasons`; L-5/L-6 added `evaluate` citation merge.ts:291-372 covering `pending`; L-7 widened runs.ts:634-681→585-682 to include the declaration; L-23 widened file-cache.ts:1-6→1-16 to include `class FileCache`); rejected: L-1 `mergeable` is the stored GitHub-field value, the citations govern `save`; L-3 the AC requires `repoDir` absent from those ranges, its absence is the point; L-4 `merging` is a RunStatus value, the citations govern the poll interval and push; L-8/L-9/L-10 `owner`/`matthew`/`harness` are the new field and values added to the cited Deferral interface; L-11/L-12/L-13/L-15 `owner` is the new field added to the cited storage/schema/reindex/summary code; L-14/L-16 `get`/`list` are action names, the citation governs the summary rows; L-17/L-18/L-19/L-20 `matthew`/`harness` are chip labels, the citations locate the reused panel and Chips; L-21 `jsonl` is part of the `harness-events.jsonl` filename; L-22 `usage` is the harness action name, the citations govern the fold.
