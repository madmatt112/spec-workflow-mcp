# Lint brief — dashboard-loop-views requirements v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/requirements.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-loop-views/requirements.md` (v3). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 24): Identifier 'repoDir' is absent from the cited ranges (src/controller/runs.ts:1175-1196, src/dashboard/shell/types.ts:137-150, src/dashboard_frontend/src/modules/shell/types.ts:167-179)
L-2 (warning, citation-identifier, line 27): Identifier 'merging' is absent from the cited ranges (src/controller/merge.ts:24, src/controller/runs.ts:50-55)
L-3 (warning, citation-identifier, line 39): Identifier 'owner' is absent from the cited ranges (src/types.ts:310-330)
L-4 (warning, citation-identifier, line 39): Identifier 'matthew' is absent from the cited ranges (src/types.ts:310-330)
L-5 (warning, citation-identifier, line 39): Identifier 'harness' is absent from the cited ranges (src/types.ts:310-330)
L-6 (warning, citation-identifier, line 40): Identifier 'owner' is absent from the cited ranges (src/core/deferral-storage.ts:42-62, src/core/deferral-storage.ts:125-170)
L-7 (warning, citation-identifier, line 41): Identifier 'owner' is absent from the cited ranges (src/tools/deferrals.ts:150-190, src/tools/deferrals.ts:254-275, src/core/deferral-storage.ts:218-259, src/core/deferral-storage.ts:310-329, src/tool
L-8 (warning, citation-identifier, line 43): Identifier 'owner' is absent from the cited ranges (src/core/deferral-storage.ts:428-470)
L-9 (warning, citation-identifier, line 45): Identifier 'get' is absent from the cited ranges (src/tools/deferrals.ts:199-207)
L-10 (warning, citation-identifier, line 45): Identifier 'owner' is absent from the cited ranges (src/tools/deferrals.ts:199-207)
L-11 (warning, citation-identifier, line 45): Identifier 'list' is absent from the cited ranges (src/tools/deferrals.ts:199-207)
L-12 (warning, citation-identifier, line 47): Identifier 'matthew' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:206-251)
L-13 (warning, citation-identifier, line 47): Identifier 'harness' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:206-251)
L-14 (warning, citation-identifier, line 48): Identifier 'matthew' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/primitives.tsx:63-102)
L-15 (warning, citation-identifier, line 48): Identifier 'harness' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/primitives.tsx:63-102)
L-16 (warning, citation-identifier, line 61): Identifier 'jsonl' is absent from the cited ranges (src/watch/usage.ts:162, src/watch/usage.ts:68-78)
L-17 (warning, citation-identifier, line 61): Identifier 'usage' is absent from the cited ranges (src/watch/usage.ts:162, src/watch/usage.ts:68-78)

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
