# Adversarial Review — provider-per-role/requirements (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-requirements-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-requirements-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v4.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v4 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v4 lint commit changed: see the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): L-1 (warning, citation-identifier, line 149): Identifier `ANTHROPIC_MODEL` is absent from the cited ranges `.spec-workflow/spec-decomposition/decomposition.md:371-373` and `.spec-workflow/spec-decomposition/decomposition.md:344`. This citation grounds a Scope note about the decomposition's stale launcher contract; confirm the cited lines actually name `ANTHROPIC_MODEL` (it may sit at :346, which the citation groups but the lint check did not flag), or that the token should be dropped from the citation.
- Changes: the diff from the newest `docs(sdd): provider-per-role requirements v3` commit to the working tree follows as `## Changes since <short sha>`, cut at 500 lines. The v4 lint commit's diff follows as `## Lint commit <short sha>`.
- Read the Revision History line for v4 first and attack those changes before anything else. Round 2's MUST_FIX R2-1 (a fix-induced seam) was settled by placing the response-model contract at three points: Req 4 crit 4 (credential proof rests on `ANTHROPIC_API_KEY` absence), Req 6 crit 2 (preflight (a) records whether `message.model` equals the requested `--model`), and Req 7 crit 1 (asserts the preflight-recorded value). Stress-test that this three-point settlement is actually consistent and testable: does any surviving criterion still assume `message.model` is a fixed DeepSeek name? Does preflight (a)'s recorded value have a defined pass/fail rule, or is "records whether" a no-op that never blocks? Mark a finding that lands in text the round-2 delta wrote `Compounds: R2-<n>` (naming the round-2 finding whose fix wrote the clause) or a seam round 1/2 already raised `Compounds: R<k>-<n>`. Label each round-3 MUST_FIX `fix-induced` (a `Compounds` finding is fix-induced) or `carried`; the label is guidance and does not change the round budget.
- Fresh lens for this round: every cited artifact re-read at both ends of its range — the document cites decomposition.md, harness agent files, agent-profiles.json, the activity hook, SKILL.md and formats.md. Round 1 used wire-contracts, round 2 used a cold-read truth table; do not repeat them. Open each cited range and confirm the claim the sentence makes matches what the lines actually say, especially every citation the v4 lint commit touched.
- Closed by ruling, do not re-open: none. The approved Gate A decisions (Refuse never fall back; refused-at-start writes no ledger row; failed preflight blocks the spec; Anthropic total is the headline; provider-map location) are human-decided — attack their internal consistency, not their merits.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Rounds 1 and 2 rejected none. Re-raise a prior finding only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold above says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since ff63aeb

````diff
diff --git a/.spec-workflow/specs/provider-per-role/requirements.md b/.spec-workflow/specs/provider-per-role/requirements.md
index 92a036e..0365c0e 100644
--- a/.spec-workflow/specs/provider-per-role/requirements.md
+++ b/.spec-workflow/specs/provider-per-role/requirements.md
@@ -2,21 +2,21 @@
 
 ## Introduction
 
-This spec lets one SDD run send chosen roles to DeepSeek through a child `claude -p` process while every other role and the session stay on Anthropic, for the Max-plan-limited operator who wants the most-spawned role off it. It adds a `## Providers` section to `agent-rules.md`, a launcher the orchestrator calls instead of the Agent tool for that role, `provider` on the ledger, and provider-split totals in `harness usage` and the watch view.
+This spec sends chosen SDD roles to DeepSeek through a child `claude -p` process while every other role and the session stay on Anthropic. It adds a `## Providers` section to `agent-rules.md`, a launcher the orchestrator calls instead of the Agent tool, `provider` on the ledger, and provider-split totals in `harness usage` and the watch view.
 
 ## Alignment with Product Vision
 
-No `steering/product.md` exists in this store, so alignment is to the decomposition's harness operations preamble and the efficiency plan's first rule: tokens against the Max plan limit come first (`docs/harness-efficiency-plan.md:8-9`). Routing the reviewer, the most-spawned role, off Anthropic cuts that number without changing a skill's steps. The provider is a per-role, per-run fact the ledger records, so spec 9 renders it and spec 11 promotes its test author in one line.
+No `steering/product.md` exists here; alignment is to the decomposition's harness preamble and the efficiency plan's first rule: tokens against the Max plan limit come first (`docs/harness-efficiency-plan.md:8-9`). Routing the reviewer, the most-spawned role, off Anthropic cuts that number with no skill change. Provider is a per-role, per-run fact the ledger records: spec 9 renders it, spec 11 promotes its test author.
 
 ## Requirements
 
 ### Requirement 1 — Provider map in `agent-rules.md`
 
-**User Story:** As the harness operator, I want to name a provider per role in `agent-rules.md`, so that a role moves between Anthropic and DeepSeek with one line and no skill edit.
+**User Story:** As the harness operator, I want to name a provider per role in `agent-rules.md`, so a role moves between Anthropic and DeepSeek with one line, no skill edit.
 
 #### Acceptance Criteria
 
-1. THE spec store's `agent-rules.md` SHALL accept an optional `## Providers` section whose bullets read `- <agent>: <provider> <model>`: `<agent>` is a harness agent name (`sdd-reviewer`), `<provider>` is `anthropic` or `deepseek`, `<model>` is `deepseek-v4-pro` or `deepseek-flash` (required for `deepseek`, absent for `anthropic`). WHEN absent or naming no agent THEN every role SHALL run on Anthropic as today (D1).
+1. THE spec store's `agent-rules.md` SHALL accept an optional `## Providers` section whose bullets read `- <agent>: <provider> <model>`: `<agent>` is a harness agent name (`sdd-reviewer`), `<provider>` is `anthropic` or `deepseek`, `<model>` is `deepseek-v4-pro` or `deepseek-flash` (required for `deepseek`, absent for `anthropic`). WHEN absent or naming no agent THEN every role SHALL run on Anthropic (D1).
 2. THE eligible set for DeepSeek SHALL be `sdd-reviewer` and `sdd-checker` (file tools only: `harness/agents/sdd-reviewer.md:7-12`, `harness/agents/sdd-checker.md:7-12`), plus `sdd-reviser` after preflight (b) passes (Requirement 6 criterion 4); no other agent is eligible.
 3. WHEN the section names an agent outside the eligible set, an unknown provider, a `deepseek` row without a listed model, or the same agent twice THEN the supervisor SHALL stop before any ledger row is written and SHALL NOT run that role on Anthropic (D2, D5).
 4. THE supervisor SHALL read the section once, at the roots step locating `agent-rules.md` (`harness/skills/sdd-continue/SKILL.md:71-72`), and SHALL record the map on `run.start` (`harness/skills/sdd-continue/references/formats.md:186-198`) as `providers=<agent>:<provider>[:<model>],...` in section order, or `providers=none` if absent or empty (D4).
@@ -26,129 +26,130 @@ No `steering/product.md` exists in this store, so alignment is to the decomposit
 
 ### Requirement 2 — The launcher: a subprocess spawn path for a DeepSeek role
 
-**User Story:** As the document orchestrator, I want one command that runs a DeepSeek role with the same launch message and returns the same report, so that my steps before and after the spawn are unchanged.
+**User Story:** As the document orchestrator, I want one command that runs a DeepSeek role with the same launch message and report, so my steps before and after the spawn are unchanged.
 
 #### Acceptance Criteria
 
 1. WHEN the map names at least one DeepSeek row THEN the supervisor SHALL write `/tmp/scratchpad/sdd/<spec>/launch.sh` next to `event.sh` at run start (`harness/skills/sdd-continue/SKILL.md:76-86`), filled with the spec dir, run id, spec, harness-source path (`HARNESS_REPO`, `harness/skills/sdd-continue/SKILL.md:204`) and map, and pass its path as `LAUNCHER: <path>`; otherwise `LAUNCHER: none`.
 2. THE per-run file SHALL carry only run values and call a launcher body shipped with the harness under `harness/`, tested like the hook (`src/__tests__/hook-spawn-events.test.ts:13-41`) (D3).
-3. WHEN an orchestrator is about to spawn a DeepSeek-provider agent THEN it SHALL run `bash <LAUNCHER> <agent> "<launch message>"` with the exact launch message it would have given the Agent tool (for the reviewer, `Read and execute the instructions in <promptOutputPath>`, `harness/skills/sdd-document-phase/SKILL.md:160-161`), wait for it in the foreground, and take the worker's final report from stdout.
-4. WHEN `PROVIDERS` names a `deepseek` agent and `LAUNCHER` is `none` or the file is missing THEN the orchestrator SHALL report `PHASE: error` with the reason and SHALL NOT spawn that agent through the Agent tool (D2).
-5. THE launcher SHALL spawn `claude -p` (installed `2.1.278`; flags per `claude -p --help`) with: the launch message as the prompt; the agent's `--agents` definition, built from the agent file (frontmatter `tools`, `harness/agents/sdd-reviewer.md:7-12`; body as the agent prompt) and `harness/agent-profiles.json` (feeds the `--agents` JSON's ignored `model`/`effort` keys, `harness/agent-profiles.json:47-51`); `--model` set to the `claude-*` alias the endpoint maps to the requested DeepSeek model (`claude-opus-4-8`→`deepseek-v4-pro`, `claude-sonnet-5`→`deepseek-flash`, `.spec-workflow/spec-decomposition/decomposition.md:256-258`), never the DeepSeek name itself; only the agent's frontmatter tools; no MCP server (`--strict-mcp-config`, no `--mcp-config`) (D10).
+3. WHEN an orchestrator is about to spawn a DeepSeek-provider agent THEN it SHALL run `bash <LAUNCHER> <agent> "<launch message>"` with the exact launch message it would have given the Agent tool (for the reviewer, `Read and execute the instructions in <promptOutputPath>`, `harness/skills/sdd-document-phase/SKILL.md:160-161`), wait for it in the foreground, and take the worker's report from stdout.
+4. WHEN `PROVIDERS` names a `deepseek` agent and `LAUNCHER` is `none` or the file is missing THEN the orchestrator SHALL report `PHASE: error` and SHALL NOT spawn that agent through the Agent tool (D2).
+5. THE launcher SHALL spawn `claude -p` (`2.1.278`; flags per `claude -p --help`) with: the launch message as the prompt; the agent's `--agents` definition (agent-file frontmatter `tools`, `harness/agents/sdd-reviewer.md:7-12`; body as the prompt) and `harness/agent-profiles.json` (feeds the `--agents` JSON's `model`/`effort` keys, whose acceptance Requirement 6 criterion 5 preflights, expected ignored, `harness/agent-profiles.json:47-51`); `--model` set to the `claude-*` alias the endpoint maps to the requested model (`claude-opus-4-8`→`deepseek-v4-pro`, `claude-sonnet-5`→`deepseek-flash`, `.spec-workflow/spec-decomposition/decomposition.md:256-258`), never the DeepSeek name; only the agent's frontmatter tools; no MCP server (`--strict-mcp-config`, no `--mcp-config`) (D10).
 6. THE child's environment SHALL carry `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`, `ANTHROPIC_AUTH_TOKEN` set from `DEEPSEEK_API_KEY`, and `ANTHROPIC_MODEL` set to the same alias as criterion 5's `--model`; it SHALL NOT carry `ANTHROPIC_API_KEY` (Requirement 4 criterion 4).
-7. THE child SHALL never wait on a permission prompt (one that would block is denied, `--permission-prompts none`) and SHALL read the spec store and write under `reviews/` from the main-checkout cwd every eligible, document-phase role already runs in (worktree entry is implementation-only, `harness/skills/sdd-continue/SKILL.md:270-282`), so `--add-dir` is not needed.
-8. THE launcher SHALL exit 0 with the report on stdout when the child ends with a final message, and non-zero with one stderr line otherwise; the orchestrator's stall rule then applies unchanged (missing analysis file: spawn once more, then `PHASE: error`, `harness/skills/sdd-document-phase/SKILL.md:162-164`).
-9. THE orchestrator SHALL write `spawn.usage` after a launcher call exactly as after an Agent-tool call (`harness/skills/sdd-document-phase/SKILL.md:44-52`), and read the verdict block or `VERIFIED:` line from the analysis file as today; nothing after the spawn changes.
-10. THE agent file and skill that say spawn workers only with the Agent tool (`harness/agents/sdd-document-orchestrator.md:50`, `harness/skills/sdd-document-phase/SKILL.md:23-27`) SHALL say: with the Agent tool, or the launcher for a DeepSeek-provider agent; a `model` parameter is still never passed to the Agent tool.
+7. THE child SHALL never wait on a permission prompt (any blocking prompt is denied, `--permission-prompts none`) and SHALL read the spec store and write under `reviews/` from the main-checkout cwd every eligible, document-phase role runs in (worktree entry is implementation-only, `harness/skills/sdd-continue/SKILL.md:270-282`), so `--add-dir` is not needed.
+8. THE launcher SHALL exit 0 with the report on stdout when the child ends with a final message, and non-zero with one stderr line otherwise; the orchestrator's stall rule applies unchanged (missing analysis file: spawn once more, then `PHASE: error`, `harness/skills/sdd-document-phase/SKILL.md:162-164`).
+9. THE orchestrator SHALL write `spawn.usage` after a launcher call exactly as after an Agent-tool call (`harness/skills/sdd-document-phase/SKILL.md:44-52`), and read the verdict block or `VERIFIED:` line from the analysis file as today.
+10. THE agent file and skill that say spawn workers only with the Agent tool (`harness/agents/sdd-document-orchestrator.md:50`, `harness/skills/sdd-document-phase/SKILL.md:23-27`) SHALL say: with the Agent tool, or the launcher for a DeepSeek-provider agent; a `model` parameter is never passed to the Agent tool.
 11. THE DeepSeek worker SHALL receive the same launch message, the same tools and the same report contract (`harness/skills/sdd-continue/references/formats.md:123-135`) as an Agent-tool worker, so moving a role back is one line in `## Providers`.
 
 ### Requirement 3 — Ledger rows for a DeepSeek spawn
 
-**User Story:** As the operator watching a run, I want a DeepSeek spawn in the ledger with its provider, model and usage, so that the views tell the two providers apart.
+**User Story:** As the operator watching a run, I want a DeepSeek spawn in the ledger with its provider, model and usage, so the views tell the providers apart.
 
 #### Acceptance Criteria
 
-1. WHEN the launcher starts the child THEN it SHALL append spawn.start to harness-events.jsonl with `run`, `spec`, `agent`, `role` (agent name without `sdd-`; the value `spawn.usage` already uses, `.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:105`), `provider=deepseek`, `model=<requested DeepSeek name>` and `effort=not-applied` (D4, D11).
-2. WHEN the child exits THEN the launcher SHALL append `spawn.end` with `agent`, `provider=deepseek`, `model` (the child transcript's `message.model` values, joined with `+`) and `input`, `output`, `cacheWrite`, `cacheRead`, `tokens` summed over the transcript's assistant entries per the hook's rule (`harness/hooks/sdd-activity.sh:37-49`); a transcript it cannot find or parse SHALL yield `tokens=unknown` and no usage keys, never a missing row (`harness/hooks/sdd-activity.sh:114-123`).
-3. THE launcher SHALL locate the child's transcript deterministically (`--session-id <uuid>` and `~/.claude/projects/<cwd slug>/<session id>.jsonl` are the probed inputs), never as the newest file in a directory, and SHALL generate a fresh uuid per call so a role spawned across rounds never appends onto an earlier transcript.
-4. THE two rows SHALL be written through the run's event script (`harness/skills/sdd-continue/references/formats.md:163-182`), string values, the `run` and `spec` keys on every row, exactly one spawn.start and one spawn.end per call; the child's own hooks SHALL add nothing to the ledger or activity file (`harness/hooks/sdd-activity.sh:14-17` gates on an `sdd-` agent type; preflight proves it for the child, else the design disables hooks there).
-5. THE Anthropic spawn rows SHALL NOT change: no `provider` key is added to them, and a row without `provider` reads as `anthropic` in every consumer (Requirement 5).
+1. WHEN the launcher starts the child THEN it SHALL append spawn.start to harness-events.jsonl with `run`, `spec`, `agent`, `role` (agent name without `sdd-`; the value `spawn.usage` uses, `.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:105`), `provider=deepseek`, `model=<requested DeepSeek name>` and `effort=not-applied` (D4, D11).
+2. WHEN the child exits THEN the launcher SHALL append `spawn.end` with `agent`, `provider=deepseek`, `model` (the child transcript's `message.model` values, joined with `+`) and `input`, `output`, `cacheWrite`, `cacheRead`, `tokens` summed per the hook's rule (`harness/hooks/sdd-activity.sh:37-49`); a transcript it cannot find or parse SHALL yield `tokens=unknown` and no usage keys, never a missing row (`harness/hooks/sdd-activity.sh:114-123`).
+3. THE launcher SHALL locate the child's transcript deterministically (`--session-id <uuid>` and `~/.claude/projects/<cwd slug>/<session id>.jsonl` are the probed inputs), never as the newest file in a directory, and SHALL generate a fresh uuid per call so a role spawned across rounds never appends an earlier transcript.
+4. THE two rows SHALL be written through the run's event script (`harness/skills/sdd-continue/references/formats.md:163-182`), string values, the `run` and `spec` keys on every row, exactly one spawn.start and one spawn.end per call; the child's own hooks SHALL add nothing to the ledger or activity file (`harness/hooks/sdd-activity.sh:14-17` gates on `sdd-` agent type; preflight proves it for the child, else the design disables them).
+5. THE Anthropic spawn rows SHALL NOT change: no `provider` key is added, and a row without `provider` reads as `anthropic` in every consumer (Requirement 5).
 6. THE event table (`harness/skills/sdd-continue/references/formats.md:186-198`) SHALL list the launcher as a writer of `spawn.start` and `spawn.end`, the keys provider, `model` and effort, and providers on `run.start`.
 
 ### Requirement 4 — The key, and refusal without it
 
-**User Story:** As the operator, I want the DeepSeek key read from my environment only and a run that stops when it is missing, so that no key lands in the spec store and no role runs on the wrong provider by accident.
+**User Story:** As the operator, I want the DeepSeek key read only from my environment, and the run to stop when it's missing, so no key lands in the spec store and no role runs on the wrong provider by accident.
 
 #### Acceptance Criteria
 
 1. THE key SHALL be `DEEPSEEK_API_KEY` in the run-starting process's environment (terminal or dashboard), never read from the spec store, a run file, `agent-rules.md` or a launch prompt.
 2. WHEN the map names a `deepseek` role and `DEEPSEEK_API_KEY` is unset or empty THEN the supervisor SHALL stop before any ledger row is written, spawning no orchestrator (D5).
 3. THE launcher SHALL also refuse (non-zero, one stderr line, no `spawn.start`) when called with the key unset, so a stale launcher cannot run on a missing key.
-4. THE key SHALL NOT appear in the launcher text, any ledger or activity row, HANDOFF, the retro log, `questions.md`, a brief, or a commit; the child's environment SHALL NOT carry `ANTHROPIC_API_KEY`; and preflight (a) SHALL show the session's Anthropic credential was not used (the child's transcript `message.model` is a DeepSeek name).
+4. THE key SHALL NOT appear in the launcher text, any ledger or activity row, HANDOFF, the retro log, `questions.md`, a brief, or a commit; the child's environment SHALL NOT carry `ANTHROPIC_API_KEY`; preflight (a) SHALL show the session's Anthropic credential was not used via that absence, not via `message.model`, which Requirement 6 criterion 2 measures instead.
 5. WHEN the key is set THEN the run SHALL NOT print it, and the watch view and `harness usage` SHALL NOT read it.
 
 ### Requirement 5 — Accounting by provider
 
-**User Story:** As the operator judging the saving, I want `harness usage` and the watch view to show DeepSeek tokens apart from the Anthropic total, so that the number the Max plan limit applies to stays honest.
+**User Story:** As the operator judging the saving, I want `harness usage` and the watch view to show DeepSeek tokens apart from the Anthropic total, so the Max plan limit's number stays honest.
 
 #### Acceptance Criteria
 
 1. THE usage fold (`src/watch/usage.ts:76-216`) SHALL take a spawn's provider from the provider key of its `spawn.end`, else its `spawn.start`, else anthropic.
-2. THE report (`src/watch/usage.ts:13-23`) SHALL add per-provider cells (`spawns`, `tokens`, `unknown`) at the spec level and per phase; the existing `total` and `kinds` fields SHALL keep their all-provider meaning and values (D6).
+2. THE report (`src/watch/usage.ts:13-23`) SHALL add per-provider cells (`spawns`, `tokens`, `unknown`) at the spec level and per phase; the existing `total` and `kinds` fields SHALL keep their all-provider values (D6).
 3. WHEN the table is printed (`src/watch/usage.ts:253-298`) THEN each agent row SHALL name its provider when not anthropic, and each phase total line and the spec total line SHALL print `anthropic <tokens>` and `deepseek <tokens>` beside the existing figures; compare mode SHALL carry the same columns for both specs.
 4. WHEN `harness usage` runs on a ledger with no provider key (`src/__tests__/fixtures/usage-ledger.jsonl:1-20`, `question-gates`) THEN every existing figure SHALL be unchanged, the deepseek figures SHALL read 0, and data.report SHALL carry the provider cells.
-5. THE watch model (`src/watch/ledger.ts:94-114`, `src/watch/ledger.ts:142-163`) SHALL carry provider per spawn node and tokens by provider on the run; the header (`src/watch/render.ts:67-79`) SHALL print `tokens <Anthropic total>` and, when DeepSeek tokens exist, `deepseek <total>` after it; the tier line (`src/watch/render.ts:204-211`) SHALL print the provider before the model for a non-Anthropic spawn; the `!=` mark fires as today.
+5. THE watch model (`src/watch/ledger.ts:94-114`, `src/watch/ledger.ts:142-163`) SHALL carry provider per spawn node and tokens by provider on the run; the header (`src/watch/render.ts:67-79`) SHALL print `tokens <Anthropic total>` and, when DeepSeek tokens exist, `deepseek <total>` after it; the tier line (`src/watch/render.ts:204-211`) SHALL print the provider before the model for a non-Anthropic spawn; the `!=` mark fires unchanged.
 6. WHEN `--watch --once` runs on the `review-gate` ledger THEN it SHALL render every token total it renders today (the spec 8 regression, kept).
 7. WHEN `run.start` carries a `providers` value other than `none` THEN the watch view SHALL show it.
 8. THE docs (`docs/TOOLS-REFERENCE.md:574-577`, `docs/SDD-HARNESS.md:330-333`) SHALL say the usage is split by provider and the Anthropic figure is the Max plan number.
 
 ### Requirement 6 — Preflight recorded in `docs/`
 
-**User Story:** As the operator, I want the DeepSeek facts this spec depends on proven once and written down, so that the launcher is built on tested behaviour and the reviser's eligibility is a recorded answer.
+**User Story:** As the operator, I want the DeepSeek facts this spec depends on proven once and written down, so the launcher is built on tested behaviour and the reviser's eligibility is recorded.
 
 #### Acceptance Criteria
 
 1. THE first task of the spec SHALL be the preflight, and its outcomes SHALL be written to `docs/deepseek-preflight.md` in the step-0 answer format (`docs/step-0-answers.md:1-17`): date, source, a summary table, one section per question with the evidence (D7).
-2. THE preflight SHALL run (a): `claude -p` against DeepSeek with the reviewer's definition, `--model deepseek-v4-pro` and the environment of Requirement 2 criterion 6, on a fixture spec document with a review prompt built as the round section is (`harness/skills/sdd-document-phase/references/briefs.md:125-176`); it passes WHEN the analysis file exists in that format and ends with the verdict block (`harness/skills/sdd-continue/references/formats.md:5-17`); the record SHALL include message.model and the usage sums.
-3. THE preflight SHALL run (b): the same with the reviser's definition, one `--mcp-config` for the spec-workflow server, and a prompt making one `adversarial-response` call (`harness/skills/sdd-document-phase/references/briefs.md:225`); the record SHALL say whether the call was made and answered, and on failure whether the refusal came from the API connector or Claude Code's client tools.
-4. IF (b) shows the MCP call answered THEN `sdd-reviser` SHALL join the eligible set (Requirement 1 criterion 2); IF not THEN it SHALL stay on Anthropic, and no other role SHALL be promoted here.
-5. THE preflight SHALL also record, one line of evidence each: whether `ANTHROPIC_AUTH_TOKEN` alone authenticates the child (no `ANTHROPIC_API_KEY`, no OAuth); whether `--agents` accepts `tools` and `model` keys; where the child's transcript lands and whether `--session-id` fixes its name; whether user hooks fire in the child and write to the run's files; and whether declared `effort` reaches DeepSeek (expected ignored, per the decomposition preamble) (D7).
+2. THE preflight SHALL run (a): `claude -p` against DeepSeek with the reviewer's definition, `--model deepseek-v4-pro` and the environment of Requirement 2 criterion 6, on a fixture document, a review prompt built as the round section is (`harness/skills/sdd-document-phase/references/briefs.md:125-176`); it passes WHEN the analysis file exists in that format and ends with the verdict block (`harness/skills/sdd-continue/references/formats.md:5-17`); the record SHALL state whether `message.model` (`harness/skills/sdd-continue/SKILL.md:226-234`) equals the requested `--model` value, and the usage sums.
+3. THE preflight SHALL run (b): the same with the reviser's definition, one `--mcp-config` for the spec-workflow server, and a prompt making one `adversarial-response` call (`harness/skills/sdd-document-phase/references/briefs.md:225`); the record SHALL say whether the call was made and answered, and on failure whether the API connector or Claude Code's client tools refused.
+4. IF (b) shows the MCP call answered THEN `sdd-reviser` SHALL join the eligible set (Requirement 1 criterion 2); IF not THEN it SHALL stay on Anthropic, and no other role SHALL be promoted.
+5. THE preflight SHALL also record, one line each: whether `ANTHROPIC_AUTH_TOKEN` alone authenticates the child (no `ANTHROPIC_API_KEY`, no OAuth); whether `--agents` accepts `tools` and `model` keys; where the child's transcript lands and whether `--session-id` fixes its name; whether user hooks fire in the child and write to the run's files; and whether `effort` reaches DeepSeek (expected ignored, decomposition preamble) (D7).
 6. IF (a) fails THEN the preflight task SHALL record it and the implementation orchestrator SHALL report `PHASE: escalate` with the reason; no later task of this spec SHALL run until a human rules (D8).
 7. IF `DEEPSEEK_API_KEY` is unset when the preflight runs THEN the task SHALL report the missing key and stop; it SHALL NOT record a fabricated outcome.
 
 ### Requirement 7 — End-to-end verification and regression
 
-**User Story:** As the operator, I want the decomposition's six scenarios runnable as written, so that the spec is judged on its ledger, not on a report.
+**User Story:** As the operator, I want the decomposition's six scenarios runnable as written, so the spec is judged on its ledger, not a report.
 
 #### Acceptance Criteria
 
-1. WHEN a fixture requirements round runs with `sdd-reviewer` on `deepseek-v4-pro` THEN the analysis file SHALL exist in the round's format with a verdict block; the ledger SHALL hold its `spawn.start` and `spawn.end` with `provider=deepseek`, a DeepSeek model name and digit-string usage; the reviser round that follows SHALL run on Anthropic through the Agent tool with today's hook-written rows.
+1. WHEN a fixture requirements round runs with `sdd-reviewer` on `deepseek-v4-pro` THEN the analysis file SHALL exist in the round's format with a verdict block; the ledger SHALL hold its `spawn.start` and `spawn.end` with `provider=deepseek`, `model` matching what preflight (a) recorded, and digit-string usage; the following reviser round SHALL run on Anthropic through the Agent tool with today's hook-written rows.
 2. WHEN the same round runs with every role on `anthropic` THEN the ledger SHALL have today's shape: no `provider` key on any spawn row, `run.start` gaining only `providers`.
-3. WHEN `DEEPSEEK_API_KEY` is unset and the map names one `deepseek` role THEN the run SHALL stop as Requirement 4 criterion 2 says, writing no ledger row; `--watch --once` SHALL show no entry for that run (spec 9's page is not built; Scope notes).
+3. WHEN `DEEPSEEK_API_KEY` is unset and the map names one `deepseek` role THEN the run SHALL stop per Requirement 4 criterion 2, writing no ledger row; `--watch --once` SHALL show no entry for that run (spec 9's page is not built; Scope notes).
 4. WHEN `harness usage` runs on the ledger of criterion 1 THEN it SHALL report the reviewer's tokens under `deepseek` and an Anthropic total that excludes them.
 5. THE checks SHALL pass: `npm test`, `npx tsc --noEmit`, `claude plugin validate . --strict`, `npm run check:plugin-assets`; a launcher test SHALL assert only on `child_process` and `fs` fields the node 20 docs guarantee (`.spec-workflow/agent-rules.md:30-32`).
 
 ## Non-Functional Requirements
 
 ### Performance
-- An Anthropic spawn SHALL cost nothing new: no launcher call, no extra ledger row, and the hook's early exit (`harness/hooks/sdd-activity.sh:11-17`) unchanged.
+- An Anthropic spawn SHALL cost nothing new: no launcher call, no extra ledger row, hook early exit (`harness/hooks/sdd-activity.sh:11-17`) unchanged.
 - `harness usage` and the watch view SHALL stay synchronous folds of two files; no network call.
 
 ### Security
-- Requirement 4 holds for every file the run commits. `harness/hooks/` is a sensitive path (`.spec-workflow/agent-rules.md:61-70`); the design says where the launcher body goes.
-- The child SHALL have the eligible role's file tools only and no MCP server, so it cannot write approvals, deferrals or the spec store.
+- Requirement 4 holds for every file the run commits; `harness/hooks/` is a sensitive path (`.spec-workflow/agent-rules.md:61-70`) and the design says where the launcher body goes.
+- The child SHALL have the eligible role's file tools only, no MCP server, so it cannot write approvals, deferrals or the spec store.
 
 ### Reliability
 - A DeepSeek spawn SHALL always leave a `spawn.end`; `unknown` beats a wrong number (spec 8 rule).
-- Refusal beats a silent fallback: a missing key, launcher or bad map row stops the run; a start refusal writes no ledger row.
-- The session running the harness SHALL never have its provider changed; only the child carries the DeepSeek environment.
+- Refusal beats a silent fallback: a missing key or bad map row stops the run at the roots step, no ledger row (D5); a missing launcher is mid-run `PHASE: error`, rows already written (Req 2 crit 4).
+- The harness session SHALL never have its provider changed; only the child carries the DeepSeek environment.
 
 ### Compatibility
-- Old ledgers render and fold unchanged. CI runs node 20 (`.spec-workflow/agent-rules.md:30-32`); `plugins/` copies regenerate via `scripts/sync-plugin-assets.cjs`, and `harness/agent-profiles.json` keeps its shape.
+- Old ledgers render and fold unchanged; CI runs node 20 (`.spec-workflow/agent-rules.md:30-32`), `plugins/` regenerate via `scripts/sync-plugin-assets.cjs`, and `harness/agent-profiles.json` keeps its shape.
 
 ## Decisions taken in this document
 
-- D1 — Map shape: a Providers section in agent-rules, one bullet per agent naming provider and model; matches the four machine-read sections already there, and frontmatter is shared by every run and project.
-- D2 — A bad map row, an ineligible role or a missing key refuses the run before any ledger row is written (D5); a missing launcher, found only when an orchestrator is about to spawn a DeepSeek agent, is that orchestrator's `PHASE: error` (Req 2 crit 4), not a start refusal; the decomposition rules out a silent fallback, and a wrong provider spends the Max plan without saying so.
-- D3 — The launcher is a per-run wrapper next to the event script, calling a body shipped with the harness and tested like the hook; real logic needs a test, and the wrapper keeps the decomposition's contract of a file next to the event script.
-- D4 — Ledger keys: provider, model and effort on spawn start; provider, model and the six usage keys on spawn end; run start carries the whole map; both folds already read those rows, and the map on run start is what spec 9 renders.
-- D5 — A run refused at start (missing key or bad map row) writes no ledger row and spawns nothing; the map and key checks complete at the roots step (`harness/skills/sdd-continue/SKILL.md:71-72`), before the run id, `event.sh`, the pointer-file line and `run.start` are written (`harness/skills/sdd-continue/SKILL.md:76-86`); a run that never reaches a task should not appear in the ledger.
-- D6 — The Anthropic figure is the headline tokens number, DeepSeek shown beside it; existing all-provider totals keep their values; the Max plan number must be what the eye lands on, and no existing test assertion changes.
-- D7 — The preflight file is a new docs file in the step-0 answer format, carrying five extra probes (auth path, agents JSON keys, transcript location, child hooks, effort); the step-0 file is closed and says do not re-run, and these are the facts the launcher is built on.
-- D8 — A failed preflight (a) escalates and blocks the rest of the spec; every other deliverable exists to serve the DeepSeek path.
-- D9 — The launch prompt carries the map and the launcher path; the supervisor is the single reader of run configuration, and skills never parse it twice.
-- D10 — The child gets the agent's frontmatter tools only, no MCP server; the eligible roles are file-tools-only by definition, and the spec store keeps one writer.
-- D11 — The role value on a launcher spawn start is the agent name without its prefix; the reviewer and checker are prompt-launched, and the orchestrator's usage row already uses that value, so the watch view joins on the same label.
+- D1 — Map shape: a Providers section in agent-rules, one bullet per agent naming provider and model; matches the four machine-read sections already there, shared frontmatter for every run and project.
+- D2 — A bad map row, an ineligible role or a missing key refuses the run before any ledger row is written (D5); a missing launcher, found only when spawning a DeepSeek agent, is the orchestrator's `PHASE: error` (Req 2 crit 4), not a start refusal — no silent fallback (decomposition); a wrong provider would spend the Max plan unannounced.
+- D3 — The launcher is a per-run wrapper next to the event script, calling a body shipped with the harness, tested like the hook; real logic needs a test, keeping the decomposition's file-next-to-event-script contract.
+- D4 — Ledger keys: provider, model, effort on spawn start; provider, model, six usage keys on spawn end; run start carries the whole map; both folds read those rows, and spec 9 renders the map.
+- D5 — A run refused at start (missing key or bad map row) writes no ledger row and spawns nothing; map and key checks complete at the roots step (`harness/skills/sdd-continue/SKILL.md:71-72`), before run id, `event.sh`, pointer-file line and `run.start` are written (`harness/skills/sdd-continue/SKILL.md:76-86`); a run reaching no task should not appear in the ledger.
+- D6 — The Anthropic figure is the headline tokens number, DeepSeek shown beside it; existing all-provider totals keep their values, and no test assertion changes.
+- D7 — The preflight file is a new docs file in the step-0 answer format, carrying five extra probes (auth path, agents JSON keys, transcript location, child hooks, effort); the step-0 file is closed (do not re-run), and these are the launcher's build facts.
+- D8 — A failed preflight (a) escalates and blocks the spec; every other deliverable serves the DeepSeek path.
+- D9 — The launch prompt carries the map and launcher path; the supervisor is the single reader of run configuration, and skills never parse it twice.
+- D10 — The child gets the agent's frontmatter tools only, no MCP server; eligible roles are file-tools-only, and the spec store keeps one writer.
+- D11 — The role value on a launcher spawn start is the agent name without its prefix; reviewer and checker are prompt-launched, and the orchestrator's usage row uses that value, so the watch view joins on the same label.
 
 ## Scope notes
 
-- The spec 9 per-run override (`harness-run.json`) is deferred to spec 9 as the entry says; this spec fixes the map value format spec 9 pre-fills.
-- Verification (4) names "the page"; that is spec 9's control pane, not built yet. Here the check is the TUI (`--watch --once`).
+- Spec 9's per-run override (`harness-run.json`) is deferred; this spec fixes the map value format spec 9 pre-fills.
+- Verification (4) names "the page" — spec 9's control pane, unbuilt; here the check is the TUI (`--watch --once`).
 - Only the reviewer and checker are promoted; the reviser only on a passed preflight (b); no other role.
-- Decomposition scenario 4 (`.spec-workflow/spec-decomposition/decomposition.md:383-384`) still reads "with a `note`"; Gate A (RI-1) revised that to no ledger row (D5). Req 7's "as written" means the outcome, not that superseded wording.
-- Not fixed here: a prompt-launched Anthropic reviewer or checker still gets no hook `spawn.start` (`harness/hooks/sdd-activity.sh:106-113`; live rows `.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:104-105`), so both folds drop its `spawn.end` usage (`src/watch/usage.ts:93-100`, `src/watch/ledger.ts:276-288`); the launcher writes both rows, so DeepSeek is unaffected. Flagged for the retro.
-- `steering/product.md` does not exist; alignment is written to the decomposition preamble and the efficiency plan.
-- DeepSeek endpoint facts (model mapping, `budget_tokens` ignored, MCP tools unsupported) are taken from the decomposition preamble's settled list and not re-probed; the preflight measures behaviour, not the docs.
+- Decomposition scenario 4 (`.spec-workflow/spec-decomposition/decomposition.md:383-384`) still reads "with a `note`"; Gate A (RI-1) revised that to no ledger row (D5); Req 7's "as written" means the outcome, not that superseded wording.
+- `.spec-workflow/spec-decomposition/decomposition.md:371-373` still reads "refuses at `run.start` with a `note`", and `.spec-workflow/spec-decomposition/decomposition.md:344,346` still read "`--model` the DeepSeek name" / "`ANTHROPIC_MODEL` set to the same name" — both superseded (D5; Req 2 crit 5/6, R1-2), recorded here not re-decided, like scenario 4.
+- Not fixed here: a prompt-launched Anthropic reviewer or checker gets no hook `spawn.start` (`harness/hooks/sdd-activity.sh:106-113`; live rows `.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:104-105`), so both folds drop its `spawn.end` usage (`src/watch/usage.ts:93-100`, `src/watch/ledger.ts:276-288`); the launcher writes both rows; DeepSeek is unaffected. Flagged for the retro.
+- No `steering/product.md`; alignment is written to the decomposition preamble and efficiency plan.
+- DeepSeek endpoint facts (model mapping, `budget_tokens` ignored, MCP tools unsupported) come from the decomposition preamble's settled list, not re-probed; the preflight measures behaviour, not the docs.
 
 ## Revision History
 
@@ -166,3 +167,9 @@ No `steering/product.md` exists in this store, so alignment is to the decomposit
   - **R1-7 — Accepted (SHOULD_FIX).** Req 2 crit 5's `agent-profiles.json` rationale now says it feeds `--agents`' ignored `model`/`effort` keys, not the ledger.
   - **M1 — Accepted (MINOR).** Req 3 crit 3 now requires a fresh `--session-id` per launcher call.
   - **M2 — Accepted (MINOR).** No text change: Req 1 crit 6 already requires the fifth machine-read line; the docs count-word edit is implementation-phase follow-through.
+- **v4** (2026-09-22) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/2).
+  - **R2-1 — Accepted (MUST_FIX).** Req 4 crit 4 now rests on `ANTHROPIC_API_KEY` absence; Req 6 crit 2 makes `message.model` a preflight-measured fact; Req 7 crit 1 asserts that recorded value, not an assumed DeepSeek name.
+  - **R2-2 — Accepted (SHOULD_FIX).** Req 2 crit 5 makes `--agents` key acceptance contingent on Req 6 crit 5's preflight, not settled.
+  - **R2-3 — Accepted (MINOR).** Scope notes record `decomposition.md:344,346,371-373`'s stale launcher and refusal wording, as R1-4 did for scenario 4.
+  - **R2-4 — Accepted (MINOR).** Reliability NFR separates the missing-launcher `PHASE: error` case from no-row start refusals.
+  - **Lint pass.** 2 fixed; rejected: none.
````

## Lint commit e5a275c

````diff
diff --git a/.spec-workflow/specs/provider-per-role/requirements.md b/.spec-workflow/specs/provider-per-role/requirements.md
index ae88318..0365c0e 100644
--- a/.spec-workflow/specs/provider-per-role/requirements.md
+++ b/.spec-workflow/specs/provider-per-role/requirements.md
@@ -89,7 +89,7 @@ No `steering/product.md` exists here; alignment is to the decomposition's harnes
 #### Acceptance Criteria
 
 1. THE first task of the spec SHALL be the preflight, and its outcomes SHALL be written to `docs/deepseek-preflight.md` in the step-0 answer format (`docs/step-0-answers.md:1-17`): date, source, a summary table, one section per question with the evidence (D7).
-2. THE preflight SHALL run (a): `claude -p` against DeepSeek with the reviewer's definition, `--model deepseek-v4-pro` and the environment of Requirement 2 criterion 6, on a fixture document, a review prompt built as the round section is (`harness/skills/sdd-document-phase/references/briefs.md:125-176`); it passes WHEN the analysis file exists in that format and ends with the verdict block (`harness/skills/sdd-continue/references/formats.md:5-17`); the record SHALL state whether `message.model` equals the requested `--model` value, and the usage sums.
+2. THE preflight SHALL run (a): `claude -p` against DeepSeek with the reviewer's definition, `--model deepseek-v4-pro` and the environment of Requirement 2 criterion 6, on a fixture document, a review prompt built as the round section is (`harness/skills/sdd-document-phase/references/briefs.md:125-176`); it passes WHEN the analysis file exists in that format and ends with the verdict block (`harness/skills/sdd-continue/references/formats.md:5-17`); the record SHALL state whether `message.model` (`harness/skills/sdd-continue/SKILL.md:226-234`) equals the requested `--model` value, and the usage sums.
 3. THE preflight SHALL run (b): the same with the reviser's definition, one `--mcp-config` for the spec-workflow server, and a prompt making one `adversarial-response` call (`harness/skills/sdd-document-phase/references/briefs.md:225`); the record SHALL say whether the call was made and answered, and on failure whether the API connector or Claude Code's client tools refused.
 4. IF (b) shows the MCP call answered THEN `sdd-reviser` SHALL join the eligible set (Requirement 1 criterion 2); IF not THEN it SHALL stay on Anthropic, and no other role SHALL be promoted.
 5. THE preflight SHALL also record, one line each: whether `ANTHROPIC_AUTH_TOKEN` alone authenticates the child (no `ANTHROPIC_API_KEY`, no OAuth); whether `--agents` accepts `tools` and `model` keys; where the child's transcript lands and whether `--session-id` fixes its name; whether user hooks fire in the child and write to the run's files; and whether `effort` reaches DeepSeek (expected ignored, decomposition preamble) (D7).
@@ -146,7 +146,7 @@ No `steering/product.md` exists here; alignment is to the decomposition's harnes
 - Verification (4) names "the page" — spec 9's control pane, unbuilt; here the check is the TUI (`--watch --once`).
 - Only the reviewer and checker are promoted; the reviser only on a passed preflight (b); no other role.
 - Decomposition scenario 4 (`.spec-workflow/spec-decomposition/decomposition.md:383-384`) still reads "with a `note`"; Gate A (RI-1) revised that to no ledger row (D5); Req 7's "as written" means the outcome, not that superseded wording.
-- `decomposition.md:371-373` still reads "refuses at `run.start` with a `note`", and `344,346` still read "`--model` the DeepSeek name" / "`ANTHROPIC_MODEL` set to the same name" — both superseded (D5; Req 2 crit 5/6, R1-2), recorded here not re-decided, like scenario 4.
+- `.spec-workflow/spec-decomposition/decomposition.md:371-373` still reads "refuses at `run.start` with a `note`", and `.spec-workflow/spec-decomposition/decomposition.md:344,346` still read "`--model` the DeepSeek name" / "`ANTHROPIC_MODEL` set to the same name" — both superseded (D5; Req 2 crit 5/6, R1-2), recorded here not re-decided, like scenario 4.
 - Not fixed here: a prompt-launched Anthropic reviewer or checker gets no hook `spawn.start` (`harness/hooks/sdd-activity.sh:106-113`; live rows `.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:104-105`), so both folds drop its `spawn.end` usage (`src/watch/usage.ts:93-100`, `src/watch/ledger.ts:276-288`); the launcher writes both rows; DeepSeek is unaffected. Flagged for the retro.
 - No `steering/product.md`; alignment is written to the decomposition preamble and efficiency plan.
 - DeepSeek endpoint facts (model mapping, `budget_tokens` ignored, MCP tools unsupported) come from the decomposition preamble's settled list, not re-probed; the preflight measures behaviour, not the docs.
@@ -172,3 +172,4 @@ No `steering/product.md` exists here; alignment is to the decomposition's harnes
   - **R2-2 — Accepted (SHOULD_FIX).** Req 2 crit 5 makes `--agents` key acceptance contingent on Req 6 crit 5's preflight, not settled.
   - **R2-3 — Accepted (MINOR).** Scope notes record `decomposition.md:344,346,371-373`'s stale launcher and refusal wording, as R1-4 did for scenario 4.
   - **R2-4 — Accepted (MINOR).** Reliability NFR separates the missing-launcher `PHASE: error` case from no-row start refusals.
+  - **Lint pass.** 2 fixed; rejected: none.
````
