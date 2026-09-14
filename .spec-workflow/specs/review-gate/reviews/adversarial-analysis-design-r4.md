# Adversarial Analysis — review-gate/design (v4)

Round 4. Target: `.spec-workflow/specs/review-gate/design.md` (v4). Read against the
codebase-context map, the approved requirements, the memory file, and the R3 analysis.
Environment on this machine matches the document's probes (git 2.43.0, node v24.13.0);
CI runs node 20 on ubuntu-latest (`.github/workflows/ci.yml:12,20`).

Delta attacked first (v4 Revision History): R3-1 `computeRangeStats` folds the
repo-existence check ahead of the resolve step, each with its own message; R3-2 commit
`C0` also adds `.gitignore`; R3-3 the resolve message names the selector; R3-4
Component 8 routes a post-checks `success: false` to close-out's resume escape; R3-5 an
unborn `HEAD` yields a clean empty range.

Fresh lens for this round: every `path:line` / `path:start-end` citation re-read at both
ends, and every `new` symbol checked against the tree for a pre-existing clash and every
reused export checked for the signature the document assumes.

## Delta re-verification — each R3 fix against the tree

- **R3-1 closed.** The reachability and distinguishability problem is resolved by
  *ordering*, not by widening `runGit`. `runGit` (`src/core/task-diff.ts:36-48`) still
  returns only `{ stdout, ok: !err }` — no stderr, no exit code — confirmed by reading
  both ends. Because `computeRangeStats` now lives inside `task-diff.ts` (D15) it can
  call the file-private `runGit`, and it runs the repo check
  (`git rev-parse --show-toplevel`) as a **separate** call *before* the resolve
  (`git rev-parse --verify <ref>^{commit}`). A non-repo fails the first call → `'no git
  repository at <root>'`; a bad ref passes the first and fails the second → `'<selector>
  <ref> does not resolve in <root>'`. The two outcomes are now derivable from *which*
  call failed, not from error text `runGit` never surfaces. The separate `handleGate`
  `show-toplevel` probe that R3-1 flagged as unreachable is gone (Component 2 step 5 and
  Error Handling 2 now defer to `computeRangeStats`). Probe claim verified against
  `codebase-context.md:161` (show-toplevel and `--verify <bad>^{commit}` both exit 128).
- **R3-2 closed.** Testing Strategy now reads "`C0` adds a `.gitignore` (ignoring
  `.spec-workflow`) plus `src/auth.ts`". With `.gitignore` committed at `C0`, it is not
  itself untracked, so `git ls-files --others --exclude-standard` no longer lists it;
  case 1's `touched` is `[docs/a.md]` only, `low` holds.
- **R3-3 closed.** Component 5 and Error Handling 3 name `commit`, `baseRef`, or the
  `HEAD` fallback in the resolve message.
- **R3-4 closed.** Component 8 `:89-96` routes a gate `success: false` after `logged:
  yes` to "the same resume escape `sdd-closeout-phase/SKILL.md:96-98` uses for a stuck
  batch." Verified: `SKILL.md:96-98` is exactly "a tool error leaves open items you
  cannot route around … report `PHASE: resume` …". True citation, real mechanism.
- **R3-5 closed.** Component 5 special-cases an unborn `HEAD` to `{ ok: true, stats:
  zero, touched: [] }`, so rule d (`no-diff`) and rule f (`no-range`) both fire and the
  bare task-mode call still scores `high` (D12, AC 6.1). The narrow loss (untracked
  files in a pre-first-commit tree are not counted) is the accepted residual.

No false claim about the codebase was introduced by the v4 delta.

## Citation audit (fresh lens) — every cited artifact held

Re-read at both ends and confirmed accurate: `review-task.ts` (`:160-162` Two-actions,
`:179-183` action enum, `:178-223` schema, `:224` required, `:251-260` dispatch,
`:54-73` `computeTypecheckMethodologyState`, `:79-113` unwrap converters, `:357-366`
implementation-log guard, `:431-432` `loadSettings`/`isTypecheckEnabled`, `:440-449`
pre-computations, `:493-498` `projectContext`, `:576-582` `saveReview` call, `:743-791`
byte-pinned constants); `root-selection.ts:202-221`; `task-diff.ts` (`:36-48` `runGit`,
`:263-291`/`:277` `parseNumstat`, `:135-234` `computeTaskDiff`); `git-utils.ts:45-51`
`scrubbedGitEnv`; `typecheck.ts` (`:8-15` `TypecheckDiagnostic.inScope`, `:17-49` result
union, `:124` `runProjectTypecheck` signature, `:187` tsc env);
`hygiene-signals.ts:4-9`/`:46-50`; `task-parser.ts` (`:112` 0-based `lineNumber`, `:153`
`parseTasksFromMarkdown`, `:167-175` checkbox/endLine); `path-utils.ts:208-210`
`getWorkflowRoot`; `implementation-log-manager.ts:461` `getTaskLogs`; `types.ts:253-262`
`TaskReview` (no `reviewer` today); `task-review-manager.ts` (`:10-27`
`validateVerdictConsistency`, `:62-66` `getNextVersion`, `:108-132` `saveReview` returns
the assigned `id`/`version`, `:195` verdict line, `:243-246` `get`, `:307` return
object); `get-task-review.ts:106,129` `data:{review}`; `spec-status.ts:179-193` review
coverage; `multi-server.ts:1913-1960` three review routes; the harness set
(`sdd-implementation-phase/SKILL.md:40-51,59-61,71-72,84-88,89-96`; its
`briefs.md:66-82,112-131 (line 124 exact),133-137,211-216`; `sdd-verifier.md:12-14,26`;
both orchestrators `:9-36`/`:9-24`, neither carrying `review-task` today;
`sdd-closeout-phase/SKILL.md:39-50,66-72,96-98,118-120,121-124,125-131`; its
`briefs.md:5-14,44-60,112-138,140-158`); `vitest.config.ts:7` include (the
`review-gate.e2e.test.ts` name matches `*.{test,spec}.{js,ts}`); `ci.yml:12`;
`TOOLS-REFERENCE.md:399-437`/`:439`.

New-symbol clash check: `computeRangeStats`, `RangeSelector`, `RangeStatsResult`,
`runChecks`, `lastLine`, `CheckResult`, `parseSensitivePaths`, `isSensitivePath`,
`scoreRisk`, `decideGate`, `worstTypecheckState`, `taskBlock`, `truncateLine`,
`handleGate` — none exist under those names in the tree today; the files
`review-gate.ts`, `gate-rules.ts`, `check-runner.ts` do not exist. Reused exports match
the signatures the document assumes: `saveReview(Omit<TaskReview,'id'|'version'|
'timestamp'>): Promise<TaskReview>` (so `recorded={reviewId,version}` is derivable);
`runProjectTypecheck(workspacePath, workflowRoot, allFiles, {enabled})`;
`getTaskLogs(taskId): Promise<ImplementationLogEntry[]>`; `computeHygieneSignals(files)`
(re-partitions internally, so passing absolutised `touchedAbs` is safe);
`getWorkflowRoot(projectPath)=<projectPath>/.spec-workflow` and
`loadSettings(projectPath)` both derive the `.spec-workflow` segment themselves, so
`handleGate`'s `workflowRoot` param (which holds `context.projectPath`) resolves
`agent-rules.md` and settings correctly despite the confusing name.

Consistency spot-checks that hold: the gate reads `tasks.md` from the spec store
(`specPath`) while running git on the landing `root` — correctly decoupled for close-out
items whose `root` (MAIN_CHECKOUT/HARNESS_REPO) is not the spec store; `feature-disabled`
maps to `TYPECHECK_STATE_RANK` index 5, not the worst, so it does **not** trip rule e —
which is exactly what lets e2e case 1 stay `low`; item mode sets rule c/f false and never
records (Component 2 step 9 gates on task mode), matching Component 9's "items never
record"; `validateVerdictConsistency` accepts the gate's `verdict:'pass', findings:[]`.

## Findings

### R4-1 — MINOR — the 100-path display cap is not explicitly separated from rule evaluation (Novel)

`MAX_TOUCHED_LISTED = 100` and `GateData.touched` is documented "≤100 paths", but risk
rule a (`sensitive-path`: "a `touched` path satisfies `isSensitivePath`") and gate rule d
(`file-outside-list`) both read "`touched`". The document never states that the rules
evaluate the **full** `RangeStatsResult.touched` list while only `GateData.touched.paths`
is capped for display. The natural implementation is safe — `computeRangeStats` returns
an unbounded `touched: string[]`, `scoreRisk`/`decideGate` consume it, and `GateData` caps
afterward — but if an implementer scores rule a against the already-capped 100-path list,
a sensitive path sorted beyond position 100 escapes the `sensitive-path` rule and the
change is scored `low` (recorded, no verifier). That is a security-adjacent miss.
Practically it is backstopped: any 100+ file change almost always exceeds the 200-line
`line-count` rule b and scores `high` regardless; the escape needs 100+ files totalling
≤200 changed lines with a sensitive file past position 100. Narrow, but one line in Data
Models — "rules evaluate the full touched set; only `data.touched.paths` is capped" —
removes the ambiguity.

### R4-2 — MINOR — check-runner exec taxonomy is probed on node 24 but CI (where the e2e asserts it) runs node 20 (Novel)

Component 6 and Error Handling 7 pin the exec error taxonomy (timeout ⇒ `killed:true,
signal:'SIGTERM', code:null`; overflow ⇒ `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`; non-zero ⇒
numeric `code`) to "node v24.13.0". `check-runner.test.ts` and the e2e (case 3's failing
check) assert this taxonomy and run under `npm test` on CI, which is node 20
(`ci.yml:20`), not 24. These `child_process` behaviours are stable across node 20 and 24,
so this is not a correctness defect — but the probe note should name node 20 as the
runtime the taxonomy must hold on, since that is where the committed assertions actually
execute. (The Scope note already says CI is Ubuntu-only; add the version.)

## Top 3 risks/gaps

1. R4-1: the `touched` display cap vs rule-evaluation ambiguity — a wrong reading is a
   sensitive-path bypass, though rule b backstops all but a very narrow input.
2. R4-2: taxonomy probed on node 24, asserted on CI node 20 — stable, documentation-only.
3. No third gap of MINOR-or-higher severity surfaced; the delta is clean and every
   citation holds.

## Top 3 conclusions to challenge

1. **"the two git-path failure outcomes are now distinguishable" (R3-1 close-out).**
   Upheld, not reversed: the distinction comes from ordering two `runGit` calls, so it
   does not depend on `runGit` surfacing stderr/exit — which it still does not. The one
   soft edge (git missing from PATH also fails the repo check and reports "no git
   repository") is the same MINOR R3 already walked; outcome (`success:false`) is right.
2. **"an unborn `HEAD` yields a clean empty range" (R3-5).** Upheld. The implementer must
   detect it as "ref is `HEAD` and resolve failed after the repo check passed"; that is
   derivable and the document's data flow supports it.
3. **Nothing else rises to a reversal.** Store-item gates score `high` meaninglessly
   (no tsconfig ⇒ rule e) but never see a verifier and never record, so the outcome is
   `ok`; running the harness class's heavy checks (`npm install`, `tsc`, `vitest`,
   `claude plugin validate`) through the 300 s/16 MiB runner is real-time cost the
   steering already accepts and is the skill's assembly, not a design defect.

## What's missing before acting

- Add one Data Models line stating rules evaluate the full `touched` set; only
  `data.touched.paths` is capped at 100 (R4-1).
- Name node 20 as the CI runtime for the exec taxonomy (R4-2).
- Nothing blocking. The design is implementable as written.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
