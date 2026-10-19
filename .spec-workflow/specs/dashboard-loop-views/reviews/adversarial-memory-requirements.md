# Adversarial Review Memory — requirements

Last updated: 2026-10-19 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MUST_FIX)** — R3 AC3 mis-cites `now-model.ts:136-144` ("as closedOn") for the close date; that
  code only emits `closedOn` for closeout rows within 7 days (`withinSevenDays`, line 141). Usage trend
  plots mostly specs closed >7 days ago, which get mis-dated via the ledger-ts fallback or dropped. Needs
  an unwindowed closeout-row read.
- **R1-2 (MUST_FIX)** — NFR Performance ("`agent-rules.md` through a `FileCache`") contradicts R3 AC9
  ("baseline read through `readAgentRules`", `run-setup.ts:66-127`, which `readFileSync`s uncached via
  `readIfExists`). Both cannot hold; `agent-rules.md` is reread every request as cited.
- **R1-3 (SHOULD_FIX)** — R1 AC1/AC3 wire/data-flow gap: `evaluate` (`merge.ts:291-372`) produces no
  `CiState` and keeps `mergeable` only as a local (line 348); `readCiState` (390-430) is called only from
  `implementation.ts:1050`, never the merge stage; `MergeStageResult` (95-107) carries neither. Path from
  `evaluate` to `save` unspecified and two-way ambiguous (extend `evaluate` vs a second read D1 forbids).
- **R1-4 (SHOULD_FIX)** — R1 AC6 names only two of three `ControllerRun` shapes. Omits shell
  `ControllerRun` (`src/dashboard/shell/types.ts:138-150`) that `shell-feed.ts:109` casts to and that the
  frontend copy (`frontend types.ts:162`) says it mirrors ("keep in step").
- **R1-5 (MINOR)** — "the one parser `readAgentRules`" overstates (`controller.ts:455-468` reads
  `baseline-w-per-spec` by its own regex); `DeferralStorage.create` (218-259) and `update` mutable list
  (310-329) owner threading left implicit in R2 AC3.

## Patterns & Themes
- Recurring root cause: the document treats data as already available at the writer/wire site when the
  cited function discards or localizes it (CI state + `mergeable` in `evaluate`; close date behind a
  7-day window in `now-model`). Citations name the right *file* but misstate its *behaviour/scope*.
- Wire-contract fan-out: `ControllerRun` has three hand-kept copies; a requirement that names a subset
  leaves the chain inconsistent. The deferral path is safe only because its frontend type has an index
  signature.
- NFR vs AC consistency: performance/cache claims were not cross-checked against the concrete reader the
  ACs cite.

## Guidance for Next Review
- Verify the reviser gave the PR panel one named data path (which fn computes CI state in the merge
  stage; which fields `MergeEvaluation`/`MergeStageResult` gain) with no second GitHub read.
- Confirm the close date no longer inherits the 7-day window.
- Confirm NFR FileCache line and the `agent-rules.md` reader are reconciled.
- Confirm AC6 enumerates all three `ControllerRun` declarations.
- Do not re-raise R1-5 owner-threading or the deferral wire path unless a fix regresses them.
- Fresh lens used this round: wire contracts. Next unused lenses: testability of ACs, failure/empty-state
  coverage, and cross-requirement ordering (close-date tie-break, series-colour determinism).
