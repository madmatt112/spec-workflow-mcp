# Retrospective plan — dashboard-plain-pages

Status: APPROVED
Date: 2026-11-15

## Approved proposals

- **P1 (F1) — Anticipated proxy work needs no change.** The vite dev-proxy Origin
  rewrite (4064229c) and its decomposition anticipation (agent-rules.md:225-228) made
  task 9's mutating `/api` POST pass first try. The rule already carries the anticipation.
  Target: none.
  Effort: S. Risk: low: nothing to touch.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P2 (F2) — Generalize the config-support carve-out to `e2e/helpers/` seed files.**
  A task-authorized non-test support file (`e2e/helpers/shell-seed.ts`) was run by the
  TDD dispatch as a Playwright test ("No tests found" → exit 1) and counted as
  author-changed source. `isConfigSupportPath` (gate-rules.ts:278) already exempts
  `*.config.*` for exactly this reason (dashboard-deploy P3); widen it — or add a sibling
  `isSeedSupportPath` keyed on an `e2e/helpers/` path segment — so red-green.ts:204/236
  skip it in `runFiles` and `sourcePaths`, and route the agent-rules.md:7
  `tdd-test-command` `e2e/helpers/*` case to a no-op. Closes d-ae7a5d40.
  Target: server code (gate-rules.ts, red-green.ts) + harness agent-rules.md.
  Effort: M. Risk: low: mirrors the shipped `isConfigSupportPath` path and its tests.
  Prerequisites: none.
  Eval case: extend gate-rules.test.ts `isConfigSupportPath (P3)` block with an
  `e2e/helpers/shell-seed.ts` → support, `e2e/foo.spec.ts` → not-support pair; grader
  checks the support file is filtered from `runFiles` and absent from `sourcePaths`.
  DECISION NEEDED: no.

- **P3 (F3) — Give the base-failure case a truthful outcome, after classifying it.**
  Task 11 ("report a failing check with the task whose files fail") had no honest result
  when 13 tests in 5 untouched files failed identically at merge-base. Those files
  (project-manager-durable, evals/graders, evals/runner, log-implementation, projectPath)
  match the known SDD-env artifact: `SPEC_WORKFLOW_SHARED_ROOT`/`WORKSPACE` and the global
  commit-msg hook fail the suite green on CI. Classify before fixing.
  Target: server code + harness (fix task) OR project decomposition conventions.
  Effort: M. Risk: medium: an env isolation that masks a real regression would be worse.
  Prerequisites: reproduce the 13 failures with `env -u SPEC_WORKFLOW_SHARED_ROOT
  -u SPEC_WORKFLOW_WORKSPACE GIT_CONFIG_GLOBAL=/dev/null npm test`.
  Eval case: none for the ruling itself; a tracked fix task carries its own red proof.
  DECISION NEEDED: yes. Are the 13 base failures an env artifact or a real base defect?
  - Option A (recommended): reproduce with the vars unset first; if they vanish, isolate
    the suite from the SDD env (unset the two vars + `GIT_CONFIG_GLOBAL`) as the tracked
    fix task, not a test rewrite.
  - Option B: treat them as genuine base defects and add a tracked fix task per
    agent-rules.md:210-212 (they qualify — 2+ specs).
  - Option C: add only a sanctioned "pre-existing base failure" gate outcome so the next
    such task passes without fix rounds, deferring the suite fix.

- **P4 (F4) — No independent change; removed by P2 and P3.** The 4 no-op fix rounds and
  ~6 spawns were entirely the downstream cost of the F2 TDD gap and the F3 base failures.
  Fixing those removes the churn; no separate inefficiency fix exists.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: P2, P3.
  Eval case: none — no standalone change.
  DECISION NEEDED: no.

- **P5 (F5) — Correct the stale `UsageTrend` comment.** The header comment at
  `frontend-style-scan.test.ts:26` still names the deleted `UsageTrend` component and says
  the task-5 sweep "has not happened yet"; task 10 edited that hunk and left it. Replace
  the two stale lines with the current state. Harmless, but the comment now misleads.
  Closes d-998f2119.
  Target: product code (test file comment).
  Effort: S. Risk: low: comment-only, excluded from the success grep.
  Prerequisites: none.
  Eval case: none — prose-only edit to an existing test's comment.
  DECISION NEEDED: no.

- **P6 (F6) — Desired behaviour; no change.** The implementer built a merge-base worktree,
  ran `npm ci`, re-ran the exact files and proved identical fail/pass before ruling
  pre-existing. This is the behaviour P3's classification relies on. Keep it; it is already
  implicit in the base-diff rules. See Graduation candidates for a possible explicit rule.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P7 (F7) — Early adjudication worked; no change.** Short-circuiting task 5 to a narrow
  verdict pass once a fix round left the commit and gate verdict unchanged saved rounds on
  a cause outside the task (F2). The loop guard behaved; nothing to amend.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P8 (F8) — Decide the red-commit rule for provably-red-on-base e2e ids.** Task 9's new
  e2e test ids landed in the feat commit (7971bb58), not a separate `test(...): task N red`
  commit like tasks 7 and 8. The ids are absent from the old page, so red-on-base was
  provable and the gate passed — an audit-trail gap, not a coverage defect (d-0c7bf06c).
  Target: project decomposition conventions / test-author skill.
  Effort: S. Risk: low: either option is an audit-trail convention, not a gate change.
  Prerequisites: none.
  Eval case: none — a documentation/convention change, no gate logic altered.
  DECISION NEEDED: yes. Should a task adding e2e cases always carry a separate red commit?
  - Option A (recommended): accept a coupled commit when the ids are provably absent at
    base (gate already verifies this); document the exception so it is not re-flagged.
  - Option B: require every e2e-adding task to produce a separate `test: task N red` commit,
    and have the tasks-phase review flag tasks that couple the test with the route.

- **P9 (F9) — No new change; resolved by P2 and P3.** Both in-run rulings (the TDD gap via
  the adjudicator, the base failures via the implementer) existed only because P2 and P3
  are unfixed. With those fixed there is nothing to escalate. Keeping such mechanical,
  provable rulings in-run (rather than opening a human gate) matches the standing
  tokens-and-gates-first stance; no policy change is proposed.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: P2, P3.
  Eval case: none — no standalone change.
  DECISION NEEDED: no.

- **P10 (F10) — Make the completion gate's deferral count truthful.** Two verifier
  info-findings (d-998f2119, d-0c7bf06c) were filed `owner=harness`, yet the completion
  gate logged "0 deferrals added." Report the real figure, e.g. "0 owner deferrals
  (2 harness info-findings)", so the count is a floor that names what it omits rather than
  a bare zero.
  Target: server code (completion-gate deferral count).
  Effort: S. Risk: low: a reported-string change, no gating behaviour affected.
  Prerequisites: none.
  Eval case: completion-gate test with two `owner=harness` deferrals in the run asserts the
  logged line names the harness count, not `0`.
  DECISION NEEDED: no.

## Decisions

- P3: Are the 13 base failures an env artifact or a real base defect? → reproduce with the vars unset first; if they vanish, isolate the suite from the SDD env (unset the two vars + `GIT_CONFIG_GLOBAL`) as the tracked fix task, not a test rewrite.
- P8: Should a task adding e2e cases always carry a separate red commit? → accept a coupled commit when the ids are provably absent at base (gate already verifies this); document the exception so it is not re-flagged.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P1: skipped — no change chosen
- P4: skipped — no change chosen
- P6: skipped — no change chosen
- P7: skipped — no change chosen
- P9: skipped — no change chosen
- P2: to-do (human) — needs server code (gate-rules.ts, red-green.ts) + eval case; a tracked fix task, not a spec-store direct commit
- P3: to-do (human) — recorded decision is a tracked fix task isolating the suite from the SDD env (source change), not a doc edit
- P8: done — 904bed5746d0c6f0f09532f9e0e388872ca184e6
