# Codebase context — review-gate

## review-task tool (`src/tools/review-task.ts`, 810 lines)
- src/tools/review-task.ts:30-73 — `DiffMethodologyState` and `TypecheckMethodologyState` unions plus their compute functions
- src/tools/review-task.ts:79-150 — `unwrapTypecheck`, `unwrapHygiene`, `unwrapDiff`: rejection-to-degraded-state converters
- src/tools/review-task.ts:152-230 — tool definition; `action` enum is `prepare | record` (179-183); `required: ['action', 'specName', 'taskId']` (224)
- src/tools/review-task.ts:232-261 — `reviewTaskHandler`: `selectRoots`, spec path, dispatch on action
- src/tools/review-task.ts:321-508 — `handlePrepare`: task lookup (347-355), implementation log required (357-366), prepare marker (377-381), file resolution (413-430), settings (431-432)
- src/tools/review-task.ts:440-449 — the three concurrent pre-computations: typecheck, hygiene, diff
- src/tools/review-task.ts:463-499 — the `prepare` response `data` fields (diff body, stats, typecheck results, methodology)
- src/tools/review-task.ts:510-631 — `handleRecord`: marker check (532-539), task exists (541-552), log exists (554-562), consistency (564-569), save (576-582), `nextSteps` per verdict (585-603)
- src/tools/review-task.ts:633-738 — `buildReviewMethodology`, the verifier's checklist text
- src/tools/review-task.ts:743-791 — byte-pinned R4 prose constants; drift-tested against fixtures, not to be edited
- src/tools/root-selection.ts:51-56 — `SelectedRoots`: `workflowRoot` (contains `.spec-workflow`) and `workspacePath` (the checkout)
- src/tools/root-selection.ts:202-209 — `selectRoots`: no `projectPath` override means both roots come from the context
- src/tools/get-task-review.ts:44-149 — handler; latest or by version; returns `data.review` (103-113, 126-141)
- src/tools/index.ts:16-31 — tool registration; src/tools/index.ts:69-74 — dispatch of `review-task` and `get-task-review`

## Review storage
- src/types.ts:242-251 — `ReviewFinding` (severity, title, file, line, description, taskRequirement, category, classification)
- src/types.ts:253-262 — `TaskReview` (id, taskId, specName, version, timestamp, verdict `pass | fail | findings`, summary, findings); no reviewer field
- src/core/task-review-manager.ts:10-27 — `validateVerdictConsistency`: `pass` needs zero findings
- src/core/task-review-manager.ts:33-40 — manager over `<spec dir>/reviews/`
- src/core/task-review-manager.ts:62-66 — `getNextVersion`: max existing version plus one
- src/core/task-review-manager.ts:71-103 — prepare marker write, check, remove (`.prepare-<taskId>`)
- src/core/task-review-manager.ts:108-132 — `saveReview`: assigns id, version, timestamp; writes markdown; removes marker
- src/core/task-review-manager.ts:137-150 — `getReviewsForTask`, `getLatestReview`
- src/core/task-review-manager.ts:155-177 — `loadAllReviews`: every `review-*.md` in the directory
- src/core/task-review-manager.ts:185-234 — `reviewToMarkdown`: YAML frontmatter keys id, taskId, specName, version, verdict, timestamp, counts
- src/core/task-review-manager.ts:236-311 — `parseReviewMarkdown`: regex frontmatter reader (`get(key)` at 243-246), findings from `### SEVERITY` headings

## Pre-computations the gate reuses
- src/core/typecheck.ts:8-15 — `TypecheckDiagnostic` with `inScope`
- src/core/typecheck.ts:17-47 — `TypecheckResult`: `success` (diagnostics, coverage, truncated), `unavailable` (reasons incl. `feature-disabled`), `timeout`
- src/core/typecheck.ts:49 — `TIMEOUT_MS = 30_000`
- src/core/typecheck.ts:124-140 — `runProjectTypecheck(workspacePath, workflowRoot, allFiles, { enabled })`
- src/core/hygiene-signals.ts:4-19 — `HygieneSignal` and the four patterns `console | todo | fixme | debugger`
- src/core/hygiene-signals.ts:46-50 — `computeHygieneSignals(files)`: whole-file scan of kept paths
- src/core/task-diff.ts:8-14 — `TaskDiffResult` (`stats: { filesChanged, linesAdded, linesRemoved } | undefined`)
- src/core/task-diff.ts:36-48 — `runGit`: `execFile('git')` in the workspace with the scrubbed env
- src/core/task-diff.ts:135-234 — `computeTaskDiff(workspacePath, allFiles)`: containment assertion, then `git diff -U10 -M HEAD -- <files>` and `--numstat` (169-170); working tree against `HEAD` only, logged files only
- src/core/task-diff.ts:263-291 — `parseNumstat`: per-file added/removed and totals
- src/core/path-denylist.ts:24-30 — fixture segments (`__tests__`, `fixtures`, ...); src/core/path-denylist.ts:101-109 — `partitionPaths`
- src/core/file-resolution.ts:94-134 — `DropCause`, `ResolvedFile`, `FileResolution`, `ResolutionRoots`
- src/core/file-resolution.ts:183-186 — `resolveLoggedFiles(input, roots)`
- src/core/git-utils.ts:27-50 — `SCRUBBED_GIT_ENV_VARS`, `scrubbedGitEnv()`
- src/core/adversarial-settings.ts:61-141 — `loadSettings(projectPath)` from `<workflow root>/adversarial-settings.json`
- src/core/adversarial-settings.ts:183-206 — `isTypecheckEnabled(settings)`
- src/core/path-utils.ts:208-226 — `getWorkflowRoot` (`<projectPath>/.spec-workflow`), `getSpecPath`, `getSteeringPath`

## Tasks and implementation logs
- src/core/task-parser.ts:103-128 — `PromptSection`, `ParsedTask` (requirements, leverage, files, prompt, promptStructured)
- src/core/task-parser.ts:226-298 — per-task metadata loop from the task line to the next task line or heading; `_Prompt:` capture (233-263), `_Requirements:` (264-271), `Files:` (279-288)
- src/types.ts:162-212 — `ImplementationLogEntry` (filesModified, filesCreated, self-reported statistics, artifacts)
- src/dashboard/implementation-log-manager.ts:461-464 — `getTaskLogs(taskId)`
- src/tools/log-implementation.ts:8 — `logImplementationTool`; src/tools/log-implementation.ts:294 — handler

## spec-status
- src/tools/spec-status.ts:153-197 — log coverage and review coverage over completed tasks; `getLatestReview` per task (184-191)
- src/tools/spec-status.ts:199-205 — warnings for unlogged and unreviewed completed tasks
- src/core/spec-status-deriver.ts:17-37 — `deriveSpecStatus`: phase from file existence and task checkboxes only

## Dashboard consumers (unchanged by this spec)
- src/dashboard/task-review-runner.ts:160-177 — calls `reviewTaskHandler` with `action: 'prepare'`; destructures six named fields of `data`
- src/dashboard/multi-server.ts:1913-1926 — list review versions; 1929-1944 — one version; 1947-1960 — per-spec summary keyed by taskId
- src/dashboard_frontend/src/modules/pages/TasksPage.tsx:428-440 — `TaskReviewBadge`: renders `verdict` only

## Watch ledger
- src/watch/ledger.ts:93-99 — `PickRow`; `outcome` is a free string
- src/watch/ledger.ts:275-283 — `task.done` closes the matching `task.pick`
- src/watch/ledger.ts:296-310 — ticker rendering of `task.done`, `note` and spawn events

## Harness — implementation phase (source of truth `harness/`)
- harness/skills/sdd-implementation-phase/SKILL.md:8-12 — the orchestrator's drift rule (no file contents, diffs or test output in its context)
- harness/skills/sdd-implementation-phase/SKILL.md:40-51 — ledger events (`task.pick`, `spawn.start`, `spawn.end`, `task.done ... outcome=`, `note`)
- harness/skills/sdd-implementation-phase/SKILL.md:67-105 — per-task loop: pick (71-72), implement (73-76), read report (77-83), verify (84-88), fix rounds cap 3 (89-96), complete (97-102), budget (103-105)
- harness/skills/sdd-implementation-phase/SKILL.md:126-139 — completion gate: end-to-end verification by `sdd-verifier`
- harness/skills/sdd-implementation-phase/SKILL.md:159-178 — PR checks gate
- harness/skills/sdd-implementation-phase/references/briefs.md:5-49 — implementer standing brief (commit before report, 16-18; run named checks, 27-28)
- harness/skills/sdd-implementation-phase/references/briefs.md:66-82 — fix brief (verifier findings verbatim)
- harness/skills/sdd-implementation-phase/references/briefs.md:88-110 — verifier standing brief
- harness/skills/sdd-implementation-phase/references/briefs.md:112-131 — verifier brief: `prepare`, read files, "Run the task's checks yourself" (124), `record`
- harness/skills/sdd-implementation-phase/references/briefs.md:155-172 — end-to-end verification brief
- harness/skills/sdd-implementation-phase/references/briefs.md:211-218 — PR body rules; forbidden terms are grepped by the skill, not parsed by the server
- harness/agents/sdd-implementation-orchestrator.md:9-36 — tool list; no `review-task` today
- harness/agents/sdd-verifier.md:7-19 — tool list with the three `review-task` names (12-14); 22-32 — standing rules
- harness/agents/sdd-implementer.md:24-34 — standing rules; commits on the current branch before reporting (29)

## Harness — close-out phase
- harness/skills/sdd-closeout-phase/SKILL.md:39-50 — ledger events for close-out
- harness/skills/sdd-closeout-phase/SKILL.md:52-83 — orient; class table `none | harness | store | code | home` (66-72)
- harness/skills/sdd-closeout-phase/SKILL.md:92-144 — batches: landing (102-113), brief (114-117), implement (118-120), verify (121-124), fix rounds (125-131), close-out lines (132-135), PR (136-143)
- harness/skills/sdd-closeout-phase/references/briefs.md:5-14 — checks per class (`store` none, `harness` sync and validate, `code` per rules, `home` none)
- harness/skills/sdd-closeout-phase/references/briefs.md:44-60 — commit script: one commit per item, only the named files
- harness/skills/sdd-closeout-phase/references/briefs.md:112-138 — verify brief per batch
- harness/agents/sdd-closeout-orchestrator.md:9-25 — tool list; no `review-task` today

## Harness — supervisor and rules
- harness/skills/sdd-continue/SKILL.md:56-62 — spec store root; agent rules at `<spec store root>/agent-rules.md`
- harness/skills/sdd-continue/SKILL.md:160-172 — launch prompt fields (`SPEC_STORE_ROOT`, `CODE_ROOT`, `AGENT_RULES`, `EVENT_SCRIPT`)
- .spec-workflow/agent-rules.md — `## Checks` (per-path commands), `## PR body` (forbidden terms: none), `## Sensitive paths` (six bullets, machine-read by the gate)
- harness/hooks/hooks.json — activity hooks; a sensitive path, untouched by this spec

## Plugin copies and docs
- scripts/sync-plugin-assets.cjs:1-12 — `harness/` is the single source of truth; plugins get exact copies
- scripts/sync-plugin-assets.cjs:41-46 — plugin roots; 66-73 — copy step
- plugins/spec-workflow-harness/ — generated copy; `diff -rq` against `harness/` differs only by `.claude-plugin/plugin.json`
- docs/SDD-HARNESS.md:75-89 — implementation phase and PR checks gate; 98-113 — close-out; 225-240 — writing `agent-rules.md`, two machine-read lines (233-238); 242-256 — model policy
- docs/TOOLS-REFERENCE.md:399-437 — `review-task`; 439-453 — `get-task-review`

## Tests
- src/tools/__tests__/review-task.test.ts:1-61 — module mocks for typecheck, hygiene, diff
- src/tools/__tests__/review-task.test.ts:63-113 — temp-dir fixture: `tasks.md`, materialised files, implementation log
- src/tools/__tests__/review-task.test.ts:114-165 — prepare cases; 272-393 — record cases
- src/tools/__tests__/spec-status.test.ts:80-89 — completed-spec fixture
- src/tools/__tests__/get-task-review.test.ts — 97 lines, handler cases

## Steering stand-ins
- docs/harness-efficiency-plan.md:8-9 — goal; 98-137 — step 2; 126-128 — the conservative default; 164-167 — step 4 measures skipped verifier spawns; 174-183 — R1 to R8
- docs/step-0-answers.md:9-17 — settled facts table
- .spec-workflow/spec-decomposition/decomposition.md:64-100 — section preamble and entry 4

## Added by the design phase (2026-09-14)
- src/tools/review-task.ts:54-73 — `computeTypecheckMethodologyState(result)`: one `TypecheckResult` to one methodology state
- src/tools/review-task.ts:160-162 — the description's "Two actions" bullets
- src/tools/review-task.ts:176-225 — `inputSchema`; properties 178-223; `required` 224
- src/tools/review-task.ts:251-260 — dispatch on `action`; unknown-action response 256-259
- src/tools/review-task.ts:431-432 — `loadSettings(projectPath)`, `isTypecheckEnabled(settings)`
- src/tools/review-task.ts:493-498 — `projectContext` block of the prepare response
- src/tools/review-task.ts:576-582 — `handleRecord` `saveReview` call; no `reviewer`
- src/core/task-review-manager.ts:190-200 — frontmatter lines; `verdict:` at 195
- src/core/task-review-manager.ts:307 — the parsed object returned; no `reviewer`
- src/core/task-diff.ts:277 — `parseNumstat` skips a line with fewer than three tab fields
- src/core/task-parser.ts:112 — `ParsedTask.lineNumber` (0-based)
- src/core/task-parser.ts:153 — `parseTasksFromMarkdown(content)`
- src/core/task-parser.ts:167-175 — checkbox regex (167), `checkboxIndices` (168), `endLine` = next checkbox line or EOF (175)
- src/core/typecheck.ts:187 — env for `tsc`: scrubbed git env plus `FORCE_COLOR=0`, `NO_COLOR=1`
- src/core/hygiene-signals.ts:21-44 — `scanFile`: unreadable or oversize file yields no signals
- src/types.ts:58-60 — `ToolContext.projectPath` (the workflow root); `workspacePath` required
- src/tools/root-selection.ts:202-221 — `selectRoots` body
- src/tools/get-task-review.ts:106, 129 — `data: { review }`: the parsed object whole
- src/dashboard/implementation-log-manager.ts:461 — `getTaskLogs(taskId)` signature
- src/watch/ledger.ts:94-99 — `PickRow`; 279-281 — `task.done` sets `outcome`
- vitest.config.ts:4-8 — `include: ['src/**/*.{test,spec}.{js,ts}']`
- .github/workflows/ci.yml:12 — `runs-on: ubuntu-latest`, the only OS
- src/core/__tests__/task-diff.test.ts:3-9 — `node:child_process` mocked; 23-41 — `gitCmd`, `gitInit`, `gitCommitAll`
- src/core/__tests__/task-review-manager.test.ts:149 — markdown round-trip suite; 207 — classification round-trip suite; 229 — absent-key default case
- src/tools/__tests__/get-task-review.test.ts:85 — findings-in-response case
- src/tools/__tests__/spec-status.test.ts:80-89 — completed-spec fixture with two `[x]` tasks
- src/tools/__tests__/review-task.test.ts:13-38 — module mocks; 94-112 — `createImplLog` materialises files and adds a log entry
- harness/skills/sdd-implementation-phase/SKILL.md:53-65 — Step 0; a resumed `[-]` task is worked first (59-61); 214-224 — Repair
- harness/skills/sdd-closeout-phase/references/briefs.md:90-110 — batch brief; 140-158 — fix brief
- harness/agents/sdd-closeout-orchestrator.md:9-24 — `tools` list (six MCP names, two tools)
- docs/SDD-HARNESS.md:98-113 — close-out paragraph

## Probes (2026-09-14; node v24.13.0, git 2.43.0)
- `child_process.exec` with `timeout`: on expiry `error.killed === true`, `error.signal === 'SIGTERM'`, `error.code === null`; non-zero exit ⇒ `error.code` is the exit code; success ⇒ `error === null`
- `git diff-tree --numstat -r --root --no-renames <commit>`: a root commit is listed; a rename is two lines; a merge commit prints nothing without `-m --first-parent`
- `git diff --numstat --no-renames <ref>`: working tree against `<ref>`, committed and uncommitted tracked changes; untracked files absent
- `git ls-files --others --exclude-standard`: untracked files that are not ignored
- `git rev-parse --verify <bad>^{commit}` and `git rev-parse --show-toplevel` outside a repository: exit 128

## Added by the tasks phase (2026-09-14)
- src/tools/review-task.ts:54, 79, 103 — `computeTypecheckMethodologyState`, `unwrapTypecheck`, `unwrapHygiene` are already `export`ed; no export change needed for `review-gate.ts`
- src/tools/review-task.ts:18 — `_resetReviewWarnings`, the only review-task export the test imports (`src/tools/__tests__/review-task.test.ts:42, 59`)
- src/tools/__tests__/review-task.test.ts — no assert on `inputSchema`, the description text or the unknown-action message
- src/tools/__tests__/adversarial-review.test.ts:589 — the only `inputSchema` assert in the suite (a different tool)
- src/core/__tests__/task-review-manager.test.ts:38-116 — `saveReview` suite; 149-206 — round-trip suite, frontmatter checked with `toContain` at 195-198
- src/core/__tests__/task-review-manager.test.ts — the only test file holding review frontmatter text (`verdict:`/`criticalCount:`)
- src/core/__tests__/task-diff.test.ts:31-36 — `gitInit`; 38-41 — `gitCommitAll`; 43 — `installPassthrough`; 76 onward — `computeTaskDiff` suites
- src/core/task-review-manager.ts:307 — `return { id, taskId, specName, version, timestamp, verdict, summary, findings }`
- src/core/adversarial-settings.ts:54-57 — `getSettingsPath`: `<workflow root>/adversarial-settings.json`; 195-197 — `features.typecheck` boolean switches typecheck off
- src/tools/spec-status.ts:37 — `specStatusHandler`; 154 — `reviewCoverage` declared; 224 — returned inside `data`
- src/types.ts:218 — `ToolResponse` interface
- src/watch/ledger.ts:94-99 — `PickRow` with `outcome?: string` at 98
- .github/workflows/ci.yml:20 — `node-version: '20'`; 41 — `npm test -- --run`
- .spec-workflow/agent-rules.md:43 — `## Sensitive paths`; 47-52 — six bullets
- package.json:39 — `"test": "vitest"`; 26 — `build` runs `sync:plugin-assets` then `tsc`
- plugins/spec-workflow-harness, plugins/spec-workflow-mcp, plugins/spec-workflow-mcp-with-dashboard — each holds `agents/`, `hooks/`, `skills/` copies
- docs/TOOLS-REFERENCE.md:411 — the `action` row (`'prepare' | 'record'`); 439-453 — `get-task-review`
- docs/SDD-HARNESS.md:75-78 — per-task sentence; 98-113 — close-out paragraph; 233-238 — the two machine-read bullets
- harness/skills/sdd-implementation-phase/references/briefs.md:124 — "Run the task's checks yourself."; 133-137 — narrow-verification addendum
- harness/skills/sdd-closeout-phase/SKILL.md:96-98 — stuck-batch resume escape
- No test under `src/` reads `harness/`; `scripts/` has no test directory
- Local runtimes (2026-09-14): node v24.13.0 default, v22.14.0 via fnm; no node 20 installed
