# Lint brief — advisor tasks v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/tasks.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/tasks.md` (v2). Cap: 150 words per task block excluding its prompt. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/design.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 11): Identifier 'appendEvent' is absent from the cited ranges (src/controller/state.ts:298)
L-2 (warning, citation-identifier, line 45): Identifier 'advisorSecretPath' is absent from the cited ranges (src/controller/access.ts:156, src/controller/access.ts:191, src/dashboard/multi-server.ts:230-231)
L-3 (warning, citation-identifier, line 45): Identifier 'loadOrCreateAdvisorSecret' is absent from the cited ranges (src/controller/access.ts:156, src/controller/access.ts:191, src/dashboard/multi-server.ts:230-231)
L-4 (warning, citation-identifier, line 45): Identifier 'ADVISOR_MCP_PATH' is absent from the cited ranges (src/controller/access.ts:156, src/controller/access.ts:191, src/dashboard/multi-server.ts:230-231)
L-5 (warning, citation-identifier, line 103): Identifier 'StagedAction' is absent from the cited ranges (src/dashboard/multi-server.ts:649-657)
L-6 (warning, citation-identifier, line 103): Identifier 'checkAnswerKeys' is absent from the cited ranges (src/dashboard/multi-server.ts:649-657)
L-7 (warning, citation-identifier, line 114): Identifier 'launchSpec' is absent from the cited ranges (src/dashboard/multi-server.ts:604-635)
L-8 (warning, bridge-missing, line 120): task 12 names later task 17 with no bridge
L-9 (warning, citation-identifier, line 138): Identifier 'Server' is absent from the cited ranges (src/server.ts:255-268)
L-10 (warning, citation-identifier, line 149): Identifier 'Controller' is absent from the cited ranges (src/controller/controller.ts:373-388)
L-11 (warning, citation-identifier, line 149): Identifier 'usageBlock' is absent from the cited ranges (src/controller/controller.ts:373-388)
L-12 (warning, citation-identifier, line 170): Identifier 'advisor' is absent from the cited ranges (src/index.ts:129-131, src/index.ts:394-398)
L-13 (info, task-test-seam, line 176): task 17 changes source and has no Test line
L-14 (warning, citation-identifier, line 180): Identifier 'controllerActions' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:351, src/dashboard_frontend/src/modules/shell/NowPage.tsx:534, src/dashboard_fronte
L-15 (warning, citation-identifier, line 180): Identifier 'ShellContextType' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:351, src/dashboard_frontend/src/modules/shell/NowPage.tsx:534, src/dashboard_fronten

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
