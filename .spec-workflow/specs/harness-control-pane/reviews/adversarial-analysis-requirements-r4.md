R3-1: addressed — AC 4.9 now routes all three pushes (run model, log lines, gate sections) to harness subscribers only, keyed on AC 4.8 state.
R3-2: addressed — AC 3.13 requires deregister.mjs or an equivalent single-line removal atomic against a concurrent writer, never `grep -v` (SKILL.md:494-500 confirmed).
R3-3: addressed — AC 3.12 re-checks each restored launch record's pid on restart and drives a dead run through AC 3.10, whose steps are now stated idempotent.
R3-4: addressed — new AC 3.14 requires surfacing the failing step/error, leaving no launch record for a child that never started, and never reusing an incomplete worktree.
R3-5: addressed — AC 2.6 now deletes `harness-run.json` on a preflight refusal so it cannot re-refuse future runs.
R3-6: addressed — new scope note bounds the single-live-run invariant (AC 3.7, AC 3.8) to dashboard-initiated launches, citing the decomposition's pointer-file lock (decomposition.md:673-674, confirmed).

VERIFIED: 6/6

## Deferred findings
- None noted beyond the checked items.
