# Lint brief — worktree-review-signals requirements v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings under `## Findings` in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected` (group ids that share a disposition and reason); citations verified (count); the document's body word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: the requirements.md above (v2). Cap: 3,500 words for the body (H1 down to the line before `## Revision History`); the body sits exactly at the cap now. Do not grow it past the cap: a fix that adds words removes as many from non-decision prose.
- Findings: the list under `## Findings`, numbered L-1..L-34 for v2 as `(severity, rule, line): message [tag]`. Line numbers refer to v2 as committed, which is the document as it stands now. Code under `/home/mcf/repo/spec-workflow-mcp`; use absolute paths.
- The v2 Revision History line already carries a `Lint pass` bullet from the v1-to-v2 revision pass; it names the v1 lint ids it rejected and their one-line reasons. Read that bullet before you start.

## Priority guidance
- All 34 findings are `citation-identifier` warnings: `spec-lint` on v2 reports 0 error, 34 warning, 0 info. No out-of-bounds range and no bare range is left.
- 25 findings re-flag identifiers the v1-to-v2 pass already rejected with a reason (tagged `[v1 L-n rejected]` below). For each of these, keep the rejection unless a cheap, honest fix exists: a same-function or same-file line where the token literally appears, read at both ends, added to the citation without dropping the existing range. Do not re-litigate a rejection whose reason still holds; carry it forward with the same one-line reason.
- 9 findings are new (tagged `[new]` below): they surfaced when the v1-to-v2 pass gave bare `:NNN` ranges their owning path, so the linter now resolves those ranges. Assess each fresh: when the token is literally present in that file near the cited line, widen or re-anchor the citation after reading both ends; when it is a concept the document proposes or describes (a field this spec adds, a value this spec introduces, a package name the code reads from a manifest), reject with a one-line reason. Never fabricate a range or invent a line to satisfy the linter.
- Gate A is resolved and every decision in `## Decisions taken in this document` was kept as written: you may correct a citation inside that section, but do not change any decision's choice, its options considered, or its reasoning.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line, after its existing nested bullets, one nested bullet: `- **Lint pass (re-lint of v2).** <n> fixed; rejected: <none | L-n reason, ...>` naming every rejected L-n (this brief's v2 numbering) with its one-line reason. A Revision-History bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans; write `` `<name>` `` or the word.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX, gate files and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same cited range or the same identifier claim) and fix each; list them under the Lint pass bullet. A sibling left unchanged is next round's finding.

## Findings
L-1 (warning, citation-identifier, line 19): Identifier 'HEAD' is absent from the cited ranges (src/dashboard/multi-server.ts:1417-1477, src/dashboard/project-manager.ts:14) [v1 L-1 rejected]
L-2 (warning, citation-identifier, line 28): Identifier 'MAX_BUFFER' is absent from the cited ranges (src/core/task-diff.ts:191-193, src/core/typecheck.ts:478, src/core/typecheck.ts:30, src/core/task-diff.ts:115) [new]
L-3 (warning, citation-identifier, line 38): Identifier 'dependencies' is absent from the cited ranges (src/core/typecheck.ts:188) [new]
L-4 (warning, citation-identifier, line 38): Identifier 'devDependencies' is absent from the cited ranges (src/core/typecheck.ts:188) [new]
L-5 (warning, citation-identifier, line 38): Identifier 'typescript' is absent from the cited ranges (src/core/typecheck.ts:188) [new]
L-6 (warning, citation-identifier, line 38): Identifier 'vitest' is absent from the cited ranges (src/core/typecheck.ts:188) [new]
L-7 (warning, citation-identifier, line 38): Identifier 'optionalDependencies' is absent from the cited ranges (src/core/typecheck.ts:188) [new]
L-8 (warning, citation-identifier, line 41): Identifier 'observed' is absent from the cited ranges (src/core/typecheck.ts:147-152, src/core/typecheck.ts:141) [new]
L-9 (warning, citation-identifier, line 42): Identifier 'success' is absent from the cited ranges (src/core/typecheck.ts:217-222, src/core/typecheck.ts:198-200) [new]
L-10 (warning, citation-identifier, line 45): Identifier 'observed' is absent from the cited ranges (src/core/typecheck.ts:17-47, src/tools/review-task.ts:55-74) [v1 L-11 rejected]
L-11 (warning, citation-identifier, line 53): Identifier 'HEAD' is absent from the cited ranges (src/tools/log-implementation.ts:297-429, src/tools/log-implementation.ts:316, src/tools/log-implementation.ts:376-388) [v1 L-13 rejected]
L-12 (warning, citation-identifier, line 58): Identifier 'handlePrepare' is absent from the cited ranges (src/core/git-utils.ts:101) [v1 L-14 rejected]
L-13 (warning, citation-identifier, line 58): Identifier 'match' is absent from the cited ranges (src/core/git-utils.ts:101) [v1 L-15 rejected]
L-14 (warning, citation-identifier, line 58): Identifier 'mismatch' is absent from the cited ranges (src/core/git-utils.ts:101) [v1 L-16 rejected]
L-15 (warning, citation-identifier, line 58): Identifier 'unknown' is absent from the cited ranges (src/core/git-utils.ts:101) [v1 L-17 rejected]
L-16 (warning, citation-identifier, line 69): Identifier 'handlePrepare' is absent from the cited ranges (src/tools/review-task.ts:494-511, src/tools/review-task.ts:521-526, src/core/path-utils.ts:208-210) [v1 L-18 rejected]
L-17 (warning, citation-identifier, line 69): Identifier 'executionContext' is absent from the cited ranges (same ranges as L-16) [v1 L-19 rejected]
L-18 (warning, citation-identifier, line 69): Identifier 'workspacePath' is absent from the cited ranges (same ranges as L-16) [v1 L-20 rejected]
L-19 (warning, citation-identifier, line 69): Identifier 'specWorkflowDir' is absent from the cited ranges (same ranges as L-16) [v1 L-21 rejected]
L-20 (warning, citation-identifier, line 69): Identifier 'diffBase' is absent from the cited ranges (same ranges as L-16) [v1 L-22 rejected]
L-21 (warning, citation-identifier, line 69): Identifier 'observed' is absent from the cited ranges (same ranges as L-16) [v1 L-23 rejected]
L-22 (warning, citation-identifier, line 69): Identifier 'attribution' is absent from the cited ranges (same ranges as L-16) [v1 L-24 rejected]
L-23 (warning, citation-identifier, line 70): Identifier 'executionContext' is absent from the cited ranges (src/dashboard/task-review-runner.ts:96, src/dashboard/task-review-runner.ts:177, src/dashboard/task-review-runner.ts:66-91) [v1 L-26 rejected]
L-24 (warning, citation-identifier, line 70): Identifier 'diff' is absent from the cited ranges (same ranges as L-23) [v1 L-27 rejected]
L-25 (warning, citation-identifier, line 70): Identifier 'diffStats' is absent from the cited ranges (same ranges as L-23) [v1 L-28 rejected]
L-26 (warning, citation-identifier, line 70): Identifier 'diffTruncated' is absent from the cited ranges (same ranges as L-23) [v1 L-29 rejected]
L-27 (warning, citation-identifier, line 70): Identifier 'skippedPaths' is absent from the cited ranges (same ranges as L-23) [v1 L-30 rejected]
L-28 (warning, citation-identifier, line 70): Identifier 'diffRejection' is absent from the cited ranges (same ranges as L-23) [v1 L-31 rejected]
L-29 (warning, citation-identifier, line 72): Identifier 'E2BIG' is absent from the cited ranges (src/dashboard/task-review-runner.ts:204, src/dashboard/task-review-runner.ts:272, src/dashboard/task-review-runner.ts:473, src/core/task-diff.ts:32) [v1 L-37 rejected]
L-30 (warning, citation-identifier, line 74): Identifier 'executionContext' is absent from the cited ranges (src/tools/review-task.ts:661-766) [v1 L-38 rejected]
L-31 (warning, citation-identifier, line 85): Identifier 'empty' is absent from the cited ranges (src/tools/review-task.ts:317-321, src/core/task-diff.ts:179-181, src/tools/review-task.ts:774-775) [v1 L-40 rejected]
L-32 (warning, citation-identifier, line 88): Identifier 'nextSteps' is absent from the cited ranges (src/tools/review-task.ts:345-346, src/dashboard/task-review-runner.ts:389-393, src/tools/review-task.ts:515-517) [new]
L-33 (warning, citation-identifier, line 98): Identifier 'executionContext' is absent from the cited ranges (src/types.ts:288-296, package.json:72) [v1 L-48 rejected]
L-34 (warning, citation-identifier, line 107): Identifier 'recorded' is absent from the cited ranges (e2e/worktree-shared.spec.ts:322-657) [v1 L-49 rejected]
