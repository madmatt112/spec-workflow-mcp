# Adversarial Analysis — controller-liveness-and-push/requirements (v2, round 2)

## Deltas since v1 — all clean

The v2 delta exists to land R1-1..R1-4 (Revision History, v2). I re-verified every artifact the delta touched, both ends of each range:

- **Req 2 AC 1 rewrite (R1-1/R1-2).** `src/dashboard/multi-server.ts:809-811` is the bare `GET /api/controller/runs` returning `listRunsForWire()` with no `request`/`reply` — correct. `src/dashboard/shell/shell-feed.ts:38-46` is the constructor taking `ProjectManager`, a `send` callback and timing opts, no controller handle — correct. The three run-row shapes resolve: `ControllerRunRow` (`src/controller/runs.ts:1410-1427`, carries `pauseRequested?` at :1419), `ControllerRun` (`src/dashboard/shell/types.ts:194-210`, **does not** carry `pauseRequested` — the "server copy already drifts" claim is accurate), `ControllerRun` (`src/dashboard_frontend/src/modules/shell/types.ts:215-233`, carries `pauseRequested?` at :227). The drift claim lands on the right copy.
- **Req 4 AC 2 rewrite (R1-3).** `src/advisor/summary.ts:93-100` is `pushState()`, which does `fs.access(pushConfigPath())` and returns `'on'`/`'off'` — exactly the second reader R1-3 named. Correct.
- **Req 1 AC 9**, **D10**, **Introduction trim**, **Scope-note trims (R1-4)** are consistent re-pointers to the above. No new artifact introduced a claim error.

No MUST_FIX from the delta. R1-1..R1-4 are faithfully dispositioned and closed.

## Fresh lens this round — restart / reminder (Requirement 5)

No prior round touched Requirement 5. The memory flagged it. I read the whole pusher (`src/advisor/push.ts:1-219`): it is **purely file-watch driven, has no timer of any kind**, and `pushed.json` stores `{v:1, ids:string[]}` — **ids only, no timestamps**. Against that base, Requirement 5 has a real completeness gap.

### R2-1 — Reminder anchored to `created` fires a redundant immediate second push when the first push is delayed — SHOULD_FIX, Novel

Req 5 AC 1 anchors the reminder to the wait's `created` time; AC 4 says on start "schedule its reminder for `created` plus one hour, **or send it at once if that time has passed**." The first push, however, is **not** anchored to `created` — the pusher only sends the first message when it *sees* the wait (startup scan or file-watch, `src/advisor/push.ts:155-186`).

Failure scenario (grounded in this doc's own scope notes):
1. A wait is written `open` at T0 while no controller runs — the exact watchdog controller-down case the Req 4 scope note keeps in scope (`scripts/sdd-watchdog.sh:184-199`), or any wait left open across a deploy restart (D5 cites spec 31).
2. The controller starts at T0+3h. `pushed.json` exists (this is a restart, not a first-ever start, so Req 4 AC 6 / Req 5 AC 5 do **not** apply). The startup scan finds the wait not recorded and sends the **first** message now (`runStartupScan`, :166-172).
3. Req 5 AC 4 reads the wait's `created` (T0), computes T0+1h — two hours past — and per its own text sends the **reminder at once**.

The operator's phone buzzes twice within seconds for one wait. That directly defeats Req 5's user story ("one reminder when a wait is still open an hour later, so that a missed message does not stall a run all day"): the first message was not missed — it only just arrived. The requirement as written *prescribes* this double-notification; it is not a tuning value left to design.

The fix is a requirements-level decision, not a design detail: anchor the reminder to **when the operator was first notified** (first push time), not to `created`, and record that time (the "reminded-ids record" shape is already deferred to design, so it can carry it) — or state that no reminder is sent when the first push itself is already past the reminder window. AC 4's "send it at once if that time has passed" is only correct once the anchor is the notification time, not `created`.

Secondary, same root: AC 4 describes scheduling "on start" only; the live path (a wait arriving via the file-watch while a long-running controller is up) is covered only by AC 1's unconditional WHEN/THEN. An implementer reading AC 4 as the scheduling spec could arm reminders on start but forget to arm one when `handleWait` sends a fresh first push. Fold this into the same fix: state that every first push arms the reminder, on start and live alike.

## Top risks/gaps

1. **R2-1** — reminder's time anchor (`created` vs first-notification) produces a redundant immediate double-push for any wait whose first push is delayed past one hour; the restart case is the common one (deploy restarts, controller-down waits). SHOULD_FIX.
2. The pusher has **no timer today** (`src/advisor/push.ts` is entirely chokidar-driven). Req 5 adds per-wait scheduling up to one hour plus an injectable clock (AC 6). This is a large, un-sketched mechanism change; it is stated as an outcome with a clock seam, so it is design-legitimate, but worth flagging that the "existing pusher, extended" framing (D1) understates the addition. MINOR.
3. The "reminded-ids record" is deferred to design (scope note) and is not pruned the way `pushed.json` prunes dead ids (`writePushedIds`, :104-111). Unbounded for one operator is harmless; note it for design. MINOR.

## Top 3 conclusions to challenge

1. **Req 5 AC 4 "send it at once if that time has passed."** Reverse the anchor: this clause is right against first-notification time, wrong against `created`. As written it manufactures the double-push in R2-1.
2. **D1 — "the existing wait pusher, extended."** The reminder is not an extension of a file-watch sender; it is a new scheduling subsystem (timers, injectable clock, a second durable record). The decision is still sound (one sender, dedup, cross-process visibility) but the word "extended" hides the reminder's weight.
3. **Req 4 scope note (watchdog controller-down waits) vs Req 5.** The doc keeps controller-down waits in scope as "reaches the phone when a controller starts again," then Req 5 reminds on those same waits immediately at start. The two in-scope behaviours collide; R2-1 is that collision.

## What's missing before acting

- A clause fixing the reminder's time anchor to the first-notification time (and recording it), so a delayed first push does not fire an immediate reminder; and stating that first-push arming happens on both the start scan and the live file-watch path.

## Fine, move on

- All v2 delta citations are accurate; R1-1..R1-4 are correctly closed. No misstated artifact.
- Requirements 1, 2, 3, 6 cites were verified correct in round 1 and are unchanged in substance by the delta.
- Req 4 AC 5 decoupling (pusher off the file-watch, not inside the wait write) holds at base (`src/advisor/push.ts:139-143,188-204`).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
