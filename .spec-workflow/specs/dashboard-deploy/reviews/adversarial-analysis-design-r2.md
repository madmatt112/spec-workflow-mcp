# Adversarial Analysis — dashboard-deploy/design (v2), round 2

Primary surface: feasibility, consistency, edge cases. Fresh lens: none (deltas are small).

## What I checked and how

The v2 diff is the round-1 response plus concision edits. I attacked the four
behaviour-bearing deltas against the worktree; the rest (Overview/structure/C9
rewording, the D13–D26 reword that drops the enumerated alternatives, the Scope-notes
cut, scenario 5/8 rewording) are prose and carry no new claim.

- **R1-1 fix (C1 Release).** Traced the emit path. `runEvents` is defined in
  `src/controller/runs.ts:58` and emitted only from `runs.ts` (`patchRun` :433,
  `setRunHeartbeat` :445, `save` :563, :1392) and `controller.ts` (:211 enqueue, :476,
  :700 save) — the controller layer. `hub.ts:50` subscribes `runEvents→onSourceChange`
  which `schedule()`s the 1 s feed (`shell-feed.ts:44-45`), so one emit refreshes every
  row. The behaviour the fix wants is sound. **But the fix attributes the emit to the
  wrong component — see Attack 1.**
- **R1-2 fix (C1 "Failed and done writes keep the record's other fields, commit
  included").** Covers the onStart `done` write (R3 AC1) and the script/controller
  converge-on-`done` at `restart`. `commit` is written once at `sdd-self-update.sh:180`
  (after the first `check_move`), long before `restart`, so every later merge-write
  re-reads it; both writers (script `write_stage`, controller `writeJsonAtomic`) read-
  merge-rename, last-writer-wins on `stage`, neither drops `commit`. Adequate. No new gap.
- **R1-M2 fix (C8 `execDeploy` adds `state: 'refused'`).** Verified against
  `execMerge` (`src/advisor/actions.ts:350`), whose refusal return is literally
  `{ ok:false, outcome:'refused', detail, error:'refused', state:'refused' }`. The
  design's `execDeploy` refusal shape is valid for `ExecResult`. Accurate.
- **C4 Claim reword (D15).** "After this `mkdir` no cancel sends a stop" — a cancel's
  `fs.mkdir` after the script's gets `EEXIST`→409, and a cancel that wins refuses the
  script before `write_stage swap`. Mutual exclusion holds. Accurate.
- `src/controller/deploy.ts` confirmed new (does not exist). `controller.ts:277-284`
  (resumeNow held branch) matches the Release parity citation :278-281 (paused→queued,
  clears `pauseReason`/`resumeAt`/`pauseRequested`). Accurate.

No misstated cited artifact → no MUST_FIX from citations.

## Attack 1 — the R1-1 fix pins `runEvents` emit on `updateRun`, which cannot emit it

C1 Release (the v2 delta) now reads: "For every run listed with `holdBy: 'deploy'`,
**`updateRun` re-checks `holdBy` inside the chain, clears it and `pauseRequested`, and
emits `runEvents` `change` for it** (parity with press step 6)." The grammatical subject
of "emits" is `updateRun`.

- **Challenge the placement.** C2 defines `updateRun` as a new primitive in
  **`src/controller/state.ts`** ("runs inside the id's write chain
  (`src/controller/state.ts:447-455`)"). But `runEvents` lives in `src/controller/runs.ts:58`,
  and `state.ts` neither imports it nor any symbol from `runs.ts`. `state.ts:18` carries an
  explicit guard — "Type-only so no runtime cycle forms: `merge.ts` imports `state.ts` at
  runtime" — and `runs.ts` imports `state.ts`. Making `updateRun` emit `runEvents` forces
  `state.ts`→`runs.ts` at runtime, closing the cycle the file is written to avoid.
- **Stress-test "parity with press step 6."** Press step 6 does **not** make `updateRun`
  emit: "Apply the holds through `updateRun` (C2)… **Emit `runEvents` `change`**" — the emit
  is a separate action performed by the coordinator (the same pattern as `controller.ts:211`,
  where `enqueue` — not `writeRun` — emits once). So the fix's own cited precedent puts the
  emit in the coordinator layer, contradicting the sentence that puts it in `updateRun`.
- **Failure scenario.** A literal implementer adds `runEvents.emit('change', run)` inside
  `updateRun` in `state.ts`, which requires `import { runEvents } from './runs.js'` there —
  the exact runtime import cycle `state.ts:18` forbids. The alternative, a confused
  implementer who notices `updateRun` can't reach `runEvents` and has no design sentence
  telling them the coordinator emits instead.
- **Direct the fix.** Attribute the emit to the coordinator (`deploy.ts`, same layer as
  `runs.ts`, free to import `runEvents`), exactly as press step 6 does — e.g. "Release calls
  `updateRun` for each held run… and emits `runEvents` `change` (parity with press step 6)."
  One emit suffices; `onSourceChange` ignores the record arg and re-reads all runs. If the
  intent is that `updateRun` itself emits, relocate `updateRun` out of `state.ts`.

**R2-1 (SHOULD_FIX) — Novel / Compounds R1-1 / fix-induced.** The R1-1 fix attributes the
`runEvents` emit to `updateRun`, a `state.ts` primitive that cannot emit the `runs.ts`
event without the runtime cycle `state.ts:18` guards against; it also contradicts the
"parity with press step 6" it cites, where the coordinator emits separately.

Fix-induced re-check scope: the one clause the R1-1 delta added to C1 Release, against the
emit-layer pattern (press step 6 / `controller.ts:211`). Not a whole-document re-review.

## What else I looked for and did not find

- No MUST_FIX: every cited artifact in the delta is accurate; no unimplementable
  requirement, no data/security hole.
- Error-branch shapes (press/cancel/resume/execDeploy) still pin discriminant + status;
  the enqueue race-loser (`run-live` vs `deploy-open`) is closed by the R1-M1 ruling — not
  re-opened.
- Data Models complete: `DeployRecord` fully enumerated, `ControllerDeploy` an `Omit`,
  press/cancel/resumeNow returns pinned.
- D26 live-scenario proof is still routed to `verification-evidence.md` by ruling — not a
  defect, but the largest unverified surface; carry it as the gate it is.

## Closing deliverables

**Top risks/gaps (short doc → 3)**
1. R2-1: C1 Release puts the `runEvents` emit on `updateRun` (a `state.ts` primitive), an
   architecture inconsistency that invites a layering-violating implementation.
2. The R1-1/R1-2 fixes otherwise land correctly, but both were the "emit/write stated for
   one path, implicit for the mirror" asymmetry the memory flagged; R2-1 is a fresh instance
   of the same pattern introduced by the fix. Watch the next delta for the same shape.
3. Live-only proof (D26): six entry scenarios, 2 s stage delivery, 10 s reconnect — verified
   only by a hand deploy. Design-clean, but the biggest untested area.

**Top 3 conclusions to challenge or reverse**
1. "`updateRun` … emits `runEvents` `change`." Reverse: the coordinator emits, as press step
   6 and `controller.ts:211` do; `state.ts` cannot emit a `runs.ts` event (R2-1).
2. "parity with press step 6" as written — press's emit is the coordinator's separate step,
   so the parity argument actually refutes the sentence's own attribution.
3. Nothing else in the v2 delta needs reversing; R1-2 and R1-M2 fixes are correct.

**What's missing before acting**
- One sentence moving the Release `runEvents` emit to the coordinator (or relocating
  `updateRun`). That is the whole gap; no new seam, data model, or decision is needed.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
