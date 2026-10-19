# Adversarial Review Memory — design

Last updated: 2026-10-19 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MUST_FIX)** — C1 says "four early returns" at `merge.ts:297-321`; there are five
  `unreadable` returns (298, 304, **312 no headRefOid**, 316, 320). The no-`headRefOid` return is
  unaddressed in C1's count and in Error Handling cases 1–2. Failure: a view that parses with no
  `headRefOid` returns at 312 before the CI flags are set; an implementer who misses it lets `ci`
  fall through to `green` for an unreadable PR. Fix: say "five"/"every", pin the 312 branch
  (`ci: unreadable`, `mergeable` present via a parse-time read of `data.mergeable`).
- **R1-2 (SHOULD_FIX)** — D9/C8 null a `0` baseline (regex `[1-9]\d*`), but R3 AC9 (v3) mandates
  keeping the integer value and only nulls when "not an integer"; `0` is an integer. D9 flags the
  re-decision but requirements are not amended ⇒ unreconciled design/requirements contradiction.
  Fix: reviser records a deferral or amends AC9.
- **R1-3 (MINOR)** — C7 adds `activeOwners` to the page-reset effect (`DeferralsPage.tsx:106`) but
  not to the `items` `useMemo` deps (`:103`); the owner filter must be in those deps too or
  owner-chip clicks won't recompute. `eslint-disable` at :102 hides it. e2e R2 covers it.

## Patterns & Themes
- The design is unusually well-grounded: every delta citation (lint pass) verified accurate, and
  the byte-identity (D6), the branch-save persistence (C2), the `evaluate`/`evaluatePullRequest`
  split preserving the two exact-equality tests (D1), and the usage fold shape (C9) all hold.
- Both real findings sit at the merge-read edge cases: incomplete enumeration of `evaluate`'s
  unreadable early returns, and a numeric edge (`0`) where design chose correctness over the
  literal AC without reconciling it.

## Guidance for Next Review
- Re-check only R1-1's fix (did C1 move to five/every returns, and is the no-`headRefOid` branch's
  `ci`/`mergeable` pinned?) and R1-2's reconciliation (deferral or amended AC9) as fix-induced
  re-checks against the exact diff, not a whole re-review.
- Do not re-open: the lint-pass citations (all verified), D1 (verified sound), D6 byte-identity
  (verified), C2 branch-save persistence (verified), `done`-runs-on-wire feasibility (verified).
- Closed by ruling: none.
