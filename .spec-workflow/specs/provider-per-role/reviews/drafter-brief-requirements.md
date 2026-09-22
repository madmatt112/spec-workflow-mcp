# Drafter brief — provider-per-role requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md` in place, write `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`, then report in 150 words or fewer: files touched, the document's word count (`wc -w`), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. Requirements: nothing yet; you write the context file (below).
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/product.md`.
2. The decomposition entry for `provider-per-role` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. If the entry points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier documents: none.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/requirements-template.md`, else `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/requirements-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe. Read before you cite. (graphify-out/graph.json exists: prefer `graphify query`/`graphify explain` to orient before reading source files.)

## Carried from previous phase
none (requirements has no carried items).

## Gate-A step (requirements v1 only)
After you write v1, extract up to five direction-setting product decisions from your `## Decisions taken in this document` section, rank them most-consequential first, and `put` them to the gate-A surface through the `harness` tool's `gate` action (`op: put`, `slot: a`, `specName: provider-per-role`, `payload = { items: [{ decision, options, rationale }, ...] }`). A `gate put` overwrites the whole file; put the complete list.

## Size
- Cap: 3,500 words (body only: the H1 down to the line before `## Revision History`). Count with `wc -w` before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md` is the map of the code this spec touches, written from the exploration you do anyway. Create it if it does not exist; append if it does (never delete a line another phase wrote). Shape:
- First line `# Codebase context — provider-per-role`.
- One `## <area>` heading per area (a route, a package, a table, a component tree).
- Under each, one line per file that matters: `- path:start-end — what it is, one clause`. Cite only after reading both ends of the range.
- No prose, no design opinions, no requirements. Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-21) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name". Acceptance criteria must be EARS-form (WHEN/IF/THE/SHALL).
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
