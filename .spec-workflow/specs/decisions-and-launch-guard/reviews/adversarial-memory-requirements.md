# Adversarial Review Memory — requirements
Last updated: 2026-11-07 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Req 2: no-`tasks.md` common branch unverified. v2 added a
  second Verification scenario; under-two-roots disambiguation deferred to design.
- **R1-2 (MINOR, v1)** — Req 2 AC5 now cites base one-press path `HomePage.tsx:188-194`.
- **R1-3 (MINOR, v1)** — Req 3 AC1 now states each decision is one line (`runs.ts:356`).
- **R1-4 (MINOR, v1)** — Req 3 AC5 now flags the no-change match as heuristic, design-tested.
- **R1-5 (MINOR, v1)** — Intro now "eleven operator items", not "operator-reported defects".

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (SHOULD_FIX, Novel, v2)** — Req 10 AC1/AC2: tone via `runDot` colours a driven
  (healthy) run `danger` after a ≥15-min activity gap in one step, defeating the user
  story ("a long healthy run does not look broken"); AC2 "healthy run older than 1 hour →
  neutral" contradicts AC1 for that case and leaves "healthy" undefined. Fix: reserve
  `danger` for `isStalled`, or state that a driven activity-gap red is intended; reframe
  AC2 as "age alone no longer forces danger".
- **R2-2 (MINOR, Compounds R1-1, v2)** — Req 2 second Verification scenario states no
  concrete pass/fail outcome (source design-deferred); bind design/tasks to supply it.
- **R2-3 (MINOR, v2)** — Req 9 AC3 "less visual weight than Running" is unquantified.

## Patterns & Themes
- Citations remain strong. v2's two new citations (`HomePage.tsx:188-194`, `runs.ts:356`)
  both verified; the D1–D13 reformat dropped options lists without factual drift. No
  misstated artifact in any round. No MUST_FIX in either round.
- The board requirements lean on existing frontend helpers (`runDot`, `isStalled`,
  `ageTone`, `MOVING_STATUSES`, `stoppedAdmitted`) — accurate to code — but Req 10 adopts
  `runDot`'s thresholds without reconciling them to its own user-story intent. Soft spot:
  ACs that cite a helper as the rule, then add an illustrative AC (AC2) on a different
  axis than the helper actually uses.
- Recurring theme carried from round 1: behaviour pinned to an existing mechanism, with
  an edge case (quiet-but-driven run; no-`tasks.md` branch) left implicit.

## Guidance for Next Review
- Fresh lenses used: wire contracts (r1), testability-vs-user-story (r2). Next round pick
  another — e.g. idempotency/restart ordering (Req 7 AC3/AC4 across a restart), or the
  close-out batch-brief dataflow (Req 3 AC3/AC4 `itemsText`).
- If v3 re-words Req 10, scope the re-check to AC1/AC2/AC3 coherence (does `danger` now
  track `isStalled`, and does "healthy" have a definition?) — fix-induced re-check.
- Well-covered, do not re-mine: Req 1 durable-vs-read path, Req 2 cross-project tile
  mechanism and one-run-per-store, Req 3 `## Decisions` single-line read, Req 5 label
  contract, Req 7 the five `runStep` sites and the wait-site citations, the
  translatePath host-conditional equivalence. All verified accurate.
