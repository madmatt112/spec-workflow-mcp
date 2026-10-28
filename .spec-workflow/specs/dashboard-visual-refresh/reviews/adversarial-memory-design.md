# Adversarial Review Memory — design
Last updated: 2026-10-28 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — C6 cited line 92 for the axis SVG colour; true line is 88.
  Fixed in v2: `design.md:106` now cites 88/98/109/116; axis colour still moves to `style`.
  Verified against `UsageTrend.tsx`.
- **R1-2 (SHOULD_FIX, v1)** — T4.1 pair-selection ignored Button `size` and row selection and
  the row had no locator. Fixed in v2: UI module stamps `data-size`, `data-selected`,
  `data-ui="row"`; T4.1 keys on `data-variant`+`data-size` for the button and
  `data-ui="row"`+`data-selected="false"` for the row. Verified.

### Partially Accepted
- **R1-MINOR (v1)** — active nav-row token unnamed. v2 named `--surface-selected` /
  `--text-primary` (both declared, text-primary-on-surface-selected already in the 4.5:1 set).

### Rejected
- (none)

### Unresolved
- **R2-1 (MINOR, v2)** — Button default `size` / `data-size`-when-omitted unstated; T4.1 keys on
  `data-size`. Safely a tasks-phase value (implementer sets default, stamps unconditionally).
  Non-blocking.

## Patterns & Themes
- Code grounding is strong and stays strong: every library-capability claim (including the
  `--text-*--line-height` companion under the namespace clear) is probe-backed in
  `/tmp/scratchpad/sdd/dashboard-visual-refresh/probe/NOTES.md`. Round-1's two defects were a
  propagated line-number slip and an under-keyed test locator; both are cleanly fixed with no
  fix-induced regression. v2 delta (round-1 response + lint L-16 + D-reword) introduced no claim
  error.

## Guidance for Next Review
- The document is converged at v2 (0 MUST / 0 SHOULD). If a v3 appears, re-check only its delta.
- Do not re-open: D2's "selector" departure (RE-DECIDED); lint rulings L-30/L-31/L-32;
  C5 tone-map meaning; contrast pairs and `@theme static` behaviour (all probe-verified).
- Do not re-probe the type scale, var-shorthand, transition or `color-scheme` claims — NOTES 1–10
  cover them.
- If tasks phase is reviewed: watch the T1 red-on-base sites with no named target token
  (`min-w-[7rem]` at `RunPage.tsx:223`, the `dark:` pill sites) and the Button default-size (R2-1).
