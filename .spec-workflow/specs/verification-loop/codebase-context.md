# Codebase context — verification-loop

Code root: `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop` (paths below are relative to it).

## Source of the scope
- docs/ai-resources-catalogue.md:125-163 — the 2026-10-20 grill decisions 1-17 (C1, C3, C4, C5 make spec 26)
- docs/adr/0003-merge-by-rule.md:1-31 — merge by rule; a model never merges; blocked PR is an `error` wait (2026-10-15 amendment)
- docs/controller-design.md:194-208 — section 10, the merge rule
- GLOSSARY.md:46-50 — "Check": the deterministic test of one commit; "review gate" is avoided

## Merge stage (controller, no model)
- src/controller/merge.ts:26-27 — `MERGE_QUESTION_ID`: `merge` for the run's own PR, `merge:<repo>#<n>` for a close-out PR
- src/controller/merge.ts:97 — `MergeStageStatus` union (merged, waiting, not-ready, blocked, unreadable, failed)
- src/controller/merge.ts:284-412 — `evaluate` / `evaluatePullRequest`: the readiness rule, its reasons, the CI state and raw `mergeable`
- src/controller/merge.ts:414-472 — `CiFailing`, `CiState`, `readCiState`: failing checks of a head sha with workflow run ids
- src/controller/merge.ts:537-561 — `runMergeStage`: finds the run's own PR and calls `mergeByRule`
- src/controller/merge.ts:563-642 — `mergeByRule`: one pass; builds the `PrRead`; `blocked` when not ready and nothing pending
- src/controller/runs.ts:597-710 — `runMergeStageStep`: maps each status to a run change; `blocked` opens the `error` wait with a `merge` cursor
- src/controller/runs.ts:712-723 — `runOnce` resumes a mid-flight merge stage before routing
- src/controller/runs.ts:852-881 — the implementation branch of the run loop, then the merge stage
- src/controller/runs.ts:931 — `runCloseoutMergeStep`: close-out PRs through `mergeByRule` (out of scope for fix rounds)
- src/controller/runs.ts:1015-1056 — `handleImplementationOutcome`: `verify-failed` and other non-complete results become an `error` wait
- src/controller/runs.ts:1211-1235 — `ControllerRunRow` / `toRow`: `prReads` passed to the wire as is
- scripts/stub-gh.mjs:1-86 — the `gh` stub the merge tests swap in through `CONTROLLER_GH_BIN`

## Implementation phase (controller, model steps)
- src/controller/phases/implementation.ts:48-58 — caps: `FIX_ROUNDS_CAP` 3, `REPAIR_CAP` 2, `RECONCILE_CAP` 3, CI poll and wait
- src/controller/phases/implementation.ts:147-161 — `IMPLEMENTER_SCHEMA` (flag includes `INFRA`, `reproduce` for CI fixes)
- src/controller/phases/implementation.ts:174-184 — `E2E_SCHEMA`: verify, deferredCommand, findings, retro
- src/controller/phases/implementation.ts:371-418 — `stepUsage` (spawn rows take the model from `loadRole`) and `runModelStep` (builds the `StepSpec`, no model override today)
- src/controller/phases/implementation.ts:600-668 — the implementer step of one task (two attempts, checks-file re-spawn)
- src/controller/phases/implementation.ts:753-786 — a task fix round on the `sdd-implementer` role
- src/controller/phases/implementation.ts:879-956 — `completionGate`: end-to-end verification, repair rounds, HANDOFF, push and PR, PR checks gate
- src/controller/phases/implementation.ts:891-904 — the deferred-verification deferral the completion gate creates (no owner set)
- src/controller/phases/implementation.ts:958-980 — `verifyEndToEnd`: the `e2e` verifier brief and report parse
- src/controller/phases/implementation.ts:982-1003 — `repairRound`: an implementer repair after a failed end-to-end verification
- src/controller/phases/implementation.ts:1068-1171 — `prChecksGate`: reconcile a red PR (3 rounds, verifier, adjudicator, then `verify-failed`)

## Steps and model profiles
- src/controller/step.ts:108-111 — `StepSpec.model` / `StepSpec.effort` override the role profile when set
- src/controller/step.ts:229-242 — `loadRole`: model and effort from `harness/agent-profiles.json`, else the agent frontmatter
- src/controller/step.ts:343-358 — `runStep` passes `--model` and `--effort` from the override or the role
- harness/agent-profiles.json:20-25 — `sdd-implementer`: `claude-opus-4-8`, effort `xhigh`
- harness/agent-profiles.json:1-62 — all ten profiles; `sdd-test-author` and `sdd-checker` run `claude-sonnet-5` at `high`
- harness/agents/sdd-implementer.md:4-5 — implementer frontmatter model and effort (must equal the profile)
- src/__tests__/agent-profiles.test.ts:23-47 — pins 10 keys, profile equals frontmatter lines 4-5, byte-for-byte re-serialise
- src/watch/ledger.ts:53-84 — `loadAgentProfiles`: the watch view shows declared profiles
- scripts/stub-claude.mjs — the `claude` stub the step tests swap in through `CONTROLLER_CLAUDE_BIN`

## Gate B and sensitive paths
- src/controller/phases/gates.ts:216-266 — `gateB`: the gate-b wait with the veto list in `proposals`
- src/controller/phases/gates.ts:286-318 — `buildVetoList`: class (a) from `harness gate class-a`, then tags (b)/(c)
- src/controller/phases/gates.ts:344-351 — `ClassAItem` kind `sensitive-path` or `keyword`
- src/tools/harness.ts:1162-1220 — `gateClassA`: tasks.md plus the agent-rules sensitive list into `computeClassA`, read-only
- src/core/veto-rules.ts:65-101 — `computeClassA`: one `sensitive-path` item per task whose declared files match; no list gives no path item
- src/core/gate-rules.ts:105-108 — `parseSensitivePaths`
- src/core/gate-rules.ts:154-160 — `isSensitivePath`: `dir/` by prefix, else equality
- src/core/gate-rules.ts:343-349 — the Check's risk score: no list means every path sensitive; a touched sensitive path is a reason
- src/core/__tests__/veto-rules.test.ts — class (a) tests
- src/controller/phases/__tests__/gates.test.ts — gate B tests

## Briefs
- src/tools/brief-templates.ts:681-705 — `renderCiFix`: the CI-fix implementer brief (`ci`, `reconcile`)
- src/tools/brief-templates.ts:707-750 — `renderFix`: task, gate, repair fix briefs
- src/tools/brief-templates.ts:783-806 — `renderVerifierE2e`: the end-to-end verifier brief
- src/tools/brief-templates.ts:808-825 — `renderVerifierCi`: the CI verify brief
- src/tools/__tests__/harness.test.ts — brief template tests

## Deferrals
- src/types.ts:310 — `DeferralOwner` is `matthew` or `harness`
- src/core/deferral-storage.ts:229-232 — `DeferralStorage.create` signature (owner is a field of the record)
- src/core/__tests__/deferral-storage.test.ts — storage tests

## Ledger and run record
- src/controller/ledger.ts:53-73 — `RunLedger`: row writers (spawn rows carry `model`, `note`, `prMerged`)
- src/controller/ledger.ts:168-173 — `prMerged` and `note` writers
- src/controller/state.ts:97-126 — `RunRecord.prReads`, `PrCiState`, `PrRead`

## Run page PR panel (dashboard)
- src/dashboard/shell/types.ts:161-172 — server `ControllerPrRead`, a hand copy of `PrRead`
- src/dashboard/shell/types.ts:188 — `ControllerRun.prReads`
- src/dashboard_frontend/src/modules/shell/types.ts:184-195 — frontend `ControllerPrRead`, a hand copy
- src/dashboard_frontend/src/modules/shell/RunPage.tsx:188 — the PR panel renders when the run has reads
- src/dashboard_frontend/src/modules/shell/RunPage.tsx:345-394 — `PrPanel`: one row per read (CI chip, mergeable, verdict, reasons)

## Tests next to the touched modules
- src/controller/__tests__/merge.test.ts:1-693
- src/controller/__tests__/runs.test.ts:1-721
- src/controller/phases/__tests__/implementation.test.ts:1-626
