# Adversarial Review — harness-evals/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): harness-evals requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
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

## Changes since ce17626

````diff
diff --git a/.spec-workflow/specs/harness-evals/requirements.md b/.spec-workflow/specs/harness-evals/requirements.md
index 1aa382e..9be51a4 100644
--- a/.spec-workflow/specs/harness-evals/requirements.md
+++ b/.spec-workflow/specs/harness-evals/requirements.md
@@ -18,8 +18,8 @@ Today a role runs only inside a controller run, through `runStep` (`src/controll
 
 #### Acceptance Criteria
 
-1. Each eval case SHALL be one directory under `harness/evals/`, named by the case id, holding: the role name (a file under `harness/agents/`), the brief template name (a key of the brief template registry) and the values it is rendered with, the fixture definition, the turn cap, the graders, and the evidence of the failure it guards (a Progress log date, a PR number or a retro finding id).
-2. A case's brief values MAY contain a placeholder for the fixture's root and its scratch directory; the runner SHALL substitute both with the run's own paths before it renders the brief.
+1. Each eval case SHALL be one directory under `harness/evals/`, named by the case id, holding: the controller step it emulates — the role (a file under `harness/agents/`) and the phase (implementation, document or close-out), which fix the report schema and the brief template(s) that step renders — the values each template is rendered with, the fixture definition, the turn cap, the graders, and the evidence of the failure it guards (a Progress log date, a PR number or a retro finding id).
+2. A case's brief values MAY contain a placeholder for the fixture's root and its scratch directory; the runner SHALL substitute both with the run's own paths before it renders each brief. WHEN the emulated step renders more than one brief — a close-out step renders `closeout-batch` and the `closeout-standing` it points at (`src/tools/brief-templates.ts:1505`) — the runner SHALL render every one from the build under evaluation and wire the pointer, so a template defect in either is caught (D1).
 3. The fixture definition SHALL describe a small git repository state: files, commits in order, and optional extras the seed cases need (a `.git/hooks/pre-commit` script, a second worktree, a spec store with documents). The runner SHALL build it fresh in a temporary directory for every run; no run SHALL reuse another run's fixture.
 4. Each grader SHALL be code that reads two inputs only: the step's structured report and the fixture repository after the run (files, git log, commit messages, working tree status, worktree list). A grader SHALL return pass or fail with a one-line reason; no model grades.
 5. WHEN `npm test` runs THEN every case under `harness/evals/` SHALL be validated without a model: the definition parses, the role file and the template exist, the template renders with the case values (no missing required key), the fixture builds, and every grader the case names resolves. A case that fails validation SHALL fail the suite.
@@ -30,11 +30,11 @@ Today a role runs only inside a controller run, through `runStep` (`src/controll
 
 #### Acceptance Criteria
 
-1. WHEN a case runs THEN the runner SHALL run its role 3 times through `runStep` (`src/controller/step.ts:343-516`) of the build under evaluation, one run after the other, each on a fresh fixture, with the role's report schema and the case's turn cap. Role files resolve from the build's own package root (`harnessDir`, `src/controller/step.ts:146-150`), so a staged build evaluates the staged role files.
-2. The report schema SHALL be the one the controller passes for that role in a live run (for example the test author and implementer schemas at `src/controller/phases/implementation.ts:144-173`, the drafter schema at `src/controller/phases/document.ts:199-220`); a case SHALL NOT carry its own copy.
+1. WHEN a case runs THEN the runner SHALL run its role 3 times through `runStep` (`src/controller/step.ts:343-516`) of the build under evaluation, one run after the other, each on a fresh fixture, with the step's report schema and the case's turn cap. Role files resolve from the build's own package root (`harnessDir`, `src/controller/step.ts:146-150`), so a staged build evaluates the staged role files.
+2. The report schema SHALL be the one the controller passes for that (role, phase) in a live run — the implementation schemas at `src/controller/phases/implementation.ts:144-173`, the drafter schema at `src/controller/phases/document.ts:199-220`, or the close-out batch schema at `src/controller/phases/closeout.ts:82-104` (passed at `src/controller/phases/closeout.ts:411-414`), which the two close-out cases need for its `items[].status`, `items[].commit` and `items[].reason` fields; a case SHALL NOT carry its own copy.
 3. The spawned step's working directory SHALL be the fixture root. IF the role calls a spec-workflow tool THEN the tool SHALL act on the fixture's spec store only.
 4. A case SHALL pass only WHEN all 3 runs pass. A run SHALL pass only WHEN its step classification is `ok` and every grader passes.
-5. IF a run's step classification is `usage-limit`, `turn-cap`, `schema-invalid` or `error` (`src/controller/step.ts:303-327`) THEN that run SHALL be recorded as inconclusive with the classification, and the case SHALL NOT pass.
+5. IF a run's step classification is `usage-limit`, `turn-cap`, `schema-invalid` or `error` (`src/controller/step.ts:303-327`) THEN that run SHALL be recorded as inconclusive with the classification, and the case SHALL NOT pass. A grader that throws at run time, or a fixture that fails to build, SHALL likewise record the run inconclusive with the error (distinct from a grader returning fail).
 6. WHEN a run ends THEN the runner SHALL compare the live checkout's HEAD and its `git status --porcelain` output with a snapshot taken before the run; IF they differ THEN the run SHALL fail with the reason "edited the live checkout", whatever its graders said.
 7. WHEN a case run ends THEN the runner SHALL write one result record under the controller home (`SDD_HOME`, as `scripts/sdd-self-update.sh:34-38` resolves it): per case, the commit evaluated, each run's verdict, classification, grader reasons, step log path and token usage, and the case verdict (pass, fail or inconclusive).
 8. No case run SHALL create a controller run record or a wait, or write a run ledger row.
@@ -53,7 +53,7 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 3. IF any selected case fails or is inconclusive AND no override (Requirement 4) covers it THEN the self-update SHALL exit non-zero, leave the live checkout's HEAD, its `harness/` files and `dist/` unchanged, and write an `error` wait (as `write_error_wait` does, `scripts/sdd-self-update.sh:45-60`) whose text names the commit, each failing or inconclusive case id with its first grader reason or classification, and the result record path.
 4. WHEN every selected case passes THEN the self-update SHALL continue with the live checkout move, the swap and the restart as today.
 5. Invariant (verified, not red-first): WHEN no case is selected THEN the self-update SHALL run no model step and behave as today.
-6. WHEN the self-update runs with `--dry-run` THEN it SHALL print the selected case ids and the reason each was selected, run no case, and change nothing.
+6. WHEN the self-update runs with `--dry-run` THEN it SHALL print the selected case ids and the reason each was selected, run no case, and change nothing. Because `--dry-run` skips the staging build (`scripts/sdd-self-update.sh:179-182`), it cannot render `origin/main`'s brief text; for the rendered-text input (criterion 1) it SHALL instead diff the template render function's source between the two commits and mark a case selected by that signal alone provisional. The real build computes the diff exactly.
 7. The self-update SHALL print one line per selected case with its verdict and run count (for example `eval test-author-trailer: pass 3/3`).
 8. The live-checkout move SHALL keep today's rules for the store-only rebase and the refusals (`scripts/sdd-self-update.sh:116-174`), only later in the sequence.
 
@@ -83,7 +83,7 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
    - `closeout-reversing-proposal`: a close-out item whose change reverses a decision recorded in the fixture's design document. The graders SHALL require no commit that touches the item's files and a report that marks the item as needing a human decision. Evidence: the whisper close-out P3 (`docs/foundation-review.md:700-703`).
 2. The drafter brief template SHALL stop telling a tasks drafter to write `- Test (integration):` (`src/tools/brief-templates.ts:129-133`); it SHALL say instead that coverage which already holds at base is noted in the task as a regression guard, matching the role rule (`harness/agents/sdd-drafter.md:25`). No code routes on that label today; the canonical `- Test:` pattern is the only one the parser reads (`src/core/task-parser.ts:14`).
 3. WHEN the deploy that lands this spec runs THEN all five cases SHALL be selected (their directories are new) and SHALL pass 3 of 3.
-4. Invariant (verified, not red-first): the four cases other than `drafter-test-seam-label` SHALL pass at base as regression guards, each guarding a rule already in the role files or the close-out brief (`harness/agents/sdd-test-author.md:29-31`, `src/tools/brief-templates.ts:1509`).
+4. Invariant (verified, not red-first): the three deterministic cases other than `drafter-test-seam-label` and `closeout-reversing-proposal` SHALL pass at base as regression guards, each guarding a rule already in the role files or the close-out brief (`harness/agents/sdd-test-author.md:29-31`, `src/tools/brief-templates.ts:1509`). `closeout-reversing-proposal` guards a judgment rule in the standing brief (`src/tools/brief-templates.ts:1487-1489`) and is expected, not required, to pass at base (D10); a base failure under the 3-of-3 bar is handled by an `--eval-override` (Requirement 4), not treated as a code regression.
 
 ### Requirement 6 — a retro defect becomes a case
 
@@ -101,7 +101,7 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 
 #### Acceptance Criteria
 
-1. `docs/SDD-HARNESS.md` "The staged self-update" (`docs/SDD-HARNESS.md:459-473`) SHALL list the eval step in its place in the sequence, the refusal, the override flag and its records.
+1. `docs/SDD-HARNESS.md` "The staged self-update" (`docs/SDD-HARNESS.md:459-473`) SHALL list the eval step and the reordered live-checkout move (D3) in their place in the sequence, the refusal, the override flag and its records.
 2. `docs/SDD-HARNESS.md` SHALL describe the case directory, how to run one case by hand, and how a retro adds a case.
 
 ## Non-Functional Requirements
@@ -120,17 +120,17 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 
 ## Decisions taken in this document
 
-- D1 — The brief is rendered from the case's frozen values by the build under evaluation, not stored as a frozen brief file: options were a frozen rendered brief file, frozen values rendered by the build under evaluation, or both per case; chosen because a frozen file cannot catch a brief template defect, and two of the five seed failures are brief defects.
-- D2 — A case is selected when its own files, its role file, its role's profile entry, its grader code or its rendered brief text changed: options were role file and template only (the grill's literal), the wider set, or every case on every deploy; chosen because a model or effort change in the profile and a new case both change what the case proves, and running every case costs 15 spawns or more per deploy.
+- D1 — The brief is rendered from the case's frozen values by the build under evaluation, not stored as a frozen brief file: chosen over a frozen rendered file because a frozen file cannot catch a brief template defect, and two of the five seed failures are brief defects.
+- D2 — A case is selected when its own files, its role file, its role's profile entry, its grader code or its rendered brief text changed: chosen over role-file-and-template-only (the grill's literal) or every-case-every-deploy because a model or effort change in the profile and a new case both change what the case proves, and running every case costs 15 spawns or more per deploy.
 - D3 — The evals run after the staged build and smoke boot and before the live checkout moves: options were evals before the live checkout moves, evals after the move with a rollback of the checkout, or evals after the move with the role files left live; chosen because the controller reads role files from the live checkout, so a refusal after the move would still ship the role change.
-- D4 — An override is recorded in an override log under the controller home and in a deferral whose body carries the Progress log line, and the deploy does not edit the Progress log itself: options were the deploy appending to the Progress log file, the deploy committing the line on the live checkout, or the home log plus the deferral; chosen because a dirty or locally committed docs file blocks the next self-update's fast-forward and its store-only rebase.
-- D5 — The drafter brief template's instruction to write the integration test label is removed in this spec: options were fixing the template here, leaving it and overriding the drafter case on the landing deploy, or dropping the drafter case; chosen because the case would likely fail on the deploy that lands it, the template contradicts the drafter role, and no code reads that label.
+- D4 — An override is recorded in an override log under the controller home and in a deferral whose body carries the Progress log line, and the deploy does not edit the Progress log itself: chosen over the deploy appending to or committing the Progress log because a dirty or locally committed docs file blocks the next self-update's fast-forward and its store-only rebase.
+- D5 — The drafter brief template's instruction to write the integration test label is removed in this spec: chosen over overriding or dropping the drafter case because the case would likely fail on the deploy that lands it, the template contradicts the drafter role, and no code reads that label.
 - D6 — An inconclusive run (usage limit, turn cap, schema-invalid, error) refuses the deploy like a failure: options were refuse, retry once, or skip the case and deploy; chosen because a skipped case is an untested change and the override flag already covers a deliberate deploy.
 - D7 — Cases live under the harness directory, one directory per case: options were the harness directory, a new top-level evals directory, or the spec store; chosen because the close-out classes a harness path as a harness item, so a retro case lands in the same batch as its role fix.
 - D8 — Graders read only the structured report and the fixture repository, not the step's stream log: options were report and repository only (grill decision 21) or also the tool calls in the stream log; chosen because every seed failure leaves a trace in the report or the repository, and stream parsing would tie graders to the CLI's event format.
 - D9 — The override deferral is owned by the harness, not by Matthew: options were harness or Matthew; chosen because fixing a failing case is harness work, and the override itself is already Matthew's recorded act.
 - D10 — The closeout reversing-proposal case is kept as a regression guard although the recorded instances show the implementer refusing correctly: options were keep it or drop it from the seed set; chosen because the decomposition entry lists it and a later role edit could lose the refusal.
-- D11 — Posture: the spec touches no money, personal data, deletion of user data or legal surface; an eval run only spends subscription usage, bounded by D2 and the sequential runs.
+- D11 — Posture: the spec touches no money, personal data, data deletion or legal surface; an eval run only spends subscription usage, bounded by D2 and the sequential runs.
 
 ## Scope notes
 
@@ -145,3 +145,9 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 
 - **v1** (2026-10-22) — Initial draft.
   - **Lint pass.** 7 fixed; rejected: none.
+- **v2** (2026-10-22) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 2/2/4).
+  - **R1-1 — Accepted (MUST_FIX).** Keyed the report schema by (role, phase), not role; named the close-out batch schema so the two close-out cases get the status, commit and reason fields their graders read (Requirement 2 criterion 2).
+  - **R1-2 — Accepted (MUST_FIX).** A case now names the controller step it emulates and its brief templates; a close-out case renders the batch brief and the standing brief it points at from the build, so the reversing-proposal rule reaches the implementer (Requirement 1 criteria 1 and 2).
+  - **R1-3 — Accepted (SHOULD_FIX).** Stated that the dry-run preview, which skips the build, approximates the rendered-text selection input by a template source diff and marks such a case provisional (Requirement 3 criterion 6).
+  - **R1-4 — Accepted (SHOULD_FIX).** Split the base-pass invariant: the three deterministic cases must pass at base; the judgment reversing-proposal case is only expected to, its standing-brief rule now cited and a base failure handled by an override (Requirement 5 criterion 4).
+  - **MINOR — Accepted.** Requirement 7 lists the reordered live-checkout move; Requirement 2 records a grader throw or a failed fixture build as inconclusive, distinct from a grader returning fail.

````
