# Adversarial Review Memory — tasks

Last updated: 2026-10-22 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Eval CLI `gate` subcommand argument handling is untested. Task 10 covers run + select only; the deploy calls `dist/evals/cli.js gate` (Component 10 change 4) but task 14 stubs the CLI and task 9 tests `runGate` directly, so no automated test exercises the gate dispatch. Contradicts D4's "export main to test argument handling". Fix: add a gate test + Success clause to task 10.
- **R1-2 (MINOR)** — Missing dependency edge 6→5. `render.ts` imports the `Fixture` type from task 5; the dependency paragraph lists only "6 need[s] 4". Harmless under numeric order.
- **R1-3 (MINOR)** — Task 13 says add the `Eval case:` line "after `Prerequisites:` … in the role file", but `sdd-retro-analyst.md` has no literal `Prerequisites:` line (only prose at :18). Anchor exists only in the proposal-format block (`brief-templates.ts:1389`).

## Patterns & Themes
- The document is citation-accurate: every path/range/signature/behaviour verified against code at both ends; zero misstated artifacts. Do not re-verify these next round unless a fix touches them.
- Coverage is complete: all R1–R7 ACs map to tasks and back; Success-clause coverage holds; all `- Test:` calls resolve. The lint-pass deltas are cosmetic.
- The recurring weak spot is the **CLI↔deploy seam**: the gate runs through the CLI in production but every surrounding test either stubs the CLI (task 14) or bypasses it (task 9). Watch any revision that claims the gate is "tested".
- A requirements(R6 AC1 "a brief template")-vs-design(Component 11 "server code, docs or templates") trigger-scope widening exists but is a closed prior-phase matter; the task cites Component 11, which is explicit — not re-raising.

## Guidance for Next Review
- If the reviser added a gate test to task 10, scope the re-check to that diff vs R1-1 (fix-induced re-check), not a full re-review.
- Re-confirm only citations any fix commit changed.
- Fresh lens not yet used: a timing/stub-fidelity lens on the runner (does the stub-claude seam faithfully model `runStep`'s snapshot/scratch-wipe ordering under node 20?).
- Rejected-finding guard: nothing rejected yet.
