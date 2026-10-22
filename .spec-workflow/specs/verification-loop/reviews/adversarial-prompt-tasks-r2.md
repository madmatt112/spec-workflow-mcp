# Adversarial Review — verification-loop/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-tasks.md using this format:

```markdown
# Adversarial Review Memory — tasks
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

**Primary attack surface for this phase:** Atomicity, ordering, coverage

**Example attack angles to consider:** Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don't map to any requirement

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): verification-loop tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since c326ca7

````diff
diff --git a/.spec-workflow/specs/verification-loop/tasks.md b/.spec-workflow/specs/verification-loop/tasks.md
index 3b44fda..bb5ebfd 100644
--- a/.spec-workflow/specs/verification-loop/tasks.md
+++ b/.spec-workflow/specs/verification-loop/tasks.md
@@ -1,8 +1,8 @@
 # Tasks Document — verification-loop
 
-Document version: v1
+Document version: v2
 
-Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and the dependency flag; task 5 adds the brief variants; 6 → 7 build and wire the merge fix round (6 needs 1 and 5); 8 → 9 build and wire the implementer route; 10 → 11 → 12 → 13 build the completion-gate security pass and its wait (12 needs 5, 9 and 10); task 14 is documentation. Each task leaves the tree compiling and every existing suite green. Expected verifier spend: tasks 2, 6, 8 and 10 create new modules, so they route high risk to the verifier; no task touches a `## Sensitive paths` entry.
+Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and the dependency flag; task 5 adds the brief variants; 6 → 7 build and wire the merge fix round (6 needs 1 and 5); 8 → 9 build and wire the implementer route; 10 → 11 → 12 → 13 build the completion-gate security pass and its wait (12 needs 5, 9, 10 and 11); task 14 is documentation. Each task leaves the tree compiling and every existing suite green. Expected verifier spend: tasks 2, 6, 8 and 10 create new modules, so they route high risk to the verifier; no task touches a `## Sensitive paths` entry.
 
 - [ ] 1. Blocking kinds, base and head in the merge evaluation
   - File: src/controller/merge.ts
@@ -85,7 +85,7 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
   - Purpose: pick the implementer model and effort from the class (a) items with no model judgement (R2 AC 1-5, 7).
   - _Leverage: src/controller/step.ts `loadRole` (:229-242); harness/agent-profiles.json `sdd-implementer` (:20-25) and `sdd-test-author` (:50-55)_
   - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7_
-  - _Prompt: Task: Create src/controller/implementer-route.ts with `ImplementerRoute` and `routeForTask` as design C5 pins, per R2 AC 1, 2, 3, 5 and 7. Tests: a `sensitive-path` item for the task gives the `sdd-implementer` profile and the item's reason; keyword-only items give the `sdd-test-author` profile and `no sensitive-path flag`; no items give the same; `null` gives the `sdd-implementer` profile and `class-a unavailable` (design D7); an item for another task is ignored | Restrictions: read both profiles through `loadRole`, never literal model strings; add no key to harness/agent-profiles.json, so src/__tests__/agent-profiles.test.ts stays green with no edit | Success: the four cases return the model, effort and reason listed; implementer-route.test.ts and agent-profiles.test.ts pass_
+  - _Prompt: Task: Create src/controller/implementer-route.ts with `ImplementerRoute` and `routeForTask` as design C5 pins, per R2 AC 1, 2, 3, 5 and 7. Tests: a `sensitive-path` item for the task gives the `sdd-implementer` profile and the item's reason; keyword-only items give the `sdd-test-author` profile and `no sensitive-path flag`; no items give the same; `null` gives the `sdd-implementer` profile and `class-a unavailable` (design D7); an item whose `taskId` is another task is ignored, so a query with only such an item returns the `sdd-test-author` profile and `no sensitive-path flag` (R2 AC 1) | Restrictions: read both profiles through `loadRole`, never literal model strings; add no key to harness/agent-profiles.json, so src/__tests__/agent-profiles.test.ts stays green with no edit | Success: each of the five cases returns the model, effort and reason listed, including the other-task item returning the `sdd-test-author` profile and `no sensitive-path flag`; implementer-route.test.ts and agent-profiles.test.ts pass_
 
 - [ ] 9. Implementer route in the implementation phase
   - File: src/controller/phases/implementation.ts
@@ -95,7 +95,7 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
   - Purpose: unflagged task steps run on the Sonnet route; flagged and non-task steps keep the profile (R2 AC 1-2, 4, 6, 8-11).
   - _Leverage: src/controller/phases/gates.ts class-a call (:291-294); `stepUsage` (:371-381)_
   - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.8, 2.9, 2.10, 2.11_
-  - _Prompt: Task: Per R2 AC 1, 2, 4, 6 and 8-11 and design C5, compute the route with the function task 8 exports at every task step start (implement attempts :629-634, checks re-spawn :658-661, task fix rounds :774-778) and pass it to `runModelStep`, which then fills `StepSpec.model` and `.effort` and the `spawn.start` model and effort and `spawn.end` model. Write the route note at the task's first step and again when the route changes. Tests: the stub init event `argv` has `--model claude-sonnet-5` for a task on `src/a.js` and `--model claude-opus-4-8` for a task on `package.json` (the fixture lists it, src/controller/phases/__tests__/implementation.test.ts:104); spawn rows match; one route note per task; regression guard (already true at base, R2 AC 11): the test author, verifier and repair steps keep their profiles | Restrictions: repair (:994-997) and reconcile (:1137-1140) pass no override; no `--resume`; existing implementation.test.ts assertions keep their values | Success: the unflagged task's implementer `argv` carries `--model claude-sonnet-5` and the flagged task's carries `--model claude-opus-4-8`; each `spawn.start` model and effort and `spawn.end` model equal the `argv` values; each task gets one route note; the test author, verifier and repair steps run on their profile models; src/controller/phases/__tests__/implementation.test.ts passes_
+  - _Prompt: Task: Per R2 AC 1, 2, 4, 6 and 8-11 and design C5, compute the route with the function task 8 exports at every task step start (implement attempts :629-634, checks re-spawn :658-661, task fix rounds :774-778) and pass it to `runModelStep`, which then fills `StepSpec.model` and `.effort` and the `spawn.start` model and effort and `spawn.end` model. Write the route note at the task's first step and again when the route changes. Tests: the stub init event `argv` has `--model claude-sonnet-5` for a task on `src/a.js` and `--model claude-opus-4-8` for a task on `package.json` (the fixture lists it, src/controller/phases/__tests__/implementation.test.ts:104); spawn rows match; one route note per task; regression guard (already true at base, R2 AC 10 and 11): the test author, verifier and repair steps keep their profiles | Restrictions: repair (:994-997) and reconcile (:1137-1140) pass no override; no `--resume`; existing implementation.test.ts assertions keep their values | Success: the unflagged task's implementer `argv` carries `--model claude-sonnet-5` and the flagged task's carries `--model claude-opus-4-8`; each `spawn.start` model and effort and `spawn.end` model equal the `argv` values; each task gets one route note; the test author, verifier and repair steps run on their profile models; src/controller/phases/__tests__/implementation.test.ts passes_
 
 - [ ] 10. Security pass state module
   - File: src/controller/phases/security-pass.ts
@@ -163,5 +163,10 @@ Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and
 
 ## Revision History
 
+- **v2** (2026-10-21) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/1/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Task 8 Success named only four cases while the Task body named five; added the fifth — an item scoped to another task returns the test-author profile and no sensitive-path flag — so the test author writes the task-id scoping test that catches a route ignoring taskId.
+  - **R1-2 — Accepted (MINOR).** Task 9's regression guard cited only R2 AC 11, but repair is an AC 10 step while AC 11 covers the test author, verifier and adjudicator; relabelled the guard to R2 AC 10 and 11 so each named step sits under the criterion that governs it.
+  - **R1-3 — Accepted (MINOR).** The dependency header omitted task 12's direct need of task 11 (the e2e-skip and handoff markers); the parenthetical now reads 5, 9, 10 and 11.
+  - **Lint pass.** 0 fixed; rejected: L-1/L-2 `blocking` and `base` are new fields task 1 adds, so the citation marks the insertion site (rule 11, rejected v1); L-3/L-5 `newDependencies` is a new field tasks 3 and 4 add (rule 11, rejected v1; absent from state.ts confirms it is new); L-6 `classAItems` is a new closure task 9 adds (rule 11, rejected v1; absent from implementation.ts); L-4 task 4 is `kind: e2e` (D2), its one test is the Playwright suite in File:, which vitest cannot run (rejected v1 as L-9); L-7 task 14 touches only `docs/*.md`, so it changes no source and the seam check does not apply.
 - **v1** (2026-10-21) — Initial draft.
   - **Lint pass.** 11 fixed; rejected: L-2/L-3 `blocking`/`base` are new fields task 1 adds (not in source); L-6/L-10 `newDependencies` is a new field; L-15 `classAItems` is a new closure; L-9 info only — task 4 is `kind: e2e` (D2), its only test is the Playwright suite in File:, which vitest cannot run.

````
