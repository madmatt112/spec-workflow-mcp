# Adversarial Review — project-bootstrap/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-tasks.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): project-bootstrap tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 3a7c758

````diff
diff --git a/.spec-workflow/specs/project-bootstrap/tasks.md b/.spec-workflow/specs/project-bootstrap/tasks.md
index e27bd13..d890b8a 100644
--- a/.spec-workflow/specs/project-bootstrap/tasks.md
+++ b/.spec-workflow/specs/project-bootstrap/tasks.md
@@ -1,6 +1,6 @@
 # Tasks Document
 
-Document version: v1
+Document version: v2
 
 Dependency order: tasks 1 to 3 change existing controller code (the session peek, then `addProjectByPath`, then the add route that calls it); tasks 4 to 8 build the new `src/bootstrap/` modules leaf first (controller client, agent-rules facts, argument parsing, `init`, `doctor`); task 9 wires the entrypoint to them; task 10 is the end-to-end test of shipped behaviour; task 11 is the documentation. Each task leaves `npx tsc --noEmit` clean and every existing suite green, because no existing caller changes until task 9 and task 9 adds only a branch for two new first arguments. Expected verifier count: five, for the brand-new modules of tasks 4 to 8 (structural red, high risk); the other tasks route by the normal risk rules, and no task touches a sensitive path.
 
@@ -32,7 +32,7 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Let `init` send the store root it resolved instead of the controller deriving one in its own environment.
   - _Leverage: src/dashboard/__tests__/health-route.test.ts, src/controller/access.ts_
   - _Requirements: 5.1, 5.4, 5.6_
-  - _Prompt: Task: Change the add route per design C7: the body is `{ projectPath, workflowRootPath? }`; a present workflowRootPath that is not a string, not absolute, or not an existing directory gets 400 with an error naming the field; otherwise call the addProjectByPath change task 2 ships with both values. Write the new route test with a real MultiProjectDashboardServer on a free port and temp homes, as health-route.test.ts:49-71 does, posting with Authorization Bearer and the secret read from the temp home | Restrictions: A body without workflowRootPath must produce the base call and response (Req 5 AC 6, an invariant: verified, not red-first); keep the 500 path for a thrown error; no change to makeRequireAccess | Success: a non-string, a relative and a missing-directory workflowRootPath each get 400 naming the field; a valid one gets 200 with projectId and projects.json holds both paths; `{ projectPath }` alone gets 200 with `{ projectId, success: true }`; a request without the secret gets 401_
+  - _Prompt: Task: Change the add route per design C7: the body is `{ projectPath, workflowRootPath? }`; a present workflowRootPath that is not a string, not absolute, or not an existing directory gets 400 with an error naming the field; otherwise call the addProjectByPath change task 2 ships with both values. Write the new route test with a real MultiProjectDashboardServer on a free port and temp homes, as src/dashboard/__tests__/health-route.test.ts:49-71 does, posting with Authorization Bearer and the secret read from the temp home | Restrictions: A body without workflowRootPath must produce the base call and response (Req 5 AC 6, an invariant: verified, not red-first); keep the 500 path for a thrown error; no change to makeRequireAccess | Success: a non-string, a relative and a missing-directory workflowRootPath each get 400 naming the field; a valid one gets 200 with projectId and projects.json holds both paths; `{ projectPath }` alone gets 200 with `{ projectId, success: true }`; a request without the secret gets 401_
 
 - [ ] 4. Create the controller client
   - File: src/bootstrap/controller-client.ts
@@ -78,12 +78,13 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
   - Purpose: Write `.mcp.json` and `agent-rules.md`, then register, with nothing written before every input is valid.
   - _Leverage: src/core/git-utils.ts, src/core/project-registry.ts_
   - _Requirements: 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.2, 4.6, 4.8, 5.1, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5_
-  - _Prompt: Task: Implement runInit per design C3 and Req 1 AC 7-8, Req 2, Req 3, Req 4 AC 2, 6 and 8, Req 5 AC 1 and 7, Req 6, and the Reliability NFR, using the controller client of task 4 and the facts module of task 5. Top level through gitTopLevel (src/core/git-utils.ts:152-158, design D5); realpath both roots (design D9); always send both paths (design D2); keep an existing agent-rules.md (requirements D3); replace only the spec-workflow entry (requirements D2); exit 2 keeps the files (requirements D4); the not-committed last line on exit 0 and 2 (design D8). Test against a fake controller (Fastify, installAccessControl, stub add route, SDD_PORT) with an explicit entryPath. Replace the local InitArgs of tasks 5 and 6 with an import of this module's export | Restrictions: Create no store directory other than .spec-workflow (requirements D10); write through a same-directory temp file and rename; never print the secret or an env value | Success: a missing path, a non-git path, a bad --store and malformed .mcp.json each exit 1 with no file written; a subdirectory acts on its top level; other keys and servers keep value and order and a missing mcpServers is added; the changed-entry line shows the was clause without env; env is the shared root with --store, else empty; output is two-space JSON plus newline; wrote, updated and kept lines and the registered line print; an existing agent-rules.md is byte-identical and a left-out fact prints its note; a byte-identical re-run prints kept twice and exits 0; no secret, missing controller and non-2xx exit 2 with the files kept; a rename spy shows same-directory temp files; no output line contains the secret or an env value_
+  - _Prompt: Task: Implement runInit per design C3 and Req 1 AC 7-8, Req 2, Req 3, Req 4 AC 2, 6 and 8, Req 5 AC 1 and 7, Req 6, and the Reliability NFR, using the controller client of task 4 and the facts module of task 5. Top level through gitTopLevel (src/core/git-utils.ts:152-158, design D5); realpath both roots (design D9); always send both paths (design D2); keep an existing agent-rules.md (requirements D3); replace only the spec-workflow entry (requirements D2); exit 2 keeps the files (requirements D4); the not-committed last line on exit 0 and 2 (design D8). Test against a fake controller (Fastify, installAccessControl, stub add route, SDD_PORT) with an explicit entryPath. Replace the local InitArgs of tasks 5 and 6 with an import of this module's export | Restrictions: Create no store directory other than .spec-workflow (requirements D10); write through a same-directory temp file and rename; never print the secret or an env value | Success: a missing path, a non-git path, a bad --store and malformed .mcp.json each exit 1 with no file written; a subdirectory acts on its top level; other keys and servers keep value and order and a missing mcpServers is added; the changed-entry line shows the was clause without env; env is the shared root with --store, else empty; output is two-space JSON plus newline; wrote, updated and kept lines and the registered line print; an existing agent-rules.md is byte-identical and a left-out fact prints its note; a byte-identical re-run prints kept twice and exits 0; no secret, missing controller and non-2xx exit 2 with the files kept; the last line on exit 0 and on exit 2 states the files are not committed and names doctor as the next command; a rename spy shows same-directory temp files; no output line contains the secret or an env value_
 
 - [ ] 8. Implement `doctor` and export `ghBin`
   - File: src/bootstrap/doctor.ts
   - File: src/controller/merge.ts
   - File: src/bootstrap/__tests__/doctor.test.ts
+  - Test: src/bootstrap/__tests__/doctor.test.ts — runDoctor(repoPath, io, timeoutMs)
   - Test: src/bootstrap/__tests__/doctor.test.ts — runChecks(top, timeoutMs)
   - Test: src/bootstrap/__tests__/doctor.test.ts — serviceEnv()
   - Implement design C4 and add only the `export` keyword to `ghBin` (`src/controller/merge.ts:47-50`, design C8). No existing merge test changes.
@@ -138,5 +139,10 @@ Dependency order: tasks 1 to 3 change existing controller code (the session peek
 
 ## Revision History
 
+- **v2** (2026-10-20) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/2/1).
+  - **R1-1 — Accepted (SHOULD_FIX).** Task 7 `Success:` now asserts the last line on exit 0 and on exit 2 states the files are not committed and names doctor as the next command (line 81), so Req 6 AC 5 is tested red-first.
+  - **R1-2 — Accepted (SHOULD_FIX).** Task 8 gains a `runDoctor(repoPath, io, timeoutMs)` test seam (line 87), pinning the reporter/exit contract of Req 7 AC 3 that `runChecks` and `serviceEnv` cannot assert.
+  - **R1-M1 — Rejected (MINOR).** Task 7 breadth stays: one command is one cohesive module with a declared up-front verifier, and splitting its three phases would invent shared-state seams; noted, not a defect.
+  - **Lint pass.** 1 fixed (L-3: task 3 prompt bare `health-route.test.ts:49-71` → `src/dashboard/__tests__/health-route.test.ts:49-71`; no other bare sibling — lines 33 and 112 already carry the prefix); rejected: L-1, L-2, L-4, L-5 (all suppressed by rule 11 — same tokens rejected with reason in v1 as L-1, L-2, L-18, L-26: the identifier is the method/keyword/command being added or documented, not a claim about the cited range).
 - **v1** (2026-10-20) — Initial draft.
   - **Lint pass.** 22 fixed; rejected: L-1 (`peekDashboardSession` is the new method being added, not a claim about the cited range), L-2 (`mkdir` is described as absent, "no mkdir"), L-18 (`export` is the keyword being added; the citation anchors `ghBin`), L-26 (`init` is the command being documented; the citation anchors the subsection/key-table location). Prompt citations gained their directory prefixes (L-3 to L-25); the bare `:29-45` sibling on task 1 was repaired to `src/core/dashboard-session.ts:29-45`; the MDX acorn break (L-9) and its brace siblings on tasks 2, 3 and 6 were wrapped in code spans.

````
