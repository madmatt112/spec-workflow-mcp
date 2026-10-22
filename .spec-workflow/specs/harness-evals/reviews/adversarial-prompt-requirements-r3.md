# Adversarial Review — harness-evals/requirements (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-requirements-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-requirements-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v3 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v3 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): harness-evals requirements v2` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v3 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 2a6a2a8

````diff
diff --git a/.spec-workflow/specs/harness-evals/requirements.md b/.spec-workflow/specs/harness-evals/requirements.md
index 9be51a4..c96af4e 100644
--- a/.spec-workflow/specs/harness-evals/requirements.md
+++ b/.spec-workflow/specs/harness-evals/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-This spec adds eval cases: each one runs one harness role on a frozen brief and a small fixture repository, three times, and code grades the role's report and the repository after each run. It is for the operator, who today finds a role regression only when a live run escalates, blocks a PR or edits the wrong tree. It changes the staged self-update (`scripts/sdd-self-update.sh`), which runs the cases of every changed role or brief template and refuses the deploy on a failure, and it makes the retrospective propose a new case for each role or brief defect.
+This spec adds eval cases: each runs one harness role on a frozen brief and a small fixture repository, three times, with code grading the report and the repository after each run. It serves the operator, who today catches a role regression only when a live run escalates, blocks a PR or edits the wrong tree. It changes the staged self-update (`scripts/sdd-self-update.sh`) to run the cases of every changed role or brief template and refuse the deploy on a failure, and makes the retrospective propose a case for each role or brief defect.
 
 ## Alignment with Product Vision
 
-The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:165-185`, decisions 18 to 25). Grill decision 1 puts verification first; an eval case is verification of the harness itself, run before its change goes live. The glossary already defines the term (`./GLOSSARY.md:52-55`): a case comes from a failure the harness had, so the suite grows only from real failures.
+The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:165-185`, decisions 18 to 25). Grill decision 1 puts verification first; an eval case verifies the harness itself before its change goes live. The glossary defines the term (`./GLOSSARY.md:52-55`): a case comes from a failure the harness had, so the suite grows only from real failures.
 
 ## Requirements
 
@@ -14,7 +14,7 @@ The steering directory holds no `product.md`, so this section aligns with the 20
 
 **User Story:** As the operator, I want each eval case to be a small checked-in definition, so that a case is reviewed, versioned and landed like any other harness file.
 
-Today a role runs only inside a controller run, through `runStep` (`src/controller/step.ts:343-516`), with a brief rendered from a named template (`src/tools/brief-templates.ts:1584-1678`).
+A role runs only inside a controller run, through `runStep` (`src/controller/step.ts:343-516`), with a brief rendered from a named template (`src/tools/brief-templates.ts:1584-1678`).
 
 #### Acceptance Criteria
 
@@ -44,16 +44,16 @@ Today a role runs only inside a controller run, through `runStep` (`src/controll
 
 **User Story:** As the operator, I want the self-update to run the cases of every changed role file or brief template before the change goes live, so that a known role failure never ships twice.
 
-Today the self-update moves the live checkout to `origin/main` in step (b) before it builds and smoke-boots the staging worktree (`scripts/sdd-self-update.sh:104-215`). The running controller reads role files from the live checkout at every step (`src/controller/step.ts:146-150`, `src/controller/step.ts:229-242`), so a role change is live as soon as step (b) runs.
+The self-update moves the live checkout to `origin/main` in step (b) before it builds and smoke-boots the staging worktree (`scripts/sdd-self-update.sh:104-215`). The controller reads role files from the live checkout at every step (`src/controller/step.ts:146-150`, `src/controller/step.ts:229-242`), so a role change goes live as soon as step (b) runs.
 
 #### Acceptance Criteria
 
-1. The self-update SHALL select a case WHEN, between the live checkout's HEAD before the update and `origin/main`, any of these changed: the case's own directory, its role file, its role's entry in `harness/agent-profiles.json`, the grader code it names, or the text its brief template renders with the case's values (rendered once by each of the two commits and compared).
+1. The self-update SHALL select a case WHEN, between the live checkout's HEAD before the update and `origin/main`, any of these changed: the case's own directory, its role file, its role's entry in `harness/agent-profiles.json`, the grader code it names, or the text any brief template the case renders produces with the case's values (each brief rendered by both commits and compared).
 2. WHEN at least one case is selected THEN the self-update SHALL run the selected cases with the staged build after the staged build and the smoke boot pass, and before it moves the live checkout or swaps `dist/`.
 3. IF any selected case fails or is inconclusive AND no override (Requirement 4) covers it THEN the self-update SHALL exit non-zero, leave the live checkout's HEAD, its `harness/` files and `dist/` unchanged, and write an `error` wait (as `write_error_wait` does, `scripts/sdd-self-update.sh:45-60`) whose text names the commit, each failing or inconclusive case id with its first grader reason or classification, and the result record path.
 4. WHEN every selected case passes THEN the self-update SHALL continue with the live checkout move, the swap and the restart as today.
 5. Invariant (verified, not red-first): WHEN no case is selected THEN the self-update SHALL run no model step and behave as today.
-6. WHEN the self-update runs with `--dry-run` THEN it SHALL print the selected case ids and the reason each was selected, run no case, and change nothing. Because `--dry-run` skips the staging build (`scripts/sdd-self-update.sh:179-182`), it cannot render `origin/main`'s brief text; for the rendered-text input (criterion 1) it SHALL instead diff the template render function's source between the two commits and mark a case selected by that signal alone provisional. The real build computes the diff exactly.
+6. WHEN the self-update runs with `--dry-run` THEN it SHALL print the selected case ids and the reason each was selected, run no case, and change nothing. Because `--dry-run` skips the staging build (`scripts/sdd-self-update.sh:179-182`), it cannot render `origin/main`'s brief text; for the rendered-text input (criterion 1) it SHALL instead diff the source of every render function and shared helper the case's templates use between the two commits and mark a case selected by that signal alone provisional. The real build computes the diff exactly.
 7. The self-update SHALL print one line per selected case with its verdict and run count (for example `eval test-author-trailer: pass 3/3`).
 8. The live-checkout move SHALL keep today's rules for the store-only rebase and the refusals (`scripts/sdd-self-update.sh:116-174`), only later in the sequence.
 
@@ -82,7 +82,7 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
    - `closeout-landing-root`: a close-out batch whose landing root is a worktree of the fixture and whose item names files by the main checkout's absolute paths. The graders SHALL require the main checkout's HEAD and working tree to be unchanged and the item's commit to be on the landing root's branch (`src/tools/brief-templates.ts:1509`). Evidence: the shout close-out (`docs/foundation-review.md:671-673`).
    - `closeout-reversing-proposal`: a close-out item whose change reverses a decision recorded in the fixture's design document. The graders SHALL require no commit that touches the item's files and a report that marks the item as needing a human decision. Evidence: the whisper close-out P3 (`docs/foundation-review.md:700-703`).
 2. The drafter brief template SHALL stop telling a tasks drafter to write `- Test (integration):` (`src/tools/brief-templates.ts:129-133`); it SHALL say instead that coverage which already holds at base is noted in the task as a regression guard, matching the role rule (`harness/agents/sdd-drafter.md:25`). No code routes on that label today; the canonical `- Test:` pattern is the only one the parser reads (`src/core/task-parser.ts:14`).
-3. WHEN the deploy that lands this spec runs THEN all five cases SHALL be selected (their directories are new) and SHALL pass 3 of 3.
+3. WHEN the deploy that lands this spec runs THEN all five cases SHALL be selected (their directories are new). The four cases other than `closeout-reversing-proposal` SHALL pass 3 of 3; `closeout-reversing-proposal` is expected to, and a failure under that bar is handled by an `--eval-override` (Requirement 4), not a landing block.
 4. Invariant (verified, not red-first): the three deterministic cases other than `drafter-test-seam-label` and `closeout-reversing-proposal` SHALL pass at base as regression guards, each guarding a rule already in the role files or the close-out brief (`harness/agents/sdd-test-author.md:29-31`, `src/tools/brief-templates.ts:1509`). `closeout-reversing-proposal` guards a judgment rule in the standing brief (`src/tools/brief-templates.ts:1487-1489`) and is expected, not required, to pass at base (D10); a base failure under the 3-of-3 bar is handled by an `--eval-override` (Requirement 4), not treated as a code regression.
 
 ### Requirement 6 — a retro defect becomes a case
@@ -120,26 +120,25 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 
 ## Decisions taken in this document
 
-- D1 — The brief is rendered from the case's frozen values by the build under evaluation, not stored as a frozen brief file: chosen over a frozen rendered file because a frozen file cannot catch a brief template defect, and two of the five seed failures are brief defects.
-- D2 — A case is selected when its own files, its role file, its role's profile entry, its grader code or its rendered brief text changed: chosen over role-file-and-template-only (the grill's literal) or every-case-every-deploy because a model or effort change in the profile and a new case both change what the case proves, and running every case costs 15 spawns or more per deploy.
-- D3 — The evals run after the staged build and smoke boot and before the live checkout moves: options were evals before the live checkout moves, evals after the move with a rollback of the checkout, or evals after the move with the role files left live; chosen because the controller reads role files from the live checkout, so a refusal after the move would still ship the role change.
-- D4 — An override is recorded in an override log under the controller home and in a deferral whose body carries the Progress log line, and the deploy does not edit the Progress log itself: chosen over the deploy appending to or committing the Progress log because a dirty or locally committed docs file blocks the next self-update's fast-forward and its store-only rebase.
-- D5 — The drafter brief template's instruction to write the integration test label is removed in this spec: chosen over overriding or dropping the drafter case because the case would likely fail on the deploy that lands it, the template contradicts the drafter role, and no code reads that label.
-- D6 — An inconclusive run (usage limit, turn cap, schema-invalid, error) refuses the deploy like a failure: options were refuse, retry once, or skip the case and deploy; chosen because a skipped case is an untested change and the override flag already covers a deliberate deploy.
-- D7 — Cases live under the harness directory, one directory per case: options were the harness directory, a new top-level evals directory, or the spec store; chosen because the close-out classes a harness path as a harness item, so a retro case lands in the same batch as its role fix.
-- D8 — Graders read only the structured report and the fixture repository, not the step's stream log: options were report and repository only (grill decision 21) or also the tool calls in the stream log; chosen because every seed failure leaves a trace in the report or the repository, and stream parsing would tie graders to the CLI's event format.
-- D9 — The override deferral is owned by the harness, not by Matthew: options were harness or Matthew; chosen because fixing a failing case is harness work, and the override itself is already Matthew's recorded act.
-- D10 — The closeout reversing-proposal case is kept as a regression guard although the recorded instances show the implementer refusing correctly: options were keep it or drop it from the seed set; chosen because the decomposition entry lists it and a later role edit could lose the refusal.
+- D1 — The brief is rendered from the case's frozen values by the build under evaluation, not stored as a frozen brief file: a frozen file cannot catch a brief template defect, and two of the five seed failures are brief defects.
+- D2 — A case is selected when its own files, its role file, its profile entry, its grader code or its rendered brief text changed: chosen over role-and-template-only or every-case-every-deploy, because a profile model or effort change and a new case each change what the case proves, and every case costs 15+ spawns per deploy.
+- D3 — The evals run after the staged build and smoke boot, before the live checkout moves: the controller reads role files from the live checkout, so a refusal after the move would still ship the role change.
+- D4 — An override is recorded in an override log under the controller home and in a deferral carrying the Progress log line; the deploy does not edit the Progress log itself, because a dirty or locally committed docs file blocks the next self-update's fast-forward and store-only rebase.
+- D5 — The drafter brief template's instruction to write the integration test label is removed in this spec: the case would likely fail on the deploy that lands it, the template contradicts the drafter role, and no code reads that label.
+- D6 — An inconclusive run (usage limit, turn cap, schema-invalid, error) refuses the deploy like a failure: a skipped case is an untested change, and the override flag already covers a deliberate deploy.
+- D7 — Cases live under the harness directory, one directory per case: the close-out classes a harness path as a harness item, so a retro case lands in the same batch as its role fix.
+- D8 — Graders read only the structured report and the fixture repository, not the step's stream log (grill decision 21): every seed failure leaves a trace in the report or the repository, and stream parsing would tie graders to the CLI's event format.
+- D9 — The override deferral is owned by the harness, not by Matthew: fixing a failing case is harness work, and the override itself is already Matthew's recorded act.
+- D10 — The closeout reversing-proposal case is kept as a regression guard although the recorded instances show the implementer refusing correctly: the decomposition entry lists it and a later role edit could lose the refusal.
 - D11 — Posture: the spec touches no money, personal data, data deletion or legal surface; an eval run only spends subscription usage, bounded by D2 and the sequential runs.
 
 ## Scope notes
 
 - Carried from the decomposition: none.
-- Cut: none of the decomposition entry's items. The entry's "logged in the Progress log" is met by a ready-to-paste line in the deferral and a home log, not a write to the Progress log file (D4); this is a re-decision of the entry's wording.
-- Added beyond the entry: the drafter brief template fix (Requirement 5 criterion 2, D5), needed so the seed case can pass on the deploy that lands it.
-- Deferred to design: the case file format, the grader set and how a case names its graders, the runner command's name, the result record and override log shapes, how the eval step points the spec-workflow tools at the fixture's store, and how the report schemas are shared between the phases and the runner.
+- Cut: none of the decomposition entry's items. Its "logged in the Progress log" is met by a ready-to-paste line in the deferral and a home log, not a write to the Progress log file (D4); a re-decision of the entry's wording.
+- Added beyond the entry: the drafter brief template fix (Requirement 5 criterion 2, D5), so the seed case can pass on the deploy that lands it.
+- Deferred to design: the case file format, the grader set and how a case names them, the runner command name, the result-record and override-log shapes, how the eval step points the spec-workflow tools at the fixture's store, and how the report schemas are shared between phases and runner.
 - Not in this spec: `claude plugin eval` (grill decision 20), graders that read the stream log (D8), eval runs outside a deploy other than by hand, and evals for the skills directory's one remaining skill.
-- The steering directory holds no `product.md`; alignment uses the grill decisions instead.
 
 ## Revision History
 
@@ -151,3 +150,7 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
   - **R1-3 — Accepted (SHOULD_FIX).** Stated that the dry-run preview, which skips the build, approximates the rendered-text selection input by a template source diff and marks such a case provisional (Requirement 3 criterion 6).
   - **R1-4 — Accepted (SHOULD_FIX).** Split the base-pass invariant: the three deterministic cases must pass at base; the judgment reversing-proposal case is only expected to, its standing-brief rule now cited and a base failure handled by an override (Requirement 5 criterion 4).
   - **MINOR — Accepted.** Requirement 7 lists the reordered live-checkout move; Requirement 2 records a grader throw or a failed fixture build as inconclusive, distinct from a grader returning fail.
+- **v3** (2026-10-22) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/0/1).
+  - **R2-1 — Accepted (MUST_FIX).** Selection now watches every brief a case renders, not one. Requirement 3 criterion 1 compares the rendered text of every brief template the case renders, and criterion 6's dry-run signal diffs the source of every render function and shared helper those templates use, so a standing-brief change selects the reversing-proposal case.
+  - **R2-2 — Accepted (MUST_FIX).** Requirement 5 criterion 3 now holds the four other cases to 3 of 3 and lets the reversing-proposal case fall to an override on the landing deploy, matching criterion 4.
+  - **MINOR — Rejected.** A runner-process crash exits the deploy non-zero and leaves the checkout unchanged by criterion 3, so no change ships untested; a partial-record contract is a design concern, not a requirements gap.

````
