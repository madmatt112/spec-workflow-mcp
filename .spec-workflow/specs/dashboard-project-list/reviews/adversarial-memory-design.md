# Adversarial Review Memory — design
Last updated: 2026-10-29 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Integration test waited for a registration line the fix deletes.
  v2 waits for whichever startup line prints. Fix applied, but see R2-1 (same seam).
- **R1-2 (SHOULD_FIX, v1)** — Un-debounced watcher reconcile ran blocking git classification
  per differing entry. v2 adds a 100 ms trailing debounce; first reconcile stays direct. Clean.
- **R1-3 (SHOULD_FIX, v1)** — `removeProjectById` unregistered before forgetting, so a
  contended DELETE could re-list. v2 forgets first (lock-guarded step runs first). Clean.
- **R1-4 (MINOR, v1)** — C1 Reuses reworded: inline common-dir test + parent logic, not the
  two helpers. Clean.
- **R1-5 (MINOR, v1)** — Dropped the "illustrative" hedge from both Data Models shapes. Clean.

### Partially Accepted
- (none)

### Rejected
- (none substantive; v1/v2 lint citation re-fires suppressed per lint rule 11, recorded in
  Revision History)

### Unresolved
- **R2-1 (SHOULD_FIX, Compounding R1-1, carried)** — The new integration test asserts registry
  byte-equality *after* the server exits; at base the start-time registration is reversed by the
  shutdown unregister (`server.ts:289-290` → `unregisterProjectById`), so the red-first signal is
  fragile/incorrect (green at base when the per-worker registry file pre-exists). Assert while the
  server is alive. Testing Strategy › Integration.
- **R2-2 (MINOR)** — C3 `removeProjectById` bullet omits whether the in-memory
  `removeProject(:390)` call survives ahead of `forgetProject`; on a lock-miss throw the files
  stay whole but the in-memory row may drop until next sync.
- **R2-3 (MINOR)** — The integration test's `projects.json` byte-equal assertion is inert (the
  MCP server never writes that file in this `runCases` test).

## Patterns & Themes
- The folding core, representative/store-key consistency, the debounce and the lock reorder are
  all now verified clean. The sole live weak point is the real-server integration test's
  lifecycle: both v1 and v2 assert byte-equality after shutdown, which erases the very write the
  test means to catch. The seam R1-1 opened is still the one that bites.
- Red-first integrity (does the test actually fail at base?) is the lens to keep applying to any
  new start/stop or register/unregister test.

## Guidance for Next Review
- If R2-1 is fixed, confirm the snapshot/assert point is before stdin close and that base yields
  an added entry vs. fixed yields none — do not accept "byte-equal after exit" wording.
- Confirm the explicit new body of `removeProjectById` (R2-2).
- Do NOT re-litigate: folding algebra (C2), representative consistency (C8/C10/C12),
  R1-2 debounce, R1-3 forget-first, Data Models shapes, the vitest/tsc probe — all checked clean.
