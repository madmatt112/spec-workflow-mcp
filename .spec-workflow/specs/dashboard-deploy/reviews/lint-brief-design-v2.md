# Lint brief — dashboard-deploy design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/design.md` (v2). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 58): Identifier 'isQuiet' is absent from the cited ranges (scripts/sdd-self-update.sh:89-97, src/controller/controller.ts:144-146)
L-2 (warning, citation-identifier, line 71): Identifier 'updateRun' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-3 (warning, citation-identifier, line 71): Identifier 'holdBy' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-4 (warning, citation-identifier, line 71): Identifier 'runEvents' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-5 (warning, citation-identifier, line 71): Identifier 'change' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-6 (warning, citation-identifier, line 71): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-7 (warning, citation-identifier, line 71): Identifier 'resumeIfAnswered' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-8 (warning, citation-identifier, line 71): Identifier 'schedule' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-9 (warning, citation-identifier, line 86): Identifier 'operator' is absent from the cited ranges (src/controller/state.ts:91)
L-10 (warning, citation-identifier, line 87): Identifier 'writeRunLocked' is absent from the cited ranges (src/controller/state.ts:424-437)
L-11 (warning, citation-identifier, line 87): Identifier 'holdBy' is absent from the cited ranges (src/controller/state.ts:424-437)
L-12 (warning, citation-identifier, line 95): Identifier 'start' is absent from the cited ranges (src/controller/controller.ts:109-111)
L-13 (warning, citation-identifier, line 96): Identifier 'schedule' is absent from the cited ranges (src/controller/controller.ts:395)
L-14 (warning, citation-identifier, line 98): Identifier 'deploy' is absent from the cited ranges (src/controller/controller.ts:405-409)
L-15 (warning, citation-identifier, line 99): Identifier 'isStartable' is absent from the cited ranges (src/controller/controller.ts:456)
L-16 (warning, citation-identifier, line 100): Identifier 'recover' is absent from the cited ranges (src/controller/controller.ts:546, src/controller/controller.ts:387-390, src/controller/controller.ts:352-353)
L-17 (warning, citation-identifier, line 101): Identifier 'deploy' is absent from the cited ranges (src/controller/controller.ts:242)
L-18 (warning, citation-identifier, line 102): Identifier 'resumeNow' is absent from the cited ranges (src/controller/controller.ts:277-284)
L-19 (warning, citation-identifier, line 102): Identifier 'holdBy' is absent from the cited ranges (src/controller/controller.ts:277-284)
L-20 (warning, citation-identifier, line 103): Identifier 'withLock' is absent from the cited ranges (src/controller/controller.ts:191-209, src/dashboard/multi-server.ts:122-127)
L-21 (warning, citation-identifier, line 103): Identifier 'launchSpec' is absent from the cited ranges (src/controller/controller.ts:191-209, src/dashboard/multi-server.ts:122-127)
L-22 (warning, citation-identifier, line 106): Identifier 'writeRunLocked' is absent from the cited ranges (src/controller/runs.ts:417-422, src/controller/runs.ts:573-581)
L-23 (warning, citation-identifier, line 106): Identifier 'holdBy' is absent from the cited ranges (src/controller/runs.ts:417-422, src/controller/runs.ts:573-581)
L-24 (warning, citation-identifier, line 112): Identifier 'build' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-upda
L-25 (warning, citation-identifier, line 112): Identifier 'smoke' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-upda
L-26 (warning, citation-identifier, line 112): Identifier 'gate' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-updat
L-27 (warning, citation-identifier, line 112): Identifier 'swap' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-updat
L-28 (warning, citation-identifier, line 112): Identifier 'done' is absent from the cited ranges (scripts/sdd-self-update.sh:81, scripts/sdd-self-update.sh:191, scripts/sdd-self-update.sh:213, scripts/sdd-self-update.sh:239, scripts/sdd-self-updat
L-29 (warning, citation-identifier, line 113): Identifier 'commit' is absent from the cited ranges (scripts/sdd-self-update.sh:180)
L-30 (warning, citation-identifier, line 114): Identifier 'behind' is absent from the cited ranges (scripts/sdd-self-update.sh:276)
L-31 (warning, citation-identifier, line 116): Identifier 'LAST_LOG' is absent from the cited ranges (scripts/sdd-self-update.sh:54)
L-32 (warning, citation-identifier, line 116): Identifier 'error' is absent from the cited ranges (scripts/sdd-self-update.sh:54)
L-33 (warning, citation-identifier, line 119): Identifier 'STAGE' is absent from the cited ranges (scripts/sdd-self-update.sh:59-75, src/__tests__/service-scripts.test.ts:510)
L-34 (warning, citation-identifier, line 119): Identifier 'smoke' is absent from the cited ranges (scripts/sdd-self-update.sh:59-75, src/__tests__/service-scripts.test.ts:510)
L-35 (warning, citation-identifier, line 119): Identifier 'gate' is absent from the cited ranges (scripts/sdd-self-update.sh:59-75, src/__tests__/service-scripts.test.ts:510)
L-36 (warning, citation-identifier, line 160): Identifier 'deployDisabled' is absent from the cited ranges (src/dashboard/multi-server.ts:70-75, src/dashboard/multi-server.ts:177-194, src/index.ts:563-568)
L-37 (warning, citation-identifier, line 160): Identifier 'deployUnit' is absent from the cited ranges (src/dashboard/multi-server.ts:70-75, src/dashboard/multi-server.ts:177-194, src/index.ts:563-568)
L-38 (warning, citation-identifier, line 167): Identifier 'flush' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:145-153, src/dashboard/multi-server.ts:360-368)
L-39 (warning, citation-identifier, line 167): Identifier 'readDeployForWireSync' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:145-153, src/dashboard/multi-server.ts:360-368)
L-40 (warning, citation-identifier, line 167): Identifier 'await' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:145-153, src/dashboard/multi-server.ts:360-368)
L-41 (warning, citation-identifier, line 169): Identifier 'HarnessHub' is absent from the cited ranges (src/dashboard/harness/hub.ts:49-52, src/dashboard/harness/hub.ts:139-154)
L-42 (warning, citation-identifier, line 169): Identifier 'deployEvents' is absent from the cited ranges (src/dashboard/harness/hub.ts:49-52, src/dashboard/harness/hub.ts:139-154)
L-43 (warning, citation-identifier, line 169): Identifier 'pushDeploy' is absent from the cited ranges (src/dashboard/harness/hub.ts:49-52, src/dashboard/harness/hub.ts:139-154)
L-44 (warning, citation-identifier, line 170): Identifier 'done' is absent from the cited ranges (src/dashboard/multi-server.ts:404-417)
L-45 (warning, citation-identifier, line 183): Identifier 'ControllerDeploy' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/types.ts:268-274)
L-46 (warning, citation-identifier, line 184): Identifier 'useShell' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:286)
L-47 (warning, citation-identifier, line 185): Identifier 'Deploy' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:358-366)
L-48 (warning, citation-identifier, line 196): Identifier 'retryDelayFor' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104)
L-49 (warning, citation-identifier, line 196): Identifier 'nextRetryAt' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104)
L-50 (warning, citation-identifier, line 196): Identifier 'ShellProvider' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104)
L-51 (warning, citation-identifier, line 239): Identifier 'holdBy' is absent from the cited ranges (src/controller/__tests__/pause-request.test.ts:58)
L-52 (warning, citation-identifier, line 239): Identifier 'updateRun' is absent from the cited ranges (src/controller/__tests__/pause-request.test.ts:58)
L-53 (warning, citation-identifier, line 242): Identifier 'pushDeploy' is absent from the cited ranges (src/dashboard/shell/__tests__/shell-feed.test.ts:359-361)
L-54 (warning, citation-identifier, line 244): Identifier 'PATH' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:49-76, scripts/sdd-self-update.sh:299)
L-55 (warning, citation-identifier, line 244): Identifier 'systemctl' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:49-76, scripts/sdd-self-update.sh:299)
L-56 (warning, citation-identifier, line 249): Identifier 'route' is absent from the cited ranges (e2e/worktree-shell.spec.ts:417-444)

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
