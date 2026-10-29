# Lint brief — dashboard-project-list design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 41): Identifier 'linked' is absent from the cited ranges (src/core/git-utils.ts:64-71, src/core/git-utils.ts:7-11, src/core/git-utils.ts:260-270, src/core/git-utils.ts:133-139, src/core/git-utils.ts:214-25
L-2 (warning, citation-identifier, line 41): Identifier 'mainTree' is absent from the cited ranges (src/core/git-utils.ts:64-71, src/core/git-utils.ts:7-11, src/core/git-utils.ts:260-270, src/core/git-utils.ts:133-139, src/core/git-utils.ts:214-
L-3 (warning, citation-identifier, line 42): Identifier 'gitCapture' is absent from the cited ranges (src/core/git-utils.ts:101-112)
L-4 (warning, citation-identifier, line 58): Identifier 'computeFolds' is absent from the cited ranges (src/dashboard/__tests__/project-manager-durable.test.ts:84, src/dashboard/project-manager.ts:146-154)
L-5 (warning, citation-identifier, line 58): Identifier 'linkedWorktreeInfo' is absent from the cited ranges (src/dashboard/__tests__/project-manager-durable.test.ts:84, src/dashboard/project-manager.ts:146-154)
L-6 (warning, citation-identifier, line 58): Identifier 'addProject' is absent from the cited ranges (src/dashboard/__tests__/project-manager-durable.test.ts:84, src/dashboard/project-manager.ts:146-154)
L-7 (warning, citation-identifier, line 58): Identifier 'removeProject' is absent from the cited ranges (src/dashboard/__tests__/project-manager-durable.test.ts:84, src/dashboard/project-manager.ts:146-154)
L-8 (warning, citation-identifier, line 61): Identifier 'addProjectByPath' is absent from the cited ranges (src/dashboard/project-manager.ts:364-372)
L-9 (warning, citation-identifier, line 61): Identifier 'rememberProject' is absent from the cited ranges (src/dashboard/project-manager.ts:364-372)
L-10 (warning, citation-identifier, line 61): Identifier 'syncWithRegistry' is absent from the cited ranges (src/dashboard/project-manager.ts:364-372)
L-11 (warning, citation-identifier, line 62): Identifier 'syncWithRegistry' is absent from the cited ranges (src/dashboard/project-manager.ts:389-393)
L-12 (warning, citation-identifier, line 66): Identifier 'undefined' is absent from the cited ranges (src/dashboard/project-manager.ts:181-256, src/dashboard/project-manager.ts:240-249, src/dashboard/multi-server.ts:576-583)
L-13 (warning, citation-identifier, line 70): Identifier 'isMissing' is absent from the cited ranges (src/core/registry-lock.ts:371-412, src/core/project-registry.ts:479-496)
L-14 (warning, citation-identifier, line 77): Identifier 'withProjectsLock' is absent from the cited ranges (src/controller/state.ts:302-304, src/controller/state.ts:559-570)
L-15 (warning, citation-identifier, line 81): Identifier 'readProjects' is absent from the cited ranges (src/controller/state.ts:318-323)
L-16 (warning, citation-identifier, line 81): Identifier 'writeProjects' is absent from the cited ranges (src/controller/state.ts:318-323)
L-17 (warning, citation-identifier, line 85): Identifier 'ENOENT' is absent from the cited ranges (src/core/path-utils.ts:108)
L-18 (warning, citation-identifier, line 85): Identifier 'ENOTDIR' is absent from the cited ranges (src/core/path-utils.ts:108)
L-19 (warning, citation-identifier, line 91): Identifier 'parseArguments' is absent from the cited ranges (src/index.ts:164-177, src/index.ts:37-65)
L-20 (warning, citation-identifier, line 92): Identifier 'options' is absent from the cited ranges (src/server.ts:185-195, src/server.ts:289)
L-21 (warning, citation-identifier, line 92): Identifier 'stop' is absent from the cited ranges (src/server.ts:185-195, src/server.ts:289)
L-22 (warning, citation-identifier, line 94): Identifier 'runCases' is absent from the cited ranges (src/evals/runner.ts:190-197)
L-23 (warning, citation-identifier, line 100): Identifier 'workflowRootPath' is absent from the cited ranges (src/dashboard/shell/spec-rows.ts:78-99, src/dashboard/shell/live-runs.ts:10-18, src/dashboard/shell/shell-feed.ts:98-100)
L-24 (warning, citation-identifier, line 100): Identifier 'originalProjectPath' is absent from the cited ranges (src/dashboard/shell/spec-rows.ts:78-99, src/dashboard/shell/live-runs.ts:10-18, src/dashboard/shell/shell-feed.ts:98-100)
L-25 (warning, citation-identifier, line 109): Identifier 'liveCount' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:257-264)
L-26 (warning, citation-identifier, line 109): Identifier 'runs' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:257-264)
L-27 (warning, citation-identifier, line 109): Identifier 'NOW_LIVE_STATUSES' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:257-264)
L-28 (warning, citation-identifier, line 115): Identifier 'flush' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:103-115)
L-29 (warning, citation-identifier, line 130): Identifier 'deferralsByProject' is absent from the cited ranges (src/dashboard/multi-server.ts:464-473)
L-30 (warning, citation-identifier, line 141): Identifier 'sidebar' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/types.ts:86-93)
L-31 (warning, citation-identifier, line 141): Identifier 'SidebarProjectRow' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/types.ts:86-93)
L-32 (warning, citation-identifier, line 170): Identifier 'rememberProject' is absent from the cited ranges (src/dashboard/project-manager.ts:246-248)
L-33 (warning, citation-identifier, line 170): Identifier 'addProject' is absent from the cited ranges (src/dashboard/project-manager.ts:246-248)
L-34 (warning, citation-identifier, line 173): Identifier 'stop' is absent from the cited ranges (src/core/project-registry.ts:421-425)
L-35 (warning, citation-identifier, line 181): Identifier 'workflowRootPath' is absent from the cited ranges (src/dashboard/__tests__/project-manager-durable.test.ts:87, src/dashboard/__tests__/project-manager-durable.test.ts:115)
L-36 (warning, citation-identifier, line 181): Identifier 'syncWithRegistry' is absent from the cited ranges (src/dashboard/__tests__/project-manager-durable.test.ts:87, src/dashboard/__tests__/project-manager-durable.test.ts:115)
L-37 (warning, citation-identifier, line 191): Identifier 'running' is absent from the cited ranges (e2e/worktree-shell.spec.ts:174)
L-38 (error, citation-path, line 191): Cited path `playwright.worktree.config.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/playwright.worktree.config.ts`)
L-39 (warning, citation-identifier, line 193): Identifier 'tsc' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/pause.ts:1)
L-40 (warning, citation-identifier, line 193): Identifier 'node16' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/pause.ts:1)
L-41 (error, citation-path, line 193): Cited path `tsconfig.json` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/tsconfig.json`)

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
