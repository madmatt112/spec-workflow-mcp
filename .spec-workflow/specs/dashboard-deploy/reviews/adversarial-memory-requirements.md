# Adversarial Review Memory — requirements

Last updated: 2026-11-05 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — `holdBy`↔`pauseRequested` coupling. Fixed v2: R1 AC2 sets
  both, R3 AC6 clears both, R4 AC4 names `pauseRequested`. Verified sound against
  `isStartable:456`, `runs.ts:574` pause-as-operator, `:242` early-return.
- **R1-2 (SHOULD_FIX, v1)** — unit-started signal distinct from `started`. Fixed v2:
  `unitStarted` field at R1 AC4; `started` = press time. NOTE: fix introduced R2-1/R2-2.
- **R1-3 (SHOULD_FIX, v1)** — client wire half unpinned. Fixed v2: R6 AC2 pins
  ShellProvider subscription/state + frontend payload hand-copy.
- **R1-4 (MINOR, v1)** — cancel success status. Fixed v2: R5 AC1 answers 200.
- **R1-5 (MINOR, v1)** — D4 "leave status alone" overstated. Fixed v2: scoped to
  queued/waiting/merging + running-parks-paused note.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (MUST_FIX, v2, Compounds R1-2, fix-induced)** — R3 AC4 and AC5 both match
  `wait` + `unitStarted` absent + unit live, no precedence stated; with R1 AC4's
  spawn-then-persist order, a crash in that window double-spawns the self-update unit
  (or, with a fixed unit name, trips R1 AC6 and releases holds under a live deploy).
  Fix: AC5 (unit live) wins over AC4; persist `unitStarted` before the spawn.
- **R2-2 (SHOULD_FIX, v2, Compounds R1-2, fix-induced)** — R5 AC1 contemplates cancel at
  `wait` before the unit exists, but nothing stops the controller starting the unit on
  its tick (R1 AC4) after cancel removed the record. R5 AC2 pins only the script writer.
  Fix: controller-side counterpart to R5 AC2 — removed/non-open record blocks the spawn.

## Patterns & Themes
- Two-writer handoff (controller spawns unit ↔ script writes record) is the live seam.
  v1 findings were about field/state *semantics*; v2 findings are about *ordering and
  precedence* of writes across that seam (crash recovery R2-1, live cancel R2-2). The
  R1-2 `unitStarted` fix sharpened both: it named the flag but did not pin when it is
  written relative to the spawn, nor who may spawn.
- `started`-field semantics (v1) and now the start-unit guard (v2): R1 AC4 remains the
  highest-risk AC — every recovery and cancel branch keys off whether/when the unit was
  started.
- Citations remain accurate; every v2-changed citation re-read and anchors. No MUST_FIX
  from a misstated artifact in either round.
- Wire-contract symmetry (R1-3) and the hold-coupling (R1-1) are now uniform and verified;
  do not re-examine.

## Guidance for Next Review
- Confirm the reviser gave R3 AC4-vs-AC5 a precedence (unit-live leaves alone) and pinned
  `unitStarted`'s write order relative to the spawn (R2-1).
- Confirm a controller-side no-spawn-after-cancel invariant mirroring R5 AC2 (R2-2).
- Well-covered, do not re-open: hold/`pauseRequested` coupling (R1-1), `unitStarted` vs
  `started` naming (R1-2), the client wire half (R1-3), cancel status (R1-4), D4 scope
  (R1-5), all delta citations.
- Lenses used: wire contracts (v1), crash-ordering / two-writer handoff (v2). A next round
  (if R2-1/R2-2 are fixed) should scope to a fix-induced re-check of the new precedence
  wording, not a fresh full pass — the document is otherwise converged.
