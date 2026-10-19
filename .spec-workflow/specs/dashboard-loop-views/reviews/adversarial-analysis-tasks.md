# Adversarial Analysis — dashboard-loop-views/tasks (v1, Round 1)

Primary attack surface: **atomicity, ordering, coverage.** First review; the `## Changes
since ef86abd` diff was empty (tasks.md is the checkpoint), so I attacked the whole
document fresh, grounded in the code it cites and the approved requirements.md and
design.md.

## What I checked and how

**Every cited artifact, read at both ends.** All accurate — no misstated path, range,
signature or behaviour (so no automatic MUST_FIX):

- `merge.ts` — `PR_VIEW_FIELDS` 38-39, `state.ts` import at line 20 (type-only cycle break
  for T2 is sound: merge.ts imports `listWaits` value from state.ts, state.ts would import
  `MergeStageStatus` type-only), `evaluate` 291-372, the **five** unreadable early returns
  inside 297-321 (view-exit 297, parse-fail 301, no-headRefOid 311-313, runs-fail 315,
  status-fail 319), CI loop 323-345, `mergeable` read 347-351, `readCiState` 397-430,
  `closeoutMergeTarget` 457-460 (`basename(repoDir)`), `runMergeStage` 513-519 (no-PR return
  515-517), `mergeByRule` 526-586 (evaluate call at 531; a `read` is reachable on all 8
  returns).
- `state.ts` RunRecord 65-95; `controllerHome()===sddHome()`, `runPath = <home>/runs/<id>/run.json` 206-227 (T14 seed path correct).
- `runs.ts` `save` 521-526, `runMergeStageStep` 599-682 (runMergeStage call 626-632, switch
  634 — inserting the save between 632/634 then re-using `run` keeps reads on every branch),
  `runCloseoutMergeStep` 903-937 (mergeByRule 912), `ControllerRunRow` 1175-1187, `toRow`
  1189-1196, `listRunsForWire` 1199-1202.
- deferral slice: `serializeFrontmatter` 42-63 (supersedes 60), `parseMarkdown` 125-165,
  `create` 218-259 (Omit type accepts optional owner), `resolve` 296-308 / `merge` 352-372 /
  `update` 310-329 (all re-serialize the whole record → owner survives), `reindex` 428-470
  (byte-identical for ownerless → `rewritten:0` holds); `Deferral` 310-330; tool schema
  22-104, desc line 18, handleAdd 150-190, handleList summary 199-207, handleUpdate 254-275
  (key list 260, message 265 is `toContain`-guarded at test:125); TOOLS-REFERENCE table
  add 372 / update 376; wire owner flows automatically (buildDeferralsPayload 393-402 returns
  `storage.list()` full records — no task needed to thread it).
- usage slice: `AgentRules` 32-43, `readAgentRules` 66-127, missing-file return 69-72
  (optional key omitted → `run-setup.test.ts:371-374` whole-struct `toEqual` unchanged;
  regex `^baseline-w-per-task:` cannot collide with `baseline-w-per-spec`); `isSpecClosed`
  source lines 92-93, `firstStatusValue` 52-60, snapshot walk 72-86, `taskProgress` 144,
  `PhaseRow` exported (ledger.ts:89), `parseHandoffPhaseRows` 202-218, `UsageCell`
  {spawns,w,wUnknown} + aggregation 187-208 → T11's `w` gate
  (`total.spawns - total.wUnknown > 0`) and `w = total.w` match AC4/AC8 exactly; `buildUsageReport`
  162-255, `reduceSpawns` 345-368 (seed start+end); route neighbour 526-535, `getAllProjects`
  294-296; SDD-HARNESS key table row 260, "Three keys" 135 (merge keys only — stays).
- frontend: RunPage ctrlRun 122-125 / LiveNow mount 176-186; DeferralsPage FullDeferral
  23-33, statusCounts 75-84, items 87-103 (deps 103), reset 106; UsagePage refetch 67-75,
  placeholder 97-99, header 8-9; `Chips` 69-102 / `chip-{value}` 87 (owner values
  matthew/harness/none do not collide with status chip ids).
- tests: merge exact `toEqual` 171 & 232 (`{ready:true,reasons:[]}` — safe because evaluate
  delegates and returns `.evaluation`, design D1); runs close-out 411-434 and
  not-ready→merged 465-499 (sha `cafef00d1234` at 477); shell-feed quiet-wait 201-243 +
  quintet 252; shell-routes fixture 208-252; e2e seeding 68-91, marker 206.

**Ordering** is forward-only and every task leaves the tree compiling: 1→2→3→4→5 (T1 only
touches evaluate/PR_VIEW_FIELDS; T2 adds PrRead + MergeStageResult.read; T3 consumes them;
T4 hand-copies; T5 renders), 6→7 & 6→8, 9,10→11→12→13, 14 last. No task uses a later task's
artifact.

**Coverage.** R1 (13 AC), R2 (12 AC), R3 (15 AC) all map to tasks. Per the round's rules I
checked each `Test:` line resolves to a real/earlier/own export and is assertable, and that
every test the `Task:` body names reappears in `Success:` — both hold. Every `design D<n>`
citation refers to the **design's** D-numbering (distinct from requirements' D-numbering)
and governs the cited behaviour (D1 inner-fn wrap, D4 repo+number identity, D5 absent wire
field, D6 owner-line-when-set, D8 second chip row, D9 zero-baseline, D10 omitted key, D13/D14
trend, D15 closed-rule reuse). No new external dependency (gate-b) and nothing exceeds the
approved requirements (gate-c).

## Findings

No MUST_FIX, no SHOULD_FIX. Three MINOR observations (recorded, not loop-keeping):

- **R1-1 (MINOR) — T11 `_Leverage` omits the baseline source.** The row's `baseline` comes
  from `readAgentRules(workflowRoot).baselineWPerTask` (design C9), but T11's `_Leverage`
  lists only spec-rows/usage/ledger/file-cache and the prompt body says only "the
  baselineWPerTask task 9 adds, else null". Recoverable: the prompt directs "Implement
  design C9's builder" and C9 spells out the exact call; the NFR fixes it as one uncached
  read. Add `src/dashboard/harness/run-setup.ts (readAgentRules 66-127)` to `_Leverage` for
  completeness.
- **R1-2 (MINOR) — R2 AC11 (deferrals-update refresh) not explicitly proven.** T8 reuses
  the existing `deferralsByProject` push unchanged (design C7 "as at base") and the frontend
  has no unit suite; e2e R2 exercises filter/panel but not the live refresh. Acceptable as a
  reuse invariant.
- **R1-3 (MINOR) — defensive paths unasserted.** T12's NFR-Reliability "project throws →
  skip + log once" and T11's design-D9 zero-baseline edge (keep value, null percentage) have
  no Success assertion; both are hard to force (buildUsageRows is built not to throw) or are
  narrow edges.

## Top risks / conclusions to challenge

1. The live-push proof (R1 AC9) rests on a vitest feed test (T4) + an e2e render from a
   seeded run.json (T14), not a real merging run (design D16). Reasonable — I confirmed the
   seed path (`<sddHome>/runs/<id>/run.json`) and that `listRunsForWire`→feed carries the
   row — but e2e success depends on the harness sharing `SDD_HOME` between the seeding code
   and the server process; untestable here, flagged only as a watch-item, not a defect.
2. T2's `read.at = deps.now()` — in `mergeByRule`, `deps.now` is optional; the local
   `now = deps.now ?? (()=>new Date())` at line 529 is the safe source. Wording only.
3. "No PR read needed when already merged out-of-band" — `runMergeStageStep` returns `none`
   at the `hasMerged` check before saving a read. Not required by any AC; benign.

## What's missing before acting

Nothing blocking. Optionally add the `readAgentRules` leverage cite to T11.

## Scratch
Fuller notes: none beyond this file.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
