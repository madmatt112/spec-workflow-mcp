# Adversarial Review Memory — requirements
Last updated: 2026-09-15 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — Hook spawn events cannot carry precise `role`/`result`; v2 put
  them on the orchestrator `spawn.usage` event and pinned the renderer change (4.2, D2).
- **R1-2 (SHOULD_FIX, v1)** — Undefined wire contract; v2 added the wire-contract table
  (file, keys, writer, agent+time-window join, torn-tail skip).
- **R1-3 (SHOULD_FIX, v1)** — Supervisor→orchestrator spawn writes; v2 added AC 3.6 keeping
  them (routing prompt has no brief path, hook does not fire).
- **R1-4 (SHOULD_FIX, v1)** — Interrupted row + write-vs-return; v2 rewrote Req 5 (rows from
  `phase.end`, 5.4 interrupted row, block-only write preserving header/sections, 5.3 split).
  NOTE: 5.4's fix is itself flawed — see R2-2 (Unresolved).
- **R1-5 (SHOULD_FIX, v1)** — Close-out budget vs source; v2 reworded 6.1 (every open item of
  every class, one worker per class-and-batch). Reconciled with SKILL.md:16-17 and :44.
- **R1-6 (SHOULD_FIX, v1)** — `orient` missing `MODE`; v2 added `mode` input + revision
  fixture (1.1, 1.7). Confirmed against sdd-document-phase/SKILL.md:65-66.
- **R1-7 (MINOR, v1)** — "20 tasks in one spawn" reworded to orchestrator invocation (6.1).
- **R1-8 (MINOR, v1)** — Parser-block vs hand-rule heading; v2 added the scope note.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (SHOULD_FIX, Compounds R1-1)** — The ticker (`ledger.ts:300-301` → `render.ts:171`)
  still renders `role`/`result` from `spawn.start`/`spawn.end`; new path degrades those and
  `spawn.usage` has no ticker branch. 4.2 pins only `render.ts:180-208` (agentLines).
- **R2-2 (SHOULD_FIX, Compounds R1-4)** — 5.4 interrupted-row trigger ("phase.start w/o
  phase.end") ≠ supervisor rule (SKILL.md:139-143, State-row-ahead, impl-only); no run-ended
  guard so it stamps the live phase (buildModel treats same state as live, ledger.ts:216-224);
  and "state from phase.start" (formats.md:189) is the entry snapshot, not the advanced count.
- **R2-3 (SHOULD_FIX, Novel)** — `## Phase log` is one table shared across specs (Spec column,
  formats.md:57/65; parseHandoffPhaseRows filters cells[1]!==spec, ledger.ts:157). 5.1 renders
  per-spec and writes "only the block" but omits preserving other specs' rows — data-loss path.
- **R2-4 (SHOULD_FIX, Novel)** — Hook writes only harness-activity.jsonl today (sdd-activity.sh:28);
  Req 3 now needs ledger-shaped spawn events in harness-events.jsonl AND never says the hook keeps
  its tool/agent.start/agent.stop writes that feed the live badge (render.ts:188-196, 205-206;
  ledger.ts:265). No criterion protects the live activity view for new runs.

## Patterns & Themes
- Each round-1 fix landed but under-scoped one surface. R1-1's fix covered the agentLines
  spawn view and forgot the ticker (R2-1). R1-4's fix invented an interrupted trigger that
  fights the live-phase rule (R2-2). The theme persists: "the renderer/hook is unchanged"
  keeps hiding a second rendered artifact (ticker, live badge) or a shared-file hazard
  (the cross-spec phase-log table) that the requirement text does not name.
- v2 citations are all accurate paths/lines; every remaining issue is semantic completeness,
  a self-contradiction (5.4 vs 4/buildModel), or a data-loss path — attack meaning and
  cross-consumer/cross-spec effects, not paths.
- The `--watch` renderer has three consumers of `role`/`result`/`tokens`: agentLines
  (pinned), the ticker (unpinned, R2-1), and the live activity badge/tokensTotal fed by the
  hook activity file (unpinned, R2-4). Enumerate all three when judging any "same view" claim.

## Guidance for Next Review
- Well covered, do not re-mine: the wire contract table, the join key under serial exec, the
  supervisor's kept orchestrator spawns (3.6), `orient` MODE, the budget wording — all
  accurate and closed unless the v3 delta changes them.
- Focus areas for v3: (a) does the ticker get a criterion + `spawn.usage` branch; (b) does
  5.4 gain a run-ended guard and the correct trigger/state; (c) does 5.1 preserve other specs'
  rows; (d) does Req 3 keep the hook's activity writes and state the ledger event shape.
- Citations remain accurate; do not re-open them. If v3 rewrites Req 5 again, re-check the
  buildModel dedup key (phase+result+state, ledger.ts:210) when WRITING to HANDOFF — a state
  mismatch there yields a persistent duplicate row, not a transient one.
