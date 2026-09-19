# Adversarial Review — harness-usage-and-tiers/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-design.md using this format:

```markdown
# Adversarial Review Memory — design
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

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid and doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): 77 `citation-identifier` warnings the lint pass rejected under rule 11 — the same tokens rejected at v1 (new or proposed design text, or a symbol attributed to a different citation in the same prose block, never literally inside the flagged range). Do not re-discover these; only flag one where the design claims a symbol already exists in the exact cited range and it does not.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): harness-usage-and-tiers design v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines. The v2 lint commit's own diff follows as `## Lint commit <short sha>`.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. The v2 delta accepted R1-1 (extended skill/doc edit spans and corrected several citations), R1-2 (capped the tier line's `actual` column, recomputed to 80 columns, added a width-80 render test), R1-3 (the tool description gains a fifth `usage` action) and R1-4 (qualified a citation; added a Scope-notes bullet on the four unread SpawnNode kind fields). Re-read each changed span end to end.
- Fresh lens for this round: each prescribed test or safety mechanism verified against the installed library. Attack the `## Testing Strategy` and `## Error Handling` sections: for every test the design prescribes, confirm the assertion is expressible against the real vitest version and the real shapes under `/home/mcf/repo/spec-workflow-mcp` (the fold in `src/watch/ledger.ts`, the render widths in `src/watch/render.ts`, the tool in `src/tools/harness.ts`); confirm each named existing test file the design says it touches actually asserts the value the design claims; and trace every stated failure path (a missing/`unknown` token, an absent profiles file, a malformed row) to a mechanism the design pins, not a hope.
- Closed by ruling, do not re-open: the two drafter RE-DECIDED literals ruled refinement at round 1 (Req 4.7 two-line agent entry; Req 5.4 / D6 non-digit `tokens` value).
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the Prior review context section above says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design-r2.md

## Changes since 3de1754

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/design.md b/.spec-workflow/specs/harness-usage-and-tiers/design.md
index 8c218b9..4aa4e3a 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/design.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/design.md
@@ -1,10 +1,10 @@
 # Design Document
 
-Document version: v1
+Document version: v2
 
 ## Overview
 
-The plugin's `SubagentStop` hook (`harness/hooks/sdd-activity.sh:63-65`, `:83-85`) becomes the single writer of per-spawn usage: it sums `message.usage` over the worker's transcript at `transcript_path` and writes six keys on the `spawn.end` row it already emits, for orchestrators too. `scripts/sync-plugin-assets.cjs` generates `harness/agent-profiles.json` from the twelve agents' frontmatter, `src/watch/ledger.ts` loads it in place of the hand-kept table (`src/watch/ledger.ts:41-53`), and `src/watch/render.ts` shows declared beside actual. A new pure fold, `src/watch/usage.ts`, computes the tokens-by-phase-and-agent report that the `harness` tool exposes as action `usage` (`src/tools/harness.ts:46`, `:109-120`), reusing `parseJsonl` (`src/watch/ledger.ts:129`), `PathUtils.safeJoin` and the `phase-log` read pattern (`:658-683`).
+The plugin's `SubagentStop` hook (`harness/hooks/sdd-activity.sh:63-65`, `:83-85`) becomes the single writer of per-spawn usage: it sums `message.usage` over the worker's transcript at `transcript_path` and writes six keys on the `spawn.end` row it already emits, for orchestrators too. `scripts/sync-plugin-assets.cjs` generates `harness/agent-profiles.json` from the twelve agents' frontmatter, `src/watch/ledger.ts` loads it in place of the hand-kept table (`src/watch/ledger.ts:41-53`), and `src/watch/render.ts` shows declared beside actual. A new pure fold, `src/watch/usage.ts`, computes the tokens-by-phase-and-agent report that the `harness` tool exposes as action `usage` (`src/tools/harness.ts:46`, `:109-120`), reusing `parseJsonl` (`src/watch/ledger.ts:129`), `PathUtils.safeJoin` and the `phase-log` read pattern (`src/tools/harness.ts:658-683`).
 
 ## Steering Document Alignment
 
@@ -12,14 +12,14 @@ The plugin's `SubagentStop` hook (`harness/hooks/sdd-activity.sh:63-65`, `:83-85
 `.spec-workflow/steering/` is empty on this store; the standards applied are `.spec-workflow/agent-rules.md`: tests beside the module under `__tests__/`, `harness/` as the single source with generated `plugins/` copies, `harness/hooks/` as a sensitive path.
 
 ### Project Structure (structure.md)
-No `structure.md`; new code follows the existing split: the fold in `src/watch/` beside `ledger.ts`, the tool action in `src/tools/harness.ts`, the generator in `scripts/`, the fixture under `src/__tests__/fixtures/` (not collected by vitest, `vitest.config.ts:7`).
+No `structure.md`; new code follows the existing split: the fold in `src/watch/` beside `ledger.ts`, the tool action in `src/tools/harness.ts`, the generator in `scripts/`, the fixture under `src/__tests__/fixtures/` (not collected by vitest, `./vitest.config.ts:7`).
 
 ### Design System (design-system.md) — if applicable
 N/A: no design-system.md; the only visual surface is the terminal view.
 
 ## Architecture
 
-Three seams move. (1) Token measurement leaves the LLM: today `spawn.usage` and the supervisor's orchestrator `spawn.end` take `tokens` from the `<usage><subagent_tokens>` value of the Agent task notification (`harness/skills/sdd-continue/SKILL.md:213-217`, commit f616c72), never a result footer, and rows still read `unknown` (this run: `sdd-reviewer`, rounds 2-4); after this spec the hook reads the transcript named by the `SubagentStop` payload and no skill writes `tokens`. (2) Declared tiers leave `ledger.ts`: generated into `harness/agent-profiles.json`, shipped in `dist/`, loaded relative to the module. (3) The step-4 measurement becomes a pure fold over a ledger, exposed by the `harness` tool and reusable by spec 9.
+Three seams move. (1) Token measurement leaves the LLM: today `spawn.usage` and the supervisor's orchestrator `spawn.end` take `tokens` from the `<usage><subagent_tokens>` value of the Agent task notification (`harness/skills/sdd-continue/SKILL.md:213-220`, commit f616c72), never a result footer, and rows still read `unknown` (this run: `sdd-reviewer`, rounds 2-4); after this spec the hook reads the transcript named by the `SubagentStop` payload and no skill writes `tokens`. (2) Declared tiers leave `ledger.ts`: generated into `harness/agent-profiles.json`, shipped in `dist/`, loaded relative to the module. (3) The step-4 measurement becomes a pure fold over a ledger, exposed by the `harness` tool and reusable by spec 9.
 
 ```mermaid
 graph LR
@@ -82,8 +82,8 @@ function readUsage(p) {
 ### Component 4 — Watch view tier line (`src/watch/render.ts`)
 - **Purpose:** Show declared model and effort beside the actual model, within 80 columns (Req 4.2, 4.3, 4.5, 4.7).
 - **Interfaces:** `agentLines` (`src/watch/render.ts:180-211`) renders a head line, a tier line and the existing third line (D1):
-  1. Head: `${indent}${mark} ${bold(padRight(agent, agentW))}${padRight(fit(role, roleW), roleW + 1)}${padRight(dur, 8)} ${badge} ${tokens}`, trimmed; the model and effort columns of `src/watch/render.ts:203` leave this line. `agentW` stays `max(18, agent.length + 1)`; `roleW = max(16, min(30, width - indent.length - 2 - agentW - 20))`: role pad 1, duration 8, 2 spaces, 9 for the badge (`* 1:02:03`) on a running node (`src/watch/render.ts:188`) or the tokens (`12.3M tok`) on an ended one, never both (a running node folded with `spawn.usage` tokens, `src/watch/ledger.ts:267-271`, shows them once it ends). Worst case at 80 columns, `sdd-implementation-orchestrator` (indent 2): 2 + 2 + 32 + 25 + 8 + 2 + 9 = 80.
-  2. Tier: `${indent}   ${dim('declared')} ${padRight(declared, 23)}${dim('actual')} ${actual}${flag}` with `declared = profile ? profile.model + ' ' + profile.effort : ''` (longest 22), `actual = s.model ?? ''`, `flag = profile && s.model && s.model !== profile.model ? ' ' + bad('!=') : ''` (Req 4.3, D10; a `+`-joined `model` is flagged); longest 66 characters; omitted when both are empty (Req 3.5's empty columns).
+  1. Head: `${indent}${mark} ${bold(padRight(agent, agentW))}${padRight(fit(role, roleW), roleW + 1)}${padRight(dur, 8)} ${badge} ${tokens}`, trimmed; the model and effort columns of `src/watch/render.ts:203` leave this line. `agentW` stays `max(18, agent.length + 1)`; `roleW = max(16, min(30, width - indent.length - 2 - agentW - 20))`: role pad 1, duration 8, 2 spaces, 9 for the badge (`* 1:02:03`) on a running node (`src/watch/render.ts:188`) or the tokens (`12.3M tok`) on an ended one, never both (a running node folded with `spawn.usage` tokens, `src/watch/ledger.ts:267-271`, shows them once it ends). Worst case at 80 columns, `sdd-implementation-orchestrator` (indent 2): 2+2+32+25+8+2+9=80.
+  2. Tier: `${indent}   ${dim('declared')} ${padRight(declared, 23)}${dim('actual')} ${actual}${flag}` with `declared = profile ? profile.model + ' ' + profile.effort : ''` (longest 22), `actual = fit(s.model ?? '', 30)`, `flag = profile && s.model && s.model !== profile.model ? ' ' + bad('!=') : ''` (Req 4.3, D10; `fit` caps a flagged `+`-joined `model` past 30 characters); worst case 80 columns, level-2 (5+3+8+1+23+6+1+30+3); omitted when both empty (Req 3.5).
   3. The tool or result line (`src/watch/render.ts:205-209`) unchanged.
 - **Dependencies:** `AGENT_PROFILES`, `PHASE_ORDER` from `./ledger.js`.
 - **Reuses:** `padRight`, `fit`, the palette (`src/watch/render.ts:16-19`, `src/watch/render.ts:44-58`).
@@ -93,14 +93,14 @@ function readUsage(p) {
 - **Interfaces:** `export function buildUsageReport(events: LedgerEvent[], spec: string): UsageReport`; `export function usageDelta(a: UsageReport, b: UsageReport): UsageDelta[]` (per phase of the union in report order, `b` minus `a`); `export function formatUsageTable(report: UsageReport, compare?: UsageReport): string`.
   - Rules of `buildUsageReport`, in order. (a) Sort rows by `ts` (stable; `ms` as `src/watch/ledger.ts:183-186`); `runs` = distinct defined `run` values (Req 5.5). (b) Walk the rows with `current: Map<string, Spawn>` by agent: `spawn.start` opens `Spawn { agent, startedAt: ts, phaseKey: row.phase, rows: [] }` and sets `current[agent]`; `spawn.end` or `spawn.usage` attaches to `current[agent]` when set; when unset, a `spawn.usage` becomes its own `Spawn` (`startedAt` = its `ts`, not entered in `current`) and a `spawn.end` is dropped (Req 5.4). (c) Per spawn: `tokens` = the later digit-string (`/^\d+$/`) `spawn.end` value, else the later digit-string `spawn.usage` value, else undefined; the four kinds and `model` from the later `spawn.end` carrying them; a `spawn.usage` `phase` overwrites `phaseKey`. (d) `unknown` = `tokens` undefined and some row carries a non-digit `tokens` value (D6); no `tokens` key anywhere counts unmarked; `0` is a known zero. (e) Phase = `phaseKey`; else the phase of the latest `phase.start` at or before `startedAt` with no `phase.end` of that phase between (the live-phase rule of `src/watch/ledger.ts:217-224`); else `unknown` (Req 5.6). (f) Per phase and agent: `spawns`, `tokens`, `unknown` count; per phase a total cell, `kinds`, and `orchestratorShare` = orchestrator tokens / phase tokens (name ends `-orchestrator`, `src/watch/ledger.ts:238`), `null` at zero. Order: `PHASE_ORDER`, other labels sorted, `unknown` last.
   - Replay on this store (scratch script, 2026-09-19): `question-gates` runs 2, spawns 44, tokens 1,963,320, 14 marked, 7 unmarked orchestrator spawns (Req 5.9); `review-gate` 59 spawns, 6,324,447, equal to `tokensTotal` (Req 7.1).
-  - Known limit: two `spawn.start` rows of one agent before either closes (this run, `sdd-reviser` at 15:28:19 and 15:34:04) attach later closing rows to the second and leave the first a token-less unmarked spawn; per-phase and per-agent totals are unaffected.
+  - Known limit: two `spawn.start` rows of one agent before either closes (seen this run, `sdd-reviser`) attach later closing rows to the second and leave the first a token-less unmarked spawn; per-phase and per-agent totals are unaffected.
   - `formatUsageTable` (Req 5.2, 5.3, D7): header `usage <spec>  runs <n>  spawns <n>  tokens <n>`; columns `phase | agent | spawns | tokens`; a row per phase and agent (agents sorted), then a phase `total` row carrying `orch <p>%` (one decimal, `-` when null) and `in <n> out <n> cw <n> cr <n>`; last a spec `total` row. A token cell is `<sum>` or `<sum> (+<n> unknown)` (Req 5.4); numbers use `toLocaleString('en-US')`. With `compare`: the union of keys in the same order, one `spawns | tokens` pair per spec, `-` where absent; `total` rows add `delta spawns <n> tokens <n>` (compare minus report).
 - **Dependencies:** `LedgerEvent`, `PHASE_ORDER` from `./ledger.js`.
 - **Reuses:** `buildModel`'s fold behaviours (`src/watch/ledger.ts:250-291`) restated as rules (b) and (c), not its last-run scope (`:200-202`).
 
 ### Component 6 — `harness usage` action (`src/tools/harness.ts`)
 - **Purpose:** Read one or two ledgers and return the table (Req 5.1-5.3, 5.7).
-- **Interfaces:** `action.enum` (`src/tools/harness.ts:46`) gains `'usage'`; new property `compareSpecName: { type: 'string', description: 'Second spec for a side-by-side usage table (usage action)' }` beside `specName` (`:49-52`; `additionalProperties: false` at `:95` bars it otherwise); `harnessHandler` (`:109-120`) gains `case 'usage'`, its default message names five actions, and the tool `description` (`:29-40`) gains one sentence. `async function usageAction(args: any, context: ToolContext): Promise<ToolResponse>`: `selectRoots`, `PathUtils.getSpecPath` (`:660-661`), spec dir must exist (`:664-670`), ledger via `PathUtils.safeJoin(specDir, 'harness-events.jsonl')` with `ENOENT` as empty (`:673-683`), `parseJsonl` (`:697`), the same for `compareSpecName`. Returns `{ success: true, message: formatUsageTable(report, compare), data: { report, compare, delta } }`, `compare` and `delta` only for two specs (Req 5.7). No process spawned.
+- **Interfaces:** `action.enum` (`src/tools/harness.ts:46`) gains `'usage'`; new property `compareSpecName: { type: 'string', description: 'Second spec for a side-by-side usage table (usage action)' }` beside `specName` (`:49-52`; `additionalProperties: false` at `:95` bars it otherwise); `harnessHandler` (`:109-120`) gains `case 'usage'`, its default message names five actions, and the tool `description` (`:29-40`) gains one sentence and its opening line's action list gains `usage`. `async function usageAction(args: any, context: ToolContext): Promise<ToolResponse>`: `selectRoots`, `PathUtils.getSpecPath` (`:660-661`), spec dir must exist (`:664-670`), ledger via `PathUtils.safeJoin(specDir, 'harness-events.jsonl')` with `ENOENT` as empty (`:673-683`), `parseJsonl` (`:697`), the same for `compareSpecName`. Returns `{ success: true, message: formatUsageTable(report, compare), data: { report, compare, delta } }`, `compare` and `delta` only for two specs (Req 5.7). No process spawned.
 - **Dependencies:** `buildUsageReport`, `usageDelta`, `formatUsageTable` from `../watch/usage.js`; `ToolResponse` (`src/types.ts:218-222`).
 - **Reuses:** `phaseLogAction`'s read pattern (`src/tools/harness.ts:658-683`).
 
@@ -108,10 +108,10 @@ function readUsage(p) {
 - **Purpose:** No skill or agent writes `tokens`; the docs say who does (Req 2, 5.10, 6.2).
 - **Interfaces:** each edit replaces the cited span:
   - Drop the `tokens=<n>` clause from the `spawn.usage` key lists at `harness/skills/sdd-document-phase/SKILL.md:46-48`, `harness/skills/sdd-implementation-phase/SKILL.md:57-58` and `harness/skills/sdd-closeout-phase/SKILL.md:48-49`; `harness/skills/sdd-document-phase/SKILL.md:114-116` drops "and tokens"; `:144` already reads "from its report".
-  - `harness/skills/sdd-retrospective/SKILL.md:35-38`: the orchestrator writes `spawn.start` before and `spawn.usage` (`agent=sdd-retro-analyst role=proposals result=<one line>`) after the analyst; the hook writes the analyst's `spawn.end` (Req 2.4).
-  - `harness/skills/sdd-continue/SKILL.md:213-217`: after the report the supervisor writes `spawn.usage agent=<agent> "role=<phase> phase, spawn <n>" result=<PHASE value>`; the hook writes the orchestrator's `spawn.end` (Req 2.3).
+  - `harness/skills/sdd-retrospective/SKILL.md:35-39`: the orchestrator writes `spawn.start` before and `spawn.usage` (`agent=sdd-retro-analyst role=proposals result=<one line>`) after the analyst; the hook writes the analyst's `spawn.end` (Req 2.4).
+  - `harness/skills/sdd-continue/SKILL.md:213-220`: after the report the supervisor writes `spawn.usage agent=<agent> "role=<phase> phase, spawn <n>" result=<PHASE value>`; the hook writes the orchestrator's `spawn.end` (Req 2.3).
   - `harness/skills/sdd-continue/references/formats.md:193-194`: `spawn.end` is hook-written for every `sdd-*` agent with the Data Models keys; `spawn.usage` is written by the supervisor (orchestrator) or the orchestrator (worker), keys `agent`, `role`, `result`, `phase`, `task` or `round`, no `tokens`; `:200-201`: the supervisor writes `spawn.start` and `spawn.usage` per orchestrator (Req 2.5).
-  - Member-finding command (Req 2.2): `grep -rn "footer\|tokens=\|subagent_tokens" harness/skills`; afterwards only the two unrelated `attribution footer` hits remain (`harness/skills/sdd-closeout-phase/SKILL.md:168`, `harness/skills/sdd-implementation-phase/references/briefs.md:233`).
+  - Member-finding command (Req 2.2): `grep -rn "footer\|tokens=\|subagent_tokens" harness/skills`; afterwards only the two unrelated `attribution footer` hits remain (`harness/skills/sdd-closeout-phase/SKILL.md:170`, `harness/skills/sdd-implementation-phase/references/briefs.md:233`).
   - `docs/TOOLS-REFERENCE.md:551-570`: "five actions"; parameters add `op`, `slot`, `payload`, `compareSpecName`; bullets for `gate` (four ops) and `usage` (one or two specs, tokens and spawns by phase and agent, orchestrator share, `unknown` marks).
   - `docs/SDD-HARNESS.md:284-298`: a supervisor row (main session, no agent file, outside the generated profiles), four rows matching Req 6.1's groups with full ids, and one sentence naming `harness/agent-profiles.json` as generated by `node scripts/sync-plugin-assets.cjs` and checked in CI; `:325-328`: the `SubagentStop` hook measures tokens from the transcript, the watch header sums them, `harness usage` splits them by kind.
 - **Dependencies:** the `harness/` checks of `.spec-workflow/agent-rules.md` (scenario 5).
@@ -174,7 +174,7 @@ Tool `data`: `{ report: UsageReport; compare?: UsageReport; delta?: UsageDelta[]
 - **Unit:**
   - `src/__tests__/hook-spawn-events.test.ts` (drives the real script, `src/__tests__/hook-spawn-events.test.ts:13`, `src/__tests__/hook-spawn-events.test.ts:36-41`): a fixture transcript with three `assistant` entries carrying `message.usage` (two models), one `user` entry, one `assistant` entry without `usage`, one torn line. `SubagentStop` with `transcript_path` for `sdd-implementer` asserts the six keys against sums from the test's own literals and `model` as the two ids joined with `+`; for `sdd-implementation-orchestrator` a `spawn.end` row appears (inverting `src/__tests__/hook-spawn-events.test.ts:110-116`, Req 1.8); no `transcript_path`, or a missing path, gives `tokens: 'unknown'` and no `input`; `agent.stop` carries numeric `tokens` (Req 1.7). Assertions read only the appended JSON lines (`src/__tests__/hook-spawn-events.test.ts:9-11`).
   - `src/watch/__tests__/ledger.test.ts`: a hook `spawn.end` with the six keys sets `SpawnNode.model`, the kinds, `tokens` and `tokensTotal` (Req 7.4); `spawn.end tokens=84000` then `spawn.usage tokens=1` keeps 84,000 (Req 7.2); `loadAgentProfiles(['/nonexistent'])` and a `not json` file give `{}`; the default call has 12 keys, `sdd-checker` at `claude-sonnet-5` `high` (Req 3.6). `src/watch/__tests__/ledger.test.ts:169-226` unchanged.
-  - `src/watch/__tests__/render.test.ts`: `src/watch/__tests__/render.test.ts:53` and `src/watch/__tests__/render.test.ts:56` split into a head-line assertion without model columns and a tier-line assertion (`declared claude-opus-4-8 high`, `declared claude-opus-4-8 xhigh`, empty actual; Req 4.6); a `spawn.end model=claude-sonnet-5` for the implementer renders `actual claude-sonnet-5 !=`; the fixture at width 80 renders no line above 80 characters and the orchestrator tier line `declared claude-opus-4-8 high` / `actual claude-opus-4-8` without `!=` (Req 4.5, 4.7).
+  - `src/watch/__tests__/render.test.ts`: `src/watch/__tests__/render.test.ts:53` and `src/watch/__tests__/render.test.ts:56` split into a head-line assertion without model columns and a tier-line assertion (`declared claude-opus-4-8 high`, `declared claude-opus-4-8 xhigh`, empty actual; Req 4.6); a `spawn.end model=claude-sonnet-5` for the implementer renders `actual claude-sonnet-5 !=`; the fixture at width 80 renders no line above 80 characters and the orchestrator tier line `declared claude-opus-4-8 high` / `actual claude-opus-4-8` without `!=` (Req 4.5, 4.7); a level-2 `+`-joined `model` renders truncated, fitting 80 columns.
   - `src/tools/__tests__/harness.test.ts` (temp store `src/tools/__tests__/harness.test.ts:12-29`, `writeLedger` as `src/tools/__tests__/harness.test.ts:248-253`): one spec (`data.report` totals, `message` holds the phase row); two specs (`compareSpecName`, `delta`); an unknown cell; an old `review-gate`-shape ledger (`spawn.end` with digit `tokens`); the fixture (runs 2, 5 spawns, 4,554,189); the all-runs scope (a second run id with no `run.start` counted); a start-less `spawn.end` dropped, a start-less `spawn.usage` counted once (Req 5.4); an unknown spec dir fails naming it; a missing ledger gives `runs 0` (Req 5.8).
   - `src/__tests__/agent-profiles.test.ts` (new): `harness/agent-profiles.json` has 12 keys; each key's `model` and `effort` equal the frontmatter lines of `harness/agents/<key>.md`; `JSON.stringify(JSON.parse(text), null, 2) + '\n'` equals the file text. Drift detection runs in CI (`.github/workflows/ci.yml:30`) and in scenario (5).
 - **Integration:** `runWatch` with `once` (`src/watch/__tests__/index.test.ts:62-68` pattern) on a temp store holding the fixture asserts `tokens 1.6M` and the orchestrator tier line; the hook script against a real transcript (scenario 1).
@@ -204,8 +204,9 @@ Tool `data`: `{ report: UsageReport; compare?: UsageReport; delta?: UsageDelta[]
 
 ## Scope notes
 
-- Carried item (token source): addressed in Architecture; the current source is the `<usage><subagent_tokens>` notification value (`harness/skills/sdd-continue/SKILL.md:213-217`, f616c72), never a result footer; Component 7 removes it from every skill.
-- The supervisor's model pre-flight (`harness/skills/sdd-continue/SKILL.md:219-227`) is untouched (requirements scope notes).
+- Carried item (token source): addressed in Architecture (`harness/skills/sdd-continue/SKILL.md:213-220`, f616c72); Component 7 removes it from every skill.
+- The supervisor's model pre-flight (`harness/skills/sdd-continue/SKILL.md:222-230`) is untouched (requirements).
+- `SpawnNode`'s four kind fields go unread; held for spec 9.
 - The step-4 columns beyond tokens and spawns (`docs/harness-efficiency-plan.md:164-167`) are not delivered (requirements scope notes).
 - The supervisor's own tokens are not measured (no `SubagentStop` for the main session).
 - No agent file changes (Req 6.1); no second tier cut (Req 6.4).
@@ -215,3 +216,9 @@ Tool `data`: `{ report: UsageReport; compare?: UsageReport; delta?: UsageDelta[]
 
 - **v1** (2026-09-19) — Initial draft.
   - **Lint pass.** 27 fixed (L-2, L-7-L-9, L-19-L-30, L-53, L-70-L-78, L-86): bare or unqualified citations given their full path from the code root. Rejected (60): L-3 — `vitest.config.ts` is already the full path from the code root, a root-level file has no directory to prepend; L-1, L-4-L-6, L-10-L-18, L-31-L-52, L-54-L-69, L-79-L-85, L-87 — each named identifier is new or proposed text this design adds, or is attributed to a different citation earlier or later in the same block; none is literally inside the specific range flagged.
+- **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 1/1/2).
+  - **R1-1 — Accepted (MUST_FIX).** The skill edit spans stopped short of the token-write text. Extended the supervisor continue-skill edit to run through its trailing tokens-unknown sentence and the retrospective-skill edit to run through its trailing unknown-marking clause, so both edits now remove that text instead of leaving it dangling; corrected the closeout attribution-footer citation to the line that actually holds it; corrected the model pre-flight boundary to its true span and re-derived the post-edit member-finding grep claim against it. The corrected spans and the re-derived claim now read at lines 22, 111, 112, 114, 207 and 208.
+  - **R1-2 — Accepted (SHOULD_FIX).** The tier line's actual-model column overflowed 80 columns for a two-model worker. Capped that column with the same truncation helper the head line already uses and recomputed the worst case, which now lands at exactly 80 columns for a level-2 two-model worker; added a matching width-80 render-test case. The corrected rule and the new test case now read at lines 86 and 177.
+  - **R1-3 — Accepted (MINOR).** The tool's description sentence still listed four actions after usage was added. Noted that the description's opening action list also gains the fifth entry. Now reads at line 103.
+  - **R1-4 — Accepted (MINOR).** The four new spawn-kind fields had no reader and one Overview citation lacked its file name. Qualified the bare citation with its file and added a note that the four fields are read by nothing in this spec and are held for a later spec. Now read at lines 7 and 209.
+  - **Lint pass.** 1 fixed (L-2): the root-level `vitest.config.ts:7` citation gained the `./` prefix the checker requires for a path with no directory; verified line 7 still holds the fixture-exclusion text cited. Rejected (77): L-1, L-3 through L-78 — rule 11, the same citation-identifier tokens the v1 lint pass already rejected with reasons on record, re-fired only because v2 shifted their line numbers; spot-verified against the real tree (`buildModel` at `src/watch/ledger.ts:188`, not inside its cited `:250-291` range; `loadAgentProfiles` not inside `src/watch/render.ts:1`, which imports `AGENT_PROFILES`; `main` at `sync-plugin-assets.cjs:74`/`:108`, not inside its cited `:83-100`; `readUsage`, `usage`, `transcript_path` new text this design introduces) — each still new or proposed text, or attributed to a different citation in the same block, none literally inside the newly-flagged range.
````

## Lint commit 317a241

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/design.md b/.spec-workflow/specs/harness-usage-and-tiers/design.md
index 3d8ed84..4aa4e3a 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/design.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/design.md
@@ -12,7 +12,7 @@ The plugin's `SubagentStop` hook (`harness/hooks/sdd-activity.sh:63-65`, `:83-85
 `.spec-workflow/steering/` is empty on this store; the standards applied are `.spec-workflow/agent-rules.md`: tests beside the module under `__tests__/`, `harness/` as the single source with generated `plugins/` copies, `harness/hooks/` as a sensitive path.
 
 ### Project Structure (structure.md)
-No `structure.md`; new code follows the existing split: the fold in `src/watch/` beside `ledger.ts`, the tool action in `src/tools/harness.ts`, the generator in `scripts/`, the fixture under `src/__tests__/fixtures/` (not collected by vitest, `vitest.config.ts:7`).
+No `structure.md`; new code follows the existing split: the fold in `src/watch/` beside `ledger.ts`, the tool action in `src/tools/harness.ts`, the generator in `scripts/`, the fixture under `src/__tests__/fixtures/` (not collected by vitest, `./vitest.config.ts:7`).
 
 ### Design System (design-system.md) — if applicable
 N/A: no design-system.md; the only visual surface is the terminal view.
@@ -221,3 +221,4 @@ Tool `data`: `{ report: UsageReport; compare?: UsageReport; delta?: UsageDelta[]
   - **R1-2 — Accepted (SHOULD_FIX).** The tier line's actual-model column overflowed 80 columns for a two-model worker. Capped that column with the same truncation helper the head line already uses and recomputed the worst case, which now lands at exactly 80 columns for a level-2 two-model worker; added a matching width-80 render-test case. The corrected rule and the new test case now read at lines 86 and 177.
   - **R1-3 — Accepted (MINOR).** The tool's description sentence still listed four actions after usage was added. Noted that the description's opening action list also gains the fifth entry. Now reads at line 103.
   - **R1-4 — Accepted (MINOR).** The four new spawn-kind fields had no reader and one Overview citation lacked its file name. Qualified the bare citation with its file and added a note that the four fields are read by nothing in this spec and are held for a later spec. Now read at lines 7 and 209.
+  - **Lint pass.** 1 fixed (L-2): the root-level `vitest.config.ts:7` citation gained the `./` prefix the checker requires for a path with no directory; verified line 7 still holds the fixture-exclusion text cited. Rejected (77): L-1, L-3 through L-78 — rule 11, the same citation-identifier tokens the v1 lint pass already rejected with reasons on record, re-fired only because v2 shifted their line numbers; spot-verified against the real tree (`buildModel` at `src/watch/ledger.ts:188`, not inside its cited `:250-291` range; `loadAgentProfiles` not inside `src/watch/render.ts:1`, which imports `AGENT_PROFILES`; `main` at `sync-plugin-assets.cjs:74`/`:108`, not inside its cited `:83-100`; `readUsage`, `usage`, `transcript_path` new text this design introduces) — each still new or proposed text, or attributed to a different citation in the same block, none literally inside the newly-flagged range.
````
