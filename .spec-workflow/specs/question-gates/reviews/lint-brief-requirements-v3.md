# Lint brief — question-gates requirements v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`
in place, then report in 150 words or fewer: files touched; each finding as
`<id>: accepted | partially accepted | rejected`; citations verified (count); the
document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`
  (v3). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph
  removes one.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 22): Identifier 'record' is absent from the cited ranges (docs/step-0-answers.md:105).
L-2 (warning, citation-identifier, line 22): Identifier 'headless' is absent from the cited ranges (docs/step-0-answers.md:105).
L-3 (warning, citation-identifier, line 23): Identifier 'record' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:60).
L-4 (warning, citation-identifier, line 32): Identifier 'question' is absent from the cited ranges (harness/skills/sdd-document-phase/SKILL.md:20).
L-5 (warning, citation-identifier, line 32): Identifier 'options' is absent from the cited ranges (harness/skills/sdd-document-phase/SKILL.md:20).
L-6 (warning, citation-identifier, line 125): Identifier 'record' is absent from the cited ranges (docs/step-0-answers.md:105, harness/skills/sdd-continue/SKILL.md:60, harness/skills/sdd-document-phase/SKILL.md:20).
L-7 (warning, citation-identifier, line 125): Identifier 'headless' is absent from the cited ranges (docs/step-0-answers.md:105, harness/skills/sdd-continue/SKILL.md:60, harness/skills/sdd-document-phase/SKILL.md:20).
L-8 (warning, citation-identifier, line 125): Identifier 'question' is absent from the cited ranges (docs/step-0-answers.md:105, harness/skills/sdd-continue/SKILL.md:60, harness/skills/sdd-document-phase/SKILL.md:20).
L-9 (warning, citation-identifier, line 125): Identifier 'options' is absent from the cited ranges (docs/step-0-answers.md:105, harness/skills/sdd-continue/SKILL.md:60, harness/skills/sdd-document-phase/SKILL.md:20).

Context: L-1..L-5 are the same citation-identifier warnings the v2 lint pass already
assessed and rejected — the linter reads a backtick-wrapped defined term (`record`,
`headless`, `question`, `options`) that sits on the same line as a citation scoped to a
different clause, and the cited source never claims to contain that term. L-6..L-9 are
the same pattern in the v3 Revision History disposition bullets on line 125, which cite
the fix sources while naming those defined terms. For each finding: read the cited
line(s) under `/home/mcf/repo/spec-workflow-mcp` (both ends) and either (a) reject with
the standing reason if the flagged token is this document's own defined term and the
citation backs only a different clause, preserving the disposition record verbatim, or
(b) if a citation genuinely misattributes a term, correct the range you have read. Do
not distort the Revision History record just to silence a warning. Never invent a range
you have not read.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work. When
   a finding says a rationale clause is false, delete the clause unless you can prove
   the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v3 in place. Add no version line. Append under the v3 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same citation range, rule table, command, fixture shape or union
   member) and fix each; list them under the finding's bullet. A sibling left unchanged
   is next round's finding.
