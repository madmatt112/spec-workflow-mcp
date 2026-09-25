# Drafter brief — graph-orientation tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/tasks.md` in place, write or extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md`, then report in 150 words or fewer: files touched, the document's word count (`wc -w`), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md` FIRST: it maps the code the requirements and design cite. Start from it instead of exploring from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/structure.md`.
2. The decomposition entry for graph-orientation in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. If the entry points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier documents: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` and `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/design.md`. Tasks must cover every design component (C1-C7).
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/tasks-template.md`, else `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the tasks must describe. Read before you cite.

## Carried from design
none.

## Size
- Cap: 150 words per task block, excluding its `_Prompt:` line. Count with `wc -w` before you report.
- Introduction/overview/alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md` is the map of the code this spec touches. Append to it if it does not fully cover a file a task cites (never delete a line another phase wrote). Shape: first line `# Codebase context — graph-orientation`; one `## <area>` heading per area; under each, one line per file `- path:start-end — what it is, one clause` (cite only after reading both ends). Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under the code root and cite the probe, or leave the claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned. Tasks cover every design component; do not add components the design did not name.
- When tasks depart from a design/requirement literal, flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make under `## Decisions taken in this document` as `D<n> — <decision>: <options>; chosen because <one line>`.
- End the document with `## Revision History` and the line `- **v1** (2026-09-25) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only; never a backticked path, line range or code identifier there.
- MDX rule: no bare angle brackets outside code spans. Write `` `<name>` `` or "name".
- tasks.md: follow `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md` exactly. Each task is `- [ ] N. Title` (sub-tasks `N.M`), with `- File:` lines, a `- Purpose:` line, `_Leverage: …_`, `_Requirements: …_`, and a `_Prompt: Task: … | Restrictions: … | Success: …_` line ending with `_`. Every task numbered. Order tasks so each step leaves the tree compiling and every existing suite green; state the dependency order in a short preamble. A prompt must not pin a call signature, UI label or helper name that a different task in this document creates; write "the hook task 7 exports" and let the implementer read the merged code. For every existing test file a task names, say whether the change alters a value it asserts exactly. When a prompt enumerates assertion sites (line anchors), label the list an illustrative minimum ("at least these") and tell the implementer to widen it to every assertion the change touches. When a task uses an artefact a later task creates, the prompt names the bridge (a cast, a stub) and the later task's prompt says to remove it. When a task tells the implementer to stage a scratch store with its own event script, give that script an explicit path under the scratch store (`<scratch-store>/event.sh`) and state it must not reuse the supervisor's `EVENT_SCRIPT`. When a task authors a `set -u` shell script, its prompt says to read every optional env var as `${VAR:-}`, never bare `$VAR`. Only the supervisor writes the run ledger — event.sh, its .runid and harness-events.jsonl; a spawned worker calls EVENT_SCRIPT only to append rows. Start the tasks document with a `Document version: v1` line right after the H1.
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
