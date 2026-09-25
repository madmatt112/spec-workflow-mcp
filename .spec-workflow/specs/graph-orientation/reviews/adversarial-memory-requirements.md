# Adversarial Review Memory — requirements

Last updated: 2026-09-25 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Under `worktree-per-change` the implementation/close-out workers
  run in a `feat/<spec>` worktree, so `GRAPH` is the main checkout's graph (missing the
  worktree's new symbols, never refreshed); R2 AC2's per-task refresh is dead like the
  close-out one, but only close-out is disclosed (D12). Scenario (4)/R7 AC4 can only pass in
  a non-worktree fixture, so the freshness path is unverified for real runs.
- **R1-2 (SHOULD_FIX)** — R1 AC8 wants the post-refresh `graphBehind` in `run.start`, but
  R2 AC1 only pins the refresh to "before the first orchestrator spawn", which is after the
  `run.start` write (`sdd-continue/SKILL.md:108-110`). Ordering under-specified.
- **R1-3 (SHOULD_FIX)** — R6's per-role `graph` count omits DeepSeek-routed workers:
  `sdd-activity.sh:126-127` records only `sdd-` Agent-tool subagents, and spec 10 runs
  reviewer/checker as `claude -p` children; agent keys also differ (`@deepseek`). Not scoped.
- **R1-4 (MINOR)** — R6 AC4 (`data.report` carries counts) + AC3 (reuse inline `usage.ts:277-296`)
  is really a two-file join (activity rows × events phase windows) needing rule extraction;
  merge must live in `usageAction`, not the pure `buildUsageReport`. Flag for design.
- **R1-5 (MINOR)** — shrink guard (`watch.py:1612-1618`) + R2 AC7 "no `--force`" wedges the
  graph after a deletion-heavy commit; R2 AC5 degrades gracefully but the trap is undisclosed.
- **R1-6 (MINOR)** — R3 AC6 claims to reuse the placeholder-only missing-value rule
  (`harness.ts:617-631`) for graph values that AC7 forbids from being placeholders; it is a
  new check, reword the citation.

## Patterns & Themes

- **Worktree seam is the recurring blind spot.** The spec reasons cleanly about the main
  checkout (drafter, run-start refresh) but repeatedly under-specifies the worktree case that
  is this project's default: dead refresh (R1-1), graph missing new symbols (R1-1).
- **Cross-boundary state ordering.** run-start vs refresh (R1-2) and activity-file vs
  events-file folds (R1-4) are the wire-contract weak points; the fresh lens paid off there.
- **Cross-spec interactions (10, 8) under-scoped.** DeepSeek children (R1-3) inherited from
  the provider-per-role landing are not addressed by R6.
- Citations are clean: every cited range is accurate, the v1 lint delta introduced no defect,
  the graphify probes (D1) hold in the installed package, and the lint rejections are sound.

## Guidance for Next Review

- Re-check whether v2 disclosed the implementation-phase worktree limitation (R1-1) the way
  D12 handles close-out, and whether scenario (4)'s fixture is stated non-worktree.
- Verify the run-start refresh is pinned before `run.start` (R1-2).
- Verify R6 scopes the `graph` column to Agent-tool/anthropic workers (R1-3).
- Do not re-open the citations, the D1/`graphify update` exit-code probe, or the lint
  dispositions — all verified accurate this round. Re-raise a rejected item only with new
  evidence, marked Recurring.
