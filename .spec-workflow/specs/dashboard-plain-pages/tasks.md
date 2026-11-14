# Tasks Document

Document version: v1

Dependency order: run the tasks in number order. The chains are 1 → 2 → 6 → 7; 3 → 4 → 5; 8 → 9; tasks 5, 7 and 9 → 10; task 11 runs last. Each page task (5, 7, 9) changes its wire or route, its frontend page and the end-to-end suites that read that page in one commit, so no page is left empty between tasks. Each task leaves `npx tsc --noEmit` and every vitest suite green; tsc does not cover `src/dashboard_frontend/` (`./tsconfig.json:20`), so frontend tasks prove their code through `src/dashboard/__tests__/frontend-build.test.ts` (a vite build) and Playwright. Line citations are to base 1054a946; where an earlier task here edited the file, the named symbol is the anchor and the implementer re-resolves the line. If SPEC_WORKFLOW_SHARED_ROOT is set in the session, run vitest as `env -u SPEC_WORKFLOW_SHARED_ROOT -u SPEC_WORKFLOW_WORKSPACE npx vitest run …`. Tasks 1 and 6 add new modules, so expect at least two verifier spawns. Task 9 carries `kind: e2e`; tasks 10 and 11 carry no `- Test:` seam; all three route implementer-only.

- [ ] 1. Add the usage log module
  - File: src/controller/usage-log.ts
  - File: src/controller/__tests__/usage-log.test.ts
  - Test: src/controller/__tests__/usage-log.test.ts — `appendUsageLine(line, now)`
  - Test: src/controller/__tests__/usage-log.test.ts — `readUsageLog(nowMs)`
  - Test: src/controller/__tests__/usage-log.test.ts — `computeBurn(lines, nowMs)`
  - Test: src/controller/__tests__/usage-log.test.ts — `attributedUse(lines, runId)`
  - Purpose: Keep each rate-limit reading with its time and run, and reduce the log to a burn and a per-run use.
  - _Leverage: src/controller/state.ts:292-297, src/controller/ledger.ts:102-108_
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 4.5, 4.6_
  - _Prompt: Task: Per design C1 and design D7, D8, D14 (requirement 3 AC 1, AC 3 to AC 5, requirement 4 AC 5, AC 6), create `src/controller/usage-log.ts` exporting `UsageLogLine`, `usageLogPath`, `appendUsageLine`, `readUsageLog`, `computeBurn` and `attributedUse` with the signatures design C1 pins. The path joins `controllerHome()` (`src/controller/state.ts:292-297`). Append with `appendFileSync`, as the run ledger does (`src/controller/ledger.ts:107`); above 256 KiB, rewrite the file to the lines of the last 8 days through a temporary file and `renameSync` in the same directory | Restrictions: Synchronous append; catch every error inside `appendUsageLine`, log it with one `console.error` call and never rethrow; the test sets `SDD_HOME` to a temporary directory | Success: an appended line parses to `v: 1`, `ts`, `sevenDay.utilization` and `run`, where `run` is the given id, and `null` when `null` is given; an append whose home is a regular file does not throw and calls `console.error` once; two appends give two parsable lines; a file over 256 KiB keeps only the lines of the last 8 days after the next append; `readUsageLog` skips a torn line and a line with no numeric utilisation, drops lines older than 8 days, sorts by `ts`, and gives `[]` with no file; `computeBurn` with two lines exactly 24 h apart and the clock at the second line gives their difference in points; a reset inside the span sums only the positive steps; no line at or before 24 h ago gives `null`; `attributedUse` with two alternating runs gives each run only the steps that end on its own lines; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/usage-log.test.ts` pass_

- [ ] 2. Carry the run id to the rate-limit callback and append the log line
  - File: src/controller/step.ts
  - File: src/controller/runs.ts
  - File: src/controller/controller.ts
  - File: src/controller/__tests__/step.test.ts
  - File: src/controller/__tests__/controller.test.ts
  - Test: src/controller/__tests__/step.test.ts — `runStep(spec)` on a stream with a `rate_limit_event`
  - Test: src/controller/__tests__/controller.test.ts — a run whose stub step emits a `rate_limit_event`
  - Note: the case at `src/controller/__tests__/step.test.ts:232-255` keeps every asserted value. The unchanged `rate-limit.json` content (requirement 3 AC 2) holds at base: a regression guard. No phase file changes (design C2).
  - Purpose: Each log line names the run whose step emitted the reading.
  - _Leverage: src/controller/step.ts:127, src/controller/step.ts:135, src/controller/step.ts:499-502, src/controller/runs.ts:405-406, src/controller/controller.ts:732, src/controller/controller.ts:790-803, src/controller/__tests__/step.test.ts:70-92, src/controller/__tests__/controller.test.ts:103-131_
  - _Requirements: 3.1, 3.2_
  - _Prompt: Task: Per design C2 and design D13 (requirement 3 AC 1, AC 2), add an optional trailing `run?: string | null` to `StepSpec.onRateLimit` (`src/controller/step.ts:135`) and `RunDeps.onRateLimit` (`src/controller/runs.ts:405-406`). The `rate_limit_event` branch (`src/controller/step.ts:499-502`) passes `spec.runId ?? null`. `runDeps().onRateLimit` (`src/controller/controller.ts:732`) keeps `persistRateLimit` and then calls the append task 1 exports with a line built from the windows, `this.now()` and the run id. Extend the fake at `src/controller/__tests__/step.test.ts:79` to record the second argument; drive the controller case through the stub script of `src/controller/__tests__/controller.test.ts:127-131` | Restrictions: Do not change the `onRateLimit` types of the five phase and merge-fix contexts or `persistRateLimit`; do not await the append | Success: the step fake records `run-x` for a spec with `runId: 'run-x'` and `null` for a spec with no `runId`; a controller run whose stub step emits one `rate_limit_event` leaves `rate-limit.json` holding the event's `fiveHour` and `sevenDay` utilisation, and `usage-log.jsonl` under `SDD_HOME` holding one line whose `run` is the run id and whose `sevenDay.utilization` is the event's; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/step.test.ts src/controller/__tests__/controller.test.ts` pass_

- [ ] 3. Share the decomposition heading list and the launchable rule
  - File: src/dashboard/harness/run-setup.ts
  - File: src/dashboard/harness/__tests__/run-setup.test.ts
  - Test: src/dashboard/harness/__tests__/run-setup.test.ts — `decompositionHeadings(text)`
  - Test: src/dashboard/harness/__tests__/run-setup.test.ts — `launchableSpec(routing, workflowRoot, text)`
  - Test: src/dashboard/harness/__tests__/run-setup.test.ts — `nextUnstartedSpec(workflowRoot, text)`
  - Note: the `buildSetupView` cases (`src/dashboard/harness/__tests__/run-setup.test.ts:552`) keep every asserted value: regression guards for the moved expression. `nextUnstartedSpec` called with no text holds at base: a regression guard.
  - Purpose: The Specs builder and the setup view read one heading rule and one "next" rule.
  - _Leverage: src/dashboard/harness/run-setup.ts:23, src/dashboard/harness/run-setup.ts:202-205, src/dashboard/harness/run-setup.ts:230-239, src/core/spec-routing-deriver.ts:20_
  - _Requirements: 1.2, 2.5, 2.8_
  - _Prompt: Task: Per design C4 (requirement 1 AC 2, requirement 2 AC 5, AC 8), add `decompositionHeadings` and `launchableSpec` to `src/dashboard/harness/run-setup.ts` with the signatures design C4 pins, give `nextUnstartedSpec` (`:230-239`) an optional trailing `text`, and make `buildSetupView` call `launchableSpec` in place of the expression at `:202-205` | Restrictions: Reuse `DECOMPOSITION_HEADING` (`:23`); do not change `decompositionEntry` or `decompositionPosition` | Success: `decompositionHeadings` returns `number`, `spec` and `deferredTag` per heading in file order, so a `34` heading before a `12` heading stays first; `deferredTag` is true for a `(Deferred)` tail and false with no tag; a `## ` heading and a `### ` line with no backticked name give no entry; empty text gives `[]`; `nextUnstartedSpec` given text reads the text, not the file, in a root with no `decomposition.md`; `launchableSpec` returns the routed spec for an `active` routing, else the first heading with no spec directory and no deferred tag, else `null`; `npx tsc --noEmit` and `npx vitest run src/dashboard/harness/__tests__/run-setup.test.ts` pass_

- [ ] 4. Build one Specs block per store
  - File: src/dashboard/shell/spec-rows.ts
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard/shell/__tests__/spec-rows.test.ts
  - Test: src/dashboard/shell/__tests__/spec-rows.test.ts — `buildSpecBlock(project, liveRuns, cache)`
  - Note: `buildSpecRows` and `buildSpecDetail` stay until tasks 5 and 10; their suites keep every asserted value. The `isSpecClosed` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:620`) is a regression guard.
  - Purpose: The decomposition of one store as numbered lines with one state word and one fact.
  - _Leverage: src/dashboard/shell/spec-rows.ts:78-82, src/dashboard/shell/spec-rows.ts:149-154, src/dashboard/harness/run-setup.ts:246-261, src/core/index-generator.ts:59-91, src/core/deferral-storage.ts:277-305_
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - _Prompt: Task: Per design C3 and design D1, D3 to D6, D16, D25 (requirement 1 AC 2 to AC 5, requirement 2 AC 1 to AC 8), add `buildSpecBlock` to `src/dashboard/shell/spec-rows.ts` with the signature and rule order design C3 pins, using the heading list and launchable rule task 3 exports. Add `SpecWord`, `SpecLine` and `SpecBlock` (design Data Models) to `src/dashboard/shell/types.ts` | Restrictions: Read `decomposition.md` and HANDOFF once each through the cache; one `DeferralStorage.list({ status: 'deferred' })` call; never throw on a missing file | Success: one case per word: live in the implementation phase reads `implementation 3/7`, a paused live run reads `implementation 3/7 · paused`, and a live run of the store's second project reads live; closed reads `#12 #15` ascending from phase-log notes, else `no PR recorded`; deferred by a `(deferred)` heading and by a `deferred.json` marker, its fact the newest open record whose `originSpec` is the spec, else a `d-` id in the entry text, else `no record`; next has no fact and at most one line reads it; stopped reads the newest phase-log row's phase, else the index entry's current phase; not started has no fact; live beats closed and closed beats deferred; lines keep file order with non-sequential numbers; an unnamed spec directory gives no line; no `decomposition.md` gives `lines: []`; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/spec-rows.test.ts` pass_

- [ ] 5. Send the blocks and render the Specs page as the list
  - File: src/dashboard/shell/shell-feed.ts
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard/shell/spec-rows.ts
  - File: src/dashboard/shell/__tests__/shell-feed.test.ts
  - File: src/dashboard/shell/__tests__/spec-rows.test.ts
  - File: src/dashboard_frontend/src/modules/shell/ShellProvider.tsx
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/SpecsPage.tsx
  - File: e2e/worktree-shell.spec.ts
  - File: e2e/worktree-no-shared.spec.ts
  - File: e2e/worktree-project-list.spec.ts
  - File: e2e/worktree-visual.spec.ts
  - File: e2e/helpers/shell-seed.ts
  - Test: src/dashboard/shell/__tests__/shell-feed.test.ts — `ShellFeed.start()` then `snapshot()` for `shell-specs`
  - Note: the cases at `src/dashboard/shell/__tests__/shell-feed.test.ts:356-404` change the asserted value from `rows` to `blocks`. The `shell-specs` arrival cases in `src/dashboard/__tests__/shell-routes.test.ts:286-343` are regression guards.
  - Purpose: The Specs page shows each enabled store's decomposition and nothing else.
  - _Leverage: src/dashboard/shell/shell-feed.ts:91-103, src/dashboard/shell/store-groups.ts:25-42, src/dashboard_frontend/src/modules/projects/stores.ts:25-49, src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-39, src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:60_
  - _Requirements: 1.1, 1.6, 1.7, 1.8, 2.9, 8.3_
  - _Prompt: Task: Per design C5, C8, C11 and design D17, D21, D24 (requirement 1 AC 1, AC 6 to AC 8, requirement 2 AC 9), make `flush` (`src/dashboard/shell/shell-feed.ts:91-103`) call the builder task 4 exports per store group with the live runs of every member, and send `{ blocks }`. Delete `buildSpecRows`, `newestRunAbandoned`, `pickNewer`, both `SpecListRow` copies and the `buildSpecRows` suite (`src/dashboard/shell/__tests__/spec-rows.test.ts:279`). `ShellProvider` stores `specBlocks`; rewrite `SpecsPage.tsx` per design C8 with its test ids, keeping `data-testid="page-list"` on the page root (D27); `SpecPanel` and `FileRow` go. Move the toggle case (`e2e/worktree-shell.spec.ts:228-246`) to `spec-line-` ids and delete the panel-stacking case (`:248-260`). Each e2e suite seeds a `decomposition.md` naming its specs before its servers start (D30); the visual Specs view waits for a block, no panel | Restrictions: Keep the five-topic order; do not change `e2e/helpers/worktree-harness.ts`; run `npx playwright install chromium` first | Success: `shell-specs` carries `blocks`, one per store; two projects on one store give one block with the representative's id; a group whose builder throws is left out while the other group's block is sent; the topic order is unchanged; on the page, toggling project B off hides its `spec-line-` and survives a reload; a `(deferred)` heading whose entry names `d-0000abcd` shows `deferred` and `d-0000abcd`; `grep -rn "buildSpecRows\|SpecListRow\|SpecPanel" src --include='*.ts' --include='*.tsx' --exclude-dir=__tests__` finds nothing; `npx tsc --noEmit`, `npx vitest run src/dashboard/shell/__tests__/shell-feed.test.ts src/dashboard/shell/__tests__/spec-rows.test.ts src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-no-shared.spec.ts e2e/worktree-project-list.spec.ts e2e/worktree-visual.spec.ts` pass_

- [ ] 6. Build the usage view on the server
  - File: src/dashboard/shell/usage-view.ts
  - File: src/dashboard/shell/types.ts
  - File: src/controller/runs.ts
  - File: src/dashboard/shell/__tests__/usage-view.test.ts
  - Test: src/dashboard/shell/__tests__/usage-view.test.ts — `buildUsageView(projects, nowMs)`
  - Purpose: The window, the burn and one line per live run with its fit, computed in one place.
  - _Leverage: src/controller/state.ts:593-595, src/dashboard/shell/live-runs.ts:10-18, src/controller/runs.ts:585-587, src/core/task-parser.ts:553, src/controller/ledger.ts:160-166_
  - _Requirements: 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Prompt: Task: Per design C6 and design D8, D11, D18, D20, D26 (requirement 4 AC 4, AC 5, requirement 5 AC 1 to AC 5), create `src/dashboard/shell/usage-view.ts` with `buildUsageView` as design C6 pins it, reading the log through the reader, burn and attribution functions task 1 exports. Export `totalW` (`src/controller/runs.ts:585-587`) unchanged. Add `UsageView` and `UsageRunLine` (design Data Models) to `src/dashboard/shell/types.ts` | Restrictions: Read-only; never throw; the test sets `SDD_HOME` to a temporary directory and seeds run records, `rate-limit.json`, the log, a spec's `tasks.md` and `harness-events.jsonl` | Success: an implementation run with three distinct `task.done` rows, attributed log lines and a future reset reads `fits` when use per task times remaining is within the headroom and `does-not-fit` when not; the fit is `null` for a document-phase run, for zero tasks done, for no attributed line, for a passed reset and for a missing `tasks.md`; a repeated `task.done` row for one task counts once and a row of another run does not count; no `rate-limit.json` gives `window: null`; `burn` equals the task 1 burn of the same lines; a live run of a project absent from `projects` is listed with its project id as name; done and abandoned runs are not listed; `tokens` is the sum of the four kinds; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/usage-view.test.ts` pass_

- [ ] 7. Serve the usage view and render the Usage page
  - File: src/dashboard/multi-server.ts
  - File: src/dashboard/__tests__/shell-routes.test.ts
  - File: src/dashboard_frontend/src/modules/shell/UsagePage.tsx
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: e2e/worktree-shell.spec.ts
  - File: e2e/worktree-visual.spec.ts
  - File: e2e/worktree-board.spec.ts
  - Test: src/dashboard/__tests__/shell-routes.test.ts — `GET /api/shell/usage`
  - Note: the closed-specs route and its cases stay until task 10. `src/dashboard/__tests__/controller-dashboard-routes.test.ts:172` is a regression guard. The visual parity test drops the `row` kind (D29): after this task one view at most renders a row.
  - Purpose: The Usage page answers how much of the week is left and how fast it goes.
  - _Leverage: src/dashboard/multi-server.ts:887-889, src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102, src/dashboard_frontend/src/modules/shell/UsagePage.tsx:117-120, e2e/worktree-board.spec.ts:3531-3581, e2e/worktree-visual.spec.ts:415-420_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 8.1_
  - _Prompt: Task: Per design C7, C9, C11 and design D9, D15 (requirement 4 AC 1 to AC 4, AC 7, AC 8, requirement 5), add `GET /api/shell/usage` returning the view task 6 exports over every registered project, and rewrite `UsagePage.tsx` per design C9 with its test ids; drop its `UsageTrend`, five-hour and closed-specs code. Copy `UsageView` and `UsageRunLine` into the frontend types. Rewrite the worktree-shell Usage case: inside the test seed `rate-limit.json`, two log lines 25 h and 1 min old, a `waiting` implementation run with three `task.done` rows in project A and a `waiting` document-phase run in project B (one live run per project, `src/dashboard/shell/live-runs.ts:10-18`), and remove them in a `finally`. Change the Usage marker at `e2e/worktree-shell.spec.ts:309` and `e2e/worktree-visual.spec.ts:70` to `usage-window`, and at `e2e/worktree-board.spec.ts:3580` to `usage-window` or `usage-no-window` | Restrictions: Do not change `/api/controller/rate-limit`; run `npx playwright install chromium` first | Success: the route on an empty home returns `window: null`, `burn: null`, `runs: []`; the page shows the per cent left of the seeded window, the burn in points, `fits before the reset` for run A and `not known yet` for run B, and no five-hour text; `grep -n "'row'" e2e/worktree-visual.spec.ts` finds every row-kind site (the `KindCapture` union at `:313`, the capture at `:352-354`, the loop at `:415`) and each drops `row`, so the parity loop checks `pill` and `button` only; `npx tsc --noEmit`, `npx vitest run src/dashboard/__tests__/shell-routes.test.ts src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-visual.spec.ts e2e/worktree-board.spec.ts` pass_

- [ ] 8. Add the deferral resolve route
  - File: src/dashboard/multi-server.ts
  - File: src/dashboard/__tests__/deferral-resolve-route.test.ts
  - Test: src/dashboard/__tests__/deferral-resolve-route.test.ts — `POST /api/projects/:projectId/deferrals/:deferralId/resolve`
  - Purpose: The operator resolves a queue item without a session.
  - _Leverage: src/dashboard/multi-server.ts:600-607, src/dashboard/multi-server.ts:704-718, src/tools/deferrals.ts:116-153, src/core/deferral-storage.ts:192-202, src/core/deferral-storage.ts:485-492, src/dashboard/__tests__/shell-routes.test.ts:173_
  - _Requirements: 7.4, 7.5, 7.6_
  - _Prompt: Task: Per design C7 and design D19 (requirement 7 AC 4 to AC 6), add `POST /api/projects/:projectId/deferrals/:deferralId/resolve` beside the deferrals list route (`src/dashboard/multi-server.ts:600-607`), with the six checks in the order design C7 pins, then `deferralsHandler` (`src/tools/deferrals.ts:116-153`). Build the test server as `src/dashboard/__tests__/shell-routes.test.ts:173` does | Restrictions: Read only `resolution` from the body; write nothing before every check passes; no access-control exemption | Success: a valid request answers 200 `{ ok: true }` and the record file holds `status: resolved`, the trimmed text as `resolution` and a `resolvedAt`; a 2,000-character resolution is accepted; an empty, a whitespace-only, a non-string and a 2,001-character resolution each answer 400; an unknown project, an unknown id and an id holding an encoded slash each answer 404 with an `error`; an already resolved record answers 409 naming its status; a corrupt record file answers 409 with the reindex message; each error case leaves the record file bytes unchanged; `npx tsc --noEmit` and `npx vitest run src/dashboard/__tests__/deferral-resolve-route.test.ts` pass_

- [ ] 9. Render the Deferrals page as the queue with Resolve
  - File: src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx
  - File: e2e/worktree-shell.spec.ts
  - File: e2e/worktree-visual.spec.ts
  - Test: e2e/worktree-shell.spec.ts — `page.getByTestId('deferral-resolve-confirm-<id>').click()`
  - kind: e2e
  - Note: `deferral-row-` ids stay, so `e2e/worktree-project-list.spec.ts:61-63` and the push path (requirement 6 AC 6) are regression guards. The server half of Resolve is task 8's red test.
  - Purpose: One table of open records, oldest first, each with Resolve.
  - _Leverage: src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:54-57, src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:211, src/dashboard_frontend/vite.config.ts:27-46, e2e/worktree-shell.spec.ts:262-288_
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.7, 7.8, 7.9_
  - _Prompt: Task: Per design C10 and design D22 (requirement 6, requirement 7 AC 1 to AC 3, AC 7 to AC 9), rewrite `DeferralsPage.tsx` with the columns, sort, Resolve box and test ids design C10 pins, posting to the route task 8 adds; keep `data-testid="page-list"` on the page root (D27) and render a non-empty owner as a neutral `Pill` (D28). Replace the owner-chip case (`e2e/worktree-shell.spec.ts:262-288`) with the queue and Resolve cases; the visual Deferrals view waits for a row, no panel. Run `npx playwright install chromium` first | Restrictions: No chips, search, pager or panel; never assert a row's absence before its settling signal | Success: three open rows show oldest first with age, id, project, spec, tag, owner and summary in that order; `matthew` shows in its owner cell; no `chip-` test id exists; Cancel closes the box and the file stays `deferred`; the confirm is disabled with empty text; confirm with text writes `status: resolved` and the text, and after the row count drops to 2 (the `deferrals-update` settling signal) the file is asserted; a routed 409 shows its `error`, keeps the typed text and the box open; with every project toggled off the page shows `Queue empty`, and the toggles are turned back on before the case ends; `npx vitest run src/dashboard/__tests__/frontend-build.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-visual.spec.ts e2e/worktree-project-list.spec.ts` pass_

- [ ] 10. Remove the dead routes, builders, types and components
  - File: src/dashboard/multi-server.ts
  - File: src/dashboard/shell/spec-rows.ts
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard/shell/usage-rows.ts
  - File: src/dashboard/shell/__tests__/usage-rows.test.ts
  - File: src/dashboard/shell/__tests__/spec-rows.test.ts
  - File: src/dashboard/__tests__/shell-routes.test.ts
  - File: src/dashboard/__tests__/frontend-style-scan.test.ts
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/UsageTrend.tsx
  - File: src/dashboard_frontend/src/modules/shell/PageLayout.tsx
  - File: src/dashboard_frontend/src/modules/shell/primitives.tsx
  - File: e2e/worktree-shared.spec.ts
  - Note: deletion task: no `- Test:` seam, implementer-only. Its checks are its pass criterion.
  - Purpose: No code is left that no page uses.
  - _Leverage: src/dashboard/multi-server.ts:32-34, src/dashboard/multi-server.ts:161-163, src/dashboard/multi-server.ts:609-643, src/dashboard/__tests__/frontend-style-scan.test.ts:448-466, e2e/worktree-shared.spec.ts:399-414_
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Prompt: Task: Per design C7 "Deleted", C3 "Deletions in this file", C11, C12 and design D12, D23 (requirement 8 AC 1 to AC 5), delete the spec detail and closed-specs routes, `usageCache` and the imports at `src/dashboard/multi-server.ts:32-34`; `buildSpecDetail`, `parseDecomposition`, `buildRuns`, `listTopLevelFiles`, `SPEC_NAME_RE`, `VERSION_RE` and any helper left unused; both copies of `SpecDetail` and `UsageSpecRow`; `usage-rows.ts` and its test; `UsageTrend.tsx`, `PageLayout.tsx` and `primitives.tsx`; the `buildSpecDetail` suite, the detail and closed-specs route cases, and the series suite at `src/dashboard/__tests__/frontend-style-scan.test.ts:448-466` with its header comment. Point `e2e/worktree-shared.spec.ts:399-414` at `GET /api/projects/:projectId/harness/setup` and assert each project's `specs` names the shared spec | Restrictions: Keep `isSpecClosed`, `timeOf`, `newestBy`, `firstStatusValue` | Success: `grep -rn "buildSpecDetail\|buildUsageRows\|UsageSpecRow\|SpecDetail\|UsageTrend\|PageLayout\|primitives\|closed-specs" src --include='*.ts' --include='*.tsx' --exclude-dir=__tests__` finds nothing; `npx tsc --noEmit`, `npx vitest run src/dashboard/shell/__tests__/spec-rows.test.ts src/dashboard/__tests__/shell-routes.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts src/dashboard/__tests__/frontend-build.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shared.spec.ts` pass_

- [ ] 11. Run the end-to-end verification
  - File: e2e/worktree-shell.spec.ts
  - Note: verification task: no `- Test:` seam, implementer-only; it changes no file. Requirement 3 AC 6 and requirement 8 AC 7 hold at base: `src/tools/__tests__/harness.test.ts` and `src/tools/__tests__/spec-index.test.ts` are their regression guards.
  - Purpose: Prove the entry's four verification steps on the merged tree.
  - _Leverage: ./playwright.worktree.config.ts, src/tools/__tests__/harness.test.ts, src/tools/__tests__/spec-index.test.ts_
  - _Requirements: 3.6, 8.6, 8.7_
  - _Prompt: Task: Run the full checks and confirm the entry's verification steps 1 to 4 map onto the cases tasks 4, 5, 6, 7, 8, 9 and 10 added | Restrictions: Change no file; when a check fails, report it with the DESIGN-DEFECT flag naming the task whose files fail | Success: `npm run build`, `npm test`, `npx vitest run src/tools/__tests__/harness.test.ts src/tools/__tests__/spec-index.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-shell.spec.ts e2e/worktree-visual.spec.ts e2e/worktree-board.spec.ts e2e/worktree-shared.spec.ts e2e/worktree-no-shared.spec.ts e2e/worktree-project-list.spec.ts` pass; `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx` does not exist_

## Decisions taken in this document

- D27 — The rewritten Specs and Deferrals pages keep the existing list test id on their root: options were a new root id per page, or keep the old one; chosen because the no-sideways-scroll case and the board overflow case then need no edit for those two pages.
- D28 — A non-empty owner on the Deferrals page renders as a neutral pill: options were plain text, or a neutral pill; chosen because the visual suite's pill-parity case needs a pill on a second view once the Specs page is the only other page with pills, and a neutral tone keeps colour for state only.
- D29 — The visual suite's style-parity case stops checking the row kind: options were keep a row component alive on two pages, or drop the kind; chosen because the shared row component is deleted with the page primitives and no page renders a selectable row any more.
- D30 — Each end-to-end suite that asserts Specs lines seeds its own decomposition file before its servers start: options were seed one in the shared worktree harness for every suite, or per suite; chosen because a decomposition file in every fixture would change the launchable spec that other suites read.
- D31 — Each page's wire change, frontend page and end-to-end edits land in one task: options were all end-to-end edits in one final task, or one task per page; chosen because a wire change with no frontend update leaves the page empty and its suites red between tasks.
- D32 — The Deferrals page task routes implementer-only with the end-to-end marker: options were a test author writing a red Playwright case, or the marker; chosen because its only test is a Playwright suite and the Resolve behaviour already has its red test in the route task.
- D33 — The old Specs rows builder and its row type are deleted in the feed task, the detail and usage routes in the removal task: options were delete everything in the removal task, or delete each symbol with its last caller; chosen because the feed task removes the rows builder's only caller, while the detail route keeps its own caller until the removal task.

## Scope notes

- Carried items from design: none.
- Added beyond the design's end-to-end list, because they assert the old pages: `e2e/worktree-board.spec.ts:3580` (the Usage marker), the row kind of the visual parity case (`e2e/worktree-visual.spec.ts:415`), and `e2e/helpers/shell-seed.ts` (the visual fixture needs a decomposition file).
- No ESLint check is listed: the repository has no ESLint binary, config or `package.json` entry, so the standing ESLint rule has nothing to run.
- `docs/dashboard-ideation-brief.md` names the deleted routes; it is an ideation record, not current documentation, and stays unchanged.
- Cut: nothing.

## Revision History

- **v1** (2026-11-14) — Initial draft.
