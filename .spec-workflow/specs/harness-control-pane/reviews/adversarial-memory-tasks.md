# Adversarial Review Memory — tasks
Last updated: 2026-09-28 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1 → fixed in v2)** — Task 19 `_Prompt` cited the wrong `briefs.md`
  (drafter document-phase `## Job`, no commit-script content). v2 retargeted it to
  `harness/skills/sdd-implementation-phase/references/briefs.md:12-15`, which matches the
  `_Leverage` line and supports the commit-script instruction. Verified closed in v2.

### Partially Accepted
- (none)

### Rejected
- **L-2, L-3, L-7 (bridge-missing warnings)** — task 3 names tasks 4/7, task 6 names task
  10. Producer→consumer narrative references, not forward artefact uses. Rejected at v1,
  re-affirmed by the v2 lint pass. Do not re-raise without new evidence.

### Unresolved
- **R2-1 (MINOR, v2)** — Task 13's file-level dependency on task 12 (nav item placed
  "after the task 12 item"; both edit `App.tsx`, `PageNavigationSidebar.tsx`, `en.json`)
  is unstated in the dependency-order paragraph (line 6 groups 12 and 13 as siblings of
  10/11). Numeric order enforces it in practice; cosmetic worst case only. Not gating.

## Patterns & Themes

- Every MUST_FIX so far has been a claim/citation error introduced by the previous delta
  (the v1 lint expansion caused R1-1). The v2 delta was a single, correct citation fix and
  introduced no new defect. Continue to scope fix-induced re-checks tightly to the diff.
- The document's self-imposed invariants (line 6: "no task changes a count/length another
  file asserts"; "each edited test file is named with whether an assertion changes") hold
  under audit. Frontend edits are additive and safe: vitest excludes the frontend, the
  e2e suite is a separate `test:e2e` script with anchored nav selectors and `toHaveCount`
  only on dropdown/spec-row/approval items, no snapshot tests, no test imports locales,
  and `validate-i18n.js` checks only interpolation-variable parity (en-only keys pass).
- Non-delta code facts confirmed this round where load-bearing: `index-generator.ts`
  `generate()` structure (categorize l66, deriveRouting l67, render l68, mkdir l70, write
  l72 — task 1 ranges `:44-67`/`:68-72` accurate); `PathUtils.getIndexPath` (path-utils.ts
  :245); `IndexGenerator` constructor takes `projectPath`.

## Guidance for Next Review

- If v3 has no delta beyond an R2-1 ordering-line tweak (or none), converge; the tasks are
  implementation-ready (converged at v2, 0/0/1).
- Do NOT re-open: L-2/L-3/L-7 (bridge warnings); R1-1 (fixed); the R2-3 spawn-to-record
  window and the 409-loser (scoped/closed in design + tasks D1).
- Well-covered, no need to re-examine: coverage (C1–C10 → tasks), gate B/C, the Test:
  lines, the cost-of-touching lens over every edited file (all safe this round).
- Fresh lenses not yet used: none obvious remain; a citation-drift spot check of the
  non-delta code ranges the frontend tasks cite (e.g. multi-server.ts:1965-1988 summary
  route — one line short of the context file's 1965-1989, MINOR, untouched by v2) is the
  only loose thread, and it is not delta-related.
