# Requirements Document

## Introduction

This spec makes the signal a reviewing agent receives truthful: which commit the diff starts from, whether the typecheck ran, which workspace produced the work, and how those facts reach the prompt on both review paths. It is for developers running agents in parallel git worktrees over one shared `.spec-workflow`, where a task committed on a branch reviews as an empty diff, a half-installed worktree reviews as a flood of module errors, and a dashboard-spawned reviewer never sees diff or context data. It changes `review-task prepare`, `log-implementation`, the dashboard status route, the task-review runner, the adversarial scaffold and the response encoder.

## Alignment with Product Vision

`.spec-workflow/steering/product.md` is absent; the scope authority is decomposition entry 2 (`.spec-workflow/spec-decomposition/decomposition.md:40-48`), which carries R5, R7, R8 and R9 from `worktree-execution-context`. A reviewer told the wrong thing passes unexamined code. This spec depends on spec 1 for `ToolContext.workspacePath` (`src/types.ts:58-76`) and the file partition, re-specifying neither.

## Requirements

### Requirement 1 — The diff base is the task's own starting point (carried R5)

**User Story:** As a developer whose agent commits task work on a worktree branch, I want the review diff to start from the commit the task started at, so that committed work is reviewed instead of reported as "no diff".

#### Acceptance Criteria

1. WHEN the dashboard status route (`src/dashboard/multi-server.ts:1417-1477`) changes a task to `in-progress` THEN the server SHALL record a diff base keyed by spec, task ID and the project's translated workspace path (`ProjectContext.workspacePath`, `src/dashboard/project-manager.ts:14`), holding that workspace's `HEAD` commit and the recording time. Keying without the workspace lets worktree B reviewing A's task read A's commit.
2. WHEN `HEAD` is read for the record THEN it SHALL be read in the workspace being marked, with the git location variables scrubbed as every other git call is (`src/core/task-diff.ts:39-62`). IF the read fails THEN nothing SHALL be recorded and the status change SHALL still succeed.
3. WHEN `tasks.md` is edited directly THEN no base is recorded. No MCP tool sets `in-progress`, so this is the dominant path; design and user documentation SHALL state that the recording site serves dashboard-driven status changes only.
4. WHEN `handlePrepare` (`src/tools/review-task.ts:348-536`) computes the diff THEN it SHALL read the base entry for the reviewing workspace only, never another's for the same task; attribution SHALL be read regardless of workspace (Requirement 3).
5. WHEN a recorded base is used THEN it SHALL first pass `git merge-base --is-ancestor <base> HEAD` run in the workspace. `git rev-parse --verify` is not sufficient: linked worktrees share one object database, so it succeeds on any sibling branch's commit.
6. WHEN the base validates THEN `computeTaskDiff` (`src/core/task-diff.ts:149-248`) SHALL diff from it instead of the `HEAD` literal at `:183-184`, taking the base as a parameter, disclosed with provenance `recorded`. Its production caller (`src/tools/review-task.ts:473`) and its test callers (`src/core/__tests__/task-diff.test.ts`, `src/tools/__tests__/review-task.test.ts`, `src/__tests__/parity-baseline.test.ts`) SHALL be updated in the same change.
7. IF no record exists for the reviewing workspace THEN the diff SHALL use `HEAD`, disclosed with provenance `head-expected`.
8. IF the record fails the ancestry check THEN the diff SHALL use `HEAD`, disclosed distinctly with provenance `head-degraded` and the rejected commit named.
9. WHEN a recorded base equals `HEAD`, and WHEN a non-worktree project has no record, THEN the diff bytes, stats and truncation SHALL equal today's output for the same inputs.
10. WHEN a git invocation fails on the diff — the `!ok` arm at `src/core/task-diff.ts:191-193`, including `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` (`src/core/typecheck.ts:478`) against the 16 MB `MAX_BUFFER` at `src/core/task-diff.ts:30` — THEN the result SHALL classify as `rejected` (`src/core/task-diff.ts:115`) with a message naming the observed cause, not as the benign empty diff. A base many commits back makes overflow materially likelier.
11. WHEN the base is disclosed THEN the disclosure SHALL name the commit and its provenance and SHALL state that the diff spans the base to the working tree, so changes to the same files committed between base and `HEAD` are included.

### Requirement 2 — The typecheck degrades honestly (carried R7)

**User Story:** As a reviewer of a worktree whose dependencies are missing or stale, I want the typecheck to say it could not run, so that I am not handed hundreds of fabricated "cannot find module" diagnostics as if they were findings.

#### Acceptance Criteria

1. WHEN the compiler is resolved THEN it SHALL continue to resolve only under the workspace (`resolveTscBinary`, `src/core/typecheck.ts:409-423`); absence yields `tsc-not-found`, the behaviour spec 1 recorded in Migration.
2. WHEN the workspace has a `package.json` THEN, before `tsc` is spawned (`src/core/typecheck.ts:188`), the check SHALL verify that every package named in `dependencies` and `devDependencies` is resolvable from the workspace. Not sampled and not capped: this repository declares 37 and 15 (`package.json`), and every type-critical package (`typescript`, `@types/*`, `vitest`) is a devDependency. `optionalDependencies` are excluded.
3. IF any declared package is unresolvable THEN the result SHALL be `unavailable` with a new reason value naming dependency resolution, `tsc` SHALL NOT be spawned, and the `observed` text SHALL give the unresolvable count and up to five package names.
4. WHEN a result is `unavailable` for any reason THEN it SHALL carry an `observed` statement: what was checked, at which path, and what was found. It SHALL describe the observation, not a diagnosis the check did not make.
5. WHEN the workspace lacks `tsconfig.json` (`src/core/typecheck.ts:147-152`) THEN `observed` SHALL state whether the workflow root has one, so a worktree missing the file is distinguishable from a project that never had it. `tsconfigPath` stays derived from the workspace (`src/core/typecheck.ts:141`).
6. WHEN `tsc` did not run to a parseable completion THEN status SHALL NOT be `success`: the `no-parseable-output` arms (`src/core/typecheck.ts:217-222`) and `output-overflow` (`src/core/typecheck.ts:198-200`) SHALL continue, and no diagnostic list — present or absent — SHALL be reported from a run that did not finish.
7. WHEN dependency state is decided THEN it SHALL NOT be inferred from diagnostic shape. A ratio test over `TS2307` cannot distinguish a broken `node_modules` from a large legitimate file move.
8. (Amends carried R7 AC 6.) WHEN a new `unavailable` reason is added THEN it SHALL be surfaced through the execution-context disclosure (Requirement 4), and `R4_6B_TYPECHECK_UNAVAILABLE` (`src/tools/review-task.ts:815-816`) SHALL NOT be edited by this spec. That constant names six reasons and already omits `wrapper-config` (`src/core/typecheck.ts:35`); it is byte-pinned by the seventeen fixtures under `src/tools/__tests__/__fixtures__/methodology/` and by the two-way drift test (`src/tools/__tests__/review-task.test.ts:1458-1501`) against `.spec-workflow/specs/tighter-reviews/requirements.md:184-186`. That document is tracked (`git ls-files` lists it; `git check-ignore` exits 1), so the test runs in CI too, contrary to the comment at `src/tools/__tests__/review-task.test.ts:1455-1457` and to deferral `d-f3cb6fd8`. The divergence is a deferred decision against `tighter-reviews`, filed by the orchestrator.
9. WHEN the `TypecheckResult` union (`src/core/typecheck.ts:17-47`) gains a reason value or an `observed` field THEN the change SHALL land under the exported-type-shape position spec 1 took in its Migration section. `computeTypecheckMethodologyState` (`src/tools/review-task.ts:55-74`) maps every non-`feature-disabled` reason to `unavailable-other`, so the methodology directive is unchanged.

### Requirement 3 — Work is attributable to the workspace that produced it (carried R8)

**User Story:** As a developer reviewing from worktree B a task that was implemented in worktree A, I want the review to say so, so that a mismatch between where the code was written and where it is being read is a stated fact rather than a silent one.

#### Acceptance Criteria

1. WHEN `log-implementation` succeeds THEN it SHALL record, in the per-task record of Requirement 1, the absolute translated workspace path and that workspace's `HEAD` at logging time. Today the handler (`src/tools/log-implementation.ts:297-429`) destructures only the workflow root (`:316`) and the entry it writes (`:376-388`) carries neither.
2. WHEN attribution is written THEN `log-implementation` SHALL be its single writer; the status route writes only the base. A write to either field SHALL preserve the other (one record, two owners).
3. (Amends carried R8.) WHEN the fields are stored THEN they SHALL live in one record per task, base keyed by workspace and attribution shared, under the workflow root's `.spec-workflow/specs/<spec>/`, not in the implementation-log markdown entry (`src/dashboard/implementation-log-manager.ts:318-345`, `:433-448`) and not inside any worktree.
4. WHEN the workspace came from an `args.projectPath` override THEN the record SHALL mark `source: 'override'`, otherwise `'context'`. `selectRoots` (`src/tools/root-selection.ts:202-221`) returns no such flag, so the tool derives it from `args`. A value derived from an override is asserted by the caller and SHALL be disclosed as such.
5. IF reading `HEAD` fails THEN the workspace path SHALL still be recorded with a null commit, and the log entry SHALL still be written.
6. WHEN `handlePrepare` runs THEN attribution state SHALL be one of `match` (recorded path equals the reviewing workspace after `normalizeIdentityPath`, `src/core/git-utils.ts:101`, on both sides), `mismatch`, or `unknown` (no record). Every task logged before this change is `unknown`.
7. WHEN state is `mismatch` THEN the review SHALL still produce a verdict; attribution is descriptive, never a review or implementation lock.
8. WHEN two writers from different workspaces update records under one spec concurrently THEN neither write SHALL be lost, and the file SHALL never be observed half-written. The registry lock's primitive (`withRegistryLock`, `src/core/registry-lock.ts:350-391`) may be reused with a store-specific lock path; the registry's own lock file (`:7-11`) SHALL NOT be shared.
9. IF the record is missing, unreadable or malformed THEN prepare SHALL degrade to `unknown` attribution and `head-expected` base, both disclosed, and SHALL NOT fail.

### Requirement 4 — Disclosures reach the reviewing agent on every path (carried R9)

**User Story:** As a reviewing agent, I want one named execution-context object in my prompt whichever way I was started, so that I act on the real base, typecheck state and workspace rather than on defaults.

#### Acceptance Criteria

1. WHEN `handlePrepare` returns THEN `data` (`src/tools/review-task.ts:494-511`) SHALL carry one object `executionContext` with `workspacePath`; `workflowRoot`, the directory containing `.spec-workflow`, equal to `ToolContext.projectPath`; `specWorkflowDir`, the `.spec-workflow` directory that `projectContext.workflowRoot` (`:521-526`, `PathUtils.getWorkflowRoot`, `src/core/path-utils.ts:208-210`) names today; `diffBase` (commit, provenance, detail); `typecheck` (status, reason, `observed`); and `attribution` (state, logged workspace, logged commit, source). The two root meanings SHALL NOT share a field name.
2. WHEN `TaskReviewRunner` (`src/dashboard/task-review-runner.ts:96`) reads the prepare response THEN its destructure (`:177`, six fields today, none carrying diff data) SHALL name `executionContext`, `diff`, `diffStats`, `diffTruncated`, `skippedPaths` and `diffRejection`, and `BuildPromptOptions` (`:66-91`) SHALL type each, so an omission is a compile error rather than a silent drop. (Closes `d-6e59490b`.)
3. WHEN the dashboard prompt is built (`buildPrompt`, `src/dashboard/task-review-runner.ts:287-434`) THEN it SHALL contain a section rendering the execution context, the diff state — stats, truncation, skipped paths, and any rejection message verbatim — and where the diff body is.
4. WHEN the diff body is non-empty on the dashboard path THEN it SHALL be written to a file beside `outputPath` (`src/dashboard/task-review-runner.ts:204`) and named in the prompt, removed with the output file (`src/dashboard/task-review-runner.ts:272`). The prompt is one argv element (`src/dashboard/task-review-runner.ts:473`): under node 24 on Linux, `spawnSync('/bin/true', ['x'.repeat(131072)])` fails with `E2BIG` while 100,000 bytes succeeds, and the diff cap alone is 50,000 bytes (`src/core/task-diff.ts:32`).
5. WHEN provenance is `head-expected` or `recorded` THEN it SHALL be rendered as a fact with no qualify-your-verdict instruction. WHEN provenance is `head-degraded`, attribution is `mismatch`, or typecheck is `unavailable` or `timeout` THEN the section SHALL carry one sentence telling the reviewer to name that fact in the summary.
6. WHEN a fact already drives a methodology directive (`buildReviewMethodology`, `src/tools/review-task.ts:661-766`) THEN the methodology SHALL own the instruction and `executionContext` the fact; the disclosure SHALL NOT restate a directive, and no fact SHALL have two emitters.
7. WHEN the direct MCP path is used THEN `data.executionContext` SHALL be the same object the runner renders, produced once in `handlePrepare`.
8. WHEN `adversarialReviewHandler` writes the scaffold (`src/tools/adversarial-review.ts:157`) THEN the scaffold SHALL state the workspace and workflow root. The handler drops `workspacePath` today (`:61`), `buildScaffoldedPrompt` (`:342-351`) has no field for it, and `AdversarialRunner` (`src/dashboard/adversarial-runner.ts:49`) builds no prompt (`:116-128`). Adversarial runs disclose the two roots only.
9. WHEN the runner spawns the agent THEN `SPEC_WORKFLOW_WORKSPACE` and `SPEC_WORKFLOW_SHARED_ROOT` (`src/dashboard/task-review-runner.ts:483-487`) SHALL continue to be set; the prompt disclosure is additional; an agent does not read its environment.

### Requirement 5 — An all-drop review is honest at every instruction site

**User Story:** As a reviewer whose task's logged files all failed to resolve in the workspace, I want no instruction in my prompt telling me to read every file or explaining the empty diff as already-committed work, so that I cannot pass unexamined code by following the methodology.

#### Acceptance Criteria

1. WHEN no logged file resolved in the workspace (`hasNoReviewableFiles`, `src/tools/review-task.ts:317-321`) THEN the diff state SHALL be a distinct kind, not `empty`. Today the empty `kept` early return (`src/core/task-diff.ts:179-181`) yields `empty` and `R4_2A_DIFF_EMPTY` (`src/tools/review-task.ts:774-775`) fires necessarily.
2. WHEN that state holds THEN the preamble SHALL be a stated text that does not offer "already committed before review" as an explanation and does not instruct a full read, and the unconditional header at `src/tools/review-task.ts:675` ("Read ALL files listed in filesToReview") SHALL be replaced by a header stating that no workspace files are available.
3. WHEN those texts are added THEN they SHALL be new constants, not R4.x blocks. The fixtures' canonical inputs (`src/tools/__tests__/review-task.test.ts:1107-1124`) do not exercise this state and Direction B (`:1482-1500`) inspects fixtures only, so no pin moves. A fixture-free test SHALL assert the all-drop methodology contains neither pinned sentence.
4. WHEN the prompt no longer contains the two instructions THEN the last sentence of `NO_REVIEWABLE_FILES_DISCLOSURE` (`src/tools/review-task.ts:345-346`), SHALL be revised to match the prompt rendered on both paths (runner `src/dashboard/task-review-runner.ts:389-393`, `nextSteps` `src/tools/review-task.ts:515-517`).
5. WHEN this diverges from `tighter-reviews` R4.2a's trigger (`.spec-workflow/specs/tighter-reviews/requirements.md:154-156`: empty diff with `data.diffRejection` absent) THEN the divergence SHALL be recorded in the same deferred decision as Requirement 2 AC 8.
6. WHEN a containment rejection (`src/core/task-diff.ts:168-177`, `:115`) or a git-failure rejection (Requirement 1 AC 10) occurs THEN it SHALL keep the `rejected` kind and its own message; `R4_2B_DIFF_REJECTED` (`src/tools/review-task.ts:777-778`) is not edited.

### Requirement 6 — The prepare response survives its own encoding

**User Story:** As a consumer that decodes a `review-task` response with the library that encoded it, I want the data back, so that a structured assertion or an agent reading the response does not get a decode error instead. (Folds in `d-a2233b94`.)

#### Acceptance Criteria

1. WHEN `toMCPResponse` (`src/types.ts:288-296`) encodes a `review-task prepare` response THEN decoding the text with the same library SHALL return a value deep-equal to the response. Probe under the installed `@toon-format/toon@0.8.0` (`package.json:72`, `^0.8.0`): `decode(encode({ m }))` for the real methodology (3,702 characters, empty-diff and `tsc-not-found` inputs) throws `RangeError: Expected 0 inline array items, but got 1`; the first half of the string round-trips; a small nested object shaped like `executionContext` round-trips.
2. WHEN the shape is chosen THEN the methodology text SHALL still reach direct callers in full. Fallback to JSON, a different carrier for the field, or a library fix is design work.
3. WHEN `adversarial-review` returns `data.methodology` (`src/tools/adversarial-review.ts:178`) THEN the same round-trip property SHALL hold.
4. WHEN the change lands THEN a test SHALL decode a full encoded prepare response and compare it to the source.

### Requirement 7 — The behaviour is verifiable

#### Acceptance Criteria

1. WHEN end-to-end coverage runs on the shared harness (`e2e/helpers/worktree-harness.ts`, `e2e/worktree-shared.spec.ts:322-657`, `npm run test:e2e:worktree`) THEN a task set `in-progress` through the dashboard route in worktree A, then committed on A's branch, SHALL produce a diff covering the committed work with provenance `recorded`.
2. WHEN a worktree's `node_modules` lacks a declared devDependency THEN the typecheck SHALL report `unavailable` with the dependency reason, `observed` naming the package, and no `tsc` spawn, asserted on the spawn count.
3. WHEN work is logged from A and reviewed from B THEN `attribution.state` SHALL be `mismatch` in the direct response and in the dashboard prompt, and a verdict SHALL still be produced.
4. WHEN a single-checkout project with no records is reviewed THEN diff bytes and methodology bytes SHALL equal today's; the seventeen fixtures pass unchanged.
5. WHEN a dashboard prompt is built for a containment-rejection case THEN the test SHALL assert the `containmentRejectionMessage` text (`src/core/task-diff.ts:135-147`) is present.
6. WHEN two workspaces write one spec's records concurrently THEN both writes SHALL be present afterwards.
7. WHEN a test asserts on `child_process` or `fs` behaviour THEN it SHALL assert only fields node 20 documents (`.spec-workflow/agent-rules.md`), and the design SHALL say which.

## Non-Functional Requirements

### Performance
- One `git rev-parse HEAD` per recording and one `git merge-base` per prepare; no other new git spawn.
- The dependency probe is one filesystem existence check per declared package (52 here), before the 30-second `tsc` spawn.

### Reliability
- Recording a base or attribution never blocks the status change or the log write; failure warns and continues.
- A missing or corrupt record degrades to disclosed `unknown` and `head-expected`, never a thrown prepare.

### Security
- The record is written only under the workflow root's `.spec-workflow`; it stores paths spec 1 validated, never a worktree path.
- All new git invocations pass argument arrays with the location variables scrubbed, as `runGit` does.

### Migration
- `computeTaskDiff` gains a base parameter; `runGit` (`src/core/task-diff.ts:50-62`) gains an error-cause field (Requirement 1 AC 10); `TypecheckResult` gains a reason value and an `observed` field; `data.executionContext` is new; a per-task record file is new. All fall under spec 1's stated position on exported type shapes.
- Tasks logged before upgrade are `unknown`; tasks started before upgrade have no base and review from `HEAD`, disclosed.
- Dashboard-started tasks diff from the recorded base, so a review of committed work is no longer empty; release notes SHALL say so.

## Decisions taken in this document

- D1 — Diff base recording site: the dashboard status route only; options were an explicit `baseRef` argument on `prepare`, and a computed merge-base with the default branch; chosen because it is the only site with a known workspace at a pre-work moment; the argument trusts the caller and a branch merge-base spans every task on the branch.
- D2 — Base validation by `git merge-base --is-ancestor` in the workspace; options were `git rev-parse --verify` and `git cat-file -e`; chosen because both alternatives succeed on any commit in the shared object database.
- D3 — One per-task record under the shared `.spec-workflow/specs/<spec>/` holds base and attribution with one owner per field; options were attribution in the implementation-log markdown entry, and two separate stores; chosen because the log is hand-parsed markdown and the carried criteria require co-location.
- D4 — Direct existence probe of every `dependencies` and `devDependencies` entry before spawning `tsc`; options were a `TS2307` ratio test, a ten-item sample of `dependencies` only, and no probe; chosen because the type-critical packages here are all devDependencies and a ratio cannot tell a broken install from a file move.
- D5 — New `unavailable` reasons surface through `executionContext.typecheck` and `R4_6B_TYPECHECK_UNAVAILABLE` is not edited; options were editing the constant with the fixtures and `tighter-reviews` R4.6b in one change; chosen because the constant is byte-pinned across a spec boundary and the drift test runs in CI.
- D6 — All-drop honesty via a new diff-state kind with new preamble and header constants; options were editing `R4_2A_DIFF_EMPTY` and the header with a fixture regeneration, and leaving the residual; chosen because it closes the harm without touching any pinned byte.
- D7 — On the dashboard path the diff body travels by a file beside the output path and the state travels inline; options were inlining the body in the prompt, and omitting it; chosen because the prompt is one argv element and a 131,072-byte element fails with `E2BIG` on Linux.
- D8 — Round-trip fidelity of the whole prepare response is the stated observable; options were fixing the mechanism here (JSON fallback, dropping the field, patching the encoder); chosen because the mechanism is design work.
- D9 — `head-expected` is a fact with no directive; options were a directive on every fallback; chosen because a signal that fires on every review carries no information.
- D10 — The disclosure names both `workflowRoot` (directory containing `.spec-workflow`) and `specWorkflowDir`; options were reusing `projectContext.workflowRoot`'s meaning, and one field with a note; chosen because the two meanings would otherwise reach the agent under one name.
- D11 — The carried R7 cache-location criterion is dropped; options were re-specifying the cache under the workspace with `info/exclude`; chosen because spec 1 R4 AC 3-4 pinned the shared cache directory and per-workspace file key (`src/core/typecheck.ts:167-174`, `:425-453`).
- D12 — Attribution paths compare after `normalizeIdentityPath` on translated paths; options were raw string equality; chosen because both sides are translated and a symlinked root would otherwise mismatch.

## Scope notes

- Carried R7 "cache lives under the workspace, exclusion in `info/exclude`" and the related bare-repository and `.gitignore`-regression notes: dropped (D11); spec 1 decided and implemented the cache location.
- `d-f3cb6fd8`'s two owned sites (runner instruction, `nextSteps`) were closed by spec 1; only the two pinned sites are in scope (Requirement 5).
- Locking for other shared-root files stays with `worktree-dashboard-concurrency`; Requirement 3 AC 8 covers only the new record.
- Adversarial runs get roots only; no diff, typecheck or attribution for them.
- No MCP tool sets a task `in-progress`; Requirement 1 AC 3's hit-rate statement stands instead.
- The review gate keeps its caller-supplied `baseRef` default `HEAD` (`src/tools/review-gate.ts:207-210`).
- The deferred decision against `tighter-reviews` (Requirement 2 AC 8, Requirement 5 AC 5) is filed by the orchestrator, not by this document.

## Revision History

- **v1** (2026-09-17) — Initial draft.
- **v2** (2026-09-17) — Lint pass on v1 from revision input RI-1 (the v1 lint brief; 2 error, 34 warning, 13 info).
  - **RI-1 — Accepted (MUST_FIX).** Applied the interrupted v1 lint pass: re-anchored both out-of-bounds citations, qualified thirteen bare line-only citations with their owning path, added the missing normative word to the one criterion lacking it, and widened or rejected each identifier-mismatch finding on its individual merits.
  - **Lint pass.** 23 fixed; rejected: L-1 (the recorded commit is read by a git helper elsewhere, not by the status route or the path field cited here), L-11 (the field this criterion adds cannot already exist in the type it amends), L-13 (the commit field this criterion adds is new behavior with no reader yet in that handler), L-14, L-15, L-16, L-17 (the four terms name a different function and new state values, not the path-normalizing helper cited inline), L-18, L-19, L-20, L-21, L-22, L-23, L-24 (the object fields named are new; the current response literal cannot already carry them, and the enclosing handler is already cited elsewhere in this document), L-26, L-27, L-28, L-29, L-30, L-31 (these six names are exactly what this criterion adds to a destructure that today carries none of them), L-36 (the cited byte-cap constant has no reason to name a file path defined in a different module), L-37 (the cited byte-cap constant states a size, not the operating-system error the same sentence also mentions), L-38 (the field this criterion adds cannot already exist in the methodology builder it will pass through), L-40 (today's code has no distinct-state label at all; the word only describes an effect callers currently infer), L-48 (the field is a hypothetical probe shape, not a name the generic encoder or the version pin carries), L-49 (the new outcome value cannot exist yet in an end-to-end file this change has not touched).
- **v3** (2026-09-18) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 2/2/0).
  - **R1-1 — Accepted (MUST_FIX).** Requirement 1 AC 10's bare line-only citation, left pointing at the wrong file after the v2 lint pass inserted a full path ahead of it, is re-anchored to the byte-cap constant's own file and line.
  - **R1-2 — Accepted (MUST_FIX).** Requirement 1 AC 4 now scopes "the reviewing workspace only" to the base entry alone and states the attribution field is read regardless of workspace; Requirement 3 AC 3 now states the storage schema in prose — one record per task, base keyed by workspace, attribution shared — so Requirement 3 AC 6 and Requirement 7 AC 3's cross-workspace mismatch read no longer conflicts with Requirement 1's per-workspace base scoping.
  - **R1-3 — Accepted (SHOULD_FIX).** The Migration section now states the shared diff helper gains an error-cause field, read by Requirement 1 AC 10's classification, so the git-failure cause it names is no longer discarded.
  - **R1-4 — Accepted (SHOULD_FIX).** Requirement 1 AC 6 now names the provenance value for the validated-base diff, and Requirement 4 AC 5 now renders that value as a fact alongside the no-record case, closing the previously undefined success-case provenance.
  - **Lint carry-over.** 1 fixed (L-2, via R1-1); rest left: new-behavior identifiers.
