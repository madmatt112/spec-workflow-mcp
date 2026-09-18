# Adversarial Analysis — worktree-review-signals/tasks (v1), Round 1

Attack surface: **atomicity, ordering, coverage**. Fresh lens: **the sub-agent that
receives only the task `_Prompt:`** — could an implementer complete each task without
silently depending on an artefact another task owns?

## Method — what I checked and how

- Read the target (`tasks.md`), `codebase-context.md`, `design.md` v3,
  `requirements.md` v3, decomposition entry 2, and `agent-rules.md`.
- Grounded every load-bearing citation in source, both ends of each range:
  `task-diff.ts` (37, 50-62, 149-193, 345-422), `typecheck.ts` (17-47, 124-238),
  `review-task.ts` (31-102, 300-346, 430-536, 661-838), `log-implementation.ts`
  (297-429), `root-selection.ts` (195-221), `multi-server.ts` (1417-1477),
  `task-review-runner.ts` (66-91, 147-285, 287-394), `adversarial-review.ts`
  (54-83, 140-184, 342-406), `registry-lock.ts` (1-60, 340-391), `project-registry.ts`
  (268-321), `git-utils.ts` (101-112), `path-utils.ts` (212-214), `types.ts` (285-296),
  and the e2e/test fixtures the prompts name.
- Verified every claimed count by grep: `computeTaskDiff(` = **23** (task 3),
  `methodology:` in the runner test = **19** (task 9), `status: 'unavailable'`
  literals repo-wide = the exact 8 typecheck sites + `unwrapTypecheck` + 2 test
  literals (task 4 — complete, no hidden site), `Other guidance in this review
  context` = only the constant (task 5). `.gitignore:150`, `CHANGELOG.md:8`,
  `package.json:72 ^0.8.0` confirmed.
- Coverage: all **11 design components** map to a task (1→C10, 2→C1, 3→C2, 4→C3,
  5→C5, 6→C7, 7→C6, 8→C4, 9→C8, 10→C9, 11→C11; 12 = e2e). Every `_Requirements:`
  id exists. Every acceptance criterion R1.1–R7.7 is referenced by a task except
  R5.5, which the Scope notes and requirements deliberately leave to the orchestrator.
- Re-probed the `## Probes` line task 3 relies on (see conclusions).

## Attacks pressed, and what they found

### 1. Task 1 — the `@toon-format/toon` 0.8.0 → 4.1.1 bump and universal `undefined`-strip
- Stress-test the claim that a four-major-version bump leaves "every existing suite
  green" with a file list of only `package.json`, `types.ts` and two test files.
- Challenge the safety of recursively deleting `undefined` keys inside
  `toMCPResponse`, which runs on **every** tool response via `index.ts:101`.
- **Held.** `toMCPResponse` has exactly one caller (`index.ts:101`); the toon library
  is imported in only `types.ts` (encode) and `spec-lint.e2e.test.ts` (decode). Unit
  tests assert on raw handler `ToolResponse`, never through `toMCPResponse`, so the
  strip's blast radius is the three encode/decode files task 1 already names plus
  task 12's e2e. Scope is adequate; not a finding.

### 2. Task 4 — the honest-typecheck `observed` field across every construction site
- Challenge that the enumerated sites (`:144,:151,:156,:159,:164,:199,:218,:221` +
  `unwrapTypecheck:96-101`) are complete, since making `observed` required breaks the
  build if any site is missed.
- **Held on completeness:** a repo-wide grep for `status: 'unavailable'` returns
  exactly those production sites plus the two test literals task 4 names
  (`review-gate.test.ts:74`, `review-task.test.ts:474`). No hidden site.
- **One imprecision (R1-1):** the prompt says "the timeout, output-overflow and
  no-parseable-output arms change only by observed," but the `timeout` variant of
  `TypecheckResult` (`typecheck.ts:43-47`) gains **no** `observed` field — its
  `observed` is synthesised in `handlePrepare` (task 8, design Data Models). MINOR.

### 3. Ordering — "tasks 1–5 independent, each leaving the tree green"; the `'HEAD'` bridge
- Attack whether task 3 requiring a third `computeTaskDiff` param and task 8 removing
  the `:473` bridge is a clean hand-off, and whether tasks 3/4/5 (all editing
  `review-task.ts` + `review-task.test.ts`) actually stay green independently.
- **Held.** `computeDiffMethodologyState` at `:37-44` and the `:481` call site
  (passing `noReviewableFiles` from `:457`) belong to task 5; task 8 re-uses, not
  re-writes, them — no double emitter. The `!ok` arm at `task-diff.ts:191-193`
  returning empty-without-rejection today confirms task 3's three failure tests
  (`:260-289`, `:291-342`) each assert `rejection` undefined and must flip. `runGit`'s
  options block `:52-56` is where the 10 s timeout lands. All consistent.
- **One gap in the narrative (R1-2):** the Dependency-order paragraph never states
  that task 8 (adds `executionContext` to the encoded response) and task 12 (decodes
  the full response) depend on task 1's encoder fix. Linear order 1→12 satisfies it,
  so no defect — but the edge is unstated. MINOR.

### 4. Fresh lens — can an implementer complete each task from the `_Prompt:` alone?
- Stress-test whether tasks 6/7/8/9, whose prompts open "Implement design Component N,"
  silently depend on `readHeadCommit`/`isAncestorOfHead` (task 3), `TaskStateStore`
  (task 2), `hasProjectPathOverride` (created in task 6), `PrepareData`/`ExecutionContext`
  (task 8) without naming the bridge.
- **Held.** Each prompt's "Implement design Component N" is a named bridge: design
  Components 1–9 spell out every cross-task signature and its owning component, and the
  task bodies name "the helper task 3 exports" / "the writer task 2 exports" explicitly.
  `specTasksPath` (`log-implementation.ts:341`) and `PathUtils.getSpecPath` (`:212-214`)
  both resolve to the spec **directory**, so `new TaskStateStore(...)` builds
  `<spec>/task-state.json` — the store constructor's contract holds on both writer paths.

### 5. Coverage against decomposition entry 2 (R5, R7, R8, R9) and Gate B/C
- Confirm the four carried requirements land: R5 diff base (tasks 3,7,8), R7 typecheck
  honesty (task 4), R8 attribution (tasks 2,6,8), R9 disclosure (tasks 8,9,10).
- **Held.** No new external dependency is introduced (task 1 is a version bump of an
  existing dep; tasks 2–3 use node built-ins) → no `[gate-b]`. No task exceeds the
  approved requirements: the universal `undefined`-strip is design D5's chosen
  mechanism for R6, not scope creep → no `[gate-c]`.

## Findings (round 1)

- **R1-1 — MINOR.** Task 4 `_Prompt:` "the timeout... arm[s] change only by observed"
  is inaccurate for the `timeout` arm, which gains no `observed` field; `tsc` would
  catch an implementer who added one. Cosmetic; design and the construction-site list
  already exclude `:194`.
- **R1-2 — MINOR.** The Dependency-order paragraph omits task 8/task 12's dependency on
  task 1's encoder change. Satisfied by the linear 1→12 order; worth a clause.
- **R1-3 — MINOR.** Task 3's failure-case range `:260-289 and :291-342` splits the
  non-repository test (`:284-293`) across the 289/291 boundary. The stated meaning
  (three cases asserting `rejection` undefined today) is correct.

## Top risks / gaps

1. None blocking. The single behavioural risk probed — a global `undefined`-strip on
   `toMCPResponse` — is contained to two library-consuming files and is design-approved.
2. R1-1's wording could nudge an implementer to add `observed` to the timeout result;
   the compiler rejects it, so the cost is one build cycle, not a wrong implementation.

## Top 3 conclusions to challenge

1. **"tasks 1–5 are independent leaf changes."** Reversal attempt failed: verified that
   task 5 owns `computeDiffMethodologyState`'s second parameter and the `:481` call, and
   task 3 owns the `computeTaskDiff` signature and the `:473` bridge — disjoint edits to
   `review-task.ts`, each leaving `tsc` and the named suites green. Conclusion stands.
2. **The probe "`git merge-base --is-ancestor` exits 0/1/128."** Re-probed the design's
   claim against git semantics: ancestor → 0, non-ancestor → 1, unknown sha → 128; both
   non-zero mean "not validated" (design D4). Matches. Conclusion stands.
3. **"the response literal stays identical on every arm" (task 7).** Verified the status
   route returns the same literal at `:1469-1473` and the same-status early return at
   `:1450-1456`; recording sits after the write/broadcast in try/catch and never touches
   the response. Conclusion stands.

## What's missing before acting

Nothing that blocks implementation. Optional polish: fold R1-1/R1-2/R1-3 into the next
lint pass. Note that the round's only checkpoint delta (task 1's parenthetical reword,
L-1) is clean — the `stripMethodology` deletion remains owned by task 12 (D3) and
`e2e/worktree-shared.spec.ts:81-100`/`:185` confirm the workaround it removes.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
