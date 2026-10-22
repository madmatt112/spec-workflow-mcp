# Lint brief — verification-loop tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/tasks.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/tasks.md` (v1). Cap: 150 words per task block excluding its prompt. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/design.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 11): Identifier 'evaluatePullRequest' is absent from the cited ranges (src/controller/merge.ts:357-405, src/controller/merge.ts:588-591)
L-2 (warning, citation-identifier, line 11): Identifier 'blocking' is absent from the cited ranges (src/controller/merge.ts:357-405, src/controller/merge.ts:588-591)
L-3 (warning, citation-identifier, line 11): Identifier 'base' is absent from the cited ranges (src/controller/merge.ts:357-405, src/controller/merge.ts:588-591)
L-4 (warning, citation-identifier, line 11): Identifier 'mergeByRule' is absent from the cited ranges (src/controller/merge.ts:357-405, src/controller/merge.ts:588-591)
L-5 (error, citation-path, line 15): Cited path `merge.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/merge.test.ts`)
L-6 (warning, citation-identifier, line 32): Identifier 'newDependencies' is absent from the cited ranges (src/controller/merge.ts:568-642, src/controller/state.ts:109-126)
L-7 (error, citation-path, line 36): Cited path `merge.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/merge.test.ts`)
L-8 (error, citation-path, line 36): Cited path `merge.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/merge.test.ts`)
L-9 (info, task-test-seam, line 38): task 4 changes source and has no Test line
L-10 (warning, citation-identifier, line 43): Identifier 'newDependencies' is absent from the cited ranges (src/dashboard/shell/types.ts:161-172, src/dashboard_frontend/src/modules/shell/types.ts:184-195)
L-11 (warning, citation-identifier, line 43): Identifier 'PrPanel' is absent from the cited ranges (src/dashboard/shell/types.ts:161-172, src/dashboard_frontend/src/modules/shell/types.ts:184-195)
L-12 (error, citation-path, line 43): Cited path `RunPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/RunPage.tsx`)
L-13 (error, mdx, line 52): Could not parse expression with acorn
L-14 (warning, citation-identifier, line 74): Identifier 'runMergeStageStep' is absent from the cited ranges (src/controller/runs.ts:669-682)
L-15 (warning, citation-identifier, line 94): Identifier 'classAItems' is absent from the cited ranges (src/controller/phases/implementation.ts:383-418)
L-16 (error, citation-path, line 98): Cited path `implementation.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/implementation.test.ts`)
L-17 (warning, citation-identifier, line 134): Identifier 'escalationRulings' is absent from the cited ranges (src/controller/runs.ts:1015-1056)

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. Every citation you insert or change carries its directory-prefixed path (`src/core/typecheck.ts:30`), never a bare filename (`typecheck.ts:30`) or a bare `:<line>`. A citation that lacks a directory prefix, or a bare `:<line>` token, outside a code block is itself a finding to reject or repair before you hand off, so a later pass cannot re-resolve it to the wrong file (retro P6).
11. A citation-identifier warning on a token that is unchanged since a version where it was rejected with a reason is suppressed, not re-fired.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- version:
- words:
- accepted:
- partial:
- rejected:
- cut-scope:
- flags:
