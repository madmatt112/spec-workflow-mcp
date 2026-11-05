# Retrospective — eval-gate-runs

Compiled 2026-11-05 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

This spec made the eval gate run each case its real planned count (1 for role/profile/brief
reasons, 3 for case/grader) instead of a fixed 3, and made the CLI, deploy dry-run and docs
state the real count. Small change (net ~180 lines across six files), clean run: 0 fix rounds,
0 adjudications, 0 escalations, 0 rulings, 0 deferrals added.

## Gotchas
- **F1 — A symlinked `dist/evals/cli.js` prints nothing and exits 0.** The deploy dry-run
  calls the live `dist/evals/cli.js`; because `cli.ts` compares an unresolved `argv[1]`
  against a realpath'd `import.meta.url`, a symlinked entry never runs `main()`. Task 5's
  test had to write a dynamic-import wrapper to the toy checkout's `dist/` to exercise it.
  The design probed this on node 24 before relying on it. Evidence:
  reviews/adversarial-analysis-design.md §4; Implementation Logs/task-5 (`writeEvalCliWrapper`).
  Frequency: once. Cost: one node probe + one wrapper helper.

## Product bugs found
None found.

## Tool and MCP errors or deficiencies
None found.

## Harness defects
None found.

## Prompt misunderstandings
- **F2 — Drafter put a `- Test:` seam on an all-regression-guard task.** Task 5's every
  criterion holds at base, yet v1 carried a `Test:` line and merely described the wasteful
  "author reports RED-IMPOSSIBLE then re-route" path in prose, instead of marking the task
  implementer-only up front as agent-rules.md:176-178 requires. The tasks reviewer caught it
  (R1-1 SHOULD_FIX); v2 removed the seam. Evidence:
  reviews/adversarial-analysis-tasks.md Attack 1; commit 89a85a56. Frequency: once here;
  recurs widely (see Repeat patterns). Cost: 1 extra tasks round + 1 reviser spawn (avoided
  a wasted test-author spawn and a mid-run re-route).
- **F3 — Requirements drafter rotated a grouped citation triplet.** R1 AC1 listed three
  brief reasons with citations `(:131, :153, :200)` in the wrong order against the reasons
  they followed, so verifying any one reason landed on a different reason's line. Fixed in
  v2 by reordering. Evidence: reviews/adversarial-analysis-requirements.md R1-1 (MUST_FIX).
  Frequency: once here; repeat (graph-orientation). Cost: part of the round-1 iterate.
- **F4 — Requirements drafter wrote an unconditional exit-1 AC that contradicted the
  override story.** R2 AC1/AC2 said a failed/inconclusive single run SHALL exit 1 with no
  qualifier, contradicting R3 AC5's overridden-case exit 0 (`gate.ts:74` guards it with
  `!overrideSet.has`). Fixed in v2 with the override carve-out. Evidence:
  reviews/adversarial-analysis-requirements.md R1-2 (MUST_FIX). Frequency: once. Cost: part
  of the round-1 iterate.

## Inefficiencies
- **F5 — Doc phases dominated cost on a tiny code change.** Six source tasks of ~180 net
  lines, but the four phases spent 3 drafter + 5 reviewer + 7 reviser spawns (≈15 of 27)
  across 5 doc review rounds plus two lint passes, against 6 implementer spawns. Inherent
  SDD overhead for a small, well-understood change. Evidence: harness-events.jsonl spawn
  counts; git log (req v1/v2 + lint, tasks v1/v2 + lint). Frequency: once. Cost: ~41.5M
  tokens floor for the whole run, doc phases the larger share.

## Documentation gaps
- **F6 — SDD-HARNESS.md claimed a fixed "three times" run count that was already wrong.**
  The gate had stopped always running 3 times, but the harness doc still stated a flat 3.
  Task 6 corrected it to the per-reason count (3 for case/grader, 1 for role/profile/brief,
  3 for a direct `node dist/evals/cli.js` run). This stale claim was the spec's reason to
  exist. Evidence: Implementation Logs/task-6; SDD-HARNESS.md:511 (commit af59e661).
  Frequency: once. Cost: a +13/-9 doc edit.

## Model behaviour
- **F7 — Clean implementation across all six tasks on Sonnet.** Every task passed its gate
  on the first try (0 fix rounds, 0 adjudications); implementers ran on claude-sonnet-5 at
  high effort, drafters/revisers/reviewers on Opus (4-8 and 5-5). Evidence:
  retrospective-log.md (tasks 1-6, 0 fix rounds); harness-events.jsonl model/route notes.
  Frequency: once here; repeat clean-run pattern (controller-liveness-and-push, review-gate,
  run-pause, verification-loop). Cost: none — this is the good case.

## Process deviations and rulings
None found. (0 rulings, 0 adjudications, 0 escalations; the task-5 routing was corrected
in-phase, not deviated. The final task running gate-reviewed but verifier-skipped is
blessed by agent-rules.md:179-182 and is not a finding.)

## Decisions the harness made for the human
- **F8 — Gate A's "Posture" item was pre-answered n/a.** The money/personal-data/legal
  posture question offered only the single option "n/a — the spec touches no money, personal
  data, or legal surface"; the harness decided the surface was empty rather than asking.
  Correct here, but it is a human-facing gate item the harness filled in. Evidence:
  gate-a.json (Posture item); questions.md (Gate A, no posture answer line). Frequency:
  once. Cost: none.

## Repeat patterns
- **F2 — regression-guard task carrying a test seam → wasted author spawn.** Also
  controller-liveness-and-push/retrospective.md F4 ("recurs widely. Also advisor F12,
  lean-orchestrators…"); the construct is exactly what agent-rules.md:176-178 was written to
  prevent. Here the tasks reviewer caught it before any spawn was wasted — the rule plus the
  review gate worked. Evidence here: reviews/adversarial-analysis-tasks.md Attack 1.
- **F3 — wrong-line / rotated citation in a drafted document.** Also
  graph-orientation/retrospective.md (round-1 MUST_FIX: "R6 AC8 wrong line"). Both caught at
  adversarial review round 1. Evidence here: reviews/adversarial-analysis-requirements.md R1-1.
- **F7 — fully clean implementation run, 0 fix rounds.** Also controller-liveness-and-push,
  review-gate, run-pause, verification-loop, worktree-review-signals, dashboard-project-list
  retrospectives record 0/near-0 fix-round runs. Evidence here: retrospective-log.md.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | req v2, design v1, tasks v2, impl 6 tasks |
| Review rounds | req 2, design 1, tasks 2 (doc); impl 6 gates + 1 verifier + e2e |
| Fix rounds (impl) | 0 |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 0 (38 open overall) |
| Spawns | 27 (3 drafter, 5 reviewer, 7 reviser, 4 test-author, 6 implementer, 2 verifier) |
| Tokens (floor) | ~41.5M across the run |
| PR | #203, merged (merge commit 20ee72c3) |

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
