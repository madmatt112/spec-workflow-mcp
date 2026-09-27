# Reviser brief — tdd-task-loop requirements v4 (SHOULD_FIX-only)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v4 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md in place. This is a SHOULD_FIX-only corrective pass: disposition ONLY the SHOULD_FIX finding(s) below; leave the MINOR finding (R3-2) alone. Report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents. Cap: 3,500 words (body: H1 down to the line before ## Revision History; v3 sits at the 3,500 cap — a fix that adds words must remove others). Do not grow the document past the cap. End the v4 Revision History line with exactly the phrase: SHOULD_FIX-only corrective pass. Closed by ruling: none.

## Findings
Disposition ONLY the SHOULD_FIX finding from the round-3 analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-analysis-requirements-r3.md: R3-1 (SHOULD_FIX, Recurring/carried) — the test author's brief carries no channel to the spec dir or the code root, yet R2 AC4/AC10 require both. Read that file for R3-1's full reasoning and the exact acceptance criteria it names; assess on its merits per the disposition rules and verify every citation against the tree under /home/mcf/repo/spec-workflow-mcp. Do NOT address R3-2 (MINOR). Memory file (read only): /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/reviews/adversarial-memory-requirements.md.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at c695917291236b8bdeaf2cfe0c2bce2b47365079, 0 commits behind HEAD.
