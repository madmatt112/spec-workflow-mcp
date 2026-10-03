# Adversarial Review — lean-orchestrators/design (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md using this format:

```markdown
# Adversarial Review Memory — design
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v3 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v3 lint commit changed: the `## Lint commit` section below (the v3 lint pass fixed 0 and only added a Revision History bullet). Still open (error = MUST_FIX candidate, warning = your call, info = a note): 45 citation-identifier warnings (design.md lines 40–190), all the design-introduced-identifier / data-value-against-behaviour-code / cross-file-token false-positive class rejected with a stated reason in the v1, v2 and v3 lint passes, each cited range re-verified; your call.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): lean-orchestrators design v2` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v3 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v3 delta wrote `Compounds: R2-<n>`, naming the round-2 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-3 MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- The v3 delta changed two things: (1) the brief-templates component's account of the existing `briefAction` test suite and its refactor (R2-1), and (2) a `no-usage` discriminant added to the spawn-sources failure union plus the Error Handling item-1 condition-to-reason mapping (R2-2). Both were marked Accepted. Attack both: verify the new `no-usage` reason is produced by, and consumed at, both seam ends; verify the brief-templates test-accounting claims against the real `briefAction` tests in `src/tools/__tests__/harness.test.ts`.
- Fix-induced re-check: when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: a cold read for internal contradictions and a truth table of the stated cases — walk every enumerated condition set (the spawn-sources failure union against the Error Handling table, the orient routing cases, every error branch's discriminant and status code) and confirm no two statements in the document contradict and every case is covered.
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a.

## Changes since 209e169

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/design.md b/.spec-workflow/specs/lean-orchestrators/design.md
index 53d7d0f..e5f2c2e 100644
--- a/.spec-workflow/specs/lean-orchestrators/design.md
+++ b/.spec-workflow/specs/lean-orchestrators/design.md
@@ -2,7 +2,7 @@
 
 ## Overview
 
-This design adds W and a per-source transcript breakdown to `harness usage`, then cuts orchestrator context with step-scoped skills, server-side briefs, short worker report blocks, one batched bookkeeping script and a 5-task implementation budget. The server changes sit in `src/watch/` (pure folds) and `src/tools/harness.ts` (actions); the harness changes sit in `harness/skills/`, `harness/agents/` and the supervisor skill. It reuses the usage fold, the `orient` and `brief` actions, the task parser, and the run's `event.sh` and `retro.sh`.
+This design adds W and a per-source transcript breakdown to `harness usage`, then cuts orchestrator context with step-scoped skills, server-side briefs, short worker report blocks, one batched bookkeeping script and a 5-task implementation budget. Server changes sit in `src/watch/` (pure folds) and `src/tools/harness.ts` (actions); harness changes sit in `harness/skills/`, `harness/agents/` and the supervisor skill. It reuses the usage fold, the `orient` and `brief` actions, the task parser, and the run's `event.sh` and `retro.sh`.
 
 ## Steering Document Alignment
 
@@ -17,7 +17,7 @@ N/A.
 
 ## Architecture
 
-The orchestrator holds a core skill and reads a routed reference file only when a step needs it. Briefs, prompt blocks and the bookkeeping script come from `harness` `brief`, so their fixed text never enters orchestrator context. Workers end with a key block; between two spawns the orchestrator makes one `book.sh` call, which writes rows only through `EVENT_SCRIPT`.
+The orchestrator holds a core skill and reads a routed reference only when a step needs it. Briefs, prompt blocks and the bookkeeping script come from `harness` `brief`, keeping their text out of orchestrator context. Workers end with a key block; between two spawns the orchestrator makes one `book.sh` call, which writes rows only through `EVENT_SCRIPT`.
 
 ```mermaid
 graph LR
@@ -41,7 +41,7 @@ graph LR
   - `listSpawns(events: LedgerEvent[]): SpawnSummary[]`: each reduced spawn, same pairing (`src/watch/usage.ts:137-155`) and phase rule (`src/watch/usage.ts:290-296`), with the latest `spawn.end` row's `agentId` and W from the row that sets tokens (`src/watch/usage.ts:259-275`), as in C1.
   - `unitCount(events: LedgerEvent[], phase: string): number`: `round` rows whose `phase` key matches, for a document phase; for `implementation`, `task.done` rows inside an implementation window (`src/watch/usage.ts:116-124`).
   - `UsagePhase` gains `orchW` (the two orchestrator cells' W), `units` and `orchWPerUnit: number | null` (null at 0 units).
-  - `formatUsageTable(report, compare?, opts?: { perUnit?: boolean })`, trailing parameter optional: a `W` column after `tokens` in every row, ` (+N unknown)` as in `src/watch/usage.ts:365-367`; with `perUnit`, phase totals add `orch W/round` or `orch W/task`, and the compare table prints both and the delta.
+  - `formatUsageTable(report, compare?, opts?: { perUnit?: boolean })`: a `W` column after `tokens` in every row, ` (+N unknown)` as in `src/watch/usage.ts:365-367`; with `perUnit`, phase totals add `orch W/round` or `orch W/task`, and the compare table prints both and the delta.
   - `UsageDelta` gains `w` and `orchWPerUnit`.
 - **Reuses:** `buildUsageReport` (`src/watch/usage.ts:126-231`), `usageDelta` (`src/watch/usage.ts:302-314`), the formatters (`src/watch/usage.ts:403-457`).
 
@@ -79,7 +79,7 @@ graph LR
 - **Purpose:** Requirement 1 criteria 2, 7 and 9.
 - **Interfaces:** the schema gains `sources: { type: 'boolean' }`. The description (`src/tools/harness.ts:30-43`) gains this text: "Pass `sources: true` to also read each document and implementation orchestrator spawn's subagent transcript under `$CLAUDE_CONFIG_DIR/projects`, else `~/.claude/projects`, and print its W by context source. Without it the action reads only the spec store." The existing "never spawns a process" sentence stays.
 - **Flow:** `usageAction` (`src/tools/harness.ts:1215-1244`), then with `sources`: `listSpawns`, keep the two orchestrator agents, and run `resolveSession`, `findTranscript`, `readFile`, `breakdownTranscript` per spawn, for both specs, with `perUnit` set; `data` adds `sources` and `compareSources`.
-- **Block** (illustrative; the numbers come from `/tmp/scratchpad/sdd/lean-orchestrators/design-probe-base.js` run on the baseline implementation spawn):
+- **Block** (illustrative; numbers from `/tmp/scratchpad/sdd/lean-orchestrators/design-probe-base.js` on the baseline implementation spawn):
 
 ```
 sources tdd-task-loop  spawns 5  unknown 0  (shares are estimates; W totals are floors)
@@ -96,8 +96,8 @@ implementation | sdd-implementation-orchestrator | a46fec387251fb6c6 | calls 127
 
 ### C6 — Server brief templates (`src/tools/brief-templates.ts`)
 - **Purpose:** Requirement 3 criteria 3 and 4.
-- **Interfaces:** `BRIEF_TEMPLATES` (`src/tools/harness.ts:493-557`) moves here as `Record<string, BriefTemplate>`. `briefAction` (`src/tools/harness.ts:595-765`) keeps its behaviours (unknown kind, all missing values at once, agent-rules line, `taskBlock`, graph append at `src/tools/harness.ts:572-588`, `safeJoin` write) and adds append mode, which fails on a missing target.
-- Each kind's text is the matching `references/briefs.md` section, word for word, with slots as values and phase and D conditionals rendered on the server.
+- **Interfaces:** `BRIEF_TEMPLATES` (`src/tools/harness.ts:493-557`) moves here as `Record<string, BriefTemplate>`. `briefAction` (`src/tools/harness.ts:595-765`) keeps its unknown-kind, all-missing-at-once, agent-rules-line, `taskBlock`, graph-append (`src/tools/harness.ts:572-588`) and `safeJoin`-write behaviours, but the missing-value set now comes from each template's `required[]` rather than the `{{key}}` scan (`src/tools/harness.ts:717-719`), and `redTests` moves from a caller value to the `authorFiles`/`authorReport` build. It adds append mode, which fails on a missing target.
+- Each kind's text is the matching `references/briefs.md` section verbatim, slots as values, phase and D conditionals rendered on the server.
 
 | Kind | Mode, target | Values beyond `path`, `title` |
 | --- | --- | --- |
@@ -116,11 +116,11 @@ implementation | sdd-implementation-orchestrator | a46fec387251fb6c6 | calls 127
 
 Illustrative, verify against the test fake: `type BriefTemplate = { mode: 'write' | 'append'; required: string[]; optional?: string[]; render(v: Record<string, string>): string }`.
 
-Both skills' `references/briefs.md` files are deleted; the drift-guard test reading one (`src/tools/__tests__/harness.test.ts:491-495`) becomes one snapshot test per kind.
+Both skills' `references/briefs.md` files are deleted; the drift-guard test (`src/tools/__tests__/harness.test.ts:491-504`) that checked the `briefs.md` `## Code graph block` against `codeGraphSection` is deleted with them.
 
 ### C7 — Bookkeeping script `book.sh`
 - **Purpose:** Requirement 6 and Requirement 3 criterion 5.
-- **Interfaces:** `/tmp/scratchpad/sdd/<SPEC>/book.sh`. Step 0 writes it with `harness` `brief`, `template: book-script`, when the file is missing. Invocation: `bash book.sh <segment> [-- <segment>]...`. The segments run in order. The script reads the run id and ledger path from `EVENT_SCRIPT`'s `SDD_RUN` and `SDD_LEDGER` lines (`harness/skills/sdd-continue/references/formats.md:164-183`).
+- **Interfaces:** `/tmp/scratchpad/sdd/<SPEC>/book.sh`. Step 0 writes it with `harness` `brief`, `template: book-script`, when the file is missing. Invocation: `bash book.sh <segment> [-- <segment>]...`, segments in order. The script reads the run id and ledger path from `EVENT_SCRIPT`'s `SDD_RUN` and `SDD_LEDGER` lines (`harness/skills/sdd-continue/references/formats.md:164-183`).
 
 | Segment | Effect | Already landed when |
 | --- | --- | --- |
@@ -154,9 +154,9 @@ Both skills' `references/briefs.md` files are deleted; the drift-guard test read
 | `sdd-implementation-phase/references/completion.md` | Completion gate (Live verification, Reconcile a red PR), Repair |
 | `sdd-implementation-phase/references/stops.md` | Design defect, Escalate, Resume recovery, Stop conditions and their reports |
 
-- **Routers:** one line replaces each moved step. Reads happen at these points:
+- **Routers:** one line replaces each moved step; reads happen at:
   - `gates.md`: Step 1 item 6 in requirements; Step 5 in design; Step 6 in tasks.
-  - `convergence.md`: a Step 2 item 9 `iterate` at round 2 or later or at D ≥ 4, the SHOULD_FIX-only route, or a Step 0 `nextStep` of Step 4a or 4b. Round 1 goes straight to Step 3 because no check can fire on round 1 (`harness/skills/sdd-document-phase/SKILL.md:224-273`).
+  - `convergence.md`: a Step 2 item 9 `iterate` at round 2 or later or at D ≥ 4, the SHOULD_FIX-only route, or a Step 0 `nextStep` of Step 4a or 4b. Round 1 goes straight to Step 3, as no check can fire then (`harness/skills/sdd-document-phase/SKILL.md:224-273`).
   - `revision.md`: Step R.
   - `completion.md`: a Step 0 `nextStep` of Completion gate or Repair.
   - `stops.md`: `resume task`, a `DESIGN-DEFECT`, `ESCALATE` or `SEAM-DEFECT` flag, or any stop other than Budget.
@@ -187,11 +187,11 @@ Both skills' `references/briefs.md` files are deleted; the drift-guard test read
 ### C10 — Supervisor (`harness/skills/sdd-continue/SKILL.md`)
 - **Purpose:** Requirement 7 criteria 1 to 3.
 - The launch line (`harness/skills/sdd-continue/SKILL.md:291`) reads `BUDGET: <4 review rounds | 5 tasks | all items | n/a>`. Resume does not change (`harness/skills/sdd-continue/SKILL.md:350-351`).
-- The runaway guard (`harness/skills/sdd-continue/SKILL.md:379-380`): for implementation, more than `max(12, ceil(T/B) + 4)` spawns is an error, T being `data.tasks.total` from a `harness` `orient` call the supervisor makes before its first implementation spawn of the run and B the budget; other phases keep 12.
+- The runaway guard (`harness/skills/sdd-continue/SKILL.md:379-380`): for implementation, more than `max(12, ceil(T/B) + 4)` spawns is an error, T being `data.tasks.total` from a `harness` `orient` call before the run's first implementation spawn, B the budget; other phases keep 12.
 
 ### C11 — Baseline file (Requirement 2)
-- The first task after C1 to C4 writes `.spec-workflow/specs/lean-orchestrators/baseline-sources.md`: date, HEAD, and both `sources: true` messages verbatim (`trading-rules` through `projectPath: /home/mcf/repo/tradr-hosted`). It also runs scenario 1 (Requirement 1 criterion 6).
-- Probe, 2026-10-02: all 5 `tdd-task-loop` and all 3 `trading-rules` orchestrator transcripts resolve; the latter sit under slug `-home-mcf-repo-tradr--claude-worktrees-trading-rules`, dated 2026-09-28, and the oldest transcript under `-home-mcf-repo-tradr` is dated 2026-09-04.
+- The first task after C1–C4 writes `.spec-workflow/specs/lean-orchestrators/baseline-sources.md`: date, HEAD, and both `sources: true` messages verbatim (`trading-rules` through `projectPath: /home/mcf/repo/tradr-hosted`). It also runs scenario 1 (Requirement 1 criterion 6).
+- Probe, 2026-10-02: all 5 `tdd-task-loop` and all 3 `trading-rules` orchestrator transcripts resolve; the oldest, under `-home-mcf-repo-tradr`, is dated 2026-09-04.
 
 ## Data Models
 
@@ -207,7 +207,7 @@ interface TranscriptBreakdown { calls: number; peak: number; base: number; w: nu
 type TranscriptLookup = { ok: true; path: string } | { ok: false; reason: 'invalid-id' | 'missing' }
 type SpawnSources =
   | { phase: string; agent: string; agentId: string; ledgerW: number | null; ok: true; breakdown: TranscriptBreakdown; diff: number | null }
-  | { phase: string; agent: string; agentId: string | undefined; ledgerW: number | null; ok: false; reason: 'no-agent-id' | 'no-session' | 'invalid-id' | 'missing' | 'unreadable' }
+  | { phase: string; agent: string; agentId: string | undefined; ledgerW: number | null; ok: false; reason: 'no-agent-id' | 'no-session' | 'invalid-id' | 'missing' | 'unreadable' | 'no-usage' }
 interface SourcesReport { spec: string; spawns: SpawnSources[]; unknown: number }
 interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progress'; files: string[] }
 ```
@@ -216,7 +216,7 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
 
 ## Error Handling
 
-1. **No `agentId`, no session, invalid id, no or unreadable transcript, no usage line, or no projects directory:** `SpawnSources.ok: false` with `reason`; the block prints `sources unknown (<reason>)` and the ledger W, the header counts it, and the action returns `success: true`.
+1. **`SpawnSources.ok: false` with `reason`:** no `agentId` (`no-agent-id`), no session (`no-session`), an id failing the check (`invalid-id`), no transcript or no projects directory (`missing`, from `findTranscript`), an unreadable transcript (`unreadable`), or a readable transcript whose `breakdownTranscript` returns null for want of a `message.usage` line (`no-usage`). The block prints `sources unknown (<reason>)` and the ledger W, the header counts it, and the action returns `success: true`.
 2. **W unknown** (non-digit tokens or cache field): `wUnknown` increments; the cell prints ` (+N unknown)`.
 3. **Transcript W differs from ledger W:** the block prints `diff`; evidence for scenario 1, not an error.
 4. **Ledger or activity read error:** as today, `success: false` naming the path (`src/tools/harness.ts:1139-1207`).
@@ -232,7 +232,7 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
   - `src/watch/__tests__/usage.test.ts`: `spawnW`, `wUnknown`, `unitCount` per phase kind, per-unit and compare delta, the W column (update existing table assertions).
   - New `src/watch/__tests__/sources.test.ts`, fixture transcripts: one per source kind; a multi-line message counted once with its last usage; no usage line gives null; totals equal `w`; `base` sizing; a zero-character call.
   - New `src/watch/__tests__/transcripts.test.ts` (temp dirs): env override, invalid ids, symlinked project entry skipped, escaping session symlink skipped, first match wins.
-  - `src/tools/__tests__/harness.test.ts`: `usage` with `sources` (stubbed `CLAUDE_CONFIG_DIR`), the description, `queue`, `nextTask`, `decomposition` (both label forms, missing entry), one snapshot per brief kind, append mode and its missing target.
+  - `src/tools/__tests__/harness.test.ts`: `usage` with `sources` (stubbed `CLAUDE_CONFIG_DIR`), the description, `queue`, `nextTask`, `decomposition` (both label forms, missing entry). The existing `briefAction` tests (all-missing message, agent-rules drop, `taskBlock`, `redTests` gating, graph append/none/behind-0) keep their assertions under each kind's new value set, the `redTests` ones re-pointed to the `authorFiles`/`authorReport` build; new tests add one `render()` snapshot per brief kind, append mode and its missing target.
 - **Integration:**
   - New `src/__tests__/skill-split.test.ts` (Requirement 3 criterion 6): a frozen list of today's rule headings of both skills; each is in `SKILL.md` or exactly one of that skill's `references/*.md`; neither `SKILL.md` names `briefs.md`.
   - New `src/__tests__/book-script.test.ts`: renders `book-script` into a temp git store with stub `event.sh` and `retro.sh`, runs every segment, forces a commit failure (a held `index.lock`), re-runs, and asserts no doubled row or retro entry, exit codes 1 and 2, and the step name. It asserts only on exit codes and file contents.
@@ -242,23 +242,23 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
 
 ## Decisions taken in this document
 
-- D1 — Usage of a call: the last transcript line per message id (chosen) over the probe's first line; chosen because the first line misses 0.3 to 6.3 percent of ledger W in the design probe, failing the 1 percent check, while the last line matches exactly.
-- D2 — Base scope (narrow-check deferred note): the first call of the spawn's own transcript (chosen) over the first call overall; chosen because one transcript holds one agent id and a resumed segment keeps its prefix.
-- D3 — Breakdown modules: a pure source module plus a locator module (chosen) over code in the tool file; chosen because Requirement 1 criterion 10 wants pure, tested functions in the watch directory.
-- D4 — Batch shape: one generic segment script (chosen) over four verb scripts or server actions; chosen because commits need git and one script keeps one writer per row.
-- D5 — Script delivery: the brief action writes it from a server template (chosen) over a Write from reference text or a copy from the skill directory; chosen because the text stays out of context and a preloaded skill's base directory is uncertain.
-- D6 — Row idempotency: exact row match after the run's latest phase start, with unique values for repeats (chosen) over stamp files or a new key; chosen because Requirement 6 criterion 5 freezes keys and stamps die with the scratch directory.
-- D7 — Retro marker: a short hash of stage, ref, category and body (chosen) over a task-number match; chosen because a ruling and a task entry can share a number.
-- D8 — Close also picks the next task (chosen) over separate calls; chosen because Requirement 6 criterion 1 allows one bookkeeping call between spawns.
-- D9 — Task routing: an open-task queue from orient (chosen) over orient per task or script-side parsing; chosen because it is one read per spawn and keeps one parser.
-- D10 — Gate file scope: the task's declared files (chosen) over the implementer's list; chosen because Requirement 5 forbids file lists in reports and the gate takes the paths a change must stay within.
-- D11 — Lint rules: inline in the kept Lint step (chosen) over a lint template; chosen because the orchestrator fixes lint itself and would have to read a brief back.
-- D12 — Brief source: server templates only, both phase briefs files deleted (chosen) over a kept copy with a sync test; chosen because two copies drift.
-- D13 — Skill grouping: reference files by trigger (chosen) over one file per step; chosen to follow requirements decision D5.
-- D14 — Runaway guard basis: the task total (chosen) over open tasks at phase start; chosen because the total never shrinks, so a restarted supervisor gets the same allowance (R2-4).
-- D15 — Transcript expiry (R2-3): baseline task first, ledger-only per-unit W as fallback (chosen) over a snapshot; chosen because per-unit W needs no transcript, every baseline transcript is present, and a snapshot commits large files.
-- D16 — Round section: appended by the server (chosen) over read-then-overwrite; chosen because the scaffold leaves context.
-- D17 — Gate checks: an implementer-named checks file (chosen) over commands in the report or a rules-file read; chosen because the report stays within 80 words and Requirement 4 criterion 1 forbids the read.
+- D1 — Usage of a call: the last transcript line per message id (chosen) over the first line; because the first misses 0.3 to 6.3 percent of ledger W, failing the 1 percent check; the last matches exactly.
+- D2 — Base scope (narrow-check deferred note): the spawn's own first call (chosen) over the overall first call; because one transcript holds one agent id and a resumed segment keeps its prefix.
+- D3 — Breakdown modules: a pure source module plus a locator module (chosen) over code in the tool file; because Requirement 1 criterion 10 wants pure, tested watch-directory functions.
+- D4 — Batch shape: one generic segment script (chosen) over four verb scripts or server actions; because commits need git and one script is one writer per row.
+- D5 — Script delivery: the brief action writes it from a server template (chosen) over a Write from reference text or a skill-directory copy; because the text stays out of context and a preloaded skill's base directory is uncertain.
+- D6 — Row idempotency: exact row match after the run's latest phase start, unique values for repeats (chosen) over stamp files or a new key; because Requirement 6 criterion 5 freezes keys and stamps die with the scratch directory.
+- D7 — Retro marker: a short hash of stage, ref, category and body (chosen) over a task-number match; because a ruling and a task entry can share a number.
+- D8 — Close also picks the next task (chosen) over separate calls; because Requirement 6 criterion 1 allows one bookkeeping call between spawns.
+- D9 — Task routing: an open-task queue from orient (chosen) over orient per task or script-side parsing; because it is one read per spawn and one parser.
+- D10 — Gate file scope: the task's declared files (chosen) over the implementer's list; because Requirement 5 forbids report file lists and the gate takes the paths a change must stay within.
+- D11 — Lint rules: inline in the kept Lint step (chosen) over a lint template; because the orchestrator fixes lint itself and would read a brief back.
+- D12 — Brief source: server templates only, both phase briefs files deleted (chosen) over a kept copy with a sync test; because two copies drift.
+- D13 — Skill grouping: reference files by trigger (chosen) over one file per step; to follow requirements decision D5.
+- D14 — Runaway guard basis: the task total (chosen) over open tasks at phase start; because the total never shrinks, so a restarted supervisor gets the same allowance (R2-4).
+- D15 — Transcript expiry (R2-3): baseline task first, ledger-only per-unit W as fallback (chosen) over a snapshot; because per-unit W needs no transcript, every baseline transcript is present, and snapshots commit large files.
+- D16 — Round section: appended by the server (chosen) over read-then-overwrite; because the scaffold leaves context.
+- D17 — Gate checks: an implementer-named checks file (chosen) over commands in the report or a rules-file read; because the report stays within 80 words and Requirement 4 criterion 1 forbids the read.
 
 ## Scope notes
 
@@ -269,6 +269,10 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
 
 ## Revision History
 
+- **v3** (2026-10-02) — Round-2 adversarial response (adversarial-analysis-design-r2.md, verdict iterate 1/1/0).
+  - **Lint pass.** 0 fixed; rejected: the 45 citation-identifier warnings — same disposition as v1 and v2, each names a design-introduced identifier (a new type, field, report key, or orient datum; the two on the refactored brief-templates line are the new author-files and author-report build names, absent from the behaviour code being refactored), a data value matched against behaviour code, or a cross-file token the rule mis-associated with a correct behavioural citation; every cited range re-verified to anchor its adjacent claim. No errors.
+  - **R2-1 — Accepted (SHOULD_FIX).** The brief-templates component now states that the brief action keeps its behaviours but re-implements the missing-value set from each template's required list rather than the placeholder scan, and that the red-tests value moves to the author-files build; the component no longer claims the deleted drift-guard test becomes a per-kind snapshot and instead says that test, which checked the reference file against the code-graph helper, is deleted with the reference files; Testing Strategy now names which existing brief tests keep their assertions under the new per-kind value sets and which tests are new.
+  - **R2-2 — Accepted (MUST_FIX).** Added a no-usage discriminant to the spawn-sources failure union for a readable transcript with no usage line, and rewrote Error Handling item 1 to map every enumerated condition to a named reason, folding the no-projects-directory case into the missing reason.
 - **v2** (2026-10-02) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/2).
   - **Lint pass.** 0 fixed; rejected: the 43 citation-identifier warnings — same disposition as v1, each names a design-introduced identifier (a new type, field, report key, or orient datum), a data value matched against behaviour code, or a cross-file token the rule mis-associated with a correct behavioural citation; every cited range re-verified to anchor its adjacent claim. No errors.
   - **R1-1 — Accepted (SHOULD_FIX).** Cut the two consumerless fields from the open-task queue entry (the test-file list and the integration flag), leaving only its id, title, status and file list, and deleted the paragraph that defined them off an absent test-bullet convention.
````

## Lint commit 7a15ef1

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/design.md b/.spec-workflow/specs/lean-orchestrators/design.md
index 205c501..e5f2c2e 100644
--- a/.spec-workflow/specs/lean-orchestrators/design.md
+++ b/.spec-workflow/specs/lean-orchestrators/design.md
@@ -270,6 +270,7 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
 ## Revision History
 
 - **v3** (2026-10-02) — Round-2 adversarial response (adversarial-analysis-design-r2.md, verdict iterate 1/1/0).
+  - **Lint pass.** 0 fixed; rejected: the 45 citation-identifier warnings — same disposition as v1 and v2, each names a design-introduced identifier (a new type, field, report key, or orient datum; the two on the refactored brief-templates line are the new author-files and author-report build names, absent from the behaviour code being refactored), a data value matched against behaviour code, or a cross-file token the rule mis-associated with a correct behavioural citation; every cited range re-verified to anchor its adjacent claim. No errors.
   - **R2-1 — Accepted (SHOULD_FIX).** The brief-templates component now states that the brief action keeps its behaviours but re-implements the missing-value set from each template's required list rather than the placeholder scan, and that the red-tests value moves to the author-files build; the component no longer claims the deleted drift-guard test becomes a per-kind snapshot and instead says that test, which checked the reference file against the code-graph helper, is deleted with the reference files; Testing Strategy now names which existing brief tests keep their assertions under the new per-kind value sets and which tests are new.
   - **R2-2 — Accepted (MUST_FIX).** Added a no-usage discriminant to the spawn-sources failure union for a readable transcript with no usage line, and rewrote Error Handling item 1 to map every enumerated condition to a named reason, folding the no-projects-directory case into the missing reason.
 - **v2** (2026-10-02) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/2).
````
