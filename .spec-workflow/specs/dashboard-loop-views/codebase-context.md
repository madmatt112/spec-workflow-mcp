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

## Merge evaluation internals (design phase)
- src/controller/merge.ts:38-39 — `PR_VIEW_FIELDS`, the `gh pr view --json` field list.
- src/controller/merge.ts:233-250 — `CheckState`, `classifyWorkflowRun`, `classifyStatusContext`.
- src/controller/merge.ts:297-321 — `evaluate`'s four unreadable early returns.
- src/controller/merge.ts:323-345 — the CI loop over runs and statuses, and the fresh-head pending rule.
- src/controller/merge.ts:347-354 — the `mergeable` read; `UNKNOWN` sets `pending`.
- src/controller/merge.ts:456-460 — `closeoutMergeTarget`, `basename(repoDir)` as the repo name.
- src/controller/merge.ts:483-493 — `readMergeSha`.
- scripts/stub-gh.mjs:1-86 — the `gh` stub the merge and runs suites script.

## Run loop re-reads (design phase)
- src/controller/runs.ts:626-632 — the `runMergeStage` call inside `runMergeStageStep`.
- src/controller/runs.ts:718-730 — loop top re-reads the run, resumes a mid-flight merge.
- src/controller/runs.ts:754-762 — the done route: close-out merges, then a re-read.
- src/controller/runs.ts:846-852 — implementation complete, then `runMergeStageStep`.
- src/controller/state.ts:212-227 — `runsDir`, `runDir`, `runPath`: `runs/<id>/run.json` under the controller home.
- src/controller/state.ts:327-333 — `readRun` and `writeRun`.

## Shell feed timing
- src/dashboard/shell/shell-feed.ts:39 — `throttleMs` default 1000.
- src/dashboard/harness/hub.ts:49 — `runEvents` `change` re-arms the feed.

## Spec rows and usage inputs
- src/dashboard/shell/spec-rows.ts:52-60 — `firstStatusValue`, the plan `Status:` value.
- src/dashboard/shell/spec-rows.ts:72-86 — snapshot walk, HANDOFF phase rows and ledger per spec.
- src/dashboard/shell/spec-rows.ts:91-102 — closed rule lines 92-93.
- src/watch/ledger.ts:201-218 — `parseHandoffPhaseRows`, unwindowed.
- src/watch/usage.ts:162-255 — `buildUsageReport`; `total` summed at 240-254.
- src/dashboard/multi-server.ts:526-535 — the `/api/shell/projects/:projectId/specs/:specName` route.
- src/dashboard/project-manager.ts:294-296 — `getAllProjects`.

## Frontend extras
- src/dashboard_frontend/src/lib/dateUtils.ts:13-41 — `formatDate`, optional seconds.
- src/dashboard_frontend/src/modules/theme/theme.css:97-108 — status colour tokens, light.
- src/dashboard_frontend/src/modules/theme/theme.css:172-183 — status colour tokens, dark.
- src/dashboard_frontend/src/modules/shell/RunPage.tsx:176-186 — `LiveNow` mount in the list column.
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:23-33 — `FullDeferral`.
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:196-204 — `Field`, hides an empty value.

## Tests and checks touched
- src/controller/__tests__/merge.test.ts:157-172 — `evaluate` ready case; exact `toEqual` at 171 and 232.
- src/controller/__tests__/runs.test.ts:357-499 — merge stage suite: close-out, ask, auto not-ready then merged.
- src/dashboard/harness/__tests__/run-setup.test.ts:366-375 — missing-file whole-struct `toEqual` of `AgentRules`.
- e2e/worktree-shell.spec.ts:205-224 — no-sideways-scroll test; `/usage` marker `usage-placeholder` at 206.
- vitest.config.ts:1-21 — node env; excludes `src/dashboard_frontend/**`.

## Docs (design phase)
- docs/SDD-HARNESS.md:252-269 — the full `agent-rules.md` key table.
- docs/TOOLS-REFERENCE.md:370-376 — the `deferrals` action table through `update`.

## Tasks phase additions
- src/controller/merge.ts:20 — `merge.ts` imports `RunRecord` from `state.ts`; `state.ts` imports nothing from `merge.ts`.
- src/controller/merge.ts:531 — `mergeByRule` calls `evaluate(pr)`.
- src/controller/runs.ts:840-852 — implementation complete: re-read, `runMergeStageStep`, then `continue` re-reads at loop top.
- src/dashboard/shell/shell-feed.ts:109 — `listRunsForWire` rows become the `controller-runs` payload.
- src/watch/usage.ts:345-368 — `reduceSpawns`: a `spawn.end` attaches only to an open `spawn.start` of the same agent.
- src/dashboard/harness/state-files.ts:26-29 — `sddHome`: `$SDD_HOME`, else the state home plus `sdd`.
- src/dashboard_frontend/src/modules/shell/primitives.tsx:87 — chip test id `chip-{value}`.
- src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:87-106 — `items` filter, its deps at 103, the pager reset effect at 106.
- tsconfig.json:20 — `tsc` excludes `src/dashboard_frontend/**`; the frontend check is `npm run build:dashboard` (package.json:31).
- docs/SDD-HARNESS.md:135 — "Three keys" counts the merge keys only.
- docs/TOOLS-REFERENCE.md:370-377 — the `deferrals` action table, `add` at 372, `update` at 376.

## Tests touched (tasks phase)
- src/controller/__tests__/runs.test.ts:411-434 — close-out PR merged by rule.
- src/controller/__tests__/runs.test.ts:465-499 — auto: not-ready once, then merged (sha `cafef00d1234`).
- src/tools/__tests__/deferrals.test.ts:118-126 — no-fields update; `toContain('No fields to update')`.
- src/core/__tests__/deferral-resilience.test.ts:173-178 — second `reindex` rewrites 0.
- src/dashboard/__tests__/shell-routes.test.ts:208-252 — two-project fixture (alpha with spec-a, beta idle).
- src/dashboard/shell/__tests__/shell-feed.test.ts:201-243 — `writeRun` then a short-throttle `ShellFeed`.
- e2e/worktree-shell.spec.ts:68-91 — seeding before the servers start.
