# Lint brief — question-gates requirements v4

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v4 of
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
  (v4). Cap: 3,500 words (body is ~2,526; you have headroom, but do not pad).
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 22): 'record' absent (docs/step-0-answers.md:105).
L-2 (warning, citation-identifier, line 22): 'headless' absent (docs/step-0-answers.md:105).
L-3 (warning, citation-identifier, line 23): 'record' absent (harness/skills/sdd-continue/SKILL.md:60).
L-4 (warning, citation-identifier, line 32): 'question' absent (harness/skills/sdd-document-phase/SKILL.md:20).
L-5 (warning, citation-identifier, line 32): 'options' absent (harness/skills/sdd-document-phase/SKILL.md:20).
L-6 (warning, citation-identifier, line 38): 'answer' absent (harness/skills/sdd-continue/SKILL.md:122).
L-7 (warning, citation-identifier, line 38): 'record' absent (harness/skills/sdd-continue/SKILL.md:122).
L-8 (warning, citation-identifier, line 126): 'record' absent (docs/step-0-answers.md:105, harness/skills/sdd-continue/SKILL.md:60, harness/skills/sdd-document-phase/SKILL.md:20).
L-9 (warning, citation-identifier, line 126): 'headless' absent (same three ranges).
L-10 (warning, citation-identifier, line 126): 'question' absent (same three ranges).
L-11 (warning, citation-identifier, line 126): 'options' absent (same three ranges).
L-12 (warning, citation-identifier, line 134): 'record' absent (same three ranges).
L-13 (warning, citation-identifier, line 134): 'headless' absent (same three ranges).
L-14 (warning, citation-identifier, line 134): 'question' absent (same three ranges).
L-15 (warning, citation-identifier, line 134): 'options' absent (same three ranges).
L-16 (ERROR, citation-path, line 136): Cited path resolves under no base: sdd-drafter.md.
L-17 (ERROR, citation-path, line 136): Cited path resolves under no base: sdd-reviser.md.
L-18 (ERROR, citation-path, line 137): Cited path resolves under no base: sdd-continue/SKILL.md.

Guidance:
- L-16, L-17, L-18 are real ERRORS and must be fixed. Lines 136-137 are v4 Revision
  History disposition bullets that cite abbreviated bare paths (`sdd-drafter.md:7-13`,
  `sdd-reviser.md:7-16`, `sdd-continue/SKILL.md:122`). Expand each to its full
  repo-relative path (`harness/agents/sdd-drafter.md`, `harness/agents/sdd-reviser.md`,
  `harness/skills/sdd-continue/SKILL.md`), verifying the file exists and the line range
  reads as claimed. Do not delete the disposition record — only correct the path.
- L-1..L-15 are the recurring `citation-identifier` warnings the v2 and v3 lint passes
  already rejected (a backtick-wrapped defined term of this document — `record`,
  `headless`, `question`, `options` — on a line that also carries a citation scoped to a
  different clause). Reject them with that standing reason unless you find new evidence.
- L-6, L-7 (line 38) are on a body citation the v4 pass added (R3-2 fix citing
  `harness/skills/sdd-continue/SKILL.md:122` for the supervisor's step-3 routing). Read
  that line (both ends). If the citation genuinely supports the sentence's claim and the
  flagged tokens (`answer`, `record`) are this document's own terms, reject as above; if
  the cited line does not support the claim, correct the citation or delete the unproven
  clause. Never invent a range you have not read.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work. When
   a finding says a rationale clause is false, delete the clause unless you can prove
   the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v4 in place. Add no version line. Append under the v4 Revision History line one
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
