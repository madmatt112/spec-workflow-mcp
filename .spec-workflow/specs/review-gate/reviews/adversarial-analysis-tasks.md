# Adversarial Analysis — review-gate/tasks (v1)

Round 1. Target: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/review-gate/tasks.md` (v1).
Read against `codebase-context.md`, the approved `design.md` (v4) and `requirements.md` (v4),
the decomposition entry 4, and the design review r4 (which left R4-1 and R4-2 for the tasks
drafter). First review, so no prior tasks-phase memory. Primary attack surface: atomicity,
ordering, coverage. Fresh lens: the sub-agent that receives only the task `_Prompt:` line plus
the files it names — can it finish, keep the tree compiling, keep every existing suite green,
and know it is done; and does every call a later task makes match the artefact an earlier task
defines.

## Delta absorption — R4-1 and R4-2 (checked first)

- **R4-1 absorbed, with a test.** Task 2 returns `touched` "whole, never capped"; task 4 states
  `MAX_TOUCHED_LISTED` "the handler applies after the rules run, never before"; task 5 caps
  `data.touched.paths` to 100 "after every rule has seen the whole list" and adds the exact
  regression case ("a sensitive path sorted past position 100 still scores `high`;
  `touched.total` is the full count"). Scope note 1 restates it. This is the fix the r4 MINOR
  asked for, plus the escape-hatch test r4 only described. Clean.
- **R4-2 absorbed.** Task 3 pins the taxonomy to node v24.13.0 as the probe but names
  `.github/workflows/ci.yml:20` (node 20) as "the runtime the test's assertions target" and
  instructs "assert only `killed`, `signal`, `code` and the status mapping, nothing
  version-specific." D37 records the choice not to install node 20. Scope note 2 repeats it.
  Matches the r4 MINOR. Clean.

## Citation audit — every artefact tasks.md cites, re-read at both ends

Held: `src/types.ts:253-262` (`TaskReview`, no `reviewer` today); `src/core/task-review-manager.ts`
(`:195` `verdict:` line, `:243-246` `get`, `:307` return object `{ id, taskId, specName, version,
timestamp, verdict, summary, findings }`); `src/core/task-diff.ts` (`:36-48` `runGit(projectPath,
args)`, `:263-291` `parseNumstat`, `:277` the `<3`-field skip); `src/core/task-parser.ts` (`:112`
0-based `lineNumber`, `:167` checkbox regex `/^\s*[-*]\s+\[([ x\-])\]/`, `:175` `endLine`);
`src/tools/review-task.ts` (`:160-162` Two-actions, `:179-183` enum `['prepare','record']`, `:224`
`required`, `:251-260` dispatch, `:256-259` unknown-action, `:54-73`/`:79-113` exported converters,
`:431-432`, `:493-498`, `:743-791`); `src/core/adversarial-settings.ts:54-57`/`:195-197`
(`features.typecheck` boolean); `src/tools/spec-status.ts:224` (`reviewCoverage` in `data`);
`.github/workflows/ci.yml:20` (`node-version: '20'`); `.spec-workflow/agent-rules.md:43-52` (a real
six-bullet `## Sensitive paths` list); `harness/agents/sdd-verifier.md:12-14` (three `review-task`
tool names) and `:26` ("run the task's checks yourself"); `harness/.../implementation-phase/
references/briefs.md:124` ("Run the task's checks yourself."); `harness/.../closeout-phase/SKILL.md`
(`:96-98` resume escape, `:118-120` Implement, `:121-124` Verify, `:125-131` Fix rounds, `:132-135`
Close-out lines) and `references/briefs.md:5-14` (Checks-per-class table). No false claim about the
codebase was found in the document. Coverage of design Components 1-10, every Data Model, every
Error Handling cause and every Testing-Strategy item maps to exactly one owning task.

## Topics attacked

### 1. The dependency-order header and the "every existing suite green" guarantee (ordering/atomicity)
- Stress-test the claim that "5 wires them into the new handler" is reachable: `handleGate`
  (task 5) calls `saveReview({ ..., reviewer: 'gate' })`, which needs task 1's `TaskReview.reviewer`
  and serializer — the 1→5 edge carries this and holds.
- Challenge the claim that task 5 compiles standalone before task 6 adds the dispatch: `review-gate.ts`
  imports the already-exported converters from `review-task.ts` (`:54,:79,:103`, codebase-context:164)
  and the task 2-4 modules; nothing imports `handleGate` yet — holds.
- Stress-test "every existing suite green" for task 1: adding a `reviewer: agent` frontmatter line
  is not asserted by any existing test — verified against the round-trip suite (`toContain` only) and
  `get-task-review.test.ts:85-96` (field-equality, no `reviewer`); codebase-context:169 says
  task-review-manager.test.ts is the only file holding frontmatter text. Holds.

### 2. Task 5 — the `handleGate` integration test recipe (coverage of the pass/low case)
- Stress-test the "a task gate with `baseRef` ⇒ `pass`/`low`" case against risk rule a: with no
  `agent-rules.md` in the fixture, `sensitive === null` and rule a fires `NO_LIST_REASON` ⇒ `high`.
- Challenge the omission that task 5's prompt and `_Leverage` name a git fixture and the typecheck
  mock but never the `agent-rules.md` the pass/low outcome needs — while task 7 (e2e) does name it.

### 3. Task 6 — the dispatch exposure test (intra-document shape: mock coverage)
- Challenge the claim that a `gate` dispatch case "returns `data.gate`" using the cited
  `review-task.test.ts:63-113` fixture, which has no git repo and mocks only `computeTaskDiff`.
- Stress-test what the existing `vi.mock('../../core/task-diff.js')` covers: task 2 adds
  `computeRangeStats` to the same module, and the mock passes it through to the real implementation.

### 4. Tasks 8-9 — harness routing edits vs requirements 6-7 (coverage)
- Stress-test that every 6.1-6.8 / 7.1-7.7 clause has an edit: line-checked; the cited
  `SKILL.md`/`briefs.md`/agent line ranges all point at the sections the edits name.
- Challenge the `store`/`home` "no verifier whatever the risk" path: a `store` item runs the git
  path, scores `high` (no tsconfig ⇒ rule e), yet closes `ok` — design r4 already ruled this
  acceptable; tasks 8-9 preserve it. No new gap.

## Findings

### R1-1 — SHOULD_FIX — Task 5's "pass/low" integration case scores `high`: no `agent-rules.md` in the fixture
Task 5's prompt requires "a task gate with `baseRef` ⇒ `pass`/`low`, a review file with
`reviewer: gate`". For a task-mode gate, `handleGate` reads `agent-rules.md` (design.md Component 2
step 4): ENOENT ⇒ `sensitive = null`. Risk rule a (design.md Data Models, Risk rules) then fires on
`sensitive === null` with `NO_LIST_REASON`, so `risk` is `high` and no review is recorded. The
review-gate.test.ts fixture follows `src/tools/__tests__/review-task.test.ts:63-113`, whose
`beforeEach` (`:68-88`) creates only `<tempDir>/.spec-workflow/specs/test-spec` — it never writes
`<tempDir>/.spec-workflow/agent-rules.md`, which is where `getWorkflowRoot(workflowRoot)/agent-rules.md`
resolves. Task 5's `_Prompt` and `_Leverage` name the git helpers (`task-diff.test.ts:31-41`) and the
typecheck mock (`review-task.test.ts:13-20`) but never an `agent-rules.md` fixture. An implementer
following task 5 alone writes the pass/low case, runs it, and gets `high` with reason
`sensitive-paths: no list; every path is sensitive`. Task 7 (e2e) proves the omission: it explicitly
creates `.spec-workflow/agent-rules.md` naming `src/auth.ts` so its analogous low case (case 1)
passes. Fix: task 5 must name an `agent-rules.md` fixture (a `## Sensitive paths` list that does not
match the touched file) as a precondition for the pass/low case, and — for completeness — the
`record`-after-gate case (`version: 2`) has the same dependency.

### R1-2 — SHOULD_FIX — Task 6's dispatch test asserts `data.gate` against a non-git fixture; the natural task-mode call returns `success: false`
Task 6's prompt: "add one dispatch case to `review-task.test.ts` (a `gate` call reaches the handler
and returns `data.gate`...)", with `_Leverage` pointing at `src/tools/__tests__/review-task.test.ts:63-113`.
That fixture's `tempDir` is not a git repository (no `gitInit` in `beforeEach`, `:68-88`), and its
`vi.mock('../../core/task-diff.js', ...)` (`:31-38`) spreads `...actual` and overrides **only**
`computeTaskDiff` — task 2's new `computeRangeStats`, which `handleGate` step 5 calls, passes through
to the real implementation. The natural dispatch test uses the fixture's existing task `'1'`, i.e. a
task-mode gate; with `baseRef` unset the range is `{ baseRef: 'HEAD' }`, `computeRangeStats`'s repo
check (`git rev-parse --show-toplevel`) fails on the non-repo tempDir ⇒ `{ ok: false }` ⇒ `handleGate`
returns `success: false` with no `data.gate`. The asserted outcome is unreachable on the documented
happy path. The document even claims "no bridge to remove, task 5's direct-call test stays valid" but
never notes that the existing task-diff mock does not cover `computeRangeStats`. Fix: task 6 should
direct the dispatch case to a files-only item call (a `taskId` absent from `tasks.md` plus `files`,
which skips the git path per D23) so `data.gate` is produced with no git, or state that the case
needs `gitInit`/a `computeRangeStats` mock. (Escape exists, but the prompt as written traps the
natural reading.)

### R1-3 — MINOR — Task 1 cites `task-review-manager.test.ts:195-198` for the `toContain` frontmatter checks; the asserts are at :200-203
Task 1 says the round-trip suite "checks frontmatter with `toContain` (`:195-198`)". Lines 195-198 are
the raw-file read setup (`getReviewsDir`, `readdir`, `find`, `readFile`); the `toContain('verdict: fail')`
etc. assertions are at `:200-203`. The behavioural claim — that adding a `reviewer:` line breaks none
of them — is correct, so this is only an imprecise line range (mirrored from codebase-context:168).
Tighten to `:195-204` or `:200-203`.

## Top 5 risks/gaps

1. R1-1 — task 5's pass/low case is unreachable without an `agent-rules.md` fixture the prompt omits;
   the implementer's first test run fails `high`.
2. R1-2 — task 6's dispatch assertion (`data.gate`) is unreachable on the natural task-mode reading
   because the cited fixture has no git repo and the task-diff mock does not cover `computeRangeStats`.
3. R1-3 — a two-line-off citation in task 1 (MINOR, behaviour correct).
4. Not a defect, verified clean: R4-1/R4-2 are fully absorbed (tasks 2/4/5 and task 3), including the
   position-past-100 regression test.
5. Not a defect, verified clean: every design Component (1-10), Data Model, Error-Handling cause and
   Testing-Strategy item has exactly one owning task; the 1→10 dependency edges each carry the symbol
   the next task consumes.

## Top 3 conclusions to challenge

1. **"the full suite runs once, at the completion gate ... every existing suite green" (header).**
   Upheld for compilation and existing suites, but the *new* tests each task writes are not green on
   the first pass for tasks 5 and 6 (R1-1, R1-2). The guarantee should cover the tests the task itself
   adds, not only pre-existing ones.
2. **"task 5's direct-call test stays valid" and the task-6 note that nothing needs a bridge.**
   Reverse the implied completeness: task 6's new dispatch test is the weak point, not task 5's
   direct call — the existing `computeTaskDiff` mock silently fails to cover `computeRangeStats`.
3. **Nothing else rises to a reversal.** The `store`-item "score `high`, close `ok`" path and the
   node-24-probe/node-20-assert taxonomy are both design-settled (r4) and correctly inherited; the
   harness line citations for tasks 8-9 all hold.

## What's missing before acting

- Task 5: name an `agent-rules.md` fixture (a non-matching `## Sensitive paths` list) as a
  precondition for the pass/low and `record`-after-gate cases (R1-1).
- Task 6: specify the dispatch case as a files-only item call, or note the `gitInit`/`computeRangeStats`
  mock the task-mode reading needs (R1-2).
- Task 1: correct the `:195-198` line reference to the `toContain` block (R1-3). Non-blocking.
- Nothing else. Every code, harness and doc citation the document makes is accurate, and coverage of
  the design is complete.

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
