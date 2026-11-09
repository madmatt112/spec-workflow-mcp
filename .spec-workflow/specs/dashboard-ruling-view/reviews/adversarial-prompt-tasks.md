# Adversarial Review — dashboard-ruling-view/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Atomicity, ordering, coverage

**Example attack angles to consider:** Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don't map to any requirement

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-ruling-view tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-ruling-view` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since af0bad4c

````diff
diff --git a/.spec-workflow/specs/dashboard-ruling-view/tasks.md b/.spec-workflow/specs/dashboard-ruling-view/tasks.md
index b3b3df99..52289e9a 100644
--- a/.spec-workflow/specs/dashboard-ruling-view/tasks.md
+++ b/.spec-workflow/specs/dashboard-ruling-view/tasks.md
@@ -2,7 +2,7 @@
 
 Document version: v1
 
-Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 → 5; 2 → 3 → 4; 6 → 7, 6 → 8 and 7, 8 → 9; 6 → 10 → 11 → 12; task 13 runs last. Server tasks (1-9) come before the view (10-12), so the view reads real routes. Each task leaves `npx tsc --noEmit` and every vitest suite green; `tsc` does not cover `src/dashboard_frontend/` (`tsconfig.json:20`), so frontend tasks prove their code through vitest dynamic imports and Playwright. Line citations are to base `bb6d32ff`; where an earlier task here edited the file, the named symbol is the anchor and the implementer re-resolves the line. If `SPEC_WORKFLOW_SHARED_ROOT` is set in the session, run vitest as `env -u SPEC_WORKFLOW_SHARED_ROOT -u SPEC_WORKFLOW_WORKSPACE npx vitest run …`. Tasks 2, 7, 8, 10 and 11 add new modules, so expect at least five verifier spawns. Tasks 6 and 13 carry no `- Test:` seam and route implementer-only.
+Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 → 5; 2 → 3 → 4; 6 → 7, 6 → 8 and 7, 8 → 9; 6 → 10 → 11 → 12; task 13 runs last. Server tasks (1-9) come before the view (10-12), so the view reads real routes. Each task leaves `npx tsc --noEmit` and every vitest suite green; tsc does not cover `src/dashboard_frontend/` (`./tsconfig.json:20`), so frontend tasks prove their code through vitest dynamic imports and Playwright. Line citations are to base bb6d32ff; where an earlier task here edited the file, the named symbol is the anchor and the implementer re-resolves the line. If SPEC_WORKFLOW_SHARED_ROOT is set in the session, run vitest as `env -u SPEC_WORKFLOW_SHARED_ROOT -u SPEC_WORKFLOW_WORKSPACE npx vitest run …`. Tasks 2, 7, 8, 10 and 11 add new modules, so expect at least five verifier spawns. Tasks 6 and 13 carry no `- Test:` seam and route implementer-only.
 
 - [ ] 1. Add the evidence fields to the wait record
   - File: src/controller/state.ts
@@ -14,7 +14,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 
   - Purpose: The wait holds the worker report, the review and the task's commits.
   - _Leverage: src/controller/state.ts:207-226, src/controller/waits.ts:52-62, src/controller/waits.ts:98-118, src/controller/waits.ts:241-243_
   - _Requirements: 2.1, 2.12_
-  - _Prompt: Task: Per design C1 (requirement 2 AC 1, AC 12), add `detail?: string` and `commits?: string[]` to `WaitRecord` (`src/controller/state.ts:207-226`) and `CreateWaitInput` (`src/controller/waits.ts:52-62`). `createWait` (`:98-118`) copies `detail` when present and `commits` when non-empty, as it copies `proposals` (`:114`). `listWaitsForWire` (`:241-243`) strips `commits` as well as `specDir`, and its return type omits both | Restrictions: Add no other record field; do not change `answerWait` here (task 5 does) | Success: a wait created with `detail` and `commits` reads back with both; a wait created with an empty `commits` array stores no `commits` key; a wait created with neither has no `detail` or `commits` key (regression guard); `listWaitsForWire` returns the wait with `detail` and with no `commits` or `specDir`; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/waits.test.ts` pass_
+  - _Prompt: Task: Per design C1 (requirement 2 AC 1, AC 12), add `detail?: string` and `commits?: string[]` to `WaitRecord` (`src/controller/state.ts:207-226`) and `CreateWaitInput` (`src/controller/waits.ts:52-62`). `createWait` (`:98-118`) copies `detail` when present and `commits` when non-empty, as it copies `proposals` (`:114`). `listWaitsForWire` (`:241-243`) strips `commits` as well as `specDir`, and its return type omits both | Restrictions: Add no other record field; do not change `answerWait` here (a later task does) | Success: a wait created with `detail` and `commits` reads back with both; a wait created with an empty `commits` array stores no `commits` key; a wait created with neither has no `detail` or `commits` key (regression guard); `listWaitsForWire` returns the wait with `detail` and with no `commits` or `specDir`; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/waits.test.ts` pass_
 
 - [ ] 2. Build the ruling detail module
   - File: src/controller/ruling-detail.ts
@@ -31,7 +31,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 
   - File: src/controller/phases/implementation.ts
   - File: src/controller/phases/__tests__/implementation.test.ts
   - Test: src/controller/phases/__tests__/implementation.test.ts — `runImplementationPhase(ctx)`
-  - Note: the cases at `src/controller/phases/__tests__/implementation.test.ts:842-873` keep every asserted value. The gate-tool stop (`implementation.ts:843-844`) is covered by the same wrapper; it needs no case of its own (D5).
+  - Note: the cases at `src/controller/phases/__tests__/implementation.test.ts:842-873` keep every asserted value. The gate-tool stop (`src/controller/phases/implementation.ts:843-844`) is covered by the same wrapper; it needs no case of its own (D5).
   - Purpose: Every stop made while a task is picked names the task and carries its evidence.
   - _Leverage: src/controller/phases/implementation.ts:124-144, src/controller/phases/implementation.ts:649-669, src/controller/phases/implementation.ts:703-704, src/controller/phases/implementation.ts:777-795, src/controller/phases/implementation.ts:945-947, src/core/task-review-manager.ts:182-185_
   - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.11_
@@ -78,7 +78,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 
   - Purpose: The task row is read live from `tasks.md` and the gate note.
   - _Leverage: src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/controller/phases/implementation.ts:256-259, src/controller/phases/implementation.ts:848_
   - _Requirements: 3.2, 3.3, 3.4, 3.5_
-  - _Prompt: Task: Per design C5 and design D8, D9 (requirement 3 AC 2, AC 3, AC 5), create `src/dashboard/shell/ruling-rows.ts` with `riskFromLedger` and `readTaskRow` as design C5 pins them, returning the `WaitTaskRow` type task 6 adds. Export `isTddMarked` (`src/controller/phases/implementation.ts:256-259`) with its body unchanged and use it | Restrictions: Read only `tasks.md` and `harness-events.jsonl` under the given spec dir; the row holds no path but the task's own `Files` entries | Success: `riskFromLedger` returns the risk of the newest matching gate note; ignores notes for another task id (task `1` does not match a `gate: task 12` note); skips a torn line; returns `null` with no note; `readTaskRow` returns `ok` with id, title, the `Success` text, `tdd` true for a task with a `Test:` line, `risk` and `files`; `tdd` is false for a block marked `kind: e2e`; `success` is `null` with no `Success` section; an absent id and a missing `tasks.md` each give `not-found` with the id; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/ruling-rows.test.ts` pass_
+  - _Prompt: Task: Per design C5 and design D8, D9 (requirement 3 AC 2, AC 3, AC 5), create `src/dashboard/shell/ruling-rows.ts` with `riskFromLedger` and `readTaskRow` as design C5 pins them, returning the `WaitTaskRow` type task 6 adds. Export `isTddMarked` (`src/controller/phases/implementation.ts:256-259`) with its body unchanged and use it | Restrictions: Read only `tasks.md` and `harness-events.jsonl` under the given spec dir; the row holds no path but the task's own `Files` entries | Success: `riskFromLedger` returns the risk of the newest matching gate note; ignores notes for another task id (task `1` does not match a `gate: task 2` note); skips a torn line; returns `null` with no note; `readTaskRow` returns `ok` with id, title, the `Success` text, `tdd` true for a task with a `Test:` line, `risk` and `files`; `tdd` is false for a block marked `kind: e2e`; `success` is `null` with no `Success` section; an absent id and a missing `tasks.md` each give `not-found` with the id; `npx tsc --noEmit` and `npx vitest run src/dashboard/shell/__tests__/ruling-rows.test.ts` pass_
 
 - [ ] 8. Build the diff reader
   - File: src/dashboard/shell/wait-diff.ts
@@ -109,11 +109,11 @@ Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 
   - File: src/dashboard/shell/__tests__/ruling-view.test.ts
   - Test: src/dashboard/shell/__tests__/ruling-view.test.ts — `answerPayload(wait, picks, texts, notes)`
   - Test: src/dashboard/shell/__tests__/ruling-view.test.ts — `resolved(stage, seen)` for `answer`
-  - Note: `board-view.test.ts` keeps every asserted value; its local stage-name type at `:1624` needs no edit.
+  - Note: `board-view.test.ts` keeps every asserted value; its local stage-name type at `src/dashboard/shell/__tests__/board-view.test.ts:1624` needs no edit.
   - Purpose: The layout choice, the form rules and the stage rule live in pure code.
   - _Leverage: src/dashboard_frontend/src/modules/shell/stage.ts:13, src/dashboard_frontend/src/modules/shell/stage.ts:73-96, src/dashboard/shell/__tests__/board-view.test.ts:19-33, src/controller/runs.ts:1285-1287_
   - _Requirements: 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.9, 6.11_
-  - _Prompt: Task: Per design C8 "New pure module", C9 and design D6, D7, D10 (requirement 6 AC 2 to AC 5, AC 9, AC 11), create `ruling.ts` with `rulingLayout`, `initialValues`, `answerOf`, `canSubmit`, `answerPayload`, `securityLines` and `offersAbandon` as design C8 pins them. Add `'answer'` to `StageName` (`stage.ts:13`) and its `resolved` case (`:73-96`). Load both modules by dynamic import, as `board-view.test.ts:19-33` does | Restrictions: Type-only imports in `ruling.ts`; no React; do not change `responseStage` or `advance` | Success: `rulingLayout` gives `security`, `task`, `taskless`, `gate`, `retro-plan`, `merge` and `question` for one wait each; `initialValues` gives `recommended`, else empty; `canSubmit` is false with an unpicked radio, false with an empty `ruling` text, true when every radio is picked; `answerOf` prefers non-empty text over the pick on a free question with options; `answerPayload` appends a blank line, `Notes: ` and the notes to the first typed answer, puts notes in `note` when every answer is a pick, and adds `proposal:` keys for `retro-plan`; `securityLines` splits lead, findings and tail; `offersAbandon` is true only for an escalation or error with no `abandon` option; `resolved` for `answer` is true with the run gone or not `waiting`, false while `waiting`; `npx vitest run src/dashboard/shell/__tests__/ruling-view.test.ts src/dashboard/shell/__tests__/board-view.test.ts` passes_
+  - _Prompt: Task: Per design C8 "New pure module", C9 and design D6, D7, D10 (requirement 6 AC 2 to AC 5, AC 9, AC 11), create `ruling.ts` with `rulingLayout`, `initialValues`, `answerOf`, `canSubmit`, `answerPayload`, `securityLines` and `offersAbandon` as design C8 pins them. Add `'answer'` to `StageName` (`src/dashboard_frontend/src/modules/shell/stage.ts:13`) and its `resolved` case (`:73-96`). Load both modules by dynamic import, as `src/dashboard/shell/__tests__/board-view.test.ts:19-33` does | Restrictions: Type-only imports in `ruling.ts`; no React; do not change `responseStage` or `advance` | Success: `rulingLayout` gives `security`, `task`, `taskless`, `gate`, `retro-plan`, `merge` and `question` for one wait each; `initialValues` gives `recommended`, else empty; `canSubmit` is false with an unpicked radio, false with an empty `ruling` text, true when every radio is picked; `answerOf` prefers non-empty text over the pick on a free question with options; `answerPayload` appends a blank line, `Notes: ` and the notes to the first typed answer, puts notes in `note` when every answer is a pick, and adds `proposal:` keys for `retro-plan`; `securityLines` splits lead, findings and tail; `offersAbandon` is true only for an escalation or error with no `abandon` option; `resolved` for `answer` is true with the run gone or not `waiting`, false while `waiting`; `npx vitest run src/dashboard/shell/__tests__/ruling-view.test.ts src/dashboard/shell/__tests__/board-view.test.ts` passes_
 
 - [ ] 11. Render the ruling view in place of the answer sheet
   - File: src/dashboard_frontend/src/modules/shell/RulingView.tsx
@@ -126,7 +126,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 
   - Purpose: One screen per wait, every kind laid out for its decision.
   - _Leverage: src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:45-78, src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:210-260, src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/board.ts:152-163, e2e/worktree-board.spec.ts:47-106_
   - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.5, 3.6, 4.5, 4.7, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.8, 6.9, 6.10_
-  - _Prompt: Task: Per design C8 and design D12, create `RulingView.tsx` rendering header, body by layout and form as design C8 pins them, using the rules task 10 exports and fetching the two routes task 9 adds. `HomePage` (`:148-171`) renders it in place of the sheet and passes `tick` as `now`. Bridge: pass `stage={null}` and have `onAnswer` press key `wait:<id>` with the stage name task 10 adds; task 12 removes the bridge. Delete `AnswerSheet.tsx`. Seed runs `waiting` with `pauseRequested` (design D11). Run `npx playwright install chromium` first | Restrictions: Only token classes the shell already uses; no file link; no `/tmp/scratchpad` read | Success: a tagged escalation shows the header (kind, project, spec, wait id, age, run id, phase, step, `task 1`), the wait text, the task row with title, Success, TDD, the gate-note risk and every file, the detail as preformatted text, and the fixture commit's added line, with no `band-needs-you` once `now-answer-sheet` is visible; a wait whose run is gone shows `run record gone`; a gate-B wait shows `Approve` checked with `(recommended)` and `The plan`; a merge wait shows the PR number, `Merge` and `Hold`; a security wait shows three unchecked radios and a disabled `answer-submit`; a taskless escalation shows `no task: raised in the` and its phase; a removed worktree shows `worktree gone` and `answer-submit` enables once a ruling is typed; `grep -rn AnswerSheet src e2e` finds nothing; `npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts`, `npx playwright test -c playwright.worktree.config.ts e2e/worktree-ruling.spec.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_
+  - _Prompt: Task: Per design C8 and design D12, create `RulingView.tsx` rendering header, body by layout and form as design C8 pins them, using the rules task 10 exports and fetching the two routes task 9 adds. `HomePage` (`src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171`) renders it in place of the sheet and passes `tick` as `now`. Bridge: pass `stage={null}` and have `onAnswer` press key `wait:<id>` with the stage name task 10 adds; task 12 removes the bridge. Delete `AnswerSheet.tsx`. Seed runs `waiting` with `pauseRequested` (design D11). Run `npx playwright install chromium` first | Restrictions: Only token classes the shell already uses; no file link; no `/tmp/scratchpad` read | Success: a tagged escalation shows the header (kind, project, spec, wait id, age, run id, phase, step, `task 1`), the wait text, the task row with title, Success, TDD, the gate-note risk and every file, the detail as preformatted text, and the fixture commit's added line, with no `band-needs-you` once `now-answer-sheet` is visible; a wait whose run is gone shows `run record gone`; a gate-B wait shows `Approve` checked with `(recommended)` and `The plan`; a merge wait shows the PR number, `Merge` and `Hold`; a security wait shows three unchecked radios and a disabled `answer-submit`; a taskless escalation shows `no task: raised in the` and its phase; a removed worktree shows `worktree gone` and `answer-submit` enables once a ruling is typed; `grep -rn AnswerSheet src e2e` finds nothing; `npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts`, `npx playwright test -c playwright.worktree.config.ts e2e/worktree-ruling.spec.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_
 
 - [ ] 12. Keep the view on the answered wait until the run moves
   - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
@@ -143,7 +143,7 @@ Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 
   - File: e2e/worktree-ruling.spec.ts
   - Note: verification task: no `- Test:` seam, implementer-only; it changes no file. Requirement 6 AC 13 holds at base; the case at `src/controller/phases/__tests__/implementation.test.ts:857-873` is its regression guard.
   - Purpose: Prove the entry's five verification steps on the merged tree.
-  - _Leverage: src/controller/phases/__tests__/implementation.test.ts:857-873, playwright.worktree.config.ts:67_
+  - _Leverage: src/controller/phases/__tests__/implementation.test.ts:857-873, ./playwright.worktree.config.ts:67_
   - _Requirements: 1.1, 2.9, 4.5, 6.6, 6.13, 6.14_
   - _Prompt: Task: Run the full checks for the spec and confirm the entry's verification steps 1-5 map onto the cases tasks 3, 4, 11 and 12 added | Restrictions: Change no file; when a check fails, report it with the DESIGN-DEFECT flag naming the task whose files fail | Success: `npm run build`, `npm test`, `npx playwright test -c playwright.worktree.config.ts e2e/worktree-ruling.spec.ts e2e/worktree-board.spec.ts` and `npx vitest run src/controller/phases/__tests__/implementation.test.ts` pass; `grep -rn "scratchpad" src/dashboard_frontend/src/modules/shell/RulingView.tsx src/dashboard/shell/ruling-rows.ts src/dashboard/shell/wait-diff.ts` finds nothing_
 
@@ -167,3 +167,4 @@ Dependency order: run the tasks in number order. The chains are 1 → 4 and 1 
 ## Revision History
 
 - **v1** (2026-11-08) — Initial draft.
+  - **Lint pass.** 9 fixed (L-1,L-2,L-3,L-5,L-6,L-7,L-8,L-9,L-10). L-1/L-3/L-6/L-7/L-8/L-9 given directory-prefixed paths; `tsconfig.json` → `./tsconfig.json` and swept the sibling bare-root citation `playwright.worktree.config.ts` → `./playwright.worktree.config.ts` on the task 13 _Leverage line (house idiom, per design L-80). The three prose tokens the newly-resolvable `./tsconfig.json:20` would otherwise trip (tsc, bb6d32ff, SPEC_WORKFLOW_SHARED_ROOT) de-ticked on line 5. L-2 dropped the `task 5` token for "a later task" (scope note, not a dependency). L-5 is a false positive — the regex read example ledger text `gate: task 12` as a forward reference; changed the illustrative id to 2. Rejected: L-4 — task 6 is a schema-only guard routed implementer-only (D2; agent-rules routes such tasks with no `- Test:` seam), so the missing Test line is correct, not a defect.

````
