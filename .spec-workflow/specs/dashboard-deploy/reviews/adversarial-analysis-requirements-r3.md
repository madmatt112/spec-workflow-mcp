# Adversarial Analysis — dashboard-deploy/requirements (v3, round 3)

Primary surface: completeness, ambiguity, scope. Fresh lens (prompt names none; prior
rounds used wire contracts (r1) and spawn/crash-ordering of the two-writer handoff (r2)):
**cancel/termination teardown semantics** — what happens to the record and the script when
a deploy is stopped, and whether the just-added lock claim is self-sufficient. Deltas
attacked first (R1 AC4, R3 AC4, R5 AC2, the D1–D12 rewording), then this lens.

## Delta verification — R2-1 resolved, R2-2 only half-resolved

- **Citations in the delta are accurate.** The one new code citation, `src/controller/state.ts:338-343` in R1 AC4, is `writeJsonAtomic` ("a temp file in the same directory, then rename") — correct for "persist `unitStarted: true` to `deploy.json`". `src/advisor/actions.ts:363-364` (unchanged, re-read) is the `checkoutRoot`/`scriptPath` resolution — correct. No misstated artifact in the delta.

- **R2-1 (double-spawn) is genuinely fixed.** R1 AC4 now persists `unitStarted: true` *before* the spawn, and R3 AC4 gains "AND no unit is live" with "AC 5 takes precedence when a unit is live". Tracing the four restart states: `wait`+absent+no-unit → AC4 (continue); `wait`+true+no-unit → AC3 (fail); `wait`+true+unit-live → AC5 (leave); `wait`+absent+unit-live cannot occur under persist-before-spawn and AC5 covers it anyway. AC4 and AC5 are now mutually exclusive on unit-liveness. The precedence hole is closed.

- **D1–D12 rewording dropped no constraint.** Each decision keeps its chosen option and rationale; D1 even sharpens to "with no operator hold". D6 lost the rationale clause "the decomposition wants the strip to say it" (rationale only, no AC depends on it). No contradiction introduced.

## Findings

### R3-1 — MUST_FIX (fix-induced; Compounds R2-2). R5 AC2's "by the re-read under its lock" is unsound: cancel's removal is not pinned to that lock, so a mid-critical-section tick recreates the record and spawns after a 200-cancel.

R5 AC2 (delta) claims: "The controller SHALL start no unit once the record is removed, by
the re-read under its lock (R1 AC4)." R1 AC4 (delta) holds the lock across **re-read →
persist `unitStarted` → spawn**. The re-read is at the *start* of that section; the persist
(`writeJsonAtomic`, `state.ts:338-343`) **creates** the file via temp+rename. Nothing in the
document requires cancel (R5 AC1: "release the holds, remove the record") to take that same
lock. Concrete interleave on a single event loop, cancel at `wait` with `unitStarted` false:

1. tick acquires the lock, re-reads: record open at `wait` → proceeds.
2. tick awaits the `unitStarted: true` persist.
3. cancel route runs (not holding the lock): `unitStarted` false → stops nothing, releases
   the holds, removes the record, answers **200**.
4. tick's persist completes — `writeJsonAtomic` **recreates** `deploy.json` (`unitStarted:
   true`, stage `wait`).
5. tick spawns the unit.

The deploy now proceeds on runs the cancel already released, for a record the operator was
told was cancelled — exactly the R2-2 hazard the fix set out to close. R5 AC2's "no later
**script** write SHALL recreate it" does not cover the controller's own persist. The re-read
alone is insufficient; the invariant holds only if cancel's release-and-remove executes under
the same lock. **Fix:** state that R5 AC1's "release the holds and remove the record" runs
under the same lock as R1 AC4, so the controller's re-read→persist→spawn and the removal are
mutually exclusive (then the re-read is decisive: removal is either strictly before it, or
strictly after a completed spawn that cancel then stops).

### R3-2 — SHOULD_FIX (Novel, carried; fresh lens). R2 AC3 asks the script to condition `failed` on "SIGTERM from outside a cancel", a distinction the script cannot observe; the reconciling mechanism (trap always writes, cancel erases) is unstated.

R2 AC3: "WHEN the script ends on a refusal, a timeout, a failed command under `set -e`, or
**SIGTERM from outside a cancel** THEN it SHALL write `stage: 'failed'`…". The script today
has no trap (`set -euo pipefail`, no `trap`, confirmed `scripts/sdd-self-update.sh:24`), so
satisfying the non-cancel-SIGTERM case requires adding a SIGTERM trap. That trap fires on
**every** SIGTERM, including the one R5 AC1's cancel sends when it "stop[s] the unit". The
script has no channel to learn a SIGTERM is a cancel (no sentinel, no flag, the record still
exists at kill time per R5 AC2's "removal SHALL come after the unit is gone"). So the AC as
written is not evaluable script-side. The consistent reading — trap writes `failed` on any
termination, and cancel's post-teardown removal (R5 AC1/AC2) is what leaves no `failed`
record — is never stated, so an implementer may instead try to make the script detect a
cancel (impossible, or an over-engineered sentinel file) or ignore the qualifier. **Fix:**
drop "from outside a cancel"; state the script writes `failed` on any SIGTERM/`set -e`
termination, and that R5 AC1's record removal (after the unit is gone) is what guarantees a
cancelled deploy leaves no `failed` record.

### R3-3 — MINOR (Compounds R2-1). `unitStarted` now means "committed to start", not "started"; D3 and R3 AC3's "lost unit" wording no longer match the persist-before-spawn window.

With persist-before-spawn, a crash between the persist and the `systemd-run` call leaves
`unitStarted: true` while the unit was **never actually started**. On restart R3 AC3 fires
(`unitStarted` true + not live → `failed`, "`error` naming the stage and the **lost unit**"),
reporting a lost unit that never ran. D3's cost statement — "a record at `wait` whose unit
was never started continues after a restart and does not fail" — is contradicted for this
sub-case (unit never started, yet it fails). The ACs themselves are precise and
implementable, so this is wording/semantics, not a behaviour defect: the `unitStarted` flag
and the "lost unit" phrasing should be read as "controller committed to starting", and D3
should scope its "does not fail" claim to `unitStarted` false/absent.

## Top risks / gaps (short doc → top 3)

- **R3-1 (MUST_FIX).** The re-read-under-lock claim (R5 AC2) does not close the cancel race
  because cancel's removal is not required to take that lock; the controller's own
  `unitStarted` persist recreates the record and the spawn proceeds after a 200-cancel.
- **R3-2 (SHOULD_FIX).** R2 AC3 attributes a cancel/non-cancel SIGTERM discrimination to the
  script, which cannot make it; the real two-part mechanism is unstated.
- **R3-3 (MINOR).** `unitStarted` semantics drifted to "committed to start"; D3 and R3 AC3's
  "lost unit" wording now misdescribe the persist-spawn-crash window.

## Top 3 conclusions to challenge or reverse

1. **"R5 AC2 + R1 AC4 close the cancel/start-unit race."** Reverse. They close only the half
   where cancel removes before the tick's re-read; the half where cancel removes during the
   tick's locked section is reopened by the recreating persist unless cancel shares the lock
   (R3-1).
2. **"The script can report `failed` on termination except when cancelled."** Challenge. The
   script cannot see that a SIGTERM is a cancel; the exception lives in cancel's removal, not
   in the script (R3-2).
3. **"`unitStarted: true` means the unit was started."** Challenge. After the ordering fix it
   means the controller committed to starting it; a persisted-but-never-spawned unit is
   possible and is reported as a "lost unit" (R3-3).

## What's missing (before design)

- One clause putting cancel's release-and-remove under the same lock as R1 AC4 (R3-1).
- A statement of where the cancel/non-cancel `failed` discrimination lives — the script
  writes `failed` on any termination, cancel's removal erases it (R3-2).

## Checks performed

Read both ends of each delta range: R1 AC4, R3 AC4, R5 AC2, D1–D12, Revision History v3.
Grounded in code: `controller.ts:95-333` (start/lock via `acquireControllerLock`, single
event loop; `enqueue` `withStoreLock`; `cancel`/`pause`/`resumeNow`/`recover` — no deploy
lock exists yet), `state.ts:270-343` (`controllerHome`, `writeJsonAtomic` temp+rename —
creates the file), `scripts/sdd-self-update.sh:1-310` (no trap; stage anchors `:81`, `:191`,
`:213`, `:239`, `:276`, `:305`, `:307` and wait texts `:219`, `:257` all anchor),
`advisor/actions.ts:355-384` (`checkoutRoot`/`scriptPath`). Grepped the requirements for
`trap|SIGTERM|signal|lock`: SIGTERM appears only in R2 AC3; the lock only in R1 AC4/R5 AC2 —
confirming no cancel-signal channel and no cancel-side lock. No misstated artifact in the
delta.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
