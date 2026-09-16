# Adversarial Review — question-gates/requirements (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v3 review)

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v3 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v3 lint commit changed: the `## Lint commit` section below (the v3 lint commit changed no body citations — it only appended a Revision History disposition bullet). Still open (error = MUST_FIX candidate, warning = your call, info = a note) — all nine are the same recurring `citation-identifier` false positive the v2 and v3 lint passes rejected (a backtick-wrapped defined term of this document — `record`, `headless`, `question`, `options` — sitting on a line that also carries a citation scoped to a different clause). Confirm the rejection or, with new evidence, overturn one:
  - L-1 (warning, citation-identifier, line 22): 'record' absent (docs/step-0-answers.md:105).
  - L-2 (warning, citation-identifier, line 22): 'headless' absent (docs/step-0-answers.md:105).
  - L-3 (warning, citation-identifier, line 23): 'record' absent (harness/skills/sdd-continue/SKILL.md:60).
  - L-4 (warning, citation-identifier, line 32): 'question' absent (harness/skills/sdd-document-phase/SKILL.md:20).
  - L-5 (warning, citation-identifier, line 32): 'options' absent (harness/skills/sdd-document-phase/SKILL.md:20).
  - L-6..L-9 (warning, citation-identifier, line 125): 'record'/'headless'/'question'/'options' absent from the three fix-source citations in the v3 Revision History disposition bullet.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): question-gates requirements v2` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v3 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R2-<n>`, naming the round-2 finding whose fix wrote the clause.
- Fresh lens for this round: failure, rollback and partial-failure paths — trace what each gate requires when the surrounding machinery misbehaves: AskUserQuestion returns partially or times out, the `questions.md` write fails, the HANDOFF `## Phase log` row cannot be written, the run crashes between a gate decision and the phase it gates, or a `MODE: revision` round is interrupted. Find each path the acceptance criteria leave undefined.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold above says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 59decb3

````diff
diff --git a/.spec-workflow/specs/question-gates/requirements.md b/.spec-workflow/specs/question-gates/requirements.md
index 83fa17f..40269fe 100644
--- a/.spec-workflow/specs/question-gates/requirements.md
+++ b/.spec-workflow/specs/question-gates/requirements.md
@@ -21,7 +21,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 3. IF AskUserQuestion is unavailable, returns an error, or returns denied THEN the supervisor SHALL treat the gate as `record` mode and SHALL NOT stall the run.
 4. WHEN the supervisor treats a denied AskUserQuestion call as `record` THEN it SHALL NOT change the run ledger's `headless` flag. AskUserQuestion can be denied by a `dontAsk` permission rule even when an allow rule matches (`docs/step-0-answers.md:105`), so a denied call alone does not prove the run is unattended.
 5. WHEN a gate runs in `record` mode THEN the supervisor SHALL write the gate's items to `specs/<spec>/questions.md`, write a HANDOFF `## Phase log` row, commit both in the same commit as the supervisor's own HANDOFF edits (`harness/skills/sdd-continue/SKILL.md:60`), and proceed.
-6. WHEN a gate's payload (gate A's ranked decisions, or gate B's veto list) crosses from an orchestrator to the supervisor THEN it SHALL cross via a spec-workflow MCP server surface, not the orchestrator's textual report: that report caps at 150 words above the `PHASE:` contract lines and forbids file contents (`harness/skills/sdd-continue/references/formats.md:25-26`; `harness/agents/sdd-document-orchestrator.md:49,51`). The exact tool action is a design decision (D11).
+6. WHEN a gate's payload crosses to the supervisor THEN it SHALL cross via a spec-workflow MCP server surface, not a worker's textual report: gate A's ranked list is written directly to that surface by the drafter (Req 2 AC 1), whose own report caps at 150 words and forbids file contents (`harness/agents/sdd-drafter.md:26`); gate B's veto list is written by the tasks orchestrator, whose report caps at 150 words above the `PHASE:` contract lines and forbids file contents (`harness/skills/sdd-continue/references/formats.md:25-26`; `harness/agents/sdd-document-orchestrator.md:49,51`). The document orchestrator's `gate-a` return (Req 2 AC 2) only signals that the surface already holds the list; it never carries the payload itself. The exact tool action, and which actor calls it, is a design decision (D11).
 
 ### Requirement 2 — Gate A: requirements direction confirmation (interactive)
 
@@ -29,13 +29,12 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 
 #### Acceptance Criteria
 
-1. WHEN the drafter writes requirements v1 THEN it SHALL extract and rank, most direction-setting first and at most five, the decisions from its own `## Decisions taken in this document` section, because the document orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`). Each ranked item SHALL carry a `{header, question, options}` triple askable via AskUserQuestion: `question` is the decision's one-line choice, `options` are the chosen option plus the rejected alternatives already named in that decision's "options were" clause.
-2. WHEN the document orchestrator checkpoints v1 and the Lint step has run (document-phase Step 1) THEN it SHALL return `PHASE: gate-a` carrying that ranked list, after any lint fixes have landed and before Step 2's first review round, so the human sees the lint-corrected v1 text.
+1. WHEN the drafter writes requirements v1 THEN it SHALL extract and rank, most direction-setting first and at most five, the decisions from its own `## Decisions taken in this document` section, because the document orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`). Each ranked item SHALL carry a `{header, question, options}` triple askable via AskUserQuestion: `question` is the decision's one-line choice, `options` are the chosen option plus the rejected alternatives already named in that decision's "options were" clause. The drafter SHALL write that ranked list of triples directly to the gate-A server surface (Req 1 AC 6) before its report; the document orchestrator never reads or relays it.
+2. WHEN the document orchestrator checkpoints v1 and the Lint step has run (document-phase Step 1) THEN it SHALL return `PHASE: gate-a`, signalling that the drafter's ranked list already sits on the server surface (Req 2 AC 1), after any lint fixes have landed and before Step 2's first review round, so the human sees the lint-corrected v1 text. A Lint-step fix SHALL NOT reword a ranked decision's question text or its "options were" clause; if a lint finding needs such a reword, the drafter SHALL rewrite that decision's triple on the server surface before gate-a fires.
 3. WHEN the orchestrator resumes the phase from any later state (a review round or a revision pass) THEN it SHALL NOT return `gate-a` again.
 4. WHEN the supervisor receives `gate-a` in `block` mode THEN it SHALL ask those decisions with AskUserQuestion, at most five, across at most two calls (the tool takes at most four questions per call).
-5. WHEN a human changes an answer THEN the supervisor SHALL re-spawn the document orchestrator with `MODE: revision` and `REVISION_INPUT` naming the changed decisions, so `sdd-reviser` writes v2 before the first adversarial round.
-6. WHEN every answer is unchanged THEN the supervisor SHALL record the decisions and the answers to `questions.md`, drop them, and re-spawn the document orchestrator with `MODE: normal` to proceed to round 1 on v1.
-7. WHEN AskUserQuestion returns for a decision, a reply selecting the recorded option with no free text is approve; a reply selecting a different option is change (AC 5); a reply that keeps the recorded option but adds free text is annotate. WHEN a human annotates THEN the supervisor SHALL treat the annotation as revision input, exactly one revision round (re-spawn `MODE: revision`, `REVISION_INPUT` naming the annotation text, matching D10 and Req 5 AC 3's gate-B annotation), and record the decisions and the annotation to `questions.md`. The gate SHALL NOT hard-block the spec; the only escape hatch is stopping the run.
+5. WHEN AskUserQuestion returns for gate A's decisions THEN the supervisor SHALL treat a decision as approve when the reply selects the recorded option with no free text, and as needing revision otherwise (a different option, added free text, or both). WHEN any decision needs revision THEN the supervisor SHALL re-spawn the document orchestrator exactly once with `MODE: revision` and `REVISION_INPUT` naming, per such decision, its new option (if changed) and its free text (if any) — matching D10 and Req 5 AC 3's gate-B annotation — so `sdd-reviser` writes v2 covering all of them before the first adversarial round, and SHALL record every decision, its final answer, and any free text to `questions.md`.
+6. WHEN every decision is approve THEN the supervisor SHALL record the decisions and the answers to `questions.md`, drop them, and re-spawn the document orchestrator with `MODE: normal` to proceed to round 1 on v1. The gate SHALL NOT hard-block the spec; the only escape hatch is stopping the run.
 
 ### Requirement 3 — Gate A: headless or denied
 
@@ -52,7 +51,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 
 #### Acceptance Criteria
 
-1. WHEN the `tasks` phase reports `approved` THEN the tasks orchestrator SHALL return one ranked veto list, most consequential first, combining three classes.
+1. WHEN the `tasks` phase reports `approved` for the first time in a spec (`MODE: normal`) THEN the tasks orchestrator SHALL return one ranked veto list, most consequential first, combining three classes; Req 5 AC 6 states the sole exception, a later revision-mode re-approval, for which the orchestrator SHALL NOT return a new list.
 2. WHEN class (a) is computed THEN a pure, tunable module SHALL match each task's declared `- File:` paths against the `## Sensitive paths` list, reusing `parseSensitivePaths` and `isSensitivePath` from `src/core/gate-rules.ts:101-135`, and SHALL also match the action keywords migration, delete/drop, auth, billing, config and external write.
 3. WHEN classes (b) and (c) are computed THEN the tasks orchestrator SHALL identify new external dependencies the tasks introduce and tasks doing more than the approved requirements asked, from the approved `tasks.md` and `requirements.md`.
 4. WHEN the veto list is assembled THEN it SHALL be one list ranked most consequential first, not three separate lists.
@@ -92,7 +91,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 ## Decisions taken in this document
 
 - D1 — Both gates live in the supervisor (`sdd-continue`): options were the orchestrators or the server; chosen because only the supervisor holds AskUserQuestion (`harness/skills/sdd-continue/SKILL.md:232-261`) and the decomposition pins it.
-- D2 — The drafter extracts and ranks the gate-A decisions (at most five) when it writes v1; the document orchestrator's `gate-a` return only carries that list: options were supervisor-side extraction, orchestrator-side extraction, or drafter-side extraction; chosen because the orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`) while the drafter already writes and reads the section it produces.
+- D2 — The drafter extracts and ranks the gate-A decisions (at most five) when it writes v1 and writes the ranked triples directly to the gate-A server surface; the document orchestrator's `gate-a` return only signals that the surface holds the list: options were supervisor-side extraction, orchestrator-side extraction, or drafter-side extraction; chosen because the orchestrator's standing rule forbids reading the document body (`harness/skills/sdd-document-phase/SKILL.md:20`) while the drafter already writes and reads the section it produces and needs no relay through the orchestrator's capped report.
 - D3 — Gate A is emitted only from the `requirements` phase and only right after the v1 checkpoint (Step 1): options were a per-phase gate or a resumable flag; chosen because a re-spawn orients to a review round or a revision pass and so never re-fires it, needing no extra state.
 - D4 — The supervisor re-spawns the orchestrator with `MODE: revision` (changed answers as revision input) or `MODE: normal` (no change): options were a new mode or reuse; chosen because Step R already turns numbered findings into v2 then a review round.
 - D5 — `questions.md` is `specs/<spec>/questions.md`, written by the supervisor: options were the orchestrator or the supervisor as writer; chosen because the supervisor holds the answers and the extracted decisions and already writes spec-store files.
@@ -101,7 +100,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 - D8 — `gates: block | record` is a new top-of-file key in `agent-rules.md` beside `worktree-per-change`: options were a `## `-heading or a key line; chosen because it is a single scalar and matches the existing key style (`.spec-workflow/agent-rules.md:5-6`).
 - D9 — Gate B runs after the `approved` tasks report and before the first implementation spawn and worktree entry: options were before or after worktree entry; chosen because an annotation's one revision round must land before any code work.
 - D10 — Objections are advisory: an annotation drives exactly one revision round and neither gate hard-blocks; the escape hatch is stopping the run: chosen because it matches the retrospective conversation and the decomposition pin.
-- D11 — The exact server surface that returns `gate-a` and computes the veto list is left to design: options were pinning a tool action now or deferring; chosen because requirements fix behaviour, not the tool shape, and the decomposition pins only that the module is pure and reuses `gate-rules.ts`. Requirement 1 AC 6 pins that the payload crosses via a server surface, not the orchestrator's 150-word report; only which surface is deferred.
+- D11 — The exact server surface that returns `gate-a` and computes the veto list is left to design: options were pinning a tool action now or deferring; chosen because requirements fix behaviour, not the tool shape, and the decomposition pins only that the module is pure and reuses `gate-rules.ts`. Requirement 1 AC 6 pins that gate A's payload crosses via a server surface the drafter writes directly and gate B's via one the tasks orchestrator writes; only which tool call each uses is deferred.
 
 ## Scope notes
 
@@ -124,3 +123,11 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
   - **R1-8 — Accepted (MINOR).** Req 1 AC 5 adds that `questions.md` and the HANDOFF row commit together; "no answer" content was already pinned in Req 3/6 AC 1.
   - **R1-9 — Accepted (MINOR).** Req 2 AC 2 now fires `gate-a` after the Lint step, before round 1, so the human sees lint-corrected text.
   - **Lint pass.** 0 fixed; rejected: L-1 (`docs/step-0-answers.md:105` backs only the dontAsk/allow-rule clause; `record` is this document's own gate-mode term, not cited content), L-2 (same citation; `headless` is this document's own ledger-flag name, not cited content), L-3 (`harness/skills/sdd-continue/SKILL.md:60` backs only the commit-together clause; `record` is this document's own gate-mode term, not cited content), L-4 (`harness/skills/sdd-document-phase/SKILL.md:20` backs only the forbids-reading-the-body clause; `question` is this document's own AskUserQuestion payload key, not cited content), L-5 (same citation; `options` is this document's own payload key, not cited content).
+- **v3** (2026-09-16) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/2/3).
+  - **R2-1 — Accepted (MUST_FIX).** Req 4 AC 1 now fires only on the first (`MODE: normal`) `approved` report and cross-references Req 5 AC 6's revision-mode exception, resolving the contradiction on a revision-mode re-approval.
+  - **R2-2 — Accepted (SHOULD_FIX).** Req 2 AC 1 now has the drafter write the ranked triples directly to the gate-A server surface, and Req 1 AC 6, D2 and D11 are corrected: the document orchestrator's `gate-a` return (Req 2 AC 2) only signals the surface holds the list, so the unspecified drafter→orchestrator hop no longer exists.
+  - **R2-3 — Accepted (SHOULD_FIX).** Req 2 AC 5 now classifies each decision's reply as approve or needing-revision (option change, added free text, or both) and fires exactly one `MODE: revision` round naming every such decision, resolving the mixed change+annotate double-route.
+  - **R2-4 — Accepted (MINOR).** Folded into the same Req 2 AC 5 rewrite: `REVISION_INPUT` now names both a changed option and any free text per decision, so a changed option's free text is no longer dropped.
+  - **R2-5 — Accepted (MINOR).** Req 2 AC 2 now forbids a Lint-step fix from rewording a ranked decision's question text or "options were" clause, and requires the drafter to rewrite the triple on the server surface first if a lint finding needs such a reword, closing the pre/post-lint staleness gap.
+  - **R2-6 — Accepted (MINOR).** Folded into the same Req 2 AC 5 rewrite: the revision branch now records every decision, its final answer, and any free text to `questions.md`, matching the approve branch (AC 6) instead of recording nothing.
+  - **Lint pass.** 0 fixed; rejected: L-1 (`docs/step-0-answers.md:105` backs only the dontAsk/allow-rule clause; `record` is this document's own gate-mode term, not cited content), L-2 (same citation; `headless` is this document's own ledger-flag name, not cited content), L-3 (`harness/skills/sdd-continue/SKILL.md:60` backs only the commit-together clause; `record` is this document's own gate-mode term, not cited content), L-4 (`harness/skills/sdd-document-phase/SKILL.md:20` backs only the forbids-reading-the-body clause; `question` is this document's own AskUserQuestion payload key, not cited content), L-5 (same citation; `options` is this document's own payload key, not cited content), L-6 (the v2 Lint-pass bullet's own rejection note for L-1/L-3 states that `record` is not backed by those citations; flagging that explanatory text as an unbacked claim misreads it — rejecting preserves the v2 disposition record verbatim), L-7 (same line's rejection note for `headless`, same reasoning), L-8 (same line's rejection note for `question`, same reasoning), L-9 (same line's rejection note for `options`, same reasoning).
````

## Lint commit 71f9ba6

````diff
diff --git a/.spec-workflow/specs/question-gates/requirements.md b/.spec-workflow/specs/question-gates/requirements.md
index 797515e..40269fe 100644
--- a/.spec-workflow/specs/question-gates/requirements.md
+++ b/.spec-workflow/specs/question-gates/requirements.md
@@ -130,3 +130,4 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
   - **R2-4 — Accepted (MINOR).** Folded into the same Req 2 AC 5 rewrite: `REVISION_INPUT` now names both a changed option and any free text per decision, so a changed option's free text is no longer dropped.
   - **R2-5 — Accepted (MINOR).** Req 2 AC 2 now forbids a Lint-step fix from rewording a ranked decision's question text or "options were" clause, and requires the drafter to rewrite the triple on the server surface first if a lint finding needs such a reword, closing the pre/post-lint staleness gap.
   - **R2-6 — Accepted (MINOR).** Folded into the same Req 2 AC 5 rewrite: the revision branch now records every decision, its final answer, and any free text to `questions.md`, matching the approve branch (AC 6) instead of recording nothing.
+  - **Lint pass.** 0 fixed; rejected: L-1 (`docs/step-0-answers.md:105` backs only the dontAsk/allow-rule clause; `record` is this document's own gate-mode term, not cited content), L-2 (same citation; `headless` is this document's own ledger-flag name, not cited content), L-3 (`harness/skills/sdd-continue/SKILL.md:60` backs only the commit-together clause; `record` is this document's own gate-mode term, not cited content), L-4 (`harness/skills/sdd-document-phase/SKILL.md:20` backs only the forbids-reading-the-body clause; `question` is this document's own AskUserQuestion payload key, not cited content), L-5 (same citation; `options` is this document's own payload key, not cited content), L-6 (the v2 Lint-pass bullet's own rejection note for L-1/L-3 states that `record` is not backed by those citations; flagging that explanatory text as an unbacked claim misreads it — rejecting preserves the v2 disposition record verbatim), L-7 (same line's rejection note for `headless`, same reasoning), L-8 (same line's rejection note for `question`, same reasoning), L-9 (same line's rejection note for `options`, same reasoning).
````
