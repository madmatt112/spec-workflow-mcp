# harness-control-pane tasks v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/tasks.md` in place from the round-1 findings, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the number of task blocks; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/tasks.md` (v1). Cap: 150 words per task block excluding its prompt. Do not grow a block past it; a fix that adds a sentence removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md`.
- Findings: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-tasks.md`. The MUST_FIX R1-1: task 19's `_Prompt` cites `sdd-document-phase/references/briefs.md:12-15`, but the supporting content and the task's own `_Leverage` line cite `sdd-implementation-phase/references/briefs.md:12-15`; correct the `_Prompt` citation to the implementation-phase file so both agree.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-tasks.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`.
- You may call the spec-workflow `adversarial-response` tool (`specName: harness-control-pane`, `phase: tasks`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v2 in place. Set the `Document version:` header to v2. Add the Revision History line `- **v2** (2026-09-28) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 1/0/0).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. A Revision-History bullet cites findings by id and prose only; no backticked path or identifier token. Cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes. When an accepted finding changes a call signature that `design.md` states, apply the same text to that design component and add a `design.md` Revision History line, listed under the finding's bullet as `also applied to design.md`.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same citation, rule table, command or fixture shape) and fix each; list them under the finding's bullet.
12. Gate-B tags (tasks phase). When a finding's title carries a `[gate-b:T<id>]` or `[gate-c:T<id>]` tag, begin that finding's Revision History bullet reasoning with the exact tag: `Accepted` when you removed the task, `Rejected` when you intentionally kept it. The orchestrator greps these lines for gate B.
13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation resolved to the wrong file, a citation missing its directory prefix, a bare `:<line>`). Fix any regression your own delta introduced now.

## Findings
See `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-tasks.md` (round-1 analysis). Verdict iterate 1/0/0. The one MUST_FIX is R1-1.
