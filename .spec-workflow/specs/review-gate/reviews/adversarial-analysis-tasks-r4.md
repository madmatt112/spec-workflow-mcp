# Adversarial Analysis — review-gate/tasks (v4)

Round 4. Target: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/review-gate/tasks.md` (v4).
Read against `codebase-context.md`, `design.md` (v4), the round-3 analysis
(`adversarial-analysis-tasks-r3.md`) and the rolling memory (`adversarial-memory-tasks.md`).
Primary attack surface: atomicity, ordering, coverage. Fresh lens for this round (prompt):
intra-document shape consistency — for every call, export, file, fixture or CLI flag a later task
(1-10) uses against an artefact an earlier task defines, confirm the shape the later task assumes
(name, signature, return, file path, field names) is the shape the earlier task's prompt and the
design pin; and confirm every bridge (stub/cast) a task introduces has a matching removal in the
later task's prompt. Prior lenses (r1 lone sub-agent, r2 cost-of-touch, r3 truth table) not repeated.

## Delta attack (v4 Revision History), checked first

The v4 delta is one edit: **R3-1** added to task 7's `_Prompt` the clause "with the fixture's task-1
and task-3 blocks not matching `/\b(tests?)\b/i` (rule c stays silent since `docs/a.md`/`docs/b.md`
are non-test paths)". I re-derived every case task 7 asserts against the design's risk/gate tables to
confirm the fix is both correct and sufficient.

E2E fixture (task 7 line 69 / design line 214): one temp dir, `gitInit`, `.gitignore` ignores
`.spec-workflow`, `agent-rules.md` `## Sensitive paths` = `src/auth.ts`, `adversarial-settings.json`
`features.typecheck: false`, `tasks.md` tasks 1-3 `[-]`, commit `C0`.

- **Case 1** (`taskId: '1'`, `docs/a.md`, `baseRef: C0` ⇒ `pass`/`low`/recorded, `reviewer: 'gate'`).
  Task mode; touched = `['docs/a.md']` (untracked, in `ls-files --others`). Walked all seven risk
  rules: **a** — `sensitive = ['src/auth.ts']`, non-null, `docs/a.md` no match ⇒ silent; **b** — a
  small hand-written doc file < 200 lines ⇒ silent; **c** — the delta now forces the task-1 block not
  to match `TEST_WORD_RE` (`/\b(test|tests)\b/i`, design Component 4) ⇒ `taskNamesTests` false ⇒
  **silent (the fix)**; **d** — touched non-empty ⇒ silent; **e** — `features.typecheck: false` ⇒
  `computeTypecheckMethodologyState` returns `unavailable-feature-disabled` (verified
  `review-task.ts:59-60`), rule e fires only on `unavailable-other`/`timeout` ⇒ silent; **f** —
  `baseRef` supplied ⇒ silent; **g** — hygiene runs the real scan on `docs/a.md`, resolves ⇒ silent.
  All five gate rules silent (no `checks`, no in-scope diagnostic, no `debugger`, no `files`, not
  files-only). Verdict `pass`, risk `low`, review saved with `reviewer: 'gate'`. Reachable.
- **Case 3 re-gate** (`taskId: '3'`, `docs/b.md`, passing check ⇒ `pass`/recorded). Identical
  structure on the task-3 block, which the delta also constrains ⇒ rule c silent ⇒ `low`. The first
  gate (failing `node -e` check) is `fail` by gate rule a regardless of the block text, so `boom` /
  no-review-file hold independent of the fix. Reachable.
- **Closing** `data.reviewCoverage.reviewed === 3`. Confirmed the shape and semantics at
  `spec-status.ts:154-197`: `reviewCoverage = { reviewed, unreviewed }`, `reviewed` counts completed
  tasks with a `getLatestReview`. Task 1 (gate review v1), task 2 (record v1), task 3 (gate review)
  each have ≥1 review; all `[x]` ⇒ `reviewed === 3`. Reachable.
- **Case 2** unaffected: rule a on `src/auth.ts` dominates ⇒ `high`, `recorded: null`, then
  `prepare`/`record` ⇒ v1 (no prior review for task 2, `getNextVersion` = 1). The delta correctly
  leaves the task-2 block unconstrained.

The delta resolves R3-1 exactly as task 5's precondition is stated, misstates no artifact, and
introduces no contradiction with design D29 ("case 1 is `low` by construction"). **Delta sound.**

One cosmetic note, not a finding: the parenthetical rationale "rule c stays silent since
`docs/a.md`/`docs/b.md` are non-test paths" states the wrong proximate cause (non-test touched paths
are the reason the block-text is the *only* silencer, not themselves the silencer). The operative
directive — "blocks not matching `/\b(tests?)\b/i`" — is correct and complete, so an implementer is
not misled. MINOR at most; does not cause rework; not logged.

## Fresh lens — intra-document shape consistency, tasks 1-10

I traced every artefact an earlier task defines to every later task and doc that consumes it, and
pinned each shape against the cited code and design. All consistent:

1. **`reviewer` field (task 1 → tasks 5, 7).** Task 1 adds `reviewer?: 'gate' | 'agent'` to
   `TaskReview` (`src/types.ts:253-262`). `saveReview` takes
   `Omit<TaskReview, 'id'|'version'|'timestamp'>` (verified `task-review-manager.ts:108`), so task 5's
   `saveReview({ …, reviewer: 'gate' })` is type-valid the moment the field lands on `TaskReview` — no
   separate signature change needed. `reviewToMarkdown` writes it after `verdict:` (line 195 is
   `verdict: ${review.verdict}` — citation correct). `parseReviewMarkdown`'s `get` closure is
   `:243-246` and the return object is `:307` (`return { id, taskId, specName, version, timestamp,
   verdict, summary, findings }`) — both citations correct. `get-task-review` returns `data.review`
   whole, so task 7's `reviewer: 'gate'` assertion carries through unchanged. Field name and value
   domain identical at every hop.
2. **`computeRangeStats` (task 2 → task 5).** Return `RangeStatsResult = { ok: true; stats:
   {filesChanged,linesAdded,linesRemoved}; touched: string[] } | { ok: false; message }` (design
   Component 5). Task 5 reads `.touched` whole (for the rules), builds `data.touched = { paths (≤100),
   total }` and `data.stats`, and maps `!ok ⇒ success:false` with `.message`. `RangeSelector = {commit}
   | {baseRef}` matches task 5's `range = commit ? {commit} : {baseRef: baseRef ?? 'HEAD'}`. Consistent.
   `parseNumstat` (`task-diff.ts:263-291`) returns `{perFile,filesChanged,linesAdded,linesRemoved}`,
   the exact source of `stats`; `:277`'s "<3 tab fields" skip is inert in commit mode (`--format=`,
   no sha header) as design line 82 states.
3. **`runChecks`/`CheckResult` (task 3 → task 5).** `runChecks(root, commands, opts?)` and
   `CheckResult = {command,status,exitCode,output}`. Task 5 calls `runChecks(root, args.checks ?? [])`
   and asserts `data.checks[].output ≤ 200`. `data.checks: CheckResult[]` (GateData). Consistent.
4. **`gate-rules` exports (task 4 → task 5).** `scoreRisk`, `decideGate`, `truncateLine`,
   `parseSensitivePaths`, `isSensitivePath`, `worstTypecheckState`, `taskBlock`, `taskNamesTests`,
   `isTestPath` — every name task 5's step list uses is on task 4's export list. `worstTypecheckState`
   takes `{ kind: string }[]`; task 5 feeds it `results.map(computeTypecheckMethodologyState)`, whose
   elements are `{ kind, … }` (verified `review-task.ts:45-73`). `TYPECHECK_STATE_RANK` (design
   Component 4) enumerates all seven `TypecheckMethodologyState.kind` values, so the "worst" lookup
   cannot hit an unranked kind. `taskBlock` uses `ParsedTask.lineNumber` (0-based, `task-parser.ts:112`)
   and the checkbox regex (`:167`, matches `TASK_CHECKBOX_RE`) — citations correct.
5. **Tool schema → handler → harness → docs (task 6 → tasks 5, 8, 9, 10).** Task 6 adds `'gate'` to
   the enum (`:179-183`), the five optional properties (`:178-223`), keeps `required` (`:224`), and
   the dispatch branch (`:251-260`) — all four citations verified against the live file. Tasks 8/9
   call `gate` with only schema-declared args (`action`, `specName`, `taskId`, `baseRef`/`commit`,
   `checks`, `files`, `root`). Task 10 documents `'prepare' | 'record' | 'gate'` and every `data`
   field; the GateData field set it and task 8's verifier brief name (`reasons`, `checks`, `stats`,
   `touched`, `typecheck`, `hygiene`, `recorded`, `gate`, `risk`) matches the design Data Model exactly.
6. **Bridge check.** The only bridge is task 5's note "no dispatch exists yet, so the test calls
   `handleGate` directly (bridge; task 6 adds the dispatch case)". Task 6 states "no bridge to remove,
   task 5's direct-call test stays valid" — consistent with D34 (the handler is a plain export; the
   direct-call test is permanent, task 6 *adds* a dispatch test rather than replacing one). No dangling
   stub, cast or removable shim anywhere in tasks 1-10.

## Findings

None. The v4 delta is correct and sufficient; every cross-task shape is consistent; every artifact
citation I opened (`types.ts:253-262`, `task-review-manager.ts:108/195/243-246/307`,
`task-review-manager.test.ts:200-203`, `get-task-review.test.ts:85-96`, `review-task.ts:54-73/79-113/
160-162/179-224/251-260`, `spec-status.ts:154-224`, `task-parser.ts:112/167-175`, `task-diff.ts:263-291`)
matches the document's claim.

## Topics attacked

### 1. The v4 delta — task 7's rule-c precondition (R3-1)
- Challenge the claim that constraining only task-1 and task-3 blocks makes cases 1, 3 and
  `reviewed === 3` reachable: walked all seven risk rules and five gate rules for each — reachable;
  case 2 correctly left unconstrained because rule a dominates. Sound.
- Stress-test whether rules b/d/e/g hide a second latent trap in task 7's fixture the way rule c did
  in task 5: rule d (no-diff) is defeated by construction (the file is logged, hence present and
  untracked), rule e by `features.typecheck: false` (`unavailable-feature-disabled`, the exempt
  state), rule g by the real hygiene scan resolving on a plain doc file, and rule b only by the file
  being a small hand-written doc — no repository boilerplate seeds a >200-line doc the way
  `review-task.test.ts:84`'s "Success: Tests pass" seeds the `test` word. No second trap of the
  rule-c class.

### 2. Fresh lens — reviewer-field shape across the round-trip and coverage path
- Stress-test that `saveReview` accepts `reviewer` without a signature edit task 1 does not list:
  its parameter is `Omit<TaskReview,'id'|'version'|'timestamp'>`, so the `TaskReview` field addition
  flows through. Sound.
- Challenge whether task 7's `reviewer: 'gate'` and `reviewed === 3` assertions match the returned
  shapes: `parseReviewMarkdown` returns the field in the `:307` object, `get-task-review` returns
  that object whole, and `spec-status.ts:193` returns `reviewCoverage = { reviewed, unreviewed }`.
  Field names and types match the assertions exactly.

### 3. Fresh lens — the tool contract from schema to harness to docs
- Stress-test that tasks 8/9 pass no argument outside task 6's schema and that task 10 documents no
  `data` field the design does not emit: every harness argument and every documented field maps to a
  schema property or a GateData key. No drift.
- Verify the sole bridge (task 5 direct-call test) has task 6's matching disposition: it stays valid,
  no removal owed. Sound.

## Top 3 risks/gaps

1. None material. The one previously open finding (R3-1) is resolved by the v4 delta and verified
   reachable end to end.
2. Not a defect, verified: the `reviewer` field is type-safe through `saveReview` without a listed
   signature change, and travels unmodified through parse, `get-task-review` and `spec-status`.
3. Watch-item for a future round (not this lens, not a gap in this document): the harness routing
   state machine (tasks 8-9) — the cap-of-3 interaction between gate fails, the adjudicator terminus
   and the narrow-verify re-run — is asserted only by prose/command-exit tests, never truth-tabled.
   Out of scope for the shape lens; flagged for the next reviewer.

## Top 3 conclusions to challenge or reverse

1. **Header: "every existing suite green … the full suite runs once, at the completion gate."** Upheld;
   the additive `reviewer` line and `gate` enum break no existing assertion (the round-trip test uses
   `toContain`, `get-task-review`'s existing case checks findings only). The three rounds of blind
   spots (R1-1/R2-1/R3-1) were all about the *new* e2e/integration fixtures, and R3-1 — the last of
   them — is now closed. No standing challenge remains.
2. **Task 7's "tasks 1-3 `[-]`" fixture line.** The r3 reversal (block *content*, not just count,
   drives the verdict) is now absorbed into the `_Prompt`. Reversal spent.
3. **Nothing else rises to a reversal.** Delta sound; every cross-task shape consistent; every
   citation accurate.

## What's missing before acting

- Nothing blocking. The document is internally shape-consistent, every asserted case tabulates to the
  design's rules, and every code/harness/doc citation checked is accurate.
- Optional (MINOR, not required): reword task 7's parenthetical so the stated cause of rule c's
  silence is the block-text constraint, not the non-test paths. The operative directive is already
  correct, so this changes no implementation.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
