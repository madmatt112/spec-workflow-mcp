# Reviser brief — dashboard-shell requirements v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of `.spec-workflow/specs/dashboard-shell/requirements.md` in place from the findings below.

## Inputs
- Context file: `.spec-workflow/specs/dashboard-shell/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `.spec-workflow/specs/dashboard-shell/requirements.md` (v2). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: `reviews/adversarial-analysis-requirements.md`.
- Memory: `reviews/adversarial-memory-requirements.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: dashboard-shell`, `phase: requirements`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v3 in place. Add the Revision History line `- **v3** (<today>) — SHOULD_FIX-only corrective pass.` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. If the document carries a `Document version:` header, set it to v3. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it. Tasks phase only: when an accepted finding changes a call signature that `design.md` states, apply the same text to that design component and add to `design.md` a Revision History line `- **v<D> amended** (<date>) — tasks R<A>-<n>: <what>` (v<D> is design.md's current version); list it under the finding's bullet as `also applied to design.md`. This does not widen scope and needs no re-approval — approval records do not hash content.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding marked `Compounds: R<A-1>-<n>` lands in text a previous delta wrote: do not reword the clause again. Write one plain sentence of what the clause must claim, delete the old text, and probe the new claim as round 1 would. A claim you cannot probe is deleted, not kept.
11. A MUST_FIX that names a cross-artifact wire (a producer and its consumer) or an acceptance-criterion contradiction (the AC and the component that implements it) is a seam: edit and cite both ends under the finding's bullet, never the symptom on one side. A finding marked `Compounds: R<k>-<n>` re-flags a seam an earlier round left half-fixed; fix both ends now.
12. Gate-B tags (tasks phase). When a finding's title carries a `[gate-b:T<id>]` (new external dependency) or `[gate-c:T<id>]` (work beyond the approved requirements) tag, begin that finding's Revision History bullet reasoning (rule 4) with the exact tag, so it sits on the same line as the bullet's `Accepted`/`Rejected` disposition: `Accepted` when you removed the task, `Rejected` when you intentionally kept it — say why either way. The orchestrator greps these lines for gate B; a tag left off its Revision History line drops that task from the veto list.
13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, an unproven rationale clause, a half-fixed cross-artifact seam). Fix any regression your own delta introduced now; it is cheaper here than as next round's finding (retro P7).
14. After any re-anchor or agreed-wording fix, before you hand back, self-verify that every new producer the delta introduced has a named consumer, and every acceptance criterion the delta touched stays consistent with the rest of the document. Record this as part of the fix-induced re-check (retro P7).
15. Post-trim citation check. After any trim that removes a line to keep the document under its cap, re-verify that every surviving accepted acceptance criterion still carries its original citation, anchored to the exact phrase it supports. Never relocate a citation onto an unrelated note to save a line. A trim that drops an accepted AC's citation, or moves one off the phrase it cited, is a MUST_FIX next round (retro P1).

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- version:
- words:
- accepted:
- partial:
- rejected:
- cut-scope:
- flags:

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at f004fae4fb9092354e673510044e90b169ed99c4, 1 commits behind HEAD.
A `file:line` from the graph is a hint to confirm, not a citation.
