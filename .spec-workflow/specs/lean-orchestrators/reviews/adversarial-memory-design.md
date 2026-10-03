# Adversarial Review Memory — design
Last updated: 2026-10-03 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — `QueuedTask.testFiles`/`integration` had no consumer. v2 cut
  both and the paragraph. Verified clean (r2).
- **R1-2 (MINOR, v1)** — `compareSources` shape unstated. v2 pinned `data.sources` as
  `SourcesReport`, `data.compareSources` as `SourcesReport | null` (design.md:215).
- **R1-3 (MINOR, v1)** — `listSpawns` W-source wording. v2 points it at the token-setting
  row (`src/watch/usage.ts:259-275`). Confirmed anchored (r2).
- **R2-2 (MUST_FIX, v2)** — "no usage line" branch had no discriminant. v3 added `no-usage`
  to the `SpawnSources` union (design.md:210) and rewrote Error Handling item 1 to map six
  conditions to six reasons (design.md:219). Verified clean in r3: producer
  (`breakdownTranscript` null), consumer (block/header/`success:true`), and the truth table
  all balance. CLOSED.
- **R2-1 (SHOULD_FIX, v2) — test-accounting half only.** v3 named the real existing brief
  tests (all-missing, agent-rules drop, taskBlock, redTests gating, graph) and corrected
  the drift-guard description + citation (491-504). Verified in r3. The conditional-coverage
  and authorFiles/authorReport halves were NOT closed — see R3-1, R3-2.

### Partially Accepted
- (none)

### Rejected
- (none for design; the five re-decided literals Req 1.5/3.3/4.2/6.4/7.3 were ruled
  refinement in r1 and are CLOSED — do not re-open.)

### Unresolved (raised r3, awaiting response)
- **R3-1 (SHOULD_FIX, Compounding R2-1, fix-induced)** — "one `render()` snapshot per brief
  kind" (design.md:235) tests one branch per kind, but C6 renders "phase and D conditionals"
  (design.md:100) and reviser/verifier/fix carry 4-5 variants each (design.md:107,113,114).
  The source templates branch heavily (briefs.md: 13 `<D=1>`/`<D>1>`/variant/phase markers,
  e.g. 180-202, 294-296, 283-284). Variant branches ship untested. This is the exact
  sub-concern r2's R2-1 raised; the v3 fix left it.
- **R3-2 (SHOULD_FIX, Compounding R2-1)** — implementer brief consumes `authorFiles`/
  `authorReport` (design.md:99,111) but C9 says the orchestrator passes only
  `findings`/`folds`/`notes`/`re-decided` paths unread and reads only `checks-file`
  (design.md:185), and the test-author reports only `commit`/`tests`/`folds`/`flag`/`retro`
  (design.md:182) — neither value has a producer or a passthrough slot. Seam left open by
  the v3 redTests→authorFiles/authorReport re-point.

## Patterns & Themes
- Code citations remain reliably accurate across three rounds (usage fold ranges,
  reduceSpawn, readUsage dedup, cacheFields, orient `tasks.total`/`nextStep`, the brief
  action, the drift-guard test). Weakness is consistently at the *seams and completeness*,
  not false claims.
- The brief-template refactor (C6) is the recurring soft spot. Each round finds a different
  consequence of the `{{key}}`→`render()`+`required[]` change: r2 the test under-accounting;
  r3 the untested conditional branches (R3-1) and an input value with no producer (R3-2).
  "Keeps its behaviours" / "one snapshot per kind" keep hiding per-variant work.
- Deltas remain free of *regressions* (R2-2 is fully clean; the R2-1 test-accounting half is
  clean). The open items are halves of R2-1 the accept note did not touch, not new breakage.

## Guidance for Next Review
- Confirm the R3 fixes: (a) a snapshot/test plan that names coverage per rendered variant
  and phase/D branch (not one per kind); (b) a producer + passthrough wire for
  `authorFiles`/`authorReport` across test-author → orchestrator → implementer.
- Already verified, do not re-spend: R2-2 `no-usage` seam (both ends, truth table balanced);
  the R2-1 test-accounting/drift-guard half (tests real, 491-504 accurate); C1 fold ranges
  (116-124, 137-155, 259-275, 290-296, 365-367, 403-457); readUsage last-line dedup;
  cacheFields; the W/base/fs probes; orient `nextStep`/`tasks.total` vs C5/C8/C10;
  `sync-plugin-assets.cjs` handles `briefs.md` deletion; `formatUsageTable` has no external
  consumer; the five re-decided literals (CLOSED, r1).
- Fresh lenses not yet used (round-4 candidates): the `book.sh` idempotency algorithm end to
  end against duplicate/concurrent rows; the `append` mode's "fails on a missing target"
  against the reviewer/checker write-over-prompt flows; whether every brief kind in the C6
  table has a producer for each of its listed values (R3-2 may have siblings).
