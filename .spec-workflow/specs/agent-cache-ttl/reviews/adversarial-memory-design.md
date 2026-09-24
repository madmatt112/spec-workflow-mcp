# Adversarial Review Memory — design

Last updated: 2026-09-24 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1, awaiting drafter response)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MINOR).** `recompute.mjs` assumes subagent transcripts sit under
  `$H/projects/*/SESSION/subagents/agent-AGENTID.jsonl` when the isolated session runs with
  `CLAUDE_CONFIG_DIR=$H`. The recorded binary probe verified `CLAUDE_CONFIG_DIR` for settings
  location + absolute-path only, not for the projects/transcript dir. Load-bearing for scenario
  (3); unprobed. Scratch tool, tunable, so not a blocker.
- **R1-2 (MINOR).** C8 "without touching `~/.claude`" / D1 "leaves other sessions alone"
  understate the touch: live scenarios append to the real `~/.local/state/sdd/active-run` and
  leave `spawn-ends` markers. `--clear-pointer` is `$ROOT`-scoped (safe), but the framing is
  inaccurate.
- **R1-3 (MINOR).** Field-name seam: `ReducedSpawn.cache` = `{w5m,w1h,gap,unknownWrite,unknownGap}`
  vs `UsageCell` = `{cacheWrite5m,cacheWrite1h,gapRewrites,cacheUnknownWrite,cacheUnknownGap}`.
  "Add `cache`" / "addCell covers all eight" hide a five-field remap.

## Patterns & Themes

- The document is unusually well-grounded: every cited path/range/signature/behaviour was
  verified accurate, including all 12 lint-repointed citations. No misstated-artifact MUST_FIX.
- The wire contract (`spawn.end` → `reduceSpawn` → `UsageCell` → `cacheCols`/`formatOne`/
  `formatCompare`) is internally consistent and matches Req 4 criteria 2-8 and carried notes 1/3.
- The four "re-decided literals" the prompt flagged are all refinements, each backed by a
  recorded decision (D4, D6, D2, D9) and a real constraint (vitest include; Claude Code's
  `CLAUDE_CONFIG_DIR` read; deterministic gap; same-branch fix + retained retrospective block).
- Residual risk concentrates in the operator-driven, multi-step C8 live-verification path
  (unprobed transcript dir, exit-condition timing), not in the shipped code design.

## Guidance for Next Review

- Rulings closed this round (do not re-open): the four refinement rulings (Req 1.5, 5.2.5, 6.2,
  6.7); the binding-constraint check (branch `cacheTtl` is exercised via `dev-link.sh` REPO=`$0`
  + `CLAUDE_CONFIG_DIR`); the fresh-lens wire-contract trace (consistent end to end); citation
  accuracy of every artifact listed in the analysis "What I checked" section.
- If a v2 lands, attack only the deltas plus one unused lens (candidates: the operator launch
  sequence's failure/rollback paths across the six numbered steps; or the render-pad interaction
  with agents that are NOT the three orchestrators once profiles gain `cacheTtl`).
- Confirm whether R1-1/R1-2/R1-3 were addressed; if the transcript-dir probe (R1-1) is still
  absent, it stays MINOR unless the drafter makes recompute depend on it more tightly.
- Partial-unknown write columns summing silently is mandated by Req 4.6 — do not raise it.
