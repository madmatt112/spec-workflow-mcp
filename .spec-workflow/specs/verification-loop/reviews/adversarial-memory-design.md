# Adversarial Review Memory — design

Last updated: 2026-10-21 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet (round 1 is MINOR-only; the reviser may fold them or leave them).

### Partially Accepted
- none.

### Rejected
- none.

### Unresolved
- **R1-1 (MINOR)** — C6's "after each verifier step and fix round" counts-note rule
  undercounts the adjudicate step; the adjudicator note is required by Data Models,
  R3 AC 12 and `readSecurityState`'s `adjudicator`→`recheck-adjudicated` transition.
  Wording only.
- **R1-2 (MINOR)** — security deferral `create` fields beyond `body.context`
  (title, revisitTrigger, supersedes, body.decision/revisitCriteria) unpinned;
  template at implementation.ts:893-901.
- **R1-3 (MINOR)** — merge-fix blocked resume path specifies only the window
  outcome; cancelled and cap-exceeded outcomes left implicit (mirror runOnce).
- **R1-4 (MINOR)** — `findings` value for the `merge` fix variant unspecified though
  the `fix` template requires the key.
- **R1-5 (MINOR)** — buildPrBody's source for the accepted-finding command is
  implicit (the `security: accepted <json>` note).

## Patterns & Themes
- The document is exceptionally well-grounded: every one of ~40 code citations
  verified accurate at both ends, the gh 2.95.0 `baseRefName` probe confirmed live,
  and the `{ ready: true, reasons: [] }` test invariant holds. The lint commit's
  range/path corrections are all correct.
- The weak spots are prose that is terse where three state-machine stages, a
  required template key, or a required record field need naming — not interfaces or
  data shapes, which are pinned.
- The v2→v3 e2e-pass-stands fix (R3 AC 13 / D16) survives the resume lens.

## Guidance for Next Review
- If a v2 lands, re-check only the diff for these five MINORs; do not re-review the
  whole document. Citations are verified — re-verify a citation only if its line
  range moved in the v2 diff.
- The `readSecurityState` 8-value state machine is the densest surface; if the
  reviser touches it, re-trace pass→fix×2→adjudicate→recheck-adjudicated→escalate
  for stage-note advancement (R1-1).
- Closed by ruling: none. No findings rejected yet, so nothing is barred from
  re-raising.
