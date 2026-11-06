# Adversarial Analysis — dashboard-board/design (v2), Round 2

Primary surface: feasibility, consistency, edge cases. Deltas-first, then a fresh lens on Data Models completeness, the stage/`Observed` state machine, and the Discard side-effect ordering.

## What I checked and how

Read the v2 memory, the R1 analysis, codebase-context, requirements (v3) and agent-rules. The v2 delta is a round-1 response (R1-1..R1-4) plus decision reformatting and a scope-note cut. Verified every fix against code (worktree paths, both ends):

- **R1-1 (dot map):** `Sidebar.tsx:37-41` `DOT_COLOUR` = waiting→`bg-(--tone-warning-fg)`, running→`bg-(--tone-success-fg)`, idle→`bg-(--tone-neutral-fg)`; no red. `tokens.css:92` = `--tone-danger-fg: #c4343a`. C10's new wording maps green/amber/grey to that Sidebar map and sends `red`→`bg-(--tone-danger-fg)`. **Correct.**
- **R1-3 (hub ranges):** `hub.ts` `snapshotFor` :118-121, `overviewSnapshot` :123-129 (kept), `watchedProjects` :131-134. C6's split cites match exactly. **Correct.**
- **R1-4 (Gear:14):** `Gear.tsx:14` is `const { density, setDensity } = useShell();`; C7 now deletes it. Panel open class at :64, density block :75-99. **Correct.**
- **R1-2 (ShellProvider):** `now`/`controllerActivity`/`connected`/`density` all live at `ShellProvider.tsx:7-63`; C7's "whose only readers are the deleted pages" is accurate (R1 confirmed every reader is a deleted page). **Correct.**
- **Load-bearing Discard race (re-walked, not a closed re-open):** `enqueue` writes `branch:''` at `controller.ts:259` under `deploy.withLock(() => withStoreLock(project.projectPath,…))` (C3 cite `:231-261`, C4 cite `:231-245` both land on the lock/write). `discard` :373-378 and `discardRun` :1401 (unconditional `cancelRun` today) and route :859-864 (404-only today) all match the design's described target changes. `branchHeld`'s store-lock serialization holds for same-store relaunch (project.projectPath == run.specStore).
- **C1 task route:** `implementation.ts:446` has `task?`, `:469` the `onSpawn` call. **Correct.**

Every artifact path, range, signature and behaviour the v2 document asserts is accurate. No MUST_FIX; error branches stay pinned (discard race-loser 409 `{error:'branch-in-use'}`, confirm fail 200 `ok:false`); the Tailwind 4.1.18 `compile()` probe is a verified library-capability claim.

## Findings

### R2-1 — MINOR — `Observed` type is never pinned in Data Models (Novel)
C11's `resolved(stage, seen: Observed)` and `advance(stage, seen, now)` consume a type `Observed` that no section defines; Data Models pins only `ControllerRunRow` and local storage. Mitigation: the `resolved` table enumerates every field read (pauseRequested, status, isOperatorHeld, branchPresent, isStalled, controllerRuns, action state) and C11 is flagged "illustrative — verify against the test fake." `Observed` is a design-internal observation bundle, not a result/response object a requirement references, so it does not trip the Data Models MUST_FIX rule; an implementer can derive it from the wire data already on Home. Record-only; not blocking.

### R2-2 — MINOR — C4 "nothing changes on branch-in-use" relies on an unstated reorder (Novel)
`Controller.discard` today runs `this.cancelled.add(runId)` → `dropFromQueue` → `clearRunActivity` *before* `discardRun` (`controller.ts:374-377`). C4's post-condition "On `branch-in-use` nothing changes: no `cancelled` entry, no queue edit, no write" requires those three side-effects to move *after* the `branchHeld` guard inside the store lock, and requires a pre-lock run read to pick `run.specStore`. The post-condition pins the invariant unambiguously, but C4 does not enumerate the reorder, so a literal wiring that keeps the three lines up top would cancel a run it must leave running. The stated post-condition governs; surfaced for the implementer, not a design defect.

### R2-3 — MINOR — Architecture delta "three run-row fields" under-counts Data Models' five (Novel, fix-induced)
The v2 reword changed "gains three things on the run row" → "adds three run-row fields," but Data Models enumerates five (`inFlight`, `stepStarted`, `task`, `branchPresent`, `discardAllowed`). The enumerated list after the colon is unchanged (the three *concepts*), and Data Models is authoritative, so no implementation reads it wrong. Cosmetic.

## Top risks / conclusions to weigh
1. Nothing substantive remains. The one R1 gap (red dot class) is correctly closed; its *rendered* class is still gated only at the unit level (`board-view.test.ts` tests `runDot`'s string, not `tiles.tsx`'s class), and e2e scenario 2 exercises Stalled/Re-drive, not a 16-min red dot — a testing-coverage note, not a design hole.
2. The Discard/relaunch race, done-discard cache flush (`forgetBranchPresence` + post-cleanup `change`), and controller→dashboard/harness layering remain sound.
3. No security/data/money surface beyond Discard, which keeps its second press + store lock (D1).

## What's missing before acting
Nothing blocking. The three MINORs above are record-only; the strongest (R2-2) is a reorder the stated post-condition already forces.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
