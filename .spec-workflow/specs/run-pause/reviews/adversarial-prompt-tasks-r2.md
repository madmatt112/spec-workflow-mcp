# Adversarial Review — run-pause/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-tasks.md using this format:

```markdown
# Adversarial Review Memory — tasks
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): run-pause tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 5676d25a

````diff
diff --git a/.spec-workflow/specs/run-pause/tasks.md b/.spec-workflow/specs/run-pause/tasks.md
index 2567927c..f7187e0c 100644
--- a/.spec-workflow/specs/run-pause/tasks.md
+++ b/.spec-workflow/specs/run-pause/tasks.md
@@ -1,6 +1,6 @@
 # Tasks Document
 
-Document version: v1
+Document version: v2
 
 Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds the durable hold to the state module with no reader; tasks 2 and 3 teach the driver and the document phase to stop on it, still with no producer; task 4 wires the controller's pause, resume and start guard, task 5 the settle pass, wait answers and restart, task 6 the route and the wire field; tasks 7 and 8 change the frontend; task 9 writes the live-verification line. Each task leaves `npx tsc --noEmit`, `npm run build:dashboard` and every existing vitest and worktree e2e suite green with no asserted value changed. No task touches an agent-rules sensitive path and no task creates a new source module, so the planned verifier spend is the default routing only. Task 9 is a measurement task with no `- Test:` seam (implementer-only).
 
@@ -13,7 +13,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
   - Purpose: One durable hold that a stale driver or controller write cannot drop.
   - _Leverage: src/controller/state.ts (RunRecord at 67-101, writeJsonAtomic at 322-327, the sync read in listRunsSync at 348-365, writeRun at 388-394)_
   - _Requirements: 2.5, 2.7, 3.5, 5.1, NFR Reliability_
-  - _Prompt: Task: Per design C1 and Requirement 2 AC 7 and Requirement 5 AC 1, add `RunRecord.pauseRequested` (ISO string), export `OPERATOR_PAUSE = 'operator'`, add the optional trailing `opts?: { ownsPauseRequest?: boolean }` to writeRun, and export `readRunSync(id)`. Serialise writeRun per run id in-process with a promise chain; inside one section read `run.json` and write. Without ownsPauseRequest the written pauseRequested is the on-disk value; with it, the incoming value (set or absent). A `done`, `abandoned` or `error` status writes no pauseRequested whatever the options. The pausedAt rule at 388-394 is unchanged. readRunSync returns undefined for a missing or unparsable file. Write the new vitest file with temp SDD_HOME isolation like paused-at.test.ts | Restrictions: Every existing writeRun call site keeps its meaning with no edit; pauseReason stays a free string; no `v` bump; a rejected write must not stall later writes for that id | Success: A normal write over an on-disk pauseRequested keeps it; an owned write sets it and an owned write without it clears it; a write with a terminal status drops it; a stale normal write and an owned set started together through Promise.all end with the field set; readRunSync returns the written record and undefined for a missing id; paused-at.test.ts and state.test.ts pass unchanged; tsc is clean_
+  - _Prompt: Task: Per design C1 and Requirement 2 AC 7 and Requirement 5 AC 1, add `RunRecord.pauseRequested` (ISO string), export `OPERATOR_PAUSE = 'operator'`, add the optional trailing `opts?: { ownsPauseRequest?: boolean }` to writeRun, and export `readRunSync(id)`. Serialise writeRun per run id in-process with a promise chain; inside one section read `run.json` and write. Without ownsPauseRequest the written pauseRequested is the on-disk value; with it, the incoming value (set or absent). A `done`, `abandoned` or `error` status writes no pauseRequested whatever the options. The pausedAt rule at 388-394 is unchanged. readRunSync returns undefined for a missing or unparsable file. Write the new vitest file with temp SDD_HOME isolation like paused-at.test.ts | Restrictions: Every existing writeRun call site keeps its meaning with no edit; pauseReason stays a free string; no `v` bump; a rejected write must not stall later writes for that id | Success: A normal write over an on-disk pauseRequested keeps it; an owned write sets it and an owned write without it clears it; a write with a terminal status drops it; a stale normal write and an owned set started together through Promise.all end with the field set; readRunSync returns the written record, undefined for a missing id, and undefined for an unparsable file; paused-at.test.ts and state.test.ts pass unchanged; tsc is clean_
 
 - [ ] 2. Driver stop points and the operator pause
   - File: src/controller/runs.ts
@@ -24,7 +24,7 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
   - Purpose: A held run finishes its step, acts on the result, then parks instead of spawning the next step.
   - _Leverage: src/controller/runs.ts (RunDeps at 388-411, save at 532-537, pause at 539-542, runMergeStageStep at 621-768, runOnce at 770-989, handleCloseoutOutcome at 1038-1063, handleImplementationOutcome at 1120-1181, handleRetrospectiveOutcome at 1184-1206)_
   - _Requirements: 2.1, 2.2, 2.3, 2.6, 5.3, 5.4, 7.1_
-  - _Prompt: Task: Per design C3 points 1 to 4 and the driver half of C5, add the optional `RunDeps.isPauseRequested?(runId)`; absent means never held. pause (539-542) keeps its signature and, when isPauseRequested is true for the run, writes pauseReason set to the operator reason constant task 1 exports and no resumeAt, whatever the caller passed (Requirement 2 AC 6). One helper returns `cancelled`, then `operator`, then `usage-window`, else null, and replaces the three inline shouldStop lambdas at 933, 964 and 982. At the runOnce loop top (804-806), after the cancel check, a held run pauses and returns; when resumingMerge is true the same write sets the merge cursor `{ phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 }`. runMergeStageStep stops a held run after its hasMerged return (624) with that cursor, and in the blocked branch after the cancel guard (696), returning stop. A stopped outcome with reason operator pauses in the three handlers at 1045-1048, 1127-1132 and 1188-1191. Add runs.test.ts cases | Restrictions: Never signal or kill a step; leave the cancelled and usage-window branches as they are; do not touch the document phase call (task 3) or the controller (task 4) | Success: A held running record ends paused with pauseReason operator, no resumeAt, no inFlight, and the stub consumed no step; with a hold that is false on its first read and true after, a document step that classifies usage-limit (the fixture at 348-366) ends paused/operator with no resumeAt; a held record seeded merging with an implementation cursor ends paused/operator with cursor stepKind merge and no `pr merge` gh call; a hold set from the setInFlight dep while the last implementation step runs, with the mergeable PR of the auto test at 574-613, leaves the PR unmerged (no `pr merge` gh call) and the run paused/operator; existing runs.test.ts cases pass unchanged; tsc is clean_
+  - _Prompt: Task: Per design C3 points 1 to 4 and the driver half of C5, add the optional `RunDeps.isPauseRequested?(runId)`; absent means never held. pause (539-542) keeps its signature and, when isPauseRequested is true for the run, writes pauseReason set to the operator reason constant task 1 exports and no resumeAt, whatever the caller passed (Requirement 2 AC 6). One helper returns `cancelled`, then `operator`, then `usage-window`, else null, and replaces the three inline shouldStop lambdas at 933, 964 and 982. At the runOnce loop top (804-806), after the cancel check, a held run pauses and returns; when resumingMerge is true the same write sets the merge cursor `{ phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 }`. runMergeStageStep stops a held run after its hasMerged return (624) with that cursor, and in the blocked branch after the cancel guard (696), returning stop. A stopped outcome with reason operator pauses in the three handlers at 1045-1048, 1127-1132 and 1188-1191. Add runs.test.ts cases | Restrictions: Never signal or kill a step; leave the cancelled and usage-window branches as they are; do not touch the document phase call (task 3) or the controller (task 4) | Success: A held running record ends paused with pauseReason operator, no resumeAt, no inFlight, and the stub consumed no step; with a hold that is false on its first read and true after, a document step that classifies usage-limit (the fixture at 348-366) ends paused/operator with no resumeAt; a held record seeded merging with an implementation cursor ends paused/operator with cursor stepKind merge and no `pr merge` gh call; a hold set from the setInFlight dep while the last implementation step runs, with the mergeable PR of the auto test at 574-613, leaves the PR unmerged (no `pr merge` gh call) and the run paused/operator; a run that enters the merge stage unheld, reaches a blocked fix-eligible PR, and is held before the merge-fix round stop (696) ends paused/operator with cursor stepKind merge and runMergeFixRound not spawned (no fix-round step consumed); existing runs.test.ts cases pass unchanged; tsc is clean_
 
 - [ ] 3. Document phase stop at the review-round top
   - File: src/controller/phases/document.ts
@@ -119,3 +119,6 @@ Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 1 adds
 
 - **v1** (2026-10-29) — Initial draft.
   - **Lint pass.** 2 fixed; rejected: none.
+- **v2** (2026-10-29) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/1/1).
+  - **R1-1 — Accepted (SHOULD_FIX).** The merge-fix round stop was named in task 2's prompt body but had no Success case and no exemption; an exemption would be false, since no earlier stop point catches a hold set during the pull-request read before that stop. Added a Success case: a run entering the merge stage unheld that reaches a blocked, fix-eligible pull request and is held before the merge-fix round ends paused by the operator with the merge cursor and spawns no merge-fix round (task 2 Success, line 27). The merge-stage-entry exemption stays as is.
+  - **R1-2 — Accepted (MINOR).** Task 1's prompt body promised the synchronous run read returns nothing for a missing or unparsable file, but its Success named only the missing id. Widened Success to also assert the unparsable file, matching the body and the design (task 1 Success, line 16).

````
