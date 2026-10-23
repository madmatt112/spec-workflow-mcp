# Adversarial Review Memory — tasks

Last updated: 2026-10-22 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — CLI `gate` subcommand argument handling was untested. v2 added a `gate` test to task 10 (`cli.test.ts`): stub claude on a two-commit temp repo, a failing overridden case exits 0 + one `overrides.log` line, a bad `--override` exits 2 before any spawn, with matching Success clause. Verified accurate in round 2.
- **R1-2 (MINOR, v1)** — Missing dependency edge 6→5. v2 dependency paragraph now states 6 needs the `Fixture` type of 5 (`renderCaseBriefs(c, f: Fixture, …)`). Verified vs design Component 3.
- **R1-3 (MINOR, v1)** — Task 13 role-file anchor: `sdd-retro-analyst.md` has no literal `Prerequisites:` line. v2 now extends the proposal-fields sentence at `:18` for the role file, keeps "after Prerequisites" only for the proposal format (`brief-templates.ts:1389`). Verified both ends.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- (none)

## Patterns & Themes
- Document is citation-accurate across both v1 and v2; zero misstated artifacts in either round. The v2 fix commit changed no code citation — only task-10 prose, the dependency edge, and the task-13 anchor — all verified.
- Coverage (R1–R7 AC↔task), Success-clause coverage (retro P7), and `- Test:` resolution all complete and unchanged by v2.
- The CLI↔deploy gate seam (R1-1) is now closed: task 10 tests `main(argv)` gate dispatch; task 9 tests `runGate`; task 14 tests the shell forwarding `--eval-override`→`--override`. The three layers together cover the production path end to end.
- `src/evals/` correctly does not exist at base — these tasks create it; absence is expected, not a miss.

## Guidance for Next Review
- This review converged (0/0/0). If a human revision reopens the doc, re-verify only the touched anchors; do not re-walk the clean surface.
- Areas well-covered, skip unless a fix touches them: all citations (both ends read), AC↔task coverage, Success-clause coverage, `- Test:` resolution, Gate B/C, grader split (tasks 2–3), snapshot carve-out (D3), env/`SDD_RUN_ID` handling.
- Residual non-defects for the operator, not the doc: the model-dependent 3/3 bar on `drafter-test-seam-label` (R5 AC3) on the landing deploy; the implicit "case must be selected" setup in task 10's gate test (recoverable from tasks 8/9's idiom).
- Rejected-finding guard: nothing rejected in any round.
