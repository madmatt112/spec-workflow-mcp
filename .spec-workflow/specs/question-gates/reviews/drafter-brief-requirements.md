# Drafter brief — question-gates requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`
in place, write or extend
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`,
then report in 150 words or fewer: files touched, the document's word count (`wc -w`),
what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. Nothing yet; you write the context file (below).
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/product.md` if it
   exists. It is currently absent — the `steering/` directory is empty — so the
   decomposition entry (below) is the scope authority. Do not block on the missing file.
2. The decomposition entry for `question-gates` in
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`:
   grep for the slug `question-gates`, read that entry only (delivers, verification
   scenario, notes, decided, depends, design should address). It fixes the scope. The
   entry (heading `### 7. \`question-gates\``) also references shared conventions
   elsewhere in the file and a note near line 245 about ordering; read the conventions
   sections it points at.
3. This spec's earlier documents: none.
4. The template:
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/requirements-template.md`
   if it exists, else
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/requirements-template.md`
   (the user-template is absent; use the base template).
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe.
   Read before you cite.

## Carried from previous phase
none — requirements is the first phase.

## Size
- Cap: 3,500 words. Count with `wc -w` before you report (the cap counts the body only:
  the H1 down to the line before `## Revision History`).
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it;
  the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a
  constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`
is the map of the code this spec touches, written from the exploration you do anyway.
Create it (it does not exist). Shape:
- First line `# Codebase context — question-gates`.
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
  version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the
  claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in
  a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned (none for requirements).
- When your requirements depart from what the decomposition entry pins (a widened enum,
  a defaulted param, a changed shape), flag it in your report as `RE-DECIDED: <item> —
  <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this
  document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A
  human reads that list.
- End the document with `## Revision History` and the line
  `- **v1** (2026-09-16) — Initial draft.`
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint;
  write `` `<name>` `` or "name".
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and
  every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
