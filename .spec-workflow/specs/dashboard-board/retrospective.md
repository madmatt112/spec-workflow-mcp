# Retrospective — dashboard-board

Compiled 2026-11-07 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — `SDD_DEPLOY_DISABLED` does not stop the scheduler acting on a seeded run.** The flag
  only gates `deploy.tick()`; the controller's `isStartable()` still drives any on-disk run in
  `merging`/`queued`/`paused`. The task-11 e2e fixture seeded `status: 'merging'`, the live
  scheduler drove it to the merge stage, found no PR, and raised its own `error` wait with a
  random id that no test cleaned up. Fix was changing the fixture to `status: 'running'`.
  Evidence: `/tmp/scratchpad/sdd/dashboard-board/task-11-fix-1-report.md`; retro log
  2026-11-07T03:40:48Z; commit 3d8f3a21/fa3bcbc8. Frequency: once. Cost: 1 of task 11's 2 fix rounds.
- **F2 — A pre-existing connect-time `projects-update` push broke a zero-message assertion.** Task
  19's author test asserted zero messages, but the per-connection `projects-update` push
  (`multi-server.ts:327-332`, outside scope) made it pass ~1/5 instead of deterministically
  red/green until filtered out. Evidence: retro log 2026-11-07T10:11:24Z; commit 1f9777de. Frequency:
  once. Cost: 1 fix round.

## Product bugs found

- **F3 — Controller did not drain an in-flight scheduler tick on stop; push budget too tight.** Surfaced
  under CI load during reconcile and fixed for real. Evidence: commit e7396b64
  `fix(controller): drain in-flight scheduler on stop; widen push budget`; retro log
  2026-11-07T11:36:37Z (round 2, verifier pass). Frequency: once. Cost: part of CI round 2.
- **F4 — Advisor armed its pusher watch before the waits dir existed.** Fixed during the same CI
  reconcile. Evidence: commit 90f6e1dc `fix(advisor): create waits dir before arming the pusher
  watch`; retro log 2026-11-07T11:59:48Z (round 3, verifier pass). Frequency: once. Cost: part of CI round 3.

## Tool and MCP errors or deficiencies

- **F5 — vite ws-proxy `ECONNRESET`/`EPIPE` noise made a green Playwright run read as failed.** The
  task-16 gate reported fail with proxy noise interleaved into the line reporter; re-running the
  same commit passed 9/9 and 62/62. The gate failure was infra flakiness, not a real red test.
  Evidence: retro log 2026-11-07T08:26:12Z and 08:39:16Z (tool-error, gotcha); task-16 review v1.
  Frequency: twice within task 16. Cost: contributed to 3 wasted fix rounds (see F10).

## Harness defects

- **F6 — `playwright.worktree.config.ts` uses fixed shared temp paths never wiped between
  invocations.** `sddHome()`/`SPEC_WORKFLOW_HOME` point at shared tmp dirs, so a stray
  controller-created record (e.g. an error wait) from one run silently poisons every later run
  until a suite explicitly purges it. The board suite had to add a `beforeAll` purge. Evidence:
  retro log 2026-11-07T03:54:46Z (harness-defect); commit 241330ce `purge stale waits/runs before
  the board e2e suite`. Frequency: once (root cause of F1's leak). Cost: 1 fix round + a purge step.

## Prompt misunderstandings

- **F7 — Test header comment asserted a seeded run "stays exactly as written" under
  `SDD_DEPLOY_DISABLED`.** The author's mental model was that the deploy flag froze on-disk runs; it
  does not (see F1). Evidence: retro log 2026-11-07T03:40:48Z. Frequency: once. Cost: folded into F1.

## Inefficiencies

- **F8 — 91 spawns for 23 tasks; 8 fix rounds, 2 adjudications.** Most tasks closed at 0 fix rounds
  on the gate, but tasks 11, 12, 16 absorbed the fix-round cost. Evidence: retro log
  2026-11-07T12:51:13Z completion gate. Frequency: whole spec. Cost: 91 spawns.
- **F9 — Task 12 took 2 fix rounds tuning one negative e2e assertion.** The R5 AC2 refused/failed
  test needed a 3s wait for the controller-actions snapshot before `toHaveCount(0)`. Evidence:
  retro log 2026-11-07T05:15:57Z; task-12 review v3; commit d2891935. Frequency: once. Cost: 3 spawns.

## Documentation gaps

- **F10 — Tasks 20, 21, 22 were red-impossible on every criterion, routed implementer-only mid-run.**
  All three (deletions / already-held behaviour) could not be red-tested; the routing was discovered
  during the run rather than marked in the tasks phase. Evidence: retro log 2026-11-07T10:16:23Z,
  10:28:44Z, 10:36:03Z (doc-gap). Frequency: 3 tasks. Cost: 3 author probes.

## Model behaviour

- **F11 — Task 16 chased infra flakiness through 4 fix rounds before adjudication.** The gate's fail
  reproduced clean on re-run; HEAD already satisfied the brief. The model kept re-attempting instead
  of recognising the proxy noise early. Evidence: retro log 2026-11-07T08:59:49Z (ruling,
  inefficiency); task-16 review v1 (round-4 amendment). Frequency: once. Cost: 5 spawns, 4 rounds.

## Process deviations and rulings

- **F12 — Task 17 required edits to four off-list files to pass its own checks.** The implementer hit
  comments naming NowPage/RunsPage/Sidebar in `board.ts`, `tiles.tsx`, `AnswerSheet.tsx`,
  `OpenAdvisor.tsx`; the task's Success grep and the "deleted symbols scrubbed" test walk all of
  FE_ROOT, so passing required rewording them. No implementer edit can move a file-list verdict — the
  fix is to list the files in tasks.md. Evidence: retro log 2026-11-07T09:16:38Z (deviation); commit
  97447566. Frequency: once. Cost: unknown.
- **F13 — Task 16 adjudicated after 3 fix rounds; narrow verdict pass.** Evidence: retro log
  2026-11-07T08:59:49Z (ruling). Frequency: once. Cost: 1 adjudication.
- **F14 — PR #207 checks escalated red after 3 reconcile rounds and an adjudication.** CI stayed red
  through the reconcile loop before the fixes in F3/F4 landed. Evidence: retro log
  2026-11-07T12:28:04Z (escalation); PR #207. Frequency: once. Cost: 4 rounds, 1 adjudication.

## Decisions the harness made for the human

- **F15 — The harness ruled the task-16 gate fail infra flakiness and proceeded with no code
  change.** Evidence: retro log 2026-11-07T08:39:16Z. Frequency: once. Cost: see F11.
- **F16 — The harness ruled the CI round-1 `push.test.ts` timeout 2-core event-loop starvation (an
  already-budget-widened test from another spec) and proceeded.** Evidence: retro log
  2026-11-07T11:04:15Z (tool-error). Frequency: once. Cost: round 1.

## Repeat patterns

- **F12 (File: list omission) recurs widely.** A task's File: list omits a file its own test or grep
  forces it to touch. Also advisor F1/F11, harness-evals F6, run-pause F9, dashboard-project-list F1,
  dashboard-visual-refresh F1, dashboard-shell. Evidence: those retrospective.md files.
- **F10 (red-impossible routing discovered mid-run) recurs widely.** Also advisor F12,
  controller-liveness-and-push F4, dashboard-deploy F6/F7, dashboard-loop-views F10,
  verification-loop F1, tdd-task-loop F3, harness-evals F7, run-pause F6, harness-control-pane F9.
- **F16 (CI 2-core event-loop starvation `waitFor` timeout) recurs.** Also
  controller-liveness-and-push retrospective.md:106. Evidence: both retro logs.
- **F5 (vite ws-proxy `ECONNRESET` noise) recurs.** Also dashboard-loop-views retrospective.md:54.
- **F2 (connect-time `projects-update` push noise in assertions) recurs.** Also harness-control-pane
  retrospective.md:12.
- **F6 (shared temp/shared-root leaking into e2e verification) recurs.** Also dashboard-project-list
  F2 (`SPEC_WORKFLOW_SHARED_ROOT`) and advisor. Evidence: those retrospective.md files.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation (+ CI reconcile) |
| Versions per phase | requirements v3, design v2, tasks v1 |
| Review rounds | requirements 3, design 2, tasks 1 adversarial |
| Fix rounds | 8 (tasks 11, 12, 16, 19) + 3 CI reconcile |
| Adjudications | 2 (task 16; PR/CI) |
| Escalations | 1 (PR #207 checks red) |
| Rulings | task 16 narrow pass |
| Deferrals added | 0 (44 open in all) |
| Spawns | 91 |
| PR | #207 (merged) |

TDD coverage: 19 TDD tasks (assertion-red 7, structural-red 11, vacuous 0, inconclusive 1); tasks 20/21/22 red-impossible implementer-only; logCoverage 23/23, reviewCoverage 23/23, verifier-skipped none.

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
