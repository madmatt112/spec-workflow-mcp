# Lint brief — dashboard-board tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/tasks.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/tasks.md` (v1). Cap: 150 words per task block excluding its prompt. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/design.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 56): Identifier 'tsc' is absent from the cited ranges (src/controller/__tests__/controller.test.ts:2402-2403)
L-2 (warning, citation-identifier, line 68): Identifier 'tsc' is absent from the cited ranges (src/dashboard/harness/__tests__/run-setup.test.ts:317-323)
L-3 (warning, bridge-missing, line 74): task 6 names later task 17 with no bridge
L-4 (warning, bridge-missing, line 85): task 7 names later task 16 with no bridge
L-5 (warning, bridge-missing, line 96): task 8 names later task 11 with no bridge
L-6 (warning, bridge-missing, line 106): task 9 names later task 20 with no bridge
L-7 (warning, bridge-missing, line 117): task 10 names later task 12 with no bridge
L-8 (warning, bridge-missing, line 128): task 11 names later task 17 with no bridge
L-9 (warning, bridge-missing, line 128): task 11 names later task 16 with no bridge
L-10 (warning, bridge-missing, line 152): task 13 names later task 14 with no bridge
L-11 (warning, bridge-missing, line 186): task 16 names later task 17 with no bridge
L-12 (info, citation-bare, line 198): Bare range `:75-99` has no earlier path citation in its block
L-13 (info, citation-bare, line 198): Bare range `:14` has no earlier path citation in its block
L-14 (error, citation-path, line 214): Cited path `frontend-tokens.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/frontend-tokens.test.ts`)
L-15 (error, citation-path, line 214): Cited path `frontend-style-scan.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/frontend-style-scan.test.ts`)
L-16 (error, citation-path, line 214): Cited path `frontend-style-scan.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/frontend-style-scan.test.ts`)
L-17 (error, citation-path, line 214): Cited path `frontend-style-scan.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/frontend-style-scan.test.ts`)
L-18 (error, citation-path, line 218): Cited path `frontend-style-scan.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/frontend-style-scan.test.ts`)
L-19 (error, citation-path, line 218): Cited path `frontend-style-scan.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/frontend-style-scan.test.ts`)
L-20 (error, citation-path, line 218): Cited path `tokens.css` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/tokens.css`)
L-21 (warning, bridge-missing, line 220): task 18 names later task 19 with no bridge
L-22 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:243-245 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-23 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:242 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-24 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:408 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-25 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:553 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-26 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:301 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-27 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:305 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-28 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:413 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-29 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:496 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-30 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:344 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-31 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:445 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-32 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:348 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-33 (error, citation-range, line 238): Cited range src/dashboard/shell/types.ts:369 is out of bounds (src/dashboard/shell/types.ts has 240 lines)
L-34 (info, citation-bare, line 258): Bare range `:86` has no earlier path citation in its block
L-35 (info, citation-bare, line 258): Bare range `:206` has no earlier path citation in its block
L-36 (info, citation-bare, line 258): Bare range `:226` has no earlier path citation in its block
L-37 (info, citation-bare, line 258): Bare range `:249` has no earlier path citation in its block
L-38 (info, citation-bare, line 258): Bare range `:265` has no earlier path citation in its block
L-39 (error, citation-path, line 258): Cited path `controller-dashboard-routes.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/controller-dashboard-routes.test.ts`)
L-40 (info, citation-bare, line 278): Bare range `:72-75` has no earlier path citation in its block
L-41 (info, citation-bare, line 278): Bare range `:238` has no earlier path citation in its block
L-42 (info, citation-bare, line 278): Bare range `:56` has no earlier path citation in its block
L-43 (info, citation-bare, line 278): Bare range `:69` has no earlier path citation in its block
L-44 (info, citation-bare, line 278): Bare range `:82` has no earlier path citation in its block
L-45 (info, citation-bare, line 291): Bare range `:271` has no earlier path citation in its block
L-46 (info, citation-bare, line 291): Bare range `:23` has no earlier path citation in its block
L-47 (info, citation-bare, line 291): Bare range `:277` has no earlier path citation in its block

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
