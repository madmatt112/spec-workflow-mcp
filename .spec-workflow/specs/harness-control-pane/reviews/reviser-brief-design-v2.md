# Reviser brief — harness-control-pane design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md` in place from the findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md`.
- Findings: the round-1 analysis named under `## Findings`.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-design.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: harness-control-pane`, `phase: design`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what requirements pinned.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-09-28) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/3/3).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. If the document carries a `Document version:` header, set it to v2. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: the four round-1 RE-DECIDED flags (Req 1 AC 4, Req 3 AC 13, Req 3 AC 14, Req 2 AC 6) were all ruled refinement (closed) by the reviewer; do not re-open them.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding marked `Compounds: R<k>-<n>` lands in text a previous delta wrote: do not reword the clause again. Write one plain sentence of what the clause must claim, delete the old text, and probe the new claim as round 1 would.
11. A MUST_FIX that names a cross-artifact wire (a producer and its consumer) or an acceptance-criterion contradiction is a seam: edit and cite both ends under the finding's bullet, never the symptom on one side.
12. The 63 citation-identifier lint warnings are a known false-positive class (design-introduced identifiers, string-literal values, probe-verified node fields); the orchestrator verified their cited ranges. Do not act on them unless a round-1 finding independently names one.
13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, an unproven rationale clause, a half-fixed cross-artifact seam). Fix any regression your own delta introduced now; it is cheaper here than as next round's finding.

## Findings
All findings are in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design.md` (round 1, verdict iterate MUST_FIX 0 / SHOULD_FIX 3 / MINOR 3). Disposition every SHOULD_FIX and MINOR in it by its id. The three SHOULD_FIX concern: the launch-log lifecycle (re-point/offset/reset) left unspecified; the sdd-providers.sh merge path bypassing the script's early returns and inline checks; and the Testing Strategy omitting the mandatory harness plugin-sync and validate checks. The four RE-DECIDED flags are already ruled refinement (closed) — leave them.
