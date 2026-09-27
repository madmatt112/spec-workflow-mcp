# Requirements Document — tdd-task-loop

## Introduction

A task carrying a `- Test:` line gets its failing tests from a separate Sonnet-tier test author before the implementer runs. The gate proves in code that those tests fail on the pre-task code and pass on the finished code, and records the proof on the review. A task without a `Test:` line runs today's loop, so removing the lines is the kill switch.

## Alignment with Product Vision

This store has no `product.md`, so the spec aligns with the spec 11 decomposition entry and `docs/tdd-implementation-research.md` section 0.1. The gate's verdict changes only on facts the code proves; Jev, the one LLM signal, runs in shadow. The author runs on the narrow-role Sonnet tier, and the tasks phase gains one line per marked task.

## Requirements

### Requirement 1 — The Test line in the tasks phase

**User Story:** As a tasks drafter, I want to mark a task with one line naming its test file and the public call it tests through, so that the harness knows which tasks get an author and a proof.

Anchors: src/core/task-parser.ts:108-128, src/core/task-parser.ts:279-297, src/core/lint-types.ts:50-63, src/tools/spec-lint.ts:158-187, src/core/gate-rules.ts:192-198, src/tools/review-gate.ts:102-106.

#### Acceptance Criteria

1. WHEN a task block holds a bullet `- Test:` with a test path by the gate's test-path rule, a space-padded em dash and a call text, THEN THE task parser SHALL add `{ path, seam }` to the task's `tests` array in document order, and SHALL NOT add that line to `files` or `implementationDetails`.
2. IF a task block holds no `Test:` line, THEN THE task parser SHALL emit no `tests` field.
3. WHEN a `Test:` line has no em dash, an empty call text, or a path that is not a test path, THEN THE spec-lint rule `task-test-seam` SHALL report a `warning` on that line, and THE parser SHALL leave it an `implementationDetails` bullet.
4. WHEN a task names a `File:` path that is neither a test path nor a documentation path by the gate's rules and has no `Test:` line, THEN THE rule `task-test-seam` SHALL report an `info` finding on its checkbox line.
5. THE rule `task-test-seam` SHALL run in the `tasks` phase only.
6. THE shipped tasks template SHALL state the `Test:` line shape in its shape rules and carry it in one example task.
7. THE tasks-phase reviewer brief SHALL carry one added lens: for every `Test:` line, the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state.
8. THE tasks phase SHALL gain no other section, cap or gate tag.

### Requirement 2 — The test author

**User Story:** As the implementation orchestrator, I want a separate agent to write a marked task's failing tests from the criteria before any code exists, so that the tests do not share the implementer's blind spots.

Anchors: src/tools/harness.ts:485-535, src/tools/harness.ts:537-538, harness/agents/sdd-implementer.md:1-38, scripts/sync-plugin-assets.cjs:90-134.

#### Acceptance Criteria

1. THE harness SHALL ship an agent `sdd-test-author` with `model: claude-sonnet-5`, `effort: high`, the tools Read, Grep, Glob, Bash, Write and Edit, no MCP tool, and a description that opens `SDD test author:`.
2. THE `harness` `brief` action SHALL accept the template `test-author`, fill its read-and-obey line and task block as it does for `implementer`, and require the values `path`, `title` and `job`.
3. IF the task has no `Test:` line, THEN THE `brief` action SHALL fail for `test-author`, name the task and write no file.
4. THE author SHALL read the task block, the requirement criteria its `_Requirements:` ids name, the design sections it cites, `codebase-context.md`, and one existing test file near the target as the convention; it runs before the implementer and never sees the implementation.
5. THE author SHALL open each test file with a contract block giving, per success criterion, the pre-condition, the call through the seam, the observable result and the source of the expected value.
6. THE author SHALL write one test per success criterion, take every expected value from the criteria, reach the behaviour only through the `Test:` line's call, and mock no collaborator inside the module under test.
7. THE author SHALL create no stub and change no path that is not a test path.
8. WHEN an author test passes on its first run, THEN THE author SHALL rewrite it until it fails, or report `RED-IMPOSSIBLE: <criterion>` when the current code already meets the criterion.
9. WHEN the call cannot be reached as the design describes it, THEN THE author SHALL report `SEAM-DEFECT: <one line>` and commit nothing.
10. THE author SHALL commit only its test files, on the current branch, as `test(<spec>): task <N> red`, and report in 120 words or fewer: the files, one line per test with its red kind, `commit: <sha>`, and the flags `SEAM-DEFECT`, `RED-IMPOSSIBLE`, `RETRO:`.

### Requirement 3 — The implementation loop for a marked task

**User Story:** As the supervisor, I want the phase to run the author, hand its red tests to the implementer and pass the proof inputs to the gate, so that a marked task cannot go `[x]` without the proof.

Anchors: harness/skills/sdd-implementation-phase/SKILL.md:55-68, harness/skills/sdd-implementation-phase/SKILL.md:93-104, harness/skills/sdd-implementation-phase/SKILL.md:209-216, harness/skills/sdd-implementation-phase/references/briefs.md:60-101, harness/skills/sdd-implementation-phase/references/briefs.md:127-159.

#### Acceptance Criteria

1. WHEN the picked task has a `Test:` line, THEN THE orchestrator SHALL, after the `base=` capture and before the implementer, spawn `sdd-test-author` with a `test-author` brief and record `spawn.usage` with `role=author task <N>`.
2. WHEN the author reports `SEAM-DEFECT`, or `RED-IMPOSSIBLE` for every criterion, THEN THE orchestrator SHALL take the existing design-defect stop and spawn no implementer.
3. WHEN the author reports `RED-IMPOSSIBLE` for some criteria only, THEN THE orchestrator SHALL continue and append one `doc-gap` retro-log entry naming them.
4. WHEN a task is marked, THEN its implementer brief and every fix brief SHALL carry `## Red tests (from the test author)` with the author's files, the `Test:` lines and the author's report verbatim. THE `implementer` template SHALL gain a `brief`-filled slot for this section, filled for every task and empty when unmarked; the fix brief uses the `reviser` `{{job}}` value.
5. WHEN an implementer works a marked task, THEN THE implementer SHALL make every author test pass, SHALL NOT edit an author file without reporting `TEST-AMENDED: <file> — <reason>`, MAY add its own tests, and SHALL run the author's files last and report `green: <passed>/<total>`.
6. WHEN the orchestrator gates a marked task, THEN every gate call SHALL carry `tdd: { testFiles, redCommit }` from the author's report.
7. WHEN the gate result carries a `tdd` block, THEN THE verifier brief's `## Gate results` SHALL carry it, and WHEN it shows `amended: true`, THEN THE verifier SHALL judge the amended test against the criteria first.
8. WHEN a task has no `Test:` line, THEN THE orchestrator SHALL spawn no author and pass no `tdd` argument.
9. WHEN the gate result carries a `tdd` block, THEN THE gate `note` SHALL append `tdd <base outcome>` to today's text.
10. WHEN `data.tdd.judged` is present and not a cache hit, THEN THE orchestrator SHALL record one `judge` event with the task, site `tdd`, the four answers, tokens and milliseconds.

### Requirement 4 — The red-on-base proof in the gate

**User Story:** As the supervisor, I want the gate to prove that the author's tests fail before the task and pass after it, so that a vacuous or bent test cannot pass silently.

Anchors: src/tools/review-gate.ts:47-70, src/tools/review-gate.ts:192-209, src/tools/review-task.ts:249-271, src/core/check-runner.ts:5-7, src/core/check-runner.ts:35-44, src/core/git-utils.ts:45-51.

#### Acceptance Criteria

1. THE `review-task` `gate` action SHALL accept an optional `tdd` object with `testFiles` (a non-empty array of root-relative paths) and `redCommit` (a git revision).
2. WHEN the gate is called without `tdd`, THEN its behaviour and response SHALL be identical to today's.
3. IF `tdd` is given in item or files-only mode, THEN THE gate SHALL return `success: false` saying `tdd` needs a task.
4. WHEN a path the red commit changed against its first parent is not a test path, THEN THE gate SHALL fail with `tdd: author changed source: <path>`.
5. WHEN an author file in the root's working tree differs from its red-commit content, THEN THE gate SHALL set `amended: true`.
6. WHEN the proof runs, THEN THE gate SHALL run `git worktree prune`, add a detached worktree of the red commit's first parent in a new directory outside the code root, and remove it in a `finally` path.
7. IF the agent rules carry `red-on-base-setup: <command>`, THEN THE gate SHALL run it in the base worktree; otherwise THE gate SHALL symlink each `node_modules` directory of the code root into it at the same relative path, skipping any inside another `node_modules` or a linked worktree.
8. WHEN the base worktree is ready, THEN THE gate SHALL copy the author files' red-commit content into it, run the agent-rules `tdd-test-command:` with `{files}` replaced by those files there, then run the same command in the code root, each with `CHECK_TIMEOUT_MS` and the scrubbed git environment.
9. WHEN the base run exits non-zero, THEN THE gate SHALL classify its full captured stdout and stderr (not the one-line `runChecks` output) as `assertion-red` when it carries `AssertionError` and no structural marker, else `structural-red`; the structural markers are `Cannot find module`, `is not a function`, `SyntaxError` and `error TS`.
10. WHEN the base run exits 0, THEN THE gate SHALL run it once more, and WHEN that also exits 0, THEN THE base outcome SHALL be `vacuous` and the gate SHALL fail with `tdd: tests pass on base`; a non-zero second run SHALL give `inconclusive`.
11. WHEN the head run exits non-zero or times out, THEN THE gate SHALL fail with `tdd: tests fail on HEAD`.
12. IF a git command fails, the red commit does not resolve, setup fails, the base run times out, `tdd-test-command:` is absent, or the agent rules carry `red-on-base: off`, THEN THE base outcome SHALL be `inconclusive` with that cause and SHALL NOT fail the gate.
13. WHEN `tdd` is given, THEN THE response SHALL carry `data.tdd` = `{ testFiles, seams, redCommit, baseSha, base, head, amended, judged }`, with `seams` the `seam` its `tests[]` entry holds for each `testFiles` path, none for a path without an entry, `base` one of `assertion-red`, `structural-red`, `vacuous`, `inconclusive`, and `head` one of `pass`, `fail`, `not-run`.
14. THE gate SHALL keep at most one output line per proof run in the response and run no configurable test or setup command other than the two agent-rules keys; its own git plumbing is excepted.

Probe for criterion 9 (2026-09-27, vitest 4.0.16, run through `node_modules/.bin/vitest run`): a failed `expect` prints `AssertionError:`, a missing import `Error: Cannot find module`, a missing export `TypeError: … is not a function`, each exiting 1; a passing file exits 0. The last output line is the duration line, so the one-line check output cannot classify.

### Requirement 5 — Risk and the recorded review

**User Story:** As the supervisor, I want a weak proof to raise risk and the proof to travel with the review, so that the verifier and the record show it.

Anchors: src/core/gate-rules.ts:280-359, src/core/gate-rules.ts:384-437, src/tools/review-gate.ts:303-344, src/types.ts:253-263, src/core/task-review-manager.ts:185-313, src/tools/review-task.ts:858-864.

#### Acceptance Criteria

1. THE rules of `scoreRisk` SHALL stay as they are.
2. WHEN the base outcome is `structural-red` or `inconclusive`, or `amended` is true, THEN THE gate SHALL add `tdd-structural-red`, `tdd-inconclusive: <cause>` or `tdd-amended: <files>`, each scoring `high`.
3. WHEN a response carries a `tdd-` reason, THEN its risk SHALL be `high` despite the trivial-change fast path or the no-product-code down-rank.
4. WHEN `tdd` is given, THEN THE gate SHALL count the author files as listed for `file-outside-list` and as touched test paths for `tests-not-touched`.
5. THE `tdd:` fail reasons SHALL fail the gate as today's fail rules do.
6. THE `TaskReview` type SHALL gain an optional `tdd` field of the `data.tdd` shape that the review markdown writes and parses back unchanged; a review without it SHALL read as today.
7. WHEN any review is recorded for a marked task, by the gate or by `review-task` `record`, THEN it SHALL carry the `tdd` block of that task's latest gate run, without the caller passing it.
8. THE spec SHALL NOT skip a verifier that today's rules call for.

### Requirement 6 — Visibility

**User Story:** As Matthew, I want each proof in `spec-status` and the dashboard task view, so that I can judge the loop without the ledger.

Anchors: src/tools/spec-status.ts:179-193, src/dashboard/multi-server.ts:1931-1962, src/dashboard_frontend/src/modules/pages/TasksPage.tsx:1364-1406.

#### Acceptance Criteria

1. WHEN a completed task's latest review carries a `tdd` block, THEN THE `spec-status` response SHALL carry `tddCoverage`: the task count, a count per base outcome and the amended count; otherwise no such field.
2. THE dashboard's task review routes SHALL return the `tdd` block.
3. WHEN a review carries a `tdd` block, THEN THE task view SHALL show one line with base, head, amended and file count on the always-shown task row, not the findings expander that today's `verdict !== 'pass'` gate hides.
4. THE PR body SHALL keep its shape, and THE ledger SHALL gain only the author's `spawn.usage` role, the note's `tdd` word and `judge` events.

### Requirement 7 — Jev in shadow

**User Story:** As Matthew, I want a cheap independent judge to score each author test file against the criteria without routing on it, so that one spec of data can set the thresholds for a later raise-only rule.

Anchors: .gitignore:164, src/watch/ledger.ts:246-250.

#### Acceptance Criteria

1. THE new module `judge.ts` in the server core SHALL send at most one request per gate call, to the endpoint and shape of `docs/jev-integration-research.md` section 1.3, with the key from `TYPESAFE_API_KEY`, model `jev-1.13.0`, a 10-second timeout, one retry on 429 or 529, and no SDK dependency.
2. THE mode SHALL come from `SPEC_WORKFLOW_JUDGE_TDD` (`off`, `shadow`, `enforce`): IF no key is set, THEN `off`; IF a key is set and the variable is unset, THEN `shadow`; `enforce` SHALL act as `shadow` in this spec.
3. WHEN the mode is `shadow`, THEN THE gate SHALL send the author files' red-commit text (48,000 characters at most, truncated with a marker), the task's success criteria, the requirement criteria it cites, its `Test:` lines and the base outcome.
4. THE request SHALL ask `tautological` (noul), `asserts_criteria` (score: none pinned, some with exact values, all with exact values), `through_seam` (noul) and `mocks_internals` (noul).
5. THE module SHALL cache answers under the spec store's `.cache` directory by a content hash of the request body; a hit SHALL send nothing.
6. IF the request errors, times out, or returns a non-2xx status or a malformed body, THEN THE module SHALL return `null` and the gate SHALL set `judged: null` and continue.
7. WHEN answers exist, THEN `judged` SHALL carry the four answers, model, input tokens, milliseconds and `cached`.
8. THE gate's verdict, risk and reasons SHALL be identical under `off` and `shadow`.
9. THE key SHALL live only in this repository's gitignored `.mcp.json` env, never in a brief, tracked file or response; tradr gets no key.

### Requirement 8 — Profiles, agent rules and documentation

**User Story:** As a maintainer, I want the new agent, keys and argument generated and documented like the rest, so that the next spec can run under the loop.

Anchors: harness/agent-profiles.json:1-74, docs/SDD-HARNESS.md:21-23, docs/SDD-HARNESS.md:313-320.

#### Acceptance Criteria

1. THE generated `agent-profiles.json` SHALL list thirteen agents, including `sdd-test-author` with `claude-sonnet-5`, `high` and role `test author`.
2. THE document `docs/SDD-HARNESS.md` SHALL name the new worker (count word updated), its model-policy row, the `Test:` line, the author step, the proof outcomes and the keys `tdd-test-command`, `red-on-base-setup` and `red-on-base`.
3. THE document `docs/TOOLS-REFERENCE.md` SHALL describe the gate's `tdd` argument and `data.tdd`, the `test-author` template and `tddCoverage`; the implementer red-tests slot is internal.
4. THE agent rules of this repository SHALL carry `tdd-test-command: npx vitest run {files}`.

### Requirement 9 — End-to-end verification

**User Story:** As the supervisor, I want one headless scenario over the whole loop, so that the spec closes on evidence.

#### Acceptance Criteria

1. WHEN the implementation phase runs headless (`claude -p`) on a scratch-store fixture against this checkout with tasks ordered marked-honest, unmarked-docs, marked-already-met, THEN the first record SHALL show `assertion-red`, `pass`, `amended: false`; the second SHALL spawn no author and carry no `tdd` block; the third's author SHALL report `RED-IMPOSSIBLE` for every criterion and the phase SHALL take the design-defect stop.
2. WHEN a gate is called in-process with a fixture red commit whose tests pass on its parent, THEN it SHALL fail with `tdd: tests pass on base`.
3. WHEN the run completes, THEN its ledger SHALL carry `spawn.usage role=author task <N>` for both marked tasks, and one `judge` event for the first task when a key is set, none when not.
4. WHEN a spec with no `Test:` line runs, THEN its ledger rows and review records SHALL match today's in shape.
5. THE first task's proof SHALL take under 30 seconds on this checkout.
6. THE checks `npx tsc --noEmit`, `npm test`, `npm run check:plugin-assets` and `claude plugin validate . --strict` SHALL pass.

## Non-Functional Requirements

### Performance
- A marked task costs at most a third more price-weighted tokens than an unmarked one (Sonnet at 0.4 of Opus); the first dogfooded spec measures it from `spawn.end` per role.

### Security
- The base worktree lives outside the code root, and its symlinks point only at the code root's own `node_modules` directories.
- Only this public repository's test files and criteria go to TypeSafe.

### Reliability
- An infrastructure error in the proof or the judge never fails the gate; it yields `inconclusive` or `judged: null`.
- CI runs node 20: proof tests assert only on exit codes and output strings the node 20 `child_process` docs guarantee.

## Decisions taken in this document

- D1 — Seam defects take the design-defect stop: options were that stop, or a narrower tasks-defect stop; chosen because it needs no new supervisor route, and the retro can add the narrow stop.
- D2 — A per-project proof switch, default on: options were an off key in the agent rules, or always running the proof; chosen because a setup failure must not stall a spec, and off still scores every marked task high.
- D3 — Test files and criteria go to TypeSafe in shadow: options were sending this repository's author tests and criteria, or keeping the judge off until a later spec; chosen because the content is already public and shadow data sets the later thresholds; tradr stays off until its DPA is read.
- D4 — The author's files count as listed and as touched test paths: options were counting them, or leaving gate inputs as they are; chosen because the gate range covers only the implementer's commit, so every marked task would otherwise score high on tests-not-touched and could fail the outside-list rule on a true fact.
- D5 — The proof's base is the red commit's parent: options were that parent, or the gate's base ref; chosen because a fix round's base ref already holds the first implementation, reading as vacuous.
- D6 — A task met on every criterion stops the phase: options were the design-defect stop, reverting and continuing, or marking it done unreviewed; chosen because the pick rule would loop on a reverted task and marking done breaks the log gate.
- D7 — The orchestrator writes the judge event: options were the orchestrator through the event script, or the server appending to the ledger; chosen because the watch view keeps only rows carrying the run id the event script stamps.
- D8 — An unclear red counts as structural; a passing base re-runs once: options were structural or inconclusive, and one re-run or none; chosen because it is still a red that raises risk, and one re-run keeps a flake from failing a task.
- D9 — Amended compares the working tree: options were the working tree, or the head commit; chosen because the head run executes the working tree.
- D10 — The server keeps the latest proof for records: options were the server attaching it, or the verifier passing it; chosen because the record must not depend on an agent relay.
- D11 — The author reads criteria and design itself: options were a brief of task block plus paths, or the orchestrator pasting document text; chosen because the orchestrator reads nothing beyond the tasks file.
- D12 — The judge defaults to shadow when a key is set: options were that default, or off until set; chosen because verification counts judge events whenever a key is set.

## Scope notes

- RE-DECIDED: end-to-end scenario item (1). A marked task whose behaviour already exists cannot reach the gate, because an honest author reports it as met (D6). An in-process gate call proves the vacuous failure; the fixture puts that task last; only the first yields a judge event.
- Flag: D4 feeds the author's files to two unchanged rules, so a marked task scores lower than without it.
- Deferred to the first dogfooded spec's retro: the budget measurement, Jev thresholds and enforce mode, and a verifier skip for proven tasks.
- Out of scope: the provider-map line for the author (spec 10) and the control-pane task view (spec 9).

## Revision History

- **v1** (2026-09-27) — Initial draft.
- **v2** (2026-09-27) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/4/2). Closed by ruling: none.
  - R1-1 (SHOULD_FIX): accepted — R6 anchor moved to `TasksPage.tsx:1364-1406` and AC3 names the always-shown task row, not the `verdict !== 'pass'` findings expander.
  - R1-2 (SHOULD_FIX): accepted — R4 AC9 now classifies the base run's full captured stdout/stderr, not the one-line `runChecks` output.
  - R1-3 (SHOULD_FIX): accepted — R3 AC4 names the injection channel: the `implementer` template gains a `brief`-filled slot; the fix brief uses the `reviser` `{{job}}` value.
  - R1-4 (SHOULD_FIX): accepted — R4 AC14 scopes "command" to the two configurable agent-rules keys, git plumbing excepted.
  - R1-5 (MINOR): accepted — R4 AC13 states `seams` is derived from the parsed task's `tests[]`.
  - R1-6 (MINOR): accepted — R1 AC3 states a malformed `Test:` line is not promoted to `tests` and stays an `implementationDetails` bullet.
- **v3** (2026-09-27) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/2). Closed by ruling: none.
  - R2-1 (MUST_FIX, Compounds R1-6): accepted — R1 AC1 now promotes only a `- Test:` line whose path is a test path by the gate's rule, so AC1 and AC3 partition the input and the line `- Test: src/foo.ts — createWidget()` fires AC3 alone (lint warning, stays `implementationDetails`); the shared test-path rule surfaces the parser coupling AC3 needed.
  - R2-2 (SHOULD_FIX, Compounds R1-3): accepted — R3 AC4's slot is now filled for every task and empty when unmarked, so the `brief` action writes a file for the kill-switch path (an empty string passes the required check); AC8 no longer says to write no red section.
  - R2-3 (MINOR): accepted — R4 AC13 now omits a `testFiles` path with no matching `tests[]` entry from `seams`, keeping the shape total.
  - R2-4 (MINOR): partially accepted — R8 AC3 states the implementer red-tests slot is an internal fill; it is filled only by the orchestrator, so it is not a documented TOOLS-REFERENCE surface.
