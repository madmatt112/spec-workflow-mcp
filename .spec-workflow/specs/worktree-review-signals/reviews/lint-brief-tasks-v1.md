# Lint brief — worktree-review-signals tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/tasks.md`
in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`;
citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/tasks.md` (v1). Cap: 150 words per task block excluding its prompt. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, bridge-missing, line 9): task 1 names later task 12 with no bridge.
L-2 (warning, citation-identifier, line 11): Identifier 'undefined' is absent from the cited ranges (package.json:72, src/types.ts:288-296).
L-3 (warning, citation-identifier, line 12): Identifier 'toEqual' is absent from the cited ranges (src/server.ts:205, src/tools/review-task.ts:525, src/tools/adversarial-review.ts:178, src/tools/__tests__/spec-lint.e2e.test.ts:43).
L-4 (warning, citation-identifier, line 12): Identifier 'prepare' is absent from the cited ranges (src/server.ts:205, src/tools/review-task.ts:525, src/tools/adversarial-review.ts:178, src/tools/__tests__/spec-lint.e2e.test.ts:43).
L-5 (info, citation-bare, line 21): Bare range `:150` has no earlier path citation in its block.
L-6 (info, citation-bare, line 29): Bare range `:37` has no earlier path citation in its block.
L-7 (info, citation-bare, line 29): Bare range `:50-62` has no earlier path citation in its block.
L-8 (info, citation-bare, line 29): Bare range `:52-56` has no earlier path citation in its block.
L-9 (info, citation-bare, line 29): Bare range `:149` has no earlier path citation in its block.
L-10 (info, citation-bare, line 29): Bare range `:183-184` has no earlier path citation in its block.
L-11 (info, citation-bare, line 29): Bare range `:191-193` has no earlier path citation in its block.
L-12 (info, citation-bare, line 38): Bare range `:27-42` has no earlier path citation in its block.
L-13 (info, citation-bare, line 38): Bare range `:162` has no earlier path citation in its block.
L-14 (info, citation-bare, line 38): Bare range `:188` has no earlier path citation in its block.
L-15 (info, citation-bare, line 38): Bare range `:147-152` has no earlier path citation in its block.
L-16 (info, citation-bare, line 38): Bare range `:144` has no earlier path citation in its block.
L-17 (info, citation-bare, line 38): Bare range `:151` has no earlier path citation in its block.
L-18 (info, citation-bare, line 38): Bare range `:156` has no earlier path citation in its block.
L-19 (info, citation-bare, line 38): Bare range `:159` has no earlier path citation in its block.
L-20 (info, citation-bare, line 38): Bare range `:164` has no earlier path citation in its block.
L-21 (info, citation-bare, line 38): Bare range `:199` has no earlier path citation in its block.
L-22 (info, citation-bare, line 38): Bare range `:218` has no earlier path citation in its block.
L-23 (info, citation-bare, line 38): Bare range `:221` has no earlier path citation in its block.
L-24 (warning, citation-identifier, line 38): Identifier 'probeDeclaredDependencies' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-25 (warning, citation-identifier, line 38): Identifier 'access' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-26 (warning, citation-identifier, line 38): Identifier 'dependencies' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-27 (warning, citation-identifier, line 38): Identifier 'devDependencies' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-28 (warning, citation-identifier, line 38): Identifier 'optionalDependencies' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-29 (warning, citation-identifier, line 38): Identifier 'resolveTscBinary' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-30 (warning, citation-identifier, line 38): Identifier 'spawnTsc' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-31 (warning, citation-identifier, line 38): Identifier 'observed' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-32 (warning, citation-identifier, line 38): Identifier 'unwrapTypecheck' is absent from the cited ranges (src/tools/review-task.ts:96-101).
L-33 (info, citation-bare, line 46): Bare range `:31-35` has no earlier path citation in its block.
L-34 (info, citation-bare, line 46): Bare range `:37-44` has no earlier path citation in its block.
L-35 (info, citation-bare, line 46): Bare range `:481` has no earlier path citation in its block.
L-36 (info, citation-bare, line 46): Bare range `:457` has no earlier path citation in its block.
L-37 (info, citation-bare, line 46): Bare range `:675` has no earlier path citation in its block.
L-38 (info, citation-bare, line 46): Bare range `:783-802` has no earlier path citation in its block.
L-39 (info, citation-bare, line 46): Bare range `:345-346` has no earlier path citation in its block.
L-40 (warning, citation-identifier, line 54): Identifier 'workspacePath' is absent from the cited ranges (src/tools/log-implementation.ts:316, :390, :341, :203-20…).
L-41 (warning, citation-identifier, line 54): Identifier 'HEAD' is absent from the cited ranges (src/tools/log-implementation.ts:316, :390, :341, :203-20…).
L-42 (warning, citation-identifier, line 54): Identifier 'source' is absent from the cited ranges (src/tools/log-implementation.ts:316, :390, :341, :203-…).
L-43 (warning, citation-identifier, line 54): Identifier 'hasProjectPathOverride' is absent from the cited ranges (src/tools/log-implementation.ts:316, :390, :341, :203-…).
L-44 (warning, citation-identifier, line 62): Identifier 'HEAD' is absent from the cited ranges (src/dashboard/multi-server.ts:1417-1477, :1465-1467, :1469-1473, …).
L-45 (warning, citation-identifier, line 62): Identifier 'workspacePath' is absent from the cited ranges (src/dashboard/multi-server.ts:1417-1477, :1465-1467, :1469-1473, …).
L-46 (info, citation-bare, line 70): Bare range `:440-457` has no earlier path citation in its block.
L-47 (info, citation-bare, line 70): Bare range `:473` has no earlier path citation in its block.
L-48 (info, citation-bare, line 70): Bare range `:494-511` has no earlier path citation in its block.
L-49 (info, citation-bare, line 70): Bare range `:512-520` has no earlier path citation in its block.
L-50 (info, citation-bare, line 70): Bare range `:521-526` has no earlier path citation in its block.
L-51 (info, citation-bare, line 70): Bare range `:471` has no earlier path citation in its block.
L-52 (info, citation-bare, line 78): Bare range `:177` has no earlier path citation in its block.
L-53 (info, citation-bare, line 78): Bare range `:66-91` has no earlier path citation in its block.
L-54 (info, citation-bare, line 78): Bare range `:204` has no earlier path citation in its block.
L-55 (info, citation-bare, line 78): Bare range `:225` has no earlier path citation in its block.
L-56 (info, citation-bare, line 78): Bare range `:272` has no earlier path citation in its block.
L-57 (info, citation-bare, line 78): Bare range `:287-434` has no earlier path citation in its block.
L-58 (info, citation-bare, line 78): Bare range `:376` has no earlier path citation in its block.
L-59 (info, citation-bare, line 78): Bare range `:378` has no earlier path citation in its block.
L-60 (info, citation-bare, line 78): Bare range `:464-527` has no earlier path citation in its block.
L-61 (info, citation-bare, line 86): Bare range `:61` has no earlier path citation in its block.
L-62 (info, citation-bare, line 86): Bare range `:342-351` has no earlier path citation in its block.
L-63 (info, citation-bare, line 86): Bare range `:145` has no earlier path citation in its block.
L-64 (info, citation-bare, line 86): Bare range `:70` has no earlier path citation in its block.
L-65 (info, citation-bare, line 86): Bare range `:402-403` has no earlier path citation in its block.
L-66 (info, citation-bare, line 86): Bare range `:178` has no earlier path citation in its block.
L-67 (warning, citation-identifier, line 94): Identifier 'executionContext' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:401-459, :381-399, CHANGELOG.md:8).
L-68 (warning, citation-identifier, line 94): Identifier 'HEAD' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:401-459, :381-399, CHANGELOG.md:8).
L-69 (info, citation-bare, line 102): Bare range `:247-285` has no earlier path citation in its block.
L-70 (info, citation-bare, line 102): Bare range `:400-402` has no earlier path citation in its block.
L-71 (warning, citation-identifier, line 102): Identifier 'seedSharedSpecTasks' is absent from the cited ranges (e2e/helpers/worktree-harness.ts:177-179, e2e/worktree-shared.spec.ts:118-192, :81-100, :185).
L-72 (warning, citation-identifier, line 102): Identifier 'fetch' is absent from the cited ranges (e2e/helpers/worktree-harness.ts:177-179, e2e/worktree-shared.spec.ts:118-192, :81-100, :185).
L-73 (warning, citation-identifier, line 102): Identifier 'mismatch' is absent from the cited ranges (e2e/helpers/worktree-harness.ts:177-179, e2e/worktree-shared.spec.ts:118-192, :81-100, :185).
L-74 (warning, citation-identifier, line 102): Identifier 'record' is absent from the cited ranges (e2e/helpers/worktree-harness.ts:177-179, e2e/worktree-shared.spec.ts:118-192, :81-100, :185).
L-75 (warning, citation-identifier, line 104): Identifier 'seedWorktreeCode' is absent from the cited ranges (e2e/worktree-shared.spec.ts:322).

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.

## Notes on the finding classes
- `citation-identifier` fires when a sentence names an identifier the linter cannot find in the cited range. Two cases: (a) the identifier is a to-be-created artefact of this task (a function or helper the task will write), which is legitimate — the citation should point at the anchor code, not imply the new name already exists there; reword so the sentence does not read as a citation of an existing identifier, or reject with that reason. (b) English words the linter mistook for identifiers ('undefined', 'HEAD', 'source', 'record', 'fetch', 'mismatch', 'observed', 'access', 'prepare') — reject with that reason unless the word is in fact meant as a code token at a wrong range.
- `citation-bare` (info) fires when a `:line` range in a block has no path prefix earlier in that same block. If the path is established in the block header or an adjacent line, this is benign; add the path prefix to the first occurrence in the block where it clarifies, or reject with the reason that the block's path is unambiguous. Do not bloat blocks past the 150-word cap to satisfy these.
- `bridge-missing` (L-1): confirm whether task 1 genuinely uses an artefact task 12 creates. If it is a forward reference needing a bridge, name the bridge in task 1's prompt and have task 12 remove it; if task 1 merely mentions task 12 for ordering, reword so it does not read as a dependency.
