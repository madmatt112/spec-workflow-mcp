# Adversarial Review — dashboard-ruling-view/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Label every MUST_FIX and SHOULD_FIX, in the analysis and the report arrays, with a `[drafting] ` or `[design] ` prefix. A drafting defect is one the reviser can fix with no change to a requirement, a design choice or the scope: a wrong citation, a stale count, wording, or a lint failure. Every other item is a design defect.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): dashboard-ruling-view requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-ruling-view` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 89d49d4e

````diff
diff --git a/.spec-workflow/specs/dashboard-ruling-view/requirements.md b/.spec-workflow/specs/dashboard-ruling-view/requirements.md
index d2841c98..36f99a21 100644
--- a/.spec-workflow/specs/dashboard-ruling-view/requirements.md
+++ b/.spec-workflow/specs/dashboard-ruling-view/requirements.md
@@ -22,7 +22,7 @@ The steering file `product.md` does not exist in this spec store, so this sectio
 4. IF the wait's run is not in the controller's run list THEN the header SHALL show "run record gone" in place of the phase and step, and the rest of the view SHALL still render.
 5. WHEN the view is open THEN the age SHALL update at least once per second without a reload.
 6. The view SHALL contain no "open in editor" link and no link to a file path. The dashboard SHALL never read `/tmp/scratchpad/sdd/` for any part of the view.
-7. WHEN the wait leaves the open list for any reason other than this view's own answer (answered elsewhere, expired, or its project disabled) THEN the view SHALL return to the board. Invariant (verified, not red-first): `HomePage.tsx:149-152` re-derives the open wait each render.
+7. WHEN the wait leaves the open list for any reason other than this view's own answer (answered elsewhere, expired, or its project disabled) THEN the view SHALL return to the board. Invariant (verified, not red-first): `src/dashboard_frontend/src/modules/shell/HomePage.tsx:149-152` re-derives the open wait each render.
 
 ### Requirement 2 — The wait record carries the detail and the commits
 
@@ -32,15 +32,15 @@ The steering file `product.md` does not exist in this spec store, so this sectio
 
 1. `WaitRecord` (`src/controller/state.ts:207-226`) SHALL gain `detail?: string` and `commits?: string[]`, and `CreateWaitInput` (`src/controller/waits.ts:52-62`) SHALL accept both and write them when present.
 2. `ImplementationPhaseOutcome` (`src/controller/phases/implementation.ts:124-144`) SHALL gain `detail?: string` and `commits?: string[]`.
-3. WHEN the implementation phase returns `design-defect`, `escalate` or `error` while a task is picked (inside the per-task loop) THEN the outcome SHALL carry that task's id in `task` and its commits in `commits`. This includes the error stops that today pass no task, for example the never-logged stop at `implementation.ts:795` and the gate-tool stop at `implementation.ts:843`.
-4. The `commits` list SHALL be the task's red commit, when the test author made one, followed by the hashes `taskCommits` returns at the stop (`implementation.ts:668-669`), oldest first, with no duplicates.
-5. WHEN a worker step's report caused the stop (an implementer or fix-round flag routed by `routeImplementerFlags` at `implementation.ts:960-1005`, or the test author's SEAM-DEFECT at `implementation.ts:703-704`) THEN `detail` SHALL hold that worker's full report text: the result text, else the structured report as JSON.
+3. WHEN the implementation phase returns `design-defect`, `escalate` or `error` while a task is picked (inside the per-task loop) THEN the outcome SHALL carry that task's id in `task` and its commits in `commits`. This includes the error stops that today pass no task, for example the never-logged stop at `src/controller/phases/implementation.ts:795` and the gate-tool stop at `src/controller/phases/implementation.ts:843`.
+4. The `commits` list SHALL be the task's red commit, when the test author made one, followed by the hashes `taskCommits` returns at the stop (`src/controller/phases/implementation.ts:668-669`), oldest first, with no duplicates.
+5. WHEN a worker step's report caused the stop (an implementer or fix-round flag routed by `routeImplementerFlags` at `src/controller/phases/implementation.ts:960-1005`, or the test author's SEAM-DEFECT at `src/controller/phases/implementation.ts:703-704`) THEN `detail` SHALL hold that worker's full report text: the result text, else the structured report as JSON.
 6. WHEN a task review exists for the task (the latest version from `TaskReviewManager.getLatestReview`, `src/core/task-review-manager.ts:182-185`) THEN `detail` SHALL also hold that review's version, verdict, summary and every finding as severity, title, file and line when present, and description.
 7. The worker report SHALL come first under the heading "Worker report", the review second under the heading "Task review". IF neither exists THEN `detail` SHALL be absent.
 8. The worker report part SHALL be capped at 12,000 characters and the review part at 8,000. A capped part SHALL end with a line naming how many characters were dropped.
 9. WHEN `handleImplementationOutcome` (`src/controller/runs.ts:1242-1309`) opens the ruling `escalation` wait or the implementation `error` wait THEN it SHALL write the outcome's `detail` and `commits` into the wait, and the `error` question SHALL carry the outcome's `task` tag when it has one.
 10. Waits from the document, merge, retrospective and close-out paths, and the security escalation, SHALL carry neither field. Invariant (verified, not red-first) for every path this spec does not touch.
-11. No file under `harness/agents/` or `harness/skills/` and no report schema in `implementation.ts:152-182` SHALL change: the worker roles stay as they are.
+11. No file under `harness/agents/` or `harness/skills/` and no report schema in `src/controller/phases/implementation.ts:152-182` SHALL change: the worker roles stay as they are.
 12. The wire copies of the wait shape (`src/dashboard/shell/types.ts:57-95` and `src/dashboard_frontend/src/modules/shell/types.ts:53-91`) SHALL gain `detail`, `commits` and the question `task` tag. `listWaitsForWire` SHALL still strip `specDir`.
 
 ### Requirement 3 — The task section of an escalation or error wait
@@ -50,8 +50,8 @@ The steering file `product.md` does not exist in this spec store, so this sectio
 #### Acceptance Criteria
 
 1. WHEN the wait is an `escalation` or `error` whose question carries a `task` tag THEN the view SHALL show, in this order: the wait text, the task row, the detail, the diff, then the answer form.
-2. The task row SHALL show the task id, its title, the `Success` part of its prompt (`promptStructured`, `src/core/task-parser.ts:148-169`), TDD as "yes" or "no" by the rule of `isTddMarked` (`implementation.ts:256-259`), the risk, and every entry of its `Files` list.
-3. The risk SHALL be the level in the newest `gate: task N ... risk R` note for that task in the spec's `harness-events.jsonl` (the note written at `implementation.ts:848`). IF the task has no such note THEN the row SHALL show "risk not scored yet".
+2. The task row SHALL show the task id, its title, the `Success` part of its prompt (`promptStructured`, `src/core/task-parser.ts:148-169`), TDD as "yes" or "no" by the rule of `isTddMarked` (`src/controller/phases/implementation.ts:256-259`), the risk, and every entry of its `Files` list.
+3. The risk SHALL be the level in the newest `gate: task N ... risk R` note for that task in the spec's `harness-events.jsonl` (the note written at `src/controller/phases/implementation.ts:848`). IF the task has no such note THEN the row SHALL show "risk not scored yet".
 4. The server SHALL read the task row from the spec's `tasks.md` and the ledger when the view opens, not from the wait record. The browser SHALL never receive the spec directory path.
 5. IF the tagged task id is not in `tasks.md` THEN the row SHALL read "task N not found in tasks.md" and the detail, diff and form SHALL still render.
 6. WHEN `detail` is present THEN the view SHALL show it as preformatted text with line breaks kept. IF it is absent THEN the detail section SHALL read "no worker report or task review".
@@ -81,9 +81,9 @@ The steering file `product.md` does not exist in this spec store, so this sectio
 #### Acceptance Criteria
 
 1. WHEN the wait is `gate-a` or `gate-b` THEN the view SHALL show each question's text, its options as radios with the recommended option preselected and marked "(recommended)", and the question's `reason` next to the recommended pick.
-2. WHEN a gate question has `free: true` and no options THEN the view SHALL show a text box. WHEN it has `free: true` and options (the gate B question at `src/controller/phases/gates.ts:229-243` and the gate A defer question at `gates.ts:148-159`) THEN the view SHALL show the radios and a text box; non-empty text in the box SHALL be the answer in place of the pick.
-3. WHEN a `gate-a` wait has `proposals` THEN the view SHALL list them under "Recorded without asking" below the questions. WHEN a `gate-b` wait has `proposals` THEN the view SHALL list them under "The plan" below the question. At base the sheet shows no proposals for a gate (`AnswerSheet.tsx:200-209`).
-4. WHEN the wait is `retro-plan` THEN the view SHALL show its questions first, then the proposals as a list of checkboxes, all ticked by default, each with its title and details. Invariant (verified, not red-first): `AnswerSheet.tsx:210-260`.
+2. WHEN a gate question has `free: true` and no options THEN the view SHALL show a text box. WHEN it has `free: true` and options (the gate B question at `src/controller/phases/gates.ts:229-243` and the gate A defer question at `src/controller/phases/gates.ts:148-159`) THEN the view SHALL show the radios and a text box; non-empty text in the box SHALL be the answer in place of the pick.
+3. WHEN a `gate-a` wait has `proposals` THEN the view SHALL list them under "Recorded without asking" below the questions. WHEN a `gate-b` wait has `proposals` THEN the view SHALL list them under "The plan" below the question. At base the sheet shows no proposals for a gate (`src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:200-209`).
+4. WHEN the wait is `retro-plan` THEN the view SHALL show its questions first, then the proposals as a list of checkboxes, all ticked by default, each with its title and details. Invariant (verified, not red-first): `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:210-260`.
 5. WHEN the wait is `merge` THEN the view SHALL show the PR number (a link when the read has an https URL), the CI state, the mergeable value, the rule's verdict and every reason, from the `PrRead` that `mergeRead` selects (`src/dashboard_frontend/src/modules/shell/board.ts:152-163`), then Merge and Hold. IF no read exists THEN it SHALL show "PR not read yet" and still offer Merge and Hold.
 6. WHEN the wait is an `escalation` whose question id is `security` THEN the view SHALL show each finding line of the question text as a list item, then the options accept, retry and abandon as radios with none preselected.
 7. WHEN the wait is an `escalation` or `error` with no `task` tag (a document-phase escalation at `src/controller/runs.ts:1359-1364`, a merge or close-out error) THEN the view SHALL show the wait text and "no task: raised in the X phase" with X the run's phase, and SHALL show no task row and no diff section.
@@ -97,18 +97,18 @@ The steering file `product.md` does not exist in this spec store, so this sectio
 
 1. For each question the form SHALL show radios when the question has options, a text box when it is free with no options, and both per Requirement 5 AC 2. A notes box SHALL always be shown, once per wait.
 2. A radio question SHALL preselect its `recommended` option. IF it has no `recommended` THEN no option SHALL be preselected and the answer button SHALL stay disabled until every radio question has a pick.
-3. WHEN the wait is a task ruling (question id `ruling`) THEN the form SHALL show one text box for the ruling and the answer button SHALL stay disabled while it is empty. The typed ruling SHALL be the answer value. At base the escalation footer sends `retry` and drops the typed text (`AnswerSheet.tsx:277-292`).
+3. WHEN the wait is a task ruling (question id `ruling`) THEN the form SHALL show one text box for the ruling and the answer button SHALL stay disabled while it is empty. The typed ruling SHALL be the answer value. At base the escalation footer sends `retry` and drops the typed text (`src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:277-292`).
 4. WHEN the notes box is not empty AND the answer is typed text THEN the value sent SHALL be the text, a blank line, "Notes: " and the notes.
 5. WHEN the notes box is not empty AND the answer is a picked option THEN the value sent SHALL be the option alone, and the note SHALL travel as a separate `note` field of the answer request body. The server SHALL accept that field and SHALL NOT treat it as an answer key.
 6. WHEN an `escalation` or `error` wait is answered THEN `answerWait` SHALL add a section to the spec's `questions.md` headed with the kind and the wait id, holding each question's text, its task id when tagged, the answer value and the note when one was sent. A later section SHALL never replace an earlier wait's section. At base only gate waits write `questions.md` (`src/controller/waits.ts:145-150`).
 7. WHEN a gate wait is answered with a note THEN its `questions.md` section SHALL carry a "Notes:" line. WHEN any wait is answered with a note THEN the `note` ledger row SHALL end with the note.
 8. The answer button SHALL read "Answer and continue the run" for every kind except `merge`, which keeps Merge and Hold. The request SHALL send `by: "operator"`.
 9. WHEN an `escalation` or `error` wait offers no `abandon` option THEN the form SHALL also show "Abandon the run", which answers the wait's first question with `abandon` (the cancel path at `src/controller/controller.ts:662-668`).
-10. The "Second opinion" button SHALL call the existing second-opinion route and show the opinion or advice as today. Invariant (verified, not red-first): `AnswerSheet.tsx:45-78`, `313-317`.
+10. The "Second opinion" button SHALL call the existing second-opinion route and show the opinion or advice as today. Invariant (verified, not red-first): `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:45-78`, `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:313-317`.
 11. WHEN the operator presses the answer button THEN the button SHALL show its stage in place: pressed while the request is in flight; running once the server accepts and the run is still waiting; done once the run leaves `waiting`. On done the view SHALL return to the board. The view SHALL stay on the answered wait until done or failed.
 12. IF the request fails THEN the button SHALL show failed with the server's reason, the form SHALL keep every value typed, and the button SHALL be pressable again.
-13. WHEN a task ruling is answered THEN the run SHALL leave `waiting` and the next implementer brief for that task SHALL carry the full answer value (ruling and notes) under "Operator rulings". Invariant (verified, not red-first): `controller.ts:645-676`, `implementation.ts:553-559` and `implementation.ts:740-745` already do this for the value stored.
-14. WHEN a wait is answered THEN its tile SHALL leave Needs you and the run's tile SHALL show in Running, without a reload. Invariant (verified, not red-first): the board derives both bands from the pushed wait and run lists (`board.ts:21-32`, `HomePage.tsx:76-88`).
+13. WHEN a task ruling is answered THEN the run SHALL leave `waiting` and the next implementer brief for that task SHALL carry the full answer value (ruling and notes) under "Operator rulings". Invariant (verified, not red-first): `src/controller/controller.ts:645-676`, `src/controller/phases/implementation.ts:553-559` and `src/controller/phases/implementation.ts:740-745` already do this for the value stored.
+14. WHEN a wait is answered THEN its tile SHALL leave Needs you and the run's tile SHALL show in Running, without a reload. Invariant (verified, not red-first): the board derives both bands from the pushed wait and run lists (`src/dashboard_frontend/src/modules/shell/board.ts:21-32`, `src/dashboard_frontend/src/modules/shell/HomePage.tsx:76-88`).
 
 ## Non-Functional Requirements
 
@@ -142,9 +142,10 @@ The steering file `product.md` does not exist in this spec store, so this sectio
 
 - Carried from the decomposition: none.
 - The steering file `product.md` is absent from this spec store; the alignment section rests on the decomposition instead.
-- Nothing the entry lists is cut. The entry's "resumes at the fix step" is read as "the next implementer step for the task, with the ruling in its brief", because an escalation resets the task to pending (`implementation.ts:570`) and the next pass spawns a fresh implementer, not a fix round.
+- Nothing the entry lists is cut. The entry's "resumes at the fix step" is read as "the next implementer step for the task, with the ruling in its brief", because an escalation resets the task to pending (`src/controller/phases/implementation.ts:570`) and the next pass spawns a fresh implementer, not a fix round.
 - Out of scope: a deep link URL to the view, a document-phase `detail`, and any change to the worker roles or their report schemas.
 
 ## Revision History
 
 - **v1** (2026-11-08) — Initial draft.
+  - **Lint pass.** 20 citation-path errors fixed — each bare filename given its directory prefix (`HomePage.tsx`, `implementation.ts`, `gates.ts`, `AnswerSheet.tsx`, `controller.ts`, `board.ts`); the bare sibling range `313-317` on line 107 repaired to carry its full path too. Rejected: L-7, L-8, L-9, L-11, L-12, L-13, L-14, L-15, L-16, L-17, L-23, L-24, L-26, L-27, L-28 — each flags a backticked token the cited range does not define while the citation correctly anchors the symbol or behaviour it follows: `detail`/`commits`/the question `task` tag are this spec's new fields ("SHALL gain"), `isTddMarked`, `listWaitsForWire` and `specDir` carry their own citations elsewhere, `Success` is a prompt-section label, and `escalation`/`error`/`task` are wait kinds, not symbols at the range.

````
