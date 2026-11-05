# Adversarial Analysis — dashboard-deploy/requirements (v2, round 2)

Primary surface: completeness, ambiguity, scope. Fresh lens (per prior-round guidance,
the prompt names none): crash ordering / idempotency of the controller↔script two-writer
handoff around starting the unit. Deltas attacked first (the five R1 fixes in the v2
Revision History), then this lens.

## Delta verification (v2 fixes) — all citations accurate, fixes internally consistent

- **R1-1 fix (pauseRequested coupling).** R1 AC2 now sets `pauseRequested` + `holdBy`; R3
  AC6 clears both; R4 AC4 names `pauseRequested` as the reason. Verified the chain holds:
  `isStartable` blocks on `pauseRequested` (`controller.ts:456`), the driver's `pause`
  parks as operator only when `isPauseRequested` is true (`runs.ts:574-577`), and
  `pause()` early-returns on `pauseRequested` (`controller.ts:242`). Every downstream guard
  the hold relies on now has its precondition. R4 AC4's "invariant, not red-first" marking
  is now genuinely true. Clean.
- **R1-2 fix (`unitStarted` field).** R1 AC1 marks `started` the press time; R1 AC4 sets a
  distinct `unitStarted: true`; R3 AC3/AC4, R5 AC1 and the scope note read `unitStarted`.
  The timestamp/flag ambiguity is resolved — but the fix introduced a crash-ordering hole
  (R2-1) and exposed a cancel race (R2-2). See below.
- **R1-3 fix (client wire half).** R6 AC2 now pins the subscription + state slot
  (`ShellProvider.tsx:76-121`, verified: the `subscribe`/`unsubscribe` block) and the
  frontend payload hand-copy (`dashboard_frontend/.../types.ts:215-237`, verified: the
  `ControllerRun` hand copy). Mirrors R4 AC12. Clean.
- **R1-4 fix.** R5 AC1 answers 200. Clean.
- **R1-5 fix.** D4 scoped to queued/waiting/merging with the running-parks-`paused` note.
  Matches R4 AC5 and `runs.ts:573-581`. Clean.

All v2-changed citations re-read and anchor their phrases: `controller.ts:456`, `:278-281`,
`:387-390`, `state.ts:429-433`/`:434-437`, `shell-feed.ts:146-153`, `shell/types.ts:230-236`,
`ShellProvider.tsx:76-121`, frontend `types.ts:215-237`, `runs.ts:573-581`. No misstated
artifact in the delta.

## Topics attacked

### A. Lost-unit recovery can double-spawn the self-update (R3 AC4 vs AC5, R1 AC4)

- Challenge R3 AC4's trigger. Its condition is only: controller starts AND record at `wait`
  AND `unitStarted` false/absent. It does **not** check whether a unit is live. R3 AC5's
  condition (open record AND unit live → leave alone) **also** matches a record at `wait`
  whose unit is live. The doc resolves one precedence conflict ("AC 1 takes precedence at
  `restart` on start") but is silent on AC4-vs-AC5 at `wait`.
- Stress-test R1 AC4's write order. It says "start the unit ... **and** SHALL set
  `unitStarted: true`" — spawn first, persist second. A spawn (`systemd-run`) and a record
  write are two separate operations; there is no atomicity across them. The script writes
  `wait` as its *first* stage (R2 AC1, `sdd-self-update.sh:81`), so a freshly spawned unit
  sits at `wait` legitimately.
- The crash window: controller spawns the unit → unit writes/keeps `wait` → controller dies
  before persisting `unitStarted: true`. On restart the record is at `wait`, `unitStarted`
  absent, a unit **is** live. If AC4 is applied, the controller re-applies holds and
  "continue[s] from Requirement 1 AC 4" → starts a **second** unit. Two self-update scripts
  then race the same checkout and `dist/` — the exact collision D11 forbids.
- Even if the design gives the unit a fixed name so the second `systemd-run` fails, R1 AC6
  fires ("unit cannot be started → write `failed` and **release the holds**") while the
  first unit is still mid-build. Holds drop under a live deploy; a released run starts a
  step the imminent restart kills — the hazard D1 exists to prevent. Both outcomes are
  wrong.

### B. A cancel at `wait` races the controller's own start-unit (R5 AC1, R1 AC4)

- Stress-test R5 AC1's new "stop the unit if `unitStarted`". It explicitly contemplates a
  cancel while `unitStarted` is false — the `wait` stage before the controller has started
  the unit (the D3 window where the controller waits for live steps to clear). In that case
  cancel stops nothing, releases the holds, removes the record and answers 200.
- But at that same `wait` the controller is the actor that will start the unit "WHEN no live
  step remains" on its tick (R1 AC4, tick at `controller.ts:113`). R5 AC2 pins only the
  **script** side ("no later **script** write SHALL recreate it"). Nothing pins the
  **controller** side: a tick that read the record before cancel's unlink, then spawns the
  unit after it, starts a deploy for a record the operator was told was cancelled — on runs
  whose holds cancel already released.
- The requirements resolve the symmetric script race (R5 AC2, Reliability) but leave the
  controller race unstated, so an implementer has no instruction to re-check the record is
  still open under a lock immediately before `systemd-run`.

### C. Re-checked, fine

- R3 AC6 idempotency ("safe to repeat"): a repeated release finds no `holdBy: 'deploy'`
  runs and is a no-op; the `waiting`→`resumeIfWaitAnswered` branch (`:387-390`) is also
  idempotent. Fine.
- The usage-window-paused held run on release ("every other run SHALL keep its status")
  returns to `paused`/`usage-window` with holds cleared. Matches D4. Fine.
- R6 AC4's `isOperatorHeld`-false requirement under the new `pauseRequested`-setting hold:
  reachable because R4 AC12 puts `holdBy` on the frontend row, so the function can gate on
  `holdBy === 'deploy'`. Stated as an outcome; implementable. Fine.

## Top risks / gaps (short doc → top 3)

- **R2-1 (MUST_FIX, Compounds R1-2, fix-induced).** R3 AC4 and R3 AC5 both match a record at
  `wait` with `unitStarted` absent and a live unit, and the doc gives no precedence (it
  resolves only the AC1-at-`restart` conflict). With R1 AC4's spawn-then-persist order, a
  crash between `systemd-run` and the `unitStarted: true` write leaves exactly that state;
  applying AC4 starts a second self-update unit on the same checkout/`dist/` (collision D11
  forbids), and a fixed-name design instead trips R1 AC6 and releases the holds under a live
  deploy. Fix: state that AC5 (unit live → leave alone) takes precedence, i.e. AC4 applies
  only when no unit is live, and/or pin that `unitStarted: true` is persisted **before** the
  unit is spawned.

- **R2-2 (SHOULD_FIX, Compounds R1-2, fix-induced).** R5 AC1's new "stop the unit if
  `unitStarted`" contemplates a cancel at `wait` before the unit exists, but no AC stops the
  controller from starting the unit on its tick (R1 AC4) after/concurrent with the cancel
  that removed the record. R5 AC2 pins only the script side. Failure: cancel returns 200 and
  releases holds; a mid-flight tick then spawns the unit and the deploy proceeds on
  now-unheld runs. Fix: mirror R5 AC2 for the controller — a removed/absent or non-open
  record SHALL prevent the controller starting a unit; re-check under the controller lock
  immediately before `systemd-run`.

- (No third gap. The remaining deltas verify clean; see Topic C.)

## Top 3 conclusions to challenge or reverse

1. **"R3's recovery branches fully cover the open-record states."** Reverse. They leave the
   `wait` + `unitStarted`-absent + unit-live state matched by two branches with opposite
   actions and no stated precedence (R2-1).
2. **"R1 AC4 can start the unit then record it."** Challenge. The spawn-then-persist order is
   the source of the double-spawn window; persisting intent first (or gating recovery on
   liveness) is required for the "exactly one unit" guarantee (R1 AC9) to survive a crash.
3. **"R5 AC2 closes the cancel/record-recreate race."** Challenge. It closes only the script
   writer; the controller's own start-unit path is an unguarded second writer (R2-2).

## What's missing (before design)

- A stated precedence between R3 AC4 and R3 AC5 (unit-live wins), and a pinned write order
  for `unitStarted` relative to the spawn.
- A controller-side counterpart to R5 AC2: a cancel-removed record must stop the controller
  from spawning the unit.

## Checks performed

Re-read for the deltas (both ends of each changed range): `state.ts:419-455` (carry-over
`:429-433`, terminal clear `:434-437`), `controller.ts:103-117` (start/tick),
`:238-257` (pause early-return `:242`), `:273-300` (resumeNow `:278-281`), `:387-390`
(resumeIfWaitAnswered), `:434-449` (settlePass), `:454-467` (isStartable `:456`),
`runs.ts:410-434` (stopReason/patchRun), `:560-593` (save/pause/waitAnd),
`:1420-1468` (ControllerRunRow/toRow/listRunsForWire), `shell-feed.ts:89-156`,
`shell/types.ts:190-236`, frontend `ShellProvider.tsx:60-121`, frontend `types.ts:205-237`,
frontend `pause.ts` (whole). The deploy-record handling in R3 is new behaviour routed
through `recover()`/the tick; no v1 citation was re-litigated (none in the v2 delta).

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
