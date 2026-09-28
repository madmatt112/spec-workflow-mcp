# Drafter brief — harness-control-pane requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md` in place, write or extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md`, then report in 150 words or fewer: files touched, the document's word count (`wc -w`), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/product.md`.
2. The decomposition entry for `harness-control-pane` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. If the entry points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier documents: none.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/requirements-template.md`, else `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/requirements-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe. Read before you cite.

## Carried from previous phase
none

## DRAFTER NOTE — a decision already taken, state it in v1
decomposition.md (commit 7db34aa) says the cross-project Overview page reads `~/.local/state/sdd/overwatch-todos.json`. That file does not exist; the live file is `~/.local/state/sdd/overwatch-hud.json` with shape {meta, operations[], todos[]}. Decision already taken: the Overview page reads the `todos[]` (and may read `operations[]`) of `~/.local/state/sdd/overwatch-hud.json`; there is no `overwatch-todos.json`. State this in v1 (record it under Decisions taken in this document, and use the correct path in every acceptance criterion that references it). Confirm the shape against the real file before you cite it.

## Size
- Cap: 3,500 words. Count the body only (H1 down to the line before `## Revision History`) with `wc -w` before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` is the map of the code this spec touches, written from the exploration you do anyway. GRAPH is a path: build the file from graphify explain and query output for each area the decomposition entry names; open a code file only to confirm the range you cite. A graph node alone is not a citation; every line cites a range you read at both ends. Create it if it does not exist; append to it if it does (never delete a line another phase wrote). Shape: first line `# Codebase context — harness-control-pane`; one `## <area>` heading per area; under each, one line per file that matters: `- path:start-end — what it is, one clause` (cite only after reading both ends of the range); no prose, no design opinions, no requirements, lists only. Every later reviewer, reviser and implementer reads it first.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-28) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- Acceptance criteria in EARS form (WHEN/IF … THE SYSTEM SHALL …), each testable.
- After you write v1, do your gate-A step: extract up to five direction-setting decisions from `## Decisions taken in this document`, rank them most consequential first, and `put` the ranked list through the `harness` tool's `gate` action (`op: put`, `slot: a`, `specName: harness-control-pane`). A `gate put` overwrites the whole file, so put the complete `{ items: [...] }` list.
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at d24c492e8a65a2aef35860a975404cd608f41d37, 0 commits behind HEAD.
