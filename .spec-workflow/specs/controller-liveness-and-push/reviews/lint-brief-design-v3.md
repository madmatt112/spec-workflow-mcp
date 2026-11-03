# Lint brief — controller-liveness-and-push design v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/design.md` (v3). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 32): Identifier 'writeRun' is absent from the cited ranges (src/controller/state.ts:415)
L-2 (warning, citation-identifier, line 35): Identifier 'lastActivity' is absent from the cited ranges (src/controller/state.ts:417-433)
L-3 (warning, citation-identifier, line 35): Identifier 'patchRun' is absent from the cited ranges (src/controller/state.ts:417-433)
L-4 (warning, citation-identifier, line 35): Identifier 'save' is absent from the cited ranges (src/controller/state.ts:417-433)
L-5 (warning, citation-identifier, line 35): Identifier 'cancelRun' is absent from the cited ranges (src/controller/state.ts:417-433)
L-6 (warning, citation-identifier, line 35): Identifier 'writeLastActivity' is absent from the cited ranges (src/controller/state.ts:417-433)
L-7 (warning, citation-identifier, line 42): Identifier 'handleLine' is absent from the cited ranges (src/controller/step.ts:446-448)
L-8 (warning, citation-identifier, line 43): Identifier 'finish' is absent from the cited ranges (src/controller/step.ts:466-469, src/controller/step.ts:509-511)
L-9 (warning, citation-identifier, line 76): Identifier 'ShellFeed' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:41, src/dashboard/shell/shell-feed.ts:117)
L-10 (warning, citation-identifier, line 76): Identifier 'flush' is absent from the cited ranges (src/dashboard/shell/shell-feed.ts:41, src/dashboard/shell/shell-feed.ts:117)
L-11 (warning, citation-identifier, line 77): Identifier 'HarnessHub' is absent from the cited ranges (src/dashboard/harness/hub.ts:44, src/dashboard/harness/hub.ts:98)
L-12 (warning, citation-identifier, line 85): Identifier 'reattach' is absent from the cited ranges (src/controller/controller.ts:75-78, src/controller/controller.ts:321)
L-13 (warning, citation-identifier, line 87): Identifier 'drive' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-14 (warning, citation-identifier, line 87): Identifier 'try' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-15 (warning, citation-identifier, line 87): Identifier 'active' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-16 (warning, citation-identifier, line 92): Identifier 'startDrive' is absent from the cited ranges (src/controller/controller.ts:419)
L-17 (warning, citation-identifier, line 92): Identifier 'runEvents' is absent from the cited ranges (src/controller/controller.ts:419)
L-18 (warning, citation-identifier, line 92): Identifier 'change' is absent from the cited ranges (src/controller/controller.ts:419)
L-19 (warning, citation-identifier, line 92): Identifier 'drivenRuns' is absent from the cited ranges (src/controller/controller.ts:419)
L-20 (warning, citation-identifier, line 96): Identifier 'running' is absent from the cited ranges (src/controller/runs.ts:850-858)
L-21 (warning, citation-identifier, line 96): Identifier 'startDrive' is absent from the cited ranges (src/controller/runs.ts:850-858)
L-22 (warning, citation-identifier, line 96): Identifier 'pauseRequested' is absent from the cited ranges (src/controller/runs.ts:850-858)
L-23 (warning, citation-identifier, line 97): Identifier 'openDriveCrashWait' is absent from the cited ranges (src/controller/controller.ts:438-466)
L-24 (warning, citation-identifier, line 103): Identifier 'driven' is absent from the cited ranges (src/controller/controller.ts:320-332)
L-25 (warning, citation-identifier, line 109): Identifier 'expired' is absent from the cited ranges (src/controller/waits.ts:73-84)
L-26 (warning, citation-identifier, line 109): Identifier 'change' is absent from the cited ranges (src/controller/waits.ts:73-84)
L-27 (warning, citation-identifier, line 110): Identifier 'onWaitChange' is absent from the cited ranges (src/controller/controller.ts:439, src/controller/waits.ts:193-198)
L-28 (warning, citation-identifier, line 111): Identifier 'expireWait' is absent from the cited ranges (src/controller/waits.ts:87-141)
L-29 (warning, citation-identifier, line 119): Identifier 'notifyConfigPath' is absent from the cited ranges (src/advisor/home.ts:39-41)
L-30 (warning, citation-identifier, line 119): Identifier 'tsc' is absent from the cited ranges (src/advisor/home.ts:39-41)
L-31 (warning, citation-identifier, line 122): Identifier 'readNotifyConfig' is absent from the cited ranges (src/advisor/summary.ts:93-100)
L-32 (warning, citation-identifier, line 122): Identifier 'undefined' is absent from the cited ranges (src/advisor/summary.ts:93-100)
L-33 (warning, citation-identifier, line 122): Identifier 'topic' is absent from the cited ranges (src/advisor/summary.ts:93-100)
L-34 (warning, citation-identifier, line 122): Identifier 'token' is absent from the cited ranges (src/advisor/summary.ts:93-100)
L-35 (warning, citation-identifier, line 131): Identifier 'runStartupScan' is absent from the cited ranges (src/advisor/push.ts:166-172, src/advisor/push.ts:175-186, src/advisor/push.ts:189)
L-36 (warning, citation-identifier, line 131): Identifier 'ids' is absent from the cited ranges (src/advisor/push.ts:166-172, src/advisor/push.ts:175-186, src/advisor/push.ts:189)
L-37 (warning, citation-identifier, line 131): Identifier 'now' is absent from the cited ranges (src/advisor/push.ts:166-172, src/advisor/push.ts:175-186, src/advisor/push.ts:189)
L-38 (warning, citation-identifier, line 131): Identifier 'reminded' is absent from the cited ranges (src/advisor/push.ts:166-172, src/advisor/push.ts:175-186, src/advisor/push.ts:189)
L-39 (warning, citation-identifier, line 141): Identifier 'name' is absent from the cited ranges (src/controller/state.ts:504-506)
L-40 (warning, citation-identifier, line 142): Identifier 'fetch' is absent from the cited ranges (src/controller/state.ts:140-147)
L-41 (warning, citation-identifier, line 142): Identifier 'TypeError' is absent from the cited ranges (src/controller/state.ts:140-147)
L-42 (warning, citation-identifier, line 147): Identifier 'validateSetup' is absent from the cited ranges (src/dashboard/harness/run-setup.ts:200-201, src/dashboard/multi-server.ts:79-87, src/dashboard/harness/run-setup.ts:265-267, src/dashboard_f
L-43 (warning, citation-identifier, line 156): Identifier 'running' is absent from the cited ranges (src/controller/controller.ts:381-396)
L-44 (warning, citation-identifier, line 179): Identifier 'firstPush' is absent from the cited ranges (src/advisor/push.ts:104-111)
L-45 (warning, citation-identifier, line 179): Identifier 'reminded' is absent from the cited ranges (src/advisor/push.ts:104-111)
L-46 (warning, citation-identifier, line 185): Identifier 'createWait' is absent from the cited ranges (src/controller/controller.ts:449-450)
L-47 (warning, citation-identifier, line 185): Identifier 'running' is absent from the cited ranges (src/controller/controller.ts:449-450)
L-48 (warning, citation-identifier, line 185): Identifier 'onWaitChange' is absent from the cited ranges (src/controller/controller.ts:449-450)
L-49 (warning, citation-identifier, line 203): Identifier 'claude' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-50 (warning, citation-identifier, line 203): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-51 (warning, citation-identifier, line 203): Identifier 'inFlight' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-52 (warning, citation-identifier, line 203): Identifier 'drivenRuns' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-53 (warning, citation-identifier, line 203): Identifier 'retry' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-54 (warning, citation-identifier, line 203): Identifier 'abandon' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-55 (warning, citation-identifier, line 203): Identifier 'redrive' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-56 (warning, citation-identifier, line 203): Identifier 'paused' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-57 (warning, citation-identifier, line 203): Identifier 'recover' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)
L-58 (warning, citation-identifier, line 203): Identifier 'driven' is absent from the cited ranges (src/controller/controller.ts:54, src/controller/runs.ts:832)

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v3 in place. Add no version line. Append under the v3 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
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
