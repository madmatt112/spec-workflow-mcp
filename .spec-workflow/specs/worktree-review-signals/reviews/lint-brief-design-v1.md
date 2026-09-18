# Lint brief — worktree-review-signals design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` (v1). Cap: 4,000 words (body is 3,994 — there is almost no slack; a fix that adds a clause removes one elsewhere).
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md`.
- Findings: the list under `## Findings` below (from `spec-lint`).
- Code under `/home/mcf/repo/spec-workflow-mcp`.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what requirements pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a `codebase-context.md` line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same citation pattern) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.

## Notes on the three error findings (must resolve)
- L-2 and L-13 are `citation-path` errors: a cited path resolves under no base. The document cites `registry-lock.ts` (line 52) and `gate-rules.ts` (line 81) without a resolvable directory prefix. Correct each to the real path under `/home/mcf/repo/spec-workflow-mcp` (e.g. `src/core/...`) after confirming the file exists, or remove the citation if the file does not exist.
- L-19 is a `citation-range` error: `src/tools/root-selection.ts:341` is out of bounds (the file has 221 lines). Find the correct line for the cited artifact and fix the range, or drop it.

## Note on the info findings (do NOT list them individually; a class)
`spec-lint` also raised 70 `citation-bare` info findings: a bare range like `:183-184` with no `path:` prefix earlier in its bullet/block. These are traceability nits, not errors. Where a bullet's owning file is obvious and the prefix costs no cap, add the `path:` prefix to the first bare range in that bullet. Where adding prefixes would breach the 4,000-word cap, leave them; they carry to the reviewer as notes. Do not enumerate these in your Lint-pass bullet.

## Note on identifier warnings
Many `citation-identifier` warnings name prose words the linter mistakes for code identifiers (for example 'undefined', 'null', 'HEAD', 'node_modules', 'timeout', 'fetch', 'mismatch', 'engines', 'dependencies'). Reject those with the reason 'prose word, not a cited identifier'. For genuine code identifiers absent from the cited range (for example 'writeRegistry', 'resolveTscBinary', 'specTasksPath', 'methodology', 'computeTaskDiff'), either fix the range so it contains the identifier, or drop the identifier reference.

## Findings
L-1 (warning, citation-identifier, line 52): Identifier 'writeRegistry' absent from cited ranges (src/core/registry-lock.ts:350-391, :38-40, :52-54, src/core/project-registry.ts:277-279, ...).
L-2 (error, citation-path, line 52): Cited path resolves under no base (code root, spec store, spec dir): registry-lock.ts.
L-3 (warning, citation-identifier, line 79): Identifier 'observed' absent from cited ranges (src/tools/review-task.ts:96-101, :162-165, :188, :147-152, ...).
L-4 (warning, citation-identifier, line 79): Identifier 'unwrapTypecheck' absent from same cited ranges.
L-5 (warning, citation-identifier, line 79): Identifier 'dependencies' absent from same cited ranges.
L-6 (warning, citation-identifier, line 79): Identifier 'devDependencies' absent from same cited ranges.
L-7 (warning, citation-identifier, line 79): Identifier 'optionalDependencies' absent from same cited ranges.
L-8 (warning, citation-identifier, line 79): Identifier 'node_modules' absent from same cited ranges.
L-9 (warning, citation-identifier, line 79): Identifier 'resolveTscBinary' absent from same cited ranges.
L-10 (warning, citation-identifier, line 79): Identifier 'spawnTsc' absent from same cited ranges.
L-11 (warning, citation-identifier, line 79): Identifier 'timeout' absent from same cited ranges.
L-12 (warning, citation-identifier, line 81): Identifier 'resolveTscBinary' absent from cited ranges (src/tools/review-task.ts:55-74, :815-816).
L-13 (error, citation-path, line 81): Cited path resolves under no base: gate-rules.ts.
L-14 (warning, citation-identifier, line 111): Identifier 'hasNoReviewableFiles' absent from cited ranges (src/core/path-utils.ts:208-210).
L-15 (warning, citation-identifier, line 111): Identifier 'normalizeIdentityPath' absent from cited ranges (src/core/path-utils.ts:208-210).
L-16 (warning, citation-identifier, line 120): Identifier 'R4_1' absent from cited ranges (src/tools/__tests__/review-task.test.ts:1127, :1458-1500).
L-17 (warning, citation-identifier, line 120): Identifier 'R4_7' absent from same cited ranges.
L-18 (warning, citation-identifier, line 132): Identifier 'specTasksPath' absent from cited ranges (src/tools/root-selection.ts:202-221).
L-19 (error, citation-range, line 132): Cited range src/tools/root-selection.ts:341 is out of bounds (file has 221 lines).
L-20 (warning, citation-identifier, line 166): Identifier 'methodology' absent from cited ranges (src/dashboard/adversarial-runner.ts:111-148).
L-21 (warning, citation-identifier, line 166): Identifier 'AdversarialRunner' absent from same cited ranges.
L-22 (warning, citation-identifier, line 172): Identifier 'undefined' absent from cited ranges (e2e/worktree-shared.spec.ts:81-100).
L-23 (warning, citation-identifier, line 172): Identifier 'null' absent from same cited ranges.
L-24 (warning, citation-identifier, line 172): Identifier 'engines' absent from same cited ranges.
L-25 (warning, citation-identifier, line 172): Identifier 'diffStats' absent from same cited ranges.
L-26 (warning, citation-identifier, line 178): Identifier 'executionContext' absent from cited ranges (docs/TOOLS-REFERENCE.md:401-458, :381-399).
L-27 (warning, citation-identifier, line 178): Identifier 'HEAD' absent from same cited ranges.
L-28 (warning, citation-identifier, line 251): Identifier 'fetch' absent from cited ranges (e2e/helpers/worktree-harness.ts:177-179, :118-175).
L-29 (warning, citation-identifier, line 251): Identifier 'callToolFromWorktree' absent from same cited ranges.
L-30 (warning, citation-identifier, line 251): Identifier 'mismatch' absent from same cited ranges.
L-31 (warning, citation-identifier, line 282): Identifier 'TypecheckResult' absent from cited ranges (.spec-workflow/specs/worktree-execution-context/design.md:303).
L-32 (warning, citation-identifier, line 282): Identifier 'computeTaskDiff' absent from same cited range.
L-33 (warning, citation-identifier, line 282): Identifier 'PrepareData' absent from same cited range.
L-34 (warning, citation-identifier, line 282): Identifier 'BuildPromptOptions' absent from same cited range.
L-35 (warning, citation-identifier, line 282): Identifier 'buildScaffoldedPrompt' absent from same cited range.
