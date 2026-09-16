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
5. WHEN a gate runs in `record` mode THEN the supervisor SHALL write the gate's items to `specs/<spec>/questions.md`, write a HANDOFF `## Phase log` row, commit both in the same commit as the supervisor's own HANDOFF edits (`harness/skills/sdd-continue/SKILL.md:60`), and proceed.
6. WHEN a gate's payload (gate A's ranked decisions, or gate B's veto list) crosses from an orchestrator to the supervisor THEN it SHALL cross via a spec-workflow MCP server surface, not the orchestrator's textual report: that report caps at 150 words above the `PHASE:` contract lines and forbids file contents (`harness/skills/sdd-continue/references/formats.md:25-26`; `harness/agents/sdd-document-orchestrator.md:49,51`). The exact tool action is a design decision (D11).

### Requirement 2 — Gate A: requirements direction confirmation (interactive)

**User Story:** As a human owner, I want to confirm the direction-setting assumptions of requirements v1 before the review rounds, so that a wrong assumption does not cost whole rounds.

#### Acceptance Criteria

1. WHEN the drafter writes requirements v1 THEN it SHALL extract and rank, most direction-setting first and at most five, the decisions from its own `## Decisions taken in this document` section, because the document orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`). Each ranked item SHALL carry a `{header, question, options}` triple askable via AskUserQuestion: `question` is the decision's one-line choice, `options` are the chosen option plus the rejected alternatives already named in that decision's "options were" clause.
2. WHEN the document orchestrator checkpoints v1 and the Lint step has run (document-phase Step 1) THEN it SHALL return `PHASE: gate-a` carrying that ranked list, after any lint fixes have landed and before Step 2's first review round, so the human sees the lint-corrected v1 text.
3. WHEN the orchestrator resumes the phase from any later state (a review round or a revision pass) THEN it SHALL NOT return `gate-a` again.
4. WHEN the supervisor receives `gate-a` in `block` mode THEN it SHALL ask those decisions with AskUserQuestion, at most five, across at most two calls (the tool takes at most four questions per call).
5. WHEN a human changes an answer THEN the supervisor SHALL re-spawn the document orchestrator with `MODE: revision` and `REVISION_INPUT` naming the changed decisions, so `sdd-reviser` writes v2 before the first adversarial round.
6. WHEN every answer is unchanged THEN the supervisor SHALL record the decisions and the answers to `questions.md`, drop them, and re-spawn the document orchestrator with `MODE: normal` to proceed to round 1 on v1.
7. WHEN AskUserQuestion returns for a decision, a reply selecting the recorded option with no free text is approve; a reply selecting a different option is change (AC 5); a reply that keeps the recorded option but adds free text is annotate. WHEN a human annotates THEN the supervisor SHALL treat the annotation as revision input, exactly one revision round (re-spawn `MODE: revision`, `REVISION_INPUT` naming the annotation text, matching D10 and Req 5 AC 3's gate-B annotation), and record the decisions and the annotation to `questions.md`. The gate SHALL NOT hard-block the spec; the only escape hatch is stopping the run.

### Requirement 3 — Gate A: headless or denied

**User Story:** As an unattended run, I want gate A to proceed without a human, so that a `claude -p` run reaches the review rounds.

#### Acceptance Criteria

1. IF AskUserQuestion is unavailable, denied, or returns an error WHEN the supervisor receives `gate-a` THEN it SHALL write the extracted decisions and `no answer` to `specs/<spec>/questions.md`.
2. WHEN gate A proceeds in `record` mode THEN the supervisor SHALL write a HANDOFF `## Phase log` row and re-spawn the document orchestrator with `MODE: normal` to run round 1 on v1 unchanged.

### Requirement 4 — Gate B: veto-list computation

**User Story:** As a reviewer of a task plan, I want the most consequential actions surfaced first, so that I can veto the ones that matter without reading every task.

#### Acceptance Criteria

1. WHEN the `tasks` phase reports `approved` THEN the tasks orchestrator SHALL return one ranked veto list, most consequential first, combining three classes.
2. WHEN class (a) is computed THEN a pure, tunable module SHALL match each task's declared `- File:` paths against the `## Sensitive paths` list, reusing `parseSensitivePaths` and `isSensitivePath` from `src/core/gate-rules.ts:101-135`, and SHALL also match the action keywords migration, delete/drop, auth, billing, config and external write.
3. WHEN classes (b) and (c) are computed THEN the tasks orchestrator SHALL identify new external dependencies the tasks introduce and tasks doing more than the approved requirements asked, from the approved `tasks.md` and `requirements.md`.
4. WHEN the veto list is assembled THEN it SHALL be one list ranked most consequential first, not three separate lists.
5. IF `agent-rules.md` has no `## Sensitive paths` list THEN class (a)'s path match SHALL match no path (an empty list), while its action-keyword match (AC 2) SHALL still fire on every task; class (a) SHALL NOT reuse `gate-rules.ts`'s `NO_LIST_REASON` "every path is sensitive" convention (`src/core/gate-rules.ts:26,260-261`, consumed at `src/tools/review-gate.ts:177-179`), which would flood the veto list with every task. The gate SHALL NOT fail for a missing list.

### Requirement 5 — Gate B: task plan veto (interactive)

**User Story:** As a human owner, I want to veto or annotate the task plan before implementation, so that irreversible or out-of-scope work does not run unreviewed.

#### Acceptance Criteria

1. WHEN the tasks phase reports `approved` and the veto list is returned THEN the supervisor SHALL run gate B before the first implementation spawn, before it enters a worktree.
2. WHEN gate B runs in `block` mode THEN the supervisor SHALL present the task list and the ranked veto list and ask the human to approve or annotate with AskUserQuestion; a reply with no free text is approve (AC 4), and a reply carrying free text on any option is annotate (AC 3).
3. WHEN the human annotates THEN the supervisor SHALL run exactly one tasks-revision round (advisory), then proceed to implementation.
4. WHEN the human approves THEN the supervisor SHALL proceed to implementation with no revision round.
5. WHEN gate B is advisory THEN it SHALL NOT hard-block the spec; the only escape hatch is stopping the run.
6. Gate B runs at most once per spec. WHEN the tasks orchestrator resumes the tasks phase in `MODE: revision` — AC 3's own annotation-driven revision round, or a design-defect tasks revalidation (`harness/skills/sdd-continue/SKILL.md:198-203`) — and reports `approved` again THEN it SHALL NOT return a new veto list, and the supervisor SHALL proceed directly to implementation without running gate B a second time.

### Requirement 6 — Gate B: headless or denied

**User Story:** As an unattended run, I want gate B to proceed without a human, so that implementation begins on a `claude -p` run.

#### Acceptance Criteria

1. IF AskUserQuestion is unavailable, denied, or returns an error WHEN gate B runs THEN the supervisor SHALL write the veto list to `specs/<spec>/questions.md` and a HANDOFF `## Phase log` row.
2. WHEN gate B proceeds in `record` mode THEN the supervisor SHALL proceed to implementation without stalling.

## Non-Functional Requirements

### Reliability
- Neither gate stalls an unattended run: a missing, errored or denied AskUserQuestion always proceeds in `record` mode (Requirements 1, 3, 6).
- The gate B veto module is pure (no I/O) and tunable in one place, mirroring `src/core/gate-rules.ts`, so a retrospective can move a threshold or keyword without touching the callers.

### Security
- The `## Sensitive paths` list drives class (a)'s path match; with no list, class (a) matches no path (empty, not `gate-rules.ts`'s every-path-sensitive default) while its keyword match still fires, so a missing list never floods the veto list.

## Decisions taken in this document

- D1 — Both gates live in the supervisor (`sdd-continue`): options were the orchestrators or the server; chosen because only the supervisor holds AskUserQuestion (`harness/skills/sdd-continue/SKILL.md:232-261`) and the decomposition pins it.
- D2 — The drafter extracts and ranks the gate-A decisions (at most five) when it writes v1; the document orchestrator's `gate-a` return only carries that list: options were supervisor-side extraction, orchestrator-side extraction, or drafter-side extraction; chosen because the orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`) while the drafter already writes and reads the section it produces.
- D3 — Gate A is emitted only from the `requirements` phase and only right after the v1 checkpoint (Step 1): options were a per-phase gate or a resumable flag; chosen because a re-spawn orients to a review round or a revision pass and so never re-fires it, needing no extra state.
- D4 — The supervisor re-spawns the orchestrator with `MODE: revision` (changed answers as revision input) or `MODE: normal` (no change): options were a new mode or reuse; chosen because Step R already turns numbered findings into v2 then a review round.
- D5 — `questions.md` is `specs/<spec>/questions.md`, written by the supervisor: options were the orchestrator or the supervisor as writer; chosen because the supervisor holds the answers and the extracted decisions and already writes spec-store files.
- D6 — Gate B computation is split: a pure module does class (a) path and keyword matching, the tasks orchestrator does classes (b) and (c) from the tasks and requirements: options were an all-mechanical module or all-orchestrator judgment; chosen because path/keyword matching is mechanizable but new-dependency and out-of-scope judgment is not.
- D7 — The class-(a) action keywords are migration, delete/drop, auth, billing, config and external write, kept in the tunable module: options were a hardcoded list or config; chosen because the decomposition names exactly these and one module keeps them next to the reused gate-rules predicates.
- D8 — `gates: block | record` is a new top-of-file key in `agent-rules.md` beside `worktree-per-change`: options were a `## `-heading or a key line; chosen because it is a single scalar and matches the existing key style (`.spec-workflow/agent-rules.md:5-6`).
- D9 — Gate B runs after the `approved` tasks report and before the first implementation spawn and worktree entry: options were before or after worktree entry; chosen because an annotation's one revision round must land before any code work.
- D10 — Objections are advisory: an annotation drives exactly one revision round and neither gate hard-blocks; the escape hatch is stopping the run: chosen because it matches the retrospective conversation and the decomposition pin.
- D11 — The exact server surface that returns `gate-a` and computes the veto list is left to design: options were pinning a tool action now or deferring; chosen because requirements fix behaviour, not the tool shape, and the decomposition pins only that the module is pure and reuses `gate-rules.ts`. Requirement 1 AC 6 pins that the payload crosses via a server surface, not the orchestrator's 150-word report; only which surface is deferred.

## Scope notes

- Every item the decomposition entry (spec 7) lists is covered: gate A interactive and headless, gate B interactive and headless, mode resolution, and the veto-list classes.
- The `headless` run-ledger flag and the supervisor report contract are consumed from `harness-bookkeeping` (spec 6), and the `## Sensitive paths` convention and `gate-rules.ts` predicates from `review-gate` (spec 4); this spec does not re-specify them.
- The gate B veto module, if added under `src/`, is a pure TypeScript module with no node-version-sensitive behaviour, so the node 20 CI / node 24 local split does not constrain it.
- Nothing from the decomposition entry is cut or deferred.

## Revision History
- **v1** (2026-09-16) — Initial draft.
  - **Lint pass.** 2 fixed; rejected: none.
- **v2** (2026-09-16) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/4/4).
  - **R1-1 — Accepted (MUST_FIX).** Added Req 5 AC 6: gate B runs at most once per spec; its own annotation revision round and a design-defect tasks revalidation do not re-fire it.
  - **R1-2 — Accepted (SHOULD_FIX).** Added Req 1 AC 6: gate-A decisions and the gate-B veto list cross via a server surface, not the 150-word orchestrator report; noted in D11.
  - **R1-3 — Accepted (MINOR).** Folded into Req 2 AC 1: each ranked decision now carries a `{header, question, options}` triple, owned by the drafter.
  - **R1-4 — Accepted (SHOULD_FIX).** Req 2 AC 1 and D2 reassign extraction and ranking to the drafter (who writes the section), not the orchestrator, whose standing rule forbids reading the body.
  - **R1-5 — Accepted (SHOULD_FIX).** Req 4 AC 5 now states class (a)'s no-list behaviour explicitly (no path match, keywords still fire); also applied to the Security NFR bullet.
  - **R1-6 — Accepted (SHOULD_FIX).** Req 2 AC 7 routes a gate-A annotation to one revision round (matching D10) and maps AskUserQuestion's reply to approve/change/annotate; also applied to Req 5 AC 2 for gate B.
  - **R1-7 — Accepted (MINOR).** Req 3 AC 1 and Req 6 AC 1 both add the "returns an error" case already general in Req 1 AC 3.
  - **R1-8 — Accepted (MINOR).** Req 1 AC 5 adds that `questions.md` and the HANDOFF row commit together; "no answer" content was already pinned in Req 3/6 AC 1.
  - **R1-9 — Accepted (MINOR).** Req 2 AC 2 now fires `gate-a` after the Lint step, before round 1, so the human sees lint-corrected text.
