# graph-orientation requirements v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` in place from the findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` (v2). Cap: 3,500 words (currently ~3,014 body words — there is headroom, but stay lean; a fix that adds a paragraph removes one).
- Findings: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-requirements-r2.md` (round-2 analysis, verdict iterate 2/1/0). Disposition R2-1, R2-2, R2-3.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-memory-requirements.md` (read; do not write it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`.
- Code lives under /home/mcf/repo/spec-workflow-mcp. Use absolute paths. Project rules: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md.
- You may call the spec-workflow `adversarial-response` tool (`specName: graph-orientation`, `phase: requirements`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under /home/mcf/repo/spec-workflow-mcp. Read both ends of a line range. Cite the exact line, with filename (never a bare `:<line>`). A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the decomposition entry pinned.
4. Write v3 in place. Add the Revision History line `- **v3** (2026-09-25) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/1/0).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. A Revision-History bullet cites findings by id and prose only; no backticked path or identifier token. State what the fix did and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. EARS acceptance criteria keep their WHEN/IF/THEN/SHALL shape.
7. Edit only the document. Approvals, HANDOFF, memory file belong to others. You may replace a context-file line an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet.
10. BOTH MUST_FIX (R2-1, R2-2) are marked `Compounds` — they land in text the v2 delta wrote. Do not reword the clause again. Write one plain sentence of what the clause must claim, delete the old text, and probe the new claim as round 1 would. R2-1: the reviewer says graphify's `_check_shrink` accounts for deleted paths (watch.py:1374, 842-907) so a code-deletion commit refreshes without --force at exit 0 — the real wedge is partial extraction; verify this against the installed graphify before rewriting the Reliability line. R2-2: R6 AC8 cites the wrong line for the @deepseek keying (reviewer says it is at usage.ts:159, not :366/:399) and falsely claims spawns and graph share scope (deepseek roles show spawns>0 but graph=0); read usage.ts and the join in harness.ts, fix the line citation and the scope claim, cite both ends. A claim you cannot probe is deleted, not kept.
11. A MUST_FIX that names a cross-artifact wire or an acceptance-criterion contradiction is a seam: edit and cite both ends under the finding's bullet.
12. R2-3 (SHOULD_FIX, Compounds R1-1): the scenario-4 non-worktree fixture is unspecified under worktree-per-change and the R7 AC3 deferral does not fit; make R7 AC4's scenario-4 fixture self-consistent with the worktree caveats (D12/D14) or state its constraint explicitly.

## Findings
See the round-2 analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-requirements-r2.md. MUST_FIX 2 (R2-1 Compounds R1-5: Reliability shrink-guard line false, real wedge is partial extraction; R2-2 Compounds R1-3: R6 AC8 wrong line citation + false shared-scope claim for deepseek), SHOULD_FIX 1 (R2-3 Compounds R1-1: scenario-4 non-worktree fixture unspecified). Read the full analysis for each finding's exact detail and disposition every one.
