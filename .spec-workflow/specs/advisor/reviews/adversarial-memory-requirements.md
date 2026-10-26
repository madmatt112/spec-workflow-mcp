# Adversarial Review Memory — requirements

Last updated: 2026-10-26 (round 1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- R1-1 (SHOULD_FIX) — Two-credential auth contract (advisor cred reads+stages, refused 401 at
  confirm; only operator browser session confirms — Req 6 AC 4, Req 7 AC 2, D2, Security NFR) is
  cited against a single-secret, no-scope access layer (`isAuthorized`/`makeRequireAccess`/
  `loadOrCreateSecret`, access.ts), and §17 says "no roles." Req 7 AC 2 "sits under
  makeRequireAccess" implies no new auth logic. Risk: implementer reuses the operator secret for
  the advisor → self-confirm hole D2 exists to close.
- R1-2 (SHOULD_FIX) — Typed second-opinion picks (Req 5 AC 2/AC 8, D5) must cross four sites that
  all carry `advice?: string` today (state.ts:176, shell/types.ts:151, dashboard_frontend
  types.ts:172, NowPage.tsx:534) plus `attachAdvice(id, advice: string)` (waits.ts:119). New
  field unnamed; not required across all boundary sites. Risk: dashboard silently shows no picks.
- R1-3 (SHOULD_FIX) — "The home event log" (Req 5 AC 6 advisor.opinion, Req 6 AC 5 advisor.action,
  Req 10 AC 5 push-failure) is undefined: no path/schema/v:1, absent from the Reliability
  new-home-records list, no such log in code (per-run harness-events.jsonl is /tmp scratch). Only
  cited write helper is whole-file writeJsonAtomic — cannot append across writers.

## Patterns & Themes
- Weakness clusters at the dashboard-server ↔ advisor boundary: auth scope, the wait wire shape,
  and the audit sink are each under-specified where the document leans on an existing single-
  purpose artifact (one secret, a `string` advice field, a whole-file atomic writer) to carry a
  new, richer contract.
- Intent is sound throughout (security posture, invariants) — gaps are mechanism/contract
  completeness, not wrong goals.

## Guidance for Next Review
- Citation audit is fully clean as of v1 — do not re-audit every artifact; spot-check only lines
  the reviser changes.
- The delta this round (RunStatus citation) was clean.
- Next fresh lens candidate: data lifecycle / failure modes (search index staleness and deletion,
  push retry/idempotency across restart, second-opinion step with no run worktree).
- If the reviser adds a second credential, re-check that the confirm AND login routes reject it
  and that loopback reads of the advisor endpoint still require it (makeRequireAccess exempts
  loopback non-controller GETs, access.ts:166-171).
