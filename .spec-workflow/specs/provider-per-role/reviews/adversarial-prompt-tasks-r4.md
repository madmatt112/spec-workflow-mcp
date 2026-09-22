# Adversarial Review — provider-per-role/tasks (v4)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v4. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-tasks-r3.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-tasks.md using this format:

```markdown
# Adversarial Review Memory — tasks
Last updated: <today's date> (after v4 review)

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-tasks-r4.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v4.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing on v4 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v4 lint commit changed: the `## Lint commit` section below (the two line-119 `.spec-workflow/spec-decomposition/decomposition.md` citations). Still open (error = MUST_FIX candidate, warning = your call, info = a note):
  - L-3 (69 warnings, your call, citation-identifier + bridge-missing, lines 9,16,25,35,37,44,72,83,96,100,117): the same class the v1, v2, v3 and v4 lint passes all rejected — each flagged token is a new env var/artifact/field this spec creates (for example `DEEPSEEK_API_KEY`, `SDD_PROVIDERS`, `ANTHROPIC_MODEL`, `provider`, `effort`, `tokensByProvider`, `reduceSpawn`, `buildUsageReport`, `formatUsageTable`, `ELIGIBLE`, the `verification` deferral tag at line 96) or an identifier cited correctly elsewhere in the same task's prompt; the two bridge-missing (lines 9, 37) are the forward task references the preamble's dependency order documents. Judge whether any names a range genuinely wrong; do not re-raise the class as a whole.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): provider-per-role tasks v3` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines, and the v4 lint commit follows as `## Lint commit <short sha>`.
- Read the Revision History line for v4 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text a previous delta wrote `Compounds: R<k>-<n>`, naming the round-`k` finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised is marked `Compounds: R<k>-<n>` for the round `k` that first raised it. Label each round-4 MUST_FIX `fix-induced` when the v4 delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch.
- This is the fourth reviewed version. Three rounds of fixes have landed. Do not pad: a clean round is a valid, expected result here — show what you checked and how, and say converged. MINOR-only findings do not keep the loop alive.
- Fresh lens for this round: a cold read for internal contradictions and a truth table of the stated cases. Build the table for the `DEEPSEEK_API_KEY` set / unset branches across tasks 1, 4, 5, 7, 8 and 10, and the `provider = deepseek | anthropic | none` cases across the launcher, the hook and the usage/watch fold; find any pair of task prompts, Success lines or Decisions that state contradictory outcomes for the same case. Prior rounds used wire contracts / decomposition scope (r1), the cost of touching existing components (r2) and the prompt-only implementer (r3); do not repeat those.
- tasks phase, gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md`. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-tasks.md`. Read it first and rewrite it after your analysis, as the scaffold above says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 4027247

````diff
diff --git a/.spec-workflow/specs/provider-per-role/tasks.md b/.spec-workflow/specs/provider-per-role/tasks.md
index de6f070..66fdc14 100644
--- a/.spec-workflow/specs/provider-per-role/tasks.md
+++ b/.spec-workflow/specs/provider-per-role/tasks.md
@@ -1,6 +1,6 @@
 # Tasks Document — provider-per-role
 
-Document version: v3
+Document version: v4
 
 This spec sends `sdd-reviewer` and `sdd-checker` (and `sdd-reviser` on a passed preflight) to DeepSeek through a `claude -p` child while the session and every other role stay on Anthropic, and splits the ledger, `harness usage` and the watch view by provider. The eight design components map to tasks as follows: Component 3 is tasks 1 and 2; Component 7 is tasks 1 and 3; Component 1 is task 4; Component 2 is task 5; Component 4 is task 6; Component 5 is task 7; Component 6 is task 8; Component 8 is task 9; task 10 is the verification of Requirement 7. No steering document exists on this store, so the standards applied are those of `.spec-workflow/agent-rules.md`: tests beside the module, `harness/` as the single source with the generated `plugins/` copies committed in the same commit, node 20 assertions only.
 
@@ -93,11 +93,11 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
 
 - [ ] 10. End-to-end verification of Requirement 7
   - File: none (verification only)
-  - Run the checks and the six corrected scenarios; this task's own implementer (spawned like any task, `harness/skills/sdd-implementation-phase/SKILL.md:84-99`) does the work and reports the supervisor/orchestrator halves as `AFFECTS-FUTURE-SPECS:` lines, since the implementer is barred from `deferrals` (`harness/agents/sdd-implementer.md:35`); the orchestrator, which holds `deferrals` and already routes that flag through the Deferral bar (`harness/skills/sdd-implementation-phase/SKILL.md:100-106,167-175`), files the records. Step 8's completion-gate verifier is a different agent that still greps the decomposition entry's superseded wording (requirements Scope notes: Requirement 7's "as written" means the outcome, not that wording) — this task, not that grep, is the corrected check.
+  - Run the checks and the six corrected scenarios; this task's own implementer (spawned like any task, `harness/skills/sdd-implementation-phase/SKILL.md:84-99`) does the work and reports the supervisor/orchestrator halves as `AFFECTS-FUTURE-SPECS:` lines, since the implementer is barred from `deferrals` (`harness/agents/sdd-implementer.md:35`); the orchestrator, which holds `deferrals`, routes that flag through the Deferral bar (`harness/skills/sdd-implementation-phase/SKILL.md:100-106,167-175`) and files the record, tagged `verification` explicitly since the bar itself names none. Step 8's completion-gate verifier is a different agent that still greps the decomposition entry's superseded wording (requirements Scope notes: Requirement 7's "as written" means the outcome, not that wording) — this task, not that grep, is the corrected check.
   - Purpose: the spec is judged on its ledger and checks (Requirement 7; design Testing Strategy, end-to-end).
   - _Leverage: harness/skills/sdd-implementation-phase/SKILL.md:84-99, harness/skills/sdd-implementation-phase/SKILL.md:100-106, harness/skills/sdd-implementation-phase/SKILL.md:167-175, harness/skills/sdd-implementation-phase/SKILL.md:201-209, harness/agents/sdd-implementer.md:35, harness/agents/sdd-implementation-orchestrator.md:31-33, docs/deepseek-preflight.md, src/watch/__tests__/index.test.ts:82-94_
   - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
-  - _Prompt: Task: Run, each as its own command: `npm run check:plugin-assets`, `npx tsc --noEmit`, `npm run build`, `npm test -- --run`, `claude plugin validate . --strict`. Then the scenarios. (1) With `DEEPSEEK_API_KEY` set, stage `/tmp/scratchpad/sdd/provider-per-role/scratch-store/.spec-workflow/specs/provider-per-role/` with its own `event.sh` (formats.md text), build `launch.sh` from the formats.md `## Launcher (launch.sh)` text pointed at it with `SDD_PROVIDERS=sdd-reviewer:deepseek:deepseek-v4-pro`, and run it for `sdd-reviewer` with a review prompt as task 1 built: the analysis file ends with the verdict block; the ledger holds one `spawn.start` (`provider=deepseek`, `model=deepseek-v4-pro`, `effort=not-applied`) and one `spawn.end` (`provider=deepseek`, `model` equal to the string docs/deepseek-preflight.md recorded, digit usage). (2) A ledger written by today's hook path carries no `provider` key: `npx vitest run src/__tests__/hook-spawn-events.test.ts` green stands for it. (3) `env -u DEEPSEEK_API_KEY bash harness/skills/sdd-continue/references/sdd-providers.sh <a temp rules file with a deepseek row>` exits 3 naming the role and the key; `node dist/index.js --watch <scratch store repo> --spec provider-per-role --once` on a spec dir without a ledger prints the no-ledger line (src/watch/__tests__/index.test.ts:79). (4) Fold the (1) ledger with `node -e` importing `dist/watch/usage.js` (`buildUsageReport`, `formatUsageTable`): the reviewer row is `sdd-reviewer@deepseek`, the total line's `deepseek` figure equals its tokens and the `anthropic` figure excludes them. (5) `node dist/index.js --watch . --spec review-gate --once` prints `tokens 6.3M`. (6) is the check list above. The supervisor halves of (1)-(3) (refusal at the roots step, the orchestrator's launcher call, the Anthropic reviser round through the Agent tool) need the merged skills in a restarted session: this task runs as a normal implementer task (`harness/skills/sdd-implementation-phase/SKILL.md:84-99`), not the step-8 verifier of `harness/skills/sdd-implementation-phase/SKILL.md:201-209`, so report `AFFECTS-FUTURE-SPECS: <one line>` naming, as the revisit check, the exact command `run a fixture requirements round of a scratch spec with agent-rules.md naming sdd-reviewer: deepseek deepseek-v4-pro, then with every role anthropic, then with the key unset`; the orchestrator holds `deferrals` and you do not (`harness/agents/sdd-implementer.md:35`), so it routes the flag through the Deferral bar (`harness/skills/sdd-implementation-phase/SKILL.md:167-175`) into one record tagged `verification` with that command as `revisitCriteria` | Restrictions: Never print the key; scratch files under `/tmp/scratchpad/sdd/provider-per-role/` only; never run the Playwright suites; do not edit `.spec-workflow/agent-rules.md` of this store (the scratch store carries the test map). With `DEEPSEEK_API_KEY` unset, (1) and (4) are not deferred but failed: report the failure naming the key with `RETRO: bug` (Requirement 6 criterion 7 applies to the run, and the design's end-to-end paragraph says so); no `VERIFY:` line — this task's report uses the implementer's flags, not the step-8 verifier's | Success: every command in the check list exits 0; (1) and (4) show the recorded `message.model` and the split figures; (3) exits 3 and the watch frame shows no run; (5) prints `tokens 6.3M`; the report names each scenario's outcome and carries one `AFFECTS-FUTURE-SPECS:` line per deferred half naming that command_
+  - _Prompt: Task: Run, each as its own command: `npm run check:plugin-assets`, `npx tsc --noEmit`, `npm run build`, `npm test -- --run`, `claude plugin validate . --strict`. Then the scenarios. (1) With `DEEPSEEK_API_KEY` set, stage `/tmp/scratchpad/sdd/provider-per-role/scratch-store/.spec-workflow/specs/provider-per-role/` with its own `event.sh` (formats.md text), build `launch.sh` from the formats.md `## Launcher (launch.sh)` text pointed at it with `SDD_PROVIDERS=sdd-reviewer:deepseek:deepseek-v4-pro`, and run it for `sdd-reviewer` with a review prompt as task 1 built: the analysis file ends with the verdict block; the ledger holds one `spawn.start` (`provider=deepseek`, `model=deepseek-v4-pro`, `effort=not-applied`) and one `spawn.end` (`provider=deepseek`, `model` equal to the string docs/deepseek-preflight.md recorded, digit usage). (2) A ledger written by today's hook path carries no `provider` key: `npx vitest run src/__tests__/hook-spawn-events.test.ts` green stands for it. (3) `env -u DEEPSEEK_API_KEY bash harness/skills/sdd-continue/references/sdd-providers.sh <a temp rules file with a deepseek row>` exits 3 naming the role and the key; `node dist/index.js --watch <scratch store repo> --spec provider-per-role --once` on a spec dir without a ledger prints the no-ledger line (src/watch/__tests__/index.test.ts:79). (4) Fold the (1) ledger with `node -e` importing `dist/watch/usage.js` (`buildUsageReport`, `formatUsageTable`): the reviewer row is `sdd-reviewer@deepseek`, the total line's `deepseek` figure equals its tokens and the `anthropic` figure excludes them. (5) `node dist/index.js --watch . --spec review-gate --once` prints `tokens 6.3M`. (6) is the check list above. The supervisor halves of (1)-(3) (refusal at the roots step, the orchestrator's launcher call, the Anthropic reviser round through the Agent tool) need the merged skills in a restarted session: this task runs as a normal implementer task (`harness/skills/sdd-implementation-phase/SKILL.md:84-99`), not the step-8 verifier of `harness/skills/sdd-implementation-phase/SKILL.md:201-209`, so report `AFFECTS-FUTURE-SPECS: <one line>` naming, as the revisit check, the exact command `run a fixture requirements round of a scratch spec with agent-rules.md naming sdd-reviewer: deepseek deepseek-v4-pro, then with every role anthropic, then with the key unset`; the orchestrator holds `deferrals` and you do not (`harness/agents/sdd-implementer.md:35`); it passes the flag to the Deferral bar (`harness/skills/sdd-implementation-phase/SKILL.md:167-175`), which — only when its three-part test holds — files a `deferrals` record with tag `verification` and that command as `revisitCriteria`, both set explicitly since the bar names no tag on its own | Restrictions: Never print the key; scratch files under `/tmp/scratchpad/sdd/provider-per-role/` only; never run the Playwright suites; do not edit `.spec-workflow/agent-rules.md` of this store (the scratch store carries the test map). With `DEEPSEEK_API_KEY` unset, (1) and (4) are not deferred but failed: report the failure naming the key with `RETRO: bug` (Requirement 6 criterion 7 applies to the run, and the design's end-to-end paragraph says so); no `VERIFY:` line — this task's report uses the implementer's flags, not the step-8 verifier's | Success: every command in the check list exits 0; (1) and (4) show the recorded `message.model` and the split figures; (3) exits 3 and the watch frame shows no run; (5) prints `tokens 6.3M`; the report names each scenario's outcome and carries one `AFFECTS-FUTURE-SPECS:` line naming that command_
 
 ## Decisions taken in this document
 
@@ -105,7 +105,7 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
 - D2 — The eligible-set line is written by task 4 from the preflight record, not by the preflight task: options were the preflight task editing a script that does not exist yet, a placeholder script written before the preflight, the map-script task reading the record; chosen because the record is the single source of the (b) outcome and the script is created after it (design D17 names the editing task; the record decides the value).
 - D3 — Compare-mode provider pair goes at the end of each total line, after the delta text: options were after each spec's total cell, at the end of the line; chosen because the existing compare assertions are substring matches on the cells through the delta, and R2-1 left the placement to implementation.
 - D4 — Every harness task runs the asset sync and commits the `plugins/` copies in its own commit, so no sync task exists: options were one sync task at the end, per-task sync; chosen because the agent rules require the copies in the same commit as the source.
-- D5 — Task 10 is a verification-only task (`File: none`) that names the checks and the six corrected scenarios, run by the `sdd-implementer` the per-task loop spawns for every task (`SKILL.md:84-99`), gate and the step-4 verifier skipped per `SKILL.md:107-109`; the supervisor/orchestrator halves it cannot exercise this run are reported as `AFFECTS-FUTURE-SPECS:` lines, since the implementer is barred from `deferrals` (`sdd-implementer.md:35`), and filed by the orchestrator, which holds `deferrals` (`sdd-implementation-orchestrator.md:31-33`) and already routes that flag through the Deferral bar (`SKILL.md:100-106,167-175`), not a `VERIFY:`/deferred-report line the per-task loop never routes: options were leaving the scenarios to the completion gate's decomposition grep, a named task; chosen because step 8's own verifier still greps the decomposition entry's superseded wording regardless (requirements Scope notes: "as written" means the outcome, not that wording) — task 10, not that grep, is the actual, corrected verification of Requirement 7.
+- D5 — Task 10 is a verification-only task (`File: none`) that names the checks and the six corrected scenarios, run by the `sdd-implementer` the per-task loop spawns for every task (`SKILL.md:84-99`), gate and the step-4 verifier skipped per `SKILL.md:107-109`; the supervisor/orchestrator halves it cannot exercise this run are reported as `AFFECTS-FUTURE-SPECS:` lines, since the implementer is barred from `deferrals` (`sdd-implementer.md:35`), and the orchestrator, which holds `deferrals` (`sdd-implementation-orchestrator.md:31-33`), routes that flag through the Deferral bar (`SKILL.md:100-106,167-175`) and, when its three-part test holds, files the record with tag `verification` set explicitly (the bar names no tag on its own and may instead record a HANDOFF gotcha), not a `VERIFY:`/deferred-report line the per-task loop never routes: options were leaving the scenarios to the completion gate's decomposition grep, a named task; chosen because step 8's own verifier still greps the decomposition entry's superseded wording regardless (requirements Scope notes: "as written" means the outcome, not that wording) — task 10, not that grep, is the actual, corrected verification of Requirement 7.
 - D6 — Task 1's failure report carries a retro flag beside the escalate flag: options were the escalate flag alone, both; chosen because the orchestrator running this spec loaded its skill before task 3 lands, and the retro flag it already routes leaves a visible record.
 - D7 — Tests for the two scripts live in `src/__tests__/` beside the hook test, not under `harness/`: options were a bash test runner under `harness/`, vitest beside the hook test; chosen because vitest already drives the hook script there and CI runs it on node 20.
 
@@ -115,8 +115,8 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
 - Carried ruling on Requirement 2 criterion 7 (`--add-dir` when the spec store repo is outside the code root) is written into tasks 1 and 2 as the body's conditional flag and the test's two cases; not re-flagged.
 - R2-1 (compare-mode pair placement) gets no task of its own; task 7's prompt fixes the placement (D3).
 - The `ESCALATE` branch task 3 adds is harness text; the orchestrator running this spec's implementation loaded the pre-spec skill, so in this run a failed preflight (a) is carried by the implementer's `ESCALATE:` and `RETRO: gotcha` lines (D6; `gotcha` is a category the implementer's brief list already authorises, `harness/skills/sdd-implementation-phase/references/briefs.md:43-45`, unlike `escalation`) and the retro-log entry the orchestrator writes for the latter. The branch is live from the next session restart.
-- The supervisor and orchestrator halves of scenarios (1)-(3) need the merged skills in a restarted session; task 10 reports them as `AFFECTS-FUTURE-SPECS:` lines and the orchestrator files the `verification` deferral (D5), while task 10 itself runs the launcher, map-script and fold halves in-process. Without the key, task 1 does not halt the spec automatically (see Dependency order above); regardless, scenarios (1) and (4) are failures, not deferrals, when task 10 itself runs without the key (design Testing Strategy, end-to-end).
-- Step 8's completion-gate verifier greps the decomposition entry for `SPEC` and takes only its **End-to-end verification** section (`.spec-workflow/spec-decomposition/decomposition.md:377-387`, `harness/skills/sdd-implementation-phase/SKILL.md:190-191`), which reads the superseded scenario (4) wording at `:383-384`; the entry's other superseded wording at `:344,346` sits in a different bullet the verifier never reads into its brief. Requirements Scope notes already rule that Requirement 7's "as written" means the outcome, not that wording, so this is accepted, not re-decided or fixed here (R1-2).
+- The supervisor and orchestrator halves of scenarios (1)-(3) need the merged skills in a restarted session; task 10 reports them as `AFFECTS-FUTURE-SPECS:` lines and the orchestrator, per the Deferral bar's three-part test, files the resulting record with tag `verification` set explicitly (D5), while task 10 itself runs the launcher, map-script and fold halves in-process. Without the key, task 1 does not halt the spec automatically (see Dependency order above); regardless, scenarios (1) and (4) are failures, not deferrals, when task 10 itself runs without the key (design Testing Strategy, end-to-end).
+- Step 8's completion-gate verifier greps the decomposition entry for `SPEC` and takes only its **End-to-end verification** section (`.spec-workflow/spec-decomposition/decomposition.md:377-387`, `harness/skills/sdd-implementation-phase/SKILL.md:190-191`), which reads the superseded scenario (4) wording at `.spec-workflow/spec-decomposition/decomposition.md:383-384`; the entry's other superseded wording at `.spec-workflow/spec-decomposition/decomposition.md:344,346` sits in a different bullet the verifier never reads into its brief. Requirements Scope notes already rule that Requirement 7's "as written" means the outcome, not that wording, so this is accepted, not re-decided or fixed here (R1-2).
 - Req 3 crit 5, Req 4 crit 1 and Req 4 crit 5 map to no task's `_Requirements:` line; they are negative constraints enforced by restrictions and regression coverage — 3.5 by tasks 7/8's Anthropic-row assertions and task 10 scenario (2); 4.1/4.5 by tasks 4/5/7/8's key-reading restrictions and the folds reading no environment — not an omission (R1-3).
 - Spec 9's `harness-run.json` override and control pane are not built; scenario (3) uses `--watch --once` (requirements Scope notes).
 - The implementation-phase skill's spawn rule is unchanged: no eligible role runs in that phase.
@@ -138,3 +138,8 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
   - **R2-2 — Accepted (SHOULD_FIX, Compounds R1-1).** `RETRO: escalation` is not in the implementer brief's authorised category list (`briefs.md:43-45`: gotcha, bug, tool-error, mcp-deficiency, harness-defect, misunderstanding, inefficiency, doc-gap, model-behaviour), so an implementer following its own brief might not write it. Task 1's report, its Prompt, and the matching Scope note now use `RETRO: gotcha`, a category the brief already authorises; the orchestrator's own `## Escalate` branch (task 3, a different reporter with the full `retro.sh` category set) still uses `escalation` and is untouched.
   - **R2-3 — Accepted (MINOR, Compounds R1-2).** The Scope note said the step-8 verifier reads superseded wording at `decomposition.md:344,346,383-384`; the verifier takes only the **End-to-end verification** section (`:377-387`, `SKILL.md:190-191`), which holds 383-384 but not 344/346 (a different bullet, `:341-350`). The note now cites only what the verifier actually reads.
   - **Lint pass.** 6 fixed; rejected: L-7 — the finding claimed a second bare `SKILL.md` on line 119, but only one occurrence exists there; the file's only other `SKILL.md:190-191` instance is in the v2 Revision History (line 139), historical text this pass does not edit; L-8 — same citation-identifier/bridge-missing class v1 and v2 lint rejected, rule 11 suppresses a token unchanged since its prior rejection, and no range was found genuinely wrong.
+- **v4** (2026-09-22) — Round-3 adversarial response (adversarial-analysis-tasks-r3.md, verdict iterate 1/1/1).
+  - **R3-1 — Accepted (MUST_FIX, fix-induced, Compounds R2-3).** The Scope note's bare `:383-384` and `:344,346` refs at line 119 bound to the nearest preceding path, `SKILL.md:190-191` (320 lines), and resolved out of bounds. Both are now explicit: `decomposition.md:383-384` and `decomposition.md:344,346`, verified against the real file (377-387 is the End-to-end verification section holding 383-384; 341-350 is the subprocess-spawn bullet holding 344 and 346).
+  - **R3-2 — Accepted (SHOULD_FIX, fix-induced, Compounds R2-1).** Task 10's description bullet, its Prompt, D5 and the matching Scope note all asserted the cited Deferral bar (`SKILL.md:167-175`) "already routes" the flag "into one record tagged `verification`." Read whole, the bar is a discretionary three-part gate whose record fields include a generic `tags`, not `verification` by name, and anything failing the bar goes to HANDOFF as a gotcha instead. All four now say the orchestrator routes the flag through the bar and, only when the bar's test holds, files the record with tag `verification` set explicitly — not a guarantee the bar produces on its own.
+  - **R3-3 — Accepted (MINOR, fix-induced, Novel).** Task 10's Success line read "one `AFFECTS-FUTURE-SPECS:` line per deferred half" against the Prompt body's "one line, one record, one command." Success now reads "one ... line naming that command," matching the Prompt's single-command, single-record design.
+  - **Lint pass.** 2 fixed; rejected: L-3 — same citation-identifier/bridge-missing class v1/v2/v3 lint rejected: each of the 69 flagged tokens is a new artifact/env var/field this spec creates (including the `verification` tag at line 96, the deferral tag task 10 sets), an identifier cited correctly elsewhere in the same task's prompt, or one of the two documented forward references (lines 9, 37); rule 11 suppresses a token unchanged since its prior rejection, and no range was found genuinely wrong.
````

## Lint commit 17db435

````diff
diff --git a/.spec-workflow/specs/provider-per-role/tasks.md b/.spec-workflow/specs/provider-per-role/tasks.md
index cd2f6c9..66fdc14 100644
--- a/.spec-workflow/specs/provider-per-role/tasks.md
+++ b/.spec-workflow/specs/provider-per-role/tasks.md
@@ -116,7 +116,7 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
 - R2-1 (compare-mode pair placement) gets no task of its own; task 7's prompt fixes the placement (D3).
 - The `ESCALATE` branch task 3 adds is harness text; the orchestrator running this spec's implementation loaded the pre-spec skill, so in this run a failed preflight (a) is carried by the implementer's `ESCALATE:` and `RETRO: gotcha` lines (D6; `gotcha` is a category the implementer's brief list already authorises, `harness/skills/sdd-implementation-phase/references/briefs.md:43-45`, unlike `escalation`) and the retro-log entry the orchestrator writes for the latter. The branch is live from the next session restart.
 - The supervisor and orchestrator halves of scenarios (1)-(3) need the merged skills in a restarted session; task 10 reports them as `AFFECTS-FUTURE-SPECS:` lines and the orchestrator, per the Deferral bar's three-part test, files the resulting record with tag `verification` set explicitly (D5), while task 10 itself runs the launcher, map-script and fold halves in-process. Without the key, task 1 does not halt the spec automatically (see Dependency order above); regardless, scenarios (1) and (4) are failures, not deferrals, when task 10 itself runs without the key (design Testing Strategy, end-to-end).
-- Step 8's completion-gate verifier greps the decomposition entry for `SPEC` and takes only its **End-to-end verification** section (`.spec-workflow/spec-decomposition/decomposition.md:377-387`, `harness/skills/sdd-implementation-phase/SKILL.md:190-191`), which reads the superseded scenario (4) wording at `decomposition.md:383-384`; the entry's other superseded wording at `decomposition.md:344,346` sits in a different bullet the verifier never reads into its brief. Requirements Scope notes already rule that Requirement 7's "as written" means the outcome, not that wording, so this is accepted, not re-decided or fixed here (R1-2).
+- Step 8's completion-gate verifier greps the decomposition entry for `SPEC` and takes only its **End-to-end verification** section (`.spec-workflow/spec-decomposition/decomposition.md:377-387`, `harness/skills/sdd-implementation-phase/SKILL.md:190-191`), which reads the superseded scenario (4) wording at `.spec-workflow/spec-decomposition/decomposition.md:383-384`; the entry's other superseded wording at `.spec-workflow/spec-decomposition/decomposition.md:344,346` sits in a different bullet the verifier never reads into its brief. Requirements Scope notes already rule that Requirement 7's "as written" means the outcome, not that wording, so this is accepted, not re-decided or fixed here (R1-2).
 - Req 3 crit 5, Req 4 crit 1 and Req 4 crit 5 map to no task's `_Requirements:` line; they are negative constraints enforced by restrictions and regression coverage — 3.5 by tasks 7/8's Anthropic-row assertions and task 10 scenario (2); 4.1/4.5 by tasks 4/5/7/8's key-reading restrictions and the folds reading no environment — not an omission (R1-3).
 - Spec 9's `harness-run.json` override and control pane are not built; scenario (3) uses `--watch --once` (requirements Scope notes).
 - The implementation-phase skill's spawn rule is unchanged: no eligible role runs in that phase.
@@ -142,3 +142,4 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
   - **R3-1 — Accepted (MUST_FIX, fix-induced, Compounds R2-3).** The Scope note's bare `:383-384` and `:344,346` refs at line 119 bound to the nearest preceding path, `SKILL.md:190-191` (320 lines), and resolved out of bounds. Both are now explicit: `decomposition.md:383-384` and `decomposition.md:344,346`, verified against the real file (377-387 is the End-to-end verification section holding 383-384; 341-350 is the subprocess-spawn bullet holding 344 and 346).
   - **R3-2 — Accepted (SHOULD_FIX, fix-induced, Compounds R2-1).** Task 10's description bullet, its Prompt, D5 and the matching Scope note all asserted the cited Deferral bar (`SKILL.md:167-175`) "already routes" the flag "into one record tagged `verification`." Read whole, the bar is a discretionary three-part gate whose record fields include a generic `tags`, not `verification` by name, and anything failing the bar goes to HANDOFF as a gotcha instead. All four now say the orchestrator routes the flag through the bar and, only when the bar's test holds, files the record with tag `verification` set explicitly — not a guarantee the bar produces on its own.
   - **R3-3 — Accepted (MINOR, fix-induced, Novel).** Task 10's Success line read "one `AFFECTS-FUTURE-SPECS:` line per deferred half" against the Prompt body's "one line, one record, one command." Success now reads "one ... line naming that command," matching the Prompt's single-command, single-record design.
+  - **Lint pass.** 2 fixed; rejected: L-3 — same citation-identifier/bridge-missing class v1/v2/v3 lint rejected: each of the 69 flagged tokens is a new artifact/env var/field this spec creates (including the `verification` tag at line 96, the deferral tag task 10 sets), an identifier cited correctly elsewhere in the same task's prompt, or one of the two documented forward references (lines 9, 37); rule 11 suppresses a token unchanged since its prior rejection, and no range was found genuinely wrong.
````
