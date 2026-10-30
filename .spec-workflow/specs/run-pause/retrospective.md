# Retrospective — run-pause

Compiled 2026-10-30 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — A new mutating dashboard fetch needs the vite dev-proxy Origin rewrite.** Task 8 was
  the first-ever real mutating fetch exercised by the worktree e2e suite; it failed until the
  `/api` dev proxy rewrote the Origin header the way the WebSocket proxy already did. Any future
  dashboard task that adds a POST/PUT from the frontend hits this. Evidence: impl log
  task-8 cbfc91fc; commit 4064229c. Frequency: once. Cost: folded into the F9 design-defect
  repair (1 escalation + 1 no-op re-verify).

## Product bugs found

- **F2 — Latent CORS bug in the vite dev proxy blocked mutating `/api` requests.** The dev
  proxy did not rewrite the Origin header on `/api`, so the dashboard's origin check rejected
  the first real mutating fetch. Fixed in task 8 (`vite.config.ts`), dev-server only; the
  Fastify-served production dashboard origin check was unchanged. Evidence: impl log
  task-8 cbfc91fc; commit 4064229c; escalation ruling note (run ledger). Frequency: once.
  Cost: +2 lines in the task 8 change; surfaced the F9 design-defect.

## Tool and MCP errors or deficiencies

- **F3 — No usable checks-file for tasks 1 and 7; the gate ran project checks only.** On two
  tasks the implementer produced no checks-file the gate could read, so the gate fell back to
  the project checks. Evidence: run-ledger notes "task 1: no usable checks-file…",
  "task 7: no usable checks-file…". Frequency: 2 times in this spec. Cost: unknown (no
  observed failure; a coverage blind spot).

## Harness defects

None found.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F4 — Three implementer spawns were relaunched as retries with no fix round.** Tasks 1, 2
  and 7 each logged an `implement task N retry` spawn, yet every gate passed on the first
  verdict and the retro log records 0 fix rounds for all three. The retries were spawn
  relaunches, not corrective work. Evidence: `spawn.start` labels in
  harness-events.jsonl. Frequency: 3 times in this spec. Cost: ~3 extra implementer spawns.
- **F5 — Requirements needed a third version as a SHOULD_FIX-only corrective pass.** Two
  review rounds returned should-fix-only verdicts, then v3 was a corrective pass to converge.
  Evidence: round events (requirements rounds 1 `iterate 1/1/0`, 2 `iterate 0/1/0`); commit
  1d76ee92 "requirements v3 SHOULD_FIX-only corrective pass"; approval
  `approval_1793305345807_opwjw2o47`. Frequency: once. Cost: 1 extra document version +
  lint/narrow-check spawns.

## Documentation gaps

- **F6 — Task 8 AC was red-impossible; two sub-cases were never red-tested.** Base code
  already showed ctrl-resume for any `status==='paused'` run regardless of `pauseReason`, so the
  test author wrote a regression guard (green). AC 6.2's busy-state text and 6.3's pending-panel
  sub-case were not separately red-tested — not named in task 8's Success line, riding the same
  `isOperatorHeld` branch test 3 covers. Evidence: retro log 2026-10-29T23:48:02Z;
  notes at /tmp/scratchpad/sdd/run-pause/test-author-task-8-notes.md. Frequency: once.
  Cost: 2 sub-cases untested.
- **F7 — A live-verification scenario is still pending deploy.** The run merged with a
  verification-evidence line left pending a deploy, gated per agent-rules rather than closed.
  Evidence: commit ba9979fb "add pending deploy verification-evidence line". Frequency: once.
  Cost: 1 open verification-evidence line for the operator to run post-deploy.

## Model behaviour

- **F8 — Two stray background watchers left running by the task 8 test author.** Watchers
  b1mloithq and b9nqkslw0 were killed on timeout after their results had already been
  retrieved; no action was needed but they were not cleaned up. Evidence: retro log
  2026-10-29T23:48:02Z. Frequency: 2 watchers, once. Cost: negligible (timeout cleanup).

## Process deviations and rulings

- **F9 — Task 8's File: list omitted `vite.config.ts`, tripping the file-outside-list gate.**
  The gate failed (`file-outside-list: src/dashboard_frontend/vite.config.ts`) because the dev
  proxy fix was required to pass task 8's own real-click POST test but was not in the declared
  list. Phase ended `design-defect` and re-entered in repair mode; the coordinator ruled the
  edit accepted, tasks.md was amended to list the file, and the fix round was a no-op re-verify
  of the existing commit 4064229c. Evidence: retro log 2026-10-30T00:11:24Z and
  2026-10-30T00:00Z escalation note; phase.end `design-defect`; commits 204d3c6b, 61cf90a6.
  Frequency: once. Cost: 1 escalation ruling + 1 repair re-entry + 1 no-op fix spawn.
- **F10 — Task 9 was merged logged but unreviewed.** reviewCoverage closed 8/9; task 9 had a
  log but no review, and the completion gate allowed the merge under the standing rule
  (decision C, retro P9). Evidence: retro log 2026-10-30T00:22:24Z; HANDOFF implementation
  "reviewCoverage 8/9 (unreviewed: 9)". Frequency: once. Cost: 1 unreviewed task shipped.
- **F11 — Tasks 8 and 9 were verifier-skipped (gate-only review).** Both were reviewed by the
  gate only, no independent verifier, per retro P6/P15. Evidence: HANDOFF "Verifier-skipped:
  task 8, task 9". Frequency: 2 tasks. Cost: 2 tasks without independent verification.

## Decisions the harness made for the human

- **F12 — The completion gate merged the unreviewed task 9 without asking.** Rather than block
  on the review-coverage gap, the harness applied decision C (retro P9) and allowed the merge,
  logging it. Evidence: retro log 2026-10-30T00:22:24Z "merge allowed (decision C)"; ledger
  note "merge answered by coordinator: merge". Frequency: once. Cost: 1 merge proceeded on a
  standing rule, not an operator stop.

## Repeat patterns

- **F9 repeats dashboard-project-list F1.** Both: a task's File: list omitted a file the task's
  own test forced it to edit, the gate flagged file-outside-list, the operator ruled the list
  should include it, and the fix round was a no-op re-verify. Evidence: this spec retro log
  2026-10-30T00:11:24Z; dashboard-project-list/retrospective.md F1 (retro log
  2026-10-29T13:08:38Z, commit 88c47fff). Seen in advisor, dashboard-loop-views,
  dashboard-shell, dashboard-visual-refresh, harness-evals, harness-usage-and-tiers too.
- **F10 repeats the unreviewed-merge pattern.** A completed-but-unreviewed task merged under a
  standing allowance. Evidence: this spec retro log 2026-10-30T00:22:24Z; also
  graph-orientation/retrospective.md, review-gate/retrospective.md, dashboard-project-list,
  dashboard-visual-refresh, harness-evals, lean-orchestrators.
- **F2/F1 repeat dashboard-shell F8.** A dev/worktree frontend-origin mismatch blocked
  dashboard traffic. Evidence: dashboard-shell/retrospective.md F8 (worktree e2e frontend port
  missing from the CORS allow-list); this spec impl log task-8 cbfc91fc.
- **F3 repeats dashboard-shell F4.** The gate could not read a checks-file and fell back.
  Evidence: dashboard-shell/retrospective.md F4; this spec ledger notes for tasks 1 and 7.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation (+ retrospective) |
| Versions per phase | req v3, design v2, tasks v2 |
| Review rounds | req 2 (+v3 corrective), design 2, tasks 2 |
| Fix rounds | 1 (task 8, no-op re-verify) |
| Adjudications | 0 |
| Escalations | 1 (task 8 file-outside-list) |
| Rulings | 1 ruling + gate-A/gate-B/merge answers |
| Deferrals added | 0 (26 open project-wide) |
| Spawns | 44 (45 spawn.start rows) |
| TDD | 8 tasks: assertion-red 4, structural-red 4, vacuous 0 |
| PR | #195 (merged) |

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
