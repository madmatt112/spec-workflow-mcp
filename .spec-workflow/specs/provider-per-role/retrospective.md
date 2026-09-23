# Retrospective — provider-per-role

Compiled 2026-09-23 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Launcher tested a bare `$DEEPSEEK_API_KEY` under `set -u`.** Line 18 read the key
  unquoted, so an unset key aborted with unbound-variable exit 1 instead of the intended
  exit 2 no-row path; fixed to `${DEEPSEEK_API_KEY:-}`. Evidence: retrospective-log.md
  16:47:48Z; commit 044bbc3; get-task-review task 1 v2. Frequency: once. Cost: 1 fix round
  + 1 verifier spawn.
- **F2 — Task 1 escalated on the first run because `DEEPSEEK_API_KEY` was unset.** The key
  gate (Req 6 crit 7, D6) correctly wrote no launcher body and reported ESCALATE, but this
  blocked tasks 2, 4, 5, 6 and forced a human-mediated stop and full re-run of task 1 once
  the key was exported. Evidence: retrospective-log.md 16:01:35Z; commit 3d0a541.
  Frequency: once. Cost: 1 wasted implementer spawn + one session stop.

## Product bugs found

None found. All defects were in the harness code under construction (F1) and were caught
in-phase, not pre-existing product bugs.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F3 — Task 10's brief made the implementer overwrite the shared `EVENT_SCRIPT`.** The
  brief said to stage a scratch store "with its own event.sh"; the implementer wrote it at
  the supervisor's shared path `/tmp/scratchpad/sdd/provider-per-role/event.sh` pointing at
  the scratch ledger (run id run-20260923-000010). Five real rows (task.done 10, phase.end,
  two spawn.usage, a deferral note) landed in the scratch ledger until the supervisor moved
  them back and restored event.sh. Evidence: retrospective-log.md 22:43:26Z; tasks.md task
  10 _Prompt. Frequency: once here; repeat class (see F12). Cost: 5 misrouted rows + one
  supervisor repair.
- **F4 — A WSL crash left the run ledger with 596 trailing NUL bytes.** The crash killed
  the session after task 6; `harness-events.jsonl` was corrupt past its last complete line.
  The supervisor truncated to that line (225 rows) and resumed the same run id. The ledger
  has no crash-resilience or auto-repair. Evidence: retrospective-log.md 22:00:27Z; commit
  7336c03. Frequency: once. Cost: one resume spawn + manual truncation.

## Prompt misunderstandings

- **F5 — "Its own event.sh" read as the shared path, not a scratch-store path.** The task
  10 brief's scratch-store wording did not name a distinct file location, so the implementer
  reused the supervisor's `EVENT_SCRIPT` path. Root cause of F3. Evidence: retrospective-log.md
  22:43:26Z; tasks.md task 10 _Prompt. Frequency: once. Cost: folded into F3.

## Inefficiencies

- **F6 — Requirements hit the v4 review cap with fix-induced findings.** Four rounds
  (1/6/2 → 1/1/2 → 1/1/0), MUST_FIX flat r2→r3, no cap-convergence round granted, routed to
  post-cap adjudication for v5. Both remaining items compounded earlier fixes. Evidence:
  retrospective-log.md 16:38:57Z, 16:46:10Z. Frequency: once. Cost: 4 reviewer + 4 reviser
  + 1 adjudicator spawns.
- **F7 — Tasks hit the v4 review cap the same way.** Four rounds (0/2/2 → 1/1/1 → 1/1/1 →
  1/1/0); every post-r1 MUST_FIX was fix-induced (citation-path/range slips and contradiction
  remnants), MUST_FIX flat r3→r4, routed to post-cap adjudication for v5. Evidence:
  retrospective-log.md 21:02:27Z. Frequency: once; same shape as F6. Cost: 4 reviewer + 1
  checker + 7 reviser + 1 adjudicator spawns.

## Documentation gaps

- **F8 — `SDD-HARNESS.md` "no MCP server" is loose for the eligible reviser.** The blanket
  statement is the anthropic default, but the eligible `sdd-reviser` gets `--mcp-config`
  (design.md:133), so the line is slightly wrong for that case. Evidence: retrospective-log.md
  22:24:45Z; docs/SDD-HARNESS.md; commit 43c3414. Frequency: once. Cost: noted, no rework.
- **F9 — Req 6 crit 5's auth-path clause is grammatically garbled.** The intended rule (a
  "no" answer fails preflight (a)) is inferable but does not parse cleanly; deferred at
  approval and carried to design as a note. Evidence: retrospective-log.md 16:48:00Z; HANDOFF
  requirements Carried items. Frequency: once. Cost: none (deferred, not fixed).
- **F10 — Stale CLI version citation in requirements.** Req 2 crit 5 cites CLI `2.1.278`;
  installed is `2.1.280`. Flagged MINOR out-of-scope by the adjudicator, left for a later
  phase. Evidence: retrospective-log.md 16:46:10Z. Frequency: once. Cost: none.

## Model behaviour

- **F11 — Reviser fixes to multi-site contradictions were incomplete, generating fix-induced
  MUST_FIX.** A fix that touched 3 of 4 sites left a contradiction remnant (tasks R4-1 carried
  from R1-1, R4-2 from R3-2), and lint passes mis-prefixed citation ranges (tasks R3-1). Every
  post-r1 MUST_FIX in both document phases was fix-induced rather than novel. Evidence:
  retrospective-log.md 20:35:16Z, 20:54:54Z, 21:02:27Z. Frequency: recurring within this spec
  (both requirements and tasks). Cost: drove F6 and F7 to the cap.

## Process deviations and rulings

- **F12 — Design ruled two drafter RE-DECIDED literals as refinement.** Req 2 crit 5 (the
  `--agents` JSON `model` key carries the request alias, effort still from profiles) and Req 2
  crit 7 (`--add-dir` passed when the spec store repo is outside the code root) ruled
  refinement/closed inside round 1, no extra spawn. Evidence: retrospective-log.md 17:46:10Z;
  reviews/adversarial-analysis-design.md. Frequency: 2 rulings. Cost: none.
- **F13 — Requirements v1 was drafted and linted pre-gate and never reviewed.** The approved
  run was a revision-mode run applying the Gate A answers; the refused-at-start run writes no
  ledger row. Not a defect, but it means v1 had no adversarial pass. Evidence:
  retrospective-log.md 16:49:34Z. Frequency: once. Cost: none.

## Decisions the harness made for the human

- **F14 — Cap-convergence extra round refused twice, auto-routing to adjudication.** At both
  requirements v4 and tasks v4 the MUST_FIX count was flat, so the harness declined an extra
  review round and went to the post-cap corrective pass without asking. Evidence:
  retrospective-log.md 16:38:57Z, 20:54:54Z. Frequency: 2 times. Cost: 2 adjudicator spawns
  (vs 2 more review rounds).
- **F15 — On the WSL crash the supervisor auto-truncated the ledger and resumed the same run
  id.** No human confirmation of the truncation point. Evidence: retrospective-log.md
  22:00:27Z. Frequency: once. Cost: none (correct call).

## Repeat patterns

- **F16 — The shared `event.sh` / `EVENT_SCRIPT` path gets clobbered, splitting a run across
  ids.** This spec: task 10's E2E scenario overwrote the shared event.sh (F3). Also
  harness-bookkeeping F6 (a peer supervisor rewrote event.sh + .runid, splitting 25 tasks-phase
  events) and question-gates F3 (the tasks orchestrator re-initialized event.sh with a fresh
  run id). Evidence: this spec retrospective-log.md 22:43:26Z; harness-bookkeeping
  retrospective.md F6; question-gates retrospective.md F3. Frequency: 3 specs. Cost: ledger
  run grouping fragmented for `--watch` each time; manual repair.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements v5, design v2, tasks v5 |
| Review rounds | requirements 4, design 2, tasks 4 |
| Fix rounds (impl) | 1 (task 1) |
| Adjudications | 2 (requirements v5, tasks v5); 0 in implementation |
| Escalations | 1 (task 1, unset key) |
| Rulings | 2 (design round 1) |
| Deferrals added | 1 (d-a38fea66, verification) |
| Orchestrator spawns | 3 supervisor sessions (restart, key-escalate re-run, post-crash resume) |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/59 (open) |

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
