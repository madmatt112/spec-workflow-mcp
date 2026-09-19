# Drafter brief — harness-usage-and-tiers design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
in place, extend
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`
where you read code the earlier documents did not map, then report in 150 words or
fewer: files touched, the document's word count (`wc -w`), what you loaded, any scope
you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`
   first: it maps the code the requirements cite. Start from it instead of exploring
   from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/tech.md`,
   `structure.md`, and `design-system.md` if they exist. The steering directory is
   currently empty; if so, note it and rely on the codebase and the requirements.
2. The decomposition entry for `harness-usage-and-tiers` in
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`
   (grep for the slug; the entry starts at the `### 8.` heading around line 259). Read
   that entry only (delivers, verification scenario, notes, decided, depends, design
   should address). It fixes the scope. If it points at conventions sections elsewhere
   in the file, read those too.
3. This spec's earlier document:
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md`.
4. The template:
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/design-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe.
   Read before you cite. The requirements HANDOFF names these as the first reads after
   the context file: `src/watch/ledger.ts` (the token/spawn fold the usage report
   reuses and departs from), `src/watch/render.ts` (watch view row widths),
   `src/tools/harness.ts` (the tool surface gaining `usage`/`gate`/`compareSpecName`),
   `harness/hooks/sdd-activity.sh` (spawn events and declared tiers).

## Carried from requirements
- Token source (overwatch ruling 2026-09-19, carried not revised): the orchestrator-side
  per-spawn token count is the `<usage><subagent_tokens>` value of the Agent task
  notification (skill fix f616c72), never a result footer, which does not exist; the
  hook-read transcript remains the deterministic replacement the spec builds. Design must
  cite the notification as the current source.

Address the carried item in this document, or state in `## Scope notes` why it does not
apply to this phase.

## Size
- Cap: 4,000 words. Count with `wc -w` before you report (the body only: the H1 down to
  the line before `## Revision History`).
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it;
  the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a
  constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`
is the map of the code this spec touches. It already exists; append to it if you read
code it does not yet map (never delete a line another phase wrote). Shape:
- First line `# Codebase context — harness-usage-and-tiers`.
- One `## <area>` heading per area.
- Under each, one line per file that matters: `- path:start-end — what it is, one
  clause`. Cite only after reading both ends of the range.
- No prose, no design opinions, no requirements. Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after
  reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the
  reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed
  version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim
  out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in
  a `## Scope notes` section and in your report.
- Do not re-decide what the requirements pinned. Design enumerates every artifact the
  requirements name.
- When you pin an interface whose Testing Strategy needs an extra argument (for example a
  `timeoutMs`), pin that argument as an optional trailing parameter, so the implementer
  does not have to invent a backward-compatible shim.
- When a design departs from a requirement's literal (a widened enum, a defaulted param,
  a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this
  document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A
  human reads that list.
- End the document with `## Revision History` and the line
  `- **v1** (2026-09-19) — Initial draft.`
- MDX rule: no bare angle brackets outside code spans. `` `<name>` `` or "name"; a bare
  `<name>` fails the approval lint.
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and
  every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
