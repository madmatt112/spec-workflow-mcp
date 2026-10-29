# Retrospective — dashboard-visual-refresh

Compiled 2026-10-29 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — A self-hosting repo cannot gate-verify its own gate fix before merge.** Task 1's gate
  had a bug (declared-directory File entries) whose fix lives in `src/core/task-parser.ts`,
  inherently outside task 1's own File: list, so no in-loop gate run could pass it. Evidence:
  retro-log 2026-10-29T00:16:15Z; fix-round-3-findings.md. Frequency: once. Cost: 3+ fix rounds.
- **F2 — A net-zero revert pair in the gate's commit range produced a phantom structural-red.**
  Commits 3015906c/9796d63e (the reverted parser fix) sat inside task 3's gate range, inflating
  tdd head/line-count (303/structural-red) though the net diff was zero. Evidence: task 3 review
  v1 summary. Frequency: once. Cost: folded into task 3's 4 fix rounds.
- **F3 — The e2e visual capture did not reset the durable project list.** `resetSpecWorkflowHome`
  truncates `activeProjects.json` only, not `projects.json`, so repeated captures polluted the
  sidebar and screenshots until `playwright.worktree.config.ts` was fixed. Evidence: retro-log
  2026-10-29T00:00:02Z; commit e89b1edb. Frequency: once. Cost: 1 implementer round.

## Product bugs found

- **F4 — Gear's notify-enable button is not drawn from the shared Button (latent 4.1 gap).**
  `Gear.tsx:109` keeps a hand-styled raw `<button>`; no downstream task covers it (task 4 greps
  only `*Page.tsx`, the sameness test searches inside `main` while Gear is in the sidebar).
  Token-clean, so nothing broke. Evidence: task 3 review v1 finding; d-8b739a63. Frequency: once.
  Cost: deferred, open.

## Tool and MCP errors or deficiencies

- **F5 — A fix brief carried another task's content.** Task 4's fix brief listed task 1's Operator
  rulings and `<A>-<B>` task-reference, not task 4's actual gate reasons. Evidence: retro-log
  2026-10-29T04:34:16Z. Frequency: once. Cost: part of task 4's wasted round.
- **F6 — The gate re-sent a byte-identical fix brief as a new round.** Task 4's fix-round-2 output
  was byte-identical to round 1 (including task 1's already-resolved rulings), and its "tests fail
  on HEAD" was contradicted by a live re-run. Evidence: retro-log 2026-10-29T04:38:41Z. Frequency:
  once. Cost: 1 escalation.
- **F7 — A "MANDATORY: run graphify query" system-reminder was injected into Grep/Read results
  with no graphify-out present.** It looked like prompt injection and was ignored. Evidence:
  retro-log 2026-10-29T00:07:35Z; recurred in this compile session's Grep hook. Frequency: twice.
  Cost: unknown.

## Harness defects

- **F8 — The gate ranges from the implementer's last reported commit, not the task's first.**
  This yields stale ranges and false `file-outside-list` escalations. Evidence: d-e6bee5d8;
  retro-log 2026-10-29T03:16:02Z (HANDOFF Next). Frequency: once, open. Cost: unknown.
- **F9 — A `file-outside-list` verdict cannot be moved by any implementer edit.** When the needed
  path is outside the task's File: entries, the fix is a tasks.md edit; task 1 re-ran the gate
  twice with an unchanged commit and got the same verdict. Evidence: retro-log 00:17:12Z,
  02:34:36Z. Frequency: 2 rounds. Cost: 2 wasted rounds.
- **F10 — The declared-directory annotation dropped its trailing slash, so prefix matching flagged
  every file under the directory as outside-list.** Fixed in `src/core/task-parser.ts` (then
  reverted per F1). Evidence: retro-log 2026-10-29T00:07:35Z; commits 3015906c/9796d63e. Frequency:
  once. Cost: folded into task 1.
- **F11 — The loop resends an identical brief instead of routing to the verifier.** Task 4's fail
  was pre-declared verifier routing (line-count/structural-red from tasks.md), not an implementer
  defect, yet the loop resent the brief rather than routing to the verifier. Evidence: retro-log
  2026-10-29T04:38:41Z. Frequency: once. Cost: 1 escalation.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F12 — Task 3 ran 4 fix rounds / 5 implementer spawns before an adjudicated narrow pass**, all
  over the phantom gate artifact of F2. Evidence: retro-log 2026-10-29T04:05:55Z. Frequency: once.
  Cost: 4 rounds, 5 spawns, 1 adjudication.
- **F13 — Task 1 burned rounds re-running a gate no implementer edit could satisfy.** Two fix
  rounds left the commit unchanged and returned the same `file-outside-list` verdict. Evidence:
  retro-log 00:17:12Z, 02:34:36Z. Frequency: 2 rounds. Cost: 2 rounds.
- **F14 — Task 5 spent 2 fix rounds / 3 spawns, both on pre-existing npm test failures.** The
  failures base-diff as pre-existing, so the rounds added no fix. Evidence: retro-log
  2026-10-29T05:53:37Z; task 5 review v1. Frequency: 2 rounds. Cost: 2 rounds, 3 spawns.
- **F15 — A 6-task visual refresh cost 54 spawns and 11 fix rounds.** Evidence: retro-log
  2026-10-29T09:43:52Z. Frequency: whole spec. Cost: 54 spawns, 11 fix rounds.

## Documentation gaps

None found.

## Model behaviour

- **F16 — The implementer correctly flagged, rather than silently absorbed, verdicts it had no
  authority to fix.** It logged the F7 injected reminder as suspected injection and logged that
  `file-outside-list` needs a tasks.md edit. Evidence: retro-log 00:07:35Z, 00:17:12Z. Frequency:
  twice. Cost: none (positive).

## Process deviations and rulings

- **F17 — Task 3 was adjudicated after 3 fix rounds; narrow verdict pass.** Evidence: retro-log
  2026-10-29T04:05:55Z (ruling). Frequency: once. Cost: 1 adjudication.
- **F18 — Task 4 escalated: gate resend with stale content, routed by the operator.** Evidence:
  retro-log 2026-10-29T04:38:41Z. Frequency: once. Cost: 1 escalation.
- **F19 — Review coverage gap: task 6 was logged but unreviewed; merge allowed (decision C, retro
  P9).** reviewCoverage 5/6. Evidence: retro-log 2026-10-29T06:18:36Z; HANDOFF implementation.
  Frequency: once. Cost: 1 task unreviewed at merge.

## Decisions the harness made for the human

- **F20 — Merge allowed despite the task 6 review coverage gap (decision C / retro P9).**
  Evidence: retro-log 2026-10-29T06:18:36Z. Frequency: once. Cost: merge proceeded.
- **F21 — Six pre-existing npm test failures were allowed past the e2e gate (D9).** Worse-than-base
  recorded as a signal, merge not blocked. Evidence: d-ee90c2ed; task 5 review v1. Frequency: once.
  Cost: 6 failing suites carried.
- **F22 — The uncommitted re-captured before-screenshots deferral was resolved at the merge gate by
  the harness.** Evidence: d-85d402c5 (resolved). Frequency: once. Cost: 1 merge-gate check.

## Repeat patterns

- **F8/F9/F10 ↔ dashboard-loop-views F4/F5, dashboard-shell F3, harness-usage-and-tiers F3,
  harness-evals F5.** A `file-outside-list` gate the implementer cannot satisfy (incomplete File:
  list, dir globs, or a path outside scope) — now the fifth spec. Evidence: those retrospectives'
  cited findings; this spec retro-log 00:17:12Z.
- **F21 ↔ dashboard-loop-views F3, dashboard-shell F2, harness-control-pane F7, advisor F17.**
  Pre-existing full-suite failures reaching the gate and admitted under D9. Evidence: those
  retrospectives; this spec task 5 review v1, d-ee90c2ed.
- **F2/F8 ↔ tdd-task-loop (gate commit range took in spec-store commits, retro line 57).** The gate
  range swallows commits that are not the task's work. Evidence: tdd-task-loop retrospective.md:57;
  this spec task 3 review v1.
- **F12/F17 ↔ advisor F14 ("adjudicated after 3 fix rounds; narrow verdict pass") and F8.** A
  single task runs ~4 fix rounds / 5 spawns into adjudication. Evidence: advisor retrospective.md
  55,81; this spec retro-log 04:05:55Z.
- **F19 ↔ tdd-task-loop (coverage gap noted so the human sees it, retro line 121).** A review
  coverage gap is logged and the merge proceeds. Evidence: tdd-task-loop retrospective.md:121; this
  spec retro-log 06:18:36Z.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements v4; design v2; tasks v2; implementation 6 tasks |
| Review rounds (docs) | requirements 3; design 1; tasks 1 |
| Fix rounds (impl) | 11 (task 3: 4, task 5: 2, task 1: gate rounds, others 0) |
| Adjudications | 1 (task 3) |
| Escalations | 1 (task 4) |
| Rulings | 1 (task 3 narrow pass); docs none |
| Deferrals | 6 records originSpec (gate logged 3 added in final batch); 1 resolved, 5 deferred |
| Spawns | 54 (12 implementer: 1/1/5/1/3/1) |
| Coverage | logCoverage 6/6; reviewCoverage 5/6 (task 6 unreviewed) |
| PR | #187, merged |

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
