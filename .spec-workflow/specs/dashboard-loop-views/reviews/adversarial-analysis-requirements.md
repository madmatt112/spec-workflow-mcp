# Adversarial Analysis — dashboard-loop-views/requirements (v1, round 1)

First review. Attacked the three requirements against decomposition entry 23 (scope matches: PR
panel, deferral owner+chip+filter, W-per-task trend; no creep). Fresh lens applied: **wire
contracts across a boundary** (router, query params, response shapes, client state). Every cited
range below was read in the worktree; the context file's probe lines were re-checked against code.

## What I checked and how

- Read both ends of every citation Requirement 1–3 relies on: `merge.ts` (`evaluate` 280-372,
  `MergeStageStatus/Result` 95-107, `readCiState` 390-430, `runMergeStage`/`mergeByRule` 500-586),
  `runs.ts` (`runMergeStageStep` 585-682, `runCloseoutMergeStep` 894-937, `toRow`/`ControllerRunRow`
  1171-1202), `state.ts` RunRecord 54-95, `types.ts` Deferral 310-330, `deferral-storage.ts`
  (serialize/parse/update 42-62/125-170/310-329), `deferrals.ts` (schema 6-109, handleAdd/List/Update
  150-275), `multi-server.ts` buildDeferralsPayload 366-402, `usage.ts` (spawnW 68-78, buildUsageReport
  162, unitCount 384-400), `run-setup.ts` readAgentRules 31-127, `spec-rows.ts` 91-102/144,
  `now-model.ts` 136-144, `file-cache.ts` 1-16, the three `ControllerRun` type copies, `UsagePage.tsx`
  61-102, `DeferralsPage.tsx` 1-15, `primitives.tsx` 63-102, `docs/SDD-HARNESS.md` 252-260.
- Traced the controller-runs push chain end to end: `toRow` → `shell-feed` cast → shell `ControllerRun`
  → frontend `ControllerRun`.
- Confirmed the delta since 6654777 is a lint pass only (five widened citations + rejections); no new
  normative text. Attacked it first (below), then the fresh lens.

## Attack 1 — Requirement 3 AC3: the close-date definition (`now-model.ts:136-144`)

- **Reject the citation `(as closedOn, now-model.ts:136-144)` as the source of "the date of the HANDOFF
  `closeout`/`closed` row."** That code only pushes `closedOn` for closeout rows that pass
  `withinSevenDays(r.date, now)` (`now-model.ts:141`). Its behaviour is *"closeout rows closed in the
  last 7 days,"* not *"the date of the closeout row."*
- **Failure scenario:** a spec closed 2026-09-21 is 28 days before today. The cited derivation yields no
  `closedOn` for it, so AC3's "IF that row is absent" clause fires and the close date falls through to
  "the newest `ts` in the ledger" — a reconcile/run-end timestamp, not the close date. The trend's
  x-axis point is mis-dated and AC10's "newest close date first" ordering is wrong. A trend "over
  closed specs" is almost entirely specs older than 7 days, so this hits the common case, not an edge.
- The row-date *parsing* precedent is fine; the 7-day window is what does not belong. AC3 must cite an
  unwindowed read of the closeout row (`parseHandoffPhaseRows` without `withinSevenDays`) or state that
  the window does not apply here.

## Attack 2 — NFR Performance vs Requirement 3 AC9: who reads `agent-rules.md`

- **Challenge the claim that the usage route reads `agent-rules.md` "through a `FileCache` … so a repeat
  request rereads no unchanged file."** AC9 says the baseline is read "through the one parser
  `readAgentRules` (`run-setup.ts:66-127`)." That parser reads the file with `readFileSync` via
  `readIfExists` (`run-setup.ts:47-52`), bypassing `FileCache` entirely.
- **These two normative lines cannot both hold.** The only reason the usage route touches
  `agent-rules.md` is the baseline; routing it through `readAgentRules` means `agent-rules.md` is reread
  on every request, directly contradicting the NFR. Reconcile: pass cached text to a refactored reader,
  or drop `agent-rules.md` from the FileCache line and accept the uncached read, or state `readAgentRules`
  is adapted to the cache. The document picks neither.
- Minor, same area: "the **one** parser `readAgentRules`" overstates — the analogous `baseline-w-per-spec`
  is read by a separate regex in `controller.ts:455-468`, and `readAgentRules` returns a fixed struct
  (`AgentRules`, `run-setup.ts:32-43`) that must be extended with the new key. Not the one parser.

## Attack 3 — Requirement 1 AC1/AC3: where the CI state and `mergeable` come from (fresh lens)

- **Stress-test the assumption that the merge rule's pass produces a CI state.** `evaluate`
  (`merge.ts:291-372`) folds workflow runs and commit statuses into `reasons` plus `pending`/`unreadable`
  flags; it returns no `CiState` and keeps no per-check verdict. `readCiState` (`merge.ts:397-430`) — the
  `green/pending/red/unreadable` classifier AC3 cites — is called **only** from the implementation phase
  (`implementation.ts:1050`), never from `evaluate`, `mergeByRule` or `runMergeStage`.
- **Challenge "save … the raw `mergeable` value."** `mergeable` lives only inside `evaluate` as a local
  (`merge.ts:348`); neither `MergeEvaluation` (76-93) nor `MergeStageResult` (95-107) carries it, and
  `runMergeStage`/`mergeByRule` return only `status/reasons/number/sha/waitId`. The data AC1 saves (CI
  state, `mergeable`) does not reach the `save` site the AC cites.
- **The contract is unspecified and two-way ambiguous.** To satisfy AC1+AC3+AC11 the merge pass must be
  extended to surface a CI state and `mergeable` up to the controller; the alternative — calling
  `readCiState` again during the merge stage — is a second GitHub read that D1 explicitly rejects (and
  it uses a different fresh-head source, `git show` vs the PR-view `committedDate`, so it can disagree).
  The document names neither path; an implementer can build either, and AC12 ("decision SHALL NOT
  change") adds doubt about whether extending `evaluate`'s return is even allowed. Design will need this
  threaded before it can write a flow.

## Attack 4 — Requirement 1 AC6: the `ControllerRun` wire shape has three copies, not two

- **Challenge "the frontend hand copy of `ControllerRun` SHALL match the server shape."** There are two
  server shapes: `ControllerRunRow` (`runs.ts:1175-1187`, what `toRow` builds) and `ControllerRun`
  (`src/dashboard/shell/types.ts:138-150`, what `shell-feed.ts:109` casts the rows to). AC6 names
  `toRow` and the frontend copy but **omits the shell `ControllerRun`** — the very type the frontend copy's
  own comment says it is a hand copy of ("Hand copy of src/dashboard/shell/types.ts and
  src/controller/runs.ts; keep in step", frontend `types.ts:162`).
- **Failure scenario:** implementer adds PR reads to `ControllerRunRow` + `toRow` + the frontend copy per
  AC6, leaves the shell type untouched. `listRunsForWire() as ControllerRun[]` (`shell-feed.ts:109`) still
  compiles (the field survives at runtime through the cast and the WS send), so the panel may even work —
  but the shell type no longer matches, the documented "keep in step" invariant is silently broken, and
  no server-side consumer can read the PR reads typed. AC6 must enumerate all three declarations.
- `toRow` is a fixed field projection (`runs.ts:1190-1195`), so a new field is dropped unless `toRow` is
  edited — AC6 covers that correctly. The gap is only the omitted middle type.

## Attack 5 — Requirement 2: owner plumbing (completeness, not a blocker)

- The deferral wire path is sound: `buildDeferralsPayload` sends full records from `storage.list()`
  (`multi-server.ts:393-402`) and the frontend `DeferralRecord` has an index signature
  (`ShellProvider.tsx:13`, `[key: string]: any`), so `owner` flows without a frontend type change. No
  wire gap here — stated so the loop does not re-raise it.
- Minor completeness: AC3 requires `add`/`update` to store `owner` and cites the tool layer
  (`handleAdd` 150-190, `handleUpdate` 254-275) but not `DeferralStorage.create` (218-259) or `update`'s
  mutable-field list (310-329), both of which must gain `owner` for persistence. Implied by "store it";
  worth making explicit in design, not a requirements blocker.

## Top risks / gaps (5)

1. **MUST_FIX** — AC3 (R3) mis-cites `now-model.ts:136-144` for the close date; that code is 7-day
   windowed, so every spec closed >7 days ago is mis-dated or dropped. (Attack 1)
2. **MUST_FIX** — NFR Performance ("`agent-rules.md` through a `FileCache`") contradicts AC9 (R3)
   ("baseline through `readAgentRules`", which `readFileSync`s uncached). (Attack 2)
3. **SHOULD_FIX** — AC1/AC3 (R1): the merge pass produces no CI state and does not surface `mergeable`;
   the flow from `evaluate` to `save` is unspecified and two-way ambiguous (extend `evaluate` vs a second
   read D1 forbids). (Attack 3)
4. **SHOULD_FIX** — AC6 (R1): three `ControllerRun` declarations; AC6 names only two, omitting the shell
   type the frontend copy mirrors. (Attack 4)
5. **MINOR** — "the one parser `readAgentRules`" overstates (a second reader exists in `controller.ts`),
   and `create`/`storage.update` owner threading is left implicit. (Attacks 2, 5)

## Top 3 conclusions to challenge or reverse

1. **D1 ("the merge rule's own read … the run record already has one writer and a push path").** The run
   record's writers carry none of this data today: `evaluate` discards per-check state and keeps
   `mergeable` as a local. D1's premise that the data is already in hand at the writer is false; the merge
   pass must first be refactored to emit it. Reverse the framing to "extend `evaluate` to return CI state
   and `mergeable`" so the design owns that work explicitly.
2. **AC3's close-date reuse of `closedOn`.** Reverse: do not reuse the Now-page derivation; it is scoped
   to a 7-day display window and is wrong for the historical population the Usage trend plots.
3. **NFR "repeat request rereads no unchanged file" for `agent-rules.md`.** Reverse or qualify: as cited
   (`readAgentRules`) the file is reread every request. Either the claim or the reader must change.

## What's missing — do before acting

- A single stated data path for the PR panel: which function computes the CI state during the merge
  stage, what new fields `MergeEvaluation`/`MergeStageResult` gain, and where `save` is called with them —
  without a second GitHub read.
- An unwindowed close-date source for closed specs of any age.
- Reconciliation of the `agent-rules.md` read path (FileCache vs `readAgentRules`).
- AC6 to enumerate all three `ControllerRun` declarations (plus `ControllerRunStatus` on the frontend).

## Clean areas (checked, fine)

Scope matches decomposition entry 23; cut items (entries 17/18) are correctly excluded and the baseline
value is correctly deferred to the operator. AC2/AC5 spec-state and task-count citations
(`spec-rows.ts:91-102`, `:144`) are exact. The W fold (`spawnW` 68-78, `buildUsageReport` 162) and the
"equal the usage action exactly" tie are sound. `FileCache`, Chips, the read-only Deferrals page, the
placeholder removal, and the docs key table citations are accurate. The delta since 6654777 is a
citation-only lint pass and introduces no new defect.

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
