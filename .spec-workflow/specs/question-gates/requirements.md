# Requirements Document

## Introduction

`question-gates` adds two bounded human gates to the SDD run: gate A confirms the requirements' recorded direction before the review rounds spend cost, and gate B lets a human veto the task plan before implementation. Both gates live in the supervisor (`sdd-continue`), the only role with AskUserQuestion, and both read `gates: block | record` from `agent-rules.md`. Neither gate ever stalls an unattended run: absent or denied AskUserQuestion becomes record mode, which writes the questions to a file and proceeds.

## Alignment with Product Vision

No `steering/product.md` exists, so the decomposition entry (`spec-decomposition/decomposition.md`, spec 7) is the scope authority. This spec is step 3 of `docs/harness-efficiency-plan.md` (R7 of the Harness Spend Review): spend a few human confirmations where a wrong machine assumption would waste whole review rounds or an implementation. It closes the harness-efficiency work after `review-gate`, `spec-lint` and `harness-bookkeeping`.

## Requirements

### Requirement 1 — Gate mode resolution and non-stall

**User Story:** As a run supervisor, I want each gate's mode resolved from configuration and headless state, so that an unattended run never blocks on a human.

#### Acceptance Criteria

1. WHEN a gate runs THEN the supervisor SHALL read `gates: block | record` from `agent-rules.md` when the key is present.
2. IF `agent-rules.md` has no `gates:` key THEN the supervisor SHALL default to `block` when AskUserQuestion is available and `record` when it is not.
3. IF AskUserQuestion is unavailable, returns an error, or returns denied THEN the supervisor SHALL treat the gate as `record` mode and SHALL NOT stall the run.
4. WHEN the supervisor treats a denied AskUserQuestion call as `record` THEN it SHALL NOT change the run ledger's `headless` flag. AskUserQuestion can be denied by a `dontAsk` permission rule even when an allow rule matches (`docs/step-0-answers.md:105`), so a denied call alone does not prove the run is unattended.
5. WHEN a gate runs in `record` mode THEN the supervisor SHALL write the gate's items to `specs/<spec>/questions.md`, write a HANDOFF `## Phase log` row, and proceed.

### Requirement 2 — Gate A: requirements direction confirmation (interactive)

**User Story:** As a human owner, I want to confirm the direction-setting assumptions of requirements v1 before the review rounds, so that a wrong assumption does not cost whole rounds.

#### Acceptance Criteria

1. WHEN the document orchestrator runs the `requirements` phase and checkpoints v1 (document-phase Step 1) THEN it SHALL return `PHASE: gate-a` carrying the direction-setting decisions extracted from `## Decisions taken in this document`, ranked most-direction-setting first, at most five.
2. WHEN the orchestrator resumes the phase from any later state (a review round or a revision pass) THEN it SHALL NOT return `gate-a` again.
3. WHEN the supervisor receives `gate-a` in `block` mode THEN it SHALL ask those decisions with AskUserQuestion, at most five, across at most two calls (the tool takes at most four questions per call).
4. WHEN a human changes an answer THEN the supervisor SHALL re-spawn the document orchestrator with `MODE: revision` and `REVISION_INPUT` naming the changed decisions, so `sdd-reviser` writes v2 before the first adversarial round.
5. WHEN every answer is unchanged THEN the supervisor SHALL record the decisions and the answers to `questions.md`, drop them, and re-spawn the document orchestrator with `MODE: normal` to proceed to round 1 on v1.
6. WHEN a human annotates rather than approves THEN the gate SHALL be advisory: it SHALL NOT hard-block the spec; the only escape hatch is stopping the run.

### Requirement 3 — Gate A: headless or denied

**User Story:** As an unattended run, I want gate A to proceed without a human, so that a `claude -p` run reaches the review rounds.

#### Acceptance Criteria

1. IF AskUserQuestion is unavailable or denied WHEN the supervisor receives `gate-a` THEN it SHALL write the extracted decisions and `no answer` to `specs/<spec>/questions.md`.
2. WHEN gate A proceeds in `record` mode THEN the supervisor SHALL write a HANDOFF `## Phase log` row and re-spawn the document orchestrator with `MODE: normal` to run round 1 on v1 unchanged.

### Requirement 4 — Gate B: veto-list computation

**User Story:** As a reviewer of a task plan, I want the most consequential actions surfaced first, so that I can veto the ones that matter without reading every task.

#### Acceptance Criteria

1. WHEN the `tasks` phase reports `approved` THEN the tasks orchestrator SHALL return one ranked veto list, most consequential first, combining three classes.
2. WHEN class (a) is computed THEN a pure, tunable module SHALL match each task's declared `- File:` paths against the `## Sensitive paths` list, reusing `parseSensitivePaths` and `isSensitivePath` from `src/core/gate-rules.ts:101-135`, and SHALL also match the action keywords migration, delete/drop, auth, billing, config and external write.
3. WHEN classes (b) and (c) are computed THEN the tasks orchestrator SHALL identify new external dependencies the tasks introduce and tasks doing more than the approved requirements asked, from the approved `tasks.md` and `requirements.md`.
4. WHEN the veto list is assembled THEN it SHALL be one list ranked most consequential first, not three separate lists.
5. IF `agent-rules.md` has no `## Sensitive paths` list THEN class (a) SHALL fall back to the module's no-list behaviour without failing the gate.

### Requirement 5 — Gate B: task plan veto (interactive)

**User Story:** As a human owner, I want to veto or annotate the task plan before implementation, so that irreversible or out-of-scope work does not run unreviewed.

#### Acceptance Criteria

1. WHEN the tasks phase reports `approved` and the veto list is returned THEN the supervisor SHALL run gate B before the first implementation spawn, before it enters a worktree.
2. WHEN gate B runs in `block` mode THEN the supervisor SHALL present the task list and the ranked veto list and ask the human to approve or annotate with AskUserQuestion.
3. WHEN the human annotates THEN the supervisor SHALL run exactly one tasks-revision round (advisory), then proceed to implementation.
4. WHEN the human approves THEN the supervisor SHALL proceed to implementation with no revision round.
5. WHEN gate B is advisory THEN it SHALL NOT hard-block the spec; the only escape hatch is stopping the run.

### Requirement 6 — Gate B: headless or denied

**User Story:** As an unattended run, I want gate B to proceed without a human, so that implementation begins on a `claude -p` run.

#### Acceptance Criteria

1. IF AskUserQuestion is unavailable or denied WHEN gate B runs THEN the supervisor SHALL write the veto list to `specs/<spec>/questions.md` and a HANDOFF `## Phase log` row.
2. WHEN gate B proceeds in `record` mode THEN the supervisor SHALL proceed to implementation without stalling.

## Non-Functional Requirements

### Reliability
- Neither gate stalls an unattended run: a missing, errored or denied AskUserQuestion always proceeds in `record` mode (Requirements 1, 3, 6).
- The gate B veto module is pure (no I/O) and tunable in one place, mirroring `src/core/gate-rules.ts`, so a retrospective can move a threshold or keyword without touching the callers.

### Security
- The `## Sensitive paths` list drives class (a); with no list, class (a) matching falls back to the module's no-list behaviour rather than reporting nothing.

## Decisions taken in this document

- D1 — Both gates live in the supervisor (`sdd-continue`): options were the orchestrators or the server; chosen because only the supervisor holds AskUserQuestion (`harness/skills/sdd-continue/SKILL.md:232-261`) and the decomposition pins it.
- D2 — The document orchestrator, not the supervisor, extracts and ranks the gate-A decisions and returns at most five in the `gate-a` outcome: options were supervisor-side extraction or an orchestrator return; chosen because the supervisor never reads spec documents, so ranking by direction must happen where the document is read.
- D3 — Gate A is emitted only from the `requirements` phase and only right after the v1 checkpoint (Step 1): options were a per-phase gate or a resumable flag; chosen because a re-spawn orients to a review round or a revision pass and so never re-fires it, needing no extra state.
- D4 — The supervisor re-spawns the orchestrator with `MODE: revision` (changed answers as revision input) or `MODE: normal` (no change): options were a new mode or reuse; chosen because Step R already turns numbered findings into v2 then a review round.
- D5 — `questions.md` is `specs/<spec>/questions.md`, written by the supervisor: options were the orchestrator or the supervisor as writer; chosen because the supervisor holds the answers and the extracted decisions and already writes spec-store files.
- D6 — Gate B computation is split: a pure module does class (a) path and keyword matching, the tasks orchestrator does classes (b) and (c) from the tasks and requirements: options were an all-mechanical module or all-orchestrator judgment; chosen because path/keyword matching is mechanizable but new-dependency and out-of-scope judgment is not.
- D7 — The class-(a) action keywords are migration, delete/drop, auth, billing, config and external write, kept in the tunable module: options were a hardcoded list or config; chosen because the decomposition names exactly these and one module keeps them next to the reused gate-rules predicates.
- D8 — `gates: block | record` is a new top-of-file key in `agent-rules.md` beside `worktree-per-change`: options were a `## `-heading or a key line; chosen because it is a single scalar and matches the existing key style (`.spec-workflow/agent-rules.md:5-6`).
- D9 — Gate B runs after the `approved` tasks report and before the first implementation spawn and worktree entry: options were before or after worktree entry; chosen because an annotation's one revision round must land before any code work.
- D10 — Objections are advisory: an annotation drives exactly one revision round and neither gate hard-blocks; the escape hatch is stopping the run: chosen because it matches the retrospective conversation and the decomposition pin.
- D11 — The exact server surface that returns `gate-a` and computes the veto list is left to design: options were pinning a tool action now or deferring; chosen because requirements fix behaviour, not the tool shape, and the decomposition pins only that the module is pure and reuses `gate-rules.ts`.

## Scope notes

- Every item the decomposition entry (spec 7) lists is covered: gate A interactive and headless, gate B interactive and headless, mode resolution, and the veto-list classes.
- The `headless` run-ledger flag and the supervisor report contract are consumed from `harness-bookkeeping` (spec 6), and the `## Sensitive paths` convention and `gate-rules.ts` predicates from `review-gate` (spec 4); this spec does not re-specify them.
- The gate B veto module, if added under `src/`, is a pure TypeScript module with no node-version-sensitive behaviour, so the node 20 CI / node 24 local split does not constrain it.
- Nothing from the decomposition entry is cut or deferred.

## Revision History
- **v1** (2026-09-16) — Initial draft.
  - **Lint pass.** 2 fixed; rejected: none.
