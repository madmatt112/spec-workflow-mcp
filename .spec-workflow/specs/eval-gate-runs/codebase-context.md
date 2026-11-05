# Codebase context — eval-gate-runs

## Selection (src/evals/select.ts)
- src/evals/select.ts:11-23 — `SelectCasesOpts` and `SelectedCase` (`id`, `reasons`, `provisional`)
- src/evals/select.ts:115-162 — `briefReasonsForCase`: exact-mode `brief <template>` reasons, or `brief: base render unavailable`
- src/evals/select.ts:169-208 — `selectCases`: builds the reason strings per case; `case`, `role`, `profile`, `grader <name>` in both modes, `brief source` in provisional mode only

## Gate (src/evals/gate.ts)
- src/evals/gate.ts:8-23 — `RunGateOpts` (holds `step`, no `onLine`) and `RunGateResult`
- src/evals/gate.ts:25-30 — `firstReason`: first reason of the first run that has one
- src/evals/gate.ts:36-107 — `runGate`: exact selection, override checks, `runCases` call, summary line, override log and deferral
- src/evals/gate.ts:56-58 — the `runCases` call: no `runs`, no `onLine`
- src/evals/gate.ts:74-79 — exit 1 path and the summary line
- src/evals/gate.ts:96 — the deferral body with the fixed `passes 3/3` text

## Runner (src/evals/runner.ts)
- src/evals/runner.ts:18-40 — `EvalRunRecord`, `EvalCaseRecord`, `EvalResultRecord` (`v: 1`)
- src/evals/runner.ts:42-49 — `RunCasesOpts`: uniform `runs`, `step`, `onLine`
- src/evals/runner.ts:141-266 — `runCases`: sequential runs per case, fresh fixture each, writes the record
- src/evals/runner.ts:144 — default of 3 runs
- src/evals/runner.ts:246-250 — case verdict from its runs
- src/evals/runner.ts:253-254 — the `eval <id>: <verdict> <passed>/<runs>, <tokens> tokens` line

## CLI (src/evals/cli.ts)
- src/evals/cli.ts:14-18 — usage text for the three forms
- src/evals/cli.ts:128-149 — `runRun`: direct run, passes `onLine`, no `runs`
- src/evals/cli.ts:151-169 — `runSelect`: prints the `select <id>: <reasons>` lines
- src/evals/cli.ts:171-187 — `runGateCommand`: calls `runGate`, prints nothing itself

## Deploy script (scripts/sdd-self-update.sh)
- scripts/sdd-self-update.sh:59-75 — `write_error_wait`: the wait text carries the gate summary
- scripts/sdd-self-update.sh:231-237 — dry-run branch: `select --provisional` from the live `dist/evals/cli.js`
- scripts/sdd-self-update.sh:239-260 — real branch: staged CLI `gate`, summary file to `error` wait on failure
- src/advisor/actions.ts:362-384 — `execDeploy`: script stdout and stderr go to `deploy.log`

## Tests
- src/evals/__tests__/gate.test.ts:346-380 — exit 1 test, exact summary line at :369-371
- src/evals/__tests__/gate.test.ts:400-449 — override test, exact `passes 3/3` at :440
- src/evals/__tests__/cli.test.ts:270-286 — `select` output test, `toContain` at :283
- src/evals/__tests__/cli.test.ts:304-326 — direct run line and record path, `pass 3/3` at :318
- src/evals/__tests__/cli.test.ts:390-418 — gate through the CLI with an override
- src/evals/__tests__/runner.test.ts:200 — exact case line `pass 3/3`
- src/evals/__tests__/runner.test.ts:242 — one of the `runs: 1` callers of the uniform option
- src/evals/__tests__/select.test.ts:158 — reasons `['case']`; the other reason strings are pinned at :180, :205, :229, :279, :329, :355
- src/__tests__/service-scripts.test.ts:251-273 — dry-run in a clone with no `dist/`
- src/__tests__/service-scripts.test.ts:382-406 — failing eval stage leaves HEAD, `harness/` and `dist/` unchanged

## Docs
- docs/SDD-HARNESS.md:474-506 — the staged self-update, the `error` wait, overrides, dry-run (:505 says "staged"; the script uses the live build)
- docs/SDD-HARNESS.md:508-545 — eval cases, "three times" at :511, direct run at :531-539
- docs/ai-resources-catalogue.md:175-176 — grill decision 21, "3 runs per case"

## CLI entry and readers (src/evals/cli.ts)
- src/evals/cli.ts:148 — `runRun` reads the returned verdicts for its exit code
- src/evals/cli.ts:193-201 — exported `main`: dispatches `select`, `gate`, or a direct run
- src/evals/cli.ts:203-215 — entrypoint check: unresolved `argv[1]` against the module's real path

## Deploy script, dry run (scripts/sdd-self-update.sh)
- scripts/sdd-self-update.sh:24 — `set -euo pipefail`
- scripts/sdd-self-update.sh:175-181 — `BASE`, and the dry-run branch that only prints the fetch
- scripts/sdd-self-update.sh:109-117 — the `dist/controller/state.js` check, with its dry-run note

## Test seams
- src/evals/__tests__/gate.test.ts:87-110 — `writeDeterministicCase`: a case with no `agent-rules.md`
- src/evals/__tests__/gate.test.ts:113-141 — `writeAuthorCase`: a case with chosen graders
- src/evals/__tests__/gate.test.ts:145-157 — `realRenderedText`: this build's text for one case
- src/evals/__tests__/gate.test.ts:160-174 — `writeMatchingBaseDist`: a base build that writes fixed text
- src/evals/__tests__/gate.test.ts:179-186 — `writeScript`: the stub `claude` script and counter path
- src/evals/__tests__/gate.test.ts:188-201 — `okRun`: one scripted stub run
- src/evals/__tests__/cli.test.ts:76-90 — `captureStdout` over `console.log` and `process.stdout.write`- src/evals/__tests__/cli.test.ts:157-171 — `writeMatchingBaseDist`: forwards to the real `dist/tools/harness.js`, so it needs a built tree
- src/evals/__tests__/cli.test.ts:175-187 — `writeSelectRepo`: role, profile, brief-source files and one case
- src/evals/__tests__/runner.test.ts:378-394 — a stub `step` returning a full `StepResult`
- scripts/stub-claude.mjs:62-72 — the `.counter` file, one increment per invocation
- src/__tests__/service-scripts.test.ts:24-34 — `runScript`: 20 s timeout, `code`, `stdout`, `stderr`
- src/__tests__/service-scripts.test.ts:49-69 — `makeDivergedCheckout`: toy `package.json` with no `type`, clone made before origin advances
- src/__tests__/service-scripts.test.ts:74-76 — `stageBuildStub`: stub staged `dist/evals/cli.js`
- src/__tests__/service-scripts.test.ts:408-436 — override forwarding through a stub CLI that reads its argv

## CI
- .github/workflows/ci.yml:30 — `npm run build` step
- .github/workflows/ci.yml:33 — `npm test -- --run` step

## Task routing and red proof
- src/controller/phases/implementation.ts:255-259 — `isTddMarked`: a `- Test:` seam routes a task to the test author
- src/controller/phases/implementation.ts:266-272 — `isWiringTask`: a CLI file or title; line 850 gives it a verifier
- src/controller/phases/implementation.ts:672-678 — RED-IMPOSSIBLE on every criterion routes the task implementer-only
- src/core/red-green.ts:123-184 — `runBaseWorktree`: red run in a fresh detached worktree, no build
- src/core/red-green.ts:192-265 — `proveRedGreen`: base run, then the head run in the code root
- src/core/lint-tasks.ts:241-266 — `checkCoverage`: each design component label must appear in a task block
- src/core/lint-tasks.ts:278-300 — `checkBridges`: a block that names a later task needs a bridge word

## Tasks-phase test seams
- src/evals/graders/report-flag.ts:4-11 — `grade`: passes when the report `flag` starts with `prefix`
- src/evals/__tests__/cli.test.ts:122-150 — `writeAuthorCaseDir`: a case under a temp repo, with chosen graders
- src/evals/__tests__/cli.test.ts:346-372 — gate refusal test; fails on an unbuilt tree (exit 0, expected 2)
- scripts/sdd-self-update.sh:132-173 — `check_move`: refusals read tracked paths only, so an untracked `dist/` stub passes
