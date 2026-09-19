# Reviser brief — harness-usage-and-tiers design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
in place from the findings below, then report in 150 words or fewer: files touched; each
finding as `<id>: accepted | partially accepted | rejected`; citations verified (count);
the document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
  (v1). Cap: 4,000 words (body only, H1 to the line before `## Revision History`). The
  body is at 3,998 words — do not grow it past 4,000; a fix that adds a paragraph removes
  one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md`.
- Findings:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design.md`.
- Memory:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-design.md`
  (read; do not write it — the reviewer maintains it). Read `## Guidance for Next
  Review`. When it names another place where an accepted finding's defect occurs, fix
  that place under the same finding's bullet as `also applied to <where>`. This is not
  widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName:
  harness-usage-and-tiers`, `phase: design`) for the response methodology. Ignore its
  instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round. R1-1 turns on exact line spans in skill/doc files
   — re-read each cited range end to end and confirm the edit span reaches the actual
   token-write text.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-09-19) — Round-1
   adversarial response (adversarial-analysis-design.md, verdict iterate 1/1/2).`
   followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted
   | Rejected> (<severity>).** <what changed, or why not>`. Set the `Document version:`
   header to v2. A Revision-History bullet cites findings by id and prose only; it carries
   no backticked path or identifier token. State what the fix did, and cite the exact
   post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none. Note: the reviewer ruled both drafter RE-DECIDED
   flags (Req 4.7 two-line agent entry; Req 5.4 / D6 non-digit `tokens` value) as
   refinement — closed. Do not re-open or re-decide them.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding refutes:
   same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape, citation span or union member)
   and fix each; list them under the finding's bullet. A sibling left unchanged is next
   round's finding. R1-1 names several sibling spans (retro `:35-38` tail, closeout footer
   `:168` vs `:170`, the scope note's `:219-227` claim) — fix every one.
11. A MUST_FIX that names a cross-artifact wire (a producer and its consumer) or an
    acceptance-criterion contradiction is a seam: edit and cite both ends under the
    finding's bullet, never the symptom on one side.
