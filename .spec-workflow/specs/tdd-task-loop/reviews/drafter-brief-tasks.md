# Drafter brief — tdd-task-loop tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/tasks.md` in place, extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md`, then report in 150 words or fewer: files touched, the document's task count and the max per-task-block word count (`wc -w` on the largest block excluding its `_Prompt:` line), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md` FIRST: it maps the code the requirements and design cite. Start from it instead of exploring from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/structure.md` (may be absent; if so, note it and move on).
2. The decomposition entry for `tdd-task-loop` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. If it points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier documents: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/requirements.md` and `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/design.md`.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the tasks must touch. Read before you cite. Use the code graph (below) to orient first.

## Carried from design
R2-1 (MINOR, from design round 2, open) — gate path-form mismatch: the gate matches `testFiles` to the parsed task's `tests[]` without pinning the path form, so a mismatch fails open with no `seams`. Weigh whether a task should normalise the path form on both sides (the gate wiring and the `- Test:` parse).
Address this carried item in a task, or state in `## Scope notes` why it does not apply to this phase.

## Size
- Cap: 150 words per task block, excluding its `_Prompt:` line. Count with `wc -w` before you report.
- Any preamble is three sentences: state the dependency order there.
- Do not describe the codebase inside the document. Cite a `path:line` when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/tdd-task-loop/codebase-context.md` is the map of the code this spec touches. Extend the file (never delete a line another phase wrote) from graphify explain and query output for each area the tasks touch; open a code file only to confirm the range you cite. A graph node alone is not a citation; every line cites a range you read at both ends. Shape: first line `# Codebase context — tdd-task-loop`; one `## <area>` heading per area; under each, one line per file `- path:start-end — what it is, one clause`. No prose, no design opinions. Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what design pinned. Tasks cover every design component; every design component maps to at least one task.
- Record every call you make on the product's behalf under a `## Decisions taken in this document` section as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-27) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- Follow `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md` EXACTLY. Each task is `- [ ] N. Title` (sub-tasks `N.M`), with `- File:` lines, a `- Purpose:` line, `_Leverage: …_`, `_Requirements: …_`, and a `_Prompt: Task: … | Restrictions: … | Success: …_` line that ends with `_`. Every task numbered so the parser counts it. Order tasks so each step leaves the tree compiling and every existing suite green. State the dependency order in a short preamble. A prompt must not pin a call signature, UI label or helper name that a DIFFERENT task in this document creates; write "the hook task 7 exports" and let the implementer read the merged code. For every existing test file a task names, say whether the change alters a value it asserts exactly. When a prompt enumerates assertion sites to update (line anchors like `:127`), label the list an illustrative minimum ("at least these") and tell the implementer to widen it to every assertion the change touches; never let a reader treat one as exhaustive and under-test. When a task uses an artefact a later task creates (a route, an export), the prompt names the bridge (a cast, a stub) and the later task's prompt says to remove it. When a task tells the implementer to stage a scratch store with its own event script, give that script an explicit path under the scratch store (`<scratch-store>/event.sh`) and state it must not reuse the supervisor's `EVENT_SCRIPT` path. When a task authors a `set -u` shell script, its prompt says to read every optional environment variable as `${VAR:-}`, never bare `$VAR`. Only the supervisor writes the run ledger — a spawned worker calls `EVENT_SCRIPT` only to append rows. Start the tasks document with a `Document version: v1` line right after the H1.
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at c695917291236b8bdeaf2cfe0c2bce2b47365079, 0 commits behind HEAD.
A `file:line` from the graph is a hint to confirm, not a citation.
