# Drafter brief — worktree-review-signals tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/tasks.md` in place, extend
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` if you learn new code facts,
then report in 150 words or fewer: files touched, the document's word count (`wc -w`),
what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` first: it maps the
   code the earlier documents cite. Start from it instead of exploring from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/structure.md` if it exists (the steering directory is
   currently empty; skip if absent).
2. The decomposition entry for `worktree-review-signals` in
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read entry 2 only
   (delivers, carries R5/R7/R8/R9, depends, end-to-end verification, notes). It fixes the scope. If the entry points at
   conventions sections elsewhere in the file, read those too.
3. This spec's earlier documents: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md`
   and `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md`.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that each task must describe. Read before you cite.

## Carried from design
none

## Size
- Cap: 150 words per task block, excluding its `_Prompt:` line. Count with `wc -w` before you report.
- Introduction/preamble: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` is the map of the code this
spec touches, written by the earlier phases. Append to it if you learn a new code fact (never delete a line another phase wrote).
Shape:
- First line `# Codebase context — worktree-review-signals`.
- One `## <area>` heading per area (a route, a package, a table, a component tree).
- Under each, one line per file that matters: `- path:start-end — what it is, one clause`. Cite only after reading both ends of the range.
- No prose, no design opinions, no requirements. Lists only.
Every later reviewer, reviser and implementer reads it first.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned. Tasks cover every design component.
- When a design departs from a requirement's literal (a widened enum, a defaulted param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-18) — Initial draft.`
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- tasks.md only: follow `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md` exactly. Each task is
  `- [ ] N. Title` (sub-tasks `N.M`), with `- File:` lines, a `- Purpose:` line, `_Leverage: …_`, `_Requirements: …_`, and a
  `_Prompt: Task: … | Restrictions: … | Success: …_` line that ends with `_`. Every task numbered, so the parser counts it.
  Order tasks so each step leaves the tree compiling and every existing suite green. State the dependency order in a short
  preamble. A prompt must not pin a call signature, UI label or helper name that a different task in this document creates;
  write "the hook task 7 exports" and let the implementer read the merged code. For every existing test file a task names, say
  whether the change alters a value it asserts exactly. When a task uses an artefact a later task creates (a route, an export),
  the prompt names the bridge (a cast, a stub) and the later task's prompt says to remove it. Start the tasks document with a
  `Document version: v1` line right after the H1.
- Every `_Requirements:` id must exist in `requirements.md`; every design component must appear in some task (the lint checks coverage).
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
