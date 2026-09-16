# Lint brief — question-gates design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` in
place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted
| partially accepted | rejected`; citations verified (count); the document's word count;
flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` (v1).
  Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes
  one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 48): Identifier 'gate' is absent from the cited ranges (src/tools/harness.ts:36-77)
L-2 (warning, citation-identifier, line 48): Identifier 'get' is absent from the cited ranges (src/tools/harness.ts:36-77)
L-3 (warning, citation-identifier, line 48): Identifier 'slot' is absent from the cited ranges (src/tools/harness.ts:36-77)
L-4 (warning, citation-identifier, line 48): Identifier 'payload' is absent from the cited ranges (src/tools/harness.ts:36-77)
L-5 (warning, citation-identifier, line 59): Identifier 'harness' is absent from the cited ranges (harness/agents/sdd-reviser.md:14-16, harness/agents/sdd-drafter.md:16-26)
L-6 (error, citation-path, line 64): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-7 (error, citation-path, line 65): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-8 (error, citation-path, line 73): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-9 (error, citation-path, line 74): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-10 (error, citation-path, line 76): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-11 (error, citation-path, line 76): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-12 (error, citation-path, line 76): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-13 (error, citation-path, line 80): Cited path resolves under no base (code root, spec store, spec dir): formats.md
L-14 (error, citation-path, line 80): Cited path resolves under no base (code root, spec store, spec dir): formats.md
L-15 (error, citation-path, line 80): Cited path resolves under no base (code root, spec store, spec dir): agent-rules.md
L-16 (warning, citation-identifier, line 111): Identifier 'payload' is absent from the cited ranges (src/tools/harness.ts:537-544)
L-17 (warning, citation-identifier, line 111): Identifier 'briefAction' is absent from the cited ranges (src/tools/harness.ts:537-544)
L-18 (warning, citation-identifier, line 121): Identifier 'gate' is absent from the cited ranges (src/tools/harness.ts:517-612)
L-19 (warning, citation-identifier, line 121): Identifier 'harness' is absent from the cited ranges (src/tools/harness.ts:517-612)
L-20 (error, citation-path, line 126): Cited path resolves under no base (code root, spec store, spec dir): SKILL.md
L-21 (error, citation-path, line 127): Cited path resolves under no base (code root, spec store, spec dir): agent-rules.md

For the citation-path errors (L-6..L-15, L-20, L-21): the linter could not resolve the
bare filename. Cite the full repo-relative path that resolves under the code root, spec
store or spec dir (for example `harness/skills/sdd-document-phase/SKILL.md`,
`harness/skills/sdd-continue/references/formats.md`,
`.spec-workflow/agent-rules.md`), verifying the path and any line range against the real
tree. For the citation-identifier warnings (L-1..L-5, L-16..L-19): either correct the
line range so the cited identifier actually appears in it, or change the citation to name
an identifier that is present — do not keep a citation that misstates the artifact.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same bare-filename citation or absent-identifier citation) and fix
   each; list them under the finding's bullet. A sibling left unchanged is next round's
   finding.
