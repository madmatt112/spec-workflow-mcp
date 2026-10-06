# Drafter brief — dashboard-shell design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-shell/design.md` in place, write or extend `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-shell/codebase-context.md`.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-shell/codebase-context.md` first: it maps the code the earlier documents cite. Start from it instead of exploring from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/tech.md`, `structure.md`, and `design-system.md` if it exists.
2. The decomposition entry for `dashboard-shell` in
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep for the slug, read that
   entry only (delivers, verification scenario, notes, decided, depends, design should
   address). It fixes the scope. If the entry points at conventions sections elsewhere
   in the file, read those too.
3. This spec's earlier documents: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-shell/requirements.md`.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/design-template.md`, else
   `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/design-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe. Read before you cite.

## Carried from requirements
none
Address each carried item in this document, or state in `## Scope notes` why it does
not apply to this phase.

## Size
- Cap: 4,000 words. Count with `wc -w` before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs
  it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a
  constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-shell/codebase-context.md` is the map of the code this spec touches, written from the exploration you do anyway. Extend the file the same way. A graph node alone is not a citation; every line cites a range you read at both ends. Create it if it does not exist; append to it if it does (never delete a line another phase wrote). Shape:
- First line `# Codebase context — dashboard-shell`.
- One `## <area>` heading per area (a route, a package, a table, a component tree).
- Under each, one line per file that matters: `- path:start-end — what it is, one
  clause`. Cite only after reading both ends of the range.
- No prose, no design opinions, no requirements. Lists only.
Every later reviewer, reviser and implementer reads it first.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after
  reading both ends of the range. A misstated artifact is an automatic MUST_FIX for
  the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed
  version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out. Design only: a
  sentence that names a specific library or framework API capability — a method, an
  option, or an exposed field — is such a checkable claim; probe it against the installed
  version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or state only the behaviour you
  verified. Never carry an unproven library-capability claim into a later phase.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so
  in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned. Design enumerates every artifact the
  requirements name; tasks cover every design component.
- Requirements only: label any acceptance criterion that asserts an equality or
  invariant already true on the pre-feature base an invariant (verified, not
  red-first), so the tasks author does not route it as a red/green Test task. An AC
  that cannot fail before the feature is built is verified, not red-first
  (retro canonical-link F5).
- Design only: when you pin an interface whose Testing Strategy needs an extra argument
  (for example a `timeoutMs`), pin that argument as an optional trailing parameter, so the
  implementer does not have to invent a backward-compatible shim.
- Design only: when you pin an interface you do not exercise live — a method on a fork or
  integration branch — cite that branch's tip (for example `fork/integration`) and confirm
  the symbol resolves there, never a historical commit hash that may predate the method
  (retro P1).
- Design only: pin the interface and its post-conditions, not a code shape. Label any inline
  code "illustrative — verify against the test fake," so a shape bug in the sample does not
  read as binding (retro P2).
- When a design departs from a requirement's literal (a widened enum, a defaulted
  param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in
  this document` as `D<n> — <decision>: <options considered>; chosen because <one
  line>`. A human reads that list.
- End the document with `## Revision History` and the line
  `- **v1** (<today>) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose
  only. Never write a backticked path, line range or code identifier there; the
  citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval
  lint; write `` `<name>` `` or "name".
- tasks.md only: follow `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/tasks-template.md` exactly. Each
  task is `- [ ] N. Title` (sub-tasks `N.M`), with `- File:` lines, a `- Purpose:`
  line, `_Leverage: …_`, `_Requirements: …_`, and a `_Prompt: Task: … | Restrictions:
  … | Success: …_` line that ends with `_`. Every task numbered, so the parser counts
  it. Order tasks so each step leaves the tree compiling and every existing suite
  green. State the dependency order in a short preamble. A prompt must not pin a call
  signature, UI label or helper name that a different task in this document creates;
  write "the hook task 7 exports" and let the implementer read the merged code. When a
  `_Prompt` cites a decision id (`D<n>`) as the reason for a behaviour, verify that
  decision actually governs that behaviour before the brief ships, and cite the governing
  requirement number alongside it (retro P8/P9/G2). Cite code by symbol or
  acceptance-criterion name plus line number. Any citation into a file merged by an earlier
  task must be re-resolved before the tasks review (retro P8/G4). For
  every existing test file a task names, say whether the change alters a value it
  asserts exactly. When a prompt enumerates assertion sites to update (line anchors
  like `:127`, `:479`), label the list an illustrative minimum ("at least these") and
  tell the implementer to widen it to every assertion the change touches; never let a
  reader treat one as exhaustive and under-test (retro P11). A task whose tests cover
  behaviour an earlier task in this document already shipped — an integration test that
  cannot fail before that code exists — marks its coverage `- Test (integration): <path>
  — <call>` instead of `- Test:`, so the implementation phase routes it implementer-only
  with no red-first author (retro P4). When a task uses an artefact a later task creates (a route, an
  export), the prompt names the bridge (a cast, a stub) and the later task's prompt
  says to remove it. When a task tells the implementer to stage a scratch store with
  its own event script, give that script an explicit path under the scratch store
  (`<scratch-store>/event.sh`) and state that it must not reuse the supervisor's
  `EVENT_SCRIPT` path. When a task authors a `set -u` shell script, its prompt says to
  read every optional environment variable as `${VAR:-}`, never bare `$VAR`, so an
  unset key takes the intended no-value path instead of aborting on an unbound
  variable. Only the supervisor writes the run ledger — `event.sh`, its `.runid` and
  the run's `harness-events.jsonl`; a spawned worker calls `EVENT_SCRIPT` only to
  append rows and never rewrites, re-initializes or repoints it. Start the tasks
  document with a `Document version: v1` line right after the H1.
- tasks.md only: before hand-off, self-check Success-clause coverage. For every task,
  each test its `_Prompt` `Task:` body names, and every behavioural `- Test:` coverage
  line that asserts observable output or state, must have a matching clause in that
  task's `Success:` clause. The test-author writes to the `Success:` clause, so a tested
  behaviour the clause omits is silently dropped; the tasks reviewer still verifies this
  (retro P7), but a clean draft leaves nothing for it to raise.
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and
  every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- doc:
- words:
- context:
- re-decided:
- scope-cut:
- gate-a:
- flags:

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at f004fae4fb9092354e673510044e90b169ed99c4, 1 commits behind HEAD.
A `file:line` from the graph is a hint to confirm, not a citation.
