# Lint brief — dashboard-deploy design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 58): Identifier 'isQuiet' is absent from the cited ranges (scripts/sdd-self-update.sh:89-97, src/controller/controller.ts:144-146)
L-2 (warning, citation-identifier, line 71): Identifier 'updateRun' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-3 (warning, citation-identifier, line 71): Identifier 'holdBy' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-4 (warning, citation-identifier, line 71): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-5 (warning, citation-identifier, line 71): Identifier 'resumeIfAnswered' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-6 (warning, citation-identifier, line 71): Identifier 'schedule' is absent from the cited ranges (src/controller/controller.ts:278-281)
L-7 (warning, citation-identifier, line 86): Identifier 'operator' is absent from the cited ranges (src/controller/state.ts:91)
L-8 (info, citation-bare, line 87): Bare range `:424-437` has no earlier path citation in its block
L-9 (info, citation-bare, line 88): Bare range `:447-455` has no earlier path citation in its block
L-10 (info, citation-bare, line 95): Bare range `:109-111` has no earlier path citation in its block
L-11 (info, citation-bare, line 96): Bare range `:395` has no earlier path citation in its block
L-12 (info, citation-bare, line 97): Bare range `:434-449` has no earlier path citation in its block
L-13 (info, citation-bare, line 98): Bare range `:405-409` has no earlier path citation in its block
L-14 (info, citation-bare, line 99): Bare range `:456` has no earlier path citation in its block
L-15 (info, citation-bare, line 100): Bare range `:546` has no earlier path citation in its block
L-16 (info, citation-bare, line 100): Bare range `:387-390` has no earlier path citation in its block
L-17 (info, citation-bare, line 100): Bare range `:352-353` has no earlier path citation in its block
L-18 (info, citation-bare, line 101): Bare range `:242` has no earlier path citation in its block
L-19 (info, citation-bare, line 102): Bare range `:277-284` has no earlier path citation in its block
L-20 (info, citation-bare, line 103): Bare range `:191-209` has no earlier path citation in its block
L-21 (warning, citation-identifier, line 103): Identifier 'withLock' is absent from the cited ranges (src/dashboard/multi-server.ts:122-127)
L-22 (warning, citation-identifier, line 103): Identifier 'launchSpec' is absent from the cited ranges (src/dashboard/multi-server.ts:122-127)
L-23 (info, citation-bare, line 104): Bare range `:315-327` has no earlier path citation in its block
L-24 (warning, citation-identifier, line 106): Identifier 'writeRunLocked' is absent from the cited ranges (src/controller/runs.ts:417-422, src/controller/runs.ts:573-581)
L-25 (warning, citation-identifier, line 106): Identifier 'holdBy' is absent from the cited ranges (src/controller/runs.ts:417-422, src/controller/runs.ts:573-581)
L-26 (info, citation-bare, line 110): Bare range `:32-46` has no earlier path citation in its block
L-27 (info, citation-bare, line 112): Bare range `:81` has no earlier path citation in its block
L-28 (info, citation-bare, line 112): Bare range `:191` has no earlier path citation in its block
L-29 (info, citation-bare, line 112): Bare range `:213` has no earlier path citation in its block
L-30 (info, citation-bare, line 112): Bare range `:239` has no earlier path citation in its block
L-31 (info, citation-bare, line 112): Bare range `:276` has no earlier path citation in its block
L-32 (info, citation-bare, line 112): Bare range `:305` has no earlier path citation in its block
L-33 (info, citation-bare, line 112): Bare range `:307` has no earlier path citation in its block
L-34 (info, citation-bare, line 112): Bare range `:308` has no earlier path citation in its block
L-35 (info, citation-bare, line 113): Bare range `:180` has no earlier path citation in its block
L-36 (info, citation-bare, line 114): Bare range `:276` has no earlier path citation in its block
L-37 (info, citation-bare, line 116): Bare range `:54` has no earlier path citation in its block
L-38 (info, citation-bare, line 119): Bare range `:59-75` has no earlier path citation in its block
L-39 (warning, citation-identifier, line 119): Identifier 'write_error_wait' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:510)
L-40 (warning, citation-identifier, line 119): Identifier 'STAGE' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:510)
L-41 (warning, citation-identifier, line 119): Identifier 'smoke' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:510)
L-42 (warning, citation-identifier, line 119): Identifier 'gate' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:510)
L-43 (info, citation-bare, line 156): Bare range `:690` has no earlier path citation in its block
L-44 (info, citation-bare, line 159): Bare range `:833-839` has no earlier path citation in its block
L-45 (info, citation-bare, line 160): Bare range `:70-75` has no earlier path citation in its block
L-46 (info, citation-bare, line 160): Bare range `:177-194` has no earlier path citation in its block
L-47 (warning, citation-identifier, line 160): Identifier 'MultiDashboardOptions' is absent from the cited ranges (src/index.ts:563-568)
L-48 (warning, citation-identifier, line 160): Identifier 'Controller' is absent from the cited ranges (src/index.ts:563-568)
L-49 (warning, citation-identifier, line 160): Identifier 'deployDisabled' is absent from the cited ranges (src/index.ts:563-568)
L-50 (warning, citation-identifier, line 160): Identifier 'deployUnit' is absent from the cited ranges (src/index.ts:563-568)
L-51 (info, citation-bare, line 161): Bare range `:741-752` has no earlier path citation in its block
L-52 (warning, citation-identifier, line 167): Identifier 'flush' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:145-153, src/dashboard/multi-server.ts:360-368)
L-53 (warning, citation-identifier, line 167): Identifier 'readDeployForWireSync' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:145-153, src/dashboard/multi-server.ts:360-368)
L-54 (warning, citation-identifier, line 167): Identifier 'await' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:145-153, src/dashboard/multi-server.ts:360-368)
L-55 (warning, citation-identifier, line 169): Identifier 'HarnessHub' is absent from the cited ranges (src/dashboard/harness/hub.ts:49-52, src/dashboard/harness/hub.ts:139-154)
L-56 (warning, citation-identifier, line 169): Identifier 'deployEvents' is absent from the cited ranges (src/dashboard/harness/hub.ts:49-52, src/dashboard/harness/hub.ts:139-154)
L-57 (warning, citation-identifier, line 169): Identifier 'pushDeploy' is absent from the cited ranges (src/dashboard/harness/hub.ts:49-52, src/dashboard/harness/hub.ts:139-154)
L-58 (warning, citation-identifier, line 170): Identifier 'done' is absent from the cited ranges (src/dashboard/multi-server.ts:404-417)
L-59 (warning, citation-identifier, line 183): Identifier 'ControllerDeploy' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/types.ts:268-274)
L-60 (warning, citation-identifier, line 184): Identifier 'useShell' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/NowPage.tsx:286)
L-61 (warning, citation-identifier, line 185): Identifier 'Deploy' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunsPage.tsx:358-366)
L-62 (warning, citation-identifier, line 196): Identifier 'retryDelayFor' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104)
L-63 (warning, citation-identifier, line 196): Identifier 'nextRetryAt' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104)
L-64 (warning, citation-identifier, line 196): Identifier 'ShellProvider' is absent from the cited ranges (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx:94-104)
L-65 (warning, citation-identifier, line 239): Identifier 'holdBy' is absent from the cited ranges (src/controller/__tests__/pause-request.test.ts:58)
L-66 (warning, citation-identifier, line 239): Identifier 'updateRun' is absent from the cited ranges (src/controller/__tests__/pause-request.test.ts:58)
L-67 (warning, citation-identifier, line 242): Identifier 'pushDeploy' is absent from the cited ranges (src/dashboard/shell/__tests__/shell-feed.test.ts:359-361)
L-68 (error, citation-path, line 243): Cited path `vitest.config.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/vitest.config.ts`)
L-69 (error, citation-path, line 243): Cited path `tsconfig.json` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/tsconfig.json`)
L-70 (warning, citation-identifier, line 244): Identifier 'PATH' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:49-76, scripts/sdd-self-update.sh:299)
L-71 (warning, citation-identifier, line 244): Identifier 'systemctl' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:49-76, scripts/sdd-self-update.sh:299)
L-72 (warning, citation-identifier, line 249): Identifier 'route' is absent from the cited ranges (e2e/worktree-shell.spec.ts:417-444)

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
