# Adversarial Analysis — dashboard-loop-views/design (v2, round 2)

Primary surface: feasibility, consistency, edge cases. Fresh lens: none.
I read codebase-context.md, the memory file and the r1 analysis, then re-verified the v2
deltas at both ends of every cited range in `merge.ts`, `run-setup.ts`, `DeferralsPage.tsx`,
`file-cache.ts`, `spec-rows.ts`, `e2e/worktree-shell.spec.ts`, `primitives.tsx` and
requirements.md AC9, plus the installed `gh` version.

## Fix-induced re-checks (the three R1 findings)

**R1-1 (was MUST_FIX) — RESOLVED.** `merge.ts:297-321` holds exactly five `unreadable`
returns: 298 (view exit≠0), 304 (parse fail), **312 (no `headRefOid`)**, 316 (runs read
fail), 320 (status read fail). C1 now says "five early returns" and names the 312 branch;
Error Handling case 2 now pins 312/316/320 together as `ci: unreadable` with `mergeable`
held from the parse. The "read right after the JSON parses (`:300-305`)" wording is the one
reading that makes `mergeable` present on the 312/316/320 returns, matching the `PrRead`
Data Model ("raw gh value; absent when the view was unreadable"). The green-chip-for-
unreadable hole is closed. Verified against the code, not just the prose.

**R1-2 (was SHOULD_FIX) — RESOLVED for the baseline value.** requirements.md:66 (AC9):
"the integer value ... IF the key is absent or not an integer THEN ... null." The v2 regex
`/^baseline-w-per-task:\s*(\d+)\s*$/m` keeps `0` as `0` (an integer), so the baseline value
now conforms; `pctOfBaseline` is nulled only when `baseline` is not positive, so no
divide-by-zero. The design/requirements contradiction is gone. One residual sub-issue below
(R2-1, MINOR).

**R1-3 (was MINOR) — RESOLVED.** `DeferralsPage.tsx:103` is the `items` `useMemo` deps array
(`[enabledKey, deferralsByProject, active, query]`), and `:106` is the page-reset effect.
C7 now adds `activeOwners` to both, so an owner-chip click recomputes the list. Accurate.

## Delta probes and seams that held

- **gh `url` probe.** Installed `gh` is **2.95.0** — the exact version C1 cites. `gh pr view
  --json` lists `url`. `PR_VIEW_FIELDS` (`merge.ts:38-39`) today lacks `url`, so "gains `url`"
  is correct and the link costs no extra call (D2). Sound.
- **`evaluate`/`evaluatePullRequest` split.** `evaluate` returns `(...).evaluation`, an
  untouched `{ ready, reasons }`/`{ ...pending }`/`{ ...unreadable }`; the three observed
  fields are siblings in the wrapper, so the two exact `toEqual` at `merge.test.ts:171,232`
  stay green (D1). Verified `mergeByRule` returns at 533/536/550/554/557/565/580/585 are all
  reachable by "sets `read` on every return"; the six `MergeStageStatus` verdicts are the
  `read.verdict` discriminant.
- **FileCache capability.** `file-cache.ts:20-48` exposes `.text()` and `.jsonl<T>()`; C9's
  `cache.text(handoffPath(...))` and `cache.jsonl(ledgerPath)` match `buildSpecRows`
  (`spec-rows.ts:75,85-86`). `closeDate`/`w`/`tasks`/`isSpecClosed` all mirror
  `spec-rows.ts:72-93,144`. Sound.
- **Data Models completeness.** `PrRead`, `UsageSpecRow` and the `evaluatePullRequest` return
  all have their full field shape pinned, not only union arms. OK.
- **e2e marker change (C12).** The no-sideways-scroll test (`worktree-shell.spec.ts:205-224`)
  shares the single `describe.serial` `beforeAll` that the v2 e2e seed extends with "a closed
  spec in each project," so `usage-closed-specs` renders for it. The `Row` primitive is
  `overflow-hidden truncate whitespace-nowrap` (`primitives.tsx:196`) and the Design System
  section declares the new UI reuses `Row`, and `UsageTrend` is `w-full h-auto`, so the new
  table cannot scroll sideways at 375px. The removed "keeps the existing test valid" sentence
  was redundant, not load-bearing. No finding.

## Findings

### R2-1 — MINOR (Compounding; Compounds: R1-2; fix-induced): a `0` baseline is treated two ways across the table and the trend
The R1-2 fix keeps `baseline: 0` as a value but C11 shows `no baseline` in the % column when
`baseline` is null **or 0**, while the trend draws a dashed reference "line per project that
has a baseline" — if "has a baseline" is read as `baseline != null`, a `baseline: 0` project
gets a `trend-baseline-{id}` line at y=0 even though the table said "no baseline" for it. D9
says "null only the percentage," which reads as table-only. Harmless (an operator would never
set a 0 W-per-task baseline, and a line at y=0 sits on the axis), and AC9 does not mandate the
% text for a valid integer `0`, so it is not a contradiction. Tighten by stating the trend
also treats a non-positive baseline as no baseline (no `trend-baseline` line), or leave to the
implementer. MINOR — does not keep the loop alive.

## Top risks/gaps

1. None at MUST_FIX or SHOULD_FIX. The v2 delta resolves all three R1 findings and the fixes
   verify against the tree.
2. (MINOR) R2-1 — the `0`-baseline edge is handled in the table but unstated for the trend.

## Top conclusions — none to reverse

The three v2 resolutions (five returns + parse-time `mergeable`; `0` kept as the integer
baseline; `activeOwners` in the `items` deps) each match the code they cite. No prior
conclusion needs reversing.

## What's missing before acting

Nothing blocking. Optional: one clause that the trend omits a `trend-baseline` line for a
non-positive baseline, to match the table's `no baseline` for `0` (R2-1).

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
