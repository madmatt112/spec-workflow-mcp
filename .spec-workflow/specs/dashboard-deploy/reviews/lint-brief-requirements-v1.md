# Lint brief — dashboard-deploy requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/requirements.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/requirements.md` (v1). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 13): Identifier 'stage' is absent from the cited ranges (scripts/sdd-self-update.sh:89-97)
L-2 (warning, citation-identifier, line 13): Identifier 'done' is absent from the cited ranges (scripts/sdd-self-update.sh:89-97)
L-3 (warning, citation-identifier, line 13): Identifier 'failed' is absent from the cited ranges (scripts/sdd-self-update.sh:89-97)
L-4 (warning, citation-identifier, line 21): Identifier 'runs' is absent from the cited ranges (src/controller/state.ts:275-279)
L-5 (warning, citation-identifier, line 21): Identifier 'started' is absent from the cited ranges (src/controller/state.ts:275-279)
L-6 (warning, citation-identifier, line 21): Identifier 'error' is absent from the cited ranges (src/controller/state.ts:275-279)
L-7 (warning, citation-identifier, line 24): Identifier 'KillMode' is absent from the cited ranges (src/advisor/actions.ts:363-364)
L-8 (warning, citation-identifier, line 25): Identifier 'PATH' is absent from the cited ranges (scripts/sdd-service.sh:82, scripts/sdd-service.sh:84)
L-9 (warning, citation-identifier, line 25): Identifier 'HOME' is absent from the cited ranges (scripts/sdd-service.sh:82, scripts/sdd-service.sh:84)
L-10 (warning, citation-identifier, line 25): Identifier 'SDD_HOME' is absent from the cited ranges (scripts/sdd-service.sh:82, scripts/sdd-service.sh:84)
L-11 (warning, citation-identifier, line 25): Identifier 'service' is absent from the cited ranges (scripts/sdd-service.sh:82, scripts/sdd-service.sh:84)
L-12 (warning, citation-identifier, line 38): Identifier 'stage' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-upda
L-13 (warning, citation-identifier, line 38): Identifier 'build' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-upda
L-14 (warning, citation-identifier, line 38): Identifier 'smoke' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-upda
L-15 (warning, citation-identifier, line 38): Identifier 'gate' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-updat
L-16 (warning, citation-identifier, line 38): Identifier 'swap' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-updat
L-17 (warning, citation-identifier, line 38): Identifier 'done' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-updat
L-18 (warning, citation-identifier, line 39): Identifier 'check_move' is absent from the cited ranges (scripts/sdd-self-update.sh:135)
L-19 (warning, citation-identifier, line 39): Identifier 'commit' is absent from the cited ranges (scripts/sdd-self-update.sh:135)
L-20 (warning, citation-identifier, line 40): Identifier 'gate' is absent from the cited ranges (scripts/sdd-self-update.sh:219, scripts/sdd-self-update.sh:257)
L-21 (warning, citation-identifier, line 41): Identifier 'failed' is absent from the cited ranges (scripts/sdd-self-update.sh:136-138)
L-22 (warning, citation-identifier, line 41): Identifier 'error' is absent from the cited ranges (scripts/sdd-self-update.sh:136-138)
L-23 (warning, citation-identifier, line 41): Identifier 'check_move' is absent from the cited ranges (scripts/sdd-self-update.sh:136-138)
L-24 (warning, citation-identifier, line 59): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:278-281, src/controller/controller.ts:387-390)
L-25 (warning, citation-identifier, line 69): Identifier 'RunRecord' is absent from the cited ranges (src/controller/state.ts:91)
L-26 (warning, citation-identifier, line 69): Identifier 'operator' is absent from the cited ranges (src/controller/state.ts:91)
L-27 (warning, citation-identifier, line 69): Identifier 'holdBy' is absent from the cited ranges (src/controller/state.ts:91)
L-28 (warning, citation-identifier, line 70): Identifier 'holdBy' is absent from the cited ranges (src/controller/state.ts:429-433, src/controller/state.ts:434-437)
L-29 (warning, citation-identifier, line 72): Identifier 'isStartable' is absent from the cited ranges (src/controller/controller.ts:456)
L-30 (warning, citation-identifier, line 73): Identifier 'holdBy' is absent from the cited ranges (src/controller/runs.ts:417-422, src/controller/runs.ts:573-581)
L-31 (warning, citation-identifier, line 73): Identifier 'deploy' is absent from the cited ranges (src/controller/runs.ts:417-422, src/controller/runs.ts:573-581)
L-32 (warning, citation-identifier, line 74): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:557-560, src/controller/controller.ts:352-353)
L-33 (warning, citation-identifier, line 75): Identifier 'holdBy' is absent from the cited ranges (src/controller/controller.ts:242)
L-34 (warning, citation-identifier, line 75): Identifier 'operator' is absent from the cited ranges (src/controller/controller.ts:242)
L-35 (warning, citation-identifier, line 80): Identifier 'holdBy' is absent from the cited ranges (src/controller/runs.ts:1428-1462, src/dashboard/shell/types.ts:194-214, src/dashboard_frontend/src/modules/shell/types.ts:215-237)
L-36 (warning, citation-identifier, line 100): Identifier 'build' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:146-153, src/dashboard/shell/types.ts:230-236)
L-37 (warning, citation-identifier, line 100): Identifier 'smoke' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:146-153, src/dashboard/shell/types.ts:230-236)
L-38 (warning, citation-identifier, line 100): Identifier 'gate' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:146-153, src/dashboard/shell/types.ts:230-236)
L-39 (warning, citation-identifier, line 100): Identifier 'swap' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:146-153, src/dashboard/shell/types.ts:230-236)
L-40 (warning, citation-identifier, line 100): Identifier 'restart' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:146-153, src/dashboard/shell/types.ts:230-236)
L-41 (warning, citation-identifier, line 100): Identifier 'done' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:146-153, src/dashboard/shell/types.ts:230-236)
L-42 (warning, citation-identifier, line 104): Identifier 'restart' is absent from the cited ranges (src/dashboard/multi-server.ts:741-752)
L-43 (warning, citation-identifier, line 106): Identifier 'swap' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:31-32, src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:98-103)
L-44 (warning, citation-identifier, line 106): Identifier 'restart' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:31-32, src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:98-103)

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
