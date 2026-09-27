# Reviser brief — tdd-task-loop requirements v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md in place from the round-2 findings, then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents. Cap: 3,500 words (body: H1 down to the line before ## Revision History; v2 sits at 3,497 — a fix that adds words removes others). Do not grow the document past the cap. End the v3 Revision History line: Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/2). Both round-2 findings are fix-induced (R2-1 Compounds R1-6, R2-2 Compounds R1-3): follow disposition rule 10 — write one plain sentence of what each clause must claim, delete the old text, and probe the new claim; a claim you cannot probe is deleted, not reworded. Closed by ruling: none.

## Findings
Disposition every finding in the round-2 analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-analysis-requirements-r2.md (verdict iterate: 1 MUST_FIX, 1 SHOULD_FIX, 2 MINOR). Read that file for each finding's id, severity, Compounds label, and reasoning; assess each on its merits per the disposition rules. Memory file (read only): /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-requirements.md.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at c695917291236b8bdeaf2cfe0c2bce2b47365079, 0 commits behind HEAD.
