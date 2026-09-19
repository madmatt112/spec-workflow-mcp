# Requirements Document
Document version: v4

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
6. WHEN a gate's payload crosses to the supervisor THEN it SHALL cross via a spec-workflow MCP server surface, not a worker's textual report: gate A's ranked list is written directly to that surface by the drafter (Req 2 AC 1), whose frontmatter gains the MCP write tool for this (D2) and whose report caps at 150 words and forbids file contents (`harness/agents/sdd-drafter.md:26`); gate B's veto list is written by the tasks orchestrator, whose report caps at 150 words above the `PHASE:` contract lines and forbids file contents (`harness/skills/sdd-continue/references/formats.md:25-26`; `harness/agents/sdd-document-orchestrator.md:49,51`). The document orchestrator's `gate-a` return (Req 2 AC 2) only signals that the surface already holds the list; it never carries the payload itself. The exact tool action, and which actor calls it, is a design decision (D11).

### Requirement 2 — Gate A: requirements direction confirmation (interactive)

**User Story:** As a human owner, I want to confirm the direction-setting assumptions of requirements v1 before the review rounds, so that a wrong assumption does not cost whole rounds.

#### Acceptance Criteria

1. WHEN the drafter writes requirements v1 THEN it SHALL extract and rank, most direction-setting first and at most five, the decisions from its own `## Decisions taken in this document` section, because the document orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`). Each ranked item SHALL carry a `{header, question, options}` triple askable via AskUserQuestion: `question` is the decision's one-line choice, `options` are the chosen option plus the rejected alternatives already named in that decision's "options were" clause. The drafter's frontmatter SHALL gain the MCP tool this write uses (D2); the drafter SHALL write the ranked list of triples directly to the gate-A server surface (Req 1 AC 6) before its report; the document orchestrator never reads or relays it.
2. WHEN the document orchestrator checkpoints v1 and the Lint step has run (document-phase Step 1) THEN it SHALL return `PHASE: gate-a`, signalling that the drafter's ranked list already sits on the server surface (Req 2 AC 1), after any lint fixes have landed and before Step 2's first review round, so the human sees the lint-corrected v1 text. A Lint-step fix SHALL NOT reword a ranked decision's question text or its "options were" clause; if a lint finding needs such a reword, the drafter SHALL rewrite that decision's triple on the server surface before gate-a fires.
3. WHEN the orchestrator resumes the phase from any later state (a review round or a revision pass) THEN it SHALL NOT return `gate-a` again.
4. WHEN the supervisor receives `gate-a` in `block` mode THEN it SHALL ask those decisions with AskUserQuestion, at most five, across at most two calls (the tool takes at most four questions per call). IF the second call is denied, errors, or times out after the first answered THEN the supervisor SHALL keep those answers, treat only the unreturned decisions as `no answer` (Req 3 AC 1), and proceed under AC 5/AC 6, not discarding the first call's answers.
5. WHEN AskUserQuestion returns for gate A's decisions THEN the supervisor SHALL treat a decision as approve when the reply selects the recorded option with no free text, and as needing revision otherwise (a different option, added free text, or both). WHEN any decision needs revision THEN the supervisor SHALL re-spawn the document orchestrator exactly once with `MODE: revision` and `REVISION_INPUT` naming, per such decision, its new option (if changed) and its free text (if any) — matching D10 and Req 5 AC 3's gate-B annotation — so `sdd-reviser` writes v2 covering all of them before the first adversarial round, and SHALL record every decision, its final answer, and any free text to `questions.md`.
6. WHEN every decision is approve THEN the supervisor SHALL record the decisions and the answers to `questions.md`, drop them, and re-spawn the document orchestrator with `MODE: normal` to proceed to round 1 on v1. The gate SHALL NOT hard-block the spec; the only escape hatch is stopping the run.
7. WHEN the supervisor receives `gate-a` THEN, before it asks, it SHALL write a durable receipt (the extracted decisions, no `answer`) to `specs/<spec>/questions.md` and commit it — best-effort; a write/commit failure SHALL NOT stall the run (Req 1 AC 5). WHEN step 3 (`harness/skills/sdd-continue/SKILL.md:122`) finds that receipt unanswered THEN the supervisor SHALL re-ask or fall to `record` mode (Req 3 AC 1) instead of re-spawning `MODE: normal` straight to round 1.

### Requirement 3 — Gate A: headless or denied

**User Story:** As an unattended run, I want gate A to proceed without a human, so that a `claude -p` run reaches the review rounds.

#### Acceptance Criteria

1. IF AskUserQuestion is unavailable, denied, or returns an error WHEN the supervisor receives `gate-a` THEN it SHALL write the extracted decisions and `no answer` to `specs/<spec>/questions.md`.
2. WHEN gate A proceeds in `record` mode THEN the supervisor SHALL write a HANDOFF `## Phase log` row and re-spawn the document orchestrator with `MODE: normal` to run round 1 on v1 unchanged.

### Requirement 4 — Gate B: veto-list computation

**User Story:** As a reviewer of a task plan, I want the most consequential actions surfaced first, so that I can veto the ones that matter without reading every task.

#### Acceptance Criteria

1. WHEN the `tasks` phase reports `approved` for the first time in a spec (`MODE: normal`) THEN the tasks orchestrator SHALL return one ranked veto list, most consequential first, combining three classes; Req 5 AC 6 states the sole exception, a later revision-mode re-approval, for which the orchestrator SHALL NOT return a new list.
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
- D2 — The drafter extracts and ranks the gate-A decisions (at most five) when it writes v1 and writes the ranked triples directly to the gate-A server surface; the document orchestrator's `gate-a` return only signals that the surface holds the list: options were supervisor-side extraction, orchestrator-side extraction, or drafter-side extraction; chosen because the orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`); its frontmatter (`harness/agents/sdd-drafter.md:7-13`) gains one MCP write tool for this, matching the reviser's grant (`harness/agents/sdd-reviser.md:7-16`), so the payload needs no relay through the orchestrator's capped report.
- D3 — Gate A is emitted only from the `requirements` phase and only right after the v1 checkpoint (Step 1): options were a per-phase gate or a resumable flag; chosen because a re-spawn orients to a review round or a revision pass and so never re-fires it, needing no extra state.
- D4 — The supervisor re-spawns the orchestrator with `MODE: revision` (changed answers as revision input) or `MODE: normal` (no change): options were a new mode or reuse; chosen because Step R already turns numbered findings into v2 then a review round.
- D5 — `questions.md` is `specs/<spec>/questions.md`, written by the supervisor: options were the orchestrator or the supervisor as writer; chosen because the supervisor holds the answers and the extracted decisions and already writes spec-store files.
- D6 — Gate B computation is split: a pure module does class (a) path and keyword matching, the tasks orchestrator does classes (b) and (c) from the tasks and requirements: options were an all-mechanical module or all-orchestrator judgment; chosen because path/keyword matching is mechanizable but new-dependency and out-of-scope judgment is not.
- D7 — The class-(a) action keywords are migration, delete/drop, auth, billing, config and external write, kept in the tunable module: options were a hardcoded list or config; chosen because the decomposition names exactly these and one module keeps them next to the reused gate-rules predicates.
- D8 — `gates: block | record` is a new top-of-file key in `agent-rules.md` beside `worktree-per-change`: options were a `## `-heading or a key line; chosen because it is a single scalar and matches the existing key style (`.spec-workflow/agent-rules.md:5-6`).
- D9 — Gate B runs after the `approved` tasks report and before the first implementation spawn and worktree entry: options were before or after worktree entry; chosen because an annotation's one revision round must land before any code work.
- D10 — Objections are advisory: an annotation drives exactly one revision round and neither gate hard-blocks; the escape hatch is stopping the run: chosen because it matches the retrospective conversation and the decomposition pin.
- D11 — The exact server surface that returns `gate-a` and computes the veto list is left to design: options were pinning a tool action now or deferring; chosen because requirements fix behaviour, not the tool shape, and the decomposition pins only that the module is pure and reuses `gate-rules.ts`. Requirement 1 AC 6 pins that gate A's payload crosses via a server surface the drafter writes directly and gate B's via one the tasks orchestrator writes; only which tool call each uses is deferred (D2 pins the drafter's tool grant).

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
  - **Lint pass.** 0 fixed; rejected: L-1 (`docs/step-0-answers.md:105` backs only the dontAsk/allow-rule clause; `record` is this document's own gate-mode term, not cited content), L-2 (same citation; `headless` is this document's own ledger-flag name, not cited content), L-3 (`harness/skills/sdd-continue/SKILL.md:60` backs only the commit-together clause; `record` is this document's own gate-mode term, not cited content), L-4 (`harness/skills/sdd-document-phase/SKILL.md:20` backs only the forbids-reading-the-body clause; `question` is this document's own AskUserQuestion payload key, not cited content), L-5 (same citation; `options` is this document's own payload key, not cited content).
- **v3** (2026-09-16) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/2/3).
  - **R2-1 — Accepted (MUST_FIX).** Req 4 AC 1 now fires only on the first (`MODE: normal`) `approved` report and cross-references Req 5 AC 6's revision-mode exception, resolving the contradiction on a revision-mode re-approval.
  - **R2-2 — Accepted (SHOULD_FIX).** Req 2 AC 1 now has the drafter write the ranked triples directly to the gate-A server surface, and Req 1 AC 6, D2 and D11 are corrected: the document orchestrator's `gate-a` return (Req 2 AC 2) only signals the surface holds the list, so the unspecified drafter→orchestrator hop no longer exists.
  - **R2-3 — Accepted (SHOULD_FIX).** Req 2 AC 5 now classifies each decision's reply as approve or needing-revision (option change, added free text, or both) and fires exactly one `MODE: revision` round naming every such decision, resolving the mixed change+annotate double-route.
  - **R2-4 — Accepted (MINOR).** Folded into the same Req 2 AC 5 rewrite: `REVISION_INPUT` now names both a changed option and any free text per decision, so a changed option's free text is no longer dropped.
  - **R2-5 — Accepted (MINOR).** Req 2 AC 2 now forbids a Lint-step fix from rewording a ranked decision's question text or "options were" clause, and requires the drafter to rewrite the triple on the server surface first if a lint finding needs such a reword, closing the pre/post-lint staleness gap.
  - **R2-6 — Accepted (MINOR).** Folded into the same Req 2 AC 5 rewrite: the revision branch now records every decision, its final answer, and any free text to `questions.md`, matching the approve branch (AC 6) instead of recording nothing.
  - **Lint pass.** 0 fixed; rejected: L-1 (`docs/step-0-answers.md:105` backs only the dontAsk/allow-rule clause; `record` is this document's own gate-mode term, not cited content), L-2 (same citation; `headless` is this document's own ledger-flag name, not cited content), L-3 (`harness/skills/sdd-continue/SKILL.md:60` backs only the commit-together clause; `record` is this document's own gate-mode term, not cited content), L-4 (`harness/skills/sdd-document-phase/SKILL.md:20` backs only the forbids-reading-the-body clause; `question` is this document's own AskUserQuestion payload key, not cited content), L-5 (same citation; `options` is this document's own payload key, not cited content), L-6 (the v2 Lint-pass bullet's own rejection note for L-1/L-3 states that `record` is not backed by those citations; flagging that explanatory text as an unbacked claim misreads it — rejecting preserves the v2 disposition record verbatim), L-7 (same line's rejection note for `headless`, same reasoning), L-8 (same line's rejection note for `question`, same reasoning), L-9 (same line's rejection note for `options`, same reasoning).
- **v4** (2026-09-16) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md, verdict iterate 0/3/1), SHOULD_FIX-only corrective pass.
  - **R3-1 — Accepted (SHOULD_FIX). Compounds R2-2.** Deleted Req 2 AC 1's compounded claim that the drafter writes the gate-A list "directly to the gate-A server surface"; replaced with the provable claim that its frontmatter gains the MCP write tool this needs (`harness/agents/sdd-drafter.md:7-13`), probed against the reviser's single-MCP-tool grant (`harness/agents/sdd-reviser.md:7-16`). Also applied to Req 1 AC 6, D2 (deleted the false "needs no relay" clause), and D11.
  - **R3-2 — Accepted (SHOULD_FIX). Novel.** Added Req 2 AC 7: the supervisor writes a durable `questions.md` receipt before asking; a fresh supervisor whose step-3 routing (`harness/skills/sdd-continue/SKILL.md:122`) finds it unanswered re-asks or falls to `record`, instead of silently dropping gate A (D3's "no extra state").
  - **R3-3 — Accepted (SHOULD_FIX). Novel.** Extended Req 2 AC 4: a second-call denial/error/timeout after the first answered keeps those answers, treats the rest as `no answer`, closing the undefined partial-return gap.
  - **R3-4 — Folded in (MINOR).** Req 2 AC 7's receipt write states best-effort: it does not stall the run.
  - **Lint pass.** 2 fixed; rejected: L-1 through L-15 (the recurring citation-identifier warnings the v2 and v3 lint passes already dispositioned — each flagged term is this document's own defined term on a line whose citation is scoped to a different clause; standing reason applies unchanged, including where L-8 through L-15 re-flag the v2/v3 Lint-pass bullets' own rejection notes), L-6/L-7 (`harness/skills/sdd-continue/SKILL.md:122` backs only the step-3/requirements-routing location the sentence names, not the `answer`/`record` outcome of the new receipt check this spec adds; both are this document's own terms, same standing reason).
