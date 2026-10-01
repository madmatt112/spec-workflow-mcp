# Verification evidence — harness-control-pane

These lines run against the merged checkout after `npm run build` and a session
restart, because they need a real `claude -p` run; the retrospective phase
requires every line below to read `passed` before it opens.

- (1) passed — The Harness page lists the routed spec and shows each role's declared model. Evidence 2026-09-29 (overwatch subagent, isolated dashboard): every role card showed its declared model.
- (2) pending — Launching with `sonnet` overriding one role appends `run.start` with the override within five seconds, the page updates live, and the spawn row shows the actual model.
- (3) pending — Pressing Stop appends `run.end`, removes the run's pointer line, and a second launch is refused with the live run id.
- (4) pending — A `--watch` session on the same store shows the same phase, spawn and ticker rows as the page.
- (5) pending — A terminal run started with no `harness-run.json` produces a ledger with the pre-spec event types and keys per row.
- (6) passed — `npx tsc --noEmit`, `npm run build` and `npm test` pass and the Harness and Overview pages are usable at 375 px in browser device mode. Evidence 2026-09-29 (overwatch subagent): tsc and build exit 0; npm test 1721 passed after `npm install` synced toon 0.8.0 to 4.1.1; both pages usable at 375 px with no horizontal scroll.
- (7) passed — The Overview shows two projects, a `gate-a` row reaches "waiting" within five seconds, and a to-do change and delete push through. Evidence 2026-09-29 (overwatch subagent, isolated dashboard): Overview showed 2 projects; gate-a row reached waiting in 482 ms; to-do edit and delete pushed live in about 490 ms.
- (c1) passed (0) — npm run check:plugin-assets
- (c2) passed (0) — claude plugin validate . --strict
- (c3) passed (0) — node scripts/sync-plugin-assets.cjs leaves no diff
