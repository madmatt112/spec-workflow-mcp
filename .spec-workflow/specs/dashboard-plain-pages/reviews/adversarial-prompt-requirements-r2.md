# Adversarial Review — dashboard-plain-pages/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-requirements.md using this format:

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
- Label every MUST_FIX and SHOULD_FIX, in the analysis and the report arrays, with a `[drafting] ` or `[design] ` prefix. A drafting defect is one the reviser can fix with no change to a requirement, a design choice or the scope: a wrong citation, a stale count, wording, or a lint failure. Every other item is a design defect.
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-plain-pages requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 7fd26aa5

````diff
diff --git a/.spec-workflow/specs/dashboard-plain-pages/requirements.md b/.spec-workflow/specs/dashboard-plain-pages/requirements.md
index 2ae9b587..1923a91b 100644
--- a/.spec-workflow/specs/dashboard-plain-pages/requirements.md
+++ b/.spec-workflow/specs/dashboard-plain-pages/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-This spec rebuilds the three plain pages of the dashboard: Specs becomes the decomposition as an ordered list, Usage becomes the weekly window with a burn and a fit, and Deferrals becomes one queue table with a Resolve action. It is for the one operator who reads the dashboard to answer three questions: where each project is, how much of the week is left, and what is in the queue. It adds one controller writer (the usage log), one server route (resolve), and removes the panels, filters, the cost tab and the trend.
+This spec rebuilds the dashboard's three plain pages: Specs becomes the decomposition as an ordered list, Usage becomes the weekly window with a burn and a fit, and Deferrals becomes one queue table with a Resolve action. It adds one controller writer (the usage log, which threads the emitting run's id through the rate-limit callback), one server route (resolve), and removes the panels, filters, the cost tab and the trend.
 
 ## Alignment with Product Vision
 
-`.spec-workflow/steering/product.md` does not exist in this repository, so this section aligns with the decomposition's dashboard-board block instead. That block sets the rule "fewer things, larger, colour only for state, and three plain pages" and makes this spec the last of 30 to 34. Every field on the three pages is derived from files on disk by deterministic code; no model writes any text.
+`.spec-workflow/steering/product.md` is absent, so this section aligns with the decomposition's dashboard-board block instead: "fewer things, larger, colour only for state, and three plain pages", the last of 30 to 34. Every field on the three pages is derived from files on disk by deterministic code; no model writes any text.
 
 ## Requirements
 
@@ -32,7 +32,7 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 #### Acceptance Criteria
 
 1. WHEN a line's state is computed THEN the first matching rule SHALL win, in this order: live, closed, deferred, next, stopped, not started (D1).
-2. IF a run for any project of the store is live by the rule of `src/dashboard/shell/live-runs.ts:10-18` and its spec is the heading's spec THEN the word SHALL be "live" and the fact SHALL be the run's phase and, in the implementation phase, the spec's task progress as done/total (for example "implementation 3/7").
+2. IF a run for any project of the store is live by the rule of `src/dashboard/shell/live-runs.ts:10-18` and its spec is the heading's spec THEN the word SHALL be "live" and the fact SHALL be the run's phase and, in the implementation phase, the spec's task progress as done/total ("implementation 3/7").
 3. IF the spec is closed by `isSpecClosed` (`src/dashboard/shell/spec-rows.ts:78-82`) THEN the word SHALL be "closed" and the fact SHALL be the distinct PR numbers found as "PR #n" in the spec's HANDOFF phase-log notes, ascending (the rule of `src/dashboard/shell/spec-rows.ts:149-154`), or "no PR recorded" when there are none (D6).
 4. IF the heading line carries `(deferred)` (the tag `src/controller/phases/document.ts:1156-1158` writes) or the spec directory holds a `deferred.json` marker (`src/core/index-generator.ts:263-278`) THEN the word SHALL be "deferred" and the fact SHALL be a deferral record id chosen by D5, or "no record" when D5 finds none.
 5. IF the spec is the store's launchable spec as the setup view computes it before the launch guards (`src/dashboard/harness/run-setup.ts:199-207`) THEN the word SHALL be "next" with no fact.
@@ -47,7 +47,7 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 
 #### Acceptance Criteria
 
-1. WHEN a step's stream emits a `rate_limit_event` (`src/controller/step.ts:499-502`) THEN the controller SHALL append one JSON line to `usage-log.jsonl` in the controller home (`src/controller/state.ts:293-297`; by default `~/.local/state/sdd/usage-log.jsonl`) holding `v: 1`, `ts` (the controller clock, ISO), `sevenDay.utilization` (0..1, as received) and `run` (the id of the run whose step emitted the event) (D10).
+1. WHEN a step's stream emits a `rate_limit_event` (`src/controller/step.ts:499-502`) THEN the controller SHALL append one JSON line to `usage-log.jsonl` in the controller home (`src/controller/state.ts:293-297`; by default `~/.local/state/sdd/usage-log.jsonl`) holding `v: 1`, `ts` (the controller clock, ISO), `sevenDay.utilization` (0..1, as received) and `run` (the id of the run whose step emitted the event, or null when the step has no run, such as the supervisor stream, since `spec.runId` is optional at `src/controller/step.ts:461`) (D10). A null-`run` line counts toward burn (D7), not a run's fit (D8).
 2. WHEN the line is appended THEN the existing `rate-limit.json` write (`src/controller/controller.ts:790-803`) SHALL still happen with the same content; the log does not replace it.
 3. IF the append fails THEN the controller SHALL log the error once per failure and SHALL NOT fail, pause or retry the step.
 4. WHEN two events arrive at once THEN each SHALL land as one whole line; no line is interleaved with another.
@@ -67,7 +67,7 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 5. IF the log holds no line at or before 24 h ago THEN the burn SHALL read "not known yet".
 6. WHEN two log lines 24 h apart are the only lines and the clock (a test seam) reads the second line's time THEN the burn SHALL equal the second utilisation minus the first, in percentage points.
 7. WHEN the page renders THEN it SHALL NOT show the five-hour window.
-8. WHEN a `controller-runs` push arrives THEN the page SHALL refetch its figures, as the current page does (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102`).
+8. WHEN a `controller-runs` push arrives THEN the page SHALL refetch its figures — the window, the burn and the per-run fits — from the usage route, on the same cue the current page refetches the window (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102`).
 
 ### Requirement 5 — Usage page: live runs and the fit
 
@@ -75,7 +75,7 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 
 #### Acceptance Criteria
 
-1. WHEN the page renders THEN it SHALL show one line per live run of every registered project (D11), each with the project name, the spec, the phase and the run's tokens so far (`tokens` of the run row, `src/dashboard_frontend/src/modules/shell/types.ts:174`).
+1. WHEN the page renders THEN it SHALL show one line per live run of every registered project, enabled or not — the `controller-runs` push is account-wide, unfiltered by enable state (D11), each with the project name, the spec, the phase and the run's tokens so far (`tokens` of the run row, `src/dashboard_frontend/src/modules/shell/types.ts:174`).
 2. IF the run is in the implementation phase and has finished at least one task THEN its line SHALL show the remaining tasks (total minus done from the spec's `tasks.md`) and either "fits before the reset" or "does not fit before the reset", by the formula of D8.
 3. IF the run is in a document phase, or has finished no task, or the log holds no line for the run THEN the fit SHALL read "not known yet".
 4. WHEN a live implementation run has three tasks done and log lines attributed to it THEN its line SHALL show a fit; WHEN a live document-phase run is listed THEN its line SHALL read "not known yet".
@@ -102,7 +102,7 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 
 1. WHEN the page renders THEN every row SHALL carry a Resolve button.
 2. WHEN Resolve is pressed THEN a resolution box SHALL open in the row with a text field, a Resolve confirm and a Cancel; Cancel closes it and writes nothing.
-3. WHEN the confirm is pressed with non-empty text THEN the frontend SHALL POST `{ resolution }` to `/api/projects/:projectId/deferrals/:deferralId/resolve`.
+3. WHEN the confirm is pressed with non-empty text THEN the frontend SHALL POST `{ resolution }` to `/api/projects/:projectId/deferrals/:deferralId/resolve`, with the store's representative project as `:projectId` (any member of a shared store resolves to the same record file).
 4. WHEN the route receives a valid request THEN it SHALL resolve the record through the deferrals tool's resolve path (`src/tools/deferrals.ts:258-270`, which calls `src/core/deferral-storage.ts:307-319`), so the record file holds `status: resolved`, the trimmed text as `resolution`, and `resolvedAt`; it SHALL reply 200.
 5. IF the trimmed resolution is empty or longer than 2,000 characters THEN the route SHALL reply 400 and write nothing.
 6. IF the project or the record does not exist THEN the route SHALL reply 404; IF the record is not `deferred` THEN it SHALL reply 409; IF the record's frontmatter cannot be parsed THEN it SHALL reply 409 with the reindex message. No case writes the file.
@@ -127,15 +127,14 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 ## Non-Functional Requirements
 
 ### Performance
-- The server's read of `usage-log.jsonl` for one Usage page request covers at most the lines of the last 8 days; the design picks rotation or a tail read (decomposition "the log's growth and rotation").
+- The server's read of `usage-log.jsonl` for a Usage page request covers at most the last 8 days of lines; the design picks rotation or a tail read (decomposition "the log's growth and rotation").
 - The Specs builder reads each store's `decomposition.md` once per feed flush, through the existing file cache (`src/dashboard/shell/shell-feed.ts:31`).
 
 ### Security
 - The resolve route sits behind the same auth and CORS hooks as every other mutating `/api` route and accepts only the `resolution` string; no request text reaches a shell. The dev proxy already rewrites `Origin` for a mutating fetch (`src/dashboard_frontend/vite.config.ts:27-46`).
 
 ### Reliability
-- A missing, empty or torn `decomposition.md`, `usage-log.jsonl` line or deferral file yields an empty or "not known yet" field and never a thrown error or a 500.
-- A log line that does not parse is skipped; the lines around it still count.
+- A missing, empty or torn `decomposition.md`, `usage-log.jsonl` line or deferral file yields an empty or "not known yet" field and never a thrown error or a 500; a log line that does not parse is skipped and the lines around it still count.
 
 ## Decisions taken in this document
 
@@ -143,10 +142,10 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 - D2 — One block (Specs) and one read (Deferrals) per spec store, not per registered project: options were one block per enabled project, or one per store; chosen because two registered projects share one tradr store and per-project blocks would list the same decomposition and records twice.
 - D3 — List headings in file order and show each heading's number as written: options were file order, or sort by number; chosen because the decomposition file is the build order and its numbers are not in sequence.
 - D4 — Leave out spec directories that no heading names: options were list them after the headings under "other", or leave them out; chosen because the page shows the decomposition and nothing else.
-- D5 — The deferred line's record id is the newest open record whose origin spec is the spec, else the first deferral id written in the heading's entry text, else "no record": options were only the origin-spec record, only the entry text, or this fallback chain; chosen because a gate-A deferral writes no record and older deferrals name their record only in the entry text.
+- D5 — The deferred line's record id is the newest open record whose origin spec is the spec, else the first deferral id written in the heading's entry text, else "no record": options were a single source or this fallback chain; chosen because a gate-A deferral writes no record and older deferrals name their record only in the entry text.
 - D6 — A closed line's fact is every PR number in the spec's HANDOFF phase-log notes, else "no PR recorded": options were the run record's PR, the close-out PRs, or the phase-log notes; chosen because run records can be removed and the phase log is the durable record the current page already reads.
-- D7 — Burn is the sum of the positive steps between consecutive log lines from the newest line at or before 24 h ago up to the newest line, in percentage points, and "not known yet" when the log does not reach back 24 h: options were the plain difference of two lines, the same over a shorter span with its length shown, or the sum of positive steps; chosen because a weekly reset inside the 24 h makes a plain difference negative, and the sum equals the plain difference when no reset falls inside.
-- D8 — A run's fit uses its own attributed utilisation: the sum of positive steps between consecutive log lines where the later line carries the run's id, divided by the tasks the run has finished, times the remaining tasks, compared with the headroom (1 minus the latest utilisation); "fits" when the product is at most the headroom: options were the window delta since the run started (it counts other runs' spend), or per-run attribution; chosen because two runs often share the window and the delta since start would charge one run for both.
+- D7 — Burn is the sum of the positive steps between consecutive log lines from the newest line at or before 24 h ago up to the newest line, in percentage points, and "not known yet" when the log does not reach back 24 h: options were the plain difference of two lines, a shorter-span difference, or the sum of positive steps; chosen because a weekly reset inside the 24 h makes a plain difference negative, and the sum equals the plain difference when no reset falls inside.
+- D8 — A run's fit uses its own attributed utilisation: the sum of positive steps between consecutive log lines where the later line carries the run's id, divided by the tasks the run has finished, times the remaining tasks, compared with the headroom (1 minus the latest utilisation); "fits" when the product is at most the headroom: options were the window delta since the run started, or per-run attribution; chosen because two runs often share the window and the delta since start would charge one run for both.
 - D9 — A passed reset shows "window reset — no reading since": options were show the stale reading, show 100 per cent left, or say the window reset; chosen because the controller itself reads a passed reset as reset and no reading confirms the new value yet.
 - D10 — The log lives in the controller home with a version field: options were a fixed home path or the controller home; chosen because the controller home is where the rate-limit file lives and the home variable keeps tests off the real file.
 - D11 — The Usage page lists live runs of every registered project, enabled or not: options were enabled projects only, or every project; chosen because the weekly window is account-wide and a run in a hidden project still spends it.
@@ -155,12 +154,18 @@ This spec rebuilds the three plain pages of the dashboard: Specs becomes the dec
 ## Scope notes
 
 - Carried items from the decomposition: none.
-- Cut or changed against the decomposition entry: D1 adds the word "stopped" to the five the entry lists; D2 groups by spec store where the entry says "one block per enabled project".
-- Left to the design, as the entry asks: the state word or fact for a live run that is paused or held; whether a Specs line links anywhere; the log's growth and rotation; the source of "tasks the run has finished" for D8 (the run's ledger or its step records).
+- Cut or changed against the decomposition entry: D1 adds the word "stopped" to the five the entry lists; D2 groups by spec store where the entry says "one block per enabled project"; D7 redefines burn from the entry's utilisation delta over 24 h to the sum of positive steps, differing when a reset falls inside the 24 h.
+- Left to the design, as the entry asks: the state word or fact for a live run that is paused or held; whether a Specs line links anywhere; the log's growth and rotation; the source of "tasks the run has finished" for D8 (the run's ledger or its step records); how the emitting run's id reaches the usage-log line (change the windows-only `onRateLimit` signature at `src/controller/runs.ts:405-406`, or write the line from `src/controller/step.ts:499-502`, where `spec.runId` is in scope); the transport and shape carrying the burn and per-run fits to the Usage page (extend `/api/controller/rate-limit` at `src/dashboard/multi-server.ts:887-889`, or add a route).
 - Out of scope: the Home board, the ruling view and the top bar (specs 32 and 33); the TUI and the HUD; any change to the deferrals tool's behaviour or to `spec-index`.
-- Steering: `product.md` is absent, so the alignment section cites the decomposition block instead.
 
 ## Revision History
 
+- **v2** (2026-11-14) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Introduction now says the usage log threads the emitting run's id through the rate-limit callback; Req 3 AC1 gives run as the run id or null for a no-run step such as the supervisor, a null-run line counting toward burn but no run's fit; Left-to-the-design names the run-id path.
+  - **R1-2 — Accepted (SHOULD_FIX).** Req 4 AC8 now refetches the window, burn and per-run fits from the usage route on the controller-runs cue; Left-to-the-design names their transport and response shape.
+  - **R1-3 — Accepted (SHOULD_FIX).** The decomposition-delta note now records D7 redefining burn from the entry's utilisation delta over 24 h to the sum of positive steps.
+  - **R1-4 — Accepted (MINOR).** Req 7 AC3 now names the store's representative project as the POST path's project id.
+  - **R1-5 — Accepted (MINOR).** Req 5 AC1 now states the controller-runs push is account-wide, unfiltered by enable state.
+  - **Lint pass.** 0 fixed; L-1..L-7 rejected, citation-identifier false positives (log-line schema, resolve field, deletion targets); the citation anchors a different phrase; L-3..L-6 unchanged, rule 11.
 - **v1** (2026-11-13) — Initial draft.
-  - **Lint pass.** 0 fixed; rejected (all citation-identifier false positives — each flagged token names an artifact this spec defines or a deletion target the context file maps, while the adjacent citation correctly anchors a different phrase): L-1/L-2/L-3 the new log-line names `usage-log.jsonl`, `sevenDay.utilization` and `run` (D10), absent from the cited event-trigger (`src/controller/step.ts:499-502`) and controller-home (`src/controller/state.ts:293-297`) ranges by design; L-4 `UsageSpecRow`, a type deleted from `src/dashboard/shell/types.ts:40-51` and its frontend copy, not the cited closed-specs route `src/dashboard/multi-server.ts:625-643`; L-5/L-6 `SpecPanel` and `FileRow`, deleted components at `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:239-385` and `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:387-436`, not the cited spec-detail route `src/dashboard/multi-server.ts:611-618`; L-7 `resolution`, the resolve route's request field (Requirement 7), not the cited Origin-rewrite range `src/dashboard_frontend/vite.config.ts:27-46`.
+  - **Lint pass.** 0 fixed; L-1..L-7 rejected as citation-identifier false positives — each flagged token names an artifact this spec defines (`usage-log.jsonl`, `sevenDay.utilization`, `run`, the `resolution` field) or a deletion target the context file maps (`UsageSpecRow`, `SpecPanel`, `FileRow`); the adjacent citation anchors a different phrase.

````
