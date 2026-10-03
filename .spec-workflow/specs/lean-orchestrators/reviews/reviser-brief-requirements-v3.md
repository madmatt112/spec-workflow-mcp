# Reviser brief — lean-orchestrators requirements v3 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md in place, addressing ONLY the two SHOULD_FIX findings below (R2-1, R2-2). Do NOT act on the round-2 MINOR findings (R2-3, R2-4, R2-5). Then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents. Cap: 3,500 words — the document is already at cap; a fix that adds a sentence removes one. Read /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md first; it maps the code the document cites. Read the memory file for Guidance for Next Review; do not write it. End the v3 Revision History line exactly: - **v3** (2026-10-02) — SHOULD_FIX-only corrective pass (adversarial-analysis-requirements-r2.md, verdict iterate 0/2/3). followed by one nested bullet per finding: - **<id> — <Accepted | Partially accepted | Rejected> (SHOULD_FIX).** <what changed, or why not>. R2-2 is marked Compounds R1-3 (fix-induced): do not reword the clause again — write one plain sentence of what the idempotency contract must claim, delete the stale text, and ensure both the retro-log append and the HANDOFF rewrite are covered. A claim you cannot probe is deleted, not kept.

## Findings
Address ONLY these two SHOULD_FIX findings from /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-requirements-r2.md:
- R2-1 (SHOULD_FIX): The per-source attribution rule (Req 1.5 / D7) is under-specified — "input W" and `base` sizing are undefined; literal input W is ~0.01% of total W, which breaks criterion 6. Define the term and the base char/token constant.
- R2-2 (SHOULD_FIX, Compounds R1-3, fix-induced): Req 6.7 idempotency does not cover the retro-log append or the HANDOFF rewrite — a re-run double-appends. Extend the re-run contract to those two writes.
Memory file: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-requirements.md.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
