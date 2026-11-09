# Codebase context — dashboard-ruling-view

## Wait records (controller state)
- src/controller/state.ts:25-36 — `StepCursor`, the run's phase, task and step kind.
- src/controller/state.ts:80-123 — `RunRecord`: `worktree`, `branch`, `phase`, `cursor`, `prReads`.
- src/controller/state.ts:133-152 — `PrRead`: number, url, ci, mergeable, verdict, reasons.
- src/controller/state.ts:154-163 — `WaitKind` and `WaitState`.
- src/controller/state.ts:166-182 — `WaitQuestion`, with the `task` tag on a task ruling.
- src/controller/state.ts:185-190 — `WaitAnswer`: value, by, answered.
- src/controller/state.ts:207-226 — `WaitRecord`, no `detail` or `commits` at base.

## Waits module
- src/controller/waits.ts:44-49 — `ControllerWaitRecord`: adds `specDir` and `proposals`.
- src/controller/waits.ts:52-62 — `CreateWaitInput`.
- src/controller/waits.ts:98-118 — `createWait`.
- src/controller/waits.ts:127-155 — `answerWait`: stores answers; `questions.md` only for gate-a and gate-b.
- src/controller/waits.ts:241-243 — `listWaitsForWire` strips `specDir`.
- src/controller/waits.ts:260-302 — gate section render and upsert into `questions.md`.
- src/controller/waits.ts:305-326 — `noteText` and `appendNote`, the `note` ledger row.

## Gates (document phase)
- src/controller/phases/gates.ts:127-179 — gate A wait; recorded-without-asking lines ride `proposals`.
- src/controller/phases/gates.ts:218-266 — gate B wait; free question with options, plan and veto lines in `proposals`.
- src/controller/phases/gates.ts:274-281 — gate B resume: exact `Approve` proceeds, other text annotates.

## Implementation phase
- src/controller/phases/implementation.ts:114-121 — `operatorRulings` and `securityAnswers` in the phase context.
- src/controller/phases/implementation.ts:124-144 — `ImplementationPhaseOutcome`, carries `task` but no report or commits.
- src/controller/phases/implementation.ts:167-182 — `IMPLEMENTER_SCHEMA`, the flag field.
- src/controller/phases/implementation.ts:256-259 — `isTddMarked`: a `Test:` line and no `kind: e2e`.
- src/controller/phases/implementation.ts:553-559 — `appendRulings`: `## Operator rulings` in a worker brief.
- src/controller/phases/implementation.ts:566-578 — `stop`: task back to pending, phase end, outcome.
- src/controller/phases/implementation.ts:649-670 — `runTask` start, pick head note, `taskCommits` closure.
- src/controller/phases/implementation.ts:671-725 — test author step, SEAM-DEFECT stop, red commit.
- src/controller/phases/implementation.ts:740-753 — `hasRulings` forces a fresh implementer after a ruling.
- src/controller/phases/implementation.ts:777-796 — implementer attempts, `routeImplementerFlags`, never-logged error stop.
- src/controller/phases/implementation.ts:838-848 — gate call and the `gate: task N verdict risk R` ledger note.
- src/controller/phases/implementation.ts:859-875 — P8 file-outside-list design-defect stop, no worker report.
- src/controller/phases/implementation.ts:960-1005 — `routeImplementerFlags`: DESIGN-DEFECT, REQUIRED, ESCALATE.

## Run driver
- src/controller/runs.ts:622-631 — `waitAnd`: creates the wait and parks the run.
- src/controller/runs.ts:1035-1065 — implementation branch of the driver loop.
- src/controller/runs.ts:1188-1204 — `escalationRulings`: answered escalation values, task-tagged.
- src/controller/runs.ts:1211-1223 — `securityAnswers`.
- src/controller/runs.ts:1242-1309 — `handleImplementationOutcome`: ruling, security and error waits.
- src/controller/runs.ts:1359-1364 — document-phase escalation wait (question id `escalation`, no task).
- src/controller/controller.ts:645-676 — `onWaitChange`: exact `abandon` cancels, else the run is queued.
- src/controller/merge.ts:725-745 — merge wait, options merge and hold, exact decision read.

## Task records
- src/core/task-parser.ts:148-169 — `ParsedTask`: description, files, tests, promptStructured; no risk field.
- src/core/task-parser.ts:194 — `parseTasksFromMarkdown`.
- src/core/task-parser.ts:424 — `taskBlock`.
- src/core/task-review-manager.ts:172-185 — `getReviewsForTask`, `getLatestReview`.
- src/tools/get-task-review.ts:44-149 — get-task-review handler over `TaskReviewManager`.
- src/types.ts:242-251 — `ReviewFinding`.
- src/types.ts:297-308 — `TaskReview`: verdict, summary, findings.

## Dashboard server
- src/dashboard/multi-server.ts:693-735 — wait routes: list, answer, advice, second opinion.
- src/advisor/actions.ts:145-154 — `checkAnswerKeys`: refuses answer keys the wait never asked.
- src/dashboard/shell/types.ts:57-95 — server wire copy of `ControllerWait`, no `task` on questions.

## Dashboard frontend (shell)
- src/dashboard_frontend/src/modules/shell/HomePage.tsx:53-171 — Home; open wait replaces the board with Back to board.
- src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:1-323 — the answer sheet to be moved into the ruling view.
- src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:85-90 — `defaultValue`: recommended, else first option.
- src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:200-209 — gate layout; `proposals` not shown for gates.
- src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:261-292 — merge, error and escalation footers; escalation sends `retry`, not the typed text.
- src/dashboard_frontend/src/modules/shell/tiles.tsx:50-99 — `MergeLine` and `WaitTile`.
- src/dashboard_frontend/src/modules/shell/board.ts:21-32 — `needsYou`.
- src/dashboard_frontend/src/modules/shell/board.ts:152-163 — `mergeRead`: the PrRead for a merge wait.
- src/dashboard_frontend/src/modules/shell/types.ts:53-91 — frontend copy of the wait wire shape.
- src/dashboard_frontend/src/modules/shell/types.ts:115-149 — `ControllerRun` wire shape: phase, stepKind, prReads.
- src/dashboard_frontend/src/modules/shell/stage.ts:13-23 — `StageName` and `Stage`; no answer stage.
- src/dashboard_frontend/src/modules/shell/useStages.ts:15-22 — `Stages` hook interface.

## Tests
- src/controller/__tests__/waits.test.ts:1-673 — waits module tests.
- src/controller/__tests__/runs.test.ts — run driver tests.
- e2e/worktree-board.spec.ts:1-3736 — worktree board Playwright suite.

## Implementation phase (design additions)
- src/controller/phases/implementation.ts:356-371 — `runImplementationPhase` start: tasks path, scratch dir, log manager.
- src/controller/phases/implementation.ts:374-378 — `git` and `gitTry` over `execFileSync` with `scrubbedGitEnv`.
- src/controller/phases/implementation.ts:477-517 — `runModelStep`; a non-ok step returns an `error` outcome with no task.
- src/controller/phases/implementation.ts:618-639 — per-task loop: orient, pick the queue head, `runTask`.
- src/controller/phases/implementation.ts:1063-1074 — `complete`: task done, retro entry, spec-store commit.

## Run driver and controller (design additions)
- src/controller/runs.ts:1283-1289 — security escalation wait: question id `security`, options accept, retry, abandon.
- src/controller/runs.ts:1296-1308 — one fresh retry on `error`, then the implementation `error` wait.
- src/controller/controller.ts:660 — a deploy-held run stays `waiting` after an answer.
- src/controller/controller.ts:671-673 — answer patch: `paused` when `pauseRequested`, else `queued`.

## Wait wire and routes (design additions)
- src/dashboard/multi-server.ts:34-47 — server imports: waits, actions, state readers (`readWait`, `listRuns`).
- src/dashboard/multi-server.ts:701-715 — answer route: body `answers` and `by`, `checkAnswerKeys`, `answerWait`.
- src/dashboard/shell/shell-feed.ts:107 — shell push reads `listWaitsForWire`.

## Gates (design additions)
- src/controller/phases/gates.ts:148-159 — gate A defer question: free with options.
- src/controller/phases/gates.ts:229-243 — gate B question: free with options Approve and Annotate.

## Review records and git helpers
- src/core/task-review-manager.ts:33-40 — `TaskReviewManager` over `<specDir>/reviews`.
- src/tools/get-task-review.ts:58 — spec path from project path and spec name.
- src/tools/get-task-review.ts:73 — the tool builds a `TaskReviewManager` on the spec path.
- src/core/git-utils.ts:45-51 — `scrubbedGitEnv`.
- src/tools/review-gate.ts:73-74 — `GateData` gate verdict and risk values.

## Dashboard frontend (design additions)
- src/dashboard_frontend/src/modules/shell/stage.ts:55-70 — `responseStage`: non-2xx to failed with reason.
- src/dashboard_frontend/src/modules/shell/stage.ts:73-96 — `resolved` per stage name.
- src/dashboard_frontend/src/modules/shell/stage.ts:106-123 — `advance`: 30 s running timeout, 5 s done clear.
- src/dashboard_frontend/src/modules/shell/useStages.ts:24-49 — `useStages`: press and retained.
- src/dashboard_frontend/src/modules/shell/harness.tsx:11-24 — `callHarness`.
- src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63 — one-second tick.
- src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171 — `openWait` re-derived; board swap.
- src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:45-78 — `SecondOpinionButton`.
- src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:210-260 — retro-plan proposals checkboxes.
- src/dashboard_frontend/src/modules/shell/board.ts:165-178 — `waitSummary`.
- src/dashboard_frontend/src/modules/shell/board.ts:184-195 — `compactAge`.
- src/dashboard_frontend/src/modules/shell/tiles.tsx:13-16 — wait kind labels.

## Tests (design additions)
- src/controller/phases/__tests__/implementation.test.ts:842-867 — DESIGN-DEFECT and ESCALATE flag cases, `operatorRulings`.
- src/dashboard/__tests__/controller-waits-routes.test.ts:1-169 — wait route tests over a real server.
- src/dashboard/shell/__tests__/board-view.test.ts:19-33 — dynamic import of frontend modules.
- e2e/worktree-board.spec.ts:699-789 — Home answer-sheet cases on `now-answer-sheet`.
- playwright.worktree.config.ts:67 — `SDD_DEPLOY_DISABLED`; the real controller still runs.
