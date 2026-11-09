# Adversarial Review Memory — requirements

Last updated: 2026-11-08 (after v2 review)

## Cumulative Findings Summary

### Accepted
- R1-1 (v1, SHOULD_FIX): security escalation matched both R5 AC 6 and AC 7. Fixed in v2 —
  AC 7 excludes `id == security` and states AC 6 takes precedence.
- R1-2 (v1, SHOULD_FIX): R4 diff-route success had no `state`/payload. Fixed in v2 — AC 2
  names state `ok` and a `commits` response array.
- R1-3 (v1, SHOULD_FIX): R1 AC 1 tagged the new full-width view as a base invariant. Fixed
  in v2 — split into base swap/link/hidden-board invariant + red-first ruling-view content.
- R1-4 (v1, MINOR): R5 AC 7 was silent on the answer form for a taskless escalation/error.
  Fixed in v2 — "SHALL still show the answer form".
- R1-5 (v1, MINOR): R2 AC 12 pushed unused `commits` on the wire. Fixed in v2 — wire gains
  `detail` + question `task` tag only; `commits` stays server-side for the diff route.

### Partially Accepted
- (none)

### Rejected
- v1 lint L-7..L-28 and v2 lint L-1..L-22: backticked design terms / new fields / wait
  kinds / symbols cited elsewhere; citations correctly anchor the symbol or behaviour.
  Closed by the Revision History — do not re-open.

### Unresolved
- (none — v2 is converged: MUST_FIX 0, SHOULD_FIX 0)

## Patterns & Themes
- The document is unusually well-grounded; every delta-touched citation re-verified
  accurate at both ends. Round-1 defects were all completeness/precedence gaps in the
  kind-dispatch and the one new wire contract (diff route), never false codebase claims.
- The v2 delta is a clean application of all five round-1 fixes plus the lint pass, with no
  fix-induced regression. The decisions-trim and prose removals dropped no requirement.
- Lenses used so far: wire contracts (R1); testability + cap/length cross-AC consistency
  (R2). Both now exhausted on this document.

## Guidance for Next Review
- Only a MINOR remains: R4 AC 9 enumerates "every state of AC 5-8" and omits the `ok`
  success state introduced by the R1-2 fix (form still renders via R3 AC 1, so not a hole).
  A reviser may tidy it; it does not keep the loop alive.
- Well-covered, do not re-examine: the R5 kind-dispatch precedence, the R4 diff-route
  response contract, the R1 AC 1 invariant split, the D4/R2 AC 8/R4 AC 4 cap values, every
  citation touched by the v1 and v2 lint passes.
- If a v3 is forced, the only unused lens left is operational failure-mode sequencing
  (wait answered/closed between view-open and diff-fetch; answered-but-still-listed waits
  hitting the diff route) — low yield, the Reliability NFR already covers the blocking case.
