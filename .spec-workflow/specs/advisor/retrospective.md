# Retrospective — advisor

Compiled 2026-10-27 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — A task's File: list excluded the only file that could satisfy its own design clause.**
  Task 14 asked the implementer to make `attachAdvice` clear `opinionStatus`, but that write is
  only safe inside `waits.ts`'s per-wait queue (design D19 / C7), which the File: list omitted.
  No edit within the listed files could pass the gate, confirmed across 2 fix rounds, until the
  supervisor amended tasks.md. Evidence: retro-log 2026-10-27T08:11:09Z; commits 6fd4606c, 503b89cd.
  Frequency: once. Cost: 2 fix rounds plus a supervisor tasks.md edit.
- **F2 — Vitest files couple to machine state.** Two suites pass or fail depending on a live
  dashboard on :5000 and on ambient `SPEC_WORKFLOW_SHARED_ROOT`/`WORKSPACE`. Evidence: deferrals
  d-b3d7382d, d-42e16315. Frequency: 2 suites. Cost: unknown (deferred, info-only).

## Product bugs found

- **F3 — Background embed job crashed and wiped the index on embedder failure.** The async
  embed path (chunks beyond the first 200) could throw mid-refresh and crash the job, discarding
  the index. Fixed by chunk-capping, crash-guarding the deferred job, and degrading to
  `meaning: off`. Evidence: commits 85aee31c, 47cefa01, d8a5c6ee. Frequency: once (multi-round).
  Cost: part of task 9's 4 fix rounds.
- **F4 — Synchronous embed path still rejected instead of degrading, half-implementing a design
  clause.** Design Error Handling #7 says a mid-refresh embedder failure keeps the index and
  returns `meaning: off`; fix round 2 guarded only the >200-chunk background path, leaving the
  common <=200 synchronous loop and the query embed unguarded. Caught at adjudication. Evidence:
  task 9 review v3, src/advisor/search/index.ts:226, search.ts:87. Frequency: once. Cost: 1 adjudication.
- **F5 — execDeploy detached spawn has no 'error' handler.** A missing deploy script would crash
  the dashboard server. Evidence: deferral d-de507c11. Frequency: once. Cost: deferred (info-only).
- **F6 — Advisor launch input omits gates; a real launchSpec would 400.** The confirm-route launch
  payload lacks gate fields real validation requires. Evidence: deferral d-1cadcc61. Frequency: once.
  Cost: deferred (info-only).

## Tool and MCP errors or deficiencies

None found.

## Harness defects

None found.

## Prompt misunderstandings

- **F7 — Implementer fixed only half of a two-part review instruction.** Task 9's v2 WARNING named
  "the background (and synchronous) embed"; the fix wrapped only the background half, so the same
  warning recurred in round 3 and went to adjudication. Evidence: task 9 review v3 (spec-compliance
  finding). Frequency: once, recurring across 2 rounds. Cost: an extra fix round plus the adjudication.

## Inefficiencies

- **F8 — Task 9 ran 4 fix rounds / 5 implementer spawns before adjudication.** A chain of
  index-crash and degrade-path fixes needed five passes. Evidence: retro-log 2026-10-27T05:48:30Z.
  Frequency: once. Cost: 5 implementer spawns, 4 rounds.
- **F9 — Regression tests were repeatedly written outside the declared test file, then folded back.**
  Three fix rounds existed only to move added tests into the task's declared file and budget (task 8,
  task 9, task 10). Evidence: commits 41a15f86, 721dcb94, 475de899. Frequency: 3 times. Cost: ~3 fix rounds.
- **F10 — Task 10 took 2 fix rounds / 3 spawns for a purely additive test fold.** Evidence: retro-log
  2026-10-27T06:24:13Z; task 10 review v2. Frequency: once. Cost: 3 implementer spawns.

## Documentation gaps

- **F11 — Task 2's count-change grep scoped "docs" but the File: list omitted the doc it touched.**
  The implementer edited docs/SDD-HARNESS.md (owned by task 18) and had to revert it. Evidence:
  retro-log 2026-10-27T03:30:33Z; commit 48ef3b41. Frequency: once. Cost: 1 fix round.
- **F12 — Task 19 was red-impossible on every criterion.** Criteria 2.2, 5.4, 4.4, 6.7, 10.3 could
  not be driven red first, so it was routed implementer-only. Evidence: retro-log 2026-10-27T15:22:20Z
  and 18:22:54Z. Frequency: once (5 criteria). Cost: 1 spawn, verifier skipped.

## Model behaviour

- **F13 — Partial-clause implementation under review pressure.** The model satisfied the literal test
  seam but not the full enumerated design clause until an adjudicator forced it (see F4/F7). Evidence:
  task 9 reviews v3→v4. Frequency: once. Cost: folded into the adjudication.

## Process deviations and rulings

- **F14 — Task 9 adjudicated after 3 fix rounds; narrow verdict pass.** Evidence: retro-log
  2026-10-27T05:48:30Z (ruling). Frequency: once. Cost: 1 adjudication.
- **F15 — Task 19 verifier-skipped (gate-only review).** Evidence: HANDOFF advisor — implementation,
  "Verifier-skipped: task 19". Frequency: once. Cost: none measured.

## Decisions the harness made for the human

- **F16 — Five findings were deferred rather than fixed, all owner harness.** execDeploy crash
  handler, launch-gates 400, two env-coupled test suites, three pre-existing durable-test failures.
  Evidence: deferrals d-de507c11, d-1cadcc61, d-b3d7382d, d-42e16315, d-99ea856a. Frequency: 5.
  Cost: carried forward.
- **F17 — Three pre-existing failing tests were allowed past the full-suite gate (D9).** Worse-than-
  baseline recorded, not blocked. Evidence: deferral d-99ea856a; agent-rules "Fixtures and live
  verification" D9. Frequency: once. Cost: merge proceeded.

## Repeat patterns

- **F1/F11 (File: list omissions)** also harness-evals F6 (task 11 fixture tree omitted) and
  worktree-review-signals F12 (setup step omits a path). References: this spec retro-log
  2026-10-27T03:30:33Z, 08:06:23Z; harness-evals/retrospective.md:38; worktree-review-signals/retrospective.md:89.
- **F12 (red-impossible criteria)** also harness-evals F7, verification-loop F1, tdd-task-loop F3.
  References: this spec retro-log 2026-10-27T15:22:20Z; harness-evals/retrospective.md:60;
  verification-loop/retrospective.md:99.
- **F2/F16/F17 (pre-existing / env-coupled test failures at the full-suite gate)** also
  dashboard-loop-views F3, dashboard-shell F2, harness-control-pane F7. References: deferrals
  d-99ea856a, d-b3d7382d, d-42e16315; dashboard-loop-views/retrospective.md:24;
  dashboard-shell/retrospective.md:14; harness-control-pane/retrospective.md:58.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | req 2, design 3, tasks 2 |
| Review rounds (docs) | req 2, design 3, tasks 1 |
| Fix rounds (impl) | 10 |
| Adjudications | 1 (task 9) |
| Escalations | 1 (task 9 adjudication) |
| Rulings | 1 (task 9 narrow pass) |
| Deferrals added | 5 |
| Spawns | 90 |
| PR | #180 (merged) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  Eval case: <case id — what its grader checks | none — why>. Required when Target is
  harness skills or agents, or server code, docs or templates.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs' findings,
each proposed for promotion into a steering document or agent-rules.md, with the rule text as
it would be written.
