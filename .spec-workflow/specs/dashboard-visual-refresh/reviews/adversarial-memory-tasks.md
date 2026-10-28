# Adversarial Review Memory — tasks

Last updated: 2026-10-28 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (SHOULD_FIX, Novel)** — Requirement 3.4 (theme control in popover, default dark,
  `theme` storage key) is in no task's `_Requirements` line and task 6 (the gate) drops it,
  though `design.md:214` lists 3.4 among gate-checked invariants. Default-dark / storage-key
  stay unverified (after-screenshots set the theme explicitly; 6.2 grep only covers
  labels/roles/testids). Mitigated by ThemeProvider being in no `File:` list + tasks 2–3
  restrictions, so it is a verification/traceability hole, not a certain break. Fix: add 3.4 to
  task 6 (+ one gate line) or to tasks 2/3.

## Patterns & Themes
- The document is tightly built: bridge alias list, the 14+1 bare-radius sweep, the scan-hit
  file set, and the test seams were each probed against the real tree and all came back
  complete. Coverage weaknesses, if any, are at the invariant/gate edge, not in the red-first
  chain.
- Deltas this round were a clean lint pass (two citation-path fixes + one de-ranged scratch
  citation); all verified against code.

## Guidance for Next Review
- R1-1 is the only open item: check the reviser either added 3.4 to task 6 with a concrete
  default-dark/`theme`-key check, or moved it into tasks 2/3, and did not just drop the design's
  claim silently.
- Do NOT re-probe (verified clean this round): bridge completeness, bare-radius coverage,
  scan-hit file coverage, success-clause coverage, T3-vs-bridge double-declaration, the 1→6
  dependency chain.
- Fresh lenses still unused: completion-criteria precision of each `Success:` clause; whether
  task 4's cross-view pairs (row/pill/button same tone+variant+size) are guaranteed by the task-1
  seed; T1 utility-name-rule assertability against the design C7 list beyond the seven regexes.
