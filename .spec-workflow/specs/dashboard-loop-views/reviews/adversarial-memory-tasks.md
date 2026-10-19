# Adversarial Review Memory — tasks

Last updated: 2026-10-19 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet

### Partially Accepted
- none yet

### Rejected
- none yet

### Unresolved
- **R1-1 (MINOR)** — T11 `_Leverage` omits `src/dashboard/harness/run-setup.ts`
  (`readAgentRules`), the baseline source; prompt body says only "the baselineWPerTask task 9
  adds". Recoverable via the cited design C9. Did not keep the loop alive.
- **R1-2 (MINOR)** — R2 AC11 (deferrals-update live refresh) not explicitly proven; T8
  reuses the existing `deferralsByProject` push unchanged, frontend has no unit suite.
- **R1-3 (MINOR)** — T12 throw-skip reliability path and T11 zero-baseline (design D9) edge
  have no Success assertion; defensive / hard to force.

## Patterns & Themes
- Citations are exceptionally accurate: every cited range checked at both ends across
  merge/state/runs, deferral storage/tool, usage parser/builder/route, and all frontend +
  test + doc anchors. No misstated artifact.
- The document separates the two D-numbering schemes correctly: tasks cite **design** D-ids
  (D1,D4,D5,D6,D8,D9,D10,D13,D14,D15), which differ from requirements' D-ids. No mis-cite.
- Ordering is forward-only; each task compiles standalone (evaluate delegation, optional
  fields, wire casts). Owner reaches the frontend for free because buildDeferralsPayload
  returns full `storage.list()` records.
- Invariants (R1 AC12/AC13, R2 AC8, no-behaviour-change extraction) are correctly routed as
  regression guards, not red-first tests.

## Guidance for Next Review
- If a v2 lands, attack the delta first. Likely delta: adding `readAgentRules` to T11
  `_Leverage` (R1-1) — scope the re-check to that one line against AC9/NFR, not a re-review.
- Do NOT re-open: the five-early-return enumeration (merge.ts 297-321), the type-only import
  cycle break (T2), the exact `toEqual` safety at merge.test.ts 171/232, the byte-identical
  reindex guard, or the e2e seed-path (`<sddHome>/runs/<id>/run.json`) — all verified sound.
- Watch-item (not a defect): e2e R1 render depends on the harness sharing `SDD_HOME` between
  seeding and server; unverifiable statically.
