# Adversarial Review Memory — requirements

Last updated: 2026-09-18 (Round 1, v2)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MUST_FIX)** — Req 1 AC10 bare `:30` resolves to `typecheck.ts:30` (a comment;
  `MAX_BUFFER` absent) after the v2 lint inserted `typecheck.ts:478`. Intended target is
  `task-diff.ts:30`. Delta-introduced; upholds open warning L-2. Fix: re-anchor the path.
- **R1-2 (MUST_FIX)** — per-task record key granularity contradicts itself. Req 1 AC1/AC4
  ("keyed by ... workspace path", "never another workspace's record") describe
  per-workspace records; Req 3 AC6 / Req 7 AC3 need cross-workspace attribution read for
  `mismatch`. D3 implies one per-task file (base per-workspace, attribution shared) but no
  AC states the split. This is the decomposition's lead coupling.
- **R1-3 (SHOULD_FIX)** — AC10 requires naming/distinguishing the git-failure cause, but
  shared `runGit` (`task-diff.ts:50-62`) returns only `{stdout, ok}` and discards
  `err`/`err.code`; the `!ok` arm (`:191-193`) cannot comply without a helper change the
  doc omits.
- **R1-4 (SHOULD_FIX)** — provenance value `recorded` (validated-base success case) is used
  in Req 7 AC1 / Migration but never defined by Req 1 (AC6/AC11), and Req 4 AC5 specifies no
  disclosure behavior for it.

## Patterns & Themes
- Precision is high; the failures are at the edges. The lint pass itself introduced the
  one citation defect (R1-1) by shifting a bare citation's nearest-path anchor.
- The recurring soft spot is the shared on-disk record contract (R1-2) — key granularity,
  field ownership, read scoping — exactly the cross-component seam the decomposition split
  this spec to own. It is still under-specified at the AC level.
- Enum/return-shape wire contracts are incompletely closed: `recorded` provenance (R1-4)
  and the `runGit` cause channel (R1-3) are named at one boundary but undefined at the
  producing one.
- Verified sound and not to be re-litigated without new evidence: Req 6's TOON RangeError
  (reproduced against `@toon-format/toon@0.8.0`); the 37+15=52 dependency counts; the
  `tighter-reviews` doc being git-tracked (drift test runs in CI); the runner reading
  `prepareResponse.data` in-process (Req 6 concerns the direct MCP path only).

## Guidance for Next Review
- Re-check R1-1 first: confirm the bare `:30` was re-anchored to `task-diff.ts:30`.
- For R1-2, demand an explicit record schema in the ACs (file key + per-workspace base map
  + shared attribution + read/merge rules). Re-test the A-logs / B-reviews path against the
  new wording.
- Confirm R1-3 and R1-4 produced ACs (runGit cause channel; `recorded` provenance defined
  and given AC5 behavior).
- Fresh lenses not yet used: failure-injection / idempotency (re-mark `in-progress`,
  overwrite semantics, concurrent base+attribution writes under `withRegistryLock`); and
  test-fixture / byte-pin drift once the new diff-state kind and `unavailable` reason land.
- Do not re-open: Req 6 TOON premise, dependency counts, git-tracking of tighter-reviews,
  the L-1/L-11/L-13.. rejections recorded in the v2 Revision History.
