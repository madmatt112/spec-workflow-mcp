# Verification evidence — harness-control-pane

These lines run against the merged checkout after `npm run build` and a session
restart, because they need a real `claude -p` run; the retrospective phase
requires every line below to read `passed` before it opens.

- (1) pending — The Harness page lists the routed spec and shows each role's declared model.
- (2) pending — Launching with `sonnet` overriding one role appends `run.start` with the override within five seconds, the page updates live, and the spawn row shows the actual model.
- (3) pending — Pressing Stop appends `run.end`, removes the run's pointer line, and a second launch is refused with the live run id.
- (4) pending — A `--watch` session on the same store shows the same phase, spawn and ticker rows as the page.
- (5) pending — A terminal run started with no `harness-run.json` produces a ledger with the pre-spec event types and keys per row.
- (6) pending — `npx tsc --noEmit`, `npm run build` and `npm test` pass and the Harness and Overview pages are usable at 375 px in browser device mode.
- (7) pending — The Overview shows two projects, a `gate-a` row reaches "waiting" within five seconds, and a to-do change and delete push through.
- (c1) pending — npm run check:plugin-assets
- (c2) pending — claude plugin validate . --strict
- (c3) pending — node scripts/sync-plugin-assets.cjs leaves no diff
