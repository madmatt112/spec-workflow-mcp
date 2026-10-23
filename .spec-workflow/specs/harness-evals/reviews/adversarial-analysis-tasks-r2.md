# Adversarial Analysis — harness-evals/tasks (v2, round 2)

Attack surface: **atomicity, ordering, coverage**. Fresh lens applied: runner stub-fidelity / env + the CLI↔gate seam (memory's suggested lens). Deltas attacked first.

## v2 deltas attacked (Revision History v2: R1-1, R1-2, R1-3 all Accepted)

The v2 commit touched exactly three spots. Each verified against code and the approved design; all three are accurate and coherent.

### Delta 1 — Task 10 gate test (R1-1 fix, fix-induced re-check)
New `_Prompt`/`Success` text adds a `gate` subcommand test to `cli.test.ts`:
`gate --repo … --base … --target … --base-dist … --summary-file …` through the stub claude — a failing case named by one `--override` exits 0 + one `overrides.log` line; a `--override` naming no selected case exits 2 before any spawn.
- Scoped the re-check to this diff vs R1-1 (not a re-review). It closes exactly the gap R1-1 named: the production path is `dist/evals/cli.js gate` (design Component 10 change 4, line 133 of the diff; design.md:124,133), task 9 tests `runGate` directly, task 14 stubs the CLI — so the CLI's `gate` flag-parse + exit-code forwarding had no test. It now does, through `main(argv)` (the `- Test:` seam), asserting exit code + `overrides.log` line, both readable from the temp `SDD_HOME`.
- Consistency with task 9 (design Component 8 post-conditions 1,5, design.md:113,117): "exits 2 before any spawn" and "exit 0 + one override log line" match post-conditions 1 and 5 verbatim. No contradiction.
- Success-clause coverage (retro P7): all three `Task:`-body gate tests reappear in the `Success:` clause. Holds.
- Flag set matches Component 9 gate signature (`--repo/--base/--target/--base-dist/--summary-file/--override`, design.md:124). No new flag — Gate B/C clean.

### Delta 2 — dependency paragraph edge 6→5 (R1-2 fix)
Now reads "5 and 6 need 4, and 6 also needs the `Fixture` type of 5 (`renderCaseBriefs(c, f: Fixture, …)`)". Verified against design Component 3 interface `renderCaseBriefs(c: EvalCase, f: Fixture, scratch: string, handler?)` (design.md:53) and task 6's `- Test:` line `renderCaseBriefs(c, f, scratch, handler)`. The `Fixture` type is Component 2 / task 5 (design.md:41,188). Edge is accurate; harmless under numeric order 5<6.

### Delta 3 — task 13 role-file anchor (R1-3 fix)
Now: "add the `Eval case:` line after `Prerequisites:` in the proposal format, extend the proposal-fields sentence at `harness/agents/sdd-retro-analyst.md:18` to name `eval case` (the role file has no literal `Prerequisites:` line)". Verified both ends:
- `brief-templates.ts:1389` is a literal `Prerequisites: <none | list>.` line inside the proposal-format block (`:1381` heading) — the `Eval case:` line lands after it. Matches design Component 11 (design.md:141).
- `sdd-retro-analyst.md:18` is the prose sentence "One proposal per finding … with the target surface, effort, risk, prerequisites, and `DECISION NEEDED` …" — no literal `Prerequisites:` line, exactly as the fix states. Anchor is correct.

## Fresh-lens pass (runner stub-fidelity / env; CLI↔gate seam)

- The runner never deletes `SDD_RUN_ID`; design puts that on the CLI (design.md:95). Task 7's "stub env has no `SDD_RUN_ID`" passes because the vitest env sets none; task 10's "a run with `SDD_RUN_ID` set leaves it unset" is the test that actually exercises the CLI deletion. The two assertions are complementary, not redundant — pre-existing, unchanged, no defect.
- CLI gate → deferral store: the overridden-failure path creates an `owner: harness` deferral in `repo`'s store (design.md:117; R4 AC3). Task 10 asserts only the exit code + `overrides.log` line, not the deferral (task 9 owns that), so no new cross-store assertion is introduced. Isolation rests on `runGate` scoping the store to `opts.repo`, a design contract task 9 already tests.
- Snapshot carve-out ordering (D3, design.md:93): task 7's "tracked edit fails, `.spec-workflow/` edit does not" matches the filtered-status rule. Assertable through the stub. No defect.

## What I re-verified vs round 1

Round 1 established full citation accuracy, complete R1–R7 AC↔task coverage, Success-clause coverage, and all `- Test:` resolution. The v2 commit changed no code citation (only task 10's prose, the dependency edge, and the task-13 anchor), so per the standing directive I re-confirmed only the fix-touched anchors above and did not re-walk the clean surface.

## Findings

None. All three round-1 findings are dispositioned in v2 (R1-1 Accepted SHOULD_FIX; R1-2, R1-3 Accepted MINOR) and the fixes are accurate. No novel or compounding defect in the deltas; the fresh lens surfaced no new gap.

## Top risks/gaps
1. **(carried, non-defect)** `drafter-test-seam-label`'s 3/3 bar (R5 AC3) is the one model-dependent required pass; it is requirements-approved and belongs to the operator's eye on the landing deploy, not a tasks fix.
2. Task 10's gate test needs the case to be *selected* (new case dir between the two commits) for `--override` to reach exit 0 rather than the unselected-case exit 2; the `_Prompt` leaves that implicit, but tasks 8 and 9 establish the identical "two-commit temp repo holding a case" idiom, so it is recoverable — not worth a MINOR.
3. Nothing else: coverage, atomicity and ordering hold; Gate B and Gate C are clean.

## Top conclusions to challenge — none reverse
1. "The v2 fixes resolve R1-1/-2/-3 accurately." Challenged and upheld — verified each at code + design.
2. "The CLI gate path is now tested." Upheld — `main(argv)` now parses and forwards `gate`, closing the production-path gap.

## What's missing before acting
- Nothing. The three fixes are accurate, coverage is complete, citations hold. Proceed to implementation.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
