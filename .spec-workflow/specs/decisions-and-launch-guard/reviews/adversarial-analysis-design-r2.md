# Adversarial Analysis — decisions-and-launch-guard/design (v2, round 2)

Primary surface: feasibility, consistency, edge cases. Fresh lens: none assigned.
Method: attacked the v2 deltas first as fix-induced re-checks, each scoped to the
fix's diff against the requirement it must satisfy; then read both ends of every
new citation and the consuming code. No fresh corrective round was needed.

## Fix-induced re-checks (the v2 deltas)

The v2 delta is the round-1 adversarial response (R1-1 … R1-5). Each fix was
re-checked against its requirement and the installed code.

### R1-1 — C5 drafting-only cap version increment (was SHOULD_FIX) — RESOLVED
- The flow now reads `reviserStep('drafting-only', D, ...)` (writes v(D+1)),
  then `D += 1`, `lintStep(D)`, `narrowCheck(D, analysisPath, items)`,
  `narrowCheckRan`, note `v<D> approved` (now v(D+1)), `approve(D)`.
- `reviserStep(variant, D, findings, commitMsg)` at `document.ts:452-468` writes
  the brief for `v${D+1}` and the commit — so the pre-increment `D` is the input,
  and the post-increment `D` names the revised version. This is byte-for-byte the
  shape of the should-fix-only path at `document.ts:892-903` the design cites.
  The lint, narrow check, note and approval now all name the revised version.
- The `ledgerRoundCount() === 1` gate is unchanged and still correctly suppresses
  the cap on re-entry (the round row at `:855` is written before this point).
  No conflict with the should-fix-only `D >= 2` guard: the drafting-only path
  does not require `D >= 2`.

### R1-2 — C9 reused-branch discard guard (was SHOULD_FIX, destructive) — RESOLVED
- `Controller.discard`'s guard is `if (branchHeld(run, await listRuns())) return
  'branch-in-use'` at `controller.ts:388`. The design now states this guard
  "gains the same `|| branchReused`", so a direct POST on a non-live reuser
  returns `'branch-in-use'` and `discardRun` never runs. This closes the exact
  destructive path round 1 flagged.
- `toRow` sets `discardAllowed: !branchHeld(run, allRuns)` at `runs.ts:1509`; the
  design changes it to `!(branchHeld || branchReused)` and forces
  `branchPresent: false` with no branch read. `stoppedAdmitted` keys on
  `Boolean(run.branchPresent)` (`board.ts:39`), so forcing false makes the reused
  run leave the stopped band — the branch physically exists (the reuser holds it),
  so the read would otherwise return true and pin it there. The "with no branch
  read" clause is therefore necessary and correct.
- `branchReused` (any status, later `created`) vs `branchHeld` (live only) is the
  right split: the newest run owns the branch (no later-created reuser → not
  reused → discardable); every older run is reused → not discardable → leaves band.

### R1-3 — C2 file-list source precedence (was MINOR) — RESOLVED
- New wording: "When `tasks.md` exists: the union of `task.files`, source `tasks`.
  The decomposition is read only when `tasks.md` is absent, so an existing
  `tasks.md` with no `File:` entries gives `no-list`." This matches Requirement 2
  AC 7 ("WHEN `tasks.md` exists THEN the guard SHALL read its `File:` entries …")
  with no fall-through. The round-1 tension is gone.

### R1-4 — C7 writeRunLocked terminal read (was MINOR) — RESOLVED
- The `if (!terminal)` gate is at `state.ts:442`; today a terminal write never
  re-reads disk. The design now reads disk "for terminal writes too" and drops a
  losing `error`/`done` write when disk is `abandoned`. This satisfies Requirement
  7 AC 3 ("WHEN a run is `abandoned` on disk THEN no later write SHALL change that
  status"). Writes are serialized per id through `writeChains` (`:465-472`), so the
  disk read is race-safe within the chain; the legitimate `abandoned` write from
  `cancelRun` still proceeds (disk is not yet `abandoned` at that point).

### R1-5 — close-out reference plan illustrative — RULING (closed, not re-opened).

## Remaining deltas (prose, no defect)
- C7 dropped "They still skip the usage window."; the behaviour (return
  `'cancelled'` before `'operator'`) is still stated, and Requirement 7 D7 keeps
  the usage window out of the document stop. No contradiction.
- C8 dropped "which answers the decomposition's question."; C11 "1 px rule" →
  "alignment"; D10/D11 options reworded; C1 citation `:427-434` → "(D1)" (D1
  exists in Decisions). All lossless.
- Scope notes dropped "Carried items: none." (requirements.md still carries it);
  absence means none. No defect.

## New citations verified (automatic-MUST_FIX surface)
- `controller.ts:388` — the `branchHeld` discard guard. Accurate.
- `state.ts:442` — `if (!terminal)` gate inside `writeRunLocked` (`:431-463`). Accurate.
- `document.ts:452-468` reviserStep signature; `:892-903` should-fix-only path
  the drafting-only block mirrors. Accurate.
- `board.ts:38-44` `stoppedAdmitted` keys on `branchPresent`. Accurate.
No misstated artifact. The v2 lint commit changed no citation (0 fixed), so no
lint-changed citation needed re-verification.

## Top risks / gaps
None. All four actionable round-1 findings are resolved against code and the
requirements they cite, and the v2 deltas introduce no new defect.

## Top conclusions to challenge
None outstanding. The two round-1 conclusions ("a direct POST deletes nothing",
"approve at v(D+1)") are now true as written.

## What's missing before acting
Nothing at the design layer. Implementation must still turn `writeRunLocked` from
`Promise<void>` to a boolean return and thread it through `writeRun`/`save`/
`patchRun`, and skip the branch read in `toRow` for a reused run — both are
stated and feasible, left to the tasks phase.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0; both are 0. Every round-1
finding is resolved and no delta introduced a new one.
