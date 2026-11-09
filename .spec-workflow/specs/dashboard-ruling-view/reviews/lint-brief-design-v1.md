# Lint brief — dashboard-ruling-view design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 36): Identifier 'commits' is absent from the cited ranges (src/controller/state.ts:207-226, src/controller/waits.ts:52-62, src/controller/waits.ts:98-118, src/controller/waits.ts:241-243)
L-2 (warning, citation-identifier, line 49): Identifier 'latest' is absent from the cited ranges (src/controller/phases/implementation.ts:649-952, src/core/task-review-manager.ts:182-185)
L-3 (info, citation-bare, line 51): Bare range `:703-704` has no earlier path citation in its block
L-4 (info, citation-bare, line 51): Bare range `:787-788` has no earlier path citation in its block
L-5 (info, citation-bare, line 51): Bare range `:945-947` has no earlier path citation in its block
L-6 (info, citation-bare, line 52): Bare range `:566-578` has no earlier path citation in its block
L-7 (info, citation-bare, line 52): Bare range `:960-1005` has no earlier path citation in its block
L-8 (info, citation-bare, line 54): Bare range `:622-635` has no earlier path citation in its block
L-9 (info, citation-bare, line 54): Bare range `:152-182` has no earlier path citation in its block
L-10 (info, citation-bare, line 59): Bare range `:1296-1301` has no earlier path citation in its block
L-11 (info, citation-bare, line 59): Bare range `:1188-1204` has no earlier path citation in its block
L-12 (info, citation-bare, line 65): Bare range `:260-272` has no earlier path citation in its block
L-13 (info, citation-bare, line 65): Bare range `:295-302` has no earlier path citation in its block
L-14 (info, citation-bare, line 66): Bare range `:305-309` has no earlier path citation in its block
L-15 (warning, citation-identifier, line 67): Identifier 'note' is absent from the cited ranges (src/dashboard/multi-server.ts:701-715, src/advisor/actions.ts:145-154)
L-16 (warning, citation-identifier, line 72): Identifier 'WaitTaskRow' is absent from the cited ranges (src/dashboard/multi-server.ts:45)
L-17 (warning, citation-identifier, line 72): Identifier 'task' is absent from the cited ranges (src/dashboard/multi-server.ts:45)
L-18 (warning, citation-identifier, line 75): Identifier 'success' is absent from the cited ranges (src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/core/task-parser.ts:143-169)
L-19 (warning, citation-identifier, line 75): Identifier 'null' is absent from the cited ranges (src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/core/task-parser.ts:143-169)
L-20 (warning, citation-identifier, line 75): Identifier 'tdd' is absent from the cited ranges (src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/core/task-parser.ts:143-169)
L-21 (warning, citation-identifier, line 75): Identifier 'risk' is absent from the cited ranges (src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/core/task-parser.ts:143-169)
L-22 (warning, citation-identifier, line 75): Identifier 'riskFromLedger' is absent from the cited ranges (src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/core/task-parser.ts:143-169)
L-23 (warning, citation-identifier, line 75): Identifier 'jsonl' is absent from the cited ranges (src/core/task-parser.ts:194, src/core/task-parser.ts:424-444, src/core/task-parser.ts:143-169)
L-24 (warning, citation-identifier, line 76): Identifier 'export' is absent from the cited ranges (src/controller/phases/implementation.ts:256-259)
L-25 (warning, citation-identifier, line 82): Identifier 'WaitDiff' is absent from the cited ranges (src/controller/state.ts:414-416)
L-26 (warning, citation-identifier, line 82): Identifier 'readWait' is absent from the cited ranges (src/controller/state.ts:414-416)
L-27 (warning, citation-identifier, line 92): Identifier 'commits' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-28 (warning, citation-identifier, line 92): Identifier 'WaitTaskRow' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-29 (warning, citation-identifier, line 92): Identifier 'WaitDiff' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-30 (warning, citation-identifier, line 92): Identifier 'DiffCommit' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-31 (warning, citation-identifier, line 92): Identifier 'DiffFile' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-32 (warning, citation-identifier, line 92): Identifier 'DiffHunk' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-33 (warning, citation-identifier, line 99): Identifier 'initialValues' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:85-90)
L-34 (error, citation-path, line 102): Cited path `AnswerSheet.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/AnswerSheet.tsx`)
L-35 (warning, citation-identifier, line 103): Identifier 'securityLines' is absent from the cited ranges (src/controller/runs.ts:1285-1287)
L-36 (warning, citation-identifier, line 103): Identifier 'lead' is absent from the cited ranges (src/controller/runs.ts:1285-1287)
L-37 (warning, citation-identifier, line 103): Identifier 'tail' is absent from the cited ranges (src/controller/runs.ts:1285-1287)
L-38 (warning, citation-identifier, line 106): Identifier 'phase' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:90)
L-39 (warning, citation-identifier, line 106): Identifier 'stepKind' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:90)
L-40 (warning, citation-identifier, line 107): Identifier 'task' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-41 (warning, citation-identifier, line 107): Identifier 'taskless' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-42 (warning, citation-identifier, line 107): Identifier 'unknown' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-43 (warning, citation-identifier, line 107): Identifier 'security' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-44 (warning, citation-identifier, line 107): Identifier 'lead' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-45 (warning, citation-identifier, line 107): Identifier 'findings' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-46 (warning, citation-identifier, line 107): Identifier 'tail' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-47 (warning, citation-identifier, line 107): Identifier 'gate' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-48 (warning, citation-identifier, line 107): Identifier 'proposals' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-49 (warning, citation-identifier, line 107): Identifier 'url' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:152-163)
L-50 (error, citation-path, line 107): Cited path `AnswerSheet.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/AnswerSheet.tsx`)
L-51 (error, citation-path, line 108): Cited path `AnswerSheet.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/AnswerSheet.tsx`)
L-52 (error, citation-path, line 108): Cited path `AnswerSheet.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/AnswerSheet.tsx`)
L-53 (warning, citation-identifier, line 111): Identifier 'RulingView' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:6)
L-54 (warning, citation-identifier, line 117): Identifier 'HomePage' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63)
L-55 (warning, citation-identifier, line 117): Identifier 'onAnswer' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63)
L-56 (warning, citation-identifier, line 117): Identifier 'stages' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63)
L-57 (warning, citation-identifier, line 117): Identifier 'run' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63)
L-58 (warning, citation-identifier, line 117): Identifier 'controllerRuns' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63)
L-59 (warning, citation-identifier, line 117): Identifier 'done' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63)
L-60 (warning, citation-identifier, line 117): Identifier 'tick' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/HomePage.tsx:148-171, src/dashboard_frontend/src/modules/shell/HomePage.tsx:60-63)
L-61 (warning, citation-identifier, line 151): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:660)
L-62 (warning, citation-identifier, line 151): Identifier 'failed' is absent from the cited ranges (src/controller/controller.ts:660)
L-63 (warning, citation-identifier, line 158): Identifier 'listWaitsForWire' is absent from the cited ranges (src/controller/__tests__/waits.test.ts:106-153)
L-64 (warning, citation-identifier, line 158): Identifier 'commits' is absent from the cited ranges (src/controller/__tests__/waits.test.ts:106-153)
L-65 (warning, citation-identifier, line 161): Identifier 'resolved' is absent from the cited ranges (src/dashboard/shell/__tests__/board-view.test.ts:19-33)
L-66 (warning, citation-identifier, line 161): Identifier 'answer' is absent from the cited ranges (src/dashboard/shell/__tests__/board-view.test.ts:19-33)
L-67 (warning, citation-identifier, line 163): Identifier 'commits' is absent from the cited ranges (src/controller/phases/__tests__/implementation.test.ts:842-867, src/controller/phases/implementation.ts:795)
L-68 (warning, citation-identifier, line 163): Identifier 'detail' is absent from the cited ranges (src/controller/phases/__tests__/implementation.test.ts:842-867, src/controller/phases/implementation.ts:795)
L-69 (warning, citation-identifier, line 164): Identifier 'detail' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:2274)
L-70 (warning, citation-identifier, line 164): Identifier 'commits' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:2274)
L-71 (warning, citation-identifier, line 164): Identifier 'error' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:2274)
L-72 (warning, citation-identifier, line 166): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-73 (warning, citation-identifier, line 166): Identifier 'detail' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-74 (warning, citation-identifier, line 166): Identifier 'commits' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-75 (warning, citation-identifier, line 166): Identifier 'task' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-76 (warning, citation-identifier, line 166): Identifier 'specDir' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-77 (warning, citation-identifier, line 166): Identifier 'done' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-78 (warning, citation-identifier, line 166): Identifier 'Approve' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-79 (warning, citation-identifier, line 166): Identifier 'Merge' is absent from the cited ranges (src/controller/controller.ts:671-673, src/controller/phases/__tests__/implementation.test.ts:867)
L-80 (error, citation-path, line 166): Cited path `playwright.worktree.config.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/playwright.worktree.config.ts`)

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
