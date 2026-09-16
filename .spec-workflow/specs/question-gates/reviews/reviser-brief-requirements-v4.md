# Reviser brief — question-gates requirements v4 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v4 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`
in place. This is a SHOULD_FIX-only corrective pass: address the three SHOULD_FIX
findings below (R3-1, R3-2, R3-3). No further adversarial review round follows — a
narrow check only verifies these items were addressed. Then report in 150 words or
fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`;
citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`
  (v3). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph
  removes one.
- Findings (SHOULD_FIX only, R3-1..R3-3):
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r3.md`.
  Read the full analysis for context, but only R3-1, R3-2 and R3-3 are in scope. R3-4 is
  a MINOR (record-mode write-failure behaviour); you may fold in a one-line clarification
  if it is trivial and adjacent to your R3-2 fix, otherwise leave it.
- Memory:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md`
  (read; do not write it — the reviewer maintains it). Read `## Guidance for Next
  Review`. When it names another place where an accepted finding's defect occurs, fix
  that place under the same finding's bullet as `also applied to <where>`. This is not
  widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: question-gates`,
  `phase: requirements`) for the response methodology. Ignore its instructions to present
  to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work. When
   a finding says a rationale clause is false, delete the clause unless you can prove
   the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v4 in place. Add the Revision History line
   `- **v4** (2026-09-16) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md,
   verdict iterate 0/3/1), SHOULD_FIX-only corrective pass.` followed by one nested
   bullet per finding:
   `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what
   changed, or why not>`. If the document carries a `Document version:` header, set it
   to v4.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding marked `Compounds: R2-<n>` (R3-1 compounds R2-2) lands in text a previous
    delta wrote: do not reword the clause again. Write one plain sentence of what the
    clause must claim, delete the old text, and probe the new claim as round 1 would. A
    claim you cannot probe is deleted, not kept.
