# Reviser brief — lean-orchestrators tasks v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/tasks.md` in place from the findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Findings
## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/tasks.md` (v1). Cap: 150 words per task block excluding its prompt. Do not grow a block past it; a fix that adds a line removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md`.
- Findings: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks.md` (round 1: 4 SHOULD_FIX R1-1..R1-4, 1 MINOR R1-5). Read the full text of each finding there.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-tasks.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: lean-orchestrators`, `phase: tasks`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round. Every citation you insert or change carries its directory-prefixed path (`src/core/typecheck.ts:30`), never a bare filename or a bare `:<line>`.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-10-03) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/4/1).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. Set the `Document version:` header to v2. A Revision-History bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none. (The reviewer closed the Req 7.3 runaway-guard basis as a refinement on its own authority; it is not a finding to fix here.)
6. MDX rule: no bare angle brackets outside code spans. Keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it. Tasks phase only: when an accepted finding changes a call signature that `design.md` states, apply the same text to that design component and add to `design.md` a Revision History line `- **v4 amended** (2026-10-03) — tasks R1-<n>: <what>`; list it under the finding's bullet as `also applied to design.md`. This does not widen scope and needs no re-approval. NOTE: design.md body is at its 4,000-word cap; do not grow it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same grep, rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
12. Gate-B tags (tasks phase). When a finding's title carries a `[gate-b:T<id>]` or `[gate-c:T<id>]` tag, begin that finding's Revision History bullet reasoning with the exact tag: `Accepted` when you removed the task, `Rejected` when you intentionally kept it. (Round 1 raised no gate-b/gate-c tags.)
13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, an unproven rationale clause, a half-fixed cross-artifact seam, a grep that hits forbidden or out-of-scope lines). Fix any regression your own delta introduced now.
14. After any re-anchor or agreed-wording fix, before you hand back, self-verify that every new producer the delta introduced has a named consumer, and every task prompt the delta touched stays internally consistent.
15. Post-trim citation check. After any trim that removes a line to keep a block under its cap, re-verify that every surviving success criterion and Test line keeps its original citation, anchored to the exact phrase it supports.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
