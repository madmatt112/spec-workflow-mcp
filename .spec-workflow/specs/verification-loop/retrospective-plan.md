# Retrospective plan — verification-loop

Status: APPROVED
Date: 2026-10-22

## Approved proposals

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

## Decisions

- P2: The verifier judged it non-blocking and it shipped; should we fix it? → fix the guard to also suppress `none` after `unreadable`/`none`, add the regression test. One line, removes the invariant deviation at its cause.
- P7: How should a non-blocking info finding be captured at pass? → verifier records it as a deferral when closing `pass`, so it lands in the tracked queue and survives the retro.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P1: skipped — no change chosen
- P3: skipped — no change chosen
- P4: skipped — no change chosen
- P6: skipped — no change chosen
- P5: done — 6cc5f9c8b48877bcc7ab191b1465374764a39b8a
- P7: done — 16188b50309c6c7de16eec340f99e32ffee53709
- P2: done — d90bb87c2e4c6aa42bac3df7489af011313a2fcd
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/169
