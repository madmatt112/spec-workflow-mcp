# Reviser brief — harness-control-pane design v3 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md` in place from the findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

This is a SHOULD_FIX-only corrective pass: no further adversarial review round follows, only a narrow check that each listed item was addressed. Disposition R2-1 and R2-2 (the two SHOULD_FIX). Also disposition R2-3 (MINOR): fold it in only if it fits within the 4,000-word cap without dropping a SHOULD_FIX fix; otherwise reject it with the exact reason `word cap` so the orchestrator carries it to the next phase.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md` (v2, body 3999 words). Cap: 4,000 words. The document sits at the ceiling: a fix that adds words must remove others. Do not grow the body past 4,000 words.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md`.
- Findings: the round-2 analysis named under `## Findings`.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-design.md` (read; do not write it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`.
- You may call the spec-workflow `adversarial-response` tool (`specName: harness-control-pane`, `phase: design`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX.
3. Do not widen scope, and do not re-decide what requirements pinned.
4. Write v3 in place. Add the Revision History line `- **v3** (2026-09-28) — Round-2 adversarial response (adversarial-analysis-design-r2.md, verdict iterate 0/2/1) — SHOULD_FIX-only corrective pass.` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. If the document carries a `Document version:` header, set it to v3. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: the four round-1 RE-DECIDED flags (Req 1 AC 4, Req 3 AC 13, Req 3 AC 14, Req 2 AC 6), all ruled refinement.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet. R2-2 compounds R1-1 (the log re-point/reset path) — fix both the launch-update trigger condition and any sibling reset path.
11. R2-1 and R2-2 both name a cross-artifact seam (launch admission vs the in-flight mark; the launch-update producer vs the log-watch consumer): edit and cite both ends under the finding's bullet, never the symptom on one side.
13. Before you report, re-scan only the lines you changed for citation-prefix, bare `:<line>`, unproven rationale and half-fixed seam regressions, and fix any your own delta introduced.

## Findings
All findings are in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design-r2.md` (round 2, verdict iterate MUST_FIX 0 / SHOULD_FIX 2 / MINOR 1). Disposition:
- R2-1 (SHOULD_FIX): launch admission is not atomic with the in-flight mark — a double-spawn race between the launchable check and writing the run pointer. Pin the atomic admission step (write-then-check the single-live-run pointer before spawn) and cite both the admission and the mark.
- R2-2 (SHOULD_FIX, compounds R1-1): the log re-point fires on every launch-update message, not only on a new launch, causing a reset storm on an unpruned log. Gate the re-point on a changed launchedAt (new launch) only; cite the producer condition and the consumer reset.
- R2-3 (MINOR): the spawn-to-record crash window (launcher crashes between spawn and writing the record). Fold in a one-line recovery/out-of-scope note only if it fits the cap; otherwise reject with the reason `word cap`.
