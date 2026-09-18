# Adversarial Analysis — worktree-review-signals/design (v1), Round 1

Attack surface: feasibility, consistency, edge cases. Fresh lens: wire contracts
across the producer→consumer boundary. First review — no prior rounds; all findings
are Novel.

## What I checked and how

- Read both ends of every cited range the lint pass changed (the whole `## Changes
  since` diff): `project-registry.ts:268-279`, `registry-lock.ts:7-11`/`:52-54`/`:350-391`,
  `review-task.ts:80-101`/`:55-74`/`:317-321`/`:771-781`/`:806-819`, `typecheck.ts:162-165`/
  `:409-423`, `gate-rules.ts:303-308`, `path-utils.ts:208-214`, `log-implementation.ts:341`,
  `adversarial-review.ts:157`/`:178`/`:342-351`/`:402-403`, `adversarial-runner.ts:49`,
  `git-utils.ts:101-112`, `task-diff.ts:37`/`:50-62`/`:149-248`/`:361`, `types.ts:288-296`,
  `project-manager.ts:14`, `e2e/worktree-shared.spec.ts:81-100`/`:118-175`. **Every cited
  path, range and identifier is accurate.** No misstated-artifact MUST_FIX.
- Re-probed both `## Probes` facts the drafter recorded (context file is unreviewed):
  - `git merge-base --is-ancestor HEAD~3 HEAD` → exit 0; reverse → exit 1; unknown/garbage
    sha → exit 128. **Confirms design line 64 and D4.**
  - `@toon-format/toon` 0.8.0 vs 4.1.1 round-trip: installed both, ran `decode(encode(x))`
    over the real 4,756-char methodology (empty-diff + tsc-not-found, built through
    `buildReviewMethodology`) inside a full prepare-shaped object. **0.8.0 throws
    `RangeError: Expected 0 inline array items, but got 1`; 4.1.1 round-trips; both encode
    `undefined` as `null`; both emit byte-identical text for a small nested object; neither
    declares `engines`; both are ESM.** All of Component 10's claims hold. (Design says the
    methodology is 4,783 chars, Requirement 6 said 3,702 — both input-dependent, neither wrong.)
- Traced each wire the fresh lens names — `task-state.json` (recordBase/recordAttribution
  producers, `handlePrepare.read` consumer), exported `ExecutionContext`, the `observed`
  per-`unavailable` table, and `diffStats → null` — reading both ends.

## Rulings requested by the prompt

- **R4 AC 5 / D11 (`feature-disabled` produces no degraded note): REFINEMENT (closed).**
  R4 AC 5's literal text lists "typecheck is `unavailable`" as note-worthy, and
  `feature-disabled` is an `unavailable` reason, so there is surface tension. But R4_6A
  (`review-task.ts:812-813`) already tells the reviewer to "proceed normally", the same
  requirement's D9 rules that a signal firing deterministically "carries no information",
  and R4 AC 6 forbids restating a directive. Suppressing a note for a deliberate project
  setting is the degradation-focused intent, not a scope change. Closed, no finding.
- **R1 AC 11 / D3 (`diffBase.commit` is the ref `HEAD`, not a resolved sha, for HEAD
  provenances): REFINEMENT (closed).** The Performance NFR grants exactly one new git
  spawn per prepare, spent on `isAncestorOfHead`. Resolving `HEAD` to a sha would need a
  second spawn. Naming the base as the ref `HEAD` still "names the commit"; the head-degraded
  `detail` still names the rejected sha (R1 AC 8). Consistent with the budget. Closed.

## Findings

### R1-1 — SHOULD_FIX — Novel — the prepare response still fails its own round-trip when the dashboard is not running

Component 10 / Requirement 6 AC 1 require `decode(toMCPResponse(response).text)` to be
deep-equal to the whole prepare response. The design's mechanism is: bump to 4.1.1 (fixes
the decode *throw*) plus one targeted `diffStats: diffResult.stats ?? null` so no
`undefined` survives. But `handlePrepare` also emits
`projectContext.dashboardUrl: context.dashboardUrl` (`review-task.ts:525`), and
`context.dashboardUrl` is **optional** (`types.ts:74 — "Optional for backwards
compatibility"`) and is left `undefined` whenever the MCP server starts without a dashboard
session (`server.ts:205` `let dashboardUrl … = undefined`, assigned at `:222`). I verified
mechanically under 4.1.1: a full response with `dashboardUrl: undefined` encodes that field
to `null`, so the decoded value is NOT deep-equal to the source (`src=undefined`,
`decoded=null`). This is exactly the direct-caller/no-dashboard path Requirement 6's user
story targets ("a structured assertion … does not get [the wrong thing] instead").

Compounding: the design's own round-trip test (Testing Strategy, `review-task.test.ts` bullet)
is specified "with a context carrying `dashboardUrl`", which hides the failure — the test
passes while a real no-dashboard response does not round-trip. The design invested a specific
`?? null` for `diffStats` for precisely this reason and missed the sibling field.

Fix: coalesce `projectContext.dashboardUrl` (and audit every optional response field), or
strip `undefined` at the `encode` boundary in `toMCPResponse` so the round-trip holds for any
context, not only one the test supplies. A per-field `?? null` list is fragile; a boundary
strip is the robust closure.

Mitigating note (why not MUST_FIX): the *primary* harm Requirement 6 names — a decode
`throw` — is genuinely fixed by 4.1.1. The residual is a single optional field's
`null`-vs-`undefined` fidelity gap. It is still a real gap: a stated `deep-equal` observable
is unmet on a reachable path and the test is constructed to pass anyway.

### R1-2 — MINOR — Novel — `PrepareData` names two types that do not exist

The exported `PrepareData` interface (design lines 95-102) types `taskContext: TaskContext`
and `implementationSummary: ImplementationSummary`. Neither `TaskContext` nor
`ImplementationSummary` is defined anywhere in `src/` (only `ResolvedFile`, at
`file-resolution.ts:111`, exists). Today both are inline object literals
(`review-task.ts:420-434`). D16's "field renamed on one side fails to compile" only works if
`data` is actually typed `PrepareData`, which requires these two types to exist. The
implementer must define them from the existing literals; the design should say so or inline
the shapes. Trivial, but the interface as written will not compile as-is.

## Wire contracts that are sound (checked, no finding)

- **`observed` made required on the `unavailable` arm.** All eight production construction
  sites (`typecheck.ts:144,151,156,159,164,199,218,221`), `unwrapTypecheck`
  (`review-task.ts:96-101`) and the probe site are enumerated. The only other
  `unavailable` literals are test fixtures at `review-task.test.ts:474` and
  `review-gate.test.ts:74`; both reach the code through `any`-typed overrides
  (`overrides.typecheck: (...args:any[])=>any`), so they will not break `tsc --noEmit`.
  No consumer of the old shape breaks.
- **`diffStats → null`.** `computeTaskDiff` returns `stats: undefined` only on the three
  `diff: ''` arms (`:172,:180,:192`) and a defined object on the success arm (`:240`), so the
  runner's `## Diff` branch (rendered only when `diff !== ''`) never dereferences a null
  `diffStats`. `NonNullable<TaskDiffResult['stats']> | null` types both producer and consumer.
- **`task-state.json` keys.** Base is written under `normalizeIdentityPath(project.workspacePath)`
  and read under `normalizeIdentityPath(workspacePath)`; attribution stores a raw path and
  normalizes on compare. Both ends realpath-normalize; the dashboard route, the runner and the
  direct path all resolve the same `getSpecPath(...)/task-state.json`.
- **`dependencies-unresolved` → `unavailable-other`.** `computeTypecheckMethodologyState`
  (`:55-74`) maps it unchanged; `renderTypecheckDirective` renders R4_6B without the reason;
  `gate-rules.ts:303-308` prints `input.typecheck.reason` unchanged; the new value flows to the
  reviewer via `executionContext.typecheck.observed`. R4_6B stays byte-pinned. Consistent.
- **`DiffMethodologyState` gains `no-files`.** The only `switch (state.kind)` on it is
  `renderDiffPreamble` (`:785`), which has no default and returns after the switch, so the new
  member cannot silently break compilation; the design adds the case. `computeDiffMethodologyState`
  gains a defaulted param — backward-compatible for its one production caller.
- **`!ok` diff arm now returns a rejection.** Existing `task-diff.test.ts` cases that asserted
  *no* rejection are flagged for re-assertion; the parity/single-checkout path (git succeeds) is
  untouched.
- **Decomposition scope.** `TaskStateStore`, typecheck honesty, the execution-context object and
  the moved R7-AC-6 byte-pin criterion all sit where entry 2 and its Boundary notes place them;
  locking touches only the new record (R3 AC 8), leaving the four shared-root files to spec 3.

## Top risks / gaps

1. **R1-1** — the round-trip observable is unmet on the no-dashboard path, and the test is
   rigged to pass. This is the one gap that will ship a false green.
2. `PrepareData` references undefined types (R1-2) — cosmetic but a compile blocker if copied verbatim.
3. No other. The artifact citations, both probes, and every fresh-lens wire agree.

## Top 3 conclusions to challenge

1. **"A prepare response decodes with the library that encoded it" (Component 10 Purpose).**
   Reverse to: "…decodes *when a dashboardUrl is present*." Bump + `diffStats ?? null` is
   necessary but not sufficient; close it at the encode boundary.
2. **"Required fields make an omission a compile error" (D16, Component 8).** True only once
   `TaskContext`/`ImplementationSummary` exist and `data` is actually annotated `PrepareData`;
   the interface as drafted does not compile.
3. Nothing else rises to reversal. D3, D4, D11 and the encoding choice survive re-probing.

## What's missing before acting

- Decide the round-trip closure (per-field coalesce vs strip-undefined-before-encode) and make
  the AC-4 test use a **real** response (no hard-coded dashboardUrl), so it can catch R1-1.
- Define `TaskContext` and `ImplementationSummary`, or inline their shapes in `PrepareData`.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```

`converged` requires SHOULD_FIX = 0; R1-1 keeps the loop alive.
