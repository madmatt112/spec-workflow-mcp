# harness-control-pane requirements v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md in place from the round-1 findings, then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents.

## Findings
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements.md

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at d24c492e8a65a2aef35860a975404cd608f41d37, 0 commits behind HEAD.
