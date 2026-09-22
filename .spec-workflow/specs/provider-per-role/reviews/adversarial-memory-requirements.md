# Adversarial Review Memory — requirements

Last updated: 2026-09-22 (round 1, v2)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MUST_FIX)** — D2 (line 132) still says a bad map row / ineligible role / missing key
  "refuses the run with a note"; D5 (revised) and Req 1 crit 3 / Req 4 crit 2 say a
  start-refusal writes no ledger row. Direct contradiction from the v2 delta not reaching D2.
- **R1-2 (SHOULD_FIX)** — Req 2 crit 5/6 pass the DeepSeek native name (`deepseek-v4-pro`) as
  `--model` / `ANTHROPIC_MODEL`; the settled mapping (`decomposition.md:256-258`) routes "any
  other name" (non-`claude-*`) to `deepseek-flash`. Silent tier downgrade of the reviewer;
  preflight (a) records `message.model` but asserts nothing about it.
- **R1-3 (SHOULD_FIX)** — the refusal ordering / "first ledger row" moment is unstated. Map
  read is pinned to the roots step (Req 1 crit 4) but validation + key check timing vs the
  `SKILL.md:76-86` block (run id / event.sh / pointer line / run.start) is only implied; a
  wrong order leaves a stale `active-run` pointer line and orphan `event.sh`.
- **R1-4 (SHOULD_FIX)** — Req 7's "the decomposition's six scenarios runnable as written" is
  now false for scenario 4 (`decomposition.md:383-384` says "stops at run.start with a note");
  the v2 divergence from the decomposition is unrecorded. (Same root as R1-1.)
- **R1-5 (SHOULD_FIX)** — Req 2 crit 1's enumerated `launch.sh` values (spec dir, run id, spec,
  map) omit the harness-source path the launcher needs to find its body, the agent file and
  `agent-profiles.json` (Req 2 crit 2/5).
- **R1-6 (SHOULD_FIX)** — Req 2 crit 7's "from a worktree cwd" premise never occurs: all
  eligible roles are document-phase (reviewer, checker, reviser), which run in the main
  checkout; the supervisor enters a worktree only before implementation (`SKILL.md:270-282`,
  `agent-rules.md:40`). Live `run.start` for this spec is `worktree=no`.
- **R1-7 (SHOULD_FIX)** — Req 2 crit 5's "declared model and effort for the ledger" (from
  `agent-profiles.json`) contradicts the ledger contract: Req 3 crit 1 writes
  `model=<requested deepseek name>`/`effort=not-applied`; Req 3 crit 2 writes actual
  `message.model`. Declared values never reach a ledger row.
- **M1 (MINOR)** — Req 3 crit 3 does not say the `--session-id` uuid is fresh per launcher call
  (rounds would append to one transcript and over-count).
- **M2 (MINOR)** — Req 1 crit 6 adds a fifth machine-read line; `docs/SDD-HARNESS.md:271` still
  says "Four" (count-word update, task phase).

## Patterns & Themes

- The v2 gate A delta (remove the ledger trace for a start-refusal) was applied to the
  acceptance criteria, the NFR and D5, but not swept through the rationale (D2) or the
  cross-document alignment (Req 7 vs `decomposition.md`). Pattern: propagate a decision change
  to every decision entry and every "as written" claim, not just the criteria.
- The launcher wire contract is the soft spot: three separate boundaries (map→launcher,
  launcher→child/DeepSeek, run→execution-context) each carry an unstated or wrong assumption
  (harness path, `--model` mapping, worktree cwd). The DeepSeek endpoint facts are "settled,
  not re-probed" — so any requirement that acts against those settled facts (R1-2) is high
  risk because the preflight is scoped to measure behaviour, not to assert the requested model.

## Guidance for Next Review

- Confirm D2 was split (start-refusal = no row; missing launcher = `PHASE: error`) and that
  Req 7 / Scope notes reconcile with `decomposition.md` (still "with a note" at line 383-384).
- Check whether the `--model` question (R1-2) was resolved by tier-alias mapping or by a
  preflight assertion on `message.model`; do not accept "records message.model" as a fix.
- Re-read the refusal ordering: it must be explicit that no run id, pointer line, `event.sh`
  or `run.start` is written on a refusal.
- Citations were all accurate on v2 (spec-lint clean; I re-read both ends of the load-bearing
  ranges). Later rounds can trust `path:line` resolution and focus on meaning.
- Rulings closed by revision history: RI-1 (refused-at-start writes no ledger row) — do not
  re-open the decision itself, only its incomplete propagation.
