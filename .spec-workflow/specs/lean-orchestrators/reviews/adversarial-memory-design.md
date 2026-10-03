# Adversarial Review Memory — design
Last updated: 2026-10-02 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — `QueuedTask.testFiles`/`integration` had no consumer and keyed
  off an absent `- Test (integration):` convention. v2 cut both fields and the paragraph.
  Verified clean in r2: no dangling refs, no requirement violated, `files` retained.
- **R1-2 (MINOR, v1)** — `compareSources` shape unstated. v2 pinned `data.sources` as
  `SourcesReport` and `data.compareSources` as `SourcesReport | null` (design.md:215).
- **R1-3 (MINOR, v1)** — `listSpawns` W-source wording could diverge from the fold. v2 points
  it at the token-setting row (`src/watch/usage.ts:259-275`), as in C1. Confirmed anchored.

### Partially Accepted
- (none)

### Rejected
- (none for design; the five re-decided literals Req 1.5/3.3/4.2/6.4/7.3 were ruled
  refinement in r1 and are CLOSED — do not re-open.)

### Unresolved (raised r2, awaiting response)
- **R2-1 (SHOULD_FIX, Novel)** — Brief-template refactor (C6) under-accounts for the existing
  `briefAction` test suite. Of 18 brief tests in `src/tools/__tests__/harness.test.ts` the
  design names only the drift guard (491-504) and mis-describes it (it checks `codeGraphSection`
  parity, not per-kind text). The `{{key}}`→`render()`+`required[]` change reimplements every
  "kept" behaviour (all-missing message, agent-rules drop, redTests TDD gate, graph none/absent
  byte-identity, per-kind graph append), and every kind's value contract changes, invalidating
  ~10 tests. Testing Strategy's "one snapshot per kind" doesn't cover the conditionals.
- **R2-2 (MUST_FIX, carried, Novel)** — Error Handling item 1 names a "no usage line" branch
  producing `SpawnSources.ok:false` with a `reason`, but the union (design.md:210) has only
  `no-agent-id|no-session|invalid-id|missing|unreadable`; `breakdownTranscript` null (readable
  file, no usage) maps to none. Discriminant unstated / enum vs error-handling contradiction.

## Patterns & Themes
- The document's *code citations* are reliably accurate (verified across two rounds: usage fold
  ranges, reduceSpawn, tokenCell, readUsage dedup, cacheFields ephemeral fields). Weaknesses are
  in *completeness at the seams*, not false claims: r1 found a dangling data field; r2 finds a
  missing error discriminant and an under-specified test-migration plan.
- The "keeps its behaviours" shorthand (C6) hides real reimplementation cost. When a refactor
  changes the mechanism (string `{{key}}` → `render()`), the kept behaviours need re-stated tests.
- Deltas have been clean both rounds — no fix-induced regressions so far.

## Guidance for Next Review
- Confirm the r2 fixes: (a) a `reason` member for "no usage line" (or an explicit fold) and
  consistency between Error Handling item 1 and the `SpawnSources` union; (b) a brief-test
  migration statement naming which behaviours are ported and how they are tested under `render()`.
- Already verified against code/probes (don't re-spend): C1 fold ranges (116-124, 137-155,
  259-275, 290-296, 365-367, 403-457), readUsage last-line dedup (68-98), cacheFields ephemeral
  fields (40-66), the W/base/fs probes (r1), the `round`/`task.done` phase-key asymmetry, the C9
  report-bullet citations, `formatUsageTable` has no external consumer, `sync-plugin-assets.cjs`
  handles `briefs.md` deletion.
- Closed, do not re-open: the five re-decided literals (refinement, r1); R1-1/R1-2/R1-3 fixes
  (verified clean, r2); the W-column test churn (accounted); the plugin-mirror deletion (handled).
- Fresh lenses not yet used (candidates for round 3): the `book.sh` idempotency algorithm
  against concurrent/duplicate rows end to end; the C6 `render()` per-kind conditional logic
  (phase/D) feasibility; whether `append` mode's "fails on a missing target" interacts with the
  reviewer/checker write-over-prompt flows.
