# Retrospective plan — dashboard-board

Status: APPROVED
Date: 2026-11-07

## Approved proposals

- **P1 (F1) — `SDD_DEPLOY_DISABLED` does not freeze a seeded run.** Document the flag's real
  scope in `docs/SDD-HARNESS.md` and in the controller source comment: it gates `deploy.tick()`
  only; `isStartable()` still drives on-disk runs in `merging`/`queued`/`paused`. A fixture that
  must stay frozen seeds `status: 'running'`, not a mid-pipeline stage.
  Target: server code, docs or templates.
  Effort: S. Risk: low: doc + comment, no behaviour change.
  Prerequisites: none.
  Eval case: `deploy-disabled-freezes-nothing` — asserts a `merging` fixture under the flag is
  still advanced by `isStartable()`, pinning the documented contract.
  DECISION NEEDED: yes. Scope the flag or only document it?
  - Option A (recommended): document the contract and fix fixtures to seed `running`. Smallest, and the flag's narrow scope is intentional.
  - Option B: extend the flag so `isStartable()` short-circuits every on-disk run. Larger blast radius; changes live controller behaviour.
  - Option C: no change; rely on reviewers catching bad fixture seeds.

- **P2 (F2) — connect-time `projects-update` push breaks zero/count message assertions.** Add a
  shared test helper that drops the per-connection `projects-update` push
  (`multi-server.ts:327-332`) from captured messages, and note it in the server test docs as
  baseline noise. Tests then assert deterministically.
  Target: server code, docs or templates.
  Effort: S. Risk: low: test-only helper.
  Prerequisites: none.
  Eval case: `connect-push-filtered-in-count-assert` — grader checks a count assertion stays
  green/red deterministically with the connect push present.
  DECISION NEEDED: no.

- **P3 (F3) — controller did not drain an in-flight scheduler tick on stop; push budget too tight.**
  No change. Real bug, root cause removed in `e7396b64`. Record only.
  Target: product code.
  Effort: S. Risk: low: already landed and verified.
  Prerequisites: none.
  Eval case: none — a fixed product bug with a regression test in the commit.
  DECISION NEEDED: no.

- **P4 (F4) — advisor armed its pusher watch before the waits dir existed.** No change. Real bug,
  fixed in `90f6e1dc`. Record only.
  Target: product code.
  Effort: S. Risk: low: already landed and verified.
  Prerequisites: none.
  Eval case: none — fixed product bug.
  DECISION NEEDED: no.

- **P5 (F5) — vite ws-proxy `ECONNRESET`/`EPIPE` noise reads as a failed Playwright run.** Filter
  proxy teardown errors out of the worktree Playwright reporter (or downgrade them below the fail
  threshold) so a 9/9, 62/62 run reports green. This removes the false red that drove F11/F15.
  Target: harness skills or agents.
  Effort: M. Risk: medium: must not mask a genuine connection failure in the app under test.
  Prerequisites: confirm the noise only occurs at proxy teardown, not mid-test.
  Eval case: `playwright-proxy-reset-not-failure` — grader feeds a log with teardown
  `ECONNRESET` and all specs passing, expects a green verdict.
  DECISION NEEDED: no.

- **P6 (F6) — `playwright.worktree.config.ts` uses fixed shared temp paths never wiped.** Make the
  config derive `SPEC_WORKFLOW_HOME`/`sddHome()` per invocation (unique temp dir) or purge it in a
  global setup, so a stray record from one run cannot poison the next. Removes the need for each
  suite's own `beforeAll` purge (root cause of F1's leak).
  Target: harness skills or agents.
  Effort: M. Risk: medium: a per-run dir must still be reachable by the controller the test drives.
  Prerequisites: none.
  Eval case: `worktree-e2e-temp-isolated` — grader runs two suites and checks the second sees no
  record the first created.
  DECISION NEEDED: yes. Per-invocation dir or shared-dir global purge?
  - Option A (recommended): unique temp dir per invocation. Cleanest isolation, no cross-run state.
  - Option B: keep the shared dir, add a global-setup purge. Smaller diff but still one shared root.

- **P7 (F7) — test header asserted a seeded run "stays exactly as written" under the deploy flag.**
  No separate change; the mental-model error is removed by P1's documented contract.
  Target: harness skills or agents.
  Effort: S. Risk: low.
  Prerequisites: P1.
  Eval case: covered by P1's `deploy-disabled-freezes-nothing`.
  DECISION NEEDED: no.

- **P8 (F8) — 91 spawns for 23 tasks; 8 fix rounds.** No standalone change. The spend concentrated
  in tasks 11/12/16, each addressed by P1/P5/P6/P9/P11; most tasks closed at 0 fix rounds. Re-measure
  W/task on the next real spec per the run-ledger note.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — an aggregate metric, not a gradable behaviour.
  DECISION NEEDED: no.

- **P9 (F9) — negative e2e assertion needed a settle wait before `toHaveCount(0)`.** Add a
  decomposition/test-author convention: a negative e2e assertion (absence after an action) waits on
  the settling signal — the controller-actions snapshot here — before `toHaveCount(0)`, rather than
  asserting immediately.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: convention only.
  Prerequisites: none.
  Eval case: none — project-local e2e convention, not a harness-agent behaviour.
  DECISION NEEDED: no.

- **P10 (F10) — tasks 20/21/22 were red-impossible, routed implementer-only mid-run.** The
  implementer-only routing rule already exists in agent-rules.md; it was not applied to deletion /
  already-held tasks. Strengthen the tasks-phase review to flag deletion and "already holds" tasks
  as regression-guard candidates up front.
  Target: harness skills or agents.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: extend `guard-task-no-red-step` with a deletion task whose ACs all hold at base; grader
  expects it marked implementer-only in the decomposition.
  DECISION NEEDED: no.

- **P11 (F11) — task 16 chased infra flakiness through 4 fix rounds.** Add an implementer/gate rule:
  when a gate fail carries proxy/infra noise and the same commit re-runs clean, record infra
  flakiness and stop — do not re-attempt a code fix. Pairs with P5 removing the false red at source.
  Target: harness skills or agents.
  Effort: S. Risk: low.
  Prerequisites: P5.
  Eval case: `gate-infra-flake-one-rerun` — grader gives a noise-tagged fail that passes on re-run,
  expects a single re-run then a flake verdict, not a code edit.
  DECISION NEEDED: no.

- **P12 (F12) — task 17 edited four off-list files to satisfy its own root-walking grep.** When a
  task's Success grep or a "deleted symbols scrubbed" test walks a whole root (FE_ROOT), the
  decomposition names every file holding the target symbol in the `File:` list. No implementer edit
  can move a file-list verdict.
  Target: harness skills or agents.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: extend `implementer-file-outside-list-classify` with a root-walking scrub grep that
  forces a comment edit in an off-list file; grader expects the tasks-phase review to reject the list.
  DECISION NEEDED: no.

- **P13 (F13) — task 16 adjudicated after 3 rounds, narrow pass.** No separate change; folded into
  P5/P11, which remove the flakiness that forced the adjudication.
  Target: harness skills or agents.
  Effort: S. Risk: low.
  Prerequisites: P5, P11.
  Eval case: covered by P11.
  DECISION NEEDED: no.

- **P14 (F14) — PR #207 checks escalated red after 3 reconcile rounds.** No standalone change; the
  root causes are the real bugs in P3/P4, now fixed. Record only.
  Target: product code.
  Effort: S. Risk: low.
  Prerequisites: P3, P4.
  Eval case: none — covered by the P3/P4 regression tests.
  DECISION NEEDED: no.

- **P15 (F15) — harness ruled the task-16 gate fail infra flakiness and proceeded.** The ruling was
  correct. No change beyond earlier detection in P5/P11.
  Target: harness skills or agents.
  Effort: S. Risk: low.
  Prerequisites: P5, P11.
  Eval case: covered by P11.
  DECISION NEEDED: no.

- **P16 (F16) — CI round-1 `push.test.ts` timeout was 2-core event-loop starvation.** This base
  failure now recurs across two specs, so by the agent-rules graduation rule the next decomposition
  adds a tracked fix task for `push.test.ts` (raise/park its timing under 2-core load) rather than
  re-ruling it D9 each spec.
  Target: harness skills or agents.
  Effort: M. Risk: medium: the fix must not hide a real push regression.
  Prerequisites: none.
  Eval case: `push-test-2core-fix-task-required` — grader checks a decomposition adds a fix task
  when a named test has failed at base in two or more specs.
  DECISION NEEDED: no.

## Decisions

- P1: Scope the flag or only document it? → document the contract and fix fixtures to seed `running`. Smallest, and the flag's narrow scope is intentional.
- P6: Per-invocation dir or shared-dir global purge? → unique temp dir per invocation. Cleanest isolation, no cross-run state.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P8: skipped — no standalone change; W/task re-measure already stands in agent-rules.md run-ledger note
- P9: done — 9e99ff788f90d2ca0527d70b6c93941f3f952770
- P1: to-do (human) — REQUIRED: src/controller/controller.ts. The item mandates the controller source comment but backticks only docs/SDD-HARNESS.md as a path, so the gate allow-list (itemPaths, closeout.ts:151) excludes the controller and file-outside-list can never clear. Tree already correct in e125a64d (docs + comment + fixtures seed running). No implementer edit moves a file-list verdict (P12); fix is to name src/controller/controller.ts as a backticked path in P1's item block. (commit e125a64 left on the branch: revert failed)
- P2: done — c9e47ef2d5a2bdc13c6990e7f11df37b1d4b1ec3
- P5: to-do (human) — Needs a live worktree e2e run to confirm the ECONNRESET/EPIPE noise is teardown-only (its stated prerequisite) and to design a filter that won't mask a real connection failure (medium risk). No reporter/vite-proxy config exists to edit safely without that run; e2e suites out of scope for this batch.
- P6: done — 04220a4283507e99147d2cf90ae4c1e3ea932a01
- P7: skipped — No separate change; the mental-model error is removed by P1's documented contract.
- P10: done — 824c15b73ec7f0fcf2ff727dd8cd64913878fe76
- P11: done — acc4493ea013b6d85169dbdd8ed0700c6aa03ca9
- P12: done — 1337e284a531266558d0acf8112833c1ad94da2b
- P13: skipped — No separate change; folded into P5/P11.
- P15: skipped — No separate change; the ruling was correct; folded into P5/P11.
- P16: to-do (human) — Graduation rule already exists in agent-rules.md (two-spec base failure -> next decomposition adds a tracked fix task). push.test.ts fix task is next-spec decomposition work, no base-failures registry to edit; eval case needs a new grader.
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/208
- P3: skipped — no change needed; controller stop-drain bug already fixed in e7396b64, record-only
- P4: skipped — no change needed; advisor waits-dir bug already fixed in 90f6e1dc, record-only
- P14: skipped — no change needed; no standalone change, covered by P3/P4 fixes, record-only
