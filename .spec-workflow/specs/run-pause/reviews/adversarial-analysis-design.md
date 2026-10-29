# Adversarial Analysis — run-pause/design (v1), Round 1

First review of the design. Primary surface: feasibility, consistency, edge cases.
Fresh lens: none specified.

## What I checked and how

Read `codebase-context.md`, the requirements (v3), the decomposition entry (29), and
every artifact the design cites, both ends of each range, from the worktree
(`.claude/worktrees/run-pause`):

- `state.ts` `RunStatus`/`RunRecord` (56-101), `writeJsonAtomic`/`readJson` (316-337),
  `writeRun`/`pausedAt` (388-394), `listRunsSync` (348-365).
- `controller.ts` `resumeNow` (207-224), `recover`/`reattach`/`resumeIfWaitAnswered`
  (261-294), `schedule`/`isStartable` (298-345), `onWaitChange` (369-392), `windowBlock`
  (408-423), `runDeps` (438-453), `save` (524-529), `isLive` (532-536).
- `runs.ts` `RunDeps` (388-411), `patchRun`/`stepLifecycle` (413-437), `save`/`pause`/
  `waitAnd` (532-554), `runMergeStageStep` (621-768), `runOnce` (770-989), close-out
  merge/handlers (1000-1063), `handleImplementationOutcome`/`Retrospective`/`Document`
  (1120-1262), `cancelRun`/`discardRun` (1282-1330), `ControllerRunRow`/`toRow` (1336-1363).
- `document.ts` context/outcome (159-213), rounds loop and steps (680-911).
- `multi-server.ts` routes (800-830), `access.ts` `makeRequireAccess` (186-211).
- Frontend `pause.ts`, `RunsPage.tsx` (185-324), `NowPage.tsx` (338-358),
  `types.ts` (196-231), `Sidebar.tsx:197`; `scripts/sdd-self-update.sh` (85-117, 295-309).

**Every cited path, line range and signature in the design matches the code.** No
misstated-artifact MUST_FIX. The lint-pass delta (dropping the unresolvable
`node_modules/@types/react` citation on line 123, leaving the `Sidebar.tsx:197`
ground) is correct: `Sidebar.tsx:197` does call `e.stopPropagation()`.

## Attack surface 1 — C3 "Driver stop points": the merge stage after implementation is un-held

- **Challenge the claim that the loop top "is the boundary between phases" (C3 point 1).**
  It is not. When the implementation phase returns `complete`, `handleImplementationOutcome`
  returns `go` and `runOnce` calls `runMergeStageStep` **directly at `runs.ts:947`**, never
  returning to the loop-top operator check at `runs.ts:804`. The stop-point list (C3 points
  1–4) has no entry for the merge-stage *entry* — point 3 guards only the merge-*fix* round,
  which lives inside the `blocked` branch (`runs.ts:692-710`), reached only when the PR fails
  the rule. A PR that passes the rule merges at `runs.ts:672-675` before any operator check.
- **Stress-test this against D9.** D9 holds that a merging run must pause "at once" because
  "an auto-merge can trigger the self-update the operator is trying to control." The design
  honours that for a run already in `merging` status (route applies at once; `isStartable`
  blocks the poll), but a `running` run that finishes its last implementation step while held
  slips straight into the merge and auto-merges the PR — the exact outcome D9 exists to stop.
- **This is R1-1 (SHOULD_FIX)** — see Findings.
- Fine, briefly: the **merge-resume** path is protected. C3 point 1 places the operator check
  "before the merge resume," i.e. ahead of the `resumingMerge` block at `runs.ts:809`, so a
  run re-entered for a `merging` re-check pauses before the re-check. The gap is only the
  first merge after an in-line implementation `complete` (947), which bypasses the loop top.

## Attack surface 2 — C1 / D2 "writeRun carry rule": feasibility of the rewrite

- **Stress-test the claim that `writeRun` serialises per id and reads disk inside the section.**
  Today `writeRun` (`state.ts:388-394`) is a fire-and-forget write of the in-memory record with
  no disk read and no locking. C1 turns it into a per-id serialised read-modify-write for every
  caller (`patchRun`, module `save`, `Controller.save`, `cancelRun`). The behaviour is
  implementable (a per-id promise chain spanning the `readJson`+`writeJsonAtomic`), and
  `writeJsonAtomic`'s temp-then-rename makes partial reads impossible, so the `Promise.all`
  stale-vs-owned test the design promises is sound. No defect — but flag that this changes a
  hot, universally-called function; the test named in Testing Strategy must exercise the
  owned/normal ordering both ways, which it does.
- **Probe post-condition 4 (terminal drop).** `done`/`abandoned`/`error` writes force
  `pauseRequested` absent. `cancelRun` (`runs.ts:1298`) writes `abandoned` through `writeRun`,
  so the drop reaches the cancel/abandon path (Req 2 AC 5, Req 3 AC 5). Consistent.
- **Probe the driver's applied-pause write.** `pause()` → module `save` → `writeRun(next)`
  with no `ownsPauseRequest`, so `pauseRequested` is carried from disk (still set) while
  status/reason become `paused`/`operator`. This is the intended applied state; verified
  against the state table row 1. Consistent.

## Attack surface 3 — C6 / D3 "document-phase round-top stop"

- **Challenge "no step runs twice" on resume.** Verified: `reviserStep` and `lintStep` each
  commit a checkpoint (`document.ts:455`, `:434`) before the loop returns to its top, so at the
  round top the latest version D is committed and `orient` re-reads it (`document.ts:692`). A
  stop at the round top re-enters on that version's reviewer; the claim holds.
- **Stress-test the RE-DECIDED scope against Req 2 AC 3.** AC 3 names "before the fresh retry in
  `handleDocumentOutcome`" as a boundary that must hold; C6 **does** add the held check before
  the fresh retry (`runs.ts:1239-1249`). The mid-round steps are RE-DECIDED out (D3), which is a
  design decision, internally consistent, and the one-round wait is acknowledged. No defect.
- Fine: the design phase has no gate A (requirements-only, `document.ts:792`), so a design run
  held during its drafter parks at the first round top after draft+lint — within one round.

## Attack surface 4 — C4 "resumeNow / onWaitChange / recovery"

- **Probe the pending-resume `null` hazard.** Today `resumeNow` returns `null` for a non-`paused`
  run (`controller.ts:210`), which the route maps to 409 `not-paused`. Req 4 AC 4 needs a
  pending resume on a `running`/`waiting` run to answer 200. C4 says the held branch is "first,"
  i.e. before line 210; that placement is load-bearing and correct as written. No defect, but
  the implementer must honour "first" or AC 4 regresses to a 409.
- **Probe Error Handling 4 (resume vs. pause-write race).** Traced: resume clears
  `pauseRequested` (owned) while the driver's non-owned pause write lands `paused`/`operator`
  with the field already gone; the record is startable (table row 4) and `drive()`'s post-run
  `schedule()` (`controller.ts:364`) starts it. Handled.
- **Probe `onWaitChange` held path + abandon.** `abandon` → `cancel` → terminal write drops the
  field (Req 3 AC 5); any other answer → `paused`/`operator` carrying `pauseRequested` from disk
  (Req 3 AC 4). `recover` reaches it via `resumeIfWaitAnswered` (`controller.ts:291-294`, Req 5
  AC 5). Consistent.

## Attack surface 5 — C4 scheduler "settle pass" + `isStartable`

- **Stress-test the new `isStartable` first-rule against the 30 s merge poll.** A held `merging`
  run that became idle via `not-ready` (`runs.ts:677`, resumeAt = next check) is blocked because
  the new rule returns `false` for any `pauseRequested` run *before* the status checks
  (`controller.ts:333-343`), so the poll cannot self-resume it before the settle pass parks it.
  This is the correct closure of requirements R2-1. Consistent.
- Fine: the settle pass's "`paused` with a reason other than `operator`" arm is largely
  defensive — `pause()`'s operator override and the settle-before-window order make that state
  hard to reach — but defensive breadth is not a defect.

## Findings

### R1-1 — SHOULD_FIX — No operator stop between implementation `complete` and the merge stage

`runOnce` routes a completed implementation phase straight into `runMergeStageStep`
(`runs.ts:947`) without an `isPauseRequested` check, and `runMergeStageStep` runs the actual
merge (`runMergeStage` → `case 'merged'`, `runs.ts:663,672-675`) before its only operator
guard, which sits in the `blocked` branch (C3 point 3, `runs.ts:692-710`). C3's stop-point
list has no entry for the merge-stage entry, and C3 point 1 wrongly calls the loop top "the
boundary between phases" — the implementation→merge transition does not pass through it.

**Failure scenario.** A run is on its last implementation step during a deploy. The operator
clicks Pause; the route records `pauseRequested` as pending because the drive still holds the
run (C4 post-condition 2). The step finishes, `handleImplementationOutcome` returns `go`
(`runs.ts:1123-1125`), and `runOnce` calls `runMergeStageStep` at 947. The PR passes the merge
rule, so `runMergeStage` merges it (`runs.ts:672-675`) and only then does the next loop
iteration hit the operator stop at 804. The PR is merged, its branch pushed, and any
auto-merge side effect (CI, a webhook, the self-update the operator is coordinating) fires —
precisely the outcome D9 and Req 7 exist to prevent — despite a recorded, accepted pause.

**Fix direction.** Add the operator stop at the merge-stage entry: before `runs.ts:947` (or at
the top of `runMergeStageStep`), when `isPauseRequested`, save the `merge` cursor (C5) and
`pause(deps, run, OPERATOR_PAUSE)`, returning before the merge attempt — the same shape C3
point 3 already uses in the `blocked` branch. Correct C3 point 1's "boundary between phases"
wording to name the implementation→merge call as a separate boundary.

### R1-2 — MINOR — C2 "reuses the cancel route's handler shape" is the wrong reference

C2 says the pause route "Reuses: the cancel route's handler shape and its 404 body." The pause
route needs the three-way split `undefined→404 / null→409 / record→200`, which is the **resume**
route's shape (`multi-server.ts:816-822`); the cancel route (`:808-813`) has no 409 branch. The
C2 interface text itself specifies the correct behaviour, so no implementer is misled — wording
only.

### R1-3 — MINOR — Per-check synchronous read cost is unstated

`isPauseRequested` adds a synchronous `readRunSync` on every `shouldStop` and loop-top check,
alongside the existing `windowBlock` sync read. For a single-operator controller this is fine
and the design rightly cites the `windowBlock` precedent, but the added per-check I/O is not
acknowledged. Safe to leave to implementation.

## Top 3 risks / gaps

1. **R1-1**: a held run auto-merges its PR when implementation completes under a pending pause,
   defeating the feature's own deploy purpose (D9, Req 7).
2. Implementer mis-orders the `resumeNow` held branch (C4) after the `status !== 'paused'`
   return, regressing Req 4 AC 4 (pending resume) to a 409. Called out in C4 but easy to miss.
3. The `writeRun` rewrite touches every writer; a serialisation bug there silently drops a
   pending pause across a stale driver write (Req 2 AC 7). Low likelihood given the design, but
   the blast radius is the whole feature.

## Top 3 conclusions to challenge or reverse

1. **"This is the boundary between phases" (C3 point 1)** — reverse: the loop top is the
   boundary for *routed* phases only; the implementation phase exits into the merge stage via a
   direct call that bypasses it. The design needs a stop there (R1-1).
2. **"A merging run pauses at once … an auto-merge can trigger the self-update" (D9)** —
   incomplete: the protection covers runs already in `merging`, not a `running` run entering the
   merge, which is where a fresh PR actually auto-merges.
3. **C3's enumeration of stop points is complete** — challenge: it omits the merge-stage entry
   (`runs.ts:947`) and the close-out merge is only safe because it *is* reached through the loop
   top (`runs.ts:850-858`), an asymmetry the design does not call out.

## What's missing before acting

- A stop point (or an explicit, justified exception) for the merge stage reached from
  implementation `complete` (R1-1), plus a Testing-Strategy case: pause a `running` run whose
  implementation completes with an immediately-mergeable PR, assert the PR is **not** merged.
- Nothing else blocks. The spec-store/library claims, route shapes, restart cases, wait/resume
  races, and the `writeRun` carry rule are all grounded and internally consistent.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
