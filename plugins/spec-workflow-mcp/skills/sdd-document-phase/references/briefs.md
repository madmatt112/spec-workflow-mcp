# Document-phase briefs and prompts

Fill every `<…>` from the launch prompt or the current state. Absolute paths only.
When `AGENT_RULES` is `none`, drop the first line of each brief.

## Drafter brief — `reviews/drafter-brief-<PHASE>.md`

```markdown
# Drafter brief — <SPEC> <PHASE> v1

Read and obey <AGENT_RULES> first.

## Job
Write v1 of `<document path>` in place, then report in 150 words or fewer: files
touched, what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
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

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after
  reading both ends of the range. A misstated artifact is an automatic MUST_FIX for
  the reviewer.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so
  in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned. Design enumerates every artifact the
  requirements name; tasks cover every design component.
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
  write "the hook task 7 exports" and let the implementer read the merged code.
- Edit only the document. Approvals, deferrals, HANDOFF, INDEX and every other file
  belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
```

## Round section — appended to the scaffold in `reviews/adversarial-prompt-<PHASE>[-rN].md`

Keep the scaffold as written (it already carries the standing directives and the
verdict block). Append:

```markdown
## This round

- Version under review: v<D>.
- <D = 1: First review. Read the decomposition entry for `<SPEC>` in
  `<SPEC_STORE_ROOT>/spec-decomposition/decomposition.md` and check the document
  against its scope.>
  <D > 1: Read the Revision History line for v<D> first and attack those changes
  before anything else. Every MUST_FIX after round 1 in past specs was a claim error
  introduced by the previous delta.>
- Fresh lens for this round: <one lens the previous rounds did not use, chosen from:
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
accepted | rejected`; citations verified (count); flags. No file contents.

## Inputs
- Document: `<document path>` (v<D>).
<- Requirements: `<spec dir>/requirements.md`.>
<- Design: `<spec dir>/design.md`.>
- Findings: <`<latest analysis path>` | the list below (revision input)>.
- Memory: `<memory file path>` (read; do not write it — the reviewer maintains it).
- You may call the spec-workflow `adversarial-response` tool (`specName: <SPEC>`,
  `phase: <PHASE>`) for the response methodology. Ignore its instructions to present
  to a user, wait, or delete approvals.

<## Revision input
RI-1: <text>
RI-2: <text>>

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`.
   Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v<D+1> in place. Add the Revision History line
   `- **v<D+1>** (<today>) — Round-<A> adversarial response (<analysis file name>,
   verdict iterate <m>/<s>/<k>).` followed by one nested bullet per finding:
   `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what
   changed, or why not>`.
5. Closed by ruling, leave as is: <none | list>.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's
   task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others.
8. Do not ask questions.
```

## Adjudication brief — `reviews/adjudication-brief-<PHASE>.md`

```markdown
# Adjudication brief — <SPEC> <PHASE>, post-cap corrective pass

Read and obey <AGENT_RULES> first.

The review loop reached its cap: v9 of `<document path>` was reviewed in
`<r9 analysis path>` and still carries MUST_FIX <m> / SHOULD_FIX <s>. You are the
corrective pass. Fix or rule out each open item, write v10 in place, and stop. Nothing
reviews v10 again; a narrow check only verifies that each listed item was addressed.

## Open items
<one line per item: `<id> — <title> (<severity>)`>

## Inputs
- Document (v9); the r9 analysis; the memory file `<memory file path>`;
  <requirements and design as applicable>. Code under `<CODE_ROOT>`.

## Rules
- For each item: fix it in the document, or rule it out with a stated reason. A
  rule-out is a ruling; it is final for this phase.
- Verify every citation against the real tree, both ends of every range.
- Revision History line: `- **v10** (<today>) — Post-cap corrective pass, adjudicated,
  not re-reviewed.` followed by one nested bullet per item: `- **<id> — fixed |
  ruled out.** <one line>`.
- Report in 150 words or fewer: each item as `<id>: fixed | ruled out`, files touched,
  flags. No file contents.
- Edit only the document. Do not ask questions.
```

## Narrow-check prompt — overwrites the scaffold in `reviews/adversarial-prompt-<PHASE>-r<N>.md`

```markdown
# Narrow check — <SPEC>/<PHASE> v10

This is not a review. v9 of `<document path>` was reviewed in `<r9 analysis path>`;
a corrective pass produced v10 and addressed the items below. Verify only that each
item was addressed in v10: fixed, or ruled out with a stated reason under the v10
Revision History line. Read the document and the code it cites under `<CODE_ROOT>` as
needed. <Project rules: `<AGENT_RULES>`.>

## Items
<one line per item: `<id> — <title>`>

## Output
Write to `<analysis output path>`:
- One line per item: `<id>: addressed | not addressed — <one line>`.
- The line `VERIFIED: <k>/<n>` where k is the number addressed.
- Any new observation under a `## Deferred findings` heading, one line each. Do not
  write a verdict block. Do not update the memory file. Do not edit the document.
```
