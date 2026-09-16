# Lint brief — question-gates design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` in
place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted
| partially accepted | rejected`; citations verified (count); the document's word count;
flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` (v2).
  Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes
  one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 49): Identifier 'title' is absent from the cited ranges (src/core/task-parser.ts:108-128, src/core/task-parser.ts:365-385)
L-2 (warning, citation-identifier, line 49): Identifier 'block' is absent from the cited ranges (src/core/task-parser.ts:108-128, src/core/task-parser.ts:365-385)
L-3 (warning, citation-identifier, line 49): Identifier 'parseSensitivePaths' is absent from the cited ranges (src/core/task-parser.ts:108-128, src/core/task-parser.ts:365-385)
L-4 (warning, citation-identifier, line 49): Identifier 'null' is absent from the cited ranges (src/core/task-parser.ts:108-128, src/core/task-parser.ts:365-385)
L-5 (warning, citation-identifier, line 49): Identifier 'computeClassA' is absent from the cited ranges (src/core/task-parser.ts:108-128, src/core/task-parser.ts:365-385)
L-6 (warning, citation-identifier, line 113): Identifier 'payload' is absent from the cited ranges (src/tools/harness.ts:537-544)
L-7 (warning, citation-identifier, line 113): Identifier 'briefAction' is absent from the cited ranges (src/tools/harness.ts:537-544)
L-8 (warning, citation-identifier, line 150): Identifier 'title' is absent from the cited ranges (src/core/task-parser.ts:108-128, src/core/task-parser.ts:365-385)

For each: either correct the cited path and line range so the named identifier actually
appears in it (some of these identifiers — `parseSensitivePaths`, `computeClassA`,
`briefAction` — live in real code at some path; cite where they truly are), or, when the
token is a field/keyword the design introduces and no code declares yet (a new
AskUserQuestion `title` field, the keyword `null`), de-backtick it so it is prose, not a
citation. Do not keep a backticked identifier next to a range that does not contain it.
Verify every path and range you change against the real tree.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same absent-identifier citation) and fix each; list them under the
   finding's bullet. A sibling left unchanged is next round's finding.
