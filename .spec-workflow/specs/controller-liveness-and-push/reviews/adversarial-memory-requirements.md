# Adversarial Review Memory — requirements

Last updated: 2026-11-03 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting revision)

### Partially Accepted
- (none)

### Rejected
- (none; lint pass L-1..L-22 rejections recorded in the document's Revision History, not re-opened)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Req 2 AC 1: `driven` truth-source is the controller's in-memory `active`/`drives`/`resumeTimers` (`controller.ts:75-78`) but the row is pinned to `toRow`/`listRunsForWire` (`runs.ts:1429-1444`, pure over the disk record) and the shell feed (`shell-feed.ts:38-46`) holds no controller handle; cross-process (no-lock dashboard) case unaddressed; persisting to `run.json` reintroduces the stale-running bug. Provenance of `driven` at both the GET route and the feed boundary is unspecified.
- **R1-2 (SHOULD_FIX)** — The run row is three hand-mirrored shapes: `ControllerRunRow` (`runs.ts:1410-1427`), `ControllerRun` (`dashboard/shell/types.ts:194-210`), `ControllerRun` (`dashboard_frontend/.../shell/types.ts:215-233`). Doc names only the first; `driven`/`lastActivity` must land on all three or the client can't read them typed. Server copy already lacks `pauseRequested` (drift evidence). Req 2 AC 2 "dashboard derives stalled" has no renderer in scope (D6 defers rendering) and the e2e verifies the wire row, not a rendered dashboard → AC 2 untestable here.
- **R1-3 (SHOULD_FIX)** — Req 4 AC 2 "`push.json` SHALL no longer be read" migrates only `push.ts`; `summary.ts:93-100` `pushState()` is a second reader. Post-migration (D2: old file not on operator machine) the advisor hello reports push "off" while push is on. Falsifies D2's "one path to test."
- **R1-4 (MINOR)** — Req 4 AC 3: ntfy `<url>/<topic>` publish takes a plain-text body; the message carrying four fields is not stated as plain text nor given a composition rule; current sender posts a JSON body. Largely design-deferred (title/priority/auth already deferred).

## Patterns & Themes
- The spec's whole hazard is one axis: **liveness is live in-process controller state, and every wire/consumer boundary reads from disk.** `driven` (R1-1), the client mirrors (R1-2), and the push config reader (R1-3) are all cases of "the fact lives in one place, the reader is elsewhere." The design must name the data path across each boundary, not just the field.
- Requirement cites are accurate throughout (no misstated artifacts in round 1). Weakness is in unstated data-flow/scope, not wrong line ranges.

## Guidance for Next Review
- Fresh lens used this round: wire contracts (router/response/client state). For round 2, consider the **failure/restart lens**: heartbeat race on terminal writes, reminder scheduling across restart (Req 5 AC 4-6) vs the pusher's current purely file-watch design (no timer today, `push.ts:139-143`), and the drive-crash wait discriminator (the "question id design names it") surviving a restart recover (`controller.ts:304-317`).
- Verify any revision of R1-1 against whether the chosen data path reintroduces a stale `driven` after a controller crash.
- Do not re-open lint L-1..L-22 or any ruling in the Revision History without new evidence (mark Recurring).
```
