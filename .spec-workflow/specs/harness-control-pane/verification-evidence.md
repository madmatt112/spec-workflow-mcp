# Verification evidence — harness-control-pane

These lines run against the merged checkout after `npm run build` and a session
restart, because they need a real `claude -p` run; the retrospective phase
requires every line below to read `passed` before it opens.

- (1) passed — The Harness page lists the routed spec and shows each role's declared model. Evidence 2026-09-29 (overwatch subagent, isolated dashboard): every role card showed its declared model.
- (2) passed — Launching with `sonnet` overriding one role appends `run.start` with the override within five seconds, the page updates live, and the spawn row shows the actual model. Evidence 2026-10-01 (sdd-sandbox run-20261001-201124, sdd-drafter set to sonnet): run.start carried overrides=sdd-drafter:sonnet:anthropic and setup=harness-run; rows reached the page live; the drafter spawn.end read model claude-sonnet-5-5.
- (3) passed — Pressing Stop appends `run.end`, removes the run's pointer line, and a second launch is refused with the live run id. Evidence 2026-10-01 (same run): a second launch returned 409 run-live naming run-20261001-201124; Stop appended run.end "stopped from the dashboard" at 20:15:04Z, removed the pointer line and harness-run.json.
- (4) passed — A `--watch` session on the same store shows the same phase, spawn and ticker rows as the page. Evidence 2026-10-01 (same run): Matthew compared --watch with the page side by side; phase, spawn and ticker rows matched.
- (5) passed — A terminal run started with no `harness-run.json` produces a ledger with the pre-spec event types and keys per row. Evidence 2026-10-01 (sdd-sandbox run-20261001-201959, terminal, no harness-run.json): run.start keys model, specStore, codeRoot, worktree, headless, providers, cacheTtl; spawn.start keys agent, role, phase; no overrides or setup key.
- (6) passed — `npx tsc --noEmit`, `npm run build` and `npm test` pass and the Harness and Overview pages are usable at 375 px in browser device mode. Evidence 2026-09-29 (overwatch subagent): tsc and build exit 0; npm test 1721 passed after `npm install` synced toon 0.8.0 to 4.1.1; both pages usable at 375 px with no horizontal scroll.
- (7) passed — The Overview shows two projects, a `gate-a` row reaches "waiting" within five seconds, and a to-do change and delete push through. Evidence 2026-09-29 (overwatch subagent, isolated dashboard): Overview showed 2 projects; gate-a row reached waiting in 482 ms; to-do edit and delete pushed live in about 490 ms.
- (c1) passed (0) — npm run check:plugin-assets
- (c2) passed (0) — claude plugin validate . --strict
- (c3) passed (0) — node scripts/sync-plugin-assets.cjs leaves no diff
