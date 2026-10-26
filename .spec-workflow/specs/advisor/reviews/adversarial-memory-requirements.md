# Adversarial Review Memory — requirements

Last updated: 2026-10-26 (after v2 review)

## Cumulative Findings Summary

### Accepted
- R1-1 (SHOULD_FIX, v1) — Two-credential auth contract cited against a single-secret,
  no-scope hook. Resolved in v2 Req 7 AC 2: hook extended with a second advisor
  credential (distinct from the operator secret), per-route scope (endpoint accepts it;
  confirm + login routes refuse 401), endpoint under `/api/controller/` so the loopback
  non-controller-GET exemption (access.ts:171) does not apply; §17 "no roles"
  superseded. Verified mechanically correct against access.ts.
- R1-2 (SHOULD_FIX, v1) — Typed second opinion not threaded across the wait boundary.
  Resolved in v2 Req 5 AC 2: new field `opinion` beside legacy `advice`, threaded
  through WaitRecord (state.ts:162-178), both wire types (shell/types.ts:151,
  dashboard_frontend types.ts:172), `attachAdvice` signature (waits.ts:118-126) and the
  render (NowPage.tsx:534). Verified.
- R1-3 (SHOULD_FIX, v1) — "The home event log" undefined, only cited helper cannot
  append. Resolved in v2 Reliability: `events.jsonl` in home, JSONL, each row v:1 + time
  + type (advisor.opinion/advisor.action/push.failure), appended line-at-a-time not via
  writeJsonAtomic. Verified writeJsonAtomic (state.ts:297-303) is temp+rename, cannot
  append.

### Partially Accepted
- (none)

### Rejected
- Usage threshold value, the two usage-window names, and the cross-process push trigger
  (round-1 MINORs) — rejected in v2 as design/config choices below requirements
  altitude (Revision History v2). Do not re-raise without new evidence.

### Unresolved
- (none)

## Patterns & Themes
- The v1 weakness cluster (dashboard-server ↔ advisor boundary: auth scope, wait wire
  shape, audit sink) was fully and faithfully closed in v2 without introducing a new
  contradiction or claim error — the fixes stated contracts at the right altitude rather
  than over-specifying mechanism.
- Citation discipline remains perfect: every artifact the v2 delta re-cited matches the
  code at both ends of its range.

## Guidance for Next Review
- Requirements is converged as of v2 (0 MUST_FIX / 0 SHOULD_FIX, DESIGN_READY: yes). No
  further requirements round is needed unless the document changes.
- Do not re-audit citations — v1 and v2 are both clean. Spot-check only lines a later
  edit changes.
- Items correctly deferred to design (watch for them when design is reviewed): advisor
  credential create/inject mechanism; the confirm route's concrete path and
  operator-session gating; event-log O_APPEND / per-line size bound for cross-process
  append safety; the usage threshold value and the two usage-window names; the
  controller-side non-`waitEvents` trigger for cross-process wait pushes.
