# Lint brief — dashboard-board design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 41): Identifier 'startedAt' is absent from the cited ranges (src/controller/state.ts:39-46, src/controller/runs.ts:449-465)
L-2 (warning, citation-identifier, line 41): Identifier 'toISOString' is absent from the cited ranges (src/controller/state.ts:39-46, src/controller/runs.ts:449-465)
L-3 (warning, citation-identifier, line 43): Identifier 'runModelStep' is absent from the cited ranges (src/controller/phases/implementation.ts:95, src/controller/phases/implementation.ts:469, src/controller/phases/implementation.ts:446)
L-4 (warning, citation-identifier, line 58): Identifier 'enqueue' is absent from the cited ranges (src/controller/controller.ts:256-261, src/controller/runs.ts:840-842)
L-5 (warning, citation-identifier, line 64): Identifier 'branchHeld' is absent from the cited ranges (src/controller/controller.ts:245)
L-6 (warning, citation-identifier, line 64): Identifier 'enqueue' is absent from the cited ranges (src/controller/controller.ts:245)
L-7 (warning, citation-identifier, line 66): Identifier 'done' is absent from the cited ranges (src/controller/runs.ts:1400-1422)
L-8 (warning, citation-identifier, line 71): Identifier 'launchable' is absent from the cited ranges (src/dashboard/harness/run-setup.ts:224-233)
L-9 (warning, citation-identifier, line 75): Identifier 'snapshotFor' is absent from the cited ranges (src/dashboard/harness/hub.ts:78-93, src/dashboard/harness/hub.ts:53, src/dashboard/harness/hub.ts:149, src/controller/runs.ts:441-446, src/con
L-10 (warning, citation-identifier, line 75): Identifier 'watchedProjects' is absent from the cited ranges (src/dashboard/harness/hub.ts:78-93, src/dashboard/harness/hub.ts:53, src/dashboard/harness/hub.ts:149, src/controller/runs.ts:441-446, src
L-11 (warning, citation-identifier, line 75): Identifier 'OverviewWatch' is absent from the cited ranges (src/dashboard/harness/hub.ts:78-93, src/dashboard/harness/hub.ts:53, src/dashboard/harness/hub.ts:149, src/controller/runs.ts:441-446, src/c
L-12 (warning, citation-identifier, line 76): Identifier 'sendToProjectOrOverview' is absent from the cited ranges (src/dashboard/multi-server.ts:353-366, src/dashboard/multi-server.ts:938-952, src/dashboard/multi-server.ts:172, src/dashboard/mul
L-13 (error, citation-path, line 83): Cited path resolves under no base (code root, spec store, spec dir): modules/app/App.tsx
L-14 (info, citation-bare, line 86): Bare range `:64` has no earlier path citation in its block
L-15 (info, citation-bare, line 86): Bare range `:75-99` has no earlier path citation in its block
L-16 (info, citation-bare, line 87): Bare range `:153-156` has no earlier path citation in its block
L-17 (warning, citation-identifier, line 87): Identifier 'Density' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-18 (warning, citation-identifier, line 87): Identifier 'DENSITY_KEY' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-19 (warning, citation-identifier, line 87): Identifier 'readDensity' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-20 (warning, citation-identifier, line 87): Identifier 'density' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-21 (warning, citation-identifier, line 87): Identifier 'setDensity' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-22 (warning, citation-identifier, line 87): Identifier 'now' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-23 (warning, citation-identifier, line 87): Identifier 'controllerActivity' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-24 (warning, citation-identifier, line 87): Identifier 'connected' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/tokens.css:54)
L-25 (error, citation-path, line 88): Cited path resolves under no base (code root, spec store, spec dir): modules/ws/WebSocketProvider.tsx
L-26 (info, citation-bare, line 98): Bare range `:28-39` has no earlier path citation in its block
L-27 (info, citation-bare, line 98): Bare range `:74-77` has no earlier path citation in its block
L-28 (warning, citation-identifier, line 117): Identifier 'waitSummary' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:66-78)
L-29 (warning, citation-identifier, line 122): Identifier 'runControls' is absent from the cited ranges (src/controller/controller.ts:292-297)
L-30 (info, citation-bare, line 123): Bare range `:43` has no earlier path citation in its block
L-31 (info, citation-bare, line 123): Bare range `:45` has no earlier path citation in its block
L-32 (warning, citation-identifier, line 130): Identifier 'WaitDetail' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:196-228, src/dashboard_frontend/src/modules/shell/NowPage.tsx:433-701)
L-33 (warning, citation-identifier, line 130): Identifier 'WaitPanel' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:196-228, src/dashboard_frontend/src/modules/shell/NowPage.tsx:433-701)
L-34 (warning, citation-identifier, line 134): Identifier 'ActionTile' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:98-102)
L-35 (warning, citation-identifier, line 134): Identifier 'staged' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:98-102)
L-36 (warning, citation-identifier, line 136): Identifier 'secondary' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360)
L-37 (warning, citation-identifier, line 136): Identifier 'danger' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:360)
L-38 (warning, citation-identifier, line 138): Identifier 'secondary' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/Sidebar.tsx:37-41)
L-39 (warning, citation-identifier, line 139): Identifier 'runKey' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:63-66)
L-40 (warning, citation-identifier, line 155): Identifier 'press' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-41 (warning, citation-identifier, line 155): Identifier 'pressed' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-42 (warning, citation-identifier, line 155): Identifier 'callHarness' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-43 (warning, citation-identifier, line 155): Identifier 'failReason' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-44 (warning, citation-identifier, line 155): Identifier 'launch' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-45 (warning, citation-identifier, line 155): Identifier 'opError' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-46 (warning, citation-identifier, line 155): Identifier 'OpErrorView' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-47 (warning, citation-identifier, line 155): Identifier 'running' is absent from the cited ranges (src/dashboard/multi-server.ts:796-801, src/advisor/actions.ts:459-464)
L-48 (info, citation-bare, line 173): Bare range `:53` has no earlier path citation in its block
L-49 (info, citation-bare, line 173): Bare range `:56` has no earlier path citation in its block
L-50 (error, citation-range, line 173): Cited range src/dashboard_frontend/src/modules/shell/PageLayout.tsx:61-160 is out of bounds (src/dashboard_frontend/src/modules/shell/PageLayout.tsx has 33 lines)
L-51 (info, citation-bare, line 175): Bare range `:132-157` has no earlier path citation in its block
L-52 (warning, citation-identifier, line 206): Identifier 'child_process' is absent from the cited ranges (src/dashboard/shell/__tests__/deploy-view.test.ts:12-17)
L-53 (warning, citation-identifier, line 221): Identifier 'WORKTREE_SPEC_PATTERN' is absent from the cited ranges (e2e/worktree-deploy.spec.ts:49-52, src/dashboard_frontend/vite.config.ts:28-36)

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
