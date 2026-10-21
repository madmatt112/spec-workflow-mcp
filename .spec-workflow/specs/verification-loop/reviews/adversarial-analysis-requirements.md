# Adversarial Analysis — verification-loop/requirements (v1, round 1)

Reviewed v1 against the real code under the worktree. **Deltas first** (the lint
pass that produced v1's four re-anchored citations), then the required **fresh
lens: wire contracts across a boundary**. Primary surface: completeness,
ambiguity, scope.

## Deltas since 21537de — verified clean

The lint pass only widened four citations. Each was checked at both ends:

- R1 intro `src/controller/runs.ts:611-682` — `runMergeStageStep` starts at 611;
  the `blocked` → `error`-wait branch is 669-682. Range is accurate.
- R1 AC2 `src/controller/phases/implementation.ts:1069-1126` — `prChecksGate`
  starts 1069; the saved log-tail loop is 1117-1126. Accurate (names the function
  and the save loop).
- R1 AC12 `src/controller/runs.ts:927-931` — `runCloseoutMergeStep`'s doc comment
  (927-929) states "a failed, unreadable or blocked PR ⇒ an `error` wait"; 931 is
  the signature. Accurate anchor for "blocked close-out ⇒ error wait, no fix round".
- R2 intro `src/controller/step.ts:93-111` — `StepSpec` interface; `model` (109)
  and `effort` (111) are the override fields. Accurate.

No misstated artifact in the deltas → no delta-induced MUST_FIX. Doc citations
(ADR 0003:12-14, controller-design.md:194-208 = §10, ai-resources-catalogue.md:125-163,
`merge.ts:588-591`, `:295-297`, `:568-583/642`, `:320-324`, `implementation.ts:884-911`,
`:371-381`, `:1143-1148`, `veto-rules.ts:65-153`, `harness.ts:1162-1220`,
`state.ts:109-126`, both `types.ts` hand copies, `RunPage.tsx:345-394`) all read as
stated.

## Topic 1 — R2 AC7: the "Sonnet route" has no named source key (fresh lens: a contract against the profile file's test)

AC7: *"The Sonnet route's model and effort SHALL be read from `harness/agent-profiles.json`…
their first values SHALL be `claude-sonnet-5` and `high`. The ten-key,
frontmatter-equality and byte-for-byte assertions of `src/__tests__/agent-profiles.test.ts:23-47`
SHALL stay green."*

- Challenge the claim that these three constraints are jointly satisfiable without
  naming a key. `agent-profiles.json` has **exactly 10 keys**, each pinned to a
  `harness/agents/<key>.md` frontmatter (`agent-profiles.test.ts:23-31`). A new
  `sonnet-route` key makes 11 and **breaks the ten-key assertion**; it also has no
  agent file, breaking frontmatter-equality. So the route MUST reuse an existing key.
- The only `claude-sonnet-5` / `high` entries are `sdd-checker` (`:8-13`) and
  `sdd-test-author` (`:50-55`). AC7 never says which. D9's prose ("that pair already
  runs the test author") hints `sdd-test-author`, but no AC states it.
- Stress-test the unstated coupling: if the implementer's Sonnet model is read from
  `sdd-test-author`'s entry, a future spec that re-tiers the test author silently
  re-routes every non-sensitive implementer. The document never acknowledges this.
- Failure scenario: an implementer reads AC7, adds a `sonnet-implementer` profile key
  → `agent-profiles.test.ts` goes red → rework. Or it hard-codes which key to read,
  contradicting D9's "the profile file is the model source."
- **Fix:** name the exact profile key the Sonnet route reads (and state the coupling),
  or add a route that survives the ten-key test. **SHOULD_FIX.**

## Topic 2 — R1 AC1/AC8: classifying blocking reasons by kind has no structured source

AC1 fires a fix round only WHEN *"every blocking reason is a failed workflow run, a
failed commit status, or a merge conflict"*; AC8 opens the wait WHEN *"any blocking
reason is an attribution trailer or a wrong head branch."*

- Challenge the assumption that the controller can tell a reason's kind. The `blocked`
  result carries `reasons: string[]` (free text) plus `ci` and raw `mergeable`
  (`merge.ts:588-591`, `state.ts:109-126`). Failed checks map to `ci==='red'` and a
  conflict to `mergeable` CONFLICTING — but **attribution-trailer and wrong-head
  reasons exist only as English strings** built in `merge.ts:393-405`
  ("…carries a Claude attribution trailer", "head branch is …, expected …").
- To prove "every blocking reason is fixable" (AC1) you must prove *no* trailer/head
  reason is present — reachable today only by string-matching merge.ts's exact wording.
- Failure scenario: merge.ts reworders "head branch is X" in a later change; the
  controller's regex misses it, runs a doomed fix round on an unfixable PR, burns the
  2-round cap, then errors anyway — the opposite of AC8's intent.
- **Fix:** require the merge evaluation to expose a structured reason kind, or state
  explicitly that AC1/AC8 classify from `ci`/`mergeable` plus a pinned reason-kind set.
  **SHOULD_FIX.**

## Topic 3 — R2 AC10 vs R3 AC6: the security fix round's tier is ambiguous

AC10 enumerates non-task implementer steps that keep the Opus profile: *"repair
rounds, PR checks reconcile rounds, merge fix rounds of R1."* R3 AC6 adds a new
non-task implementer step — the **security fix round** — that the list omits.

- Challenge whether AC10's list is exhaustive or illustrative. If exhaustive, R3's
  security fix round has no routing rule and R2 AC1 (task steps only) does not cover
  it → undefined tier. If illustrative, the general clause routes it to Opus, but the
  omission reads as deliberate.
- Failure scenario: the implementer of R3's fix round runs on Sonnet because no AC
  put it in scope, weakening exactly the sensitive-spec review R3 exists to harden.
- **Fix:** add R3's security fix round to AC10's enumeration. **SHOULD_FIX.**

## Topic 4 — R1 AC5: no run-state transition after an `INFRA:` merge fix round

AC5: on `INFRA:` the controller re-runs the failed workflows and the round counts
toward the cap. AC4 handles the "new commit" case (push + `merging` + re-check);
AC6 handles "no new commit and no `INFRA:`". **INFRA produces no commit and is
explicitly excluded from AC6**, so no AC says what the run does next.

- Stress-test the gap: after re-running the workflows the run needs `merging` +
  re-check (as `prChecksGate` re-polls, `implementation.ts:1144-1147`), else the run
  has no defined state and the re-run CI result is never read.
- **Fix:** state that an `INFRA:` round sets `merging` with a re-check time.
  **SHOULD_FIX.**

## Topic 5 — R2 AC8: spawn.end has no effort field to carry

AC8: *"`spawn.start` and `spawn.end` rows SHALL carry the model and effort the step
ran on."* `spawnStart` takes `effort` (`ledger.ts:63,128`) but **`spawnEnd` carries
`model` only, no `effort`** (`ledger.ts:64,130-143`); `stepUsage` passes none
(`implementation.ts:377`). AC8 asserts behavior for a row field that does not exist.

- **Fix:** either add an `effort` field to `spawnEnd` deliberately (a usage-ledger
  shape change — name its blind spots per agent-rules), or scope the effort clause to
  `spawn.start`. **SHOULD_FIX (borderline MINOR).**

## Minor (do not keep the loop alive on their own)

- R3 AC8 lists `abandon` on the security escalation wait, but AC9 specifies only
  `accept` and `retry`; `abandon`'s behavior is left to the generic handler, unstated.
- R4 AC1 says "between the PR's base and head" without fixing base-branch-tip vs
  merge-base, while R3 AC3 says "merge base" explicitly; the set-difference semantics
  make this low-risk but the inconsistency invites a wrong diff basis.
- The Alignment section maps R1/R2/R3 to grill decision 1 but silently omits R4.

## What's fine (checked, moving on)

- **R4 wire contract (the named fresh lens) is sound.** PrRead (`state.ts:109-126`)
  flows through `ControllerRunRow.prReads: PrRead[]` and `toRow` as-is
  (`runs.ts:1224,1233`), the shell feed passes it through (no field-by-field remap;
  `shell-feed.test.ts:244-272`), and AC3 updates both hand copies
  (`dashboard/shell/types.ts:161-172`, `dashboard_frontend/.../types.ts:184-195`) that
  `PrPanel` consumes (`RunPage.tsx:345`). Adding one optional field carries end to end;
  old records without it render no chip. No dropped-field gap.
- R2 AC4's "same rule as `harness gate class-a`" is accurate: `gateClassA`
  (`harness.ts:1214`) is `applyKeywordSaturationFallback(computeClassA(...))`, and the
  fallback leaves sensitive-path items untouched (`veto-rules.ts:124,138`), so the flag
  is stable. AC3's "keyword items (incl. destructive) do not route" matches the
  `kind:'keyword'` tag on fallback items (`veto-rules.ts:143-149`).
- Scope matches decomposition entry 26 (R1–R4 = items 1–4; R5 docs is supporting, not
  creep). Close-outs and keyword routing correctly out of scope.

## Top 3 conclusions to challenge or reverse

1. **"The Sonnet route reads from the profile file" (AC7/D9) is under-determined.** The
   profile file cannot hold a dedicated route without breaking its own pinning test;
   reversing to "a named existing profile key, with the coupling stated" is cleaner.
2. **"The merge rule returns enough to classify reasons" (implicit in AC1/AC8) is
   false today.** Reasons are free text; design needs a structured reason kind.
3. **"AC10 covers every non-task implementer step" is false** — it omits R3's security
   fix round.

## What is missing before design

- A named key (or route) for R2's Sonnet model that keeps `agent-profiles.test.ts` green.
- A structured blocking-reason kind for R1's fixable/unfixable split.
- The INFRA merge-fix-round run-state transition.
- Decide the `spawn.end` effort field and the `abandon` branch of R3's wait.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 5
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
