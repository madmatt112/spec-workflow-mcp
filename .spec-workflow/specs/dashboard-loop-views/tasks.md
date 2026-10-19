# Tasks Document

Document version: v1

Three slices share no code: the PR panel (tasks 1 to 5), the deferral owner (tasks 6 to 8) and the usage view (tasks 9 to 13); task 14 runs the browser scenarios over all three. Inside each slice the order is fixed: 1, 2, 3, 4, 5; 6, 7, 8; 9, 10, 11, 12, 13. Each task leaves the server compiling (`npx tsc --noEmit`), the dashboard building (`npm run build:dashboard`) and every existing suite green. No task uses an artefact that a later task creates, so no task needs a bridge. Task 11 adds a new module and routes to a verifier by default; no task touches a sensitive path in `agent-rules.md`.

- [x] 1. Return what the merge pass read
  - File: src/controller/merge.ts
  - Test: src/controller/__tests__/merge.test.ts — evaluatePullRequest(pr, now)
  - Add `url` to `PR_VIEW_FIELDS`; move the body of `evaluate` into a new exported `evaluatePullRequest` that also returns the CI state, the raw `mergeable` and the URL; `evaluate` returns only its evaluation.
  - Purpose: Give the PR panel the CI state, mergeable value and link with no second GitHub read
  - _Leverage: src/controller/merge.ts (`evaluate` 291-372, `readCiState` 397-430), scripts/stub-gh.mjs_
  - _Requirements: 1.1, 1.3, 1.4, 1.12_
  - _Prompt: Task: Implement design C1 (requirement 1 AC1, AC3, AC4) in `src/controller/merge.ts`. Add `url` to `PR_VIEW_FIELDS` (line 38-39); the view call count stays one per pass. Export `evaluatePullRequest(pr, now?)` that holds the body of `evaluate` (lines 291-372) unchanged and also returns `ci`, `mergeable` and `url`. `ci` is `unreadable` on each of the five early returns (lines 297-321: view exit, parse fail, no `headRefOid` at 311-313, runs-read fail, status-read fail). Else two new flags: `ciFailed` from a failed workflow run or status, `ciPending` from a pending run or status or the fresh-head rule (lines 339-345); `ci` is `red` if failed, else `pending` if pending, else `green`. `mergeable=UNKNOWN` (lines 347-351) sets the evaluation's `pending` but not `ciPending`. `mergeable` is the raw `data.mergeable` string, read right after the JSON parses, so it is present on every return after the parse; it is absent when the view failed or did not parse. `url` is `pr.url` when set, else `data.url` when it is a string (no https filter here; task 2 filters). `evaluate(pr, now)` keeps its signature and returns `(await evaluatePullRequest(pr, now)).evaluation` (design D1, requirement 1 AC12). | Restrictions: Change no reason text, no `ready`/`pending`/`unreadable` value and no `gh` call order. The exact `toEqual` assertions at `src/controller/__tests__/merge.test.ts:171` and `:232` stay unchanged; no existing assertion in that file changes value. Run `grep -rn "mergeStateStatus,headRefName" src scripts e2e` to find every assertion on the field list and keep each green. R1 AC12 is an invariant (verified, not red-first): the existing merge suite passes as is. Check with `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/merge.test.ts`. | Success: `evaluatePullRequest` returns `ci: 'green'` for passing runs and statuses; `ci: 'pending'` for a run in progress and for a fresh head with no run; `ci: 'red'` for a failed run; `ci: 'unreadable'` on each of the five early returns; `mergeable=UNKNOWN` gives `ci: 'green'` with the evaluation pending; `mergeable` is absent when the view fails and present when the runs read fails; `url` comes from the view when `pr.url` is unset; `evaluate` returns the same objects as at base and the existing merge suite passes unchanged_

- [x] 2. Put a PR read on every merge-stage result
  - File: src/controller/state.ts
  - File: src/controller/merge.ts
  - Test: src/controller/__tests__/merge.test.ts — runMergeStage(run, deps); mergeByRule(target, deps)
  - Export the `PrCiState` and `PrRead` types from `state.ts`; add an optional `read` to `MergeStageResult`; `mergeByRule` calls the function task 1 exports and sets `read` on every return.
  - Purpose: Carry one PR read from the merge pass to its callers
  - _Leverage: src/controller/merge.ts (`MergeStageResult` 98-107, `mergeByRule` 526-586, `closeoutMergeTarget` 457-460)_
  - _Requirements: 1.1, 1.2_
  - _Prompt: Task: Implement the `PrRead` model and the `read` post-conditions of design C1 and C2 (requirement 1 AC1, AC2). In `src/controller/state.ts` export `PrCiState` and `PrRead` with the fields of the design's PrRead data model (illustrative; verify against the test fake); import `MergeStageStatus` with `import type` so no runtime cycle forms (`merge.ts` already imports `state.ts` at line 20). In `merge.ts`, `MergeStageResult` (lines 98-107) gains `read?: PrRead`. `mergeByRule` (lines 526-586) calls the function task 1 exports in place of `evaluate` at line 531 and sets `read` on every return: `verdict` equals the returned `status`, `reasons` is the same array, `sha` equals the returned `sha`, `at` is `deps.now()` ISO, `repo` is `basename(pr.repoDir)` as `closeoutMergeTarget` does (lines 457-460), `kind` is `run` when `target.questionId` is `merge`, else `closeout`, `ci` and `mergeable` from the evaluation pass, and `url` kept only when it starts with `https://` (NFR Security). The no-PR return of `runMergeStage` (lines 515-517) has no `read`. | Restrictions: `PrRead` holds no path. Change no `status`, `reasons`, `number`, `sha` or `waitId` value of any return; no existing assertion in `merge.test.ts` changes value. Check with `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/merge.test.ts`. | Success: `runMergeStage` results for merged, not-ready, blocked and unreadable each carry `read` with `verdict` equal to `status`, the same `reasons`, `kind: 'run'` and `repo` equal to the repo basename; a merged read carries the merge `sha`; a non-https view url is dropped and an https one kept; an unreadable view gives a read with `ci: 'unreadable'` and no `mergeable`; `mergeByRule` with a `closeoutMergeTarget` target gives `kind: 'closeout'`; the no-PR result has no `read`_

- [ ] 3. Save PR reads on the run record and the wire row
  - File: src/controller/state.ts
  - File: src/controller/runs.ts
  - Test: src/controller/__tests__/runs.test.ts — withPrRead(reads, read); runOnce(deps, runId); listRunsForWire()
  - Add optional `prReads` to `RunRecord`; export `withPrRead`; save each read at both merge call sites; copy `prReads` onto the `controller-runs` row.
  - Purpose: Persist one read per PR and push it to the dashboard
  - _Leverage: src/controller/runs.ts (`save` 521-526, `runMergeStageStep` 599-682, `runCloseoutMergeStep` 903-937, `toRow` 1189-1196)_
  - _Requirements: 1.1, 1.5, 1.6, 1.9, 1.13_
  - _Prompt: Task: Implement design C2 (requirement 1 AC1, AC5, AC6, AC13). `RunRecord` (`src/controller/state.ts:65-95`) gains `prReads?: PrRead[]`. Export `withPrRead(reads, read)` from `runs.ts`: replace the entry with the same `repo` and `number` (design D4), else append, then stable-sort `kind: 'run'` first. In `runMergeStageStep`, right after the `runMergeStage` call (lines 626-632) and before the `switch` at 634, when `result.read` is set, `run = await save(deps, run, { prReads: withPrRead(run.prReads, result.read) })`. In `runCloseoutMergeStep`, after each `mergeByRule` (line 912), the same save with that PR's read. `ControllerRunRow` (lines 1175-1187) and `toRow` gain `prReads`, copied from the record and left undefined when the record has none (design D5, requirement 1 AC13). | Restrictions: Use the `PrRead` type task 2 exports. Write only through `save`. Change no run status, wait text or ledger row; no existing assertion in `runs.test.ts` changes value. The legacy-record case is a regression guard: it holds at base (R1 AC13, invariant). Check with `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/runs.test.ts`. | Success: `withPrRead` replaces the entry with the same repo and number, keeps the others, and puts `run` first; in "auto: not-ready once, then merged" (lines 465-499) `prReads` holds one read with verdict `not-ready` and `ci: 'pending'` after pass one, and one read with verdict `merged` and sha `cafef00d1234` after pass two; in the close-out merge test (lines 411-434) `prReads` holds a `kind: 'closeout'` read with verdict `merged`; `listRunsForWire` gives a row with `prReads` and no `repoDir` key; a record written without `prReads` lists with the field undefined_

- [ ] 4. Hand copies of the PR read on the wire
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - Test (integration): src/dashboard/shell/__tests__/shell-feed.test.ts — new ShellFeed(projects, send, { throttleMs }).start()
  - Add `ControllerPrRead` and an optional `prReads` to both `ControllerRun` hand copies.
  - Purpose: Keep the three row shapes in step and prove the live push
  - _Leverage: src/dashboard/shell/types.ts (`ControllerRun` 138-150), src/dashboard_frontend/src/modules/shell/types.ts (`ControllerRun` 167-179)_
  - _Requirements: 1.6, 1.9_
  - _Prompt: Task: Implement design C3 for the PR read (requirement 1 AC6, AC9). Both `ControllerRun` types gain `prReads?: ControllerPrRead[]`, where `ControllerPrRead` is a hand copy of the `PrRead` task 2 exports. Run `grep -rn "interface ControllerRun\b\|interface ControllerRunRow" src` to find the three shapes and keep their fields in step. Add a test to `shell-feed.test.ts` in the pattern of its quiet-wait test (lines 201-243): `writeRun` a record with `prReads`, start a `ShellFeed` with a short `throttleMs`, and assert the `controller-runs` message carries the reads within the throttle. | Restrictions: No runtime change; the feed already forwards the rows `listRunsForWire` returns (`src/dashboard/shell/shell-feed.ts:109`). No existing assertion in `shell-feed.test.ts` changes value; the message-type order at line 252 stays. Check with `npx tsc --noEmit`, `npx vitest run src/dashboard/shell/__tests__/shell-feed.test.ts` and `npm run build:dashboard`. | Success: Both hand copies compile with `prReads`; the new feed test shows a `controller-runs` message whose run row carries the written reads within the throttle; the existing feed suite passes unchanged_

- [ ] 5. PR panel on the Run page
  - File: src/dashboard_frontend/src/modules/shell/RunPage.tsx
  - Add a `PrPanel` after `LiveNow` that renders one row per PR read of the page's controller run.
  - Purpose: Show the operator why a run in `merging` has not merged
  - _Leverage: src/dashboard_frontend/src/modules/shell/RunPage.tsx (`ctrlRun` 122-125, `LiveNow` mount 176-186), src/dashboard_frontend/src/lib/dateUtils.ts (`formatDate`)_
  - _Requirements: 1.7, 1.8, 1.10, 1.11_
  - _Prompt: Task: Implement design C4 (requirement 1 AC7, AC8, AC10, AC11). Add `PrPanel({ reads })` typed with the `ControllerPrRead` task 4 exports; mount it right after the `LiveNow` block (lines 176-186) when `ctrlRun?.prReads?.length` is above 0, else render nothing. The panel has `data-testid="pr-panel"`; each row `data-testid="pr-row-{repo}-{number}"` shows, in order: the repo name; `#number` as an anchor to `url` when it starts with `https://`, else plain text; a CI chip `data-testid="pr-ci-{repo}-{number}"` coloured `--status-success`, `--status-warning`, `--status-error` or `--status-pending` for `green`, `pending`, `red`, `unreadable`; `mergeable`, or an em dash when absent; the verdict, then `sha.slice(0, 7)` when the verdict is `merged`; each reason on its own line; `formatDate(at, { includeSeconds: true })`. | Restrictions: The panel makes no fetch and calls no GitHub route (requirement 1 AC11). Use the existing theme tokens; add no package. The frontend has no unit suite (vitest excludes it); task 14 covers the browser behaviour. Check with `npm run build:dashboard`. | Success: The dashboard builds; with no PR read no `pr-panel` element renders; with reads the panel shows one row per read with every field above in order, the CI chip test id and colour per state, and the 7-character sha on a merged row_

- [ ] 6. Owner on the deferral record and its storage
  - File: src/types.ts
  - File: src/core/deferral-storage.ts
  - Test: src/core/__tests__/deferral-storage.test.ts — DeferralStorage.create/get/list/update/resolve/merge/reindex
  - Add `DeferralOwner` and an optional `owner` to `Deferral`; write, read and update it in the storage.
  - Purpose: Store and read the owner of a deferral
  - _Leverage: src/core/deferral-storage.ts (`serializeFrontmatter` 42-63, `parseMarkdown` 125-165, `update` 310-329, `reindex` 428-470)_
  - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.8_
  - _Prompt: Task: Implement design C5 (requirement 2 AC1, AC2, AC5, AC6, AC8). Export `type DeferralOwner = 'matthew' | 'harness'`; `Deferral` (`src/types.ts:310-330`) gains `owner?: DeferralOwner | null`. `serializeFrontmatter` writes `owner: "matthew"` or `owner: "harness"` after the `supersedes` line (line 60) only when `owner` is one of the two; else no line (design D6, requirement 2 AC5). `parseMarkdown` sets `owner` to the scalar when it is one of the two, else `null`. `update`'s `updates` (lines 310-317) gains `owner?: DeferralOwner`. | Restrictions: A record with no owner serializes byte-identical to base, so `reindex` rewrites no legacy file. No read path writes (requirement 2 AC8, invariant: holds at base, a regression guard). Run `grep -rn "supersedes: " src/core/__tests__ src/tools/__tests__ src/dashboard docs` to find every frontmatter-shape assertion and keep each green. No asserted value in `deferral-storage.test.ts` or `src/core/__tests__/deferral-resilience.test.ts` changes; the idempotence check `second.rewritten` 0 (resilience line 176) holds. Check with `npx tsc --noEmit` and `npx vitest run src/core/__tests__/deferral-storage.test.ts src/core/__tests__/deferral-resilience.test.ts`. | Success: An owner round-trips through create, get and list; an absent or bad owner reads `null` and the record still lists; `reindex` on a legacy file reports `rewritten: 0` and on an owned file keeps the owner; `resolve`, `merge` and `update` keep the owner and `update` sets a new one; an unowned record's file has no `owner` line_

- [ ] 7. Owner in the deferrals tool
  - File: src/tools/deferrals.ts
  - File: docs/TOOLS-REFERENCE.md
  - Test: src/tools/__tests__/deferrals.test.ts — deferralsHandler(args, context)
  - Accept, validate and return `owner` in `add`, `update`, `list` and `get`; document it.
  - Purpose: Let the harness set the owner and read it back
  - _Leverage: src/tools/deferrals.ts (schema 22-104, `handleAdd` 150-190, `handleList` 192-214, `handleUpdate` 254-275), docs/TOOLS-REFERENCE.md (action table 370-376)_
  - _Requirements: 2.3, 2.4, 2.7_
  - _Prompt: Task: Implement design C6 (requirement 2 AC3, AC4, AC7). The schema gains `owner: { type: 'string', enum: ['matthew', 'harness'] }`, optional for add and update; the description's update list (line 18) names `owner`. A shared check runs first in `handleAdd` and `handleUpdate`: when `args.owner !== undefined` and it is neither value, return `{ success: false, message: "owner must be 'matthew' or 'harness'" }` before any storage call. `handleAdd` passes `owner: args.owner ?? null` to `create`; `handleUpdate`'s key list (line 260) and its "Updatable" message (line 265) add `owner`. `handleList`'s summary (lines 199-207) adds `owner: d.owner ?? null`. The action table rows for `add` and `update` list `owner`. | Restrictions: Use the storage field task 6 adds. Run `grep -rn "revisitCriteria" src/tools/deferrals.ts docs/TOOLS-REFERENCE.md` to find every updatable-field list and add `owner` to each. No asserted value in `deferrals.test.ts` changes; the `toContain('No fields to update')` at line 125 still holds. Check with `npx tsc --noEmit` and `npx vitest run src/tools/__tests__/deferrals.test.ts`. | Success: `add` with an owner stores it and `get` returns it; `update` with an owner sets it; a bad owner on `add` returns `success: false` with a message naming both values and creates no file; a bad owner on `update` returns `success: false` and leaves the file unchanged; `list` summary rows carry `owner`, `null` when unset_

- [ ] 8. Owner chip, field and filter on the Deferrals page
  - File: src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx
  - Add owner filter chips with counts, an owner badge per row and an Owner field in the panel.
  - Purpose: Let the operator see and filter the deferrals that wait on them
  - _Leverage: src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx (`FullDeferral` 23-33, `statusCounts` 75-84, `items` 87-103, reset effect 106, `Field` 196-204), src/dashboard_frontend/src/modules/shell/primitives.tsx (`Chips` 69-102)_
  - _Requirements: 2.9, 2.10, 2.11, 2.12_
  - _Prompt: Task: Implement design C7 (requirement 2 AC9 to AC12). `FullDeferral` gains `owner?: 'matthew' | 'harness' | null`. Add `activeOwners` state and a second `Chips` row (design D8, requirement 2 AC10) with values `matthew`, `harness`, `none`, labelled `matthew`, `harness`, `no owner`; each count spans every enabled project's records, computed like `statusCounts`. The `items` filter keeps a record only if `activeOwners` is empty or includes `d.owner ?? 'none'`; add `activeOwners` to that `useMemo` deps array (line 103) and to the reset effect (line 106). A row with an owner shows a badge `data-testid="deferral-owner-{projectId}-{id}"` after `StatusBadge`; `DeferralPanel` adds `Field label="Owner"`. | Restrictions: The page stays read-only: add no control that writes (requirement 2 AC12). Refresh comes from `deferralsByProject` as at base. Task 14 covers the browser behaviour. Check with `npm run build:dashboard`. | Success: The dashboard builds; owner chips show with counts; owner chips combine by OR with each other and by AND with status chips and search; a filter change resets the pager; an owned row shows the badge and the panel shows Owner; an unowned record shows neither_

- [ ] 9. Baseline key in the agent-rules parser
  - File: src/dashboard/harness/run-setup.ts
  - File: docs/SDD-HARNESS.md
  - Test: src/dashboard/harness/__tests__/run-setup.test.ts — readAgentRules(workflowRoot)
  - Add an optional `baselineWPerTask` to `AgentRules` and read it from a `baseline-w-per-task` line; document the key.
  - Purpose: Give each repository a W-per-task baseline
  - _Leverage: src/dashboard/harness/run-setup.ts (`AgentRules` 32-43, `readAgentRules` 66-127), docs/SDD-HARNESS.md (key table 252-269)_
  - _Requirements: 3.9_
  - _Prompt: Task: Implement design C8 (requirement 3 AC9). `AgentRules` gains `baselineWPerTask?: number`. `readAgentRules` sets it from `/^baseline-w-per-task:\s*(\d+)\s*$/m`, so `0` reads as `0` (design D9, requirement 3 AC9); otherwise the key is omitted, including for a non-integer and a missing file. Add a key-table row after `baseline-w-per-spec` (line 260): `baseline-w-per-task: <n>`, read by the Usage page, meaning the repository's W per task baseline. | Restrictions: The missing-file return (lines 69-72) gains no key, so the whole-struct `toEqual` at `run-setup.test.ts:371-374` stays unchanged (design D10). Run `grep -rn "postMerge: null, merge: 'auto'" src` to find every whole-struct equality and keep each green. Run `grep -n "keys" docs/SDD-HARNESS.md`: the "Three keys" sentence (line 135) counts the merge keys only and stays. Check with `npx tsc --noEmit` and `npx vitest run src/dashboard/harness/__tests__/run-setup.test.ts`. | Success: `1200` reads as 1200; `0` reads as 0; `12.5`, `abc` and an absent key give no `baselineWPerTask` key; the missing-file equality passes unchanged; the key table lists the new key_

- [ ] 10. Export the closed-spec rule
  - File: src/dashboard/shell/spec-rows.ts
  - Test: src/dashboard/shell/__tests__/spec-rows.test.ts — isSpecClosed(phaseRows, planText)
  - Move the closed rule out of `buildSpecRows` into an exported `isSpecClosed`; `buildSpecRows` calls it.
  - Purpose: One closed rule for the Specs page and the usage rows
  - _Leverage: src/dashboard/shell/spec-rows.ts (`firstStatusValue` 52-60, closed rule 92-93)_
  - _Requirements: 3.2_
  - _Prompt: Task: Implement the `isSpecClosed` part of design C9 (requirement 3 AC2; design D15). Export `isSpecClosed(phaseRows, planText)` that returns true when a row has phase `closeout` and result `closed`, or when the first word of `firstStatusValue(planText)` is `CLOSED` — the rule at lines 92-93. `buildSpecRows` calls it in place of those two lines. | Restrictions: No behaviour change in `buildSpecRows`; no asserted value in `spec-rows.test.ts` changes. `PhaseRow` is the type `src/watch/ledger.ts` exports. Check with `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/spec-rows.test.ts`. | Success: `isSpecClosed` is true for a `closeout`/`closed` row, true for a plan whose `Status:` value starts with `CLOSED`, and false for neither; the existing spec-rows suite passes unchanged_

- [ ] 11. Usage rows builder
  - File: src/dashboard/shell/usage-rows.ts
  - File: src/dashboard/shell/types.ts
  - Test: src/dashboard/shell/__tests__/usage-rows.test.ts — buildUsageRows(project, cache)
  - Add `UsageSpecRow` to the server shell types and a new `buildUsageRows` that returns one row per closed spec of a project.
  - Purpose: Compute W per task and the baseline percentage per closed spec
  - _Leverage: src/dashboard/shell/spec-rows.ts (snapshot walk 72-86), src/watch/usage.ts (`buildUsageReport` 162-255), src/watch/ledger.ts (`parseHandoffPhaseRows` 202-218), src/dashboard/shell/file-cache.ts_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  - _Prompt: Task: Implement design C9's builder (requirement 3 AC1 to AC9). `UsageSpecRow` follows the design's data model (illustrative; verify against the test fake). `buildUsageRows(project, cache)` walks the `IndexGenerator` snapshot as `buildSpecRows` does and keeps entries where the function task 10 exports is true. Per row: `closeDate` is the `date` of the newest `closeout`/`closed` row from `parseHandoffPhaseRows` with no window, else the newest ledger `ts`, else null; `report = buildUsageReport(ledger, spec)`; `w` is `report.total.w` when `report.total.spawns - report.total.wUnknown` is above 0, else null; `wUnknown` is `report.total.wUnknown`; `tasks` is `entry.taskProgress.total`; `wPerTask` is `w / tasks` when `w` is set and `tasks` above 0, else null; `baseline` is the `baselineWPerTask` task 9 adds, else null; `pctOfBaseline` is `wPerTask / baseline * 100` when both are set and `baseline` above 0, else null (design D9). | Restrictions: Read ledgers and HANDOFF through `cache`; never throw on a missing, empty or torn file (NFR Reliability). Write nothing. A `spawn.end` row counts only after a `spawn.start` of the same agent (`reduceSpawns`, `src/watch/usage.ts:345-368`): seed both. Check with `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/usage-rows.test.ts`. | Success: In a temp project, a spec with two `closeout`/`closed` rows takes the newer date; a plan-closed spec falls back to the ledger `ts`; an open spec is excluded; for one ledger `w` equals `buildUsageReport(events, spec).total.w` exactly; an unknown spawn gives `wUnknown` above 0; zero tasks gives `wPerTask` null; a ledger with no known W gives `w` null; a baseline gives the percentage and no baseline gives `baseline` and `pctOfBaseline` null_

- [ ] 12. Usage route
  - File: src/dashboard/multi-server.ts
  - Test: src/dashboard/__tests__/shell-routes.test.ts — GET /api/shell/usage/closed-specs
  - Add a read-only route that returns every known project's closed-spec rows, sorted.
  - Purpose: Serve the usage rows to the Usage page
  - _Leverage: src/dashboard/multi-server.ts (shell spec-detail route 526-535), src/dashboard/project-manager.ts (`getAllProjects` 294-296)_
  - _Requirements: 3.1, 3.10_
  - _Prompt: Task: Implement design C10 (requirement 3 AC1; design D11, D12). Add `GET /api/shell/usage/closed-specs` beside the shell spec-detail route (lines 526-535), returning `{ rows }`. Loop over `this.projectManager.getAllProjects()`, every known project, not only toggled-on ones; run the builder task 11 exports per project in a `try`; on a throw log `ShellUsage: skipping project {id}` once for that request and leave the project out. Use one server-lifetime `FileCache` field. Sort by `projectName`, then `closeDate` newest first with null last. | Restrictions: No parameters; never return an error status for a bad file; add no watcher, timer or writer (NFR Reliability). No existing assertion in `shell-routes.test.ts` changes value; extend its two-project fixture (lines 208-252) with closed specs. Check with `npx tsc --noEmit` and `npx vitest run src/dashboard/__tests__/shell-routes.test.ts`. | Success: The route returns 200 with the rows of two projects in the stated order; a project whose `agent-rules.md` path is a directory still yields rows with `baseline: null`_

- [ ] 13. Usage page table and trend
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/UsagePage.tsx
  - File: src/dashboard_frontend/src/modules/shell/UsageTrend.tsx
  - Add the frontend `UsageSpecRow` hand copy; fetch the rows on the Usage page; render the table and a plain-SVG trend; remove the placeholder.
  - Purpose: Show W per task per closed spec and its trend per repository
  - _Leverage: src/dashboard_frontend/src/modules/shell/UsagePage.tsx (refetch effect 67-75, placeholder 97-99), src/dashboard_frontend/src/modules/shell/primitives.tsx (`Group` 12-59)_
  - _Requirements: 3.10, 3.11, 3.12, 3.13, 3.14, 3.15_
  - _Prompt: Task: Implement design C11 (requirement 3 AC10 to AC15). Add a hand copy of the `UsageSpecRow` task 11 exports to the frontend types. `UsagePage` fetches `/api/shell/usage/closed-specs` in a second effect keyed on `controllerRuns`, the pattern at lines 67-75; remove the placeholder (lines 97-99) and the placeholder sentence of the header comment (lines 8-9); keep both window bars. Empty rows after load: `data-testid="usage-no-closed"` with `No closed specs yet.`; else `data-testid="usage-closed-specs"` holding the trend then the table. Table: one `Group` per project (`name="usage-{projectId}"`), rows `data-testid="usage-row-{projectId}-{spec}"`, cell text per design C11. New `UsageTrend.tsx`: inline `svg` per design C11 — `trend-line-{projectId}` polylines, one `circle` per point with a `title` hover value (design D14), dashed `trend-baseline-{projectId}` lines, `trend-legend`, colours from a fixed six-colour list by `projectName` order (design D13), and `No plotted points yet.` when nothing plots. | Restrictions: No charting package (NFR Performance). Plot only rows with both `wPerTask` and `closeDate` (requirement 3 AC12). A failed fetch keeps the last rows. Task 14 covers the browser behaviour. Check with `npm run build:dashboard`. | Success: The dashboard builds; the placeholder is gone and both bars stay; with no rows the page shows `No closed specs yet.`; with rows it shows the trend and the grouped table; rows with a null W per task or close date list but do not plot_

- [ ] 14. End-to-end scenarios for the three views
  - File: e2e/worktree-shell.spec.ts
  - Test (integration): e2e/worktree-shell.spec.ts — npm run test:e2e:worktree
  - Seed a run record with PR reads, three deferrals and one closed spec per project; add one browser test per requirement; change the `/usage` marker.
  - Purpose: Prove the three views render from real files in the browser
  - _Leverage: e2e/worktree-shell.spec.ts (seeding 68-91, no-sideways-scroll test 205-224), src/dashboard/harness/state-files.ts (`sddHome` 26-29)_
  - _Requirements: 1.7, 1.10, 2.9, 2.10, 3.10, 3.11, 3.14_
  - _Prompt: Task: Implement design C12 and the end-to-end strategy. Before the pages load, seed: a `done` run record for project A with two reads (one `merged` with a sha, one close-out `blocked` with two reasons) at `runs/{id}/run.json` under `sddHome()` (`$SDD_HOME`, else `$XDG_STATE_HOME/sdd`), its `project` equal to project A's id; three deferral files in project A (owner `matthew`, owner `harness`, none); a new closed spec in each project with a HANDOFF `## Phase log` closeout row, a ledger of `spawn.start`/`spawn.end` pairs, and a `tasks.md`; `baseline-w-per-task` in project A's `agent-rules.md` only. Add tests: (R1) the Run page shows `pr-panel`, both rows, the 7-character sha, each reason and the CI chips; (R2) `chip-matthew` shows 1, selecting it leaves one row, adding a status chip narrows by AND, the panel shows Owner; (R3) both projects' rows show, the placeholder is gone, two `trend-line-*` and one `trend-baseline-*` are present. Change the marker at line 206 from `usage-placeholder` to `usage-closed-specs`. | Restrictions: Leave the existing fixture specs and their HANDOFF lines as they are; use new spec names for the closed specs. No other existing assertion changes value. Run `npx playwright install chromium`, `npm run build`, `npm run test:e2e:worktree`, then `npm test`. | Success: The R1, R2 and R3 tests pass; the no-sideways-scroll test passes with the new marker; every existing test in the file and the full vitest suite pass_

## Decisions taken in this document

- D1 — Slice 1 split: options were five tasks (merge read, result read, run-record save, wire copies, panel) or two larger tasks; chosen because each step keeps the tree compiling and maps to one test file.
- D2 — Where the https filter is tested: options were the read on the merge-stage result or the evaluation pass; chosen because design C1 puts the filter on the read, while its testing line groups it with the evaluation cases.
- D3 — Live-push proof routing: options were an integration test in the wire-copy task or a red-first test; chosen because the feed already forwards every row field, so the test cannot fail once the run-record task ships.
- D4 — Frontend tasks carry no unit test: options were a new frontend test runner or the dashboard build plus the browser task; chosen because vitest excludes the frontend and design D11 records no frontend suite.
- D5 — Closed specs in the browser fixture: options were new spec names or closing the two existing fixture specs; chosen because closing the existing specs would change rows that other tests in the file assert.
- D6 — Closed-rule extraction as its own task: options were its own task or folding it into the builder task; chosen so the no-behaviour-change proof lands apart from the new module.
- D7 — Legacy-record cases: options were regression guards in the Success clause or red-first tests; chosen because they hold at base, and agent-rules routes such a criterion as a regression guard.

## Scope notes

- Carried from design: none.
- Cut, as the requirements and design record: the operator-owned-deferral Now-page wait, a blocks field, the deferral-skill owner triage, the deferral write actions, the live usage view and the per-spec chooser.
- Deferred to the operator: writing a `baseline-w-per-task` value into each repository's `agent-rules.md`.
- The steering `structure.md` is absent from this store; the tasks follow `agent-rules.md`.

## Revision History

- **v1** (2026-10-19) — Initial draft.
