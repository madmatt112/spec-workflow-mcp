# Tasks Document

Document version: v1

Dependency order: 1 → 2 → 3 → 4 → 5 → 6. Tasks 1 and 2 add the rule and the runner option with no caller, task 3 applies them in the gate, task 4 reports them from the CLI, task 5 guards the deploy script's output, and task 6 updates the docs. Each task leaves `npx tsc --noEmit` and every existing suite green, and no file is edited by two tasks, so every line citation below stays valid. No task touches a sensitive path or creates a module; task 4 edits `src/evals/cli.ts`, so `isWiringTask` routes it a verifier (`src/controller/phases/implementation.ts:266-272`, `src/controller/phases/implementation.ts:850`).

- [ ] 1. Add the reason-to-count rule to the selection module
  - File: src/evals/select.ts
  - File: src/evals/__tests__/select.test.ts
  - Test: src/evals/__tests__/select.test.ts — `plannedRuns(reasons)`
  - Note: requirement 1.5 holds at base: regression guard, not a red test. The `selectCases` tests (`src/evals/__tests__/select.test.ts:158` and its siblings) pass unchanged; no value they assert changes.
  - Purpose: One definition of the count, beside the reason strings it reads.
  - _Leverage: src/evals/select.ts:131, src/evals/select.ts:153, src/evals/select.ts:184-200_
  - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - _Prompt: Task: Per design Component 1 and requirement 1 AC 1, AC 3 and AC 4, export `plannedRuns(reasons: string[]): 1 | 3` from `src/evals/select.ts`. It returns 1 when every reason equals `role` or `profile` or starts with `brief`, and 3 otherwise, so a reason it does not know gives 3 (design D2). Add a `describe` block to `select.test.ts` | Restrictions: Leave `selectCases`, `SelectedCase` and the reason strings as they are; add no file | Success: `plannedRuns` returns 1 for each of `['role']`, `['profile']`, `['brief source']`, `['brief test-author']` and `['brief: base render unavailable']`, and for the mix `['role', 'profile', 'brief source']`; it returns 3 for `['case']`, `['grader x']`, `['case', 'role']`, `['grader x', 'brief source']`, `['unknown']` and `['unknown', 'role']`; the existing `selectCases` tests pass unchanged (regression guard, requirement 1.5); `npx tsc --noEmit` and `npx vitest run src/evals/__tests__/select.test.ts` pass_

- [ ] 2. Add the per-case run count to the runner
  - File: src/evals/runner.ts
  - File: src/evals/__tests__/runner.test.ts
  - Test: src/evals/__tests__/runner.test.ts — `runCases(ids, { ...opts, runsByCase, step })`
  - Note: requirements 1.6, 1.7, 2.3, 2.4 and 3.4 hold at base: regression guards, not red tests. `src/evals/__tests__/runner.test.ts:200` and the `runs: 1` callers (at least :242 and :271) pass unchanged; no value they assert changes.
  - Purpose: Run each case the number of times its caller states, with the uniform option intact.
  - _Leverage: src/evals/runner.ts:42-49, src/evals/runner.ts:144, src/evals/runner.ts:160-165, src/evals/__tests__/runner.test.ts:378-394_
  - _Requirements: 1.6, 1.7, 2.3, 2.4, 3.3, 3.4_
  - _Prompt: Task: Per design Component 2, add the optional `runsByCase?: ReadonlyMap<string, number>` to `RunCasesOpts` (`src/evals/runner.ts:42-49`). Resolve the count per case inside the loop at `src/evals/runner.ts:160`: the map's value, else `opts.runs ?? 3`, replacing the single value at `src/evals/runner.ts:144`. Change the doc comment at `src/evals/runner.ts:137-140` so it no longer says 3 times. Use a stub `step` of the shape at `src/evals/__tests__/runner.test.ts:378-394` | Restrictions: `runCases` keeps its signature; leave the verdict rule (`src/evals/runner.ts:246-250`), the run loop that continues after a failed run, the case line and `v: 1` as they are | Success: One call with a map of 3 for one case and 1 for another gives records with 3 and 1 `runs` entries, and `onLine` lines holding `pass 3/3` and `pass 1/1`; a case absent from the map takes `runs` when `runs` is set; a case absent from the map with no `runs` takes 3; the record keeps `v: 1` (regression guard, requirement 3.4); `src/evals/__tests__/runner.test.ts:200` and the `runs: 1` tests pass unchanged (regression guards, requirements 1.6 and 1.7); `npx tsc --noEmit` and `npx vitest run src/evals/__tests__/runner.test.ts` pass_

- [ ] 3. Apply the rule in the gate and state real counts
  - File: src/evals/gate.ts
  - File: src/evals/__tests__/gate.test.ts
  - Test: src/evals/__tests__/gate.test.ts — `runGate(opts)`
  - Note: this changes one asserted value: `src/evals/__tests__/gate.test.ts:369-371` becomes `fail-case fail 0/3` plus the reason, and the comment at :337-338 follows. That list is an illustrative minimum: widen it with `grep -n "fail-case\|3/3" src/evals/__tests__/gate.test.ts`. The value at :440 does not change.
  - Note: requirements 1.3, 3.6 and 3.7, and the step count of requirement 2.4, hold at base: regression guards. Every existing step-running test selects a case new at `target`, so it keeps 3 runs and its 3-entry stub script.
  - Purpose: The gate spends fewer runs and reports what really ran.
  - _Leverage: src/evals/gate.ts:56-58, src/evals/gate.ts:76, src/evals/gate.ts:96, src/evals/__tests__/gate.test.ts:87-110, src/evals/__tests__/gate.test.ts:160-174_
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, NFR Performance_
  - _Prompt: Task: Per design Component 3, add the optional trailing `onLine?: RunCasesOpts['onLine']` to `RunGateOpts`. At `src/evals/gate.ts:56-58` build a per-case map from `selected` with the rule task 1 exports, and pass it through the option task 2 adds, with `opts.onLine` (requirement 1 AC 1 to AC 3, requirement 3 AC 1). Make each summary part at `src/evals/gate.ts:76` read `<id> <verdict> <passed>/<runs> <first reason>`, where `<passed>` counts runs with verdict `pass` and `<runs>` is `c.runs.length` (requirement 3 AC 2). Make `revisitCriteria` at `src/evals/gate.ts:96` read `case <id> passes <n>/<n>`, with `n` equal to `c.runs.length` (requirement 3 AC 5, design D8). Build the two-case fixture as design Testing Strategy states: `old-case` from `writeDeterministicCase` at `base` with the role file, `target` edits the role file and adds `new-case`, and `writeMatchingBaseDist` holds `old-case`'s text. A stub `step` counts calls by the case id in `logPath` | Restrictions: Keep the override checks and exit codes (`src/evals/gate.ts:45-49`, `src/evals/gate.ts:66-72`), the exit-1 guard (`src/evals/gate.ts:74`), `revisitTrigger`, the deferral context, the `overrides.log` line and `RunGateResult`; add no retry; leave `src/evals/cli.ts` as it is | Success: A gate over `new-case` and `old-case` (reason `role` only) makes 3 step calls for `new-case` and 1 for `old-case`; that run's record holds 3 and 1 `runs` entries, and `onLine` gets lines holding `pass 3/3` and `pass 1/1`; a failing grader on the 1-run case with no override gives exit 1, 1 step call and a summary holding `fail 0/1`; a stub `step` classified `usage-limit` on the 1-run case gives exit 1 and a summary holding `inconclusive 0/1`; an override of the failed 1-run case gives exit 0 and `revisitCriteria` of `case <id> passes 1/1`; a 3-run case that fails only its first run makes 3 step calls (regression guard, requirement 2.4) and its summary reads `fail 2/3`; the summary keeps its `<target 12>: ` start and `; record <path>` end, with the test at :369-371 reading `fail-case fail 0/3`; `passes 3/3` at :440 holds (regression guard, requirement 3.6); the override refusal tests pass unchanged (regression guard, requirement 3.7); `npx tsc --noEmit` and `npx vitest run src/evals/__tests__/gate.test.ts` pass_

- [ ] 4. Print the gate's case lines and the planned counts from the CLI
  - File: src/evals/cli.ts
  - File: src/evals/__tests__/cli.test.ts
  - Test: src/evals/__tests__/cli.test.ts — `main(argv, opts)`
  - Note: `src/evals/__tests__/cli.test.ts:283` (a `toContain` on the prefix) and :318 hold; no value they assert changes. Requirement 1.6 holds at base: regression guard.
  - Note: run `npm run build` before this test file. The existing test at :346-372 forwards to the built `dist/tools/harness.js` and fails on an unbuilt tree (probe 2026-11-04: exit 0, expected 2). `dist/` is ignored, so the build stays in the worktree for the gate's head run.
  - Purpose: The operator sees real and planned counts on stdout.
  - _Leverage: src/evals/cli.ts:141, src/evals/cli.ts:151-169, src/evals/cli.ts:171-187, src/evals/__tests__/cli.test.ts:76-92, src/evals/__tests__/cli.test.ts:122-150, src/evals/__tests__/cli.test.ts:175-187_
  - _Requirements: 1.6, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Prompt: Task: Per design Component 4, make `runGateCommand` (`src/evals/cli.ts:171-187`) set the line callback task 3 adds, printing with `console.log` as `runRun` does at `src/evals/cli.ts:141` (requirement 3 AC 1). In `runSelect`, append `: <n> run` or `: <n> runs` to the line at `src/evals/cli.ts:165`, after any ` (provisional)` marker, with `n` from the rule task 1 exports (requirement 4 AC 1). After the case lines, always print one total line in the grammar under design Data Models, for an empty selection too (requirement 4 AC 2, AC 3). Build the count-line fixtures with `select --provisional`, which needs no base build, and build the equality fixture with no `--base-dist` | Restrictions: No new flag; `USAGE`, the parsers, the exit codes and `runRun` stay as they are; new tests do not use `writeMatchingBaseDist` | Success: A provisional select over a role edit and an added case prints `select cli-demo: role: 1 run`, the added case's line ending `: 3 runs`, and `select: 2 cases, 4 runs`; a brief-source edit with one case prints `select cli-demo: brief source (provisional): 1 run` and `select: 1 case, 1 run (provisional)`; a brief-source edit with an added case prints a line ending `(provisional): 3 runs` and `select: 2 cases, 4 runs (provisional)`; a role edit with one case prints `select: 1 case, 1 run` with no marker; a README-only edit prints `select: 0 cases, 0 runs`; `main(['gate', ...])` prints the case line `eval <id>: pass 3/3` with its token count; exact `select` and `gate` over one fixture with an added case and an unchanged case and no `--base-dist` agree per case, and the stub `.counter` equals the select total of 4 (requirement 4 AC 5); the direct-run test at :318 still reads `pass 3/3` (regression guard, requirement 1.6); `npx tsc --noEmit`, then `npm run build`, then `npx vitest run src/evals/__tests__/cli.test.ts` pass_

- [ ] 5. Guard the dry run and the error wait in the script tests
  - File: src/__tests__/service-scripts.test.ts
  - Test: src/__tests__/service-scripts.test.ts — `runScript(selfUpdateSh, ['--dry-run'], env)`
  - Note: regression guard, not a red test. Earlier tasks shipped the dry-run output and requirement 2.5 holds at base, so every criterion passes before this task. Expected route: the author reports RED-IMPOSSIBLE and the implementer writes the tests.
  - Note: the tests at `src/__tests__/service-scripts.test.ts:251-273` and :382-406 do not change; no value they assert changes.
  - Purpose: Prove design Component 5: `scripts/sdd-self-update.sh` shows the counts and the failing case with no script edit.
  - _Leverage: src/__tests__/service-scripts.test.ts:24-34, src/__tests__/service-scripts.test.ts:49-69, src/__tests__/service-scripts.test.ts:74-76, scripts/sdd-self-update.sh:59-75, scripts/sdd-self-update.sh:231-237_
  - _Requirements: 2.5, 4.6, 4.7_
  - _Prompt: Task: Per design Component 5 and the Script bullets of design Testing Strategy, add two tests. Dry run: a toy checkout whose HEAD holds one case and its role file, with `origin/main` ahead by a role edit and an added case; the dry run does not fetch (`scripts/sdd-self-update.sh:176-178`), so the test runs `git fetch origin`. `<checkout>/dist/evals/cli.js` is a wrapper that dynamic-imports this repository's built `dist/evals/cli.js`, calls `main(process.argv.slice(2))` and exits with its code. Error wait: `stageBuildStub` stages a gate that writes `demo fail 0/1 stub reason; record /x` to its `--summary-file` and exits 1, and a stub `<checkout>/dist/controller/waits.js` records the wait text to a file under the test's home. Illustrative — verify against the test fake: the toy package has no `type` field, so that stub is CommonJS with `exports.createWait` | Restrictions: Do not edit `scripts/sdd-self-update.sh` (design D5); assert only on `code`, `stdout` and files, which node 20 guarantees (`src/__tests__/service-scripts.test.ts:24-34`); use a wrapper, not a symlink, because a symlinked `dist` prints nothing (`src/evals/cli.ts:208-215`); add no skip for a missing `dist/` | Success: The dry run exits 0 and prints the role-only case's line ending `: 1 run`, the added case's line ending `: 3 runs`, and `select: 2 cases, 4 runs`; it creates no stub `.counter`, and HEAD and `git status --porcelain` match before and after; the error-wait run exits 1, its recorded wait text names `demo fail 0/1`, and the stub file and HEAD are unchanged; `eval selection unavailable` at :264 still holds (regression guard, requirement 4.7); `npm run build`, then `npx tsc --noEmit`, then `npx vitest run src/__tests__/service-scripts.test.ts` pass_

- [ ] 6. State the per-case count in the harness docs
  - File: docs/SDD-HARNESS.md
  - Count: `grep -n "three times\|3 runs\|3/3" docs/SDD-HARNESS.md` finds every fixed count; today that is :511 only. Update each hit.
  - Purpose: The docs stop promising 3 runs on every gate.
  - _Leverage: docs/SDD-HARNESS.md:492-494, docs/SDD-HARNESS.md:504-506, docs/SDD-HARNESS.md:510-511, docs/SDD-HARNESS.md:537-539_
  - _Requirements: 5.1, 5.2, 5.3_
  - _Prompt: Task: Per design Component 6, edit the four sites in `docs/SDD-HARNESS.md` that the design lists | Restrictions: Write in Simplified Technical English; leave `docs/ai-resources-catalogue.md:175-176` and `harness/` as they are | Success: `docs/SDD-HARNESS.md:492-494` says the `error` wait gives each failing or inconclusive case's run count; `docs/SDD-HARNESS.md:504-506` says the dry run prints each selected case's planned count and the total and uses the live `dist/evals/cli.js`, and no longer says staged; `docs/SDD-HARNESS.md:510-511` states 3 runs for a case with a `case` or `grader` reason and 1 run for a case selected only by `role`, `profile` or brief reasons; `docs/SDD-HARNESS.md:537-539` says a direct run stays at 3 runs per case; the Count grep finds no claim that every gate case runs 3 times_

## Decisions taken in this document

- D1 — The dry-run and error-wait script tests are their own task after the CLI task, as regression guards: options were a separate guard task, red tests inside the CLI task; chosen because the dry-run test needs a built tree and the red proof runs in a fresh worktree with no build, so it would fail there for the wrong reason.
- D2 — No Success clause lists the ESLint binary: options were omit it, list it as the standing rule says; chosen because this repository has no ESLint dependency, binary or config, so the command could never pass and would red every source task. The type check and the named test files remain the task checks.
- D3 — Six tasks, one per design component that changes a file, plus the guard task: options were six tasks, one task for the rule and the runner option; chosen because each task then owns its test file, so no file is edited twice and no line citation moves.
- D4 — The CLI count-line tests use the provisional form: options were the provisional form, the exact form with a matching base build; chosen because the provisional form reaches every line form with no built tree.
- D5 — The CLI task builds before it runs its tests: options were build in the task, repair the existing test so it needs no build; chosen because that test's dependence on a built tree predates this spec and is out of scope.

## Scope notes

- Cut or deferred from the entry: none.
- Carried from design: none.
- No task lists `scripts/sdd-self-update.sh` as a file to edit, because design D5 gives it no edit. Task 5 covers Component 5.
- The standing rule on the ESLint Success check does not apply here (D2). A later spec that adds ESLint adds the check.
- The existing test at `src/evals/__tests__/cli.test.ts:346-372` fails on an unbuilt tree, so a worktree with only `npm ci` shows one failure in that file until `npm run build` runs. Task 4 handles this; this spec does not change the test.

## Revision History

- **v1** (2026-11-04) — Initial draft.
