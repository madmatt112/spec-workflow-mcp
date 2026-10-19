# Adversarial Analysis — dashboard-loop-views/design (v1, round 1)

First review. Primary surface: feasibility, consistency, edge cases. Fresh lens: none.
I read codebase-context.md, then both ends of every cited range in merge.ts, runs.ts,
state.ts, deferral-storage.ts, run-setup.ts, usage.ts, spec-rows.ts, primitives.tsx,
UsagePage.tsx, DeferralsPage.tsx and e2e/worktree-shell.spec.ts, and the v3 requirements
and decomposition entry 23.

## Deltas since the checkpoint (lint pass) — all verified clean

Every citation the v1 lint commit changed is accurate:
- `primitives.tsx:12-203` — `Group` at 12, `Row` at 178-203; the widened range now spans all
  three primitives. Correct (the old `:12-102` dropped `Row`).
- `deferral-storage.ts:296-308` — `resolve` is exactly there; the old `:352-372` was `merge`.
  Correct, now cited separately.
- `merge.test.ts:171` and `:232` — both are `expect(result).toEqual({ ready: true, reasons: [] })`.
  They stay valid because `evaluate` keeps returning `(await evaluatePullRequest(...)).evaluation`,
  so D1 holds. Correct.
- `runs.test.ts:411-434` — the "merges an unmerged close-out PR by rule" test. Correct.
- `run-setup.test.ts:366-375` — the missing-file whole-struct `toEqual`; the missing-file branch
  (`run-setup.ts:68-72`) omits `baselineWPerTask`, so the equality stays unchanged. Correct.

No lint-fix regressed a citation. The rejected citation-identifier flags are genuine false
positives (new symbols the design introduces).

## Topics attacked

### 1. C1 — the extended merge read (`merge.ts:291-372`)
- Challenge the claim that `ci` is unreadable "on each of the **four** early returns
  (`merge.ts:297-321`)". There are **five** `unreadable: true` returns in that region:
  line 298 (view exit≠0), 304 (JSON parse fail), **312 (no `headRefOid`)**, 316 (workflow-runs
  read fail), 320 (commit-status read fail). See Finding R1-1.
- Stress-test the `mergeable` rule against the no-`headRefOid` return at 312. Here the view
  parsed (`data` exists at 302) but the function returns before line 348. The design's rule
  "`mergeable` is the raw `data.mergeable` string whenever the output parsed" is self-consistent
  only if the implementer reads `data.mergeable` at parse time, not at 348; the design never says
  so, and Error Handling case 2 ("`mergeable` keeps the value just read") only covers the
  post-view-parse runs/status failures, not 312.
- Confirmed fine: the `evaluate`/`evaluatePullRequest` split preserves the two exact-equality
  tests (D1); `url = pr.url ?? data.url` with the https gate works because `PR_VIEW_FIELDS` gains
  `url` (probed: gh 2.95.0 lists `url` — verified by `gh pr view --json` output); `read.kind` is
  `run` for `questionId === 'merge'` and `closeout` otherwise, matching `runMergeStage` (518) and
  `closeoutMergeTarget` (459).

### 2. C2 — reads on the run record (`runs.ts:599-682`, `903-937`)
- Stress-test "every branch then saves from that `run`, so no branch drops the reads." Verified:
  the pre-`switch` save at 626-632 reassigns `run = await save(...)`, and each branch (`merged`
  636, `not-ready` 639, `blocked` 645, `waiting` 657, `unreadable` 662, `failed`→`waitAnd`) spreads
  the updated `run` through `save`'s `{ ...run, ...patch }`, so `prReads` persists. Sound.
- Verified the close-out loop: `runCloseoutMergeStep` reassigns `run` at 919, so an in-loop
  `run = await save(...)` after `mergeByRule` (912) accumulates reads; the `return 'go'` at 936
  relies on the in-loop save plus the loop re-read at `runs.ts:761`. Sound.
- Confirmed `listRuns` (`state.ts:310-325`) returns `done` runs unfiltered, so the R1 e2e seed of a
  `done` run with two reads does surface on `controller-runs` and renders the panel. Feasible.

### 3. C5/C8/D9 — storage byte-identity and the zero baseline
- Verified D6: a legacy record reads `owner: null`, `serializeFrontmatter` omits the line when
  owner is null, so `canonical === content` in `reindex` (463) and no legacy file is rewritten.
  Sound and well-reasoned.
- Challenge D9 against R3 AC9. The regex `/^baseline-w-per-task:\s*([1-9]\d*)\s*$/m` nulls a
  `0` baseline, but AC9 (requirements v3) says "the integer value ... IF the key is absent or **not
  an integer** THEN null." Zero is an integer, so AC9 as written keeps `0`. See Finding R1-2.

### 4. C9/C10/C11 — the usage rows, route and trend
- Verified `report.total` is a `UsageCell` carrying `spawns`, `w`, `wUnknown` (`usage.ts:13-25`),
  so `report.total.spawns - report.total.wUnknown > 0` is a real expression and `w = report.total.w`
  matches the `usage` action's fold (AC4). Sound.
- Verified `tasks = entry.taskProgress.total` and the `IndexGenerator` snapshot walk mirror
  `buildSpecRows` (72-86); `isSpecClosed` cleanly factors lines 92-93 with no behaviour change (D15).
- Confirmed the route returns 200 on a per-project throw (logged once), null fields on torn files,
  and server-side sort by projectName then closeDate — matches NFR Reliability and AC10.

### 5. C7 — the Deferrals owner filter
- Minor: the design adds `activeOwners` to the page-reset effect (`:106`) but is silent on the
  `items` `useMemo` deps array (`:103`, `[enabledKey, deferralsByProject, active, query]`). The
  owner filter must also be added there or owner-chip clicks won't recompute the list; the
  `eslint-disable` at :102 hides the omission. Test-covered by e2e R2, so MINOR.

## Findings

### R1-1 — MUST_FIX (Novel): C1 miscounts the unreadable early returns and leaves the no-`headRefOid` branch unpinned
`merge.ts:297-321` holds **five** returns that set `unreadable`, not four; the uncounted one is
the `if (!headOid)` return at `merge.ts:312`. C1 says "`ci` is `unreadable` on each of the four
early returns," and Error Handling cases 1–2 cover only the view-fail/parse-fail and
runs/status-fail returns — the no-`headRefOid` return is addressed nowhere.

**Failure scenario:** `gh pr view` succeeds and returns JSON but with no `headRefOid` (head ref
deleted, or a sparse response). The base code returns `unreadable` at 312. An implementer who
codes "ci=unreadable on the four early returns" and misses this fifth one lets `evaluatePullRequest`
fall through to `ci` computed from `ciFailed`/`ciPending`, both false (no runs/statuses were read)
⇒ `ci: 'green'`. The Run page then shows a green CI chip for a PR the rule could not read.

**Fix:** state "five early returns" (or "every early return") in C1 and pin the no-`headRefOid`
return in Error Handling: `ci: 'unreadable'`, and `mergeable` present (the view parsed — read
`data.mergeable` at parse time so this holds for returns 312, 316 and 320 too, which is the only
reading that makes the "raw string whenever parsed" rule consistent).

### R1-2 — SHOULD_FIX (Novel): D9's zero-baseline nulling diverges from R3 AC9 and is unreconciled
C8's regex excludes `0` and the C8 test asserts `0` gives no key, so a `baseline-w-per-task: 0`
line yields `baseline: null`. R3 AC9 (requirements v3) literally mandates "the integer value ...
IF the key is absent or not an integer THEN null"; `0` is an integer, so AC9 requires keeping it
(then `pctOfBaseline = wPerTask / 0 * 100` ⇒ Infinity). The design's nulling is the correct
engineering choice, but D9 only "flags [it] as re-decided against requirement 3 criterion 9" while
the requirements are not amended — leaving an open design/requirements contradiction that a later
design-vs-requirements check will catch.

**Fix:** reconcile — have the reviser record a deferral or amend R3 AC9 to exclude a non-positive
baseline, so the design and requirements agree on `0`.

## Top 3 conclusions to challenge or reverse

1. **"four early returns" (C1).** Reverse: there are five; the fifth (no `headRefOid`, line 312)
   is a genuine CI-state hole with a concrete wrong-output scenario. R1-1.
2. **D9 "Flagged as re-decided against requirement 3 criterion 9" is sufficient.** Challenge:
   flagging is not reconciling; AC9 still mandates the opposite for `0`. R1-2.
3. **Error Handling case 2 "`mergeable` keeps the value just read."** Challenge the wording: at the
   runs/status-fail returns (316, 320) no `mergeable` has been extracted at line 348 yet; the claim
   is only true if `data.mergeable` is read at parse time. Spell that out (folded into R1-1's fix).

## What's missing before acting

- A single explicit statement of where `evaluatePullRequest` reads `data.mergeable` (at parse,
  not at 348), and the no-`headRefOid` branch's shape. Without it the implementer guesses.
- A one-line reconciliation of `0` baseline between design D9 and requirements AC9.
- (MINOR) a note that the `items` filter deps must include the new owner-filter state.

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
