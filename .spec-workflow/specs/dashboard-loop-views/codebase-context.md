# Codebase context — dashboard-loop-views

## Merge rule (controller)
- src/controller/merge.ts:23-24 — `MERGE_POLL_INTERVAL_MS`, the 30 s re-check while `not-ready`.
- src/controller/merge.ts:56-64 — `MergeRules`, the three `agent-rules.md` merge keys.
- src/controller/merge.ts:66-74 — `PullRequest`; `url` is optional.
- src/controller/merge.ts:76-93 — `MergeEvaluation`: `ready`, `reasons`, `pending`, `unreadable`.
- src/controller/merge.ts:95-107 — `MergeStageStatus` and `MergeStageResult` (status, reasons, number, sha, waitId).
- src/controller/merge.ts:188-217 — `findPullRequest`; a known number is trusted with no `gh` call and no url.
- src/controller/merge.ts:280-372 — `evaluate`, the read-only rule: workflow runs, commit statuses, `mergeable`, head branch, attribution trailers.
- src/controller/merge.ts:383-430 — `CiState` (`green`/`pending`/`red`/`unreadable`) and `readCiState`, the same check rule for one head sha.
- src/controller/merge.ts:513-519 — `runMergeStage`, the run's own PR through `mergeByRule`.
- src/controller/merge.ts:526-586 — `mergeByRule`: evaluate, the `ask` wait, `gh pr merge`, post-merge, `pr.merged`.

## Run loop and run record (controller)
- src/controller/state.ts:1-11 — header: one writer, the controller; atomic writes; every record `v: 1`.
- src/controller/state.ts:54-62 — `RunStatus`, including `merging`.
- src/controller/state.ts:64-95 — `RunRecord`: `pr`, `closeoutPrs`, `status`, `resumeAt`, `tokens`; no merge verdict field.
- src/controller/runs.ts:50-55 — `runEvents`, the `change` emitter the dashboard rebroadcasts as `controller-runs`.
- src/controller/runs.ts:454-456 — `ledgerPath`, the spec's `harness-events.jsonl`.
- src/controller/runs.ts:508-511 — run `totalW`, an unweighted sum of the four token kinds.
- src/controller/runs.ts:521-526 — `save`, the one run-record write path; emits `change`.
- src/controller/runs.ts:585-682 — `runMergeStageStep`: maps each `MergeStageStatus` to a run status; only `blocked`/`unreadable`/`failed` reasons reach a wait text.
- src/controller/runs.ts:894-937 — `runCloseoutMergeStep`: close-out PRs through `mergeByRule`; reasons go to a ledger `note`.
- src/controller/runs.ts:1171-1202 — `ControllerRunRow`, `toRow`, `listRunsForWire`: the path-free `controller-runs` row; no PR fields.
- src/controller/ledger.ts:53-73 — `RunLedger` row writers; `prMerged` is the only PR row.
- src/controller/controller.ts:455-468 — `mergeRules` and `tokenCap`; `baseline-w-per-spec` is read by a regex on `agent-rules.md`.

## Agent rules parser
- src/dashboard/harness/run-setup.ts:31-43 — `AgentRules`, the run-relevant keys.
- src/dashboard/harness/run-setup.ts:66-127 — `readAgentRules`, the one parser of `agent-rules.md`.

## Deferral record and tool
- src/types.ts:310-330 — `Deferral`; no `owner` field.
- src/core/deferral-storage.ts:42-62 — `serializeFrontmatter`, the fixed frontmatter key list.
- src/core/deferral-storage.ts:125-170 — `parseMarkdown`, quoting-tolerant frontmatter read.
- src/core/deferral-storage.ts:218-259 — `create`.
- src/core/deferral-storage.ts:266-294 — `list` with status/originSpec/tag filters.
- src/core/deferral-storage.ts:310-329 — `update`, the mutable field list.
- src/core/deferral-storage.ts:428-470 — `reindex`, re-serializes every record's frontmatter.
- src/tools/deferrals.ts:6-109 — the `deferrals` tool schema.
- src/tools/deferrals.ts:150-190 — `handleAdd`.
- src/tools/deferrals.ts:192-214 — `handleList`, the summary fields.
- src/tools/deferrals.ts:254-275 — `handleUpdate`, the updatable key list.

## Dashboard server
- src/dashboard/multi-server.ts:366-402 — `deferral-change` broadcast and `buildDeferralsPayload` (full records from `list`).
- src/dashboard/multi-server.ts:490-498 — `GET /api/projects/:projectId/deferrals`.
- src/dashboard/multi-server.ts:643-657 — run log tail and `GET /api/controller/rate-limit`.
- src/dashboard/shell/shell-feed.ts:1-9 — header: the feed adds no file watcher.
- src/dashboard/shell/shell-feed.ts:81-131 — `flush`: sends `shell-now`, `shell-specs`, `controller-waits`, `controller-runs`, `controller-activity`.
- src/dashboard/shell/types.ts:137-150 — server `ControllerRun` wire type.
- src/dashboard/shell/spec-rows.ts:91-102 — the spec state rule; `closed` by a HANDOFF closeout row or a `CLOSED` retro plan.
- src/dashboard/shell/spec-rows.ts:144 — task counts from the index snapshot's `taskProgress`.
- src/dashboard/shell/now-model.ts:136-144 — `closedOn` from the HANDOFF closeout row date.
- src/dashboard/shell/file-cache.ts:1-6 — `FileCache`, mtime-and-size keyed, never throws.

## Usage fold
- src/watch/usage.ts:13-39 — `UsageCell` (`w`, `wUnknown`) and `UsageReport`.
- src/watch/usage.ts:68-78 — `spawnW`, the weighted W of one `spawn.end` row.
- src/watch/usage.ts:162 — `buildUsageReport(events, spec)`, every run of one ledger.
- src/watch/usage.ts:384-400 — `unitCount`; implementation units are `task.done` rows.
- src/tools/harness.ts:1222-1266 — `readSpecLedger`, the `usage` action's ledger read.

## Frontend shell
- src/dashboard_frontend/src/modules/shell/types.ts:167-179 — hand copy of `ControllerRun`.
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:8-20 — `DeferralRecord` and `DeferralsPayload`.
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:117-132 — per-project deferrals fetch.
- src/dashboard_frontend/src/modules/shell/RunPage.tsx:121-133 — the controller run picked for the page's project.
- src/dashboard_frontend/src/modules/shell/RunPage.tsx:163-202 — the Run page list column; `LiveNow` renders first.
- src/dashboard_frontend/src/modules/shell/RunPage.tsx:238-324 — `LiveNow`, the controller run's status, step and waits.
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:1-15 — header: read-only page, status chips, search, pager.
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:59-184 — `DeferralsPage`: chips, filter, rows.
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:206-251 — `DeferralPanel`, the record fields.
- src/dashboard_frontend/src/modules/shell/UsagePage.tsx:61-102 — `UsagePage`: two window bars and the placeholder line.
- src/dashboard_frontend/src/modules/shell/primitives.tsx:4 — `ROWS_PER_PAGE` = 20.
- src/dashboard_frontend/src/modules/shell/primitives.tsx:63-102 — `Chip` and `Chips`.

## Docs
- docs/SDD-HARNESS.md:252-260 — the `agent-rules.md` key table (merge keys, `baseline-w-per-spec`).
- docs/adr/0003-merge-by-rule.md — the merge rule decision.

## Dashboard push path
- src/dashboard/harness/hub.ts:46-50 — the hub listens to spec, deferral, wait, run and activity changes.
- src/dashboard/harness/hub.ts:161-163 — `onSourceChange` schedules a shell-feed flush.
- src/dashboard/project-manager.ts:294 — `getAllProjects`, every project the dashboard knows.
