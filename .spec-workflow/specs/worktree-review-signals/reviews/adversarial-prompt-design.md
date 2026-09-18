# Adversarial Review — worktree-review-signals/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed below passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open after the lint pass (error = MUST_FIX candidate, warning = your call, info = a note): both `citation-path` errors and the one `citation-range` error were fixed. The reviser rejected 19 `citation-identifier` warnings as classes — (a) prose words the linter mistakes for code identifiers: `undefined`, `null`, `HEAD`, `node_modules`, `timeout`, `fetch`, `mismatch`, `engines`, `dependencies`, `devDependencies`, `optionalDependencies`, `spawnTsc` (lines 79, 172, 178, 251); (b) forward-looking citations for fields/paragraphs this design adds that cannot yet appear in a current-state file: `observed`, `diffStats`, `executionContext` (lines 79, 172, 178); (c) citations that support the migration-position ruling, not identifier presence: `TypecheckResult`, `computeTaskDiff`, `PrepareData`, `BuildPromptOptions`, `buildScaffoldedPrompt` (line 282). Judge each on meaning, not on the linter's identifier match. 70 `citation-bare` info findings (a bare `:NNN` range with no `path:` prefix earlier in its bullet) are traceability nits left untouched; treat as notes.
- Changes: the diff from the `docs(sdd): worktree-review-signals design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `worktree-review-signals` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on (the drafter probed `git merge-base --is-ancestor` exit codes and a `@toon-format/toon` 0.8.0-vs-4.1.1 round-trip).
- The drafter re-decided these requirement literals; rule on each as `refinement` (closed) or `widening` (a MUST_FIX):
  - R4 AC 5 — `feature-disabled` produces no degraded note (design decision D11).
  - R1 AC 11 — `diffBase.commit` is the ref `HEAD` for HEAD provenances, not a sha, to keep one git spawn per prepare (design decision D3).
- Fresh lens for this round: wire contracts across a boundary — the producer-to-consumer shapes this design introduces (`task-state.json`, the exported `ExecutionContext`, the `observed` per-`unavailable` reason table, `diffStats` becoming `null`). Read each producer and each consumer at both ends and check the shapes agree, that every union member and null case is handled, and that a consumer of the old shape does not break.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds: none — this is the first round.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-design.md`. It does not exist yet. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 8633482

````diff
diff --git a/.spec-workflow/specs/worktree-review-signals/design.md b/.spec-workflow/specs/worktree-review-signals/design.md
index b30285c..3d3f129 100644
--- a/.spec-workflow/specs/worktree-review-signals/design.md
+++ b/.spec-workflow/specs/worktree-review-signals/design.md
@@ -49,7 +49,7 @@ graph LR
   ```
   Both writers run `withRegistryLock(lockPath, fn)`; inside `fn`: read, parse, mutate one field, write `uniqueTempPath(filePath)`, `fs.rename`. `acquired: false` returns false with `console.warn`. `bases` keys are `normalizeIdentityPath(workspacePath)`. `read` takes no lock: rename leaves the file complete or absent; missing, unreadable, malformed or `version !== 1` returns null and warns once per file.
 - **Dependencies:** `registry-lock.ts`, `git-utils.ts`, `node:fs/promises`.
-- **Reuses:** `withRegistryLock` (`src/core/registry-lock.ts:350-391`), `RegistryLockResult` (`:38-40`), `uniqueTempPath` (`:52-54`), `writeRegistry`'s temp-then-rename (`src/core/project-registry.ts:277-279`), `normalizeIdentityPath` (`src/core/git-utils.ts:101-112`). The registry's own lock (`registry-lock.ts:7-11`) is not shared.
+- **Reuses:** `withRegistryLock` (`src/core/registry-lock.ts:350-391`), `RegistryLockResult` (`:38-40`), `uniqueTempPath` (`:52-54`), `writeRegistry`'s temp-then-rename (`src/core/project-registry.ts:268-279`), `normalizeIdentityPath` (`src/core/git-utils.ts:101-112`). The registry's own lock (`src/core/registry-lock.ts:7-11`) is not shared.
 
 ### Component 2 — git helpers and base-aware diff (`src/core/task-diff.ts`)
 - **Purpose:** Read `HEAD`, validate ancestry, diff from a base, classify git failure.
@@ -76,9 +76,9 @@ graph LR
     observed: string; rejectionMessage?: string }
   async function probeDeclaredDependencies(workspacePath: string): Promise<{ declared: number; unresolved: string[] } | null>;
   ```
-  `observed` is required, so every construction site states one: `:144`, `:151`, `:156`, `:159`, `:164`, `:199`, `:218`, `:221`, `unwrapTypecheck` (`src/tools/review-task.ts:96-101`), and the probe site. The probe reads `<workspacePath>/package.json`; absent or unparseable returns null and the check proceeds. Names are the keys of `dependencies` and `devDependencies`; `optionalDependencies` are excluded. One `fs.access(<workspacePath>/node_modules/<name>/package.json)` per name, awaited together, against the workspace's own `node_modules` only (D7). It runs after `resolveTscBinary` succeeds (`:162-165`) and before `spawnTsc` (`:188`); any unresolved name returns `reason: 'dependencies-unresolved'` with no spawn. The `no-tsconfig` arm (`:147-152`) adds one `fs.access(<workflowRoot>/tsconfig.json)` so `observed` can state whether the workflow root has one; `tsconfigPath` stays `:141`. The `timeout` (`:193-197`), `output-overflow` (`:198-200`) and `no-parseable-output` (`:217-222`) arms are unchanged apart from `observed`.
+  `observed` is required, so every construction site states one: `:144`, `:151`, `:156`, `:159`, `:164`, `:199`, `:218`, `:221`, `unwrapTypecheck` (`src/tools/review-task.ts:80-101`), and the probe site. The probe reads `<workspacePath>/package.json`; absent or unparseable returns null and the check proceeds. Names are the keys of `dependencies` and `devDependencies`; `optionalDependencies` are excluded. One `fs.access(<workspacePath>/node_modules/<name>/package.json)` per name, awaited together, against the workspace's own `node_modules` only (D7). It runs after `resolveTscBinary` succeeds (`src/core/typecheck.ts:162-165`) and before `spawnTsc` (`:188`); any unresolved name returns `reason: 'dependencies-unresolved'` with no spawn. The `no-tsconfig` arm (`:147-152`) adds one `fs.access(<workflowRoot>/tsconfig.json)` so `observed` can state whether the workflow root has one; `tsconfigPath` stays `:141`. The `timeout` (`:193-197`), `output-overflow` (`:198-200`) and `no-parseable-output` (`:217-222`) arms are unchanged apart from `observed`.
 - **Dependencies:** `node:fs/promises`.
-- **Reuses:** `resolveTscBinary` (`:409-423`); `computeTypecheckMethodologyState` (`src/tools/review-task.ts:55-74`) maps the new reason to `unavailable-other` unchanged; `gate-rules.ts:303-308` prints the reason string unchanged; `R4_6B_TYPECHECK_UNAVAILABLE` (`src/tools/review-task.ts:815-816`) is not edited.
+- **Reuses:** `resolveTscBinary` (`src/core/typecheck.ts:409-423`); `computeTypecheckMethodologyState` (`src/tools/review-task.ts:55-74`) maps the new reason to `unavailable-other` unchanged; `src/core/gate-rules.ts:303-308` prints the reason string unchanged; `R4_6B_TYPECHECK_UNAVAILABLE` (`src/tools/review-task.ts:815-816`) is not edited.
 
 ### Component 4 — `handlePrepare` (`src/tools/review-task.ts:348-536`)
 - **Purpose:** Resolve base and attribution, run the diff from the base, build `executionContext` once.
@@ -108,7 +108,7 @@ graph LR
   - typecheck `timeout`, or `unavailable` with any reason but `feature-disabled`: "Quote `executionContext.typecheck.observed` where the methodology's item 10 asks you to surface the typecheck degradation."
   `head-expected`, `recorded`, `match`, `unknown`, `success` and `feature-disabled` add no note.
 - **Dependencies:** Components 1, 2, 3.
-- **Reuses:** `hasNoReviewableFiles` (`:317-321`), `PathUtils.getWorkflowRoot` (`src/core/path-utils.ts:208-210`), `normalizeIdentityPath`.
+- **Reuses:** `hasNoReviewableFiles` (`src/tools/review-task.ts:317-321`), `PathUtils.getWorkflowRoot` (`src/core/path-utils.ts:208-210`).
 
 ### Component 5 — methodology constants (`src/tools/review-task.ts:661-838`)
 - **Purpose:** An all-drop review carries no read-every-file instruction and no already-committed explanation, without moving a pinned byte.
@@ -117,7 +117,7 @@ graph LR
   `NO_FILES_DIFF_PREAMBLE`, the `no-files` case of `renderDiffPreamble` (`:783-802`): "**No diff and no workspace files.** The implementation log's files did not resolve in the workspace under review, so no pathspec reached git. This is not an empty diff of an unchanged tree and is not evidence that the changes were committed; the implementation is not available to read. Report the unresolved files as a critical finding (see the fileResolution counts)."
   `NO_REVIEWABLE_FILES_DISCLOSURE` (`:345-346`): its last sentence becomes "The methodology header and the diff preamble in this review context state the same: no workspace files resolved and no diff was computed."
 - **Dependencies:** none new.
-- **Reuses:** `R4_1` to `R4_7` (`:771-781`, `:806-819`) unchanged; `FIXTURE_INPUTS` (`src/tools/__tests__/review-task.test.ts:1127`) has no `no-files` entry, so the seventeen fixtures and the drift test (`:1458-1500`) are untouched.
+- **Reuses:** `R4_1_DIFF_PRESENT` to `R4_7_TYPECHECK_TIMEOUT` (`:771-781`, `:806-819`) unchanged; `FIXTURE_INPUTS` (`src/tools/__tests__/review-task.test.ts:1127`) has no `no-files` entry, so the seventeen fixtures and the drift test (`:1458-1500`) are untouched.
 
 ### Component 6 — status route (`src/dashboard/multi-server.ts:1417-1477`)
 - **Purpose:** Record the workspace's `HEAD` when the dashboard sets a task in-progress.
@@ -129,7 +129,7 @@ graph LR
 - **Purpose:** Record where and at which commit the work was logged.
 - **Interfaces:** `:316` becomes `const { workflowRoot: projectPath, workspacePath } = selectRoots(args, context)`. After `addLogEntry` (`:390`): `commit = await readHeadCommit(workspacePath)`, then `new TaskStateStore(specTasksPath).recordAttribution(taskId, { workspacePath, commit, source, loggedAt })` with `source = hasProjectPathOverride(args) ? 'override' : 'context'`. Failure warns; the response (`:395-416`) is unchanged. `hasProjectPathOverride(args)` is a new export of `src/tools/root-selection.ts` holding the predicate at `:203-205`.
 - **Dependencies:** Components 1, 2.
-- **Reuses:** `selectRoots` (`src/tools/root-selection.ts:202-221`); `specTasksPath` (`:341`).
+- **Reuses:** `selectRoots` (`src/tools/root-selection.ts:202-221`); `specTasksPath` (`src/tools/log-implementation.ts:341`).
 
 ### Component 8 — runner (`src/dashboard/task-review-runner.ts`)
 - **Purpose:** Carry the execution context and the diff state into the dashboard prompt; move the diff body to a file.
@@ -163,7 +163,7 @@ graph LR
   - Workspace: <workspacePath>
   - Workflow root: <workflowRoot>
   ```
-  `data.methodology` (`:178`) and `AdversarialRunner` (`src/dashboard/adversarial-runner.ts:111-148`) are unchanged.
+  `data.methodology` (`src/tools/adversarial-review.ts:178`) and `AdversarialRunner` (`src/dashboard/adversarial-runner.ts:49-148`) are unchanged.
 - **Dependencies:** `selectRoots`.
 - **Reuses:** the scaffold writer at `:157`.
 
@@ -248,7 +248,7 @@ Node 20 fields asserted (`agent-rules.md`): `execFile`'s callback `error.code` (
 - **Unit, `src/tools/__tests__/log-implementation.test.ts`:** attribution with `source: 'context'` and, with `args.projectPath`, `'override'`; a non-repository workspace gives `commit: null` and a written entry.
 - **Unit, `src/dashboard/__tests__/multi-server.test.ts`** (route URL form at `:110`): `in-progress` writes `task-state.json` keyed by the project's workspace; `completed` writes nothing; a non-repository workspace returns 200 and writes nothing.
 - **Parity, `src/__tests__/parity-baseline.test.ts:66`:** the wrapper forwards `'HEAD'` as the third argument; diff bytes unchanged (Requirement 7 AC 4).
-- **End-to-end, `e2e/worktree-shared.spec.ts`** (`npm run test:e2e:worktree`): a third seeded task, pending; `PUT /api/projects/<A>/specs/<spec>/tasks/<id>/status` with `{ status: 'in-progress' }` via `fetch` (form at `:400-402`); `writeFile` and `commitAll` on A (`e2e/helpers/worktree-harness.ts:177-179`); `log-implementation` then `review-task prepare` through `callToolFromWorktree` (`:118-175`) from A gives `provenance === 'recorded'`, the committed marker in the diff and `attribution.state === 'match'`; prepare from B gives `mismatch`, and `record` from B succeeds (Requirement 7 AC 3). The dashboard-prompt half of AC 3 is the runner unit case.
+- **End-to-end, `e2e/worktree-shared.spec.ts`** (`npm run test:e2e:worktree`): a third seeded task, pending; `PUT /api/projects/<A>/specs/<spec>/tasks/<id>/status` with `{ status: 'in-progress' }` via `fetch` (form at `:400-402`); `writeFile` and `commitAll` on A (`e2e/helpers/worktree-harness.ts:177-179`); `log-implementation` then `review-task prepare` through `callToolFromWorktree` (`e2e/worktree-shared.spec.ts:118-175`) from A gives `provenance === 'recorded'`, the committed marker in the diff and `attribution.state === 'match'`; prepare from B gives `mismatch`, and `record` from B succeeds (Requirement 7 AC 3). The dashboard-prompt half of AC 3 is the runner unit case.
 
 ## Decisions taken in this document
 
@@ -285,3 +285,4 @@ Node 20 fields asserted (`agent-rules.md`): `execFile`'s callback `error.code` (
 ## Revision History
 
 - **v1** (2026-09-18) — Initial draft.
+  - **Lint pass.** 16 fixed (L-1, L-2, L-4, L-9, L-10, L-12 to L-21, L-29 — corrected bare paths, widened citation ranges to cover the named identifier, or re-anchored a citation after a mid-bullet file change); rejected: L-3, L-25, L-26 (name a field or paragraph this design adds; it cannot appear in a current-state citation), L-5 to L-8, L-11, L-22 to L-24, L-27, L-28, L-30 (prose word, not a cited identifier), L-31 to L-35 (the citation supports the migration-position ruling, not a claim the identifiers appear in that file).
````
