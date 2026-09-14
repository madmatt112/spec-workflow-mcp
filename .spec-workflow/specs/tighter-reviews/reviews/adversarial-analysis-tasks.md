# Adversarial review — `tasks.md`

Verified against `tasks.md`, `requirements.md`, `design.md` (no `steering/*.md` present — empty dir confirmed), and direct inspection of `src/dashboard/multi-server.ts`. Findings are grounded in concrete file/line references, not stylistic objection.

---

## 1. Atomicity and task sizing

### Task 3 is structurally three tasks

`src/core/typecheck.ts` is asked to land **in one diff**:

- spawn contract (`execFile` + 30 s timeout + SIGTERM→2 s→SIGKILL + 16 MB maxBuffer + env scrubbing)
- two-pass parser (Pass 1 with multi-line continuation; Pass 2 abs-path filter on remainder)
- chunked async realpath normalization (100/chunk, per-path ENOENT, case-fold matrix)
- denylist filtering of three output arrays + `suppressedDenylistedFiles` count
- six failure-mode mappings (timeout / output-overflow / no-parseable-output × 2 / tsc-not-found / wrapper-config / project-references / no-tsconfig — eight reason codes, six failure paths)
- 100-diagnostic cap, in-scope-first ordering
- first-run cache-dir creation
- coverage-array dedupe-by-normalized-form preserving first-seen original

The acceptance test list names ~12 distinct scenarios. By line count the implementation is ~400–600 LOC plus equivalent test code, plus fixture stdout files for the multi-line continuation case and a pnpm symlink fixture project. **No single-sitting reviewer can validate the parser regex correctness, the realpath chunking semantics, the failure-mode taxonomy, AND the 100-cap ordering policy without losing the thread.** Sensible split:

- **3a** — spawn contract + failure-mode mapping + cache-dir + tsconfig gate (returns parse-stage stub).
- **3b** — two-pass parser with multi-line continuation (consumes Pass 1 output of stub; tests the parser in isolation against fixture stdout).
- **3c** — async realpath normalization + denylist filtering + 100-cap + in-scope tagging.

Each is reviewable in one sitting. The current Task 3 is not.

### Task 4 hides four landings under one task line

Task 4 ships `validateAllFiles` (a 30-LOC helper with 7 boundary cases — itself a task), the `Promise.allSettled` shell with three `unwrap*` helpers, the data-shape extension (six new fields), the `loadSettings` / `isTypecheckEnabled` wiring, AND the integration test. The "all-three-utilities rejection" integration tests alone are three test cases that each require stubbing distinct surfaces. The seam where reviewer comprehension breaks is between `validateAllFiles` (a security-adjacent input filter) and the orchestration shell — these are independent concerns. Recommend a 4a/4b split with `validateAllFiles` landing first and the orchestration layered on top.

### Task 9 is fixture-mass churn at unsafe scale

Deleting 7 fixtures and shipping 15 (7 typecheck-axis re-pinned + 4 diff-axis + 4 cross-axis) plus a sentinel regression test plus drift-test guard updates plus the `diffState` parameter change is **15 hand-authored composite-prose fixtures** that the normalizer (`.trimEnd` + NFC + dash + quote + whitespace-collapse) must agree match `buildReviewMethodology(...)`. A reviewer asked to validate this PR is asked to read 15 ~30–80 line fixtures against R4 verbatim text by eye. The realistic failure mode: a fixture passes the drift test (substring contains R4 block) but contains an extra sentence introduced during composition — Direction B catches this only if the extra sentence is not itself a substring of any R4 block. **Soft fixture rot is a real risk.** Split: 9a (preamble + diff-axis fixtures + drift-count bump to 8); 9b (cross-axis fixtures + sentinel regression).

### Task 7 is correctly sized

Public-signature surface crossed (`partitionPaths` import added to `computeHygieneSignals`); independent test extension; cleanly reviewable in isolation. Argued either way the call holds — the alternative (folding into Task 1) would couple a leaf utility's PR to its consumer's PR.

---

## 2. Track ordering and dependency edges

### Task 4 → Task 8 interim shape is under-specified

Task 4's prompt says "diff slot is wired but inert until Track B" and that interim returns "the empty-diff state." Task 8's prompt says "Replace the inert diff slot from Task 4 with `computeTaskDiff`." But **Task 4 must populate `data.diff = ""` and the four other diff fields** (`diffStats: undefined`, `skippedPaths: []`, `diffTruncated: false`, no `diffRejection`) — between Track A merge and Track B merge, the API surface advertises diff fields that are always empty, **and the methodology emits R4.2a (diff-empty fallback) for every prepare call.** Task 5 is deliberately Track-A-only on methodology (no diff directives), so the methodology and the data shape are inconsistent during the interim: data carries diff slots, methodology does not mention them. Reviewer-visible bug surface: an LLM that reads `data.diff === ""` may invent a directive. Task 4's tests need to pin "interim emits no diff directive even though the data field is present" — this is not in Task 4's or Task 5's test list.

### Task 2 → Task 4 / Task 10 coupling

`loadSettings` is consumed by Task 4 (for `isTypecheckEnabled`) and by Task 10 (for `resolveRunnerModel`). Task 2's `loadSettings` returns `AdversarialSettings` typed as `{ /* as before */ }` (design.md:184) — **the design doc literally elides the type**. Task 2's prompt does not specify whether `cli`/`cliArgs` are surfaced on the return type. Task 10's RunnerOptions construction requires `settings.cli` and `settings.cliArgs` (visible at multi-server.ts:785–790, 953–957). If Task 2 ships a type that omits these, Task 10 must reach for `(settings as any).cli` or extend Task 2's type retroactively — silent coupling. **Type contract for `AdversarialSettings` should be pinned in Task 2's prompt or Task 10 will discover the gap during implementation.**

### Track-A-blocked-beyond-a-week escape hatch is wired into nothing

Requirements §"Track sequencing" line 19: "Track-A blocked beyond a week: Track B may re-pin the composite directly, skipping the interim Track-A-only pin — call this out in the PR description." Task 9 is currently written assuming "delete the 7 Track-A interim fixtures and the marker." If Track A never lands, Task 9's "delete the marker" sub-step is a no-op (no marker exists), but the sentinel regression still ships and passes vacuously. More important: Task 5 (interim drift test with `EXPECTED_R4_BLOCK_COUNT = 5`) cannot be skipped if Task 9 is to skip it — there's no "if Track A merged, do X; else do Y" branching in the tasks doc. **The escape hatch in requirements is not represented in the task graph.**

### Path-drift sweep

The path note at the top of tasks.md catches `multi-server.ts` → `src/dashboard/multi-server.ts`. Other drifts I confirmed:

- Design.md:5 says "settings reads in `src/multi-server.ts`" — confirmed wrong; corrected only in the tasks-doc preamble.
- Design.md:39 references runner classes at `src/dashboard/adversarial-runner.ts:63` and `src/dashboard/task-review-runner.ts:58` — paths plausible but line numbers unverified by tasks doc.
- Design.md:45 references "lines 780–791 (adversarial initial), 948–959 (adversarial retry), 1730–1742 (task-review initial), 1774–1786 (task-review retry)" — I confirmed these are roughly correct (adversarial init at 776–791, adversarial retry at 944–959, task-review pair at 1729–1749 / 1775–1793). **But see §6 below — these line numbers describe four separate route handlers, not four callsites in one function. The "closure capture" claim breaks against this structure.**

---

## 3. Mapping between tasks and requirements / design

### R3.12 partial coverage

Task 2's prompt and `_Requirements:` cite R3.12. The prompt body says: *"`isTypecheckEnabled`: false only when `features.typecheck === false`; non-boolean values warn-once and default to true (R3.12)."*

R3.12 in requirements.md (lines 138–142) actually requires:

- `features` is a top-level object; unknown keys silently ignored (forward-compat)
- `features === null` treated as absent
- `features` present but **not an object** → ignored with warn-once
- `features.typecheck === ""` (empty string) → ignored as absent
- `features.typecheck` non-boolean → treated as absent + warn-once naming the user-supplied value

Task 2 picks up only the last bullet. **The other four cases are unspecified in Task 2 and unscheduled in any later task.** R3.12 is partially implemented as written.

### R2.14 asymmetrically pinned

Task 6's prompt names "GIT_OPTIONAL_LOCKS=0 env propagation assertion." Task 3 cites R2.14 in `_Requirements:` and prose ("env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }") but **the test list in Task 3 does not include an env-propagation assertion** for typecheck the way Task 6 includes one for git. The implementer who follows the test enumeration literally will leave R2.14's env propagation untested. Add the assertion explicitly.

### NFR Security has no end-to-end test

Task 1 unit-tests `partitionPaths` with mixed-separator inputs and case-folding rules at the module boundary. **No task pins, end-to-end through `handlePrepare`, that a `.ENV` file (uppercase, secret-bearing) in `allFiles` ends up in `data.skippedPaths` and not in `data.diff` and not in `hygieneSignals`.** The denylist's correctness at the leaf and the consumers' correct invocation of it are independent — three places consume `partitionPaths` (Task 6 diff, Task 3 typecheck output, Task 7 hygiene), and each is unit-tested in isolation. A regression where one consumer reverts to a raw `files` reference is invisible to existing tests. Add an integration test in Task 4 or Task 8.

### Error Scenarios §7 (concurrent prepare) has no task

Design.md §7 says "Concurrent prepare against same project — documented unsupported; corrupts buildinfo." No task documents this for end users. It belongs in Task 11's README section or somewhere; absent, the failure is silent.

### R4.8 — existing item-9 hygiene wording protection is missing

R4.8 stipulates the item-9 hygiene directive's existing position is preserved. Tasks 5 and 9 cite R4.8. Neither pins a regression test that the **byte-identical** existing item-9 fixture from `fast-reviews` (referenced as `src/tools/__tests__/review-task.test.ts:100`) is unchanged after the new directives are added. The composite-pin tests at the new fixture set assert the full output composition; they do not assert the legacy fast-reviews fixture is unmodified. If `buildReviewMethodology` is refactored to thread the new state arguments through and the item-9 prose is incidentally re-emitted with whitespace drift, the legacy pin from fast-reviews catches it — **only if** that legacy test still runs and was not silently subsumed. Task 5 should include "legacy item-9 hygiene fixture passes byte-identically" as an explicit success criterion.

### R3.11 same-PR constraint is structurally unenforceable as tasks-doc is written

R3.11 line 137: "These doc updates land in the same PR as R3's code changes." The tasks doc imposes per-task PR-and-review process ("Mark task N [-]... request a dashboard task review; only after review passes mark [x]") on each of Tasks 10 and 11 separately. **Two PRs by construction.** Task 11's prompt acknowledges the constraint ("docs land in the SAME PR as Track C code") but the surrounding task structure contradicts it. Either Task 10 and Task 11 must be merged into one task, or the tasks doc must explicitly say "Tasks 10 and 11 land in one PR" and unify the review checkpoints.

---

## 4. Completion criteria and testability

### Wall-clock thresholds drift between NFR and task-prompt

- NFR Performance line 250: "Settings read: < 5 ms per call (small file, mtime+size-cached). One settings read per runner construction."
- NFR notes design.md line 439: "warm-cache reads < 1 ms; cold first-call 5–15 ms typical."
- Task 2 success: "cold-cache call < 15 ms typical."

The implementer cannot reconcile a 5 ms NFR with a 15 ms task success criterion without picking one — and "typical" is not a percentile. CI runners vary 3–10× from developer laptops; "< 15 ms typical" is unmeasurable as a CI gate. **Either drop the timing assertion or specify (a) cold vs warm, (b) percentile (p50? p99?), (c) hardware class (CI vs local), (d) measurement instrument (`performance.now()` average over N runs vs single shot).** Same applies to NFR Performance "diff utility under 200 ms / 50 files" and "typecheck under 5 s incremental" — none of these are wired into Task 6 or Task 3 as success criteria, so they're orphan NFRs.

### `EXPECTED_R4_BLOCK_COUNT = 5` at Task 5 will fail the drift test against requirements.md

This is the clearest cross-track ordering hazard in the doc.

R4 prose in requirements.md **already contains all 8 directive blocks** (R4.1, R4.2a, R4.2b, R4.4, R4.5, R4.6a, R4.6b, R4.7). Task 5's drift test extracts blocks from `requirements.md` and asserts the count equals `EXPECTED_R4_BLOCK_COUNT`. Task 5 sets that to 5. **The test will throw: extractor returns 8, constant is 5.** R4.10 line 226 explicitly says "Test fails if extractor returns ≠ 8."

Three repair paths, all unprincipled:

1. Change the extractor at Track A to filter by directive ID (R4.4–R4.7 only). Then the constant is doing nothing the ID filter doesn't already do — guard collapses.
2. Set the constant to 8 from Task 5 and accept that Direction A (each R4.x block must appear in at least one fixture) will fail for R4.1, R4.2a, R4.2b at the Track-A interim — i.e. Track A's drift test cannot pass.
3. Strip R4.1, R4.2a, R4.2b from `requirements.md` at Track A and add them back at Track B. This violates "R4 prose is authoritative" — you'd be mutating the authority to make the test pass.

**The interim drift test as specified is unimplementable.** Either the constant guard idea is the wrong shape for staged rollout, or Track A's interim cannot run the two-way drift test at all (only the substring direction A → fixtures, with the count check deferred to Track B). The tasks doc has not faced this. Recommend: drop `EXPECTED_R4_BLOCK_COUNT` for the Track-A interim entirely; rely on Direction A only at the interim; introduce the count guard in Task 9 with the value 8 from the start.

### Task 8 "diff-empty and diff-rejection tests pass distinctly"

The criterion's observable is `data.diffRejection` — present iff utility-throw, absent iff benign empty. The success line should say so: "diff-empty asserts `data.diff === '' && data.diffRejection === undefined`; diff-rejection asserts `data.diff === '' && data.diffRejection.message` is set." As written, an implementer can pass two assertions on the same data shape and call it "distinct."

### Task 11 manual E2E "edit settings between initial and retry"

The retry handler at `src/dashboard/multi-server.ts:879` is a separate Fastify POST route from the initial-review handler at line ~733. **A "retry" is triggered by a separate user action** (clicking the retry button), which fires a separate HTTP request, which enters a fresh closure scope. There is no in-process state spanning the two requests today. The manual-E2E checklist asks the human reviewer to "confirm retry uses initial's model" — but the architecture as it stands re-reads settings on every retry. To make the checklist pass, Task 10 needs to persist per-jobId options (e.g. in the approval annotation, or in a per-jobId map on the runner). **The dashboard surface for "trigger retry while preserving original options" does not exist.** Task 11 cannot run the E2E it advertises until Task 10 designs that persistence — and Task 10's prompt does not.

### Task 10 "call count is 2, not 4"

`resolveRunnerModel` is an exported function. To `vi.spyOn` it, the test must `import * as settings from 'src/core/adversarial-settings'` and spy on the namespace member, OR `vi.mock` the module with a partial mock that wraps the original. Either works in vitest, but **the test infrastructure required (replacing the import shape in `multi-server.ts` to call through the namespace, or maintaining the mock factory) is non-trivial and not mentioned in Task 10**. If the implementer leaves `multi-server.ts` with a direct named import, `vi.spyOn` cannot intercept the call — the spy would observe zero invocations. This silently passes ("call count = 0 ≤ 2") unless the assertion is `equal(2)` rather than `lessThanOrEqual(2)`.

---

## 5. Out-of-scope drift / scope creep

### `validateAllFiles` is not in any requirement

Task 4 introduces `validateAllFiles` with NUL-byte filter, non-string drop, realpath-symlink-outside detection, and ENOENT tolerance. **Search of requirements.md for "validateAllFiles": zero hits.** Search of design.md: present in §`validateAllFiles`, lines 218–254. Justified at the design level by NFR Reliability ("utility never throws") and Error Scenarios §14, but the requirements gate did not see this work. It is real and necessary work — but its absence from R-level requirements means a future change to `allFiles` semantics may not realize this contract exists.

### `hygieneRejection` and `diffRejection` are design-level only

Search requirements.md for "hygieneRejection" / "diffRejection": zero hits. Both fields are in design.md and tasks.md. They are reviewer-visible additions to `data` shape that R1/R2 do not enumerate. NFR Reliability's "utility never throws" justifies a degraded shape, but the **specific shape** (`{ message: string }` field on `data`) is design-level invention. If a hypothetical schema-strict consumer exists, they have no requirements-level commitment to these fields. This is acceptable but should be promoted: add a sentence to R1/R2 saying "rejection is surfaced in `data.<utility>Rejection.message`."

### Task 11's "shipped example `adversarial-settings.json`" does not exist

`Glob "**/adversarial-settings*.json"` against the repo returns **zero matches** (only `.md` references in `docs/CONFIGURATION.md`, `docs/INTERFACES.md`). Task 11 says "ensure shipped example settings carry the comment header" — there is nothing to add the header to. The implementer either (a) creates a new `examples/adversarial-settings.json` (silent new artifact, no requirement asks for it), or (b) does nothing and marks the task complete (the "ensure" is vacuous). Decide one or the other in Task 11's prompt.

### `<projectPath>/.spec-workflow/.cache/` is a new on-disk artifact

Task 3 creates `.spec-workflow/.cache/tsc.tsbuildinfo` on first run. **No task adds it to `.gitignore`.** No task documents the directory's lifetime, max size, cleanup, or that it is created by spec-workflow-mcp. Users running on a fresh checkout will see an unexplained directory appear. Add to Task 3 or Task 11: "Append `.spec-workflow/.cache/` to `.gitignore` if not already present; document the cache in README."

---

## 6. Risk-laden technical assumptions

### **Task 10's "closure-shared by initial-and-retry callsites" is structurally impossible against the actual code**

I read `src/dashboard/multi-server.ts:760–990`. Confirmed structure:

- Adversarial **initial** at `POST /api/projects/:projectId/approvals/:id/review` handler body, lines ~733–842. Reads settings at 776–791. Calls `this.adversarialRunner.run(...)` at 794.
- Adversarial **retry** at a **separate route**: `POST /api/projects/:projectId/approvals/:id/adversarial-retry` handler body, lines 879–~990. Reads settings independently at 944–959. Calls `this.adversarialRunner.run(...)` at 962.
- Same pattern for task-review at the 1729 / 1775 callsites.

These are **four different route handlers in four different `this.app.post(...)` registrations**. There is no shared closure scope. The retry is triggered by a user action (HTTP request) that occurs after the initial run has completed; the initial handler's closure has long since GC'd. **Task 10's "captured in closures shared by initial-and-retry callsites" cannot be implemented as described.** To honor R3.9 ("retry uses the same model as the original attempt"), the implementer must either:

- **Persist `RunnerOptions` per-jobId** in a service-level map (`Map<jobId, RunnerOptions>`) so the retry route looks up the original options. This is real new architecture, not "wiring."
- **Stash the resolved model in the approval annotation** (the retry handler already reads `approval.annotations` at line 896). This is a schema change to annotations.

Either path is bigger than Task 10 advertises ("wiring-only"). **The "call count of `resolveRunnerModel` = 2 per review" assertion is also impossible without this refactor** — currently each handler calls settings-read independently; without per-jobId persistence, the retry handler must call `resolveRunnerModel` again, and the count becomes 4. Task 10 needs to be elevated to a design task and the persistence mechanism chosen before implementation.

### Task 2's "byte-for-byte contract" warning format

Search of consumers: nothing parses the `[spec-workflow] adversarial-settings.json: ...` warning programmatically (no tests, no scripts, no log scrapers in the repo). "Byte-for-byte" pins it for human-readability stability — defensible — but pinning to that strictness without a downstream contract turns every editor-introduced punctuation drift into a CI break. Soften to "format matches the regex `^\[spec-workflow\] adversarial-settings\.json: .* \(path: .+\); falling back to defaults\..*$`" — preserves human meaning, doesn't break on a comma.

### Task 3's "tsc never imported as a library" + self-host

`package.json:109` confirms `"typescript": "^5.7.2"` is a devDependency of `spec-workflow-mcp`. Self-host works: the repo's own typecheck under `runProjectTypecheck` resolves `<projectPath>/node_modules/.bin/tsc` against the repo root and finds it. **The hidden risk is for consumers**: if `spec-workflow-mcp` is installed into a project that has no `typescript` dependency, `runProjectTypecheck` correctly returns `'tsc-not-found'`. Fine. But **fixture-project test setups** for Task 3's vitest suite need their own `node_modules/.bin/tsc` — and pnpm's symlink-resolution test fixture needs an actual pnpm install. This is non-trivial fixture infrastructure that Task 3's "leverage" line (`node:child_process, node:fs/promises, node:path`) does not call out. Add to Task 3: "Fixture projects under `src/core/__tests__/fixtures/` require committed `node_modules/.bin/tsc` shims or mocked `execFile`."

### Task 6's `-M` flag with restrictive pathspec

Task 6 prose says "-M flag enabled even though pathspec defeats some rename detection (the directive tells the reviewer not to trust diff for renames)." Verified R4.1 (requirements.md:150) does include "Do NOT rely on the diff to surface renames — explicit pathspec defeats git's rename detection." So the directive is honest. **`-M` provides value** specifically when both old and new paths happen to be in pathspec (rename within the in-scope file set) — in that case `-M` correctly produces a single rename hunk instead of a delete+add pair. Cost is negligible. Defensible; keep.

### Task 5's `__fixtures__` directory creation

Confirmed `src/tools/__tests__/__fixtures__/` does not exist (`Glob` returned no results). Task 5 says "this is the first `__fixtures__` dir." Verified vitest config does not exclude `__fixtures__/`-prefixed directories from test discovery — but `.txt` files are not collected by vitest by default, so no glob hazard. **Risk:** if `tsconfig.json` includes `src/**/*` and a fixture file is unintentionally `.ts`, it gets typechecked. Task 5's fixtures are `.txt`, so safe. Note in Task 5: "fixtures are `.txt` only; no `.ts` fixtures in this directory."

---

## 7. Process and review-loop hygiene

### Task 9's single-PR review is too dense

15 hand-authored prose fixtures + drift-test guard bump + sentinel regression + `diffState` parameter wire-through is **one dashboard task review** asking the reviewer to validate 15 pieces of normalized prose against R4 verbatim by eye. The drift test catches structural mismatches but not "fixture composes R4 blocks in the wrong order" or "fixture has correct content but wrong contextual prose between directives." Recommend the 9a/9b split from §1.

### Chicken-and-egg risk on Task 10

Task 10 changes how `AdversarialRunner` and `TaskReviewRunner` are constructed. The dashboard task-review process uses these same runners. **Reviewing Task 10's PR on the dashboard runs the modified runner code.** If Task 10 ships a bug that breaks runner construction, the very review that would catch it cannot run. Surface in Task 10's prompt: "First-merge of this task should be reviewed via local `npm test` AND smoke-tested locally before requesting a dashboard review" — or accept that this task is the natural exception to the dashboard-review-gates-everything rule.

---

## Closing deliverables

### Top 5 risks/gaps (ranked)

1. **Task 10 "closure capture" is structurally impossible** against `src/dashboard/multi-server.ts`'s actual route-handler layout. The four callsites are in four separate Fastify route bodies, not one function. Implementing R3.9 (retry uses initial's model) requires per-jobId state persistence that Task 10 does not design. **Task 11's manual E2E for retry-uses-initial-model also cannot run** until this is solved. Failure scenario: implementer writes the obvious code (re-call `resolveRunnerModel` in retry handler), call-count assertion fails, retry uses *current* settings file contents, R3.9 silently violated.
2. **Task 5's `EXPECTED_R4_BLOCK_COUNT = 5` will throw against `requirements.md`** — R4 prose at the time Task 5 lands already contains 8 directive blocks. The drift test at Track A interim is unimplementable as written. Failure scenario: Task 5's CI fails on the first run; implementer makes the test "pass" by stripping R4.1/R4.2a/R4.2b from requirements.md, violating the authority direction.
3. **Task 3 is three tasks** masquerading as one. ~600 LOC + ~600 LOC of test + multiple fixture projects + 8-reason failure taxonomy + multi-line parser correctness. Failure scenario: PR sits in review for a week, reviewer signs off on parser regex without truly validating the realpath chunking semantics, a regression in coverage-array dedupe-by-normalized-form ships unnoticed.
4. **R3.12 is partially implemented.** Task 2 covers the non-boolean `features.typecheck` case but skips four other `features` block edge cases (null, non-object, empty-string typecheck, malformed-warn semantics on the block itself). Failure scenario: a user writes `"features": null` thinking it disables features; the code crashes accessing `features.typecheck` on null.
5. **Task 11's "shipped example settings"** references a file the repo does not have. Failure scenario: the implementer either silently creates a new `examples/adversarial-settings.json` (out-of-scope artifact creation) or marks the task done without action (vacuous E2E claim).

### Top 3 conclusions to challenge

1. **"Task 3 is one task."** It bundles four orthogonal concerns (process orchestration, parsing, normalization, output filtering) and an 8-reason failure taxonomy. The acceptance test list names ~12 scenarios. This is not one sitting; this is one milestone broken into one task line because the file boundary suggests one PR. The file boundary is the wrong cohesion signal — the cognitive boundary is concern.
2. **"`EXPECTED_R4_BLOCK_COUNT = 5` is a clean Track-A interim guard."** It cannot be — the extractor reads the canonical R4 prose, which already contains 8 blocks. The constant guard idea is wrong-shaped for a staged rollout where the requirements doc does not change phase-by-phase. The guard belongs only in Task 9 with value 8; Task 5 should rely on Direction A substring presence only.
3. **"Track C is wiring-only, since Task 2 ships the helpers."** Task 10's actual blocker is not helper wiring — it is choosing a persistence mechanism for per-review `RunnerOptions` so retry can reference the same options as initial across two HTTP requests. That is design work, not wiring. The tasks doc has elided it because design.md asserted closure capture as a structural guarantee without ever opening the route-handler file.

### What's missing

- **A design decision in Task 10 for how per-review `RunnerOptions` persist across the initial-review and retry HTTP requests.** Options: (a) `Map<jobId, RunnerOptions>` on the runner singleton; (b) serialize into the approval annotation. Pick one before implementation.
- **A revised drift-test plan for the Track-A interim** that does not require `EXPECTED_R4_BLOCK_COUNT` to lie about the canonical R4 contents.
- **R3.12 sub-rules** (null, non-object, empty-string, malformed-warn) wired into Task 2's scope or split into a Task 2b.
- **Task 4 / Task 5 alignment** on the interim shape: the data carries diff slots from Task 4 forward, but Task 5's methodology emits no diff directive — pin "interim does not emit diff directive even though diff slots are present" as a Task 4 or Task 5 test.
- **Quantitative thresholds** on Task 2's "< 15 ms typical," NFR's "< 5 ms warm," "< 200 ms diff," "< 5 s incremental typecheck." Specify percentile, hardware, instrument, sample count — or drop the assertions and rely on functional correctness.
- **An end-to-end secret-leak test** in Task 4 or Task 8 covering `.ENV` (uppercase) input → absent from `data.diff` AND absent from `hygieneSignals` AND present in `data.skippedPaths`. Unit-testing `partitionPaths` is necessary but not sufficient.
- **A `.gitignore` update** for `.spec-workflow/.cache/` in Task 3 or Task 11.
- **A regression-test commitment** in Task 5 that the legacy `fast-reviews` item-9 hygiene fixture passes byte-identically.
- **An R3.11-to-task structural fix**: either merge Task 10 and Task 11 into one task (one PR), or explicitly note that they ship together and only one combined dashboard review runs.
- **An env-propagation assertion** in Task 3's test list for `FORCE_COLOR=0` / `NO_COLOR=1`, symmetric with Task 6's `GIT_OPTIONAL_LOCKS=0`.
- **A concrete `AdversarialSettings` type in Task 2** so Task 10's options-construction does not silently widen it.
