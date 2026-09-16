# Lint brief — question-gates tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/tasks.md` in place,
then report in 150 words or fewer: files touched; each finding as
`<id>: accepted | partially accepted | rejected`; citations verified (count); the
document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/tasks.md` (v1).
  Cap: 150 words per task block excluding its prompt. Do not grow the document past it; a
  fix that adds a paragraph removes one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`.
- Design:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 4): Identifier 'harness' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-2 (warning, citation-identifier, line 4): Identifier 'gate' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-3 (warning, citation-identifier, line 4): Identifier 'computeClassA' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-4 (warning, citation-identifier, line 4): Identifier 'vitest' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-5 (warning, citation-identifier, line 4): Identifier 'get' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-6 (warning, citation-identifier, line 4): Identifier 'delete' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-7 (warning, bridge-missing, line 34): task 4 names later task 5 with no bridge
L-8 (error, citation-path, line 39): Cited path resolves under no base (code root, spec store, spec dir): sdd-reviser.md
L-9 (error, citation-path, line 41): Cited path resolves under no base (code root, spec store, spec dir): sdd-reviser.md
L-10 (error, citation-path, line 49): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-11 (error, citation-path, line 49): Cited path resolves under no base (code root, spec store, spec dir): references/briefs.md
L-12 (error, citation-path, line 59): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact
   is a MUST_FIX next round. The bare paths in L-8..L-12 are real files under the harness/
   tree; each same-task `- File:` line already names the correct directory prefix (task 4
   uses harness/agents/sdd-reviser.md; task 5 uses harness/skills/sdd-document-phase/SKILL.md
   and harness/skills/sdd-document-phase/references/briefs.md; task 6 uses
   harness/skills/sdd-continue/SKILL.md). Give each citation a base-resolvable path.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task
   shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong
   to others. You may replace a context-file line that an accepted finding refutes: same
   line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
