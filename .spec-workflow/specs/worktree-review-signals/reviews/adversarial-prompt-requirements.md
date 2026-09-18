# Adversarial Review — worktree-review-signals/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2. This is round 1, the first adversarial review of this document. v2 is v1 plus a lint pass (no reviewer has seen either); the whole document is under review, not only the diff.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2. No lint pass ran on v2, so no citation was changed after that run; a rule with no finding listed here passed. Still open (all `citation-identifier` warnings — your call: an identifier the criterion introduces as new behavior is not a citation defect, an identifier the criterion claims already exists in the cited range is):
  - L-1 (warning, citation-identifier, line 19): Identifier 'HEAD' is absent from the cited ranges (src/dashboard/multi-server.ts:1417-1477, src/dashboard/project-manager.ts:14)
  - L-2 (warning, citation-identifier, line 28): Identifier 'MAX_BUFFER' is absent from the cited ranges (src/core/task-diff.ts:191-193, src/core/typecheck.ts:478, src/core/typecheck.ts:30, src/core/task-diff.ts:115)
  - L-3 (warning, citation-identifier, line 38): Identifier 'dependencies' is absent from the cited ranges (src/core/typecheck.ts:188)
  - L-4 (warning, citation-identifier, line 38): Identifier 'devDependencies' is absent from the cited ranges (src/core/typecheck.ts:188)
  - L-5 (warning, citation-identifier, line 38): Identifier 'typescript' is absent from the cited ranges (src/core/typecheck.ts:188)
  - L-6 (warning, citation-identifier, line 38): Identifier 'vitest' is absent from the cited ranges (src/core/typecheck.ts:188)
  - L-7 (warning, citation-identifier, line 38): Identifier 'optionalDependencies' is absent from the cited ranges (src/core/typecheck.ts:188)
  - L-8 (warning, citation-identifier, line 41): Identifier 'observed' is absent from the cited ranges (src/core/typecheck.ts:147-152, src/core/typecheck.ts:141)
  - L-9 (warning, citation-identifier, line 42): Identifier 'success' is absent from the cited ranges (src/core/typecheck.ts:217-222, src/core/typecheck.ts:198-200)
  - L-10 (warning, citation-identifier, line 45): Identifier 'observed' is absent from the cited ranges (src/core/typecheck.ts:17-47, src/tools/review-task.ts:55-74)
  - L-11 (warning, citation-identifier, line 53): Identifier 'HEAD' is absent from the cited ranges (src/tools/log-implementation.ts:297-429, src/tools/log-implementation.ts:316, src/tools/log-implementation.ts:376-388)
  - L-12 (warning, citation-identifier, line 58): Identifier 'handlePrepare' is absent from the cited ranges (src/core/git-utils.ts:101)
  - L-13 (warning, citation-identifier, line 58): Identifier 'match' is absent from the cited ranges (src/core/git-utils.ts:101)
  - L-14 (warning, citation-identifier, line 58): Identifier 'mismatch' is absent from the cited ranges (src/core/git-utils.ts:101)
  - L-15 (warning, citation-identifier, line 58): Identifier 'unknown' is absent from the cited ranges (src/core/git-utils.ts:101)
  - L-16 (warning, citation-identifier, line 69): Identifier 'handlePrepare' is absent from the cited ranges (src/tools/review-task.ts:494-511, src/tools/review-task.ts:521-526, src/core/path-utils.ts:208-210)
  - L-17 (warning, citation-identifier, line 69): Identifier 'executionContext' is absent from the cited ranges (same ranges as L-16)
  - L-18 (warning, citation-identifier, line 69): Identifier 'workspacePath' is absent from the cited ranges (same ranges as L-16)
  - L-19 (warning, citation-identifier, line 69): Identifier 'specWorkflowDir' is absent from the cited ranges (same ranges as L-16)
  - L-20 (warning, citation-identifier, line 69): Identifier 'diffBase' is absent from the cited ranges (same ranges as L-16)
  - L-21 (warning, citation-identifier, line 69): Identifier 'observed' is absent from the cited ranges (same ranges as L-16)
  - L-22 (warning, citation-identifier, line 69): Identifier 'attribution' is absent from the cited ranges (same ranges as L-16)
  - L-23 (warning, citation-identifier, line 70): Identifier 'executionContext' is absent from the cited ranges (src/dashboard/task-review-runner.ts:96, src/dashboard/task-review-runner.ts:177, src/dashboard/task-review-runner.ts:66-91)
  - L-24 (warning, citation-identifier, line 70): Identifier 'diff' is absent from the cited ranges (same ranges as L-23)
  - L-25 (warning, citation-identifier, line 70): Identifier 'diffStats' is absent from the cited ranges (same ranges as L-23)
  - L-26 (warning, citation-identifier, line 70): Identifier 'diffTruncated' is absent from the cited ranges (same ranges as L-23)
  - L-27 (warning, citation-identifier, line 70): Identifier 'skippedPaths' is absent from the cited ranges (same ranges as L-23)
  - L-28 (warning, citation-identifier, line 70): Identifier 'diffRejection' is absent from the cited ranges (same ranges as L-23)
  - L-29 (warning, citation-identifier, line 72): Identifier 'E2BIG' is absent from the cited ranges (src/dashboard/task-review-runner.ts:204, src/dashboard/task-review-runner.ts:272, src/dashboard/task-review-runner.ts:473, src/core/task-diff.ts:32)
  - L-30 (warning, citation-identifier, line 74): Identifier 'executionContext' is absent from the cited ranges (src/tools/review-task.ts:661-766)
  - L-31 (warning, citation-identifier, line 85): Identifier 'empty' is absent from the cited ranges (src/tools/review-task.ts:317-321, src/core/task-diff.ts:179-181, src/tools/review-task.ts:774-775)
  - L-32 (warning, citation-identifier, line 88): Identifier 'nextSteps' is absent from the cited ranges (src/tools/review-task.ts:345-346, src/dashboard/task-review-runner.ts:389-393, src/tools/review-task.ts:515-517)
  - L-33 (warning, citation-identifier, line 98): Identifier 'executionContext' is absent from the cited ranges (src/types.ts:288-296, package.json:72)
  - L-34 (warning, citation-identifier, line 107): Identifier 'recorded' is absent from the cited ranges (e2e/worktree-shared.spec.ts:322-657)
- Changes: the diff from the `docs(sdd): worktree-review-signals requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines. It shows only the v1 lint pass; read the whole document.
- First review. Read the decomposition entry for `worktree-review-signals` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Gate A (`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/questions.md`) approved the document's ranked decisions D1, D3, D5, D6 and D7 unchanged; the human delegated the choice. They are not rulings: attack their wording, testability and citations as normal, and if you argue for reversing one, argue from code evidence, not preference.
- Body word count is 3,500 against a cap of 3,500: it is at the cap, not over. Any fix you propose that adds text must name what to cut.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. (This round: the v2 Revision History records the lint findings the v1 lint pass rejected, with reasons.)
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`; read and obey it first.
- Number findings `R1-1`, `R1-2`, … with a severity and a one-line title each, so the reviser can cite them by id.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 13abaed

````diff
diff --git a/.spec-workflow/specs/worktree-review-signals/requirements.md b/.spec-workflow/specs/worktree-review-signals/requirements.md
index b56a8c8..3f9d30d 100644
--- a/.spec-workflow/specs/worktree-review-signals/requirements.md
+++ b/.spec-workflow/specs/worktree-review-signals/requirements.md
@@ -2,7 +2,7 @@
 
 ## Introduction
 
-This spec makes the signal a reviewing agent receives truthful: which commit the diff starts from, whether the typecheck ran, which workspace produced the work, and how those facts reach the prompt on both review paths. It is for developers running agents in parallel git worktrees over one shared `.spec-workflow`, where today a task committed on a branch reviews as an empty diff, a half-installed worktree reviews as a flood of module errors, and a dashboard-spawned reviewer never sees diff or context data. It changes `review-task prepare`, `log-implementation`, the dashboard status route, the task-review runner, the adversarial scaffold and the response encoder.
+This spec makes the signal a reviewing agent receives truthful: which commit the diff starts from, whether the typecheck ran, which workspace produced the work, and how those facts reach the prompt on both review paths. It is for developers running agents in parallel git worktrees over one shared `.spec-workflow`, where a task committed on a branch reviews as an empty diff, a half-installed worktree reviews as a flood of module errors, and a dashboard-spawned reviewer never sees diff or context data. It changes `review-task prepare`, `log-implementation`, the dashboard status route, the task-review runner, the adversarial scaffold and the response encoder.
 
 ## Alignment with Product Vision
 
@@ -17,7 +17,7 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 #### Acceptance Criteria
 
 1. WHEN the dashboard status route (`src/dashboard/multi-server.ts:1417-1477`) changes a task to `in-progress` THEN the server SHALL record a diff base keyed by spec, task ID and the project's translated workspace path (`ProjectContext.workspacePath`, `src/dashboard/project-manager.ts:14`), holding that workspace's `HEAD` commit and the recording time. Keying without the workspace lets worktree B reviewing A's task read A's commit.
-2. WHEN `HEAD` is read for the record THEN it SHALL be read in the workspace being marked, with the git location variables scrubbed as every other git call is (`src/core/task-diff.ts:50-62`). IF the read fails THEN nothing SHALL be recorded and the status change SHALL still succeed.
+2. WHEN `HEAD` is read for the record THEN it SHALL be read in the workspace being marked, with the git location variables scrubbed as every other git call is (`src/core/task-diff.ts:39-62`). IF the read fails THEN nothing SHALL be recorded and the status change SHALL still succeed.
 3. WHEN `tasks.md` is edited directly THEN no base is recorded. No MCP tool sets `in-progress`, so this is the dominant path; design and user documentation SHALL state that the recording site serves dashboard-driven status changes only.
 4. WHEN `handlePrepare` (`src/tools/review-task.ts:348-536`) computes the diff THEN it SHALL read the record for the reviewing workspace only, never another workspace's record for the same task.
 5. WHEN a recorded base is used THEN it SHALL first pass `git merge-base --is-ancestor <base> HEAD` run in the workspace. `git rev-parse --verify` is not sufficient: linked worktrees share one object database, so it succeeds on any sibling branch's commit.
@@ -25,7 +25,7 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 7. IF no record exists for the reviewing workspace THEN the diff SHALL use `HEAD`, disclosed with provenance `head-expected`.
 8. IF the record fails the ancestry check THEN the diff SHALL use `HEAD`, disclosed distinctly with provenance `head-degraded` and the rejected commit named.
 9. WHEN a recorded base equals `HEAD`, and WHEN a non-worktree project has no record, THEN the diff bytes, stats and truncation SHALL equal today's output for the same inputs.
-10. WHEN a git invocation fails on the diff — the `!ok` arm at `src/core/task-diff.ts:191-193`, including `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` against the 16 MB `MAX_BUFFER` at `:30` — THEN the result SHALL classify as `rejected` with a message naming the observed cause, not as the benign empty diff. A base many commits back makes overflow materially likelier.
+10. WHEN a git invocation fails on the diff — the `!ok` arm at `src/core/task-diff.ts:191-193`, including `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` (`src/core/typecheck.ts:478`) against the 16 MB `MAX_BUFFER` at `:30` — THEN the result SHALL classify as `rejected` (`src/core/task-diff.ts:115`) with a message naming the observed cause, not as the benign empty diff. A base many commits back makes overflow materially likelier.
 11. WHEN the base is disclosed THEN the disclosure SHALL name the commit and its provenance and SHALL state that the diff spans the base to the working tree, so changes to the same files committed between base and `HEAD` are included.
 
 ### Requirement 2 — The typecheck degrades honestly (carried R7)
@@ -35,14 +35,14 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 #### Acceptance Criteria
 
 1. WHEN the compiler is resolved THEN it SHALL continue to resolve only under the workspace (`resolveTscBinary`, `src/core/typecheck.ts:409-423`); absence yields `tsc-not-found`, the behaviour spec 1 recorded in Migration.
-2. WHEN the workspace has a `package.json` THEN, before `tsc` is spawned (`:188`), the check SHALL verify that every package named in `dependencies` and `devDependencies` is resolvable from the workspace. Not sampled and not capped: this repository declares 37 and 15 (`package.json`), and every type-critical package (`typescript`, `@types/*`, `vitest`) is a devDependency. `optionalDependencies` are excluded.
+2. WHEN the workspace has a `package.json` THEN, before `tsc` is spawned (`src/core/typecheck.ts:188`), the check SHALL verify that every package named in `dependencies` and `devDependencies` is resolvable from the workspace. Not sampled and not capped: this repository declares 37 and 15 (`package.json`), and every type-critical package (`typescript`, `@types/*`, `vitest`) is a devDependency. `optionalDependencies` are excluded.
 3. IF any declared package is unresolvable THEN the result SHALL be `unavailable` with a new reason value naming dependency resolution, `tsc` SHALL NOT be spawned, and the `observed` text SHALL give the unresolvable count and up to five package names.
 4. WHEN a result is `unavailable` for any reason THEN it SHALL carry an `observed` statement: what was checked, at which path, and what was found. It SHALL describe the observation, not a diagnosis the check did not make.
-5. WHEN the workspace lacks `tsconfig.json` (`:147-152`) THEN `observed` SHALL state whether the workflow root has one, so a worktree missing the file is distinguishable from a project that never had it. `tsconfigPath` stays derived from the workspace (`:141`).
-6. WHEN `tsc` did not run to a parseable completion THEN status SHALL NOT be `success`: the `no-parseable-output` arms (`:217-222`) and `output-overflow` (`:198-200`) SHALL continue, and no diagnostic list — present or absent — SHALL be reported from a run that did not finish.
+5. WHEN the workspace lacks `tsconfig.json` (`src/core/typecheck.ts:147-152`) THEN `observed` SHALL state whether the workflow root has one, so a worktree missing the file is distinguishable from a project that never had it. `tsconfigPath` stays derived from the workspace (`src/core/typecheck.ts:141`).
+6. WHEN `tsc` did not run to a parseable completion THEN status SHALL NOT be `success`: the `no-parseable-output` arms (`src/core/typecheck.ts:217-222`) and `output-overflow` (`src/core/typecheck.ts:198-200`) SHALL continue, and no diagnostic list — present or absent — SHALL be reported from a run that did not finish.
 7. WHEN dependency state is decided THEN it SHALL NOT be inferred from diagnostic shape. A ratio test over `TS2307` cannot distinguish a broken `node_modules` from a large legitimate file move.
-8. (Amends carried R7 AC 6.) WHEN a new `unavailable` reason is added THEN it SHALL be surfaced through the execution-context disclosure (Requirement 4), and `R4_6B_TYPECHECK_UNAVAILABLE` (`src/tools/review-task.ts:815-816`) SHALL NOT be edited by this spec. That constant names six reasons and already omits `wrapper-config` (`src/core/typecheck.ts:35`); it is byte-pinned by the seventeen fixtures under `src/tools/__tests__/__fixtures__/methodology/` and by the two-way drift test (`src/tools/__tests__/review-task.test.ts:1458-1501`) against `.spec-workflow/specs/tighter-reviews/requirements.md:184-186`. That document is tracked (`git ls-files` lists it; `git check-ignore` exits 1), so the test runs in CI too, contrary to the comment at `:1455-1457` and to deferral `d-f3cb6fd8`. The divergence is a deferred decision against `tighter-reviews`, filed by the orchestrator.
-9. WHEN the `TypecheckResult` union (`src/core/typecheck.ts:17-47`) gains a reason value or an `observed` field THEN that lands under the exported-type-shape position spec 1 took in its Migration section. `computeTypecheckMethodologyState` (`src/tools/review-task.ts:55-74`) maps every non-`feature-disabled` reason to `unavailable-other`, so the methodology directive is unchanged.
+8. (Amends carried R7 AC 6.) WHEN a new `unavailable` reason is added THEN it SHALL be surfaced through the execution-context disclosure (Requirement 4), and `R4_6B_TYPECHECK_UNAVAILABLE` (`src/tools/review-task.ts:815-816`) SHALL NOT be edited by this spec. That constant names six reasons and already omits `wrapper-config` (`src/core/typecheck.ts:35`); it is byte-pinned by the seventeen fixtures under `src/tools/__tests__/__fixtures__/methodology/` and by the two-way drift test (`src/tools/__tests__/review-task.test.ts:1458-1501`) against `.spec-workflow/specs/tighter-reviews/requirements.md:184-186`. That document is tracked (`git ls-files` lists it; `git check-ignore` exits 1), so the test runs in CI too, contrary to the comment at `src/tools/__tests__/review-task.test.ts:1455-1457` and to deferral `d-f3cb6fd8`. The divergence is a deferred decision against `tighter-reviews`, filed by the orchestrator.
+9. WHEN the `TypecheckResult` union (`src/core/typecheck.ts:17-47`) gains a reason value or an `observed` field THEN the change SHALL land under the exported-type-shape position spec 1 took in its Migration section. `computeTypecheckMethodologyState` (`src/tools/review-task.ts:55-74`) maps every non-`feature-disabled` reason to `unavailable-other`, so the methodology directive is unchanged.
 
 ### Requirement 3 — Work is attributable to the workspace that produced it (carried R8)
 
@@ -67,13 +67,13 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 #### Acceptance Criteria
 
 1. WHEN `handlePrepare` returns THEN `data` (`src/tools/review-task.ts:494-511`) SHALL carry one object `executionContext` with `workspacePath`; `workflowRoot`, the directory containing `.spec-workflow`, equal to `ToolContext.projectPath`; `specWorkflowDir`, the `.spec-workflow` directory that `projectContext.workflowRoot` (`:521-526`, `PathUtils.getWorkflowRoot`, `src/core/path-utils.ts:208-210`) names today; `diffBase` (commit, provenance, detail); `typecheck` (status, reason, `observed`); and `attribution` (state, logged workspace, logged commit, source). The two root meanings SHALL NOT share a field name.
-2. WHEN `TaskReviewRunner` reads the prepare response THEN its destructure (`src/dashboard/task-review-runner.ts:177`, six fields today, none carrying diff data) SHALL name `executionContext`, `diff`, `diffStats`, `diffTruncated`, `skippedPaths` and `diffRejection`, and `BuildPromptOptions` (`:66-91`) SHALL type each, so an omission is a compile error rather than a silent drop. (Closes `d-6e59490b`.)
-3. WHEN the dashboard prompt is built (`buildPrompt`, `:287-434`) THEN it SHALL contain a section rendering the execution context, the diff state — stats, truncation, skipped paths, and any rejection message verbatim — and where the diff body is.
-4. WHEN the diff body is non-empty on the dashboard path THEN it SHALL be written to a file beside `outputPath` (`:204`) and named in the prompt, removed with the output file (`:272`). The prompt is one argv element (`:473`): under node 24 on Linux, `spawnSync('/bin/true', ['x'.repeat(131072)])` fails with `E2BIG` while 100,000 bytes succeeds, and the diff cap alone is 50,000 bytes (`src/core/task-diff.ts:32`).
+2. WHEN `TaskReviewRunner` (`src/dashboard/task-review-runner.ts:96`) reads the prepare response THEN its destructure (`:177`, six fields today, none carrying diff data) SHALL name `executionContext`, `diff`, `diffStats`, `diffTruncated`, `skippedPaths` and `diffRejection`, and `BuildPromptOptions` (`:66-91`) SHALL type each, so an omission is a compile error rather than a silent drop. (Closes `d-6e59490b`.)
+3. WHEN the dashboard prompt is built (`buildPrompt`, `src/dashboard/task-review-runner.ts:287-434`) THEN it SHALL contain a section rendering the execution context, the diff state — stats, truncation, skipped paths, and any rejection message verbatim — and where the diff body is.
+4. WHEN the diff body is non-empty on the dashboard path THEN it SHALL be written to a file beside `outputPath` (`src/dashboard/task-review-runner.ts:204`) and named in the prompt, removed with the output file (`src/dashboard/task-review-runner.ts:272`). The prompt is one argv element (`src/dashboard/task-review-runner.ts:473`): under node 24 on Linux, `spawnSync('/bin/true', ['x'.repeat(131072)])` fails with `E2BIG` while 100,000 bytes succeeds, and the diff cap alone is 50,000 bytes (`src/core/task-diff.ts:32`).
 5. WHEN provenance is `head-expected` THEN it SHALL be rendered as a fact with no qualify-your-verdict instruction. WHEN provenance is `head-degraded`, attribution is `mismatch`, or typecheck is `unavailable` or `timeout` THEN the section SHALL carry one sentence telling the reviewer to name that fact in the summary.
 6. WHEN a fact already drives a methodology directive (`buildReviewMethodology`, `src/tools/review-task.ts:661-766`) THEN the methodology SHALL own the instruction and `executionContext` the fact; the disclosure SHALL NOT restate a directive, and no fact SHALL have two emitters.
 7. WHEN the direct MCP path is used THEN `data.executionContext` SHALL be the same object the runner renders, produced once in `handlePrepare`.
-8. WHEN `adversarialReviewHandler` writes the scaffold (`src/tools/adversarial-review.ts:157`) THEN the scaffold SHALL state the workspace and workflow root. The handler drops `workspacePath` today (`:61`), `buildScaffoldedPrompt` (`:342-351`) has no field for it, and `AdversarialRunner` builds no prompt (`src/dashboard/adversarial-runner.ts:116-128`). Adversarial runs disclose the two roots only.
+8. WHEN `adversarialReviewHandler` writes the scaffold (`src/tools/adversarial-review.ts:157`) THEN the scaffold SHALL state the workspace and workflow root. The handler drops `workspacePath` today (`:61`), `buildScaffoldedPrompt` (`:342-351`) has no field for it, and `AdversarialRunner` (`src/dashboard/adversarial-runner.ts:49`) builds no prompt (`:116-128`). Adversarial runs disclose the two roots only.
 9. WHEN the runner spawns the agent THEN `SPEC_WORKFLOW_WORKSPACE` and `SPEC_WORKFLOW_SHARED_ROOT` (`src/dashboard/task-review-runner.ts:483-487`) SHALL continue to be set; the prompt disclosure is additional; an agent does not read its environment.
 
 ### Requirement 5 — An all-drop review is honest at every instruction site
@@ -83,11 +83,11 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 #### Acceptance Criteria
 
 1. WHEN no logged file resolved in the workspace (`hasNoReviewableFiles`, `src/tools/review-task.ts:317-321`) THEN the diff state SHALL be a distinct kind, not `empty`. Today the empty `kept` early return (`src/core/task-diff.ts:179-181`) yields `empty` and `R4_2A_DIFF_EMPTY` (`src/tools/review-task.ts:774-775`) fires necessarily.
-2. WHEN that state holds THEN the preamble SHALL be a stated text that does not offer "already committed before review" as an explanation and does not instruct a full read, and the unconditional header at `:675` ("Read ALL files listed in filesToReview") SHALL be replaced by a header stating that no workspace files are available.
+2. WHEN that state holds THEN the preamble SHALL be a stated text that does not offer "already committed before review" as an explanation and does not instruct a full read, and the unconditional header at `src/tools/review-task.ts:675` ("Read ALL files listed in filesToReview") SHALL be replaced by a header stating that no workspace files are available.
 3. WHEN those texts are added THEN they SHALL be new constants, not R4.x blocks. The fixtures' canonical inputs (`src/tools/__tests__/review-task.test.ts:1107-1124`) do not exercise this state and Direction B (`:1482-1500`) inspects fixtures only, so no pin moves. A fixture-free test SHALL assert the all-drop methodology contains neither pinned sentence.
-4. WHEN the prompt no longer contains the two instructions THEN the last sentence of `NO_REVIEWABLE_FILES_DISCLOSURE` (`:345-346`), SHALL be revised to match the prompt rendered on both paths (runner `:389-393`, `nextSteps` `:515-517`).
+4. WHEN the prompt no longer contains the two instructions THEN the last sentence of `NO_REVIEWABLE_FILES_DISCLOSURE` (`src/tools/review-task.ts:345-346`), SHALL be revised to match the prompt rendered on both paths (runner `src/dashboard/task-review-runner.ts:389-393`, `nextSteps` `src/tools/review-task.ts:515-517`).
 5. WHEN this diverges from `tighter-reviews` R4.2a's trigger (`.spec-workflow/specs/tighter-reviews/requirements.md:154-156`: empty diff with `data.diffRejection` absent) THEN the divergence SHALL be recorded in the same deferred decision as Requirement 2 AC 8.
-6. WHEN a containment rejection (`src/core/task-diff.ts:168-177`) or a git-failure rejection (Requirement 1 AC 10) occurs THEN it SHALL keep the `rejected` kind and its own message; `R4_2B_DIFF_REJECTED` (`:777-778`) is not edited.
+6. WHEN a containment rejection (`src/core/task-diff.ts:168-177`, `:115`) or a git-failure rejection (Requirement 1 AC 10) occurs THEN it SHALL keep the `rejected` kind and its own message; `R4_2B_DIFF_REJECTED` (`src/tools/review-task.ts:777-778`) is not edited.
 
 ### Requirement 6 — The prepare response survives its own encoding
 
@@ -116,20 +116,20 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 
 ### Performance
 - One `git rev-parse HEAD` per recording and one `git merge-base` per prepare; no other new git spawn.
-- The dependency probe is one filesystem existence check per declared package (52 here), run before the 30-second `tsc` spawn.
+- The dependency probe is one filesystem existence check per declared package (52 here), before the 30-second `tsc` spawn.
 
 ### Reliability
 - Recording a base or attribution never blocks the status change or the log write; failure warns and continues.
 - A missing or corrupt record degrades to disclosed `unknown` and `head-expected`, never to a thrown prepare.
 
 ### Security
-- The record is written only under the workflow root's `.spec-workflow`; it stores paths spec 1 already validated and never a path inside a worktree.
+- The record is written only under the workflow root's `.spec-workflow`; it stores paths spec 1 validated and never a path inside a worktree.
 - All new git invocations pass argument arrays with the location variables scrubbed, as `runGit` does.
 
 ### Migration
 - `computeTaskDiff` gains a base parameter; `TypecheckResult` gains a reason value and an `observed` field; `data.executionContext` is new; a per-task record file is new. All fall under spec 1's stated position on exported type shapes.
 - Tasks logged before upgrade are `unknown`; tasks started before upgrade have no base and review from `HEAD`, disclosed.
-- Dashboard-started tasks now diff from the recorded base, so a review of committed work is no longer empty; release notes SHALL say so.
+- Dashboard-started tasks diff from the recorded base, so a review of committed work is no longer empty; release notes SHALL say so.
 
 ## Decisions taken in this document
 
@@ -159,3 +159,6 @@ This spec makes the signal a reviewing agent receives truthful: which commit the
 ## Revision History
 
 - **v1** (2026-09-17) — Initial draft.
+- **v2** (2026-09-17) — Lint pass on v1 from revision input RI-1 (the v1 lint brief; 2 error, 34 warning, 13 info).
+  - **RI-1 — Accepted (MUST_FIX).** Applied the interrupted v1 lint pass: re-anchored both out-of-bounds citations, qualified thirteen bare line-only citations with their owning path, added the missing normative word to the one criterion lacking it, and widened or rejected each identifier-mismatch finding on its individual merits.
+  - **Lint pass.** 23 fixed; rejected: L-1 (the recorded commit is read by a git helper elsewhere, not by the status route or the path field cited here), L-11 (the field this criterion adds cannot already exist in the type it amends), L-13 (the commit field this criterion adds is new behavior with no reader yet in that handler), L-14, L-15, L-16, L-17 (the four terms name a different function and new state values, not the path-normalizing helper cited inline), L-18, L-19, L-20, L-21, L-22, L-23, L-24 (the object fields named are new; the current response literal cannot already carry them, and the enclosing handler is already cited elsewhere in this document), L-26, L-27, L-28, L-29, L-30, L-31 (these six names are exactly what this criterion adds to a destructure that today carries none of them), L-36 (the cited byte-cap constant has no reason to name a file path defined in a different module), L-37 (the cited byte-cap constant states a size, not the operating-system error the same sentence also mentions), L-38 (the field this criterion adds cannot already exist in the methodology builder it will pass through), L-40 (today's code has no distinct-state label at all; the word only describes an effect callers currently infer), L-48 (the field is a hypothetical probe shape, not a name the generic encoder or the version pin carries), L-49 (the new outcome value cannot exist yet in an end-to-end file this change has not touched).
````
