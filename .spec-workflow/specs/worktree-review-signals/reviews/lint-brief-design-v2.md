# Lint brief — worktree-review-signals design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` (v2). Cap: 4,000 words (body is 3,998 — NO slack; adding a directory prefix to a citation costs words, so shorten prose elsewhere to stay at or under 4,000).
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md`.
- Findings: the list under `## Findings` (from `spec-lint` on v2).
- Code under `/home/mcf/repo/spec-workflow-mcp`.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what requirements pinned.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: D11 and D3.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a `codebase-context.md` line an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet.

## The eight citation-path errors (MUST fix — the v2 delta introduced them)
L-11, L-12, L-13, L-14 (line 106–107) cite `types.ts`; L-28, L-29, L-30, L-31 (line 175) cite `types.ts`, `server.ts`, `server.ts`, `review-task.ts`. Each is a bare filename with no resolvable directory, so it resolves under no base. Prefix each with its real path under `src/` after confirming the file and line (for example `src/core/types.ts`, `src/index.ts` or the real server file, `src/tools/review-task.ts`). Verify the cited line actually holds the artifact; if the file is elsewhere, use the real path. Because the cap has no slack, trim adjacent prose to absorb the added path characters.

## Genuine miscitations to fix
- L-2 to L-10 (line 106): the design cites `src/core/task-parser.ts:108-128` (that range is `ParsedTask`) for fields that belong to `PrepareData`/the prepare response (`taskContext`, `implementationSummary`, `ImplementationLogEntry`, `computeDiffMethodologyState`, `rejection`, `noReviewableFiles`, `nextSteps`, `projectContext`, `notes`). Re-anchor each to the file and range that actually defines it, or drop the identifier reference if it is a field this design adds (a forward-looking name cannot cite a current-state range).
- L-17, L-18 (line 123): `R4_1_DIFF_PRESENT`, `R4_7_TYPECHECK_TIMEOUT` are absent from the cited test range `src/tools/__tests__/review-task.test.ts:1127, :1458-1500`. Find the real line for each constant and fix the range, or drop the constant name.

## Prose-word / forward-looking warnings (reject with a reason, as in v1)
L-1 (`observed`), L-5 to L-9 (`dependencies`, `devDependencies`, `optionalDependencies`, `node_modules` — package.json keys / prose), L-25 to L-27 (`undefined`, `dashboardUrl`, `diffStats`, `toEqual` — prose/forward), L-32, L-33 (`executionContext`, `HEAD` — prose in a doc citation), L-34 to L-36 (`fetch`, `mismatch`, `record` — prose), L-37 to L-41 (`TypecheckResult`, `computeTaskDiff`, `PrepareData`, `BuildPromptOptions`, `buildScaffoldedPrompt` — the citation supports the migration-position ruling, not identifier presence). Reject each with its one-line reason; do not enumerate the 67 `citation-bare` info findings.

## Info findings (a class — do NOT list individually)
67 `citation-bare` info findings (bare `:NNN` range, no `path:` prefix earlier in the bullet) are traceability nits. Leave them; the cap has no slack. Do not enumerate them in your Lint-pass bullet.

## Findings
L-1 (warning, citation-identifier, line 79): 'observed' absent from cited ranges (review-task.ts:80-101, typecheck.ts:162-165/188/147-152/...).
L-2 (warning, citation-identifier, line 79): 'dependencies' absent from same ranges.
L-3 (warning, citation-identifier, line 79): 'devDependencies' absent from same ranges.
L-4 (warning, citation-identifier, line 79): 'optionalDependencies' absent from same ranges.
L-5 (warning, citation-identifier, line 79): 'node_modules' absent from same ranges.
L-6 (warning, citation-identifier, line 106): 'taskContext' absent from src/core/task-parser.ts:108-128.
L-7 (warning, citation-identifier, line 106): 'implementationSummary' absent from src/core/task-parser.ts:108-128.
L-8 (warning, citation-identifier, line 106): 'ImplementationLogEntry' absent from src/core/task-parser.ts:108-128.
L-9 (warning, citation-identifier, line 106): 'computeDiffMethodologyState' absent from src/core/task-parser.ts:108-128.
L-10 (warning, citation-identifier, line 106): 'rejection' absent from src/core/task-parser.ts:108-128.
L-11 (error, citation-path, line 106): cited path resolves under no base: types.ts.
L-12 (error, citation-path, line 106): cited path resolves under no base: types.ts (second occurrence).
L-13 (error, citation-path, line 107): cited path resolves under no base: types.ts.
L-14 (error, citation-path, line 107): cited path resolves under no base: types.ts (second occurrence).
L-15 (warning, citation-identifier, line 106): 'noReviewableFiles' absent from src/core/task-parser.ts:108-128.
L-16 (warning, citation-identifier, line 106): 'nextSteps' absent from src/core/task-parser.ts:108-128.
L-17 (warning, citation-identifier, line 123): 'R4_1_DIFF_PRESENT' absent from review-task.test.ts:1127, :1458-1500.
L-18 (warning, citation-identifier, line 123): 'R4_7_TYPECHECK_TIMEOUT' absent from review-task.test.ts:1127, :1458-1500.
L-19 (warning, citation-identifier, line 106): 'projectContext' absent from src/core/task-parser.ts:108-128.
L-20 (warning, citation-identifier, line 106): 'notes' absent from src/core/task-parser.ts:108-128.
L-21 (warning, citation-identifier, line 175): 'undefined' absent from e2e/worktree-shared.spec.ts:81-100.
L-22 (warning, citation-identifier, line 175): 'dashboardUrl' absent from e2e/worktree-shared.spec.ts:81-100.
L-23 (warning, citation-identifier, line 175): 'diffStats' absent from e2e/worktree-shared.spec.ts:81-100.
L-24 (warning, citation-identifier, line 175): 'toEqual' absent from e2e/worktree-shared.spec.ts:81-100.
L-25 (error, citation-path, line 175): cited path resolves under no base: types.ts.
L-26 (error, citation-path, line 175): cited path resolves under no base: server.ts.
L-27 (error, citation-path, line 175): cited path resolves under no base: server.ts (second occurrence).
L-28 (error, citation-path, line 175): cited path resolves under no base: review-task.ts.
L-29 (warning, citation-identifier, line 181): 'executionContext' absent from docs/TOOLS-REFERENCE.md:401-458/381-399.
L-30 (warning, citation-identifier, line 181): 'HEAD' absent from docs/TOOLS-REFERENCE.md:401-458/381-399.
L-31 (warning, citation-identifier, line 254): 'fetch' absent from e2e/helpers/worktree-harness.ts:177-179, e2e/worktree-shared.spec.ts:118-175.
L-32 (warning, citation-identifier, line 254): 'mismatch' absent from same ranges.
L-33 (warning, citation-identifier, line 254): 'record' absent from same ranges.
L-34 (warning, citation-identifier, line 285): 'TypecheckResult' absent from worktree-execution-context/design.md:303.
L-35 (warning, citation-identifier, line 285): 'computeTaskDiff' absent from worktree-execution-context/design.md:303.
L-36 (warning, citation-identifier, line 285): 'PrepareData' absent from worktree-execution-context/design.md:303.
L-37 (warning, citation-identifier, line 285): 'BuildPromptOptions' absent from worktree-execution-context/design.md:303.
L-38 (warning, citation-identifier, line 285): 'buildScaffoldedPrompt' absent from worktree-execution-context/design.md:303.
Note: the eight citation-path errors are L-11, L-12, L-13, L-14 (line 106-107) and L-25, L-26, L-27, L-28 (line 175). The genuine wrong-range identifier miscitations are L-6 to L-10, L-15, L-16, L-19, L-20 (line 106) and L-17, L-18 (line 123). The rest are prose-word or forward-looking or policy citations to reject with a reason, as in v1.
