# Requirements Document

## Introduction

The ruling view is one full-width screen, opened from a wait tile, that holds everything the operator needs to answer a controller wait. For a task escalation it shows the wait text, the task row, the stopping worker's report, the task review and the task's diff, then the answer form. It is for the operator, who today must open the scratch folder, the editor and git to rule on a wait.

## Alignment with Product Vision

The steering file `product.md` does not exist in this spec store, so this section aligns with the decomposition entry 33 and the dashboard board plan (decomposition "Dashboard board specs"). That plan wants fewer, larger things on screen and one page per question; the ruling view answers "what do I rule here, and on what evidence". It moves the evidence into the wait record and git, so the dashboard never reads the scratch folder.

## Requirements

### Requirement 1 — The view frame, for every wait kind

**User Story:** As the operator, I want one screen per wait that says what raised it and how long it has waited, so that I know the context before I read the detail.

#### Acceptance Criteria

1. WHEN the operator presses Answer on a wait tile THEN the dashboard SHALL replace the board with the ruling view at full width, with a "Back to board" link above it, and no band of the board SHALL be visible. Invariant (verified, not red-first): this holds at base (`src/dashboard_frontend/src/modules/shell/HomePage.tsx:154-171`).
2. WHEN the view is open THEN its header SHALL show the wait kind, the project name, the spec, the wait id, the age in the display type size (the class the wait tile uses at `src/dashboard_frontend/src/modules/shell/tiles.tsx:90`), the run id, and the run's phase and step kind.
3. WHEN the wait's first question carries a `task` tag THEN the header SHALL also show "task" and that id.
4. IF the wait's run is not in the controller's run list THEN the header SHALL show "run record gone" in place of the phase and step, and the rest of the view SHALL still render.
5. WHEN the view is open THEN the age SHALL update at least once per second without a reload.
6. The view SHALL contain no "open in editor" link and no link to a file path. The dashboard SHALL never read `/tmp/scratchpad/sdd/` for any part of the view.
7. WHEN the wait leaves the open list for any reason other than this view's own answer (answered elsewhere, expired, or its project disabled) THEN the view SHALL return to the board. Invariant (verified, not red-first): `src/dashboard_frontend/src/modules/shell/HomePage.tsx:149-152` re-derives the open wait each render.

### Requirement 2 — The wait record carries the detail and the commits

**User Story:** As the operator, I want the worker's report, the task review and the task's commits stored in the wait, so that the ruling view needs nothing from the scratch folder.

#### Acceptance Criteria

1. `WaitRecord` (`src/controller/state.ts:207-226`) SHALL gain `detail?: string` and `commits?: string[]`, and `CreateWaitInput` (`src/controller/waits.ts:52-62`) SHALL accept both and write them when present.
2. `ImplementationPhaseOutcome` (`src/controller/phases/implementation.ts:124-144`) SHALL gain `detail?: string` and `commits?: string[]`.
3. WHEN the implementation phase returns `design-defect`, `escalate` or `error` while a task is picked (inside the per-task loop) THEN the outcome SHALL carry that task's id in `task` and its commits in `commits`. This includes the error stops that today pass no task, for example the never-logged stop at `src/controller/phases/implementation.ts:795` and the gate-tool stop at `src/controller/phases/implementation.ts:843`.
4. The `commits` list SHALL be the task's red commit, when the test author made one, followed by the hashes `taskCommits` returns at the stop (`src/controller/phases/implementation.ts:668-669`), oldest first, with no duplicates.
5. WHEN a worker step's report caused the stop (an implementer or fix-round flag routed by `routeImplementerFlags` at `src/controller/phases/implementation.ts:960-1005`, or the test author's SEAM-DEFECT at `src/controller/phases/implementation.ts:703-704`) THEN `detail` SHALL hold that worker's full report text: the result text, else the structured report as JSON.
6. WHEN a task review exists for the task (the latest version from `TaskReviewManager.getLatestReview`, `src/core/task-review-manager.ts:182-185`) THEN `detail` SHALL also hold that review's version, verdict, summary and every finding as severity, title, file and line when present, and description.
7. The worker report SHALL come first under the heading "Worker report", the review second under the heading "Task review". IF neither exists THEN `detail` SHALL be absent.
8. The worker report part SHALL be capped at 12,000 characters and the review part at 8,000. A capped part SHALL end with a line naming how many characters were dropped.
9. WHEN `handleImplementationOutcome` (`src/controller/runs.ts:1242-1309`) opens the ruling `escalation` wait or the implementation `error` wait THEN it SHALL write the outcome's `detail` and `commits` into the wait, and the `error` question SHALL carry the outcome's `task` tag when it has one.
10. Waits from the document, merge, retrospective and close-out paths, and the security escalation, SHALL carry neither field. Invariant (verified, not red-first) for every path this spec does not touch.
11. No file under `harness/agents/` or `harness/skills/` and no report schema in `src/controller/phases/implementation.ts:152-182` SHALL change: the worker roles stay as they are.
12. The wire copies of the wait shape (`src/dashboard/shell/types.ts:57-95` and `src/dashboard_frontend/src/modules/shell/types.ts:53-91`) SHALL gain `detail`, `commits` and the question `task` tag. `listWaitsForWire` SHALL still strip `specDir`.

### Requirement 3 — The task section of an escalation or error wait

**User Story:** As the operator ruling on a task, I want the wait text, the task as written, the report and the diff in one order, so that I read the evidence top to bottom before I answer.

#### Acceptance Criteria

1. WHEN the wait is an `escalation` or `error` whose question carries a `task` tag THEN the view SHALL show, in this order: the wait text, the task row, the detail, the diff, then the answer form.
2. The task row SHALL show the task id, its title, the `Success` part of its prompt (`promptStructured`, `src/core/task-parser.ts:148-169`), TDD as "yes" or "no" by the rule of `isTddMarked` (`src/controller/phases/implementation.ts:256-259`), the risk, and every entry of its `Files` list.
3. The risk SHALL be the level in the newest `gate: task N ... risk R` note for that task in the spec's `harness-events.jsonl` (the note written at `src/controller/phases/implementation.ts:848`). IF the task has no such note THEN the row SHALL show "risk not scored yet".
4. The server SHALL read the task row from the spec's `tasks.md` and the ledger when the view opens, not from the wait record. The browser SHALL never receive the spec directory path.
5. IF the tagged task id is not in `tasks.md` THEN the row SHALL read "task N not found in tasks.md" and the detail, diff and form SHALL still render.
6. WHEN `detail` is present THEN the view SHALL show it as preformatted text with line breaks kept. IF it is absent THEN the detail section SHALL read "no worker report or task review".

### Requirement 4 — The diff, read live from git

**User Story:** As the operator, I want the task's changes shown as added and removed lines per file, so that I judge the code without leaving the dashboard.

#### Acceptance Criteria

1. The server SHALL serve `GET /api/controller/waits/:id/diff`. It SHALL answer 404 for an unknown wait id.
2. WHEN the wait has commits and the run's worktree exists THEN the route SHALL run `git show` for each commit in the run's `worktree` and return, per commit (oldest first) its short hash and subject, and per file its repo-relative path and its hunks with each line marked added, removed or context.
3. Each hash SHALL match `^[0-9a-f]{7,40}$` before it reaches git. git SHALL run with an argument array, never a shell string.
4. The response SHALL be capped: at most 60 files with hunks across all commits; at most 400 diff lines per file; at most 512 KiB of JSON. A file cut by the line cap SHALL say how many lines were dropped. Files past the 60th SHALL be listed by path only, with the count of such files. A binary file SHALL be listed as "binary".
5. IF the run's worktree path does not exist THEN the route SHALL answer with state `worktree-gone`, and the view SHALL show "worktree gone" in the diff section.
6. IF a hash is not found in the worktree (for example, a rebase rewrote it) THEN that commit SHALL be listed as "not found in the worktree" and the other commits SHALL still render.
7. IF the run record is gone THEN the route SHALL answer with state `run-gone`. IF the wait has no commits THEN it SHALL answer with state `no-commits` and the view SHALL show "no commits for this task".
8. IF git fails or runs longer than 10 seconds THEN the route SHALL answer with state `unreadable` and the first line of git's error, and the view SHALL show it.
9. In every state of AC 5-8 the answer form SHALL still render and work.
10. The response SHALL contain no absolute path. The diff SHALL be read on every open and SHALL NOT be stored in the wait record or cached on the server.
11. The route SHALL sit under the same global authentication hooks as the other wait routes (`src/dashboard/multi-server.ts:693-735`), with no exemption.

### Requirement 5 — The layout of the other wait kinds

**User Story:** As the operator, I want each wait kind laid out for the decision it asks, so that a gate, a plan, a merge and a security ruling each show what they rest on.

#### Acceptance Criteria

1. WHEN the wait is `gate-a` or `gate-b` THEN the view SHALL show each question's text, its options as radios with the recommended option preselected and marked "(recommended)", and the question's `reason` next to the recommended pick.
2. WHEN a gate question has `free: true` and no options THEN the view SHALL show a text box. WHEN it has `free: true` and options (the gate B question at `src/controller/phases/gates.ts:229-243` and the gate A defer question at `src/controller/phases/gates.ts:148-159`) THEN the view SHALL show the radios and a text box; non-empty text in the box SHALL be the answer in place of the pick.
3. WHEN a `gate-a` wait has `proposals` THEN the view SHALL list them under "Recorded without asking" below the questions. WHEN a `gate-b` wait has `proposals` THEN the view SHALL list them under "The plan" below the question. At base the sheet shows no proposals for a gate (`src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:200-209`).
4. WHEN the wait is `retro-plan` THEN the view SHALL show its questions first, then the proposals as a list of checkboxes, all ticked by default, each with its title and details. Invariant (verified, not red-first): `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:210-260`.
5. WHEN the wait is `merge` THEN the view SHALL show the PR number (a link when the read has an https URL), the CI state, the mergeable value, the rule's verdict and every reason, from the `PrRead` that `mergeRead` selects (`src/dashboard_frontend/src/modules/shell/board.ts:152-163`), then Merge and Hold. IF no read exists THEN it SHALL show "PR not read yet" and still offer Merge and Hold.
6. WHEN the wait is an `escalation` whose question id is `security` THEN the view SHALL show each finding line of the question text as a list item, then the options accept, retry and abandon as radios with none preselected.
7. WHEN the wait is an `escalation` or `error` with no `task` tag (a document-phase escalation at `src/controller/runs.ts:1359-1364`, a merge or close-out error) THEN the view SHALL show the wait text and "no task: raised in the X phase" with X the run's phase, and SHALL show no task row and no diff section.
8. WHEN the wait is `question` THEN the view SHALL show each question by the rules of Requirement 6 AC 1.

### Requirement 6 — The answer form

**User Story:** As the operator, I want one form that takes my pick or my ruling plus a note and resumes the run, so that answering is one press.

#### Acceptance Criteria

1. For each question the form SHALL show radios when the question has options, a text box when it is free with no options, and both per Requirement 5 AC 2. A notes box SHALL always be shown, once per wait.
2. A radio question SHALL preselect its `recommended` option. IF it has no `recommended` THEN no option SHALL be preselected and the answer button SHALL stay disabled until every radio question has a pick.
3. WHEN the wait is a task ruling (question id `ruling`) THEN the form SHALL show one text box for the ruling and the answer button SHALL stay disabled while it is empty. The typed ruling SHALL be the answer value. At base the escalation footer sends `retry` and drops the typed text (`src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:277-292`).
4. WHEN the notes box is not empty AND the answer is typed text THEN the value sent SHALL be the text, a blank line, "Notes: " and the notes.
5. WHEN the notes box is not empty AND the answer is a picked option THEN the value sent SHALL be the option alone, and the note SHALL travel as a separate `note` field of the answer request body. The server SHALL accept that field and SHALL NOT treat it as an answer key.
6. WHEN an `escalation` or `error` wait is answered THEN `answerWait` SHALL add a section to the spec's `questions.md` headed with the kind and the wait id, holding each question's text, its task id when tagged, the answer value and the note when one was sent. A later section SHALL never replace an earlier wait's section. At base only gate waits write `questions.md` (`src/controller/waits.ts:145-150`).
7. WHEN a gate wait is answered with a note THEN its `questions.md` section SHALL carry a "Notes:" line. WHEN any wait is answered with a note THEN the `note` ledger row SHALL end with the note.
8. The answer button SHALL read "Answer and continue the run" for every kind except `merge`, which keeps Merge and Hold. The request SHALL send `by: "operator"`.
9. WHEN an `escalation` or `error` wait offers no `abandon` option THEN the form SHALL also show "Abandon the run", which answers the wait's first question with `abandon` (the cancel path at `src/controller/controller.ts:662-668`).
10. The "Second opinion" button SHALL call the existing second-opinion route and show the opinion or advice as today. Invariant (verified, not red-first): `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:45-78`, `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:313-317`.
11. WHEN the operator presses the answer button THEN the button SHALL show its stage in place: pressed while the request is in flight; running once the server accepts and the run is still waiting; done once the run leaves `waiting`. On done the view SHALL return to the board. The view SHALL stay on the answered wait until done or failed.
12. IF the request fails THEN the button SHALL show failed with the server's reason, the form SHALL keep every value typed, and the button SHALL be pressable again.
13. WHEN a task ruling is answered THEN the run SHALL leave `waiting` and the next implementer brief for that task SHALL carry the full answer value (ruling and notes) under "Operator rulings". Invariant (verified, not red-first): `src/controller/controller.ts:645-676`, `src/controller/phases/implementation.ts:553-559` and `src/controller/phases/implementation.ts:740-745` already do this for the value stored.
14. WHEN a wait is answered THEN its tile SHALL leave Needs you and the run's tile SHALL show in Running, without a reload. Invariant (verified, not red-first): the board derives both bands from the pushed wait and run lists (`src/dashboard_frontend/src/modules/shell/board.ts:21-32`, `src/dashboard_frontend/src/modules/shell/HomePage.tsx:76-88`).

## Non-Functional Requirements

### Performance
- The diff route SHALL answer within 10 seconds for a capped response (Requirement 4 AC 8 is the bound).

### Security
- No absolute path SHALL reach the browser from the diff route or the task row.
- git SHALL get validated hashes in an argument array (Requirement 4 AC 3).

### Reliability
- A missing worktree, a missing run record, a rewritten hash or a failing git read SHALL never block the answer form.

### Usability
- On a phone the view is one long scroll; no layout beyond the existing shell width is required.

## Decisions taken in this document

- D1 — A note on a picked option stays out of the answer value: options were keep it out and send it as a separate field written to the gate receipt and the ledger note, append it to every value, store it as a new field on the stored answer; chosen because the controller, the merge rule and gate B match option values exactly, so an appended note would turn Approve into an annotation or Merge into an unknown decision.
- D2 — The task's commits include the test author's red commit before the task commits: options were red commit plus task commits, task commits alone as the phase computes them today; chosen because the operator ruling on a test-first task needs to see the tests the implementer worked against.
- D3 — With no recommended pick, nothing is preselected and the answer button waits for a pick: options were no preselection, keep preselecting the first option as the sheet does today; chosen because the security escalation has no recommendation and a preselected accept would record open findings on one careless press.
- D4 — The caps are 12,000 plus 8,000 characters for the detail and 60 files, 400 lines per file and 512 KiB for the diff: options were these caps, one combined detail cap, no cap; chosen because a capped wait file stays small enough to push to every client and a capped diff still shows a normal task whole.
- D5 — A task ruling keeps an "Abandon the run" control: options were keep it, drop it and leave the run tile's Stop as the only way out; chosen because the sheet offers Abandon on escalations today and removing it is a regression the entry does not ask for.
- D6 — The phase and step in the header come from the run record, not from new wait fields: options were read the run record, add phase and step fields to the wait; chosen because the entry fixes the new wait fields at two and a waiting run's phase and cursor are the ones that raised the wait.
- D7 — The risk shown on the task row is read from the newest gate note in the spec ledger: options were the ledger gate note, a new risk field on the outcome, leave risk out; chosen because tasks do not record a risk and the gate note is the only stored score.
- D8 — The task row is read live from the spec's tasks file on open: options were read it live, copy it into the wait record; chosen because the entry puts only the detail and the commits into the record, and a live read shows any file-list patch made since the stop.
- D9 — Escalation and error answers add a section per wait id to the questions receipt: options were one section per wait id, one replaced section per kind, no receipt for these kinds; chosen because the entry's verification wants the ruling in the receipt and several rulings in one run must all stay readable.
- D10 — The diff is grouped per commit, then per file: options were per commit then per file, one combined diff across the range; chosen because the entry names a show per commit and a rewritten hash can then be reported alone.

## Scope notes

- Carried from the decomposition: none.
- The steering file `product.md` is absent from this spec store; the alignment section rests on the decomposition instead.
- Nothing the entry lists is cut. The entry's "resumes at the fix step" is read as "the next implementer step for the task, with the ruling in its brief", because an escalation resets the task to pending (`src/controller/phases/implementation.ts:570`) and the next pass spawns a fresh implementer, not a fix round.
- Out of scope: a deep link URL to the view, a document-phase `detail`, and any change to the worker roles or their report schemas.

## Revision History

- **v1** (2026-11-08) — Initial draft.
  - **Lint pass.** 20 citation-path errors fixed — each bare filename given its directory prefix (`HomePage.tsx`, `implementation.ts`, `gates.ts`, `AnswerSheet.tsx`, `controller.ts`, `board.ts`); the bare sibling range `313-317` on line 107 repaired to carry its full path too. Rejected: L-7, L-8, L-9, L-11, L-12, L-13, L-14, L-15, L-16, L-17, L-23, L-24, L-26, L-27, L-28 — each flags a backticked token the cited range does not define while the citation correctly anchors the symbol or behaviour it follows: `detail`/`commits`/the question `task` tag are this spec's new fields ("SHALL gain"), `isTddMarked`, `listWaitsForWire` and `specDir` carry their own citations elsewhere, `Success` is a prompt-section label, and `escalation`/`error`/`task` are wait kinds, not symbols at the range.
