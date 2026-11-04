# Requirements Document — eval-gate-runs

## Introduction

The deploy eval gate runs every selected case 3 times, even when a change reaches the case only through its role file, profile or brief. This spec sets the run count of each selected case from the reasons that selected it: 3 runs for a `case` or `grader` reason, 1 run for the rest. It is for the operator, and it changes the gate's run count, its reporting and the dry-run plan, not which cases it selects.

## Alignment with Product Vision

The steering directory holds no `product.md`, so this section aligns with the operator's decision of 2026-11-04 in decomposition entry 35. That decision puts tokens first: the deploy of PR #202 ran 27 sequential agent runs in 62 minutes for 14.8M tokens. The same selection uses 19 runs under this spec, and the gate still blocks a deploy on any failed run.

## Requirements

### Requirement 1 — the run count of a selected case

**User Story:** As the operator, I want a case that a change reaches only indirectly to run once, so that a deploy spends tokens in proportion to how directly the change touches the case.

#### Acceptance Criteria

1. WHEN the gate selects a case whose reasons are all `role` (`src/evals/select.ts:188`), `profile` (`src/evals/select.ts:190`) or brief reasons THEN the gate SHALL run that case exactly 1 time. The brief reasons are `brief <template>`, `brief source` and `brief: base render unavailable` (`src/evals/select.ts:131`, `src/evals/select.ts:153`, `src/evals/select.ts:200`).
2. WHEN one gate selects a case with a `case` reason (`src/evals/select.ts:184`) and a case with only a `role` reason (`src/evals/select.ts:188`) THEN the gate SHALL make 3 step calls for the first case and 1 step call for the second. `RunGateOpts.step` is the seam (`src/evals/gate.ts:17`).
3. WHEN the gate selects a case with a `case` reason or a `grader <name>` reason, alone or with any other reason, THEN the gate SHALL run that case 3 times. **Invariant (verified, not red-first):** every gate case runs 3 times at base (`src/evals/gate.ts:56-58`, `src/evals/runner.ts:144`).
4. The reason-to-count rule SHALL have one definition, which both the gate and the `select` command use.
5. WHEN `selectCases` runs on any range THEN it SHALL return the same case ids, reasons and `provisional` values as at base. **Invariant (verified, not red-first):** `src/evals/__tests__/select.test.ts:155-159` and its sibling assertions.
6. WHEN a direct run of named cases, or of every case, starts THEN each case SHALL run 3 times. **Invariant (verified, not red-first):** `src/evals/cli.ts:137-142` passes no run count.
7. WHEN a caller of `runCases` passes the uniform `runs` number THEN every case in that call SHALL run that many times. **Invariant (verified, not red-first):** `src/evals/__tests__/runner.test.ts:242`.

### Requirement 2 — the verdict and the block

**User Story:** As the operator, I want a single run to block a deploy the way 3 runs do, so that fewer runs do not weaken what a failure means.

#### Acceptance Criteria

1. WHEN the single run of a 1-run case fails THEN the gate SHALL make no further step call for that case and SHALL exit 1.
2. WHEN the single run of a 1-run case is inconclusive THEN the case verdict SHALL be `inconclusive` and the gate SHALL exit 1, with no further step call for that case.
3. A case SHALL pass only when all of its runs pass. **Invariant (verified, not red-first):** `src/evals/runner.ts:246-250`.
4. WHEN a case with 3 planned runs fails a run THEN the remaining runs of that case SHALL still run. **Invariant (verified, not red-first):** `src/evals/runner.ts:165-243`.
5. WHEN the gate exits non-zero THEN the self-update SHALL leave `dist/` unchanged and write an `error` wait that names the failing case. **Invariant (verified, not red-first):** `scripts/sdd-self-update.sh:252-258`, `src/__tests__/service-scripts.test.ts:382-406`.

### Requirement 3 — stating the real run count

**User Story:** As the operator, I want every gate report to state how many runs a case really had, so that I can tell `pass 1/1` from `pass 3/3` when I judge a deploy.

#### Acceptance Criteria

1. WHEN the gate finishes a case THEN it SHALL print the runner's case line to stdout: `eval <id>: <verdict> <passed>/<runs>, <tokens> tokens`, for example `eval demo: pass 1/1, 42 tokens`. At base the gate passes no `onLine` (`src/evals/gate.ts:56-58`), so it prints no case line. The line format itself does not change (`src/evals/runner.ts:253-254`).
2. WHEN the gate exits 1 THEN each failing case in the summary line SHALL read `<id> <verdict> <passed>/<runs> <first reason>`, for example `demo fail 0/1 <first reason>`. The line keeps its `<target 12>: ` start and its `; record <path>` end (`src/evals/gate.ts:76-77`). This change alters the exact assertion at `src/evals/__tests__/gate.test.ts:369-371`.
3. WHEN a gate writes a result record THEN each case's `runs` array SHALL hold one entry per real run: 3 entries for a 3-run case and 1 entry for a 1-run case.
4. The result record SHALL keep `v: 1` and gain no field. **Invariant (verified, not red-first):** no code outside `src/evals/` reads a record, and inside it only `src/evals/gate.ts:66-81` reads the returned verdicts and `firstReason` reads run reasons (`src/evals/gate.ts:25-30`); neither assumes 3 runs.
5. WHEN an override passes a failed 1-run case THEN the gate SHALL exit 0 and the deferral's revisit criteria SHALL read `case <id> passes 1/1`. The number comes from the case's real run count, replacing the fixed text at `src/evals/gate.ts:96`.
6. WHEN an override passes a failed 3-run case THEN the deferral's revisit criteria SHALL read `case <id> passes 3/3`. **Invariant (verified, not red-first):** `src/evals/__tests__/gate.test.ts:440`.
7. The gate SHALL keep its override checks and their exit codes. **Invariant (verified, not red-first):** `src/evals/gate.ts:45-49`, `src/evals/gate.ts:66-72`.

### Requirement 4 — the planned count before a deploy

**User Story:** As the operator, I want the dry run to show the planned runs, so that I know what a deploy will cost before I start it.

#### Acceptance Criteria

1. WHEN `select` prints a selected case THEN the line SHALL end with its planned count: `select <id>: <reasons>: 3 runs`, or `select <id>: <reasons> (provisional): 1 run`. The existing text stays a prefix of the line, so the `toContain` at `src/evals/__tests__/cli.test.ts:283` still holds.
2. WHEN `select` finishes THEN it SHALL print one total line after the case lines: `select: <cases> cases, <runs> runs`, with the singular word for a count of 1. It SHALL print this line for an empty selection too, as `select: 0 cases, 0 runs`.
3. WHEN any selected case is provisional THEN the total line SHALL end with ` (provisional)`.
4. WHEN selection is provisional THEN each case's count SHALL come from the same rule as the gate's. The `case`, `role`, `profile` and `grader` reasons are the same in both modes (`src/evals/select.ts:184-195`), so a case that stays selected keeps its count. Only the membership of brief-only cases, and so the total, is provisional.
5. WHEN exact `select` and the gate run on the same range and base build THEN the count `select` prints for each case SHALL equal the gate's step calls for that case.
6. WHEN `sdd-self-update.sh --dry-run` runs on a range with both kinds of case and the live build has the eval runner THEN it SHALL print the per-case counts and the total, run no step, exit 0 and change nothing. The dry run uses the live `dist/evals/cli.js` (`scripts/sdd-self-update.sh:232-234`).
7. WHEN the live build has no eval runner THEN the dry run SHALL print `eval selection unavailable`. **Invariant (verified, not red-first):** `src/__tests__/service-scripts.test.ts:264`.

### Requirement 5 — the harness documentation

**User Story:** As a reader of the harness docs, I want them to state the per-case count, so that they do not promise 3 runs on every gate.

#### Acceptance Criteria

1. `docs/SDD-HARNESS.md` SHALL state the gate's reason-to-count rule, and that a direct run stays at 3 runs (`docs/SDD-HARNESS.md:510-511`, `docs/SDD-HARNESS.md:537-539`).
2. `docs/SDD-HARNESS.md` SHALL state that the dry run prints the planned counts and the total, and that it uses the live build, not the staged one (`docs/SDD-HARNESS.md:504-506`).
3. `docs/SDD-HARNESS.md` SHALL state that the `error` wait gives each failing case's run count (`docs/SDD-HARNESS.md:492-494`).

## Non-Functional Requirements

### Performance
- A gate with `a` cases that hold a `case` or `grader` reason and `b` other cases SHALL make `3a + b` step calls. On the selection of PR #202 that is 19, down from 27.
- Runs stay sequential; this spec adds no parallel runs.

### Reliability
- The gate runs from the staged build (`scripts/sdd-self-update.sh:239-248`), so the deploy that ships this spec already uses the new counts. The dry run before that deploy uses the old live build and prints no counts.

## Decisions taken in this document

- D1 — A 3-run case keeps its remaining runs after a failed run: options were keep today's behaviour, stop the case at its first failed run; chosen because the entry changes the count rule only and the operator did not ask for an early stop.
- D2 — The failure summary states each failing case's run count: options were add the count to the summary, leave the summary as it is and print the count on stdout only; chosen because the error wait is what the operator reads, while deploy stdout goes to a log file.
- D3 — A base render failure counts as a brief reason and gives 1 run: options were 1 run, 3 runs; chosen because the entry gives 1 run to every case selected only by brief reasons, although this reason selects every case and proves no change.
- D4 — Provisional selection states a count for each case and marks the total provisional: options were state the count and mark the total, omit the count for provisional cases, print a range; chosen because a case's count does not depend on whether its brief reason is exact.
- D5 — The result record keeps its shape and version: options were keep the shape, add a planned-runs field, raise the version; chosen because the length of the runs list already is the real count and no reader assumes 3.
- D6 — The planned count goes at the end of the select line, with a separate total line: options were append to the line, put the count before the reasons, print a table; chosen because the existing text stays a prefix.
- D7 — The total line prints for an empty selection too: options were always print it, print it only when a case is selected; chosen because a dry run should say that a deploy costs no runs.

## Scope notes

- Cut or deferred from the entry: none.
- Added to the entry: Requirement 5, because the docs state 3 runs and the entry's list omits them. The entry's "gate output" is read as both stdout and the failure summary (D2).
- The entry's list names `scripts/sdd-self-update.sh`, but Requirement 4 may need no script edit, because the script already prints what `select` prints. Design decides.
- Unchanged, on purpose: `docs/ai-resources-catalogue.md:175-176` records a past grill decision, not current behaviour.
- Known consequence, not fixed here: a single-run failure can be a flake. A later deploy with an override on that case refuses with exit 2 if the case then passes, and it refuses after the runs (`src/evals/gate.ts:66-72`). The operator then deploys again with no override.
- Carried from the decomposition: none.

## Revision History

- **v1** (2026-11-04) — Initial draft.
  - **Lint pass.** 6 fixed; rejected: none.
