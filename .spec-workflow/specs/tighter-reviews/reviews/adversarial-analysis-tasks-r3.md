# Adversarial review analysis — `tighter-reviews` tasks.md (round 3)

**Findings classification:** {novel: 7, compounding: 4, recurring: 5}

Scope ground-truth verified against the working tree before writing:
- `src/dashboard/adversarial-runner.ts:49` exposes `getJob(jobId)`; `:53` exposes `getJobsForProject`. Duplicate-guard at `:73` throws `"An adversarial review is already running for ${specName}/${phase}"`.
- `src/dashboard/task-review-runner.ts:44` exposes `getJob(jobId)`; `:48` exposes `getJobsForProject`. Duplicate-guard at `:66` throws `"A task review is already running for ${specName}/task ${taskId}"` — note the literal `/task ` separator (not a single `/`).
- The four new core modules (`adversarial-settings.ts`, `task-diff.ts`, `typecheck.ts`, `path-denylist.ts`) do not exist on `main`; this is an unbuilt spec.
- `multi-server.ts` lines 780, 948, 1730, 1774 contain four ad-hoc `readFile + JSON.parse` blocks against `adversarial-settings.json`. Tasks 19/20 promise to replace exactly these.

---

## 1. Track C per-job storage — new failure modes from the v2 resolution mechanism

### 1.1 [Recurring; v2 Unresolved §"failedJob lookup"] `failedJob.find` ordering is structurally ambiguous and not pinned in tasks 20/21

Task 20 retains the existing handler's lookup verbatim: `taskReviewRunner.getJobsForProject(projectId).find(j => j.specName === specName && j.taskId === taskId && j.status === 'failed')`. With multiple historical retries for the same `(specName, taskId)` — a routine outcome of "user retried twice yesterday, then again today" — `.find` returns the first match in `Map<string, Job>` insertion order, which on V8 is insertion order, which is *oldest first*. So "the failed job" the retry reads `model` from is the **oldest** failed retry, not the most recent one.

R3.9 states "retry uses initial's model." When N≥2 historical retries exist, "initial" is undefined: is it the very first run (now overwritten by N intermediate retries with possibly-different models if the user edited settings between them)? Is it the most recent failed run? Tasks 20 and 21 don't pin this. Task 21's "Whitespace-only model test" injects exactly one job into the map; multi-failure ordering is never exercised.

**Failure scenario.** User runs initial review with `model: opus-4-7`. It fails. They edit `adversarial-settings.json` to `model: sonnet-4-6` and click retry — that's the second job. It also fails. They click retry again from the dashboard. The handler's `.find` returns the *first* failed job (from the initial), reads `opus-4-7`, and the third attempt runs with `opus-4-7`. The user thinks they're testing `sonnet-4-6`. Telemetry/billing reflects `opus-4-7`. No test catches this.

**Fix.** Either sort by `startedAt` descending and pick `[0]`, or filter to "the failed job *with the most recent `startedAt`*", and add a Track-C test that exercises ≥2 historical failures.

---

### 1.2 [Novel] `vi.spyOn` import-shape responsibility is split between tasks 19/20 and 21 with no enforcement

Task 21's prompt admits the dependency: *"if the spy infra requires changes to `multi-server.ts`'s import shape, those changes belong in task 19/20 not this task — flag and resolve before writing assertions."* But task 19's prompt does not enumerate `import * as settings from '...'`, and task 20's prompt does not either. Design line 396 buries the namespace-import requirement in a sub-bullet inside a `Single-resolution pin (revised)` block.

The current codebase has zero existing imports from `src/core/adversarial-settings` (the file doesn't exist). Whichever PR ships first (19 or 20) will write the import statement. If the implementer writes `import { loadSettings, resolveRunnerModel } from '../core/adversarial-settings'` (the natural shape for a new module — named imports are idiomatic), task 21's spy on the namespace member silently observes zero invocations. The `equal(1)` assertion fails loudly, but the implementer's first instinct will be "the code path isn't hit" rather than "the import shape is wrong" — wasted debugging cycles, possibly misdiagnosed as a runner-spawn issue.

**Fix.** Move "use `import * as settings from '../core/adversarial-settings'` namespace import" into the *Restrictions* line of tasks 19 and 20 explicitly. Or better: have task 21 use `vi.mock('../core/adversarial-settings', async (importOriginal) => { ... })` partial-mock factory, which is import-shape-agnostic. Pick one and pin in 19/20, not 21.

---

### 1.3 [Recurring; memory §"cli/cliArgs not pinned per-review"] `cli`/`cliArgs` divergence between initial and retry is undocumented to users

Tasks 19 and 20 explicitly read `cli`/`cliArgs` from current settings on retry while pinning `model` from the prior job. A user who edits `cliArgs` between initial and retry gets a hybrid configuration: initial's `model`, current `cliArgs`. R3.9's stated rationale is "telemetry/billing consistency" — but `cliArgs` can include billing-relevant flags like `--print` mode vs interactive, and edits to `cliArgs` mid-review break the same consistency guarantee R3.9 invokes.

Task 22's README block enumerates the precedence ladder, the empty-string-clear semantics, the legacy-stays-valid policy, the server-restart fallback, and the concurrent-prepare limitation. It does **not** surface "your `cliArgs` change took effect on retry but your `model` change did not." Users will hit this and be confused.

**Fix.** Either (a) pin `cli`/`cliArgs` on the job alongside `model` (consistent), or (b) add a one-sentence note to task 22's README block: "Note: only `model` is pinned across retry; `cli` and `cliArgs` always reflect current settings."

---

### 1.4 [Recurring; memory §"CLI version skew"] `.trim() !== ''` filter does not catch model-string-no-longer-valid

Task 19/20's filter is `typeof === 'string' && .trim() !== ''`. This catches null/undefined/empty/whitespace, but not a persisted-but-invalid model name (the user upgraded their CLI mid-review and the old model name was deprecated; or someone mass-renamed the model in `claude-cli` between releases). The retry passes the persisted invalid string to `runner.run`; the runner shells out with `--model <stale-name>`; failure surfaces deep inside the spawned process, possibly with an unhelpful exit code.

This was Unresolved in v2 memory and remains so in v3 tasks. Task 21's tests don't simulate it.

**Recommendation.** Either acknowledge in task 22 docs ("if your CLI deprecates a model between initial and retry, the retry will fail; resolve by clearing `adversarial-settings.json`") or add a fallback: catch the runner's "unknown model" failure shape in the retry handler and re-invoke `resolveRunnerModel` from current settings as a degraded path. The current spec's response is silence.

---

### 1.5 [Novel] Task 18's "smoke test that existing tests still pass" does not audit `getJob`/`getJobsForProject` consumers

Task 18 adds `model?: string` to `AdversarialJob` and `TaskReviewJob`. These job objects are returned by `getJob` and `getJobsForProject`. Existing consumers of those accessors include dashboard rendering paths and websocket pushes that serialize the full job object to the client. Adding `model` makes that field visible in the serialized payload anywhere a job is sent over the wire — which may now include `claude-opus-4-7`-style model strings in a UI surface that previously showed only spec/phase/status.

Task 18's tests (a)/(b)/(c) verify the field roundtrips through `getJob` and that "existing tests still pass." They do **not** assert "no consumer accidentally exposes model in a UI context where it shouldn't appear" — that would require auditing every reference to `AdversarialJob`/`TaskReviewJob` and every JSON serialization path. No task in the spec does this audit.

**Failure scenario.** A user runs an adversarial review. The dashboard websocket pushes a job-update event containing `model: "claude-opus-4-7"`. A user with their dashboard mirrored to a public stream (e.g., recording a screencast) leaks their model preference. Low blast-radius but real, and PII-adjacent for any user who treats their model selection as private.

**Fix.** Add a sub-step to task 18: "audit all serialization paths for `AdversarialJob`/`TaskReviewJob` (websocket events, REST responses) and either include `model` intentionally with a test that pins its presence, or strip it via a serializer."

---

### 1.6 [Novel] Concurrent initial-and-retry race is unpinned in tests

Task 19's 409 translation handles the *initial-vs-initial* concurrency case. But what happens when a retry POST arrives during an initial's in-flight `runner.run` window? Sequence:

1. Client posts initial review → handler builds `RunnerOptions`, calls `runner.run(opts)` (the runner's job map is mutated synchronously inside `run` to register the new job before any await).
2. Before `runner.run` returns, client posts retry to the same approval. Retry handler reads `priorJobId = ann?.jobId` from the *approval annotation*, which still references the **previous** review's job (since the new initial's `updateApproval` at line 836 hasn't fired yet).
3. Retry handler calls `getJob(priorJobId)` for the previous job — possibly long since cleared if the in-process map evicts on completion (verify retention policy).
4. Retry then calls `runner.run` with the prior job's model. Now there are two simultaneous "initial" runs for the same `(specName, phase)`. The duplicate-guard fires on the *second* one. The 409 translation works — but the user's retry just failed in a way that has nothing to do with the prior job's model.

This isn't a correctness hole — the 409 catches it — but it's a UX hole. Task 21's tests cover concurrent-initial-vs-initial; they don't cover initial-vs-retry. Recommend adding the case to task 21's enumeration.

---

### 1.7 [Compounding; memory §"Per-job storage interaction with parallel job-store consumers"] `getJobsForProject` ordering on retry

Related to 1.1 but distinct: task 20's existing lookup uses `getJobsForProject(projectId).find(...)`. `getJobsForProject` is implemented in both runners as `Array.from(this.jobs.values()).filter(j => j.projectId === projectId)` (per the line `:53`/`:48` references). The order is `Map.values()` insertion order. Tasks 19/20 don't acknowledge that this is implementation-defined-but-stable; if either runner's internals are refactored to use any other backing store (LRU, priority queue, async-loaded), the lookup order silently changes and the multi-historical-retry semantics from 1.1 silently change with it.

**Fix.** Either pin the ordering as part of `getJobsForProject`'s contract in design.md, or have task 20's retry handler explicitly sort.

---

## 2. Sub-task ordering and cross-sub-task contract drift

### 2.1 [Novel] Task 14's `Promise.allSettled` array index choice is unspecified, and task 8.2's unwrap helpers are positional

Task 8.2 ships `Promise.allSettled([runProjectTypecheck(...), computeHygieneSignals(...)])` with `unwrapTypecheck`/`unwrapHygiene` helpers. The helpers are described in design as "fulfilled returns value; rejected returns documented degraded state" — they are unwrappers of a single settled-result entry, so they consume `settled[i]` for some `i`. Whether they're positional (called as `unwrapTypecheck(settled[0])`, `unwrapHygiene(settled[1])`) or named (called by inspecting which utility produced which result) is not pinned. The natural implementation is positional.

Task 14 says **"Add `computeTaskDiff` as the third entry"** — but the example in design.md elsewhere (the conceptual data flow) shows diff first. Task 14's prompt is silent on whether to append (index 2) or prepend (index 0). If task 14 prepends — driven by the implementer's read of design.md — the existing 8.2 callers `unwrapTypecheck(settled[0])` and `unwrapHygiene(settled[1])` now receive *the diff result*, with type errors caught by TS at best and silent type-coercion at runtime at worst.

**Failure scenario.** Task 14 implementer prepends `computeTaskDiff` to match design narrative; TS catches the swap because `TypecheckResult` ≠ `TaskDiffResult`. Easy fix in code review. But if the implementer instead appends (consistent with task 14's "third entry" wording) and adds `unwrapDiff(settled[2])`, everything works — but tasks 8.2's existing `[typecheck, hygiene]` shape is now an undocumented invariant. Future refactor reorders for "diff first" and breaks both unwrap helpers silently if any of them migrate to non-positional access.

**Fix.** Pin in task 14: "Append at index 2; the existing helpers' positional reads MUST NOT change." Or: pin in task 8.2 that helpers must take a *named* settled-result via destructuring keyed by utility name. Pick one.

---

### 2.2 [Novel] Sub-task 5.1's stub return-shape on success is the same as 5.2's real-parser return-shape on a clean compile — green CI doesn't prove correctness

Task 5.1 ships a parser stub that "returns empty diagnostics + empty coverage on success exit." Task 5.2 replaces it with a real parser. After 5.1 lands (CI green) and before 5.2 lands, *every test against typecheck* exercises the stub. A clean-compile fixture against the stub returns `{ diagnostics: [], coverage: { compiled: [], excluded: [] } }`. Against the real 5.2 parser, a clean compile returns `{ diagnostics: [], coverage: { compiled: [...allFiles...], excluded: [] } }`. Same fixture, different result.

If task 6's tests are written *during* the 5.2 PR (which they likely are, since task 6 is gated on 5.2 per task 5's note), this is fine. But if any test against the stub was written during 5.1 (the prompt doesn't forbid it; task 5.1 is its own task with its own implementation prompt), those tests pin the stub's `coverage.compiled: []` shape. When 5.2 lands and starts populating `compiled`, those stub-era tests fail in a way that looks like a real regression.

**Fix.** Task 5.1's prompt should explicitly forbid asserting against `coverage.compiled` content; only structural (the field exists) assertions are valid against the stub. Or: make 5.1's stub throw if `runProjectTypecheck` is called with success-exit semantics, so any 5.1-era test must avoid the success path until 5.2 lands.

---

### 2.3 [Compounding; v2 §3.2] Task 8.1's "exclusive boundary ownership" vs task 11's "integration smoke test" still overlap on three shapes

Task 11's *Integration-level validateAllFiles smoke test* explicitly enumerates "one valid path, one invalid (NUL-byte), one outside projectPath" — three shapes that are also in task 8.1's exclusive boundary set. The "exclusive" framing is preserved by *test description*: 8.1 names cases like `validateAllFiles: rejects NUL-byte input`; 11 names `handlePrepare: filters NUL-byte input via validateAllFiles`. Different files, different test descriptions — but the *behavior* under assertion (that NUL-byte gets dropped) is duplicated.

This is a smaller variant of v2 §3.2; v2's resolution made the framing exclusive but didn't reduce the behavioral overlap on the three smoke-test shapes. Two outcomes are possible: (a) the duplication is intentional, in which case "exclusive" is the wrong word and it should be "8.1 owns per-shape coverage; 11 spot-checks integration"; (b) the duplication is unintentional and should be reduced to ≤1 shape in task 11's smoke test.

**Fix.** Reword 8.1/11 ownership prose: "8.1 covers the full per-shape boundary set; 11 spot-checks any **one** shape end-to-end as integration evidence." Pick valid-only as the integration spot-check (verifies the wiring works) and drop NUL-byte/outside-projectPath from 11.

---

### 2.4 [Novel] Tracks A/B touch `buildReviewMethodology` signature in two PRs; legacy fast-reviews fixture call site at `review-task.test.ts:100` is not enumerated

Task 9 adds `typecheckState`. Task 15 adds `diffState`. Between Track A landing and Track B landing, every existing call site of `buildReviewMethodology` must have already been updated to pass `typecheckState`. Task 11's "legacy item-9 hygiene fixture passes byte-identically" test depends on the legacy call still calling `buildReviewMethodology` — but task 9's prompt does not enumerate "update the legacy fast-reviews fixture's call site at line ~100 to pass `typecheckState: { reason: 'feature-disabled' }` (or whatever Track-A interim default applies)." Without that update, Track A's PR doesn't compile.

This is a one-line fix during implementation; flagging because it isn't surfaced as a sub-step and an implementer following the prompt verbatim might not realize the call-site update is required before the test will compile.

**Fix.** Add to task 9's prompt: "Update all call sites of `buildReviewMethodology` (specifically the legacy fast-reviews test at `src/tools/__tests__/review-task.test.ts:100` and any production caller in `handlePrepare`) to pass `typecheckState`. The legacy hygiene fixture's expected output should remain byte-identical because Track-A interim emits no preamble; the new `typecheckState` argument should not affect the prose if hygiene-only conditions are passed."

---

### 2.5 [Novel] No CI gate enforces 5.1 → 5.2, 8.1 → 8.2, or 16.1 → 16.2 → 17 ordering

Task 5.1's `runProjectTypecheck` is exported and importable; 5.2 replaces its parser. If 5.2 lands without 5.1's spawn contract, nothing works. If 5.1 lands without 5.2's parser, success-with-listFiles returns `'no-parseable-output'`-style emptiness. Same shape for 8.1/8.2: if 8.2 lands first, `validateAllFiles` is undefined; if 8.1 lands first, the helper is dead code (TS-unused-export warning at most).

Strict ordering is in the prose ("Sub-task 5.1 ships first, then 5.2") but no PR-merge gate enforces it. The risk is small for sub-task pairs co-authored in sequence; it is real for parallel implementer streams or rebase-and-rearrange sequences.

**Fix.** Add a one-line note to each sub-task's prompt: "MUST land in PR-merge order 5.1 → 5.2 → 5.3 (resp. 8.1 → 8.2; 16.1 → 16.2 → 17)." Implementers will at least see the constraint.

---

## 3. Drift test gaps that v2 didn't address

### 3.1 [Recurring; v2 §2.2] R4.x with internal paragraph breaks — still unresolved

Task 17 says "Each extracted block is keyed by its R4.x name." If a future R4.4 maintenance splits the directive into two paragraphs (the truncation rule moves to its own paragraph under the same `#### R4.4 — ...` heading), the extractor produces two blocks at key `R4.4`. Task 17 doesn't specify the dedup semantics: last-write-wins? Concatenated? Throw? Direction A's "each R4.x block must appear normalized as a contiguous substring in at least one fixture" silently degrades depending on which paragraph survived.

**Fix.** Pin: "Multiple blocks for the same R4.x name are concatenated with a single `\n\n` separator before normalization." Or: "Multiple blocks for the same R4.x name fail the test with a 'duplicate block' error." Pick one.

---

### 3.2 [Recurring; v2 §2.3 follow-up] Heading-rename semantic identity — still unresolved

Renaming `#### R4.1 — Diff-present directive` to `#### R4.1 — Read changed hunks first` extracts as `R4.1` correctly; the rename is invisible to the drift test. v2 flagged this; v3 still doesn't address it. Low blast-radius (the rename is intentional), but it's a structural-not-semantic catch as v2 said.

**Fix.** Either accept and document ("rename catches no test, intentional") or add a `EXPECTED_R4_HEADING_TITLES` snapshot keyed by R4.x name.

---

### 3.3 [Novel] Direction B's "directive sentence" extractor is described but not pinned at the regex level

Task 17's Direction B definition: *"any sentence appearing inside a fixture's directive blocks (delimited by `**Read first:**`, item-9 hygiene marker, item-10 typecheck marker), excluding (a) the top-of-file docstring comment, (b) item-numbering boilerplate like `1.`/`2.`/`9.`/`10.`, (c) the boldface markers themselves. Pinned as a regex / extractor function in the test file."*

Saying "pinned as a regex / extractor function" is not the same as pinning *which* regex. Different implementers will write different extractors. One implementer's regex treats `R4.4 — Open the file` as a sentence; another's drops it as a heading. The drift test ships locked to whichever the implementer picked, and the next R4 maintenance round inherits the pick without realizing it.

**Fix.** Pin the literal regex text in task 17's prompt: e.g., `/(?<=^|\n)([^*\n][^.\n]*\.)/g` with explicit prose saying "sentences are full-stop-terminated; lines starting with `*`, `>`, or `#` are excluded" — or whatever the actual intended definition is.

---

### 3.4 [Compounding; v2 §2.4 follow-up] Block-ordering inversion in fixtures and non-directive filler prose between blocks remain uncaught

Memory notes Direction B catches sentences inside marked directive blocks but not narrative interleaved between them. Task 17 doesn't change this. A fixture author adds a sentence between Item 9 and Item 10 (`(this guidance applies only when typecheck passes)`) — it's not inside a marked directive block, so Direction B doesn't extract it. But it ships in the fixture, gets pinned as canonical via composite-pin, and the prose grows over time without R4 contributing it.

**Fix.** Either add a "stretch-zone" assertion (no non-whitespace text between marked blocks) or accept this as a documented limitation.

---

## 4. Quantitative NFRs — three-rounds-recurring; severity escalated

### 4.1 [Recurring; three rounds] Quantitative thresholds still ship without percentile / hardware / instrument / CI gate

Verified state of v3 tasks.md: task 4's prompt restriction explicitly says *"do NOT add wall-clock timing assertions — settings perf is informational, not a CI gate."* The conflicts persist:

- Requirements NFR section: "settings read: < 5 ms per call"
- Design line 561: "warm-cache reads < 1 ms; cold first-call 5–15 ms typical"
- Task 4's prompt: explicit instruction to NOT pin a CI gate
- Task 4's task body: "cold-cache integration test (timed first call, regression bound)" — bound undefined

This has now been flagged in v1, v2, and v3. The pattern is: the spec promises performance characteristics it does not enforce, no test will catch a regression, and "regression bound" is a placeholder that nobody is expected to fill. **Severity is escalated** per the round-3 directive.

**Concrete pinning recommendation** (so v4 has a target):

- **Percentile.** Settings reads are not on the latency-critical path of any UI render; pin **p99 ≤ 5 ms** for warm reads and **p99 ≤ 50 ms** for cold reads (10× the design's "5–15 ms typical" to absorb cold-cache spikes on slow filesystems and CI executor noise).
- **Hardware target.** GitHub Actions `ubuntu-latest` runner (the spec's existing CI floor); document the floor explicitly so degradation on slower targets isn't a silent failure of the gate but a known expansion.
- **Instrument.** `performance.now()` deltas around `loadSettings(projectPath)` invocation, run N=100 iterations after warm-up, assert percentile via tdigest or sorted-array p99.
- **CI gate.** A separate vitest test file `src/core/__tests__/adversarial-settings.perf.test.ts` flagged with `@vitest-environment node` and excluded from the default `vitest run` (run via dedicated CI job: `vitest run --include '**/*.perf.test.ts'`). Failure on the perf job blocks merge but doesn't run on every local `pnpm test`.
- **Acceptance.** If the team genuinely doesn't want a perf gate, **delete the NFR thresholds from requirements and design**. The current state — promising thresholds in three layers without enforcing them — is decorative and erodes trust in the spec's other thresholds (timeout 30s, maxBuffer 16 MiB, etc.). Pick one: enforce or remove.

This is the third round flagging this. If v4 still leaves it placeholder, the right move is removal-not-enforcement, since the team has demonstrated by inaction that they won't enforce.

---

## 5. Sub-document drift — requirements ↔ design ↔ tasks

### 5.1 [Novel] design.md lines 341 and 474 say "Add `getJob(jobId)` to both runners" but `getJob` already exists

Verified: `src/dashboard/adversarial-runner.ts:49` and `src/dashboard/task-review-runner.ts:44` already export `getJob`. Task 18 correctly says "Both runners already have `getJob(jobId)` accessors — no new method needed." Design line 341 says *"Add `getJob(jobId): AdversarialJob | TaskReviewJob | undefined` to both runners (a thin wrapper over the existing `private jobs: Map<string, Job>`)"* — stale. Line 474 repeats: *"Both runners gain a thin `getJob(jobId): Job | undefined` accessor over the existing `private jobs: Map<string, Job>`."*

This is the design layer disagreeing with itself ("over the existing `private jobs: Map<string, Job>`" hints the author *knew* `jobs` existed; they apparently didn't notice `getJob` already existed too). An implementer reading design.md first and tasks.md second will read "Add `getJob`" and possibly add a duplicate; an implementer reading tasks.md first sees "no new method needed" — these conflict.

**Fix.** Edit design.md line 341 to "**Both runners already expose `getJob(jobId): AdversarialJob | TaskReviewJob | undefined` over their `private jobs: Map<string, Job>`**, used by the retry handler to look up the prior job." And edit line 474 to remove "Both runners gain..." (replace with "Both runners already provide..."). Bonus: this edit is a one-liner and resolves the only "design contradicts task" finding I found in this round.

---

### 5.2 [Compounding; v2 §5.1 — `hygieneRejection`/`diffRejection` data-shape fields R-level gap] Still unaddressed

R4.2b prose mentions `data.diffRejection.message`; the data-shape field is design-only (line 427). If a future refactor removes `data.diffRejection`, R4.2b's prose becomes incoherent and no requirement-level test catches it (because requirements don't pin the field name).

This is a pre-existing v2 finding listed as "design-level only, no R-level commitment." V3 doesn't change it. Marking as compounding because v3's task 14 makes the field even more central (the whole "rejection observable distinguisher" testing pattern in task 17 hinges on `data.diffRejection.message`).

**Fix.** Add to requirements.md R4.2b: "the data response shape MUST include `data.diffRejection: { message: string } | undefined` such that `data.diffRejection.message` is set iff utility-rejection occurred." Pin at the requirement layer.

---

### 5.3 [Novel] `task-review-runner.ts:66` duplicate-guard message has a different shape than adversarial — task 20's "verify before pinning" is correct, but the verified prefix is not stamped in the task

Verified: task-review runner throws `"A task review is already running for ${specName}/task ${taskId}"` (note `/task ` literal), while adversarial throws `"An adversarial review is already running for ${specName}/${phase}"` (no `/task` literal). Task 20 says *"verify the exact duplicate-guard message in `src/dashboard/task-review-runner.ts` before pinning the 409 prefix-match (do NOT assume it matches the adversarial runner's message string)"*. Good — but the *result* of that verification isn't in tasks.md. The implementer has to re-verify each time the task is read.

**Fix.** Stamp the verified prefix into task 20: "The duplicate-guard message is `A task review is already running for ` (verified at `src/dashboard/task-review-runner.ts:66`)." Removes a discovery step and pins the contract.

---

## 6. Closing deliverables

### Top 5 risks/gaps

1. **`failedJob.find` ordering with multiple historical retries (1.1).** Task 20 retry handler picks the *oldest* failed job's `model`, not the most recent. User notices when telemetry/billing reflects yesterday's model, not today's edited one. Existing tests inject one job — multi-failure ordering is uncovered. Cite: `tasks.md` task 20 retry handler description; `src/dashboard/task-review-runner.ts:48` `getJobsForProject` insertion-order semantics.

2. **`vi.spyOn` namespace-import responsibility split (1.2).** Task 21's spy fails silently on `equal(1)` if tasks 19/20 use named imports for `loadSettings`/`resolveRunnerModel`. Implementer debugs spawn/runner before noticing import shape. No CI gate enforces; only doc cross-reference. Cite: `tasks.md` task 21 prompt body, `design.md:396`.

3. **NFR quantitative thresholds — three rounds unaddressed (4.1).** Settings cache "< 5 ms per call" and "< 1 ms warm / 5–15 ms cold" promised in three layers, asserted nowhere, no CI gate. Concrete recommendation: pin p99 against `ubuntu-latest`, separate perf vitest target, OR delete the thresholds. Severity escalated.

4. **`Promise.allSettled` array index unspecified between 8.2 and 14 (2.1).** Task 14's "third entry" wording vs design's diff-first conceptual order vs 8.2's positional unwrap helpers. TS may catch a swap; named-access refactor will not. Cite: `tasks.md` task 8.2 (current shape), task 14 ("third entry" wording).

5. **CLI version skew on retry — `model-no-longer-valid` (1.4).** Filter `.trim() !== ''` doesn't catch deprecated/renamed models persisted on the prior job. Retry shells out with stale model, fails inside spawn. Recurring from v2; still unaddressed; no test simulates it. Cite: `tasks.md` task 19 prompt restrictions, task 21 test enumeration.

### Top 3 conclusions to challenge or reverse

1. **Quote (task 4 prompt): "do NOT add wall-clock timing assertions — settings perf is informational, not a CI gate."**
   *Reverse* because the spec promises NFR thresholds in three layers (R-NFR, design line 561, task 4 body); declaring them informational while documenting them as commitments is the worst combination — readers assume enforcement, none exists.
   *Alternative.* Either delete the NFR thresholds from requirements/design, OR pin a perf vitest target with p99 bounds. Task 4 body should say which.

2. **Quote (design.md line 341): "Add `getJob(jobId): AdversarialJob | TaskReviewJob | undefined` to both runners (a thin wrapper over the existing `private jobs: Map<string, Job>`)."**
   *Reverse* because `getJob` already exists in both runners (verified `:49` and `:44`). The design instruction will lead an implementer who reads it before tasks.md to add a duplicate.
   *Alternative.* "Both runners already expose `getJob(jobId): AdversarialJob | TaskReviewJob | undefined` over their `private jobs: Map<string, Job>`."

3. **Quote (task 19/20 retry filter): "`typeof === 'string' && .trim() !== ''`."**
   *Reverse-or-extend* because this is necessary but not sufficient — a non-empty string that names a deprecated/renamed model passes the filter and fails inside the spawned CLI with no operator-friendly message. R3.9's "telemetry/billing consistency" rationale doesn't survive the model-no-longer-exists case.
   *Alternative.* Either (a) catch the runner's "unknown model" failure shape and degrade to `resolveRunnerModel(currentSettings, runner)` with a warn-once, OR (b) document the failure mode in task 22's README as "if you upgrade your CLI between initial and retry and the model name has changed, retry will fail; recovery is to clear the prior job by re-running the initial." Pick one; current spec is silent.

### What's missing

**Must-do pre-merge (block the spec-tasks merge until pinned):**
- Pin `Promise.allSettled` array index (2.1) — append at index 2 vs prepend; pin in task 14.
- Pin `vi.spyOn` namespace-import requirement in tasks 19 and 20 (not just task 21) (1.2).
- Stamp the verified task-review duplicate-guard prefix into task 20 (5.3).
- Pin Direction B's "directive sentence" regex literal in task 17 (3.3).
- Edit design.md lines 341/474 to reflect that `getJob` already exists (5.1).
- Decide on the perf NFRs: pin a CI gate or delete the thresholds (4.1).

**Should-do during implementation (catch in code review):**
- Audit `getJob`/`getJobsForProject` consumers for accidental `model` exposure in serialized payloads (1.5).
- Add a multi-historical-retry test in task 21 (1.1, 1.7).
- Pin sort-by-`startedAt`-descending in task 20's retry lookup (1.1).
- Reword 8.1/11 ownership prose to remove the three-shape behavioral overlap (2.3).
- Add legacy fast-reviews call-site update sub-step to task 9 (2.4).
- Add ordering-assertion notes to sub-tasks 5.1/5.2/5.3, 8.1/8.2, 16.1/16.2/17 (2.5).
- Add R4.2b data-shape field commitment to requirements (5.2).

**Can defer to a follow-up spec (acknowledge gap; don't block):**
- Heading-rename semantic identity drift (3.2) — accept as documented limitation.
- Block-ordering inversion / non-directive filler in fixtures (3.4).
- R4.x internal paragraph break dedup semantics (3.1) — likely won't fire in v1 prose; pin in v2 spec maintenance.
- `cli`/`cliArgs` divergence on retry (1.3) — either pin on the job in v2 or document explicitly; not a v1 blocker if README's R3.9 note is extended by one sentence.
- Initial-vs-retry concurrent race coverage in task 21 (1.6) — 409 catches the bug; absent from tests is a coverage gap, not a correctness hole.
- CLI version skew (1.4) — operator-recoverable; design choice between failure-shape catch vs documentation should defer to a v2 spec if the team prefers explicit silence in v1.
