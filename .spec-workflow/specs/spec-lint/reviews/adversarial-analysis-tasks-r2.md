# Adversarial analysis — spec-lint/tasks (v2)

Round 2. Order per the prompt: attack the v2 delta first, then the fresh lens
(intra-document shape consistency — every artefact one task defines vs. every later
task that calls it, and each definition vs. the design component it implements).
Round 1's lens (the sub-agent that sees only a task prompt) is not repeated.

## What I checked and how

- Read the memory file, the v1 analysis, `codebase-context.md`, `design.md` (v3),
  `requirements.md` (v4) and `agent-rules.md` before judging.
- **Delta 1 — R1-1 fix (tasks 5, 6, 7, the `lines` input).** Re-read design Data Models
  (`design.md:166`, `TaskBlock { id; line; start; end; promptLines }` — no text field, as
  the delta claims), Component 6 (`checkTaskWords(blocks: TaskBlock[], cap)`), Component 7
  (`checkCoverage(taskBlocks, components|null)`, `checkBridges(taskBlocks)`). Confirmed the
  three delta claims are factually true: `TaskBlock` carries no text; the added "needs the
  document's `lines` alongside task 2's blocks" clauses in tasks 5, 6 and 7 give the three
  functions a data path they lacked; the regex `/\btask\s+(\d+(?:\.\d+)*)/gi` in task 6
  matches Component 7 verbatim.
- **Delta 2 — R1-2 fix (`10.1` on tasks 3-6).** `grep -n '_Requirements:'` confirms
  `10.1` now sits on tasks 3 (`:29`), 4 (`:38`), 5 (`:47`) and 6 (`:57`), and nowhere else.
- **Delta 3 — R1-3 fix (task 7 `caps.task`).** Task 7's prompt now says "the `tasks` phase
  reads the singular `caps.task` key, not `caps[phase]`". `LintCaps = { requirements; design;
  task }` (design Data Models) confirms `caps[phase]` for `phase='tasks'` is `undefined`;
  `caps.task` is the only correct form.
- **Fresh lens.** Traced every exported artefact to its consumers: the Data-Models types
  and `finishLint`/`lintMessage`/`CHECKS_BY_PHASE` (task 1) → tasks 3-7; `Block`/`Criterion`/
  `TaskBlock`/`fencedLines`/`blocks`/`criteria`/`taskBlocks` (task 2) → tasks 3-7;
  `checkCitations` (task 3), `checkEars` (task 4), `parseWordCaps`/`checkDocWords`/
  `checkTaskWords` (task 5), `checkTasksFormat`/`requirementIndex`/`checkRequirementIds`/
  `designComponents`/`checkCoverage`/`checkBridges` (task 6) → the task-7 handler. Every
  export name, parameter set and return shape the handler call implies (async
  `checkCitations`, sync rest) matches the definition. The tool count (`grep -nE 'Tool,?$'`
  = 12 → 13) matches task 7 and task 11. Per-block word counts (awk, `## `/checkbox bound,
  prompt excluded) show the largest block is task 7 at 128 words — the delta pushed nothing
  over the 150 cap.
- **Ordering re-check on the R1-1 fix.** The unpinned parameter order the fix left to "the
  implementer reconciling while merging tasks 2/5/6/7" (Revision History v2 R1-1) does not
  break `tsc`: task 7 is downstream of 5 and 6 in the fixed order 5→6→7, so the handler is
  written against the concrete signatures 5 and 6 already emitted. The dependency
  paragraph's "every task leaves `npx tsc --noEmit` clean" holds.

## Findings

### R2-1 — MINOR — Compounding (on R1-1's memory note / R1-2)

The R1-2 fix added `10.1` to tasks 3, 4, 5 and 6, but not to tasks 1 and 2 — and the
document's own Decision D2 (`tasks.md:129`) names requirement 10.1 as the reason task 1
carries its own suite: "requirement 10.1 puts a suite beside each new module." Task 1
(`lint-types.ts` + `lint-types.test.ts`) and task 2 (`lint-markdown.ts` +
`lint-markdown.test.ts`) each create a new module with a test suite beside it, which is
exactly what 10.1's first clause mandates, yet task 1's `_Requirements:` line is
`1.6, 1.7, 1.8` (`:11`) and task 2's is `2.1, 2.5, 4.1, 5.3, 6.2, 7.2, 7.4` (`:20`) —
neither cites 10.1. The same untraced pattern touches 10.5 ("every `harness/` edit
followed by the plugin checks"), whose per-edit clause is realised in tasks 9, 10 and 11
but cited only by task 12. Traceability only; the suites and plugin checks are all present
in the tasks' Success criteria, so no implementation or test is lost. It reads as a
mild internal inconsistency (D2 attributes task 1 to 10.1 while task 1 omits it), safely
fixable by adding `10.1` to tasks 1 and 2 and `10.5` to tasks 9-11, or by leaving it — the
drafter's defensible scoping is "10.1's per-rule-case clause maps to the rule tasks 3-6."
Not a defect that changes any built artefact.

## Top risks/gaps

1. None at MUST_FIX or SHOULD_FIX level. The v2 delta corrected the one real defect
   (R1-1) soundly: the three block-text checks now receive `lines`, and because task 7 is
   ordered after tasks 5 and 6 it is written against their emitted signatures, so the
   unpinned parameter order cannot drift into a `tsc` break.
2. The sharpest remaining coupling is unchanged from round 1 and untouched by the delta:
   task 8's e2e asserts an *exact* per-phase finding set (requirements: `citation-path`,
   `mdx`, `ears-shape`, `doc-words`; tasks: `tasks-format`, `task-requirement-id`,
   `coverage-component`). The fixture must be hand-tuned so no stray `task-words`,
   `bridge-missing`, `citation-*` or second `mdx` fires. This is the e2e's purpose, matches
   the design Testing Strategy, and is the implementer's highest-attention item — not a
   finding.
3. R2-1 (traceability of 10.1/10.5) is cosmetic and does not keep the loop alive.

## Top 3 conclusions to challenge

1. **"Every task leaves `npx tsc --noEmit` clean" (dependency paragraph).** Round 1
   marked this false while R1-1 stood. It now holds: the delta threaded `lines` through
   tasks 5, 6 and 7, and task 7 reads the real signatures of the downstream-of-it modules,
   so no signature drift reaches the build. Conclusion is now sound.
2. **"per design Component 6 / Component 7" (tasks 5, 6 action lines) still points at the
   old 2-parameter signatures.** The design's literal `checkTaskWords(blocks, cap)`,
   `checkCoverage(taskBlocks, ...)`, `checkBridges(taskBlocks)` were deliberately left
   unedited (Revision History v2 R1-1 — a closed ruling), so the task prompt's "needs
   `lines` alongside" governs and the "per Component 6/7" reference is mildly stale. This
   is the accepted state, not re-opened here; the only lasting effect is that `design.md`
   will read inconsistent with the shipped signatures, which the R1-1 ruling accepted.
3. **"one case per rule in requirements 2-7 … beside each new module" (10.1) is fully
   traced by the R1-2 fix.** Challenged: it is traced for the rule modules (tasks 3-6) but
   not for the two infrastructure modules (tasks 1, 2) that 10.1's "beside each new module"
   clause also mandates, nor for the `mdx`/`caps-invalid` cases that live in the task-7
   handler test. See R2-1. Minor.

## What's missing before acting on this document

- Nothing that blocks implementation. The R1-1 data-path fix, the R1-3 `caps.task`
  clarification and the R1-2 traceability additions are all present and correct; every
  export/parameter/return shape is internally consistent and matches the design components
  it implements; requirement and design-component coverage is complete (round 1's map
  still holds); atomicity and ordering are sound.
- Optional, MINOR: add `10.1` to tasks 1 and 2 and `10.5` to tasks 9-11 to close the
  traceability gap R2-1 names, or record that 10.1's rule-case clause is intentionally
  scoped to tasks 3-6.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
