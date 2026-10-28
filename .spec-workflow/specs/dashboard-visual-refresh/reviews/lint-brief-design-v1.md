# Lint brief — dashboard-visual-refresh design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (error, citation-path, line 13): Cited path `playwright.worktree-pattern.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/playwright.worktree-pattern.ts`)
L-2 (error, citation-path, line 42): Cited path `ThemeProvider.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/ThemeProvider.tsx`)
L-3 (error, citation-path, line 45): Cited path `theme.css` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/theme.css`)
L-4 (error, citation-path, line 51): Cited path `theme.css` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/theme.css`)
L-5 (error, citation-path, line 51): Cited path `tailwind.css` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/tailwind.css`)
L-6 (error, citation-path, line 52): Cited path `tailwind.css` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/tailwind.css`)
L-7 (error, citation-path, line 53): Cited path `main.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/main.tsx`)
L-8 (error, citation-path, line 53): Cited path `theme.css` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/theme.css`)
L-9 (error, citation-path, line 53): Cited path `ThemeProvider.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/ThemeProvider.tsx`)
L-10 (error, citation-path, line 75): Cited path `LoginPanel.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/LoginPanel.tsx`)
L-11 (error, citation-path, line 78): Cited path `RunsPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/RunsPage.tsx`)
L-12 (error, citation-path, line 78): Cited path `RunsPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/RunsPage.tsx`)
L-13 (error, citation-path, line 82): Cited path `primitives.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/primitives.tsx`)
L-14 (error, citation-path, line 82): Cited path `primitives.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/primitives.tsx`)
L-15 (error, citation-path, line 84): Cited path `Gear.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/Gear.tsx`)
L-16 (error, citation-path, line 86): Cited path `PageLayout.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/PageLayout.tsx`)
L-17 (error, citation-path, line 87): Cited path `App.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/App.tsx`)
L-18 (error, citation-path, line 88): Cited path `ShellProvider.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/ShellProvider.tsx`)
L-19 (error, citation-path, line 95): Cited path `RunsPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/RunsPage.tsx`)
L-20 (error, citation-path, line 96): Cited path `RunPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/RunPage.tsx`)
L-21 (error, citation-path, line 97): Cited path `RunPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/RunPage.tsx`)
L-22 (error, citation-path, line 98): Cited path `SpecsPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/SpecsPage.tsx`)
L-23 (error, citation-path, line 99): Cited path `SpecsPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/SpecsPage.tsx`)
L-24 (error, citation-path, line 99): Cited path `DeferralsPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/DeferralsPage.tsx`)
L-25 (error, citation-path, line 100): Cited path `NowPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/NowPage.tsx`)
L-26 (error, citation-path, line 102): Cited path `pause.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/pause.ts`)
L-27 (error, citation-path, line 102): Cited path `NowPage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/NowPage.tsx`)
L-28 (error, citation-path, line 105): Cited path `UsageTrend.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/UsageTrend.tsx`)
L-29 (error, citation-path, line 107): Cited path `UsagePage.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/UsagePage.tsx`)
L-30 (warning, citation-identifier, line 132): Identifier 'theme' is absent from the cited ranges (node_modules/playwright-core/types/types.d.ts:2571-2602, node_modules/playwright-core/types/types.d.ts:307)
L-31 (error, citation-path, line 133): Cited path `ThemeProvider.tsx` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/ThemeProvider.tsx`)
L-32 (warning, citation-identifier, line 212): Identifier 'setProperty' is absent from the cited ranges (e2e/worktree-shell.spec.ts:242-256)
L-33 (error, citation-path, line 212): Cited path `vitest.config.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/vitest.config.ts`)

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
