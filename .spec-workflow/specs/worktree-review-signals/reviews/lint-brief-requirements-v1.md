# Lint brief — worktree-review-signals requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings under `## Findings` in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: the requirements.md above (v1). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: the list under `## Findings`, numbered L-1..L-49 as `(severity, rule, line): message`. Code under `/home/mcf/repo/spec-workflow-mcp`.

## Priority guidance
- The two `citation-range` ERRORS are out-of-bounds citations — the cited artifact is wrong; both MUST be fixed. L-10: `.spec-workflow/specs/tighter-reviews/requirements.md:1455-1457` is out of bounds (that file has 300 lines). That file is TRACKED, not gitignored (`git ls-files` lists it), so re-anchor the citation to the real range — the byte-pinned methodology-reasons material in `tighter-reviews/requirements.md`, or the drift test in `src/tools/__tests__/review-task.test.ts` — after reading both ends. L-47: `src/core/task-diff.ts:777-778` is out of bounds (that file has 422 lines); re-cite the real range for the claim (verify whether the intended artifact is in `task-diff.ts` or `review-task.ts`, whose R4_2B/rejection constants live near lines 774-815).
- L-12 (`ears-shape`): Requirement 2 criterion 9 has no `SHALL`; reword it to EARS shape with `SHALL`. Check every other acceptance criterion for the same defect and fix each (rule 9).
- `citation-identifier` warnings: for each, either correct the cited range so the named identifier token appears within it (read both ends), or REJECT with a one-line reason when the token is a described concept the range implements rather than a literal string present there — never fabricate a range or invent a line to satisfy the linter.
- `citation-bare` info findings: add the owning path prefix to an earlier citation in that block so the bare `:NNN` range resolves to a file, or reject if the block already names the path upstream. Info findings are low severity — fix the cheap ones, reject the rest with a reason.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, ...>`. List every rejected L-n by id with its reason on that bullet.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same citation pattern, identifier, or criterion shape) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.

## Findings
L-1 (warning, citation-identifier, line 19): Identifier 'HEAD' is absent from the cited ranges (src/dashboard/multi-server.ts:1417-1477, src/dashboard/project-manager.ts:14)
L-2 (warning, citation-identifier, line 20): Identifier 'HEAD' is absent from the cited ranges (src/core/task-diff.ts:50-62)
L-3 (warning, citation-identifier, line 28): Identifier 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' is absent from the cited ranges (src/core/task-diff.ts:191-193, src/core/task-diff.ts:30)
L-4 (warning, citation-identifier, line 28): Identifier 'rejected' is absent from the cited ranges (src/core/task-diff.ts:191-193, src/core/task-diff.ts:30)
L-5 (info, citation-bare, line 38): Bare range `:188` has no earlier path citation in its block
L-6 (info, citation-bare, line 41): Bare range `:147-152` has no earlier path citation in its block
L-7 (info, citation-bare, line 41): Bare range `:141` has no earlier path citation in its block
L-8 (info, citation-bare, line 42): Bare range `:217-222` has no earlier path citation in its block
L-9 (info, citation-bare, line 42): Bare range `:198-200` has no earlier path citation in its block
L-10 (ERROR, citation-range, line 44): Cited range .spec-workflow/specs/tighter-reviews/requirements.md:1455-1457 is out of bounds (file has 300 lines)
L-11 (warning, citation-identifier, line 45): Identifier 'observed' is absent from the cited ranges (src/core/typecheck.ts:17-47, src/tools/review-task.ts:55-74)
L-12 (warning, ears-shape, line 45): Requirement 2 criterion 9 has no `SHALL`
L-13 (warning, citation-identifier, line 53): Identifier 'HEAD' is absent from the cited ranges (src/tools/log-implementation.ts:297-429, :316, :376-388)
L-14 (warning, citation-identifier, line 58): Identifier 'handlePrepare' is absent from the cited ranges (src/core/git-utils.ts:101)
L-15 (warning, citation-identifier, line 58): Identifier 'match' is absent (src/core/git-utils.ts:101)
L-16 (warning, citation-identifier, line 58): Identifier 'mismatch' is absent (src/core/git-utils.ts:101)
L-17 (warning, citation-identifier, line 58): Identifier 'unknown' is absent (src/core/git-utils.ts:101)
L-18 (warning, citation-identifier, line 69): Identifier 'handlePrepare' is absent (src/tools/review-task.ts:494-511, :521-526, src/core/path-utils.ts:208-210)
L-19 (warning, citation-identifier, line 69): Identifier 'executionContext' is absent (same ranges as L-18)
L-20 (warning, citation-identifier, line 69): Identifier 'workspacePath' is absent (same ranges as L-18)
L-21 (warning, citation-identifier, line 69): Identifier 'specWorkflowDir' is absent (same ranges as L-18)
L-22 (warning, citation-identifier, line 69): Identifier 'diffBase' is absent (same ranges as L-18)
L-23 (warning, citation-identifier, line 69): Identifier 'observed' is absent (same ranges as L-18)
L-24 (warning, citation-identifier, line 69): Identifier 'attribution' is absent (same ranges as L-18)
L-25 (warning, citation-identifier, line 70): Identifier 'TaskReviewRunner' is absent (src/dashboard/task-review-runner.ts:177, :66-91)
L-26 (warning, citation-identifier, line 70): Identifier 'executionContext' is absent (same ranges as L-25)
L-27 (warning, citation-identifier, line 70): Identifier 'diff' is absent (same ranges as L-25)
L-28 (warning, citation-identifier, line 70): Identifier 'diffStats' is absent (same ranges as L-25)
L-29 (warning, citation-identifier, line 70): Identifier 'diffTruncated' is absent (same ranges as L-25)
L-30 (warning, citation-identifier, line 70): Identifier 'skippedPaths' is absent (same ranges as L-25)
L-31 (warning, citation-identifier, line 70): Identifier 'diffRejection' is absent (same ranges as L-25)
L-32 (info, citation-bare, line 71): Bare range `:287-434` has no earlier path citation in its block
L-33 (info, citation-bare, line 72): Bare range `:204` has no earlier path citation in its block
L-34 (info, citation-bare, line 72): Bare range `:272` has no earlier path citation in its block
L-35 (info, citation-bare, line 72): Bare range `:473` has no earlier path citation in its block
L-36 (warning, citation-identifier, line 72): Identifier 'outputPath' is absent (src/core/task-diff.ts:32)
L-37 (warning, citation-identifier, line 72): Identifier 'E2BIG' is absent (src/core/task-diff.ts:32)
L-38 (warning, citation-identifier, line 74): Identifier 'executionContext' is absent (src/tools/review-task.ts:661-766)
L-39 (warning, citation-identifier, line 76): Identifier 'AdversarialRunner' is absent (src/tools/adversarial-review.ts:157, :61, :342-351, src/dashboard/adversarial-review-runner.ts)
L-40 (warning, citation-identifier, line 85): Identifier 'empty' is absent (src/tools/review-task.ts:317-321, src/core/task-diff.ts:179-181, src/tools/review-task.ts:774-775)
L-41 (info, citation-bare, line 86): Bare range `:675` has no earlier path citation in its block
L-42 (info, citation-bare, line 88): Bare range `:345-346` has no earlier path citation in its block
L-43 (info, citation-bare, line 88): Bare range `:389-393` has no earlier path citation in its block
L-44 (info, citation-bare, line 88): Bare range `:515-517` has no earlier path citation in its block
L-45 (warning, citation-identifier, line 90): Identifier 'rejected' is absent (src/core/task-diff.ts:168-177)
L-46 (warning, citation-identifier, line 90): Identifier 'R4_2B_DIFF_REJECTED' is absent (src/core/task-diff.ts:168-177)
L-47 (ERROR, citation-range, line 90): Cited range src/core/task-diff.ts:777-778 is out of bounds (file has 422 lines)
L-48 (warning, citation-identifier, line 98): Identifier 'executionContext' is absent (src/types.ts:288-296, package.json:72)
L-49 (warning, citation-identifier, line 107): Identifier 'recorded' is absent (e2e/worktree-shared.spec.ts:322-657)
