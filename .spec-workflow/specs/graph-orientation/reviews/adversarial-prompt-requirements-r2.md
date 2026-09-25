# Adversarial Review — graph-orientation/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below (the lint pass removed one out-of-repo absolute path token from the Reliability shrink-guard line and changed nothing else). Still open (warning = your call) — the v2 lint pass rejected all remaining citation-identifier warnings as naming to-be-built artifacts of this feature (the `GRAPH`/`GRAPH_BEHIND`/`GRAPH_BUILT_AT` env keys, `CODE_ROOT` in the run.start range, the `graph`/`graphBuiltAt`/`graphBehind` fields, and the `explain`/`query` subcommands), none of which exist yet in the cited ranges; confirm that reasoning still holds and do not re-raise them without new evidence:
  - lines 19, 23, 24, 34, 35, 36 — GRAPH / GRAPH_BEHIND / GRAPH_BUILT_AT / CODE_ROOT env keys absent from the sdd-continue / sdd-implementation-phase / sdd-closeout-phase SKILL.md ranges
  - lines 48, 53, 89, 93, 101 — graph / graphBuiltAt / graphBehind usage fields absent from harness.ts, usage.ts, sdd-activity.sh, TOOLS-REFERENCE.md ranges
  - lines 65, 75 — GRAPH / explain / query absent from the document-phase briefs.md ranges
- Changes: the diff from the newest commit whose subject holds `docs(sdd): graph-orientation requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines; the `## Lint commit` section follows it.
- Read the Revision History line for v2 first and attack those changes before anything else. Round 1 accepted six findings: R1-1 (D14 disclosing worktree-per-change also disables the R2 AC2 per-task refresh, mirroring D12; R7 AC4 scenario-4 fixture pinned to a non-worktree CODE_ROOT), R1-2 (R2 AC1 refresh pinned before the run.start row write, not just before first spawn), R1-3 (new R6 AC8 scoping the graph column to Agent-tool/Anthropic workers), R1-4 (R6 AC4 names the usageAction join vs pure buildUsageReport), R1-5 (Reliability shrink-guard line), R1-6 (R3 AC6/D8 reworded "styled on" the missing-value rule). Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v2 delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. Label each round-2 MUST_FIX `fix-induced` when the v2 delta introduced it (a Compounds finding is fix-induced) or `carried` when it is a pre-existing defect v2 did not touch.
- Fresh lens for this round: a cold read for internal contradictions and a truth table of the stated cases — read every acceptance criterion across the seven requirements as one set and check they do not contradict each other (freshness triggers vs the run-start fact; the graph column's scope vs the "every worker" claim; the worktree caveats D12/D14 vs R2's refresh criteria) and that every stated case (graph present / absent / stale / behind, worktree vs non-worktree CODE_ROOT, Agent-tool vs DeepSeek worker) has exactly one defined behaviour.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. Round 1 rejected nothing.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under /home/mcf/repo/spec-workflow-mcp; the spec store under /home/mcf/repo/spec-workflow-mcp/.spec-workflow. Use absolute paths. Project rules for reading code and running checks: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since e586810

````diff
diff --git a/.spec-workflow/specs/graph-orientation/requirements.md b/.spec-workflow/specs/graph-orientation/requirements.md
index 95f6921..2ffdce7 100644
--- a/.spec-workflow/specs/graph-orientation/requirements.md
+++ b/.spec-workflow/specs/graph-orientation/requirements.md
@@ -31,7 +31,7 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 
 #### Acceptance Criteria
 
-1. WHEN `GRAPH` is a path AND `GRAPH_BEHIND` is not `0` AND `CODE_ROOT` is the main checkout THEN the supervisor SHALL run `graphify update <CODE_ROOT>` once, after Requirement 1 and before the first orchestrator spawn of the run.
+1. WHEN `GRAPH` is a path AND `GRAPH_BEHIND` is not `0` AND `CODE_ROOT` is the main checkout THEN the supervisor SHALL run `graphify update <CODE_ROOT>` once, after Requirement 1 and before the `run.start` row is written (`harness/skills/sdd-continue/SKILL.md:108-110`), which precedes the first orchestrator spawn of the run.
 2. WHEN the implementation orchestrator receives an `sdd-implementer` report in the per-task loop (the implement spawn and each fix spawn, `harness/skills/sdd-implementation-phase/SKILL.md:84-159`) AND `GRAPH` is a path AND `CODE_ROOT` is the main checkout THEN the orchestrator SHALL run `graphify update <CODE_ROOT>` before the next brief of that task.
 3. WHEN the close-out orchestrator receives an `sdd-implementer` report for a `harness` or `code` batch (`harness/skills/sdd-closeout-phase/SKILL.md:120-159`) AND `GRAPH` is a path AND the batch's landing root is the main checkout THEN the orchestrator SHALL run `graphify update <landing root>`.
 4. WHEN a `graphify update` exits 0 THEN the caller SHALL treat the graph as current at HEAD: `GRAPH_BEHIND` becomes `0` and `GRAPH_BUILT_AT` becomes the HEAD sha, whether or not `built_at_commit` in the file moved.
@@ -50,7 +50,7 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 3. The rule text SHALL say: run `explain` on a symbol before opening its code file, then read only the cited range to confirm it; never use the graph for the spec store; when `explain` prints "No node matching", read the file as before; an `[INFERRED]` edge is never a citation; a citation in a document or the context file names a range the worker read.
 4. The freshness line SHALL read `built at <values.graphBuiltAt>, <values.graphBehind> commits behind HEAD`; WHEN `graphBehind` is not `0` THEN the line SHALL add that a `file:line` from the graph is a hint to confirm, not a citation.
 5. IF `values.graph` is absent or equals `none` THEN the tool SHALL write a brief byte-identical to the pre-spec output for the same template and values.
-6. IF `values.graph` is a path AND `values.graphBuiltAt` or `values.graphBehind` is absent THEN the tool SHALL fail naming the missing values and write no file, as the missing-value rule does (`src/tools/harness.ts:617-631`).
+6. IF `values.graph` is a path AND `values.graphBuiltAt` or `values.graphBehind` is absent THEN the tool SHALL fail naming the missing values and write no file, styled on the missing-value rule (`src/tools/harness.ts:617-631`): a new check, since Requirement 3 AC 7 keeps these values out of the `{{key}}` placeholder set that rule checks.
 7. The graph values SHALL NOT be `{{key}}` placeholders of any template, so a caller that passes no graph value never fails the missing-value rule.
 8. The tool SHALL NOT read `graph.json`, run git or spawn any process (`src/tools/harness.ts:17-27`): every graph fact comes from `values` (`src/tools/harness.ts:547-655`).
 
@@ -86,10 +86,11 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 1. WHEN `harness` `usage` runs for a spec THEN it SHALL read `harness-activity.jsonl` from the spec dir next to `harness-events.jsonl`; IF the file is missing THEN every graph count SHALL be 0 and the call SHALL succeed.
 2. A graph call SHALL be one activity row with `event: tool`, `tool: Bash`, and a `summary` that names `graphify explain`, `graphify query` or `graphify path`; one row counts once, and a `graphify update` row does not count.
 3. The fold SHALL attribute each graph call to the row's `agent` and to the phase whose live window contains the row's `ts`, by the rule `src/watch/usage.ts:277-296` applies to a spawn's start, else to phase `unknown`.
-4. The one-report and compare tables (`src/watch/usage.ts:361-410`) SHALL print a `graph` column on every phase-agent row, every phase total and the spec total, and `data.report` SHALL carry the counts.
+4. The one-report and compare tables (`src/watch/usage.ts:361-410`) SHALL print a `graph` column on every phase-agent row, every phase total and the spec total, and `data.report` SHALL carry the counts, folded by joining activity rows to the events-derived phase windows in `usageAction` (`src/tools/harness.ts:1072-1093`); the pure `buildUsageReport` (`src/watch/usage.ts:113-218`) SHALL NOT read the activity file.
 5. IF an agent has graph calls in a phase but no spawn cell there THEN the table SHALL print a row for it with 0 spawns.
 6. WHEN `compareSpecName` names a spec THEN the tool SHALL read that spec's activity log the same way, so `harness usage` for this spec against `agent-cache-ttl` prints that run's count.
 7. Every existing column SHALL keep its value; only the header and row shapes gain the `graph` column.
+8. IF a role runs as a separate provider process rather than an Agent-tool subagent THEN its graphify calls SHALL NOT appear in the count: the activity hook records only `sdd`-prefixed Agent-tool subagents (`harness/hooks/sdd-activity.sh:126-128`), so the `graph` column is scoped to Agent-tool (Anthropic-routed) workers, the same scope the spawns column already keys apart with a `@deepseek` suffix (`src/watch/usage.ts:366,399`).
 
 ### Requirement 7 — Docs and verification
 
@@ -100,7 +101,7 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 1. The `harness` section of `docs/TOOLS-REFERENCE.md` (`docs/TOOLS-REFERENCE.md:547-579`) SHALL name the three graph values of `brief` and the `graph` column of `usage`.
 2. `docs/SDD-HARNESS.md` SHALL state the three launch-prompt lines, the refresh rule and that `graphify-out/` stays untracked.
 3. The end-to-end verification SHALL run the decomposition entry's scenarios (1) to (6); WHEN a scenario needs a harness run in a rebuilt and restarted session THEN it SHALL stay `pending` in a tracked `verification-evidence.md` as `agent-rules.md` requires, not close silently.
-4. The fixture for scenario (4) SHALL make an implementer commit that changes the code graph, so that `built_at_commit` moves to HEAD.
+4. The fixture for scenario (4) SHALL make an implementer commit in a non-worktree `CODE_ROOT` that changes the code graph, so that `built_at_commit` moves to HEAD; this is the only path where Requirement 2 AC 2 fires (D14), not the worktree-per-change path a real implementation phase runs by default.
 
 ## Non-Functional Requirements
 
@@ -114,6 +115,7 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 ### Reliability
 - A missing graph, a missing binary, a failed or timed-out refresh never stops a run or a phase; the brief and ledger then keep the pre-spec shape (Requirement 1 AC 8, Requirement 3 AC 5).
 - The global PreToolUse nudge in `~/.claude` is unchanged.
+- A commit that deletes code shrinks the graph; the refresh's shrink guard then exits non-zero because Requirement 2 AC 7 forbids `--force`, so Requirement 2 AC 5 keeps the previous `GRAPH_BEHIND` and the graph stays behind HEAD until a human runs a forced rebuild outside this spec.
 
 ## Decisions taken in this document
 
@@ -124,12 +126,13 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 - D5 — Graph calls are attributed to a phase by the live-phase window at the row's time: options were the window rule, per agent with no phase, a join through the agent id to its spawn; chosen because the usage fold already applies the window rule to spawns, so the new column lines up with the existing rows.
 - D6 — A refresh failure is a ledger note, not a stop: options were note and continue, stop the phase; chosen because the graph is an index, and a stale graph only turns citations into hints.
 - D7 — Reviewer and checker prompts get the block through the document skill's text: options were skill text, new reviewer and checker brief templates; chosen because those prompts are appended to the adversarial-review scaffold, not written by the brief action.
-- D8 — Graph values missing their freshness fail the brief call: options were fail naming them, fill them as unknown; chosen because it matches the existing missing-value rule and a silent unknown hides an orchestrator bug.
+- D8 — Graph values missing their freshness fail the brief call: options were fail naming them, fill them as unknown; chosen because it follows the same fail-fast shape as the missing-value rule — a new check, since Requirement 3 AC 7 keeps these values out of the `{{key}}` placeholder set that rule checks — and a silent unknown hides an orchestrator bug.
 - D9 — The graph is resolved after the roots step and again after worktree entry, not in preflight: options were after roots, in preflight; chosen because the path depends on the code root and main checkout, which the roots step computes, and the worktree rule changes the code root.
 - D10 — The run-start row carries graph keys only when a graph exists: options were keys only with a graph, always with a none value, never; chosen because the no-graph run must keep the pre-spec ledger shape.
 - D11 — Live scenarios that need a restarted session are deferred through the evidence file: options were defer the live half as pending evidence, block the PR until a restarted session runs them; chosen because agent-rules requires that route and the previous spec used it.
 - D12 — The close-out refresh rule is kept although it does not fire today: options were keep it, drop it; chosen because the decomposition lists it and a change to the close-out landing root would make it fire; today code and harness batches land in a retro worktree.
 - D13 — Posture: this spec touches no money, personal data, deletion or legal surface: options were none; chosen because it changes only harness briefs, launch lines and a usage column.
+- D14 — The implementation per-task refresh (Requirement 2 AC 2) does not fire under worktree-per-change either, mirroring D12: options were disclose it, widen AC 2 to cover a worktree, update the worktree's graph despite AC 6; chosen because AC 6 forbids a worktree update, so during implementation `GRAPH` stays the main checkout's graph — stale and missing the task's new symbols — and a worker falls back to a cold read for its own edits (Requirement 3 AC 3).
 
 ## Scope notes
 
@@ -145,3 +148,11 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 
 - **v1** (2026-09-25) — Initial draft.
   - **Lint pass.** 6 fixed (L-2, L-9, L-10, L-15, L-16, L-21); rejected: L-1, L-3, L-4, L-5, L-6, L-7, L-8, L-11, L-12, L-13, L-14, L-17, L-18 (GRAPH/graph/graphBuiltAt/graphBehind are new names this spec proposes, absent from the cited code today), L-19, L-20 (explain/query are content Requirement 5 adds to that section, not there yet), L-22, L-23 (the graph column is new, not in usage.ts or the docs table yet).
+- **v2** (2026-09-25) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
+  - **R1-1 — Accepted (SHOULD_FIX).** Added a decision disclosing that the implementation per-task refresh also does not fire under worktree-per-change, mirroring the existing close-out decision: during implementation the graph a worker reads stays the main checkout's, missing the task's new symbols. Sharpened the scenario-4 verification fixture to state it runs in a non-worktree checkout, the only path where that refresh fires.
+  - **R1-2 — Accepted (SHOULD_FIX).** The run-start refresh condition now pins the update before the run-start ledger row is written, not merely before the first orchestrator spawn, so the run-start row can carry the post-refresh count the run-start requirement expects.
+  - **R1-3 — Accepted (SHOULD_FIX).** Added a scoping criterion to the usage requirement: the graph column counts only Agent-tool (Anthropic-routed) workers, since the activity hook logs only sdd-prefixed Agent-tool subagents and a separately-routed provider process leaves no row to count.
+  - **R1-4 — Accepted (MINOR).** The usage requirement now states the graph count is folded by joining activity rows to the events-derived phase windows inside the usage action, not inside the pure report-building function.
+  - **R1-5 — Accepted (MINOR).** Added a Reliability line: a deletion-heavy commit trips the refresh's shrink guard, which exits non-zero because the no-force rule forbids overriding it, so the graph stays behind HEAD until a manual rebuild.
+  - **R1-6 — Accepted (MINOR).** Reworded the brief-failure criterion and its matching decision from claiming to reuse the placeholder-only missing-value rule to being styled on it, since the graph values are exempt from the placeholder set that rule checks.
+  - **Lint pass.** 1 fixed (L-22); rejected: L-1, L-2, L-3, L-4, L-5, L-9, L-10, L-11, L-12, L-13, L-14, L-15, L-16, L-17, L-18, L-21 (unchanged; to-be-built artifact, ruled in v1 lint), L-6, L-7, L-8, L-19, L-20 (to-be-built artifact this spec proposes; citation ranges confirmed correct).
````

## Lint commit 588dbd3

````diff
diff --git a/.spec-workflow/specs/graph-orientation/requirements.md b/.spec-workflow/specs/graph-orientation/requirements.md
index 1bf4e1c..2ffdce7 100644
--- a/.spec-workflow/specs/graph-orientation/requirements.md
+++ b/.spec-workflow/specs/graph-orientation/requirements.md
@@ -115,7 +115,7 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 ### Reliability
 - A missing graph, a missing binary, a failed or timed-out refresh never stops a run or a phase; the brief and ledger then keep the pre-spec shape (Requirement 1 AC 8, Requirement 3 AC 5).
 - The global PreToolUse nudge in `~/.claude` is unchanged.
-- A commit that deletes code shrinks the graph; the refresh's shrink guard (`/home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/watch.py:1612-1618`) then exits non-zero because Requirement 2 AC 7 forbids `--force`, so Requirement 2 AC 5 keeps the previous `GRAPH_BEHIND` and the graph stays behind HEAD until a human runs a forced rebuild outside this spec.
+- A commit that deletes code shrinks the graph; the refresh's shrink guard then exits non-zero because Requirement 2 AC 7 forbids `--force`, so Requirement 2 AC 5 keeps the previous `GRAPH_BEHIND` and the graph stays behind HEAD until a human runs a forced rebuild outside this spec.
 
 ## Decisions taken in this document
 
@@ -155,3 +155,4 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
   - **R1-4 — Accepted (MINOR).** The usage requirement now states the graph count is folded by joining activity rows to the events-derived phase windows inside the usage action, not inside the pure report-building function.
   - **R1-5 — Accepted (MINOR).** Added a Reliability line: a deletion-heavy commit trips the refresh's shrink guard, which exits non-zero because the no-force rule forbids overriding it, so the graph stays behind HEAD until a manual rebuild.
   - **R1-6 — Accepted (MINOR).** Reworded the brief-failure criterion and its matching decision from claiming to reuse the placeholder-only missing-value rule to being styled on it, since the graph values are exempt from the placeholder set that rule checks.
+  - **Lint pass.** 1 fixed (L-22); rejected: L-1, L-2, L-3, L-4, L-5, L-9, L-10, L-11, L-12, L-13, L-14, L-15, L-16, L-17, L-18, L-21 (unchanged; to-be-built artifact, ruled in v1 lint), L-6, L-7, L-8, L-19, L-20 (to-be-built artifact this spec proposes; citation ranges confirmed correct).
````
