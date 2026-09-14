# Adversarial Analysis — review-gate/tasks (v2)

Round 2. Target: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/review-gate/tasks.md` (v2).
Read against `codebase-context.md`, `design.md` (v4), `requirements.md` (v4), the round-1 analysis
(`adversarial-analysis-tasks.md`) and the rolling memory (`adversarial-memory-tasks.md`).
Primary attack surface: atomicity, ordering, coverage. Fresh lens for this round: the cost of
touching an existing component — for every existing file a task edits, read the suite that covers it
and judge whether the task names the right exact-value assertions and leaves every existing suite
green at that step. (Round 1 spent sub-agent-with-only-the-prompt and intra-document shape.)

## Delta attack (v2 Revision History), checked first

The v2 delta touched exactly three places. Each re-read against the code:

- **Task 1 citation (`:195-198` → `:200-203`, R1-3).** VERIFIED CORRECT. `task-review-manager.test.ts:200-203`
  are the four `expect(content).toContain(...)` frontmatter assertions (`criticalCount: 1`,
  `warningCount: 1`, `infoCount: 1`, `verdict: fail`); `:195-198` is the file-read setup. A new
  `reviewer:` line after `verdict:` (`reviewToMarkdown` line 195) is inserted between `verdict:` and
  `timestamp:`, breaks no substring match. R1-3 resolved. No new finding.

- **Task 6 dispatch case → files-only item call (D23, R1-2).** VERIFIED SOUND. In the files-only path
  (`filesOnly = mode==='item' && !commit && !baseRef && files.length>0`, design step 3) `handleGate`
  skips `computeRangeStats` (step 6), so the exact defect round 1 raised — the existing
  `vi.mock('../../core/task-diff.js')` overriding only `computeTaskDiff` (`review-task.test.ts:31-38`)
  while the real `computeRangeStats` runs — no longer bites: `computeRangeStats` is never called on
  this path. `taskId` absent from the fixture `tasks.md` (tasks `1`,`2` at `:79-87`) → item mode; the
  test asserts only that `data.gate` is present, satisfied whether rule e fires (`gate: fail`) or not.
  Needs no git repo, no typecheck/hygiene mock (files-only sets `typecheck:{kind:'skipped'}`,
  `hygiene:{}`). R1-2 resolved. No new finding.

- **Task 5 prompt → `agent-rules.md` fixture for the pass/low and record-after-gate cases (R1-1).**
  PARTIALLY RESOLVED — see R2-1. The delta fixes rule **a** (sensitive-paths) but the same pass/low
  outcome is still gated by risk rules **c** and **e**, which the delta's own reasoning leaves
  unaddressed.

## Fresh-lens sweep — existing suites each task edits

- **Task 1** edits `src/types.ts`, `src/core/task-review-manager.ts` and extends
  `task-review-manager.test.ts` + `get-task-review.test.ts`. Grepped the whole `src/**/*.test.ts`
  tree: no test does a deep/`toEqual`/snapshot on a parsed `TaskReview` or on review frontmatter;
  `get-task-review.test.ts:34-95` checks fields one-by-one with `.toBe`, none named `reviewer`;
  the round-trip suite (`:200-203`) is `toContain`; dashboard review tests
  (`task-review-runner.test.ts`, `multi-server.test.ts`) key on rendered strings / POST job status,
  not the review object shape. Adding `reviewer?: 'gate'|'agent'` and a `reviewer:` frontmatter line
  breaks nothing. Task 1's "neither asserts a value this change alters" holds. Clean.
- **Task 2** extends `task-diff.test.ts`. `gitInit`/`gitCommitAll` are at `:31-41`, `installPassthrough`
  at `:43` (both verified); `computeTaskDiff` cases start `:76`. The new export is additive; no
  existing case changes. Clean.
- **Task 6** edits `review-task.ts` + extends `review-task.test.ts`. Confirmed the schema enum
  (`:179-183`), properties (`:178-223`), Two-actions bullets (`:160-162`), dispatch (`:251-260`),
  `required` (`:224`) and the unknown-action string (`:258`) are where the task says. No test in
  `review-task.test.ts` asserts the schema, the description or the unknown-action text, so the D32
  message reword and the added `gate` enum value break nothing. Clean.
- **Task 7** reads `spec-status.test.ts:80-89` as a fixture pattern only and reaches
  `specStatusHandler`; review coverage counts via `getLatestReview`, unaffected by `reviewer`. Clean.

The fresh lens produced no new defect: every existing suite stays green at its step. The one live
gap is in the *new* test recipe task 5 writes, below.

## Findings

### R2-1 — SHOULD_FIX — Compounding (on R1-1) — Task 5's pass/low case is still unreachable: rules c and e gate it, and the R1-1 delta names only rule a

Task 5's `_Prompt` now says to use an `agent-rules.md` fixture "whose `## Sensitive paths` entry does
not match the touched file (so `sensitive` is not `null` and rule a does not fire) for the pass/low
and record-after-gate cases." That reasoning is complete for **rule a** and stops there. But for a
task-mode gate to return `pass`/`low`, `scoreRisk` (design Data Models, Risk rules) must find *no*
rule firing — and two more rules fire on the natural fixture:

- **Rule c `tests-not-touched`** fires when "task mode, `taskNamesTests(block)`, and no `touched`
  path satisfies `isTestPath`." `taskNamesTests(block) = /\b(test|tests)\b/i.test(block)` over the
  task's block in the fixture `tasks.md`. Task 5's `_Leverage` points the implementer at
  `src/tools/__tests__/review-task.test.ts:13-20, :94-112`; the companion fixture `tasks.md` in that
  file (`:79-87`) reads `_Prompt: Task: Build it | Restrictions: No new deps | Success: Tests pass` —
  the block contains the word **"Tests"**, so `taskNamesTests` is `true`. If the pass/low case then
  commits a non-test file (the e2e's analogue, case 1, commits `docs/a.md`), no touched path is a
  test file and **rule c fires ⇒ `risk: high`, no review recorded** — the exact failure mode R1-1
  described for rule a, one rule over.
- **Rule e `typecheck-unavailable`** fires when the worst typecheck state is `unavailable-other` or
  `timeout`. The recipe says "typecheck mocked per `:13-20`" but never pins the mock's return for the
  pass/low case; a mock returning `unavailable`/`timeout` (or a rejection, which `unwrapTypecheck`
  degrades to `unavailable-other`) scores `high`. The pass/low case needs the mock to return a clean
  `success` or `feature-disabled`.

So the v2 fix is incomplete: the same leverage'd exemplar that trapped on rule a (now fixed) still
traps on rule c, and the recipe under-specifies the typecheck mock for rule e. An implementer
following task 5 writes the pass/low case, runs it, and gets `high` with reason
`tests-not-touched: task names tests; no touched path is a test file`. Fix: task 5 must state the
pass/low (and record-after-gate) fixture precondition for **all** the risk rules the outcome depends
on — a task block that does not match `/\b(tests?)\b/i` (or a touched path that is a test file), the
change under 200 lines (rule b), a non-empty diff (rule d), a typecheck mock whose worst state is not
`unavailable-other`/`timeout` (rule e), and a hygiene result that does not reject (rule g) — not rule
a alone. Requirement 5.1 and design D28 both hinge on this case actually recording, so this is a real
rework gap, not wording.

### R2-2 — MINOR — Novel — Task 5's "record after a gate review ⇒ version 2" omits the intervening `prepare`

Task 5's `_Prompt` lists "`record` after a gate review ⇒ `version: 2`" as a case. Design step 9 states
the gate writes and checks **no** prepare marker, and `handleRecord` refuses without one
(`review-task.ts:532-539`; the existing test `review-task.test.ts:273-281` pins that a bare `record`
returns `success: false` with a `prepare` message). So a literal two-call reading (gate, then record)
fails; the case actually needs gate → `prepare` (writes the marker) → `record` (version 2). The
existing prepare-before-record contract is well-known and tested, so a competent implementer will
insert `prepare`; requirement 5.6 frames this as "as re-review does today," which includes it. Left
as a MINOR because the recipe's shorthand can mislead a literal reader. Tighten the case to name the
`prepare` call, mirroring what task 7's e2e case 2 already spells out ("`prepare`/`record`").

## Topics attacked

### 1. The R1-1 delta (task 5's `agent-rules.md` fixture) — completeness of the pass/low precondition
- Challenge the delta's claim that naming a non-matching `## Sensitive paths` entry makes the pass/low
  case reachable: it silences rule a only; rules c and e still fire on the leverage'd exemplar. → R2-1.
- Stress-test the record-after-gate sub-case: it inherits the same rule-c/e trap for its own gate,
  plus the missing `prepare`. → R2-1, R2-2.

### 2. The R1-2 delta (task 6's files-only dispatch) — does files-only truly avoid the mock hole
- Verified: files-only skips `computeRangeStats`, so the unmocked new export never runs; the dispatch
  test needs no git and no pre-computation mocks; `data.gate` is produced. Delta sound. No finding.

### 3. Fresh lens — existing suites vs. the new `reviewer` field / new dispatch enum
- Verified no existing test asserts a review-object shape or review frontmatter by equality, and no
  test asserts the review-task schema/description/unknown-action text; every edit is additive at its
  step. Task 1's and task 6's "existing suite green" claims hold. Clean.

### 4. Citation audit of the delta
- Task 1's `:200-203`, task 6's `:179-183/:178-223/:224/:251-260/:258`, task 5's
  `getWorkflowRoot`/`agent-rules.md` location, task 7's `adversarial-settings.ts:54-57/:195-197` and
  `path-utils.ts:208-210` all re-read at both ends and hold. No misstated artefact.

## Top 3 risks/gaps

1. **R2-1** — task 5's pass/low case scores `high` on rule c (and possibly e) even after the R1-1
   fix; the recorded-review case (Req 5.1, D28) never records on the natural fixture, so the
   integration test the task promises is red on the first run.
2. **R2-2** — the record-after-gate sub-case omits the mandatory `prepare` call between gate and
   record; a literal reading returns `success: false`.
3. Not a defect, verified clean: the R1-2 and R1-3 deltas fully resolve their round-1 findings, and
   the fresh-lens sweep found no existing suite that the `reviewer` field or the `gate` enum breaks.

## Top 3 conclusions to challenge or reverse

1. **"so `sensitive` is not `null` and rule a does not fire" (task 5 `_Prompt`, the v2 delta).**
   Reverse the implied completeness: silencing rule a does not make the pass/low outcome reachable;
   rules c and e gate the identical outcome and are armed by the very exemplar task 5's `_Leverage`
   cites. The delta fixed one of three obstacles.
2. **Header: "every existing suite green" at each step.** Upheld for the *existing* suites (verified
   file-by-file). But the guarantee still says nothing about the *new* tests each task adds being
   green on the first pass — the same blind spot round 1 named, now live again for task 5's pass/low
   case (R2-1). The header should not be read as covering the new integration test.
3. **Nothing else rises to a reversal.** The files-only dispatch design, the additive `reviewer`
   field, and the harness routing edits (tasks 8-9, no `src/` test coverage per codebase-context:184,
   design-settled D35) are correctly inherited.

## What's missing before acting

- Task 5: state the pass/low (and record-after-gate) fixture precondition for every risk rule the
  outcome depends on — a task block not matching `/\b(tests?)\b/i` or a touched test file (rule c), a
  clean/`feature-disabled` typecheck mock (rule e), a sub-200-line non-empty diff (rules b/d), a
  non-rejecting hygiene result (rule g) — not rule a alone (R2-1).
- Task 5: name the `prepare` call in the record-after-gate case, or state the gate leaves no marker so
  the record path needs one (R2-2).
- Nothing else. Every code, harness and doc citation the document makes is accurate; the R1-2/R1-3
  deltas are resolved; the fresh-lens pass over existing suites is clean.

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
