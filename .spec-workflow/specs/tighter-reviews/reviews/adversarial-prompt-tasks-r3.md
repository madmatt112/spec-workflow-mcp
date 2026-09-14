# Adversarial review prompt — `tighter-reviews` tasks.md (round 3)

You are a senior staff engineer with deep expertise in TypeScript MCP server orchestration, Fastify route lifecycles, child-process control, and the long-tail failure modes of multi-PR sequencing on shared files. Your job is to **tear apart** the tasks document at `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/tasks.md`. You are not here to validate, applaud, or weigh trade-offs charitably. Find what will break, what will silently drift, what an implementer can technically satisfy while shipping a broken contract, and what the document promises but cannot enforce.

The tasks document operationalizes a three-track spec (Track A — typecheck pre-computation; Track B — `git diff`-first context; Track C — per-runner model selection with per-job storage on the runner). Read the tasks document, the requirements at `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md`, and the design at `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/design.md`. The tasks doc is what implementers will actually act on; the requirements and design are context that lets you spot drift between layers and contracts the tasks claim but cannot enforce.

## Prior Review Context

This is the third adversarial review of this tasks document. Two prior rounds have shaped the current shape; do not re-discover what they already caught.

**v1 found** — and current tasks.md addresses — closure-capture being structurally impossible (replaced by per-job model storage on the runner), `EXPECTED_R4_BLOCK_COUNT` brittleness (replaced by name-set guard with empty-block-as-failure semantics), Track-A → Track-B interim sentinel marker, R4.2 split for utility-rejection, full R3.12 edge-case enumeration.

**v2 found** — and current tasks.md addresses — that the v1 fix (annotation stamping via `stampAnnotationRunnerOptions`) was structurally broken in three ways (no task-review approval surface, no 409 surface, post-`runner.run` `updateApproval` clobbered the stamp). The current tasks.md *abandons annotation stamping entirely* and replaces it with **per-job storage**: `AdversarialJob` and `TaskReviewJob` interfaces gain a `model?: string` field; the runner's existing `getJob(jobId)` accessor lets the retry handler read it. This is the largest single design churn since v1. v2 also found, and current tasks.md addresses: numbered-list R4.x silent-loss (Direction A's empty-block-as-failure rule), heading-format brittleness (pinned regex), Direction B "directive sentence" definition (pinned extractor), Track-A interim methodology silent on present-but-empty `data.diff` (Track A now ships no diff fields at all), task 8/task 11 boundary-test duplication (split into 8.1 exclusive ownership + 11 integration-only), end-to-end secret-leak across three consumers (now in task 17), legacy item-9 byte-identical regression (now in task 11), `.gitignore` for `.spec-workflow/.cache/` (now in task 5.1), env-propagation symmetry (`FORCE_COLOR=0`/`NO_COLOR=1` in task 6), concurrent-prepare README note (in task 22), `diffRejection` placeholder dropped, R4.8 explicit assertion.

**Three-rounds-recurring**: quantitative NFR thresholds (warm < 1ms / cold 5–15ms / "< 5ms per call" / "< 200ms / 50 files" / "< 5s incremental") still ship without percentile / hardware / instrument / CI gate. Task 4's "regression bound" placeholder persists. Two reviews flagged this; the current tasks.md still leaves the bounds informational. **If this still ships in v3 unfixed, surface it as a recurring finding with escalated severity.**

**Classify each finding** as one of:
- **Novel** — not identified in any prior review.
- **Compounding** — builds on or deepens a prior finding (cite the prior round and section number).
- **Recurring** — same issue identified before but not yet resolved. Severity must escalate. Cite the prior rounds.

Do **not** re-derive findings v2 already caught and resolved (annotation persistence redesign, drift test silent-loss, Track-A diff-fields gap, boundary-test split, etc.). The memory file at `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-memory-tasks.md` enumerates which findings are accepted, partial, rejected, and unresolved — read it to ground your scope but do not treat its "Guidance for Next Review" section as a constraint, only as a starting orientation.

Open `requirements.md` line numbers and `design.md` symbol references when you cite specifics. Cite specific task numbers (e.g., "task 5.2", "task 19", "task 21") and quote prompt fragments verbatim when calling out contradictions or ambiguity. The tasks document is the artifact under review.

---

## Analysis dimensions

### 1. Track C's per-job storage redesign — new failure modes from the v2-resolution mechanism

The v2 review caused tasks.md to abandon annotation stamping in favor of per-job storage on the runner. This is the largest single design churn in the spec's history. Each round's "fix" has tended to introduce new structural problems; do not assume the third iteration is finally clean.

Attack the per-job storage mechanism specifically:

- **`failedJob.find` ordering in task 20's retry handler.** Task 20 says the retry uses `taskReviewRunner.getJobsForProject(projectId).find(j => j.specName === specName && j.taskId === taskId && j.status === 'failed')`. With multiple historical failed retries for the same `(specName, taskId)`, `.find` returns the FIRST match — order-dependent on the underlying `Map` iteration order. R3.9 says "retry uses initial's model"; if multiple retries exist, "initial" is ambiguous. Pin which job the retry actually uses, OR demonstrate the ambiguity is real and tasks 20/21 don't pin the right invariant.
- **`getJob` semantics with the new `model?` field.** Existing consumers of `getJob`/`getJobsForProject` (dashboard rendering, websocket pushes, status panels) may now surface `model` in places it wasn't previously visible. Task 18's "smoke test that existing tests still pass" is not the same as "asserts no consumer accidentally exposes model in a UI context where it shouldn't appear." Look for whether any task pins this scope.
- **`vi.spyOn` import-shape circular dependency between tasks 19/20 and 21.** Task 21's prompt says "if the spy infra requires changes to `multi-server.ts`'s import shape, those changes belong in task 19/20 not this task — flag and resolve before writing assertions." But tasks 19 and 20 don't enumerate this import-shape change in their own prompts. Task 19's PR can ship without the namespace import; task 21's spy then silently observes zero invocations and `equal(1)` fails opaquely. The dependency is acknowledged but not enforced — the responsibility for the import shape is split between tasks that don't reference each other on this point.
- **`cli`/`cliArgs` divergence between initial and retry.** Task 19 reads `cli`/`cliArgs` from current settings on retry while pinning `model` from the prior job. A user who edits `cliArgs` between initial and retry gets a retry with the new `cliArgs` but the original `model` — a hybrid configuration neither initial nor "current settings" matches. Task 22's docs don't surface this. Either the divergence is intentional (and undocumented), or it's an unacknowledged inconsistency in R3.9's "telemetry/billing consistency" rationale.
- **Concurrent initial-and-retry race.** If a retry POST arrives during `runner.run`'s in-flight window for the same `(specName, phase)`, what happens? The duplicate-guard at the runner fires; task 19's 409 translation catches it; but is the prior-job lookup (`getJob(priorJobId)`) racing the runner's job-map mutation? Task 21's tests don't simulate this concurrency.
- **Whitespace-only / non-string filter is partial.** Task 19's `typeof === 'string' && .trim() !== ''` catches null/undefined/empty/whitespace, but it does NOT catch a model-string-no-longer-valid case (model deprecated, CLI upgraded mid-review). The retry passes the persisted-but-invalid model to `runner.run`; failure surfaces as a runner crash. R3.9's "telemetry/billing consistency" rationale doesn't survive the model-no-longer-exists case. Pin whether this is accepted-and-documented or unaddressed.
- **Verify task 20's 409-message prefix-match without verifying the message string.** Task 20 says "verify the exact duplicate-guard message in `src/dashboard/task-review-runner.ts` before pinning the 409 prefix-match (do NOT assume it matches the adversarial runner's message string)." This is a verification step the *task prompt* defers to the implementer. If the task-review runner has no analogous duplicate-guard throw (or has a *different* concurrency scope), task 20 is fundamentally not implementable as written, but the prompt frames it as "verify before pinning."
- **`getJob(jobId)` was not in the codebase pre-spec.** Task 18's prompt says "Both runners already have `getJob(jobId)` accessors — no new method needed." Verify this claim in the actual code (`src/dashboard/adversarial-runner.ts`, `src/dashboard/task-review-runner.ts`). If `getJob` does not exist on one or both runners, task 18 must add it AND task 19/20 depend on it — an uncatched scope gap.

### 2. Sub-task ordering and cross-sub-task contract drift

V3-era tasks split three monolithic tasks into sub-tasks: task 5 → 5.1/5.2/5.3 (typecheck), task 8 → 8.1/8.2 (handlePrepare wiring), task 16 → 16.1/16.2 (composite fixtures). Each split addresses v2's "density" theme but introduces new ordering invariants that must be enforced.

- **Task 5.1 ships a parser stub that 5.2 replaces.** What constraints lock the function signature between 5.1 and 5.2? 5.1's prompt says "the function signature MUST match what 5.2 and 5.3 will extend (no breaking re-shape between sub-tasks)" — but the discriminated union in `TypecheckResult` evolves across sub-tasks (5.1 says all status variants present; 5.2 adds parser; 5.3 adds coverage/normalization/denylist filtering). What stops 5.1 from shipping with `coverage: { compiled: [], excluded: [] }` always-empty (legitimate per the stub) which then forms the basis for assertions that 5.2 inherits silently?
- **5.1 → 5.2 stub-replacement contract.** 5.1's parser stub returns "empty diagnostics + empty coverage on success exit." Tests against 5.1's surface (none enumerated, but if any exist) will assert this stub behavior. 5.2 ships a real parser; the stub-asserting tests now legitimately fail. Task 6's tests cover real-parser behavior but ship as one task — meaning task 6 cannot run cleanly until 5.2 lands. What's the ordering enforcement?
- **8.1's exclusive boundary-test ownership vs 11's integration-only smoke test.** Task 8.1 owns NUL-byte / non-string / Symbol / BigInt / outside-projectPath / symlink-to-outside / deleted-file / duplicates / non-array. Task 11's prompt says "do NOT enumerate the per-shape validateAllFiles boundary cases — those are exclusive to task 8.1." But task 11 ships an "Integration-level validateAllFiles smoke test" with three of those exact shapes (valid, invalid NUL-byte, outside projectPath). If 8.1's tests use vitest descriptions like `validateAllFiles: rejects NUL-byte input` and 11's smoke test uses `handlePrepare: rejects NUL-byte input via validateAllFiles`, they're in different test files but assert overlapping behavior. The "exclusive ownership" stance breaks down at this seam.
- **16.1 deletes Track-A fixtures; 16.2 adds cross-axis fixtures depending on 16.1.** What asserts that 16.1 lands before 16.2? Both touch the same directory. If 16.2 ships first (file-name-collision-free), the cross-axis fixtures reference Track-A interim shape that 16.1 will later delete. Track-A interim sentinel test (in task 17) would catch the marker presence but only after Track B's PR.
- **Task 14 adds a third entry to the `Promise.allSettled` array.** Task 8.2 ships a 2-element array. Task 14 modifies the array to 3 elements. If task 14's PR doesn't also update the type signature of any helper that destructures `settled[0]` / `settled[1]` (assuming the helper is positional-aware), the order matters. Task 14's prompt says "Add `computeTaskDiff` as the third entry" — but the existing 8.2 helpers are `unwrapTypecheck` for `settled[0]` and `unwrapHygiene` for `settled[1]`. Task 14 must reorder OR add `unwrapDiff` at index 2 with the typecheck/hygiene at indices 0/1. If task 14 instead puts diff at index 0 (matching design.md's example which shows diff first), the 8.2 helpers' index reads break. Task 14's prompt is silent on the array order.
- **Track A → Track B `buildReviewMethodology` signature evolution.** Task 9 adds `typecheckState` parameter (no `diffState`). Task 15 adds `diffState`. Between Track A landing and Track B landing, every `buildReviewMethodology` call site must be updated to pass `typecheckState` — the legacy item-9 hygiene fixture test at `src/tools/__tests__/review-task.test.ts:100` calls the function with the old four-arg shape and must be updated. Task 9 doesn't enumerate this. Task 11's "legacy item-9 byte-identical assertion" depends on the legacy test still calling the function — but how does it call it now? Pin.

### 3. Drift test gaps that v2 didn't address

V2 closed the silent-loss path for *new* numbered-list R4.x (Direction A's empty-block-as-failure rule). But several drift-test edge cases survive into v3-era tasks.md:

- **R4.x with internal paragraph breaks.** Design line 533–534 says "Boundary detection runs BEFORE whitespace-collapse: split on `\n\n` first to identify directive boundaries, then normalizes each block's interior." This applies to **both** R4 source and fixtures. If a future R4.4 maintenance splits the directive into two paragraphs (say, the truncation rule moves to its own paragraph), the extractor gets two blocks under one heading. Task 17's prompt says "Each extracted block is keyed by its R4.x name" — implying one block per name. What happens with two blocks at the same key? Last-write-wins? Concatenated? Task 17 doesn't specify. This is unaddressed.
- **Heading rename silently parses to same R4.x.** Renaming `#### R4.1 — Diff-present directive` to `#### R4.1 — Read changed hunks first` extracts as `R4.1` correctly, but the rename isn't surfaced. The drift test catches structure not semantic identity. v2 noted this; v3 doesn't address it.
- **Block-ordering inversions in fixtures.** Direction A passes if every R4.x substring is present *somewhere* in *some* fixture — order-agnostic. A fixture that places R4.4 before `**Read first:**` (legitimate for `success-with-diagnostics + diff-empty` if the author's composition is non-canonical) passes Direction A. The "items 1–8 → Item 9 → Item 10" composition order is asserted by composite-pin tests against the fixture, but only against the fixtures that exist. A new fixture authored with inverted order pins the inversion as canonical without surfacing the divergence.
- **Non-directive filler prose between blocks.** Direction B's "directive sentence" definition excludes top-of-file docstring, item-numbering boilerplate, boldface markers. But a fixture author might insert a *narrative* sentence between Item 9 and Item 10 ("(applies only when typecheck passes)") that isn't a directive sentence per the pinned regex. Direction B doesn't catch it. Composite-pin tests catch byte-equality with the fixture, but the fixture contains the filler — so the filler is canonical. This is fixture-only prose growth that the drift test is supposed to catch but won't.
- **Direction B's regex/extractor is unspecified at the test level.** Task 17 says "Pinned as a regex / extractor function in the test file" — but doesn't pin the regex. Implementer judgment fills the gap; different judgments yield different "directive sentence" definitions, and the test ships locked to whichever the implementer picked. Drift detection becomes implementation-defined.

### 4. Quantitative NFRs — three-rounds-recurring

This is the third review noting that NFR thresholds ship without percentile / hardware / instrument / CI gate. Task 4 still says "regression bound" without numbers. Conflicts persist:

- NFR section says "settings read: < 5 ms per call."
- Design line 561 says "warm-cache reads < 1 ms; cold first-call 5–15 ms typical."
- Task 4's "cold-cache integration test (timed first call, regression bound)" is the only timing assertion and the bound is unspecified.

If you only flag this once across this analysis, flag it loudly. If still unaddressed in v3, severity is escalated. Recurring findings become structural debt — the document promises performance characteristics it cannot enforce. Spell out a concrete pinning recommendation (which percentile, which hardware target, which CI gate) so the next round has something to converge against.

### 5. Sub-document drift — requirements ↔ design ↔ tasks

Some commitments live in design.md but never made it to requirements.md, and some commitments live in tasks.md but never made it to either. v2 flagged this with three examples; v3 should re-verify and look for new drift introduced by the per-job storage redesign.

- **`getJob(jobId)` accessor.** Task 18 says "Both runners already have `getJob(jobId)` accessors — no new method needed." Design line 341 says "Add `getJob(jobId): AdversarialJob | TaskReviewJob | undefined` to both runners (a thin wrapper over the existing `private jobs: Map<string, Job>`)." The design says ADD; task 18 says ALREADY EXISTS. Verify which is true. If the design is right, task 18 is missing a sub-step. If task 18 is right, design line 341 is stale.
- **`AdversarialJob.model` and `TaskReviewJob.model` fields.** Tasks.md task 18 enumerates the addition. Requirements R3.9 mentions "the `AdversarialJob` and `TaskReviewJob` interfaces gain a `model?: string` field." Design lines 437–469 enumerate the full interface shape including `model?`. All three layers agree. But: requirements R3.9 says the field is "populated from `RunOptions.model` during job construction inside the runner" — so the requirement is for `runner.run` to populate it. Task 18 says "In each runner's `run(opts)` method, set `job.model = opts.model` during job construction." Aligned. But: any test asserting that the `RunOptions` interface itself didn't change (only the `Job` interface) — task 18's "No changes to `RunOptions`" — what verifies this in CI?
- **`hygieneRejection` and `diffRejection` data-shape fields.** v2 noted these are design-level only, no R-level commitment. v3-era requirements still don't enumerate them as acceptance criteria. R4.2b prose mentions `data.diffRejection.message`, but the data-shape field is design-only. If the field is removed by a future refactor, R4.2b's prose becomes incoherent and no requirement-level test catches it.
- **`getJobsForProject` in task 20.** Task 20 says "the existing handler already finds the failed job via `taskReviewRunner.getJobsForProject(projectId).find(j => ...)`." Verify that `getJobsForProject` exists on `TaskReviewRunner`. If not, task 20's premise is wrong.

### 6. Recurring v2 unresolved + new failure modes specific to the v3 design

V2's memory listed several still-unresolved findings. Re-verify each:

- **R4.x prose internal paragraph breaks** — still unresolved.
- **Heading-rename semantic identity** — still unresolved.
- **Whitespace-only / non-string model in retry survives CLI version skew** — partially resolved by the `.trim()!==''` filter; CLI version skew case still unresolved.
- **`vi.spyOn` import-shape dependency** — circular ownership between tasks 19/20 and 21.
- **`failedJob.find` ordering with multiple historical retries** — unaddressed in tasks 20/21.
- **Server-restart wakeup race** — covered for v1 by warn-once fallback; verify the test path actually exercises a real restart vs a mocked-out runner-jobs-clear.

For each, classify whether it's now resolved (cite where), still unresolved (escalate to recurring), or compounded by v3-era changes.

Look for **NEW** failure modes that v3 may have introduced:
- The split of task 5 into 5.1/5.2/5.3 introduces three PRs touching one file. Sub-task 5.2 replaces 5.1's parser stub. What asserts that 5.1's CI status remains green after 5.2 lands? If 5.1's PR is green-and-merged with the stub, then 5.2's PR refactors the stub away — does CI run against post-5.1 state to verify the stub's contract was upheld? Or against post-5.2 state where the stub is gone?
- Task 8.1's `validateAllFiles` lives in `src/tools/review-task.ts` as a module-private helper. Task 8.2 wires it into `handlePrepare`. If 8.1 lands without 8.2, the helper is unreachable dead code. If 8.2 lands without 8.1, `handlePrepare` references an undefined symbol. The strict ordering 8.1 → 8.2 isn't enforced by a CI gate.
- Task 16.1 deletes 7 Track-A fixtures and authors 11 new ones. Task 16.2 adds 6 more. Between 16.1 landing and 16.2 landing, the test suite asserts against 11 fixtures only — the cross-axis fixtures don't exist yet. The composite-pin test in task 17 references all 17 fixtures. If task 17 lands between 16.1 and 16.2, it fails CI on the missing 6 cross-axis fixtures. The strict ordering 16.1 → 16.2 → 17 isn't enforced.

---

## Closing deliverables

Conclude your analysis with:

- **Top 5 risks/gaps** (the highest-blast-radius items you found). For each, give a concrete failure scenario (who notices, when, what existing tests don't catch). Be specific about which task number, which line in the file, which prompt fragment.
- **Top 3 conclusions to challenge or reverse** — sentences in the tasks document or its design rationale that are wrong or under-justified. Quote the sentence verbatim, give the principled reason to reverse, and propose a concrete alternative.
- **What's missing** — work that should be done before the tasks document is acted on, broken into:
  - Must-do pre-merge (block the spec-tasks merge until pinned)
  - Should-do during implementation (catch in code review)
  - Can defer to a follow-up spec (acknowledge gap; don't block)

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on. Apply the **Novel / Compounding / Recurring** classification per finding (counts in a header line at the top of the analysis: e.g. `**Findings classification:** {novel: N, compounding: M, recurring: K}`). For Compounding and Recurring findings, cite the prior round's section number.

Write your analysis to: `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-tasks-r3.md`
