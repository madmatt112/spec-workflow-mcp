# Adversarial Review — controller-liveness-and-push/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): controller-liveness-and-push tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `controller-liveness-and-push` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 7de50f48

````diff
diff --git a/.spec-workflow/specs/controller-liveness-and-push/tasks.md b/.spec-workflow/specs/controller-liveness-and-push/tasks.md
index 33e766d5..1997e495 100644
--- a/.spec-workflow/specs/controller-liveness-and-push/tasks.md
+++ b/.spec-workflow/specs/controller-liveness-and-push/tasks.md
@@ -73,7 +73,7 @@ Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing
   - Test: src/controller/__tests__/runs.test.ts — listRunsForWire(driven)
   - Test: src/dashboard/shell/__tests__/shell-feed.test.ts — new ShellFeed(projects, send, { drivenRuns }).start()
   - Bridge: no caller passes a set until task 9, so every row reads `driven: false`.
-  - `driven` is required and `tsconfig.json:19` compiles tests, so the `run()` helper at `sidebar-rows.test.ts:189-198` gains `driven: false`.
+  - `driven` is required and `tsconfig.json:19` compiles tests, so the `run()` helper at `src/dashboard/shell/__tests__/sidebar-rows.test.ts:189-198` gains `driven: false`.
   - Existing assertions: `runs.test.ts`, `shell-feed.test.ts` and `sidebar-rows.test.ts` assert no value this changes.
   - Purpose: Put both facts on the row the dashboard reads.
   - _Leverage: src/controller/runs.ts, src/dashboard/shell/shell-feed.ts_
@@ -85,7 +85,7 @@ Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing
   - Test: src/controller/__tests__/controller.test.ts — controller.drivenRuns() and a one-shot throw through the mcpConfigFor option
   - Add the driven-set reader, the crash wait and the drive-end change event.
   - Regression guard (requirement 2.6, holds at base): `onWaitChange` already re-queues on `retry` and cancels on `abandon`; only the wait's creation is new.
-  - Existing assertions: the one `change` listener in `controller.test.ts:496-506` spans a pause with no drive, so the drive-end emit alters no asserted value.
+  - Existing assertions: the one `change` listener in `src/controller/__tests__/controller.test.ts:496-506` spans a pause with no drive, so the drive-end emit alters no asserted value.
   - Purpose: Make a crash a wait, never a silent `running`.
   - _Leverage: src/controller/controller.ts, src/controller/waits.ts_
   - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_
@@ -122,7 +122,7 @@ Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing
   - Test: src/advisor/__tests__/summary.test.ts — buildSummary({ now })
   - Add the three helpers and the `NotifyConfig` type; `pushState` reads through them.
   - Bridge: `pushConfigPath` stays exported for `src/advisor/push.ts` until task 12.
-  - Existing assertions: `home.test.ts:67`, `:79` and `summary.test.ts:411` still hold; this task changes no value they assert.
+  - Existing assertions: `src/advisor/__tests__/home.test.ts:67`, `src/advisor/__tests__/home.test.ts:79` and `src/advisor/__tests__/summary.test.ts:411` still hold; this task changes no value they assert.
   - Purpose: Give both config readers one validity rule.
   - _Leverage: src/advisor/home.ts, src/advisor/summary.ts_
   - _Requirements: 4.1, 4.2_
@@ -131,7 +131,7 @@ Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing
 - [ ] 11. Build the ntfy message from the wait's own fields
   - File: src/advisor/push.ts
   - Test: src/advisor/__tests__/push.test.ts — buildMessage(wait, projectName, reminder)
-  - Export the pure builder; nothing calls it until task 12.
+  - Export the pure builder; it has no caller yet, so the unused export compiles green on its own.
   - Existing assertions: `push.test.ts` assertions are untouched here.
   - Purpose: Fix the message text with no model and no leaked path.
   - _Leverage: src/advisor/push.ts_
@@ -147,7 +147,7 @@ Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing
   - Read `docs.ntfy.sh/publish` first (requirement 4.4): the design could not.
   - Remove task 10's bridge, so `push.json` is read nowhere.
   - Regression guards (hold at base): one retry then one `push.failure` row (4.5); first start sends nothing (4.6); the watchdog and browser notification stay outside this task's list (4.7).
-  - Existing assertions: these change exactly, at least `push.test.ts:211-212`, `:304-306` and `advisor-e2e.test.ts:438-441`, `:461`, `home.test.ts:14`, `:67`, `:79`.
+  - Existing assertions: these change exactly, at least `src/advisor/__tests__/push.test.ts:211-212`, `src/advisor/__tests__/push.test.ts:304-306` and `src/advisor/__tests__/advisor-e2e.test.ts:438-441`, `src/advisor/__tests__/advisor-e2e.test.ts:461`, `src/advisor/__tests__/home.test.ts:14`, `src/advisor/__tests__/home.test.ts:67`, `src/advisor/__tests__/home.test.ts:79`.
   - Purpose: Reach the phone through ntfy.
   - _Leverage: src/advisor/push.ts_
   - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, NFR_
@@ -169,7 +169,7 @@ Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing
   - Test: src/controller/__tests__/liveness-e2e.test.ts — launchSpec(project, input, controller)
   - Widen the guard to every state that names no spec.
   - Regression guards (hold at base): `active` keeps its spec (6.3); a null name keeps the routing reason (6.4); the two states already consulted stay as they are. `launchSpec`'s directory code is unchanged (6.5), but scenario 5 is red until the guard widens.
-  - Existing assertions: `run-setup.test.ts:505-511` and `:516-529` keep their values.
+  - Existing assertions: `src/dashboard/harness/__tests__/run-setup.test.ts:505-511` and `src/dashboard/harness/__tests__/run-setup.test.ts:516-529` keep their values.
   - Purpose: Never block Launch on a routing state that names no spec.
   - _Leverage: src/dashboard/harness/run-setup.ts, src/core/index-generator.ts_
   - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
@@ -202,9 +202,10 @@ Tasks run in number order, and each leaves `npx tsc --noEmit` and every existing
 - Deferred, as the requirements fix: deriving and rendering stalled, and any Re-drive button. The only frontend edit is the type declaration in task 6.
 - Open item: requirement 4.4's ntfy check runs first in task 12, which escalates if the page disagrees or the fetch is denied.
 - The decomposition's "at most every 10 s" check is proved in task 2 on fake timers (D5), not in the end-to-end file.
-- Known gap, not in scope: the Now page's idle row reads the routing state directly (`src/dashboard/shell/now-model.ts:131-132`), so it can still show a disabled reason where the setup view now offers a spec. Requirement 6 names `buildSetupView` only.
+- Known gap, not in scope: the Now page's idle row reads the routing state directly (`src/dashboard/shell/now-model.ts:131-132`), so it can still show a disabled reason where the setup view now offers a spec. Requirement 6 names `buildSetupView` (`src/dashboard/harness/run-setup.ts:146-217`) only.
 - Carried items from design: none.
 
 ## Revision History
 
 - **v1** (2026-11-03) — Initial draft.
+  - **Lint pass.** 16 fixed; rejected: L-1 ("Enumerated, no change" is a design meta-section of deliberately untouched components — no task implements it, and settlePass/launchSpec/sidebar-rows already appear as regression-guard references in tasks 8, 9, 14), L-2 (`tsconfig.json` is the sole tsconfig at the code root; `tsconfig.json` is its path from the root, with no directory to prefix and nothing to re-resolve wrong), L-18 (task 15's only source edit is the non-executing `src/advisor/push.ts` header comment; the task declares no seam and verifies via tsc and the `push.json` grep).

````
