# Adversarial Review Memory — tasks

Last updated: 2026-09-27 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none — reviewer raised no MUST_FIX/SHOULD_FIX)

### Unresolved
- **R1-1 (MINOR)** — Task 11 cites the spec-status review-coverage loop as `spec-status.ts:184-191`;
  the loop header is line 183 (body 184-191). Off-by-one on the start.
- **R1-2 (MINOR)** — Task 1 action line "move the documentation-path test" implies an existing
  direct `isDocPath` test; there is none (private fn, exercised only by `review-gate.test.ts:350`).
  The `_Prompt` correctly says *add* cases to `gate-rules.test.ts`. Wording only.

## Patterns & Themes

- The document is exceptionally well-grounded: ~45 code citations verified at both ends, all
  accurate; no misstated artifact found.
- Coverage is complete (13 design Components → tasks; every R1–R9 AC → a citing task; all
  requirement ids real). Machine lint (`coverage-component`, `task-requirement-id`) also passed.
- Ordering is clean: every inter-task dependency points backward and is named in the prompt, so
  D3's "no bridge" claim holds; no import cycle.
- "No existing assertion changes value" claims are the highest-risk surface and were all confirmed
  true against the real tests: `spec-lint.test.ts:107` compares to the `CHECKS_BY_PHASE.tasks`
  constant; `spec-lint.e2e` fixtures carry no `File:`/`Test:` line so `task-test-seam` fires
  nothing; `harness.test.ts:272` graph-suffix holds with an empty `redTests` slot;
  `task-review-manager.test.ts:197` `review-` prefix never sees the `.tdd-` sidecar.
- Non-exhaustive assertion lists are explicitly hedged ("widen that list to every assertion the
  change touches"), defusing the exhaustive-list trap.
- Gate B/C clean: T8 adds no dependency (asserts package.json unchanged; `npm pack` is read-only);
  no over-scope.
- Lint L-1..L-39 are the known `citation-identifier` false-positive class (deferral d-53b7f443);
  do not re-file. Prompt tokens naming real symbols each sit beside a range that contains them.

## Guidance for Next Review

- If a later round reopens, the value-preserving surfaces to re-probe with fresh code are:
  T9's `handleGate` integration tests (the largest change; confirm the widened assertion list once
  written) and T12's dashboard route tests. Both were verified at the citation level here, not at
  the written-test level (the tests do not exist yet).
- Do not re-litigate coverage, ordering, or the L-1..L-39 lint class — all closed this round.
- R1-1 and R1-2 are MINOR wording/line nits; they do not gate implementation. Confirm they were
  either fixed or consciously left before treating the doc as final.
