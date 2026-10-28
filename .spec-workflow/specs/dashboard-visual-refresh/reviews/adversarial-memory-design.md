# Adversarial Review Memory — design

Last updated: 2026-10-28 (round 1, v1)

## Cumulative Findings Summary

### Accepted
(none yet — awaiting reviser disposition)

### Partially Accepted
(none)

### Rejected
(none)

### Unresolved
- **R1-1 (MUST_FIX)** — C6 cites `UsageTrend.tsx` lines "92, 98, 109, 116" for the SVG colour
  attributes; line 92 is `key=`/93 `data-testid`. The axis colour attribute
  `stroke="var(--border-default)"` is at line 88. Risk: axis stroke left as a presentation
  attribute (does not resolve `var()`), uncaught by T1/T4. Same slip in `codebase-context.md:91`.
- **R1-2 (SHOULD_FIX)** — T4.1 pair-selection pins only `data-tone`/`data-variant`, not the
  props the compared values depend on: Button `size` (height/padding/font-size), row selection
  state (`--surface-selected`), and the row has no `data-ui` locator. Can false-fail or be
  unwritable.
- **R1-MINOR** — active nav-row token (`ui.navRow(active)`) unnamed; safely later-phase.

## Patterns & Themes
- The design's code grounding is strong: versions, Playwright/vite API, `@theme static`
  behaviour and WCAG contrast all probed and reproduced. Weak spots are (a) one propagated
  line-number slip from the unreviewed context file, and (b) a test whose locator keys on fewer
  dimensions than the compared properties span.

## Guidance for Next Review
- Re-check only R1-1's fix diff (line 88 + "axis moves to `style`") against `UsageTrend.tsx`,
  and R1-2's fix (size + selection pinned, row locator) against Requirement 4.1 — fix-induced
  re-check, not a whole-document re-review.
- Do not re-open D2's "selector" departure (RE-DECIDED) or the lint-pass L-30/L-31/L-32 rulings.
- Contrast and `@theme static` claims are verified; do not re-probe absent new token changes.
