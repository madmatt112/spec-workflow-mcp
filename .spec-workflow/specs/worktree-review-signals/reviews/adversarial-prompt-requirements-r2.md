# Adversarial Review — worktree-review-signals/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v3 (document version; this is review round 2). Number findings `R2-1`, `R2-2`, … with a severity and a one-line title each.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v3. No lint pass ran on v3, so no citation changed after that run; a rule with no finding listed here passed. Still open, all `citation-identifier` warnings (your call: an identifier the criterion introduces as new behavior is not a citation defect; an identifier the criterion claims already exists in the cited range is). L-1..L-33 were already rejected with reasons by the v1 lint pass (see the v2 Revision History lint-pass bullet) and re-checked by the v3 reviser; L-2 and L-35..L-38 sit on text the v3 delta wrote and have never been judged — look at those five:
  - L-1 (line 19): 'HEAD' absent from src/dashboard/multi-server.ts:1417-1477, src/dashboard/project-manager.ts:14
  - L-2 (line 24, v3 delta): 'recorded' absent from src/core/task-diff.ts:149-248, src/core/task-diff.ts:183-184, src/tools/review-task.ts:473
  - L-3..L-7 (line 38): 'dependencies', 'devDependencies', 'typescript', 'vitest', 'optionalDependencies' absent from src/core/typecheck.ts:188
  - L-8 (line 41): 'observed' absent from src/core/typecheck.ts:147-152, src/core/typecheck.ts:141
  - L-9 (line 42): 'success' absent from src/core/typecheck.ts:217-222, src/core/typecheck.ts:198-200
  - L-10 (line 45): 'observed' absent from src/core/typecheck.ts:17-47, src/tools/review-task.ts:55-74
  - L-11 (line 53): 'HEAD' absent from src/tools/log-implementation.ts:297-429, :316, :376-388
  - L-12..L-15 (line 58): 'handlePrepare', 'match', 'mismatch', 'unknown' absent from src/core/git-utils.ts:101
  - L-16..L-22 (line 69): 'handlePrepare', 'executionContext', 'workspacePath', 'specWorkflowDir', 'diffBase', 'observed', 'attribution' absent from src/tools/review-task.ts:494-511, :521-526, src/core/path-utils.ts:208-210
  - L-23..L-28 (line 70): 'executionContext', 'diff', 'diffStats', 'diffTruncated', 'skippedPaths', 'diffRejection' absent from src/dashboard/task-review-runner.ts:96, :177, :66-91
  - L-29 (line 72): 'E2BIG' absent from src/dashboard/task-review-runner.ts:204, :272, :473, src/core/task-diff.ts:32
  - L-30 (line 74): 'executionContext' absent from src/tools/review-task.ts:661-766
  - L-31 (line 85): 'empty' absent from src/tools/review-task.ts:317-321, src/core/task-diff.ts:179-181, src/tools/review-task.ts:774-775
  - L-32 (line 88): 'nextSteps' absent from src/tools/review-task.ts:345-346, src/dashboard/task-review-runner.ts:389-393, src/tools/review-task.ts:515-517
  - L-33 (line 98): 'executionContext' absent from src/types.ts:288-296, package.json:72
  - L-34 (line 107): 'recorded' absent from e2e/worktree-shared.spec.ts:322-657
  - L-35..L-38 (line 130, v3 delta): 'computeTaskDiff', 'TypecheckResult', 'observed', 'executionContext' absent from src/core/task-diff.ts:50-62
- Changes: the diff from the newest commit whose subject holds `docs(sdd): worktree-review-signals requirements v2` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines. No lint commit exists for v3.
- Read the Revision History line for v3 first and attack those changes before anything else: R1-1 (re-anchored citation in Req 1 AC 10), R1-2 (Req 1 AC 4 rescoped; storage schema added to Req 3 AC 3; the Req 3 AC 6 / Req 7 AC 3 cross-workspace seam), R1-3 (migration note on the shared diff helper's error cause), R1-4 (provenance value assigned in Req 1 AC 6, rendered in Req 4 AC 5), and the ~13 filler trims the reviser made in the Alignment, Scope notes and NFR sections to hold the cap. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R1-<n>` for the finding that first raised that seam.
- Body word count is 3,500 against a cap of 3,500: at the cap, not over. Any fix you propose that adds text must name what to cut.
- Fresh lens for this round: a cold read for internal contradictions and a truth table of the stated cases — enumerate the record-key, workspace, base-provenance and typecheck-outcome cases the acceptance criteria name, and check that every combination has exactly one stated behavior across Req 1, Req 3, Req 4 and Req 7. Round 1 used the wire-contracts lens; do not repeat it as the primary lens.
- Gate A (`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/questions.md`) approved the document's ranked decisions D1, D3, D5, D6 and D7 unchanged; the human delegated the choice. They are not rulings: attack their wording, testability and citations as normal, and if you argue for reversing one, argue from code evidence, not preference.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. (Round 1 rejected nothing; the v2 lint-pass bullet records the lint findings the v1 lint pass rejected.)
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says; move R1-1..R1-4 to Accepted (the v3 Revision History records their dispositions).
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`; read and obey it first.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since c28b8eb

````diff
diff --git a/.spec-workflow/specs/worktree-review-signals/requirements.md b/.spec-workflow/specs/worktree-review-signals/requirements.md
index 3f9d30d..bf34336 100644
--- a/.spec-workflow/specs/worktree-review-signals/requirements.md
+++ b/.spec-workflow/specs/worktree-review-signals/requirements.md
@@ -6,7 +6,7 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 
 ## Alignment with Product Vision
 
-`.spec-workflow/steering/product.md` is absent; the scope authority is decomposition entry 2 (`.spec-workflow/spec-decomposition/decomposition.md:40-48`), which carries R5, R7, R8 and R9 from `worktree-execution-context`. The review loop is the control point that makes agent work trustworthy, and a reviewer told the wrong thing passes unexamined code. This spec depends on spec 1 for `ToolContext.workspacePath` (`src/types.ts:58-76`) and the file partition and re-specifies neither.
+`.spec-workflow/steering/product.md` is absent; the scope authority is decomposition entry 2 (`.spec-workflow/spec-decomposition/decomposition.md:40-48`), which carries R5, R7, R8 and R9 from `worktree-execution-context`. A reviewer told the wrong thing passes unexamined code. This spec depends on spec 1 for `ToolContext.workspacePath` (`src/types.ts:58-76`) and the file partition, re-specifying neither.
 
 ## Requirements
 
@@ -19,13 +19,13 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 1. WHEN the dashboard status route (`src/dashboard/multi-server.ts:1417-1477`) changes a task to `in-progress` THEN the server SHALL record a diff base keyed by spec, task ID and the project's translated workspace path (`ProjectContext.workspacePath`, `src/dashboard/project-manager.ts:14`), holding that workspace's `HEAD` commit and the recording time. Keying without the workspace lets worktree B reviewing A's task read A's commit.
 2. WHEN `HEAD` is read for the record THEN it SHALL be read in the workspace being marked, with the git location variables scrubbed as every other git call is (`src/core/task-diff.ts:39-62`). IF the read fails THEN nothing SHALL be recorded and the status change SHALL still succeed.
 3. WHEN `tasks.md` is edited directly THEN no base is recorded. No MCP tool sets `in-progress`, so this is the dominant path; design and user documentation SHALL state that the recording site serves dashboard-driven status changes only.
-4. WHEN `handlePrepare` (`src/tools/review-task.ts:348-536`) computes the diff THEN it SHALL read the record for the reviewing workspace only, never another workspace's record for the same task.
+4. WHEN `handlePrepare` (`src/tools/review-task.ts:348-536`) computes the diff THEN it SHALL read the base entry for the reviewing workspace only, never another's for the same task; attribution SHALL be read regardless of workspace (Requirement 3).
 5. WHEN a recorded base is used THEN it SHALL first pass `git merge-base --is-ancestor <base> HEAD` run in the workspace. `git rev-parse --verify` is not sufficient: linked worktrees share one object database, so it succeeds on any sibling branch's commit.
-6. WHEN the base validates THEN `computeTaskDiff` (`src/core/task-diff.ts:149-248`) SHALL diff from it instead of the `HEAD` literal at `:183-184`, taking the base as a parameter. Its production caller (`src/tools/review-task.ts:473`) and its test callers (`src/core/__tests__/task-diff.test.ts`, `src/tools/__tests__/review-task.test.ts`, `src/__tests__/parity-baseline.test.ts`) SHALL be updated in the same change.
+6. WHEN the base validates THEN `computeTaskDiff` (`src/core/task-diff.ts:149-248`) SHALL diff from it instead of the `HEAD` literal at `:183-184`, taking the base as a parameter, disclosed with provenance `recorded`. Its production caller (`src/tools/review-task.ts:473`) and its test callers (`src/core/__tests__/task-diff.test.ts`, `src/tools/__tests__/review-task.test.ts`, `src/__tests__/parity-baseline.test.ts`) SHALL be updated in the same change.
 7. IF no record exists for the reviewing workspace THEN the diff SHALL use `HEAD`, disclosed with provenance `head-expected`.
 8. IF the record fails the ancestry check THEN the diff SHALL use `HEAD`, disclosed distinctly with provenance `head-degraded` and the rejected commit named.
 9. WHEN a recorded base equals `HEAD`, and WHEN a non-worktree project has no record, THEN the diff bytes, stats and truncation SHALL equal today's output for the same inputs.
-10. WHEN a git invocation fails on the diff — the `!ok` arm at `src/core/task-diff.ts:191-193`, including `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` (`src/core/typecheck.ts:478`) against the 16 MB `MAX_BUFFER` at `:30` — THEN the result SHALL classify as `rejected` (`src/core/task-diff.ts:115`) with a message naming the observed cause, not as the benign empty diff. A base many commits back makes overflow materially likelier.
+10. WHEN a git invocation fails on the diff — the `!ok` arm at `src/core/task-diff.ts:191-193`, including `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` (`src/core/typecheck.ts:478`) against the 16 MB `MAX_BUFFER` at `src/core/task-diff.ts:30` — THEN the result SHALL classify as `rejected` (`src/core/task-diff.ts:115`) with a message naming the observed cause, not as the benign empty diff. A base many commits back makes overflow materially likelier.
 11. WHEN the base is disclosed THEN the disclosure SHALL name the commit and its provenance and SHALL state that the diff spans the base to the working tree, so changes to the same files committed between base and `HEAD` are included.
 
 ### Requirement 2 — The typecheck degrades honestly (carried R7)
@@ -52,11 +52,11 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 
 1. WHEN `log-implementation` succeeds THEN it SHALL record, in the per-task record of Requirement 1, the absolute translated workspace path and that workspace's `HEAD` at logging time. Today the handler (`src/tools/log-implementation.ts:297-429`) destructures only the workflow root (`:316`) and the entry it writes (`:376-388`) carries neither.
 2. WHEN attribution is written THEN `log-implementation` SHALL be its single writer; the status route writes only the base. A write to either field SHALL preserve the other (one record, two owners).
-3. (Amends carried R8.) WHEN the fields are stored THEN they SHALL live in the per-task record under the workflow root's `.spec-workflow/specs/<spec>/`, not in the implementation-log markdown entry (`src/dashboard/implementation-log-manager.ts:318-345`, `:433-448`) and not inside any worktree.
+3. (Amends carried R8.) WHEN the fields are stored THEN they SHALL live in one record per task, base keyed by workspace and attribution shared, under the workflow root's `.spec-workflow/specs/<spec>/`, not in the implementation-log markdown entry (`src/dashboard/implementation-log-manager.ts:318-345`, `:433-448`) and not inside any worktree.
 4. WHEN the workspace came from an `args.projectPath` override THEN the record SHALL mark `source: 'override'`, otherwise `'context'`. `selectRoots` (`src/tools/root-selection.ts:202-221`) returns no such flag, so the tool derives it from `args`. A value derived from an override is asserted by the caller and SHALL be disclosed as such.
 5. IF reading `HEAD` fails THEN the workspace path SHALL still be recorded with a null commit, and the log entry SHALL still be written.
 6. WHEN `handlePrepare` runs THEN attribution state SHALL be one of `match` (recorded path equals the reviewing workspace after `normalizeIdentityPath`, `src/core/git-utils.ts:101`, on both sides), `mismatch`, or `unknown` (no record). Every task logged before this change is `unknown`.
-7. WHEN state is `mismatch` THEN the review SHALL still produce a verdict. Attribution is descriptive, never a lock on who may review or implement.
+7. WHEN state is `mismatch` THEN the review SHALL still produce a verdict; attribution is descriptive, never a review or implementation lock.
 8. WHEN two writers from different workspaces update records under one spec concurrently THEN neither write SHALL be lost, and the file SHALL never be observed half-written. The registry lock's primitive (`withRegistryLock`, `src/core/registry-lock.ts:350-391`) may be reused with a store-specific lock path; the registry's own lock file (`:7-11`) SHALL NOT be shared.
 9. IF the record is missing, unreadable or malformed THEN prepare SHALL degrade to `unknown` attribution and `head-expected` base, both disclosed, and SHALL NOT fail.
 
@@ -70,7 +70,7 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 2. WHEN `TaskReviewRunner` (`src/dashboard/task-review-runner.ts:96`) reads the prepare response THEN its destructure (`:177`, six fields today, none carrying diff data) SHALL name `executionContext`, `diff`, `diffStats`, `diffTruncated`, `skippedPaths` and `diffRejection`, and `BuildPromptOptions` (`:66-91`) SHALL type each, so an omission is a compile error rather than a silent drop. (Closes `d-6e59490b`.)
 3. WHEN the dashboard prompt is built (`buildPrompt`, `src/dashboard/task-review-runner.ts:287-434`) THEN it SHALL contain a section rendering the execution context, the diff state — stats, truncation, skipped paths, and any rejection message verbatim — and where the diff body is.
 4. WHEN the diff body is non-empty on the dashboard path THEN it SHALL be written to a file beside `outputPath` (`src/dashboard/task-review-runner.ts:204`) and named in the prompt, removed with the output file (`src/dashboard/task-review-runner.ts:272`). The prompt is one argv element (`src/dashboard/task-review-runner.ts:473`): under node 24 on Linux, `spawnSync('/bin/true', ['x'.repeat(131072)])` fails with `E2BIG` while 100,000 bytes succeeds, and the diff cap alone is 50,000 bytes (`src/core/task-diff.ts:32`).
-5. WHEN provenance is `head-expected` THEN it SHALL be rendered as a fact with no qualify-your-verdict instruction. WHEN provenance is `head-degraded`, attribution is `mismatch`, or typecheck is `unavailable` or `timeout` THEN the section SHALL carry one sentence telling the reviewer to name that fact in the summary.
+5. WHEN provenance is `head-expected` or `recorded` THEN it SHALL be rendered as a fact with no qualify-your-verdict instruction. WHEN provenance is `head-degraded`, attribution is `mismatch`, or typecheck is `unavailable` or `timeout` THEN the section SHALL carry one sentence telling the reviewer to name that fact in the summary.
 6. WHEN a fact already drives a methodology directive (`buildReviewMethodology`, `src/tools/review-task.ts:661-766`) THEN the methodology SHALL own the instruction and `executionContext` the fact; the disclosure SHALL NOT restate a directive, and no fact SHALL have two emitters.
 7. WHEN the direct MCP path is used THEN `data.executionContext` SHALL be the same object the runner renders, produced once in `handlePrepare`.
 8. WHEN `adversarialReviewHandler` writes the scaffold (`src/tools/adversarial-review.ts:157`) THEN the scaffold SHALL state the workspace and workflow root. The handler drops `workspacePath` today (`:61`), `buildScaffoldedPrompt` (`:342-351`) has no field for it, and `AdversarialRunner` (`src/dashboard/adversarial-runner.ts:49`) builds no prompt (`:116-128`). Adversarial runs disclose the two roots only.
@@ -120,14 +120,14 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 
 ### Reliability
 - Recording a base or attribution never blocks the status change or the log write; failure warns and continues.
-- A missing or corrupt record degrades to disclosed `unknown` and `head-expected`, never to a thrown prepare.
+- A missing or corrupt record degrades to disclosed `unknown` and `head-expected`, never a thrown prepare.
 
 ### Security
-- The record is written only under the workflow root's `.spec-workflow`; it stores paths spec 1 validated and never a path inside a worktree.
+- The record is written only under the workflow root's `.spec-workflow`; it stores paths spec 1 validated, never a worktree path.
 - All new git invocations pass argument arrays with the location variables scrubbed, as `runGit` does.
 
 ### Migration
-- `computeTaskDiff` gains a base parameter; `TypecheckResult` gains a reason value and an `observed` field; `data.executionContext` is new; a per-task record file is new. All fall under spec 1's stated position on exported type shapes.
+- `computeTaskDiff` gains a base parameter; `runGit` (`src/core/task-diff.ts:50-62`) gains an error-cause field (Requirement 1 AC 10); `TypecheckResult` gains a reason value and an `observed` field; `data.executionContext` is new; a per-task record file is new. All fall under spec 1's stated position on exported type shapes.
 - Tasks logged before upgrade are `unknown`; tasks started before upgrade have no base and review from `HEAD`, disclosed.
 - Dashboard-started tasks diff from the recorded base, so a review of committed work is no longer empty; release notes SHALL say so.
 
@@ -149,11 +149,11 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 ## Scope notes
 
 - Carried R7 "cache lives under the workspace, exclusion in `info/exclude`" and the related bare-repository and `.gitignore`-regression notes: dropped (D11); spec 1 decided and implemented the cache location.
-- `d-f3cb6fd8`'s two owned sites (runner instruction, `nextSteps`) were closed by spec 1; only the two pinned sites are in scope here (Requirement 5).
-- Locking for shared-root files other than this spec's new record stays with `worktree-dashboard-concurrency`; Requirement 3 AC 8 covers the new record only.
+- `d-f3cb6fd8`'s two owned sites (runner instruction, `nextSteps`) were closed by spec 1; only the two pinned sites are in scope (Requirement 5).
+- Locking for other shared-root files stays with `worktree-dashboard-concurrency`; Requirement 3 AC 8 covers only the new record.
 - Adversarial runs get roots only; no diff, typecheck or attribution for them.
-- No MCP tool to set a task `in-progress` is added; the hit-rate statement (Requirement 1 AC 3) stands instead.
-- The review gate keeps its caller-supplied `baseRef` default of `HEAD` (`src/tools/review-gate.ts:207-210`).
+- No MCP tool sets a task `in-progress`; Requirement 1 AC 3's hit-rate statement stands instead.
+- The review gate keeps its caller-supplied `baseRef` default `HEAD` (`src/tools/review-gate.ts:207-210`).
 - The deferred decision against `tighter-reviews` (Requirement 2 AC 8, Requirement 5 AC 5) is filed by the orchestrator, not by this document.
 
 ## Revision History
@@ -162,3 +162,9 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 - **v2** (2026-09-17) — Lint pass on v1 from revision input RI-1 (the v1 lint brief; 2 error, 34 warning, 13 info).
   - **RI-1 — Accepted (MUST_FIX).** Applied the interrupted v1 lint pass: re-anchored both out-of-bounds citations, qualified thirteen bare line-only citations with their owning path, added the missing normative word to the one criterion lacking it, and widened or rejected each identifier-mismatch finding on its individual merits.
   - **Lint pass.** 23 fixed; rejected: L-1 (the recorded commit is read by a git helper elsewhere, not by the status route or the path field cited here), L-11 (the field this criterion adds cannot already exist in the type it amends), L-13 (the commit field this criterion adds is new behavior with no reader yet in that handler), L-14, L-15, L-16, L-17 (the four terms name a different function and new state values, not the path-normalizing helper cited inline), L-18, L-19, L-20, L-21, L-22, L-23, L-24 (the object fields named are new; the current response literal cannot already carry them, and the enclosing handler is already cited elsewhere in this document), L-26, L-27, L-28, L-29, L-30, L-31 (these six names are exactly what this criterion adds to a destructure that today carries none of them), L-36 (the cited byte-cap constant has no reason to name a file path defined in a different module), L-37 (the cited byte-cap constant states a size, not the operating-system error the same sentence also mentions), L-38 (the field this criterion adds cannot already exist in the methodology builder it will pass through), L-40 (today's code has no distinct-state label at all; the word only describes an effect callers currently infer), L-48 (the field is a hypothetical probe shape, not a name the generic encoder or the version pin carries), L-49 (the new outcome value cannot exist yet in an end-to-end file this change has not touched).
+- **v3** (2026-09-18) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 2/2/0).
+  - **R1-1 — Accepted (MUST_FIX).** Requirement 1 AC 10's bare line-only citation, left pointing at the wrong file after the v2 lint pass inserted a full path ahead of it, is re-anchored to the byte-cap constant's own file and line.
+  - **R1-2 — Accepted (MUST_FIX).** Requirement 1 AC 4 now scopes "the reviewing workspace only" to the base entry alone and states the attribution field is read regardless of workspace; Requirement 3 AC 3 now states the storage schema in prose — one record per task, base keyed by workspace, attribution shared — so Requirement 3 AC 6 and Requirement 7 AC 3's cross-workspace mismatch read no longer conflicts with Requirement 1's per-workspace base scoping.
+  - **R1-3 — Accepted (SHOULD_FIX).** The Migration section now states the shared diff helper gains an error-cause field, read by Requirement 1 AC 10's classification, so the git-failure cause it names is no longer discarded.
+  - **R1-4 — Accepted (SHOULD_FIX).** Requirement 1 AC 6 now names the provenance value for the validated-base diff, and Requirement 4 AC 5 now renders that value as a fact alongside the no-record case, closing the previously undefined success-case provenance.
+  - **Lint carry-over.** 1 fixed (L-2, via R1-1); rest left: new-behavior identifiers.
````
