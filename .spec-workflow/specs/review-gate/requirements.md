# Requirements Document

## Introduction

`review-gate` adds a `gate` action to the `review-task` MCP tool: a deterministic check that runs before any LLM verifier looks at a task. It serves the SDD harness's implementation and close-out orchestrators, which spawn `sdd-verifier` for every task and batch today. After this spec the verifier runs only on high risk; a low-risk change gets a recorded gate verdict and the task is ticked without an LLM spawn.

## Alignment with Product Vision

This is R1 of the harness efficiency plan (`docs/harness-efficiency-plan.md:176`): about a third fewer tokens per spec, same checks that matter (`docs/harness-efficiency-plan.md:8-9`). The plan pins the conservative default risk rule, detailed in Requirement 3 (`docs/harness-efficiency-plan.md:126-128`). Step 0 facts (`docs/step-0-answers.md:9-17`) are settled and not re-checked here.

## Requirements

### Requirement 1 — The `gate` action

**User Story:** As the implementation orchestrator, I want one tool call that runs the mechanical checks for a task and tells me whether an LLM verifier is needed, so that I spawn `sdd-verifier` only when the change warrants it.

#### Acceptance Criteria

1. WHEN `review-task` is called with `action: "gate"` THEN the tool SHALL accept it beside `prepare` and `record` (`src/tools/review-task.ts:179-183`, `251-260`) and SHALL keep `prepare`/`record` behaviour unchanged.
2. The `gate` action SHALL take `specName` and `taskId` (required today, `src/tools/review-task.ts:224`) plus `baseRef` (a git revision; the change is everything after it), `commit` (one sha; the change is that commit alone), `checks` (shell command strings, the task's named checks), `files` (paths relative to `root` the change should stay within) and `root` (an absolute directory; default the workspace under review, `src/tools/root-selection.ts:202-209`). `root` and `projectPath` do not interact: the workflow root always comes from context or `projectPath`. `root` also is the pre-computations' working tree; only `agent-rules.md` (2.1) and the review store (5) come from the workflow root, which stays `runProjectTypecheck`'s second argument (1.3) even where `root` is a foreign checkout (7.1).
3. WHEN `gate` runs THEN it SHALL run, in `root`, three pre-computations: the project typecheck (`src/core/typecheck.ts:124-140`) and the hygiene scan (`src/core/hygiene-signals.ts:46-50`) — the two `prepare` runs today (`src/tools/review-task.ts:440-449`) — plus diff statistics, a new range function (8.3); then every `checks` entry, each its own child process, in order, with the git environment scrubbed (`src/core/git-utils.ts:45-50`). For a files-only item gate (`files` given, no `commit`, no `baseRef`; 7.2) `root` need not be a git repository: the gate SHALL skip these three pre-computations and run only `checks` plus the path-existence check (4.1e). On that path `data.stats` SHALL be `null`, `data.typecheck` `{ kind: 'skipped' }` (not added to the union at `src/tools/review-task.ts:45-52`), `data.hygiene` SHALL be `{}`, and `data.touched` the listed `files`.
4. The touched-file set and line counts SHALL come from git over the range the arguments select: `commit` given ⇒ that commit's files; else `baseRef` given ⇒ tracked changes after `baseRef`, committed or not, plus untracked files that are not ignored; else the working tree against `HEAD` (`src/core/task-diff.ts:169-170`). The gate SHALL NOT restrict the pathspec to logged files: an unlogged changed file still counts.
5. WHEN `taskId` names a task in `tasks.md` THEN the gate SHALL require an implementation log for it, as `prepare` does (`src/tools/review-task.ts:357-366`). WHEN `taskId` names no task in `tasks.md` THEN the gate SHALL treat the call as an item gate (7): it SHALL require `commit` or `files`, SHALL NOT require an implementation log, and SHALL record no verdict.
6. The response SHALL carry `data.gate` (`pass` | `fail`), `data.risk` (`low` | `high`), `data.reasons` (one line per fired rule with its evidence), `data.checks` (per command: the command, `pass` | `fail` | `timeout`, the exit code, one output line), `data.stats` (`filesChanged`, `linesAdded`, `linesRemoved`), `data.touched` (paths relative to `root`, up to 100 plus the total count), `data.typecheck` (`TypecheckMethodologyState`, `src/tools/review-task.ts:45-52`, or files-only `{ kind: 'skipped' }`), `data.hygiene` (signal counts by pattern) and `data.recorded` (`{ reviewId, version }` or `null`).
7. The response SHALL NOT contain a diff body, a file's contents, or more than one line of any check's output; every string in `data.reasons` and `data.checks[].output` SHALL be at most 200 characters, per the orchestrators' drift rule (`harness/skills/sdd-implementation-phase/SKILL.md:8-12`).
8. IF the gate cannot run at all (`tasks.md` missing when `taskId` names a task, an unreadable `agent-rules.md`, `root` not an absolute path to an existing directory, or no git repository at `root` — except for the files-only item gate of 1.3/7.2) THEN the tool SHALL return `success: false` with the cause and SHALL record nothing.

### Requirement 2 — Sensitive paths in `agent-rules.md`

**User Story:** As a project owner, I want to name the paths whose changes always get a verifier, in the file the harness already reads, so that the risk rule is mine to set without a server setting.

#### Acceptance Criteria

1. The gate SHALL read the sensitive-path list from `agent-rules.md` in the spec store root: `PathUtils.getWorkflowRoot(projectPath)` joined with `agent-rules.md` (`src/core/path-utils.ts:208-210`).
2. The list SHALL be the bullet list under the heading `## Sensitive paths`, one path per bullet, in backticks or bare, relative to the code root. Lines under the heading that are not bullets SHALL be ignored.
3. An entry that ends in `/` SHALL match every path under that directory; any other entry SHALL match one path exactly. Matching SHALL compare forward-slash paths relative to `root`. No glob syntax (D5).
4. IF `agent-rules.md` does not exist, has no `## Sensitive paths` heading, or the heading has no bullet THEN every touched path SHALL be sensitive, and `data.reasons` SHALL say `sensitive-paths: no list; every path is sensitive`. This is the Decided default of the decomposition entry.
5. The `## PR body` forbidden-terms convention (`harness/skills/sdd-implementation-phase/references/briefs.md:211-216`) SHALL stay unchanged.

### Requirement 3 — Risk score

**User Story:** As the harness owner, I want risk decided by fixed rules that err toward the verifier, so that skipping it never hides a change a human would want reviewed.

#### Acceptance Criteria

1. `data.risk` SHALL be `high` when any holds, else `low`: (a) a touched path matches a sensitive-path entry, or the list is absent (2.4); (b) `linesAdded + linesRemoved` exceeds 200 over every touched file, no exclusions (D6); (c) the task names tests and no touched path is a test file (3.3); (d) the touched set is empty (`no-diff`, D11); (e) the typecheck did not run for a reason other than `feature-disabled` (`unavailable`/`timeout`, `src/core/typecheck.ts:27-47`); (f) `taskId` is a task and `baseRef`, `commit` and `files` are all absent (the range falls back to `HEAD`, empty in the harness flow, D3).
2. Every rule that fires SHALL add one line to `data.reasons` with the rule name and its evidence (the path, the line count, the missing test file, the typecheck reason).
3. A task names tests WHEN its block in `tasks.md` (its task line through the line before the next checkbox line — headings between two tasks do not bound it — the span the parser reads, `src/core/task-parser.ts:174-298`) contains the word `test` or `tests`, case-insensitive, on a word boundary. A touched path is a test file WHEN its basename contains `.test.` or `.spec.`, or a path segment is `__tests__`, `tests` or `test` (D4).
4. The threshold and the patterns of this requirement SHALL be exported constants in one module with a unit test per rule, so a retrospective can tune them in one place.

### Requirement 4 — Gate verdict and check execution

**User Story:** As the implementation orchestrator, I want a gate fail to mean "the implementer must fix something mechanical", so that I can brief a fix round from the gate's output alone.

#### Acceptance Criteria

1. `data.gate` SHALL be `fail` when any holds, else `pass`: (a) an entry of `checks` exits non-zero or times out; (b) the typecheck's status is `success` with an `inScope: true` diagnostic (`src/core/typecheck.ts:8-15`); (c) the hygiene scan reports a `debugger` signal in a touched file; (d) `files` was given and a touched path is not in it; (e) `files` was given without `commit`/`baseRef` and a listed path does not exist under `root`.
2. Hygiene signals of pattern `console`, `todo` and `fixme` (`src/core/hygiene-signals.ts:14-19`) SHALL NOT fail the gate and SHALL NOT raise risk; the gate SHALL report their counts in `data.hygiene` (D8).
3. A typecheck that did not run (`unavailable`, `timeout`) SHALL NOT fail the gate; it raises risk (3.1e). `feature-disabled` SHALL neither fail the gate nor raise risk.
4. Each check SHALL run through the platform shell in `root` with a timeout of 300 seconds; a timed-out check is `timeout` and fails the gate. The one line of output SHALL be the last non-empty line of the combined stdout and stderr, trimmed to 200 characters (D10).
5. WHEN `data.gate` is `fail` THEN `data.risk` SHALL still be computed and returned, and no verdict SHALL be recorded.
6. `runProjectTypecheck` may return more than one `TypecheckResult`, one per `tsconfig.json` (`src/core/typecheck.ts:124-140`). 4.1b and 3.1e SHALL apply per result: one in-scope diagnostic in any result fails the gate, and any result `unavailable` or `timeout` raises risk; `data.typecheck` (1.6) SHALL report the worst state across results.

### Requirement 5 — Recording a gate verdict

**User Story:** As a user of the dashboard and `spec-status`, I want a task the gate passed to show a review, so that review coverage stays complete when no verifier ran.

#### Acceptance Criteria

1. WHEN `data.gate` is `pass`, `data.risk` is `low` and `taskId` is a task in `tasks.md` THEN the gate SHALL save a review through `TaskReviewManager.saveReview` (`src/core/task-review-manager.ts:108-132`) with `verdict: pass`, no findings, a one-line summary of the rules, counts and checks, and `reviewer: gate`; it SHALL NOT require or leave a prepare marker (`src/core/task-review-manager.ts:71-103`).
2. WHEN `data.gate` is `pass` and `data.risk` is `high` THEN the gate SHALL record nothing; the verifier records through `prepare` and `record` as today (`harness/agents/sdd-verifier.md:26`).
3. `TaskReview` (`src/types.ts:253-262`) SHALL gain an optional `reviewer` field with the values `gate` and `agent`; the serializer SHALL write `reviewer:` in the frontmatter and the parser SHALL read it (`src/core/task-review-manager.ts:185-234, 236-311`). A review file without the key SHALL parse as `reviewer: agent` (D7).
4. `get-task-review` SHALL return `reviewer` inside `data.review` (`src/tools/get-task-review.ts:103-113, 126-141`); its verdict-dependent `nextSteps` SHALL NOT change.
5. `spec-status` review coverage (`src/tools/spec-status.ts:179-193`) SHALL count a gate-recorded review with no change to its derivation; the dashboard review endpoints (`src/dashboard/multi-server.ts:1913-1944`) SHALL serve them through the same manager.
6. A `record` call after a gate-recorded `pass` SHALL create the next version, as re-review does today (`src/core/task-review-manager.ts:62-66`).

### Requirement 6 — The implementation skill calls the gate first

**User Story:** As the implementation orchestrator, I want the per-task loop to route on the gate's result, so that a low-risk task finishes without a verifier spawn.

#### Acceptance Criteria

1. WHEN the orchestrator marks a task `[-]` (`harness/skills/sdd-implementation-phase/SKILL.md:71-72`) THEN it SHALL record the code root's `HEAD` sha as the task's base ref, keep it for every fix round, and pass it as `baseRef` to every `gate` call for the task (D3). A resumed `[-]` task has no base ref; the skill SHALL call the gate without `baseRef`, yielding `risk: high` (3.1f).
2. After the implementer reports `logged: yes` (`harness/skills/sdd-implementation-phase/SKILL.md:77-79`) the skill SHALL call `review-task` `gate` with `specName`, `taskId`, `baseRef` and `checks` = the check commands the task block and `agent-rules.md` name for the files touched, one string each, omitting a bare typecheck command (D2). This call replaces step 4 (`harness/skills/sdd-implementation-phase/SKILL.md:84-88`) as the first review step.
3. WHEN `data.gate` is `fail` THEN the skill SHALL run one implementer fix round whose brief carries `data.reasons` and `data.checks` verbatim, spawn no verifier, and call the gate again. Fix rounds after a gate fail count against the existing cap of three (`harness/skills/sdd-implementation-phase/SKILL.md:89-96`). WHEN it still fails after three such rounds THEN the skill SHALL use that same cap path: adjudicator, then one narrow verifier round via `prepare`/`record` — the sole exception to "gate fail spawns no verifier" — and, contrary to 6.5, its brief (`harness/skills/sdd-implementation-phase/references/briefs.md:133-137`) SHALL tell the verifier to re-run the checks that were failing when the terminus fired.
4. WHEN `data.gate` is `pass` and `data.risk` is `low` THEN the skill SHALL proceed to complete (`harness/skills/sdd-implementation-phase/SKILL.md:97-102`) with the gate-recorded review as the task's review, `rounds=0`, and `task.done ... outcome=gate` in the ledger.
5. WHEN `data.gate` is `pass` and `data.risk` is `high` THEN the skill SHALL spawn `sdd-verifier` with a brief carrying `data.reasons`, `data.checks`, `data.stats`, `data.touched`, `data.typecheck`, and the instruction not to re-run the gate's checks. The verifier brief template (`harness/skills/sdd-implementation-phase/references/briefs.md:112-131`) SHALL replace "Run the task's checks yourself" (line 124) with "Run only checks the gate did not run"; the verifier's standing rule (`harness/agents/sdd-verifier.md:26`) SHALL change to match.
6. The skill SHALL record one ledger `note` per gate call, `text=gate: task N pass|fail risk low|high`, so step 4 counts skipped verifier spawns (`docs/harness-efficiency-plan.md:164-167`).
7. `harness/agents/sdd-implementation-orchestrator.md` and `harness/agents/sdd-closeout-orchestrator.md` SHALL list the three `review-task` tool names in `tools`, in the pattern the verifier uses (`harness/agents/sdd-verifier.md:12-14`).
8. The completion gate (`harness/skills/sdd-implementation-phase/SKILL.md:126-139`), the PR checks gate (`harness/skills/sdd-implementation-phase/SKILL.md:159-178`) and the repair path SHALL stay as they are: the end-to-end verification still runs the full suite through `sdd-verifier`.

### Requirement 7 — The close-out skill calls the gate per item

**User Story:** As the close-out orchestrator, I want every landed item checked mechanically and only `harness` and `code` items to reach a verifier, so that Markdown and memory items close without an LLM spawn.

#### Acceptance Criteria

1. After the implementer's report for a batch (`harness/skills/sdd-closeout-phase/SKILL.md:118-120`) the skill SHALL call `review-task` `gate` once per item reported `done`, with `taskId` = the item id, `commit` = the reported sha, `root` = the batch's landing root, `files` = any paths the item's text or `Target:` line names, and `checks` = the class's checks (`harness/skills/sdd-closeout-phase/references/briefs.md:5-14`) (D9).
2. For an item of class `home` (in-place edits, no commit, `harness/skills/sdd-closeout-phase/SKILL.md:66-72`) the skill SHALL pass `files` and no `commit`; the gate SHALL check that every listed path exists under `root` (4.1e). Risk is not scored; `data.risk` is `low`.
3. WHEN the item's class is `store` or `home` THEN the skill SHALL spawn no verifier whatever `data.risk` says: `gate: pass` ⇒ the item is `ok`; `gate: fail` ⇒ a fix round with the gate's reasons, under the existing cap and adjudication (`harness/skills/sdd-closeout-phase/SKILL.md:125-131`).
4. WHEN the item's class is `harness` or `code` THEN the skill SHALL route as 6.3–6.5 do: fail ⇒ fix round; pass and low ⇒ `ok`; pass and high ⇒ one `sdd-verifier` spawn for the batch, brief listing only the high-risk items with their gate results.
5. Items reported `to-do` or `skipped` SHALL NOT go through the gate; the skill closes them as today (`harness/skills/sdd-closeout-phase/SKILL.md:132-135`).
6. Mirroring 6.2/6.5, the close-out Verify step (`harness/skills/sdd-closeout-phase/SKILL.md:121-124`) and verify-brief template (`harness/skills/sdd-closeout-phase/references/briefs.md:112-138`) SHALL drop `store`/`home` items (7.3) and, for a high-risk batch, brief only the high-risk items with their gate results and "do not re-run the gate's checks"; WHEN no `harness`/`code` item remains at `risk: high` after that drop THEN the step SHALL spawn no verifier, parallel to 6.4.
7. Mirroring 6.6, the skill SHALL record one ledger `note` per item gate call (`gate: item <id> pass|fail risk low|high`) so step 4 counts close-out verifier spawns skipped for `store`/`home` items (`docs/harness-efficiency-plan.md:164-167`).

### Requirement 8 — Surfaces that stay as they are

**User Story:** As a maintainer, I want the existing review paths untouched, so that the dashboard reviewer and direct callers see no behaviour change.

#### Acceptance Criteria

1. The `prepare` response fields (`src/tools/review-task.ts:463-499`), the methodology text and its byte-pinned constants (`src/tools/review-task.ts:743-791`), and the dashboard runner's destructure (`src/dashboard/task-review-runner.ts:164-177`) SHALL NOT change.
2. The `record` validations (`src/tools/review-task.ts:521-569`) and `validateVerdictConsistency` (`src/core/task-review-manager.ts:10-27`) SHALL NOT change; a gate-recorded review satisfies them (`pass`, zero findings).
3. `runProjectTypecheck`, `computeHygieneSignals` and `computeTaskDiff` SHALL keep their signatures; the gate's range diff is a new function beside `computeTaskDiff` (`src/core/task-diff.ts:135-234`), not a change inside it.

### Requirement 9 — Tests, docs and plugin copies

**User Story:** As the implementer of this spec, I want the checks and documents the repository already requires named up front, so that the PR is green on the first push.

#### Acceptance Criteria

1. Every rule in Requirements 2 to 5 SHALL have a unit test next to its module, following the temp-directory fixture in use (`src/tools/__tests__/review-task.test.ts:63-113`).
2. The decomposition entry's end-to-end verification SHALL be a vitest test with a fixture spec of three tasks and an `agent-rules.md` naming one sensitive path, typecheck `feature-disabled` in the fixture: (1) a Markdown-only edit ⇒ `pass`, `low`, `get-task-review` returns `reviewer: gate`; (2) touching the sensitive path ⇒ `high`, then a `prepare`/`record` (5.2) records `pass`; (3) a failing check ⇒ `gate: fail`, `data.checks[0].output` holds the one-line result, no review file exists, then the fix and a re-gate record `pass` (5.1); then `spec-status` reports all three reviewed once completed, and `npm test` is green.
3. `docs/TOOLS-REFERENCE.md` (`docs/TOOLS-REFERENCE.md:399-437`) SHALL document the `gate` action, its arguments and `data` fields; `docs/SDD-HARNESS.md` SHALL add `## Sensitive paths` to the machine-read list (`docs/SDD-HARNESS.md:233-238`) and the gate to the implementation and close-out descriptions (`docs/SDD-HARNESS.md:75-78, 98-110`).
4. Skill and agent edits SHALL be made under `harness/` only; `plugins/spec-workflow-harness/` is a generated copy (`scripts/sync-plugin-assets.cjs:1-12`), regenerated with `node scripts/sync-plugin-assets.cjs` and checked with `npm run check:plugin-assets` and `claude plugin validate . --strict` (`.spec-workflow/agent-rules.md`, Checks).
5. The version bump is minor (a tool change, `CLAUDE.md`) and happens at release, not in this spec's PR.

## Non-Functional Requirements

### Performance
- One gate call SHALL finish within the typecheck budget (30 s, `src/core/typecheck.ts:49`) plus 300 s per check (D10).

### Security
- The gate SHALL run only the commands in `checks`, never one derived from file contents or `agent-rules.md` (1.3 scrubs the git environment; 1.8 covers a bad `root`).

### Reliability
- Every degraded input (3.1) SHALL resolve to `risk: high`; the gate SHALL never record `pass` when a check did not complete.

## Decisions taken in this document

- D1 — Sensitive-path list location: a tool argument, `adversarial-settings.json`, or `agent-rules.md`; chosen the fixed file.
- D2 — Source of the task's named checks: parse `## Checks`, the task's `Success:` clause, or the caller passes `checks`; chosen the caller.
- D3 — Diff range: working tree against `HEAD` (what `prepare` does), the merge base with the default branch, or a `baseRef` recorded at task pick; chosen `baseRef`: the implementer commits before the gate runs.
- D4 — Test-naming rule: a test-path pattern only, or the word `test` anywhere in the task block; chosen the word — the conservative default.
- D5 — Sensitive-path matching: globs, directory prefixes, or exact entries; chosen prefix plus exact.
- D6 — Line counting: the denylist `prepare` uses, or every file; chosen every file.
- D7 — Verdict shape: a new verdict value, a new record type, or a `reviewer` field on `TaskReview`; chosen the field.
- D8 — Hygiene: fail on any signal, or only on `debugger`; chosen `debugger` only.
- D9 — Item gates: a separate tool, or the same action with `commit` and `files`; chosen the same action.
- D10 — Check execution: parallel or sequential, how much output to keep; chosen sequential, 300 s each, last output line.
- D11 — Empty touched set: gate fail or risk high; chosen risk high.
- D12 — No `baseRef`, `commit` or `files`: refuse, or run against `HEAD` and score high; chosen the latter.

## Scope notes

- The dashboard frontend is not changed: `TaskReviewBadge` renders the verdict only (`src/dashboard_frontend/src/modules/pages/TasksPage.tsx:428-440`); `reviewer` travels in the API payload.
- No `## Checks` parsing from `agent-rules.md` (D2).

## Revision History

- **v1** (2026-09-13) — Initial draft.
- **v2** (2026-09-13) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 2/5/1).
  - **R1-1 — Accepted (MUST_FIX).** AC 3.3: dropped the false "or heading" claim, cited the real span.
  - **R1-2 — Accepted (MUST_FIX).** AC 1.3/1.8 exempt the files-only item gate from the git requirement.
  - **R1-3 — Accepted (SHOULD_FIX).** Added AC 7.6 naming the close-out verify-step and brief edits.
  - **R1-4 — Accepted (SHOULD_FIX).** Added AC 4.6: per-result reduction for a multi-`tsconfig` typecheck.
  - **R1-5 — Accepted (SHOULD_FIX).** AC 6.5 now also edits the verifier's standing rule (`sdd-verifier.md:26`).
  - **R1-6 — Accepted (SHOULD_FIX).** Added AC 7.7: close-out ledger note per item gate call, mirroring 6.6.
  - **R1-7 — Accepted (SHOULD_FIX).** AC 6.3 now defines the persistent-gate-fail terminus.
  - **R1-8 — Accepted (MINOR).** AC 1.2 states the `root`/`projectPath` non-interaction.
- **v3** (2026-09-13) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/3/1).
  - **R2-1 — Accepted (MUST_FIX).** AC 1.2: `root` also governs the pre-computations; `runProjectTypecheck`'s second argument stays the context workflow root even for a foreign `root`.
  - **R2-2 — Accepted (SHOULD_FIX).** AC 1.3: defined `data.stats`/`data.typecheck`/`data.hygiene`/`data.touched` on the files-only path.
  - **R2-3 — Accepted (SHOULD_FIX).** AC 6.3: the terminus verifier re-runs the gate's failing checks, an explicit carve-out from 6.5.
  - **R2-4 — Accepted (SHOULD_FIX).** AC 7.6: no verifier spawns when no high-risk item remains after the drop.
  - **R2-5 — Accepted (MINOR).** AC 1.3 reworded so "prepare runs today" attaches only to typecheck/hygiene; AC 9.2 names the fixture's typecheck posture.
- **v4** (2026-09-13) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md, verdict iterate 0/2/1).
  - **R3-1 — Accepted (SHOULD_FIX).** AC 1.3/1.6: `skipped` no longer joins the `TypecheckMethodologyState` union (`:45-52`); `renderTypecheckDirective` (`:793-810`) needs no new case.
  - **R3-2 — Accepted (SHOULD_FIX).** AC 9.2: task 2's review now comes from `prepare`/`record` (5.2); task 3's from fixing the check and re-gating (5.1).
  - **R3-3 — Accepted (MINOR).** AC 6.3 now cites `briefs.md:133-137` for the narrow-verify brief location.
