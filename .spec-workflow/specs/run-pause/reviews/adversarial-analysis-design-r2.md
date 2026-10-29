# Adversarial Analysis — run-pause/design (v2), Round 2

Primary surface: feasibility, consistency, edge cases. Fresh lens for this round: none.
This round attacks the v2 delta (the R1-1 fix) first, then re-sweeps the stop-point
enumeration and the merge/resume seam.

## Delta under review

Revision History v2 records: R1-1 Accepted (added the merge-stage-entry stop, C3 point 4;
corrected the loop-top wording, C5 cursor list, D3, Overview; added a Testing case),
R1-2 Accepted (C2 reuse line now cites the resume route), R1-3 Rejected (per-check read
already stated). The substantive new code claim is C3 point 4 + C5; the rest is wording.

## What I checked and how (from the worktree)

Read both ends of every range the delta touches:

- `runs.ts:621-768` `runMergeStageStep` — `hasMerged` early return at **624** (`return 'none'`),
  `onDefault`/no-PR branches (635-660), `runMergeStage` at **663** and `case 'merged'` at
  **672-675**, the `blocked` branch merge cursor at **689-691** and merge-fix guards at 692-710.
- `runs.ts:770-950` `runOnce` — merge-resume detection at **778-781**, loop top / cancel check
  at **804-806**, `resumingMerge` block calling `runMergeStageStep` at **811**, and the direct
  implementation→merge call at **947** (`if (merge === 'stop') return;` at 948).
- `runs.ts:539-542` `pause` signature; `runs.ts:1120-1132` `handleImplementationOutcome`
  (`complete` → `return 'go'` at **1125**; `stopped` block at 1127-1132).
- `controller.ts:207-224` `resumeNow` (the `status !== 'paused'` → `null` return at **210**).
- `controller.test.ts` — merge stage is testable in the integration harness: `stub-gh.mjs`,
  `scriptMergeablePR` (133-146), and the `Controller merge stage` describe block (319-373).

**Every code artifact the delta cites is accurate** — paths, ranges, the `624`/`663-675`/`811`/
`947` line numbers, and the `complete → go` / `resumeNow` return behaviour. No misstated-artifact
MUST_FIX.

## Attack 1 — C3 point 4 "Merge-stage entry" (the R1-1 fix)

- **Stress-tested the placement against the R1-1 failure scenario.** A run held on its last
  implementation step: the step completes, `handleImplementationOutcome` returns `go` (1125),
  `runOnce` calls `runMergeStageStep` at 947. The new check sits after the `hasMerged` return
  (624) and before `runMergeStage` (663), so a held run saves the `merge` cursor and pauses
  before the clean PR can merge. The gap R1-1 named is closed. Sound.
- **Re-swept for any other direct inter-phase call that bypasses the loop top.** Only 947
  qualifies: document (914-917), retrospective (952+) and the done/close-out merge (850-887,
  `runCloseoutMergeStep` at 855) all re-enter through the loop-top check (point 1) via `continue`
  or are reached after it. No second un-held entry exists. Enumeration is now complete.
- **Probed the resume round-trip.** After the merge-entry pause: `pauseRequested` set, status
  `paused`/`operator`, cursor `stepKind: 'merge'`. Resume (`resumeNow`) writes `queued` and clears
  the hold but leaves the cursor; `runOnce` 779-781 reads `!hasMerged && cursor.stepKind==='merge'`
  → `resumingMerge` true → re-enters `runMergeStageStep` at 811 and merges. Req 4 AC 2 holds.
- **Probed the "also covers the merge resume at 811" claim.** True but redundant: the loop-top
  stop (point 1) is placed between the cancel check (806) and the `resumingMerge` block (809) with
  no intervening await, so a held run can never reach 811 — point 1 fires first. Belt-and-suspenders,
  not a defect.
- **Probed the default-branch / already-merged edges.** Held entry on a default-branch run pauses,
  then on resume returns `none` (no PR) and routes on — harmless. Already-merged PR returns `none`
  at 624 before the check; the loop-top stop catches the hold before the retro. Fine.

## Attack 2 — the grounding of the no-auto-merge behaviour (C3 point 4, Testing line 169)

- **Challenged the citation `(Requirement 7 AC 1)` for "the PR stays unmerged".** Req 7 AC 1 reads
  "…no next step SHALL start…". Per the requirements' own Terms, a **step** is "one model step
  process the controller spawns through `runStep`"; merging a clean PR is `runMergeStage`
  → `gh pr merge`, **not** a `runStep` (only the merge-fix round spawns a step). So Req 7 AC 1 is
  literally satisfied even if a clean PR auto-merges, and it does not mandate "the PR stays
  unmerged." The real mandate is D9's rationale ("an auto-merge can trigger the self-update the
  operator is trying to control"), which the requirements scope to a `merging` run, not a
  `running` run entering the merge. The behaviour the fix adds is correct and clearly intended;
  only the traceability tag over-claims. This is **R2-1 (MINOR)** — see Findings.

## Attack 3 — C5 "Merge re-entry marker" delta

- **Verified the expanded trigger list.** C5 now lists "the merge-stage-entry stop on a run
  completing implementation (C3 point 4)" as a fourth writer of the `merge` cursor, matching
  C3 point 4. The cursor shape `{ phase: run.phase ?? 'implementation', stepKind: 'merge',
  attempt: 1 }` matches the `blocked` path at 689-691; at the merge entry `run.phase` is
  `'implementation'` (set at 926). The close-out clause ("`hasMerged` already true, so the cursor
  is inert") is correct: 779-781 gates the cursor read on `!hasMerged`, so a close-out run routes
  to `done` and the close-out merge step. Consistent.

## Clean areas (not re-opened)

- D2 `writeRun` carry rule, Error Handling 4 (resume-vs-pause-write race), the `isStartable`
  first-rule vs the 30 s merge poll, the document round-top RE-DECIDED (D3), and `resumeNow`'s
  load-bearing "held branch first" ordering were all traced and sound in R1; the v2 delta did not
  touch their logic. R1-2 is fixed (C2 line 54 now cites the resume route). R1-3 stays rejected.

## Findings

### R2-1 — MINOR — `(Requirement 7 AC 1)` over-claims the no-auto-merge mandate
`Compounds: R1-1` · fix-induced · Novel observation on fix-induced text

C3 point 4 and the Testing case (line 169) cite `(Requirement 7 AC 1)` as the grounding for "a
held run does not auto-merge its PR / the PR stays unmerged." Req 7 AC 1 forbids starting a *next
step*, and merging a clean PR is not a step (Terms: a step is a `runStep` model process; the
merge is `gh pr merge`). So that AC does not actually require the PR to stay unmerged. The correct
anchor is D9's rationale. Wording/traceability only: the design body independently states the stop
is required, so no implementation is misled and the Testing assertion is still the right one.

## Top risks / gaps

1. None that block. The one accepted R1 gap (merge-stage entry) is closed and its code claims are
   accurate; the enumeration of stop points is now complete.
2. Watch at tasks time: the R2-1 tag could tempt a reviewer to weaken the "PR stays unmerged"
   assertion as "not required by Req 7 AC 1." The design body prevents that, but a one-word tag
   fix (cite D9) would remove the ambiguity.

## Top conclusions to challenge

1. **"(Requirement 7 AC 1)" grounds the no-auto-merge** — reverse: it grounds "no next step," not
   "no merge"; D9 is the real anchor (R2-1).
2. Nothing else from the delta reverses: the merge-entry placement, the cursor wiring and the
   resume round-trip are all consistent with the code.

## What's missing before acting

- Nothing blocks implementation. Optionally retag R2-1 to D9. Design is ready.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
