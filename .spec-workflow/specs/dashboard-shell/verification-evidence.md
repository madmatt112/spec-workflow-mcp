# Verification evidence — dashboard-shell

An operator runs the four decomposition checks below in a rebuilt, restarted dashboard with the four registered projects.

- (1) pending — The Now page with two live runs, the idle project and closed specs.
- (2) pending — The run page against `--watch` on the same store with the Ledger tab following.
- (3) pending — Launch from a card and its disabled reason while a run is live.
- (4) pending — The Specs panel of a closed spec with two runs, its phase table and its files.

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
