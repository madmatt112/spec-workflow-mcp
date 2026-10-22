# Lint brief — harness-evals design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (error, citation-path, line 13): Cited path `vitest.config.ts` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/vitest.config.ts`)
L-2 (warning, citation-identifier, line 56): Identifier 'wire' is absent from the cited ranges (src/tools/brief-templates.ts:1505)
L-3 (warning, citation-identifier, line 57): Identifier 'RenderError' is absent from the cited ranges (src/controller/phases/implementation.ts:501-502, src/tools/harness.ts:805-807)
L-4 (warning, citation-identifier, line 58): Identifier 'closeout' is absent from the cited ranges (src/controller/phases/closeout.ts:196-206)
L-5 (warning, citation-identifier, line 65): Identifier 'undefined' is absent from the cited ranges (src/controller/phases/implementation.ts:144-184, src/controller/phases/document.ts:199-220, src/controller/phases/closeout.ts:82-104)
L-6 (warning, citation-identifier, line 71): Identifier 'doc' is absent from the cited ranges (src/core/task-validator.ts:42, src/core/task-validator.ts:146-162)
L-7 (warning, citation-identifier, line 76): Identifier 'repo' is absent from the cited ranges (src/controller/merge.ts:252-256)
L-8 (warning, citation-identifier, line 76): Identifier 'HEAD' is absent from the cited ranges (src/controller/merge.ts:252-256)
L-9 (warning, citation-identifier, line 84): Identifier 'runs' is absent from the cited ranges (src/controller/state.ts:239-243)
L-10 (warning, citation-identifier, line 84): Identifier 'home' is absent from the cited ranges (src/controller/state.ts:239-243)
L-11 (warning, citation-identifier, line 84): Identifier 'step' is absent from the cited ranges (src/controller/state.ts:239-243)
L-12 (warning, citation-identifier, line 84): Identifier 'runStep' is absent from the cited ranges (src/controller/state.ts:239-243)
L-13 (warning, citation-identifier, line 84): Identifier 'ids' is absent from the cited ranges (src/controller/state.ts:239-243)
L-14 (warning, citation-identifier, line 89): Identifier 'role' is absent from the cited ranges (src/controller/step.ts:381-387)
L-15 (warning, citation-identifier, line 89): Identifier 'sessionId' is absent from the cited ranges (src/controller/step.ts:381-387)
L-16 (warning, citation-identifier, line 89): Identifier 'mcpConfig' is absent from the cited ranges (src/controller/step.ts:381-387)
L-17 (warning, citation-identifier, line 95): Identifier 'SDD_RUN_ID' is absent from the cited ranges (src/controller/step.ts:381)
L-18 (warning, citation-identifier, line 95): Identifier 'SDD_STEP_ID' is absent from the cited ranges (src/controller/step.ts:381)
L-19 (warning, citation-identifier, line 117): Identifier 'context' is absent from the cited ranges (src/core/deferral-storage.ts:229-270)
L-20 (warning, citation-identifier, line 131): Identifier 'BASE' is absent from the cited ranges (scripts/sdd-self-update.sh:123-158)
L-21 (warning, citation-identifier, line 131): Identifier 'TARGET_COMMIT' is absent from the cited ranges (scripts/sdd-self-update.sh:123-158)
L-22 (warning, citation-identifier, line 131): Identifier 'check_move' is absent from the cited ranges (scripts/sdd-self-update.sh:123-158)
L-23 (warning, citation-identifier, line 134): Identifier 'check_move' is absent from the cited ranges (scripts/sdd-self-update.sh:159-173)
L-24 (warning, citation-identifier, line 216): Identifier 'SDD_STAGE_BUILD' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:244-265, src/__tests__/service-scripts.test.ts:267-317)
L-25 (warning, citation-identifier, line 216): Identifier 'SDD_STAGE_SMOKE' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:244-265, src/__tests__/service-scripts.test.ts:267-317)
L-26 (error, citation-path, line 216): Cited path resolves under no base (code root, spec store, spec dir): dist/evals/cli.js

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
