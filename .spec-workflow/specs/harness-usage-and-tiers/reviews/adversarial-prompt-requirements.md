# Adversarial Review — harness-usage-and-tiers/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open after the lint pass (error = MUST_FIX candidate, warning = your call, info = a note); most are `citation-identifier` warnings the lint pass rejected as forward-looking (`usage`/`gate`/`SHALL gain` fields the document says do not exist yet) or as tokens belonging to a different clause than the cited line — judge whether that rejection rationale holds:
  - L-1..L-5 (warning, citation-identifier, line 5): identifiers `jsonl`, `tokens`, `unknown`, `usage`, `harness` absent from `src/watch/ledger.ts:41-53`.
  - L-6 (warning, citation-identifier, line 25): `jsonl` absent from `harness/hooks/sdd-activity.sh:63-65, :69`.
  - L-7 (warning, citation-identifier, line 26): `transcript_path` absent from `src/__tests__/hook-spawn-events.test.ts:110-116`.
  - L-8..L-9 (warning, citation-identifier, line 37): `usage`, `result` absent from `harness/skills/sdd-continue/SKILL.md:213-214, harness/hooks/sdd-activity.sh:78`.
  - L-10..L-11 (warning, citation-identifier, line 38): `start`, `usage` absent from `harness/skills/sdd-retrospective/SKILL.md:79-87`.
  - L-12..L-16 (warning, citation-identifier, line 60): `model`, `input`, `output`, `cacheWrite`, `cacheRead` absent from `src/watch/ledger.ts:63-78, :240-247`.
  - L-17 (warning, citation-identifier, line 73): `usage` absent from `src/tools/harness.ts:27-101, :46, :109-120, :673-683`.
  - L-18..L-22 (warning, citation-identifier, line 74): `specName`, `input`, `output`, `cacheWrite`, `cacheRead` absent from `src/watch/render.ts:60, src/watch/ledger.ts:238`.
  - L-23 (warning, citation-identifier, line 77): `buildModel` absent from `src/watch/ledger.ts:200-202, :241`.
  - L-24..L-25 (warning, citation-identifier, line 82): `usage`, `gate` absent from `docs/TOOLS-REFERENCE.md:547-570`.
  - L-26 (warning, citation-identifier, line 90): `xhigh` absent from `harness/agents/sdd-document-orchestrator.md:4-5`.
  - L-27 (warning, citation-identifier, line 102): `usage` absent from `src/watch/ledger.ts:271`.
  - L-28..L-29 (warning, citation-identifier, line 117): `usage`, `safeJoin` absent from `harness/hooks/sdd-activity.sh:19-31`.
  - L-30..L-32 (warning, citation-identifier, line 125): `usage`, `role`, `result` absent from `src/watch/ledger.ts:241`.
  - L-33 (error, citation-path, line 128): cited path `tsconfig.json` has no directory prefix — the lint pass rejected this as "already at the code root; no prefix needed". Verify whether the approval lint will accept it.
  - L-34..L-35 (warning, citation-identifier, line 141): `usage`, `note` absent from `docs/harness-efficiency-plan.md:164-167`.
  - L-36..L-37 (info, citation-bare, line 150): bare ranges `:83` and `:83-85` have no earlier path citation in their block.
- Changes: the diff from the `docs(sdd): harness-usage-and-tiers requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `harness-usage-and-tiers` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fresh lens for this round: wire contracts across a boundary (the JSONL ledger event shape written by the hook and by orchestrators, the `harness` tool's action/parameter contract, the watch-view render inputs, and the transcript fields the usage extraction reads) — the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 408cae8

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
index 286b1be..4a686e8 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
@@ -16,14 +16,14 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 
 #### Acceptance Criteria
 
-1. WHEN `SubagentStop` fires for an agent whose type matches `(^|:)sdd-` (`harness/hooks/sdd-activity.sh:37`) AND the active-run pointer resolves (`:11-27`) THEN the hook SHALL append one `spawn.end` row carrying `ts`, `type`, `run`, `spec`, `agent` and the keys of criterion 2 — for every `sdd-*` agent, orchestrators included (`:83` skips names ending `-orchestrator` today).
+1. WHEN `SubagentStop` fires for an agent whose type matches `(^|:)sdd-` (`harness/hooks/sdd-activity.sh:37`) AND the active-run pointer resolves (`:11-27`) THEN the hook SHALL append one `spawn.end` row carrying `ts`, `type`, `run`, `spec`, `agent` and the keys of criterion 2 — for every `sdd-*` agent, orchestrators included (`:83-85` skips names ending `-orchestrator` today).
 2. WHEN the hook input carries `transcript_path` AND the file parses THEN the row SHALL carry `input`, `output`, `cacheWrite`, `cacheRead` as the sums of `message.usage.input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` over the transcript's entries with `type` `assistant` and a `message.usage` object; `tokens` as the sum of those four; and `model` as the distinct `message.model` values seen, first-seen order, joined with `+` (D3).
-3. Numeric values SHALL be written as JSON strings of decimal digits, the `LedgerEvent` value type (`src/watch/ledger.ts:14-20`); `buildModel` already coerces `tokens` with `Number` (`:245`).
+3. Numeric values SHALL be written as JSON strings of decimal digits, the `LedgerEvent` value type (`src/watch/ledger.ts:14-20`); `buildModel` (`src/watch/ledger.ts:188`) already coerces `tokens` with `Number` (`:245`).
 4. IF `transcript_path` is absent, the file is unreadable, or no assistant entry carries `message.usage` THEN the row SHALL still be written, with `tokens=unknown` and without `input`, `output`, `cacheWrite`, `cacheRead`, `model` — never a missing row.
-5. A transcript line that is not JSON SHALL be skipped, as `parseJsonl` skips a torn tail (`:129-142`).
+5. A transcript line that is not JSON SHALL be skipped, as `parseJsonl` skips a torn tail (`src/watch/ledger.ts:129-142`).
 6. The hook SHALL exit 0 in every path and finish inside the 5-second `timeout` of `harness/hooks/hooks.json` for a 2 MB transcript (probe: 1.87 MB, 586 lines, 240 assistant entries, parsed in 16.7 ms on node 24.13.0); no parse failure SHALL delay or block the agent's stop.
-7. The `agent.stop` line in `harness-activity.jsonl` (`sdd-activity.sh:63-65`, `:69`) SHALL keep its shape and MAY carry the same `tokens`.
-8. `src/__tests__/hook-spawn-events.test.ts` SHALL drive the real script with a fixture transcript and a `SubagentStop` payload carrying `transcript_path`, and assert each sum against a value the test computes on its own; the case at `:110-116` (no `spawn.end` for an orchestrator) SHALL invert.
+7. The `agent.stop` line in `harness-activity.jsonl` (`harness/hooks/sdd-activity.sh:63-65`, `:69`) SHALL keep its shape and MAY carry the same `tokens`.
+8. `src/__tests__/hook-spawn-events.test.ts` SHALL drive the real script with a fixture transcript and a `SubagentStop` payload carrying `transcript_path`, and assert each sum against a value the test computes on its own; the case at `src/__tests__/hook-spawn-events.test.ts:110-116` (no `spawn.end` for an orchestrator) SHALL invert.
 9. The only per-spawn token writer SHALL be this hook: no skill, agent or script writes `tokens` on any ledger row after this spec.
 
 ### Requirement 2 — Orchestrators and the supervisor stop transcribing the footer
@@ -33,10 +33,10 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 #### Acceptance Criteria
 
 1. The orchestrator's `spawn.usage` row SHALL keep `agent`, `role`, `result`, `phase`, and `task` or `round`, and SHALL NOT carry `tokens`.
-2. Every passage that tells an orchestrator to take `tokens=<n>` from the Agent result SHALL be rewritten to drop it: `harness/skills/sdd-document-phase/SKILL.md:46-48`, `:114-116`, `:144`; `sdd-implementation-phase/SKILL.md:53-57`; `sdd-closeout-phase/SKILL.md:46-49`; `sdd-retrospective/SKILL.md:33-39`; `sdd-continue/SKILL.md:213-216`; the `spawn.end` and `spawn.usage` rows of the event table, `sdd-continue/references/formats.md:193-194`; and the supervisor note at `:200-201`. The command that finds every member: `grep -rn "footer\|tokens=" harness/skills`.
-3. The supervisor SHALL keep writing `spawn.start` for each orchestrator (`sdd-continue/SKILL.md:213-214`; the hook derives `spawn.start` from a brief path, `sdd-activity.sh:78`, and an orchestrator launch has none) and SHALL write `spawn.usage` (`agent`, `role`, `result`) after the report in place of `spawn.end` (D1).
-4. The retro orchestrator SHALL keep `spawn.start` for the analyst (prompt-launched, `sdd-retrospective/SKILL.md:79-87`) and SHALL write `spawn.usage` in place of `spawn.end` (D2).
-5. `formats.md` SHALL list the six usage keys on `spawn.end` as hook-written and state that `spawn.usage` carries no `tokens`.
+2. Every passage that tells an orchestrator to take `tokens=<n>` from the Agent result SHALL be rewritten to drop it: `harness/skills/sdd-document-phase/SKILL.md:46-48`, `:114-116`, `:144`; `harness/skills/sdd-implementation-phase/SKILL.md:53-57`; `harness/skills/sdd-closeout-phase/SKILL.md:46-49`; `harness/skills/sdd-retrospective/SKILL.md:33-39`; `harness/skills/sdd-continue/SKILL.md:213-216`; the `spawn.end` and `spawn.usage` rows of the event table, `harness/skills/sdd-continue/references/formats.md:193-194`; and the supervisor note at `harness/skills/sdd-continue/references/formats.md:200-201`. The command that finds every member: `grep -rn "footer\|tokens=" harness/skills`.
+3. The supervisor SHALL keep writing `spawn.start` for each orchestrator (`harness/skills/sdd-continue/SKILL.md:213-214`; the hook derives `spawn.start` from a brief path, `harness/hooks/sdd-activity.sh:78`, and an orchestrator launch has none) and SHALL write `spawn.usage` (`agent`, `role`, `result`) after the report in place of `spawn.end` (D1).
+4. The retro orchestrator SHALL keep `spawn.start` for the analyst (prompt-launched, `harness/skills/sdd-retrospective/SKILL.md:79-87`) and SHALL write `spawn.usage` in place of `spawn.end` (D2).
+5. `harness/skills/sdd-continue/references/formats.md` SHALL list the six usage keys on `spawn.end` as hook-written and state that `spawn.usage` carries no `tokens`.
 
 ### Requirement 3 — Declared tiers generated from the agent files
 
@@ -45,10 +45,10 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 #### Acceptance Criteria
 
 1. WHEN `node scripts/sync-plugin-assets.cjs` runs THEN it SHALL write `harness/agent-profiles.json`: one entry per file under `harness/agents/`, keyed by frontmatter `name`, with `model`, `effort` and a one-line `role` (design fixes the derivation from `description`), sorted by key, byte-identical on repeated runs.
-2. WHEN it runs with `--check` THEN it SHALL exit 1 naming `harness/agent-profiles.json` if that file differs from what it would write, as it does for plugin drift (`:86-91`, `:102-105`), so CI's `check:plugin-assets` (`.github/workflows/ci.yml:30`) catches a frontmatter edit without a regenerated file.
-3. `src/watch/ledger.ts` SHALL drop the literal `AGENT_PROFILES` (`:40-53`) and expose profiles read from the generated file under the same `AgentProfile` shape (`:34-38`), the full model id kept (`claude-opus-4-8`, not `opus-4-8`).
+2. WHEN it runs with `--check` THEN it SHALL exit 1 naming `harness/agent-profiles.json` if that file differs from what it would write, as it does for plugin drift (`scripts/sync-plugin-assets.cjs:86-91`, `:102-105`), so CI's `check:plugin-assets` (`.github/workflows/ci.yml:30`) catches a frontmatter edit without a regenerated file.
+3. `src/watch/ledger.ts` SHALL drop the literal `AGENT_PROFILES` (`src/watch/ledger.ts:40-53`) and expose profiles read from the generated file under the same `AgentProfile` shape (`src/watch/ledger.ts:34-38`), the full model id kept (`claude-opus-4-8`, not `opus-4-8`).
 4. The published package (`package.json` `files`: `dist/**/*`, `README.md`, `CHANGELOG.md`, `LICENSE`) SHALL carry the profiles, so `npx ... --watch` on another machine shows declared tiers (D4).
-5. IF the profiles file is missing or malformed at run time THEN the view SHALL render with empty model and effort columns, as `render.ts:203` already does for an agent absent from the table, and never fail.
+5. IF the profiles file is missing or malformed at run time THEN the view SHALL render with empty model and effort columns, as `src/watch/render.ts:203` already does for an agent absent from the table, and never fail.
 6. The profiles SHALL cover all twelve agents, `sdd-checker` included.
 
 ### Requirement 4 — Watch view shows declared beside actual
@@ -60,7 +60,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 1. `SpawnNode` (`src/watch/ledger.ts:63-78`) SHALL gain optional `model`, `input`, `output`, `cacheWrite`, `cacheRead`, read off the paired `spawn.end` row (`:240-247`).
 2. WHEN an agent line is rendered (`src/watch/render.ts:180-211`) THEN it SHALL show the declared model and effort from the profiles and, when the node carries `model`, the actual model beside them.
 3. IF the actual model differs from the declared model THEN the line SHALL carry a visible mark (design picks it); IF the node carries no `model` THEN the actual column is blank.
-4. The header total (`render.ts:79`, `ledger.ts:316`) SHALL keep summing `tokens` per spawn, cache reads included; the split by kind lives in Requirement 5 (D10).
+4. The header total (`src/watch/render.ts:79`, `src/watch/ledger.ts:316`) SHALL keep summing `tokens` per spawn, cache reads included; the split by kind lives in Requirement 5 (D10).
 5. WHEN `--watch --once` runs on the fixture ledger of Requirement 5.8 THEN an orchestrator row SHALL show declared `claude-opus-4-8 high` and actual `claude-opus-4-8`.
 6. `src/watch/__tests__/render.test.ts:53` and `:56`, which assert `fable-5-1 xhigh` for the orchestrator and `opus-4-8 xhigh` for the implementer from the hand-kept table, SHALL be updated to the generated profiles.
 
@@ -71,10 +71,10 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 #### Acceptance Criteria
 
 1. The `harness` tool (`src/tools/harness.ts:27-101`) SHALL gain action `usage` in the enum (`:46`) and dispatch (`:109-120`); it SHALL read only `harness-events.jsonl` under the resolved spec store through `PathUtils.safeJoin`, as `phase-log` does (`:673-683`), and spawn no process.
-2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
+2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `src/watch/ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
 3. WHEN called with a second spec (one optional parameter, D12) THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
-4. Per spawn, `tokens` SHALL come from a `spawn.end` row that carries a digit string, else from the `spawn.usage` folded onto the same spawn (`ledger.ts:250-291`); every digit-string row SHALL be counted exactly once, so an orchestrator-written second `spawn.end` (the old retro shape, criterion 5) is not lost; a spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; a cell with such a spawn prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so, never for an empty cell.
-5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens; a seventh, the analyst's orchestrator-written second `spawn.end` (45,675), is dropped by the pairing at `:241` because the hook's `spawn.end` closed the node first (1,185,572 shown against 1,963,320 in the file). The header SHALL state the run count.
+4. Per spawn, `tokens` SHALL come from a `spawn.end` row that carries a digit string, else from the `spawn.usage` folded onto the same spawn (`src/watch/ledger.ts:250-291`); every digit-string row SHALL be counted exactly once, so an orchestrator-written second `spawn.end` (the old retro shape, criterion 5) is not lost; a spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; a cell with such a spawn prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so, never for an empty cell.
+5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`src/watch/ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens; a seventh, the analyst's orchestrator-written second `spawn.end` (45,675), is dropped by the pairing at `:241` because the hook's `spawn.end` closed the node first (1,185,572 shown against 1,963,320 in the file). The header SHALL state the run count.
 6. A spawn's phase SHALL be the `phase` key of its `spawn.start` or folded `spawn.usage`; else the phase whose `phase.start`-to-`phase.end` window holds the spawn's start; else `unknown` (D6).
 7. The response SHALL carry the table as text in `message` and the same numbers in `data` (D7).
 8. `src/tools/__tests__/harness.test.ts` SHALL cover: one spec; two specs; an unknown cell; an old ledger (`spawn.end` with `tokens`, `review-gate` shape); a new ledger (hook rows with the six keys); the all-runs scope. A fixture ledger in that shape SHALL be committed under `src/` for the verification scenario.
@@ -90,7 +90,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 1. The agent files SHALL declare: the four orchestrators and `sdd-retro-analyst` `claude-opus-4-8` / `high` (landed at commit 599bdca on 2026-09-18, `harness/agents/sdd-document-orchestrator.md:4-5` and the other four); `sdd-drafter`, `sdd-adjudicator` `claude-fable-5-1` / `xhigh`; `sdd-reviewer`, `sdd-implementer`, `sdd-verifier` `claude-opus-4-8` / `xhigh`; `sdd-reviser`, `sdd-checker` `claude-sonnet-5` / `high`. This spec changes no agent file (D9).
 2. `docs/SDD-HARNESS.md:284-298` (model policy, lists the orchestrators and the analyst as Fable xhigh) SHALL match the agent files and name `harness/agent-profiles.json` as the generated source; `:325-328` SHALL say the hook measures tokens from the transcript.
 3. `npm run check:plugin-assets` and `claude plugin validate . --strict` SHALL pass with the agent files, the `plugins/` copies and `agent-profiles.json` in agreement.
-4. A second cut (Sonnet for an orchestrator) is not in scope; it is a retro decision after one measured spec.
+4. This document SHALL NOT specify a second cut (Sonnet for an orchestrator); that choice SHALL wait for a retro decision after one measured spec.
 
 ### Requirement 7 — Old ledgers keep rendering
 
@@ -99,7 +99,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 #### Acceptance Criteria
 
 1. WHEN `--watch --once` runs on the `review-gate` ledger THEN it SHALL print `tokens 6.3M` (`tokensTotal` 6,324,447 over 59 spawns, every `spawn.end` carrying a digit string) and the same per-spawn tokens as before this spec.
-2. IF a spawn has both a `spawn.end` with a digit-string `tokens` and a folded `spawn.usage` with `tokens` THEN the `spawn.end` value SHALL win (the fold at `ledger.ts:271` overrides it today; no ledger on this store has both).
+2. IF a spawn has both a `spawn.end` with a digit-string `tokens` and a folded `spawn.usage` with `tokens` THEN the `spawn.end` value SHALL win (the fold at `src/watch/ledger.ts:271` overrides it today; no ledger on this store has both).
 3. `spawn.usage` rows that carry `tokens` SHALL still be summed when no `spawn.end` on the same spawn carries them (`question-gates` shape).
 4. `src/watch/__tests__/ledger.test.ts:169-226` SHALL pass unchanged, with one added case for a hook row carrying the six keys.
 
@@ -114,15 +114,15 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 - A missing or malformed `agent-profiles.json` never fails `--watch` or the server.
 
 ### Security
-- The hook reads only the path the hook payload names and writes only under the spec directory the pointer file resolved (`sdd-activity.sh:19-31`); `usage` reads only under the spec store through `safeJoin`.
+- The hook reads only the path the hook payload names and writes only under the spec directory the pointer file resolved (`harness/hooks/sdd-activity.sh:19-31`); `usage` reads only under the spec store through `safeJoin`.
 
 ### Compatibility
-- CI runs node 20 (`.github/workflows/ci.yml:20`); the hook test asserts only on the JSON lines the script appends (`hook-spawn-events.test.ts:9-11`).
+- CI runs node 20 (`.github/workflows/ci.yml:20`); the hook test asserts only on the JSON lines the script appends (`src/__tests__/hook-spawn-events.test.ts:9-11`).
 - `harness/hooks/` is a sensitive path (`.spec-workflow/agent-rules.md`); the hook change is high risk at the review gate.
 
 ## Decisions taken in this document
 
-- D1 — The supervisor writes `spawn.usage` (`agent`, `role`, `result`) for an orchestrator, and the hook writes the orchestrator's `spawn.end`: options were keep the supervisor's `spawn.end` and have the hook skip orchestrators (no orchestrator usage, against the entry), both write `spawn.end` (the second row finds no open node at `ledger.ts:241` and its `result` is lost), or the supervisor switches to `spawn.usage`; chosen because one writer per row type is the rule workers already follow.
+- D1 — The supervisor writes `spawn.usage` (`agent`, `role`, `result`) for an orchestrator, and the hook writes the orchestrator's `spawn.end`: options were keep the supervisor's `spawn.end` and have the hook skip orchestrators (no orchestrator usage, against the entry), both write `spawn.end` (the second row finds no open node at `src/watch/ledger.ts:241` and its `result` is lost), or the supervisor switches to `spawn.usage`; chosen because one writer per row type is the rule workers already follow.
 - D2 — The retro orchestrator keeps `spawn.start` for the analyst and writes `spawn.usage` instead of `spawn.end`: options were leave it (a duplicate `spawn.end` per analyst run) or brief-launch the analyst so the hook writes both rows; chosen because the analyst's launch prompt is not this spec's concern.
 - D3 — `model` is the distinct `message.model` values in first-seen order joined with `+`: options were the last entry's model, the most frequent, or all distinct; chosen because a mid-spawn substitution must show, not hide (every probed transcript had one value).
 - D4 — The profiles ship inside `dist/` and `ledger.ts` resolves them relative to its own module, empty table on absence: options were import through `resolveJsonModule` from `harness/` (outside `rootDir: ./src`, `tsconfig.json:8`), read from the working directory, or copy at build; chosen because `npx` users have only `dist/**`.
@@ -139,10 +139,13 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 
 - The tier change (entry item 4) landed before this spec at commit 599bdca; this spec verifies it, generates the profiles from it and fixes `docs/SDD-HARNESS.md:284-298`. Nothing cut.
 - The step-4 prompt's other columns (`docs/harness-efficiency-plan.md:164-167`: minutes, review rounds per document, verifier spawns skipped by the gate) are not in the entry's `usage` and are not delivered; `round` and `note` rows stay in the ledger for a later extension.
-- The supervisor's model pre-flight (`sdd-continue/SKILL.md:218-226`) stays as it is; it could read the hook's `spawn.end` `model` instead, but the entry does not ask for it.
+- The supervisor's model pre-flight (`harness/skills/sdd-continue/SKILL.md:218-226`) stays as it is; it could read the hook's `spawn.end` `model` instead, but the entry does not ask for it.
 - Tokens of the supervisor (the main session) are not captured: no `SubagentStop` fires for it.
 - Per-run effort and per-role provider belong to specs 9 and 10 (entry, Decided).
 
 ## Revision History
 
 - **v1** (2026-09-19) — Initial draft.
+  - **Lint pass.** 24 fixed; rejected: L-1, L-2, L-3, L-4, L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26, L-27, L-28, L-29, L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34, L-35, L-36, L-37, L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43, L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52, L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
+  - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39, L-40, L-41, L-42, L-47, L-48, L-49, L-50, L-54 (added missing directory prefixes), L-12 through L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21 through L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
+  - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
````
