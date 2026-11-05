# Adversarial Analysis — eval-gate-runs/tasks (v1, round 1)

Primary surface: atomicity, ordering, coverage. Fresh lens: none. First review.

## What I checked and how

- Read the decomposition entry 35, requirements v2, design v1, and `agent-rules.md`.
- Read every cited code file at both ends of every range: `select.ts`, `runner.ts`,
  `gate.ts`, `cli.ts`, `scripts/sdd-self-update.sh`, `implementation.ts` (255-272, 672-678,
  850), `red-green.ts` (118-265), `lint-tasks.ts` (checkTestSeams), `docs/SDD-HARNESS.md`,
  and the five test files (`select`, `runner`, `gate`, `cli`, `service-scripts`).
- Re-verified the one lint-pass delta (`select.test.ts:158` → `:155-158`): line 155 is the
  `selectCases` call, line 158 is `expect(demo?.reasons).toEqual(['case'])`. Correct.
- Tallied every requirement AC against the tasks' `_Requirements`, ran the `fail-case\|3/3`
  and `three times\|3 runs\|3/3` greps the tasks name, and walked the 1→2→3→4→5→6 DAG.

**All citations are accurate.** Every line range, every `src/evals/*` symbol, every test
seam, every doc site resolves to the quoted artifact. No misstated-artifact MUST_FIX.

## Attack 1 — Task 5 routing (the one real defect)

- **Challenge the `- Test:` seam on task 5.** Task 5's own Note states "regression guard, not
  a red test … every criterion passes before this task", and its only `File:` is a test file
  (`src/__tests__/service-scripts.test.ts`). `agent-rules.md:176-178` is explicit: a task whose
  every AC is a regression guard "is marked implementer-only in the decomposition up front,
  with the verifier/test-author skip stated; the routing is not discovered mid-run."
- **Trace what the seam actually triggers.** The `- Test:` line makes `isTddMarked`
  (`implementation.ts:255-259`) return true, so the controller spawns the test author
  (`implementation.ts:663`) before anything else. The author cannot produce a red (behaviour
  holds at base; the dry-run test also needs a built tree it will not have in the no-build base
  worktree, `red-green.ts:142-159`), so it reports RED-IMPOSSIBLE and only then
  (`implementation.ts:672-678`) is the task re-routed implementer-only. That is precisely the
  mid-run discovery the rule forbids, and the test-author spawn is pure waste.
- **Note the tasks doc half-admits it.** The Note says "Expected route: the author reports
  RED-IMPOSSIBLE and the implementer writes the tests." Describing the wasteful route in prose
  is not the same as "marked implementer-only up front" — the author is still spawned.
- **Confirm the fix is lint-safe.** `checkTestSeams` (`lint-tasks.ts:337-344`) only emits
  `task-test-seam` when a task has a *source* file and no `Test:` line; task 5 has only a test
  file, so dropping the seam raises no lint finding. Fix: remove the `- Test:` line, state the
  test-author/verifier skip, let the implementer write the two guard tests directly.

## Attack 2 — Atomicity and ordering (holds up)

- **Stress-test the "no file is edited by two tasks" claim (header, D3).** Verified: the six
  file-pairs are disjoint (`select`, `runner`, `gate`, `cli`, `service-scripts`, `SDD-HARNESS`).
  So the within-task citations that get rewritten (`runner.ts:144`, `gate.ts:76`/`:96`,
  `gate.test.ts:369-371`) are never invalidated by a later task. Sound.
- **Stress-test the linear order against the real DAG.** Task 3 consumes task 1 (`plannedRuns`)
  and task 2 (`runsByCase`); task 4 consumes task 1 and task 3 (`onLine` on `RunGateOpts`);
  task 5 consumes task 4 (the CLI must already print counts for the dry-run guard). The chain
  1→2→3→4→5 respects every edge. Task 6 is independent. No missing edge, no cycle.
- **Challenge task 3 for over-size.** It carries the most sub-cases, but all are one component
  (apply the rule in the gate) and its Success clause enumerates each sub-case separately
  (3/1 step counts, record entries, `pass 3/3`+`pass 1/1`, `fail 0/1`, `inconclusive 0/1`,
  `passes 1/1`, `fail 2/3`, the `:369-371` and `:440` guards) per `agent-rules.md:89-93`.
  Not over-scoped.

## Attack 3 — Coverage and the count greps (clean)

- **Verify every AC lands in a task.** R1.1-1.7, R2.1-2.5, R3.1-3.7, R4.1-4.7, R5.1-5.3 and NFR
  Performance each appear in a task's `_Requirements`. NFR Reliability is a stated existing
  consequence, not a change, and needs no task. Every design Component 1-6 is named in a task
  `_Prompt`.
- **Stress the count-change grep rule (`agent-rules.md:70-74`).** The two tasks that rewrite
  count assertions supply the grep: task 3 gives `grep -n "fail-case\|3/3"`, task 6 gives
  `grep -n "three times\|3 runs\|3/3"`. I ran both: task 3's only changing summary assertion is
  `gate.test.ts:369-371` (the `:252`/`:261` summaries are the exit-2 override format, untouched;
  `:440` is a 3-run guard that stays); task 6's only fixed-count prose is `SDD-HARNESS.md:511`.
  Both greps are accurate. Task 2 is additive (new optional map, default unchanged), so it
  rewrites no existing assertion and needs no grep.
- **Check the `Test:`/`Success:` coverage (retro P7).** For tasks 1-4, every test named in the
  `Task:` body also appears in the `Success:` clause. Fine.

## Top 3 risks/gaps

1. **(SHOULD_FIX) Task 5 forces a wasted test-author spawn.** All-regression-guard task carries
   a `- Test:` seam → test author spawned → RED-IMPOSSIBLE → re-routed mid-run, contradicting
   `agent-rules.md:176-178`. Remove the seam; mark implementer-only up front.
2. (Not a defect) The `cli.test.ts:346-372` unbuilt-tree failure that tasks 4/5 build around is
   a pre-existing, out-of-scope condition correctly handled by the `npm run build` step and the
   scope note; it does not pollute task 4's red proof, whose new tests go red for the right
   reason (no `--base-dist`, stub `step`).
3. (Not a defect) The R4-AC5 equality test with no `--base-dist` yields select total 4 (added
   `case`=3 + unchanged `brief: base render unavailable`=1) = gate counter 4; consistent with
   design Error Handling 4.

## Top 3 conclusions to challenge

1. **"Expected route: the author reports RED-IMPOSSIBLE" (task 5 Note) is acceptable** — reverse
   it. The governing rule wants the author *skipped*, not spawned-then-discarded.
2. **"Each task leaves every existing suite green" (header)** — true only with the build step;
   fine as written, but the claim is unqualified while two tasks silently depend on
   `npm run build`. Leave as is (scope note covers it); not worth a change.
3. **Six tasks, one per component (D3)** — holds. The alternative (fold rule+runner into one
   task) would re-introduce a twice-edited file and moving citations; the split is correct.

## What's missing before acting

- Only the task 5 routing fix. Re-mark it implementer-only (drop the `Test:` line, state the
  skip). Everything else is implementation-ready.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
