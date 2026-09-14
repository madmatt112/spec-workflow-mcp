# Requirements Document

## Introduction

Follow-on to `fast-reviews`, applying the same lever (shift work from the LLM to deterministic code) to three review-task surfaces:

1. **Whole-file reading** — `handlePrepare` returns absolute paths to modified files and tells the reviewer to read them. For a task that touches a 500-line file with 30 changed lines, the reviewer pays input tokens for 470 lines that didn't change. A `git diff` against the last commit captures the changed lines plus surrounding context, so the reviewer focuses on what's actually under review.
2. **Type-error hunting** — the current methodology asks the reviewer to look for "wrong patterns, deprecated approaches, missing error handling." Real type errors (return-type mismatches, missing properties, never-callable functions) are deterministic and `tsc --noEmit` finds them in seconds. Pre-running tsc and surfacing diagnostics tagged with in-scope/out-of-scope membership lets the reviewer triage flagged lines instead of hunting for them — same model as `fast-reviews` task 7's hygiene signals.
3. **Single-knob model selection across both runners** — `.spec-workflow/adversarial-settings.json`'s `model` field governs *both* adversarial-review and task-review subagents. A user who wants Opus-level scrutiny for adversarial review (rare, high-stakes) but Sonnet- or Haiku-level for routine task reviews (frequent, lower-stakes) cannot express that today. With the deterministic pre-computation in tracks A and B reducing the LLM's effective workload, choosing a cheaper model where the workload is smaller is a directly-compounding win.

### Track sequencing (intent, not mandate)

The three tracks share `multi-server.ts` (where `handlePrepare` is wired and where settings are read) and `buildReviewMethodology`. Recommended sequence:

1. **Track A — typecheck (R2)** lands first. Wires a `Promise.all` shell into `handlePrepare`. Adds typecheck utility, methodology directives, response fields. Pins composite methodology output (see R4).
2. **Track B — diff (R1)** lands second. Slots into the existing `Promise.all` seam. Adds diff utility, re-orders the methodology to put diff first, re-pins the composite methodology output.
3. **Track C — per-runner model selection (R3)** lands third. Touches `multi-server.ts` settings-read paths and runner option types only.

The composite-pin tests (R4.10) are the actual safety net — they fail if a track lands out of order in a way that produces an inconsistent methodology. Sequencing is therefore enforced by tests, not process. **Emergency-fix carve-out**: changes that don't touch `buildReviewMethodology` and don't extend the prepare response shape may land between tracks without re-pinning the composite. **Track-A blocked beyond a week**: Track B may re-pin the composite directly, skipping the interim Track-A-only pin — call this out in the PR description so the reviewer doesn't expect both pin updates.

### Coverage constraints (read first)

This spec accepts the following constraints up front rather than chasing them in requirements:

- **Diff coverage assumes "review before commit."** `git diff HEAD --` only captures uncommitted changes. **Known limitation**: when an agent partially commits a task (e.g. commits file A and updates the implementation log, leaving B and C uncommitted), the diff covers only B and C — A's contributions are silently absent from `data.diff`. We do **not** ship a "diff possibly stale" heuristic in v1: the timestamp-based heuristic considered in earlier drafts is structurally wrong-direction for the agent flow this codebase emits (log-after-commit produces `log_time > commit_time`, so the heuristic never fires in the very case it was meant to catch). A correct content-based check (compare `git log <stored-sha>..HEAD -- <allFiles>` to detect committed-since-log) requires stamping a commit SHA in the implementation log when `log-implementation` runs — a schema change that is out of scope for this spec. The right fix is a follow-up "implementation-log validation" spec; until then, users should review before committing to keep the diff authoritative.
- **Typecheck coverage is single-config-at-root only in v1.** If the project has a `tsconfig.json` with `"references"`, no `tsconfig.json` at the project root, or uses non-default config names, typecheck is treated as unavailable for that config. The v1 response shape (`typecheckResults: TypecheckResult[]`, R2.2) is forward-compatible with future multi-config support — the v1 array is always length 1.
- **Coverage anchor is `allFiles` from the implementation log.** Three computations (hygiene, diff pathspec, typecheck `inScope` tag) all derive from this list. Cross-checking against working-tree state (`git status`-style) is explicitly out of scope — addressed by the same future "implementation-log validation" spec referenced above.

### Configuration shape

`.spec-workflow/adversarial-settings.json` grows from a flat object to a **grouped per-runner** shape that is forward-compatible with future per-runner overrides (e.g. `cliArgs`, `cli`):

```json
{
  "adversarial": { "model": "claude-opus-4-7" },
  "taskReview":  { "model": "claude-haiku-4-5" },
  "features":    { "typecheck": true },
  "model":       "claude-sonnet-4-6",     // legacy fallback (preserved)
  "cli":         "claude",                 // global, unchanged
  "cliArgs":     ["--print", "..."]        // global, unchanged
}
```

Why grouped (`adversarial: { model }`) instead of flat (`models: { adversarial: ... }`): when a future spec adds per-runner `cliArgs`, the grouped shape extends naturally (`adversarial: { model, cliArgs }`); the flat shape would require a parallel `cliArgs: { ... }` sibling that fragments the file by setting type instead of by runner. R3 picks the forward-compatible shape now to avoid a config migration later.

**Forward-compat for future per-runner `cli`**: when added, per-runner `cli` will resolve through the same precedence ladder as `model`: per-runner override > legacy global > undefined (CLI default). One ladder, applied per setting; the same edge-case rules in R3.5 apply.

## Alignment with Product Vision

`spec-workflow-mcp` aims to make agent-assisted spec workflows tighter. The review loop is the per-task gate. Cutting input-token waste (track B) and pre-computing a class of findings the LLM was being asked to hunt for (track A) compound directly with `fast-reviews` to shorten that loop without giving up review quality. Per-runner model selection (track C) lets users tune cost/quality independently for the high-stakes adversarial path and the high-frequency task-review path.

## Requirements

### Requirement 1 — `review-task prepare` returns a diff-first context

**User Story:** As a user running `review-task action: prepare`, I want the response to include a `git diff` of the task's working-tree changes against the last commit, so that the reviewing agent reads only the changed hunks plus surrounding context instead of every full file.

#### Acceptance Criteria

1. WHEN `handlePrepare` succeeds AND the working tree contains uncommitted changes to any path in `allFiles` (the canonicalized `filesModified ∪ filesCreated` from the implementation log) THEN the response `data` SHALL include a `diff` field containing the unified-diff output of `git diff -U10 -M HEAD --` invoked with `cwd: projectPath` and the in-scope absolute paths as pathspec. The `-M` flag enables similarity-based rename detection when both old and new paths are in pathspec.
2. WHEN `data.diff` is non-empty THEN the methodology SHALL emit the **diff-present directive** verbatim (R4.1). The directive tells the reviewer to read `data.diff` first and use `filesToReview` for surrounding context only when (a) hunks span more than half the file (denominator: `(addedLines + removedLines) / max(preEditLines, postEditLines)`), (b) surrounding invariants are needed that the hunks don't show, or (c) `data.skippedPaths` lists a relevant file. **"Rename" is intentionally NOT a trigger** — explicit pathspec defeats reliable rename detection in git, so the reviewer cannot trust the absence of `R` markers as evidence that no renames occurred.
3. WHEN `data.diff` is an empty string (no working-tree changes match the path filter) THEN `data.diff` SHALL be `""` AND the methodology SHALL emit the **diff-empty fallback directive** verbatim (R4.2). The directive prose tells the reviewer the diff was empty and instructs them to read full files; it does NOT embed shell commands.
4. IF the project root is not a git repository, `git` is not on PATH, OR `git diff` exits non-zero THEN `data.diff` SHALL be `""`, `data.diffStats` SHALL be omitted, AND `handlePrepare` SHALL still succeed (no failure propagation). The methodology SHALL emit the **diff-empty fallback directive** in this case as well.
5. WHEN the diff is computed THEN paths SHALL be filtered through a **denylist** before being passed as pathspec. The denylist is defined as:
   - **Exact basenames** (case-insensitive on case-insensitive volumes): `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Gemfile.lock`, `Pipfile.lock`, `Cargo.lock`, `composer.lock`, `mix.lock`, `poetry.lock`, `go.sum`, `.env`, `.npmrc`, `.netrc`, `.pypirc`
   - **Basename suffixes** (case-insensitive): `*.lock`, `*.snap`, `*.min.js`, `*.min.css`, `*.map`, `*.pem`, `*.key`
   - **Basename prefixes** (case-insensitive): `id_rsa`, `id_ed25519`, `id_ecdsa`, `id_dsa`
   - **Path-segment match** (any directory in the path equals one of these, case-insensitive): `secrets`, `credentials`, `.aws`, `.kube`, `.docker`
   - **Binary**: any path git reports as binary in the diff output (the `Binary files ... differ` marker is detected and the file's section is stripped)
   The denylist uses **exact-match + suffix/prefix + path-segment** semantics, NOT shell globs or git pathspec wildcards — this guarantees identical match behavior at both call sites (diff utility and `computeHygieneSignals`). The same denylist applies to `computeHygieneSignals` (additive change to the existing utility — closes a known gap).
6. **Test-fixture exception (R1.5):** paths whose components include any of `__tests__`, `__fixtures__`, `fixtures`, `test-data`, `testdata` (case-insensitive path-segment match) are exempt from the denylist. Without this exception, a PR modifying `path-denylist.ts` itself would silently exclude the new fixtures it adds, hiding the change being reviewed. Reviewers can opt files back into the denylist by placing them outside fixtures/tests directories.
7. WHEN any path is denylisted THEN the response SHALL include `data.skippedPaths: string[]` listing the absolute paths that were excluded from the diff. Empty array if nothing was skipped.
8. WHEN `data.diff` is non-empty THEN the response SHALL include `data.diffStats: { filesChanged: number; linesAdded: number; linesRemoved: number }` computed from `git diff --numstat HEAD --` invoked with the same denylisted pathspec. The numstat output is the canonical source for stats; the unified-diff body is not parsed for counts.
9. WHEN any single file's diff hunks exceed 500 added+removed lines (counted from `git diff --numstat`) THEN the offending file's hunks SHALL be replaced by a single line `<diff truncated: <file> per-file cap exceeded>` AND `data.diffTruncated: true` SHALL be set. WHEN, after per-file truncation, the total diff still exceeds 50,000 bytes THEN remaining files SHALL be truncated in pathspec order with the message `<diff truncated: <file> total budget exhausted, file truncated despite size>` AND `data.diffTruncated: true` SHALL be set. The two messages let the reviewer distinguish "this file's own changes were too large" from "this file lost the byte-budget race." The methodology directive notes truncation occurred.
10. WHEN `data.diff` is non-empty AND `filesToReview` is also returned THEN the existing `filesToReview` field SHALL remain unchanged in shape — additive at the data-shape level.
11. WHEN `data.diff` is computed THEN both `git diff` and `git diff --numstat` SHALL run with `cwd: projectPath`, with `env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }` to avoid blocking on index lock contention.

(R1 has no diff-staleness signal in v1 — see Coverage constraints. The partial-commit case is a documented known limitation.)

### Requirement 2 — `review-task prepare` returns pre-computed typecheck diagnostics

**User Story:** As a user running `review-task action: prepare` on a TypeScript project, I want `tsc --noEmit` diagnostics surfaced in the response with in-scope tagging and explicit coverage reporting, so that the reviewing agent triages flagged type errors with upstream context preserved instead of hunting for them line-by-line, and never confuses "tsc found nothing" with "tsc never checked this file."

#### Acceptance Criteria

1. WHEN `handlePrepare` runs AND `features.typecheck` is not explicitly `false` in `adversarial-settings.json` (i.e. enabled by default or explicitly `true`) AND the project root contains a `tsconfig.json` AND that tsconfig does NOT have a top-level `"references"` field AND it does NOT have `"files": []` with no `"include"` THEN the handler SHALL invoke `tsc --noEmit -p <projectPath> --incremental --tsBuildInfoFile <projectPath>/.spec-workflow/.cache/tsc.tsbuildinfo --listFiles --pretty false` and capture diagnostics. The dedicated `--tsBuildInfoFile` path isolates the review cache from any project-level `.tsbuildinfo`. `--listFiles` emits the program file set used to derive `coverage` (R2.5).
2. WHEN typecheck is invoked THEN the response `data` SHALL include `typecheckResults: TypecheckResult[]`, where `TypecheckResult` is a discriminated union over `status`:
   ```ts
   type TypecheckResult =
     | { tsconfigPath: string; status: 'success'; diagnostics: TypecheckDiagnostic[]; coverage: { compiled: string[]; excluded: string[] }; truncated?: boolean }
     | { tsconfigPath: string; status: 'unavailable'; reason: 'no-tsconfig' | 'project-references' | 'wrapper-config' | 'tsc-not-found' | 'no-parseable-output' | 'feature-disabled' }
     | { tsconfigPath: string; status: 'timeout' };
   ```
   In v1, `typecheckResults.length` is always 1. The array shape is forward-compatible with future multi-config monorepo support without a schema break.
3. WHEN `status === 'success'` THEN `diagnostics` SHALL contain ALL diagnostics tsc emitted (not filtered to in-scope). Each entry SHALL have shape `{ file: string (absolute path), line: number (1-indexed), column: number (1-indexed), code: string (e.g. "TS2322"), message: string, inScope: boolean }`. (`inScope` is `true` when `file` is in `allFiles`, `false` otherwise.) The `severity` field is omitted — `tsc --noEmit` only emits errors.
4. **Path normalization for set operations (R2.4):** WHEN computing `coverage.compiled = allFiles ∩ listFilesOutput` and `coverage.excluded = allFiles \ listFilesOutput` THEN both sides of the intersection/difference SHALL be normalized via `fs.realpathSync.native` to resolve symlinks AND case-folded to lowercase on case-insensitive volumes (detected via `process.platform === 'darwin' || process.platform === 'win32'`, OR by reading the platform's reported case sensitivity if a more reliable signal is available). The reported `coverage.compiled` and `coverage.excluded` arrays themselves use the **original `allFiles` paths** (not the normalized form) so the reviewer sees paths matching what the agent recorded. A test fixture covering pnpm-style symlinked workspace paths SHALL pin this normalization.
5. WHEN `status === 'success'` AND `coverage.excluded` is non-empty THEN `buildReviewMethodology` SHALL emit the **typecheck-partial-coverage directive** verbatim (R4.5) IN ADDITION to the typecheck-present directive. The reviewer is told which files were not type-checked and that a "no diagnostics" signal cannot be trusted for those files.
6. WHEN `status === 'success'` AND `diagnostics.length > 0` THEN `buildReviewMethodology` SHALL emit the **typecheck-present directive** verbatim (R4.4). The directive focuses on `inScope: true` entries, treats `inScope: false` as upstream context, promotes real bugs to findings with `category: 'hygiene'`, and asks for type-system smells tsc cannot catch.
7. WHEN `status === 'success'` AND `diagnostics.length === 0` AND `coverage.excluded.length === 0` THEN `buildReviewMethodology` SHALL emit no typecheck-specific directive (clean signal, full coverage).
8. IF the conditions in R2.1 are not met (no root tsconfig, references present, files-empty wrapper, `tsc` not resolvable from `node_modules/.bin`, OR `features.typecheck: false`) THEN `typecheckResults` SHALL contain exactly one entry with `status: 'unavailable'` and the appropriate `reason`. The methodology SHALL emit the **typecheck-unavailable directive** verbatim (R4.6).
9. WHEN `tsc` exits non-zero AND zero diagnostics parse from its output THEN `typecheckResults[0]` SHALL be `{ status: 'unavailable', reason: 'no-parseable-output' }`. WHEN `tsc` exits zero AND `--listFiles` produces zero parseable lines (output buffer empty / corrupted) THEN `typecheckResults[0]` SHALL also be `{ status: 'unavailable', reason: 'no-parseable-output' }`, NOT `{ status: 'success', coverage: { compiled: [], excluded: allFiles } }`. The methodology SHALL emit the **typecheck-unavailable directive** in both cases. This prevents the regression where every in-scope file is reported as excluded due to an output-capture bug.
10. WHEN `tsc` exits non-zero AND at least one diagnostic parses THEN `typecheckResults[0].status === 'success'` AND the diagnostics are returned (parallel to R2.6).
11. WHEN the typecheck process exceeds 30 seconds THEN it SHALL be terminated AND `typecheckResults[0]` SHALL be `{ status: 'timeout', tsconfigPath }`. The methodology SHALL emit the **typecheck-timed-out directive** verbatim (R4.7). The process SHALL be killed via SIGTERM, with a 2-second grace period before SIGKILL escalation. **POSIX-primary**: on Windows, `process.kill('SIGTERM')` is `TerminateProcess`-immediate, so the 2-second grace is a no-op there; deeper Windows process-termination handling is deferred to v2 per Out of Scope.
12. WHEN both `data.diff` (from R1) and the typecheck pass are computed THEN they SHALL be invoked concurrently via `Promise.all` so wall-clock prepare latency = max(diff, typecheck), not sum. The Promise.all shell SHALL be in place from Track A's PR (typecheck-only initially), so Track B's PR is purely additive at the concurrency seam.
13. WHEN `diagnostics.length` would exceed 100 entries THEN the array SHALL be capped at 100 (in-scope first, then out-of-scope) AND `truncated: true` SHALL be set on that result. The methodology directive notes truncation.
14. WHEN `tsc` is invoked THEN `env` SHALL be `{ ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }` to prevent ANSI escape codes from corrupting diagnostic parsing.

### Requirement 3 — Per-runner model selection in `adversarial-settings.json` (grouped shape)

**User Story:** As a user configuring spec-workflow's review subagents, I want to specify different models for adversarial review and task review independently using a shape that scales to future per-runner overrides, so that I can tune cost/quality per runner without a config migration when the per-runner surface grows.

#### Acceptance Criteria

1. WHEN `.spec-workflow/adversarial-settings.json` contains a top-level `adversarial` object with a `model` string field THEN the dashboard SHALL pass `adversarial.model` to `AdversarialRunner.run({ model })`. Same for `taskReview.model` → `TaskReviewRunner.run({ model })`.
2. WHEN `adversarial.model` is absent (or `adversarial` itself is absent) AND the legacy top-level `model` field is present THEN `AdversarialRunner.run` SHALL receive the legacy `model` value. Same fallback for `taskReview.model`.
3. WHEN neither `adversarial.model` (or `taskReview.model` for the task-review case) NOR the legacy `model` field is set for a given runner THEN that runner SHALL receive `model: undefined` (no `--model` flag passed; CLI default applies).
4. WHEN `adversarial.model` and the legacy `model` field are both set THEN `adversarial.model` SHALL take precedence (specific overrides general). Same for `taskReview.model`.
5. **Edge cases at type boundaries:**
   - WHEN `adversarial.model === ""` (empty string) THEN it SHALL be treated as "explicitly cleared" and the runner falls back to legacy `model` (or `undefined` if legacy absent). Same for `taskReview.model`. Empty string is the user's explicit way to disable the per-runner override.
   - WHEN `adversarial === null` OR `taskReview === null` THEN the null is treated as absent (R3.2 fallback applies).
   - WHEN `adversarial` or `taskReview` is present but not an object (e.g. a bare string at the wrong level) THEN it is ignored as if absent AND a malformed-load warning is logged (R3.7).
   - WHEN `adversarial.model` or `taskReview.model` is present but not a string (e.g. `42`, `true`, `["claude-opus-4-7"]`) THEN it SHALL be ignored as if absent AND a malformed-load warning is logged (R3.7), symmetric with the non-object runner-block rule above. Silent acceptance of non-string `model` would otherwise mask user errors with no recovery signal.
   - WHEN unknown keys appear under `adversarial` or `taskReview` (e.g. `cliArgs`, `unsupportedKey`) THEN they SHALL be silently ignored. This is the forward-compatibility path: future per-runner additions don't crash older servers.
6. WHEN the JSON is malformed at the top level OR the legacy `model` field is present but not a string THEN the offending field SHALL be ignored as if absent AND a malformed-load warning logged (R3.7). The legacy field's existing tolerance behavior is preserved.
7. **Settings-read timing and warning semantics:**
   - The settings file SHALL be read on every runner construction (per-request). Reading is fast (small file, parsed JSON).
   - The parsed result SHALL be cached in-process keyed by `(file mtime, file size)` — both must match the stored entry to use the cache. The size check covers second-resolution mtime filesystems (NFS, SMB, WSL2 mounts of Windows volumes) where same-second edits would otherwise hit a stale cache. If size differs at identical mtime, the cache evicts and re-parses.
   - **Read-throw containment**: the `loadSettings` helper SHALL wrap `statSync`/`readFileSync` in `try/catch` covering at minimum `EBUSY`, `EACCES`, `EISDIR`, `ELOOP`, and any other I/O error. `ENOENT` (file absent) returns `{}` silently (fresh-project case). All other I/O errors return `{}` AND emit a malformed-load warning (R3.7). JSON-parse failures likewise return `{}` AND emit a malformed-load warning. **No I/O throw escapes `loadSettings`** — the synchronous prelude in `handlePrepare` cannot reject from this path.
   - Malformed-load warnings SHALL be emitted **once per process lifetime per file path** with a pinned format: `[spec-workflow] adversarial-settings.json: <reason> (path: <absPath>); falling back to defaults. <one-line parser/IO error message>`. The trailing parser/IO message lets users with BOM, trailing-comma, or permission-denied issues recognize the cause without reading source code. An in-process flag SHALL be set after the first warning to suppress duplicates. The flag is cleared if and only if the `(mtime, size)` tuple changes.
   - **Cross-process behavior:** caches are per-process. Users running multiple MCP server instances may see divergent runs until each process re-reads after a file edit. Documented limitation; not addressed in v1.
8. WHEN both legacy `model` and the new grouped shape are read from the same file THEN both shapes SHALL be accepted indefinitely. R3.4 precedence resolves conflicts. No automated migration; documentation surfaces the grouped shape as preferred.
9. WHEN the initial-review handler invokes a runner THEN the resolved model from `resolveRunnerModel(settings, runner)` SHALL be **stored on the runner job object**: the `AdversarialJob` and `TaskReviewJob` interfaces gain a `model?: string` field, populated from `RunOptions.model` during job construction inside the runner. WHEN the retry-review handler runs THEN it SHALL look up the prior job (via the runner's existing `getJobsForProject` / per-job lookup) and pass `job.model` to the new runner invocation without calling `resolveRunnerModel`. **Retry intentionally uses the same model as the original attempt** to keep per-review telemetry/billing consistent; per-retry model overrides are explicitly out of scope. **Server-restart fallback:** WHEN the prior job is not found in the runner's in-memory job map (server restarted between initial and retry, OR the job is from a pre-spec deployment that never stored `model`) THEN the retry handler SHALL fall back to `resolveRunnerModel` against current settings, logging a warn-once `[spec-workflow] retry: prior job not found in runner, re-resolving model from settings`. The server-restart case is a documented degraded path; persisting job state across restarts is out of scope for v1 (see Out of Scope). (Annotation persistence was considered and rejected because (a) the task-review HTTP route has no approval surface to persist into — task-review state lives only on the runner — and (b) on the adversarial path, the existing post-`runner.run` `updateApproval` at `multi-server.ts:836` builds the annotation from scratch and would clobber any pre-stamp. Closure capture remains structurally impossible — initial and retry are independent Fastify route handlers with no shared closure scope.)
10. **Test pinning:** the precedence matrix in R3.1–R3.6 SHALL be pinned by tests covering at minimum: (a) grouped only, (b) legacy only, (c) both with grouped winning, (d) empty string falling back to legacy, (e) `null` treated as absent, (f) unknown sub-keys ignored, (g) malformed top-level tolerated, (h) **initial+retry job-storage round-trip** — initial run resolves model X via `resolveRunnerModel`, retry reads X from `job.model` (the prior job stored in the runner) without re-invoking `resolveRunnerModel`; spy assertion expects callCount === 1 across the (approval, runner) pair (use `equal`, not `lessThanOrEqual`); job-not-found retry (clear the runner's in-memory job map mid-test to simulate server restart) exercises the fallback path and emits the warn-once. Mirrors the methodology-directive pinning in R4.10.
11. **Documentation deliverable** (R3 ships with docs, not "punted to a future doc PR"):
    - The repository's README (or equivalent user-facing entry doc) SHALL include a `Reviewer Configuration` section showing the grouped shape with both runners and the legacy fallback.
    - The grouped shape SHALL be referenced in a comment header at the top of any example `adversarial-settings.json` shipped with the repo (test fixtures, docs).
    - These doc updates land in the same PR as R3's code changes.
12. **`features` block schema rules (R3.12):**
    - `features` is a top-level object whose keys are individual feature flags. v1 defines `features.typecheck: boolean` (R2.1, R2.8). The block is **forward-compatible**: unknown keys under `features` SHALL be silently ignored (parallel to R3.5's runner-block rule).
    - Edge cases mirror R3.5: `features === null` is treated as absent; `features` present but not an object is ignored with a malformed-load warning (R3.7); `features.typecheck === ""` (empty string) is ignored as absent (typecheck stays enabled by default).
    - WHEN `features.typecheck` is present but not a boolean (e.g. `0`, `1`, `"true"`, `"false"`, `null`) THEN it SHALL be treated as absent (typecheck stays enabled by default) AND a malformed-load warning SHALL be emitted naming the user-supplied value (R3.7), symmetric with the non-string `model` rule in R3.5. A user who wrote `0` thinking it disabled typecheck must get a recovery signal.
    - `features` is read through the same per-request settings cache (R3.7); malformed-warn semantics apply.

### Requirement 4 — Methodology directives (verbatim, composite-pinned)

`buildReviewMethodology` emits the directives below verbatim. Tests pin the **full composite output** of `buildReviewMethodology` for representative inputs, with axis-by-axis coverage (R4.10) — not the cross-product of all input combinations.

#### R4.1 — Diff-present directive (R1.2)

> **Read the diff first.** `data.diff` contains a unified diff (10 lines of context per hunk, rename-detected via `-M`) of the task's uncommitted changes vs. the last commit. Read it before opening any file from `filesToReview`. Open files from `filesToReview` only when (a) hunks span more than half the file — measured as `(addedLines + removedLines) / max(preEditLines, postEditLines)` — (b) you need surrounding invariants the hunks don't show, or (c) `data.skippedPaths` lists a file relevant to the task. If `data.diffTruncated` is true, read the full file for the truncated paths. Do NOT rely on the diff to surface renames — explicit pathspec defeats git's rename detection; suspect renames must be verified by reading both files.

R4.2 has **two prose variants** depending on whether the empty diff reflects a benign empty-state (no working-tree changes, not a git repo, etc.) or a diff-utility rejection. Telling a reviewer the diff is empty when in fact the utility crashed leaves them silently misled — they would attribute the empty result to one of three innocuous causes that are not the actual cause. Mirrors R4.6's split for typecheck.

#### R4.2a — Diff-empty fallback directive (`data.diffRejection` absent)

> **No diff available — read full files.** Either the task changes were already committed before review (inspect recent commits on the branch via `filesToReview` content compared against the implementation log's described changes), the implementation log is out of sync with the working tree, or this is not a git repository. Read every file in `filesToReview` and evaluate against the task's described changes from the implementation log.

#### R4.2b — Diff-utility-rejection directive (`data.diffRejection.message` is present)

> **Diff utility rejected unexpectedly — read full files.** `data.diffRejection.message` contains the rejection reason. The diff was NOT computed because the utility threw an unexpected exception; this is a degraded review surface, not a benign empty diff. Read every file in `filesToReview` and evaluate against the task's described changes from the implementation log. **Surface the rejection in your review summary** (quote `data.diffRejection.message`) so the human reviewer knows the diff path failed and can investigate the underlying cause.

**Data-shape commitment for R4.2b**: the prepare response SHALL include `data.diffRejection: { message: string } | undefined`, where the field is set (and `data.diffRejection.message` is a non-empty string) iff the diff utility threw an unexpected exception that was caught at the `Promise.allSettled` orchestration boundary, and is `undefined` (or omitted) otherwise. The same data-shape commitment applies to `data.hygieneRejection` (set iff hygiene-utility rejection caught at the same boundary). These fields are part of the requirement-level contract — refactoring that removes them must update R4.2b in the same change.

(R4.3 — Diff-stale directive — REMOVED in v4. The R1.11 timestamp heuristic was structurally wrong-direction for the typical agent flow; rather than ship a misleading signal, the partial-commit gap is documented as a known limitation under Coverage constraints.)

#### R4.4 — Typecheck-present directive (R2.6)

> **Triage the typecheck diagnostics.** `data.typecheckResults[0].diagnostics` lists `tsc --noEmit` errors. Focus on entries with `inScope: true` — these touch files this task modified or created. For each in-scope diagnostic: confirm whether it is (a) a real bug introduced by this task → promote to a finding with `category: 'hygiene'`, or (b) pre-existing → note in summary, do not file as a finding. Treat `inScope: false` entries as upstream context for in-scope diagnostics. Also check for type-system smells tsc can't catch: unsound `any`, type assertions hiding real mismatches, narrowed types that lose information. If `truncated: true`, the diagnostic list is incomplete (capped at 100 entries) — note this gap explicitly in your review summary so the human reviewer knows to check the omitted entries manually; do not assume the truncated entries are pre-existing or unrelated.

(Note: "spurious" was removed as a triage bucket in v4 — `tsc --noEmit`'s false-positive rate is low, and offering it as an option encourages dismissal of diagnostics the LLM doesn't understand. If a diagnostic is genuinely spurious, the reviewer notes it in the summary with the specific reason.)

#### R4.5 — Typecheck-partial-coverage directive (R2.5)

> **Partial typecheck coverage — degraded review surface.** `data.typecheckResults[0].coverage.excluded` lists files this task modified that tsc did NOT compile (excluded by tsconfig's `exclude` or never reached via `include`). For these files, the absence of diagnostics is meaningless — they were never checked. **You are operating in pre-spec methodology mode for the excluded files**; manually scan them for type errors and structural issues (missing return types, implicit `any`, mismatched property shapes, unsafe casts). The `compiled` list is the trustworthy coverage set. **Surface this per-file coverage gap in your review summary** so the human reviewer knows the scope of the gap.

##### Typecheck-unavailable directive variants (R2.8, R2.9)

R4.6 has **two prose variants** depending on whether typecheck is unavailable because the user explicitly opted out (`reason: 'feature-disabled'`) or because the system couldn't run it (any other unavailable reason). Telling a user who deliberately disabled typecheck to "manually scan TS files" contradicts their explicit preference and erodes trust in the methodology.

#### R4.6a — Typecheck-disabled-by-config directive (`reason: 'feature-disabled'`)

> **Typecheck pre-computation is disabled for this project.** `data.typecheckResults[0].reason` is `'feature-disabled'` — the project's `.spec-workflow/adversarial-settings.json` sets `features.typecheck: false`. Proceed with the review as you normally would; do not perform additional manual type-checking unless a finding specifically warrants it. If you observe what looks like a type-system bug while reviewing, flag it as a finding with `category: 'hygiene'` and let the human reviewer decide whether to re-enable typecheck pre-computation.

#### R4.6b — Typecheck-unavailable directive (any other unavailable reason)

> **Typecheck did not run for this review.** `data.typecheckResults[0].reason` says why (e.g. `'project-references'`, `'no-tsconfig'`, `'tsc-not-found'`, `'no-parseable-output'`, `'output-overflow'`, `'rejection'`). **This is a degraded review surface** — the type-error coverage promised by this MCP is unverified. You are operating in pre-spec methodology mode for type-checking; manually scan the modified TypeScript files for type errors and structural problems (missing return types, implicit `any`, mismatched property shapes, unsafe casts). Surface this degradation in your review summary so the human reviewer knows the scope of the gap.

#### R4.7 — Typecheck-timed-out directive (R2.11)

> **Typecheck timed out at 30 seconds.** The project is large enough that `tsc --noEmit` did not complete within the budget. Pre-computed diagnostics are NOT available for this review. **This is a degraded review surface** — type-error coverage is unverified. Operate in pre-spec methodology mode for type-checking; manually scan the modified TypeScript files. Surface this degradation in your review summary. If this timeout recurs, set `features.typecheck: false` in `.spec-workflow/adversarial-settings.json` to disable typecheck pre-computation; the review proceeds without it.

##### R4.8: Composition with existing item-9 hygiene directive

The existing item-9 hygiene directive from `fast-reviews` (`src/tools/__tests__/review-task.test.ts:100`) remains. The new directives compose with it as follows:

- **Diff directives (R4.1, R4.2) precede everything else** — they tell the reviewer what to read.
- **Typecheck directives (R4.4–R4.7) sit alongside hygiene as item 10** — both are "deterministic-pre-check, triage these signals" guidance.
- **Hygiene directive (item 9 from `fast-reviews`) keeps its position** — it scans line-by-line for leftover `console`/`TODO`/`FIXME`/`debugger`. The diff and typecheck additions do not relocate it.

##### R4.9: Track-A-only state (interim)

Between Track A landing and Track B landing, `buildReviewMethodology` emits typecheck directives but no diff directives. The composite-pin test expectation for this interim state is committed in Track A's PR; **Track B's PR replaces (deletes) those interim pins** when adding the full-composite pins. The interim composite is the correct output for the interim code state — but it is not preserved as a regression artifact past Track B's merge. (No known external consumer pins at the Track-A-only state; the interim is a test convenience, not a stable API.)

##### R4.10: Test pinning of composite output (axis-by-axis + cross-axis)

Tests SHALL pin `buildReviewMethodology(...)` full output (not directive substrings). Pinning is **axis-by-axis with selective cross-axis coverage**:

- **Typecheck axis** (typecheck state varies, diff state held fixed at "diff-present, non-stale, untruncated"): one pin per `typecheckResults[0]` shape — success+clean+full-coverage, success+diagnostics, success+partial-coverage, **success+diagnostics+partial-coverage** (pins R4.4 and R4.5 emitting together — added because both reference manual-scan guidance and their composition is not otherwise pinned), unavailable-feature-disabled (R4.6a), unavailable-other (R4.6b), timeout (R4.7). Seven pins on this axis.
- **Diff axis** (diff state varies, typecheck state held fixed at "success+clean+full-coverage"): one pin per significant `data.diff` shape — diff-empty (R4.2a), diff-present-untruncated (R4.1), diff-present-truncated (R4.1 with truncation), diff-rejected (R4.2b). Four pins on this axis.
- **Cross-axis** (selective combinations chosen to surface directive redundancy/contradiction at maximally- and partially-degraded states): six pins.
  1. `success-partial-coverage + diff-empty` — pins that R4.5's "manually scan excluded files" composes against R4.2a's "read every file in `filesToReview`" without contradiction.
  2. `timeout + diff-present-truncated` — pins that R4.7's "manually scan modified TS files" composes against R4.1's "read full file for truncated paths" without rhetorical collision.
  3. `unavailable-other + diff-present-truncated` — partially-degraded analogue of #2.
  4. `success-with-diagnostics + diff-empty` — pins that R4.4's "open the diagnostic file" composes against R4.2a's "read every file in `filesToReview`" without prioritization conflict.
  5. **`diff-rejected + typecheck-rejection` (NEW — maximally-degraded)** — pins R4.2b's "Surface the rejection in your review summary" composed with R4.6b's "Surface this degradation in your review summary." Two surfacing asks compose; the fixture is the spot where rhetorical contradiction or duplicated guidance would surface first. Without this pin, the four-state diff axis (R4.2b is one of the four) had no cross-axis coverage at the rejection state.
  6. **`success-partial-coverage + unavailable-other` (NEW — overlapping manual-scan asks)** — pins R4.5's "manually scan excluded files" composed with R4.6b's "manually scan the modified TypeScript files." The two sets overlap (excluded ⊆ modified) but are framed independently. The fixture authoring step exposes the rhetorical overlap and either motivates prose alignment or pins the deliberate redundancy.

This yields **17 composite-pin scenarios per track stage** (7 + 4 + 6), still well below the 7 × 4 = 28 cross-product. Each fixture file's docstring records which redundancy concern it pins.

**Composite-pin normalization:** each pin asserts equality of the `buildReviewMethodology(...)` return value against a hand-authored fixture string after: line-by-line `.trimEnd()`, unified `\n` line endings, NFC Unicode normalization, em-dash → hyphen, smart quotes → straight quotes, **and whitespace-run collapse to a single space** (handles line-wrap and reflow without softening detection of new sentences). The normalization is applied to **both** sides of the comparison so editor-introduced punctuation drift and Windows checkouts with `core.autocrlf=true` don't cause false failures. Fixtures are stored in `src/tools/__tests__/__fixtures__/methodology/*.txt`.

**Authority direction (REVERSED from earlier draft):** the verbatim directive text in R4.1, R4.2a, R4.2b, R4.4, R4.5, R4.6a, R4.6b, R4.7 is **authoritative**. Fixtures are derived implementation artifacts. If R4 prose and a fixture disagree, **R4 is right** — update the fixture to match.

**Two-way drift test (replaces v2's substring-only one-way test):**
1. Extract R4.x verbatim blocks from `requirements.md`. The extractor matches both `> ...` block-quote and ` ```...``` ` fenced-block delimiters; adjacent quoted/fenced lines join into one block per directive.
2. Extract directive blocks from each fixture file (delimited by paragraph breaks between the `**Read first:**`, item-9 hygiene, and item-10 typecheck markers).
3. Apply NFC + dash + quote + whitespace-collapse normalization to both sides.
4. **Direction A (R4 → fixtures)**: each R4.x block must appear, normalized, as a contiguous substring in at least one fixture.
5. **Direction B (fixtures → R4)**: every directive sentence in any fixture must appear, normalized, as a contiguous substring of some R4.x block. Detects fixture-only prose growth.
6. **Expected-name-set guard** (replaces v3's count guard): the test encodes `EXPECTED_R4_BLOCK_NAMES = ['R4.1', 'R4.2a', 'R4.2b', 'R4.4', 'R4.5', 'R4.6a', 'R4.6b', 'R4.7']`. The extractor keys each block by its R4.x name (parsed from the preceding heading, e.g. `#### R4.1 — ...`); the test asserts `Array.from(extractedBlocks.keys()).sort()` equals `EXPECTED_R4_BLOCK_NAMES.sort()`. **Failure pinpoints the missing or extra block by name**, not just a count delta. Closes the silent-loss path where a future R4.x written as a numbered list (`1. **Read X first.** ...`) bypasses the `> ` and ``` ``` ``` delimiters — the missing name appears in the failure message, forcing a deliberate decision rather than a count tweak. Boundary detection runs BEFORE whitespace-collapse: the extractor splits on `\n\n` first to identify directive boundaries, then normalizes each block's interior. Updating R4 (adding/removing directives) requires updating `EXPECTED_R4_BLOCK_NAMES` in lockstep.

**Track-A interim sentinel test:** the marker `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` in Track-A interim fixture files SHALL be matched by a regression test asserting **no fixture file contains the marker** after Track B is merged. The marker is deliberately distinctive (project-namespaced + track + role) so no legitimate fixture content collides — the original generic `# INTERIM:` form risked collision with fixtures testing interim-state methodology examples. Track A's PR adds the marker; Track B's PR removes it as part of fixture replacement.

Each track's PR updates these pins as part of its own diff, and the PR cannot land if the pin update is missing or if either drift-test direction fails.

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility**: `computeTaskDiff(projectPath, files): Promise<{ diff, stats, skippedPaths, truncated }>` and `runProjectTypecheck(projectPath, allFiles, opts): Promise<TypecheckResult[]>` are pure async functions in `src/core/`. Both return the discriminated/structured shapes defined in R1/R2; neither throws to the caller.
- **Process spawning isolated**: `git` and `tsc` invocations live inside their respective utilities. `handlePrepare` does not spawn child processes directly.
- **No new runtime dependencies**: implementation uses `node:child_process` (`execFile` with timeout) and `fs/promises`. `tsc` is invoked via the project's own `node_modules/.bin/tsc`, never imported as a library.
- **Additive data shape**: new optional fields `diff`, `diffStats`, `skippedPaths`, `diffTruncated`, `typecheckResults`. Existing fields retain their current shape and presence.
- **MCP response schema is permissive** (`additionalProperties` allowed). New optional fields ship without a version bump. No known external consumer enforces strict shape; if one emerges, the migration concern is theirs.
- **Denylist co-located**: `src/core/path-denylist.ts` (new) holds the lock/secret/binary patterns. Match logic uses **exact basename + suffix/prefix + path-segment** semantics (not globs). `computeTaskDiff` and `computeHygieneSignals` both consume it; the test-fixture exception (R1.6) lives in the same module.
- **Settings helper**: `resolveRunnerModel(settings, runner: 'adversarial' | 'taskReview'): string | undefined` encapsulates R3.1–R3.6. Called from every `multi-server.ts` callsite that constructs runner options. Single source of truth for precedence. **Acknowledged technical debt**: when a future spec adds per-runner `cliArgs` or `cli`, the helper either grows to `resolveRunnerSetting(settings, runner, key)` or splits into a per-setting helper. The cost is bounded and accepted; we are not pre-designing for the unwritten spec.
- **Settings cache**: parsed-result cache keyed by `(file path, mtime, size)`, in-process only, not persisted (R3.7). One cache entry per file path.

### Performance (qualitative — no enforced thresholds in v1)

This spec deliberately ships no quantitative performance gates. Wall-clock thresholds were considered across earlier rounds and rejected because no CI surface enforces them; documenting numbers without enforcement was eroding trust in the spec's other commitments. The qualitative shape:

- **Diff utility**: a single `git diff -U10 -M HEAD --` invocation plus a single `git diff --numstat HEAD --` invocation, each with the denylist-filtered pathspec. No work scales beyond the size of the kept diff.
- **Typecheck utility**: bounded by the 30-second hard timeout in R2.11 (SIGTERM → SIGKILL escalation). Incremental runs are cheap when `.spec-workflow/.cache/tsc.tsbuildinfo` is populated; cold runs and large projects rely on the timeout as the kill switch, not a soft target.
- **Cache isolation**: dedicated `--tsBuildInfoFile` (R2.1) prevents review-driven tsc runs from invalidating the project's own build cache.
- **Settings read**: in-process `(absPath, mtime, size)` cache (R3.7); cold reads parse JSON once and stay cached until the file changes. The cache keeps repeated reads from re-parsing on every runner construction.
- **Concurrent execution**: `Promise.allSettled` over diff/typecheck/hygiene (R2.12) bounds wall-clock prepare overhead by `max(...)` of the three, not the sum.

If a future change makes one of these utilities user-visibly slow, the right response is to file a perf-targeted spec at that point with a measurable gate, not to re-litigate placeholder thresholds here.

### Reliability

- All external-process failures (git missing, tsc missing, non-zero exits, timeouts, parse failures) degrade to documented "feature absent / unavailable" states with explicit reason codes, not failures.
- The diff and typecheck utilities never throw out of `handlePrepare`. Errors are caught at the utility boundary and converted to absent-with-reason fields.
- Process termination on timeout uses SIGTERM → 2-second grace → SIGKILL escalation.
- Git invocations set `GIT_OPTIONAL_LOCKS=0` so a concurrent `git status` from an editor doesn't block prepare.
- **Kill switch**: setting `features.typecheck: false` in `adversarial-settings.json` short-circuits the typecheck path entirely (R2.8 with reason `'feature-disabled'`). Diff path is fast enough (sub-200ms) that no analogous switch is required. R3 is purely additive at runtime, no switch.
- **`--listFiles` parse failure on clean exit** (R2.9): zero parseable lines from `--listFiles` does NOT degrade to "everything excluded" — it surfaces as `'no-parseable-output'`, preventing a silent reversion to the LLM-hunting workload.

### Usability

- The methodology directives (§R4) are the exact reviewer instructions. They are pinned by composite tests so changes are deliberate.
- When typecheck is unavailable, timed out, OR has partial coverage, the reason/coverage is surfaced both as a structured field AND as an explicit methodology directive that names the degradation. The reviewer is told they are operating in a degraded surface — silent under-coverage is not possible.
- Diff output uses unified-diff format with `-U10` context.
- Denylisted paths surface in `data.skippedPaths` so the reviewer is aware of redactions.
- Test-fixture exception (R1.6) lets PRs that modify the denylist itself review through the diff path.

### Security

- Secret-bearing paths (env files, ssh keys, cloud credentials, package-manager auth tokens, kube/docker configs) are denylisted (R1.5) for both diff and hygiene. The denylist is shared so the same files are skipped end-to-end.
- Binary files (per git's detection) never appear in the diff body.

## Out of Scope (v1)

- **Multi-config typecheck (project references, monorepo workspaces).** The v1 response shape (`typecheckResults: TypecheckResult[]`) is forward-compatible — multi-config support is additive.
- **Per-diagnostic `git blame` for `introducedByThisTask` tagging.** LLM triage handles introduced-vs-pre-existing in v1.
- **Submodule/symlink diff handling.** Behavior is whatever git defaults to.
- **Windows-specific process termination edge cases.** SIGTERM → SIGKILL escalation is the contract; deeper Windows hardening is a v2 concern.
- **Global feature flag / shadow-mode rollout.** Only typecheck has a per-feature kill switch (`features.typecheck: false`); the rest of the spec ships on by default.
- **Deprecation of the legacy top-level `model` field.** The grouped shape is preferred; legacy stays valid indefinitely.
- **Renaming `adversarial-settings.json`** to reflect its broader scope. Documentation closes the discoverability gap; rename is config-migration cost we don't pay here.
- **Per-runner `cli` / `cliArgs` overrides.** Only `model` is split per runner. The grouped shape is forward-compatible, so the future spec can add these without a breaking change.
- **Per-retry model overrides.** Retry intentionally uses the same model as the original attempt for telemetry/billing consistency. A future spec can add a `retryModel` knob if needed.
- **`git status` orthogonal coverage check.** Cross-checking the implementation log against the working tree is a separate "implementation-log validation" concern. The spec accepts the `allFiles` list at face value.
- **Diff-staleness detection (partial-commit gap).** R1.11 (a timestamp heuristic) was considered and removed in v4 because it is structurally wrong-direction for the typical agent flow. A correct content-based check requires stamping a commit SHA in the implementation log when `log-implementation` runs — a schema change deferred to a future "implementation-log validation" spec. Until then, the partial-commit case is a documented known limitation.
- **`diff: string` reshaping for future multi-config support.** `typecheckResults` is array-shaped now; `diff` stays a single string. If multi-config diff support eventually lands, `diff` will need a schema change at that point — accepted cost.
- **Effective-config diagnostic tool** (e.g. `mcp tool: spec-workflow:effective-config` that prints the resolved per-runner config). Useful but additional surface; deferred to a follow-up if user demand emerges.
- **Build-time consistency check between this spec's R4 prose and the test-fixture files.** Manual sync between spec and fixtures is accepted; the fixtures are authoritative when they drift.
- **CI/CODEOWNERS enforcement of track sequencing.** The composite-pin tests are the safety net; for a small-team codebase, formal CI enforcement is over-engineering.
- **Persisting runner job state across server restarts.** The runner's in-memory `Map<jobId, Job>` is rebuilt from empty on each server boot. A retry that crosses a restart boundary lands in the server-restart fallback path (R3.9) — re-resolve from current settings, warn-once. A sidecar JSON file or other durable store would close this gap but is rejected for v1 because (a) the warn-once cost is bounded, (b) reviews complete in minutes so the cross-restart retry case is rare, and (c) introducing a second persistence layer interacts with concurrent-prepare and approval-store ordering in ways that require their own design pass.
