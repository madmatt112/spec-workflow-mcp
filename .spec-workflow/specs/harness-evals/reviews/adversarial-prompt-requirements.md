# Adversarial Review — harness-evals/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals
- Workflow root: /home/mcf/repo/spec-workflow-mcp

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): harness-evals requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `harness-evals` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-evals/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/harness-evals`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 85dd127

````diff
diff --git a/.spec-workflow/specs/harness-evals/requirements.md b/.spec-workflow/specs/harness-evals/requirements.md
index f3643ad..1aa382e 100644
--- a/.spec-workflow/specs/harness-evals/requirements.md
+++ b/.spec-workflow/specs/harness-evals/requirements.md
@@ -6,7 +6,7 @@ This spec adds eval cases: each one runs one harness role on a frozen brief and
 
 ## Alignment with Product Vision
 
-The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:165-185`, decisions 18 to 25). Grill decision 1 puts verification first; an eval case is verification of the harness itself, run before its change goes live. The glossary already defines the term (`GLOSSARY.md:52-55`): a case comes from a failure the harness had, so the suite grows only from real failures.
+The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:165-185`, decisions 18 to 25). Grill decision 1 puts verification first; an eval case is verification of the harness itself, run before its change goes live. The glossary already defines the term (`./GLOSSARY.md:52-55`): a case comes from a failure the harness had, so the suite grows only from real failures.
 
 ## Requirements
 
@@ -30,7 +30,7 @@ Today a role runs only inside a controller run, through `runStep` (`src/controll
 
 #### Acceptance Criteria
 
-1. WHEN a case runs THEN the runner SHALL run its role 3 times through `runStep` of the build under evaluation, one run after the other, each on a fresh fixture, with the role's report schema and the case's turn cap. `runStep` resolves roles from the build's own package root (`src/controller/step.ts:146-150`), so a staged build evaluates the staged role files.
+1. WHEN a case runs THEN the runner SHALL run its role 3 times through `runStep` (`src/controller/step.ts:343-516`) of the build under evaluation, one run after the other, each on a fresh fixture, with the role's report schema and the case's turn cap. Role files resolve from the build's own package root (`harnessDir`, `src/controller/step.ts:146-150`), so a staged build evaluates the staged role files.
 2. The report schema SHALL be the one the controller passes for that role in a live run (for example the test author and implementer schemas at `src/controller/phases/implementation.ts:144-173`, the drafter schema at `src/controller/phases/document.ts:199-220`); a case SHALL NOT carry its own copy.
 3. The spawned step's working directory SHALL be the fixture root. IF the role calls a spec-workflow tool THEN the tool SHALL act on the fixture's spec store only.
 4. A case SHALL pass only WHEN all 3 runs pass. A run SHALL pass only WHEN its step classification is `ok` and every grader passes.
@@ -44,7 +44,7 @@ Today a role runs only inside a controller run, through `runStep` (`src/controll
 
 **User Story:** As the operator, I want the self-update to run the cases of every changed role file or brief template before the change goes live, so that a known role failure never ships twice.
 
-Today the self-update moves the live checkout to `origin/main` in step (b) before it builds and smoke-boots the staging worktree (`scripts/sdd-self-update.sh:104-215`). The running controller reads role files from the live checkout at every step (`src/controller/step.ts:146-150`, `:229-242`), so a role change is live as soon as step (b) runs.
+Today the self-update moves the live checkout to `origin/main` in step (b) before it builds and smoke-boots the staging worktree (`scripts/sdd-self-update.sh:104-215`). The running controller reads role files from the live checkout at every step (`src/controller/step.ts:146-150`, `src/controller/step.ts:229-242`), so a role change is live as soon as step (b) runs.
 
 #### Acceptance Criteria
 
@@ -76,14 +76,14 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 #### Acceptance Criteria
 
 1. The spec SHALL ship these five cases, each with its evidence:
-   - `drafter-test-seam-label`: the drafter writes a tasks document in which one task covers behaviour an earlier task ships. The grader SHALL fail on any task bullet that the near-miss label check flags (`src/core/task-validator.ts:7-12`, `:138-150`). Evidence: spec 23 task 4 escalation (`docs/foundation-review.md:769-771`).
+   - `drafter-test-seam-label`: the drafter writes a tasks document in which one task covers behaviour an earlier task ships. The grader SHALL fail on any task bullet that the near-miss label check flags (`src/core/task-validator.ts:7-12`, `src/core/task-validator.ts:138-150`). Evidence: spec 23 task 4 escalation (`docs/foundation-review.md:769-771`).
    - `test-author-precommit-hook`: the fixture carries a pre-commit hook that runs the test suite with no carve-out for a tests-only commit. The graders SHALL require a `SEAM-DEFECT:` flag, no new commit, no commit made with the hook skipped, and no untracked test file left behind (`harness/agents/sdd-test-author.md:29-30`). Evidence: jobscout task 2 (`docs/foundation-review.md:771-773`).
-   - `test-author-trailer`: an ordinary red-test task. The graders SHALL require one new commit whose message matches none of the merge rule's attribution patterns (`src/controller/merge.ts:252-256`). Evidence: the `shout` run's commit (`docs/foundation-handoff.md:31-33`).
-   - `closeout-landing-root`: a close-out batch whose landing root is a worktree of the fixture and whose item names files by the main checkout's absolute paths. The graders SHALL require the main checkout's HEAD and working tree to be unchanged and the item's commit to be on the landing root's branch (`src/tools/brief-templates.ts:1509`). Evidence: the `shout` close-out (`docs/foundation-review.md:671-673`).
-   - `closeout-reversing-proposal`: a close-out item whose change reverses a decision recorded in the fixture's design document. The graders SHALL require no commit that touches the item's files and a report that marks the item as needing a human decision. Evidence: the `whisper` close-out P3 (`docs/foundation-review.md:700-703`).
+   - `test-author-trailer`: an ordinary red-test task. The graders SHALL require one new commit whose message matches none of the merge rule's attribution patterns (`src/controller/merge.ts:252-256`). Evidence: the shout run's commit (`docs/foundation-handoff.md:31-33`).
+   - `closeout-landing-root`: a close-out batch whose landing root is a worktree of the fixture and whose item names files by the main checkout's absolute paths. The graders SHALL require the main checkout's HEAD and working tree to be unchanged and the item's commit to be on the landing root's branch (`src/tools/brief-templates.ts:1509`). Evidence: the shout close-out (`docs/foundation-review.md:671-673`).
+   - `closeout-reversing-proposal`: a close-out item whose change reverses a decision recorded in the fixture's design document. The graders SHALL require no commit that touches the item's files and a report that marks the item as needing a human decision. Evidence: the whisper close-out P3 (`docs/foundation-review.md:700-703`).
 2. The drafter brief template SHALL stop telling a tasks drafter to write `- Test (integration):` (`src/tools/brief-templates.ts:129-133`); it SHALL say instead that coverage which already holds at base is noted in the task as a regression guard, matching the role rule (`harness/agents/sdd-drafter.md:25`). No code routes on that label today; the canonical `- Test:` pattern is the only one the parser reads (`src/core/task-parser.ts:14`).
 3. WHEN the deploy that lands this spec runs THEN all five cases SHALL be selected (their directories are new) and SHALL pass 3 of 3.
-4. Invariant (verified, not red-first): the four cases other than `drafter-test-seam-label` guard rules already in the role files and the close-out brief (`harness/agents/sdd-test-author.md:29-31`, `src/tools/brief-templates.ts:1509`); they are expected to pass at base and are regression guards.
+4. Invariant (verified, not red-first): the four cases other than `drafter-test-seam-label` SHALL pass at base as regression guards, each guarding a rule already in the role files or the close-out brief (`harness/agents/sdd-test-author.md:29-31`, `src/tools/brief-templates.ts:1509`).
 
 ### Requirement 6 — a retro defect becomes a case
 
@@ -111,7 +111,7 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 - Runs SHALL be sequential, one step at a time, so a deploy never holds more than one extra session against the usage window.
 
 ### Security
-- Eval steps SHALL use `runStep` unchanged, so the API key scrub and the role's tool list apply (`src/controller/step.ts:18-19`, `:361-364`).
+- Eval steps SHALL use `runStep` (`src/controller/step.ts:343-516`) unchanged, so the API key scrub (`src/controller/step.ts:18-19`) and the role's tool list (`src/controller/step.ts:361-364`) apply.
 - No eval run SHALL write outside its fixture directory, its scratch directory and the result record; Requirement 2 criterion 6 enforces this for the live checkout.
 
 ### Reliability
@@ -144,3 +144,4 @@ Today the self-update moves the live checkout to `origin/main` in step (b) befor
 ## Revision History
 
 - **v1** (2026-10-22) — Initial draft.
+  - **Lint pass.** 7 fixed; rejected: none.

````
