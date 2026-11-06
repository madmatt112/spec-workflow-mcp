# Retrospective — dashboard-deploy

Compiled 2026-11-06 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Deploy POST routes need the vite dev-proxy Origin rewrite, and the decomposition anticipated it.** Task 9 added mutating `/api/controller/deploy` POST routes and task 13 a worktree e2e; neither rediscovered the proxy-Origin gap mid-run, because agent-rules already pins it (fixed 4064229c). A planned cost, not a surprise. Evidence: agent-rules.md:188-191; review-9 v2; review-13 v1. Frequency: once. Cost: nil (avoided).

## Product bugs found

None found. Every task was TDD against new code; task 9's 401-auth case was a noted regression guard, not a defect. Evidence: review-9 v2 summary.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F2 — Gate run environment lacked a built `dist/`, failing a test on an uncommitted artifact.** Task 7's `service-scripts.test.ts` select-counts test needs this repo's own `dist/evals/cli.js`, which is gitignored and absent in the gate env; building dist locally made all 23 tests green with no code change. Evidence: retro log 2026-11-05T21:27:30Z (harness-defect); task-7 log b0f70f3e; review-7 v1→v2. Frequency: once this spec; seen in eval-gate-runs too. Cost: 1 fix round, 1 extra implementer spawn.
- **F3 — TDD gate treats a task-authorized non-test config in the red commit as a test (false head:fail).** `red-green.ts`'s isTestPath/testFiles dispatch has no case for a `*.config.ts` support file the task's File: list legitimately requires the test author to edit (D27, agent-rules 94-98); `playwright.worktree.config.ts` landed in testFiles, vitest ran it, "No test files found" → spurious head:fail / author-changed-source / inconclusive. Three identical rounds, then adjudicated. Evidence: deferral d-ae7a5d40; retro log 2026-11-05T23:21:38Z and 23:28:20Z (harness-defect); review-13 v1 summary. Frequency: 3 rounds this spec; seen in dashboard-loop-views and run-pause (config-in-gate class). Cost: 4 fix rounds, 5 implementer spawns + 1 adjudicator spawn (~815k tokens).

## Prompt misunderstandings

None found.

## Inefficiencies

- **F4 — Task 13 burned four rounds plus adjudication on a gate failure no code could fix.** The false head:fail (F3) was unfixable by any implementer edit, so three rounds repeated identically before escalation resolved it as an artifact. Evidence: retro log 2026-11-05T23:37:28Z (inefficiency); harness-events adjudicate task 13 815468 tokens. Frequency: once. Cost: 5 implementer spawns, 1 adjudication, ~2h wall.
- **F5 — Requirements took five rounds and an adjudication to converge.** The heaviest document phase; design converged in three, should-fix-only. Evidence: HANDOFF requirements (5 rounds, adjudicated, approval_1793898936916_j40cj764f); harness-events adjudicate v4 (requirements, 476k tokens). Frequency: once. Cost: 1 extra adjudicator spawn.

## Documentation gaps

- **F6 — Task 11 was red-impossible: base `execDeploy` reads no record and spawns regardless of stage.** No existing assertion named that branch (only the "no record" case was asserted), so the guard was written fresh per retro P10. Evidence: retro log 2026-11-05T22:36:30Z (doc-gap); task-11 log. Frequency: once. Cost: 1 spawn.
- **F7 — Task 14 was red-impossible on every criterion (author/report task), routed implementer-only.** Evidence: retro log 2026-11-05T23:37:35Z (doc-gap); HANDOFF Verifier-skipped. Frequency: once. Cost: 1 spawn.

## Model behaviour

None found.

## Process deviations and rulings

- **F8 — Task 15 merged logged but unreviewed; merge allowed under decision C.** reviewCoverage closed 14/15, task 15 completed without a review, and the completion gate proceeded per retro P9. Evidence: retro log 2026-11-06T00:17:37Z (deviation); HANDOFF "reviewCoverage 14/15 (unreviewed: 15)". Frequency: once this spec; seen in run-pause and lean-orchestrators. Cost: 1 unreviewed task shipped.
- **F9 — Task 13 adjudicated: narrow verdict pass, 0 fixed, 3 ruled out.** After three fix rounds the adjudicator ruled the three gate findings artifacts and passed the task. Evidence: retro log 2026-11-05T23:37:28Z (ruling); harness-events note "ruled out 3". Frequency: once. Cost: see F4.
- **F10 — Eight tasks verifier-skipped (gate-only review).** Tasks 1, 2, 3, 4, 11, 12, 14, 15 took gate-only review per retro P6/P15 (regression-guard / implementer-only routing). Evidence: HANDOFF Verifier-skipped line. Frequency: 8 this spec. Cost: verifier spawns saved (intended).

## Decisions the harness made for the human

- **F11 — The completion gate merged the unreviewed task 15 without asking.** It applied decision C / retro P9 rather than blocking on the review-coverage gap, logging the choice. Evidence: retro log 2026-11-06T00:17:37Z "merge allowed (decision C)". Frequency: once; seen in run-pause (F12) too. Cost: 1 unreviewed task merged.
- **F12 — Task 6 regression-guard #4 reused a pre-existing test instead of a fresh guard.** The harness logged it as an info-finding deferral rather than forcing a new guard. Evidence: deferral d-64ce8349; retro log 2026-11-05T21:08:42Z. Frequency: once. Cost: nil (noted).

## Repeat patterns

- **F2 repeats the gate dist/-artifact gap.** The gate ran without a built `dist/`, failing a test on the uncommitted `dist/evals/cli.js`. Evidence: this spec F2 (retro log 2026-11-05T21:27:30Z); eval-gate-runs F1 (`dist/evals/cli.js`). Both references name the same artifact.
- **F3 repeats the config-file-in-gate class.** A task-authorized non-test/config file trips the TDD/file gate. Evidence: this spec F3 (d-ae7a5d40); dashboard-loop-views (tdd.testFiles allowed-list, retro-log 2026-10-19) and run-pause F9 (vite.config.ts file-outside-list).
- **F8/F11 repeat the unreviewed-merge-under-decision-C pattern.** A completed-but-unreviewed task merges under retro P9. Evidence: this spec F8/F11 (retro log 2026-11-06T00:17:37Z); run-pause F10/F12; lean-orchestrators (reviewCoverage 13/16).

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | requirements v5, design v3, tasks v1 (+lint) |
| Review rounds | requirements 5, design 3, tasks 1 |
| Fix rounds (impl) | 4 (task 7 ×1, task 13 ×3→adjudicated) |
| Adjudications | 2 (requirements v4, task 13) |
| Escalations | 1 (task 13) |
| Rulings | 1 (task 13 narrow pass) |
| Deferrals added | 2 (d-ae7a5d40, d-64ce8349) |
| Spawns | 68 (completion gate); 69 spawn.start in ledger (floor) |
| Tasks / coverage | 15/15; logCoverage 15/15; reviewCoverage 14/15; verifier-skipped 8 |
| PR | #205 (merged) |

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
