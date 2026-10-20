# Lint brief — project-bootstrap tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/tasks.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/tasks.md` (v1). Cap: 150 words per task block excluding its prompt. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/design.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 11): Identifier 'peekDashboardSession' is absent from the cited ranges (src/core/dashboard-session.ts:122-141, src/core/dashboard-session.ts:21-24)
L-2 (warning, citation-identifier, line 11): Identifier 'mkdir' is absent from the cited ranges (src/core/dashboard-session.ts:122-141, src/core/dashboard-session.ts:21-24)
L-3 (error, citation-path, line 15): Cited path `dashboard-session.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/dashboard-session.ts`)
L-4 (error, citation-path, line 25): Cited path `git-utils.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/git-utils.ts`)
L-5 (error, citation-path, line 25): Cited path `project-registry.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/project-registry.ts`)
L-6 (error, citation-path, line 25): Cited path `state.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/state.ts`)
L-7 (error, citation-path, line 25): Cited path `project-manager.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/project-manager.ts`)
L-8 (error, citation-path, line 35): Cited path `health-route.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/health-route.test.ts`)
L-9 (error, mdx, line 35): Could not parse expression with acorn
L-10 (error, citation-path, line 46): Cited path `access.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/access.ts`)
L-11 (error, citation-path, line 46): Cited path `utils.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/utils.ts`)
L-12 (error, citation-path, line 46): Cited path `access.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/access.ts`)
L-13 (error, citation-path, line 58): Cited path `workspace-initializer.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/workspace-initializer.ts`)
L-14 (error, citation-path, line 58): Cited path `run-setup.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/run-setup.ts`)
L-15 (error, citation-path, line 58): Cited path `gate-rules.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/gate-rules.ts`)
L-16 (error, citation-path, line 69): Cited path `index.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/index.ts`)
L-17 (error, citation-path, line 81): Cited path `git-utils.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/git-utils.ts`)
L-18 (warning, citation-identifier, line 89): Identifier 'export' is absent from the cited ranges (src/controller/merge.ts:47-50)
L-19 (error, citation-path, line 93): Cited path `state.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/state.ts`)
L-20 (error, citation-path, line 93): Cited path `git-utils.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/git-utils.ts`)
L-21 (error, citation-path, line 93): Cited path `merge.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/merge.ts`)
L-22 (error, citation-path, line 105): Cited path `index.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/index.ts`)
L-23 (error, citation-path, line 105): Cited path `index.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/index.ts`)
L-24 (error, citation-path, line 105): Cited path `index.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/index.ts`)
L-25 (error, citation-path, line 105): Cited path `workspace-roots.test.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/workspace-roots.test.ts`)
L-26 (warning, citation-identifier, line 117): Identifier 'init' is absent from the cited ranges (docs/SDD-HARNESS.md:312-331, docs/SDD-HARNESS.md:252-270)

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
