# Adversarial Review Memory — design
Last updated: 2026-10-19 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — C1 miscounted the `evaluate` unreadable early returns as four; there
  are five (298, 304, 312 no-headRefOid, 316, 320). v2 fixed: C1 says "five", names the 312
  branch, reads `mergeable` at parse so it is present on 312/316/320, Error Handling case 2 pins
  all three. Verified against merge.ts:297-321 in r2. RESOLVED.
- **R1-3 (MINOR, v1)** — owner filter state not in the `items` useMemo deps. v2 added
  `activeOwners` to the deps array (DeferralsPage.tsx:103) and the reset effect (:106). RESOLVED.

### Partially Accepted
- **R1-2 (SHOULD_FIX, v1)** — D9/C8 nulled a `0` baseline (regex `[1-9]\d*`), diverging from
  R3 AC9 which keeps the integer value (0 is an integer). Reviser could not amend requirements
  or file a deferral (out of scope), so conformed the design instead: regex `\d+` keeps `0`,
  only the percentage is nulled when baseline not positive. Baseline value now conforms
  (requirements.md:66). RESOLVED for the value; residual R2-1 (MINOR) on display/trend.

### Rejected
- (none)

### Unresolved
- **R2-1 (MINOR, v2, Compounding→R1-2)** — a `0` baseline shows `no baseline` in the table %
  column but the trend may still draw a `trend-baseline` line at y=0 ("project that has a
  baseline"). Harmless, degenerate input, not a contradiction. Not raised to reviser as blocking.

## Patterns & Themes
- The design is exceptionally well-grounded: every delta citation re-verified accurate at both
  ends across two rounds; all library-capability claims probed (gh 2.95.0 exact; FileCache
  methods; buildUsageReport/parseHandoffPhaseRows/spec-rows walk).
- Both real defects sat at numeric/enumeration edges of the merge read and the baseline, not in
  architecture. Both are now closed. The remaining r2 item is a degenerate-input display nit.

## Guidance for Next Review
- If a v3 appears, re-check only R2-1's disposition (did the trend wording gain a non-positive
  guard?) as a fix-induced re-check. Nothing else is open.
- Do not re-open (all verified sound across r1/r2): the lint-pass citations; D1 evaluate split
  and the two exact toEqual; D6 frontmatter byte-identity; C2 branch-save persistence; done-runs
  on the wire; FileCache/spec-rows reuse in C9; the e2e marker change (Row clips overflow).
- Closed by ruling: none. R1-1, R1-2, R1-3 are resolved in v2 and recorded in the Revision
  History — do not re-raise without new evidence (Recurring only).
