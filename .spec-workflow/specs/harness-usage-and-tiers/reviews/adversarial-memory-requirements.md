# Adversarial Review Memory — requirements

Last updated: 2026-09-19 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (SHOULD_FIX)** — `agent-profiles.json` generated at `harness/` (Req 3.1) but no
  criterion ships it into `dist/`; `copy-static.cjs` copies only `src/markdown`/`src/locales`,
  `files` is `dist/**/*`. D4 asserts "ships inside dist" without a copy step. `npx` users hit
  Req 3.5 (empty tier columns, silent). Also: dev/test/dist resolution base unspecified, so
  `render.test.ts:53/56` (Req 4.6) may not find the file when vitest runs from `src/`.
- **R1-2 (SHOULD_FIX)** — Usage report counting/spawn-identity ambiguous. Req 5.4 "count every
  digit-string row once" contradicts "spawn.end else spawn.usage" (Req 7.2 says spawn.end
  wins). "Spawn" identity undefined for the double-`spawn.end` case in the Req 5.9 fixture
  (question-gates analyst: 1 spawn.start, 2 spawn.end rows, second = 45,675; buildModel drops
  it). buildModel fold (`ledger.ts:250-291`) cannot be reused (last-run scope, `:241` drops
  the row). Needs its own algorithm.
- **R1-3 (SHOULD_FIX)** — Render row cannot fit full model ids (Req 3.3, `claude-opus-4-8`=15,
  `claude-fable-5-1`=16) plus a new actual column (Req 4.2/4.3) at cited layout `render.ts:203`
  (model width 11, role-slack 46). `padRight` does not truncate → overflow/misalign. Req 4.5
  verification collides with the layout. Req 4.3 delegates only the mark to design, not widths.
- **R1-4 (MINOR)** — Req 6.2: model-policy table (`SDD-HARNESS.md:288`) groups the supervisor
  with orchestrators/analyst, but the supervisor has no agent file and is not in
  `agent-profiles.json`; "the generated source" cannot cover its row.
- **R1-5 (MINOR)** — `PHASE_ORDER` (`render.ts:60`) is non-exported; the tool must export or
  duplicate it (Req 5.2). Second-spec parameter (Req 5.3/D12) unnamed; schema has
  `additionalProperties: false`.
- **R1-6 (MINOR)** — Req 2.1 "the orchestrator's spawn.usage row ... keep phase, task/round"
  vs Req 2.3 supervisor writes only `(agent, role, result)`. Reword 2.1 to "the worker
  spawn.usage row an orchestrator writes."

## Patterns & Themes

- **Citations and probes are solid.** Every changed citation in the v1 lint diff verifies at
  both ends; every load-bearing ledger number reproduces (question-gates 1,963,320 / 1,185,572;
  review-gate 6,324,447; analyst double spawn.end). No misstated artifacts. Attack on
  completeness/ambiguity, not accuracy.
- **The recurring hole is the seam between generation and consumption**: a value is generated
  in one place (`harness/agent-profiles.json`) and consumed in another (`dist/`, `src/` tests,
  `render.ts` row) without the connecting step/layout being pinned (R1-1, R1-3).
- **The core deliverable (usage report) is the least precise part** relative to its
  verification fixture (R1-2). Where the doc is exact (probe numbers) it is exact; where it is
  algorithmic it leans on buildModel by analogy without acknowledging buildModel is the wrong
  tool.

## Guidance for Next Review

- Confirm whether v2 adds: (a) the copy-into-dist step + dev/test resolution base for
  `agent-profiles.json`; (b) an explicit usage-report summation + spawn-identity rule handling
  the double-`spawn.end` fixture and the both-carry-tokens case; (c) render row re-budget.
- Do NOT re-probe the ledger numbers — they are verified accurate (question-gates 1,963,320;
  buildModel 1,185,572; review-gate 6,324,447; analyst rows 01:10:28 no-tokens / 01:10:49
  45,675). Re-raise only with new evidence.
- Fresh lens already spent this round: wire contracts. Next round pick a different lens
  (e.g., testability of every acceptance criterion, or failure-mode/degradation paths).
- Watch for scope drift into specs 9/10 (per-run effort, per-role provider) — currently clean.
