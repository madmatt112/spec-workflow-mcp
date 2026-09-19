# Adversarial Review — harness-usage-and-tiers/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
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

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid and doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): 60 `citation-identifier` warnings the lint pass rejected — L-1, L-4, L-5, L-6, L-10, L-11, L-12, L-13, L-14, L-15, L-16, L-17, L-18, L-31 through L-52, L-54 through L-69, L-79, L-80, L-81, L-82, L-83, L-84, L-85, L-87. The reviser rejected each because the named identifier is new or proposed text this design introduces, or is attributed to a different citation earlier or later in the same prose block, never literally inside the specific range the linter flagged. Spot-check a few: if any names a symbol the design claims already exists in the cited range but does not, that is a MUST_FIX; if it is genuinely new/proposed design text, it is not.
- Changes: the diff from the `docs(sdd): harness-usage-and-tiers design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `harness-usage-and-tiers` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` (entry 8, around line 259) and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- The drafter re-decided these requirement literals. Rule on each: `refinement` (closed) or `widening` (a MUST_FIX):
  - Req 4.7 — the watch-view agent entry is two lines (head line, tier line), each within 80 columns, because one line cannot hold a 31-character agent name plus two full ids.
  - Req 5.4 — "states unknown" widened to mean any non-digit `tokens` value (design decision D6).
- Fresh lens for this round: wire contracts across a boundary — the hook writes `spawn.end` rows, the ledger model reads and folds them, and the `harness usage` action and the watch view surface them. Trace each field end to end (name, type, presence/absence, the `unknown`/non-digit token path) from the hook's write, through the fold, to every reader, and flag any field a producer writes that a consumer does not read as designed, or a shape a reader assumes that the producer does not guarantee.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design.md

## Changes since b1f0864

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/design.md b/.spec-workflow/specs/harness-usage-and-tiers/design.md
index cb8be44..8c218b9 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/design.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/design.md
@@ -4,7 +4,7 @@ Document version: v1
 
 ## Overview
 
-The plugin's `SubagentStop` hook (`harness/hooks/sdd-activity.sh:63-65`, `:83-85`) becomes the single writer of per-spawn usage: it sums `message.usage` over the worker's transcript at `transcript_path` and writes six keys on the `spawn.end` row it already emits, for orchestrators too. `scripts/sync-plugin-assets.cjs` generates `harness/agent-profiles.json` from the twelve agents' frontmatter, `src/watch/ledger.ts` loads it in place of the hand-kept table (`src/watch/ledger.ts:41-53`), and `src/watch/render.ts` shows declared beside actual. A new pure fold, `src/watch/usage.ts`, computes the tokens-by-phase-and-agent report that the `harness` tool exposes as action `usage` (`src/tools/harness.ts:46`, `:109-120`), reusing `parseJsonl`, `PathUtils.safeJoin` and the `phase-log` read pattern (`:658-683`).
+The plugin's `SubagentStop` hook (`harness/hooks/sdd-activity.sh:63-65`, `:83-85`) becomes the single writer of per-spawn usage: it sums `message.usage` over the worker's transcript at `transcript_path` and writes six keys on the `spawn.end` row it already emits, for orchestrators too. `scripts/sync-plugin-assets.cjs` generates `harness/agent-profiles.json` from the twelve agents' frontmatter, `src/watch/ledger.ts` loads it in place of the hand-kept table (`src/watch/ledger.ts:41-53`), and `src/watch/render.ts` shows declared beside actual. A new pure fold, `src/watch/usage.ts`, computes the tokens-by-phase-and-agent report that the `harness` tool exposes as action `usage` (`src/tools/harness.ts:46`, `:109-120`), reusing `parseJsonl` (`src/watch/ledger.ts:129`), `PathUtils.safeJoin` and the `phase-log` read pattern (`:658-683`).
 
 ## Steering Document Alignment
 
@@ -38,7 +38,7 @@ graph LR
 
 ### Component 1 — Hook usage writer (`harness/hooks/sdd-activity.sh`)
 - **Purpose:** On `SubagentStop`, read `d.transcript_path`, sum usage, write the `spawn.end` row for every `sdd-*` agent (Req 1).
-- **Interfaces:** Inline node in the script, no new process, nothing beyond `fs`. The new `SubagentStop` branch replaces `:63-65` and `:83-85`:
+- **Interfaces:** Inline node in the script, no new process, nothing beyond `fs`. The new `SubagentStop` branch replaces `harness/hooks/sdd-activity.sh:63-65` and `harness/hooks/sdd-activity.sh:83-85`:
 
 ```js
 function num(x) { return typeof x === "number" && Number.isFinite(x) ? x : 0; }
@@ -57,7 +57,7 @@ function readUsage(p) {
 }
 ```
 
-  On `SubagentStop`, `u = d.transcript_path ? readUsage(d.transcript_path) : null`. Non-null: the activity line gets `e.tokens = u.tokens` (a JSON number, `ActivityEvent.tokens?: number`, `src/watch/ledger.ts:31`; Req 1.7) and the ledger row is `{ ts, type: "spawn.end", run, spec, agent, input, output, cacheWrite, cacheRead, tokens, model }`, numbers as `String(n)`, `model` omitted when empty. Null: `{ ts, type: "spawn.end", run, spec, agent, tokens: "unknown" }` (Req 1.2-1.4). The `-orchestrator` guard (`:83`) and the `d.usage.tokens` read (`:65`) go (Req 1.1).
+  On `SubagentStop`, `u = d.transcript_path ? readUsage(d.transcript_path) : null`. Non-null: the activity line gets `e.tokens = u.tokens` (a JSON number, `ActivityEvent.tokens?: number`, `src/watch/ledger.ts:31`; Req 1.7) and the ledger row is `{ ts, type: "spawn.end", run, spec, agent, input, output, cacheWrite, cacheRead, tokens, model }`, numbers as `String(n)`, `model` omitted when empty. Null: `{ ts, type: "spawn.end", run, spec, agent, tokens: "unknown" }` (Req 1.2-1.4). The `-orchestrator` guard (`harness/hooks/sdd-activity.sh:83`) and the `d.usage.tokens` read (`harness/hooks/sdd-activity.sh:65`) go (Req 1.1).
 - **Dependencies:** `hooks.json` unchanged (`timeout` 5, `harness/hooks/hooks.json:33`). Whole-file read, 2 MB bound (Req 1.6; probe 2026-09-19 on `agent-a8a51b659b21c6e12.jsonl`, this run's orchestrator: 596,770 bytes, 71 assistant entries, 5,192,210 tokens, `claude-opus-4-8`).
 - **Reuses:** the pointer and event-file plumbing (`harness/hooks/sdd-activity.sh:11-31`); the appends (`:69`, `:84`).
 
@@ -73,20 +73,20 @@ function readUsage(p) {
   - `export function loadAgentProfiles(candidates?: string[]): Record<string, AgentProfile>`. Default candidates from `dirname(fileURLToPath(import.meta.url))` (`src/core/workspace-initializer.ts:9`): `../agent-profiles.json` (the `dist/` copy), then `../../harness/agent-profiles.json` (source under vitest). The first candidate that parses to an object of string `model`, `effort`, `role` wins; a missing or malformed one is skipped; none gives `{}` (Req 3.5). The trailing parameter serves the tests (D3).
   - `export const AGENT_PROFILES: Record<string, AgentProfile> = loadAgentProfiles();` replaces the literal at `src/watch/ledger.ts:41-53`; `src/watch/render.ts:1` keeps its import. Ids are the full frontmatter ids (Req 3.3).
   - `export const PHASE_ORDER` moves here from `src/watch/render.ts:60`; `render.ts` imports it (Req 5.2, D4).
-  - `SpawnNode` gains `model?: string; input?: number; output?: number; cacheWrite?: number; cacheRead?: number` (Req 4.1); the `spawn.end` pairing at `:240-247` reads the numbers with the coercion of `:245` and `model` as-is.
-  - Line `:271` becomes `if (tokens !== undefined && match.tokens === undefined) match.tokens = tokens;`: a digit-string `spawn.end` wins over a folded `spawn.usage` (Req 7.2) and a `spawn.usage` still fills a token-less `spawn.end` (Req 7.3; `src/watch/__tests__/ledger.test.ts:169-183` unchanged).
-  - `tokensTotal` (`:316`) unchanged (Req 4.4).
+  - `SpawnNode` gains `model?: string; input?: number; output?: number; cacheWrite?: number; cacheRead?: number` (Req 4.1); the `spawn.end` pairing at `src/watch/ledger.ts:240-247` reads the numbers with the coercion of `src/watch/ledger.ts:245` and `model` as-is.
+  - Line `src/watch/ledger.ts:271` becomes `if (tokens !== undefined && match.tokens === undefined) match.tokens = tokens;`: a digit-string `spawn.end` wins over a folded `spawn.usage` (Req 7.2) and a `spawn.usage` still fills a token-less `spawn.end` (Req 7.3; `src/watch/__tests__/ledger.test.ts:169-183` unchanged).
+  - `tokensTotal` (`src/watch/ledger.ts:316`) unchanged (Req 4.4).
 - **Dependencies:** `readFileSync`, `fileURLToPath`, `dirname`, `join` (new imports).
-- **Reuses:** `parseJsonl` (`:129-142`); the pairing and the fold (`:226-291`).
+- **Reuses:** `parseJsonl` (`src/watch/ledger.ts:129-142`); the pairing and the fold (`src/watch/ledger.ts:226-291`).
 
 ### Component 4 — Watch view tier line (`src/watch/render.ts`)
 - **Purpose:** Show declared model and effort beside the actual model, within 80 columns (Req 4.2, 4.3, 4.5, 4.7).
 - **Interfaces:** `agentLines` (`src/watch/render.ts:180-211`) renders a head line, a tier line and the existing third line (D1):
-  1. Head: `${indent}${mark} ${bold(padRight(agent, agentW))}${padRight(fit(role, roleW), roleW + 1)}${padRight(dur, 8)} ${badge} ${tokens}`, trimmed; the model and effort columns of `:203` leave this line. `agentW` stays `max(18, agent.length + 1)`; `roleW = max(16, min(30, width - indent.length - 2 - agentW - 20))`: role pad 1, duration 8, 2 spaces, 9 for the badge (`* 1:02:03`) on a running node (`:188`) or the tokens (`12.3M tok`) on an ended one, never both (a running node folded with `spawn.usage` tokens, `:267-271`, shows them once it ends). Worst case at 80 columns, `sdd-implementation-orchestrator` (indent 2): 2 + 2 + 32 + 25 + 8 + 2 + 9 = 80.
+  1. Head: `${indent}${mark} ${bold(padRight(agent, agentW))}${padRight(fit(role, roleW), roleW + 1)}${padRight(dur, 8)} ${badge} ${tokens}`, trimmed; the model and effort columns of `src/watch/render.ts:203` leave this line. `agentW` stays `max(18, agent.length + 1)`; `roleW = max(16, min(30, width - indent.length - 2 - agentW - 20))`: role pad 1, duration 8, 2 spaces, 9 for the badge (`* 1:02:03`) on a running node (`src/watch/render.ts:188`) or the tokens (`12.3M tok`) on an ended one, never both (a running node folded with `spawn.usage` tokens, `src/watch/ledger.ts:267-271`, shows them once it ends). Worst case at 80 columns, `sdd-implementation-orchestrator` (indent 2): 2 + 2 + 32 + 25 + 8 + 2 + 9 = 80.
   2. Tier: `${indent}   ${dim('declared')} ${padRight(declared, 23)}${dim('actual')} ${actual}${flag}` with `declared = profile ? profile.model + ' ' + profile.effort : ''` (longest 22), `actual = s.model ?? ''`, `flag = profile && s.model && s.model !== profile.model ? ' ' + bad('!=') : ''` (Req 4.3, D10; a `+`-joined `model` is flagged); longest 66 characters; omitted when both are empty (Req 3.5's empty columns).
-  3. The tool or result line (`:205-209`) unchanged.
+  3. The tool or result line (`src/watch/render.ts:205-209`) unchanged.
 - **Dependencies:** `AGENT_PROFILES`, `PHASE_ORDER` from `./ledger.js`.
-- **Reuses:** `padRight`, `fit`, the palette (`:16-19`, `:44-58`).
+- **Reuses:** `padRight`, `fit`, the palette (`src/watch/render.ts:16-19`, `src/watch/render.ts:44-58`).
 
 ### Component 5 — Usage fold (`src/watch/usage.ts`, new)
 - **Purpose:** The Req 5.4-5.6 algorithm over every run of a ledger, as a pure function spec 9 can call without the tool (D5).
@@ -102,7 +102,7 @@ function readUsage(p) {
 - **Purpose:** Read one or two ledgers and return the table (Req 5.1-5.3, 5.7).
 - **Interfaces:** `action.enum` (`src/tools/harness.ts:46`) gains `'usage'`; new property `compareSpecName: { type: 'string', description: 'Second spec for a side-by-side usage table (usage action)' }` beside `specName` (`:49-52`; `additionalProperties: false` at `:95` bars it otherwise); `harnessHandler` (`:109-120`) gains `case 'usage'`, its default message names five actions, and the tool `description` (`:29-40`) gains one sentence. `async function usageAction(args: any, context: ToolContext): Promise<ToolResponse>`: `selectRoots`, `PathUtils.getSpecPath` (`:660-661`), spec dir must exist (`:664-670`), ledger via `PathUtils.safeJoin(specDir, 'harness-events.jsonl')` with `ENOENT` as empty (`:673-683`), `parseJsonl` (`:697`), the same for `compareSpecName`. Returns `{ success: true, message: formatUsageTable(report, compare), data: { report, compare, delta } }`, `compare` and `delta` only for two specs (Req 5.7). No process spawned.
 - **Dependencies:** `buildUsageReport`, `usageDelta`, `formatUsageTable` from `../watch/usage.js`; `ToolResponse` (`src/types.ts:218-222`).
-- **Reuses:** `phaseLogAction`'s read pattern (`:658-683`).
+- **Reuses:** `phaseLogAction`'s read pattern (`src/tools/harness.ts:658-683`).
 
 ### Component 7 — Skill, format and doc text
 - **Purpose:** No skill or agent writes `tokens`; the docs say who does (Req 2, 5.10, 6.2).
@@ -172,10 +172,10 @@ Tool `data`: `{ report: UsageReport; compare?: UsageReport; delta?: UsageDelta[]
 ## Testing Strategy
 
 - **Unit:**
-  - `src/__tests__/hook-spawn-events.test.ts` (drives the real script, `:13`, `:36-41`): a fixture transcript with three `assistant` entries carrying `message.usage` (two models), one `user` entry, one `assistant` entry without `usage`, one torn line. `SubagentStop` with `transcript_path` for `sdd-implementer` asserts the six keys against sums from the test's own literals and `model` as the two ids joined with `+`; for `sdd-implementation-orchestrator` a `spawn.end` row appears (inverting `:110-116`, Req 1.8); no `transcript_path`, or a missing path, gives `tokens: 'unknown'` and no `input`; `agent.stop` carries numeric `tokens` (Req 1.7). Assertions read only the appended JSON lines (`:9-11`).
-  - `src/watch/__tests__/ledger.test.ts`: a hook `spawn.end` with the six keys sets `SpawnNode.model`, the kinds, `tokens` and `tokensTotal` (Req 7.4); `spawn.end tokens=84000` then `spawn.usage tokens=1` keeps 84,000 (Req 7.2); `loadAgentProfiles(['/nonexistent'])` and a `not json` file give `{}`; the default call has 12 keys, `sdd-checker` at `claude-sonnet-5` `high` (Req 3.6). `:169-226` unchanged.
-  - `src/watch/__tests__/render.test.ts`: `:53` and `:56` split into a head-line assertion without model columns and a tier-line assertion (`declared claude-opus-4-8 high`, `declared claude-opus-4-8 xhigh`, empty actual; Req 4.6); a `spawn.end model=claude-sonnet-5` for the implementer renders `actual claude-sonnet-5 !=`; the fixture at width 80 renders no line above 80 characters and the orchestrator tier line `declared claude-opus-4-8 high` / `actual claude-opus-4-8` without `!=` (Req 4.5, 4.7).
-  - `src/tools/__tests__/harness.test.ts` (temp store `:12-29`, `writeLedger` as `:248-253`): one spec (`data.report` totals, `message` holds the phase row); two specs (`compareSpecName`, `delta`); an unknown cell; an old `review-gate`-shape ledger (`spawn.end` with digit `tokens`); the fixture (runs 2, 5 spawns, 4,554,189); the all-runs scope (a second run id with no `run.start` counted); a start-less `spawn.end` dropped, a start-less `spawn.usage` counted once (Req 5.4); an unknown spec dir fails naming it; a missing ledger gives `runs 0` (Req 5.8).
+  - `src/__tests__/hook-spawn-events.test.ts` (drives the real script, `src/__tests__/hook-spawn-events.test.ts:13`, `src/__tests__/hook-spawn-events.test.ts:36-41`): a fixture transcript with three `assistant` entries carrying `message.usage` (two models), one `user` entry, one `assistant` entry without `usage`, one torn line. `SubagentStop` with `transcript_path` for `sdd-implementer` asserts the six keys against sums from the test's own literals and `model` as the two ids joined with `+`; for `sdd-implementation-orchestrator` a `spawn.end` row appears (inverting `src/__tests__/hook-spawn-events.test.ts:110-116`, Req 1.8); no `transcript_path`, or a missing path, gives `tokens: 'unknown'` and no `input`; `agent.stop` carries numeric `tokens` (Req 1.7). Assertions read only the appended JSON lines (`src/__tests__/hook-spawn-events.test.ts:9-11`).
+  - `src/watch/__tests__/ledger.test.ts`: a hook `spawn.end` with the six keys sets `SpawnNode.model`, the kinds, `tokens` and `tokensTotal` (Req 7.4); `spawn.end tokens=84000` then `spawn.usage tokens=1` keeps 84,000 (Req 7.2); `loadAgentProfiles(['/nonexistent'])` and a `not json` file give `{}`; the default call has 12 keys, `sdd-checker` at `claude-sonnet-5` `high` (Req 3.6). `src/watch/__tests__/ledger.test.ts:169-226` unchanged.
+  - `src/watch/__tests__/render.test.ts`: `src/watch/__tests__/render.test.ts:53` and `src/watch/__tests__/render.test.ts:56` split into a head-line assertion without model columns and a tier-line assertion (`declared claude-opus-4-8 high`, `declared claude-opus-4-8 xhigh`, empty actual; Req 4.6); a `spawn.end model=claude-sonnet-5` for the implementer renders `actual claude-sonnet-5 !=`; the fixture at width 80 renders no line above 80 characters and the orchestrator tier line `declared claude-opus-4-8 high` / `actual claude-opus-4-8` without `!=` (Req 4.5, 4.7).
+  - `src/tools/__tests__/harness.test.ts` (temp store `src/tools/__tests__/harness.test.ts:12-29`, `writeLedger` as `src/tools/__tests__/harness.test.ts:248-253`): one spec (`data.report` totals, `message` holds the phase row); two specs (`compareSpecName`, `delta`); an unknown cell; an old `review-gate`-shape ledger (`spawn.end` with digit `tokens`); the fixture (runs 2, 5 spawns, 4,554,189); the all-runs scope (a second run id with no `run.start` counted); a start-less `spawn.end` dropped, a start-less `spawn.usage` counted once (Req 5.4); an unknown spec dir fails naming it; a missing ledger gives `runs 0` (Req 5.8).
   - `src/__tests__/agent-profiles.test.ts` (new): `harness/agent-profiles.json` has 12 keys; each key's `model` and `effort` equal the frontmatter lines of `harness/agents/<key>.md`; `JSON.stringify(JSON.parse(text), null, 2) + '\n'` equals the file text. Drift detection runs in CI (`.github/workflows/ci.yml:30`) and in scenario (5).
 - **Integration:** `runWatch` with `once` (`src/watch/__tests__/index.test.ts:62-68` pattern) on a temp store holding the fixture asserts `tokens 1.6M` and the orchestrator tier line; the hook script against a real transcript (scenario 1).
 - **End-to-end** (the entry's scenario, run by the verifier from the worktree with `HOOK=<worktree>/harness/hooks/sdd-activity.sh`):
@@ -189,7 +189,7 @@ Tool `data`: `{ report: UsageReport; compare?: UsageReport; delta?: UsageDelta[]
 
 - D1 — Two-line agent entry (head, tier), each within 80 columns: options were one line with `claude-` stripped, one line with the agent name truncated, or a tier line; chosen because a 31-character name plus two 16-character ids cannot share 80 columns with the role, and Req 4.5 pins full ids.
 - D2 — Profile `role` = the label between `SDD ` and the first `:` of `description`, else the name without `sdd-`: options were the first sentence after the colon, a new frontmatter key, or the label; chosen because every description starts `SDD <role>:` and the view does not read `role`.
-- D3 — `AGENT_PROFILES` keeps its name as `loadAgentProfiles()` with an optional candidate list: options were a call per frame, a lazy getter, or a module constant; chosen because `render.ts:1` keeps its import and the trailing parameter serves the tests.
+- D3 — `AGENT_PROFILES` keeps its name as `loadAgentProfiles()` with an optional candidate list: options were a call per frame, a lazy getter, or a module constant; chosen because `src/watch/render.ts:1` keeps its import and the trailing parameter serves the tests.
 - D4 — `PHASE_ORDER` moves to `ledger.ts`, exported: options were export from `render.ts` or duplicate in `harness.ts`; chosen because the order is a model fact and `render.ts` already imports `ledger.ts`.
 - D5 — The fold is a pure module `src/watch/usage.ts`; the tool only reads files: options were inline in `harness.ts` or a module; chosen because spec 9 renders the same report without the tool.
 - D6 — "states unknown" is any non-digit `tokens` value, not only `unknown` or `na`: options were the two literals or any non-digit value; chosen because a future junk value must be marked, not dropped.
@@ -214,3 +214,4 @@ Tool `data`: `{ report: UsageReport; compare?: UsageReport; delta?: UsageDelta[]
 ## Revision History
 
 - **v1** (2026-09-19) — Initial draft.
+  - **Lint pass.** 27 fixed (L-2, L-7-L-9, L-19-L-30, L-53, L-70-L-78, L-86): bare or unqualified citations given their full path from the code root. Rejected (60): L-3 — `vitest.config.ts` is already the full path from the code root, a root-level file has no directory to prepend; L-1, L-4-L-6, L-10-L-18, L-31-L-52, L-54-L-69, L-79-L-85, L-87 — each named identifier is new or proposed text this design adds, or is attributed to a different citation earlier or later in the same block; none is literally inside the specific range flagged.
````
