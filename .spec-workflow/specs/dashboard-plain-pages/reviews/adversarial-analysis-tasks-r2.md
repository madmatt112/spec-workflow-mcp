# Adversarial Analysis — dashboard-plain-pages/tasks (v2, round 2)

Primary surface: atomicity, ordering, coverage. Fresh lens: none. Deltas-first.

## Deltas since v1 (four hunks + version/history)

The v1→v2 diff changes exactly four substantive lines, each a round-1 fix:

1. **Task 5 Success grep** (line 75) — added `--exclude=usage-rows.ts` and the note
   "(`usage-rows.ts` keeps a `buildSpecRows` comment until the removal task deletes
   it)". This is the R1-1 fix.
2. **Task 6 Success** (line 86) — added "and for a null window (no `rate-limit.json`)"
   to the fit-null list. This is the R1-3 fix.
3. **Task 9 Success** (line 122) — added "disabled while a resolve request is in flight
   (delay the route, click confirm, assert it disabled before the reply, so one press
   sends one request)". This is the R1-2 fix.
4. **Task 4 Note** (line 50) — "tasks 5 and 10" → "the feed task and the removal task"
   (lint L-1 house-idiom; no citation change).

All four are drafting edits. No design choice, requirement or scope moved. Each delta
citation was re-checked against the tree and is accurate (see below). No fix-induced
claim error.

## R1-1 fix — task 5 scrub grep (fix-induced re-check, MUST_FIX of round 1)

Scoped to the diff of the grep against the file-outside-list requirement (retro P1/P12):

- The v2 grep is
  `grep -rn "buildSpecRows\|SpecListRow\|SpecPanel" src --include='*.ts' --include='*.tsx' --exclude-dir=__tests__ --exclude=usage-rows.ts`.
- I ran the literal symbol search over the whole `src` tree. Every non-test `.ts/.tsx`
  hit for these three symbols lives in a **task-5-owned** file —
  `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx`,
  `.../shell/types.ts`, `.../shell/ShellProvider.tsx`,
  `src/dashboard/shell/spec-rows.ts`, `src/dashboard/shell/types.ts`,
  `src/dashboard/shell/shell-feed.ts` — **except** `src/dashboard/shell/usage-rows.ts`
  (`buildSpecRows` in comment prose at lines 4 and 30), which task 5 does not own and
  task 10 deletes.
- `--exclude=usage-rows.ts` matches that one file by base name and nothing else
  (`usage-rows.test.ts` is already dropped by `--exclude-dir=__tests__`; no other file
  is named `usage-rows.ts`). The note states the reason, as P1 requires.
- The grep still walks `spec-rows.ts`, where `buildSpecRows` is defined, so a real
  residual after task 5's delete is still caught — the fix narrows by one sibling file,
  not by the guarded source. **Confirmed fixed; no stall path remains.**

## R1-2 fix — task 9 in-flight disable (fix-induced re-check, SHOULD_FIX of round 1)

- Task 9 Success now names the in-flight disable as a positive assertion that delays
  the route and checks the confirm disabled before the reply. This matches design C10
  ("disabled while the trimmed text is empty **or** a request is in flight") and
  Requirement 7.9 ("one press sends one request"). It is Playwright-assertable via a
  delayed `page.route` intercept; the main resolve case still exercises the real task-8
  route. It asserts a disabled state, not an absence, so the settling-signal rule is not
  engaged for this sub-case. **Confirmed fixed.**

## R1-3 fix — task 6 null-window fit (fix-induced re-check, MINOR of round 1)

- Task 6 Success now lists "a null window (no `rate-limit.json`)" among the fit-null
  cases, matching the C6 guard (`window` is not null) and Error Handling #3 ("every fit
  is `null`"). Consistent with the sibling clause "no `rate-limit.json` gives
  `window: null`". **Confirmed fixed.**

## Carried re-check — task 10 scrub grep (the reviser claimed it re-checked clean)

The v2 response states the task-10 sibling grep was re-checked and is clean. Verified
by literal search: the task-10 grep
(`buildSpecDetail|buildUsageRows|UsageSpecRow|SpecDetail|UsageTrend|PageLayout|primitives|closed-specs`)
has every non-test hit either in task 10's own File list (`multi-server.ts`,
`spec-rows.ts`, both `types.ts`, `usage-rows.ts`, `UsageTrend.tsx`, `PageLayout.tsx`) or
in a page file an earlier owning task rewrites before task 10 runs — `SpecsPage.tsx`
(task 5, drops `PageLayout`/`primitives`/`SpecDetail`), `UsagePage.tsx` (task 7, drops
`UsageTrend`/`UsageSpecRow`/`closed-specs`/`primitives`), `DeferralsPage.tsx` (task 9,
drops `PageLayout`/`primitives`). No non-test hit survives in a file no task owns.
**Clean.**

## Standard checks (re-confirmed, not re-litigated)

- **`Test:` seams** — unchanged by the deltas; all four of task 1's seams
  (`appendUsageLine`, `readUsageLog`, `computeBurn`, `attributedUse`), task 2's two,
  task 3's three and task 4's one each resolve to a design C1–C4 interface and reappear
  in their Success clause (retro P7). Round 1 verified these; no seam was re-edited.
- **Success-clause coverage (retro P7)** — the one collapse round 1 found (task 9 7.9)
  is now closed; no new collapse surfaced in the delta text.
- **Gate B / Gate C** — the deltas add no external dependency and no task now does more
  than the approved requirements ask. None.
- **`File:` entries** — all literal repo paths; the deltas added none.
- **Rejected R1-4 (empty-state strings)** — not re-raised: round 1 itself treated it as
  a pattern note, not a loop-keeper, and no new evidence arose.

## Top risks / gaps

None live. The one MUST_FIX and one SHOULD_FIX of round 1 are fixed and verified against
the real tree; the MINOR is folded in; the rejected MINOR has no new evidence.

## Conclusions to challenge

None reverse. The three fixes hold under adversarial re-check; the two scrub greps were
re-run against the actual tree and neither stalls.

## What's missing before acting

Nothing. The document is ready to implement in number order.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
