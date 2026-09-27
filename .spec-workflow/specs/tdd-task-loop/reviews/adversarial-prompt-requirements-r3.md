# Adversarial Review — tdd-task-loop/requirements (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-analysis-requirements-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v3 review)

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-analysis-requirements-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path,citation-range,citation-unchecked,citation-bare,citation-identifier,mdx,caps-invalid,ears-shape,doc-words on v3 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v3 lint commit changed: no lint pass ran. Still open (error = MUST_FIX candidate, warning = your call, info = a note): none.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): tdd-task-loop requirements v2` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v3 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R2-<n>` (or `R1-<n>`), naming the round whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-3 MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch; the label is guidance and does not change the round budget.
- Fresh lens for this round: the sub-agent that receives only the task prompt (read each acceptance criterion as an implementer agent who sees only the task text and the cited artifacts — is every trigger, threshold and channel it names resolvable without out-of-band knowledge, and does any AC assume state the prompt never carries).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. (Rounds 1–2: all findings accepted or partially accepted; none rejected.)
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

## Changes since c6467e6

````diff
diff --git a/.spec-workflow/specs/tdd-task-loop/requirements.md b/.spec-workflow/specs/tdd-task-loop/requirements.md
index 32a97a4..f316356 100644
--- a/.spec-workflow/specs/tdd-task-loop/requirements.md
+++ b/.spec-workflow/specs/tdd-task-loop/requirements.md
@@ -18,9 +18,9 @@ Anchors: src/core/task-parser.ts:108-128, src/core/task-parser.ts:279-297, src/c
 
 #### Acceptance Criteria
 
-1. WHEN a task block holds a bullet `- Test:` with a path, a space-padded em dash and a call text, THEN THE task parser SHALL add `{ path, seam }` to the task's `tests` array in document order, and SHALL NOT add that line to `files` or `implementationDetails`.
+1. WHEN a task block holds a bullet `- Test:` with a test path by the gate's test-path rule, a space-padded em dash and a call text, THEN THE task parser SHALL add `{ path, seam }` to the task's `tests` array in document order, and SHALL NOT add that line to `files` or `implementationDetails`.
 2. IF a task block holds no `Test:` line, THEN THE task parser SHALL emit no `tests` field.
-3. WHEN a `Test:` line has no em dash, an empty call text, or a path that is not a test path by the gate's test-path rule, THEN THE spec-lint rule `task-test-seam` SHALL report a `warning` on that line, and THE parser SHALL NOT promote it to `tests`; it remains an `implementationDetails` bullet.
+3. WHEN a `Test:` line has no em dash, an empty call text, or a path that is not a test path, THEN THE spec-lint rule `task-test-seam` SHALL report a `warning` on that line, and THE parser SHALL leave it an `implementationDetails` bullet.
 4. WHEN a task names a `File:` path that is neither a test path nor a documentation path by the gate's rules and has no `Test:` line, THEN THE rule `task-test-seam` SHALL report an `info` finding on its checkbox line.
 5. THE rule `task-test-seam` SHALL run in the `tasks` phase only.
 6. THE shipped tasks template SHALL state the `Test:` line shape in its shape rules and carry it in one example task.
@@ -57,11 +57,11 @@ Anchors: harness/skills/sdd-implementation-phase/SKILL.md:55-68, harness/skills/
 1. WHEN the picked task has a `Test:` line, THEN THE orchestrator SHALL, after the `base=` capture and before the implementer, spawn `sdd-test-author` with a `test-author` brief and record `spawn.usage` with `role=author task <N>`.
 2. WHEN the author reports `SEAM-DEFECT`, or `RED-IMPOSSIBLE` for every criterion, THEN THE orchestrator SHALL take the existing design-defect stop and spawn no implementer.
 3. WHEN the author reports `RED-IMPOSSIBLE` for some criteria only, THEN THE orchestrator SHALL continue and append one `doc-gap` retro-log entry naming them.
-4. WHEN a task is marked, THEN its implementer brief and every fix brief SHALL carry `## Red tests (from the test author)` with the author's files, the `Test:` lines and the author's report verbatim. Because the server authors the implementer brief, THE `implementer` template SHALL gain a `brief`-filled slot for this section; the fix brief carries it in the `reviser` `{{job}}` value.
+4. WHEN a task is marked, THEN its implementer brief and every fix brief SHALL carry `## Red tests (from the test author)` with the author's files, the `Test:` lines and the author's report verbatim. THE `implementer` template SHALL gain a `brief`-filled slot for this section, filled for every task and empty when unmarked; the fix brief uses the `reviser` `{{job}}` value.
 5. WHEN an implementer works a marked task, THEN THE implementer SHALL make every author test pass, SHALL NOT edit an author file without reporting `TEST-AMENDED: <file> — <reason>`, MAY add its own tests, and SHALL run the author's files last and report `green: <passed>/<total>`.
 6. WHEN the orchestrator gates a marked task, THEN every gate call SHALL carry `tdd: { testFiles, redCommit }` from the author's report.
 7. WHEN the gate result carries a `tdd` block, THEN THE verifier brief's `## Gate results` SHALL carry it, and WHEN it shows `amended: true`, THEN THE verifier SHALL judge the amended test against the criteria first.
-8. WHEN a task has no `Test:` line, THEN THE orchestrator SHALL spawn no author, write no red section and pass no `tdd` argument.
+8. WHEN a task has no `Test:` line, THEN THE orchestrator SHALL spawn no author and pass no `tdd` argument.
 9. WHEN the gate result carries a `tdd` block, THEN THE gate `note` SHALL append `tdd <base outcome>` to today's text.
 10. WHEN `data.tdd.judged` is present and not a cache hit, THEN THE orchestrator SHALL record one `judge` event with the task, site `tdd`, the four answers, tokens and milliseconds.
 
@@ -85,7 +85,7 @@ Anchors: src/tools/review-gate.ts:47-70, src/tools/review-gate.ts:192-209, src/t
 10. WHEN the base run exits 0, THEN THE gate SHALL run it once more, and WHEN that also exits 0, THEN THE base outcome SHALL be `vacuous` and the gate SHALL fail with `tdd: tests pass on base`; a non-zero second run SHALL give `inconclusive`.
 11. WHEN the head run exits non-zero or times out, THEN THE gate SHALL fail with `tdd: tests fail on HEAD`.
 12. IF a git command fails, the red commit does not resolve, setup fails, the base run times out, `tdd-test-command:` is absent, or the agent rules carry `red-on-base: off`, THEN THE base outcome SHALL be `inconclusive` with that cause and SHALL NOT fail the gate.
-13. WHEN `tdd` is given, THEN THE response SHALL carry `data.tdd` = `{ testFiles, seams, redCommit, baseSha, base, head, amended, judged }`, with `seams` the `seam` the parsed task's `tests[]` holds for each `testFiles` path, `base` one of `assertion-red`, `structural-red`, `vacuous`, `inconclusive`, and `head` one of `pass`, `fail`, `not-run`.
+13. WHEN `tdd` is given, THEN THE response SHALL carry `data.tdd` = `{ testFiles, seams, redCommit, baseSha, base, head, amended, judged }`, with `seams` the `seam` its `tests[]` entry holds for each `testFiles` path, none for a path without an entry, `base` one of `assertion-red`, `structural-red`, `vacuous`, `inconclusive`, and `head` one of `pass`, `fail`, `not-run`.
 14. THE gate SHALL keep at most one output line per proof run in the response and run no configurable test or setup command other than the two agent-rules keys; its own git plumbing is excepted.
 
 Probe for criterion 9 (2026-09-27, vitest 4.0.16, run through `node_modules/.bin/vitest run`): a failed `expect` prints `AssertionError:`, a missing import `Error: Cannot find module`, a missing export `TypeError: … is not a function`, each exiting 1; a passing file exits 0. The last output line is the duration line, so the one-line check output cannot classify.
@@ -148,7 +148,7 @@ Anchors: harness/agent-profiles.json:1-74, docs/SDD-HARNESS.md:21-23, docs/SDD-H
 
 1. THE generated `agent-profiles.json` SHALL list thirteen agents, including `sdd-test-author` with `claude-sonnet-5`, `high` and role `test author`.
 2. THE document `docs/SDD-HARNESS.md` SHALL name the new worker (count word updated), its model-policy row, the `Test:` line, the author step, the proof outcomes and the keys `tdd-test-command`, `red-on-base-setup` and `red-on-base`.
-3. THE document `docs/TOOLS-REFERENCE.md` SHALL describe the gate's `tdd` argument and `data.tdd`, the `test-author` template and `tddCoverage`.
+3. THE document `docs/TOOLS-REFERENCE.md` SHALL describe the gate's `tdd` argument and `data.tdd`, the `test-author` template and `tddCoverage`; the implementer red-tests slot is internal.
 4. THE agent rules of this repository SHALL carry `tdd-test-command: npx vitest run {files}`.
 
 ### Requirement 9 — End-to-end verification
@@ -209,3 +209,8 @@ Anchors: harness/agent-profiles.json:1-74, docs/SDD-HARNESS.md:21-23, docs/SDD-H
   - R1-4 (SHOULD_FIX): accepted — R4 AC14 scopes "command" to the two configurable agent-rules keys, git plumbing excepted.
   - R1-5 (MINOR): accepted — R4 AC13 states `seams` is derived from the parsed task's `tests[]`.
   - R1-6 (MINOR): accepted — R1 AC3 states a malformed `Test:` line is not promoted to `tests` and stays an `implementationDetails` bullet.
+- **v3** (2026-09-27) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/2). Closed by ruling: none.
+  - R2-1 (MUST_FIX, Compounds R1-6): accepted — R1 AC1 now promotes only a `- Test:` line whose path is a test path by the gate's rule, so AC1 and AC3 partition the input and the line `- Test: src/foo.ts — createWidget()` fires AC3 alone (lint warning, stays `implementationDetails`); the shared test-path rule surfaces the parser coupling AC3 needed.
+  - R2-2 (SHOULD_FIX, Compounds R1-3): accepted — R3 AC4's slot is now filled for every task and empty when unmarked, so the `brief` action writes a file for the kill-switch path (an empty string passes the required check); AC8 no longer says to write no red section.
+  - R2-3 (MINOR): accepted — R4 AC13 now omits a `testFiles` path with no matching `tests[]` entry from `seams`, keeping the shape total.
+  - R2-4 (MINOR): partially accepted — R8 AC3 states the implementer red-tests slot is an internal fill; it is filled only by the orchestrator, so it is not a documented TOOLS-REFERENCE surface.
````
