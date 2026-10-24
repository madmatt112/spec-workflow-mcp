# Retrospective — harness-evals

Compiled 2026-10-24 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — A fresh eval fixture repo needs a repo-level git identity.** The eval fixture
  builder makes a brand-new git repo; with no `user.name`/`user.email` set, the commit it
  runs failed on CI (local node had a global identity, CI did not). Caught only after the PR
  opened. Evidence: commit `bc2b89ae`, retro-log 2026-10-24T04:09:07Z (CI fix round 1).
  Frequency: once. Cost: 1 post-PR fix round.
- **F2 — The self-update BASE line must call `/usr/bin/git`, not bare `git`.** A bare `git`
  on that line is rewritten by the shell hook, so the BASE computation used the wrong output
  until it was pinned to the absolute path. Evidence: commit `248f223b`. Frequency: once.
  Cost: 1 follow-up commit. (Repeat: see F11.)

## Product bugs found

- **F3 — Eval selector over-marks `provisional`.** The shipped `--dry-run` selector marks a
  case provisional on any brief-source change, not only when that change is the sole reason,
  diverging from R3 AC6. Shipped knowingly; today only the CLI preview reads the flag.
  Evidence: deferral `d-3a26cd7c` (owner harness). Frequency: once. Cost: unknown (deferred).
- **F4 — `fixture.test.ts` leaves-no-parent test is not concurrency-safe.** It diffs the
  global `os.tmpdir()` listing instead of asserting on the fixture's own `eval-fixture-`
  prefix, so a parallel test can make it flake. Evidence: deferral `d-afcd942d` (owner
  harness, tags flaky-test/test-isolation). Frequency: once. Cost: unknown (deferred).

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F5 — `file-outside-list` gate cannot be satisfied by any implementer edit when the
  File: list is incomplete.** Task 11 seeds a fixture tree (design Component 13) on disk;
  the task's File: list omitted those fixture files, so the gate failed `file-outside-list`
  every round regardless of content — an unfixable loop until the decomposition was patched.
  Evidence: retro-log 2026-10-24T02:08:15Z, design-defect commit `ef5ca404`. Frequency: once
  this spec. Cost: a mid-implementation corrective pass to the tasks File: list. (Repeat: see
  F10.)

## Prompt misunderstandings

None found.

## Inefficiencies

- **F6 — Whole-phase new-module TDD drove a high verifier/spawn count.** Every task was a new
  module at base (structural-red 10, assertion-red 4), routing new modules to the verifier by
  default; 63 spawns across 16 tasks, 1 implementer spawn each. The run was otherwise clean (0
  in-loop fix rounds, 0 adjudications in implementation), so the spend was planned, not wasted.
  Evidence: retro-log 2026-10-24T03:57:04Z, HANDOFF Coverage line. Frequency: 16 tasks. Cost:
  63 spawns.

## Documentation gaps

- **F7 — Design specified no distinct error message, making a task-14 AC red-impossible.**
  "Recognized flag, missing value" and "unrecognized flag" both fall into the script's
  catch-all `exit 2`; with no distinct message in the design, the "exits 2 when
  `--eval-override` has no value" test passed at base and could only be kept as a regression
  guard, not a red test. Evidence: retro-log 2026-10-24T03:10:36Z (task 14 doc-gap),
  `service-scripts.test.ts:367-370`. Frequency: once. Cost: minor (1 AC reclassified).

## Model behaviour

None found.

## Process deviations and rulings

- **F8 — Requirements needed a SHOULD_FIX-only corrective pass at v4.** Requirements ran the
  full 4 rounds (verdicts should-fix-only → converged) and closed with a corrective pass at
  v4 rather than a clean convergence. No rulings. Evidence: commit `8cdcfd14`, HANDOFF
  requirements section, approval `approval_1792687189504_gbe4xx37d`. Frequency: once. Cost: 1
  corrective pass.
- **F9 — Task 16 shipped unreviewed.** reviewCoverage is 15/16 (unreviewed: 16); logCoverage
  16/16. Evidence: HANDOFF Coverage line. Frequency: once. Cost: unknown.

## Decisions the harness made for the human

- **F10 — Both info-findings were filed as harness-owned deferrals rather than escalated.**
  The harness recorded the provisional-marking deviation (F3) and the flaky-test isolation
  issue (F4) as `owner: harness` deferrals and let the merge proceed, per the D9 rule that a
  known weakness is a tracked finding, not a merge block. Evidence: deferrals `d-3a26cd7c`,
  `d-afcd942d`. Frequency: 2. Cost: none at merge.

## Repeat patterns

- **F5 ↔ dashboard-shell F3, harness-usage-and-tiers F3, dashboard-loop-views F4/F5.** The
  `file-outside-list` gate rejecting a run it cannot pass (incomplete File: list, dir globs,
  trailing slashes) now appears in five specs. Evidence: this file F5; retrospectives of
  dashboard-shell, harness-usage-and-tiers (F3, "seen in four specs now"), dashboard-loop-views
  (F4/F5). Frequency: 5 specs. Cost: a corrective pass each time.
- **F2 ↔ spec-lint, tdd-task-loop F5/F8.** A bare `git` in harness/script text being rewritten
  by the shell hook, worked around with `/usr/bin/git` and explicit paths. Evidence: this file
  F2; spec-lint retrospective (6 refused calls), tdd-task-loop retrospective F5/F8. Frequency:
  3 specs. Cost: a line fix each time.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements 4, design 1, tasks 2 |
| Review rounds | requirements 4, design 2, tasks 1 |
| Fix rounds | 1 (CI, post-PR) |
| Adjudications | 1 (requirements v4 corrective pass); 0 in implementation |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 2 (both harness-owned) |
| Spawns | 63 (ledger floor: 66 spawn.start / 64 spawn.end) |
| PR | #176 (merged) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs' findings,
each proposed for promotion into a steering document or agent-rules.md, with the rule text as
it would be written.
