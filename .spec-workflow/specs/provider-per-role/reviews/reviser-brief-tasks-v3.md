# provider-per-role tasks v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md in place from the round-2 findings, then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md. Read it first; it maps the code the document cites.
- Document: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md (v2). Cap: 150 words per task block excluding its prompt. Do not grow the document past the cap; a fix that adds a paragraph removes one.
- Requirements: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md.
- Design: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md.
- Memory: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-tasks.md (read; do not write it). Read ## Guidance for Next Review; when it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as 'also applied to <where>'.
- Code under /home/mcf/repo/spec-workflow-mcp. Read both ends of every line range you cite.
- You may call the spec-workflow adversarial-response tool (specName: provider-per-role, phase: tasks) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

Gate-B tags (disposition rule 12): if a round-2 finding's title carries [gate-b:T<id>] or [gate-c:T<id>], begin that finding's Revision History bullet reasoning with the exact tag on the same line as its Accepted/Rejected disposition. Verdict for the Revision History line (rule 4): iterate 1/1/1.

## Findings
The findings are in /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-tasks-r2.md. Round 2 (v2) verdict iterate, MUST_FIX 1 / SHOULD_FIX 1 / MINOR 1:
- R2-1 (MUST_FIX, fix-induced, Compounds R1-2): task 10's implementer is barred from the deferrals tool by its standing rules, so the R1-2 fix that told task 10 to file its own deferral records has no permitted writer. Fix per rule 10/11: state what the mechanism must do and give it a permitted executor (for example task 10 reports AFFECTS-FUTURE-SPECS / the deferral is filed by the orchestrator or step-8 verifier who holds the tool), not the barred implementer. Fix both ends of the seam (the task 10 prompt and the D5 decision bullet).
- R2-2 (SHOULD_FIX, Compounds R1-1): the R1-1 safety record tells the implementer to use RETRO: escalation, but escalation is not a category the implementer brief lists (bug is). Use a category the brief authorises, or state where escalation is authorised.
- R2-3 (MINOR, Compounds R1-2): the new Scope note overstates what the step-8 completion-gate verifier reads; narrow the citation to what it actually reads.
Closed by ruling, leave as is: none.
