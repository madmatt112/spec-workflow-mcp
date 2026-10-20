# Adversarial Analysis — project-bootstrap/tasks (v1, round 1)

First review. Attack surface: atomicity, ordering, coverage. Deltas re-checked:
the v1 lint commit only added `src/` prefixes to prompt citations and wrapped
brace siblings in code spans — no behaviour claim moved; every re-checked path
and range resolves (see "What I checked").

## What I checked

- Every cited artifact against the tree (both ends of each range):
  `dashboard-session.ts:21-24/29-45/50-51/122-141`, `project-manager.ts:240-249/318-343`,
  `project-registry.ts:362-378`, `state.ts:425-427/434-441`,
  `git-utils.ts:45-51/101-112/152-158/194-205/214-251`,
  `multi-server.ts:349-357/420-445/453-464`, `access.ts:25-28/40/156-180/191-192`,
  `merge.ts:47-50/150-172`, `run-setup.ts:68-137` (worktree/merge-method/code-span rules),
  `gate-rules.ts:125-139` (backtick-span value), `workspace-initializer.ts:52-57/69`,
  `index.ts:120-125/378-384/400-406` and `showHelp` at `:22` (exported — task 9's
  `showHelp` assertion is feasible), `task-parser.ts:14/34-44`, `task-validator.ts:12/147-164`,
  `copy-static.cjs:46-53`, `sync-store-templates.cjs:34-37`, `stub-gh.mjs:49-51`,
  `sdd-service.sh:33`, `utils.ts:71-73`, `health-route.test.ts:49-71`,
  `project-manager-durable.test.ts:51-71` (exactly four single-arg `addProjectByPath`
  calls — task 2's claim holds), `workspace-roots.test.ts:514-517`,
  `index-args.test.ts:391-396` (`toContain`), `SDD-HARNESS.md:246-270/312-331`.
  All accurate. No misstated-artifact MUST_FIX.
- AC→task coverage: Req 1 AC1-11, Req 2 AC1-4, Req 3 AC1-6, Req 4 AC1-9, Req 5 AC1-7,
  Req 6 AC1-5, Req 7 AC1-7, Req 8 AC1-2 each map to ≥1 task. No orphan task.
- Component coverage C1-C10 and the e2e strategy item each map (scope note confirmed).
- Dependency order: 1→4/8 (peek), 2→3, 4→7/8, 5→7, 6→7/9, {3,7,8}→10. Sound; each
  intermediate task holds `tsc --noEmit` and the existing suites (additive method,
  optional param, optional field, new modules).
- Decomposition entry 24 scope: `init` writes `.mcp.json` + agent-rules + registers +
  prints; `doctor` checks those plus remote/token; deterministic, no model. Matched.

## Topics attacked

### 1. Success-clause coverage of task 7 (`init`) — retro P7

- Challenge the omission: the `Task:` body names "the not-committed last line on exit 0
  and 2 (design D8)" (Req 6 AC 5), but the `Success:` clause lists `wrote/updated/kept`,
  the `registered` line, exit codes, the `was:` clause and the no-secret rule — and never
  the final not-committed / "run doctor" line. The test-author writes to `Success:`, so
  Req 6 AC 5 is silently dropped from red-first testing. **R1-1.**
- Stress-test the lump "malformed .mcp.json each exit 1": Req 3 AC 5's distinct
  "`mcpServers` present and not an object" sub-case is folded into one phrase; a thin
  coverage nuance, not a gap on its own.

### 2. Task 8 (`doctor`) test seams vs Req 7 AC 3

- Attack the seam set: the two `- Test:` lines are `runChecks(top, timeoutMs)` and
  `serviceEnv()`. The `Success:` criterion "the last line names the first failure and the
  exit is 1, else 0" (Req 7 AC 3) is produced by `runDoctor`, not `runChecks` (which
  returns `CheckResult[]` and neither prints nor exits) nor `serviceEnv`. No seam asserts
  it; task 10 (e2e) covers only the all-`ok`, exit-0 path. The exit-1 / first-failure
  behaviour — doctor's whole point — ships without a red-first seam. **R1-2.**
- Confirmed assertable-elsewhere items (not findings): check pass/fail/skip, argv
  sidecar, token reasons, `serviceEnv` overlay, origin parsing, unchanged-mtimes,
  200 ms timeout — all reachable through `runChecks`/`serviceEnv`.

### 3. Atomicity of task 7

- Task 7 carries 21 requirement IDs across three phases (validate/write/register) and
  ~14 success assertions in one test file. Deliberate (a command is one cohesive unit;
  splitting validate/write/register invents shared-state seams) and declared high-risk
  with a verifier up front. Acceptable; recorded MINOR for visibility, not a blocker.

### 4. Ordering / InitArgs bridge

- Stress-tested the bridge: tasks 5 and 6 declare local `InitArgs`; task 7 exports the
  real one and rewrites `cli.ts`/`agent-rules.ts` to import it (both in task 7's `File:`
  list). Each step compiles; `detectFacts(top, args: InitArgs)` still type-checks under
  the unified type. No gap.

## Findings

**R1-1 — SHOULD_FIX — Novel.** Task 7 `Success:` omits Req 6 AC 5. The `Task:` body
requires "the not-committed last line on exit 0 and 2", but no `Success:` assertion
mentions the final line or that it names `doctor`. Per retro P7 the test-author writes to
`Success:`, so Req 6 AC 5 ships untested. **Failure:** `runInit` returns 0 with correct
files but no "files are not committed; … run doctor" line, and every test passes. Fix: add
a `Success:` clause asserting the last line on exit 0 and 2 names `doctor`.

**R1-2 — SHOULD_FIX — Novel.** Task 8's success criterion "the last line names the first
failure and the exit is 1, else 0" (Req 7 AC 3) is not assertable through its two seams
(`runChecks`, `serviceEnv`); it needs `runDoctor`, which has no `- Test:` line, and task 10
exercises only exit 0. **Failure:** `runDoctor` mis-selects the first failure or returns 0
on a failing check and no red-first test catches it. Fix: add
`- Test: src/bootstrap/__tests__/doctor.test.ts — runDoctor(repoPath, io, timeoutMs)` (or
narrow the `Success:` clause to `runChecks`-assertable claims).

**R1-M1 — MINOR — Novel.** Task 7 breadth (21 req IDs, 3 phases). Acceptable as one
command/one module with a declared verifier; noted only.

## Top risks/gaps

1. Req 6 AC 5 (the "run doctor next" line) untested — R1-1.
2. Req 7 AC 3 (doctor exit 1 + first-failure line) has no red-first seam — R1-2.
3. None else: coverage, ordering and every citation are sound.

## Top conclusions to challenge

1. **"Every design component is covered" (Scope notes).** True for existence, but the
   `runDoctor` output/exit contract (C4) is not pinned to a seam — coverage of the *module*
   is not coverage of the *behaviour*. Reverse by seaming `runDoctor`.
2. **Task 7's `Success:` is complete.** It is not: it drops Req 6 AC 5's terminal line.
3. **Task 8's two seams suffice for `doctor`.** They cover `runChecks` logic but not the
   reporter/exit, which is the user-visible result.

## What's missing before acting

- A `Success:` assertion for Req 6 AC 5 on task 7.
- A `runDoctor` test seam on task 8 (or a narrowed `Success:` clause).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
