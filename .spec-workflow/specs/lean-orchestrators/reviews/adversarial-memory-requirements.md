# Adversarial Review Memory — requirements

Last updated: 2026-10-02 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none yet)

### Rejected
- L-1…L-5 (lint-pass identifier warnings) — rejected by the lint pass and recorded in the
  Revision History as closed. `base` is a document-defined source name; `harness`, `orient`,
  `implementation` are MCP tool/action/phase names. Not citation defects. Do not re-raise.

### Unresolved
- R1-1 (SHOULD_FIX) — Transcript-location contract underspecified on the usage/consumer
  side: `<projects dir>` undefined, `<any project>` scan is a new behaviour the hook lacks,
  and the events→activity `session` join (spawn.end has no `session` key) and its
  no-activity-row failure path are missing. Req 1.3, 1.7, NFR Security.
- R1-2 (SHOULD_FIX) — Req 3.3/3.4 "no whole read of references/briefs.md / every brief from
  harness brief" is under-scoped: BRIEF_TEMPLATES has 6 kinds; the round section, code-graph
  block, lint, gate-A, narrow-check, reviewer, checker templates are not enumerated and some
  do not exist; removing the whole read can break kept Step 2 / Lint step.
- R1-3 (SHOULD_FIX) — Req 6 batch close/pick has no idempotency / partial-failure recovery
  contract; a re-run could double-append ledger rows, against Req 6.5 and the ledger floor.
- R1-4 (SHOULD_FIX) — Req 7.3 runaway-guard "open tasks" evaluation point ambiguous; Req 7.5
  adds a conditional completion-gate-only spawn not recorded in D1's gate-A wall-clock story.
- R1-5 (MINOR) — Scenario-1 (Req 1.6) needs ephemeral real transcripts; align capture with
  Req 2.1's early baseline write.
- R1-6 (MINOR) — Req 7.1 "today 20" also at impl SKILL.md:16 and 17-20 with a rationale that
  must be rewritten, not just the number.
- R1-7 (MINOR) — Req 3.5 constrains only the document orchestrator's cleanup.md reads; the
  impl orchestrator also reads document-phase cleanup.md (spec-edit + commit scripts),
  overlapping Req 6; unresolved.

## Patterns & Themes
- Producer/consumer asymmetry: the hook (producer) has the live payload; the `usage` action
  (consumer) must reconstruct everything from the ledger. Several ACs assume parity that
  does not hold (R1-1 the strongest).
- Sweeping "every X SHALL come from Y" ACs (Req 3.3) without enumerating the migration set
  hide large, partly-impossible scope.
- Batching and more-frequent restarts trade away existing recoverability and add
  unaccounted spend; the gate-A/wall-clock discipline the doc sets for itself is not fully
  applied to its own cuts (R1-3, R1-4).

## Guidance for Next Review
- Baseline W (4.50M doc / 2.68M impl), skill keep/move lists (Req 3.1/3.2), and all spot-
  checked citations are verified accurate — do not re-litigate; re-probe only if v2 edits them.
- Focus v2 on whether R1-1 and R1-2 got concrete contracts (projects-dir source, scan,
  session join, enumerated template set) and whether R1-3's idempotency rule landed.
- Next fresh lens candidates not yet used: failure-mode/recovery taxonomy across resume and
  repair paths; testability of the per-source split against the W floor.
