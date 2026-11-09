# Adversarial Review Memory — tasks

Last updated: 2026-11-08 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 [drafting] SHOULD_FIX** — Task 7 Success lost its only `riskFromLedger` prefix-boundary
  sub-case. The lint pass changed the illustrative ledger id from `gate: task 12` to
  `gate: task 2`; `task 2` never prefix-collides with `task 1`, so the design C5 regex boundary
  (`^gate: task <id> \S+ risk …`, the space after `<id>`) is no longer exercised. Restore a
  colliding example (task `1` vs `gate: task 12`) and fix the citation-identifier lint skip-regex
  so quoted ledger text is not read as a forward task reference.
- MINOR — gate-A "Recorded without asking" layout (R5 AC 3) rendered but not e2e-exercised (e2e
  seeds only a gate-B wait).
- MINOR — `ruling-abandon` click→`abandon`→cancel (R6 AC 9) never asserted end-to-end.
- MINOR — "risk not scored yet" display string (R3 AC 3) untested (no e2e fixture lacks a gate
  note).

## Patterns & Themes

- The document is tightly cited; every delta citation re-verified clean against the tree, and
  every requirement AC (1.1–6.14) maps to a task. The design carries the heavy correctness
  burden; the tasks mostly transcribe it faithfully.
- The recurring risk vector here is **lint cosmetics that quietly weaken a test's discriminating
  power** (R1-1). Watch future lint-pass deltas for example/id/value substitutions that trade a
  distinct sub-case for a trivial one.
- File-scope gates are satisfied: the `AnswerSheet` scrub (task 11) and the cited-module/File
  rules all hold; no file-outside-list stall.

## Guidance for Next Review

- R1-1 is the only loop-keeping item. On the next version, confirm the task-7 Success example
  again exercises the `task 1` vs `task 1X` boundary (not a different single digit), and check
  whether the lint skip-regex was graduated rather than the test re-weakened.
- Do not re-raise the three MINORs as blockers; note them only if the reviser's disposition
  introduces a regression.
- Closed/stable, do not re-open: D2 (task 6 no Test seam, L-4 rejection), D5 (gate-tool stop no
  case), D4 (view/retention split). The never-logged-vs-gate-tool `ev.report` placement is
  correctly disambiguated by task 3's "no detail" guard — do not flag it.
- Atomicity of task 11 was considered and accepted (frontend has no tsc/vitest seam; D4 already
  bounds it). Re-raise only with concrete evidence the task stalls.
