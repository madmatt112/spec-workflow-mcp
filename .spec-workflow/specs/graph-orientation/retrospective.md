# Retrospective — graph-orientation

Compiled 2026-09-26 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Graph column undercounts separate-process (DeepSeek) workers by design.** The
  `harness usage` graph column counts graph calls from the activity/ledger stream, which
  does not capture workers that run as a separate process (DeepSeek readers). Requirements
  accepted this as a known limitation (R6), not a defect. It means the graph column is a
  floor, not a true count. Evidence: HANDOFF `## graph-orientation — requirements` line
  482; retro log 2026-09-25T17:27:04Z (R1-3). Frequency: structural, every run with a
  separate-process reader. Cost: unknown (measurement bias only).
- **F2 — Verifier skipped on verification-only tasks makes spec-status read 8/10 reviewed.**
  Tasks 9 and 10 were spec-store/verification-only; the verifier is skipped by policy
  (retro P15), so `reviewCoverage` reads 8/10 and `spec-status` nextSteps nags about "2
  completed tasks without reviews". The nag is expected but looks like an open gap.
  Evidence: HANDOFF line 520; spec-status reviewCoverage unreviewed 9,10; retro log
  2026-09-25T22:16:56Z. Frequency: once here, recurs on any verification-only task. Cost:
  none (cosmetic).

## Product bugs found

None found.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F3 — Activity hook truncates drafter graph calls; graph-call count undercounts.** The
  activity hook cuts Bash summaries at 160 characters, and the drafter prefixes each Bash
  call with `cd <absolute root>;`, so a `graphify query`/`explain` chained after the `cd`
  is cut off. In live scenario (3) the drafter transcript shows two graph calls (14:17:26,
  14:17:29) before its first raw source read (14:17:32), but `harness-activity.jsonl`'s
  first visible graph row is 14:17:36 — after the read. So the usage graph column and the
  D4/D8 design intent (prove graph-before-read) undercount from the activity stream.
  Matthew marked (3) passed and asked for this as a retro item. Evidence:
  verification-evidence.md line 8; retro log 2026-09-26T14:55:22Z; fixture run-fixture-s3.
  Frequency: every drafter/orchestrator graph call that follows a `cd` prefix. Cost: one
  fixture requirements spawn, ~2.1M tokens to diagnose.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F4 — Live-verification halves deferred to a rebuilt, restarted session.** Scenarios
  (2), (3), (4) could not run inside the build session (need the merged checkout built and
  the session restarted), so they parked as `pending` lines in the tracked
  verification-evidence file and an operator ran them before the retro opened. This split
  the verification and delayed close. Evidence: verification-evidence.md lines 3-9; HANDOFF
  line 519; design C7. Frequency: 3 scenarios this spec; recurring pattern (see F8). Cost:
  operator time + a separate session, not measured.
- **F5 — Diagnosing one live scenario cost a ~2.1M-token fixture run.** Proving the
  graph-before-read ordering for scenario (3) required standing up a fixture spec and
  running a real requirements drafter spawn (~2.1M tokens), which then exposed F3 rather
  than confirming the intent. Evidence: retro log 2026-09-26T14:55:22Z. Frequency: once.
  Cost: ~2.1M tokens, one spawn.

## Documentation gaps

None found.

## Model behaviour

None found.

## Process deviations and rulings

- **F6 — Design ruling D8: a graph fact must come from a graph command.** The reviewer
  ruled (RE-DECIDED Req 6 AC2) that a grep for the graph-fact phrase does not satisfy the
  "graph fact" requirement; it must come from a graph command. Refinement, closed at design
  v1. Evidence: retro log 2026-09-25T18:45:57Z; HANDOFF line 491; approval
  approval_1790361966822_09kylbcnh. Frequency: once. Cost: folded into the single design
  round, no extra spawn.
- **F7 — Requirements round-2 MUST_FIX were both fix-induced by the v2 delta.** Round 2's
  two MUST_FIX (shrink-guard claim false; R6 AC8 wrong line + false shared-scope claim)
  were introduced by the v2 revision, not present in v1 — the fix-round added false claims
  that round 3 then had to correct. Evidence: retro log 2026-09-25T17:50:47Z (R2-1, R2-2).
  Frequency: 2 of 2 round-2 MUST_FIX. Cost: one extra requirements round (v3) + reviser
  spawn.

## Decisions the harness made for the human

- **F8 — Verification halves were parked as pending and resolved by an operator, not the
  harness.** The harness decided at design time (C7) to split live scenarios into a tracked
  evidence file rather than block the phase, deferring the operator-run halves. This is the
  same pattern CLAUDE.md codifies (`deferrals list tag=verification`, resolve after rebuild
  + restart). Evidence: verification-evidence.md; HANDOFF line 518 (d-a38fea66, d-1880d115).
  Frequency: recurring across harness specs. Cost: deferred verification latency.

## Repeat patterns

- **F3/F1 undercount family ↔ agent-cache-ttl F5.** This spec's graph-call and graph-column
  undercounts (activity-hook truncation; separate-process readers) are the same class as
  agent-cache-ttl F5 (`spawn.end` first-yield undercount since PR #62 P17): the ledger/usage
  instrumentation systematically undercounts a class of events. Evidence: this
  retrospective F1, F3; agent-cache-ttl/retrospective.md F5 (commit 59a6374).
- **F8 verification-halves-need-restarted-session.** Deferring the live half of a
  verification scenario to a rebuilt/restarted session recurs across harness specs and is
  codified in CLAUDE.md and open verification-tagged deferrals (d-a38fea66, d-1880d115).
  Evidence: HANDOFF line 518-519; project CLAUDE.md "deferrals list tag=verification".

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | req v3, design v1, tasks v1 |
| Review rounds | req 3, design 1, tasks 1 |
| Fix rounds (impl) | 0 across 10 tasks |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 1 (D8, design) |
| Deferrals added | 0 |
| Orchestrator spawns | 4 phase orchestrators + this retro |
| Worker spawns | req 3 reviewer + 4 reviser; design 1 reviewer + 1 reviser + 1 drafter; tasks 1 reviewer + 1 reviser; impl 10 implementer, 0 verifier |
| PR | #67 (merged, edf9333) |

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
