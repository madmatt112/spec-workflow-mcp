# Adversarial Review — dashboard-ruling-view/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-ruling-view design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-ruling-view` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 3a36efa5

````diff
diff --git a/.spec-workflow/specs/dashboard-ruling-view/design.md b/.spec-workflow/specs/dashboard-ruling-view/design.md
index e21e4e21..4a0415e0 100644
--- a/.spec-workflow/specs/dashboard-ruling-view/design.md
+++ b/.spec-workflow/specs/dashboard-ruling-view/design.md
@@ -48,22 +48,22 @@ graph LR
     - `rulingCommits(red: string | undefined, later: string[]): string[]` returns `[red, ...later]`, `red` left out when undefined, duplicates removed keeping the first, order otherwise unchanged.
   - The current `runTask` body (`src/controller/phases/implementation.ts:649-952`) becomes `runTaskSteps(task, ev)`, with `ev` a local `{ report?: string; commits?: () => string[] }`. The new `runTask(task)` calls it. For a `design-defect`, `escalate` or `error` outcome it returns the outcome plus `task: outcome.task ?? task.id`, `commits: ev.commits?.() ?? []` and `detail: buildRulingDetail(ev.report, latest)`, where `latest` is `getLatestReview(task.id)` on `new TaskReviewManager(ctx.specDir)` (`src/core/task-review-manager.ts:182-185`), and a throw reads as `null`. Any other outcome passes unchanged.
   - Right after `taskCommits` (`src/controller/phases/implementation.ts:668-669`): `ev.commits = () => rulingCommits(redCommit, taskCommits())`. It reads `redCommit` when called, so a red commit found later is included.
-  - `ev.report` is set only where a worker report causes the stop: before the SEAM-DEFECT `return stop(…)` (`:703-704`) and before each `if (flagged) return flagged` (`:787-788`, `:945-947`). The value is the step's `resultText` when non-empty, else `JSON.stringify` of the structured report.
-  - `stop` (`:566-578`) and `routeImplementerFlags` (`:960-1005`) do not change. An `error` stop still passes no `task` option, so the task is not reset to pending; the tag rides only on the outcome.
+  - `ev.report` is set only where a worker report causes the stop: before the SEAM-DEFECT `return stop(…)` (`src/controller/phases/implementation.ts:703-704`) and before each `if (flagged) return flagged` (`:787-788`, `:945-947`). The value is the step's `resultText` when non-empty, else the structured report as JSON.
+  - `stop` (`src/controller/phases/implementation.ts:566-578`) and `routeImplementerFlags` (`:960-1005`) do not change. An error stop still passes no `task` option, so the task is not reset to pending; the tag rides only on the outcome.
 - **Dependencies:** `TaskReview` (`src/types.ts:297-308`), `ReviewFinding` (`src/types.ts:242-251`).
-- **Out of reach:** an `error` from the orient step or a vanished task (`:622-635`) comes before a task is picked and carries no evidence. The worker report schemas (`:152-182`) do not change (R2 AC 11).
+- **Out of reach:** an `error` from the orient step or a vanished task (`src/controller/phases/implementation.ts:622-635`) comes before a task is picked and carries no evidence. The worker report schemas (`:152-182`) do not change (R2 AC 11).
 
 ### C3 — Wait creation in the run driver
 - **Purpose:** Write the evidence into the ruling and error waits (R2 AC 9, AC 10).
 - **Interfaces:** `waitAnd` (`src/controller/runs.ts:622-631`) gains a trailing optional `evidence?: { detail?: string; commits?: string[] }`, passed to `createWait`. In `handleImplementationOutcome` (`src/controller/runs.ts:1242-1309`), the ruling wait (`:1259-1271`) and the final `error` wait (`:1303-1307`) pass `{ detail: outcome.detail, commits: outcome.commits }`, and the `error` question gains `task: outcome.task` when set. The security wait (`:1283-1289`), the document escalation (`:1359-1364`) and every other caller pass none: the R2 AC 10 invariant.
-- **Note:** an `error` outcome first takes the one fresh retry (`:1296-1301`); only the outcome that opens the wait carries evidence. `escalationRulings` (`:1188-1204`) reads only `escalation` waits, so a tag on an `error` question changes no ruling.
+- **Note:** an `error` outcome first takes the one fresh retry (`src/controller/runs.ts:1296-1301`); only the outcome that opens the wait carries evidence. `escalationRulings` (`:1188-1204`) reads only `escalation` waits, so a tag on an `error` question changes no ruling.
 
 ### C4 — Answer with a note, and the ruling receipt
 - **Purpose:** Carry the note, and write `questions.md` for escalation and error waits (R6 AC 5-7).
 - **Interfaces:**
   - `answerWait(id, answers, by, note?: string)` (`src/controller/waits.ts:127-155`). The note is not stored on the record (the entry fixes the new record fields at two).
-  - For `gate-a` and `gate-b` the receipt renders as today (`:260-272`) plus a last line `Notes: <note>` when sent. For `escalation` and `error` a new `rulingSection(record, note)` renders under `## <kind> <wait id>` (for example `## escalation w-1a2b3c4d`): per question `<n>. <text>`, `   Task: <task>` when tagged, `   Answer: <value or "no answer">`, then `Notes: <note>` when sent. `upsertSection` (`:295-302`) keys on that heading, so a later wait never replaces an earlier wait's section.
-  - `noteText` (`:305-309`) appends `; note: <note>` when sent, so the ledger row ends with the note.
+  - For `gate-a` and `gate-b` the receipt renders as today (`src/controller/waits.ts:260-272`) plus a last line `Notes: <note>` when sent. For escalation and error a new `rulingSection(record, note)` renders under `## <kind> <wait id>` (for example `## escalation w-1a2b3c4d`): per question `<n>. <text>`, `   Task: <task>` when tagged, `   Answer: <value or "no answer">`, then `Notes: <note>` when sent. `upsertSection` (`:295-302`) keys on that heading, so a later wait never replaces an earlier wait's section.
+  - `noteText` (`src/controller/waits.ts:305-309`) appends `; note: <note>` when sent, so the ledger row ends with the note.
   - Answer route (`src/dashboard/multi-server.ts:701-715`): body `{ answers?, by?, note? }`; a string `note` non-empty after trim goes to `answerWait`. `checkAnswerKeys` (`src/advisor/actions.ts:145-154`) still sees only `answers`.
 
 ### C5 — Task row route
@@ -99,13 +99,13 @@ graph LR
     - `initialValues(wait)`: each question's `recommended`, else `''`. This replaces `defaultValue` (`src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:85-90`), which picked the first option.
     - `answerOf(q, pick, text)`: options and `free` give `text.trim()` when non-empty, else `pick`; options alone give `pick`; otherwise `text`.
     - `canSubmit(wait, picks, texts)`: false while a question with options has neither a pick nor (when `free`) non-empty text, or while a `ruling` question's text is empty after trim.
-    - `answerPayload(wait, picks, texts, notes): { answers; note? }`: with non-empty notes and at least one typed-text answer, the first typed-text answer in question order gets a blank line, `Notes: ` and the notes, and `note` is absent; with only picked answers, the notes go in `note`. A `retro-plan` wait adds the `proposal:<i>` keys as today (`AnswerSheet.tsx:254-257`).
+    - `answerPayload(wait, picks, texts, notes): { answers; note? }`: with non-empty notes and at least one typed-text answer, the first typed-text answer in question order gets a blank line, `Notes: ` and the notes, and `note` is absent; with only picked answers, the notes go in `note`. A `retro-plan` wait adds the `proposal:<i>` keys as today (`src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:254-257`).
     - `securityLines(text)`: first line `lead`, last line `tail`, the lines between `findings`; this matches the text written at `src/controller/runs.ts:1285-1287`.
     - `offersAbandon(wait)`: true for an `escalation` or `error` whose first question has no `abandon` option.
   - New `RulingView.tsx` in the same folder: `RulingView(props: { wait; runs: ControllerRun[]; projectName; now: number; stage: Stage | null; onAnswer: (body: { answers; by: 'operator'; note? }) => void })`. The root keeps `data-testid="now-answer-sheet"`, so the Home cases at `e2e/worktree-board.spec.ts:699-789` stay valid. Render order:
     1. Header (`ruling-header`): kind, project, spec, wait id, `Age <compactAge> ago` in `text-display tabular-nums` (`ruling-age`; the tile class at `src/dashboard_frontend/src/modules/shell/tiles.tsx:90`), run id, the run's `phase` and `stepKind` or `run record gone`, and `task <id>` when tagged.
-    2. Body by layout. `task`: question texts, task row (`ruling-task-row`), detail (`ruling-detail`), diff (`ruling-diff`); both fetches run once on mount. `taskless`: texts and `no task: raised in the <phase> phase` (`unknown` when the run is gone). `security`: `lead`, a list of `findings`, `tail`. `gate`: questions, then `proposals` under `Recorded without asking` (gate-a) or `The plan` (gate-b). `retro-plan`: questions and the proposal checkboxes moved from `AnswerSheet.tsx:210-260`. `merge`: from `mergeRead` (`src/dashboard_frontend/src/modules/shell/board.ts:152-163`) the PR number (a link when `url` is https), CI, mergeable, verdict and every reason, else `PR not read yet`. `question`: questions.
-    3. Form: radios (`answer-opt-<qid>`) with `(recommended)` and the `reason` beside the recommended option; text boxes (`answer-text-<qid>`) where R5 AC 2 and R6 AC 1, AC 3 call for them; one notes box (`ruling-notes`). Except for `merge`: `Answer and continue the run` (`answer-submit`, disabled while `!canSubmit` or the stage is `pressed` or `running`) and `Abandon the run` (`ruling-abandon`) when `offersAbandon`. For `merge`: `Merge` (`answer-submit`) and `Hold` (`answer-hold`). Then `SecondOpinionButton` with the opinion or advice (moved from `AnswerSheet.tsx:45-78`, `:307-317`) and the stage line (`answer-stage`: `pressed`, `running`, `done` or `failed: <reason>`).
+    2. Body by layout. `task`: question texts, task row (`ruling-task-row`), detail (`ruling-detail`), diff (`ruling-diff`); both fetches run once on mount. `taskless`: texts and `no task: raised in the <phase> phase` (`unknown` when the run is gone). `security`: `lead`, a list of `findings`, `tail`. `gate`: questions, then `proposals` under `Recorded without asking` (gate-a) or `The plan` (gate-b). `retro-plan`: questions and the proposal checkboxes moved from `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:210-260`. `merge`: from `mergeRead` (`src/dashboard_frontend/src/modules/shell/board.ts:152-163`) the PR number (a link when `url` is https), CI, mergeable, verdict and every reason, else `PR not read yet`. `question`: questions.
+    3. Form: radios (`answer-opt-<qid>`) with `(recommended)` and the `reason` beside the recommended option; text boxes (`answer-text-<qid>`) where R5 AC 2 and R6 AC 1, AC 3 call for them; one notes box (`ruling-notes`). Except for `merge`: `Answer and continue the run` (`answer-submit`, disabled while `!canSubmit` or the stage is `pressed` or `running`) and `Abandon the run` (`ruling-abandon`) when `offersAbandon`. For `merge`: `Merge` (`answer-submit`) and `Hold` (`answer-hold`). Then `SecondOpinionButton` with the opinion or advice (moved from `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:45-78`, `:307-317`) and the stage line (`answer-stage`: `pressed`, `running`, `done` or `failed: <reason>`).
   - Task row: id, title, `Success` (or `no Success clause`), `TDD yes` or `TDD no`, risk (or `risk not scored yet`), each file; `not-found` shows `task <id> not found in tasks.md`. Detail: `detail` in a `whitespace-pre-wrap` block, or `no worker report or task review`.
   - Diff by state. `ok`: per commit `<hash> <subject>`; per file the path, each hunk header and its lines (add on `--tone-success-*`, del on `--tone-danger-*`, ctx on `--text-secondary`), `<n> lines dropped` for a cut file, `binary`, `not found in the worktree` for a missing commit, then the overflow paths and count. `worktree-gone`: `worktree gone`. `no-commits`: `no commits for this task`. `run-gone`: `run record gone`. `unreadable`: `git could not read the diff: <error>`. A fetch failure: `diff request failed (<status>)`.
   - `AnswerSheet.tsx` is deleted; its only importer (`src/dashboard_frontend/src/modules/shell/HomePage.tsx:6`) switches to `RulingView`.
@@ -163,7 +163,7 @@ type WaitDiff =
   - `src/controller/phases/__tests__/implementation.test.ts`, next to the flag cases at `:842-867`: DESIGN-DEFECT and ESCALATE outcomes carry `task`, `commits` and a `detail` starting `## Worker report`; a SEAM-DEFECT stop includes the red commit; the never-logged `error` stop (`src/controller/phases/implementation.ts:795`) carries `task` and `commits` but no `detail`; a seeded review adds `## Task review`.
   - `src/controller/__tests__/runs.test.ts` (near `:2274`): the ruling wait holds `detail` and `commits`; the final `error` wait also tags its question; the security wait holds neither.
   - `src/dashboard/__tests__/controller-waits-routes.test.ts`: the answer route takes `note`; the task route returns 404, `no-task`, `ok`, `not-found`; the diff route returns 404, `run-gone`, `no-commits`; the waits list has no `commits` or `specDir`; each new route answers 401 without a session, like the existing wait routes (R4 AC 11).
-- **End-to-end:** new `e2e/worktree-ruling.spec.ts` on `playwright.worktree.config.ts`. Its real controller has only deploy disabled (`playwright.worktree.config.ts:67`), so the seeded `waiting` run carries `pauseRequested`, and an answer parks it `paused` (`src/controller/controller.ts:671-673`) instead of driving it. The suite seeds a temp git worktree with one fixture commit, a spec dir with `tasks.md` and a gate note, and an escalation wait with `detail`, `commits`, the `task` tag and `specDir`. It runs entry steps 1-5: the view shows the wait text, the task row and files, the detail and the added diff lines, with no `band-needs-you`; a ruling and a note are typed and Answer pressed; after the `answer-stage` reads `done` or `band-needs-you` returns, `questions.md` holds the ruling and notes and the answer has `by: operator`; a gate-B wait shows `Approve` preselected and `The plan`; a merge wait shows the PR and `Merge`; a security wait shows three unselected radios; with the worktree removed the view shows `worktree gone` and Answer still works. "The next implementer brief carries the ruling" is a regression guard at `src/controller/phases/__tests__/implementation.test.ts:867` (R6 AC 13 holds at base).
+- **End-to-end:** new `e2e/worktree-ruling.spec.ts` on `playwright.worktree.config.ts`. Its real controller has only deploy disabled (`./playwright.worktree.config.ts:67`), so the seeded `waiting` run carries `pauseRequested`, and an answer parks it `paused` (`src/controller/controller.ts:671-673`) instead of driving it. The suite seeds a temp git worktree with one fixture commit, a spec dir with `tasks.md` and a gate note, and an escalation wait with `detail`, `commits`, the `task` tag and `specDir`. It runs entry steps 1-5: the view shows the wait text, the task row and files, the detail and the added diff lines, with no `band-needs-you`; a ruling and a note are typed and Answer pressed; after the `answer-stage` reads `done` or `band-needs-you` returns, `questions.md` holds the ruling and notes and the answer has `by: operator`; a gate-B wait shows `Approve` preselected and `The plan`; a merge wait shows the PR and `Merge`; a security wait shows three unselected radios; with the worktree removed the view shows `worktree gone` and Answer still works. "The next implementer brief carries the ruling" is a regression guard at `src/controller/phases/__tests__/implementation.test.ts:867` (R6 AC 13 holds at base).
 
 ## Enumerated artifacts
 
@@ -202,3 +202,4 @@ type WaitDiff =
 ## Revision History
 
 - **v1** (2026-11-08) — Initial draft.
+  - **Lint pass.** 17 fixed: 12 citation-bare ranges (L-3–L-14) given their directory-prefixed paths (`src/controller/phases/implementation.ts`, `src/controller/runs.ts`, `src/controller/waits.ts`), the first range of each block carrying the path and later ranges inheriting it; 5 bare-filename errors repaired — `AnswerSheet.tsx` → `src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx` (L-34, L-50, L-51, the inherited L-52 cleared by the same edit) and `playwright.worktree.config.ts` → `./playwright.worktree.config.ts` (L-80). Three prose tokens that the newly-resolvable citations would otherwise trip (`JSON.stringify`, `escalation`, `error`) were de-ticked on lines 51/65. Rejected: L-1, L-2, L-15–L-33, L-35–L-49, L-53–L-79 (all citation-identifier) — each verified citation anchors its real symbol; the flagged token is a new symbol/field this design adds or a prose word, so its absence from the base ranges is expected, not a wrong citation.

````
