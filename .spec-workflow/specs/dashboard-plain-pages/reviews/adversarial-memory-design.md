# Adversarial Review Memory — design
Last updated: 2026-11-14 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1→fixed v2):** C7 check 4 missing-record 404 now pins
  `{ error: 'Deferral not found' }` (matching check 3). Verified against live code (`get`/`fileExists`
  split; 409 reindex arm cites `deferral-storage.ts:196-199` correctly). Closed.
- **R1-2 (SHOULD_FIX, v1→fixed v2):** C6 fit guard now requires `remaining != null`; torn/missing
  `tasks.md` falls to "not known yet" instead of a bogus "fits". Consistent with C6 post-condition and
  Reliability NFR. Closed.

### Partially Accepted
- none

### Rejected
- none

### Unresolved
- none

## Patterns & Themes
- v2 delta was exactly the two round-1 fixes; both verified clean with no regression introduced.
- The document is citation-accurate across both reviews: ledger `run` field, `totalW` privacy,
  `RateLimitWindow` shape, and the deferral-storage error ranges all hold under direct probing.
- Only residue is one MINOR: C7 check 4b ("409 with the reindex message") leaves the `{ error: … }`
  wrapper implicit where siblings spell it. Established pattern makes intent unambiguous; not a defect.

## Guidance for Next Review
- Design is converged (0/0). No further design round needed unless the document is re-opened.
- Carry into tasks review (not design defects): name `new DeferralStorage(project.projectPath)` as the
  route's storage construction, and make the 404-unknown-id resolve test assert the `error` body (C10
  reads `reply.error`); optionally pin the check-4b `{ error: <reindex message> }` wrapper explicitly.
- Well-covered, do not re-examine: C2/D13 run-id + type widening, Data-Models completeness, the fit
  formula and its guards, the full C7 branch table, D25/D20 flagged departures.
