# Adversarial Analysis — decisions-and-launch-guard/design (v1, round 1)

Primary surface: feasibility, consistency, edge cases. First review; attacked the
lint-pass deltas first (all citation-only), then read both ends of every cited range
against the installed code under the worktree.

## What I verified (citations are the automatic-MUST_FIX surface)

I read both ends of the ranges the document leans on. All accurate:
- C1: `KnownProject` (state.ts:256-266), `rememberProject` replaces the row today
  (state.ts:619-628), `syncOnce` reads `remembered` (project-manager.ts:115) and sets
  `projectName` at :145/:152/:216, `addProject` remembers `name` at :233-236,
  `summary.ts:110-111` matches on `readProjects().name` (not the live context, so the
  display-name override cannot break operator-config matching), `actionTarget`
  prints raw `t.project` (tiles.tsx:276-280), `push.ts:92` returns `?.name`.
- C2: setup route (multi-server.ts:620-632), `buildSetupView` reads only
  `project.projectPath` (run-setup.ts:150-224), `getAllProjects()` exists
  (project-manager.ts:285), `DECOMPOSITION_HEADING` (run-setup.ts:23), `File:` union
  (task-parser.ts:332-345), code root reaches the wire via `originalProjectPath`
  (project-manager.ts:302 = controller `codeRoot` at controller.ts:259).
- C3/C4/C5: closeout Step 1 (:362-375), itemsText/:404, verifier/:490, findings/:526,
  revert/:585-625, final line/:633; implementation :805-807/:826-842/:858-871/:880-881/
  :912/:929-936, first-pass call at :754; document REVIEWER_SCHEMA (:253-265),
  reviserStep (:452-468), ledgerRoundCount (:522-523), round row at :855, openMustFix
  (:883), converged (:885-888), should-fix-only (:892-903), escalate (:861-864).
- C7: `classifyTarget` now at :541-542 (widened by lint — declaration in range),
  cancelRun today signals-then-writes (:1380-1400 — the design reverses this),
  writeRunLocked reads disk only `if (!terminal)` today (state.ts:442), the five step
  sites all pass `runId: ctx.run.id` (document.ts:389, implementation.ts:463,
  retrospective.ts:163, closeout.ts:313, merge-fix.ts:220) ahead of their `runStep`
  calls (:401/:472/:169/:319/:229), createWait (waits.ts:87-104), merge wait
  (merge.ts:732), StepResult has exactly the 10 fields Data Models pins.
- C6: the G1/G2 blockquotes are verbatim at tradr-hosted option-lifecycle-events
  retrospective-plan.md:143-148 and :155-159; its `## Decisions` uses the single-arrow
  `- <id>: <q> → <a>` shape `parsePlanDecisions` expects.
- C9/C10/C11: stoppedAdmitted/running/runDot/isStalled (board.ts:35-117), toRow
  discardAllowed/branchHeld (runs.ts:1482-1511), Controller.discard (controller.ts:382-395),
  RunTile step line (tiles.tsx:165-174), DeployControl `mb-3` (:57).

Data Models and error-branch shapes: `LaunchGuard` fully enumerated; the skipped-step
`StepResult` pins all 10 fields with `classification/subtype: 'cancelled'`; the POST
display-name table pins 200/400/404/404 with bodies; the reused-run discard pins 409
`branch-in-use`; `RunAbandonedError` pins `code='run-abandoned'`. No union-only result
object, no HTTP branch missing a status. No library-capability assertion is left
unproven (the only OS call, `process.kill(-pid)`, is pre-existing in cancelRun).

## Topics attacked

### 1. C5 — the drafting-only cap (design §C5 Flow)
- **Challenge the version bookkeeping.** The flow runs `reviserStep('drafting-only', …)`
  — which writes **v(D+1)** and commits it — then `lintStep`, `narrowCheck(D, …)` and
  `approve(D, …)`, all on the bare `D`, and the note reads `v<D> approved`. The parallel
  should-fix-only path it is modelled on (document.ts:892-903) does `D += 1` **between**
  reviserStep and lintStep. As written the cap lints, narrow-checks and approves the
  **stale pre-revision version** while the reviser's corrective edits sit in v(D+1).
  Either the increment is missing or `D` is overloaded; the document contradicts itself.
- **Stress-test the ordering claim.** The block is inserted "after openMustFix (:883) and
  before the converged check (:885-888)". Confirmed safe: escalate (:861-864) and the
  round-2+ standoff (:873-882) precede it; `items.length > 0` gates out the converged
  case. The ledger-count gate (`=== 1`) correctly suppresses the cap on re-entry because
  a resumed round writes a second `round` row (:855) before reaching here. No defect.

### 2. C9 — Discard of a reused branch (design §C9 Reused branch)
- **Challenge "a direct POST deletes nothing."** `toRow` is given a `branchReused`
  override (discardAllowed:false), but the direct-POST guard is `Controller.discard`
  (controller.ts:388), which today calls only `branchHeld` — and `branchHeld`
  (runs.ts:1482-1488) sees **live** runs only (`isLive(other.status)`). The document says
  "branchHeld keeps its meaning," so if the reusing run is **not live** — the canonical
  `dashboard-deploy` case is days old and almost certainly `abandoned`/`done` —
  `branchHeld` returns false and a direct POST reaches `discardRun`, which deletes the
  branch and `gh pr close`s it (runs.ts:1420-1432). That is the exact destructive outcome
  Requirement 9 AC 6 forbids. The design introduces `branchReused` ("any status") but
  only wires it explicitly into `toRow`; it must state that `Controller.discard`'s guard
  gains the `branchReused` check, not lean on `branchHeld`.

### 3. C7 — Cancel stops the driver (design §C7)
- **Stress-test the retry-after-cancel path.** `handleDocumentOutcome`'s retry (runs.ts
  :1337-1354) treats any `stopped` result as an operator pause (:1349). A cancel that
  lands during the retry returns `stopped`/`cancelled`; without the stated post-retry
  `runCancelled` check at :1347 it would try to write `paused`. Confirmed the design
  closes this both ways — the :1347 re-check and the writeRunLocked abandoned-guard
  backstop. No defect.
- **Challenge the writeRunLocked guard scope.** Today the disk read is gated by
  `if (!terminal)` (state.ts:442); a `done`/`error` write never re-reads disk. The guard
  must read disk for **terminal** writes too, or a losing `error` write overwrites
  `abandoned`. The design says "reads the disk record first," which implies the gate is
  lifted — adequate, but the reviser should not leave the `if (!terminal)` structure
  ambiguous. Borderline MINOR.

### 4. C2 — Launch guard sources (design §C2)
- **Stress-test the empty-tasks.md case.** "first non-empty source wins" means a
  `tasks.md` that exists but lists no `File:` lines falls through to the decomposition
  entry — mild tension with Requirement 2 AC 7 ("WHEN tasks.md exists THEN read its File
  entries"). Low impact; MINOR.
- **Challenge the decomposition-as-file-list heuristic.** `decompositionEntry` returns the
  whole entry to the next `### `; every backticked `/`-token in Delivers / Decided /
  "Design MUST enumerate" / "Design should address" becomes a "spec file," including pure
  references. For a single-repo spec this is harmless; the design's own `.spec-workflow/`
  filter and the no-holder drop keep it bounded. Acceptable as a warns-never-refuses
  heuristic (D5/D6). No defect.

## Top risks / gaps
1. **C5 cap approves the stale version** (SHOULD_FIX) — missing `D += 1`; lint/check/
   approve target v(D) while fixes land in v(D+1).
2. **C9 direct-POST discard can still delete a reused branch/PR** (SHOULD_FIX,
   destructive) — `Controller.discard` must check `branchReused`, not the live-only
   `branchHeld`.
3. (MINOR) empty-`tasks.md` fall-through, writeRunLocked terminal-read phrasing, and the
   C3 "Reference plan" P6/P11 examples not matching the real option-lifecycle-events
   `## Decisions` (illustrative, so acceptable).

## Top conclusions to challenge
1. **"a direct POST deletes nothing" (C9)** — false unless `Controller.discard` adopts
   `branchReused`; as scoped it holds only while the reusing run is live.
2. **C5 "run … the narrow check over all items, then approve" at version `D`** — reverse
   to v(D+1); approving `D` ships the unrevised document.
3. **"branchHeld keeps its meaning" (C9)** — keep the function, but do not let that phrase
   imply the discard guard is unchanged; the guard is exactly what must change.

## What's missing before acting
- Pin the C5 version increment and fix the note/approve to name v(D+1).
- State the `Controller.discard` guard change (`branchHeld || branchReused`) and confirm
  the controller.test.ts reused-run fixture uses a **non-live** reuser so it actually
  exercises the gap.
- One line clarifying the C2 empty-`tasks.md` precedence (no-list vs decomposition).

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
`converged` needs MUST_FIX = 0 and SHOULD_FIX = 0; two SHOULD_FIX keep it open.
