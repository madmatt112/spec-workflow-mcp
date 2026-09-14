# Adversarial Analysis — `tighter-reviews` tasks.md (round 2)

**Findings classification:** `{novel: 8, compounding: 5, recurring: 4}`

---

## 1. Track C — annotation persistence: structural and ordering breakage

### 1.1 [NOVEL — Critical] Task 20 has no `approval.annotations` surface to stamp into

Task 20's prompt: "Mirror task 19's adversarial wiring on the task-review handlers, swapping `'adversarial'` → `'taskReview'`." This is **structurally impossible** as written.

The task-review POST handlers (`src/dashboard/multi-server.ts:1723` and `:1761`) do NOT operate on an approval. They take `(projectId, specName, taskId)` from the route, query `taskReviewRunner.getJobsForProject(projectId)` for retry's failed-job lookup, then call `taskReviewRunner.run(...)`. There is **no `approval` object, no `approval.annotations` string, no approval-store touch anywhere in the task-review flow**. Task-review state lives only in the `taskReviewRunner` in-memory `Map<jobId, ...>` (mirroring `adversarial-runner.ts:45`'s `private jobs: Map<string, AdversarialJob>`).

`stampAnnotationRunnerOptions` from task 18 takes `(projectId, approvalId, opts)` and "reads the existing annotation, merges `runnerOptions: { model }`, writes back" through the approval store. There is no analogous store for task-review jobs. Task 20 cannot mirror task 19 without **also** introducing a task-review persistence layer (a new approval-shaped store, or a JSON sidecar file, or a runner-level annotation map) — which is design work absent from both the design doc and the tasks doc.

Concrete failure mode: implementer reads task 20, swaps `'adversarial'` → `'taskReview'`, then has nothing to call `stampAnnotationRunnerOptions(projectId, approvalId, ...)` against because there is no `approvalId` on the task-review route. They either invent an ad-hoc store inline (silently expanding scope) or skip the stamp (silently breaking R3.9 for task-review). Existing tests (none today on a task-review annotation surface that doesn't exist) won't catch the skip. Task 21's "Cover both adversarial and task-review paths" assumes the surface exists.

This is the same class of error round 1 caught for closure capture (structural impossibility), but recurring at the round-1 *fix* layer for the task-review side. Track C's annotation-persistence design was designed against the adversarial flow's approval-bound shape and silently extrapolated to task-review without verifying the substrate.

### 1.2 [NOVEL — Critical] The 409 concurrent-initial check has no queryable surface

Task 19: "concurrent-initial check at route entry returns 409 Conflict … if approval-state machine reports an in-flight job." Design §`src/dashboard/multi-server.ts` line 393 says "the check uses the existing approval-state lookup (no new state-tracking layer)."

There is no such surface. The actual queryable state is `adversarialRunner.getActiveJobsForProject(projectId)` (`src/dashboard/adversarial-runner.ts:57`), which filters by `projectId` not `approvalId`, and the existing in-runner duplicate guard at `adversarial-runner.ts:71` is keyed on `(specName, phase)` and **throws an Error** rather than returning a 409 — which the route handler currently catches and returns as `500` (`multi-server.ts:840`).

Three concrete consequences:
- **Wrong scope.** A second concurrent POST on a different approval against the same `(specName, phase)` collides under the existing check and produces "An adversarial review is already running for X/Y" — task 19 says the second POST against the *same approvalId* gets 409. Different keys, different scopes; task 19 silently overrides the existing semantics with no acknowledgment.
- **Wrong status code.** Existing path returns 500 with body `{ error: 'Maximum 2 concurrent…' }` or `{ error: 'An adversarial review is already running…' }`. Task 19 specifies 409 with body `{ error: 'in-flight-job', jobId }`. The handler must be re-architected to detect the existing-job condition *before* `runner.run` (otherwise `run` throws and returns 500), AND a new approvalId-keyed lookup must be added to the runner (or a wrapper layer in `multi-server.ts`).
- **Approval-keyed in-flight tracking does not exist anywhere.** The `AdversarialJob` interface (`adversarial-runner.ts:7-19`) carries `id, projectId, specName, phase, status, …` — no `approvalId`. Adding the field is a runner-level change that task 19 doesn't enumerate. Without it, `getActiveJobsForApproval(approvalId)` cannot be implemented.

Failure scenario the existing tests won't catch: a developer implements task 19, doesn't notice the runner has no approvalId, instead re-uses the `(specName, phase)` duplicate path and translates its throw to 409. The 409 contract is now subtly broken: two concurrent POSTs on *different* approvals targeting the same `(specName, phase)` get 409 (per the new code) but referencing the *other* approval's `jobId`. The integration test in task 21 only verifies "two concurrent POSTs against the *same* approvalId," so it passes. The cross-approval collision is undetected and confusing in production.

### 1.3 [NOVEL — High] `stampAnnotationRunnerOptions` is clobbered by the existing post-`runner.run` `updateApproval`

Look at the current initial flow in `multi-server.ts:766-836`. After `runner.run` resolves with a `jobId`, the handler constructs a fresh annotation **from scratch** at lines 819-829 (`{ decision, trigger, specName, phase, promptOutputPath, analysisOutputPath, analysisVersion, jobId, timestamp }` — no `runnerOptions` carried over) and then calls `updateApproval(id, 'needs-revision', response, annotations, comments)` which writes the annotation string verbatim into the approval store.

Task 18's `stampAnnotationRunnerOptions` runs BEFORE `runner.run` per task 19's "stamp BEFORE invoking runner.run." So the timeline is:

1. Stamp writes `{ runnerOptions: { model } }` into `approval.annotations`.
2. `runner.run(...)` resolves with `jobId`.
3. Handler builds new annotation **without `runnerOptions`** and calls `updateApproval(...)`, **overwriting** the stamp.
4. Retry handler reads the annotation — `runnerOptions` is gone.

The stamp succeeds but the post-run write erases it. R3.9's "structural guarantee" is violated by the existing code's annotation-construction pattern, which task 18 doesn't modify and task 19 doesn't acknowledge. The merge-not-mutate property of the stamp protects writes *into* the stamp from clobbering other fields, but does nothing about writes *out of* the stamp.

Fix space: either (a) the stamp must run AFTER `runner.run` and AFTER `updateApproval`, contradicting "stamp BEFORE invoking runner.run" (which exists to survive runner crashes), or (b) the post-run `updateApproval` must read-merge the existing annotation rather than constructing fresh. Tasks don't pin (b). The task 21 test "spy on `resolveRunnerModel` shows callCount === 1 for an initial+retry sequence on a fresh approval" would FAIL the way the test is structured (because the retry would land in the legacy-fallback branch and re-resolve), surfacing the bug — but the fix is non-trivial design work that tasks 18/19 don't enumerate.

### 1.4 [NOVEL — Medium] `JSON.stringify` re-serialization on stamp causes annotation churn

Task 18's stamp "reads the existing annotation, merges `runnerOptions: { model }` (does NOT mutate other fields), writes back. Idempotent."

The existing annotation is built at `multi-server.ts:819-829` with `JSON.stringify(obj, null, 2)` — pretty-printed with 2-space indent and a fixed key order from the object literal. The stamp's read-modify-write would produce `JSON.stringify` of `{ ...parsed, runnerOptions: {...} }` — the spread preserves the original key order (V8 insertion order) IF the implementation uses `{ ...existing, runnerOptions }`. If it uses `{ runnerOptions, ...existing }` (more common defensive pattern), `runnerOptions` lands at position 0 and **every other key shifts**. The annotation string changes byte-for-byte even when re-stamping the same model. "Idempotent" claim breaks at the I/O level.

Concrete consequence: the approval store (writeFileSync on a JSON file) writes on every stamp call, file-watch consumers see noise, and any audit trail or git-tracked annotation file has spurious diffs. The task 18 prompt says "re-stamping the same model is a no-op write" — this is true only if the merge implementation uses the spread-then-override form *and* the prior annotation already had `runnerOptions` at the end. Neither invariant is enforced.

### 1.5 [COMPOUNDING — Medium] Whitespace-only `model` and version-skewed model strings bypass the four-shape filter

Task 19 specifies `typeof === 'string' && !== ''`. This catches `null`, `undefined`, `""`, non-string. It does NOT catch:

- `"   "` (whitespace-only string) — a manual edit of `approval.annotations` setting `runnerOptions.model: "   "` flows through to `runner.run({ model: "   " })`. CLI behavior on whitespace-only `--model` is implementation-defined; in `claude` CLI, this typically becomes a literal arg `--model ` `   ` and either errors with a confusing "model not found" message or silently ignores the flag. Either way, the user sees an unexplained failure.
- A persisted model string that was valid at initial-time but rejected by the current CLI (model deprecated, CLI upgraded between initial and retry, model name renamed). The retry runs with a model the CLI rejects; the failure surfaces as a runner crash, not a degradation. No fallback to `resolveRunnerModel`.

Task 19's failure-handling philosophy ("legacy → re-resolve") doesn't apply here because the persisted value is *technically* string-and-nonempty. R3.9 says "retry intentionally uses the same model as the original attempt" — but the rationale (telemetry/billing consistency) doesn't survive the model-no-longer-exists case.

This compounds round 1's concern about retry-mismatch failure modes: round 1 worried about closure capture losing the model; round 2's fix introduces a new failure mode where the model is preserved too aggressively across CLI upgrades.

---

## 2. Drift extractor + name-set guard (task 17)

### 2.1 [COMPOUNDING — High] Numbered-list silent-loss claim has a non-firing failure path

R4.10 line 228 says the expected-name-set guard "closes the silent-loss path where a future R4.x written as a numbered list bypasses delimiters." Trace the actual logic:

The extractor finds blocks via `> ` block-quote and ` ``` ` fence delimiters AND keys them by the heading `#### R4.x — ...` immediately above the block. If a future spec author writes R4.9 *entirely* as a numbered list under a `#### R4.9 — Foo` heading with no `> ` content, the extractor sees the heading but finds no block content beneath it. Two implementations are possible:

- Implementation P1: extractor enumerates only `(heading, block)` pairs where a block was actually found — `extractedBlocks` doesn't get an `R4.9` key. Keyset assertion compares `['R4.1', ..., 'R4.7']` (extracted) vs. `['R4.1', ..., 'R4.7']` (constant) — **passes** if the spec author also forgot to add `R4.9` to `EXPECTED_R4_BLOCK_NAMES`. The "missing name" failure-message path R4.10 promises **does not fire**: the missing entry isn't in either set, so neither side knows it's missing.
- Implementation P2: extractor iterates headings and warns/keys empty blocks as `R4.9 → ""`. Keyset includes `R4.9`, fails because the constant doesn't. The author "fixes" by adding `R4.9` to the constant and either repeating the silent-loss (no fixture pinning the prose) or — under Direction A — fails with "R4.9 block must appear as substring in some fixture, but R4.9 block is empty string, vacuously matches every fixture." Direction A is structurally vacuous on empty blocks.

Either way: spec author writes new R4.x as numbered list AND forgets to update `EXPECTED_R4_BLOCK_NAMES` → the test passes vacuously. R4.10 v4's claim ("forces a deliberate decision") only fires if both updates land — which is the author's *intent*, not the test's enforcement. Task 17's prompt says "Drift test fails when an R4 directive is rewritten as a numbered list (sentinel for the silent-loss path)" — but rewriting `R4.1` (already in the constant) as a numbered list does fail the test (R4.1 is missing from extracted), while *adding* a new numbered-list R4.9 doesn't.

This compounds round 1's "expected-count guard would throw on count change" concern: round 2 swapped count for name-set, but the name-set is a constant that also needs lockstep updates. The round-1 failure mode (throw on count) was loud; the round-2 failure mode (name-set silently passes) is silent. Severity escalated.

### 2.2 [NOVEL — Medium] R4.x prose with internal paragraph breaks splits Direction A

Design §Testing line 512: "Boundary detection runs BEFORE whitespace-collapse: split on `\n\n` first to identify directive boundaries." Apply this to *both* sides — including the R4 source.

Look at R4.1 in `requirements.md:150`. Today it is one paragraph. R4.2a (line 156), R4.2b (line 159-160), R4.4 (line 166), R4.5 (line 172), R4.6a (line 180), R4.6b (line 184), R4.7 (line 188): all single-paragraph block-quotes today. So the test passes today.

Future-fragility: any maintenance of R4 that introduces a deliberate paragraph break inside a directive (e.g. splitting R4.4 into two paragraphs to call out the truncation rule separately) splits that directive into two extracted blocks under one heading. The keyset assertion: does the extractor de-dup by heading and yield one merged block, or yield two blocks with the same name? Task 17's prompt says "key blocks by R4.x name parsed from preceding heading" — suggesting one key per heading. So two blocks merge under one key, but how? Concatenated with `\n\n`? Last-write-wins? Unspecified.

If concatenated: the resulting "block" contains a `\n\n` interior, and the Direction A check ("each R4.x block must appear normalized as contiguous substring in at least one fixture") looks for the merged string in fixtures. Fixtures use `\n\n` between R4 blocks and items 1-8. So the merged R4.4 string contains a `\n\n` mid-block — fixtures would need to also have R4.4 split across two paragraphs. If fixtures are written single-paragraph (the natural composition), Direction A fails post-normalization. If fixtures are also split, `buildReviewMethodology` must emit the split — adding implementation complexity.

If last-write-wins: the second paragraph of R4.4 silently overwrites the first in the extracted block. Direction A passes against the second paragraph; the first is lost. Silent under-coverage of the directive's first paragraph by drift detection.

The boundary-before-whitespace ordering was introduced by round 1 to prevent paragraph-break loss in fixtures. It introduces a new constraint on R4 prose that isn't documented: **R4.x directives must not contain internal paragraph breaks**. No task pins this constraint.

### 2.3 [NOVEL — Medium] Heading-format brittleness in extractor

Task 17's prompt: "key blocks by R4.x name parsed from preceding `#### R4.x — ...` heading." This regex is brittle to plausible variations:

- `#### R4.1 — Diff-present directive` (em-dash, today's form) — works.
- `#### R4.1 - Diff-present directive` (ASCII hyphen — common from search-and-replace tools) — likely works depending on regex.
- `### R4.1 — ...` (three hashes — if the markdown nesting moves) — fails.
- `#### R4.1: Diff-present directive` (colon instead of em-dash) — likely fails.
- `**R4.1 — ...**` (bold instead of heading — used by some authors for sub-sub-headings) — fails.
- `#### R4.1 — Diff-present directive (renamed)` — extracts as `R4.1` correctly, but the fact that R4.1 was renamed silently isn't surfaced.

Compounding with 2.1: heading-format drift produces "no R4.1 block found" → keyset fails — which is loud and good. But heading-format drift that *still* parses to `R4.1` (e.g. the rename case) doesn't surface the rename. The drift-test catches structure but not semantic identity.

The extractor regex isn't specified — task 17's prompt says "parsed from the preceding `#### R4.x — ...` heading" without giving the regex. Implementation will be permissive or strict per implementer judgment, with no test pinning the brittleness boundary.

### 2.4 [RECURRING — Medium] 17 hand-authored fixtures still under-pinned for ordering and inter-block prose

Round 1 flagged 15 fixtures as cognitively heavy; round 2 went up to 17. Direction A catches "R4.x block missing from any fixture" but not:

- Fixtures composing R4 blocks in the **wrong order** (R4.4 before `**Read first:**`). Direction A passes (substrings present); item-9/item-10 ordering pin (task 11/17) catches some of this but only for the items it explicitly pins — if a future fixture authoring step re-orders R4.5 before R4.4 (legitimate iff `success-with-diagnostics-and-partial-coverage` fixture composes them in a different sequence), neither direction catches the inversion.
- **Extra non-R4 prose between blocks**: fixture has correct R4.x substrings, contiguous, in correct order, but with introduced filler prose between them ("(fixture-only narration)"). Direction B would catch this only if the filler is a *directive sentence* — Direction B says "every directive sentence in any fixture must appear normalized as substring of some R4.x block." Definition of "directive sentence" is unspecified. If the test implementation defines it as "any sentence in the directive blocks" then the filler is caught; if as "any sentence in the fixture" then the filler is caught only if the filler looks like a directive (uses `**bold**`, imperative voice, etc.).

The fixture mass + cognitive load make it likely that filler prose lands during composition, drifts under maintenance, and Direction B is too narrow to catch it. Task 17's prompt doesn't pin Direction B's "directive sentence" definition.

---

## 3. Cross-task ordering and seam hazards

### 3.1 [NOVEL — High] Track-A interim-state methodology directive contradicts data field present

Task 8 ships `data.diff = ""`, `data.skippedPaths = []`, `data.diffTruncated = false`, no `data.diffRejection`, no diff directive in methodology (R4.9: Track A emits no diff directive). The reviewer-facing handlePrepare response now contains a `data.diff` field that is empty + a methodology that says nothing about it.

The LLM consuming this response sees:
- `data.diff: ""` — a top-level field announcing emptiness.
- `methodology` — silent on the diff.

The natural LLM behavior: "the diff field is empty; let me read the full files since methodology doesn't tell me what to do" OR "the empty diff means no changes; let me skip the diff path." The methodology was supposed to disambiguate this in Track B (R4.2a — "either changes were committed, or the implementation log is out of sync, or this is not a git repository"). In Track A interim state, no such disambiguation exists. The LLM may invent guidance.

Task 11's tests check `methodology` matches the Track-A interim fixtures (no diff directive). They don't pin "data.diff is `""` AND methodology emits no R4.x referencing data.diff" as a *coherent reviewer-facing surface*. Specifically: nothing tests that the LLM behavior is reasonable in this interim state — only that the prose composition is what we said it should be.

This is an interim-only failure mode (resolved once Track B lands), but Track A is described in requirements.md as potentially landing alone if Track B is blocked > 1 week. During that window, real reviewers are exposed to the interim state.

### 3.2 [COMPOUNDING — High] `validateAllFiles` boundary tests duplicated across tasks 8 and 11

Task 8's prompt: "`validateAllFiles` boundary tests all pass" (success criterion).
Task 11's prompt: "`validateAllFiles` boundary tests (NUL-byte, Symbol-coerced, non-string, deleted file ENOENT, symlink to outside, duplicates, non-array input)."

Are these the same tests landing twice or different cases? Task 8 says "I added the helper, here are unit tests for it." Task 11 says "I'm asserting handlePrepare integration behavior, including these boundary cases." Both PRs touch `src/tools/__tests__/review-task.test.ts` (task 11 explicitly; task 8 plausibly because validateAllFiles lives in review-task.ts as a module-private helper).

If the same: PR boundary collision — task 8's PR adds tests at file path X, task 11's PR re-adds at the same path with possibly different shape (integration vs. unit). Test name collision likely. Reviewer cognitive load.

If different: under-specified split. Task 8's "boundary tests pass" should specify *which subset* and where they land. Without that, task 8 can ship without tests by claiming "boundary tests are task 11's job," and task 11 can ship without unit tests by claiming "those are task 8's job."

This compounds round 1's "tasks bundle multiple concerns" theme. Round 1 flagged task 8 as multi-concern; round 2 didn't split it; now it bleeds into task 11's scope with no contract.

### 3.3 [NOVEL — Medium] Task 7 extends hygiene with denylist, but `unwrapHygiene`'s rejection state is structurally unreachable

`computeHygieneSignals` (`src/core/hygiene-signals.ts:45`) is `Promise.all(files.map(scanFile))`. `scanFile` has a per-file try/catch (line 21-43) that returns `[]` on any error. The outer `Promise.all` only rejects if its argument array contains a rejected promise, which `scanFile` cannot produce.

After task 7 lands, `computeHygieneSignals` adds a `partitionPaths(files)` call before the map. `partitionPaths` is sync. If it throws synchronously (which task 1 says it doesn't — empty entries are rejected at construction time, not at `partitionPaths` call time), the error propagates synchronously *out of* `computeHygieneSignals` before the await — but `computeHygieneSignals` is `async` so the sync throw becomes a rejected promise, which `Promise.allSettled` in task 8 catches.

But it's the **only** path to a rejection. In practice, `unwrapHygiene` always returns the fulfilled branch, and `data.hygieneRejection` is dead code. Task 8's "wire `unwrapHygiene`" plus task 11's test "stub each utility in turn to throw synchronously" is the *only* way `data.hygieneRejection` ever fires.

Round 1 flagged "`hygieneRejection` design-only, no R-level commitment." Round 2 added the field at the data layer with no R-level commitment AND no realistic test surface. The test for it is "stub the function to throw" which doesn't reflect any real failure mode — it's a synthetic surface for a synthetic guarantee. Compounding: the round-1 finding is unresolved AND the v2 mechanism makes the gap more concrete (a field that shipped that does nothing).

### 3.4 [NOVEL — Medium] Task 14 silently relies on task-8 test assertions surviving

Task 8 ships the diff stub. Task 11 ships Track-A integration tests including (per task 11's "composite-pin tests": "match the Track-A interim fixtures byte-for-byte"). Task 14 replaces the stub with the real `computeTaskDiff`. Task 16 replaces the interim fixtures.

What asserts the **assertions in `review-task.test.ts`** (not the fixtures, but the assertion code that *uses* the fixtures) get re-pointed correctly when Track B lands? Task 17's prompt says "extend; replace the Track-A composite-pin block from task 11" — meaning the test code itself is replaced. But the assertions about non-fixture aspects from task 11 — `data.diff === ""` (interim stub), `data.diffStats === undefined` (interim stub), no diff directive in methodology — remain valid only against the stub. Task 14 replaces the stub; if the assertions aren't replaced, they fail in CI.

The likely outcome: implementer of task 14 sees CI failure on task-11 assertions, "fixes" them by updating expected values, but doesn't re-evaluate whether the assertion *intent* is preserved. Specifically: "data.diff is `""` because the stub returned `""`" → silently becomes "data.diff is `""` because the real computeTaskDiff returned `""` for the test scenario" — same output, different meaning. The test passes but no longer asserts what it claimed.

The Track-A interim sentinel test (task 17) catches *fixture-marker* persistence. It does NOT catch test-assertion drift between Tracks A and B.

### 3.5 [NOVEL — Medium] Task 19 ships annotation wiring without integration tests for ES#16/ES#17

Task 19's prompt cites Error Scenarios 15, 16, 17, 18. Task 21 lands the integration tests for these scenarios — three task IDs later. Task 19's PR reviewer cannot verify the failure paths work end-to-end at task-19 review time; the only verification is the unit-test layer (which task 19's prompt doesn't enumerate).

Concrete consequence: task 19's PR could ship with the legacy-fallback path subtly broken (e.g. warn-once key off-by-one, parse-failure path doesn't actually catch). The task-19 reviewer signs off because the surface tests pass; task 21 adds the integration tests three weeks later; one of them fails; the task-21 implementer "fixes" the integration test (or re-opens task 19). Net: task 19's PR shipped a broken-but-untested surface for the duration.

Per the "task-line-per-PR convention" implied by the spec-workflow review process, each task's PR is a review checkpoint. Task 19's PR with no integration test for its claimed behavior degrades the checkpoint to "compiles + unit tests pass."

---

## 4. v1-flagged-and-still-unresolved (compounding)

### 4.1 [COMPOUNDING] R4.8 legacy item-9 hygiene fixture regression test

Round 1 flagged: no task asserts the legacy `fast-reviews` item-9 fixture (`src/tools/__tests__/review-task.test.ts:100`) passes byte-identically after `buildReviewMethodology` is rethreaded. Round 2 status: still unresolved.

New compounding angle: tasks 9 and 15 both add new arguments to `buildReviewMethodology`. The threading change is cumulative — Track A adds `diffState` and `typecheckState`, Track B uses both. The signature change ripples to every existing call site. The legacy item-9 test at line 100 calls `buildReviewMethodology(taskContext, hasTechSteering, hasPriorReviews, hasHygieneSignals)` — four args. After task 9, the function expects six args. The legacy test must be updated to pass the new args; the question is whether the legacy fixture's *expected output* survives the new arg threading.

Specifically: when `diffState: { kind: 'empty' }` and `typecheckState: { kind: 'unavailable-feature-disabled' }` (the closest approximation to "no diff, no typecheck" — what the legacy state was), does `buildReviewMethodology` emit *exactly* the legacy item-9 directive at *exactly* the same position? Round 1 flagged it; round 2 didn't pin it; the threading change in tasks 9+15 makes the regression risk concrete.

### 4.2 [COMPOUNDING] End-to-end secret-leak through handlePrepare

Round 1 flagged. Round 2: now THREE consumers of `partitionPaths` (`computeTaskDiff` (task 12), `computeHygieneSignals` (task 7), `runProjectTypecheck` output filtering (task 5)). Each is unit-tested; no task pins the end-to-end "given `allFiles = [..., '.ENV']`, assert `data.skippedPaths` contains `.ENV` AND `data.diff` does not contain `.ENV` content AND `data.hygieneSignals` does not reference `.ENV` AND `data.typecheckResults[0].coverage.compiled` does not contain `.ENV`" together.

A regression in any one consumer (e.g. someone refactors task 5's denylist application and forgets the `coverage.compiled` filter) goes silent. Each consumer's unit test passes; the integration test that would catch the cross-consumer drift doesn't exist. Severity escalated.

### 4.3 [RECURRING] `.spec-workflow/.cache/` lifecycle / `.gitignore`

Round 1 flagged. Round 2: still no task adds `.spec-workflow/.cache/` to `.gitignore`, documents purpose, max size, or cleanup. Task 5 creates the directory via `mkdir({ recursive: true })`. After Track A's PR, every developer machine grows a directory containing `tsc.tsbuildinfo` (typically 1-100 MB for a non-trivial project). If `.gitignore` doesn't already exclude `.spec-workflow/.cache/`, the buildinfo gets committed.

Verify the existing `.gitignore`: at minimum, the existence of an ignore entry for `.spec-workflow/.cache/` should be a task acceptance criterion. Currently no task pins this. Severity stable from round 1; impact higher in round 2 because Track A cannot ship without creating the directory.

### 4.4 [RECURRING] Quantitative NFR thresholds

Round 1: NFR says "< 5 ms" / "< 200 ms" / "< 5 s incremental" without percentile/hardware/instrument. Round 2 status: task 4's "regression bound" is still a placeholder; tasks 6, 13 have no perf-gate. If there's no CI gate, the NFR is decorative.

Specifically: design line 540 says "warm < 1 ms; cold 5-15 ms typical." NFR says "< 5 ms per call." Conflict: warm is much faster than 5 ms; cold is slower than 5 ms. The NFR doesn't distinguish. Task 4's "cold-cache integration test (timed first call, regression bound)" is the only timing assertion and it doesn't pin the bound.

### 4.5 [RECURRING] R2.14 env-propagation symmetry

Task 6's prompt enumerates "all `'unavailable'` reasons reachable; in-scope tagging works against pnpm-symlinked workspace paths; 100-cap with in-scope-first ordering verified; multi-line TS2345 expansion captured" — but does not enumerate `FORCE_COLOR=0` / `NO_COLOR=1` propagation assertion the way task 13 names `GIT_OPTIONAL_LOCKS=0`. May ship untested.

### 4.6 [RECURRING] Concurrent-prepare error scenario

Design §7 calls it "documented unsupported; corrupts buildinfo." No task surfaces this to end users (README, error scenario doc, runtime warning). Failure remains silent.

---

## 5. Tasks-doc internal contradictions

### 5.1 [NOVEL — Medium] `data.diffRejection` placeholder is meaningless

Task 8's prompt: "Add the new `data` fields … `diffRejection` (placeholder values until Track B)."

`data.diffRejection?: { message: string }` (per design §`data.diff` shape). The field has only two states: present-with-message (utility rejected) or absent (utility didn't reject). A "placeholder value" for a field whose entire purpose is "present iff utility rejected" is undefined.

Three plausible interpretations:
- Always-absent placeholder: equivalent to `data.diffRejection: undefined` (or omitted). Then task 8 ships nothing. Track B's diff-rejection test (task 17) is the first time the field is non-undefined.
- Always-present placeholder: `data.diffRejection: { message: 'placeholder' }`. Then methodology fires R4.2b unconditionally for the whole Track-A window — contradicting R4.9 ("Track A emits no diff directives").
- Conditional placeholder based on stub-rejection: but the stub doesn't reject (resolves to `{ diff: '', ...}`), so always-absent.

The prompt is unclear which is intended. Implementer judgment will pick one; if (b), R4.2b fires throughout Track A; if (a), the field is never tested in Track A and the data-shape contract is unverified until Track B. Task 8's success criterion doesn't pin the choice.

### 5.2 [COMPOUNDING] Task 22 "ships in same PR as Track C code" violates task-line-per-PR convention

Task 22 is its own task line. The dashboard task-review process (per the spec-workflow MCP's own UX) treats each task line as a separate review checkpoint. Either tasks 18+19+20+21+22 collectively ship in one PR (violates convention; reviewer reviews 5 tasks at once; task-review jobs unclear which task to review), or task 22 ships separately and the same-PR claim is broken.

Round 1 flagged "task 11's shipped example settings file" was vacuous; round 2 is the same shape but for documentation. Compounding: the spec keeps making "same-PR with code" promises that the task structure can't enforce.

---

## Top 5 risks/gaps (ranked)

### 1. Task 20 has no surface to mirror task 19 against (§1.1)
**Failure scenario.** Implementer reads task 20, swaps `'adversarial'` → `'taskReview'` for `resolveRunnerModel`, looks for `approval.annotations` on the task-review route, finds none, either invents an ad-hoc store inline or skips the stamp. R3.9's "structural single-write retry-consistency for task-review path" is silently broken or silently re-implemented as a different mechanism. Existing tests don't catch because there's no task-review annotation surface to test against.
**Who notices when.** Anyone running an initial task-review, then editing settings, then retrying — they'd expect retry to use the initial's model. Today it re-resolves; after a buggy task-20 implementation, it still re-resolves but the warn-once log doesn't fire (because the surface that would log it doesn't exist), so users don't even know R3.9 is broken for task-review.
**Why existing tests don't catch.** Task 21's "Cover both adversarial and task-review paths" assumes the substrate exists.

### 2. 409 concurrent-initial check has no queryable surface (§1.2)
**Failure scenario.** Two concurrent POSTs against same approvalId → 409 was promised. With no approvalId-keyed lookup in `AdversarialRunner`, the implementer falls back to the existing `(specName, phase)` duplicate guard, which returns a 500 with a different error body shape. Worse: two concurrent POSTs against *different* approvals targeting same `(specName, phase)` now also 409 with another approval's `jobId` in the response.
**Who notices when.** Dashboard users running parallel reviews on different specs that happen to share `(specName, phase)` keys.
**Why existing tests don't catch.** Task 21's concurrent-initial test fixes both POSTs to the same approvalId, so the cross-approval collision is untested.

### 3. `stampAnnotationRunnerOptions` clobbered by post-`runner.run` `updateApproval` (§1.3)
**Failure scenario.** Initial flow: stamp succeeds at line N (pre-run); `runner.run` resolves; line 836's `updateApproval(...)` writes a fresh annotation that doesn't preserve `runnerOptions`; retry handler reads annotation, sees no `runnerOptions`, falls into legacy fallback. R3.9's structural guarantee is violated; warn-once fires but tells users "legacy annotation" — when it's actually a fresh approval whose stamp was clobbered.
**Who notices when.** The integration test in task 21 ("callCount === 1 across initial+retry on a fresh approval") would FAIL the way it's structured. Implementer of task 21 hits the failure, debugs, finds the clobber, has to redesign tasks 18/19's ordering.
**Why existing tests don't catch.** Tasks 18 and 19 don't enumerate the post-run `updateApproval` interaction; the unit-level "stamp is idempotent" test passes against an in-memory annotation object that ignores subsequent writes.

### 4. Drift extractor's numbered-list silent-loss path doesn't fire on additions (§2.1)
**Failure scenario.** Future spec author writes R4.9 entirely as numbered list AND forgets to update `EXPECTED_R4_BLOCK_NAMES`. Drift test passes vacuously. The R4.9 directive ships in `requirements.md` but no fixture pins it, no test catches the absence. R4.10's "deliberate decision" forcing function doesn't fire.
**Who notices when.** The next spec maintainer reading the prose and wondering why the test pinned other directives but not this one.
**Why existing tests don't catch.** The keyset constant is a write-required-twice invariant — extractor and constant must move together. Removing entries from the constant is the path of least resistance to a passing test.

### 5. Track-A interim methodology silent on present-but-empty `data.diff` (§3.1)
**Failure scenario.** Track A ships solo (because Track B is blocked > 1 week, per requirements.md line 19's emergency carve-out). Real reviewers see `data.diff = ""` with no methodology guidance. LLM invents instructions (often: "since data.diff is empty I'll skip diff inspection"), skipping the legitimate fallback to `filesToReview` + implementation-log triage that R4.2a would mandate.
**Who notices when.** Someone reading a Track-A-only review's analysis and seeing the LLM bypass file inspection.
**Why existing tests don't catch.** Composite-pin tests verify *what's emitted*; they don't verify *what an LLM does with the output*. R4.9 explicitly says "Track A emits no diff directives" so the tests are correctly green. The bug is in the design choice, not in the tests.

---

## Top 3 conclusions to challenge or reverse

### A. Reverse: task 20's "Mirror task 19" framing
**Sentence to challenge** (task 20's prompt): "Mirror task 19's adversarial wiring on the task-review handlers, swapping `'adversarial'` → `'taskReview'`."

**Why principled to reverse.** Task-review has no `approval` substrate. The annotation-persistence mechanism is approval-bound. Mirroring requires inventing a new substrate.

**Alternative.** Either:
1. Add an explicit task to introduce a task-review state-persistence layer (sidecar JSON file at `.spec-workflow/specs/<name>/tasks-state.json` with per-task runnerOptions), then task 20 wires R3.9 against it.
2. Acknowledge task-review **does not** persist runner options across initial/retry — task-review's retry re-resolves from current settings unconditionally. R3.9 applies only to adversarial-review. R3.10's test-pinning is then adversarial-only. (This is principled because task-review's retry is "find the failed job and re-run with current settings" — the existing semantics, not a regression.)

The current task 20 silently picks (1) without enumerating the substrate work, OR silently picks (2) without acknowledging the R3.9 carve-out.

### B. Challenge: task 19's "stamp BEFORE invoking runner.run"
**Sentence to challenge** (task 19's prompt): "stamps `runnerOptions.model` BEFORE `runner.run`."

**Why principled to reverse.** The pre-run stamp's stated purpose is "survives a runner crash mid-flight." But the existing post-run `updateApproval` at multi-server.ts:836 clobbers the stamp's entry from the annotation. Pre-run stamp is overwritten by post-run write. Either:
1. Reorder: stamp AFTER `updateApproval`, accept that a runner crash mid-flight loses the stamp (downgrade R3.9's "even if the runner crashes" guarantee).
2. Modify `updateApproval` callsite to read-merge the existing annotation rather than constructing fresh. This is an existing-code refactor that tasks 18/19 don't enumerate.

The current text claims a guarantee that the existing code shape can't honor without (2). Either pin (2) as additional work in task 19, or downgrade the guarantee in R3.9.

### C. Challenge: task 8's "diffRejection placeholder"
**Sentence to challenge** (task 8's prompt): "Add the new `data` fields … `diffRejection` (placeholder values until Track B)."

**Why principled to reverse.** A placeholder for a field whose semantics are "present iff X" is meaningless. The field should ship as `undefined`/absent in Track A (the natural state when no rejection occurred) — which is not a placeholder, it's the actual semantic. Task 8's prompt should drop "placeholder" framing and pin `data.diffRejection: undefined` as the Track-A interim state. Composability: when Track B lands, the field becomes conditionally-set, with no transition surface.

---

## What's missing

### Must-do pre-merge
- **Task 20: enumerate the task-review persistence substrate** (or reverse the structural mirror). Today's task 20 cannot be implemented as written.
- **Task 19: pin the post-`runner.run` `updateApproval` interaction.** Either re-order stamp to AFTER `updateApproval` (with R3.9 carve-out), OR pin the read-merge refactor of `updateApproval`'s annotation construction at line 819-829.
- **Task 19: pin the 409 surface.** Add an approvalId-keyed in-flight lookup to `AdversarialRunner` (or wrapper layer in `multi-server.ts`); enumerate this as a sub-task.
- **Task 8: clarify `diffRejection` placeholder semantics** (drop the placeholder framing; pin `undefined`).
- **Task 17: pin Direction B's "directive sentence" definition.** Vague today; implementer judgment will pick a too-narrow or too-wide definition.

### Should-do during implementation
- **End-to-end secret-leak integration test** through `handlePrepare` covering all three consumers. Add as a sub-task in task 11 or task 17.
- **`.gitignore` entry** for `.spec-workflow/.cache/`. Add as a sub-task in task 5.
- **Legacy item-9 hygiene fixture regression** — explicit assertion in task 11's enumeration that `src/tools/__tests__/review-task.test.ts:100`'s legacy fixture passes byte-identically after `buildReviewMethodology` rethreading.
- **Quantitative NFR thresholds** — pick one (warm settings read p95 < 1 ms on local dev; cold first call < 50 ms) and pin in task 4.
- **Task 11 vs task 8 boundary-test split** — explicit contract for which file/scope each PR owns.

### Can defer to follow-up
- Heading-format brittleness in drift extractor — pin a specific regex and document the format constraint.
- Constraint that R4.x directives must not contain internal paragraph breaks — document, but not block any task.
- Whitespace-only-model and model-no-longer-exists handling on retry — defer to a future spec; document the gap.
- Concurrent-prepare error-message surfacing to end users — defer, document the limitation in README.

---

## Closing note

The annotation-persistence design (Tracks 18-20) is the highest-risk area in round 2. It was designed in response to round 1's closure-capture critique, and the fix introduces three new structural problems (no task-review substrate; no 409 surface; pre-run stamp clobbered by post-run write) that the design doc claims to handle but that the actual code shape contradicts. Track-A interim state introduces a present-but-undirected `data.diff` field that the LLM may misinterpret. The drift extractor's silent-loss exemption for numbered-list R4.x is real but the fix (name-set guard) requires a write-required-twice invariant that's not enforced.

The 17 composite-pin fixtures and the typecheck/diff utilities themselves are well-specified; the highest-residual risk is concentrated in Track C and in the cross-task ordering gaps between Tracks A and B.
