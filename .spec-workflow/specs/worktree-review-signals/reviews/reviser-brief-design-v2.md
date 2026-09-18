# Reviser brief — worktree-review-signals design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` in place from the findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` (v1). Cap: 4,000 words (body is 3,993 — almost no slack; a fix that adds a clause removes one elsewhere).
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md`.
- Findings: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-design.md` (round 1). Disposition R1-1 (SHOULD_FIX) and the one MINOR. The reviewer already ruled D11 and D3 refinements (closed) — do not re-open them.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-design.md` (read `## Guidance for Next Review`; do not write it).
- You may call the spec-workflow `adversarial-response` tool (`specName: worktree-review-signals`, `phase: design`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what requirements pinned.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-09-18) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/1).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. If the document carries a `Document version:` header, set it to v2. A Revision-History bullet cites findings by id and prose only; no backticked path or identifier token. State what the fix did, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: D11 and D3 (ruled refinements in round 1).
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a `codebase-context.md` line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding marked `Compounds: R0-n` does not apply this round (first delta).
11. A MUST_FIX that names a cross-artifact wire (a producer and its consumer) or an acceptance-criterion contradiction is a seam: edit and cite both ends under the finding's bullet, never the symptom on one side.

## Findings
Round 1 analysis: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-design.md

Disposition every finding it raises:
- R1-1 (SHOULD_FIX): the prepare response fails its own round-trip when the MCP server runs without a dashboard (projectContext.dashboardUrl undefined serializes to null under @toon-format/toon 4.1.1); the AC-4 test masks the case. Fix the design so the round-trip holds for the no-dashboard case (and correct the AC-4 test expectation if the design pins it), or reject with a probed reason.
- The one MINOR the analysis lists: address or leave with a one-line reason.
Read the analysis file for the full text, evidence, and any `Deferred` or `## Guidance for Next Review` notes.
