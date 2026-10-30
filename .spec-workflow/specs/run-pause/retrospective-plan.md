# Retrospective plan — run-pause

Status: APPROVED
Date: 2026-10-30

## Approved proposals

- **P1 (F1) — New mutating dashboard fetch needs the dev-proxy Origin rewrite.** The root was
  the F2 proxy gap, already fixed in `vite.config.ts` (commit 4064229c), so `/api` POST/PUT from
  the worktree e2e suite now works; no further code change. Capture the expectation so the next
  dashboard task that adds a mutating fetch anticipates it rather than rediscovering it.
  Target: project decomposition conventions (agent-rules Fixtures/live-verification).
  Effort: S. Risk: low: a note, no behaviour change.
  Prerequisites: none.
  Eval case: none — a steering note; behaviour is covered by the F2 fix and the graduation rule below.
  DECISION NEEDED: no.

- **P2 (F2) — Latent CORS bug in the vite dev proxy.** Fixed in task 8 (dev-server only;
  production Fastify origin check unchanged). No further change to the fix. The one gap is the
  absence of a regression assertion proving the dev proxy rewrites Origin on `/api`; the smallest
  add is one assertion on the task-8 e2e path, which already exercises it.
  Target: product code (test only, `src/dashboard_frontend` e2e).
  Effort: S. Risk: low: adds coverage, no runtime change.
  Prerequisites: none.
  Eval case: none — product test, not a harness/server grader; the task-8 mutating-fetch e2e is the regression proof.
  DECISION NEEDED: no.

- **P3 (F3) — No usable checks-file on tasks 1 and 7; gate fell back to project checks.**
  Repeat of dashboard-shell F4/F15. Make the implementer always emit a gate-readable checks-file
  and have the gate record a ledger warning when none is found instead of silently falling back.
  Target: harness agents (sdd-implementer) + the review-gate skill.
  Effort: M. Risk: low: a warning line plus a required-output check.
  Prerequisites: none.
  Eval case: new `gate-missing-checks-file` — grader feeds a task whose implementer wrote no checks-file and asserts the gate emits a `checks-file-missing` warning row, not a silent project-checks fallback.
  DECISION NEEDED: no.

- **P4 (F4) — Three implementer spawns relaunched as retries with no fix round.** Tasks 1, 2, 7
  each logged an `implement task N retry` spawn though their gate passed on the first verdict and
  0 fix rounds were recorded — ~3 wasted spawns. Find why the orchestrator relaunched a spawn that
  had already passed; the likely cause is reading a single `spawn.end` as death (the exact hazard
  the ledger rule warns about) and re-launching.
  Target: harness skills (implementation orchestrator).
  Effort: M. Risk: medium: touches relaunch/liveness logic.
  Prerequisites: confirm the relaunch trigger from harness-events.jsonl.
  Eval case: new `no-relaunch-after-pass` — grader replays a run where a task's first gate passes and asserts no second `implement task N retry` spawn.start is emitted.
  DECISION NEEDED: yes. Is the retry relaunch a real defect to fix or accepted spawn noise?
  - Option A: Fix the relaunch trigger (confirm liveness before re-launch) (recommended) — removes ~3 spawns/spec and matches the standing ledger rule.
  - Option B: Leave it; log the relaunches as a known floor and move on.

- **P5 (F5) — Requirements needed a v3 SHOULD_FIX-only corrective pass.** Two rounds returned
  should-fix-only, then v3 converged. The smallest reduction is to let the reviser disposition a
  should-fix-only round in place (one reviser pass) rather than spawning a fresh document version
  for cosmetic convergence.
  Target: harness skills (document orchestrator / review loop).
  Effort: S. Risk: low: scoped to should-fix-only rounds.
  Prerequisites: none.
  Eval case: new `shouldfix-only-no-new-version` — grader checks a should-fix-only verdict yields an in-place reviser disposition, not a new vN document plus lint/narrow spawns.
  DECISION NEEDED: no.

- **P6 (F6) — Task 8 AC red-impossible; two sub-cases never red-tested.** AC 6.1 held at base
  (correct regression guard), but 6.2 (busy-state text) and 6.3 (pending-panel) rode the same
  `isOperatorHeld` branch and were never named in the Success line, so the test author could not
  red-test them separately. Require the tasks-phase decomposition to name each distinct sub-case
  in the Success line so each gets its own red test (or an explicit regression-guard mark).
  Target: project decomposition conventions (agent-rules Documents).
  Effort: S. Risk: low: decomposition wording.
  Prerequisites: none.
  Eval case: none — project steering; enforced by the tasks-phase review, not a harness grader.
  DECISION NEEDED: no.

- **P7 (F7) — Live-verification scenario still pending deploy.** This is agent-rules behaviour
  working as designed: a scenario that cannot run in the loop stays `pending`, gated by a tracked
  `verification-evidence.md` the operator runs post-deploy. No change.
  Target: none (agent-rules Fixtures/live-verification already governs it).
  Effort: S. Risk: low: no change.
  Prerequisites: operator runs the pending line after deploy.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P8 (F8) — Two stray background watchers left running by the task-8 test author.** Negligible
  cost (killed on timeout after results were retrieved) but avoidable. Add a cleanup step to the
  test-author agent: kill any background watcher once its result is read.
  Target: harness agents (sdd-test-author).
  Effort: S. Risk: low: housekeeping only.
  Prerequisites: none.
  Eval case: none — hygiene step with no observable grader output; verified by the agent instruction text.
  DECISION NEEDED: no.

- **P9 (F9) — Task 8's File: list omitted `vite.config.ts`, tripping file-outside-list.** The dev
  proxy fix was forced by task 8's own real-click POST test but absent from File:, so the phase
  ended `design-defect` and re-entered in repair for a no-op re-verify. This repeats across many
  specs (dashboard-project-list F1, advisor, dashboard-loop-views, dashboard-shell,
  dashboard-visual-refresh, harness-evals, harness-usage-and-tiers). Extend the agent-rules
  File:-list rule to cover support/config files a task's own test forces it to edit, and have the
  tasks-phase review reject the omission before the run.
  Target: project steering (agent-rules Documents) + tasks-phase review.
  Effort: M. Risk: medium: a false positive here blocks a legitimate task list.
  Prerequisites: none.
  Eval case: new `test-forced-file-in-list` — grader feeds a task whose e2e test edits a proxy/config file absent from File: and asserts the tasks-phase review flags it.
  DECISION NEEDED: yes. How should a test-forced config edit be kept out of the file-outside-list trap?
  - Option A: Tasks-phase review rejects File: lists that omit a file the task's test must edit (recommended) — catches it before the run, matching the existing cited-module rule.
  - Option B: Give the gate a small allowlist of known dashboard config files (vite.config.ts, proxy) that never trip file-outside-list.
  - Option C: Keep the design-defect re-entry path; accept the one-escalation cost per occurrence.

- **P10 (F10) — Task 9 merged logged but unreviewed.** reviewCoverage closed 8/9 and the
  completion gate allowed the merge under decision C (retro P9). This recurs across many specs
  (graph-orientation, review-gate, dashboard-project-list, dashboard-visual-refresh, harness-evals,
  lean-orchestrators). It is the standing rule working, but it keeps surfacing as a retro finding.
  Target: project steering (decisions log) or tasks decomposition.
  Effort: S. Risk: low: policy/wording.
  Prerequisites: none.
  Eval case: none — policy question, no harness grader.
  DECISION NEEDED: yes. Should the recurring unreviewed-last-task merge be addressed or ratified?
  - Option A: Ratify decision C as expected and stop logging it as a retro defect (recommended) — it is intended behaviour; the graduation rule documents it.
  - Option B: Add a decomposition rule that the final batch task must be a reviewed one, so the unreviewed task is never last.
  - Option C: Require the completion gate to name the uncovered task in the merge summary for operator visibility.

- **P11 (F11) — Tasks 8 and 9 were verifier-skipped (gate-only review).** This is the retro
  P6/P15 routing working as intended (regression-guard / implementer-only tasks skip the
  verifier). No change.
  Target: none (harness routing per retro P6/P15).
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P12 (F12) — The completion gate merged the unreviewed task 9 without asking.** Same event as
  F10 seen as a decision made for the human: the harness applied decision C rather than stopping.
  Covered by P10; no separate change. If Option C of P10 is chosen, the merge summary surfaces the
  uncovered task so the decision is visible, not silent.
  Target: none (subsumed by P10).
  Effort: S. Risk: low: no change.
  Prerequisites: P10 decision.
  Eval case: none — subsumed by P10.
  DECISION NEEDED: no.

## Decisions

- P4: Is the retry relaunch a real defect to fix or accepted spawn noise? → Fix the relaunch trigger (confirm liveness before re-launch) (recommended) — removes ~3 spawns/spec and matches the standing ledger rule.
- P9: How should a test-forced config edit be kept out of the file-outside-list trap? → Tasks-phase review rejects File: lists that omit a file the task's test must edit (recommended) — catches it before the run, matching the existing cited-module rule.
- P10: Should the recurring unreviewed-last-task merge be addressed or ratified? → Ratify decision C as expected and stop logging it as a retro defect (recommended) — it is intended behaviour; the graduation rule documents it.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P7: skipped — no change chosen
- P11: skipped — no change chosen
- P12: skipped — no change chosen
- P1: done — ab3e05225dd225a9eb0eb52d73f1317f5a173eb0
- P6: done — 28dfed688b0fd2c0c7dcaf7c150fd2fc709ccc14
- P9: done — df053f4620c6e0a75bca016c8f15b34ecc1e0c67
- P10: done — 2be4b8099b89aefb53fda7e1e895f79812ef0052
- P3: done — c5b3f2188e77c5de83d9a9e18eafbde15f40ed34
- P4: to-do (human) — DECISION NEEDED unresolved (no plan resolves A vs B); real cause is the checks-file re-emit spawn at implementation.ts:756, not a spawn.end/liveness misread, so P3 fixes it; eval asserts controller behaviour the eval framework cannot observe
- P5: to-do (human) — requires restructuring the reviser version-bump + approval/convergence flow (reviserStep always writes v(D+1)) to disposition in place and skip lint/narrow — not a scoped edit; eval asserts controller spawn/version behaviour harness/evals cannot express
- P8: done — b52bf0d72f1988e48cb3f58f53365287fdd3f2c4
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/196
