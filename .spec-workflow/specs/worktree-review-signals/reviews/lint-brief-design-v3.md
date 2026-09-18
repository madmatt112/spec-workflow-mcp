# Lint brief — worktree-review-signals design v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` (v3). Cap: 4,000 words (body is 3,999 — NO slack; a corrected path that adds characters must be paid for by trimming a few words of adjacent prose so the body stays at or under 4,000).
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md`.
- Findings: the list under `## Findings` (from `spec-lint` on v3).
- Code under `/home/mcf/repo/spec-workflow-mcp`.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX in the narrow check.
3. Do not widen scope, and do not re-decide what requirements pinned.
4. Edit v3 in place. Add no version line. Append under the v3 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: D11 and D3.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a `codebase-context.md` line an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet.

## The three errors (MUST fix — the v3 corrective-pass delta introduced them)
- L-13, L-14 (line 107): `src/types.ts:512-520` and `src/types.ts:521-526` are out of bounds — `src/types.ts` has only 296 lines. Those ranges belong to a different file: the `nextSteps` and `projectContext` fields the passage names live in `src/tools/review-task.ts` (the v2 lint pass already anchored `nextSteps` at review-task.ts:512-520 and `projectContext` at :521-526). Change the file in each citation from `src/types.ts` to `src/tools/review-task.ts` after confirming the two ranges hold those fields, or drop the range if it does not.
- L-27 (line 241): `registry-lock.ts` is a bare filename that resolves under no base. Prefix it with its real path `src/core/registry-lock.ts` after confirming the cited line, or use the real path.

## Prose-word / forward-looking / policy warnings (reject with a reason, as in v1 and v2)
L-1 to L-4 (`observed`, `dependencies`, `devDependencies`, `optionalDependencies`), L-5 to L-12 (line 106 identifiers `taskContext`, `implementationSummary`, `computeDiffMethodologyState`, `rejection`, `noReviewableFiles`, `nextSteps`, `projectContext`, `notes` — each already carries its own correct citation elsewhere in the same passage, or is this design's own new vocabulary; the linter's identifier check bleeds across the run-on bullet), L-15, L-16 (`R4_1_DIFF_PRESENT`, `R4_7_TYPECHECK_TIMEOUT` — verified at review-task.test.ts:771-781/806-819 already cited in the same bullet), L-17, L-18 (`diffStats`, `toEqual` — prose/forward), L-19, L-20 (`executionContext`, `HEAD` — prose in a doc citation), L-21 to L-23 (`fetch`, `mismatch`, `record` — prose), L-24 to L-28-warn (`TypecheckResult`, `computeTaskDiff`, `PrepareData`, `BuildPromptOptions`, `buildScaffoldedPrompt` — the citation supports spec 1's migration-position ruling, not identifier presence). Reject each with its one-line reason; do not enumerate the 73 `citation-bare` info findings.

## Info findings (a class — do NOT list individually)
73 `citation-bare` info findings (bare `:NNN` range, no `path:` prefix earlier in the bullet) are traceability nits. Leave them; the cap has no slack. Do not enumerate them in your Lint-pass bullet.

## Findings
L-1 (warning, citation-identifier, line 79): 'observed' absent from cited ranges (review-task.ts:80-101, typecheck.ts:162-165/188/147-152/...).
L-2 (warning, citation-identifier, line 79): 'dependencies' absent from same ranges.
L-3 (warning, citation-identifier, line 79): 'devDependencies' absent from same ranges.
L-4 (warning, citation-identifier, line 79): 'optionalDependencies' absent from same ranges.
L-5 (warning, citation-identifier, line 106): 'taskContext' absent from src/core/task-parser.ts:108-128, src/types.ts:162-212, src/types.ts:146-149.
L-6 (warning, citation-identifier, line 106): 'implementationSummary' absent from same ranges.
L-7 (warning, citation-identifier, line 106): 'computeDiffMethodologyState' absent from same ranges.
L-8 (warning, citation-identifier, line 106): 'rejection' absent from same ranges.
L-9 (warning, citation-identifier, line 106): 'noReviewableFiles' absent from same ranges.
L-10 (warning, citation-identifier, line 106): 'nextSteps' absent from same ranges.
L-11 (warning, citation-identifier, line 106): 'projectContext' absent from same ranges.
L-12 (warning, citation-identifier, line 106): 'notes' absent from same ranges.
L-13 (error, citation-range, line 107): src/types.ts:512-520 out of bounds (src/types.ts has 296 lines).
L-14 (error, citation-range, line 107): src/types.ts:521-526 out of bounds (src/types.ts has 296 lines).
L-15 (warning, citation-identifier, line 123): 'R4_1_DIFF_PRESENT' absent from review-task.test.ts:1127, :1458-1500.
L-16 (warning, citation-identifier, line 123): 'R4_7_TYPECHECK_TIMEOUT' absent from review-task.test.ts:1127, :1458-1500.
L-17 (warning, citation-identifier, line 175): 'diffStats' absent from src/types.ts:74, src/server.ts:205/222, src/tools/review-task.ts:525, e2e/worktree-shared.spec.ts:81-100.
L-18 (warning, citation-identifier, line 175): 'toEqual' absent from same ranges.
L-19 (warning, citation-identifier, line 181): 'executionContext' absent from docs/TOOLS-REFERENCE.md:401-458/381-399.
L-20 (warning, citation-identifier, line 181): 'HEAD' absent from docs/TOOLS-REFERENCE.md:401-458/381-399.
L-21 (warning, citation-identifier, line 256): 'fetch' absent from e2e/helpers/worktree-harness.ts:177-179, e2e/worktree-shared.spec.ts:118-175.
L-22 (warning, citation-identifier, line 256): 'mismatch' absent from same ranges.
L-23 (warning, citation-identifier, line 256): 'record' absent from same ranges.
L-24 (warning, citation-identifier, line 287): 'TypecheckResult' absent from worktree-execution-context/design.md:303.
L-25 (warning, citation-identifier, line 287): 'computeTaskDiff' absent from same range.
L-26 (warning, citation-identifier, line 287): 'PrepareData' absent from same range.
L-27b (warning, citation-identifier, line 287): 'BuildPromptOptions' absent from same range.
L-28b (warning, citation-identifier, line 287): 'buildScaffoldedPrompt' absent from same range.
L-27 (error, citation-path, line 241): cited path resolves under no base: registry-lock.ts.
Note: the three errors are L-13, L-14 (line 107 out-of-bounds src/types.ts ranges) and L-27 (line 241 bare registry-lock.ts). Everything else is a warning to fix (line 107 file swap already covered) or reject with a reason as in prior lint passes.
