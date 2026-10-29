# Adversarial Review — run-pause/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): run-pause tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `run-pause` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 6d66c506

````diff
diff --git a/.spec-workflow/specs/run-pause/tasks.md b/.spec-workflow/specs/run-pause/tasks.md
index d652b059..2567927c 100644
--- a/.spec-workflow/specs/run-pause/tasks.md
+++ b/.spec-workflow/specs/run-pause/tasks.md
@@ -7,7 +7,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
 - [ ] 1. Durable hold and write ownership in the state module
   - File: src/controller/state.ts
   - File: src/controller/__tests__/pause-request.test.ts
-  - Test: src/controller/__tests__/pause-request.test.ts — writeRun(record, { ownsPauseRequest: true })
+  - Test: src/controller/__tests__/pause-request.test.ts — `writeRun(record, { ownsPauseRequest: true })`
   - Note: the owned set-and-clear case already holds at base (the field passes through): regression guard, not a red test. The red cases are the stale-write keep, the terminal drop, the concurrent pair and `readRunSync`.
   - Note: `src/controller/__tests__/paused-at.test.ts` and `src/controller/__tests__/state.test.ts` are not edited; no value they assert changes.
   - Purpose: One durable hold that a stale driver or controller write cannot drop.
@@ -18,7 +18,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
 - [ ] 2. Driver stop points and the operator pause
   - File: src/controller/runs.ts
   - File: src/controller/__tests__/runs.test.ts
-  - Test: src/controller/__tests__/runs.test.ts — runOnce(deps(fx, { isPauseRequested }), 'run-20261011-000000')
+  - Test: src/controller/__tests__/runs.test.ts — `runOnce(deps(fx, { isPauseRequested }), 'run-20261011-000000')`
   - Note: the `deps` helper (104-119) gains no default, so every existing runs.test.ts case runs unheld and no value it asserts changes.
   - Note: the merge-stage-entry stop (design C3 point 4) has no dedicated case: any hold set while the last implementation step runs is caught first by an earlier phase stop point (for example the CI poll's shouldStop, `src/controller/phases/implementation.ts:1339-1340`); the in-flight case asserts only the observable outcome.
   - Purpose: A held run finishes its step, acts on the result, then parks instead of spawning the next step.
@@ -31,7 +31,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
   - File: src/controller/runs.ts
   - File: src/controller/phases/__tests__/document.test.ts
   - File: src/controller/__tests__/runs.test.ts
-  - Test: src/controller/phases/__tests__/document.test.ts — runDocumentPhase({ ...ctx, shouldStop: () => 'operator' })
+  - Test: src/controller/phases/__tests__/document.test.ts — `runDocumentPhase({ ...ctx, shouldStop: () => 'operator' })`
   - Count: `DocumentPhaseOutcome.result` gains `stopped`. `grep -n "outcome.result\|retry.result" src/controller/runs.ts` finds every branch that reads it; today an unmatched result falls through to the error path at 1232-1261.
   - Note: existing document.test.ts and runs.test.ts cases pass no shouldStop and no hold; no value they assert changes.
   - Purpose: Give the document phase its first stop check, at the one point where re-entry runs no step twice.
@@ -63,7 +63,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
   - File: src/dashboard/multi-server.ts
   - File: src/controller/runs.ts
   - File: src/dashboard/__tests__/controller-dashboard-routes.test.ts
-  - Test: src/dashboard/__tests__/controller-dashboard-routes.test.ts — fetch(`${base}/api/controller/runs/${id}/pause`, auth({ method: 'POST' }))
+  - Test: src/dashboard/__tests__/controller-dashboard-routes.test.ts — fetch(`${base}/api/controller/runs/${id}/pause`, `auth({ method: 'POST' })`)
   - Note: the 401 without the secret and the resume 409 `not-paused` hold at base: regression guards. Existing route tests and the listRunsForWire tests (runs.test.ts 430-453) keep every asserted value.
   - Purpose: Expose pause beside cancel, resume and discard, and tell the frontend a pending pause from an applied one.
   - _Leverage: src/dashboard/multi-server.ts (cancel and resume routes at 808-822); src/controller/runs.ts (ControllerRunRow and toRow at 1336-1363); routes test startServer and auth at 71-88_
@@ -97,7 +97,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
   - Purpose: Track the decomposition's deploy scenario, which the normal loop cannot run, so the retrospective waits for it.
   - _Leverage: .spec-workflow/specs/advisor/verification-evidence.md (format at 1-21); scripts/sdd-self-update.sh (step_live at 89-97, deploy and restart at 297-308)_
   - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
-  - _Prompt: Task: Per design Testing Strategy (end-to-end) and agent-rules "Fixtures and live verification", write verification-evidence.md on the feature branch in the advisor file's format: a short preamble saying the automated cases live in the controller, route and e2e suites, then one `(deploy) pending —` line covering Requirement 7 AC 1 to AC 5: pause a run with a step in flight, the route answers at once, the step commits, no next step starts, the row reads `paused by you`; scripts/sdd-self-update.sh passes its in-flight check, deploys and restarts; the run is still paused/operator; Resume starts the next step; Pause on an idle run applies at once. State that the orchestrator relocates the file to the main spec store at the merge gate and that it must read passed before the retrospective opens | Restrictions: No code change; do not run the scenario | Success: The file exists with the preamble and exactly one pending line naming all five checks and the relocation step_
+  - _Prompt: Task: Per design C10 and Testing Strategy (end-to-end) and agent-rules "Fixtures and live verification", write verification-evidence.md on the feature branch in the advisor file's format: a short preamble saying the automated cases live in the controller, route and e2e suites, then one `(deploy) pending —` line covering Requirement 7 AC 1 to AC 5: pause a run with a step in flight, the route answers at once, the step commits, no next step starts, the row reads `paused by you`; scripts/sdd-self-update.sh passes its in-flight check, deploys and restarts; the run is still paused/operator; Resume starts the next step; Pause on an idle run applies at once. State that the orchestrator relocates the file to the main spec store at the merge gate and that it must read passed before the retrospective opens | Restrictions: No code change; do not run the scenario | Success: The file exists with the preamble and exactly one pending line naming all five checks and the relocation step_
 
 ## Scope notes
 
@@ -118,3 +118,4 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
 ## Revision History
 
 - **v1** (2026-10-29) — Initial draft.
+  - **Lint pass.** 2 fixed; rejected: none.

````
