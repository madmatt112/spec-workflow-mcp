# Reviser brief — question-gates tasks v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/tasks.md` in place
from the findings below, then report in 150 words or fewer: files touched; each finding as
`<id>: accepted | partially accepted | rejected`; citations verified (count); the
document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/tasks.md` (v1). Cap:
  150 words per task block excluding its prompt. Do not grow the document past it; a fix
  that adds a paragraph removes one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`.
- Design:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md`.
- Findings:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-tasks.md`
  (round 1; findings R1-1 SHOULD_FIX, R1-2 SHOULD_FIX, R1-3/R1-4/R1-5 MINOR).
- Memory:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-tasks.md`
  (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`.
  When it names another place where an accepted finding's defect occurs, fix that place
  under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: question-gates`,
  `phase: tasks`) for the response methodology. Ignore its instructions to present to a
  user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact
   is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v2 in place. Add the Revision History line
   `- **v2** (2026-09-16) — Round-1 adversarial response (adversarial-analysis-tasks.md,
   verdict iterate 0/2/3).` followed by one nested bullet per finding:
   `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or
   why not>`. Set the `Document version:` header to v2.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task
   shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong
   to others. You may replace a context-file line that an accepted finding refutes: same
   line, corrected text, the probe that proves it. Tasks phase: when an accepted finding
   changes a call signature or a behaviour that `design.md` states (R1-1 says design
   Component 5 also lacks AC 7's resume recheck), apply the same text to that design
   component and add to `design.md` a Revision History line
   `- **v3 amended** (2026-09-16) — tasks R1-<n>: <what>`; list it under the finding's
   bullet as `also applied to design.md`. This does not widen scope and needs no
   re-approval — approval records do not hash content.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
   For R1-2, fix every bare-path citation in the v1 Lint-pass Revision-History bullet
   (lines 86–90) — fully-qualify or code-fence each path so spec-lint resolves it — without
   rewriting the historical record's meaning.
10. A finding marked `Compounds: R<A-1>-<n>` lands in text a previous delta wrote: do not
    reword the clause again. Write one plain sentence of what the clause must claim, delete
    the old text, and probe the new claim as round 1 would. A claim you cannot probe is
    deleted, not kept.
