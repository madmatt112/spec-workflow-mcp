# Drafter brief — provider-per-role design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md` in place, write or extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`, then report in 150 words or fewer: files touched, the document's word count (`wc -w`), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md` first: it maps the code the requirements cite. Start from it instead of exploring from cold. Extend it as you read more code.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/tech.md`, `structure.md`, and `design-system.md` if they exist. (Probe: the steering directory is currently empty — skip any that are absent.)
2. The decomposition entry for provider-per-role in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. Read especially the endpoint routing facts at `.spec-workflow/spec-decomposition/decomposition.md:255-258`. If the entry points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md` (approved at v5).
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/design-template.md`, else `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/design-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe. Read before you cite. The requirements HANDOFF names these to load first (after `codebase-context.md`): `.spec-workflow/agent-rules.md` (the new `## Providers` section), `harness/hooks/sdd-activity.sh` (the `provider` ledger field), the `claude -p` launcher surface the orchestrator calls instead of the Agent tool (Req 2/3), `harness/agent-profiles.json`, and the provider-split totals in the `harness usage` report and watch view (`src/watch/`).

## Carried from requirements
Nothing was ruled out in the requirements phase. Two notes for you:
(1) Narrow-check deferred finding — Req 6 criterion 5's auth-path clause is grammatically garbled; the intended rule is "a 'no' answer fails preflight (a)". Smooth it if the design quotes the criterion.
(2) MINOR, out of scope in requirements — Req 2 criterion 5 cites CLI version 2.1.278; the installed version is 2.1.280. Cite the installed version if the design refers to it.
Address each note in this document, or state in `## Scope notes` why it does not apply to the design phase.

## Size
- Cap: 4,000 words. Count with `wc -w` (body only: the H1 down to the line before `## Revision History`) before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md` is the map of the code this spec touches. It already exists (the requirements phase wrote it); append to it, never delete a line another phase wrote. Shape:
- First line `# Codebase context — provider-per-role`.
- One `## <area>` heading per area (a route, a package, a table, a component tree).
- Under each, one line per file that matters: `- path:start-end — what it is, one clause`. Cite only after reading both ends of the range.
- No prose, no design opinions, no requirements. Lists only.
Every later reviewer, reviser and implementer reads it first.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what the requirements pinned. Design enumerates every artifact the requirements name.
- When you pin an interface whose Testing Strategy needs an extra argument (for example a `timeoutMs`), pin that argument as an optional trailing parameter, so the implementer does not have to invent a backward-compatible shim.
- When a design departs from a requirement's literal (a widened enum, a defaulted param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-22) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
