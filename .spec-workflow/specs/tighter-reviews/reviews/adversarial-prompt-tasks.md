You are a senior staff engineer with deep experience shipping multi-track refactors in Node/TypeScript codebases — child-process orchestration, vitest fixture pinning, async I/O containment, and the kind of "additive seam, then fill the seam" sequencing this spec leans on. Your job in this review is **not** to validate the plan. Your job is to find the places where this tasks document will break down when an implementer actually tries to execute it: tasks that are too large, ordering hazards that the prose papers over, completion criteria that are not testable, requirement coverage gaps, and silent assumptions about how the existing codebase will respond to the prescribed changes. Tear it apart.

Read these documents in order before you begin:

- `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/tasks.md` (the document under review)
- `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md` (R1–R4 + NFRs are the contract the tasks must implement)
- `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/design.md` (design.md is the decision record; the tasks must execute its choices, not silently relitigate them)

If steering docs exist (`.spec-workflow/steering/*.md`), read them too — they're a hidden constraint surface.

Ground every attack angle below in **specific task numbers, file paths, requirement IDs, and design sections**. Generic "what about errors?" criticism is wasted. Cite line items.

---

## 1. Atomicity and task sizing

The eleven-task split partitions the work as Track A (5 tasks) → Track B (4 tasks) → Track C (2 tasks). Pressure-test the sizing.

- Challenge whether **Task 3** (`src/core/typecheck.ts`) is one task or three. It bundles the spawn contract + two-pass parser + chunked async realpath normalization + denylist filtering + six failure-mode mappings + first-run cache-dir creation + the 100-diagnostic cap. The acceptance test list alone names ~12 distinct scenarios. Identify the smallest unit a single implementer can land + review in one sitting and judge whether Task 3 fits.
- Challenge whether **Task 4** is atomic. It introduces `validateAllFiles`, the `Promise.allSettled` shell, three `unwrap*` helpers, a new `data`-shape extension, the `loadSettings` / `isTypecheckEnabled` wiring, and an integration test covering "all-three-utilities rejection." Each of those touches `src/tools/review-task.ts` in a way that could reasonably be its own diff. Find the seam where a reviewer would lose the ability to evaluate this PR end-to-end.
- Challenge **Task 9**'s scope: it deletes seven fixtures, ships fifteen new ones, adds a sentinel regression test, bumps `EXPECTED_R4_BLOCK_COUNT`, and adds the `diffState` parameter to `buildReviewMethodology`. Composite-pin churn at this scale is high-risk for normalization mistakes that pass the drift test but produce silently wrong reviewer prose. Stress the question: is "Track-A interim pin replacement" really one task?
- Look the other direction too — is **Task 7** (apply `partitionPaths` inside `computeHygieneSignals`) too small to be its own task line, or is it correctly atomic because it crosses a public-signature surface? Argue both sides.

## 2. Track ordering and dependency edges

The intent (requirements.md "Track sequencing") says **A → B → C**, with the composite-pin tests as the safety net. The tasks doc claims sequencing is "enforced by tests, not process." Probe whether the dependency graph the tasks actually express matches that claim.

- Verify **Task 4 → Task 6** ordering. Task 4 lands the `Promise.allSettled` shell with a "pass-through that returns the empty-diff state until Task 8 implements it." Identify what the inert diff slot's shape is, whether Task 4's tests actually cover the interim shape, and whether Task 8's "replace the inert diff slot" can land cleanly without re-touching Task 4's wiring.
- Walk **Task 2 → Task 4 → Task 10**. Task 2 builds `loadSettings` + `resolveRunnerModel` + `isTypecheckEnabled`. Task 4 consumes `loadSettings` + `isTypecheckEnabled` for typecheck. Task 10 consumes `resolveRunnerModel` for runner options at four `multi-server.ts` callsites. Identify whether Task 2 ships everything Task 4 and Task 10 need, OR whether Task 2 is silently coupled to a particular consumption shape that one of the consumers will break.
- Track A's Task 5 ships **7 typecheck-axis fixtures** with the `SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` marker. Track B's Task 9 deletes them and ships **15 final fixtures** (7 + 4 diff + 4 cross). Trace what happens if Track A merges and stays in `main` for two weeks before Track B merges. The requirements doc says "Track-A blocked beyond a week: Track B may re-pin the composite directly, skipping the interim Track-A-only pin." Is that escape hatch wired into any task? Or does the tasks doc silently assume Track B follows Track A within a week?
- Identify any task that depends on a file the listed predecessor doesn't actually create or modify. The path note at the top says `src/multi-server.ts` is actually `src/dashboard/multi-server.ts` — surface any other path drift between requirements/design references and the tasks' `File:` lines.

## 3. Mapping between tasks and requirements / design

This is the highest-leverage attack surface for a tasks-phase review. Every requirement should map to exactly one or more tasks; every task should cite the requirements it satisfies. Hunt for gaps.

- Build the requirements-to-tasks matrix mentally. R1.1–R1.11, R2.1–R2.14, R3.1–R3.12, R4.1–R4.10, plus the NFRs (Code Architecture, Performance, Reliability, Usability, Security). Identify any requirement that is **not cited** by any task's `_Requirements:` field.
- Specifically check: **R3.12** (`features` block schema rules — `features === null`, non-object `features`, `features.typecheck` non-boolean warn). Task 2's prompt mentions `isTypecheckEnabled` non-boolean warn but doesn't mention the `features === null` or non-object `features` cases. Is R3.12 fully covered or partially skipped?
- Check **R2.14** (`FORCE_COLOR=0`, `NO_COLOR=1` env). Task 3 cites it but only the outer prose. Verify the test list actually pins env propagation, the way Task 6 pins `GIT_OPTIONAL_LOCKS=0`.
- Check **NFR Security**. The denylist ships in Task 1 and is consumed by Tasks 6 and 7. But where is the "secret-bearing entries always case-folded" rule actually pinned by an integration test that exercises the prepare flow end-to-end with a `.ENV` file (uppercase) on Linux? Or is it only unit-tested at the `partitionPaths` boundary?
- Check the design.md "Error Scenarios §1–14" coverage. Task 4 cites Error Scenarios §13 and §14. Where do §1–§12 land in the tasks? Task 3's prompt cites "full failure-mode mapping" but doesn't enumerate which Error Scenario numbers map to which test. Surface any scenario that the tasks doc never names.
- Check **R4.8** (composition with the existing item-9 hygiene directive — diff is preamble, typecheck is item 10). This is cited by Tasks 5 and 9. But who pins that **the existing item-9 hygiene wording is not modified** by these tasks? Is there a regression test that the pre-existing item-9 fixture from `fast-reviews` (referenced as `src/tools/__tests__/review-task.test.ts:100`) still produces byte-identical output after Track A and Track B?
- Check **R3.11 documentation** — Task 11 owns it. But the requirement says "These doc updates land in the same PR as R3's code changes." Task 11 is separate from Task 10 (the code change). The tasks doc has no constraint that they ship in one PR. Is the tasks doc structurally violating R3.11?

## 4. Completion criteria, success conditions, and testability

Every task ends with `Success: <criteria>`. Test whether those criteria are objectively verifiable, or rhetorical.

- Task 2 says "cold-cache call < 15 ms typical." `< 15 ms typical` — which percentile? Measured how? On what hardware? CI runners vs developer laptops? Identify the success criteria across all 11 tasks that are wall-clock-time conditions but unspecified on instrument and threshold semantics. Compare against the NFR Performance section, which says "settings read < 5 ms warm" (warm, not cold) and "Cold runs under 30 seconds (timeout in R2.11)" — there's a 5 ms NFR and a 15 ms task success criterion that drift in the same area.
- Task 5's success says "EXPECTED_R4_BLOCK_COUNT guard rejects partial extraction." But Task 5 sets the constant to 5 (R4.4, R4.5, R4.6a, R4.6b, R4.7). Task 9 bumps it to 8 (adds R4.1, R4.2a, R4.2b). When Task 5 lands and sits in `main`, the drift test extractor reads `requirements.md` which **already contains all 8 R4 directives** — including R4.1, R4.2a, R4.2b that Track A doesn't pin. Will the drift test pass at the Track-A interim, or will it fail because the extractor finds 8 blocks but the constant is 5? Trace this carefully — this is exactly the kind of cross-track ordering hazard that "tests enforce sequencing" was supposed to catch.
- Task 8's success says "diff-empty and diff-rejection tests pass distinctly." Distinct on what observable? `data.diff === ""` is true in both cases. The distinguishing field is `data.diffRejection` (present iff utility-throw). Is that what "distinctly" means in the success criterion, or is it ambiguous?
- Task 11's "Manual E2E checklist" includes "edit settings between initial and retry within a single review — confirm retry uses initial's model." How does a human reviewer trigger the retry path manually? Is the dashboard surface for this documented anywhere? If not, the manual E2E is undefined-by-method.
- Task 10's "call count is 2, not 4" assertion: identify which test infrastructure makes this observable. `vi.spyOn` on `resolveRunnerModel`? But `resolveRunnerModel` is imported, not a method on a mockable object — does the test scaffolding required for this actually exist, or does the task silently assume a refactor (e.g., dependency-injected resolver)?

## 5. Out-of-scope drift and silent scope creep

The tasks doc has an "Out of scope (per requirements §Out of Scope (v1))" section listing 14 items. Cross-check whether the tasks themselves stay within that fence.

- Task 4 introduces `validateAllFiles` with realpath-based inside-projectPath checks, NUL-byte filtering, deleted-file ENOENT handling, symlink-pointing-outside detection. None of this is named in any requirement. The closest is R3 (path normalization for typecheck set ops). Identify whether `validateAllFiles` is a hidden requirement that should be elevated to R-level, or scope creep that should be deleted, or correctly-derived-from-NFR-Reliability and just under-cited.
- Task 4 introduces a `hygieneRejection` field. Search requirements.md and design.md for `hygieneRejection`. The design names it; the requirements don't enumerate it as part of R1/R2. Argue whether this is acceptable design-doc-level elaboration or scope creep that bypassed the requirements gate.
- Task 11's "shipped example `adversarial-settings.json`" — does the repo actually ship one? If not, the task creates a new artifact (out-of-scope-by-omission) without a requirement saying "ship an example file."
- Task 3 mentions "first-run cache-dir creation" — `<projectPath>/.spec-workflow/.cache/`. The cache dir is a new on-disk artifact. Is its creation, lifetime, gitignore-status, or cleanup specified anywhere? Or does the spec silently create a new directory in user repos?

## 6. Risk-laden technical assumptions in task prose

The `_Prompt:` blocks for each task encode constraints the implementer is told to honor. Several of them encode load-bearing technical claims that may not hold.

- Task 2's prompt: "warning format must match R3.7 byte-for-byte (it is a contract)." Is anything downstream actually parsing this warning programmatically? If not, "byte-for-byte contract" is spec-narcissism — pin tighter than necessary, then break on every editor-introduced punctuation drift. If something IS parsing it, the contract should be elevated to a requirement, not a task-prompt note.
- Task 3's prompt: "tsc invoked via node_modules/.bin/tsc — NEVER imported as a library." Ground this — does `spec-workflow-mcp` itself even depend on `typescript`? If `tsc` resolves only from the *consuming* project's `node_modules`, what happens during the `spec-workflow-mcp` repo's own typecheck of itself? Is there a self-host issue lurking?
- Task 6 says `-M` flag is enabled "even though pathspec defeats some rename detection (the directive tells the reviewer not to trust diff for renames)." Verify R4.1's prose actually contains that warning. Then ask: if `-M` provides no value here, why pay its cost? Or is there a partial-value case the spec is leaning on but not naming?
- Task 10 says `RunnerOptions` are "captured in closures shared by initial-and-retry callsites." The four callsites are at ~four different line ranges in `multi-server.ts`. Identify whether the existing code structure has a single function scope that can hold a closure spanning all four, or whether this requires a refactor that the task understates.
- Task 5 says fixtures live in `src/tools/__tests__/__fixtures__/methodology/` — described as "this is the first `__fixtures__` dir." Does adding a new directory shape break any existing test glob, lint config, or build excludes? The task doesn't check.

## 7. Process and review-loop hygiene

Every task's `_Prompt:` says "Mark task N [-] in tasks.md before starting; on completion run log-implementation and request a dashboard task review; only after the review passes mark [x]." This is process the tasks doc imposes on the implementer.

- Audit whether this process scales for Task 9, which deletes 7 fixtures and adds 15 across multiple files. A single dashboard task review on this PR is asking the reviewer to validate fifteen pieces of deterministic prose against R4 verbatim text, plus drift-test guard updates, plus sentinel regression. Is that one review, or three?
- The tasks doc says "the runner classes live in `src/dashboard/adversarial-runner.ts` and `src/dashboard/task-review-runner.ts`." Does requesting a dashboard task review on a PR that changes how those runners are constructed (Task 10) introduce a circular dependency where the review tooling under change is the same tooling running the review? Surface any chicken-and-egg risk.

---

## Closing deliverables

Conclude your analysis with:

- **Top 5 risks/gaps** in this tasks document, ranked by severity. For each: cite the specific task number(s) and a concrete failure scenario an implementer hits.
- **Top 3 conclusions to challenge or reverse.** Pick the three most load-bearing claims the document makes (e.g., "Task 3 is one task," "Track-A interim pins are clean," "the drift test will pass at the Track-A interim with `EXPECTED_R4_BLOCK_COUNT = 5`") and argue, with reasoning grounded in the docs, why they are wrong or fragile.
- **What's missing.** Work that needs to happen before an implementer can act on this document confidently: requirements that are not mapped, design decisions that need clarification, ordering hazards that need an explicit guard, completion criteria that need quantitative thresholds.

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on. Do not pad with praise. Do not soften criticism.

Write your analysis to: `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-tasks.md`
