# Adversarial Review Memory — requirements

Last updated: 2026-11-05 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — `holdBy`↔`pauseRequested` coupling. Fixed v2. Verified sound.
- **R1-2 (SHOULD_FIX, v1)** — unit-started signal distinct from `started`. Fixed v2
  (`unitStarted`). NOTE: fix introduced R2-1/R2-2 and now R3-3's semantic drift.
- **R1-3 (SHOULD_FIX, v1)** — client wire half unpinned. Fixed v2 (R6 AC2).
- **R1-4 (MINOR, v1)** — cancel success status. Fixed v2 (R5 AC1 → 200).
- **R1-5 (MINOR, v1)** — D4 "leave status alone" overstated. Fixed v2.
- **R2-1 (MUST_FIX, v2)** — double-spawn on crash. Fixed v3: persist `unitStarted` before
  spawn (R1 AC4); R3 AC4 gains "no unit is live" + AC5-precedence. Verified resolved r3:
  AC4/AC5 now mutually exclusive on unit-liveness across all four restart states.

### Partially Accepted
- **R2-2 (SHOULD_FIX, v2) — only half-closed.** v3 added R1 AC4 re-read-under-lock + R5 AC2
  "controller starts no unit once removed, by the re-read under its lock". Closes the
  cancel-removes-before-tick half only. See R3-1 (reopened residual).

### Rejected
- (none)

### Unresolved
- **R3-1 (MUST_FIX, v3, Compounds R2-2, fix-induced)** — R5 AC2's "by the re-read under its
  lock" is not self-sufficient: cancel's `release-the-holds-and-remove` (R5 AC1) is not
  pinned to R1 AC4's lock. A tick that re-read "open at `wait`" then awaits the `unitStarted`
  persist can have cancel remove the record in between; `writeJsonAtomic` (temp+rename)
  **recreates** the record and the spawn proceeds — deploy runs on runs cancel released after
  a 200. Fix: run R5 AC1's release+remove under the same lock as R1 AC4.
- **R3-2 (SHOULD_FIX, v3, Novel, carried)** — R2 AC3's "SIGTERM from outside a cancel → write
  `failed`" asks the script to condition on a distinction it cannot observe (no trap today;
  any added trap fires on cancel's SIGTERM too; record still present at kill time). The
  consistent mechanism (trap always writes `failed`; cancel's removal erases it, R5 AC1/AC2)
  is unstated. Fix: drop "from outside a cancel"; state the two-part mechanism.
- **R3-3 (MINOR, v3, Compounds R2-1)** — persist-before-spawn makes `unitStarted: true`
  possible with the unit never actually started (crash in the persist→spawn window); R3 AC3
  then fails it as a "lost unit", and D3's "unit was never started … does not fail" is
  contradicted. Wording/semantics only; ACs are precise. `unitStarted` = "committed to start".

## Patterns & Themes
- The controller↔script two-writer seam remains the only live risk area. r1 = field/state
  *semantics*; r2 = *ordering/precedence* of the spawn; r3 = **teardown/cancel mutual
  exclusion** and the *meaning* the flag carries after the ordering fix. Each fix on this
  seam has spawned the next-round finding on the same seam — the pattern is now three deep.
- R1 AC4 is still the highest-risk AC: every recovery, cancel and now lock-serialisation
  branch keys off it.
- The recurring blind spot is the **cancel path**: v2 flagged the controller-start side
  (R2-2); v3 shows the fix pinned the controller read but not the cancel *write*/lock (R3-1)
  and never pinned the script's cancel-vs-non-cancel termination (R3-2). The cancel teardown
  is under-specified relative to the press/recovery paths.
- Citations remain accurate every round; no MUST_FIX has come from a misstated artifact.

## Guidance for Next Review
- Confirm R5 AC1's release+remove is stated to run under R1 AC4's lock (R3-1), making
  "by the re-read under its lock" actually sufficient.
- Confirm R2 AC3 no longer attributes cancel-discrimination to the script, and that the
  trap-writes / cancel-erases mechanism is named (R3-2).
- Confirm D3 / R3 AC3 wording reconciled with the persist-before-spawn window, or
  `unitStarted` redefined as "committed to start" (R3-3).
- Well-covered, do not re-open: hold/`pauseRequested` coupling (R1-1), `unitStarted` vs
  `started` naming (R1-2), client wire half (R1-3), cancel status (R1-4), D4 scope (R1-5),
  the double-spawn/AC4-vs-AC5 precedence (R2-1, now resolved), all delta citations, the
  swap-race (explicitly design-deferred in Reliability).
- Lenses used: wire contracts (r1), spawn crash-ordering (r2), cancel/teardown mutual
  exclusion (r3). If R3-1/R3-2 are fixed, next round should be a fix-induced re-check of the
  cancel-lock clause and the R2 AC3 rewording, not a fresh full pass — the document is
  otherwise converged.
