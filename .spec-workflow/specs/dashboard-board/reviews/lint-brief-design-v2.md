# Lint brief — dashboard-board design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/design.md` (v2). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 41): Identifier 'startedAt' is absent from the cited ranges (src/controller/state.ts:39-46, src/controller/runs.ts:449-465)
L-2 (warning, citation-identifier, line 41): Identifier 'toISOString' is absent from the cited ranges (src/controller/state.ts:39-46, src/controller/runs.ts:449-465)
L-3 (warning, citation-identifier, line 64): Identifier 'branchHeld' is absent from the cited ranges (src/controller/controller.ts:231-245)
L-4 (warning, citation-identifier, line 66): Identifier 'done' is absent from the cited ranges (src/controller/runs.ts:1400-1422)
L-5 (warning, citation-identifier, line 71): Identifier 'launchable' is absent from the cited ranges (src/dashboard/harness/run-setup.ts:224-233)
L-6 (warning, citation-identifier, line 83): Identifier 'Shell' is absent from the cited ranges (src/dashboard_frontend/src/modules/app/App.tsx:31)
L-7 (warning, citation-identifier, line 83): Identifier 'TopBar' is absent from the cited ranges (src/dashboard_frontend/src/modules/app/App.tsx:31)
L-8 (warning, citation-identifier, line 83): Identifier 'main' is absent from the cited ranges (src/dashboard_frontend/src/modules/app/App.tsx:31)
L-9 (warning, citation-identifier, line 83): Identifier 'HomePage' is absent from the cited ranges (src/dashboard_frontend/src/modules/app/App.tsx:31)
L-10 (warning, citation-identifier, line 98): Identifier 'toggle' is absent from the cited ranges (src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:28-39, src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:74-77)
L-11 (warning, citation-identifier, line 117): Identifier 'waitSummary' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78)
L-12 (warning, citation-identifier, line 122): Identifier 'runControls' is absent from the cited ranges (src/controller/controller.ts:292-297)
L-13 (warning, citation-identifier, line 130): Identifier 'WaitDetail' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:196-228, src/dashboard_frontend/src/modules/shell/NowPage.tsx:433-701)
L-14 (warning, citation-identifier, line 130): Identifier 'WaitPanel' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:196-228, src/dashboard_frontend/src/modules/shell/NowPage.tsx:433-701)
L-15 (warning, citation-identifier, line 134): Identifier 'ActionTile' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:98-102)
L-16 (warning, citation-identifier, line 134): Identifier 'staged' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:98-102)
L-17 (warning, citation-identifier, line 136): Identifier 'secondary' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360)
L-18 (warning, citation-identifier, line 136): Identifier 'danger' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360)
L-19 (warning, citation-identifier, line 138): Identifier 'secondary' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/Sidebar.tsx:37-41, src/dashboard_frontend/src/modules/theme/tokens.css:92)
L-20 (warning, citation-identifier, line 138): Identifier 'red' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/Sidebar.tsx:37-41, src/dashboard_frontend/src/modules/theme/tokens.css:92)
L-21 (warning, citation-identifier, line 139): Identifier 'runKey' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:63-66)
L-22 (warning, citation-identifier, line 155): Identifier 'press' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-23 (warning, citation-identifier, line 155): Identifier 'pressed' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-24 (warning, citation-identifier, line 155): Identifier 'callHarness' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-25 (warning, citation-identifier, line 155): Identifier 'failReason' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-26 (warning, citation-identifier, line 155): Identifier 'launch' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-27 (warning, citation-identifier, line 155): Identifier 'opError' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-28 (warning, citation-identifier, line 155): Identifier 'OpErrorView' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-29 (warning, citation-identifier, line 155): Identifier 'running' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-30 (warning, citation-identifier, line 175): Identifier 'tile' is absent from the cited ranges (src/dashboard_frontend/src/modules/ui/ui.tsx:132-157)
L-31 (warning, citation-identifier, line 175): Identifier 'neutral' is absent from the cited ranges (src/dashboard_frontend/src/modules/ui/ui.tsx:132-157)
L-32 (warning, citation-identifier, line 175): Identifier 'warning' is absent from the cited ranges (src/dashboard_frontend/src/modules/ui/ui.tsx:132-157)
L-33 (warning, citation-identifier, line 175): Identifier 'danger' is absent from the cited ranges (src/dashboard_frontend/src/modules/ui/ui.tsx:132-157)
L-34 (warning, citation-identifier, line 206): Identifier 'child_process' is absent from the cited ranges (src/dashboard/shell/__tests__/deploy-view.test.ts:12-17)
L-35 (warning, citation-identifier, line 221): Identifier 'WORKTREE_SPEC_PATTERN' is absent from the cited ranges (e2e/worktree-deploy.spec.ts:49-52, src/dashboard_frontend/vite.config.ts:28-36)
L-36 (error, citation-path, line 221): Cited path `playwright.worktree-pattern.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/playwright.worktree-pattern.ts`)

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
