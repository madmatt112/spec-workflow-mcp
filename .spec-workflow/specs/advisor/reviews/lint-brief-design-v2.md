# Lint brief — advisor design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/design.md` (v2). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 20): Identifier 'jsonl' is absent from the cited ranges (src/dashboard/harness/state-files.ts:26-29)
L-2 (warning, citation-identifier, line 39): Identifier 'appendEvent' is absent from the cited ranges (src/controller/state.ts:297-303)
L-3 (warning, citation-identifier, line 39): Identifier 'appendFile' is absent from the cited ranges (src/controller/state.ts:297-303)
L-4 (warning, citation-identifier, line 39): Identifier 'detail' is absent from the cited ranges (src/controller/state.ts:297-303)
L-5 (warning, citation-identifier, line 42): Identifier 'advisorSecretPath' is absent from the cited ranges (src/controller/access.ts:40-67, src/dashboard/multi-server.ts:230-231)
L-6 (warning, citation-identifier, line 42): Identifier 'loadOrCreateAdvisorSecret' is absent from the cited ranges (src/controller/access.ts:40-67, src/dashboard/multi-server.ts:230-231)
L-7 (warning, citation-identifier, line 43): Identifier 'ADVISOR_MCP_PATH' is absent from the cited ranges (src/controller/access.ts:129-137, src/controller/access.ts:194-203, src/controller/access.ts:168-171)
L-8 (warning, citation-identifier, line 46): Identifier 'ADVISOR_MCP_PATH' is absent from the cited ranges (src/server.ts:255-268)
L-9 (warning, citation-identifier, line 46): Identifier 'Server' is absent from the cited ranges (src/server.ts:255-268)
L-10 (warning, citation-identifier, line 46): Identifier 'StreamableHTTPServerTransport' is absent from the cited ranges (src/server.ts:255-268)
L-11 (warning, citation-identifier, line 46): Identifier 'hijack' is absent from the cited ranges (src/server.ts:255-268)
L-12 (warning, citation-identifier, line 46): Identifier 'unknown' is absent from the cited ranges (src/server.ts:255-268)
L-13 (warning, citation-identifier, line 47): Identifier 'projects' is absent from the cited ranges (src/controller/state.ts:109-128, src/controller/state.ts:194-201)
L-14 (warning, citation-identifier, line 47): Identifier 'runs' is absent from the cited ranges (src/controller/state.ts:109-128, src/controller/state.ts:194-201)
L-15 (warning, citation-identifier, line 47): Identifier 'waits' is absent from the cited ranges (src/controller/state.ts:109-128, src/controller/state.ts:194-201)
L-16 (warning, citation-identifier, line 47): Identifier 'specs' is absent from the cited ranges (src/controller/state.ts:109-128, src/controller/state.ts:194-201)
L-17 (warning, citation-identifier, line 47): Identifier 'usage' is absent from the cited ranges (src/controller/state.ts:109-128, src/controller/state.ts:194-201)
L-18 (warning, citation-identifier, line 47): Identifier 'sources' is absent from the cited ranges (src/controller/state.ts:109-128, src/controller/state.ts:194-201)
L-19 (warning, citation-identifier, line 53): Identifier 'error' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-20 (warning, citation-identifier, line 53): Identifier 'running' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-21 (warning, citation-identifier, line 53): Identifier 'PrRead' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-22 (warning, citation-identifier, line 53): Identifier 'merged' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-23 (warning, citation-identifier, line 53): Identifier 'abandoned' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-24 (warning, citation-identifier, line 53): Identifier 'fiveHour' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-25 (warning, citation-identifier, line 53): Identifier 'sevenDay' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-26 (warning, citation-identifier, line 53): Identifier 'personalProjects' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:
L-27 (warning, citation-identifier, line 53): Identifier 'include' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-28 (warning, citation-identifier, line 53): Identifier 'skipped' is absent from the cited ranges (src/controller/waits.ts:128-132, src/controller/state.ts:254-256, src/core/deferral-storage.ts:150-152, src/dashboard/shell/now-model.ts:1-8)
L-29 (warning, citation-identifier, line 57): Identifier 'jsonl' is absent from the cited ranges (src/controller/ledger.ts:130-143, src/controller/ledger.ts:145-153, src/controller/step.ts:71-77)
L-30 (warning, citation-identifier, line 57): Identifier 'spec' is absent from the cited ranges (src/controller/ledger.ts:130-143, src/controller/ledger.ts:145-153, src/controller/step.ts:71-77)
L-31 (warning, citation-identifier, line 57): Identifier 'opinion' is absent from the cited ranges (src/controller/ledger.ts:130-143, src/controller/ledger.ts:145-153, src/controller/step.ts:71-77)
L-32 (warning, citation-identifier, line 57): Identifier 'success' is absent from the cited ranges (src/controller/ledger.ts:130-143, src/controller/ledger.ts:145-153, src/controller/step.ts:71-77)
L-33 (warning, citation-identifier, line 57): Identifier 'unknown' is absent from the cited ranges (src/controller/ledger.ts:130-143, src/controller/ledger.ts:145-153, src/controller/step.ts:71-77)
L-34 (warning, citation-identifier, line 66): Identifier 'Controller' is absent from the cited ranges (src/controller/controller.ts:375-390, src/controller/controller.ts:87-88)
L-35 (warning, citation-identifier, line 66): Identifier 'usageBlock' is absent from the cited ranges (src/controller/controller.ts:375-390, src/controller/controller.ts:87-88)
L-36 (warning, citation-identifier, line 66): Identifier 'windowBlock' is absent from the cited ranges (src/controller/controller.ts:375-390, src/controller/controller.ts:87-88)
L-37 (warning, citation-identifier, line 67): Identifier 'running' is absent from the cited ranges (src/controller/step.ts:350, src/controller/step.ts:372-374, src/controller/controller.ts:415)
L-38 (warning, citation-identifier, line 67): Identifier 'opinionStatus' is absent from the cited ranges (src/controller/step.ts:350, src/controller/step.ts:372-374, src/controller/controller.ts:415)
L-39 (warning, citation-identifier, line 67): Identifier 'active' is absent from the cited ranges (src/controller/step.ts:350, src/controller/step.ts:372-374, src/controller/controller.ts:415)
L-40 (warning, citation-identifier, line 67): Identifier 'opinion' is absent from the cited ranges (src/controller/step.ts:350, src/controller/step.ts:372-374, src/controller/controller.ts:415)
L-41 (warning, citation-identifier, line 67): Identifier 'StepUsage' is absent from the cited ranges (src/controller/step.ts:350, src/controller/step.ts:372-374, src/controller/controller.ts:415)
L-42 (warning, citation-identifier, line 67): Identifier 'onRateLimit' is absent from the cited ranges (src/controller/step.ts:350, src/controller/step.ts:372-374, src/controller/controller.ts:415)
L-43 (warning, citation-identifier, line 73): Identifier 'answerWait' is absent from the cited ranges (src/controller/merge.ts:729-753, src/controller/merge.ts:695-778, src/controller/merge.ts:542-551, src/controller/merge.ts:160-163, src/control
L-44 (warning, citation-identifier, line 73): Identifier 'advisor' is absent from the cited ranges (src/controller/merge.ts:729-753, src/controller/merge.ts:695-778, src/controller/merge.ts:542-551, src/controller/merge.ts:160-163, src/controller
L-45 (warning, citation-identifier, line 73): Identifier 'refused' is absent from the cited ranges (src/controller/merge.ts:729-753, src/controller/merge.ts:695-778, src/controller/merge.ts:542-551, src/controller/merge.ts:160-163, src/controller
L-46 (warning, citation-identifier, line 74): Identifier 'deploy' is absent from the cited ranges (scripts/sdd-self-update.sh:1-24)
L-47 (warning, citation-identifier, line 74): Identifier 'started' is absent from the cited ranges (scripts/sdd-self-update.sh:1-24)
L-48 (warning, citation-identifier, line 80): Identifier 'action' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:121-129, src/dashboard/harness/hub.ts:45-51)
L-49 (warning, citation-identifier, line 80): Identifier 'actionEvents' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:121-129, src/dashboard/harness/hub.ts:45-51)
L-50 (warning, citation-identifier, line 86): Identifier 'advisorCommand' is absent from the cited ranges (src/index.ts:129-131, src/index.ts:394-398)
L-51 (warning, citation-identifier, line 86): Identifier 'main' is absent from the cited ranges (src/index.ts:129-131, src/index.ts:394-398)
L-52 (warning, citation-identifier, line 86): Identifier 'runAdvisorCommand' is absent from the cited ranges (src/index.ts:129-131, src/index.ts:394-398)
L-53 (warning, citation-identifier, line 86): Identifier 'checkpoint' is absent from the cited ranges (src/index.ts:129-131, src/index.ts:394-398)
L-54 (warning, citation-identifier, line 86): Identifier 'withStoreLock' is absent from the cited ranges (src/index.ts:129-131, src/index.ts:394-398)
L-55 (warning, citation-identifier, line 87): Identifier 'runAdvisorCommand' is absent from the cited ranges (src/core/dashboard-session.ts:153-177)
L-56 (warning, citation-identifier, line 87): Identifier 'ADVISOR_MCP_PATH' is absent from the cited ranges (src/core/dashboard-session.ts:153-177)
L-57 (warning, citation-identifier, line 87): Identifier 'headers' is absent from the cited ranges (src/core/dashboard-session.ts:153-177)
L-58 (warning, citation-identifier, line 87): Identifier 'claude' is absent from the cited ranges (src/core/dashboard-session.ts:153-177)
L-59 (warning, citation-identifier, line 87): Identifier 'loadRole' is absent from the cited ranges (src/core/dashboard-session.ts:153-177)
L-60 (warning, citation-identifier, line 88): Identifier 'command' is absent from the cited ranges (src/controller/state.ts:479-482)
L-61 (warning, citation-identifier, line 92): Identifier 'add' is absent from the cited ranges (src/dashboard/harness/overview-watch.ts:24-29, scripts/sdd-watchdog.sh:185-201)
L-62 (warning, citation-identifier, line 92): Identifier 'change' is absent from the cited ranges (src/dashboard/harness/overview-watch.ts:24-29, scripts/sdd-watchdog.sh:185-201)
L-63 (warning, citation-identifier, line 92): Identifier 'open' is absent from the cited ranges (src/dashboard/harness/overview-watch.ts:24-29, scripts/sdd-watchdog.sh:185-201)
L-64 (warning, citation-identifier, line 92): Identifier 'dashboardUrl' is absent from the cited ranges (src/dashboard/harness/overview-watch.ts:24-29, scripts/sdd-watchdog.sh:185-201)
L-65 (warning, citation-identifier, line 92): Identifier 'failure' is absent from the cited ranges (src/dashboard/harness/overview-watch.ts:24-29, scripts/sdd-watchdog.sh:185-201)
L-66 (warning, citation-identifier, line 98): Identifier 'Read' is absent from the cited ranges (harness/agent-profiles.json:14-19)

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
