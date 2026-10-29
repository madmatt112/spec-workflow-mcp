# Adversarial Analysis — run-pause/tasks (v1, round 1)

Primary attack surface: atomicity, ordering, coverage. Fresh lens: none (prompt).
Deltas since the v1 lint checkpoint (`6d66c506`): four `Test:` lines gained backticks
and T9's `_Prompt` gained `design C10`. All trivial and correct (`C10` exists in the
design). Nothing in the diff is a defect; the attack below is the first full read.

## What I checked and how

Read both ends of every cited range against the worktree code:
- `state.ts`: `RunRecord` 67-101, `writeJsonAtomic` 322-327, `listRunsSync` 348-365,
  `writeRun` 388-394, `readRun` 384-386 — all accurate.
- `runs.ts`: `RunDeps` 388-411, `save` 532-537, `pause` 539-542, `runMergeStageStep`
  621-768 (hasMerged return 624, blocked-branch cursor 689-691, cancel guard 696),
  `runOnce` 770-989 (loop top 804-806, direct merge call 947), the three inline
  `shouldStop` lambdas 933/964/982, handlers 1038-1063 / 1120-1181 / 1184-1206 /
  1209-1262 (error path 1232-1261, fresh retry 1242-1249), `toRow` 1336-1363 — all accurate.
- `controller.ts`: `active` 75, `resumeNow` 207-224, `recover` 261-274,
  `resumeIfWaitAnswered` 291-294, `schedule`/`isStartable` 298-345, `onWaitChange`
  369-392, `runDeps` 438-453, `save` 524-529 — all accurate.
- `document.ts`: `DocumentPhaseContext` 159-198, `DocumentPhaseOutcome` 200-213 (result
  union has no `stopped` today), round loop 802-806, `D === 0` drafter at 771 — accurate.
- Frontend: `pause.ts` `pauseNote` 27-44, `types.ts` note 194 / `ControllerRun` 215-231,
  `RunsPage.tsx` row 209-233 / panel 235-324 / resume handler 261-271 / Resume now
  296-306 / error line 321 — accurate. The `Test:` seam `ctrl-run-pause-${id}` is the
  existing pause-**note** span (225), not a button; T7 asserts note text through it — correct.
- Tests: `runs.test.ts` deps 104-119, usage-limit fixture 348-366, auto merge 574-613;
  `controller.test.ts` window/resumeNow 234-295, crash recovery 414-449;
  `e2e/worktree-shell.spec.ts` seed 164-174 — all accurate.

Requirement→task map is complete: every AC of Requirements 1-7 and all three NFRs is
claimed by at least one task, and I confirmed the claimed task can satisfy it. No
orphan AC, no task without a requirement. Dependency order 1→2→3→4→5→6→7→8→9 holds
(T2 uses T1's `OPERATOR_PAUSE`/injected `isPauseRequested`; T4 wires the real
`readRunSync` and needs T2's driver stop for its in-flight test; T6→T7→T8 chain the
wire field, the predicate and the buttons). Atomicity reads sound: the per-id
serialised `writeRun` that carries `pauseRequested` from disk unless owned makes the
`Promise.all` race (T1 Success) order-independent, and the settle pass (T5) / route
(T4) / loop-top (T2) never double-apply because `isStartable` is false for any held run.

## Topics attacked

### 1. Driver stop-point coverage — the merge-fix round stop (T2)
- Challenge the claim that T2's "Not tested directly" accounting is complete. Its Note
  and Scope-notes line exempt only the **merge-stage-entry** stop (design C3 point 4,
  `runs.ts:624`). T2's `_Prompt` also requires a stop "in the blocked branch after the
  cancel guard (696)" — design C3 **point 3**, the merge-fix round — and no `Success:`
  clause nor scope note mentions it.
- Stress-test the assumption that the loop-top and entry stops cover this. They do not:
  when `runMergeStageStep` is reached from the post-implementation direct call
  (`runs.ts:947`) and the hold is set *during* the `gh pr view`/CI read (between the 624
  check and 696), only the 696 stop parks the run before `runMergeFixRound` spawns a
  model step (`runs.ts:711`). No other guard exists on that path.
- → **R1-1 (SHOULD_FIX, Novel).** See below.

### 2. Success-clause coverage (retro P7)
- Attack T1's `readRunSync` clause. The `Task:` body requires "readRunSync returns
  undefined for a missing **or unparsable** file"; the `Success:` clause asserts only
  "undefined for a missing id". The test-author writes to `Success:`, so the unparsable
  branch is silently dropped. → **R1-2 (MINOR, Novel).**
- Every other task passes: T2 criteria 1-4, T3, T4, T5, T6, T7, T8 each carry a
  `Success:` assertion for every behaviour their `Task:` body names (the one exception
  is topic 1).

### 3. The document-phase stop re-decision (T3) — fine
- Requirement 2 AC 3 lists each document step as a boundary; T3 stops only at a
  review-round top. This is design D3 (RE-DECIDED), recorded in requirements, design
  Revision History and this document's Scope notes — a closed ruling. T3 correctly adds
  `shouldStop?` as optional (so existing `document.test.ts` cases compile), reads only
  the hold (D7), handles the `stopped` outcome and the held pre-retry path in
  `handleDocumentOutcome`, and the `Count` note on the result-union fall-through to the
  error path (1232-1261) is accurate. No defect.

### 4. Controller apply/resume ordering (T4/T5) — fine
- The applied-vs-pending split (queued/paused/merging-and-idle → applied; running/
  waiting/driven → pending), the merge-cursor write for a merging pause, the
  resume-withdraws-pending branch, and the self-heal for a hold withdrawn mid-write
  (pauseRequested absent → `isStartable` true → scheduler clears the reason) are all
  internally consistent and map to real code. Restart cases (T5) seed held records and
  assert they stay `paused`/`operator`; `recover` needing no change is correct because
  the loop-top stop catches a re-driven held run.

## Closing deliverables

**Top 3 risks/gaps**
1. R1-1 — the merge-fix round stop (`runs.ts:696`) is in T2's scope but untested and
   unaccounted; a mis-implementation ships uncaught and a held run can still spawn a
   merge-fix step.
2. R1-2 — T1's `readRunSync` unparsable-file branch is named in the body but absent from
   `Success:`, so it is not test-driven.
3. (Not a finding, watch item) Requirement 5 AC 3 (alive-pid re-attach applies the pause
   at the boundary) has no dedicated test in T2 or T5; it reuses the same loop-top stop
   that criterion 1/4 exercise, and the design's restart testing strategy also omits it,
   so this is consistent, not a gap.

**Top 3 conclusions to challenge or reverse**
1. "Not tested directly: the merge-stage-entry stop (design C3 point 4)" (Scope notes) —
   reverse the implied completeness: C3 **point 3** (merge-fix, 696) is equally
   untested and must be named too, or given a success case.
2. T2 Note "the in-flight case asserts only the observable outcome" — this justifies the
   *entry* stop (624) but is silently extended to cover the merge-fix stop (696), which
   it does not. Separate the two.
3. T1 `Success` "readRunSync returns the written record and undefined for a missing id" —
   widen to the unparsable file the body promises, or drop the promise from the body.

**What's missing before acting**
- For T2: either add a `runs.test.ts` case that enters `runMergeStageStep` unheld, hits a
  `blocked`/eligible PR, flips the hold true before 696, and asserts the run parks
  `paused`/`operator` with the merge cursor and no merge-fix spawn; or extend the "Not
  tested directly" note to cover point 3 with its own justification.
- For T1: add the unparsable-file assertion to the `Success:` clause.

ESCALATE: none — no security, secret, auth, data-loss, money or legal surface.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
