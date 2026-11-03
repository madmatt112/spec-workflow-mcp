# Lint brief — controller-liveness-and-push requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/requirements.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/requirements.md` (v1). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 19): Identifier 'lastActivity' is absent from the cited ranges (src/controller/state.ts:69-109)
L-2 (warning, citation-identifier, line 23): Identifier 'lastActivity' is absent from the cited ranges (src/controller/runs.ts:427-433, src/controller/runs.ts:542-547, src/controller/controller.ts:599-606, src/controller/runs.ts:1356-1376, src/c
L-3 (warning, citation-identifier, line 26): Identifier 'lastActivity' is absent from the cited ranges (src/controller/controller.ts:304-317, src/controller/controller.ts:320-332)
L-4 (warning, citation-identifier, line 27): Identifier 'lastActivity' is absent from the cited ranges (src/controller/runs.ts:1410-1427)
L-5 (warning, citation-identifier, line 37): Identifier 'runOnce' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-6 (warning, citation-identifier, line 37): Identifier 'stepKind' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-7 (warning, citation-identifier, line 37): Identifier 'message' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-8 (warning, citation-identifier, line 37): Identifier 'retry' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-9 (warning, citation-identifier, line 37): Identifier 'abandon' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-10 (warning, citation-identifier, line 37): Identifier 'waiting' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-11 (warning, citation-identifier, line 37): Identifier 'inFlight' is absent from the cited ranges (src/controller/controller.ts:428-429)
L-12 (warning, citation-identifier, line 40): Identifier 'retry' is absent from the cited ranges (src/controller/controller.ts:438-466)
L-13 (warning, citation-identifier, line 56): Identifier 'pauseRequested' is absent from the cited ranges (src/controller/runs.ts:850-858)
L-14 (warning, citation-identifier, line 56): Identifier 'paused' is absent from the cited ranges (src/controller/runs.ts:850-858)
L-15 (warning, citation-identifier, line 66): Identifier 'open' is absent from the cited ranges (src/controller/state.ts:504-506)
L-16 (warning, citation-identifier, line 66): Identifier 'url' is absent from the cited ranges (src/controller/state.ts:504-506)
L-17 (warning, citation-identifier, line 66): Identifier 'topic' is absent from the cited ranges (src/controller/state.ts:504-506)
L-18 (warning, citation-identifier, line 95): Identifier 'nextUnstartedSpec' is absent from the cited ranges (src/core/spec-routing-deriver.ts:96-106)
L-19 (warning, citation-identifier, line 95): Identifier 'launchable' is absent from the cited ranges (src/core/spec-routing-deriver.ts:96-106)
L-20 (warning, citation-identifier, line 95): Identifier 'disabledReason' is absent from the cited ranges (src/core/spec-routing-deriver.ts:96-106)
L-21 (warning, citation-identifier, line 96): Identifier 'launchSpec' is absent from the cited ranges (src/dashboard/multi-server.ts:118-123)
L-22 (warning, citation-identifier, line 96): Identifier 'ambiguous' is absent from the cited ranges (src/dashboard/multi-server.ts:118-123)

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
