# Retrospective — decisions-and-launch-guard

Compiled 2026-11-08 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Clean implementation: 23 tasks, 0 fix rounds, 0 adjudications, 0 escalations.**
  Every task closed on its first implementer spawn; no round re-opened. Three document
  phases converged in 3+2+1 review rounds with no human ruling. Evidence: retro log
  2026-11-08T04:46:43Z (cleanup); harness-events.jsonl (0 `round` rows beyond doc phases).
  Frequency: once. Cost: ~68 spawns total, no rework.
- **F2 — Two tasks were red-impossible, written as regression guards.** Task 1 (spreading
  `displayName` adds no field at base) and task 12 (a label prefix that exists only inside
  the new bullet) could not be red-tested; the author wrote each as a named regression
  guard and confirmed green pre-implementation, per retro P10. Evidence: retro log
  2026-11-07T22:34:23Z, 2026-11-08T01:35:08Z (doc-gap). Frequency: 2 times. Cost: 1 author
  spawn each.
- **F3 — The spec's final task resolved four foreign deferrals.** Task 23 resolved
  d-83cc3ac1, d-37e510db, d-4f6a6271 and d-aaf54e29 (all dashboard-board), the last noting
  it covers the launch half only. Evidence: Implementation Logs/task-23. Frequency: once.
  Cost: part of 1 implementer spawn.

## Product bugs found

- **F4 — A direct discard POST could delete a reused run's branch and close its PR.**
  Design review found `Controller.discard` guarded only on `branchHeld` (live runs only),
  so a non-live reuser (the canonical dashboard-deploy case) let `discardRun` delete the
  branch and `gh pr close` it — the destructive outcome Req 9 AC6 forbids. Caught before
  ship and fixed with `branchReused`. Evidence: reviews/adversarial-analysis-design.md
  §C9 (SHOULD_FIX). Frequency: once. Cost: 1 design round.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F5 — A deferral was created in the worktree but never surfaced as "added."** Task 10's
  verifier recorded d-131803a4 (addTaskFiles duplicates taskBlock's checkbox-bounds logic),
  but it stayed untracked in the worktree; the completion gate logged "0 deferrals added"
  and the deferrals tool (main store) returns 0 for this spec. The count is a floor, as
  agent-rules warns. Evidence: `.spec-workflow/deferrals/d-131803a4.md` (status deferred);
  retro log 2026-11-08T04:46:43Z. Frequency: once. Cost: one lost deferral in the index.
- **F6 — The spec merged with both live-verification scenarios still `pending`.** agent-rules
  says every verification-evidence line must read `passed` before the retrospective opens,
  run by an operator in a restarted session. Scenario 1 (naming) and scenario 6 (cancel)
  both read `pending`, yet PR #210 merged and the retro opened. Evidence:
  verification-evidence.md (worktree copy); harness-events.jsonl `pr.merged` 2026-11-08T05:16Z.
  Frequency: 2 scenarios. Cost: unknown; operator run still owed.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F7 — Tasks 19–23 took a gate-only review, verifier-skipped.** Five tasks closed on the
  gate alone (retro P6/P15), and tasks 14 and 23 drew no review at all. Planned, not
  discovered mid-run. Evidence: HANDOFF Verifier-skipped row; reviews/ (no review-14,
  review-23). Frequency: 5 of 23. Cost: ~5 verifier spawns saved.
- **F8 — Two author spawns produced only regression-guard tests.** See F2: tasks 1 and 12
  spent a test-author spawn each to write a test that holds at base. Evidence: retro log
  doc-gap entries. Frequency: 2 times. Cost: 2 author spawns.

## Documentation gaps

- **F9 — Requirements called retro-efficiency items "operator-reported defects."** The
  intro said the spec "fixes eleven operator-reported defects," but items 4 (file-list
  patch, P6) and 5 (doc review cap, P5) are retro decisions. Caught and reworded in review.
  Evidence: reviews/adversarial-analysis-requirements.md R1-5 (MINOR). Frequency: once.
  Cost: part of 1 review round.

## Model behaviour

- **F10 — Reviewers resolved every SHOULD_FIX within the allotted rounds.** Requirements
  review found a Req 10 AC1/AC2 contradiction (danger tone on a healthy quiet run) and
  design review found two SHOULD_FIX (stale-version cap, reused-branch discard); all were
  fixed and verified `converged` by r2, with no escalation. Evidence:
  adversarial-analysis-requirements-r2.md R2-1; adversarial-analysis-design-r2.md
  (converged). Frequency: 3 findings. Cost: absorbed in normal rounds.

## Process deviations and rulings

- **F11 — Review coverage gap: tasks 14 and 23 logged but unreviewed; merge allowed.** The
  completion gate closed reviewCoverage at 21/23 under decision C (retro P9). Evidence:
  retro log 2026-11-08T04:46:43Z (deviation). Frequency: 2 tasks. Cost: merge proceeded.
- **F12 — A design finding was closed by reviser ruling, not re-opened.** R1-5 (close-out
  reference plan is illustrative) was dispositioned as a ruling at design r2. Evidence:
  adversarial-analysis-design-r2.md ("RULING (closed, not re-opened)"). Frequency: once.
  Cost: none.

## Decisions the harness made for the human

- **F13 — Gate A pre-answered the money/personal-data/legal posture.** The posture item
  carried a single option, "n/a — the spec touches no money, personal data, or legal
  surface," with a harness basis checking all eleven items; the operator did not choose it.
  Evidence: gate-a.json (`basis`). Frequency: once. Cost: one fewer question.
- **F14 — The merge-despite-unreviewed call followed a standing decision, not a prompt.**
  Decision C let the completion gate merge past the 21/23 coverage without asking. Evidence:
  retro log 2026-11-08T04:46:43Z. Frequency: once. Cost: no human wait.

## Repeat patterns

- **F7 (gate-only, verifier-skipped tail) recurs.** Also dashboard-project-list F11 (nine
  tasks gate-only), dashboard-loop-views F12, eval-gate-runs. Evidence:
  dashboard-project-list/retrospective.md:45. The routing is now agent-rules, so it is
  expected, not a defect.
- **F2/F8 (red-impossible regression guard) recurs widely.** Also dashboard-board F10,
  dashboard-deploy F6/F7, eval-gate-runs F2. Evidence: dashboard-board/retrospective.md:67,
  dashboard-deploy/retrospective.md:36. Here it was handled per P10 (guard test written up
  front), not discovered after an aborted author.
- **F11 (unreviewed final task, merge allowed) recurs.** Also graph-orientation. Evidence:
  graph-orientation/retrospective.md:21 (reviewCoverage unreviewed 9,10).

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | requirements v1→v3; design v1→v2; tasks v1 |
| Review rounds | requirements 3 (iterate, iterate, narrow check); design 2 (iterate, converged); tasks 1 (converged) |
| Fix rounds (impl) | 0 |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 1 (design R1-5, reviser) |
| Deferrals added | 0 surfaced (1 created in-worktree, F5); 4 foreign resolved |
| Spawns | 70 spawn.start / 69 spawn.end (ledger floor; gate reported 68) |
| PR | #210 merged, sha 0ab6a119 |
| TDD | 21 TDD tasks (assertion-red 11, structural-red 10); tasks 14, 23 implementer-only |

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
