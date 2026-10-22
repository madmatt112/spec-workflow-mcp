# Lint brief — harness-evals requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md` (v1). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (error, citation-path, line 9): Cited path `GLOSSARY.md` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/GLOSSARY.md`)
L-2 (warning, citation-identifier, line 33): Identifier 'runStep' is absent from the cited ranges (src/controller/step.ts:146-150)
L-3 (warning, citation-identifier, line 81): Identifier 'shout' is absent from the cited ranges (src/controller/merge.ts:252-256, docs/foundation-handoff.md:31-33)
L-4 (warning, citation-identifier, line 82): Identifier 'shout' is absent from the cited ranges (src/tools/brief-templates.ts:1509, docs/foundation-review.md:671-673)
L-5 (warning, citation-identifier, line 83): Identifier 'whisper' is absent from the cited ranges (docs/foundation-review.md:700-703)
L-6 (warning, ears-shape, line 86): Requirement 5 criterion 4 has no `SHALL`
L-7 (warning, citation-identifier, line 114): Identifier 'runStep' is absent from the cited ranges (src/controller/step.ts:18-19, src/controller/step.ts:361-364)

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
