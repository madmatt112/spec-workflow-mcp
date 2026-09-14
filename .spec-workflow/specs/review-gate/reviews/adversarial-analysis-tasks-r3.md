# Adversarial Analysis — review-gate/tasks (v3)

Round 3. Target: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/review-gate/tasks.md` (v3).
Read against `codebase-context.md`, `design.md` (v4), `requirements.md` (v4), the round-2 analysis
(`adversarial-analysis-tasks-r2.md`) and the rolling memory (`adversarial-memory-tasks.md`).
Primary attack surface: atomicity, ordering, coverage. Fresh lens for this round (prompt): a cold
read for internal contradictions plus a truth table of every stated test case — for tasks 2 through
10, tabulate the fixture inputs against the design's risk-rule and gate-rule tables (Data Models) and
confirm the asserted output is the one the rules produce, task 7 included.

## Delta attack (v3 Revision History), checked first

The v3 delta touched exactly two places, both in task 5's `_Prompt`:

- **R2-1 — Full precondition set for the pass/low and record-after-gate cases.** The `_Prompt` now
  reads: "no rule but a may sit armed — write a `tasks.md` task block that does not match
  `/\b(tests?)\b/i` (not the `review-task.test.ts:79-87` exemplar's 'Success: Tests pass' line) or
  else touch a path satisfying `isTestPath` (rule c), keep the diff non-empty and under 200 changed
  lines (rules b, d), mock typecheck (`:13-20`) to return `success-clean-full` or
  `unavailable-feature-disabled` (rule e), and leave hygiene unmocked so it cannot reject (rule g)."

  I walked all seven risk rules (design Data Models, `scoreRisk`) against the resulting fixture for a
  task-mode gate with `baseRef`:
  - a `sensitive-path`: `agent-rules.md` fixture has a `## Sensitive paths` bullet that does not match
    the touched file ⇒ `sensitive !== null` and no touched path matches ⇒ **does not fire.**
  - b `line-count`: diff < 200 changed lines ⇒ **does not fire.**
  - c `tests-not-touched`: task block does not match `/\b(test|tests)\b/i` ⇒ `taskNamesTests` false ⇒
    **does not fire.** (Confirmed `TEST_WORD_RE = /\b(test|tests)\b/i`, design Component 4; confirmed
    the leverage'd exemplar `review-task.test.ts:84` is literally `Success: Tests pass_`, so the
    parenthetical warning is correct — that block *would* arm rule c.)
  - d `no-diff`: diff non-empty ⇒ **does not fire.**
  - e `typecheck-unavailable`: mock returns `success-clean-full` or `unavailable-feature-disabled`;
    rule e fires only on `unavailable-other`/`timeout` ⇒ **does not fire.** (`feature-disabled` is the
    exempt state, AC 4.3.)
  - f `no-range`: `baseRef` supplied ⇒ **does not fire.** (Correctly omitted from the delta's list.)
  - g `hygiene-rejected`: hygiene unmocked, runs the real scan, which resolves rather than rejects ⇒
    **does not fire.**

  Gate rules (`decideGate`) for the same case: no `checks` passed ⇒ a `check-failed`/`check-timeout`
  cannot fire; `success-clean-full` carries no in-scope diagnostic (b); no `debugger` in the touched
  files (c); no `files` argument ⇒ no `file-outside-list` (d); not files-only ⇒ no
  `listed-file-missing` (e). Verdict `pass`, risk `low` is now **reachable.** R2-1 resolved.

- **R2-2 — The record-after-gate case names the intervening `prepare`.** The `_Prompt` now reads "a
  gate `pass`/`low`, then `prepare`, then `record` ⇒ `version: 2`". Walked it: the gate records a
  `reviewer: gate` review at version 1 and writes no marker (design step 9); `prepare` writes the
  `.prepare-<taskId>` marker and requires the impl log (present); `record` with `verdict: pass`
  consumes the marker and `getNextVersion` returns `max(1)+1 = 2`. Reachable. R2-2 resolved.

Both deltas are correct and no artifact is misstated. The delta is clean.

## Fresh-lens truth table — every asserted case, tasks 2–10

Tasks 2, 3, 4 assert git-plumbing, runner and pure-rule behaviour, not gate verdicts; each case maps
to design Components 5, 6 and 3–4 with no output the rules contradict (spot-checked root/merge/bad-ref
for task 2, timeout/`lastLine` for task 3, the per-row `it`s and the index-150 sensitive path for
task 4). Task 5's eight cases each tabulate to the asserted output (item gate ⇒ no review file;
files-only missing path ⇒ `fail`/`stats: null`/`skipped`/`{}` via gate rule e; extra touched path
with `files` ⇒ `file-outside-list` via gate rule d; Error Handling 1–6 ⇒ `success: false`; >100 paths
⇒ full `total` and rule a still `high` past position 100). Tasks 6, 8, 9, 10 assert schema/harness/doc
text and command exit codes, not gate verdicts; their citations align with `codebase-context.md`
(verified clean in rounds 1–2, delta did not touch them).

**Task 7 is the exception, and it repeats the R2-1 defect the delta just fixed in task 5** — see R3-1.

## Findings

### R3-1 — SHOULD_FIX — Compounding (on R2-1/R1-1) — Task 7's e2e cases 1 and 3 assert `pass`/`low` without stating the rule-c precondition on the fixture's own task blocks

Task 7's fixture is "`tasks.md` with tasks 1-3 `[-]`" (line 69) and nothing constrains the text of
those three task blocks. Two of its three cases, plus the closing coverage assertion, require the gate
to score **low** on a task-mode call, and that hinges entirely on rule c:

- **Case 1:** "`docs/a.md` logged, gate with `baseRef: C0` ⇒ `pass`, `low`, `recorded` set,
  `get-task-review` returns `reviewer: 'gate'`". `taskId: '1'` is in `tasks.md` ⇒ task mode. The
  touched path `docs/a.md` is not a test file (`isTestPath` false: no `.test.`/`.spec.` basename, no
  `__tests__`/`tests`/`test` segment). So risk rule c — "task mode, `taskNamesTests(block)`, and no
  touched path satisfies `isTestPath`" — fires the moment the fixture's **task-1 block contains the
  word `test`/`tests`**. It then scores `high`, `recorded` is `null`, and the assertions
  `recorded set` and `reviewer: 'gate'` both fail.
- **Case 3 re-gate:** "`docs/b.md` … re-gate with a passing check ⇒ `pass`, `recorded` set". Same
  structure on the fixture's **task-3 block**: `docs/b.md` is not a test path, so a `test`-naming
  task-3 block fires rule c and `recorded` is `null`.
- **Closing assertion:** "`specStatusHandler` ⇒ `data.reviewCoverage.reviewed === 3`" counts a review
  per completed task; if rule c bit task 1 or task 3, that count is 2, not 3, and the final assertion
  fails too.

This is the exact class of defect accepted as SHOULD_FIX for task 5 in rounds 1 (R1-1) and 2 (R2-1):
a test recipe that asserts a `low`/recorded outcome while under-specifying the risk-rule preconditions
the outcome depends on. Task 5 was corrected to name the full set; task 7 was not. The trap is
concrete, not theoretical — the repository's own fixture exemplar (`review-task.test.ts:79-87`, the
pattern the e2e author works from) carries `Success: Tests pass`, which matches
`/\b(test|tests)\b/i`; an author who reaches for that boilerplate for any of the three fixture tasks
turns cases 1, 3 and the coverage check red on the first run. The rolling memory flagged this precise
risk for re-check ("Task 7's e2e case 1 … confirm its task-1 block does not name tests").

**Fix:** task 7 must state, for the fixture `tasks.md`, that the task-1 and task-3 blocks do not match
`/\b(tests?)\b/i` (so rule c stays silent for the `docs/a.md` and `docs/b.md` `pass`/`low` cases) — or,
equivalently, that those cases touch a `isTestPath` path — mirroring the precondition task 5's
`_Prompt` now spells out. Case 2 is unaffected (rule a dominates on `src/auth.ts`).

Severity note: this is SHOULD_FIX, not MUST_FIX — it is an underspecified fixture, not a false claim
about the codebase, and a rule-c-fluent implementer might avoid the word by luck. But three assertions
silently depend on it and the document's own standard (twice-accepted) is to state it, so leaving it
unstated in task 7 while stated in task 5 is an inconsistency that costs a debug cycle.

## Topics attacked

### 1. The v3 delta — task 5's full-precondition rewrite (R2-1) and the `prepare` naming (R2-2)
- Challenge the claim that naming rules a,b,c,d,e,g makes the pass/low case reachable: walked all
  seven risk rules and all five gate rules against the fixture — verdict `pass`/risk `low` is now
  reachable, and rule f is correctly moot because `baseRef` is supplied. Delta sound.
- Stress-test the record-after-gate case's two-call-to-three-call fix: the gate leaves no marker,
  `prepare` supplies it, `record` yields version 2. Reachable. Delta sound.

### 2. Fresh-lens truth table across tasks 2–10, task 7 included
- Stress-test task 7's case 1 (`docs/a.md` ⇒ pass/low) against the risk-rule table: rule c fires on
  an unconstrained `test`-naming task-1 block. → R3-1.
- Stress-test task 7's case 3 re-gate (`docs/b.md` ⇒ pass/recorded) and the `reviewCoverage === 3`
  assertion: same rule-c dependency on the task-3 block. → R3-1.
- Verify task 7 case 2 does not depend on rule c: rule a (`sensitive-path: src/auth.ts`) dominates,
  `recorded: null`, and the fresh `prepare`/`record` correctly yields version 1 (no prior gate
  review). Clean.

### 3. Citation / artifact audit of the delta
- Verified `review-task.test.ts:84` is `Success: Tests pass_` (arms rule c, as the delta's
  parenthetical warns) and `agent-rules.md:43-52` is the six-bullet `## Sensitive paths` list. The
  `:13-20` typecheck-mock citation and the `TEST_WORD_RE` shape hold. No misstated artifact in the
  delta.

## Top 3 risks/gaps

1. **R3-1** — task 7's e2e cases 1 and 3 (and the `reviewCoverage === 3` close) assert a
   `low`/recorded outcome without constraining the fixture's task-1/task-3 block text, so rule c
   silently turns them `high` if any block names tests; the e2e is red on the first run.
2. Not a defect, verified: the v3 delta makes task 5's pass/low and record-after-gate cases reachable
   for the first time across three rounds (all seven risk rules and five gate rules walked).
3. Not a defect, verified: tasks 2–6 and 8–10 hold — every asserted case tabulates to the design's
   rules, and every delta citation is accurate.

## Top 3 conclusions to challenge or reverse

1. **Header: "every existing suite green … the full suite runs once, at the completion gate."** Upheld
   for existing suites (rounds 1–2 verified file-by-file). It still says nothing about the *new* e2e
   test being green on the first pass — the same blind spot that produced R1-1, R2-1 and now R3-1.
   Read the guarantee as covering existing suites only.
2. **Task 7's "tasks 1-3 `[-]`" fixture line.** Reverse the implied sufficiency: three case verdicts
   (`pass`/`low`/recorded ×2 plus `reviewed === 3`) depend on the *content* of those task blocks, not
   just their count and status. The line is under-specified exactly where task 5's `_Prompt` is now
   fully specified.
3. **Nothing else rises to a reversal.** The delta resolves R2-1/R2-2; task 5's remaining cases,
   task 6's dispatch, and the harness/doc tasks are correctly inherited and clean.

## What's missing before acting

- Task 7: state that the fixture's task-1 and task-3 blocks do not match `/\b(tests?)\b/i` (or that
  those cases touch a test-file path), so rule c stays silent for the `docs/a.md` and `docs/b.md`
  `pass`/`low` cases and for `reviewCoverage.reviewed === 3` (R3-1). This is the only outstanding gap;
  it mirrors the precondition already stated in task 5.
- Nothing else. The v3 delta is sound, every other task's asserted cases are reachable under the
  design's rules, and every code, harness and doc citation the document makes is accurate.

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
