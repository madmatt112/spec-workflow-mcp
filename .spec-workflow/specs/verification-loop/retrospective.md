# Retrospective — verification-loop

Compiled 2026-10-22 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

This spec ran exceptionally clean: 14/14 tasks, 0 fix rounds, 0 adjudications, 0
escalations, 0 rulings, 0 deferrals added. Most sections below are empty. The few
findings are minor and several repeat earlier specs.

## Gotchas

- **F1 — Task 12 AC 3.2 could not be made red (vacuous at base).** "An unflagged spec
  writes no security note and spawns no security step" passed on first run because no C6
  security code existed for any spec yet, so the absence assertion was vacuously true. The
  test author kept it in the committed file as a forward regression guard and excluded it
  from the 4 genuine red tests. Evidence: retro-log 2026-10-22T07:06:21Z; commit ca18e7f.
  Frequency: once; see Repeat patterns. Cost: no extra spawn (handled in the test-author brief).

## Product bugs found

- **F2 — `none` dependency note can follow an `unreadable` note, against the invariant.**
  merge.ts guards `if (prior === undefined) return undefined`, which only suppresses a
  `none` note when there is no prior note at all. On an unreadable→empty recovery (pass 1
  base/head unresolvable, pass 2 resolvable with no new deps) a spurious `none` note is
  written, contradicting the Data Models invariant and the code's own comment. Defensible
  against hard AC5, so shipped as-is (info severity, not fixed). Evidence: task 3 review v2
  (get-task-review), src/controller/merge.ts:652. Frequency: once; see Repeat patterns.
  Cost: one benign extra ledger note on recovery; no verdict/status/wait effect; no fix round.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

None found. (The ledger shows 57 spawn.start vs 56 spawn.end and 5 phase.start vs 4
phase.end; both deltas are expected floors — the retrospective phase was open and one
orchestrator live at compile time. Evidence: harness-events.jsonl type counts.)

## Prompt misunderstandings

None found. Document phases converged without an implementer misread; 0 fix rounds across
all 14 tasks.

## Inefficiencies

- **F3 — Completion gate was re-entered ~100 minutes after first completion.** The retro
  log records "implementation complete" twice: 07:56 (55 spawns) then 09:36 (56 spawns),
  with phase.end at 09:36. The re-entry cost one extra spawn and a long wall gap. Task 11's
  "skip the e2e pass on re-entry" guard worked — it held the re-entry to a single spawn
  rather than a full completion re-run. Evidence: retro-log 2026-10-22T07:56:28Z and
  09:36:21Z; ledger phase.end line 240. Frequency: once; see Repeat patterns. Cost: 1 spawn,
  ~100 min.
- **F4 — Requirements took 3 rounds, well above the 1-round design and 3-round tasks norm
  only because r1 raised 5 should-fix items.** r1 iterate 0/5/0, r2 iterate 0/1/0, r3
  converged. The r2 finding was a genuine design-gap catch (completion-gate re-entry did not
  guard the e2e verification that gates the security pass), so the rounds bought real value
  rather than churn. Evidence: ledger round lines 13/26/36; reviews/adversarial-analysis-
  requirements.md, -requirements-r2.md. Frequency: once; see Repeat patterns. Cost: 2 extra
  review+revise rounds.

## Documentation gaps

- **F5 — The tasks decomposition did not pre-mark AC 3.2 as a regression guard.** The
  tdd-regression-guard rule says an AC that already holds at base is a guard, not a forced
  red test. For AC 3.2 the test author had to discover the vacuity at implementation time
  rather than the tasks phase flagging it up front, so the red-impossible path was found
  late. Evidence: retro-log 2026-10-22T07:06:21Z (tagged doc-gap); tasks.md task 12.
  Frequency: once. Cost: absorbed in the task-12 test spawn; no fix round.

## Model behaviour

None found. (Worth noting as non-defect context: the design reviser dispositioned all 5
MINOR findings in a single pass and the phase converged at v1, 0/0/0 — no wasted round.
Evidence: ledger round line 47; reviews/adversarial-analysis-design.md.)

## Process deviations and rulings

None found. Gate A and Gate B were both answered by the operator; no rulings, escalations,
or adjudications occurred. Evidence: ledger notes lines 9 and the gate-b note.

## Decisions the harness made for the human

- **F6 — The merge was decided by the coordinator, not the operator.** The ledger records
  `merge answered by coordinator: merge`; the PR (#167) merged without a separate human
  merge gate. This is the standing overwatch policy (coordinator merges every harness-session
  PR once green), applied here autonomously. Evidence: ledger "merge answered by coordinator"
  note; HANDOFF PR #167. Frequency: once (standard). Cost: n/a.
- **F7 — The task-3 info finding was auto-accepted with no deferral and no human sign-off.**
  The verifier judged the `none`-after-`unreadable` note non-blocking (F2) and the task
  closed `pass` with 0 fix rounds; nothing was deferred or escalated. Evidence: task 3 review
  v2 verdict `findings`, retro-log 2026-10-22T05:02:42Z. Frequency: once; see Repeat patterns.
  Cost: a latent invariant deviation ships unrecorded outside this retro.

## Repeat patterns

- **F1 (red-impossible / vacuous test)** also in tdd-task-loop F3 ("RED-IMPOSSIBLE leaves the
  test file untracked") and the vacuous-gate findings there. Here the test was kept tracked
  correctly as a guard, so the earlier failure mode did not recur — only the red-impossible
  condition did. References: this F1; tdd-task-loop/retrospective.md F3.
- **F3 (completion-gate / orchestrator re-entry)** also in dashboard-shell F11 (implementation
  "5 re-entries + 1 duplicate") and re-entry findings in agent-cache-ttl, harness-control-pane.
  References: this F3; dashboard-shell/retrospective.md F11.
- **F2 / F7 (non-blocking info finding shipped unfixed, auto-accepted)** also in
  harness-bookkeeping (task-2 verifier non-blocking info finding, shipped). References: this
  F2/F7; harness-bookkeeping/retrospective.md line 37.
- **F4 (requirements multi-round)** also in harness-control-pane, harness-usage-and-tiers,
  lean-orchestrators, spec-lint, project-bootstrap. References: this F4; those retrospectives.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation (retrospective open) |
| Versions per phase | requirements v3, design v1, tasks v3 |
| Review rounds | requirements 3, design 1, tasks 3 |
| Fix rounds (implementation) | 0 |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 0 (16 open project-wide) |
| Spawns | 56 (spawn.end; spawn.start 57 — floor) |
| Tasks / TDD | 14/14; assertion-red 8, structural-red 4, vacuous 0 (+1 kept guard, F1) |
| PR | #167, merged |

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
