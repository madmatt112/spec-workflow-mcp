# Adversarial Review — verification-loop/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): verification-loop tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `verification-loop` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 77f4aa6

````diff
diff --git a/.spec-workflow/specs/verification-loop/tasks.md b/.spec-workflow/specs/verification-loop/tasks.md
index 906a465..3b44fda 100644
--- a/.spec-workflow/specs/verification-loop/tasks.md
+++ b/.spec-workflow/specs/verification-loop/tasks.md
@@ -8,11 +8,11 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
   - File: src/controller/merge.ts
   - File: src/controller/__tests__/merge.test.ts
   - Test: src/controller/__tests__/merge.test.ts — evaluatePullRequest(pr)
-  - Add the design C1 types and fields; tag each blocking reason where `evaluatePullRequest` pushes it (`src/controller/merge.ts:357-405`); copy `blocking` and `base` onto the `blocked` return of `mergeByRule` (`:588-591`).
+  - Add the design C1 types and fields; tag each blocking reason where `evaluatePullRequest` (`src/controller/merge.ts:319`) pushes it (`src/controller/merge.ts:357-405`); copy `blocking` and `base` onto the `blocked` return (`src/controller/merge.ts:588-591`) of `mergeByRule` (`src/controller/merge.ts:568`).
   - Purpose: give the run loop a structured reason kind (R1 AC 1) with the merge rule still model-free (R1 AC 11).
   - _Leverage: src/controller/merge.ts (`PR_VIEW_FIELDS` :38-39, `MergeEvaluation` :79-95, `MergeStageResult` :100-111, `PullRequestEvaluation` :300-308)_
   - _Requirements: 1.1, 1.11_
-  - _Prompt: Task: Implement design C1 per R1 AC 1 and AC 11. Export `BlockingKind` and `BlockingReason`; add `MergeEvaluation.blocking`, `PullRequestEvaluation.head` and `.base`, `MergeStageResult.blocking` and `.base`; add `baseRefName` to `PR_VIEW_FIELDS`. Set the kind from the branch that pushes each reason: failed workflow run gives `check` with `name` and `runId`, failed commit status gives `check` with no `runId`, `CONFLICTING` gives `conflict`, any other non-MERGEABLE, non-UNKNOWN value gives `other`, head mismatch gives `head`, attribution trailer gives `trailer`. Tests in merge.test.ts: one case per kind, a pending reason gets no entry, `head` and `base` read from the view | Restrictions: never derive a kind from reason text; `blocking` is set only when not ready, not pending and not unreadable; no new `gh` call; the exact `{ ready: true, reasons: [] }` assertions at merge.test.ts:172 and :255 and the argv counts at :471, :486 and :497 keep their values (an illustrative minimum — widen to every exact assertion the change touches) | Success: each of the six kinds is asserted from its signal; a pending-only result has no `blocking`; a ready result still equals `{ ready: true, reasons: [] }`; `head` and `base` on the evaluation equal the view's `headRefOid` and `baseRefName`; the blocked `MergeStageResult` carries `blocking` and `base`; `npx tsc --noEmit` and merge.test.ts pass_
+  - _Prompt: Task: Implement design C1 per R1 AC 1 and AC 11. Export `BlockingKind` and `BlockingReason`; add `MergeEvaluation.blocking`, `PullRequestEvaluation.head` and `.base`, `MergeStageResult.blocking` and `.base`; add `baseRefName` to `PR_VIEW_FIELDS`. Set the kind from the branch that pushes each reason: failed workflow run gives `check` with `name` and `runId`, failed commit status gives `check` with no `runId`, `CONFLICTING` gives `conflict`, any other non-MERGEABLE, non-UNKNOWN value gives `other`, head mismatch gives `head`, attribution trailer gives `trailer`. Tests in src/controller/__tests__/merge.test.ts: one case per kind, a pending reason gets no entry, `head` and `base` read from the view | Restrictions: never derive a kind from reason text; `blocking` is set only when not ready, not pending and not unreadable; no new `gh` call; the exact `{ ready: true, reasons: [] }` assertions at src/controller/__tests__/merge.test.ts:172 and :255 and the argv counts at src/controller/__tests__/merge.test.ts:471, :486 and :497 keep their values (an illustrative minimum — widen to every exact assertion the change touches) | Success: each of the six kinds is asserted from its signal; a pending-only result has no `blocking`; a ready result still equals `{ ready: true, reasons: [] }`; `head` and `base` on the evaluation equal the view's `headRefOid` and `baseRefName`; the blocked `MergeStageResult` carries `blocking` and `base`; `npx tsc --noEmit` and src/controller/__tests__/merge.test.ts pass_
 
 - [ ] 2. New-dependency reader module
   - File: src/controller/new-deps.ts
@@ -33,23 +33,23 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
   - Purpose: carry the new-dependency list on every PR read and log it once per change (R4 AC 1, 3, 5-7).
   - _Leverage: src/controller/merge.ts `makeRead` (:581-583), src/controller/ledger.ts `note`_
   - _Requirements: 4.1, 4.3, 4.5, 4.6, 4.7_
-  - _Prompt: Task: Per R4 AC 1, 3, 5, 6 and 7 and design C2, call the reader task 2 exports from `mergeByRule` when the evaluation is readable and has `head` and `base`; put a non-empty list on the `PrRead` as `newDependencies`; widen `MergeStageDeps.ledger` to `prMerged`, `note` and `path`; write the `new dependencies:` note only when its text differs from the newest one for that PR (Data Models). Tests in merge.test.ts with a view that carries `baseRefName` and a temp repo: list on the read, one note over two passes, `none` after a logged list, `unreadable` note once; regression guard (already true at base, R4 AC 7): the verdict and reasons are unchanged | Restrictions: no new `gh` call, so the argv counts at merge.test.ts:471, :486 and :497 keep their values; a view without `baseRefName` (the existing `READY_VIEW` at merge.test.ts:59) skips the read and writes no note (design D14); never throw | Success: a PR adding a dependency carries `newDependencies` on its read; two passes write one note; a changed list writes one more; an empty list after a logged one writes one `none` note; an unreadable read writes one note and keeps the verdict and reasons; a view without `baseRefName` writes no note; existing merge.test.ts assertions pass unchanged_
+  - _Prompt: Task: Per R4 AC 1, 3, 5, 6 and 7 and design C2, call the reader task 2 exports from `mergeByRule` when the evaluation is readable and has `head` and `base`; put a non-empty list on the `PrRead` as `newDependencies`; widen `MergeStageDeps.ledger` to `prMerged`, `note` and `path`; write the `new dependencies:` note only when its text differs from the newest one for that PR (Data Models). Tests in src/controller/__tests__/merge.test.ts with a view that carries `baseRefName` and a temp repo: list on the read, one note over two passes, `none` after a logged list, `unreadable` note once; regression guard (already true at base, R4 AC 7): the verdict and reasons are unchanged | Restrictions: no new `gh` call, so the argv counts at src/controller/__tests__/merge.test.ts:471, :486 and :497 keep their values; a view without `baseRefName` (the existing `READY_VIEW` at src/controller/__tests__/merge.test.ts:59) skips the read and writes no note (design D14); never throw | Success: a PR adding a dependency carries `newDependencies` on its read; two passes write one note; a changed list writes one more; an empty list after a logged one writes one `none` note; an unreadable read writes one note and keeps the verdict and reasons; a view without `baseRefName` writes no note; existing src/controller/__tests__/merge.test.ts assertions pass unchanged_
 
 - [ ] 4. Run page new-dependency chip
   - File: src/dashboard/shell/types.ts
   - File: src/dashboard_frontend/src/modules/shell/types.ts
   - File: src/dashboard_frontend/src/modules/shell/RunPage.tsx
   - File: e2e/worktree-shell.spec.ts
-  - Add `newDependencies` to both `ControllerPrRead` hand copies (`src/dashboard/shell/types.ts:161-172`, `src/dashboard_frontend/src/modules/shell/types.ts:184-195`); render the chip in `PrPanel` (`RunPage.tsx:345-394`) per design C8.
+  - Add `newDependencies` to both `ControllerPrRead` hand copies (`src/dashboard/shell/types.ts:161-172`, `src/dashboard_frontend/src/modules/shell/types.ts:184-195`); render the chip in `PrPanel` (`src/dashboard_frontend/src/modules/shell/RunPage.tsx:345-394`) per design C8.
   - Purpose: show the operator that a PR adds a dependency (R4 AC 3-4). kind: e2e — the Playwright suite is the only test of this panel, so the task runs implementer-only.
-  - _Leverage: RunPage.tsx `CI_CHIP_STYLES` (:332-337), e2e/worktree-shell.spec.ts seeded record (:163-173) and panel assertions (:317-330)_
+  - _Leverage: src/dashboard_frontend/src/modules/shell/RunPage.tsx `CI_CHIP_STYLES` (:332-337), e2e/worktree-shell.spec.ts seeded record (:163-173) and panel assertions (:317-330)_
   - _Requirements: 4.3, 4.4_
   - _Prompt: Task: Per R4 AC 3 and AC 4 and design C8, add the optional field to both hand copies, matching the field task 3 added to `PrRead`; when non-empty, render a `new dependency` chip with the `pending` chip classes and `data-testid` `pr-deps-<repo>-<number>`, then the names joined by ", ". Extend the seeded run record in e2e/worktree-shell.spec.ts with `newDependencies` on one read and assert the chip text and names; assert the other read has no chip | Restrictions: run `npx playwright install chromium`, then `npx playwright test e2e/worktree-shell.spec.ts`; no new colour token; existing panel assertions (:317-330) keep their values | Success: the seeded read shows the chip and the names; a read without the field shows none; both hand copies match `PrRead`; `npx tsc --noEmit`, the frontend build and the suite pass_
 
 - [ ] 5. Merge-fix and security brief variants
   - File: src/tools/brief-templates.ts
   - File: src/tools/__tests__/harness.test.ts
-  - Test: src/tools/__tests__/harness.test.ts — harnessHandler({ action: 'brief', template, specName, values })
+  - Test: src/tools/__tests__/harness.test.ts — `harnessHandler({ action: 'brief', template, specName, values })`
   - Route `fix` variants `merge` and `security` and `verifier` variants `security` and `security-narrow` to four new renderers, per design C4.
   - Purpose: briefs for the merge fix round (R1 AC 2-3) and the security pass and fix rounds (R3 AC 3-7).
   - _Leverage: src/tools/brief-templates.ts `renderCiFix` (:682-705), `renderFix` (:713-750), `renderVerifier` (:833-848), template entries (:1553-1562)_
@@ -71,7 +71,7 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
   - File: src/controller/runs.ts
   - File: src/controller/__tests__/runs.test.ts
   - Test: src/controller/__tests__/runs.test.ts — runOnce(deps, runId)
-  - In `runMergeStageStep` case `blocked` (`src/controller/runs.ts:669-682`) run the round task 6 builds when eligible, else the `error` wait with the round endings, per design C3 "Wiring".
+  - In `runMergeStageStep` (`src/controller/runs.ts:611`), case `blocked` (`src/controller/runs.ts:669-682`), run the round task 6 builds when eligible, else the `error` wait with the round endings, per design C3 "Wiring".
   - Purpose: the run fixes its own red or conflicted PR before it asks the operator (R1 AC 1, 4-9).
   - _Leverage: src/controller/runs.ts `stepLifecycle`, `stepActivityForwarder` (:425-449), `nextMergeCheck`, `waitAnd` (:534-544)_
   - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.12_
@@ -95,7 +95,7 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
   - Purpose: unflagged task steps run on the Sonnet route; flagged and non-task steps keep the profile (R2 AC 1-2, 4, 6, 8-11).
   - _Leverage: src/controller/phases/gates.ts class-a call (:291-294); `stepUsage` (:371-381)_
   - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.8, 2.9, 2.10, 2.11_
-  - _Prompt: Task: Per R2 AC 1, 2, 4, 6 and 8-11 and design C5, compute the route with the function task 8 exports at every task step start (implement attempts :629-634, checks re-spawn :658-661, task fix rounds :774-778) and pass it to `runModelStep`, which then fills `StepSpec.model` and `.effort` and the `spawn.start` model and effort and `spawn.end` model. Write the route note at the task's first step and again when the route changes. Tests: the stub init event `argv` has `--model claude-sonnet-5` for a task on `src/a.js` and `--model claude-opus-4-8` for a task on `package.json` (the fixture lists it, implementation.test.ts:104); spawn rows match; one route note per task; regression guard (already true at base, R2 AC 11): the test author, verifier and repair steps keep their profiles | Restrictions: repair (:994-997) and reconcile (:1137-1140) pass no override; no `--resume`; existing implementation.test.ts assertions keep their values | Success: the unflagged task's implementer `argv` carries `--model claude-sonnet-5` and the flagged task's carries `--model claude-opus-4-8`; each `spawn.start` model and effort and `spawn.end` model equal the `argv` values; each task gets one route note; the test author, verifier and repair steps run on their profile models; implementation.test.ts passes_
+  - _Prompt: Task: Per R2 AC 1, 2, 4, 6 and 8-11 and design C5, compute the route with the function task 8 exports at every task step start (implement attempts :629-634, checks re-spawn :658-661, task fix rounds :774-778) and pass it to `runModelStep`, which then fills `StepSpec.model` and `.effort` and the `spawn.start` model and effort and `spawn.end` model. Write the route note at the task's first step and again when the route changes. Tests: the stub init event `argv` has `--model claude-sonnet-5` for a task on `src/a.js` and `--model claude-opus-4-8` for a task on `package.json` (the fixture lists it, src/controller/phases/__tests__/implementation.test.ts:104); spawn rows match; one route note per task; regression guard (already true at base, R2 AC 11): the test author, verifier and repair steps keep their profiles | Restrictions: repair (:994-997) and reconcile (:1137-1140) pass no override; no `--resume`; existing implementation.test.ts assertions keep their values | Success: the unflagged task's implementer `argv` carries `--model claude-sonnet-5` and the flagged task's carries `--model claude-opus-4-8`; each `spawn.start` model and effort and `spawn.end` model equal the `argv` values; each task gets one route note; the test author, verifier and repair steps run on their profile models; src/controller/phases/__tests__/implementation.test.ts passes_
 
 - [ ] 10. Security pass state module
   - File: src/controller/phases/security-pass.ts
@@ -131,7 +131,7 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
   - File: src/controller/runs.ts
   - File: src/controller/__tests__/runs.test.ts
   - Test: src/controller/__tests__/runs.test.ts — runOnce(deps, runId)
-  - Map `security-open` in `handleImplementationOutcome` (`src/controller/runs.ts:1015-1056`) to one `escalation` wait; pass the security answers to the phase (:859-867); skip them in `escalationRulings` (:997-1008); per design C7.
+  - Map `security-open` in `handleImplementationOutcome` (`src/controller/runs.ts:1015-1056`) to one `escalation` wait; pass the security answers to the phase (`src/controller/runs.ts:859-867`); skip them in `escalationRulings` (`src/controller/runs.ts:997-1008`); per design C7.
   - Purpose: the operator rules on findings that survived the loop (R3 AC 8-9).
   - _Leverage: `waitAnd` (:534-544); src/controller/controller.ts abandon path (:353-358)_
   - _Requirements: 3.8, 3.9_
@@ -164,3 +164,4 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
 ## Revision History
 
 - **v1** (2026-10-21) — Initial draft.
+  - **Lint pass.** 11 fixed; rejected: L-2/L-3 `blocking`/`base` are new fields task 1 adds (not in source); L-6/L-10 `newDependencies` is a new field; L-15 `classAItems` is a new closure; L-9 info only — task 4 is `kind: e2e` (D2), its only test is the Playwright suite in File:, which vitest cannot run.

````
