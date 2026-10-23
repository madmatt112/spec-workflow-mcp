# Adversarial Review — harness-evals/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-tasks.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): harness-evals tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 1ddf40c0

````diff
diff --git a/.spec-workflow/specs/harness-evals/tasks.md b/.spec-workflow/specs/harness-evals/tasks.md
index 047b69f5..d528a7e6 100644
--- a/.spec-workflow/specs/harness-evals/tasks.md
+++ b/.spec-workflow/specs/harness-evals/tasks.md
@@ -1,8 +1,8 @@
 # Tasks Document — harness-evals
 
-Document version: v1
+Document version: v2
 
-Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the graders; task 4 (case loader) needs 1-3; 5 (fixture builder) and 6 (brief renderer) need 4; 7 (runner) needs 4-6; 8 (selector) needs 5 and 6; 9 (gate) needs 7 and 8; 10 (CLI) needs 7-9; 11 and 12 add the seed cases and need 2-6; 13 (brief and role text) is independent; 14 (self-update script) calls the CLI of task 10 and stubs it in tests; 15 is documentation; 16 writes the pending verification record. Each task leaves the tree compiling and every existing suite green. Expected verifier spend: tasks 1-12 create new modules or a new case tree, so they route structural red, high risk, to the verifier (12 verifiers); 13-16 route by the line rule; no task touches a `## Sensitive paths` entry.
+Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the graders; task 4 (case loader) needs 1-3; 5 (fixture builder) and 6 (brief renderer) need 4, and 6 also needs the `Fixture` type of 5 (`renderCaseBriefs(c, f: Fixture, …)`); 7 (runner) needs 4-6; 8 (selector) needs 5 and 6; 9 (gate) needs 7 and 8; 10 (CLI) needs 7-9; 11 and 12 add the seed cases and need 2-6; 13 (brief and role text) is independent; 14 (self-update script) calls the CLI of task 10 and stubs it in tests; 15 is documentation; 16 writes the pending verification record. Each task leaves the tree compiling and every existing suite green. Expected verifier spend: tasks 1-12 create new modules or a new case tree, so they route structural red, high risk, to the verifier (12 verifiers); 13-16 route by the line rule; no task touches a `## Sensitive paths` entry.
 
 - [ ] 1. Report schema map
   - File: src/evals/schemas.ts
@@ -120,7 +120,7 @@ Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the grade
   - Purpose: the operator and the self-update run cases from the built package (R2 AC9).
   - _Leverage: the runner, selector and gate of tasks 7-9_
   - _Requirements: 2.9, 3.7_
-  - _Prompt: Task: Implement design Component 9 per R2 AC9 and R3 AC7. Export `main(argv)` returning the exit code, and run it only when the module is the process entry. Before any run, delete `SDD_RUN_ID` and `SDD_STEP_ID` from `process.env` (design Component 6, Record). Tests: an unknown flag and a missing value give exit 2 with a usage line; `select` on a two-commit temp repo prints `select <id>: <reasons>` and exits 0, with ` (provisional)` under `--provisional`; a run with `SDD_RUN_ID` set leaves it unset afterwards; a named case run through the stub claude prints its case line and the record path | Restrictions: no new flag beyond the component's; print through stdout only | Success: an unknown flag and a missing value exit 2 with a usage line; `select` prints its lines, exit 0, with the provisional suffix under `--provisional`; `SDD_RUN_ID` is unset after a run; a stub case run prints its case line and the record path; `npx tsc --noEmit` and cli.test.ts pass_
+  - _Prompt: Task: Implement design Component 9 per R2 AC9 and R3 AC7. Export `main(argv)` returning the exit code, and run it only when the module is the process entry. Before any run, delete `SDD_RUN_ID` and `SDD_STEP_ID` from `process.env` (design Component 6, Record). Tests: an unknown flag and a missing value give exit 2 with a usage line; `select` on a two-commit temp repo prints `select <id>: <reasons>` and exits 0, with ` (provisional)` under `--provisional`; a run with `SDD_RUN_ID` set leaves it unset afterwards; a named case run through the stub claude prints its case line and the record path; `gate --repo … --base … --target … --base-dist … --summary-file …` on a two-commit temp repo holding a case, through the stub claude, forwards its flags to `runGate` and returns its exit code: a failing case named by one `--override` exits 0 and writes one line to the run's `overrides.log`; a `--override` naming no selected case exits 2 before any spawn (the one path the deploy uses, Component 10 change 4) | Restrictions: no new flag beyond the component's; print through stdout only | Success: an unknown flag and a missing value exit 2 with a usage line; `select` prints its lines, exit 0, with the provisional suffix under `--provisional`; `SDD_RUN_ID` is unset after a run; a stub case run prints its case line and the record path; a `gate` run forwards its flags and exit code — an `--override` on a failing case exits 0 with one `overrides.log` line, a bad `--override` exits 2 before any spawn; `npx tsc --noEmit` and cli.test.ts pass_
 
 - [ ] 11. Seed cases: drafter and test author
   - File: harness/evals/drafter-test-seam-label/case.json
@@ -154,7 +154,7 @@ Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the grade
   - Purpose: the drafter brief matches its role, and a retro defect arrives with a case (R5 AC2, R6).
   - _Leverage: src/tools/__tests__/harness.test.ts:368 (`drafterValues`)_
   - _Requirements: 5.2, 6.1, 6.2, 6.3_
-  - _Prompt: Task: Per R5 AC2 (requirements D5), R6 AC1-AC3 and design Component 11, replace the drafter sentence with the component's text, add the `Eval case:` line after `Prerequisites:` in the proposal format and in the role file, and add the two close-out rules. Tests through the brief action: the drafter brief has no `Test (integration)` and says `regression guard`; the `retro-compile` brief carries `Eval case:`; the `closeout-standing` brief names `harness/evals/` and says never to run an eval case | Restrictions: change only these sentences; the existing `toContain` assertions at src/tools/__tests__/harness.test.ts:387 and src/controller/phases/__tests__/retrospective.test.ts:150 keep their values (an illustrative minimum — widen to every assertion the change touches) | Success: the drafter brief lacks `Test (integration)` and says `regression guard`; the `retro-compile` brief carries `Eval case:`; the `closeout-standing` brief names `harness/evals/` and forbids running a case; harness.test.ts and retrospective.test.ts pass_
+  - _Prompt: Task: Per R5 AC2 (requirements D5), R6 AC1-AC3 and design Component 11, replace the drafter sentence with the component's text, add the `Eval case:` line after `Prerequisites:` in the proposal format, extend the proposal-fields sentence at `harness/agents/sdd-retro-analyst.md:18` to name `eval case` (the role file has no literal `Prerequisites:` line), and add the two close-out rules. Tests through the brief action: the drafter brief has no `Test (integration)` and says `regression guard`; the `retro-compile` brief carries `Eval case:`; the `closeout-standing` brief names `harness/evals/` and says never to run an eval case | Restrictions: change only these sentences; the existing `toContain` assertions at src/tools/__tests__/harness.test.ts:387 and src/controller/phases/__tests__/retrospective.test.ts:150 keep their values (an illustrative minimum — widen to every assertion the change touches) | Success: the drafter brief lacks `Test (integration)` and says `regression guard`; the `retro-compile` brief carries `Eval case:`; the `closeout-standing` brief names `harness/evals/` and forbids running a case; harness.test.ts and retrospective.test.ts pass_
 
 - [ ] 14. Self-update eval step
   - File: scripts/sdd-self-update.sh
@@ -202,3 +202,7 @@ Dependency order: task 1 adds the report schema map; tasks 2 and 3 add the grade
 
 - **v1** (2026-10-22) — Initial draft.
   - **Lint pass.** 3 fixed; rejected: none.
+- **v2** (2026-10-22) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/1/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Task 10 now tests the CLI gate subcommand through the stub claude on a two-commit temp repo — a failing case named by one override exits 0 and writes one override-log line, an override naming no selected case exits 2 before any spawn — with a matching Success clause. Closes the gap where the one path the deploy uses was exercised by no automated test: task 9 tests the gate function directly and task 14 stubs the CLI.
+  - **R1-2 — Accepted (MINOR).** The dependency paragraph now states that 5 and 6 need 4, and that 6 also needs the fixture type of 5, which the brief renderer's signature takes.
+  - **R1-3 — Accepted (MINOR).** Task 13's instruction now adds the eval-case line after the Prerequisites line in the proposal format and extends the proposal-fields sentence at line 18 of the retro-analyst role file, which carries no literal Prerequisites line.

````
