# Adversarial Review — question-gates/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note):
  - L-1 (warning, citation-identifier, line 22): Identifier 'record' is absent from the cited ranges (docs/step-0-answers.md:105) — the lint reviser rejected it (`record` is this document's own gate-mode term; the citation backs only the dontAsk/allow-rule clause). Confirm or overturn.
  - L-2 (warning, citation-identifier, line 22): Identifier 'headless' is absent from the cited ranges (docs/step-0-answers.md:105) — rejected (own run-ledger flag name). Confirm or overturn.
  - L-3 (warning, citation-identifier, line 23): Identifier 'record' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:60) — rejected (own gate-mode term; citation backs only the commit-together clause). Confirm or overturn.
  - L-4 (warning, citation-identifier, line 32): Identifier 'question' is absent from the cited ranges (harness/skills/sdd-document-phase/SKILL.md:20) — rejected (own AskUserQuestion payload key). Confirm or overturn.
  - L-5 (warning, citation-identifier, line 32): Identifier 'options' is absent from the cited ranges (harness/skills/sdd-document-phase/SKILL.md:20) — rejected (own payload key). Confirm or overturn.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): question-gates requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause.
- Fresh lens for this round: a cold read for internal contradictions and a truth table of the stated cases — enumerate the gate modes (block vs record, interactive vs headless/denied) against both gates (A and B) and each AskUserQuestion return (approve / change / annotate), and find any case the acceptance criteria leave undefined or contradict.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold above says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since d0d0cce

````diff
diff --git a/.spec-workflow/specs/question-gates/requirements.md b/.spec-workflow/specs/question-gates/requirements.md
index c224f2f..83fa17f 100644
--- a/.spec-workflow/specs/question-gates/requirements.md
+++ b/.spec-workflow/specs/question-gates/requirements.md
@@ -20,7 +20,8 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 2. IF `agent-rules.md` has no `gates:` key THEN the supervisor SHALL default to `block` when AskUserQuestion is available and `record` when it is not.
 3. IF AskUserQuestion is unavailable, returns an error, or returns denied THEN the supervisor SHALL treat the gate as `record` mode and SHALL NOT stall the run.
 4. WHEN the supervisor treats a denied AskUserQuestion call as `record` THEN it SHALL NOT change the run ledger's `headless` flag. AskUserQuestion can be denied by a `dontAsk` permission rule even when an allow rule matches (`docs/step-0-answers.md:105`), so a denied call alone does not prove the run is unattended.
-5. WHEN a gate runs in `record` mode THEN the supervisor SHALL write the gate's items to `specs/<spec>/questions.md`, write a HANDOFF `## Phase log` row, and proceed.
+5. WHEN a gate runs in `record` mode THEN the supervisor SHALL write the gate's items to `specs/<spec>/questions.md`, write a HANDOFF `## Phase log` row, commit both in the same commit as the supervisor's own HANDOFF edits (`harness/skills/sdd-continue/SKILL.md:60`), and proceed.
+6. WHEN a gate's payload (gate A's ranked decisions, or gate B's veto list) crosses from an orchestrator to the supervisor THEN it SHALL cross via a spec-workflow MCP server surface, not the orchestrator's textual report: that report caps at 150 words above the `PHASE:` contract lines and forbids file contents (`harness/skills/sdd-continue/references/formats.md:25-26`; `harness/agents/sdd-document-orchestrator.md:49,51`). The exact tool action is a design decision (D11).
 
 ### Requirement 2 — Gate A: requirements direction confirmation (interactive)
 
@@ -28,12 +29,13 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 
 #### Acceptance Criteria
 
-1. WHEN the document orchestrator runs the `requirements` phase and checkpoints v1 (document-phase Step 1) THEN it SHALL return `PHASE: gate-a` carrying the direction-setting decisions extracted from `## Decisions taken in this document`, ranked most-direction-setting first, at most five.
-2. WHEN the orchestrator resumes the phase from any later state (a review round or a revision pass) THEN it SHALL NOT return `gate-a` again.
-3. WHEN the supervisor receives `gate-a` in `block` mode THEN it SHALL ask those decisions with AskUserQuestion, at most five, across at most two calls (the tool takes at most four questions per call).
-4. WHEN a human changes an answer THEN the supervisor SHALL re-spawn the document orchestrator with `MODE: revision` and `REVISION_INPUT` naming the changed decisions, so `sdd-reviser` writes v2 before the first adversarial round.
-5. WHEN every answer is unchanged THEN the supervisor SHALL record the decisions and the answers to `questions.md`, drop them, and re-spawn the document orchestrator with `MODE: normal` to proceed to round 1 on v1.
-6. WHEN a human annotates rather than approves THEN the gate SHALL be advisory: it SHALL NOT hard-block the spec; the only escape hatch is stopping the run.
+1. WHEN the drafter writes requirements v1 THEN it SHALL extract and rank, most direction-setting first and at most five, the decisions from its own `## Decisions taken in this document` section, because the document orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`). Each ranked item SHALL carry a `{header, question, options}` triple askable via AskUserQuestion: `question` is the decision's one-line choice, `options` are the chosen option plus the rejected alternatives already named in that decision's "options were" clause.
+2. WHEN the document orchestrator checkpoints v1 and the Lint step has run (document-phase Step 1) THEN it SHALL return `PHASE: gate-a` carrying that ranked list, after any lint fixes have landed and before Step 2's first review round, so the human sees the lint-corrected v1 text.
+3. WHEN the orchestrator resumes the phase from any later state (a review round or a revision pass) THEN it SHALL NOT return `gate-a` again.
+4. WHEN the supervisor receives `gate-a` in `block` mode THEN it SHALL ask those decisions with AskUserQuestion, at most five, across at most two calls (the tool takes at most four questions per call).
+5. WHEN a human changes an answer THEN the supervisor SHALL re-spawn the document orchestrator with `MODE: revision` and `REVISION_INPUT` naming the changed decisions, so `sdd-reviser` writes v2 before the first adversarial round.
+6. WHEN every answer is unchanged THEN the supervisor SHALL record the decisions and the answers to `questions.md`, drop them, and re-spawn the document orchestrator with `MODE: normal` to proceed to round 1 on v1.
+7. WHEN AskUserQuestion returns for a decision, a reply selecting the recorded option with no free text is approve; a reply selecting a different option is change (AC 5); a reply that keeps the recorded option but adds free text is annotate. WHEN a human annotates THEN the supervisor SHALL treat the annotation as revision input, exactly one revision round (re-spawn `MODE: revision`, `REVISION_INPUT` naming the annotation text, matching D10 and Req 5 AC 3's gate-B annotation), and record the decisions and the annotation to `questions.md`. The gate SHALL NOT hard-block the spec; the only escape hatch is stopping the run.
 
 ### Requirement 3 — Gate A: headless or denied
 
@@ -41,7 +43,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 
 #### Acceptance Criteria
 
-1. IF AskUserQuestion is unavailable or denied WHEN the supervisor receives `gate-a` THEN it SHALL write the extracted decisions and `no answer` to `specs/<spec>/questions.md`.
+1. IF AskUserQuestion is unavailable, denied, or returns an error WHEN the supervisor receives `gate-a` THEN it SHALL write the extracted decisions and `no answer` to `specs/<spec>/questions.md`.
 2. WHEN gate A proceeds in `record` mode THEN the supervisor SHALL write a HANDOFF `## Phase log` row and re-spawn the document orchestrator with `MODE: normal` to run round 1 on v1 unchanged.
 
 ### Requirement 4 — Gate B: veto-list computation
@@ -54,7 +56,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 2. WHEN class (a) is computed THEN a pure, tunable module SHALL match each task's declared `- File:` paths against the `## Sensitive paths` list, reusing `parseSensitivePaths` and `isSensitivePath` from `src/core/gate-rules.ts:101-135`, and SHALL also match the action keywords migration, delete/drop, auth, billing, config and external write.
 3. WHEN classes (b) and (c) are computed THEN the tasks orchestrator SHALL identify new external dependencies the tasks introduce and tasks doing more than the approved requirements asked, from the approved `tasks.md` and `requirements.md`.
 4. WHEN the veto list is assembled THEN it SHALL be one list ranked most consequential first, not three separate lists.
-5. IF `agent-rules.md` has no `## Sensitive paths` list THEN class (a) SHALL fall back to the module's no-list behaviour without failing the gate.
+5. IF `agent-rules.md` has no `## Sensitive paths` list THEN class (a)'s path match SHALL match no path (an empty list), while its action-keyword match (AC 2) SHALL still fire on every task; class (a) SHALL NOT reuse `gate-rules.ts`'s `NO_LIST_REASON` "every path is sensitive" convention (`src/core/gate-rules.ts:26,260-261`, consumed at `src/tools/review-gate.ts:177-179`), which would flood the veto list with every task. The gate SHALL NOT fail for a missing list.
 
 ### Requirement 5 — Gate B: task plan veto (interactive)
 
@@ -63,10 +65,11 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 #### Acceptance Criteria
 
 1. WHEN the tasks phase reports `approved` and the veto list is returned THEN the supervisor SHALL run gate B before the first implementation spawn, before it enters a worktree.
-2. WHEN gate B runs in `block` mode THEN the supervisor SHALL present the task list and the ranked veto list and ask the human to approve or annotate with AskUserQuestion.
+2. WHEN gate B runs in `block` mode THEN the supervisor SHALL present the task list and the ranked veto list and ask the human to approve or annotate with AskUserQuestion; a reply with no free text is approve (AC 4), and a reply carrying free text on any option is annotate (AC 3).
 3. WHEN the human annotates THEN the supervisor SHALL run exactly one tasks-revision round (advisory), then proceed to implementation.
 4. WHEN the human approves THEN the supervisor SHALL proceed to implementation with no revision round.
 5. WHEN gate B is advisory THEN it SHALL NOT hard-block the spec; the only escape hatch is stopping the run.
+6. Gate B runs at most once per spec. WHEN the tasks orchestrator resumes the tasks phase in `MODE: revision` — AC 3's own annotation-driven revision round, or a design-defect tasks revalidation (`harness/skills/sdd-continue/SKILL.md:198-203`) — and reports `approved` again THEN it SHALL NOT return a new veto list, and the supervisor SHALL proceed directly to implementation without running gate B a second time.
 
 ### Requirement 6 — Gate B: headless or denied
 
@@ -74,7 +77,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 
 #### Acceptance Criteria
 
-1. IF AskUserQuestion is unavailable or denied WHEN gate B runs THEN the supervisor SHALL write the veto list to `specs/<spec>/questions.md` and a HANDOFF `## Phase log` row.
+1. IF AskUserQuestion is unavailable, denied, or returns an error WHEN gate B runs THEN the supervisor SHALL write the veto list to `specs/<spec>/questions.md` and a HANDOFF `## Phase log` row.
 2. WHEN gate B proceeds in `record` mode THEN the supervisor SHALL proceed to implementation without stalling.
 
 ## Non-Functional Requirements
@@ -84,12 +87,12 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 - The gate B veto module is pure (no I/O) and tunable in one place, mirroring `src/core/gate-rules.ts`, so a retrospective can move a threshold or keyword without touching the callers.
 
 ### Security
-- The `## Sensitive paths` list drives class (a); with no list, class (a) matching falls back to the module's no-list behaviour rather than reporting nothing.
+- The `## Sensitive paths` list drives class (a)'s path match; with no list, class (a) matches no path (empty, not `gate-rules.ts`'s every-path-sensitive default) while its keyword match still fires, so a missing list never floods the veto list.
 
 ## Decisions taken in this document
 
 - D1 — Both gates live in the supervisor (`sdd-continue`): options were the orchestrators or the server; chosen because only the supervisor holds AskUserQuestion (`harness/skills/sdd-continue/SKILL.md:232-261`) and the decomposition pins it.
-- D2 — The document orchestrator, not the supervisor, extracts and ranks the gate-A decisions and returns at most five in the `gate-a` outcome: options were supervisor-side extraction or an orchestrator return; chosen because the supervisor never reads spec documents, so ranking by direction must happen where the document is read.
+- D2 — The drafter extracts and ranks the gate-A decisions (at most five) when it writes v1; the document orchestrator's `gate-a` return only carries that list: options were supervisor-side extraction, orchestrator-side extraction, or drafter-side extraction; chosen because the orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`) while the drafter already writes and reads the section it produces.
 - D3 — Gate A is emitted only from the `requirements` phase and only right after the v1 checkpoint (Step 1): options were a per-phase gate or a resumable flag; chosen because a re-spawn orients to a review round or a revision pass and so never re-fires it, needing no extra state.
 - D4 — The supervisor re-spawns the orchestrator with `MODE: revision` (changed answers as revision input) or `MODE: normal` (no change): options were a new mode or reuse; chosen because Step R already turns numbered findings into v2 then a review round.
 - D5 — `questions.md` is `specs/<spec>/questions.md`, written by the supervisor: options were the orchestrator or the supervisor as writer; chosen because the supervisor holds the answers and the extracted decisions and already writes spec-store files.
@@ -98,7 +101,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 - D8 — `gates: block | record` is a new top-of-file key in `agent-rules.md` beside `worktree-per-change`: options were a `## `-heading or a key line; chosen because it is a single scalar and matches the existing key style (`.spec-workflow/agent-rules.md:5-6`).
 - D9 — Gate B runs after the `approved` tasks report and before the first implementation spawn and worktree entry: options were before or after worktree entry; chosen because an annotation's one revision round must land before any code work.
 - D10 — Objections are advisory: an annotation drives exactly one revision round and neither gate hard-blocks; the escape hatch is stopping the run: chosen because it matches the retrospective conversation and the decomposition pin.
-- D11 — The exact server surface that returns `gate-a` and computes the veto list is left to design: options were pinning a tool action now or deferring; chosen because requirements fix behaviour, not the tool shape, and the decomposition pins only that the module is pure and reuses `gate-rules.ts`.
+- D11 — The exact server surface that returns `gate-a` and computes the veto list is left to design: options were pinning a tool action now or deferring; chosen because requirements fix behaviour, not the tool shape, and the decomposition pins only that the module is pure and reuses `gate-rules.ts`. Requirement 1 AC 6 pins that the payload crosses via a server surface, not the orchestrator's 150-word report; only which surface is deferred.
 
 ## Scope notes
 
@@ -110,3 +113,14 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 ## Revision History
 - **v1** (2026-09-16) — Initial draft.
   - **Lint pass.** 2 fixed; rejected: none.
+- **v2** (2026-09-16) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/4/4).
+  - **R1-1 — Accepted (MUST_FIX).** Added Req 5 AC 6: gate B runs at most once per spec; its own annotation revision round and a design-defect tasks revalidation do not re-fire it.
+  - **R1-2 — Accepted (SHOULD_FIX).** Added Req 1 AC 6: gate-A decisions and the gate-B veto list cross via a server surface, not the 150-word orchestrator report; noted in D11.
+  - **R1-3 — Accepted (MINOR).** Folded into Req 2 AC 1: each ranked decision now carries a `{header, question, options}` triple, owned by the drafter.
+  - **R1-4 — Accepted (SHOULD_FIX).** Req 2 AC 1 and D2 reassign extraction and ranking to the drafter (who writes the section), not the orchestrator, whose standing rule forbids reading the body.
+  - **R1-5 — Accepted (SHOULD_FIX).** Req 4 AC 5 now states class (a)'s no-list behaviour explicitly (no path match, keywords still fire); also applied to the Security NFR bullet.
+  - **R1-6 — Accepted (SHOULD_FIX).** Req 2 AC 7 routes a gate-A annotation to one revision round (matching D10) and maps AskUserQuestion's reply to approve/change/annotate; also applied to Req 5 AC 2 for gate B.
+  - **R1-7 — Accepted (MINOR).** Req 3 AC 1 and Req 6 AC 1 both add the "returns an error" case already general in Req 1 AC 3.
+  - **R1-8 — Accepted (MINOR).** Req 1 AC 5 adds that `questions.md` and the HANDOFF row commit together; "no answer" content was already pinned in Req 3/6 AC 1.
+  - **R1-9 — Accepted (MINOR).** Req 2 AC 2 now fires `gate-a` after the Lint step, before round 1, so the human sees lint-corrected text.
+  - **Lint pass.** 0 fixed; rejected: L-1 (`docs/step-0-answers.md:105` backs only the dontAsk/allow-rule clause; `record` is this document's own gate-mode term, not cited content), L-2 (same citation; `headless` is this document's own ledger-flag name, not cited content), L-3 (`harness/skills/sdd-continue/SKILL.md:60` backs only the commit-together clause; `record` is this document's own gate-mode term, not cited content), L-4 (`harness/skills/sdd-document-phase/SKILL.md:20` backs only the forbids-reading-the-body clause; `question` is this document's own AskUserQuestion payload key, not cited content), L-5 (same citation; `options` is this document's own payload key, not cited content).
````

## Lint commit 59decb3

````diff
diff --git a/.spec-workflow/specs/question-gates/requirements.md b/.spec-workflow/specs/question-gates/requirements.md
index 08ee4c3..83fa17f 100644
--- a/.spec-workflow/specs/question-gates/requirements.md
+++ b/.spec-workflow/specs/question-gates/requirements.md
@@ -123,3 +123,4 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
   - **R1-7 — Accepted (MINOR).** Req 3 AC 1 and Req 6 AC 1 both add the "returns an error" case already general in Req 1 AC 3.
   - **R1-8 — Accepted (MINOR).** Req 1 AC 5 adds that `questions.md` and the HANDOFF row commit together; "no answer" content was already pinned in Req 3/6 AC 1.
   - **R1-9 — Accepted (MINOR).** Req 2 AC 2 now fires `gate-a` after the Lint step, before round 1, so the human sees lint-corrected text.
+  - **Lint pass.** 0 fixed; rejected: L-1 (`docs/step-0-answers.md:105` backs only the dontAsk/allow-rule clause; `record` is this document's own gate-mode term, not cited content), L-2 (same citation; `headless` is this document's own ledger-flag name, not cited content), L-3 (`harness/skills/sdd-continue/SKILL.md:60` backs only the commit-together clause; `record` is this document's own gate-mode term, not cited content), L-4 (`harness/skills/sdd-document-phase/SKILL.md:20` backs only the forbids-reading-the-body clause; `question` is this document's own AskUserQuestion payload key, not cited content), L-5 (same citation; `options` is this document's own payload key, not cited content).
````
