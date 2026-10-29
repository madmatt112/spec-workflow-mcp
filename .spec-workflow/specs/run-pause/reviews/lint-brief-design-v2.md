# Lint brief — run-pause design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/design.md` (v2). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 61): Identifier 'operator' is absent from the cited ranges (src/controller/runs.ts:933, src/controller/runs.ts:964, src/controller/runs.ts:982)
L-2 (warning, citation-identifier, line 61): Identifier 'isPauseRequested' is absent from the cited ranges (src/controller/runs.ts:933, src/controller/runs.ts:964, src/controller/runs.ts:982)
L-3 (warning, citation-identifier, line 63): Identifier 'runOnce' is absent from the cited ranges (src/controller/runs.ts:804-806)
L-4 (warning, citation-identifier, line 63): Identifier 'resumingMerge' is absent from the cited ranges (src/controller/runs.ts:804-806)
L-5 (warning, citation-identifier, line 63): Identifier 'merge' is absent from the cited ranges (src/controller/runs.ts:804-806)
L-6 (warning, citation-identifier, line 64): Identifier 'operator' is absent from the cited ranges (src/controller/phases/implementation.ts:571-573, src/controller/phases/retrospective.ts:192-193, src/controller/phases/closeout.ts:380-381)
L-7 (warning, citation-identifier, line 65): Identifier 'runMergeStageStep' is absent from the cited ranges (src/controller/runs.ts:692-710, src/controller/runs.ts:689-691)
L-8 (warning, citation-identifier, line 66): Identifier 'stop' is absent from the cited ranges (src/controller/runs.ts:947, src/controller/runs.ts:624, src/controller/runs.ts:663-675, src/controller/runs.ts:811)
L-9 (warning, citation-identifier, line 68): Identifier 'operator' is absent from the cited ranges (src/controller/runs.ts:1127-1132, src/controller/runs.ts:1188-1191, src/controller/runs.ts:1045-1048)
L-10 (warning, citation-identifier, line 68): Identifier 'handleImplementationOutcome' is absent from the cited ranges (src/controller/runs.ts:1127-1132, src/controller/runs.ts:1188-1191, src/controller/runs.ts:1045-1048)
L-11 (warning, citation-identifier, line 68): Identifier 'handleRetrospectiveOutcome' is absent from the cited ranges (src/controller/runs.ts:1127-1132, src/controller/runs.ts:1188-1191, src/controller/runs.ts:1045-1048)
L-12 (warning, citation-identifier, line 68): Identifier 'handleCloseoutOutcome' is absent from the cited ranges (src/controller/runs.ts:1127-1132, src/controller/runs.ts:1188-1191, src/controller/runs.ts:1045-1048)
L-13 (warning, citation-identifier, line 68): Identifier 'handleDocumentOutcome' is absent from the cited ranges (src/controller/runs.ts:1127-1132, src/controller/runs.ts:1188-1191, src/controller/runs.ts:1045-1048)
L-14 (warning, citation-identifier, line 76): Identifier 'writeRun' is absent from the cited ranges (src/controller/controller.ts:75)
L-15 (warning, citation-identifier, line 76): Identifier 'pauseRequested' is absent from the cited ranges (src/controller/controller.ts:75)
L-16 (warning, citation-identifier, line 76): Identifier 'queued' is absent from the cited ranges (src/controller/controller.ts:75)
L-17 (warning, citation-identifier, line 76): Identifier 'paused' is absent from the cited ranges (src/controller/controller.ts:75)
L-18 (warning, citation-identifier, line 76): Identifier 'merging' is absent from the cited ranges (src/controller/controller.ts:75)
L-19 (warning, citation-identifier, line 76): Identifier 'resumeAt' is absent from the cited ranges (src/controller/controller.ts:75)
L-20 (warning, citation-identifier, line 76): Identifier 'inFlight' is absent from the cited ranges (src/controller/controller.ts:75)
L-21 (warning, citation-identifier, line 76): Identifier 'merge' is absent from the cited ranges (src/controller/controller.ts:75)
L-22 (warning, citation-identifier, line 76): Identifier 'running' is absent from the cited ranges (src/controller/controller.ts:75)
L-23 (warning, citation-identifier, line 76): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:75)
L-24 (warning, citation-identifier, line 78): Identifier 'pauseRequested' is absent from the cited ranges (src/controller/controller.ts:207-224)
L-25 (warning, citation-identifier, line 83): Identifier 'opts' is absent from the cited ranges (src/controller/controller.ts:524-529)
L-26 (warning, citation-identifier, line 87): Identifier 'recover' is absent from the cited ranges (src/controller/controller.ts:369-392, src/controller/controller.ts:291-294)
L-27 (warning, citation-identifier, line 88): Identifier 'paused' is absent from the cited ranges (src/controller/controller.ts:261-274)
L-28 (warning, citation-identifier, line 90): Identifier 'save' is absent from the cited ranges (src/controller/controller.ts:532-536)
L-29 (warning, citation-identifier, line 90): Identifier 'schedule' is absent from the cited ranges (src/controller/controller.ts:532-536)
L-30 (warning, citation-identifier, line 90): Identifier 'onWaitChange' is absent from the cited ranges (src/controller/controller.ts:532-536)
L-31 (warning, citation-identifier, line 94): Identifier 'blocked' is absent from the cited ranges (src/controller/runs.ts:689-691, src/controller/runs.ts:778-781, src/controller/runs.ts:850-858)
L-32 (warning, citation-identifier, line 94): Identifier 'runOnce' is absent from the cited ranges (src/controller/runs.ts:689-691, src/controller/runs.ts:778-781, src/controller/runs.ts:850-858)
L-33 (warning, citation-identifier, line 100): Identifier 'runOnce' is absent from the cited ranges (src/controller/runs.ts:906-913, src/controller/runs.ts:1242-1249)
L-34 (warning, citation-identifier, line 104): Identifier 'stopped' is absent from the cited ranges (src/controller/runs.ts:1209-1262, src/controller/runs.ts:1239-1249)
L-35 (warning, citation-identifier, line 105): Identifier 'result' is absent from the cited ranges (src/controller/phases/document.ts:823-827)
L-36 (warning, citation-identifier, line 119): Identifier 'fmtSpan' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:351-352)
L-37 (warning, citation-identifier, line 124): Identifier 'busy' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/Sidebar.tsx:197, src/dashboard_frontend/src/modules/shell/RunsPage.tsx:260-271)
L-38 (warning, citation-identifier, line 124): Identifier 'error' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/Sidebar.tsx:197, src/dashboard_frontend/src/modules/shell/RunsPage.tsx:260-271)
L-39 (warning, citation-identifier, line 125): Identifier 'PauseButton' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233)
L-40 (warning, citation-identifier, line 125): Identifier 'queued' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233)
L-41 (warning, citation-identifier, line 125): Identifier 'running' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233)
L-42 (warning, citation-identifier, line 125): Identifier 'paused' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233)
L-43 (warning, citation-identifier, line 125): Identifier 'waiting' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233)
L-44 (warning, citation-identifier, line 125): Identifier 'merging' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233)
L-45 (warning, citation-identifier, line 125): Identifier 'isOperatorHeld' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233)
L-46 (warning, citation-identifier, line 126): Identifier 'PauseButton' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:235-324, src/dashboard_frontend/src/modules/shell/RunsPage.tsx:296-306)
L-47 (warning, citation-identifier, line 126): Identifier 'isOperatorHeld' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:235-324, src/dashboard_frontend/src/modules/shell/RunsPage.tsx:296-306)
L-48 (warning, citation-identifier, line 127): Identifier 'Button' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:321)
L-49 (warning, citation-identifier, line 127): Identifier 'resume' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:321)
L-50 (warning, citation-identifier, line 162): Identifier 'writeRun' is absent from the cited ranges (e2e/worktree-shell.spec.ts:164-173)
L-51 (warning, citation-identifier, line 165): Identifier 'pauseRequested' is absent from the cited ranges (src/controller/__tests__/paused-at.test.ts:13-38)
L-52 (warning, citation-identifier, line 165): Identifier 'readRunSync' is absent from the cited ranges (src/controller/__tests__/paused-at.test.ts:13-38)
L-53 (warning, citation-identifier, line 167): Identifier 'running' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:348-349)
L-54 (warning, citation-identifier, line 167): Identifier 'pauseRequested' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:348-349)
L-55 (warning, citation-identifier, line 167): Identifier 'paused' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:348-349)
L-56 (warning, citation-identifier, line 167): Identifier 'operator' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:348-349)
L-57 (warning, citation-identifier, line 167): Identifier 'isPauseRequested' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:348-349)
L-58 (warning, citation-identifier, line 167): Identifier 'resumeAt' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:348-349)
L-59 (warning, citation-identifier, line 168): Identifier 'claude' is absent from the cited ranges (scripts/stub-claude.mjs:17, scripts/stub-claude.mjs:110-111)
L-60 (warning, citation-identifier, line 174): Identifier 'paused' is absent from the cited ranges (src/controller/__tests__/controller.test.ts:414-449)
L-61 (warning, citation-identifier, line 174): Identifier 'operator' is absent from the cited ranges (src/controller/__tests__/controller.test.ts:414-449)

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
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
