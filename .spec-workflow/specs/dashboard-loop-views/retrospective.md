# Retrospective — dashboard-loop-views

Compiled 2026-10-20 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — A non-canonical test-seam label stalls the whole implementation phase.** Task 4
  named its test as `- Test (integration):`. The tasks parser matches only `- Test:`
  (`TEST_BULLET_RE`, `src/core/task-parser.ts:14`), so the file was dropped from
  `task.tests`, the gate's allowed-file list omitted the mandated test, and the gate flagged
  `file-outside-list` every run — unfixable by any implementer edit. Evidence: retro-log
  2026-10-19T21:25:59Z; `/tmp/scratchpad/sdd/dashboard-loop-views/task-4-fix-1-report.md`.
  Frequency: once (2 design-defect loops). Cost: see F4/F7.
- **F2 — Full `npm test` runs for the first time at task 14 and surfaces latent failures.**
  Tasks 1–13 ran only their own module's vitest; task 14's full suite is the first to hit
  pre-existing fails and e2e flake. Evidence: retro-log 2026-10-20T01:03:54Z. Frequency:
  once. Cost: one escalation.

## Product bugs found

- **F3 — Five pre-existing vitest failures block the full-suite gate.** `npm test` failed 5
  tests at branch HEAD unrelated to this spec (log-implementation override-root selection;
  durable project list: added project across restart, worktree project, remembered-gone dir).
  The operator ruled them environment-coupled (28/28 pass in the worktree), not regressions.
  Evidence: task-14-report.md Blocker 2; ledger escalation 2026-10-20T01:03:54Z. Frequency:
  once. Cost: part of the task-14 escalation; deferred to CI.

## Tool and MCP errors or deficiencies

- **F4 — `log-implementation` threw `Cannot read properties of undefined (reading
  'linesAdded')` on a worktree commit.** The MCP server runs from the MAIN checkout
  (`node /home/mcf/repo/spec-workflow-mcp/dist/index.js` per the launch mcp-config), so for
  task 14's worktree commit its diff had no stats and `.linesAdded` read off undefined.
  Tasks 1–13 logged fine, so main's dist regressed since. The payload was captured in the
  task report in lieu of the tool. Evidence: task-14-report.md Blocker 3; retro-log
  2026-10-20T01:03:54Z. Frequency: once this spec. Cost: one manual log payload; fed the
  escalation.

## Harness defects

- **F5 — The tasks parser silently drops any test bullet that is not exactly `- Test:`.**
  `TEST_BULLET_RE = /^[-*]\s+Test:\s*(.*)$/` treats `- Test (integration):` as a plain
  detail bullet, so `isTddTask` returns false, no red author runs, and the gate receives no
  `tdd.testFiles` to extend its allowed list. No code can fix it; only a tasks.md edit. The
  canonical form is in `tasks-template.md:17`; `Test (integration):` appears in no template,
  lint, validator or doc. Evidence: task-parser.ts:14; retro-log 2026-10-19T19:28:14Z and
  21:25:59Z. Frequency: 2 design-defect loops this spec. Cost: 2 implementer spawns + 2
  operator escalations + a tasks.md fix (c80d2e8).
- **F6 — The full e2e suite flaked under a controller CPU hotspot.** A pinned
  `node dist/index.js --dashboard` process (~53% CPU, 5h+) plus a concurrent tradr session
  starved the vite ws proxy (`write ECONNRESET`) and tripped the dashboard 120-req/min rate
  limiter, so whichever WS/REST test ran last failed; `--retries=2` made it worse. Fixed and
  deployed in PR #151. Evidence: task-14-report.md Blocker 1; retro-log 2026-10-20T01:03:54Z.
  Frequency: once. Cost: part of the escalation; tests pass focused and on CI.

## Prompt misunderstandings

- **F7 — The tasks drafter invented a label outside the template vocabulary.** The tasks
  draft wrote `- Test (integration):`, a form present in no template, lint, validator or doc,
  which triggered F5. Evidence: task-4-fix-1-report.md; tasks-template.md:17. Frequency: once.
  Cost: see F5.

## Inefficiencies

- **F8 — Task 4 ran two repair re-entries against an unfixable gate before the fix.** The
  initial implement + fix round, then a repair-mode retry (implement + fix round), both
  re-ran the implementer and gate against the same parser defect before the operator edited
  tasks.md. Evidence: ledger 2026-10-19T19:18:29Z–22:11:57Z (spawns at 19:18, 19:22, 21:16,
  21:20); retro-log same window. Frequency: once. Cost: ~4 implementer spawns (~6.3M tokens)
  + 2 escalation waits.
- **F9 — ~32-minute idle gap inside task 11.** The test author ended 22:48:12Z but the
  implementer did not start until 23:20:04Z; no spawn between. Evidence: ledger
  2026-10-19T22:48:12Z → 23:20:04Z. Frequency: once. Cost: ~32 min wall clock, no tokens.

## Documentation gaps

- **F10 — Red-impossible branch needed a hand-named, non-counted guard.** Task 6's get/list
  read only `fs.readFile/readdir` at base (`deferral-storage.ts:261-294`), so no assertion
  named the "no owner key does not rewrite its file" branch; the author added a fresh guard
  that passes at base by design and must be named for the implementer brief. Evidence:
  retro-log 2026-10-19T22:11:57Z (task 6 doc-gap, mark 322f5927). Frequency: once. Cost: none
  (handled in-phase).

## Model behaviour

None found.

## Process deviations and rulings

- **F11 — The operator edited tasks.md mid-implementation to clear the parser defect.** After
  two design-defect escalations, the operator added task 4's test as a `- File:` line in
  c80d2e8 (ruled a type-only change needing no red-first test) and told the loop to re-gate.
  Evidence: ledger note 2026-10-19T22:09:13Z. Frequency: once. Cost: see F5/F8.
- **F12 — Task 14 closed on an operator ruling, verifier-skipped.** Despite the broken log
  tool and full-suite failures, the operator ruled task 14 complete at c96d671, let the merge
  proceed, and gated the full suites on PR CI; task 14 took a gate-only review with no
  verifier. Evidence: ledger note 2026-10-20T04:10:11Z; HANDOFF implementation
  `Verifier-skipped` row. Frequency: once. Cost: full-suite proof deferred to CI.

## Decisions the harness made for the human

None found. Every gate, escalation and the merge went to the operator (gate-A note
2026-10-19T16:17:03Z, gate-B 18:50:51Z, three escalation answers, merge 2026-10-20T04:46:48Z).

## Repeat patterns

- **F4/F5 ↔ dashboard-shell F3, harness-usage-and-tiers F3.** A gate `file-outside-list`
  rejection driven by a path the gate's allowed list cannot see (trailing-slash glob there,
  an unparsed test label here). harness-usage-and-tiers F3 notes the family "seen in four
  specs now". Evidence: dashboard-shell/retrospective.md F3; harness-usage-and-tiers/retrospective.md F3.
- **F4 ↔ review-gate F6, dashboard-shell F6.** `log-implementation` fails or silently drops
  data (all-`undefined` block in review-gate F6; artifacts dropped on large payloads in
  dashboard-shell F6; `linesAdded` crash here). Evidence: review-gate/retrospective.md F6;
  dashboard-shell/retrospective.md F6.
- **F4 ↔ tdd-task-loop (root=CODE_ROOT), review-gate F11.** A tool resolves the main checkout
  instead of the worktree for a worktree commit. Evidence: tdd-task-loop/retrospective.md
  retro-log 2026-09-28T15:19:17Z; review-gate/retrospective.md F11.
- **F2/F3 ↔ dashboard-shell F2, harness-control-pane F7.** Pre-existing/legacy failures or a
  flaky timing-sensitive test surface at a scoped or loaded gate rather than in the task's own
  code. Evidence: dashboard-shell/retrospective.md F2; harness-control-pane/retrospective.md F7.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | req v3, design v2, tasks v1 |
| Review rounds | req 3, design 2, tasks 1 |
| Fix rounds | 2 (both task 4) |
| Adjudications | 0 |
| Escalations | 3 (task 4 ×2 design-defect, task 14 ×1) |
| Rulings | operator: gate A, gate B, 3 escalations, merge |
| Deferrals added | 0 (16 open project-wide) |
| Spawns | 51 |
| TDD | 9 tasks: assertion-red 5, structural-red 4 |
| Verifiers | tasks 5, 11, 12, 13 + end-to-end (all pass) |
| PR | #152, merged 2026-10-20 (sha 4d9db10) |

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
