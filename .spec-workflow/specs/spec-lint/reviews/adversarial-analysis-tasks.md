# Adversarial analysis — spec-lint/tasks (v1)

First review. No prior version, so there are no deltas to attack; this pass applies the
primary attack surface (atomicity, ordering, coverage) and the named fresh lens (the
sub-agent that receives only a task's `_Prompt:` plus the files it names).

## What I checked and how

- Read `codebase-context.md`, then read both ends of every code range the tasks cite:
  `src/core/gate-rules.ts` (`:1-9`, `:16-17`, `:36-37`, `:42-43`, `:73-93`, `:118-133`,
  `:164-168`), `src/core/task-parser.ts` (`:108-128`, `:164-175`, `:200-216`, `:233-271`),
  `src/core/task-validator.ts` (`:6-24`, `:31`, `:100-115`, `:170-230`, `:248`, `:255`),
  `src/tools/index.ts` (full), `src/tools/root-selection.ts` (`:36-56`, `:202-221`),
  `src/tools/adversarial-review.ts` (`:36-39`, `:63-68`, `:316-340`),
  `src/tools/get-task-review.ts` (`:6-42`), `src/tools/review-gate.ts` (`:176-188`,
  `:274-299`), the two `review-gate` test files, the four harness files at every anchor
  tasks 9-10 name, both docs at the anchors task 11 names, `retrospective-log.md:1-10`,
  the three template `:3` cap lines, and the `review-gate` document references.
- Re-probed the two `## Probes` lines the tasks rely on: `grep -nE 'Tool,?$' src/tools/index.ts`
  returns **12** today (→ 13 after task 7 appends `specLintTool`); `harness/agents/sdd-document-orchestrator.md`
  contains **0** existing `spec-lint` (→ 3 after task 9). Both hold.
- Verified requirements→task and design-component→task coverage. All 10 design
  components map (C1→7, C2→1, C3→2, C4→3, C5→4, C6→5, C7→6, C8→9, C9→10, C10→11); tests
  and gate map to Testing Strategy (task 8→End-to-end, task 12→Harness+Checks). The
  drafter's "no RE-DECIDED, every task maps, nothing widens" claim holds for citation
  accuracy: every code path, line range and signature I checked is stated correctly.
  `requirements D11` (worker self-lint deferral, `requirements.md:170`) is a correct
  cross-reference, not a design/requirements mix-up.

## Findings

### R1-1 — MUST_FIX — Novel — Three `TaskBlock`-consuming checks cannot reach the text they must scan

`checkTaskWords`, `checkCoverage` and `checkBridges` are all pinned to take `TaskBlock[]`
(plus a cap or the components list) and nothing else, yet each must scan the raw text of
a task block:

- Design `TaskBlock` (`design.md:166`): `{ id; line; start; end; promptLines }` — **no
  text and no lines field**.
- `checkTaskWords(blocks: TaskBlock[], cap)` (`design.md:69`) must return "words of each
  block's lines minus `promptLines`" — requirement 6.2 (`requirements.md:82`): count each
  block "excluding the `_Prompt:` line and its continuation lines".
- `checkCoverage(taskBlocks, components|null)` (`design.md:75`) must test a label against
  "each task block's joined text (prompt included)" — requirement 7.2 (`requirements.md:92`).
- `checkBridges(taskBlocks)` (`design.md:75`) must run `/\btask\s+…/gi` over the block and
  test whether "the lower-cased block contains none of `bridge`, `stub`, …" — requirement
  7.4 (`requirements.md:94`).

None of the three receives the source `lines`, and `TaskBlock` carries no text, so as
pinned they cannot compute their outputs. Contrast the sibling functions that *are*
implementable because they take `lines`: `checkCitations(lines, bases)`, `requirementIndex(lines)`,
`checkRequirementIds(lines, index)`, `designComponents(designLines)`, and
`checkDocWords(content, cap)`. The gap is specific to the `TaskBlock`-consuming trio.

Concrete failure under the fresh lens: task 5's implementer (File: `src/core/lint-words.ts`
only) cannot make `checkTaskWords` count words, so the test the prompt names — "`wordCount`
… prompt lines excluded, the `## ` block bound" — cannot be written, and task 5's Success
("`vitest run … lint-words.test.ts` green") is unreachable. Task 6 has the same wall for
`checkCoverage`/`checkBridges`. The only fix inside task 5/6's file scope is to add a
`lines` parameter, which then breaks task 7: its handler, following Component 1's pinned
signatures, calls `checkTaskWords(taskBlocks(lines), caps.task)` and fails `npx tsc
--noEmit`. Task 2's implementer, reading task 2's prompt + Component 3, will *not* add a
text field (the prompt and its test cover only `promptLines`), so the missing data cannot
appear upstream either.

Fix: add a text carrier to `TaskBlock` (e.g. `text: string` populated by `taskBlocks`, or
`lines: string[]`) in the design Data Models and task 2's export list and test, or give
the three functions the source `lines` and update Component 1 / task 7's calls. This is a
cross-task correction (tasks 2, 5, 6, 7 and design Component 3/6/7 + Data Models), so it
must be pinned once, not left for each implementer to guess.

### R1-2 — MINOR — Novel — Requirement 10.1 owns no task `_Requirements:` line

10.1 ("unit tests beside each new module; one case per rule in requirements 2-7, the
`wc -w` equality of 6.1, the `## ` bound of 6.2, the cap override of 6.3") is not cited by
any task's `_Requirements:` line. It is covered in substance — task 3 (citation cases),
task 4 (EARS cases), task 5 (`wc -w` equality, `## ` bound, `parseWordCaps`), task 6
(validator mapping, ids, coverage, bridges) — and the tasks' D2 names 10.1 as the reason
per-module suites exist. So the work is present; only the traceability line is absent.

### R1-3 — MINOR — Novel — `LintCaps` key is `task` (singular), phase is `tasks` (plural)

The handler (task 7, Component 1 step 8) must map `phase: 'tasks'` to `caps.task`, not
`caps[phase]`. TypeScript catches the wrong form (`LintCaps` has no `tasks` key), so this
is a footgun, not a break — worth one word in the task 7 prompt to spare a round-trip.

## Top risks/gaps

1. **R1-1** blocks tasks 5, 6 and the clean build at task 7. It is the one thing that
   stops this document being implementable as written.
2. Task 8's e2e asserts an *exact* finding set per phase (requirements: `citation-path`,
   `mdx`, `ears-shape`, `doc-words`; tasks: `tasks-format`, `task-requirement-id`,
   `coverage-component`). The fixture must be hand-tuned so no stray `citation-identifier`,
   `task-words`, `bridge-missing` or second `mdx`/`ears-shape` fires. The prompt states the
   inputs but not the "and nothing else" traps; the risk is real but it is the e2e's
   purpose and the design Testing Strategy lists the same set, so it is not a defect —
   flagging it as the highest-attention item for the implementer, not a finding.
3. Ordering is a safe total order but over-constrained: tasks 3-6 are mutually independent
   (each needs only 1, 2), and task 9 (harness edits) has only a *runtime* dependency on
   task 7, resolved at the task 12 gate. Not a correctness gap; no missing edge exists.

## Top 3 conclusions to challenge

1. **"…each with its suite … the full suite runs once, at task 12" (dependency paragraph).**
   Sound for tasks that touch `src/`. But the per-task green-suite guarantee for tasks 5
   and 6 is false while R1-1 stands: their named suites cannot be made green from the
   pinned signatures.
2. **"No task uses an artefact a later task creates, so no bridge is needed."** True — I
   traced every cross-task reference (task 3/4/5/6 → 1,2; 7 → 1-6; 8 → 7; 10 → 9; 11 → 7,9,10;
   12 → all) and all edges point backward. The prompts also obey the template rule by
   *naming the task* (`task 2`, `tasks 1-6`) rather than pinning symbol names, deferring
   the names to the design. This conclusion holds.
3. **"Every task leaves `npx tsc --noEmit` clean."** Holds for tasks 1-4, 7-12; fails for
   the task-7 build once tasks 5/6 add a `lines` parameter to work around R1-1 (signature
   drift against Component 1's pinned call). Fixing R1-1 restores this claim.

## What's missing before acting on this document

- The R1-1 correction, pinned once across tasks 2/5/6/7 and design Component 3/6/7 + Data
  Models, so the three block-text checks have a defined way to read block text.
- Nothing else. Citation accuracy, requirement/component coverage, ordering, atomicity,
  the harness edits (every anchor at `SKILL.md`, `briefs.md`, `cleanup.md`, the two agents),
  the doc counts, and the retro-log/e2e fixtures are all grounded and internally consistent.

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
