# Tasks Document

Document version: v2

Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 → 5; 2 → 3 → 4; 6 → 7, 6 → 8 and 7, 8 → 9; 6 → 10 → 11 → 12; task 13 runs last. Server tasks (1-9) come before the view (10-12), so the view reads real routes. Each task leaves `npx tsc --noEmit` and every vitest suite green; tsc does not cover `src/dashboard_frontend/` (`./tsconfig.json:20`), so frontend tasks prove their code through vitest dynamic imports and Playwright. Line citations are to base bb6d32ff; where an earlier task here edited the file, the named symbol is the anchor and the implementer re-resolves the line. If SPEC_WORKFLOW_SHARED_ROOT is set in the session, run vitest as `env -u SPEC_WORKFLOW_SHARED_ROOT -u SPEC_WORKFLOW_WORKSPACE npx vitest run …`. Tasks 2, 7, 8, 10 and 11 add new modules, so expect at least five verifier spawns. Tasks 6 and 13 carry no `- Test:` seam and route implementer-only.

- [ ] 1. Add the evidence fields to the wait record
  - File: src/controller/state.ts
  - File: src/controller/waits.ts
  - File: src/controller/__tests__/waits.test.ts
  - Test: src/controller/__tests__/waits.test.ts — `createWait(input)`
  - Test: src/controller/__tests__/waits.test.ts — `listWaitsForWire()`
  - Note: `waits.test.ts` keeps every asserted value; a wait created with neither field reads back unchanged (regression guard).
  - Purpose: The wait holds the worker report, the review and the task's commits.
  - _Leverage: src/controller/state.ts:207-226, src/controller/waits.ts:52-62, src/controller/waits.ts:98-118, src/controller/waits.ts:241-243_
  - _Requirements: 2.1, 2.12_
  - _Prompt: Task: Per design C1 (requirement 2 AC 1, AC 12), add `detail?: string` and `commits?: string[]` to `WaitRecord` (`src/controller/state.ts:207-226`) and `CreateWaitInput` (`src/controller/waits.ts:52-62`). `createWait` (`:98-118`) copies `detail` when present and `commits` when non-empty, as it copies `proposals` (`:114`). `listWaitsForWire` (`:241-243`) strips `commits` as well as `specDir`, and its return type omits both | Restrictions: Add no other record field; do not change `answerWait` here (a later task does) | Success: a wait created with `detail` and `commits` reads back with both; a wait created with an empty `commits` array stores no `commits` key; a wait created with neither has no `detail` or `commits` key (regression guard); `listWaitsForWire` returns the wait with `detail` and with no `commits` or `specDir`; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/waits.test.ts` pass_

- [ ] 2. Build the ruling detail module
  - File: src/controller/ruling-detail.ts
  - File: src/controller/__tests__/ruling-detail.test.ts
  - Test: src/controller/__tests__/ruling-detail.test.ts — `buildRulingDetail(report, review)`
  - Test: src/controller/__tests__/ruling-detail.test.ts — `capPart(text, cap)`
  - Test: src/controller/__tests__/ruling-detail.test.ts — `rulingCommits(red, later)`
  - Purpose: One pure place that formats and caps the detail and orders the commits.
  - _Leverage: src/types.ts:242-251, src/types.ts:297-308_
  - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8_
  - _Prompt: Task: Per design C2 "New pure module" (requirement 2 AC 4 to AC 8), create `src/controller/ruling-detail.ts` with `DETAIL_REPORT_CAP`, `DETAIL_REVIEW_CAP`, `capPart`, `renderReview`, `buildRulingDetail` and `rulingCommits` exactly as design C2 pins them; `renderReview` takes a `TaskReview` (`src/types.ts:297-308`) with `ReviewFinding` entries (`src/types.ts:242-251`) | Restrictions: Pure module: no fs, no git, no imports beyond types | Success: `capPart` returns the text unchanged at exactly the cap; one character over the cap gives the first `cap` characters, a newline and `[1 characters dropped]`; far over the cap names the full dropped count; `renderReview` prints `v<version> — <verdict>`, the summary, and per finding `- [<severity>] <title>` with ` (<file>:<line>)`, ` (<file>)` when there is no line, nothing when there is no file, and the description on the next line; `buildRulingDetail` returns `undefined` with neither part, only `## Worker report` with a report, only `## Task review` with a review, and both in that order with a blank line between; the report is capped at 12,000 and the review at 8,000 characters; `rulingCommits` puts the red commit first, leaves it out when undefined, and drops a later duplicate keeping order; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/ruling-detail.test.ts` pass_

- [ ] 3. Put the evidence on the implementation outcome
  - File: src/controller/phases/implementation.ts
  - File: src/controller/phases/__tests__/implementation.test.ts
  - Test: src/controller/phases/__tests__/implementation.test.ts — `runImplementationPhase(ctx)`
  - Note: the cases at `src/controller/phases/__tests__/implementation.test.ts:842-873` keep every asserted value. The gate-tool stop (`src/controller/phases/implementation.ts:843-844`) is covered by the same wrapper; it needs no case of its own (D5).
  - Purpose: Every stop made while a task is picked names the task and carries its evidence.
  - _Leverage: src/controller/phases/implementation.ts:124-144, src/controller/phases/implementation.ts:649-669, src/controller/phases/implementation.ts:703-704, src/controller/phases/implementation.ts:777-795, src/controller/phases/implementation.ts:945-947, src/core/task-review-manager.ts:182-185_
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.11_
  - _Prompt: Task: Per design C2 and design D2, D3 (requirement 2 AC 2 to AC 7), add `detail?` and `commits?` to `ImplementationPhaseOutcome` (`src/controller/phases/implementation.ts:124-144`). Rename the body of `runTask` (`:649-952`) to an inner step function with a local evidence object; the new `runTask` wraps it and, on `design-defect`, `escalate` or `error`, adds `task`, `commits` and `detail` from the functions task 2 exports, reading the latest review through `TaskReviewManager` on `ctx.specDir` (a throw reads as no review). Set the commits getter right after `taskCommits` (`:668-669`) and the report before the SEAM-DEFECT stop (`:703-704`) and each `if (flagged) return flagged` (`:787-788`, `:945-947`) | Restrictions: Do not change `stop` (`:566-578`), `routeImplementerFlags` (`:960-1005`) or any report schema (`:152-182`); an error stop still does not reset the task to pending | Success: a DESIGN-DEFECT flag gives an outcome with `task` `1`, `commits` equal to the task's commits since pick, and `detail` starting `## Worker report` and holding the flag text; an ESCALATE flag gives the same three fields; a SEAM-DEFECT stop's `commits` start with the red commit; the never-logged `error` stop carries `task` and `commits` and no `detail`, and the task stays in progress; a seeded task review adds `## Task review` with its verdict and summary after the worker report; a `complete` outcome has no `detail` or `commits` (regression guard); `npx tsc --noEmit` and `npx vitest run src/controller/phases/__tests__/implementation.test.ts` pass_

- [ ] 4. Write the evidence into the ruling and error waits
  - File: src/controller/runs.ts
  - File: src/controller/__tests__/runs.test.ts
  - Test: src/controller/__tests__/runs.test.ts — `runOnce(deps, runId)`
  - Note: `runs.test.ts` keeps every asserted value. The security wait carrying neither field holds at base: regression guard (requirement 2 AC 10).
  - Purpose: The driver stores the outcome's evidence in the wait it opens.
  - _Leverage: src/controller/runs.ts:622-631, src/controller/runs.ts:1242-1309, src/controller/__tests__/runs.test.ts:1451-1467_
  - _Requirements: 2.9, 2.10_
  - _Prompt: Task: Per design C3 (requirement 2 AC 9, AC 10), give `waitAnd` (`src/controller/runs.ts:622-631`) a trailing optional evidence argument passed to `createWait`. In `handleImplementationOutcome` (`:1242-1309`) the ruling wait (`:1259-1271`) and the final `error` wait (`:1303-1307`) pass the outcome's `detail` and `commits`, and the `error` question gains `task: outcome.task` when set. Drive the cases through `runOnce` with a scripted worker, as the cancel case at `src/controller/__tests__/runs.test.ts:1451-1467` does | Restrictions: The security wait (`:1283-1289`), the document escalation (`:1359-1364`) and every other `waitAnd` caller pass no evidence; do not change `escalationRulings` (`:1188-1204`) | Success: a DESIGN-DEFECT flag opens an `escalation` wait whose record holds `detail` and `commits` and whose `ruling` question carries the task tag; a never-logged `error` raised again after the fresh retry opens an `error` wait whose record holds `commits` and whose `error` question carries `task` `1`; the security wait holds neither field (regression guard); `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/runs.test.ts` pass_

- [ ] 5. Take a note with an answer and write the ruling receipt
  - File: src/controller/waits.ts
  - File: src/dashboard/multi-server.ts
  - File: src/controller/__tests__/waits.test.ts
  - File: src/dashboard/__tests__/controller-waits-routes.test.ts
  - Test: src/controller/__tests__/waits.test.ts — `answerWait(id, answers, by, note)`
  - Test: src/dashboard/__tests__/controller-waits-routes.test.ts — `POST /api/controller/waits/:id/answer` with `note`
  - Note: the exact-value assertions at `src/controller/__tests__/waits.test.ts:106-152` and the route cases at `src/dashboard/__tests__/controller-waits-routes.test.ts:108-169` do not change: they send no note.
  - Purpose: The receipt and the ledger keep the ruling and the note.
  - _Leverage: src/controller/waits.ts:127-155, src/controller/waits.ts:260-309, src/dashboard/multi-server.ts:701-715, src/advisor/actions.ts:145-154_
  - _Requirements: 6.5, 6.6, 6.7_
  - _Prompt: Task: Per design C4 and requirements D1 (requirement 6 AC 5 to AC 7), give `answerWait` (`src/controller/waits.ts:127-155`) an optional trailing `note`. Gate waits render as today plus a last `Notes: <note>` line when sent. `escalation` and `error` waits write a new section headed `## <kind> <wait id>` through `upsertSection` (`:295-302`) as design C4 pins it. `noteText` (`:305-309`) appends `; note: <note>`. The answer route (`src/dashboard/multi-server.ts:701-715`) reads a string `note`, trims it, and passes it on only when non-empty | Restrictions: Do not store the note on the record; `checkAnswerKeys` (`src/advisor/actions.ts:145-154`) still sees only `answers`; `retro-plan` still writes no receipt | Success: an escalation answered with a note writes `## escalation <id>` holding the question text, `Task: <id>` when tagged, `Answer: <value>` and `Notes: <note>`; an `error` wait writes `## error <id>` the same way; a second escalation wait keeps the first wait's section; a gate wait answered with a note adds `Notes: <note>`; the ledger `note` row ends with `; note: <note>`; a gate answer with no note writes the receipt and row unchanged (regression guard); the route with `note` answers 200 and the receipt carries it; a blank `note` writes no `Notes:` line; `note` is never refused as an unknown answer key; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/waits.test.ts src/dashboard/__tests__/controller-waits-routes.test.ts` pass_

- [ ] 6. Update the wire types
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - Note: schema-only guard task: no `- Test:` seam, implementer-only. Its checks are its pass criterion.
  - Purpose: Both hand copies carry the new fields and the two route shapes.
  - _Leverage: src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91_
  - _Requirements: 2.12_
  - _Prompt: Task: Per design C7 and design Data Models (requirement 2 AC 12), add `task?: string` to `ControllerWaitQuestion` and `detail?: string` to `ControllerWait` in both `src/dashboard/shell/types.ts:57-95` and `src/dashboard_frontend/src/modules/shell/types.ts:53-91`, and add `WaitTaskRow`, `WaitDiff`, `DiffCommit`, `DiffFile` and `DiffHunk` to both, the same text in each | Restrictions: Neither copy gains `commits`; change no existing field | Success: the two copies hold the same new declarations; `npx tsc --noEmit`, `npx vitest run src/dashboard/shell/__tests__/shell-feed.test.ts src/dashboard/shell/__tests__/board-view.test.ts` pass_

- [ ] 7. Build the task row reader
  - File: src/dashboard/shell/ruling-rows.ts
  - File: src/controller/phases/implementation.ts
  - File: src/dashboard/shell/__tests__/ruling-rows.test.ts
  - Test: src/dashboard/shell/__tests__/ruling-rows.test.ts — `riskFromLedger(ledgerText, taskId)`
  - Test: src/dashboard/shell/__tests__/ruling-rows.test.ts — `readTaskRow(specDir, taskId)`
  - Purpose: The task row is read live from `tasks.md` and the gate note.
  - _Leverage: src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/controller/phases/implementation.ts:256-259, src/controller/phases/implementation.ts:848_
  - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - _Prompt: Task: Per design C5 and design D8, D9 (requirement 3 AC 2, AC 3, AC 5), create `src/dashboard/shell/ruling-rows.ts` with `riskFromLedger` and `readTaskRow` as design C5 pins them, returning the `WaitTaskRow` type task 6 adds. Export `isTddMarked` (`src/controller/phases/implementation.ts:256-259`) with its body unchanged and use it | Restrictions: Read only `tasks.md` and `harness-events.jsonl` under the given spec dir; the row holds no path but the task's own `Files` entries | Success: `riskFromLedger` returns the risk of the newest matching gate note; ignores notes for another task id (task `1` does not match a `gate: task 12` note); skips a torn line; returns `null` with no note; `readTaskRow` returns `ok` with id, title, the `Success` text, `tdd` true for a task with a `Test:` line, `risk` and `files`; `tdd` is false for a block marked `kind: e2e`; `success` is `null` with no `Success` section; an absent id and a missing `tasks.md` each give `not-found` with the id; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/ruling-rows.test.ts` pass_

- [ ] 8. Build the diff reader
  - File: src/dashboard/shell/wait-diff.ts
  - File: src/dashboard/shell/__tests__/wait-diff.test.ts
  - Test: src/dashboard/shell/__tests__/wait-diff.test.ts — `parseShow(text)`
  - Test: src/dashboard/shell/__tests__/wait-diff.test.ts — `capDiff(commits)`
  - Test: src/dashboard/shell/__tests__/wait-diff.test.ts — `readWaitDiff(wait, run, opts)`
  - Note: the `readWaitDiff` cases run on a real temp git repo.
  - Purpose: The task's diff is read from git on each request, capped and path-free.
  - _Leverage: src/core/git-utils.ts:45-51, src/controller/phases/implementation.ts:374-378_
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10_
  - _Prompt: Task: Per design C6 and design D4, D5 (requirement 4 AC 2 to AC 8, AC 10), create `src/dashboard/shell/wait-diff.ts` with `readWaitDiff`, `parseShow` and `capDiff` exactly as design C6 pins them, returning the `WaitDiff` type task 6 adds. git runs through `execFile` with an argument array, `cwd` the worktree, `scrubbedGitEnv()` (`src/core/git-utils.ts:45-51`) and one shared time budget | Restrictions: No shell string; no cache; no write | Success: `parseShow` reads hash and subject, an added, a removed and a context line, skips a `\` line, and marks a binary file; `capDiff` keeps hunks for 60 files and lists the 61st under overflow with its count, keeps 400 lines of a longer file with `droppedLines` the rest, and moves files to overflow while the JSON is over 512 KiB; `readWaitDiff` gives `ok` with the commit's short hash, subject and added lines; a rewritten hash is listed not found while the other commit renders; an invalid hash never reaches git and is listed not found; no run gives `run-gone`; no commits gives `no-commits`; a missing worktree gives `worktree-gone`; `timeoutMs: 1` gives `unreadable` whose `error` holds no absolute path; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/wait-diff.test.ts` pass_

- [ ] 9. Add the task row and diff routes
  - File: src/dashboard/multi-server.ts
  - File: src/dashboard/__tests__/controller-waits-routes.test.ts
  - Test: src/dashboard/__tests__/controller-waits-routes.test.ts — `GET /api/controller/waits/:id/task`
  - Test: src/dashboard/__tests__/controller-waits-routes.test.ts — `GET /api/controller/waits/:id/diff`
  - Note: the route cases at `src/dashboard/__tests__/controller-waits-routes.test.ts:93-169` keep every asserted value.
  - Purpose: The view reads the row and the diff without the spec dir path.
  - _Leverage: src/dashboard/multi-server.ts:45, src/dashboard/multi-server.ts:693-735, src/controller/state.ts:414-416_
  - _Requirements: 2.12, 3.4, 4.1, 4.10, 4.11_
  - _Prompt: Task: Per design C5, C6 and design D1 (requirement 3 AC 4, requirement 4 AC 1, AC 11), add `GET /api/controller/waits/:id/task` and `GET /api/controller/waits/:id/diff` beside the wait routes (`src/dashboard/multi-server.ts:693-735`). Both read the record with `readWait` (`:45`); the task route calls the reader task 7 exports with the first question's `task`, the diff route calls the reader task 8 exports with the run from `readRun` (`src/controller/state.ts:414-416`) | Restrictions: No auth exemption; no response field holds `specDir` or the worktree path | Success: each route answers 404 `wait-not-found` for an unknown id; the task route answers `no-task` for an untagged wait, `ok` with the row for a tagged wait whose spec dir holds `tasks.md`, and `not-found` for an id missing from it, and no response contains the spec dir path; the diff route answers `run-gone` with no run record and `no-commits` for a wait with none; each route answers 401 without a session; the waits list carries no `commits` or `specDir`; `npx tsc --noEmit` and `npx vitest run src/dashboard/__tests__/controller-waits-routes.test.ts` pass_

- [ ] 10. Build the view's pure rules and the answer stage
  - File: src/dashboard_frontend/src/modules/shell/ruling.ts
  - File: src/dashboard_frontend/src/modules/shell/stage.ts
  - File: src/dashboard/shell/__tests__/ruling-view.test.ts
  - Test: src/dashboard/shell/__tests__/ruling-view.test.ts — `answerPayload(wait, picks, texts, notes)`
  - Test: src/dashboard/shell/__tests__/ruling-view.test.ts — `resolved(stage, seen)` for `answer`
  - Note: `board-view.test.ts` keeps every asserted value; its local stage-name type at `src/dashboard/shell/__tests__/board-view.test.ts:1624` needs no edit.
  - Purpose: The layout choice, the form rules and the stage rule live in pure code.
  - _Leverage: src/dashboard_frontend/src/modules/shell/stage.ts:13, src/dashboard_frontend/src/modules/shell/stage.ts:73-96, src/dashboard/shell/__tests__/board-view.test.ts:19-33, src/controller/runs.ts:1285-1287_
  - _Requirements: 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.9, 6.11_
  - _Prompt: Task: Per design C8 "New pure module", C9 and design D6, D7, D10 (requirement 6 AC 2 to AC 5, AC 9, AC 11), create `ruling.ts` with `rulingLayout`, `initialValues`, `answerOf`, `canSubmit`, `answerPayload`, `securityLines` and `offersAbandon` as design C8 pins them. Add `'answer'` to `StageName` (`src/dashboard_frontend/src/modules/shell/stage.ts:13`) and its `resolved` case (`:73-96`). Load both modules by dynamic import, as `src/dashboard/shell/__tests__/board-view.test.ts:19-33` does | Restrictions: Type-only imports in `ruling.ts`; no React; do not change `responseStage` or `advance` | Success: `rulingLayout` gives `security`, `task`, `taskless`, `gate`, `retro-plan`, `merge` and `question` for one wait each; `initialValues` gives `recommended`, else empty; `canSubmit` is false with an unpicked radio, false with an empty `ruling` text, true when every radio is picked; `answerOf` prefers non-empty text over the pick on a free question with options; `answerPayload` appends a blank line, `Notes: ` and the notes to the first typed answer, puts notes in `note` when every answer is a pick, and adds `proposal:` keys for `retro-plan`; `securityLines` splits lead, findings and tail; `offersAbandon` is true only for an escalation or error with no `abandon` option; `resolved` for `answer` is true with the run gone or not `waiting`, false while `waiting`; `npx vitest run src/dashboard/shell/__tests__/ruling-view.test.ts src/dashboard/shell/__tests__/board-view.test.ts` passes_

- [ ] 11. Render the ruling view in place of the answer sheet
  - File: src/dashboard_frontend/src/modules/shell/RulingView.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx
  - File: e2e/worktree-ruling.spec.ts
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-ruling.spec.ts — `tile.getByRole('button', { name: 'Answer', exact: true }).click()`
  - Note: `AnswerSheet.tsx` is deleted. The cases at `e2e/worktree-board.spec.ts:699-835` keep every asserted value: the board swap, the link and the return are regression guards (requirement 1 AC 1, AC 7). Only the comment at `:697` changes.
  - Purpose: One screen per wait, every kind laid out for its decision.
  - _Leverage: src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:45-78, src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:210-260, src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/board.ts:152-163, e2e/worktree-board.spec.ts:47-106_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.5, 3.6, 4.5, 4.7, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.8, 6.9, 6.10_
  - _Prompt: Task: Per design C8 and design D12, create `RulingView.tsx` rendering header, body by layout and form as design C8 pins them, using the rules task 10 exports and fetching the two routes task 9 adds. `HomePage` (`src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171`) renders it in place of the sheet and passes `tick` as `now`. Bridge: pass `stage={null}` and have `onAnswer` press key `wait:<id>` with the stage name task 10 adds; task 12 removes the bridge. Delete `AnswerSheet.tsx`. Seed runs `waiting` with `pauseRequested` (design D11). Run `npx playwright install chromium` first | Restrictions: Only token classes the shell already uses; no file link; no `/tmp/scratchpad` read | Success: a tagged escalation shows the header (kind, project, spec, wait id, age, run id, phase, step, `task 1`), the wait text, the task row with title, Success, TDD, the gate-note risk and every file, the detail as preformatted text, and the fixture commit's added line, with no `band-needs-you` once `now-answer-sheet` is visible; a wait whose run is gone shows `run record gone`; a gate-B wait shows `Approve` checked with `(recommended)` and `The plan`; a merge wait shows the PR number, `Merge` and `Hold`; a security wait shows three unchecked radios and a disabled `answer-submit`; a taskless escalation shows `no task: raised in the` and its phase; a removed worktree shows `worktree gone` and `answer-submit` enables once a ruling is typed; `grep -rn AnswerSheet src e2e` finds nothing; `npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts`, `npx playwright test -c playwright.worktree.config.ts e2e/worktree-ruling.spec.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_

- [ ] 12. Keep the view on the answered wait until the run moves
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: src/dashboard_frontend/src/modules/shell/RulingView.tsx
  - File: e2e/worktree-ruling.spec.ts
  - Test: e2e/worktree-ruling.spec.ts — `page.getByTestId('answer-submit').click()`
  - Note: the run leaving `waiting` and the tile moving to Running hold at base (`src/controller/controller.ts:671-673`, `src/dashboard_frontend/src/modules/shell/board.ts:34-52`): regression guards. The case at `e2e/worktree-board.spec.ts:770` still passes: its run is absent, so the stage resolves at once.
  - Purpose: The operator sees the answer land before the board returns.
  - _Leverage: src/dashboard_frontend/src/modules/shell/useStages.ts:24-49, src/dashboard_frontend/src/modules/shell/stage.ts:55-70, src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171_
  - _Requirements: 1.7, 6.4, 6.5, 6.6, 6.8, 6.11, 6.12, 6.13, 6.14_
  - _Prompt: Task: Per design C9 and design D10 (requirement 6 AC 11, AC 12), make `HomePage` keep a snapshot of the open wait and show it while `stages.stages` holds `wait:<id>`; pass `stages.retained(key, { run })`; clear the open wait when that stage is `done`; `Back to board` clears the stage too. Remove task 11's `stage={null}` bridge | Restrictions: Do not change `useStages`, `advance` or `responseStage` | Success: typing a ruling and a note and pressing answer writes the wait answer with `by` `operator`, the ruling, a blank line and `Notes: ` plus the note, and a `questions.md` section `## escalation <id>` holding both; after `band-needs-you` is visible again the wait tile has count 0 and the run tile is in `band-running`; an answer request routed to fail with 500 shows `failed:` in `answer-stage`, keeps the typed ruling and note, and leaves `answer-submit` enabled; a gate wait answered with a picked option and a note sends the option alone and the receipt carries `Notes:`; `npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts`, `npx playwright test -c playwright.worktree.config.ts e2e/worktree-ruling.spec.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_

- [ ] 13. Run the end-to-end verification
  - File: e2e/worktree-ruling.spec.ts
  - Note: verification task: no `- Test:` seam, implementer-only; it changes no file. Requirement 6 AC 13 holds at base; the case at `src/controller/phases/__tests__/implementation.test.ts:857-873` is its regression guard.
  - Purpose: Prove the entry's five verification steps on the merged tree.
  - _Leverage: src/controller/phases/__tests__/implementation.test.ts:857-873, ./playwright.worktree.config.ts:67_
  - _Requirements: 1.1, 2.9, 4.5, 6.6, 6.13, 6.14_
  - _Prompt: Task: Run the full checks for the spec and confirm the entry's verification steps 1-5 map onto the cases tasks 3, 4, 11 and 12 added | Restrictions: Change no file; when a check fails, report it with the DESIGN-DEFECT flag naming the task whose files fail | Success: `npm run build`, `npm test`, `npx playwright test -c playwright.worktree.config.ts e2e/worktree-ruling.spec.ts e2e/worktree-board.spec.ts` and `npx vitest run src/controller/phases/__tests__/implementation.test.ts` pass; `grep -rn "scratchpad" src/dashboard_frontend/src/modules/shell/RulingView.tsx src/dashboard/shell/ruling-rows.ts src/dashboard/shell/wait-diff.ts` finds nothing_

## Decisions taken in this document

- D1 — Server tasks come before the view: the options were the view first on stubbed routes, or the server first; chosen because the view tasks then read real routes and need only one bridge.
- D2 — The wire types are a separate guard task with no test seam: the options were folding them into a route task or a guard task; chosen because they are pure shape, cannot fail red, and three later tasks need them.
- D3 — Both read routes land in one task after their two readers: the options were one task per route or one for both; chosen because they share the record read, the auth case and one test file.
- D4 — The view and the answer retention are two tasks joined by a null-stage bridge: the options were one large view task or two; chosen because the retention has its own red test and one task would exceed the size cap.
- D5 — The gate-tool error stop gets no case of its own: the options were a case per error stop or one named stop; chosen because the design wrapper covers every return site, and the never-logged stop proves an error stop carries the task.
- D6 — No ESLint check in any Success clause: the options were adding the ESLint binary check or omitting it; chosen because this repo has no ESLint binary, config or script, so the check cannot run.
- D7 — The retention's red case fails the answer request on purpose: the options were asserting the short-lived done stage or a routed failure; chosen because the done stage clears as soon as the run moves, while a failed stage stays until the next press.
- D8 — The end-to-end verification is its own implementer-only task: the options were folding it into the last view task or a final task; chosen because its pass criterion is the full build, unit and browser runs, which no red test can precede.

## Scope notes

- Carried from design: none.
- Nothing the decomposition entry lists is cut or deferred. Deferred as in requirements and design: a deep link to the view, a document-phase `detail`, and any change to worker roles or report schemas.
- The standing rule to add the ESLint binary to every Success clause does not apply here: the repo has no ESLint (D6).

## Revision History

- **v2** (2026-11-08) — Drafting-only corrective pass.
  - **R1-1 — Accepted (SHOULD_FIX).** Task 7 Success restored the prefix-colliding ledger example, now reading that task 1 must not match a gate note for task 12, so the test author again exercises the design C5 regex boundary — the space after the task id. The three minor notes were left unactioned, as the memory directs. The matching lint skip-regex graduation lives at the citation-identifier check, not in this document, and is owed there.
- **v1** (2026-11-08) — Initial draft.
  - **Lint pass.** 9 fixed (L-1,L-2,L-3,L-5,L-6,L-7,L-8,L-9,L-10). L-1/L-3/L-6/L-7/L-8/L-9 given directory-prefixed paths; `tsconfig.json` → `./tsconfig.json` and swept the sibling bare-root citation `playwright.worktree.config.ts` → `./playwright.worktree.config.ts` on the task 13 _Leverage line (house idiom, per design L-80). The three prose tokens the newly-resolvable `./tsconfig.json:20` would otherwise trip (tsc, bb6d32ff, SPEC_WORKFLOW_SHARED_ROOT) de-ticked on line 5. L-2 dropped the `task 5` token for "a later task" (scope note, not a dependency). L-5 is a false positive — the regex read example ledger text `gate: task 12` as a forward reference; changed the illustrative id to 2. Rejected: L-4 — task 6 is a schema-only guard routed implementer-only (D2; agent-rules routes such tasks with no `- Test:` seam), so the missing Test line is correct, not a defect.
