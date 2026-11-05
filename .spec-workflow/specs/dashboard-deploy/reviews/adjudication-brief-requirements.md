# Adjudication brief — dashboard-deploy requirements, post-cap corrective pass

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

The review loop reached its cap: v4 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/requirements.md` was reviewed in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-analysis-requirements-r4.md` and still carries MUST_FIX 1 / SHOULD_FIX 0. You are the corrective pass. Fix or rule out each open item, write v5 in place, and stop. Nothing reviews v5 again; a narrow check only verifies that each listed item was addressed. A SHOULD_FIX you rule out is carried into the next phase's drafter brief, so its reason must stand on its own.

## Open items
M-1 (MUST_FIX) — R4-1 (fix-induced, Compounds R3-1 / seam R2-2): R5 AC1 decides the unit-stop on a pre-lock `unitStarted` read; R1 AC4's lock scopes only release-and-remove. Tick-first interleave (cancel reads unitStarted false -> tick acquires lock, persists, spawns, releases -> cancel acquires lock, removes record) leaves the just-spawned unit live and unstopped in its own cgroup, so a 200-cancel runs the full deploy on released runs and the script recreates the removed record. Fix: make cancel's unit-liveness determination + record claim atomic under R1 AC4's lock.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/codebase-context.md`. Read it first.
- Document (v4); the r<A> analysis; the memory file `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-deploy/reviews/adversarial-memory-requirements.md`; <requirements and design as applicable>. Code under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-deploy`.
- Cap: <requirements: 3,500 words | design: 4,000 words | tasks: 150 words per task block excluding its prompt>. Do not grow the document past it.

## Rules
- For each item: fix it in the document, or rule it out with a stated reason. A rule-out is a ruling; it is final for this phase.
- Verify every citation against the real tree, both ends of every range.
- Revision History line: `- **v5** (<today>) — Post-cap corrective pass, adjudicated, not re-reviewed.` followed by one nested bullet per item: `- **<id> — fixed | ruled out (<severity>).** <one line>`. Keep the words `Post-cap corrective pass` exactly; the orchestrator greps for them.
- Edit only the document. Do not ask questions.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- version:
- fixed:
- ruled-out:
- notes:
- flags:
