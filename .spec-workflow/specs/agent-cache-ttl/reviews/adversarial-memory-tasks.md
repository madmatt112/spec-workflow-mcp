# Adversarial Review Memory — tasks

Last updated: 2026-09-24 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MINOR)** — Task 1 prompt says the loader "drops the extra key" as the reason both
  `agent-profiles.test.ts` and `ledger.test.ts` stay green. That rationale only fits
  `ledger.test.ts` (which loads via `loadAgentProfiles`). `agent-profiles.test.ts` reads
  `harness/agent-profiles.json` directly and stays green by round-trip serialisation +
  agent-count checks. Outcome correct; wording conflates two tests. No rework.
- **R1-2 (MINOR)** — Task 8 identifies task 6's script only by "read its name in
  `harness/skills/sdd-continue/references/`", a directory holding several `.sh` files.
  Disambiguation rests on the filename's meaning (`sdd-cache-ttl.sh`), not a citation.

## Patterns & Themes

- The v1 lint pass was almost entirely path-prefix normalisation plus four "bridge" sentences
  (task 1↔3 AgentProfile, task 7↔8 evidence file). All delta citations verified accurate
  against real code; no misstated artifact.
- The three re-decided design literals (render pad 23-not-24, keyless-profile case in the
  loader test, recompute `~/.claude/projects` fallback) are all REFINEMENTS — the drafter
  corrected a design-C3 pad that violated Req 2.3, and followed design-review R1-1. None widen
  scope. Do not re-open.
- Ordering is the load-bearing property and it holds: task 1 (all `default`, loader drops key)
  → task 2 (1h on 3 orchestrators, loader still drops) → task 3 (AgentProfile+loader keep key,
  watch assertions flip once). Verified each test stays green at each step.
- Coverage is complete: C1-C8 → tasks, every requirement criterion allocated, all six
  scenarios placed. The only test gap (Req 3.7 no-timestamp case) is inherited from approved
  requirements, not a tasks-phase defect.
- Gate B (new external dep) and Gate C (over-reach) both empty.

## Guidance for Next Review

- If a v2 lands, re-verify only the citations v2 changes; the whole codebase-mapped set here
  was confirmed accurate at v1.
- Do not re-raise the render-pad, keyless-profile-case, or recompute-fallback rulings; closed
  as refinements.
- Watch task 5 (largest, ~20 assertion edits + 9 new cases) and task 7 (kit + recompute +
  evidence, one task) if either is re-decomposed — atomicity was judged acceptable, not ideal.
- Task 4 touches `harness/hooks/` (sensitive path). No security/data-loss concern found;
  ESCALATE stayed none. Keep an eye on it if the hook body's dedupe/timestamp logic is reworked.
- Fresh lenses used so far: single-task-prompt isolation (R1). Unused: failure-mode/rollback,
  concurrency of two tasks editing the same file (task 4 and task 8 both edit `formats.md` —
  checked, different rows, no conflict).
```
