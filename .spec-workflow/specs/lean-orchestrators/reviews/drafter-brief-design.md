# Drafter brief — lean-orchestrators design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md` in place, extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md`, then report in 150 words or fewer: files touched, the document's word count (`wc -w` of the body, H1 down to the line before `## Revision History`), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md` first: it maps the code the requirements cite. Start from it instead of exploring from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/tech.md`, `structure.md`, and `design-system.md` — the steering directory is currently empty, so skip any that do not exist.
2. The decomposition entry for lean-orchestrators in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. If the entry points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md` (approved v3).
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/design-template.md` (no user-template override exists).
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the design must describe. Read before you cite.

## Carried from requirements
No ruled-out SHOULD_FIX were carried. Three items the requirements phase left for design's judgement (requirements HANDOFF `Next phase loads`), address each in the design or state in `## Scope notes` why it does not apply:
- Narrow-check deferred note — Req 1.5 `base` formula: the requirements do not restate which call the base is scoped to (first call of a spawn vs first overall). Pin the base scope in the design.
- R2-3, R2-4, R2-5 — three round-2 MINORs left unaddressed at requirements convergence, recorded in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-requirements-r2.md`; read them and resolve or dismiss each on its merits for design.

## Size
- Cap: 4,000 words (body only, H1 down to the line before `## Revision History`). Count with `wc -w` before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md` is the map of the code this spec touches. Extend it the same way the requirements drafter built it: from graphify explain and query output for each area the decomposition entry names; open a code file only to confirm the range you cite. A graph node alone is not a citation; every line cites a range you read at both ends. Append to it (never delete a line another phase wrote). Shape: first line `# Codebase context — lean-orchestrators`; one `## <area>` heading per area; under each, one line per file that matters: `- path:start-end — what it is, one clause`. No prose, no design opinions, no requirements. Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out. A sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is such a checkable claim; probe it against the installed version and cite the probe, or state only the behaviour you verified. Never carry an unproven library-capability claim into a later phase.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what requirements pinned. Design enumerates every artifact the requirements name.
- When you pin an interface whose Testing Strategy needs an extra argument (for example a `timeoutMs`), pin that argument as an optional trailing parameter, so the implementer does not have to invent a backward-compatible shim.
- When you pin an interface you do not exercise live — a method on a fork or integration branch — cite that branch's tip and confirm the symbol resolves there, never a historical commit hash that may predate the method.
- Pin the interface and its post-conditions, not a code shape. Label any inline code "illustrative — verify against the test fake," so a shape bug in the sample does not read as binding.
- Data Models completeness: any result or response object a requirement references has its full field shape pinned in Data Models, not only its union arms.
- Error-branch shape: every named error branch pins both its error-type discriminant and its response/exit behaviour, not only its message.
- When a design departs from a requirement's literal (a widened enum, a defaulted param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-10-02) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
