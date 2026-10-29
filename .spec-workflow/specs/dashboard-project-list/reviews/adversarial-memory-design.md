# Adversarial Review Memory — design

Last updated: 2026-10-29 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX, Novel)** — Integration test waits for "the registration log line";
  the `--no-register` fix replaces it with a skip line, so the green test hangs. Must key on
  a flag-invariant signal (ready/exit or either line), and state the node-20 child_process/
  stream fields it relies on (agent-rules). Testing Strategy › Integration.
- **R1-2 (SHOULD_FIX, Novel)** — Un-debounced chokidar reconcile (`project-manager.ts:115-121`)
  now runs synchronous `execSync` git classification (`linkedWorktreeInfo`, 5000 ms) per
  differing entry; a run-startup burst (the spec's motivating scenario) blocks the event loop
  up to 5 s × N, serialized. D12 covers per-sync cost, not volume/blocking. C1, C3, D12.
- **R1-3 (SHOULD_FIX, Novel)** — C5 makes `forgetProject` throw on lock-not-acquired;
  `removeProjectById` (`:392`) does not catch, so a contended DELETE returns 500 and the
  "removed" project reappears on next sync. Error Handling #3 covers `rememberProject` only.
- **R1-4 (MINOR)** — C1 "Reuses the existing common-dir handling; no new git command" is
  imprecise: to get raw `.git` test + normalized parent from one call it reimplements
  `isGitWorktree`/`gitCommonDirAbsolute` logic inline.
- **R1-5 (MINOR)** — Data Models tags both wire shapes "illustrative — verify against the test
  fake" though fields are enumerated and correct.

## Patterns & Themes
- Citations and the folding core are accurate and feasible; the weak points are all at the
  seams the design adds: a real-server integration test, the watcher hot path, and a lock
  contract widening. Attack execution/operational edges next round, not the fold algebra.
- The spec's own trigger ("messy as runs start up") is a burst scenario — any new per-sync
  work must be judged under bursts, not single events.

## Guidance for Next Review
- Re-check R1-1/R1-2/R1-3 as fix-induced re-checks scoped to the reviser's diff.
- If a debounce is added, confirm it does not delay the first reconcile past
  `initialize()`'s ordering (cleanup → prune → sync → watcher).
- Confirm any new integration/e2e test states which node-20 stream/child_process behaviours
  it asserts on.
- Folding algebra (C2), representative consistency (C8/C10), and the AC9/R1-AC3 edges were
  checked clean in R1 — do not re-litigate without new evidence.
