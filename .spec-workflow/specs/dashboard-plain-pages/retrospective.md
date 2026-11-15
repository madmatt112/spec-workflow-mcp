# Retrospective — dashboard-plain-pages

Compiled 2026-11-15 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

This was a near-clean run: 9 of 11 tasks closed with 0 fix rounds, one PR (#219), merged.
The two tasks that cost rounds (5 and 11) both stalled on things the tasks did not build —
a TDD harness gap and a base-failing suite — not on product defects. Both are repeats.

## Gotchas

- **F1 — Mutating `/api` resolve POST needed no new proxy work.** Task 9 added the
  deferral-resolve POST route; the vite dev-proxy Origin rewrite (4064229c) was already in
  place and anticipated in the decomposition, so the worktree e2e suite passed first try.
  Evidence: retro log 2026-11-15T05:59:57Z (task 9, 0 fix rounds); agent-rules.md:226-228.
  Frequency: once. Cost: none (anticipated).

## Product bugs found

None found.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F2 — `e2e/helpers/` seed support file is treated as a test by the TDD proof.** Task 5's
  File-list required editing `e2e/helpers/shell-seed.ts` (D30 seed support). `tdd-test-command`
  (agent-rules.md:7) sent it to `npx playwright test`, which exits 1 "No tests found", and
  `|| exit 1` failed the whole HEAD run; `isTestPath` (gate-rules.ts:270) also omits
  `e2e/helpers/`, firing author-changed-source and tdd-inconclusive. All real author tests
  passed. Ruled a harness gap, not a task defect. Evidence: retro log 2026-11-15T04:27:01Z
  (harness-defect); adjudication-task-5.md:16-37; review task 5 v1 summary. Frequency: once
  this spec; already tracked by d-ae7a5d40. Cost: 2 fix rounds, 1 adjudication, 3 spawns.
- **F3 — Task 11's design-defect restriction has no truthful outcome when the failing files
  are not this spec's.** Task 11 ("report a failing check with the task whose files fail")
  assumes `npm test` failures trace to a spec task. 13 tests in 5 untouched files
  (project-manager-durable, evals/graders, evals/runner, log-implementation, projectPath)
  fail identically at merge-base 1054a946, so no task could be named. The implementer could
  neither name a task nor edit a file. Evidence: retro log 2026-11-15T06:31:56Z (deviation);
  task-11-fix-1-report.md. Frequency: once. Cost: 2 fix rounds, 3 spawns.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F4 — 4 fix rounds and ~6 extra spawns bought no code change.** Both of the spec's
  fix-round tasks (5 and 11) churned on causes outside the task — the F2 harness gap and the
  F3 base failures. Task 5 ended adjudicated with the tree unchanged (8c61e5e7, no new
  commit); task 11 ended gate-pass with no file edited. Evidence: retro log 04:35:13Z,
  07:00:22Z (inefficiency); adjudication-task-5.md:1. Frequency: 2 of 11 tasks. Cost: 4 of
  the run's 4 fix rounds; ~6 of 53 spawns.

## Documentation gaps

- **F5 — Stale `UsageTrend` reference left in a test-file header comment.** The top-of-file
  comment in `frontend-style-scan.test.ts:26` still names the deleted `UsageTrend` component
  and reads "the task-5 sweep ... has not happened yet". Task 10 edited that exact hunk but
  left the stale line. Deferred (harmless prose, excluded from the success grep). Evidence:
  deferral d-998f2119. Frequency: once. Cost: deferred, no fix.

## Model behaviour

- **F6 — The implementer base-diffed before blaming the branch.** For task 11's 13 failures
  it built a detached worktree at merge-base, ran `npm ci`, re-ran the exact 5 files, and
  proved identical 13-fail/75-pass before ruling pre-existing. Correct, desired behaviour.
  Evidence: task-11-fix-1-report.md:16-20. Frequency: once. Cost: extra base run, well spent.

## Process deviations and rulings

- **F7 — Task 5 adjudicated early.** A fix round left the implementer commit and the gate
  verdict unchanged, so the loop was short-circuited to a narrow verdict pass rather than
  spending more rounds. Evidence: retro log 2026-11-15T04:35:13Z (ruling). Frequency: once.
  Cost: 1 adjudication (the run's only one).
- **F8 — Task 9's e2e cases were committed with the implementation, not as a separate red
  commit.** Its new test ids (deferral-resolve/-resolution/-confirm/-cancel/-error,
  deferrals-empty) landed in feat commit 7971bb58, unlike tasks 7 and 8 which each have a
  `test(...): task N red` commit. The ids are absent from the old page, so provably red-on-base
  and gate-green — an audit-trail gap, not a coverage defect. Evidence: deferral d-0c7bf06c;
  git log (7971bb58 vs 917c70e7/f1b9b968). Frequency: once. Cost: none (verdict pass).

## Decisions the harness made for the human

- **F9 — Both blocking issues were ruled out by the harness, not escalated.** The F2 TDD gap
  (adjudicator) and the F3 base failures (implementer) were each dispositioned in-run and the
  merge proceeded; neither reached the human. One escalation fired in the ledger. Evidence:
  adjudication-task-5.md; task-11-fix-1-report.md; harness-events.jsonl (escalations 1).
  Frequency: twice. Cost: avoided a human gate, at the price of 4 no-op fix rounds.
- **F10 — Two info-finding deferrals were filed owner=harness.** d-998f2119 and d-0c7bf06c
  were recorded by verifiers as harness-owned info findings; the completion gate still logged
  "0 deferrals added". Evidence: deferrals list (both owner harness); retro log 07:06:31Z.
  Frequency: twice. Cost: none; a count mismatch to note.

## Repeat patterns

- **F2 ↔ dashboard-deploy F3.** The TDD proof treating a task-authorized non-`*.test` file as
  a test (there `playwright.worktree.config.ts`, here `e2e/helpers/shell-seed.ts`) is the same
  isTestPath/testFiles-dispatch gap, same deferral d-ae7a5d40. There it cost 3 rounds +
  adjudication (~815k tokens); here 2 rounds + adjudication. Evidence: dashboard-deploy
  retrospective.md:23; adjudication-task-5.md:35-37. Still unfixed after two specs.
- **F3/F4 ↔ dashboard-visual-refresh F14, dashboard-project-list F14.** A base-failing suite
  burning fix rounds that add no fix recurs: visual-refresh task 5 spent 2 rounds/3 spawns on
  pre-existing `npm test` failures; here task 11 did the same. agent-rules.md:210-212 already
  says a check failing at base in 2+ specs gets a tracked fix task — these `npm test` failures
  now qualify. Evidence: dashboard-visual-refresh retrospective.md:75-76; dashboard-project-list
  retrospective.md:51,58; task-11-fix-1-report.md.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions/phase | req 3, design 2, tasks 2 |
| Review rounds (docs) | req 3, design 2 |
| Fix rounds (impl) | 4 (task 5: 2, task 11: 2) |
| Adjudications | 1 (task 5) |
| Escalations | 1 |
| Rulings | 1 (task 5 early-adjudicate) |
| Deferrals added | 2 info-findings (gate logged 0) |
| Spawns | 53 (54 starts / 53 ends) |
| Tasks | 11/11; TDD 8 (assertion-red 3, structural-red 4, inconclusive 1) |
| Coverage | logCoverage 11/11; reviewCoverage 11/11 (task 11 gate-only) |
| PR | #219, merged |

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
