# Document-phase briefs and prompts

Fill every `<…>` from the launch prompt or the current state. Absolute paths only.
When `AGENT_RULES` is `none`, drop the first line of each brief.

## Drafter brief — `reviews/drafter-brief-<PHASE>.md`

```markdown
# Drafter brief — <SPEC> <PHASE> v1

Read and obey <AGENT_RULES> first.

## Job
Write v1 of `<document path>` in place, write or extend `<spec dir>/codebase-context.md`,
then report in 150 words or fewer: files touched, the document's word count (`wc -w`),
what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. <design, tasks: `<spec dir>/codebase-context.md` first: it maps the code the
   earlier documents cite. Start from it instead of exploring from cold.>
   <requirements: nothing yet; you write the context file (below).>
1. Steering: <requirements: `<SPEC_STORE_ROOT>/steering/product.md` | design:
   `<SPEC_STORE_ROOT>/steering/tech.md`, `structure.md`, and `design-system.md` if it
   exists | tasks: `<SPEC_STORE_ROOT>/steering/structure.md`>.
2. The decomposition entry for `<SPEC>` in
   `<SPEC_STORE_ROOT>/spec-decomposition/decomposition.md`: grep for the slug, read that
   entry only (delivers, verification scenario, notes, decided, depends, design should
   address). It fixes the scope. If the entry points at conventions sections elsewhere
   in the file, read those too.
3. This spec's earlier documents: <none | `<spec dir>/requirements.md` |
   `<spec dir>/requirements.md` and `<spec dir>/design.md`>.
4. The template: `<SPEC_STORE_ROOT>/user-templates/<PHASE>-template.md`, else
   `<SPEC_STORE_ROOT>/templates/<PHASE>-template.md`.
5. The code under `<CODE_ROOT>` that the document must describe. Read before you cite.

## Carried from <previous phase>
<none | one line per item: `<id> — <title>: <the ruled-out reason, one line>`>
Address each carried item in this document, or state in `## Scope notes` why it does
not apply to this phase.

## Size
- Cap: <requirements: 3,500 words | design: 4,000 words | tasks: 150 words per task
  block, excluding its `_Prompt:` line>. Count with `wc -w` before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs
  it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a
  constraint, a citation. Cut the rest.

## Codebase context
`<spec dir>/codebase-context.md` is the map of the code this spec touches, written from
the exploration you do anyway. Create it if it does not exist; append to it if it does
(never delete a line another phase wrote). Shape:
- First line `# Codebase context — <SPEC>`.
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
  version under `<CODE_ROOT>` and cite the probe, or leave the claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so
  in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned. Design enumerates every artifact the
  requirements name; tasks cover every design component.
- When a design departs from a requirement's literal (a widened enum, a defaulted
  param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in
  this document` as `D<n> — <decision>: <options considered>; chosen because <one
  line>`. A human reads that list.
- End the document with `## Revision History` and the line
  `- **v1** (<today>) — Initial draft.`
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval
  lint; write `` `<name>` `` or "name".
- tasks.md only: follow `<SPEC_STORE_ROOT>/templates/tasks-template.md` exactly. Each
  task is `- [ ] N. Title` (sub-tasks `N.M`), with `- File:` lines, a `- Purpose:`
  line, `_Leverage: …_`, `_Requirements: …_`, and a `_Prompt: Task: … | Restrictions:
  … | Success: …_` line that ends with `_`. Every task numbered, so the parser counts
  it. Order tasks so each step leaves the tree compiling and every existing suite
  green. State the dependency order in a short preamble. A prompt must not pin a call
  signature, UI label or helper name that a different task in this document creates;
  write "the hook task 7 exports" and let the implementer read the merged code. For
  every existing test file a task names, say whether the change alters a value it
  asserts exactly. When a task uses an artefact a later task creates (a route, an
  export), the prompt names the bridge (a cast, a stub) and the later task's prompt
  says to remove it.
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and
  every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
```

## Round section — appended to the scaffold in `reviews/adversarial-prompt-<PHASE>[-rN].md`

Keep the scaffold as written (it already carries the standing directives and the
verdict block). Append:

```markdown
## This round

- Read `<spec dir>/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v<D>.
- <D = 1: First review. Read the decomposition entry for `<SPEC>` in
  `<SPEC_STORE_ROOT>/spec-decomposition/decomposition.md` and check the document
  against its scope. The context file is drafter-written and unreviewed; re-probe any
  `## Probes` line the document relies on.>
- <D = 1 with RE-DECIDED flags: the drafter re-decided these requirement literals:
  <`<req> — <one line>` …>. Rule on each: `refinement` (closed) or `widening` (a
  MUST_FIX).>
  <D > 1: Read the Revision History line for v<D> first and attack those changes
  before anything else. Every MUST_FIX after round 1 in past specs was a claim error
  introduced by the previous delta.>
- <Over cap: <n> words against a cap of <cap>; a SHOULD_FIX naming what to cut.>
- Fresh lens for this round: <requirements D = 1: wire contracts across a boundary
  (router, query params, response shapes, client state), the default first lens for
  requirements.> <otherwise: one lens the previous rounds did not use, chosen from:
  wire contracts across a boundary (router, query params, response shapes, client
  state); the sub-agent that receives only the task prompt; a cold read for internal
  contradictions and a truth table of the stated cases; every cited artifact re-read
  at both ends of its range; vendor or format facts checked against their source;
  failure, rollback and partial-failure paths; each prescribed test or safety
  mechanism verified against the installed library; the cost of touching an existing
  component (its tests, fixtures, query keys, e2e assumptions); intra-document shape
  consistency: every call a later task makes against an artefact an earlier task
  defines>.
- Closed by ruling, do not re-open: <none | `<finding id>: <one line>` …>.
- Rejected findings from earlier rounds are recorded with their reasons in the
  Revision History and the memory file. Re-raise one only with new evidence, marked
  Recurring.
- Rolling memory file: `<memoryFilePath from the adversarial-review result>`. <D = 1: The
  scaffold above does not mention it on the first round. Create it after your analysis,
  in the format later rounds expect: `# Adversarial Review Memory — <PHASE>`, `Last
  updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected /
  Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`,
  `## Guidance for Next Review`.> <D > 1: Read it first and rewrite it after your
  analysis, as the scaffold says.>
- Code lives under `<CODE_ROOT>`<; the spec store under `<SPEC_STORE_ROOT>`>. Use
  absolute paths. <Project rules for reading code and running checks:
  `<AGENT_RULES>`.>
- Do not edit the document or any file other than your analysis and the memory file.
```

## Reviser brief — `reviews/reviser-brief-<PHASE>-v<D+1>.md`

```markdown
# Reviser brief — <SPEC> <PHASE> v<D+1>

Read and obey <AGENT_RULES> first.

## Job
Produce v<D+1> of `<document path>` in place from the findings below, then report in
150 words or fewer: files touched; each finding as `<id>: accepted | partially
accepted | rejected`; citations verified (count); the document's word count; flags.
No file contents.

## Inputs
- Context file: `<spec dir>/codebase-context.md`. Read it first; it maps the code the
  document cites.
- Document: `<document path>` (v<D>). Cap: <requirements: 3,500 words | design: 4,000
  words | tasks: 150 words per task block excluding its prompt>. Do not grow the
  document past it; a fix that adds a paragraph removes one.
<- Requirements: `<spec dir>/requirements.md`.>
<- Design: `<spec dir>/design.md`.>
- Findings: <`<latest analysis path>` | the list below (revision input)>.
- Memory: `<memory file path>` (read; do not write it — the reviewer maintains it). Read
  `## Guidance for Next Review`. When it names another place where an accepted finding's
  defect occurs, fix that place under the same finding's bullet as `also applied to
  <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: <SPEC>`,
  `phase: <PHASE>`) for the response methodology. Ignore its instructions to present
  to a user, wait, or delete approvals.

<## Revision input
RI-1: <text>
RI-2: <text>>

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work.
   When a finding says a rationale clause is false, delete the clause unless you can
   prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`.
   Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v<D+1> in place. Add the Revision History line
   `- **v<D+1>** (<today>) — Round-<A> adversarial response (<analysis file name>,
   verdict iterate <m>/<s>/<k>).` followed by one nested bullet per finding:
   `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what
   changed, or why not>`. If the document carries a `Document version:` header, set it
   to v<D+1>.
5. Closed by ruling, leave as is: <none | list>.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's
   task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
```

## Lint brief — `reviews/lint-brief-<PHASE>-v<D>.md`

```markdown
# Lint brief — <SPEC> <PHASE> v<D>

Read and obey <AGENT_RULES> first.

## Job
Fix the lint findings below in v<D> of `<document path>` in place, then report in
150 words or fewer: files touched; each finding as `<id>: accepted | partially
accepted | rejected`; citations verified (count); the document's word count; flags.
No file contents.

## Inputs
- Context file: `<spec dir>/codebase-context.md`. Read it first; it maps the code the
  document cites.
- Document: `<document path>` (v<D>). Cap: <requirements: 3,500 words | design: 4,000
  words | tasks: 150 words per task block excluding its prompt>. Do not grow the
  document past it; a fix that adds a paragraph removes one.
<- Requirements: `<spec dir>/requirements.md`.>
<- Design: `<spec dir>/design.md`.>
- Findings: the list under `## Revision input`.

## Revision input
L-1 (<severity>, <rule>, line <line>): <message>
L-2 (<severity>, <rule>, line <line>): <message>

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work.
   When a finding says a rationale clause is false, delete the clause unless you can
   prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`.
   Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v<D> in place. Add no version line. Append under the v<D> Revision History line
   one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: <none | list>.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's
   task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
```

## Adjudication brief — `reviews/adjudication-brief-<PHASE>.md`

```markdown
# Adjudication brief — <SPEC> <PHASE>, post-cap corrective pass

Read and obey <AGENT_RULES> first.

The review loop reached its cap: v<D> of `<document path>` was reviewed in
`<r<A> analysis path>` and still carries MUST_FIX <m> / SHOULD_FIX <s>. You are the
corrective pass. Fix or rule out each open item, write v<D+1> in place, and stop.
Nothing reviews v<D+1> again; a narrow check only verifies that each listed item was
addressed. A SHOULD_FIX you rule out is carried into the next phase's drafter brief,
so its reason must stand on its own.

## Open items
<one line per item: `<id> — <title> (<MUST_FIX | SHOULD_FIX>)`>

## Inputs
- Context file: `<spec dir>/codebase-context.md`. Read it first.
- Document (v<D>); the r<A> analysis; the memory file `<memory file path>`;
  <requirements and design as applicable>. Code under `<CODE_ROOT>`.
- Cap: <requirements: 3,500 words | design: 4,000 words | tasks: 150 words per task
  block excluding its prompt>. Do not grow the document past it.

## Rules
- For each item: fix it in the document, or rule it out with a stated reason. A
  rule-out is a ruling; it is final for this phase.
- Verify every citation against the real tree, both ends of every range.
- Revision History line: `- **v<D+1>** (<today>) — Post-cap corrective pass,
  adjudicated, not re-reviewed.` followed by one nested bullet per item: `- **<id> —
  fixed | ruled out (<severity>).** <one line>`. Keep the words `Post-cap corrective
  pass` exactly; the orchestrator greps for them.
- Report in 150 words or fewer: each item as `<id>: fixed | ruled out (<severity>) —
  <reason>`, files touched, flags. No file contents.
- Edit only the document. Do not ask questions.
```

## Narrow-check prompt — overwrites the scaffold in `reviews/adversarial-prompt-<PHASE>-r<N>.md`

Spawned on `sdd-checker`, not `sdd-reviewer`.

```markdown
# Narrow check — <SPEC>/<PHASE> v<D>

This is not a review. v<D-1> of `<document path>` was reviewed in `<r<A> analysis
path>`; a corrective pass produced v<D> and addressed the items below. Verify only that
each item was addressed in v<D>: fixed, or ruled out with a stated reason under the
v<D> Revision History line. Read `<spec dir>/codebase-context.md` first, then the
document, then the code the items cite under `<CODE_ROOT>` as needed. <Project rules:
`<AGENT_RULES>`.>

## Items
<one line per item: `<id> — <title>`>

## Output
Write to `<analysis output path>`:
- One line per item: `<id>: addressed | not addressed — <one line>`.
- The line `VERIFIED: <k>/<n>` where k is the number addressed.
- Any new observation under a `## Deferred findings` heading, one line each. Do not
  write a verdict block. Do not update the memory file. Do not edit the document.
```
