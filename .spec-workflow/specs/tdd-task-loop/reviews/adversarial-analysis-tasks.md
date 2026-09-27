# Adversarial Analysis — tdd-task-loop/tasks (v1), Round 1

Attack surface this round: **atomicity, ordering, coverage**. Fresh lens: **the sub-agent
that receives only one task's `_Prompt:` line** (plus its `_Leverage:` citations and the merged
code of the tasks it names). First review of this document.

## Delta since the checkpoint (3622b99)

The only change from the `docs(sdd): tdd-task-loop tasks v1` checkpoint to the working tree is
the Revision-History lint-pass note: `0 fixed; rejected L-1..L-39`. Those 39 are the documented
`citation-identifier` false-positive class — the skip-regex `/^\s*_(?:Leverage|Prompt):/`
(`src/core/lint-citations.ts:75`) does not match the template's indented `  - _Prompt:` sub-bullet
form, so the check scans prompt tokens naming to-be-built symbols (`tests`, `tdd`, `tddCoverage`,
`redTests`, `redCommit`, `testFiles`, `seams`) or JS literals (`null`, `json`, `parse`,
`stringify`, `finally`). Deferral `d-53b7f443` owns the fix. I spot-checked the prompt lines that
DO name existing symbols (`runOne`, `runChecks`, `isDocPath`, `saveReview`, `runGit`, `criteria`)
and each sits beside a valid range citation that contains it, so it draws no warning. Not re-filed.

## Topics attacked, grounded

### 1. Coverage — every design component → a task, every task → a real requirement
- Mapped all 13 design Components to tasks (C1→T2, C2→T1+T3, C3→T4, C4→T10+T13, C5→T10+T14,
  C6→T5, C7→T1+T7, C8→T9, C9→T6, C10→T11+T12, C11→T8, C12→T14, C13→T13+T15). No orphan component.
- Mapped every acceptance criterion of R1–R9 to a citing task. No AC unclaimed; no task cites a
  non-existent id. `coverage-component` and `task-requirement-id` also passed the pre-fix lint run.
- Verdict: coverage is complete.

### 2. Ordering — the "no task needs a bridge" claim (D3, opening paragraph)
- Walked every inter-task edge. Every dependency points **backward**: T2→T1; T3→T1,T2; T7→T5,T6;
  T8→T6; T9→T1,T6,T7,T8; T10→T2; T11→T6; T12→T6; T14→T10,T13 (runtime, markdown). No task consumes
  a later task's artifact, so no cast/stub bridge is introduced or left un-removed. D3 holds.
- Confirmed no import cycle: `lint-tasks`(T3)→`task-parser`(T2)→`gate-rules`(T1)→types only.

### 3. Atomicity — the two outsized tasks (T7 proof, T9 gate wiring)
- Both are large but each is a single cohesive unit (`red-green.ts`; `handleGate`). Splitting
  either would create the exact bridge D3 avoids. The 150-word block cap excludes the prompt, and
  the blocks are within it. Acceptable.

### 4. Fresh lens — single-prompt sub-agent, cross-task symbols, "no assertion changes value"
- Every prompt that leans on a symbol another task creates names that task (T3 "the function task 2
  exports"; T9 "the proof (task 7)", "key reader task 1 exports"; T7 "captured runner task 5
  exports"). Exact symbol names defer to design Components 1/7/11, which pin them.
- Verified the load-bearing "no existing assertion changes value" claims against the real tests:
  - T3: `spec-lint.test.ts:107` compares `data.checks` to the **constant** `CHECKS_BY_PHASE.tasks`,
    so adding `task-test-seam` keeps it true; `spec-lint.e2e.test.ts` totals 3/0 hold because the
    BROKEN and CLEAN task fixtures (lines 101-108, 127-134) carry **no `File:` and no `Test:` line**,
    so the new rule fires nothing. Confirmed by reading both fixtures.
  - T10: `harness.test.ts:272` `endsWith('\n\n' + section)` holds because the empty `redTests` slot
    precedes the appended `## Code graph` section; `harness.test.ts:170-172` `toContain(taskBlock)`
    holds. Confirmed `GRAPH_BASE_VALUES.implementer = { title: 'T' }` (line 253) passes no `redTests`.
  - T6: the raw-file lookup `files.find(f => f.startsWith('review-'))` (`task-review-manager.test.ts:197`)
    never picks the `.tdd-<id>.json` sidecar; the marker sanitiser at TRM:71-76 is reused as claimed.
  - T2: `task-parser-progress.test.ts` and `task-validator.test.ts` hold **zero** `- Test:` bullets.
  - T9: the path/hygiene checks at `review-gate.test.ts:142,170,339` are all no-`tdd` cases and stay true.
- The document consistently hedges non-exhaustive lists ("widen that list to every assertion the
  change touches" in T3, T9, T13), defusing the exhaustive-list trap.

### 5. Gate B / Gate C
- No task adds a runtime dependency. T8 explicitly forbids it and asserts
  `git diff --stat package.json package-lock.json` prints nothing; its `npm pack @typesafe-ai/sdk`
  is a read-only wire-confirmation into `/tmp/scratchpad`, not an install. No `[gate-b]`.
- No task exceeds the approved requirements. No `[gate-c]`.

## Findings

**R1-1 (MINOR).** Task 11 cites the review-coverage loop as `src/tools/spec-status.ts:184-191`;
the `for (const task of completedTasks)` header is actually line **183** (body 184-191). Off-by-one
on the loop start; the referenced body is correct. No rework.

**R1-2 (MINOR).** Task 1's action line says "move the documentation-path test into the rules
module," but there is no direct `isDocPath` unit test to move — `isDocPath` is a private function
today, exercised only by the docs-only integration test at `review-gate.test.ts:350`, which stays.
The `_Prompt` correctly describes it as *adding* `isDocPath` cases to `gate-rules.test.ts`. Wording
only; the intent and the "no assertion changes value" claim are both accurate.

## Top risks/gaps

None material. Coverage, ordering and atomicity are sound; ~45 code citations were confirmed at
both ends and every one resolved. The two items above are cosmetic.

## Top conclusions — challenged, and why they survive

1. **"No task needs a bridge" (D3).** Challenged by walking every edge; confirmed — all
   dependencies are backward and named. Survives.
2. **"No existing assertion changes value" (T3/T6/T9/T10).** The highest-risk claim, since a new
   lint rule and new response fields touch shared fixtures. Challenged by reading the actual
   fixtures/tests; confirmed the fixtures lack `File:`/`Test:` lines and the constant-comparison and
   graph-suffix tests are structurally immune. Survives.
3. **Judge stays a shadow with no dependency or secret leak (T8).** Challenged against R7.9 and the
   cache path; confirmed the key is env-only, never written, and no SDK enters `package.json`.
   Survives.

## What's missing before acting

Nothing blocking. The live criteria (R9.1/9.3/9.5) are correctly deferred to the task-16 evidence
record for an operator on a rebuilt, restarted session with the Jev key; the judge-wire confirmation
(T8) is correctly gated so an unconfirmed wire only holds the judge half of the evidence pending.
Both are stated risks the plan already carries, not gaps.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
