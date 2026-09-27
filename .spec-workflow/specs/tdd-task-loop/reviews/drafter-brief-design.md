# Drafter brief — tdd-task-loop design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/design.md` in place, extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md`, then report in 150 words or fewer: files touched, the document's word count (`wc -w`, body only — H1 down to the line before `## Revision History`), what you loaded, any scope you cut, and flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md` first: it maps the code the requirements cite. Start from it instead of exploring from cold.
1. Steering: the design-phase steering docs are `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/tech.md`, `structure.md`, and `design-system.md`. The steering directory is currently empty — none exist. Skip this step; do not invent steering.
2. The decomposition entry for tdd-task-loop in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. If the entry points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md`.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/design-template.md` (no user-template override exists).
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe. Read before you cite. Ground surfaces named by the requirements HANDOFF: `src/core/gate-rules.ts` (`isTestPath`, red-on-base proof), `src/core/task-parser.ts` (`- Test:` parse, `implementationDetails` fallthrough, `tests[]`/`seams`), `src/tools/review-gate.ts`, `src/core/check-runner.ts` (captured stdout/stderr classification), `src/tools/harness.ts` (brief templates, `SERVER_BRIEF_KEYS`, empty-string required check), and `src/dashboard/.../TasksPage.tsx:1364-1406` (R6 always-shown task row). Use the code graph (below) to orient before opening each file.

## Carried from requirements
R3-2 — parsed-task `seams` datatype: requirements left the `seams` field on the parsed task's `tests[]` as an open MINOR; weigh it when design pins the parsed-task shape. Address it, or state in `## Scope notes` why it does not apply to this phase.
narrow-check note — an undocumented overview-text trim in the requirements v4 diff (decorative prose removed to stay under cap); no design action, note only.

## Size
- Cap: 4,000 words. Count with `wc -w` (body only) before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md` is the map of the code this spec touches. It already exists (the requirements phase wrote it); extend it the same way for any new area you cite — build new lines from graphify explain/query output, and open a code file only to confirm the range you cite. A graph node alone is not a citation; every line cites a range you read at both ends. Never delete a line another phase wrote. Shape: first line `# Codebase context — tdd-task-loop`; one `## <area>` heading per area; under each, one line per file that matters: `- path:start-end — what it is, one clause`. No prose, no design opinions, no requirements. Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out. A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is such a checkable claim; probe it against the installed version and cite the probe, or state only the behaviour you verified. Never carry an unproven library-capability claim into a later phase.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what the requirements pinned. Design enumerates every artifact the requirements name.
- When you pin an interface whose Testing Strategy needs an extra argument (for example a `timeoutMs`), pin that argument as an optional trailing parameter, so the implementer does not have to invent a backward-compatible shim.
- Data Models completeness: any result or response object a requirement references has its full field shape pinned in Data Models, not only its union arms.
- When a design departs from a requirement's literal (a widened enum, a defaulted param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-27) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write it in backticks or as "name".
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at c695917291236b8bdeaf2cfe0c2bce2b47365079, 0 commits behind HEAD.
