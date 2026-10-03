# Reviser brief — lean-orchestrators tasks v3 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
This is the SHOULD_FIX-only corrective pass. Produce v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/tasks.md` in place, addressing the round-2 SHOULD_FIX item (and the two MINORs while you are in the document). Nothing reviews v3 again; a narrow check only verifies that each listed item was addressed. Report in 150 words or fewer: files touched; each item as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Findings
## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/tasks.md` (v2). Cap: 150 words per task block excluding its prompt. Do not grow a block past it; a fix that adds a line removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md`.
- Design: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md`.
- Findings: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks-r2.md`. Read the full text of R2-1, R2-2 and R2-3 there.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-tasks.md` (read; do not write it). Read `## Guidance for Next Review`.
- You may call the spec-workflow `adversarial-response` tool (`specName: lean-orchestrators`, `phase: tasks`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Items to address
- R2-1 (SHOULD_FIX, Compounds R1-1): task 13 names only the Reconcile/e2e brief re-point as the consumer of the server-side brief kinds, leaving the kept per-task-loop calls (the implementer kind's redTests to authorFiles/authorReport, the verifier call, the fix rounds, the task adjudication) and the Repair calls unaddressed, even though tasks 8 and 9 replace those templates and task 13 deletes `references/briefs.md`. Make task 13 (and/or the right task) name every consumer of the new brief kinds so no kept call still points at the deleted `references/briefs.md` and no new brief kind is left unconsumed. Verify against the real implementation-phase SKILL.md and briefs.md which calls remain.
- R2-2 (MINOR): task 11's docs/SDD-HARNESS.md file-list entry is left dangling (the grep no longer touches it). Reconcile the File list with what task 11 actually edits.
- R2-3 (MINOR): task 12 over-cites task 9. Trim the citation to what task 12 actually depends on.

## Disposition rules
1. Assess every item on its merits: accept, partially accept, or reject, each with one line of reasoning. A rule-out is final for this phase. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. Every citation carries its directory-prefixed path, never a bare filename or a bare `:<line>`.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v3 in place. Add the Revision History line `- **v3** (2026-10-03) — Round-2 adversarial response (adversarial-analysis-tasks-r2.md, verdict iterate 0/1/2), SHOULD_FIX-only corrective pass.` — keep the words `SHOULD_FIX-only corrective pass` exactly; the orchestrator greps for them. Follow it with one nested bullet per item: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. Set the `Document version:` header to v3. A Revision-History bullet cites findings by id and prose only; no backticked path or identifier token.
5. Closed by ruling, leave as is: Req 7.3 runaway-guard basis (ruled a refinement in round 1).
6. MDX rule: no bare angle brackets outside code spans. Keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it. If an accepted item changes a call signature that `design.md` states, apply the same text to that design component and add a `- **v4 amended** (2026-10-03) — tasks R2-<n>: <what>` Revision History line to design.md; list it under the item's bullet as `also applied to design.md`. NOTE: design.md body is at its 4,000-word cap; do not grow it. (R2-1 is a tasks-document coverage gap, not a signature change, so a design amendment is unlikely to be needed.)
8. Do not ask questions.
9. After you accept an item, search the document for every other place with the same construct and fix each; list them under the item's bullet.
13. Before you report, re-scan only the lines you changed for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, a half-fixed cross-artifact seam, a kept call still pointing at the deleted briefs.md). Fix any regression now.
14. After the R2-1 fix, self-verify that every brief kind tasks 8, 9 and 10 add has a named consumer and every kept per-task-loop call points at a surviving source after task 13 deletes `references/briefs.md`.
15. Post-trim citation check. After any trim to keep a block under its cap, re-verify every surviving success criterion and Test line keeps its original citation anchored to the exact phrase it supports.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
