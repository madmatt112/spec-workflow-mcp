# Adversarial Review — lean-orchestrators/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-tasks.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing, task-test-seam on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below (the v2 lint pass fixed nothing — it only recorded dispositions). Still open (error = MUST_FIX candidate, warning = your call, info = a note):
  - L-1 (info, task-test-seam, line 70): task 7 changes source and has no Test line.
  - L-2 (warning, bridge-missing, line 79): task 8 names later task 12 with no bridge.
  - L-3 (warning, bridge-missing, line 90): task 9 names later task 13 with no bridge.
  - L-4 (warning, bridge-missing, line 143): task 13 names later task 14 with no bridge.
  - L-5 (info, task-test-seam, line 166): task 15 changes source and has no Test line.
  - L-6 (info, task-test-seam, line 178): task 16 changes source and has no Test line.
  The orchestrator rejected L-2, L-3, L-4 as scope-boundary notes (each earlier task defers work to, or explicitly leaves untouched, the later task's line; it does not consume a later task's artefact). Re-raise one only with new evidence, marked Recurring.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): lean-orchestrators tasks v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-2 MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch; the label is guidance and does not change the round budget.
- Fix-induced re-check: when a finding is caused by a fix round 1 made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round. The round-1 fixes re-pointed several greps (tasks 7, 9, 10, 11, 13, 14) and added one consumer reference (task 13 names the moved Reconcile step); re-run each changed grep against the real tree and confirm it hits only the intended lines and no forbidden or out-of-scope ones.
- Fresh lens for this round: every cited artifact re-read at both ends of its range — open each `path:start-end` the v2 delta added or changed and confirm the symbol and the line range still resolve in the current tree.
- gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md`. The orchestrator carries the kept ones to the human's gate B.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage: for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause; a test the prompt requires but the `Success:` clause omits is silently dropped — flag it as a normal finding.
- Closed by ruling, do not re-open: Req 7.3 runaway-guard basis (design D14 sizes the guard from the task total, not the requirement's open-tasks) — ruled a refinement in round 1.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-tasks.md. Read it first and rewrite it after your analysis, as the Prior review context section says.
- Code lives under /home/mcf/repo/spec-workflow-mcp; the spec store under /home/mcf/repo/spec-workflow-mcp/.spec-workflow. Use absolute paths. Project rules for reading code and running checks: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.

## Changes since a4bcb6a

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/tasks.md b/.spec-workflow/specs/lean-orchestrators/tasks.md
index fa5f5a3..97fe9af 100644
--- a/.spec-workflow/specs/lean-orchestrators/tasks.md
+++ b/.spec-workflow/specs/lean-orchestrators/tasks.md
@@ -1,5 +1,5 @@
 # Tasks Document — lean-orchestrators
-Document version: v1
+Document version: v2
 
 Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and the `sources` option in import order, and task 5 writes the baseline file at once, before the transcripts age out (Requirement 2). Task 6 adds the orient task queue; tasks 7 to 10 move the brief templates into their own module, then add the document kinds, the implementation kinds and the bookkeeping-script kind; task 11 sets the worker report blocks; tasks 12 to 14 rewrite the two phase skills and the supervisor on top of tasks 6 to 11; task 15 stages the fixture kit and the pending live record; task 16 runs the full checks. Each task leaves `npx tsc --noEmit` and every existing suite green, and a harness-only task changes no compiled code. Planned verifier spend: tasks 2, 3 and 7 create brand-new modules, so expect at least three verifier spawns; every other task routes on the gate's risk.
 
@@ -74,7 +74,7 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
   - Purpose: Requirement 3 criterion 3 — one home for every server-side brief before new kinds land; no behaviour change.
   - _Leverage: src/tools/harness.ts:480-563, src/tools/harness.ts:595-765, src/tools/__tests__/harness.test.ts:205-402_
   - _Requirements: 3.3_
-  - _Prompt: Task: Create src/tools/brief-templates.ts holding today's six kinds of `BRIEF_TEMPLATES` (src/tools/harness.ts:493-557) as a record of templates, each with `mode` (`write` for all six), `required`, `optional` and `render`; the illustrative type in design C6 is a guide, check it against the tests. `briefAction` (:595-765) keeps its unknown-kind, all-missing-at-once, agent-rules-line, task-block, test-author no-Test, TDD-marked `redTests`, graph-append and `safeJoin`-write behaviours, but builds the missing set from the template's `required` instead of the placeholder scan (:717-719). List each kind's `required` keys in today's placeholder order, so every message is byte-identical. Keep `codeGraphSection` exported from src/tools/harness.ts, which src/tools/__tests__/harness.test.ts:7 imports. No existing harness.test.ts value changes; every test whose title starts `brief`, and the drift guard, must pass unedited (base lines :205-402, :409-504). Count check: `grep -rn "six\|drafter, reviser" src/tools docs/TOOLS-REFERENCE.md` finds the count words; none change here | Restrictions: No new kind and no append mode in this task (tasks 8 and 10 add them, D2); do not change output bytes or messages | Success: `npx tsc --noEmit`, then `npx vitest run src/tools/__tests__/harness.test.ts` are green with no test edited_
+  - _Prompt: Task: Create src/tools/brief-templates.ts holding today's six kinds of `BRIEF_TEMPLATES` (src/tools/harness.ts:493-557) as a record of templates, each with `mode` (`write` for all six), `required`, `optional` and `render`; the illustrative type in design C6 is a guide, check it against the tests. `briefAction` (:595-765) keeps its unknown-kind, all-missing-at-once, agent-rules-line, task-block, test-author no-Test, TDD-marked `redTests`, graph-append and `safeJoin`-write behaviours, but builds the missing set from the template's `required` instead of the placeholder scan (:717-719). List each kind's `required` keys in today's placeholder order, so every message is byte-identical. Keep `codeGraphSection` exported from src/tools/harness.ts, which src/tools/__tests__/harness.test.ts:7 imports. No existing harness.test.ts value changes; every test whose title starts `brief`, and the drift guard, must pass unedited (base lines :205-402, :409-504). No count word states the number of brief kinds: `grep -rn "six templates\|six kinds\|six brief" src/tools docs/TOOLS-REFERENCE.md` returns nothing, so this move and the kinds tasks 8 to 10 add change no count assertion | Restrictions: No new kind and no append mode in this task (tasks 8 and 10 add them, D2); do not change output bytes or messages | Success: `npx tsc --noEmit`, then `npx vitest run src/tools/__tests__/harness.test.ts` are green with no test edited_
 
 - [ ] 8. Document-phase brief kinds and append mode
   - File: src/tools/brief-templates.ts
@@ -96,7 +96,7 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
   - Purpose: Requirement 3 criteria 3 and 4 — the standing briefs and every task brief come from the server.
   - _Leverage: harness/skills/sdd-implementation-phase/references/briefs.md:5-65, harness/skills/sdd-implementation-phase/references/briefs.md:67-101, harness/skills/sdd-implementation-phase/references/briefs.md:103-132, harness/skills/sdd-implementation-phase/references/briefs.md:134-156, harness/skills/sdd-implementation-phase/references/briefs.md:158-267_
   - _Requirements: 3.3, 3.4, 5.1, 5.2_
-  - _Prompt: Task: In the module task 7 creates, add or replace the kinds of the design C6 table rows `impl-standing`, `verify-standing`, `implementer`, `fix`, `verifier` and the `taskId` form of `adjudicator`, each with the values its row lists; `test-author` stays as it is. Texts are the sections of harness/skills/sdd-implementation-phase/references/briefs.md verbatim: implementer standing :5-65, implementer and red tests :67-101, fix :103-132 (variants `gate`, `verifier`, `repair`, `ci` from :232-253, and `reconcile`), verifier standing :134-156, verifier :158-191 (variants `task`, `batch`, `narrow`, `e2e` from :209-230, `ci` from :255-267), task adjudication :193-207. Replace each report sentence, and the two standing briefs' report bullet, with the design C9 block sentence and that role's keys (D1, Requirement 5.1). `redTests` stops being a caller value: on a TDD-marked task the implementer kind requires `authorFiles` and `authorReport` and renders the red-tests section from them; an unmarked task takes neither. This changes the four `brief implementer` tests that pass `redTests` (base src/tools/__tests__/harness.test.ts:335-402): re-point them to the two new values, keeping their placement and required-only-when-marked assertions. Add one render snapshot per distinct output: each fix and verifier variant, both standing kinds, marked and unmarked implementer | Restrictions: Leave `## PR body rules` (:269-279) for task 13; do not edit the skills here | Success: `npx tsc --noEmit`, then `npx vitest run src/tools/__tests__/harness.test.ts` are green_
+  - _Prompt: Task: In the module task 7 creates, add or replace the kinds of the design C6 table rows `impl-standing`, `verify-standing`, `implementer`, `fix`, `verifier` and the `taskId` form of `adjudicator`, each with the values its row lists; `test-author` stays as it is. Texts are the sections of harness/skills/sdd-implementation-phase/references/briefs.md verbatim: implementer standing :5-65, implementer and red tests :67-101, fix :103-132 (variants `gate`, `verifier`, `repair`, and `ci` and `reconcile` from :232-253 — both render the CI-fix content, as today's Reconcile step reuses it through the reviser template), verifier standing :134-156, verifier :158-191 (variants `task`, `batch`, `narrow`, `e2e` from :209-230, `ci` from :255-267), task adjudication :193-207. Replace each report sentence, and the two standing briefs' report bullet, with the design C9 block sentence and that role's keys (D1, Requirement 5.1). `redTests` stops being a caller value: on a TDD-marked task the implementer kind requires `authorFiles` and `authorReport` and renders the red-tests section from them; an unmarked task takes neither. This changes the four `brief implementer` tests that pass `redTests` (base src/tools/__tests__/harness.test.ts:335-402): re-point them to the two new values, keeping their placement and required-only-when-marked assertions. Add one render snapshot per distinct output: each fix and verifier variant, both standing kinds, marked and unmarked implementer | Restrictions: Leave `## PR body rules` (:269-279) for task 13; do not edit the skills here | Success: `npx tsc --noEmit`, then `npx vitest run src/tools/__tests__/harness.test.ts` are green_
 
 - [ ] 10. Bookkeeping script kind
   - File: src/tools/brief-templates.ts
@@ -107,7 +107,7 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
   - Purpose: Requirement 6 — one bookkeeping call between two worker spawns, re-runnable after a partial failure, rows only through `EVENT_SCRIPT`.
   - _Leverage: harness/skills/sdd-continue/references/formats.md:101-117, harness/skills/sdd-continue/references/formats.md:164-183, harness/skills/sdd-document-phase/references/cleanup.md:71-159, src/core/task-parser.ts:446-485_
   - _Requirements: 3.5, 4.4, 6.4, 6.5, 6.6, 6.7_
-  - _Prompt: Task: Add the `book-script` kind (values per its design C6 row) rendering a bash script with every segment of the design C7 table — `event`, `check`, `retro`, `state`, `commit`, `head`, `changes`, `edit` — each with that table's effect and already-landed rule, the C7 output lines, exit 1 naming the segment on failure with no later segment run, and exit 2 on a usage error. It reads the run id and ledger path from the event script's `SDD_RUN` and `SDD_LEDGER` lines (harness/skills/sdd-continue/references/formats.md:164-183) and appends rows only by calling that script. The script runs under `set -u` and reads every optional environment variable as `${VAR:-}`, never bare. The test renders the kind into a temp git store with stub scripts at `<temp store>/event.sh` and `<temp store>/retro.sh`, never the supervisor's `EVENT_SCRIPT` path; runs every segment; forces a commit failure with a held `index.lock`; re-runs; and asserts no doubled ledger row or retro entry, exit codes 1 and 2 and the failed step name, asserting only on exit codes and file contents. Update the `brief` bullet of docs/TOOLS-REFERENCE.md for the kinds tasks 8 to 10 add, append mode and `book-script`; run `grep -rn "six\|drafter, reviser" src/tools docs/TOOLS-REFERENCE.md` and update every count word it finds | Restrictions: Only the supervisor creates the run's event script; the script never rewrites, re-initializes or repoints it; ledger row types and keys stay unchanged (Requirement 6.5) | Success: `npx tsc --noEmit`, then `npx vitest run src/__tests__/book-script.test.ts src/tools/__tests__/harness.test.ts` are green_
+  - _Prompt: Task: Add the `book-script` kind (values per its design C6 row) rendering a bash script with every segment of the design C7 table — `event`, `check`, `retro`, `state`, `commit`, `head`, `changes`, `edit` — each with that table's effect and already-landed rule, the C7 output lines, exit 1 naming the segment on failure with no later segment run, and exit 2 on a usage error. It reads the run id and ledger path from the event script's `SDD_RUN` and `SDD_LEDGER` lines (harness/skills/sdd-continue/references/formats.md:164-183) and appends rows only by calling that script. The script runs under `set -u` and reads every optional environment variable as `${VAR:-}`, never bare. The test renders the kind into a temp git store with stub scripts at `<temp store>/event.sh` and `<temp store>/retro.sh`, never the supervisor's `EVENT_SCRIPT` path; runs every segment; forces a commit failure with a held `index.lock`; re-runs; and asserts no doubled ledger row or retro entry, exit codes 1 and 2 and the failed step name, asserting only on exit codes and file contents. Update the `brief` bullet of docs/TOOLS-REFERENCE.md for the kinds tasks 8 to 10 add, append mode and `book-script`; no brief-kind count word exists there (`grep -rn "six templates\|six kinds\|six brief" src/tools docs/TOOLS-REFERENCE.md` returns nothing), so no count word changes | Restrictions: Only the supervisor creates the run's event script; the script never rewrites, re-initializes or repoints it; ledger row types and keys stay unchanged (Requirement 6.5) | Success: `npx tsc --noEmit`, then `npx vitest run src/__tests__/book-script.test.ts src/tools/__tests__/harness.test.ts` are green_
 
 - [ ] 11. Worker report blocks
   - File: harness/agents/sdd-drafter.md
@@ -123,7 +123,7 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
   - Purpose: Requirement 5 — reports of at most 8 key lines within 80 words, so they stop growing the orchestrator context.
   - _Leverage: harness/agents/sdd-drafter.md:30, harness/agents/sdd-reviewer.md:26, harness/agents/sdd-implementer.md:38, harness/agents/sdd-verifier.md:34_
   - _Requirements: 5.1, 5.2, 5.4_
-  - _Prompt: Task: In each of the eight agent files replace the report bullet named in the design C9 table (drafter :30, reviewer :26, reviser :35, adjudicator :29, checker :25, implementer :38, test author :32, verifier :34) with the C9 sentence and that row's keys, in that order. Note the block in docs/SDD-HARNESS.md where it describes worker reports. Run `grep -rn "150 words\|120 words\|100 words" harness/agents docs/SDD-HARNESS.md` and update every worker report cap it finds; orchestrator caps stay. Then run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets` and `claude plugin validate . --strict`, and commit the `plugins/` copies in the same commit | Restrictions: Do not touch harness/hooks/ — the `spawn.report` row stays as it is (Requirement 5.4); do not change any agent's frontmatter | Success: each agent file states its C9 keys; the three harness checks pass_
+  - _Prompt: Task: In each of the eight agent files replace the report bullet named in the design C9 table (drafter :30, reviewer :26, reviser :35, adjudicator :29, checker :25, implementer :38, test author :32, verifier :34) with the C9 sentence and that row's keys, in that order. Note the block in docs/SDD-HARNESS.md where it describes worker reports. Run `grep -rn "150 words\|120 words\|100 words" harness/agents` and update only the eight C9 worker report-cap bullets above; the four orchestrator caps (document, implementation, retro and close-out orchestrators) and harness/agents/sdd-retro-analyst.md:26 stay (the retro orchestrator keeps its shape, decomposition entry 14). Also correct the stale "reports in 150 words" in the implementer frontmatter description (harness/agents/sdd-implementer.md:3) to 80, the one frontmatter number this task changes, so it matches the new cap. Do not grep docs/SDD-HARNESS.md for report caps: its only hit (docs/SDD-HARNESS.md:78) is the tasks.md task-block size, not a report cap. Then run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets` and `claude plugin validate . --strict`, and commit the `plugins/` copies in the same commit | Restrictions: Do not touch harness/hooks/ — the `spawn.report` row stays as it is (Requirement 5.4); change no agent frontmatter except the stale word count in the implementer description (model, effort, tools and cacheTtl stay) | Success: each agent file states its C9 keys; the three harness checks pass_
 
 - [ ] 12. Document-phase skill split
   - File: harness/skills/sdd-document-phase/SKILL.md
@@ -152,7 +152,7 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
   - Purpose: Requirement 3 criteria 2 to 6, Requirement 4, Requirement 5 criterion 3, Requirement 6 criteria 1 and 2, Requirement 7 criteria 1 and 5.
   - _Leverage: harness/skills/sdd-implementation-phase/SKILL.md:6-22, harness/skills/sdd-implementation-phase/SKILL.md:49-77, harness/skills/sdd-implementation-phase/SKILL.md:104-107, harness/skills/sdd-implementation-phase/SKILL.md:186-198, harness/skills/sdd-implementation-phase/SKILL.md:252-267, harness/skills/sdd-implementation-phase/references/briefs.md:269-279_
   - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 5.3, 6.1, 6.2, 7.1, 7.5_
-  - _Prompt: Task: Move the sections the design C8 table assigns to references/completion.md and stops.md, heading texts unchanged, with router lines at the points C8 lists; move `## PR body rules` (harness/skills/sdd-implementation-phase/references/briefs.md:269-279) into completion.md, reading only the `## PR body` section of the agent rules (D4). Own reads (harness/skills/sdd-implementation-phase/SKILL.md:6-13) become the orient data task 6 adds, the HANDOFF section and report blocks; never read `tasks.md`, the decomposition or the agent rules whole (Requirement 4.1). Rewrite the budget default and its rationale for 5 tasks (:14-20, Requirement 7.1). Remove the briefs read (:22) and the cleanup-script text (:49-58). Step 0 writes `book.sh` and the two standing briefs with the kinds tasks 9 and 10 add. Pick takes the next task from the orient data task 6 adds; the gate's `files` are that task's files and its `checks` come from the checks file the implementer's report block names (task 11; design D10, D17; Requirements 4.1, 5.2). Use the design C7 compositions, so `spawn.usage`, gate `note` and `judge` rows ride the next bookkeeping call (:59-77, Requirement 6.2). The e2e verifier gets the scenario text from the orient data task 6 adds (Requirement 4.3). Step 7 adds Requirement 7.5: when the budget-filling task is the last open one, report `PHASE: resume` with `NEXT: completion gate`. Route only on block keys; a missing block is a stall: re-spawn once, then `PHASE: error`. Extend the skill-split test: the implementation-phase SKILL.md names no `briefs.md`. Update docs/SDD-HARNESS.md for the skill layout and the 5-task budget. Run `grep -rn "20 tasks\|default 20\|20-task" harness docs/SDD-HARNESS.md` and update each hit except the historical quote in docs/harness-efficiency-plan.md. Run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets`, `claude plugin validate . --strict`; commit the `plugins/` copies | Restrictions: Keep the Deferral bar, the TDD author step and the batched-verification rules unchanged in meaning; a fresh worker per task stays (Requirement 8.1) | Success: `npx vitest run src/__tests__/skill-split.test.ts` is green and the three harness checks pass_
+  - _Prompt: Task: Move the sections the design C8 table assigns to references/completion.md and stops.md, heading texts unchanged, with router lines at the points C8 lists; move `## PR body rules` (harness/skills/sdd-implementation-phase/references/briefs.md:269-279) into completion.md, reading only the `## PR body` section of the agent rules (D4). The moved Reconcile-a-red-PR step calls the `fix` kind's `reconcile` variant and the `verifier` kind's `ci` variant task 9 adds, replacing its `reviser`-template CI-fix call, so no server-side brief kind is left unconsumed. Own reads (harness/skills/sdd-implementation-phase/SKILL.md:6-13) become the orient data task 6 adds, the HANDOFF section and report blocks; never read `tasks.md`, the decomposition or the agent rules whole (Requirement 4.1). Rewrite the budget default and its rationale for 5 tasks (:14-20, Requirement 7.1). Remove the briefs read (:22) and the cleanup-script text (:49-58). Step 0 writes `book.sh` and the two standing briefs with the kinds tasks 9 and 10 add. Pick takes the next task from the orient data task 6 adds; the gate's `files` are that task's files and its `checks` come from the checks file the implementer's report block names (task 11; design D10, D17; Requirements 4.1, 5.2). Use the design C7 compositions, so `spawn.usage`, gate `note` and `judge` rows ride the next bookkeeping call (:59-77, Requirement 6.2). The e2e verifier gets the scenario text from the orient data task 6 adds (Requirement 4.3). Step 7 adds Requirement 7.5: when the budget-filling task is the last open one, report `PHASE: resume` with `NEXT: completion gate`. Route only on block keys; a missing block is a stall: re-spawn once, then `PHASE: error`. Extend the skill-split test: the implementation-phase SKILL.md names no `briefs.md`. Update docs/SDD-HARNESS.md for the skill layout and the 5-task budget. Run `grep -rn "20 tasks\|default 20\|20-task\|twenty tasks" harness/skills/sdd-implementation-phase docs/SDD-HARNESS.md` and update each hit; this scope leaves the supervisor launch line (harness/skills/sdd-continue/SKILL.md:291, which task 14 owns) and the historical quote in docs/harness-efficiency-plan.md untouched. Run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets`, `claude plugin validate . --strict`; commit the `plugins/` copies | Restrictions: Keep the Deferral bar, the TDD author step and the batched-verification rules unchanged in meaning; a fresh worker per task stays (Requirement 8.1) | Success: `npx vitest run src/__tests__/skill-split.test.ts` is green and the three harness checks pass_
 
 - [ ] 14. Supervisor budget and runaway guard
   - File: harness/skills/sdd-continue/SKILL.md
@@ -161,7 +161,7 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
   - Purpose: Requirement 7 criteria 1 to 4 — shorter implementation spawns without tripping the guard.
   - _Leverage: harness/skills/sdd-continue/SKILL.md:291, harness/skills/sdd-continue/SKILL.md:350-351, harness/skills/sdd-continue/SKILL.md:379-380_
   - _Requirements: 7.1, 7.2, 7.3, 7.4_
-  - _Prompt: Task: Change the launch line (harness/skills/sdd-continue/SKILL.md:291) to `BUDGET: <4 review rounds | 5 tasks | all items | n/a>`. Rewrite the runaway guard (:379-380): for implementation, more than max(12, ceil(T/B) + 4) orchestrator spawns is an `error`, where T is `data.tasks.total` from one `harness` `orient` call before the run's first implementation spawn and B the budget; the error names the count and the allowance; other phases keep 12. Leave resume (:350-351) and the document budget unchanged. Update the guard text in docs/SDD-HARNESS.md where it states the limit; `grep -rn "12 orchestrator spawns\|Runaway guard" harness docs` finds each statement. Run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets` and `claude plugin validate . --strict`, and commit the `plugins/` copies | Restrictions: Use the task total, not open tasks (design D14); do not change Gate A, Gate B or dispatch | Success: the line reads 5 tasks, the guard states the formula, and the three harness checks pass_
+  - _Prompt: Task: Change the launch line (harness/skills/sdd-continue/SKILL.md:291) to `BUDGET: <4 review rounds | 5 tasks | all items | n/a>`. Rewrite the runaway guard (:379-380): for implementation, more than max(12, ceil(T/B) + 4) orchestrator spawns is an `error`, where T is `data.tasks.total` from one `harness` `orient` call before the run's first implementation spawn and B the budget; the error names the count and the allowance; other phases keep 12. Leave resume (:350-351) and the document budget unchanged. Update the guard text in docs/SDD-HARNESS.md where it states the limit (the phase-agnostic "More than twelve spawns for one phase" statement at docs/SDD-HARNESS.md:130-134) so it states the scaled implementation allowance while other phases keep 12; `grep -rn "12 orchestrator spawns\|twelve spawns\|Runaway guard" harness docs` finds each statement (harness/skills/sdd-continue/SKILL.md:379 and docs/SDD-HARNESS.md:133). Run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets` and `claude plugin validate . --strict`, and commit the `plugins/` copies | Restrictions: Use the task total, not open tasks (design D14); do not change Gate A, Gate B or dispatch | Success: the line reads 5 tasks, the guard states the formula, and the three harness checks pass_
 
 - [ ] 15. Fixture kit and pending live record
   - File: .spec-workflow/specs/lean-orchestrators/e2e/stage.sh
@@ -210,5 +210,12 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
 
 ## Revision History
 
+- **v2** (2026-10-03) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/4/1).
+  - **R1-1 — Accepted (SHOULD_FIX).** Task 9 now sources the reconcile fix variant from the CI-fix section at 232-253 alongside ci, since both render that content, and task 13 names the moved Reconcile step as its consumer so no server brief kind is orphaned.
+  - **R1-2 — Accepted (SHOULD_FIX).** Task 11 scopes the report-cap grep to harness/agents, keeps the four orchestrator caps and the retro-analyst cap, excludes the task-block-size hit in SDD-HARNESS.md, and corrects the stale implementer frontmatter number to 80; the restriction now permits only that one frontmatter number.
+  - **R1-3 — Accepted (SHOULD_FIX).** Task 13's budget grep is scoped to the implementation skill and SDD-HARNESS.md and gains twenty tasks, so it no longer reaches the supervisor launch line that task 14 owns while still catching the twenty-tasks doc statement.
+  - **R1-4 — Accepted (SHOULD_FIX).** Task 14's guard grep adds the word form twelve spawns and points the docs edit at SDD-HARNESS.md lines 130-134, so the phase-agnostic statement is found and restated with the scaled implementation allowance.
+  - **R1-5 — Accepted (MINOR).** The inert six/drafter-reviser grep is dropped from tasks 7 and 10; both now prove no brief-kind count word exists, removing the risk of corrupting the sixteen-rules count.
+  - **Lint pass.** 0 fixed; rejected: L-2 (task 8 defers deleting briefs.md to task 12 — a scope-boundary note, not consumption of a task-12 artefact), L-3 (task 9 defers the PR-body-rules move to task 13; same reason), L-4 (task 13 explicitly leaves the launch line task 14 owns untouched — a boundary note, not a bridge).
 - **v1** (2026-10-03) — Initial draft.
   - **Lint pass.** 14 fixed (10 reported plus 4 masked sibling MDX brace-call Test lines); rejected: L-5 (task 8 defers deleting briefs.md to task 12; it does not consume a task-12 artefact, so no bridge is owed), L-7 (task 9 defers the PR-body-rules move to task 13; same reason).
````

## Lint commit 9147a73

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/tasks.md b/.spec-workflow/specs/lean-orchestrators/tasks.md
index 60ee881..97fe9af 100644
--- a/.spec-workflow/specs/lean-orchestrators/tasks.md
+++ b/.spec-workflow/specs/lean-orchestrators/tasks.md
@@ -216,5 +216,6 @@ Tasks 1 to 4 build the W fold, the source breakdown, the transcript locator and
   - **R1-3 — Accepted (SHOULD_FIX).** Task 13's budget grep is scoped to the implementation skill and SDD-HARNESS.md and gains twenty tasks, so it no longer reaches the supervisor launch line that task 14 owns while still catching the twenty-tasks doc statement.
   - **R1-4 — Accepted (SHOULD_FIX).** Task 14's guard grep adds the word form twelve spawns and points the docs edit at SDD-HARNESS.md lines 130-134, so the phase-agnostic statement is found and restated with the scaled implementation allowance.
   - **R1-5 — Accepted (MINOR).** The inert six/drafter-reviser grep is dropped from tasks 7 and 10; both now prove no brief-kind count word exists, removing the risk of corrupting the sixteen-rules count.
+  - **Lint pass.** 0 fixed; rejected: L-2 (task 8 defers deleting briefs.md to task 12 — a scope-boundary note, not consumption of a task-12 artefact), L-3 (task 9 defers the PR-body-rules move to task 13; same reason), L-4 (task 13 explicitly leaves the launch line task 14 owns untouched — a boundary note, not a bridge).
 - **v1** (2026-10-03) — Initial draft.
   - **Lint pass.** 14 fixed (10 reported plus 4 masked sibling MDX brace-call Test lines); rejected: L-5 (task 8 defers deleting briefs.md to task 12; it does not consume a task-12 artefact, so no bridge is owed), L-7 (task 9 defers the PR-body-rules move to task 13; same reason).
````
