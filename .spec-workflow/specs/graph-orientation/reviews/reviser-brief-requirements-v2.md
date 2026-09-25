# graph-orientation requirements v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` in place from the findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` (v1). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one. It is currently ~2,726 body words, so there is headroom, but stay lean.
- Findings: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-requirements.md` (round-1 analysis, verdict iterate 0/3/3). Disposition every MUST_FIX, SHOULD_FIX and MINOR it lists.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-memory-requirements.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- Code lives under /home/mcf/repo/spec-workflow-mcp. Use absolute paths. Project rules: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md.
- You may call the spec-workflow `adversarial-response` tool (`specName: graph-orientation`, `phase: requirements`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under /home/mcf/repo/spec-workflow-mcp. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the decomposition entry pinned.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-09-25) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. EARS acceptance criteria keep their WHEN/IF/THEN/SHALL shape.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule, acceptance criterion shape, or citation pattern) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding that lands in text the v1 draft wrote: write one plain sentence of what the clause must claim, delete the old text, and probe the new claim. A claim you cannot probe is deleted, not kept.
11. A finding that names a cross-artifact wire (a producer and its consumer) or an acceptance-criterion contradiction (the AC and the requirement it implements) is a seam: edit and cite both ends under the finding's bullet, never the symptom on one side.

## Findings
See the round-1 analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-requirements.md. It carries MUST_FIX 0, SHOULD_FIX 3 (R1-1 worktree-per-change kills R2 AC2 refresh and hands implementation/close-out workers a stale main-checkout graph; R1-2 run.start ordering vs R2 AC1 refresh; R1-3 R6 graph column omits DeepSeek-routed readers) and MINOR 3. Read the full analysis for each finding's exact id, title, severity and detail, and disposition every one.
