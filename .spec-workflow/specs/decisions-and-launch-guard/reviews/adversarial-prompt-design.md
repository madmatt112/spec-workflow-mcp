# Adversarial Review — decisions-and-launch-guard/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): decisions-and-launch-guard design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `decisions-and-launch-guard` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/decisions-and-launch-guard`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since c85adc5b

````diff
diff --git a/.spec-workflow/specs/decisions-and-launch-guard/design.md b/.spec-workflow/specs/decisions-and-launch-guard/design.md
index 091b4b72..3cb10c07 100644
--- a/.spec-workflow/specs/decisions-and-launch-guard/design.md
+++ b/.spec-workflow/specs/decisions-and-launch-guard/design.md
@@ -32,8 +32,8 @@ Display names live in one durable field and reach every page through the project
   - `POST /api/projects/:projectId/display-name`, body `{ displayName: string | null }`; answers in Data Models.
 - **Post-conditions:**
   - `rememberProject` keeps an existing row's `displayName` (`src/controller/state.ts:619-628`), for both callers (`src/dashboard/project-manager.ts:233`, `:355`).
-  - `syncOnce` maps id to `displayName` from `remembered` (`:115`) and applies it where it sets `existing.projectName` (`:145`) and creates a context (`:152`, `:216`).
-  - `addProject` still remembers the generated name as `name` (`:233-236`), because `src/advisor/summary.ts:111-112` matches `name` against operator config.
+  - `syncOnce` maps id to `displayName` from `remembered` (`src/dashboard/project-manager.ts:115`) and applies it where it sets `existing.projectName` (`:145`) and creates a context (`:152`, `:216`).
+  - `addProject` still remembers the generated name as `name` (`src/dashboard/project-manager.ts:233-236`), because `src/advisor/summary.ts:111-112` matches `name` against operator config.
   - `src/core/project-registry.ts` does not change: `generateProjectDisplayName` and `projectName` stay the fallback, so re-registration (`src/core/project-registry.ts:376`) cannot touch a display name. The registry cannot hold it, because an entry dies with its last instance (`src/core/project-registry.ts:427-434`).
   - `src/advisor/push.ts:92` returns `shownName(p)`.
   - `ActionTile` takes `projectName: (id: string) => string`, and `actionTarget` prints that for `t.project` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280`).
@@ -69,15 +69,15 @@ Display names live in one durable field and reach every page through the project
 - **Purpose:** Act on `## Decisions` answers and read `Target document:`.
 - **Interfaces, in `src/tools/harness.ts`:**
   - `parsePlanDecisions(content: string): Map<string, string>`: reads `- <id>: <question> → <answer>` lines inside `## Decisions`, split at the last ` → `. Empty or `no answer` gives no entry. A probe of every `retrospective-plan.md` in the swm and tradr-hosted stores found no line with two arrows.
-  - `itemTarget(block: string): string`: the value of `Target:` or `Target document:`. `classifyTarget` (`src/tools/harness.ts:542`) and Step 1 (`src/controller/phases/closeout.ts:368`) call it.
+  - `itemTarget(block: string): string`: the value of `Target:` or `Target document:`. `classifyTarget` (`src/tools/harness.ts:541-542`) and Step 1 (`src/controller/phases/closeout.ts:368`) call it.
   - `answerChoosesNoChange(answer: string): boolean`: removes a leading `Option <x>:`, then matches case-insensitively. Illustrative, verify against the test table: `^(no[ -]change|no[ -]action|do nothing|leave (it|as is|alone|unchanged|deferred)|keep as is)\b`, or the whole answer being `no`, `none`, `skip` or `n/a`.
 - **The match is narrow on purpose (AC 5):** `keep the design-defect stop but trigger it on the first verdict` and `drop the two moved paths` are real answers that change code.
 - **Flow in `runCloseoutPhase`:**
   - `openItems` (`src/controller/phases/closeout.ts:262-266`) adds `answer`.
   - New step before Step 1: an open item of any class whose answer chooses no change gets `skipped — <answer>`.
-  - Step 1 (`:362-375`): a class `none` item with an answer gets `to-do (human) — recorded decision: <answer>; its target gives no landing class, so no batch can build it`, and joins `todos` (AC 4). With no answer, Step 1 stays as at base (AC 8).
-  - `withAnswer(it)` returns `Recorded decision: <answer>`, a newline and the block. `itemsText` (`:404`), the verifier text (`:490`) and `findingsText` (`:526`) use it (AC 3). `itemPaths` keeps the raw block.
-  - The final line (`:633`): an answered item that did not land writes `to-do (human) — <reason>` and joins `todos`. The reverts (`:585-625`) do not change (AC 6).
+  - Step 1 (`src/controller/phases/closeout.ts:362-375`): a class `none` item with an answer gets `to-do (human) — recorded decision: <answer>; its target gives no landing class, so no batch can build it`, and joins `todos` (AC 4). With no answer, Step 1 stays as at base (AC 8).
+  - `withAnswer(it)` returns `Recorded decision: <answer>`, a newline and the block. `itemsText` (`src/controller/phases/closeout.ts:404`), the verifier text (`:490`) and `findingsText` (`:526`) use it (AC 3). `itemPaths` keeps the raw block.
+  - The final line (`src/controller/phases/closeout.ts:633`): an answered item that did not land writes `to-do (human) — <reason>` and joins `todos`. The reverts (`:585-625`) do not change (AC 6).
 - **Reference plan:** P6 goes to the harness batch with its answer. P11 (`project deferral queue`) has no class and becomes a to-do. G1 and G2 read `Target document:`, class `store` and go to a batch.
 
 ### C4 — File-list patch (Requirement 4)
@@ -88,7 +88,7 @@ Display names live in one durable field and reach every page through the project
   - `routeImplementerFlags(task, report, text, gateReasons?: string[])`: optional trailing parameter. `src/controller/phases/implementation.ts:912` passes `gate.reasons` only when `variant === 'gate'`; the first-pass call (`:754`) passes nothing.
   - `RunLedger.filePatch(fields: { task: string; round: string | number; file: string; reason: string })` (`src/controller/ledger.ts:53-73`). `src/watch/ledger.ts:420-428` gets a render arm, because an unknown type renders empty there.
 - **Flow,** at the `REQUIRED` branch (`src/controller/phases/implementation.ts:929-936`), after the `DESIGN-DEFECT` check: with `gateReasons` set and `fileListPatch` defined, write `tasks.md`, re-parse to confirm every file is listed, call `commitSpecStore` with `docs(sdd): <spec> task <id> file-list patch`, write the row, append to `task.files`, and return `undefined`. The loop reaches its top and `:805-807` gates the same commit with the new list.
-- **Rounds and risk:** the round was counted at `:880` and the cap at `:881` still applies (AC 6). A high-risk pass reaches the verifier at `:860` (AC 5). A round with no flag keeps P8 (`:834-835`) (AC 7).
+- **Rounds and risk:** the round was counted at `src/controller/phases/implementation.ts:880` and the cap at `:881` still applies (AC 6). A high-risk pass reaches the verifier at `:860` (AC 5). A round with no flag keeps P8 (`:834-835`) (AC 7).
 - **Failure (NFR Reliability):** restore the prior text, write a `note`, take the base `design-defect` stop.
 - **Text (AC 9):** `src/tools/brief-templates.ts:803-804` and `harness/agents/sdd-implementer.md:31` say a `REQUIRED` report adds the file and the gate reruns with no wait, and keep the self-exemption ban. The prefix stays, so `harness/evals/implementer-file-outside-list-classify/case.json:29` holds. `src/core/gate-rules.ts:520-530` does not change.
 
@@ -99,8 +99,8 @@ Display names live in one durable field and reach every page through the project
   - `isDraftingDefect(item: string): boolean` in `src/controller/phases/document.ts`: `/^\s*\[drafting\]/i`; anything else is design (AC 4).
   - `reviserStep` gains variant `'drafting-only'` (`src/controller/phases/document.ts:452-454`); `renderReviser` gains the descriptor `Drafting-only corrective pass.` (`src/tools/brief-templates.ts:457-462`).
 - **Flow:** after `openMustFix` (`src/controller/phases/document.ts:883`) and before the converged check (`:885-888`), with `items = [...openMustFix, ...shouldFix]`: when `ledgerRoundCount() === 1 && items.length > 0 && items.every(isDraftingDefect)`, run `reviserStep('drafting-only', ...)`, `lintStep` and `narrowCheck(D, analysisPath, items)`, set `narrowCheckRan`, write the note `review cap: round 1 drafting-only, <n> item(s), v<D> approved` (AC 7), and return `approve(D, 'drafting-only → converged')`.
-- **Why the ledger count:** `reviewRounds` restarts at 0 on re-entry (`:345`); `ledgerRoundCount` (`:522-523`) does not, and this round's row is already written (`:855`).
-- **Order:** the escalate return (`:861-864`) comes first (AC 5). One `[design]` item fails the test and the base loop runs (AC 3). All three phases share this loop (AC 6).
+- **Why the ledger count:** `reviewRounds` restarts at 0 on re-entry (`src/controller/phases/document.ts:345`); `ledgerRoundCount` (`:522-523`) does not, and this round's row is already written (`:855`).
+- **Order:** the escalate return (`src/controller/phases/document.ts:861-864`) comes first (AC 5). One `[design]` item fails the test and the base loop runs (AC 3). All three phases share this loop (AC 6).
 
 ### C6 — Rules and deferrals (Requirement 6)
 - **Rules:** two bullets at the end of `## Checks` in `.spec-workflow/agent-rules.md`, with the words of lines 143-148 and 155-159 of the tradr-hosted plan, `> ` markers removed. No bullet starts with a machine-read key (`src/dashboard/harness/run-setup.ts:72-141`). The implementer writes through scratch and `cp` (`.spec-workflow/agent-rules.md:51-55`).
@@ -115,9 +115,9 @@ Display names live in one durable field and reach every page through the project
 - **Wait guard (AC 2, 5):** `createWait` (`src/controller/waits.ts:87-104`) throws `RunAbandonedError` for an `abandoned` run. That covers `waitAnd`, both gates (`src/controller/phases/gates.ts:169`, `:256`) and the merge wait (`src/controller/merge.ts:732`). `Controller.drive` (`src/controller/controller.ts:592-604`) ends quietly on that class.
 - **Driver checks:**
   - New `runCancelled(deps, runId)`: `deps.isCancelled(runId) || readRunSync(runId)?.status === 'abandoned'`. The disk read gives AC 4. `stopReason` (`src/controller/runs.ts:419`), the loop top (`:868`) and the merge round (`:754`) call it.
-  - `runOnce` returns after its first read for an `abandoned` run, before `ensureWorktree` and the `running` write (`:846-851`).
-  - The four `handle*Outcome` functions return `'stop'` first when `runCancelled`: no retry, no wait (AC 2). `handleDocumentOutcome` checks again after its retry (`:1347`), and `runMergeStageStep` on entry (`:1024`).
-  - Both document `shouldStop` lambdas (`:989`, `:1345`) return `'cancelled'` before `'operator'`. They still skip the usage window. The comment at `src/controller/phases/document.ts:201-206` is corrected.
+  - `runOnce` returns after its first read for an `abandoned` run, before `ensureWorktree` and the `running` write (`src/controller/runs.ts:846-851`).
+  - The four `handle*Outcome` functions return `'stop'` first when `runCancelled`: no retry, no wait (AC 2). `handleDocumentOutcome` checks again after its retry (`src/controller/runs.ts:1347`), and `runMergeStageStep` on entry (`:1024`).
+  - Both document `shouldStop` lambdas (`src/controller/runs.ts:989`, `:1345`) return `'cancelled'` before `'operator'`. They still skip the usage window. The comment at `src/controller/phases/document.ts:201-206` is corrected.
 - **Crash wait (AC 7):** `src/controller/controller.ts:611-638` already skips a cancelled run; its status filter covers a restart.
 
 ### C8 — Phase and age (Requirement 8)
@@ -232,3 +232,4 @@ No test asserts a node-version-specific `child_process`, `fs` or stream field.
 ## Revision History
 
 - **v1** (2026-11-07) — Initial draft.
+  - **Lint pass.** 25 fixed (citation-bare L-2–L-6, L-22–L-27, L-34–L-37, L-41–L-44, L-53–L-57 given a directory-prefixed path on the first bare range of each bullet, which anchors its same-file siblings; L-20 harness.ts range widened to `:541-542` so `classifyTarget`'s declaration is in range). Rejected (citation-identifier, all false positives — each citation anchors the code location the design edits or references, and the named symbol is one this design adds or one defined elsewhere named for explanation, not a token expected at the cited line): L-1, L-7, L-8, L-9, L-10, L-11, L-12, L-13, L-14, L-15, L-16, L-17, L-18, L-19, L-21, L-28, L-29, L-30, L-31, L-32, L-33, L-38, L-39, L-40, L-45, L-46, L-47, L-48, L-49, L-50, L-51, L-52, L-58, L-59, L-60, L-61, L-62, L-63, L-64, L-65, L-66, L-67, L-68, L-69, L-70, L-71.

````
