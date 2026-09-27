# Adversarial Review — tdd-task-loop/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path,citation-range,citation-unchecked,citation-bare,citation-identifier,mdx,caps-invalid,ears-shape,doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: no lint pass ran. Still open (error = MUST_FIX candidate, warning = your call, info = a note): none.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): tdd-task-loop requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-2 MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fresh lens for this round: a cold read for internal contradictions and a truth table of the stated cases (the gating logic — red-on-base proof, risk tiers, the Test line classification, malformed-line handling — read as a set of cases and checked for a case that two acceptance criteria answer differently).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. (Round 1: all six findings accepted; none rejected.)
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.
## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
A `file:line` from the graph is a hint to confirm, not a citation.

## Changes since 48b754c

````diff
diff --git a/.spec-workflow/specs/tdd-task-loop/requirements.md b/.spec-workflow/specs/tdd-task-loop/requirements.md
index 07d4994..32a97a4 100644
--- a/.spec-workflow/specs/tdd-task-loop/requirements.md
+++ b/.spec-workflow/specs/tdd-task-loop/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-A task that carries a `- Test:` line gets its failing tests from a separate Sonnet-tier test author before the implementer runs. The review gate proves in code that those tests fail on the pre-task code and pass on the finished code, and records the proof on the task's review. A task without a `Test:` line runs today's loop exactly, so removing the lines is the kill switch.
+A task carrying a `- Test:` line gets its failing tests from a separate Sonnet-tier test author before the implementer runs. The gate proves in code that those tests fail on the pre-task code and pass on the finished code, and records the proof on the review. A task without a `Test:` line runs today's loop, so removing the lines is the kill switch.
 
 ## Alignment with Product Vision
 
-This store has no `product.md`, so the spec aligns with the decomposition entry for spec 11 and the decisions in `docs/tdd-implementation-research.md` section 0.1. The gate's verdict changes only on facts the code proves; the one LLM signal (Jev) runs in shadow. The author runs on the narrow-role Sonnet tier, and the tasks phase gains one line per marked task.
+This store has no `product.md`, so the spec aligns with the spec 11 decomposition entry and `docs/tdd-implementation-research.md` section 0.1. The gate's verdict changes only on facts the code proves; Jev, the one LLM signal, runs in shadow. The author runs on the narrow-role Sonnet tier, and the tasks phase gains one line per marked task.
 
 ## Requirements
 
@@ -20,7 +20,7 @@ Anchors: src/core/task-parser.ts:108-128, src/core/task-parser.ts:279-297, src/c
 
 1. WHEN a task block holds a bullet `- Test:` with a path, a space-padded em dash and a call text, THEN THE task parser SHALL add `{ path, seam }` to the task's `tests` array in document order, and SHALL NOT add that line to `files` or `implementationDetails`.
 2. IF a task block holds no `Test:` line, THEN THE task parser SHALL emit no `tests` field.
-3. WHEN a `Test:` line has no em dash, an empty call text, or a path that is not a test path by the gate's test-path rule, THEN THE spec-lint rule `task-test-seam` SHALL report a `warning` on that line.
+3. WHEN a `Test:` line has no em dash, an empty call text, or a path that is not a test path by the gate's test-path rule, THEN THE spec-lint rule `task-test-seam` SHALL report a `warning` on that line, and THE parser SHALL NOT promote it to `tests`; it remains an `implementationDetails` bullet.
 4. WHEN a task names a `File:` path that is neither a test path nor a documentation path by the gate's rules and has no `Test:` line, THEN THE rule `task-test-seam` SHALL report an `info` finding on its checkbox line.
 5. THE rule `task-test-seam` SHALL run in the `tasks` phase only.
 6. THE shipped tasks template SHALL state the `Test:` line shape in its shape rules and carry it in one example task.
@@ -57,7 +57,7 @@ Anchors: harness/skills/sdd-implementation-phase/SKILL.md:55-68, harness/skills/
 1. WHEN the picked task has a `Test:` line, THEN THE orchestrator SHALL, after the `base=` capture and before the implementer, spawn `sdd-test-author` with a `test-author` brief and record `spawn.usage` with `role=author task <N>`.
 2. WHEN the author reports `SEAM-DEFECT`, or `RED-IMPOSSIBLE` for every criterion, THEN THE orchestrator SHALL take the existing design-defect stop and spawn no implementer.
 3. WHEN the author reports `RED-IMPOSSIBLE` for some criteria only, THEN THE orchestrator SHALL continue and append one `doc-gap` retro-log entry naming them.
-4. WHEN a task is marked, THEN its implementer brief and every fix brief SHALL carry `## Red tests (from the test author)` with the author's files, the `Test:` lines and the author's report verbatim.
+4. WHEN a task is marked, THEN its implementer brief and every fix brief SHALL carry `## Red tests (from the test author)` with the author's files, the `Test:` lines and the author's report verbatim. Because the server authors the implementer brief, THE `implementer` template SHALL gain a `brief`-filled slot for this section; the fix brief carries it in the `reviser` `{{job}}` value.
 5. WHEN an implementer works a marked task, THEN THE implementer SHALL make every author test pass, SHALL NOT edit an author file without reporting `TEST-AMENDED: <file> — <reason>`, MAY add its own tests, and SHALL run the author's files last and report `green: <passed>/<total>`.
 6. WHEN the orchestrator gates a marked task, THEN every gate call SHALL carry `tdd: { testFiles, redCommit }` from the author's report.
 7. WHEN the gate result carries a `tdd` block, THEN THE verifier brief's `## Gate results` SHALL carry it, and WHEN it shows `amended: true`, THEN THE verifier SHALL judge the amended test against the criteria first.
@@ -81,14 +81,14 @@ Anchors: src/tools/review-gate.ts:47-70, src/tools/review-gate.ts:192-209, src/t
 6. WHEN the proof runs, THEN THE gate SHALL run `git worktree prune`, add a detached worktree of the red commit's first parent in a new directory outside the code root, and remove it in a `finally` path.
 7. IF the agent rules carry `red-on-base-setup: <command>`, THEN THE gate SHALL run it in the base worktree; otherwise THE gate SHALL symlink each `node_modules` directory of the code root into it at the same relative path, skipping any inside another `node_modules` or a linked worktree.
 8. WHEN the base worktree is ready, THEN THE gate SHALL copy the author files' red-commit content into it, run the agent-rules `tdd-test-command:` with `{files}` replaced by those files there, then run the same command in the code root, each with `CHECK_TIMEOUT_MS` and the scrubbed git environment.
-9. WHEN the base run exits non-zero, THEN THE gate SHALL classify its full output as `assertion-red` when it carries `AssertionError` and no structural marker, else `structural-red`; the structural markers are `Cannot find module`, `is not a function`, `SyntaxError` and `error TS`.
+9. WHEN the base run exits non-zero, THEN THE gate SHALL classify its full captured stdout and stderr (not the one-line `runChecks` output) as `assertion-red` when it carries `AssertionError` and no structural marker, else `structural-red`; the structural markers are `Cannot find module`, `is not a function`, `SyntaxError` and `error TS`.
 10. WHEN the base run exits 0, THEN THE gate SHALL run it once more, and WHEN that also exits 0, THEN THE base outcome SHALL be `vacuous` and the gate SHALL fail with `tdd: tests pass on base`; a non-zero second run SHALL give `inconclusive`.
 11. WHEN the head run exits non-zero or times out, THEN THE gate SHALL fail with `tdd: tests fail on HEAD`.
 12. IF a git command fails, the red commit does not resolve, setup fails, the base run times out, `tdd-test-command:` is absent, or the agent rules carry `red-on-base: off`, THEN THE base outcome SHALL be `inconclusive` with that cause and SHALL NOT fail the gate.
-13. WHEN `tdd` is given, THEN THE response SHALL carry `data.tdd` = `{ testFiles, seams, redCommit, baseSha, base, head, amended, judged }`, with `base` one of `assertion-red`, `structural-red`, `vacuous`, `inconclusive`, and `head` one of `pass`, `fail`, `not-run`.
-14. THE gate SHALL keep at most one output line per proof run in the response and run no command other than the two agent-rules keys.
+13. WHEN `tdd` is given, THEN THE response SHALL carry `data.tdd` = `{ testFiles, seams, redCommit, baseSha, base, head, amended, judged }`, with `seams` the `seam` the parsed task's `tests[]` holds for each `testFiles` path, `base` one of `assertion-red`, `structural-red`, `vacuous`, `inconclusive`, and `head` one of `pass`, `fail`, `not-run`.
+14. THE gate SHALL keep at most one output line per proof run in the response and run no configurable test or setup command other than the two agent-rules keys; its own git plumbing is excepted.
 
-Probe for criterion 9 (2026-09-27, vitest 4.0.16 in this checkout, scratch files run through `node_modules/.bin/vitest run`): a failed `expect` prints `AssertionError:`, a missing import `Error: Cannot find module`, a missing export `TypeError: … is not a function`, each exiting 1; a passing file exits 0. The last output line is the duration line, so the one-line check output cannot classify.
+Probe for criterion 9 (2026-09-27, vitest 4.0.16, run through `node_modules/.bin/vitest run`): a failed `expect` prints `AssertionError:`, a missing import `Error: Cannot find module`, a missing export `TypeError: … is not a function`, each exiting 1; a passing file exits 0. The last output line is the duration line, so the one-line check output cannot classify.
 
 ### Requirement 5 — Risk and the recorded review
 
@@ -111,13 +111,13 @@ Anchors: src/core/gate-rules.ts:280-359, src/core/gate-rules.ts:384-437, src/too
 
 **User Story:** As Matthew, I want each proof in `spec-status` and the dashboard task view, so that I can judge the loop without the ledger.
 
-Anchors: src/tools/spec-status.ts:179-193, src/dashboard/multi-server.ts:1931-1962, src/dashboard_frontend/src/modules/pages/TasksPage.tsx:472-507.
+Anchors: src/tools/spec-status.ts:179-193, src/dashboard/multi-server.ts:1931-1962, src/dashboard_frontend/src/modules/pages/TasksPage.tsx:1364-1406.
 
 #### Acceptance Criteria
 
 1. WHEN a completed task's latest review carries a `tdd` block, THEN THE `spec-status` response SHALL carry `tddCoverage`: the task count, a count per base outcome and the amended count; otherwise no such field.
 2. THE dashboard's task review routes SHALL return the `tdd` block.
-3. WHEN a review carries a `tdd` block, THEN THE task view SHALL show one line with base, head, amended and file count, also when the review has no findings.
+3. WHEN a review carries a `tdd` block, THEN THE task view SHALL show one line with base, head, amended and file count on the always-shown task row, not the findings expander that today's `verdict !== 'pass'` gate hides.
 4. THE PR body SHALL keep its shape, and THE ledger SHALL gain only the author's `spawn.usage` role, the note's `tdd` word and `judge` events.
 
 ### Requirement 7 — Jev in shadow
@@ -179,11 +179,11 @@ Anchors: harness/agent-profiles.json:1-74, docs/SDD-HARNESS.md:21-23, docs/SDD-H
 
 ## Decisions taken in this document
 
-- D1 — Seam defects take the design-defect stop: options were the existing design-defect stop, or a narrower tasks-defect stop that re-opens only tasks; chosen because it needs no new supervisor route, and the retro can add the narrow stop.
-- D2 — A per-project proof switch, default on: options were allowing an off key in the agent rules, or always running the proof; chosen because a setup failure elsewhere must not stall a spec, and off still scores every marked task high.
-- D3 — Test files and criteria go to TypeSafe in shadow: options were sending this public repository's author tests and criteria with the key in the gitignored local config, or keeping the judge off until a later spec; chosen because the content is already public and shadow data sets the later thresholds; tradr stays off until its DPA is read.
-- D4 — The author's files count as listed and as touched test paths: options were counting them, or leaving gate inputs as they are; chosen because in the shared-repo layout the gate range covers only the implementer's commit, so every marked task would otherwise score high on tests-not-touched and could fail the outside-list rule on a true fact.
-- D5 — The proof's base is the red commit's parent: options were that parent, or the gate's base ref; chosen because in the shared-repo layout a fix round's base ref already holds the first implementation, which would read as vacuous.
+- D1 — Seam defects take the design-defect stop: options were that stop, or a narrower tasks-defect stop; chosen because it needs no new supervisor route, and the retro can add the narrow stop.
+- D2 — A per-project proof switch, default on: options were an off key in the agent rules, or always running the proof; chosen because a setup failure must not stall a spec, and off still scores every marked task high.
+- D3 — Test files and criteria go to TypeSafe in shadow: options were sending this repository's author tests and criteria, or keeping the judge off until a later spec; chosen because the content is already public and shadow data sets the later thresholds; tradr stays off until its DPA is read.
+- D4 — The author's files count as listed and as touched test paths: options were counting them, or leaving gate inputs as they are; chosen because the gate range covers only the implementer's commit, so every marked task would otherwise score high on tests-not-touched and could fail the outside-list rule on a true fact.
+- D5 — The proof's base is the red commit's parent: options were that parent, or the gate's base ref; chosen because a fix round's base ref already holds the first implementation, reading as vacuous.
 - D6 — A task met on every criterion stops the phase: options were the design-defect stop, reverting and continuing, or marking it done unreviewed; chosen because the pick rule would loop on a reverted task and marking done breaks the log gate.
 - D7 — The orchestrator writes the judge event: options were the orchestrator through the event script, or the server appending to the ledger; chosen because the watch view keeps only rows carrying the run id the event script stamps.
 - D8 — An unclear red counts as structural; a passing base re-runs once: options were structural or inconclusive, and one re-run or none; chosen because it is still a red that raises risk, and one re-run keeps a flake from failing a task.
@@ -194,12 +194,18 @@ Anchors: harness/agent-profiles.json:1-74, docs/SDD-HARNESS.md:21-23, docs/SDD-H
 
 ## Scope notes
 
-- RE-DECIDED: end-to-end scenario item (1). A marked task whose behaviour already exists cannot reach the gate, because an honest author reports it as met (D6). An in-process gate call proves the vacuous failure instead; the fixture puts that task last; only the first task yields a judge event.
-- RE-DECIDED: the proof's base is the red commit's parent, not the gate's base ref (D5).
-- Flag: D4 feeds the author's files to two unchanged rules, so a marked task in the shared-repo layout scores lower than it would without it.
+- RE-DECIDED: end-to-end scenario item (1). A marked task whose behaviour already exists cannot reach the gate, because an honest author reports it as met (D6). An in-process gate call proves the vacuous failure; the fixture puts that task last; only the first yields a judge event.
+- Flag: D4 feeds the author's files to two unchanged rules, so a marked task scores lower than without it.
 - Deferred to the first dogfooded spec's retro: the budget measurement, Jev thresholds and enforce mode, and a verifier skip for proven tasks.
 - Out of scope: the provider-map line for the author (spec 10) and the control-pane task view (spec 9).
 
 ## Revision History
 
 - **v1** (2026-09-27) — Initial draft.
+- **v2** (2026-09-27) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/4/2). Closed by ruling: none.
+  - R1-1 (SHOULD_FIX): accepted — R6 anchor moved to `TasksPage.tsx:1364-1406` and AC3 names the always-shown task row, not the `verdict !== 'pass'` findings expander.
+  - R1-2 (SHOULD_FIX): accepted — R4 AC9 now classifies the base run's full captured stdout/stderr, not the one-line `runChecks` output.
+  - R1-3 (SHOULD_FIX): accepted — R3 AC4 names the injection channel: the `implementer` template gains a `brief`-filled slot; the fix brief uses the `reviser` `{{job}}` value.
+  - R1-4 (SHOULD_FIX): accepted — R4 AC14 scopes "command" to the two configurable agent-rules keys, git plumbing excepted.
+  - R1-5 (MINOR): accepted — R4 AC13 states `seams` is derived from the parsed task's `tests[]`.
+  - R1-6 (MINOR): accepted — R1 AC3 states a malformed `Test:` line is not promoted to `tests` and stays an `implementationDetails` bullet.
````
