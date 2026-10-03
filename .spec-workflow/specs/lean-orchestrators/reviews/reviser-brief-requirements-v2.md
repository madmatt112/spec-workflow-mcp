# Reviser brief — lean-orchestrators requirements v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md in place from the findings below, then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents. Cap: 3,500 words — do not grow the document past it; a fix that adds a paragraph removes one. Read /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md first; it maps the code the document cites. Read the memory file for Guidance for Next Review; do not write it. End the v2 Revision History line: - **v2** (2026-10-02) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/4/3). followed by one nested bullet per finding: - **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>. The 4 SHOULD_FIX and 3 MINOR findings are the round-1 analysis; assess each on its merits.

## Findings
All findings are in /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-requirements.md (round 1, verdict iterate, MUST_FIX 0 / SHOULD_FIX 4 / MINOR 3). Memory file: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-requirements.md.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
