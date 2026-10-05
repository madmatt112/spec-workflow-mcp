# Retrospective — lean-orchestrators

Compiled 2026-10-05 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Ported-verbatim briefs need snapshots pinned to the exact source text.** Task 8
  moved the document-phase brief kinds into templates; the batched verifier caught a
  non-verbatim reviewer-round section (dropped `Compounds: R<k>-<n>` seam, 2 warnings, a
  stale adjudicator bullet) that the gate would otherwise have passed. One fix round
  restored the text and re-pinned the snapshot. Evidence: retro log task 8 (2026-10-04T06:15:16Z);
  commit 9c4cd9f; review 626b029f. Frequency: once. Cost: 1 fix round + 1 narrow verifier.
- **F2 — git reset --hard is blocked by the irreversible-destruction guard.** A worktree
  implementer could not undo a mis-commit with `git reset --hard`; revert/relocate was
  used instead. Working as intended but surprised the flow. Evidence: HANDOFF line 736
  gotcha (3). Frequency: once. Cost: none (guard held).

## Product bugs found

None found. This spec changes harness tooling only; no product code shipped.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F3 — sdd-reviewer spawns record no spawn.start row and count as tokens unknown.** The
  activity hook writes `spawn.start` only when the prompt names a `-brief*.md` path, and
  reviewers launch from a `reviews/` prompt path, so every reviewer spawn is W-unknown in
  `harness usage` — in the fixture (4 reviewer spawns) and in both baselines (6 of 6 rows).
  Evidence: harness/hooks/sdd-activity.sh:213; retro log 2026-10-05T15:45:00Z harness-defect;
  baseline-sources.md. Frequency: 4 per fixture run, every run; seen as tokens-unknown in
  spec-lint too. Cost: reviewer W unmeasurable across all usage reports.
- **F4 — Moving an orchestrator-filled brief slot to a server kind left literal `<...>`.**
  Task 8's doc-phase checker/adjudicator kinds and task 13's impl-phase CI fix/verify
  variants both shipped placeholders (`<D>`, analysis paths, CODE_ROOT, `<check names>`,
  `<sha>`) that no longer get filled once the lean orchestrator stops filling them. Caught
  by the task-12 and task-13 verifiers; two fix rounds wired them as template keys.
  Evidence: retro log tasks 12/13 (07:06:01Z, 07:39:17Z); commits d2977a7, 6162859; HANDOFF
  gotcha (2). Frequency: 2 tasks. Cost: 2 fix rounds.
- **F5 — Verification-only tasks can't reach the main spec store from the worktree.** The
  shell guard blocks the main checkout, so tasks 5 and 15 committed their baseline/fixture
  files on `feat` (7b83f87, acc4e2f) and the orchestrator relocated them to the main spec
  store. Content is identical so the merge resolves clean, but it is manual every time.
  Evidence: retro log task 5 harness-defect (2026-10-04T03:40:45Z); HANDOFF gotcha (1).
  Frequency: 2 tasks; recurs on any verification-only task. Cost: orchestrator relocation
  per task.
- **F6 — claude -p supervisor recorded headless=no and found AskUserQuestion missing only at
  the retro.** The fixture live run set `headless=no` at run.start, discovered
  AskUserQuestion unavailable only when the retro plan was written (left DRAFT), and the
  gate-B HANDOFF row landed outside the phase-log table (repaired in fixture commit
  22355f3). The fixture has no git remote, so a headless kit run can never show the one-PR
  criterion. Evidence: retro log 2026-10-05T15:45:00Z harness-defect; e2e/fixture-run.log.
  Frequency: once (fixture). Cost: unknown; manual repair.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F7 — A B+1 task spec pays a whole second orchestrator prefix for one task.** The 5-task
  launch budget split 6 fixture tasks across two implementation orchestrator spawns: spawn 1
  ran tasks 1-5 at 152,198 W/task (-4% vs baseline); spawn 2 ran task 6 plus the end-to-end
  gate for 375,714 W, of which base 163,847 + skill 85,971 is fixed per-spawn prefix.
  Evidence: retro log 2026-10-05T15:45:00Z inefficiency; e2e/fixture-usage.md per-unit table.
  Frequency: once (fixture); recurs whenever task count mod budget = 1. Cost: ~250k W for one
  task. Seen as prefix-cost in agent-cache-ttl, graph-orientation, provider-per-role.
- **F8 — Fixture W per task ran +20% over baseline though per-review-round W fell 50-67%.**
  The spec's goal was to cut W; the fixture shows W/task 189,451 vs the tdd-task-loop
  baseline 157,800 (+20%), while W per review round dropped 50-67%. A mixed result the
  operator passed as a D9 finding for Matthew rather than a silent pass. Evidence: retro log
  verification ruling 2026-10-05T15:45:00Z; e2e/fixture-usage.md. Frequency: once. Cost: the
  decomposition's core metric is not yet a clear win on the per-task axis.

## Documentation gaps

- **F9 — AC 1.9 (byte-identical without sources) was RED-IMPOSSIBLE at base.** `sources` was
  already an ignored arg, so omitting it yielded spec-store-only output before any code
  existed; the AC could not produce a red test and was carried to the implementer brief as a
  regression guard instead. Evidence: retro log task 4 doc-gap (2026-10-04T03:15:13Z).
  Frequency: once. Cost: 0 extra spawns.
- **F10 — Req 7.3 runaway-guard text is stale after the tasks ruling.** The reviewer ruled
  the guard basis a refinement (design D14 sizes it from the task total, not the
  requirement's open-tasks), so the Req 7.3 requirement text no longer matches the shipped
  behaviour. Evidence: retro log tasks R1 (2026-10-03T08:38:17Z); HANDOFF tasks rulings.
  Frequency: once. Cost: a stale requirement line.

## Model behaviour

- **F11 — The design drafter flagged five design decisions RE-DECIDED; all were refinement.**
  The round-1 reviewer ruled every RE-DECIDED flag a refinement within its governing
  requirement's intent (Req 1.5, 3.3, 4.2, 6.4, 7.3), closed them with no extra spawn and
  carried them to the tasks drafter. Evidence: retro log design v1 ruling (2026-10-03T04:25:51Z).
  Frequency: 5 flags in one round. Cost: none (ruled in round 1).

## Process deviations and rulings

- **F12 — Three rulings, zero adjudications, zero escalations, cap never hit.** Design v1
  RE-DECIDED flags (F11), tasks Req 7.3 runaway-guard basis = refinement, and the operator
  verification ruling that passed evidence lines (2)/(3) with findings. All three document
  phases converged via a SHOULD_FIX-only corrective pass (req v3, design v4, tasks v3), not a
  post-cap adjudication. Evidence: retro log phase cleanups; HANDOFF rulings rows. Frequency:
  3 rulings. Cost: no extra spawn for any ruling.

## Decisions the harness made for the human

- **F13 — Live verification scenarios (2)/(3) deferred to an operator session.** The harness
  could not run the live fixture under its own session (rebuild + restart + AskUserQuestion
  needed), so it filed d-8a58ed18 and shipped with (1)+(kit) passed and (2)/(3) pending
  rather than blocking the PR. Resolved after the operator ran the lean-fixture live run.
  Evidence: deferral d-8a58ed18 (resolved); retro log verification ruling. Frequency: once.
  Cost: deferred verification carried to merge.
- **F14 — The operator passed a worse W signal as a finding, not a block.** On D9's reading
  (a worse signal becomes a retro finding, not a silent pass and not a merge block), the
  +20% W/task result (F8) was recorded for Matthew and the merge proceeded. Evidence: retro
  log verification ruling 2026-10-05T15:45:00Z. Frequency: once. Cost: the key metric
  decision is now a retro question, not a gate.

## Repeat patterns

- **Verification-only task friction (F5).** Also tdd-task-loop F14 (task 16 verification-only
  skipped the verifier, reviewCoverage 15/17) and graph-orientation F2 (tasks 9/10, spec-status
  reads 8/10 reviewed). Here reviewCoverage is 13/16 (tasks 5, 15, 16 unreviewed) and the
  worktree relocate is manual. References: this retro F5; tdd-task-loop retrospective.md F14;
  graph-orientation retrospective.md F2.
- **Activity-hook usage undercount (F3).** Also graph-orientation F3 (hook truncates drafter
  graph calls at 160 chars so the graph column undercounts) and spec-lint tokens-unknown
  rows. References: this retro F3; graph-orientation retrospective.md F3; spec-lint
  retrospective.md.
- **Per-spawn prefix cost dominates short spawns (F7).** The base+skill prefix recurs in
  agent-cache-ttl, graph-orientation and provider-per-role retrospectives as the fixed cost
  that makes short spawns expensive. References: this retro F7; agent-cache-ttl, graph-orientation,
  provider-per-role retrospectives.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation, verification, retrospective |
| Versions per phase | requirements v3 (3 rounds), design v4 (4 rounds), tasks v3 (3 rounds) |
| Review rounds | req 3, design 4 (incl. narrow check), tasks 3 |
| Fix rounds (impl) | 3 (tasks 8, 12, 13) |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 3 (design RE-DECIDED, tasks Req 7.3, operator verification) |
| Deferrals added | 1 (d-8a58ed18, resolved) |
| Orchestrator spawns | 3 document + 1 implementation + 1 retro (fixture live run split impl into 2) |
| Worker spawns (impl) | ~10 author + ~19 implementer/fix + 9 verifier |
| PR | #81 merged (f7806cf) |

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
