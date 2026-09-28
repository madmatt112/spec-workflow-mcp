# harness-control-pane tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/tasks.md` in place, extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` if it needs new lines, then report in 150 words or fewer: files touched, the number of task blocks, what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` first: it maps the code the earlier documents cite. Start from it instead of exploring from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/structure.md`.
2. The decomposition entry for `harness-control-pane` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that entry only (delivers, verification scenario, notes, decided, depends, design should address). It fixes the scope. If the entry points at conventions sections elsewhere in the file, read those too.
3. This spec's earlier documents: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md` and `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md`. Cover every design component C1-C10, the Data Models and the Testing Strategy.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/tasks-template.md`, else `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the tasks must change. Read before you cite.

## Carried from design
- R2-3 — spawn-to-record crash window: ruled out for word cap; a launcher crash between spawn and the record-write can leave a run untracked.
- LaunchError.step / 409-vs-500 gap — narrow-check deferred: the in-flight-race loser has no LaunchError.step value and its route-layer error shape (409 vs 500) is unstated (design.md:81,90).
Address each carried item in a task (or its `_Prompt` restrictions/success), or state in `## Scope notes` why it does not apply to this phase. In particular the tasks must cover: the atomic launch admission (C4 launch step 1), the re-point-on-new-launch log seam (C5/C7), the post-merge validation pass in the providers script (C9), and must resolve the LaunchError.step / 409-vs-500 gap so an implementer knows the loser's error step and route status.

## Size
- Cap: 150 words per task block, excluding its `_Prompt:` line. Count each block.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` is the map of the code this spec touches. Extend it the same way the earlier phases built it: from graphify explain and query output for each area, opening a code file only to confirm the range you cite. A graph node alone is not a citation; every line cites a range you read at both ends. Append to it if it needs new lines (never delete a line another phase wrote). Shape: first line `# Codebase context — harness-control-pane`; one `## <area>` heading per area; under each, one line per file `- path:start-end — what it is, one clause`. Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned. Tasks cover every design component C1-C10.
- Record every product-behalf call under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`.
- End the document with `## Revision History` and the line `- **v1** (2026-09-28) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- Follow `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md` exactly. Each task is `- [ ] N. Title` (sub-tasks `N.M`), with `- File:` lines, a `- Purpose:` line, `_Leverage: …_`, `_Requirements: …_`, and a `_Prompt: Task: … | Restrictions: … | Success: …_` line that ends with `_`. Every task numbered so the parser counts it. Order tasks so each step leaves the tree compiling and every existing suite green; state the dependency order in a short preamble. A prompt must not pin a call signature, UI label or helper name that a different task in this document creates; write "the hook task N exports" and let the implementer read the merged code.
- When a `_Prompt` cites a decision id (`D<n>`) as the reason for a behaviour, verify that decision governs that behaviour and cite the governing requirement number alongside it.
- For every existing test file a task names, say whether the change alters a value it asserts exactly. When a prompt enumerates assertion sites, label the list an illustrative minimum ("at least these") and tell the implementer to widen it to every assertion the change touches.
- When a task uses an artefact a later task creates (a route, an export), the prompt names the bridge (a cast, a stub) and the later task's prompt says to remove it.
- When a task tells the implementer to stage a scratch store with its own event script, give that script an explicit path under the scratch store (`<scratch-store>/event.sh`) and state it must not reuse the supervisor's `EVENT_SCRIPT` path.
- When a task authors a `set -u` shell script, its prompt says to read every optional environment variable as `${VAR:-}`, never bare `$VAR`. Only the supervisor writes the run ledger — `event.sh`, its `.runid` and the run's `harness-events.jsonl`; a spawned worker calls `EVENT_SCRIPT` only to append rows.
- Start the tasks document with a `Document version: v1` line right after the H1.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out.
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at d24c492e8a65a2aef35860a975404cd608f41d37, 0 commits behind HEAD.
