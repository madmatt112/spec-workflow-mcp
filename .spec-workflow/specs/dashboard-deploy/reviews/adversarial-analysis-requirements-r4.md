# Adversarial Analysis — dashboard-deploy/requirements (v4, round 4)

Primary surface: completeness, ambiguity, scope. Fresh lens: none (prompt). Per the memory's
guidance, this round is a fix-induced re-check of the three v4 deltas (R3-1, R3-2, R3-3), not a
fresh full pass — the document is otherwise converged on prior lenses (wire contracts r1, spawn
crash-ordering r2, cancel teardown r3). Deltas attacked first.

## Delta verification

- **Citations in the delta are accurate.** The v4 delta adds no new code citation; it rewords
  R5 AC1/AC2, R2 AC3, D2/D3/D9, the Intro and the scope note. The one code anchor touched in
  spirit — `src/controller/state.ts:338-343` (`writeJsonAtomic`, temp+rename, creates the file)
  — was re-verified r3 and is unchanged. No misstated artifact in the delta. Lock mechanics
  re-read at `controller.ts:95-333`: `acquireControllerLock` (lifetime) and `withStoreLock`
  (per-store); route handlers and the 1 s tick (`schedule`) share one event loop and interleave
  at `await` points — so an async mutex is the only thing that can make two deploy writers
  mutually exclusive. R1 AC4's "its lock" must be a new deploy critical-section mutex.

- **R3-2 (SHOULD_FIX) is fixed.** R2 AC3 now reads "any SIGTERM → write `failed` … the script
  cannot tell a cancel's SIGTERM from any other, so it always writes `failed`; R5 AC1's removal
  of the record after the unit is gone is what leaves a cancelled deploy no `failed` record."
  This matches R3-2's recommended two-part mechanism exactly. Caveat: it is conditional on
  "removal … after the unit is gone", which R4-1 below shows is not guaranteed in one
  interleave — but the defect lives in R5, not in this clause.

- **R3-3 (MINOR) is fixed.** R3 AC3 now says "the unit the controller committed to starting but
  that is not live"; D3 adds "`unitStarted` true means the controller committed to starting the
  unit … even when the crash fell in the persist-to-spawn window", and scopes does-not-fail to
  "`unitStarted` false or absent"; the scope note reads "committed to starting the unit". The
  semantic drift R3-3 named is reconciled. Clean.

- **R3-1 (MUST_FIX) is only half-fixed — see R4-1.** The delta put the record *removal* under
  R1 AC4's lock, closing the "controller's own persist recreates a removed record" half. It left
  the *unit-stop / unit-liveness* determination outside the lock, and R5 AC2's new reasoning
  asserts a stop step that R5 AC1 does not perform. The seam reopens in a new interleave.

## Findings

### R4-1 — MUST_FIX (fix-induced; Compounds R3-1, seam from R2-2). R5 AC1 decides "stop the unit if `unitStarted`" *before* taking R1 AC4's lock; a tick can spawn the unit in the window between that pre-lock read and cancel's lock acquisition, so the lock-protected removal does not make "the unit is gone" true — the just-spawned unit survives a 200-cancel, runs the full deploy, and recreates the record.

R5 AC1 (v4): "the controller SHALL stop the unit if `unitStarted`, wait until the unit is gone,
**then** under the same lock as R1 AC4 release the holds and remove the record, and answer 200."
The phrase "then under the same lock" scopes the lock to **release-and-remove only**. The
`unitStarted` check and the unit-stop happen in the pre-lock prelude. R5 AC2 (v4) then claims:
"the removal falls either before [the re-read] or after a completed spawn **the cancel then
stops**." No clause makes cancel stop a unit under the lock, and `grep` over the document
confirms the only unit-stop is the pre-lock one in R5 AC1 (lines 88–89). So "the cancel then
stops" has no mechanism behind it.

Concrete interleave on the single event loop, cancel at `wait` with `unitStarted` still false
(the tick has not reached its persist yet):

1. cancel handler reads the record → `unitStarted` false → it will **not** stop any unit, and
   proceeds to acquire R1 AC4's lock (an `await`).
2. the 1 s tick wins the lock first: re-reads (open at `wait`), persists `unitStarted: true`
   (`writeJsonAtomic`, `state.ts:338-343`), spawns the `systemd-run --user` unit, releases.
3. cancel acquires the lock, releases the holds, removes the record, answers **200**.

The transient unit is now **live and unstopped** — it is in its own cgroup, outside
`sdd-controller.service` (R1 AC4), so nothing kills it. It runs build → smoke → gate → swap →
restart on the runs cancel just released. Two invariants break:

- R5 AC2 "removal SHALL come after the unit is gone" is false: the unit is gone at cancel's
  pre-lock read, but a new unit exists by the time the record is removed.
- R5 AC2 "no later script write SHALL recreate it" / R2 AC5 "keep every field it does not set"
  (atomic temp+rename): the live script writes `build`, `smoke`, … to the record path and
  **recreates** the deploy record the operator was told was cancelled — and R2 AC3 will leave a
  `failed` record if the script later trips, contradicting R2 AC3's "a cancelled deploy no
  `failed` record".

Root cause: R1 AC4's lock makes the re-read decisive only for writers that *claim the record
under the lock before deciding a unit's fate*. Cancel decides the unit's fate (stop or not) on a
stale pre-lock read, so the tick-first ordering escapes it. R3-1's fix pinned the removal but not
the liveness decision; R5 AC2's "the cancel then stops" describes the correct mechanism but R5
AC1 never implements it.

**Fix (one of):** (a) Under R1 AC4's lock, have cancel re-read and, if a unit is live or
`unitStarted` is true, stop it (dropping and re-taking the lock across the teardown is fine) and
only then remove; or (b) have cancel, under the lock, *claim* the record first (remove it, or
mark a `cancelling` intent the tick's re-read honours) so no spawn can follow its decision, then
stop any unit the claim found live. Either way the unit-liveness determination and the
record-claim must be atomic against R1 AC4's re-read → persist → spawn. Then R5 AC2's "the
cancel then stops" has a mechanism, and "removal after the unit is gone" holds in both orderings.

## Top risks / gaps (short doc → top 3)

- **R4-1 (MUST_FIX).** Cancel's unit-stop is outside R1 AC4's lock; a tick-first interleave
  spawns a unit cancel never stops, so a 200-cancel leaves a live deploy that swaps the checkout,
  restarts the service, and recreates the cancelled record. The R3-1 fix closed the
  record-recreation half but not the unit-liveness half of the same seam.
- No second or third risk survives verification. R3-2 and R3-3 are clean; r1/r2 findings remain
  resolved; delta citations accurate; the swap-race stays design-deferred in Reliability.

## Top 3 conclusions to challenge or reverse

1. **"R5 AC1/AC2 close the cancel/start-unit race (R3-1 fully fixed)."** Reverse. They close the
   recreate-by-persist half. The tick-first half — cancel reads `unitStarted` false, tick then
   spawns, cancel removes without stopping — survives, because the stop decision is outside the
   lock (R4-1).
2. **"After a completed spawn, the cancel then stops the unit" (R5 AC2).** Challenge. R5 AC1
   stops a unit only on its pre-lock `unitStarted` read; it has no post-lock stop, so a unit
   spawned after that read is never stopped.
3. **"A cancelled deploy leaves no `failed` record" (R2 AC3).** Challenge. It holds only if the
   unit is truly gone before removal; the R4-1 interleave leaves the script live, so it can
   recreate the record and leave a `failed` one.

## What's missing (before design)

- One clause making cancel's unit-liveness determination atomic with the record-claim under
  R1 AC4's lock, so no tick can spawn a unit after cancel has decided not to stop one (R4-1).

## Checks performed

Read both ends of every delta range: R5 AC1/AC2 (88–89), R2 AC3 (40), R3 AC3/AC4 (56–57),
D2/D3/D9 (128–135), Intro/Alignment (5,9), scope note (146–149), Revision History v4 (162–166).
Grounded in code: `controller.ts:95-333` (single event loop; `acquireControllerLock`,
`withStoreLock`; cancel/pause/resumeNow/enqueue — no deploy mutex exists yet, so R1 AC4's "lock"
is a design-introduced mutex), `state.ts:338-343` (`writeJsonAtomic` temp+rename creates the
file). Grepped the document for `unitStarted|under the same lock|the cancel then stops|wait until
the unit is gone`: the only unit-stop is R5 AC1's pre-lock one (88); nothing re-checks liveness
under the lock — confirming R4-1. R3-2 and R3-3 deltas re-read against their r3 fix text and
sound. No misstated artifact in the delta.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
