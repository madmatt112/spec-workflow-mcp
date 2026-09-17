# Codebase context — worktree-review-signals

## Tool context and response encoding
- src/types.ts:58-76 — `ToolContext`: `projectPath` (directory containing `.spec-workflow`) and required `workspacePath`, both translated paths.
- src/types.ts:162-212 — `ImplementationLogEntry`: no workspace or commit field.
- src/types.ts:288-296 — `toMCPResponse`: TOON-encodes the whole `ToolResponse` with `encode` from `@toon-format/toon`.
- package.json:72 — `@toon-format/toon` pinned `^0.8.0`; installed 0.8.0.
- src/core/path-utils.ts:208-210 — `PathUtils.getWorkflowRoot(projectPath)` returns `<projectPath>/.spec-workflow`, a different directory from `ToolContext.projectPath`.
- src/tools/root-selection.ts:202-221 — `selectRoots`: override becomes the workspace, workflow root derived; returns no flag saying an override was used.

## review-task prepare
- src/tools/review-task.ts:31-44 — `DiffMethodologyState` (present, present-truncated, empty, rejected) and `computeDiffMethodologyState`.
- src/tools/review-task.ts:46-74 — `TypecheckMethodologyState` and `computeTypecheckMethodologyState`; every non-`feature-disabled` unavailable reason maps to `unavailable-other`.
- src/tools/review-task.ts:80-102 — `unwrapTypecheck`: rejection arm reports `<workspace>/tsconfig.json` with reason `rejection`.
- src/tools/review-task.ts:135-151 — `unwrapDiff`: second producer of `TaskDiffResult.rejection`.
- src/tools/review-task.ts:257-288 — `reviewTaskHandler`: `selectRoots`, dispatch to prepare, record, gate.
- src/tools/review-task.ts:300-321 — `FileResolutionCounts` and `hasNoReviewableFiles`.
- src/tools/review-task.ts:345-346 — `NO_REVIEWABLE_FILES_DISCLOSURE`; last sentence names the two surviving read-every-file instructions.
- src/tools/review-task.ts:348-536 — `handlePrepare`: resolution at 440-457, settled typecheck/hygiene/diff at 467-477, methodology at 480-489, `data` literal at 494-511, `nextSteps` at 512-520, `projectContext` at 521-526.
- src/tools/review-task.ts:661-766 — `buildReviewMethodology`; unconditional "Read ALL files listed in filesToReview" header at 675; diff preamble at 682; typecheck directive at 740-743.
- src/tools/review-task.ts:771-781 — `R4_1_DIFF_PRESENT`, `R4_2A_DIFF_EMPTY` (774-775), `R4_2B_DIFF_REJECTED` (777-778), `DIFF_TRUNCATION_NOTE`.
- src/tools/review-task.ts:783-802 — `renderDiffPreamble`: `empty` renders R4_2A.
- src/tools/review-task.ts:806-819 — `R4_4` to `R4_7` constants; `R4_6B_TYPECHECK_UNAVAILABLE` at 815-816 lists six reasons.
- src/tools/review-task.ts:821-838 — `renderTypecheckDirective`: `unavailable-other` renders R4_6B without the reason value.
- src/tools/review-gate.ts:207-210 — gate range defaults to `baseRef ?? 'HEAD'`.

## Diff computation
- src/core/task-diff.ts:9-15 — `TaskDiffResult` with optional `rejection`.
- src/core/task-diff.ts:30-32 — `MAX_BUFFER` 16 MB, per-file cap 500 lines, total cap 50,000 bytes.
- src/core/task-diff.ts:50-62 — `runGit`: scrubbed env, resolves `ok: false` on any error including maxBuffer overflow.
- src/core/task-diff.ts:135-147 — `containmentRejectionMessage`: stated reviewer-facing text for a mis-partition.
- src/core/task-diff.ts:149-248 — `computeTaskDiff(workspacePath, allFiles)`: containment assert 168-177, empty-`kept` early return 179-181, `HEAD` literal in diff args 183-184, `!ok` arm returns empty diff with no rejection 191-193.
- src/core/task-diff.ts:345-422 — `computeRangeStats` for the gate; `rev-parse --verify` on the caller's ref at 361.
- src/core/__tests__/task-diff.test.ts — unit tests for `computeTaskDiff` and `computeRangeStats`.
- src/__tests__/parity-baseline.test.ts — characterization of single-checkout outputs; calls `computeTaskDiff`.

## Typecheck
- src/core/typecheck.ts:17-47 — `TypecheckResult` union; `unavailable` reasons at 32-40 (`wrapper-config` at 35, `rejection` at 40).
- src/core/typecheck.ts:49-57 — timeout 30 s, `MAX_BUFFER` 16 MB, `GITIGNORE_ENTRY`, diagnostic cap 100.
- src/core/typecheck.ts:117-122 — `workspaceCacheKey`: per-workspace hash for the tsbuildinfo name.
- src/core/typecheck.ts:124-238 — `runProjectTypecheck(workspacePath, workflowRoot, allFiles, opts)`: tsconfig 141-152, references/wrapper 154-160, binary 162-165, cache dir under workflow root 167-174, spawn 188, overflow 198-200, no-parseable-output 217-222; no dependency probe.
- src/core/typecheck.ts:409-423 — `resolveTscBinary`: workspace `node_modules/.bin` only.
- src/core/typecheck.ts:425-453 — `ensureGitignoreEntry(workflowRoot)`: appends to the workflow root's tracked `.gitignore`.
- src/core/typecheck.ts:455-509 — `spawnTsc`; `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` detection at 478.
- src/core/__tests__/typecheck.test.ts — unit tests; twenty-five call sites of `runProjectTypecheck`.
- .gitignore:148 — `.spec-workflow/.cache/` already ignored in this repository.

## Dashboard task-review runner and routes
- src/dashboard/task-review-runner.ts:38-55 — `RunOptions`: `workflowRoot` and `workspacePath`.
- src/dashboard/task-review-runner.ts:66-91 — `BuildPromptOptions`: typed fields; `fileResolution` optional.
- src/dashboard/task-review-runner.ts:147-285 — `executeJob`: `ToolContext` at 160-163, `any`-typed destructure of six fields at 177, output path at 204, output unlink at 272.
- src/dashboard/task-review-runner.ts:287-434 — `buildPrompt`: file list 359-376, methodology 378-379, instruction 1 replaced on all-drop 389-393, prompt joined at 433.
- src/dashboard/task-review-runner.ts:464-527 — `runAgent`: prompt pushed as one argv element 473, `cwd: workspacePath` 476, env with `SPEC_WORKFLOW_WORKSPACE` and `SPEC_WORKFLOW_SHARED_ROOT` 483-487.
- src/dashboard/__tests__/task-review-runner.test.ts — runner and prompt tests.
- src/dashboard/multi-server.ts:1417-1477 — task status route: writes `tasks.md`, records nothing else.
- src/dashboard/multi-server.ts:1783-1824 — review route: passes `project.projectPath` and `project.workspacePath` to the runner.
- src/dashboard/multi-server.ts:1827-1888 — retry route: same roots.
- src/dashboard/project-manager.ts:11-16 — `ProjectContext`: translated `projectPath` and `workspacePath`, original paths for display.

## Implementation log and attribution
- src/tools/log-implementation.ts:297-429 — `logImplementationHandler`: `selectRoots` destructures workflow root only at 316, entry literal 376-388, `addLogEntry` 390.
- src/dashboard/implementation-log-manager.ts:17 — logs directory `<spec>/Implementation Logs`.
- src/dashboard/implementation-log-manager.ts:53 — `parseMarkdownContent`: entries are hand-parsed markdown.
- src/dashboard/implementation-log-manager.ts:318-345 — `entryToMarkdown`: fields serialised.
- src/dashboard/implementation-log-manager.ts:433-448 — `addLogEntry`: one markdown file per entry.
- src/tools/__tests__/log-implementation.test.ts — minimal existing test.

## Adversarial path
- src/tools/adversarial-review.ts:54-187 — `adversarialReviewHandler`: `selectRoots` keeps workflow root only at 61, scaffold written at 157, `data.methodology` at 178.
- src/tools/adversarial-review.ts:342-351 — `buildScaffoldedPrompt` signature: no workspace field.
- src/dashboard/adversarial-runner.ts:26-44 — `RunOptions`: `workspacePath`, no workflow root.
- src/dashboard/adversarial-runner.ts:111-148 — `executeJob`: reads the scaffold from disk, one-line instruction at 126.
- src/dashboard/adversarial-runner.ts:156-180 — `runAgent`: `cwd: workspacePath`, both env vars set.

## Git helpers and locking
- src/core/git-utils.ts:5-6 — `SPEC_WORKFLOW_SHARED_ROOT_ENV`, `SPEC_WORKFLOW_WORKSPACE_ENV`.
- src/core/git-utils.ts:101 — `normalizeIdentityPath`: absolute, realpath-normalized.
- src/core/git-utils.ts:133-139 — `gitCommonDirAbsolute`.
- src/core/git-utils.ts:152-158 — `gitTopLevel`.
- src/core/git-utils.ts:214-224 — `resolveGitRoot`: env override first.
- src/core/registry-lock.ts:7-11 — lock scoped to registry writers (spec 1 requirement 6.6).
- src/core/registry-lock.ts:52-54 — `uniqueTempPath` for atomic writes.
- src/core/registry-lock.ts:350-391 — `withRegistryLock(lockPath, fn, options)`: exclusive create, stale break, identity-checked release.

## Byte pins and drift test
- src/tools/__tests__/__fixtures__/methodology/ — seventeen committed composite fixtures.
- src/tools/__tests__/review-task.test.ts:1102-1105 — `REQUIREMENTS_MD` points at `.spec-workflow/specs/tighter-reviews/requirements.md`.
- src/tools/__tests__/review-task.test.ts:1107-1124 — canonical fixture inputs; no all-drop case.
- src/tools/__tests__/review-task.test.ts:1259-1268 — `EXPECTED_R4_BLOCK_NAMES`.
- src/tools/__tests__/review-task.test.ts:1455-1458 — comment says the source doc is gitignored; `describe.skipIf(!existsSync(...))`.
- src/tools/__tests__/review-task.test.ts:1467-1500 — Direction A (block in a fixture) and Direction B (fixture sentence in a block).
- .spec-workflow/specs/tighter-reviews/requirements.md:148-190 — R4.1 to R4.7 blocks; R4.2a at 154-156, R4.6b at 184-186; file is tracked by git (`git ls-files` lists it, `git check-ignore` exits 1).

## End-to-end
- e2e/helpers/worktree-harness.ts — temporary repository with linked worktrees and one shared `.spec-workflow`.
- e2e/worktree-shared.spec.ts:322-657 — shared-worktree scenarios: identity, registry, diff of the triggering worktree, relative-path diff, adversarial target, simultaneous startup.
- package.json:43 — `test:e2e:worktree` script.
