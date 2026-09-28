# Retrospective — tdd-task-loop

Compiled 2026-09-28 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Gate against pre-implement HEAD swept in uncommitted noise.** The first task's
  gate ran against pre-implement HEAD and picked up 38 uncommitted spec-store and
  working-tree files; re-gating with `commit=<implementer sha>` scoped it to the single
  commit. Evidence: retro log 2026-09-28T14:48:36Z; task 1; commit 711c546; reviewId
  81418a81. Frequency: once (then adopted `commit=` per task). Cost: 1 extra gate call.
- **F2 — Verifier triggered on line-count alone.** Task 7 scored high risk only because
  the diff was 289 lines (>200); the logic was sound and the verifier passed with no
  fix. Task 9 similarly went high on sensitive-path. Evidence: retro log
  2026-09-28T15:36:57Z (task 7, commit fedb70f) and 16:13:22Z (task 9, commit c1f2dc4).
  Frequency: 2 of 3 verifier spawns this spec. Cost: 2 verifier spawns on low-defect
  changes.
- **F3 — RED-IMPOSSIBLE leaves the test file untracked.** After the fixture task
  reported RED-IMPOSSIBLE, the author left its test file in the code root; nothing
  commits or removes it before the design-defect stop, so a stray file sits in the tree
  for the next run. Evidence: retro log 2026-09-28T18:30:00Z (live run); `git status`
  shows `?? src/__tests__/clamp.test.js`. Frequency: once (live fixture run). Cost: manual
  cleanup before rerun.

## Product bugs found

- **F4 — A count assertion outside the task's edit scope was left stale.** Task 13 added
  the 13th agent profile (`sdd-test-author`) but `src/watch/__tests__/ledger.test.ts:103`
  asserted `toHaveLength(12)`; the assertion sat outside task 13's grep list and was never
  updated, so `npm test` failed 1/1596. Caught only by the task-17 end-to-end gate, fixed
  inline. Evidence: retro log 2026-09-28T17:11:57Z; task 13 commit 7512a66;
  ledger.test.ts:103. Frequency: once. Cost: 1 verifier + 1 fix implementer spawn.

## Tool and MCP errors or deficiencies

- **F5 — review-task gate/prepare ran against the wrong tree.** With no `root=` the gate
  ran its checks in the default root (the main checkout on another branch, lacking this
  branch's changes), so `get-task-review.test.ts` failed there while green in the worktree;
  tasks 1-5 gates likely ran vacuously in the main checkout too. Prepare's diff was also
  empty on the worktree branch (task 8). Fix: pass `root=CODE_ROOT` (and `commit=<sha>`)
  to every gate/prepare call. Evidence: retro log 2026-09-28T15:19:17Z (task 6, reviewId
  c6cf9c8f) and 15:51:32Z (task 8). Frequency: structural, every gate call on a worktree
  branch. Cost: 1 spurious fix round; earlier gates passed vacuously.
- **F6 — `harness brief` rejects an unmarked task with no redTests value.** The skill says
  `redTests` defaults to empty, but the brief tool rejected an unmarked docs-only task that
  carried no `redTests` value. Evidence: retro log 2026-09-28T18:30:00Z (live run task 2);
  design ruling that `redTests` is an optional key defaulting to empty string
  (adversarial-analysis-design.md, R3 AC4). Frequency: once (live run), but hits every
  unmarked task. Cost: 1 extra brief call.

## Harness defects

- **F7 — Docs-only change scored risk high from bookkeeping commits.** In the single-repo
  fixture a README-only task 2 scored high because the gate commit range took in spec-store
  bookkeeping commits and the untracked `.spec-workflow/templates/`, so a docs change got
  the verifier path. Evidence: retro log 2026-09-28T18:30:00Z; fixture ledger `gate: task 2
  pass risk high` at 18:16:36Z; `?? .spec-workflow/templates/` in the fixture code root.
  Frequency: once (live), structural for single-repo layouts. Cost: 1 verifier spawn a
  low-risk docs task should not need.
- **F8 — Supervisor ran from inside the worktree and hit the isolation guard.** The
  run-20260928-143508 supervisor ran inside `feat/tdd-task-loop`; Claude Code's worktree
  isolation guard blocked plain git (the rtk `rtk git` rewrite) and Edit on main-checkout
  files such as HANDOFF.md. It worked around this with `/usr/bin/git` and a node helper on
  every main-checkout write. Evidence: retro log 2026-09-28T18:45:00Z; harness-activity.jsonl
  shows repeated `/usr/bin/git commit`, `status`, `-C`. Frequency: every main-checkout write
  for the whole run. Cost: workaround commands throughout the run.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F9 — spec-lint citation-identifier check fires 39 false positives per tasks.md.** The
  skip regex `/^\s*_(?:Leverage|Prompt):/` (src/core/lint-citations.ts:75) misses the
  template-mandated indented sub-bullet form `  - _Prompt:`, so the identifier check scans
  every prompt/leverage line; tdd-task-loop tasks v1 produced 39 warnings, all
  to-be-built symbols or JS literals. Evidence: deferral d-53b7f443; retro log
  2026-09-27T23:34:15Z; adversarial-analysis-tasks.md. Frequency: every template-compliant
  tasks.md. Cost: reviewer time to triage 39 warnings as noise each tasks phase.
- **F10 — Gates for tasks 1-5 passed vacuously in the wrong tree.** Because `root=` was not
  passed early (F5), the first five gates ran their checks in a tree without the branch
  changes; the real end-to-end proof was only the task-17 full-suite run. Evidence: retro
  log 2026-09-28T15:19:17Z ("Tasks 1-5 gates likely ran in the main checkout too … task 17
  full-suite run is the net"). Frequency: 5 tasks. Cost: 5 gate calls with no verification
  value.

## Documentation gaps

- **F11 — Skill documents a redTests default the tool does not honor.** The
  implementation-phase skill says `redTests` defaults to empty, but `harness brief` requires
  a value for unmarked tasks (F6); the skill and the tool disagree. Evidence: retro log
  2026-09-28T18:30:00Z; sdd-implementation-phase skill; design R3 AC4 ruling. Frequency:
  once surfaced. Cost: operator confusion, 1 extra brief call.

## Model behaviour

- **F12 — Implementer scoped edits to its grep list and missed a coupled assertion.** Task
  13's implementer changed the profile count but did not find the dependent count assertion
  in ledger.test.ts because it was outside the task's grep list (root cause of F4). Evidence:
  retro log 2026-09-28T17:11:57Z. Frequency: once. Cost: folded into F4's fix round.

## Process deviations and rulings

- **F13 — One ruling, no adjudications or escalations.** Design R3 AC4 (`redTests` optional
  key defaulting to empty string) was ruled a refinement by the round-1 reviewer and closed,
  not a widening. Requirements RE-DECIDED flags were resolved at Gate A before round 1. No
  standoff, circling, cap hit, or adjudication in any phase. Evidence:
  adversarial-analysis-design.md; retro log 2026-09-27T22:10:29Z; HANDOFF tdd-task-loop
  design row. Frequency: 1 ruling across 4 phases. Cost: none extra.

## Decisions the harness made for the human

- **F14 — Verifier skipped by policy on docs-only and verification-only tasks.** Task 4
  (docs-only, medium risk) and task 16 (verification-only, no CODE_ROOT paths) skipped the
  verifier by policy; reviewCoverage reads 15/17 as a result. Evidence: retro log
  2026-09-28T15:06:02Z (task 4) and 17:04:59Z (task 16). Frequency: 2 tasks. Cost: none
  (intended); noted so the human sees the coverage gap.
- **F15 — 39 lint warnings deferred rather than fixed.** The tasks reviewer rejected the 39
  citation-identifier warnings as a known false-positive class and filed d-53b7f443 instead
  of blocking or fixing. Evidence: retro log 2026-09-27T23:34:15Z; deferral d-53b7f443.
  Frequency: once. Cost: deferred fix; noise persists until resolved.
- **F16 — Live verification criteria carried as pending for an operator.** Requirement 9
  criteria 9.1, 9.3, 9.5 were left pending in verification-evidence.md for an operator
  pre-merge session (rebuilt server, dev-link, restart, Jev key). Evidence: retro log
  2026-09-28T17:04:59Z; HANDOFF implementation row; commits 40a7e1f/873131e later cleared
  checks (1),(3),(5). Frequency: 3 criteria. Cost: deferred to a manual session.

## Repeat patterns

- **F5/F8 ↔ review-gate F11, spec-lint F7/F8, worktree-review-signals.** Gate/prepare and
  supervisor operations running against the main checkout instead of the worktree, and the
  worktree isolation guard refusing git and Edit, recur across specs. review-gate F11
  (implementers reported main-checkout paths); spec-lint F7 (Edit/Write refuse spec-store
  paths from a worktree) and F8 (guard refuses `git` as written); here F5 (gate wrong tree)
  and F8 (supervisor in worktree needing `/usr/bin/git`). Evidence: this file F5/F8;
  review-gate/retrospective.md F11; spec-lint/retrospective.md F7/F8.
- **F9 ↔ recurring lint false-positive noise.** Citation/lint false positives appear in
  review-gate, spec-lint, harness-bookkeeping, question-gates and provider-per-role retros;
  here the identifier skip-regex gap is the specific instance. Evidence: this file F9;
  spec-lint and review-gate retrospectives.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation, live verification |
| Versions per phase | requirements v4, design v2, tasks v1 |
| Review rounds | requirements 3 adversarial + narrow check; design 2; tasks 1 |
| Fix rounds | implementation 2 (task 6 gate root, task 13/17 e2e count) |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 1 (design R3 AC4) |
| Deferrals added | 1 (d-53b7f443) |
| Worker spawns | req 3 reviewer + 3 reviser + 1 checker; design 2 reviewer + 1 reviser; tasks 1 reviewer; impl 17 implementer + 3 verifier + 2 fix (~19 gate calls) |
| Tasks | 17/17 complete; reviewCoverage 15/17 (16, 17 verification-only) |
| PR | #72 (merged into main) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs'
findings, each proposed for promotion into a steering document or agent-rules.md,
with the rule text as it would be written.
