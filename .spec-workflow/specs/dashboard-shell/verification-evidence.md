# Verification evidence — dashboard-shell

An operator runs the four decomposition checks below in a rebuilt, restarted dashboard with the four registered projects.

- (1) passed (overwatch, 2026-10-07, isolated dashboard on port 5599 with the four real spec stores copied in as registered projects; Now showed two live runs — swm/dashboard-shell implementation and tradr/trading-rules requirements — the idle jobsync with its routed spec mcp-write-tools, and Recently closed (8); a `phase.end` result gate-a appended to tradr's live ledger surfaced under Waiting on you with no reload, measured 4135-4187 ms over the websocket (<5 s), screenshot /tmp/claude-1000/-home-mcf-repo-spec-workflow-mcp/a9feef33-db1b-4dd8-b194-aca8cd7de099/scratchpad/dash-live/shots/check1-now-gate-a-appeared.png)
- (2) passed (overwatch, 2026-10-07, swm run page matched `node dist/index.js --watch <copied store> --spec dashboard-shell --once` — same phase strip, same two open spawns (sdd-implementation-orchestrator, sdd-implementer task 7) and 16/16 task table; an appended ledger row appeared in the Ledger tab with Follow on and no reload, screenshot /tmp/claude-1000/-home-mcf-repo-spec-workflow-mcp/a9feef33-db1b-4dd8-b194-aca8cd7de099/scratchpad/dash-live/shots/check2-run-page-swm.png)
- (3) partial: disabled-reason verified; launch-start left to the operator (overwatch, 2026-10-07, the harness setup API returns the routed spec and setup the card renders — jobsync launchable mcp-write-tools, supervisor claude-opus-5-5, 13 roles, worktree no, gates block; with a scratch live run added on launchable jobsync the now-model `live` includes it, so the card's Launch is disabled with reason "A run is live for this project." per RunsPage.tsx:176-184,234; the enabled Launch was not pressed, screenshot /tmp/claude-1000/-home-mcf-repo-spec-workflow-mcp/a9feef33-db1b-4dd8-b194-aca8cd7de099/scratchpad/dash-live/shots/check3-runs-live-runs.png)
- (4) passed (overwatch, 2026-10-07, Specs panel for the closed swm spec harness-control-pane showed its two runs (run-20260928-191959 and run-20261001-202525 with start/end/status/tokens), the full phase table (requirements v1 gate-a through closeout items 18/19 closed) and 14 files with Copy path, screenshot /tmp/claude-1000/-home-mcf-repo-spec-workflow-mcp/a9feef33-db1b-4dd8-b194-aca8cd7de099/scratchpad/dash-live/shots/check4-specs-panel-closed-spec.png)

## Invariants (check 5a, run on this branch)

`BASE` is the merge base of `HEAD` and `main`. `/tmp/scratchpad/sdd/dashboard-shell/invariants.sh`
ran and printed no violation for (a), (b) or (c):

- (a) `git diff --name-only BASE HEAD` lists nothing under `src/watch/` or `harness/`, and not `src/dashboard/harness/overview-watch.ts`.
- (b) the diff of `src/dashboard/harness/project-watch.ts` adds or removes no line that names `WATCHED_FILES` or calls `chokidar.watch`.
- (c) the route registrations in `src/dashboard/multi-server.ts` at BASE are a subset of those at HEAD.

```
BASE=2c5c968999e53d4ea17c338a5f3d0ab8a3033f52
HEAD=926112a949902b3dc17653c1050603e8ff2a30d6

== (a) src/watch/, harness/ and overview-watch.ts untouched ==
ok: no changed file under src/watch/ or harness/, overview-watch.ts unchanged

== (b) project-watch.ts keeps its WATCHED_FILES / chokidar.watch lines ==
ok: no added or removed line names WATCHED_FILES or calls chokidar.watch

== (c) multi-server.ts BASE route registrations are a subset of HEAD ==
ok: all 62 BASE registrations present among 63 HEAD registrations

RESULT: no violation for (a), (b) or (c)
```

## Full checks (check 5b) and browser suite (check 6)

Run on this branch, all green:

- `npm run build` — built the dashboard bundle and synced plugin assets.
- `npx tsc --noEmit` — no type errors.
- `npm test -- --run` — 101 test files, 1889 tests, 2 skipped.
- Check 6 is the dashboard browser suite delivered by task 14 (end-to-end integration coverage).
