# Lint brief — dashboard-ruling-view requirements v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/requirements.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/requirements.md` (v2). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 35): Identifier 'escalate' is absent from the cited ranges (src/controller/phases/implementation.ts:795, src/controller/phases/implementation.ts:843)
L-2 (warning, citation-identifier, line 35): Identifier 'commits' is absent from the cited ranges (src/controller/phases/implementation.ts:795, src/controller/phases/implementation.ts:843)
L-3 (warning, citation-identifier, line 36): Identifier 'commits' is absent from the cited ranges (src/controller/phases/implementation.ts:668-669)
L-4 (warning, citation-identifier, line 37): Identifier 'detail' is absent from the cited ranges (src/controller/phases/implementation.ts:960-1005, src/controller/phases/implementation.ts:703-704)
L-5 (warning, citation-identifier, line 38): Identifier 'detail' is absent from the cited ranges (src/core/task-review-manager.ts:182-185)
L-6 (warning, citation-identifier, line 41): Identifier 'detail' is absent from the cited ranges (src/controller/runs.ts:1242-1309)
L-7 (warning, citation-identifier, line 41): Identifier 'commits' is absent from the cited ranges (src/controller/runs.ts:1242-1309)
L-8 (warning, citation-identifier, line 44): Identifier 'detail' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-9 (warning, citation-identifier, line 44): Identifier 'task' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-10 (warning, citation-identifier, line 44): Identifier 'commits' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-11 (warning, citation-identifier, line 44): Identifier 'listWaitsForWire' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-12 (warning, citation-identifier, line 44): Identifier 'specDir' is absent from the cited ranges (src/dashboard/shell/types.ts:57-95, src/dashboard_frontend/src/modules/shell/types.ts:53-91)
L-13 (warning, citation-identifier, line 53): Identifier 'Success' is absent from the cited ranges (src/core/task-parser.ts:148-169, src/controller/phases/implementation.ts:256-259)
L-14 (warning, citation-identifier, line 54): Identifier 'jsonl' is absent from the cited ranges (src/controller/phases/implementation.ts:848)
L-15 (warning, citation-identifier, line 85): Identifier 'proposals' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:200-209)
L-16 (warning, citation-identifier, line 89): Identifier 'error' is absent from the cited ranges (src/controller/runs.ts:1359-1364)
L-17 (warning, citation-identifier, line 89): Identifier 'task' is absent from the cited ranges (src/controller/runs.ts:1359-1364)
L-18 (warning, citation-identifier, line 89): Identifier 'security' is absent from the cited ranges (src/controller/runs.ts:1359-1364)
L-19 (warning, citation-identifier, line 100): Identifier 'ruling' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/AnswerSheet.tsx:277-292)
L-20 (warning, citation-identifier, line 103): Identifier 'escalation' is absent from the cited ranges (src/controller/waits.ts:145-150)
L-21 (warning, citation-identifier, line 103): Identifier 'error' is absent from the cited ranges (src/controller/waits.ts:145-150)
L-22 (warning, citation-identifier, line 103): Identifier 'answerWait' is absent from the cited ranges (src/controller/waits.ts:145-150)

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
