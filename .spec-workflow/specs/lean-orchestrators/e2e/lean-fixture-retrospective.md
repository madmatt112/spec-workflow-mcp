# Retrospective — lean-fixture

Compiled 2026-10-05 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Gate scored risk "high" on every task with no sensitive-paths list.** With no
  sensitive-paths list configured, the completion gate treats every path as sensitive,
  so all six tasks scored gate-pass risk "high" even though each was a clean append and
  the verifier passed round 0. The signal was pure noise. Evidence: retrospective-log.md
  entries 2026-10-05T15:03:11Z (task 1) through 15:26:47Z (task 6); HANDOFF
  "lean-fixture — implementation" gotchas. Frequency: 6 times in this spec (every task).
  Cost: 0 fix rounds caused, but a false high-risk signal on every task review.

- **F6 — Code-point semantics handled consistently across all six helpers.** Every
  helper used the string iterator / spread for code-point handling (astral characters
  kept whole in reverse, isPalindrome, truncate; locale-independent case in capitalize,
  slugify). No UTF-16 split bug slipped through. Evidence: Implementation Logs task-1
  through task-6; design pins (D1, D3). Frequency: all 6 helpers. Cost: none (positive).

## Product bugs found

None found.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F1 (see Gotchas) — missing sensitive-paths config inflates gate risk.** The absence
  of a configured sensitive-paths list makes the gate score every path sensitive, so the
  risk field is uninformative for a repo of plain source files. Evidence: HANDOFF
  implementation gotchas; retrospective-log.md 15:26:47Z. Frequency: 6 times. Cost: noise
  on every task review, 0 rounds.

- **F5 — No PR could be opened: no git remote on the fixture repo.** The implementation
  phase expects to push and open a PR, but the scratch code repo has no remote and sits on
  `main`, so the PR step was skipped. Expected for a fixture, but the phase has no clean
  "no-remote" path. Evidence: HANDOFF implementation "PR | none"; retrospective-log.md
  15:34:21Z phase summary. Frequency: once. Cost: none (fixture environment).

## Prompt misunderstandings

None found.

## Inefficiencies

- **F2 — E2E completion gate points 1/2 cite harness artifacts not in the code store.**
  The decomposition's end-to-end points 1 and 2 (harness usage CLI rows, baseline-sources.md)
  reference harness artifacts that are not shipped in the fixture code repo, so the e2e
  verifier spent a spawn confirming them out-of-scope rather than verifying code. Only
  point 3 (green `npm test`) was a real code check. Evidence: retrospective-log.md
  15:33:26Z; tasks.md "Scope notes" line 80. Frequency: once (at the e2e gate). Cost: 1
  verifier spawn partly spent on out-of-scope reconciliation.

## Documentation gaps

- **F3 — Requirement criteria 7.2/7.4/7.6 are not reachable per task.** At task 1 the
  author flagged criterion 7.6 (all six helpers present) as RED-IMPOSSIBLE, and 7.2/7.4
  as not reachable through the `capitalize(s)` seam — these are whole-file criteria that
  only the final task can satisfy, yet every task cited all of 7.1–7.7. The per-task
  requirement mapping overclaims. Evidence: retrospective-log.md 14:59:44Z (task 1
  doc-gap). Frequency: once (surfaced at task 1; latent on tasks 2–5). Cost: 0 spawns;
  reasoning overhead at each task's criteria check.

## Model behaviour

- **F4 — Fast, clean convergence with zero fix rounds.** All three document phases
  converged early (requirements v2 after one SHOULD_FIX, design and tasks v1), and all
  six implementation tasks passed the verifier on round 0 with 0 fix rounds, 0
  adjudications, 0 deferrals. Evidence: retrospective-log.md phase-summary entries;
  spec-status (6/6, reviewCoverage 6/6). Frequency: whole spec. Cost: none (positive —
  low spawn count).

## Process deviations and rulings

None found. Rulings: 0 across all phases (retrospective-log.md cleanup entries).

## Decisions the harness made for the human

- **F7 — Gate A, gate B, and e2e out-of-scope all recorded with no human.** Gate A
  (requirements) and gate B (tasks) were recorded "no human", and the orchestrator ruled
  the two e2e harness-artifact points out-of-scope autonomously. Reasonable for a fixture,
  but three human-gate points were passed without review. Evidence: HANDOFF phase log
  (gate-a, gate-b "no human"); retrospective-log.md 15:33:26Z. Frequency: 3 points. Cost:
  none measured.

## Repeat patterns

None found. This is the only spec in the store with a retrospective; no earlier
`retrospective.md` exists to compare against.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements v2, design v1, tasks v1 |
| Review rounds | requirements 2, design 1, tasks 1 |
| Fix rounds | 0 |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 0 |
| Tasks | 6/6 complete, verifier pass round 0 each |
| Tests | 34/34 green (npm test) |
| PR | none (no git remote) |

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
