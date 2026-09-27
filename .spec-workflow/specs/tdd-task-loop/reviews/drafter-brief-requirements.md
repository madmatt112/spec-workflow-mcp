# tdd-task-loop requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md`
in place, write `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md`,
then report in 150 words or fewer: files touched, the document's word count (`wc -w`),
what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. Nothing yet; you write the context file (below).
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/product.md`.
2. The decomposition entry for `tdd-task-loop` in
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`:
   grep for the slug, read that entry only (delivers, verification scenario, notes,
   decided, depends, design should address). It fixes the scope. If the entry points at
   conventions sections elsewhere in the file, read those too.
3. This spec's earlier documents: none.
4. The template:
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/requirements-template.md`,
   else `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/requirements-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe.
   Read before you cite.

## Carried from previous phase
none

## Size
- Cap: 3,500 words. Count with `wc -w` before you report (the cap counts the body only:
  the H1 down to the line before `## Revision History`).
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it;
  the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a
  constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md`
is the map of the code this spec touches, written from the exploration you do anyway.
Build the file from graphify explain and query output for each area the decomposition
entry names; open a code file only to confirm the range you cite. A graph node alone is
not a citation; every line cites a range you read at both ends. Create it if it does not
exist. Shape:
- First line `# Codebase context — tdd-task-loop`.
- One `## <area>` heading per area (a route, a package, a table, a component tree).
- Under each, one line per file that matters: `- path:start-end — what it is, one
  clause`. Cite only after reading both ends of the range.
- No prose, no design opinions, no requirements. Lists only.
Every later reviewer, reviser and implementer reads it first.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after
  reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the
  reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed
  version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim
  out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in
  a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned (there is none; this is the first phase).
- When requirements depart from what the decomposition entry pins (a widened scope, a
  changed shape), flag it in your report as `RE-DECIDED: <item> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this
  document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A
  human reads that list.
- Write acceptance criteria in EARS form (WHEN/IF … THE SYSTEM SHALL …).
- End the document with `## Revision History` and the line
  `- **v1** (2026-09-27) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only.
  Never write a backticked path, line range or code identifier there; the citation lint
  does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint;
  write `` `<name>` `` or "name".
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and
  every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at c695917291236b8bdeaf2cfe0c2bce2b47365079, 0 commits behind HEAD.
