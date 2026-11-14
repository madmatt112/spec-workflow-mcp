# Adversarial Review Memory — design

Last updated: 2026-11-14 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet (round 1)

### Partially Accepted
- none

### Rejected
- none

### Unresolved
- **R1-1 — MUST_FIX [design].** C7 resolve route, check 4: the missing-record arm
  (`storage.get` null + `fileExists` false → 404) states only the status, no `error` body,
  while every sibling branch pins one. Reachable in the resolve race; C10 then renders a blank
  reason. Fix: `{ error: 'Deferral not found' }` (match check 3).
- **R1-2 — SHOULD_FIX [design].** C6 fit guard omits `remaining != null`. With `done ≥ 1`,
  `use > 0`, live window, but a torn/missing `tasks.md` (`remaining` null), `use/done × null`
  → 0 ≤ headroom → bogus "fits". Contradicts the Reliability NFR and C6's own post-condition.
  Fix: fall to `null` ("not known yet") when `remaining` is null.

## Patterns & Themes

- The document is citation-accurate: every lint-pass-changed citation in the diff verified against
  live code, and the load-bearing C2 run-id/type-widening mechanism holds under direct probing
  (`runId: ctx.run.id` is set in all five phases + gates). Do not re-litigate C2/D13.
- Both open findings are *edge-case completeness* gaps in otherwise-complete contracts — one
  missing error body among six branches, one missing null-guard in an otherwise-guarded formula.
  The design pins shapes well in the common case; attack the corners.
- Flagged departures (D25 double decomposition read; D20 passed-reset fit) are defensible and
  should not be re-raised as defects.

## Guidance for Next Review

- Confirm R1-1 added the 404 body and R1-2 added `remaining != null`; scope each check to the
  fix diff against its requirement (fix-induced re-check), not a whole re-review.
- If v2 changes C7's check ordering or the fit formula, re-verify the error-branch discriminants
  and the fit guard against the Reliability NFR.
- Non-finding to carry into tasks review (not a design defect): C7 does not state how the route
  constructs `storage`; the tasks phase should name `new DeferralStorage(project.projectPath)`
  and make the 404-unknown-id test assert the `error` body.
- Rejected/closed: none to date.
