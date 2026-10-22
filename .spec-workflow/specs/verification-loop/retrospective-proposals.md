# Retrospective proposals — verification-loop

Written 2026-10-22 by the retro analyst

This spec ran clean (14/14 tasks, 0 fix rounds, 0 adjudications, 0 escalations, 0
deferrals). Most findings are minor or repeats; several need no change.

## Proposals

- **P1 (F1) — Task 12 AC 3.2 vacuous at base, kept as a regression guard.** No change.
  The test author did the right thing: the AC held at base (no C6 security code existed),
  so under `tdd-regression-guard` it stays a tracked guard, not a forced red test, and it
  was excluded from the 4 genuine red tests. The rule already covers this; the only gap is
  that the tasks phase did not flag it up front, which is F5.
  Target: n/a.
  Effort: S. Risk: low: no behaviour change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — `none` dependency note can follow an `unreadable` note.** The guard at
  `merge.ts:652` suppresses a spurious `none` only when there is no prior note at all. On an
  `unreadable`→empty recovery the prior note exists (it is `unreadable`), so a `none` note is
  written, contradicting the Data Models invariant ("`none` only after a logged non-empty
  list"). The smallest fix: treat the suppression as "write `none` only when `prior` is a
  names list", i.e. also `return undefined` when `prior` ends with `unreadable` or is itself a
  `none` note. One line plus a unit test next to the module.
  Target: product code (`src/controller/merge.ts`) + its `__tests__`.
  Effort: S. Risk: low: ledger-note-only path, never touches verdict/status/wait, guarded by R4 AC 7.
  Prerequisites: none.
  DECISION NEEDED: yes. The verifier judged it non-blocking and it shipped; should we fix it?
  - Option A (recommended): fix the guard to also suppress `none` after `unreadable`/`none`,
    add the regression test. One line, removes the invariant deviation at its cause.
  - Option B: leave as-is; it is a benign extra ledger note on a rare recovery path and was
    judged defensible against hard AC5.

- **P3 (F3) — Completion gate re-entered ~100 min after first completion.** No change to this
  spec's mechanism. Task 11's "skip the e2e pass on re-entry" guard already held the re-entry
  to one spawn instead of a full re-run, which is the intended behaviour. The recurring
  pattern across specs is worth a standing rule — see Graduation candidates.
  Target: n/a (pattern graduated below).
  Effort: S. Risk: low: guard already works.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Requirements took 3 rounds.** No change. The rounds were not churn: r1 raised 5
  genuine should-fix items and r2 caught a real design gap (completion-gate re-entry did not
  guard the e2e verification that gates the security pass). The review loop did its job.
  Multi-round requirements recurs across many specs but is value-bearing, not a defect — see
  Graduation candidates for the framing, not a cap.
  Target: n/a.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Tasks decomposition did not pre-mark AC 3.2 as a regression guard.** The
  `tdd-regression-guard` rule lives in agent-rules, but the tasks phase does not apply it when
  decomposing: the test author discovered the vacuity at implementation time. The smallest
  fix: have the tasks-phase decomposition mark each AC that already holds at base as a guard
  (not a forced red test) in the task's notes, so the red-impossible path is known before the
  test-author spawn. This is a one-line addition to the tasks drafter brief / decomposition
  conventions.
  Target: harness agents (tasks-phase drafter brief / decomposition conventions).
  Effort: S. Risk: low: advisory marking, no mechanism change; worst case the marking is
  wrong and the test author corrects it as today.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — Merge decided by the coordinator, not the operator.** No change. This is the
  standing overwatch policy (coordinator merges every green harness-session PR), and
  agent-rules keeps `merge: ask` for the in-loop controller precisely because a green build
  proves the tests, not the controller boot. The two are not in conflict: the controller still
  asks; the human coordinator answers out of band. Working as designed.
  Target: n/a.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — Task-3 info finding auto-accepted with no deferral and no sign-off.** The
  verifier closed task 3 `pass` with a known non-blocking info finding (F2) and nothing was
  recorded outside this retro, so a latent invariant deviation ships untracked. The smallest
  fix: require a verifier that closes `pass` while carrying a non-blocking info finding to
  record it as a deferral (or a one-line ledger note), so it is not invisible after the retro
  closes. This recurs (harness-bookkeeping) — see Graduation candidates.
  Target: harness agents (sdd-verifier brief) and/or agent-rules.
  Effort: S. Risk: low: adds a record, changes no verdict or gate.
  Prerequisites: none.
  DECISION NEEDED: yes. How should a non-blocking info finding be captured at pass?
  - Option A (recommended): verifier records it as a deferral when closing `pass`, so it
    lands in the tracked queue and survives the retro.
  - Option B: verifier appends a one-line `info-finding` ledger note only; lighter, but the
    note is easy to lose and not triaged.
  - Option C: no change; accept that non-blocking findings live only in the task review and
    the retro.

## Graduation candidates

- **Orchestrator / completion-gate re-entry must be idempotent** (F3; also dashboard-shell
  F11, agent-cache-ttl, harness-control-pane). Rule text: "An orchestrator that can be
  re-entered after it first reported complete must be idempotent on re-entry: it skips the
  end-to-end verification and any one-shot pass already run, and costs at most one spawn, not a
  full re-run. The completion gate records completion once and guards every pass it gates
  against a second run." Target: `docs/SDD-HARNESS.md` (completion-gate section) or
  agent-rules.md.

- **A non-blocking info finding shipped at `pass` is recorded, not just noted in the review**
  (F2/F7; also harness-bookkeeping task-2). Rule text: "When a verifier closes a task `pass`
  while carrying a non-blocking info finding, it records that finding as a deferral before
  closing, so a latent deviation is tracked and triaged rather than surviving only in the task
  review and the retrospective." Target: agent-rules.md (or the sdd-verifier brief).

- **Tasks phase pre-marks regression-guard ACs** (F1/F5; the `tdd-regression-guard` rule
  exists but is applied only at test-author time; vacuous/red-impossible tests also in
  tdd-task-loop F3). Rule text: "The tasks-phase decomposition marks each acceptance criterion
  that already holds at base as a regression guard, so the test author keeps it tracked and
  excludes it from the red set without rediscovering the vacuity at implementation time."
  Target: tasks-phase decomposition conventions (harness agents) or agent-rules.md.

Note on multi-round requirements (F4; harness-control-pane, harness-usage-and-tiers,
lean-orchestrators, spec-lint, project-bootstrap): seen in 5+ specs but value-bearing each
time. Not a graduation candidate — no rule should cap or discourage requirements rounds that
catch real gaps.
