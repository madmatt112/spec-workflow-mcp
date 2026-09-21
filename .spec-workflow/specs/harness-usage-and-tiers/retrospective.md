# Retrospective — harness-usage-and-tiers

Compiled 2026-09-21 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Design carried a citation-span slip into implementation.** design.md line 78 and
  the v3 Revision History cite the `agent.stop` activity join as lines 305-311, but the
  real join runs `src/watch/ledger.ts:293-314`; the load-bearing guarded-fill line (308)
  is correct, so it is a MINOR span slip, not a false claim, and the narrow check let it
  through as a note for the implementer. Evidence: retro log 2026-09-19T18:40:22Z; HANDOFF
  design Carried items. Frequency: once. Cost: 0 rework (implementer reads the code).

## Product bugs found

None found.

## Tool and MCP errors or deficiencies

- **F2 — `harness brief` needs `title` beside `path`, and `job` for the verifier
  template.** The required placeholders are not obvious from the template name, so the
  first brief call for a verifier can miss them. Evidence: HANDOFF implementation Gotchas
  line 310. Frequency: once this spec. Cost: unknown (a corrected re-call, no respawn).

## Harness defects

- **F3 — The gate `files` list must manually enumerate every generated `plugins/` copy
  for a `harness/` task.** Task 8's gate failed `file-outside-list` x18 because the files
  list named the `harness/` sources but not the three `plugins/` mirror copies the sync
  step regenerates; re-running with all copies listed passed. The gate treats derived
  mirror files as unlisted edits. Evidence: retro log 2026-09-21T17:51:49Z; HANDOFF
  Gotchas. Frequency: once this spec; recurs across specs (see Repeat patterns). Cost: 1
  extra gate call, no worker respawn.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F4 — Self-inflicted citation-path lint churn in requirements.** Three rounds (v2-v4)
  of rewriting Revision-History lint bullets to satisfy the citation-identifier rule
  before the v4 lint pass collapsed them to token-free prose. Evidence: retro log
  2026-09-19T16:29:52Z and 2026-09-19T16:32:46Z. Frequency: 3 rounds this spec; recurs
  across specs (see Repeat patterns). Cost: ~3 lint passes of churn.
- **F5 — Requirements hit the v4 cap and needed a post-cap adjudication.** Five rounds,
  all substantive findings circling Req 5's token-counting rule (spawn identity,
  `spawn.usage` fallback, token-state marks) against the question-gates fixture totals;
  adjudicated to v5, narrow check VERIFIED 2/2, no items ruled out. Evidence: retro log
  2026-09-19T16:32:46Z; approval_1789835511785_5tgmkk1h5. Frequency: once this spec. Cost:
  4 reviewer + 6 reviser + 1 adjudicator + 1 checker spawns.

## Documentation gaps

- **F6 — Design rule (c) names a model field the Data Models and `formatUsageTable`
  omit.** A phantom clause: the design's rule (c) references a model field absent from the
  Usage* Data Models and from `formatUsageTable`, worth trimming in a future design pass.
  Evidence: task 4 verifier finding, `src/watch/usage.ts:163`; retro log
  2026-09-21T17:20:00Z doc-gap. Frequency: once. Cost: no rework; info only.

## Model behaviour

None found.

## Process deviations and rulings

- **F7 — Two design re-decided flags ruled refinement and closed.** Req 4.7 (two-line
  agent entry, head + tier each ≤80 cols) and Req 5.4 / D6 ("states unknown" widened to
  any non-digit `tokens` value) were re-flagged in design review; the reviewer closed both
  as refinement, and the tasks drafter honoured the closure. Evidence: HANDOFF design
  Rulings; retro log 2026-09-19T17:41:01Z. Frequency: 2 rulings, both closed. Cost: 0
  extra rounds.

## Decisions the harness made for the human

- **F8 — Overwatch carried a stale token-source description rather than spend a revision
  round.** A mid-phase skill fix (f616c72) moved the per-spawn token count from a
  now-absent Agent result footer to the task notification's `<usage><subagent_tokens>`;
  requirements.md still described the old footer. Overwatch ruled a HANDOFF Carried item,
  not a revision, because a revision plus review round costs more than the stale line is
  worth. Evidence: retro log 2026-09-19T16:35:31Z; HANDOFF requirements Carried items;
  commit f616c72. Frequency: once. Cost: 0 rounds (ruled, not revised).

## Repeat patterns

- **F3 ↔ harness-bookkeeping F10, review-gate F2, spec-lint F2.** A `harness/` edit
  regenerates its `plugins/` mirror copies, and the gate counts or rejects them
  (line-count inflation there, `file-outside-list` here). Seen in four specs now.
- **F4 ↔ harness-bookkeeping F11, question-gates F4/F6, spec-lint F17,
  worktree-review-signals F1/F11.** The spec-lint citation-identifier rule fires false
  positives on nearly every document version that names new fields or paths, driving lint
  churn. Seen in five specs now.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | req v5, design v3, tasks v1 |
| Review rounds | req 5, design 3, tasks 1 |
| Fix rounds (impl) | 0 |
| Adjudications | 1 (requirements post-cap) |
| Escalations | 0 |
| Rulings | design 2 (both closed refinements); requirements 1 carry ruling |
| Deferrals added | 1 (d-3091be1c, verification) |
| Orchestrator/worker spawns | req ~13, design ~9, tasks ~3, impl 11 workers |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/54 |

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
