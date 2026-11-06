# Retrospective plan — dashboard-deploy

Status: APPROVED
Date: 2026-11-06

## Approved proposals

- **P1 (F1) — Deploy POST proxy-Origin gap was anticipated, no change.** The decomposition already carried the vite dev-proxy Origin rewrite (agent-rules 188-191, fixed 4064229c), so task 9/13 paid no rediscovery cost. The rule did its job.
  Target: none (project steering already carries it).
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P2 (F2) — A test that needs a built `dist/` must provision it, not assume it.** `service-scripts.test.ts` imports this repo's own `dist/evals/cli.js`, which is gitignored and absent in the gate env, so it failed on a missing artifact rather than on code. Make the test build (or stub) the one entry it needs in `beforeAll` rather than assuming a prior `npm run build`.
  Target: server code (`src/__tests__/service-scripts.test.ts`).
  Effort: M. Risk: medium: an on-demand build in a unit test is slow and can mask a real build break; a stub wrapper is fast but drifts from the real CLI.
  Prerequisites: none.
  Eval case: new red-green/service-scripts unit case — the select-counts test passes in a checkout with no pre-built `dist/`.
  DECISION NEEDED: yes. How should a dist-dependent test get its artifact?
  - Option A (recommended): the test builds or stubs only `dist/evals/cli.js` it imports, in `beforeAll` — self-contained, no gate-env change.
  - Option B: `worktree-setup` gains an `npm run build` step for specs whose tasks touch `src/evals` — fixes the whole class but adds build time to every such run.
  - Option C: commit a checked-in fixture CLI the test uses instead of the real `dist/` — fast, but a second copy to keep in sync.

- **P3 (F3) — The TDD gate must not run a task-authorized config support file as a test.** `red-green.ts`/`gate-rules.ts` put `playwright.worktree.config.ts` into `testFiles`, vitest ran it, found no tests, and the head run reported `fail` / author-changed-source. Add a classifier case: a `*.config.{ts,js,cts,mts,cjs,mjs}` support file that appears in the task's `File:` list is neither a test to run nor an author-changed-source violation — exclude it from `testFiles` and from `sourcePaths`. This is the single highest-cost finding (~815k tokens, 5 spawns).
  Target: server code (`src/core/gate-rules.ts`, `src/core/red-green.ts`).
  Effort: M. Risk: medium: broadening the exclusion could let a genuinely source-bearing config edit slip the source gate; scope the exemption to basenames matching `*.config.*` that are also in the task File: list.
  Prerequisites: none.
  Eval case: new `gate-rules`/`red-green` unit case — a red commit touching `foo.config.ts` listed in `File:` yields `head:not-run`-benign (no head:fail, config not in testFiles, not in sourcePaths).
  DECISION NEEDED: no.

- **P4 (F4) — Add an identical-repeat circuit-breaker so an unfixable gate failure escalates sooner.** Task 13 repeated three byte-identical fix rounds before adjudication because no implementer edit could change the verdict. P3 removes this instance; independently, when two consecutive fix rounds produce an identical gate diff/verdict, the orchestrator should escalate to the adjudicator rather than spawn a third implementer.
  Target: harness agents (implementation orchestrator / fix-round loop).
  Effort: M. Risk: low: escalating one round earlier saves a spawn; worst case is a slightly premature adjudication.
  Prerequisites: P3 (removes the triggering class).
  Eval case: new orchestrator eval — two identical fix-round verdicts route to adjudicate, not a third implementer spawn.
  DECISION NEEDED: no.

- **P5 (F5) — Requirements' five rounds were variance, not a named defect; no change.** Design converged in three, should-fix-only; requirements is the normally-heaviest phase and no single recurring cause surfaced. One-off.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — no cause to fix.
  DECISION NEEDED: no.

- **P6 (F6) — Task 11's unnamed branch is covered by the existing sub-case rule; no new change.** `execDeploy` spawning regardless of stage was a distinct sub-case the Success line did not name, so no red test existed. agent-rules 89-93 already requires each distinct sub-case be named for separate red-testing; retro P10 wrote the guard. The rule, applied, would have caught it. One-off.
  Target: none (agent-rules 89-93 already governs it).
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — covered by existing rule.
  DECISION NEEDED: no.

- **P7 (F7) — Task 14 was routed implementer-only correctly; the rule worked.** An author/report task red-impossible on every criterion is exactly the case agent-rules 181-183 pre-marks implementer-only. It was routed up front, not discovered mid-run. No change.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — rule functioned.
  DECISION NEEDED: no.

- **P8 (F8/F11) — Stop re-logging the decision-C unreviewed-final-task merge; extend the rule to cover a fully-unreviewed task.** agent-rules 184-187 blesses a final task that is gate-reviewed but verifier-skipped (reviewCoverage N−1) and says not to re-log it, yet task 15 was unreviewed entirely (14/15, no review at all) and the compiler logged it again — as it did in run-pause and lean-orchestrators. Extend 184-187 to state that a final implementer-only / regression-guard task may close reviewCoverage at N−1 with no review under decision C, and the compiler does not re-log it.
  Target: project steering (`agent-rules.md` 184-187) and harness agent (sdd-retro-compiler routing).
  Effort: S. Risk: low: scoped to the final task only; mid-spec unreviewed tasks still surface.
  Prerequisites: none.
  Eval case: new retro-compiler eval — a spec whose only unreviewed task is the final implementer-only task produces no decision-C finding.
  DECISION NEEDED: yes. What counts as acceptable for the merged final task?
  - Option A (recommended): gate-review OR implementer-only routing is enough; a fully-unreviewed final implementer-only task merges and is not re-logged.
  - Option B: require at least a gate review on the final task; a task with no gate review at all still blocks or logs.
  - Option C: leave the rule as-is and stop the compiler re-logging only when the routing was declared up front.

- **P9 (F9) — Task 13's narrow pass (0 fixed, 3 ruled out) is the correct outcome of an artifact failure; no change beyond P3.** The adjudicator rightly ruled the three gate findings artifacts. P3 prevents the artifact from arising; the adjudication path itself behaved as designed.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: P3.
  Eval case: none — covered by P3.
  DECISION NEEDED: no.

- **P10 (F10) — Eight verifier-skipped tasks were intended routing; no change.** Gate-only review on regression-guard / implementer-only tasks per retro P6/P15 is the designed spend-saver. Working as intended.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — intended behaviour.
  DECISION NEEDED: no.

- **P12 (F12) — Task 6's reused regression guard was correctly noted, not forced; no change.** Reusing a pre-existing test for regression-guard AC#4 is what tdd-regression-guard (agent-rules 9) allows; logging it as an info deferral (d-64ce8349) is the right disposition. Nil cost.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — rule functioned.
  DECISION NEEDED: no.

## Decisions

- P2: How should a dist-dependent test get its artifact? → the test builds or stubs only `dist/evals/cli.js` it imports, in `beforeAll` — self-contained, no gate-env change.
- P8: What counts as acceptable for the merged final task? → gate-review OR implementer-only routing is enough; a fully-unreviewed final implementer-only task merges and is not re-logged.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P1: skipped — no change chosen
- P5: skipped — no change chosen
- P6: skipped — no change chosen
- P7: skipped — no change chosen
- P9: skipped — no change chosen
- P10: skipped — no change chosen
- P12: skipped — no change chosen
- P8: done — a1413a0e03386ee3da69b80912c84436ce626066
