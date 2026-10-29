# Adversarial Analysis — run-pause/requirements (v1, round 1)

Primary surface: completeness, ambiguity, scope. Fresh lens: wire contracts across a
boundary (router, query params, response shapes, client state). Deltas attacked first.

## Deltas since a6febdb6 — verified clean

- R1 AC6 citation `src/controller/access.ts:198-208` → `186-208`. Verified: `makeRequireAccess`
  is `access.ts:186-211`; a non-login POST under `/api/controller/` falls past the read/login
  exemptions (`194-196`, `201`) to the secret check and the `401` at `208`. The new range now
  spans the function signature through the `401`. Accurate.
- R2 AC3 added citation `src/controller/runs.ts:1209-1262` for `handleDocumentOutcome`. Verified:
  the function is `1209-1262`, the in-place fresh retry `runDocumentPhase` is at `1242`. Accurate.
- Revision-history lint note: a disposition record, not a claim. No action.

No delta regressed a prior-agreed anchor.

## Topics attacked

### 1. Response-body citations (R1 AC3, R4 AC6) — wire-contract lens
- Challenge the anchor `src/dashboard/multi-server.ts:808-813` for "the same body as the cancel
  route" `404 { error: 'run-not-found' }`. The cancel body is at **line 814**; `808-813` runs from
  the GET route's closing `}` (808) through the cancel call (813) and stops one line short of the
  body. Artifact excluded from the range.
- Challenge the anchor `src/dashboard/multi-server.ts:816-822` for `409 { error: 'not-paused' }`
  "as today". The `not-paused` body is at **line 823**; `816-822` ends at the `404` check (822),
  one line short. Artifact excluded.
- These two anchors govern the exact response shapes the new pause route must mirror — the heart
  of this round's lens — so the imprecision lands where precision matters most.

### 2. Resume re-enters the merge stage (R4 AC2, D9) — controller-state contract
- Stress-test the claim that "Resume SHALL re-enter the merge stage" for a run paused from
  `merging`. The only durable merge-resume signal is `run.status === 'merging'`
  (`runs.ts:779`). R2 AC2's applied-pause write sets `status: 'paused'`, erasing it.
- Stress-test the fallback. `resumingMerge` also fires on `cursor?.stepKind === 'merge'` or an open
  merge wait (`runs.ts:780-781`). A `merging` run reached by the auto re-check (`not-ready`,
  `runs.ts:677`) has **neither**: its cursor is still `{stepKind:'implementation'}` from
  `runs.ts:926`, and `not-ready` opens no wait. So after an operator pause + Resume,
  `resumingMerge` is `false`.
- Trace the consequence: `runOnce` falls through to `routeRun`; with all tasks `[x]` it returns
  `retrospective`/`done`, skipping the merge entirely — the PR never merges by rule. This directly
  contradicts R4 AC2 and D9. The requirement must state that the pause preserves a merge re-entry
  marker (or R4 AC2 must cite the mechanism), because the behaviour is not achievable against the
  code as written.

### 3. Row-level Pause action (R6 AC1-AC2) — client-state contract
- Challenge "a failed call SHALL show the error as the panel's other actions do" **on a row**.
  `ControllerRunRow` (`RunsPage.tsx:209-233`) is a stateless presentational component; only
  `ControllerRunPanel` holds `busy`/`error` state and an error `<p>` (`RunsPage.tsx:243-245,321`).
  The row has no error surface, so "as the panel does" does not map. R6 AC2 also requires a per-row
  busy state — net-new local state the row does not carry today. The error-render location is
  unspecified; a frontend implementer will guess.

### 4. Pause route completeness (R1) — checked, sound
- Live vs terminal partitions all eight `RunStatus` values (`state.ts:56-64`): live (5) → 200,
  terminal (3) → 409. No status falls through. `paused` is live, so R1 AC5 (idempotent) and R3 AC2
  (usage→operator) cover both already-paused cases. `runEvents` is emitted by both `runs.ts:save`
  (`532-537`) and `controller.save` (`524-529`), so R1 AC7 holds. Fine.

### 5. Scheduler / restart invariants (R3 AC6, R5 AC2) — checked, sound
- `isStartable` (`controller.ts:333-339`) returns `true` for a `paused` run with no `resumeAt`
  whatever the reason, and `schedule` (`316-327`) clears `pauseReason` on any paused run it starts.
  The document correctly flags both as red-first and cites them. R4 AC3's "parked as usage-window"
  resolves through the `runOnce` loop-top window check (`runs.ts:831-836`), not the `schedule`
  blocked branch. Coherent.

## Top risks / gaps

1. **R4 AC2 merge re-entry is unimplementable as stated** (Topic 2). The pause erases `status:
   'merging'`; a `not-ready` merging run has no `merge` cursor and no merge wait, so Resume skips
   the merge stage and the PR never merges. SHOULD_FIX.
2. **Two response-body anchors exclude the artifact line** (Topic 1): `:808-813` for `run-not-found`
   (body at 814), `:816-822` for `not-paused` (body at 823). Wrong line ranges. MUST_FIX.
3. **Row-level Pause error surface unspecified** (Topic 3): the row is stateless with no error
   display; "as the panel does" has no target on a row. MINOR.

## Top 3 conclusions to challenge or reverse

1. **"D5 — Resume reuses the existing resume route and branches on the pause reason."** The branch
   is not only on reason: a pending pause sits on a `running`/`waiting` run, where `resumeNow`'s
   `if (run.status !== 'paused') return null` (`controller.ts:210`) fires first and yields 409 —
   the opposite of R4 AC4's required 200-withdraw. R4 AC4 carries the real contract; D5's one-line
   summary understates the change. Not wrong, but do not let it mask the status-based branch.
2. **R4 AC2's "or its last stage was the merge stage."** Reverse the assumption that a durable
   signal for this exists. After the pause write there is none for the common `not-ready` case.
   Either keep the run in a state the merge detection recognises, or add a marker — decide this in
   requirements, not silently in design.
3. **R1 AC3 "the same body as the cancel route."** The sameness is real (both `run-not-found`), but
   the anchor does not point at the body. Anchor it at the body line (814), not the handler opener.

## What's missing — before acting on this document

- A named, persistent merge-resume marker in R2 AC2 / R4 AC2 (survives `merging → paused`).
- The row's Pause error/busy surface, or an explicit deferral of the render location to design.
- Corrected body anchors at `multi-server.ts:814` and `:823`.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```

`iterate` because MUST_FIX = 1 and SHOULD_FIX = 1.
