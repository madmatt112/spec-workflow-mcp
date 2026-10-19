# Lint brief — dashboard-loop-views design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 15): Identifier 'Row' is absent from the cited ranges (src/dashboard_frontend/src/modules/theme/theme.css:97-108, src/dashboard_frontend/src/modules/theme/theme.css:172-183, src/dashboard_frontend/src/modu
L-2 (warning, citation-identifier, line 37): Identifier 'url' is absent from the cited ranges (src/controller/merge.ts:38-39)
L-3 (warning, citation-identifier, line 41): Identifier 'evaluatePullRequest' is absent from the cited ranges (src/controller/merge.ts:526-586, src/controller/merge.ts:515-517)
L-4 (warning, citation-identifier, line 41): Identifier 'runMergeStage' is absent from the cited ranges (src/controller/merge.ts:526-586, src/controller/merge.ts:515-517)
L-5 (warning, citation-identifier, line 43): Identifier 'ciFailed' is absent from the cited ranges (src/controller/merge.ts:297-321, src/controller/merge.ts:323-345, src/controller/merge.ts:347-351)
L-6 (warning, citation-identifier, line 43): Identifier 'ciPending' is absent from the cited ranges (src/controller/merge.ts:297-321, src/controller/merge.ts:323-345, src/controller/merge.ts:347-351)
L-7 (warning, citation-identifier, line 43): Identifier 'red' is absent from the cited ranges (src/controller/merge.ts:297-321, src/controller/merge.ts:323-345, src/controller/merge.ts:347-351)
L-8 (warning, citation-identifier, line 43): Identifier 'green' is absent from the cited ranges (src/controller/merge.ts:297-321, src/controller/merge.ts:323-345, src/controller/merge.ts:347-351)
L-9 (warning, citation-identifier, line 44): Identifier 'mergeable' is absent from the cited ranges (src/controller/merge.ts:297-305)
L-10 (warning, citation-identifier, line 46): Identifier 'verdict' is absent from the cited ranges (src/controller/merge.ts:457-460)
L-11 (warning, citation-identifier, line 46): Identifier 'status' is absent from the cited ranges (src/controller/merge.ts:457-460)
L-12 (warning, citation-identifier, line 46): Identifier 'reasons' is absent from the cited ranges (src/controller/merge.ts:457-460)
L-13 (warning, citation-identifier, line 46): Identifier 'sha' is absent from the cited ranges (src/controller/merge.ts:457-460)
L-14 (warning, citation-identifier, line 51): Identifier 'PrRead' is absent from the cited ranges (src/controller/state.ts:64-95)
L-15 (warning, citation-identifier, line 51): Identifier 'PrCiState' is absent from the cited ranges (src/controller/state.ts:64-95)
L-16 (warning, citation-identifier, line 55): Identifier 'prReads' is absent from the cited ranges (src/controller/runs.ts:1175-1196)
L-17 (warning, citation-identifier, line 55): Identifier 'undefined' is absent from the cited ranges (src/controller/runs.ts:1175-1196)
L-18 (warning, citation-identifier, line 55): Identifier 'PrRead' is absent from the cited ranges (src/controller/runs.ts:1175-1196)
L-19 (warning, citation-identifier, line 61): Identifier 'PrRead' is absent from the cited ranges (src/dashboard/shell/types.ts:137-150, src/dashboard_frontend/src/modules/shell/types.ts:167-179)
L-20 (warning, citation-identifier, line 61): Identifier 'UsageSpecRow' is absent from the cited ranges (src/dashboard/shell/types.ts:137-150, src/dashboard_frontend/src/modules/shell/types.ts:167-179)
L-21 (warning, citation-identifier, line 65): Identifier 'length' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunPage.tsx:176-186)
L-22 (warning, citation-identifier, line 81): Identifier 'owner' is absent from the cited ranges (src/core/deferral-storage.ts:42-62)
L-23 (warning, citation-identifier, line 82): Identifier 'owner' is absent from the cited ranges (src/core/deferral-storage.ts:125-165)
L-24 (warning, citation-identifier, line 82): Identifier 'matthew' is absent from the cited ranges (src/core/deferral-storage.ts:125-165)
L-25 (warning, citation-identifier, line 82): Identifier 'harness' is absent from the cited ranges (src/core/deferral-storage.ts:125-165)
L-26 (warning, citation-identifier, line 84): Identifier 'owner' is absent from the cited ranges (src/core/deferral-storage.ts:428-470, src/core/deferral-storage.ts:352-372)
L-27 (warning, citation-identifier, line 84): Identifier 'resolve' is absent from the cited ranges (src/core/deferral-storage.ts:428-470, src/core/deferral-storage.ts:352-372)
L-28 (warning, citation-identifier, line 89): Identifier 'owner' is absent from the cited ranges (src/tools/deferrals.ts:22-104, src/tools/deferrals.ts:18)
L-29 (warning, citation-identifier, line 92): Identifier 'handleList' is absent from the cited ranges (src/tools/deferrals.ts:199-207)
L-30 (warning, citation-identifier, line 92): Identifier 'get' is absent from the cited ranges (src/tools/deferrals.ts:199-207)
L-31 (warning, citation-identifier, line 92): Identifier 'owner' is absent from the cited ranges (src/tools/deferrals.ts:199-207)
L-32 (warning, citation-identifier, line 93): Identifier 'owner' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:370-376)
L-33 (warning, citation-identifier, line 99): Identifier 'Chips' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:75-84)
L-34 (warning, citation-identifier, line 99): Identifier 'matthew' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:75-84)
L-35 (warning, citation-identifier, line 99): Identifier 'harness' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:75-84)
L-36 (warning, citation-identifier, line 99): Identifier 'none' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:75-84)
L-37 (warning, citation-identifier, line 100): Identifier 'activeOwners' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:87-103, src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:106)
L-38 (warning, citation-identifier, line 101): Identifier 'StatusBadge' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:196-204)
L-39 (warning, citation-identifier, line 101): Identifier 'DeferralPanel' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:196-204)
L-40 (warning, citation-identifier, line 111): Identifier 'buildSpecRows' is absent from the cited ranges (src/dashboard/shell/spec-rows.ts:92-93, src/dashboard/shell/spec-rows.ts:52-60)
L-41 (warning, citation-identifier, line 112): Identifier 'buildSpecRows' is absent from the cited ranges (src/dashboard/shell/spec-rows.ts:72-86)
L-42 (warning, citation-identifier, line 112): Identifier 'isSpecClosed' is absent from the cited ranges (src/dashboard/shell/spec-rows.ts:72-86)
L-43 (warning, citation-identifier, line 114): Identifier 'closeDate' is absent from the cited ranges (src/watch/ledger.ts:201-218)
L-44 (warning, citation-identifier, line 114): Identifier 'closeout' is absent from the cited ranges (src/watch/ledger.ts:201-218)
L-45 (warning, citation-identifier, line 114): Identifier 'closed' is absent from the cited ranges (src/watch/ledger.ts:201-218)
L-46 (warning, citation-identifier, line 114): Identifier 'null' is absent from the cited ranges (src/watch/ledger.ts:201-218)
L-47 (warning, citation-identifier, line 122): Identifier 'buildUsageRows' is absent from the cited ranges (src/dashboard/multi-server.ts:526-535, src/dashboard/project-manager.ts:294-296)
L-48 (warning, citation-identifier, line 122): Identifier 'try' is absent from the cited ranges (src/dashboard/multi-server.ts:526-535, src/dashboard/project-manager.ts:294-296)
L-49 (warning, citation-identifier, line 122): Identifier 'FileCache' is absent from the cited ranges (src/dashboard/multi-server.ts:526-535, src/dashboard/project-manager.ts:294-296)
L-50 (info, citation-bare, line 202): Bare range `:171` has no earlier path citation in its block
L-51 (info, citation-bare, line 202): Bare range `:232` has no earlier path citation in its block
L-52 (warning, citation-identifier, line 204): Identifier 'prReads' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:465-499)
L-53 (warning, citation-identifier, line 204): Identifier 'pending' is absent from the cited ranges (src/controller/__tests__/runs.test.ts:465-499)
L-54 (info, citation-bare, line 205): Bare range `:411-434` has no earlier path citation in its block
L-55 (warning, citation-identifier, line 214): Identifier 'abc' is absent from the cited ranges (src/dashboard/harness/__tests__/run-setup.test.ts:366-375)

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
