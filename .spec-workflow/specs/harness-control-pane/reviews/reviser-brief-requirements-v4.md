# harness-control-pane requirements v4 — SHOULD_FIX-only corrective pass

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v4 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md in place, addressing ONLY the six SHOULD_FIX items R3-1 through R3-6 from the round-3 analysis (ignore the three MINORs). This is a SHOULD_FIX-only corrective pass: end the v4 Revision History line with the exact words 'SHOULD_FIX-only corrective pass' and give one nested bullet per R3-n item (accepted | partially accepted | rejected, each with a reason). The body is at the 3,500-word cap exactly; add the new failure-path/concurrency requirements concisely and trim lower-value prose elsewhere so the body stays at or under 3,500 words (verify with wc -w on the H1-to-before-Revision-History body). Keep every citation on the exact range whose text the claim quotes. Report in 150 words or fewer: files touched; each R3-n as accepted|partially accepted|rejected; citations verified (count); the body word count; flags. No file contents.

## Findings
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r3.md

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at d24c492e8a65a2aef35860a975404cd608f41d37, 0 commits behind HEAD.
