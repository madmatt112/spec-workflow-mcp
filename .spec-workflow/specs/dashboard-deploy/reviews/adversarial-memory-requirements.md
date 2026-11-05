# Adversarial Review Memory — requirements

Last updated: 2026-11-05 (after v4 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — `holdBy`↔`pauseRequested` coupling. Fixed v2. Sound.
- **R1-2 (SHOULD_FIX, v1)** — unit-started signal distinct from `started`. Fixed v2
  (`unitStarted`). NOTE: this fix seeded R2-1/R2-2, R3-x and now R4-1 on the same seam.
- **R1-3 (SHOULD_FIX, v1)** — client wire half unpinned. Fixed v2 (R6 AC2).
- **R1-4 (MINOR, v1)** — cancel success status. Fixed v2 (R5 AC1 → 200).
- **R1-5 (MINOR, v1)** — D4 "leave status alone" overstated. Fixed v2.
- **R2-1 (MUST_FIX, v2)** — double-spawn on crash. Fixed v3; verified resolved r3 and still
  sound v4 (AC4/AC5 mutually exclusive on unit-liveness across all restart states).
- **R3-2 (SHOULD_FIX, v3)** — R2 AC3 attributed cancel/non-cancel SIGTERM discrimination to the
  script. Fixed v4: "any SIGTERM → `failed`; cancel's record removal erases it". Verified sound
  r4 (but conditional on "unit is gone", which R4-1 breaks — defect is in R5, not here).
- **R3-3 (MINOR, v3)** — `unitStarted` drifted to "committed to start". Fixed v4: R3 AC3, D3 and
  scope note reconciled to "committed to starting the unit". Verified sound r4.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R4-1 (MUST_FIX, v4, fix-induced, Compounds R3-1 / seam from R2-2)** — R5 AC1 decides "stop
  the unit if `unitStarted`" on a **pre-lock** read; the lock scopes only release-and-remove. In
  the tick-first interleave (cancel reads `unitStarted` false → tick acquires lock, persists,
  spawns, releases → cancel acquires lock, removes record) the just-spawned unit is never stopped
  and is in its own cgroup, so a 200-cancel leaves a live deploy that swaps/restarts on released
  runs and the script recreates the removed record (breaking R5 AC2 "removal after the unit is
  gone" / "no later script write recreates it" and R2 AC3 "no `failed` record"). R5 AC2's "the
  cancel then stops" has no mechanism in R5 AC1. The R3-1 fix pinned the record removal under the
  lock but not the unit-liveness decision. Fix: make cancel's liveness determination + record
  claim atomic under R1 AC4's lock (re-check/stop under the lock, or claim the record first so no
  spawn can follow cancel's decision).

## Patterns & Themes
- The controller↔script two-writer seam is the only live risk area, now **four deep**: r1
  field/state semantics; r2 spawn ordering/precedence; r3 teardown record-removal mutual
  exclusion; r4 teardown **unit-liveness** mutual exclusion. Each fix on this seam pins one more
  edge of the cancel-vs-tick critical section and exposes the next unpinned edge.
- R1 AC4's lock is the hinge. A writer is safe only if it *claims the record under the lock
  before deciding a unit's fate*. The tick does (re-read decisive); cancel still does not — it
  decides the unit's fate (stop or not) on a stale pre-lock read. That asymmetry is R4-1.
- Citations remain accurate every round; no MUST_FIX has come from a misstated artifact — all
  from the internal logic of the cancel/spawn interleaving.

## Guidance for Next Review
- Confirm cancel's unit-stop / liveness check is moved **under** R1 AC4's lock (or that cancel
  claims the record under the lock before any unit can be spawned), so R5 AC2's "the cancel then
  stops" and "removal after the unit is gone" are actually true in the tick-first ordering (R4-1).
- Once R4-1 is fixed, verify no NEW edge of the cancel/tick critical section is left unpinned
  (the seam has regressed every round) — walk all four lock-acquisition orderings
  (cancel-first / tick-first × `unitStarted` true / false) explicitly.
- Well-covered, do not re-open: hold/`pauseRequested` coupling (R1-1), `unitStarted` vs `started`
  naming (R1-2), client wire half (R1-3), cancel status (R1-4), D4 scope (R1-5), double-spawn /
  AC4-vs-AC5 precedence (R2-1), SIGTERM→`failed` mechanism (R3-2), `unitStarted` "committed"
  semantics (R3-3), all delta citations, the swap-race (design-deferred in Reliability).
- Lenses used: wire contracts (r1), spawn crash-ordering (r2), cancel/teardown record removal
  (r3), cancel/teardown unit-liveness (r4). If R4-1 is fixed, next round should be a fix-induced
  re-check of the cancel-lock clause only — the document is otherwise converged.
