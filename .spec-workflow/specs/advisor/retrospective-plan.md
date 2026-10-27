# Retrospective plan — advisor

Status: CLOSED
Date: 2026-10-27

## Approved proposals

- **P1 (F1) — File: list must cover the file a design clause pins a write to.** Task 14's
  `File:` list omitted `waits.ts`, the only place D19/C7 lets the write live, so no edit in-scope
  could pass the gate. Add a tasks-phase rule: when a task's cited design clause pins a behaviour to
  a named module, the `File:` list must include that module; the tasks-phase review rejects a task
  whose cited clause names a write location absent from `File:`.
  Target: project steering (agent-rules "Documents"). Effort: S. Risk: low: a narrow review check.
  Prerequisites: none. Eval case: none — steering rule enforced by the tasks-phase review, not a harness grader.
  DECISION NEEDED: no.

- **P2 (F2) — Make the two env-coupled vitest suites self-contained.** The suites pass or fail on a
  live :5000 dashboard and ambient `SPEC_WORKFLOW_SHARED_ROOT`/`WORKSPACE`. Set the env in each
  suite's setup and stub or skip-guard the live-server dependency so the result is machine-independent.
  Target: product code (the two test files). Effort: M. Risk: low: test-only. Prerequisites: none.
  Eval case: none — product test change, verified by `npm test` on a clean machine.
  DECISION NEEDED: no.

- **P3 (F3) — No change; already fixed.** The index-wipe-on-embed-crash was closed by chunk-capping,
  crash-guarding the deferred job, and degrading to `meaning: off` (85aee31c, 47cefa01, d8a5c6ee).
  Keep the regression test that proves a thrown embedder leaves the index intact.
  Target: product code. Effort: S. Risk: low: no change. Prerequisites: none.
  Eval case: none — closed in-spec. DECISION NEEDED: no.

- **P4 (F4) — No code change; the gap is process (see P7).** The synchronous and query embed paths
  were guarded at adjudication (v4). The remaining lesson — half-guarded clauses slip past review — is
  answered by P7, not a code change here.
  Target: product code. Effort: S. Risk: low: no change. Prerequisites: P7.
  Eval case: none — closed in-spec. DECISION NEEDED: no.

- **P5 (F5) — Add an 'error' handler to the execDeploy detached spawn.** A missing deploy script
  crashes the dashboard server. Attach an `error` listener on the child that logs and returns a
  surfaced failure instead of propagating. Small, safe, removes a crash path.
  Target: product code (the execDeploy spawn site). Effort: S. Risk: low: one listener.
  Prerequisites: none. Eval case: none — product code, covered by a unit test on the spawn-error path.
  DECISION NEEDED: no.

- **P6 (F6) — Make the confirm-route launch payload carry the gate fields real `launchSpec` requires,
  or mark it a stub.** The payload omits gate fields, so a real launch would 400. Smallest honest fix:
  add the gate fields to the confirm-route payload so the live path works.
  Target: product code (confirm-route launch handler). Effort: M. Risk: medium: touches the launch
  path; needs a test that the payload validates. Prerequisites: none.
  Eval case: none — product code, verified by a validation test on the launch payload.
  DECISION NEEDED: no.

- **P7 (F7) — Reviser/implementer must close every location a review WARNING enumerates.** The v2
  WARNING named "the background (and synchronous) embed"; the fix wrapped only one, recurring in
  round 3. Add a line to the reviser/implementer brief: when a finding enumerates two or more
  locations, the fix addresses each named location, and the disposition lists them.
  Target: harness agents (sdd-reviser, sdd-implementer). Effort: S. Risk: low: a checklist line.
  Prerequisites: none. Eval case: `reviser/multi-location-finding` — grader feeds a finding naming two
  code sites and checks the revised document touches both. DECISION NEEDED: no.

- **P8 (F8) — No new change; fold the cause into P7.** The 4-round/5-spawn chain on task 9 was driven
  by the partial-fix behaviour P7 addresses plus the degrade-path's several code sites. P7 plus the
  task carrying the design Error-Handling clause as an explicit per-path checklist removes the churn.
  Target: project decomposition conventions. Effort: S. Risk: low: no standalone change.
  Prerequisites: P7. Eval case: none — covered by P7's grader. DECISION NEEDED: no.

- **P9 (F9) — Decide where regression tests added during a task must live.** Three fix rounds (tasks
  8, 9, 10) existed only to move added tests into the task's declared file and budget. The churn comes
  from the implementer adding regression tests where the gate does not expect them.
  Target: project decomposition conventions / review gate. Effort: S. Risk: low. Prerequisites: none.
  Eval case: none — decomposition convention, enforced by the tasks-phase review.
  DECISION NEEDED: yes. Where should regression tests an implementer adds mid-task live?
  - Option A: the tasks-phase decomposition names the module's existing test file and a line budget for
    added regression tests, so the implementer writes them there first. (recommended)
  - Option B: relax the review gate to accept added tests in any `__tests__/` next to a touched module,
    without a declared file.
  - Option C: forbid implementer-added regression tests; defer each as a follow-up test task.

- **P10 (F10) — No separate change; same cause as F9.** Task 10's 2-round/3-spawn additive test fold
  is the P9 pattern. Resolving P9 removes it.
  Target: project decomposition conventions. Effort: S. Risk: low: no standalone change.
  Prerequisites: P9. Eval case: none — covered by P9. DECISION NEEDED: no.

- **P11 (F11) — A count-change grep's scope must match the task's File: list.** Task 2's grep scoped
  "docs" but the `File:` list omitted `docs/SDD-HARNESS.md` (owned by task 18), forcing a revert.
  Extend the agent-rules count-change rule: the files the named grep can return must all appear in the
  task's `File:` list, or the grep scope is narrowed to the `File:` list; the tasks-phase review checks
  the two agree.
  Target: project steering (agent-rules "Documents"). Effort: S. Risk: low: a review check.
  Prerequisites: none. Eval case: none — steering rule enforced by the tasks-phase review.
  DECISION NEEDED: no.

- **P12 (F12) — Mark an all-regression-guard task implementer-only at the tasks phase.** Task 19's
  five criteria could not be driven red and it was routed implementer-only only after a probe. Add a
  rule: a task whose every acceptance criterion is a regression guard (holds at base) is marked
  implementer-only in the decomposition up front, with the verifier/test-author skip stated, not
  discovered mid-run.
  Target: project steering (agent-rules "Fixtures and live verification" / tdd). Effort: S. Risk: low.
  Prerequisites: none. Eval case: none — steering rule enforced by the tasks-phase review.
  DECISION NEEDED: no.

- **P13 (F13) — No change; covered by P7.** The partial-clause-under-pressure behaviour is the same
  defect as F4/F7; P7's enumerate-every-location rule is the fix.
  Target: harness agents. Effort: S. Risk: low: no standalone change. Prerequisites: P7.
  Eval case: none — covered by P7. DECISION NEEDED: no.

- **P14 (F14) — No change.** Task 9's adjudication after three rounds with a narrow verdict is the
  escalation path working as designed. The round count is reduced by P7/P8, not by changing escalation.
  Target: none. Effort: S. Risk: low: no change. Prerequisites: none.
  Eval case: none — process worked as intended. DECISION NEEDED: no.

- **P15 (F15) — No change.** Task 19's verifier-skip is consistent with its implementer-only routing
  (P12) and D9. Nothing to fix.
  Target: none. Effort: S. Risk: low: no change. Prerequisites: none.
  Eval case: none — process worked as intended. DECISION NEEDED: no.

- **P16 (F16) — Decide the disposition of the five owner-harness deferrals.** execDeploy crash handler
  (d-de507c11 → P5), launch-gates 400 (d-1cadcc61 → P6), two env-coupled suites (d-b3d7382d,
  d-42e16315 → P2), three pre-existing failures (d-99ea856a → P17). They are carried forward.
  Target: CLAUDE.md / owner backlog. Effort: S. Risk: low. Prerequisites: none.
  Eval case: none — owner decision, not a harness surface.
  DECISION NEEDED: yes. What do we do with the five carried deferrals?
  - Option A: action P2/P5/P6/P17 now as a small follow-up batch on the next swm run; they are all
    small, bounded fixes. (recommended)
  - Option B: keep all five on the owner backlog and action only if the surface is next touched.
  - Option C: fix the two crash/400 bugs (P5, P6) now; leave the test-hygiene ones (P2, P17) deferred.

- **P17 (F17) — Decide whether to fix the three pre-existing failing tests.** They were recorded as
  worse-than-baseline and let past the full-suite gate per D9 (correct), but they remain red.
  Target: product code (the three tests). Effort: M. Risk: low: test-only. Prerequisites: none.
  Eval case: none — product tests, verified by `npm test`.
  DECISION NEEDED: yes. The three durable failures (d-99ea856a) — fix or keep deferred?
  - Option A: fix them in the P16 follow-up batch so the baseline returns to green. (recommended)
  - Option B: keep them deferred and documented as known-red on the owner backlog.

## Decisions

- P9: Where should regression tests an implementer adds mid-task live? → the tasks-phase decomposition names the module's existing test file and a line budget for added regression tests, so the implementer writes them there first. (recommended)
- P16: What do we do with the five carried deferrals? → action P2/P5/P6/P17 now as a small follow-up batch on the next swm run; they are all small, bounded fixes. (recommended)
- P17: The three durable failures (d-99ea856a) — fix or keep deferred? → fix them in the P16 follow-up batch so the baseline returns to green. (recommended)

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P2: skipped — no change chosen
- P3: skipped — no change chosen
- P4: skipped — no change chosen
- P9: skipped — no change chosen
- P14: skipped — no change chosen
- P15: skipped — no change chosen
- P16: skipped — no change chosen
- P17: skipped — no change chosen
- P1: done — 6b50d2405f0fb0906b1d32749f7747328999df46
- P8: skipped — no standalone change; folded into P7 (not in this batch)
- P10: skipped — no standalone change; folded into P9 (not in this batch)
- P11: to-do (human) — Change already correct at 5d12a086; close-out gate false-positives because itemPaths() reads example path docs/SDD-HARNESS.md from the item prose as the file list, flagging the real target .spec-workflow/agent-rules.md as file-outside-list. No in-scope edit can pass the gate; touching docs/SDD-HARNESS.md would be wrong. Needs a controller/gate fix.
- P12: done — 9eddd8c616069a1248d428984814f22aab114075
- P7: done — ef7e0a9cbbe4261fc20cd31651aff07b6539c2da
- P13: skipped — No standalone change; item states it is covered by P7's enumerate-every-location rule.
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/181
- P5: done — 4ee614f1cf5fd518f6d7204aac083bee17a2e597
- P6: done — ae9211de0b2b2479d3c2bb108e3d6ca60a66b35e
