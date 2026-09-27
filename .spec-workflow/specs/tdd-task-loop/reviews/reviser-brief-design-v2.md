# Reviser brief — tdd-task-loop design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/design.md` in place from the round-1 analysis, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count (`wc -w` body only); flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one. (v1 body is ~3,985 words — you are at the cap, so trim as you fix.)
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md`.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-design.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: tdd-task-loop`, `phase: design`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-09-27) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/2/4).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: R3 AC4 (redTests optional key defaulting to empty string) was ruled a refinement by the round-1 reviewer and is closed; do not re-open it.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding marked `Compounds: R<k>-<n>` lands in text a previous delta wrote: do not reword the clause again. Write one plain sentence of what the clause must claim, delete the old text, and probe the new claim as round 1 would.
11. A MUST_FIX that names a cross-artifact wire (a producer and its consumer) or an acceptance-criterion contradiction is a seam: edit and cite both ends under the finding's bullet, never the symptom on one side.
13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, an unproven rationale clause, a half-fixed cross-artifact seam). Fix any regression your own delta introduced now.

## Findings
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-analysis-design.md (round 1, verdict iterate 0/2/4). Disposition every MUST_FIX, SHOULD_FIX and MINOR in it.
