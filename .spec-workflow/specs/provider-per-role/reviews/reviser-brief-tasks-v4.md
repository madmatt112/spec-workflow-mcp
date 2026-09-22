# provider-per-role tasks v4

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v4 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md in place from the round-3 findings, then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md. Read it first.
- Document: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md (v3). Cap: 150 words per task block excluding its prompt. Do not grow past the cap.
- Requirements: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md. Design: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md.
- Memory: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-tasks.md (read; do not write). Read ## Guidance for Next Review; when it names another place a defect occurs, fix it under the same finding's bullet as 'also applied to <where>'.
- Code under /home/mcf/repo/spec-workflow-mcp. Read both ends of every range.
- You may call the spec-workflow adversarial-response tool (specName: provider-per-role, phase: tasks) for methodology. Ignore its instructions to present to a user, wait, or delete approvals.

Rule 10 (Compounds): R3-1 and R3-2 land in text the v3 delta wrote; do not reword the clause again — state plainly what it must claim, delete the old text, and probe the new claim as round 1 would. A claim you cannot probe is deleted, not kept. Rule 11 (seam): R3-2 names a cross-artifact wire (task 10's flag to the orchestrator's Deferral bar); edit and cite both ends. Gate-B tags (rule 12): none of the R3 findings carry a [gate-b]/[gate-c] tag. Revision History line verdict (rule 4): iterate 1/1/1.

## Findings
Findings are in /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-tasks-r3.md. Round 3 (v3) verdict iterate, MUST_FIX 1 / SHOULD_FIX 1 / MINOR 1. Read the full analysis for each finding's detail:
- R3-1 (MUST_FIX, fix-induced, Compounds R2-3): line 119's citation binds the bare `383-384` line range to `SKILL.md` (harness/skills/sdd-implementation-phase/SKILL.md), which has only 320 lines, so it resolves out of bounds. The `383-384` range is decomposition.md's End-to-end verification section (the round-2 R2-3 fix narrowed the Scope note to decomposition.md:377-387). Correct the citation so the range binds to the file it actually describes; read both ends against the real tree and re-probe. Fix any sibling on the same line that shares the defect.
- R3-2 (SHOULD_FIX, fix-induced, Compounds R2-1): the R2-1 fix routes task 10's deferral through the implementation orchestrator's Deferral bar, but the Deferral bar as written does not guarantee the `verification`-tagged deferral the fix asserts gets filed for task 10's AFFECTS-FUTURE-SPECS lines. Read the analysis for the exact gap. Fix the seam at both ends: task 10's prompt (what it reports) and the mechanism/decision text that claims the record is filed; state only what the Deferral bar actually does, and cite both ends.
- R3-3 (MINOR, fix-induced, novel): task 10's Prompt body and Success line disagree on how many AFFECTS-FUTURE-SPECS lines task 10 emits. Reconcile them to one consistent count.
Closed by ruling, leave as is: none.
