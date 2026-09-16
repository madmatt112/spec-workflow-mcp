# Lint brief — question-gates design v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` in
place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted
| partially accepted | rejected`; citations verified (count); the document's word count;
flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` (v3).
  Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes
  one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 49): Identifier 'TaskVetoInput' is absent from the cited ranges (src/core/task-parser.ts:108-128, src/core/task-parser.ts:365-385, src/core/gate-rules.ts:101-104)
L-2 (warning, citation-identifier, line 60): Identifier 'put' is absent from the cited ranges (harness/agents/sdd-reviser.md:14-16, harness/agents/sdd-drafter.md:16-26)
L-3 (error, citation-path, line 65): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-4 (warning, citation-identifier, line 66): Identifier 'VetoCandidateItem' is absent from the cited ranges (harness/skills/sdd-document-phase/SKILL.md:80-85, harness/skills/sdd-document-phase/SKILL.md:236-245)
L-5 (error, citation-path, line 66): Cited path resolves under no base (code root, spec store, spec dir): references/briefs.md
L-6 (error, citation-path, line 66): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-7 (error, citation-path, line 66): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-8 (warning, citation-identifier, line 156): Identifier 'findings' is absent from the cited ranges (src/core/lint-types.ts:17-24)
L-9 (error, citation-path, line 156): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-10 (error, citation-path, line 156): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-11 (error, citation-path, line 157): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md

For the citation-path errors (L-3, L-5, L-6, L-7, L-9, L-10, L-11): the linter could not
resolve a bare filename. Two different `SKILL.md` files are in play — the document-phase
skill is `harness/skills/sdd-document-phase/SKILL.md` and the supervisor skill is
`harness/skills/sdd-continue/SKILL.md`; the briefs file is
`harness/skills/sdd-document-phase/references/briefs.md`. Cite the full repo-relative path
that matches the file each occurrence actually means, verifying the path and its line
range against the real tree. For the citation-identifier warnings (L-1, L-2, L-4, L-8):
`TaskVetoInput` and `VetoCandidateItem` are this design's own new types and `put` is a new
gate op name — none is declared in the cited existing code, so de-backtick them to prose
where they sit next to a code citation (or cite the design's own Data Models section, not
existing code). `findings` at line 156 is the orchestrator's `LINT.findings` task-list
value from the skill, not a field of `lint-types.ts` — cite the skill or de-backtick. Do
not keep a backticked identifier next to a range that does not contain it.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Edit v3 in place. Add no version line. Append under the v3 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same bare-filename citation or absent-identifier citation) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
