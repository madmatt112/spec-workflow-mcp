# Adversarial Review — lean-orchestrators/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below (the lint pass changed only the Revision History bullet; it altered no citation and rejected all seven findings below). Still open (error = MUST_FIX candidate, warning = your call, info = a note):
  - L-1 (warning, citation-identifier, line 39): `base` absent from cited range. Rejected: document-defined source name.
  - L-2 / L-5 (warning, citation-identifier, lines 64 / 76): `harness` absent. Rejected: MCP tool name; the citation backs its own claim.
  - L-3 / L-4 (warning, citation-identifier, line 64): `reviewer` / `checker` absent. Rejected: worker-kind names, not symbols in the range.
  - L-6 (warning, citation-identifier, line 76): `orient` absent. Rejected: MCP action name.
  - L-7 (warning, citation-identifier, line 76): `implementation` absent. Rejected: phase name.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): lean-orchestrators requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. v2 answered round 1's four SHOULD_FIX and three MINOR (R1-1 through R1-7); every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v2 delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam round 1 already raised is marked `Compounds: R1-<n>` for the round that first raised that seam. Label each round-2 MUST_FIX `fix-induced` when the v2 delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect v2 did not touch; the label is guidance and does not change the round budget.
- Fix-induced re-check: when a finding is caused by a fix v2 made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: a cold read for internal contradictions and a truth table of the stated cases. Round 1 used wire contracts across a boundary. For this round, read the document as a self-contained spec and build a truth table over the stated cases — the W / per-source split and the `base` sizing (Req 1), the transcript-cleanup survival window (Req 2), the batch idempotency and partial-failure cases (Req 6.7), the open-tasks-at-phase-start rule and the worst-case restart count in D1 (Req 7) — and surface any pair of acceptance criteria that cannot both hold, or a case the criteria leave undefined.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
A `file:line` from the graph is a hint to confirm, not a citation.

## Changes since c687ef8

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/requirements.md b/.spec-workflow/specs/lean-orchestrators/requirements.md
index 5ffb15a..469264a 100644
--- a/.spec-workflow/specs/lean-orchestrators/requirements.md
+++ b/.spec-workflow/specs/lean-orchestrators/requirements.md
@@ -2,127 +2,128 @@
 
 ## Introduction
 
-This spec measures where the document and implementation orchestrators spend their context, then cuts the largest sources. It is for the harness operator, who pays for every orchestrator call because each call reads the whole context again. It adds a per-source breakdown to `harness usage`, then makes the two orchestrators load less skill text, read fewer whole files, receive shorter worker reports, batch their bookkeeping calls and live for fewer tasks per spawn.
+This spec measures where the document and implementation orchestrators spend their context, then cuts the largest sources — the harness operator pays for every call because each re-reads the whole context. It adds a per-source breakdown to `harness usage`, then makes them load less skill text, read fewer whole files, take shorter worker reports, batch bookkeeping and live for fewer tasks per spawn.
 
 ## Alignment with Product Vision
 
-No `steering/product.md` exists in this spec store (the `steering/` directory is empty); alignment is to the efficiency plan's order "tokens, then wall clock" (`docs/harness-efficiency-plan.md:8-9`) and to decomposition entry 14 (`.spec-workflow/spec-decomposition/decomposition.md:728-782`). The entry fixes the scope to the document and implementation orchestrators, requires measurement first, and accepts a drop in orchestrator W per spec with no quality loss as done. Wall clock is not an accepted trade-off, so every cut that adds orchestrator restarts is a recorded decision for gate A.
+No `steering/product.md` exists; alignment is to the efficiency plan's "tokens, then wall clock" (`docs/harness-efficiency-plan.md:8-9`) and decomposition entry 14 (`.spec-workflow/spec-decomposition/decomposition.md:728-782`), which fixes scope to the two orchestrators, requires measurement first, and accepts a drop in orchestrator W per spec with no quality loss as done. Wall clock is not a trade-off, so every cut that adds restarts is a recorded gate-A decision.
 
 ## Measured baseline (drafter probe, 2026-10-02)
 
-The unit is W = input + 1.25 cw5m + 2 cw1h + 0.1 read + 5 output (decomposition entry 14). From the `tdd-task-loop` ledger (`.spec-workflow/specs/tdd-task-loop/harness-events.jsonl`, last `spawn.end` per `agentId`): four document-orchestrator spawns cost 4.50M W and one implementation-orchestrator spawn cost 2.68M W over 17 tasks. The probe `/tmp/scratchpad/sdd/lean-orchestrators/source-probe.js` split each spawn's W by source from its transcript (character-proportional, so the shares are estimates; it reproduced the implementation spawn's ledger W within 0.3%):
+The unit is W = input + 1.25 cw5m + 2 cw1h + 0.1 read + 5 output (decomposition entry 14). From the `tdd-task-loop` ledger (`.spec-workflow/specs/tdd-task-loop/harness-events.jsonl`, last `spawn.end` per `agentId`), four document-orchestrator spawns cost 4.50M W and one implementation spawn cost 2.68M W over 17 tasks. The probe split each spawn's W by source from its transcript (character-proportional estimates, within 0.3% of the implementation spawn's ledger W):
 
 | Source | Document spawns (3) | Implementation spawn |
 | --- | --- | --- |
-| Base prefix (system prompt, agent body, tool schemas), about 32k tokens | 32-36% | 25% |
+| Base prefix (system prompt, agent body, tool schemas), ~32k tokens | 32-36% | 25% |
 | Skill text (preloaded skill plus `references/` reads) | 23-31% | 18% |
-| Orchestrator's own text and tool inputs | 11-16% | 14% |
-| Whole spec-store file reads (`tasks.md` once: 43k characters) | 1-5% | 16% |
-| Worker reports (hand-back messages and Agent results) | 2-7% | 12% |
+| Own text and tool inputs | 11-16% | 14% |
+| Whole spec-store reads (`tasks.md`: 43k chars) | 1-5% | 16% |
+| Worker reports (hand-backs and Agent results) | 2-7% | 12% |
 | MCP results (`adversarial-review`, `spec-lint`, `review-task` gate) | 5-11% | 5% |
 | Bash results | 3-11% | 3% |
 
-The implementation spawn made 127 calls and reached a 229k-token context; 51 of its tool calls were ledger writes. The document spawns made 56-74 calls each, of which 2-7 were worker spawns. The cuts below target the rows that one spec can change; the base prefix is out of scope (Scope notes).
+The implementation spawn peaked at 229k tokens. The cuts below target the rows one spec can change; the base prefix is out of scope (Scope notes).
 
 ## Requirements
 
 ### Requirement 1 — W and a per-source breakdown in `harness usage`
 
-**User Story:** As the retro analyst, I want `harness usage` to print each orchestrator spawn's W split by context source, so that I can see which source a cut removed and read the drop against a baseline spec.
+**User Story:** As the retro analyst, I want `harness usage` to split each orchestrator spawn's W by context source, so I can see which source a cut removed and read the drop against a baseline.
 
 #### Acceptance Criteria
 
-1. WHEN `harness usage` runs THEN each phase total and each agent cell SHALL also carry W, computed per spawn from the closing `spawn.end` row's `input`, `output`, `cacheRead`, `cacheWrite5m` and `cacheWrite1h` (the keys the hook writes at `harness/hooks/sdd-activity.sh:220-229`). IF a spawn's `cacheWrite5m` or `cacheWrite1h` is not a digit string THEN that spawn's W SHALL count as unknown, shown as ` (+N unknown)` like the token cell (`src/watch/usage.ts:365-367`).
-2. WHEN the `usage` action gets `sources: true` THEN for every `sdd-document-orchestrator` and `sdd-implementation-orchestrator` spawn it SHALL read the subagent transcript and print one block per spawn: phase, agent, `agentId`, calls, peak context tokens, W, and one row per source with its W and its share of the spawn's W (D2).
-3. The transcript SHALL be located from the activity rows' `session` and `agentId` (`src/watch/ledger.ts:26-36`) as `<projects dir>/<any project>/<session>/subagents/agent-<agentId>.jsonl`, the same derivation the hook uses (`harness/hooks/sdd-activity.sh:135-142`). The action SHALL accept a `session` and an `agentId` only when they match `^[A-Za-z0-9-]+$`, and SHALL read no other path.
-4. The sources SHALL be: `base` (the prefix not visible in the transcript), `skill` (meta messages that carry a skill body, and `Read` results of files under a `skills/` directory), `worker-report` (Agent tool results and hand-back messages), `read` (other `Read` results, with the spec-store share broken out), `mcp:<tool>.<action>`, `bash`, `tool:<name>` for any other tool, `prompt` (the launch prompt and other user text) and `own-output` (the orchestrator's text and tool inputs held in context, plus its output tokens).
-5. Each call SHALL be counted once per `message.id`, as `readUsage` counts it (`harness/hooks/sdd-activity.sh:68-98`). A call's output W SHALL go to `own-output`; its input W SHALL be split over the sources in its context in proportion to their size, with `base` sized once from the first call (D7).
-6. WHEN the breakdown runs on the `tdd-task-loop` ledger and transcripts THEN the source totals of each document and implementation orchestrator spawn SHALL equal that spawn's W from criterion 1 within 1% (decomposition scenario 1).
-7. IF a spawn's transcript is missing or unreadable THEN its block SHALL print `sources unknown` with its ledger W, and the report header SHALL count such spawns; the action SHALL never fail on a missing transcript.
-8. WHEN `sources: true` is given THEN each phase total SHALL also print W per unit: W per review round in a document phase (the count of `round` rows) and W per completed task in the implementation phase (the count of `task.done` rows). WHEN `compareSpecName` is also given THEN the compare table SHALL print both specs' per-unit W and the delta.
-9. Without `sources: true` the action SHALL read only the spec store, as its description states (`src/tools/harness.ts:41-43`); the description SHALL name the transcript read that `sources: true` adds. The action SHALL still spawn no process.
+1. WHEN `harness usage` runs THEN each phase total and each agent cell SHALL also carry W, computed per spawn from the closing `spawn.end` row's `input`, `output`, `cacheRead`, `cacheWrite5m` and `cacheWrite1h` (written at `harness/hooks/sdd-activity.sh:220-229`). IF a spawn's `cacheWrite5m` or `cacheWrite1h` is not a digit string THEN that spawn's W SHALL count as unknown, shown as ` (+N unknown)` like the token cell (`src/watch/usage.ts:365-367`).
+2. WHEN the `usage` action gets `sources: true` THEN for every `sdd-document-orchestrator` and `sdd-implementation-orchestrator` spawn it SHALL read the subagent transcript and print one block per spawn: phase, agent, `agentId`, calls, peak context tokens, W, and one row per source with its W and share (D2).
+3. A `spawn.end` row carries `agentId` but no `session` (`src/watch/ledger.ts:18-24`), so the action SHALL recover each spawn's `session` by joining its `agentId` to the spec's `harness-activity.jsonl`, whose rows carry both (`src/watch/ledger.ts:26-36`). `<projects dir>` SHALL be `$CLAUDE_CONFIG_DIR/projects` when that variable is set, else `~/.claude/projects`. The transcript SHALL be found by scanning each project subdirectory under `<projects dir>` for the first existing `<session>/subagents/agent-<agentId>.jsonl` (the segment the hook builds, `harness/hooks/sdd-activity.sh:135-142`), so a baseline under a different project slug than Req 2.3 names is still found. The action SHALL accept `session` and `agentId` only when they match `^[A-Za-z0-9-]+$`, enumerate only project subdirectories under `<projects dir>`, read no path outside it, and stop at the first match.
+4. The sources SHALL be: `base` (the prefix not in the transcript), `skill` (meta messages carrying a skill body, and `Read` results under a `skills/` directory), `worker-report` (Agent tool results and hand-back messages), `read` (other `Read` results, spec-store share broken out), `mcp:<tool>.<action>`, `bash`, `tool:<name>` for any other tool, `prompt` (the launch prompt and other user text) and `own-output` (the orchestrator's text and tool inputs in context, plus its output tokens).
+5. Each call SHALL be counted once per `message.id`, as `readUsage` counts it (`harness/hooks/sdd-activity.sh:68-98`). A call's output W SHALL go to `own-output`; its input W SHALL be split over the sources in its context by size, with `base` sized once from the first call (D7).
+6. WHEN the breakdown runs on the `tdd-task-loop` ledger and transcripts THEN the source totals of each document and implementation orchestrator spawn SHALL equal that spawn's W from criterion 1 within 1% (decomposition scenario 1). This scenario SHALL be run and its evidence captured at the same early point as Req 2.1's baseline write, before the transcripts age out (Req 2.3).
+7. IF a spawn's transcript is missing or unreadable, or its `session` cannot be resolved (no activity row matches its `agentId`), THEN its block SHALL print `sources unknown` with its ledger W, the report header SHALL count such spawns, and the action SHALL never fail on a missing transcript or activity row.
+8. WHEN `sources: true` is given THEN each phase total SHALL also print W per unit: per review round (count of `round` rows) in a document phase, per completed task (count of `task.done` rows) in implementation. WHEN `compareSpecName` is also given THEN the compare table SHALL print both specs' per-unit W and the delta.
+9. Without `sources: true` the action SHALL read only the spec store (`src/tools/harness.ts:41-43`), and the description SHALL name the transcript read that `sources: true` adds; it SHALL still spawn no process.
 10. The breakdown and the W fold SHALL be pure functions in `src/watch/` with tests beside them, fed fixture transcripts: one per source kind, a multi-line message counted once, a missing transcript, and a sum check against W.
 
 ### Requirement 2 — The baseline survives transcript cleanup
 
-**User Story:** As the retro analyst, I want the baseline breakdowns saved in the spec store, so that the retro can compare against them after the transcripts are gone.
+**User Story:** As the retro analyst, I want the baseline breakdowns saved in the spec store, so the retro can compare against them after the transcripts are gone.
 
 #### Acceptance Criteria
 
 1. WHEN Requirement 1 is implemented THEN the first implementation task after it SHALL write `.spec-workflow/specs/lean-orchestrators/baseline-sources.md` holding the `sources: true` output for `tdd-task-loop` (this spec store) and for `trading-rules` (`/home/mcf/repo/tradr-hosted/.spec-workflow`, through `projectPath`), and commit it (D8).
 2. IF a baseline spawn reports `sources unknown` THEN the file SHALL say so for that spawn and keep its ledger W; the task SHALL not invent a breakdown.
-3. The retro SHALL read the baseline from this file, not from transcripts. The oldest transcript kept under `~/.claude/projects/-home-mcf-repo-spec-workflow-mcp/` was dated 2026-09-13 on 2026-10-02 (probe), so older transcripts are already gone.
+3. The retro SHALL read the baseline from this file, not transcripts. The oldest transcript under `~/.claude/projects/-home-mcf-repo-spec-workflow-mcp/` was dated 2026-09-13 on 2026-10-02 (probe), so older ones are already gone.
 
 ### Requirement 3 — Step-scoped skill text
 
-**User Story:** As the harness operator, I want each orchestrator to hold only the skill text of the steps it runs, so that rarely used steps stop riding in every call.
+**User Story:** As the harness operator, I want each orchestrator to hold only the skill text of the steps it runs, so rarely used steps stop riding in every call.
 
 #### Acceptance Criteria
 
 1. The preloaded `sdd-document-phase` skill (`harness/agents/sdd-document-orchestrator.md:8-9`) SHALL keep the standing rules, Step 0, Step 1, the Lint step, Step 2, Step 3, Step 5, Step 6 and Budget. Gate A, Gate B, the Standoff, Circling and Cap convergence checks, Steps 4a and 4b, the Design scope-cut gate, Step R and the legacy rules SHALL move to reference files that the orchestrator reads only when Step 0 or a route names that step (D5).
 2. The preloaded `sdd-implementation-phase` skill (`harness/agents/sdd-implementation-orchestrator.md:8-9`) SHALL keep the standing rules, Step 0, the Per-task loop and the Deferral bar. Design defect, Escalate, Resume recovery, the Completion gate (with Live verification and Reconcile a red PR), Repair and the stop table SHALL move to reference files read only when routed there.
-3. No orchestrator SHALL read `references/briefs.md` whole. Today both skills say to read it once at the start (`harness/skills/sdd-document-phase/SKILL.md:14-17`, `harness/skills/sdd-implementation-phase/SKILL.md:22`), and the server templates do not yet carry the fixed brief text (`src/tools/harness.ts:490-491`). Every brief, prompt section and standing brief an orchestrator writes SHALL come from `harness` `brief` with the fixed text server-side; the step text SHALL list only the values the orchestrator passes.
+3. No orchestrator SHALL read `references/briefs.md` whole. Today both skills read it once at the start (`harness/skills/sdd-document-phase/SKILL.md:14-17`, `harness/skills/sdd-implementation-phase/SKILL.md:22`). `BRIEF_TEMPLATES` carries six skeletons (`src/tools/harness.ts:493-544`); what is deferred is porting each block's verbatim field text (`src/tools/harness.ts:490-491`). Every brief and prompt block an orchestrator writes SHALL come from `harness` `brief` with the fixed text server-side, and the step text SHALL list only the values passed. Before the whole read is removed, the document-phase blocks with no template yet — gate-A re-spawn, round section, lint, narrow-check and code-graph — and the `reviewer` and `checker` kinds (Requirement 5) SHALL be added, so no kept step (Step 2, the Lint step) breaks.
 4. The implementer and verifier standing briefs (`harness/skills/sdd-implementation-phase/references/briefs.md`, sections at lines 5 and 134) SHALL be written by `harness` `brief`, not by the orchestrator's Write tool.
-5. The document orchestrator SHALL read `references/cleanup.md` only in Step 6 and in the step that first needs the commit script.
+5. The document orchestrator SHALL read `references/cleanup.md` only in Step 6 and in the step that first needs the commit script. The implementation orchestrator today reads the document-phase `references/cleanup.md` for its `spec-edit.mjs` and commit-script text (`harness/skills/sdd-implementation-phase/SKILL.md:49-58`); the checkbox edit and commit SHALL instead come from the Requirement 6 batch scripts, so it no longer reads `cleanup.md` for the close path.
 6. No moved text SHALL change meaning: a test SHALL assert that every rule heading of today's two skills exists in the new skill or in exactly one of its reference files.
 
 ### Requirement 4 — No whole spec-store files in the implementation orchestrator
 
-**User Story:** As the harness operator, I want the implementation orchestrator to route from server results, not from whole files, so that `tasks.md` and the decomposition stop riding in every call.
+**User Story:** As the harness operator, I want the implementation orchestrator to route from server results, not whole files, so `tasks.md` and the decomposition stop riding in every call.
 
 #### Acceptance Criteria
 
-1. The implementation orchestrator SHALL NOT read `tasks.md`, the decomposition file or `agent-rules.md` with the Read tool or with a shell command that prints them whole. Today its own reads include all three (`harness/skills/sdd-implementation-phase/SKILL.md:6-13`).
+1. The implementation orchestrator SHALL NOT read `tasks.md`, the decomposition file or `agent-rules.md` with the Read tool or a shell command that prints them whole (today all three are read: `harness/skills/sdd-implementation-phase/SKILL.md:6-13`).
 2. WHEN `harness` `orient` runs for `implementation` THEN its result SHALL also carry the next task's id, title and status, so that the Pick step needs no `tasks.md` read (`harness/skills/sdd-implementation-phase/SKILL.md:104-107`).
-3. WHEN the completion gate needs the decomposition entry's verification scenario THEN a server result SHALL return that scenario text only; the orchestrator SHALL not grep the whole file.
-4. The orchestrator SHALL change a task's checkbox through the batched bookkeeping of Requirement 6, which locates the line itself.
+3. WHEN the completion gate needs the decomposition entry's verification scenario THEN a server result SHALL return that scenario text only, not the whole file.
+4. The orchestrator SHALL change a task's checkbox through the Requirement 6 batched bookkeeping, which locates the line itself.
 
 ### Requirement 5 — Short, fixed-shape worker reports
 
-**User Story:** As the harness operator, I want every worker's report to its orchestrator to be a short fixed block, so that reports stop growing the orchestrator context.
+**User Story:** As the harness operator, I want every worker's report to be a short fixed block, so reports stop growing the orchestrator context.
 
 #### Acceptance Criteria
 
-1. Every worker that reports to the document or implementation orchestrator (drafter, reviewer, reviser, adjudicator, checker, implementer, test author, verifier) SHALL end its report with a fixed `key: value` block of at most 8 lines, and the whole report SHALL be at most 80 words (D6).
-2. The block keys SHALL be the ones the orchestrator routes on, listed per role in the role's agent file; file lists and per-file notes SHALL not appear in the report. A worker that has more to say SHALL write it to a file under `/tmp/scratchpad/sdd/<spec>/` and name the path in one line.
-3. The orchestrator SHALL route only on block keys; IF a report lacks its block THEN the orchestrator SHALL treat it as a stall and re-spawn once, as it does for a missing verdict block (`harness/skills/sdd-document-phase/SKILL.md:169-208`).
+1. Every worker that reports to an orchestrator (drafter, reviewer, reviser, adjudicator, checker, implementer, test author, verifier) SHALL end its report with a fixed `key: value` block of at most 8 lines, and the whole report SHALL be at most 80 words (D6).
+2. The block keys SHALL be the ones the orchestrator routes on, listed per role in the role's agent file; file lists and per-file notes SHALL not appear. A worker with more to say SHALL write it to a file under `/tmp/scratchpad/sdd/<spec>/` and name the path in one line.
+3. The orchestrator SHALL route only on block keys; IF a report lacks its block THEN the orchestrator SHALL treat it as a stall and re-spawn once, as for a missing verdict block (`harness/skills/sdd-document-phase/SKILL.md:169-208`).
 4. The hook's `spawn.report` row (`harness/hooks/sdd-activity.sh:230-235`) SHALL be unchanged; it records whatever the worker reported.
 
 ### Requirement 6 — Batched bookkeeping
 
-**User Story:** As the harness operator, I want the orchestrator's bookkeeping between two worker spawns to take one tool call, so that fewer calls re-read the context.
+**User Story:** As the harness operator, I want the orchestrator's bookkeeping between two worker spawns to take one tool call, so fewer calls re-read the context.
 
 #### Acceptance Criteria
 
-1. Between a worker's report and the next worker spawn or gate call, the implementation orchestrator SHALL make at most one bookkeeping tool call. The pick (checkbox to `[-]`, `task.pick`, HEAD capture) SHALL be one call; the close (checkbox to `[x]`, `task.done`, retro-log entry, HANDOFF State row, spec-store commit) SHALL be one call. Today these are separate Edit, `event.sh`, `retro.sh` and commit calls (`harness/skills/sdd-implementation-phase/SKILL.md:59-77`, `harness/skills/sdd-implementation-phase/SKILL.md:252-264`).
-2. Each worker's `spawn.usage` row and each gate's `note` and `judge` rows SHALL be written in that same bookkeeping call, not in a call of their own.
+1. Between a worker's report and the next worker spawn or gate call, the implementation orchestrator SHALL make at most one bookkeeping tool call. The pick (checkbox to `[-]`, `task.pick`, HEAD capture) SHALL be one call; the close (checkbox to `[x]`, `task.done`, retro-log entry, HANDOFF State row, spec-store commit) SHALL be one call. Today these are separate Edit, `event.sh`, `retro.sh` and commit calls (`harness/skills/sdd-implementation-phase/SKILL.md:59-77` and `:252-264`).
+2. Each worker's `spawn.usage` row and each gate's `note` and `judge` rows SHALL be written in that same bookkeeping call, not calls of their own.
 3. In a document phase, the `spawn.usage`, `round` row and retro-log entry that follow a review verdict SHALL be one call (`harness/skills/sdd-document-phase/SKILL.md:61-69`).
 4. The batching SHALL be per-run shell scripts that the orchestrator writes once per run, beside `event.sh`, and SHALL append rows only through `EVENT_SCRIPT`, so the run ledger keeps one writer per row and its run id (`.spec-workflow/agent-rules.md:84-97`) (D3).
 5. Ledger row types and keys SHALL be unchanged, so `--watch` and `harness usage` read the new run as they read the baseline.
 6. The batch scripts SHALL exit non-zero naming the step that failed; the orchestrator SHALL treat a non-zero exit as today's failed step, never as success.
+7. Each batch script SHALL be idempotent: before it appends a `task.pick` or `task.done` row, sets a checkbox or commits, it SHALL skip any step that already landed (ledger row present, checkbox in the target state, change committed), so re-running after a partial failure cannot double-append a row (Req 6.5, `.spec-workflow/agent-rules.md:84-97`) or re-commit. On a non-zero exit (Req 6.6) the orchestrator SHALL re-run the same script, completing only the unlanded steps.
 
 ### Requirement 7 — Fewer tasks per implementation orchestrator spawn
 
-**User Story:** As the harness operator, I want the supervisor to restart the implementation orchestrator more often, so that no single spawn re-reads a 200k-token context for its last tasks.
+**User Story:** As the harness operator, I want the supervisor to restart the implementation orchestrator more often, so no single spawn re-reads a 200k-token context for its last tasks.
 
 #### Acceptance Criteria
 
-1. The supervisor's implementation `BUDGET` SHALL default to 5 tasks per spawn (today 20: `harness/skills/sdd-continue/SKILL.md:291`), and the skill text that states 20 SHALL say 5 (D1).
+1. The supervisor's implementation `BUDGET` SHALL default to 5 tasks per spawn (today 20: `harness/skills/sdd-continue/SKILL.md:291`), and the skill text that states 20 SHALL say 5 (D1). The default at `harness/skills/sdd-implementation-phase/SKILL.md:16` and the rationale at `:17-20` for why 20 is safe SHALL both change; the rationale is rewritten for the 5-task budget, not merely renumbered.
 2. WHEN a spawn reports `PHASE: resume` THEN the supervisor SHALL spawn a fresh orchestrator as today (`harness/skills/sdd-continue/SKILL.md:350-351`).
-3. The runaway guard (`harness/skills/sdd-continue/SKILL.md:379-380`) SHALL allow, for the implementation phase, the larger of 12 and ceil(open tasks / BUDGET) + 4 spawns.
+3. The runaway guard (`harness/skills/sdd-continue/SKILL.md:379-380`) SHALL allow, for the implementation phase, the larger of 12 and ceil(open tasks / BUDGET) + 4 spawns. The open-tasks count SHALL be read once at phase start and held fixed, so the allowance does not shrink as tasks close and cannot trip the guard spuriously mid-phase.
 4. The document orchestrator's lifetime SHALL be unchanged: 4 review rounds per spawn (D4).
-5. WHEN the task that fills the budget is also the last open task THEN the orchestrator SHALL report `PHASE: resume` with `NEXT: completion gate`, so a fresh spawn runs the completion gate (today Budget fires only while open tasks remain: `harness/skills/sdd-implementation-phase/SKILL.md:265-267`).
+5. WHEN the task that fills the budget is also the last open task THEN the orchestrator SHALL report `PHASE: resume` with `NEXT: completion gate`, so a fresh spawn runs it (today Budget fires only while open tasks remain: `harness/skills/sdd-implementation-phase/SKILL.md:265-267`).
 
 ### Requirement 8 — Must-keeps and end-to-end proof
 
-**User Story:** As the harness operator, I want a fixture run and the retro to prove the drop with no lost quality or must-keep, so that the cuts are judged on numbers.
+**User Story:** As the harness operator, I want a fixture run and the retro to prove the drop with no lost quality or must-keep, so the cuts are judged on numbers.
 
 #### Acceptance Criteria
 
 1. The run SHALL keep the must-keeps: the ledger and `--watch`, a fresh worker per round and per task, and one PR per spec that agents never merge (decomposition entry 14, Decided).
-2. WHEN a fixture spec with at least 6 tasks runs on the changed harness through requirements, design, tasks and implementation THEN its ledger SHALL show a fresh worker `spawn.start` per review round and per task, and one PR (decomposition scenario 2). The fixture kit SHALL be dry-run in a scratch store and recorded green before the gated run (`.spec-workflow/agent-rules.md:99-110`).
+2. WHEN a fixture spec with at least 6 tasks runs on the changed harness through all four phases THEN its ledger SHALL show a fresh worker `spawn.start` per review round and per task, and one PR (decomposition scenario 2). The fixture kit SHALL be dry-run in a scratch store and recorded green before the gated run (`.spec-workflow/agent-rules.md:99-110`).
 3. WHEN that run ends THEN `harness usage` with `sources: true` SHALL show orchestrator W per review round and per task lower than in `baseline-sources.md`, and the retro SHALL print both numbers (decomposition scenario 3).
-4. The retro SHALL also report, beside the baseline, these quality signals: review rounds per document phase, MUST_FIX count at convergence, fix rounds per task, escalations and errors, and phase wall clock per round and per task. A worse quality signal, or wall clock per task more than 15% above the baseline, SHALL be a retro finding for Matthew, not a silent pass (D9).
+4. The retro SHALL also report, beside the baseline, these quality signals: review rounds per document phase, MUST_FIX count at convergence, fix rounds per task, escalations and errors, and wall clock per round and per task. A worse signal, or wall clock per task over 15% above the baseline, SHALL be a retro finding for Matthew, not a silent pass (D9).
 5. WHEN the fixture run cannot run inside the normal loop THEN it SHALL stay pending in a tracked `verification-evidence.md` whose every line must read `passed` before the retrospective opens (`.spec-workflow/agent-rules.md:99-110`).
 6. `npm run check:plugin-assets`, `claude plugin validate . --strict`, `npx tsc --noEmit` and `npm test` SHALL be green (decomposition scenario 4).
 
@@ -130,37 +131,44 @@ The implementation spawn made 127 calls and reached a 229k-token context; 51 of
 
 ### Performance
 - Orchestrator W per review round and per task SHALL drop against the baseline; there is no fixed target (decomposition entry 14, Decided).
-- `harness usage` without `sources: true` SHALL read no more files than today.
 
 ### Security
-- The transcript read SHALL accept only validated `session` and `agentId` values (Requirement 1 criterion 3) and SHALL not follow paths from row content.
+- The transcript read SHALL accept only validated `session` and `agentId` values (Requirement 1 criterion 3), SHALL enumerate only project subdirectories under `<projects dir>` and read no path outside it, and SHALL not follow paths from row content.
 
 ### Reliability
 - A missing transcript, a torn ledger line or an unknown cache field SHALL lower the report to an unknown count, never fail it. Breakdown shares are estimates and W totals are floors; the report SHALL say so in its header (`.spec-workflow/agent-rules.md:84-97`).
 
 ## Decisions taken in this document
 
-- D1 — Implementation orchestrator lifetime: options were 5 tasks per spawn (chosen), 20 tasks per spawn as today, 10 tasks per spawn, one task per spawn; chosen because the probe shows the last tasks of a 17-task spawn re-read about 200k tokens per call, a fresh spawn costs one base-and-skill write, and 5 adds about three restarts to a 17-task phase, which stays within the wall-clock rule while one task per spawn would not.
-- D2 — Where the breakdown is computed: options were the usage action reads orchestrator transcripts on request (chosen), the activity hook writes per-source rows at subagent stop, a standalone script outside the server; chosen because only a transcript reader can break down the baseline specs, and it keeps new code out of the hook, a sensitive path.
-- D3 — Where batched bookkeeping lives: options were per-run shell scripts written beside the event script (chosen), new server actions that write the ledger and commit, leaving the calls as they are; chosen because commits need a git process the harness tool never spawns, and the ledger keeps its single writer path.
-- D4 — Document orchestrator lifetime: options were keep 4 review rounds per spawn (chosen), one spawn per review round; chosen because document spawns peaked at 136k to 163k tokens, below the implementation peak, and the skill and bookkeeping cuts reach them without extra restarts.
-- D5 — Skill split: options were preloaded core plus routed reference files (chosen), one file per step loaded on demand, keep whole skills; chosen because every spawn runs the core steps, and per-step files would add a read call to every step.
-- D6 — Worker report size: options were a fixed block of at most 8 lines within 80 words (chosen), keep the 150-word cap, reports to files only; chosen because the 22 worker hand-backs of the baseline implementation spawn ran a median of 261 words (220 to 466), and the orchestrator routes on a few keys only.
-- D7 — Attribution rule: options were split each call's input W by source size with the base sized from the first call (chosen), count tokens with a tokenizer, charge each block only once when it first enters; chosen because the split makes the source totals equal W by construction, and no tokenizer package is installed in this repository (probe of the installed packages, 2026-10-02).
-- D8 — Baseline persistence: options were a committed baseline file written early in implementation (chosen), rely on the transcripts staying, re-run the baseline specs; chosen because old transcripts are already gone from this machine, and re-runs cost a full spec.
-- D9 — Quality bar: options were the listed retro signals with a 15% wall-clock flag (chosen), a fixed W target, reviewer judgement only; chosen because the decomposition sets no target number and makes wall clock Matthew's call.
-- D10 — Cheaper orchestrator model: options were defer to a retro decision (chosen), try Sonnet on the fixture run through the per-role override, switch the default now; chosen because W weighs tokens the same on every model, so a model change cannot show in this spec's done measure.
-- D11 — Approval calls: options were leave the four approval calls per phase as they are (chosen), batch them in one server action; chosen because the approvals tool is a sensitive path and the four calls are a small share of a document spawn.
+- D1 — Implementation orchestrator lifetime: 5 tasks per spawn (chosen) over 20 (today), 10, or one; the last tasks of a 17-task spawn re-read about 200k tokens per call, a fresh spawn costs one base-and-skill write, and 5 adds about three restarts to a 17-task phase, within the wall-clock rule, while one per spawn would not. Req 7.5 adds at most one further restart — a completion-gate-only spawn when the budget-filling task is the last open task — so the worst case is about four restarts, still within the rule (gate-A record).
+- D2 — Breakdown location: the usage action reads transcripts on request (chosen) over a hook or standalone script; only a transcript reader can break down the baseline specs, and it keeps new code out of the hook, a sensitive path.
+- D3 — Batched bookkeeping location: per-run shell scripts beside the event script (chosen) over new server actions or no change; commits need a git process the harness never spawns, and the ledger keeps one writer.
+- D4 — Document orchestrator lifetime: keep 4 review rounds per spawn (chosen) over one per round; spawns peaked at 136k-163k tokens, below the implementation peak, and the cuts reach them without extra restarts.
+- D5 — Skill split: preloaded core plus routed reference files (chosen) over one file per step or whole skills; per-step files would add a read to every step.
+- D6 — Worker report size: a fixed block of at most 8 lines within 80 words (chosen) over the 150-word cap or files only; the baseline spawn's 22 hand-backs ran a median 261 words (220-466) and the orchestrator routes on a few keys.
+- D7 — Attribution rule: split each call's input W by source size, base sized from the first call (chosen) over a tokenizer or charge-once; the split makes source totals equal W by construction, and no tokenizer is installed (probe, 2026-10-02).
+- D8 — Baseline persistence: a committed baseline file written early (chosen) over relying on transcripts or re-running specs; old transcripts are gone and re-runs cost a full spec.
+- D9 — Quality bar: the listed retro signals with a 15% wall-clock flag (chosen) over a fixed W target or reviewer judgement; the decomposition sets no target and makes wall clock Matthew's call.
+- D10 — Cheaper orchestrator model: defer to a retro decision (chosen) over trying Sonnet or switching now; W weighs tokens the same on every model, so a model change cannot show here.
+- D11 — Approval calls: leave the four per phase as they are (chosen) over batching; the approvals tool is a sensitive path and the calls are a small share.
 
 ## Scope notes
 
-- The base prefix (system prompt, agent body, tool schemas, about 32k tokens and 25-36% of orchestrator W) is not cut: it is set by Claude Code and the session's MCP servers, not by this repository. The breakdown reports it so a later spec can act.
-- The cheaper-model lever is deferred to a retro decision (D10); the per-role override from spec 9 stays available.
+- The base prefix (system prompt, agent body, tool schemas, ~32k tokens and 25-36% of orchestrator W) is not cut: Claude Code and the session's MCP servers set it, not this repository. The breakdown reports it so a later spec can act.
 - The close-out and retro orchestrators keep their shape (decomposition entry 14, Decided). Shared reference text they use, such as `references/cleanup.md`, SHALL keep working for them.
-- The decomposition entry lists all four levers as accepted; this document uses three (less detail, supervisor looping, bookkeeping to scripts) and defers the model lever.
+- The decomposition lists four levers as accepted; this document uses three (less detail, supervisor looping, bookkeeping to scripts) and defers the model lever to a retro decision (D10); the per-role override from spec 9 stays available.
 - Carried items from a previous phase: none.
 
 ## Revision History
 
 - **v1** (2026-10-02) — Initial draft.
   - **Lint pass.** 0 fixed; rejected: L-1 (`base` is a document-defined source name, not a symbol claimed in the `readUsage` citation), L-2 and L-3/L-4/L-5 (`harness`, `orient`, `implementation` are the MCP tool, action and phase names; each citation backs its own claim, not those tokens).
+- **v2** (2026-10-02) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/4/3).
+  - **R1-1 — Accepted (SHOULD_FIX).** Req 1.3 adds the `agentId`→activity `session` join, defines `<projects dir>` with override and bounded scan, drops "same derivation"; Req 1.7/NFR Security fold in the unresolvable `session` and enumeration bound.
+  - **R1-2 — Accepted (SHOULD_FIX).** Req 3.3 names the five blocks without a template plus `reviewer`/`checker`, and restates the premise as six skeletons with deferred field text.
+  - **R1-3 — Accepted (SHOULD_FIX).** New Req 6.7 requires idempotent, re-runnable batch scripts.
+  - **R1-4 — Accepted (SHOULD_FIX).** Req 7.3 pins open-tasks to phase start; D1 records the Req 7.5 spawn (four restarts worst case).
+  - **R1-5 — Accepted (MINOR).** Req 1.6 ties scenario-1 capture to Req 2.1's early write.
+  - **R1-6 — Accepted (MINOR).** Req 7.1 requires the `:16` default and `:17-20` rationale rewritten.
+  - **R1-7 — Partially accepted (MINOR).** Req 3.5 resolves the close-path overlap; other `spec-edit.mjs` uses left to design.
+  - **Lint pass.** 0 fixed; rejected: L-1 (`base` is a document-defined source name), L-2/L-5 (`harness` is the MCP tool name), L-3/L-4 (`reviewer`, `checker` are worker-kind names), L-6 (`orient` is the MCP action name), L-7 (`implementation` is the phase name) — each citation backs its own claim, not those tokens, so every citation-identifier warning is a false positive.
````

## Lint commit 9da15e7

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/requirements.md b/.spec-workflow/specs/lean-orchestrators/requirements.md
index 60f9e3a..469264a 100644
--- a/.spec-workflow/specs/lean-orchestrators/requirements.md
+++ b/.spec-workflow/specs/lean-orchestrators/requirements.md
@@ -171,3 +171,4 @@ The implementation spawn peaked at 229k tokens. The cuts below target the rows o
   - **R1-5 — Accepted (MINOR).** Req 1.6 ties scenario-1 capture to Req 2.1's early write.
   - **R1-6 — Accepted (MINOR).** Req 7.1 requires the `:16` default and `:17-20` rationale rewritten.
   - **R1-7 — Partially accepted (MINOR).** Req 3.5 resolves the close-path overlap; other `spec-edit.mjs` uses left to design.
+  - **Lint pass.** 0 fixed; rejected: L-1 (`base` is a document-defined source name), L-2/L-5 (`harness` is the MCP tool name), L-3/L-4 (`reviewer`, `checker` are worker-kind names), L-6 (`orient` is the MCP action name), L-7 (`implementation` is the phase name) — each citation backs its own claim, not those tokens, so every citation-identifier warning is a false positive.
````
