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
