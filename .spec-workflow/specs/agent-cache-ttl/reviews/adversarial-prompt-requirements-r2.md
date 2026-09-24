# Adversarial Review — agent-cache-ttl/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-memory-requirements.md using this format:

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

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v3 before the lint pass fixed anything; 0 errors, 29 citation-identifier warnings, all rejected again as unchanged addition-point citations (same 12 ranges as v1/v2). A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v3 lint commit changed: the `## Lint commit` section below (the v3 lint changed no citation, only trimmed 12 prose words). Still open (warning = your call): the 29 citation-identifier warnings — proposed-new identifiers absent from cited ranges because they do not exist yet; ruled at v1 as addition points, re-raise only with new evidence.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): agent-cache-ttl requirements v2` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines; a `## Lint commit` section follows it.
- Read the Revision History line for v3 first and attack those changes before anything else. v3 was the round-1 adversarial response and accepted all six findings (R1-1..R1-6). Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v3 delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised is marked `Compounds: R1-<n>`. Label each round-2 MUST_FIX `fix-induced` when the v3 delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the v3 fix did not touch.
- Pay special attention to R1-1's rewrite of Req 6 criterion 7 and decision D10: the block-until-restart gate was retargeted from the pre-merge "ready for review" transition to a post-merge artifact (the spec's retrospective start / a mandatory recorded verification). The human's Gate A ruling (the live scenarios (1),(2),(3),(5) are non-deferrable and mandatory, NOT a soft deferral) is closed — do not re-open it. Attack only whether the rewrite is now internally consistent and satisfiable: no clause still gates a pre-merge transition on post-merge evidence, no clause silently weakened "mandatory" back to "deferred", and scenarios (4)/(6) are unchanged.
- Fresh lens for this round (one the prior round did not use): a cold read for internal contradictions and a truth table of the stated cases — enumerate every acceptance criterion in Requirements 1-6, build the case table for the cache-tier / unknown / dash / gap-rewrite outputs, and find any pair of criteria that cannot both hold.
- Closed by ruling, do not re-open: none. The Gate A block-vs-defer choice is a human ruling, closed.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-requirements-r2.md

## Changes since e3fdf8c

````diff
diff --git a/.spec-workflow/specs/agent-cache-ttl/requirements.md b/.spec-workflow/specs/agent-cache-ttl/requirements.md
index 5f3fd20..8b43127 100644
--- a/.spec-workflow/specs/agent-cache-ttl/requirements.md
+++ b/.spec-workflow/specs/agent-cache-ttl/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-This spec gives the three SDD orchestrator agents a one-hour prompt cache lifetime, so a wait of more than five minutes on a worker does not force a full rewrite of the prefix. It is for the harness operator, who pays for those rewrites against the Max plan limit. It adds the lifetime to the agent frontmatter and the agent profiles, three cache fields to every hook-written `spawn.end` row, cache columns to `harness usage`, and a `cacheTtl` value on `run.start` that shows when a setting overrides the frontmatter.
+This spec gives the three SDD orchestrator agents a one-hour prompt cache lifetime, so a wait over five minutes on a worker does not force a full prefix rewrite, for the harness operator who pays against the Max plan limit. It adds the lifetime to agent frontmatter and profiles, three cache fields to every `spawn.end` row, cache columns to `harness usage`, and a `cacheTtl` value on `run.start` marking an override.
 
 ## Alignment with Product Vision
 
-No `steering/product.md` exists in this spec store; alignment is to the efficiency plan's order "tokens, then wall clock" (`docs/harness-efficiency-plan.md:8-9`) and to decomposition entry 13 (`.spec-workflow/spec-decomposition/decomposition.md:394-464`). The entry measured 92 of 95 after-gap rewrites on the three orchestrators and estimates about 35% less orchestrator input cost with a one-hour lifetime. Every number this spec adds is one the hook measures from the transcript, so the retro can prove the saving per spawn.
+No `steering/product.md` exists in this spec store; alignment is to the efficiency plan's order "tokens, then wall clock" (`docs/harness-efficiency-plan.md:8-9`) and decomposition entry 13 (`.spec-workflow/spec-decomposition/decomposition.md:394-464`), which measured 92 of 95 after-gap rewrites on the three orchestrators and estimates about 35% less orchestrator input cost on one hour. Every number added is one the hook measures from the transcript, so the retro can prove the saving.
 
 ## Requirements
 
@@ -19,8 +19,8 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 1. THE frontmatter of `harness/agents/sdd-document-orchestrator.md`, `harness/agents/sdd-implementation-orchestrator.md` and `harness/agents/sdd-closeout-orchestrator.md` SHALL carry the line `experimental: { cacheTtl: 1h }` directly after the `effort` line (today line 5 in each: `harness/agents/sdd-document-orchestrator.md:1-20`, `harness/agents/sdd-implementation-orchestrator.md:1-8`, `harness/agents/sdd-closeout-orchestrator.md:1-12`) (D9).
 2. THE other nine files under `harness/agents/` SHALL carry no `experimental` key and no `cacheTtl`; this includes `sdd-retro-orchestrator` (decomposition Decided list).
 3. WHEN `node scripts/sync-plugin-assets.cjs` runs THEN every plugin root's `agents/` copy SHALL carry the same line, byte for byte. The existing whole-directory copy (`scripts/sync-plugin-assets.cjs:67-74`) already does this; no new copy logic is added.
-4. WHEN `buildProfiles` (`scripts/sync-plugin-assets.cjs:76-110`) builds `harness/agent-profiles.json` THEN each agent entry SHALL carry a fourth string key `cacheTtl`: read from the agent's `experimental` frontmatter value the same generic per-line split that already captures `model` and `effort` (`scripts/sync-plugin-assets.cjs:93-98`), or `default` when the agent has no `experimental` key or the value names no `cacheTtl`. The new key joins `model`, `effort` and `role` in the object literal built at `scripts/sync-plugin-assets.cjs:107`, and the output stays byte-identical across repeated runs.
-5. WHEN the sync has run THEN `harness/agent-profiles.json` SHALL show `cacheTtl: "1h"` for the three orchestrators and `cacheTtl: "default"` for the other nine, and `npm run check:plugin-assets` SHALL pass.
+4. WHEN `buildProfiles` (`scripts/sync-plugin-assets.cjs:76-110`) builds `harness/agent-profiles.json` THEN each agent entry SHALL carry a fourth string key `cacheTtl`: the token between `cacheTtl:` and the next `}` in the `experimental` value, trimmed — not the generic per-line split at `scripts/sync-plugin-assets.cjs:93-98`, which leaves `1h }` — or `default` when there is no `experimental` key or no `cacheTtl` in it. The key joins `model`, `effort` and `role` in the `scripts/sync-plugin-assets.cjs:107` object literal; output stays byte-identical across runs.
+5. WHEN the sync has run THEN `harness/agent-profiles.json` SHALL show `cacheTtl: "1h"` for the three orchestrators and `cacheTtl: "default"` for the other nine, and `npm run check:plugin-assets` SHALL pass. A test beside `scripts/sync-plugin-assets.cjs` SHALL assert the literal `"1h"` on a fixture frontmatter, independent of `check:plugin-assets` (a `buildProfiles` re-run, so it cannot catch a shared wrong extraction).
 6. IF a frontmatter is edited and the sync is not re-run THEN `node scripts/sync-plugin-assets.cjs --check` SHALL fail on `harness/agent-profiles.json` (the existing comparison, `scripts/sync-plugin-assets.cjs:112-128`).
 
 ### Requirement 2 — The watch view shows the declared lifetime
@@ -32,7 +32,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 1. `AgentProfile` (`src/watch/ledger.ts:38-42`) SHALL gain an optional string `cacheTtl`. `loadAgentProfiles` (`src/watch/ledger.ts:51-78`) SHALL copy it when it is a string and SHALL still accept an entry without it, so an older `dist/agent-profiles.json` still loads; an entry without it reads as `default`.
 2. WHEN the tier line of an agent is drawn (`src/watch/render.ts:218-227`) AND the agent's profile has `cacheTtl` other than `default` THEN the declared text SHALL be `<model> <effort> <cacheTtl>` (for example `claude-opus-4-8 high 1h`) (D6).
 3. WHEN the profile's `cacheTtl` is `default` or absent THEN the tier line SHALL be unchanged from today.
-4. The declared text SHALL still fit the tier line without wrapping at the widths the existing render tests use (`src/watch/__tests__/render.test.ts`).
+4. The declared text SHALL fit the tier line without wrapping at the widths the existing render tests use (`src/watch/__tests__/render.test.ts`), with a separating space kept even at the pad width; design picks the width that holds for both the 1h and default agents.
 
 ### Requirement 3 — The lifetime a spawn got, on its row
 
@@ -64,7 +64,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 3. A spawn with no `spawn.end` that carries digit-string `tokens` (a `spawn.usage`-only spawn, a supervisor-written interrupted row) SHALL count 1 in `cacheUnknown`.
 4. A spawn whose provider is `deepseek` SHALL add nothing to the cache numbers and nothing to `cacheUnknown`; its agent line SHALL print `-` in the three cache columns (D5).
 5. The single-spec table (`src/watch/usage.ts:288-299`) SHALL add three columns after `tokens`, headed `cw5m`, `cw1h` and `gapRewrites`, on every agent line, every phase total line and the grand total line.
-6. IF a cell has `cacheUnknown` equal to its Anthropic spawn count THEN its three cache columns SHALL print `unknown`. IF `cacheUnknown` is above 0 and below that count THEN the three columns SHALL print the sums, and the `gapRewrites` column SHALL end with ` (+N unknown)` where N is `cacheUnknown` (D5).
+6. IF a cell's `cacheUnknown` equals its Anthropic spawn count THEN its cache columns SHALL print `unknown`: a per-agent cell's count is its own `spawns` (single-provider; DeepSeek keys as `agent@deepseek`); a total cell's is `ph.providers.anthropic.spawns` or `report.providers.anthropic.spawns`. IF `cacheUnknown` is above 0 and below that count THEN the columns SHALL print the sums, `gapRewrites` ending ` (+N unknown)`, N being `cacheUnknown` (D5).
 7. The two-spec table (`src/watch/usage.ts:301-330`) SHALL add the same three columns for each side, on every agent line, phase total line and grand total line, with the same `unknown` and `-` rules. The per-phase delta stays spawns and tokens only.
 8. WHEN `harness usage` runs on the `provider-per-role` ledger (no row has the new keys) THEN every Anthropic agent line and every total SHALL print `unknown` in the three columns, and the tokens columns SHALL be unchanged from today.
 9. `src/watch/__tests__/usage.test.ts` SHALL prove criteria 2 to 8 with ledger fixtures, including a mixed cell (some spawns known, some not) and a compare of a ledger with the keys against one without.
@@ -78,20 +78,20 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 1. The supervisor's Step 0 (`harness/skills/sdd-continue/SKILL.md:33-56`) SHALL gain one preflight item that runs a new shipped script `harness/skills/sdd-continue/references/sdd-cache-ttl.sh` and keeps the text after `cacheTtl=` on its stdout line as `CACHE_TTL` (D4).
 2. The script SHALL print exactly one stdout line `cacheTtl=VALUE` and exit 0 in every case. It SHALL decide VALUE in this order, first match wins (D7, D8, D11):
    1. `unknown` when `claude --version` fails or prints no version number;
-   2. `unsupported` when the version is below 2.1.248;
+   2. `unsupported` when the version, compared as three numeric components (major, minor, patch), is below 2.1.248;
    3. `FORCE_PROMPT_CACHING_5M=VALUE` when that variable is set to a non-empty value other than `0`;
    4. `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=VALUE` when that variable is set and non-empty;
-   5. `subagentPromptCacheTtl=VALUE` when that key is set in the code root's `.claude/settings.local.json`, else its `.claude/settings.json`, else `~/.claude/settings.json` (first file that sets it);
+   5. `subagentPromptCacheTtl=VALUE` when that key is set in the code root's `.claude/settings.local.json`, else its `.claude/settings.json`, else `~/.claude/settings.json` (first file that sets it; the code root is the script's working directory);
    6. `per-agent` otherwise.
 3. The `run.start` call (`harness/skills/sdd-continue/SKILL.md:100-102`) SHALL add `cacheTtl=CACHE_TTL`. The `event.sh` split at the first `=` (`harness/skills/sdd-continue/references/formats.md:170-182`) keeps a value that contains `=` whole (D3).
-4. WHEN `CACHE_TTL` is not `per-agent` THEN the supervisor SHALL print one warning line at Step 0, `warning: cacheTtl VALUE — orchestrators will not get the one-hour cache from frontmatter; continuing`, and SHALL continue the run. It SHALL NOT print the warning again in the run, SHALL NOT stop, and SHALL NOT change any setting.
+4. WHEN `CACHE_TTL` is not `per-agent` THEN the supervisor SHALL print one warning line at Step 0 and continue: `warning: cacheTtl unknown — orchestrators' cache lifetime could not be read; continuing` for `unknown`, else `warning: cacheTtl VALUE — orchestrators will not get the one-hour cache from frontmatter; continuing`. It SHALL NOT repeat the warning, stop the run, or change any setting.
 5. The `run.start` row in the event table (`harness/skills/sdd-continue/references/formats.md:194`) SHALL list `cacheTtl` and its values.
-6. The script SHALL follow the shipped-script pattern of `harness/skills/sdd-continue/references/sdd-providers.sh:1-30` (a node body in a single-quoted shell string). It SHALL have a new vitest test in `src/__tests__/`, beside `src/__tests__/providers-map.test.ts`, that covers each of the six values; the test SHALL put a stub executable named `claude` on `PATH` and point `HOME` at a temporary directory.
+6. The script SHALL follow the shipped-script pattern of `harness/skills/sdd-continue/references/sdd-providers.sh:1-30` (a node body in a single-quoted shell string). A new vitest test beside `src/__tests__/providers-map.test.ts` SHALL cover each of the six values: a stub `claude` on `PATH`, working directory a temporary fixture (the code root of criterion 2.5), `HOME` a separate directory, with settings files in all three locations so local/project/user precedence and first-file-wins (D8/D11) are exercised.
 7. THE supervisor's own cache lifetime SHALL NOT change: it is a main session and already has one hour (decomposition Decided list).
 
 ### Requirement 6 — End-to-end verification
 
-**User Story:** As the harness operator, I want the decomposition's six verification scenarios to be checks with a clear pass or fail, so that the PR proves the lifetime is applied and measured.
+**User Story:** As the harness operator, I want the decomposition's six verification scenarios to be checks with a clear pass/fail, so that the PR proves the lifetime is applied and measured.
 
 #### Acceptance Criteria
 
@@ -101,7 +101,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 4. Scenario (4): `harness usage` on the fixture ledger SHALL print the three columns with digits, and on the `provider-per-role` ledger SHALL print them as `unknown` (Requirement 4 criterion 8).
 5. Scenario (5): A run started with `FORCE_PROMPT_CACHING_5M=1` exported SHALL have `cacheTtl=FORCE_PROMPT_CACHING_5M=1` on its `run.start` row, and the supervisor output SHALL contain exactly one `warning: cacheTtl` line.
 6. Scenario (6): `npm run check:plugin-assets`, `claude plugin validate . --strict` (at the repository root, as `.spec-workflow/agent-rules.md` runs it) and `npm test` SHALL pass.
-7. IF the session that runs the end-to-end gate does not run the changed hook, agents or supervisor skill (this machine runs the harness from the main checkout, so worktree changes are live only after merge and a session restart) THEN scenarios (1), (2), (3) and (5) SHALL NOT be recorded as passed from that session; the pull request SHALL stay unopened, or if already opened SHALL stay not marked ready for review, until a session restarted on the rebuilt harness has run scenarios (1), (2), (3) and (5) and recorded their evidence. Scenarios (4) and (6) SHALL run and pass before the PR is opened or marked ready (D10).
+7. IF the session running the end-to-end gate does not run the changed hook, agents or supervisor skill (this machine runs the harness from the main checkout: worktree changes are live only after merge and a restart) THEN scenarios (1), (2), (3) and (5) SHALL NOT be recorded as passed from it, but the PR MAY still open, be reviewed and merge on scenarios (4) and (6) alone. The spec's retrospective phase SHALL NOT start until a rebuilt-harness restart has run them and recorded evidence. Scenarios (4) and (6) SHALL pass before the PR opens or is marked ready (D10).
 
 ## Non-Functional Requirements
 
@@ -109,12 +109,12 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 - The hook's extra work is one pass over the calls `readUsage` (`harness/hooks/sdd-activity.sh:41-64`) already parsed; the hook stays within its 5-second timeout (`harness/hooks/hooks.json:27-37`).
 
 ### Reliability
-- A missing or malformed cache field yields `unknown`, never a missing row and never a partial sum shown as known (Requirement 3 criteria 6 to 8).
-- The override probe never stops a run and never changes a setting (Requirement 5 criteria 2 and 4).
+- A missing or malformed cache field yields `unknown`, never a missing row or a partial sum shown as known (Requirement 3 criteria 6 to 8).
+- The override probe never stops a run or changes a setting (Requirement 5 criteria 2 and 4).
 - Ledgers written before this spec and an older `dist/agent-profiles.json` still load and fold with no error.
 
 ### Security
-- The hook change touches `harness/hooks/`, a sensitive path in `.spec-workflow/agent-rules.md`; the task that changes it is high risk.
+- The hook change touches `harness/hooks/`, a sensitive path in `.spec-workflow/agent-rules.md`; the task is high risk.
 
 ## Decisions taken in this document
 
@@ -127,7 +127,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 - D7 — Claude Code version unreadable: options were record unknown and warn, record unsupported, record per-agent; chose unknown because it neither hides nor invents a fact.
 - D8 — Settings files the probe reads: options were the code root's local and project settings plus the user settings, those three plus managed settings, user settings only; chose the three because they are the files a user edits here, and managed settings are not used on this machine.
 - D9 — Frontmatter form: options were the one-line flow mapping from the decomposition, a two-line block mapping; chose the one-line form because the profile builder parses one line per key.
-- D10 — Live scenarios when the session runs the old harness: options were defer the live half with a verification deferral, block the PR until a restarted session runs them; Gate A chose blocking the PR until a session restarted on the rebuilt harness has run scenarios (1), (2), (3) and (5) and recorded their evidence, superseding the deferral this document first recorded.
+- D10 — Live scenarios when the session runs the old harness: options were defer the live half with a verification deferral, or block progress until a restarted session runs them; Gate A chose blocking — not deferring — until a rebuilt-harness restart has run scenarios (1), (2), (3) and (5) and recorded their evidence, superseding the deferral first recorded. The block targets the spec's post-merge retrospective start, reachable after a restart, not v2's pre-merge "ready for review" state, which no restart reaches before merge.
 - D11 — Override precedence: options were first match in force flag, environment variable, then settings files local, project, user, report every override found; chose the first match because the run start row holds one value and any match already means the frontmatter does not apply.
 
 ## Scope notes
@@ -148,3 +148,11 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
   - **RI-1 — Accepted.** Removed the verification-deferral path for live scenarios (1), (2), (3), (5): Requirement 6 criterion 7 now states the blocking condition (the PR stays unopened, or not marked ready, until a session restarted on the rebuilt harness has run those scenarios and recorded their evidence); scenarios (4) and (6) are unchanged. D10 in the decision log is rewritten to record the block-until-restart choice in place of the superseded deferral; both citations to D10 in the document now agree.
   - **RI-2 — Rejected (already correct).** The document already states each recorded Gate A choice: D1 uses the earliest line timestamp per message id, D5 counts unknown with a DeepSeek dash, D3 uses one key holding the setting name and value, D2 marks all three fields unknown on a partial split. No contradiction found, so no edit made.
   - **Lint pass.** 0 fixed; rejected: L1-29 (unchanged since v1, suppressed per rule 11).
+- **v3** (2026-09-24) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/2/3).
+  - **R1-1 — Accepted (MUST_FIX).** Criterion 7 gated pre-merge "ready for review" on post-merge-only evidence, a deadlock; reworded to merge on (4)/(6) alone and block the retrospective start instead; block-vs-defer unchanged. D10 reworded to match.
+  - **R1-2 — Accepted (SHOULD_FIX).** The generic split leaves a trailing brace; criterion 4 names the real extraction, criterion 5 tests `"1h"` independently.
+  - **R1-3 — Accepted (SHOULD_FIX).** "Anthropic spawn count" was undefined for mixed-provider totals; criterion 6 now names the source per cell type.
+  - **R1-4 — Accepted (MINOR).** Added that a separating space survive at pad width; pad left to design.
+  - **R1-5 — Accepted (MINOR).** Criterion 2.2 states a numeric version compare; criterion 4 splits the warning so `unknown` no longer overclaims.
+  - **R1-6 — Accepted (MINOR).** Criterion 6 names the code-root fixture and per-tier settings files the test stages; criterion 2.5 defines the code root.
+  - **Lint pass.** 0 fixed; rejected: L1-29 (unchanged, suppressed per rule 11).
````

## Lint commit 045221b

````diff
diff --git a/.spec-workflow/specs/agent-cache-ttl/requirements.md b/.spec-workflow/specs/agent-cache-ttl/requirements.md
index 4beadc9..8b43127 100644
--- a/.spec-workflow/specs/agent-cache-ttl/requirements.md
+++ b/.spec-workflow/specs/agent-cache-ttl/requirements.md
@@ -2,11 +2,11 @@
 
 ## Introduction
 
-This spec gives the three SDD orchestrator agents a one-hour prompt cache lifetime, so a wait over five minutes on a worker does not force a full prefix rewrite, for the harness operator who pays for those rewrites against the Max plan limit. It adds the lifetime to agent frontmatter and profiles, three cache fields to every `spawn.end` row, cache columns to `harness usage`, and a `cacheTtl` value on `run.start` marking an override.
+This spec gives the three SDD orchestrator agents a one-hour prompt cache lifetime, so a wait over five minutes on a worker does not force a full prefix rewrite, for the harness operator who pays against the Max plan limit. It adds the lifetime to agent frontmatter and profiles, three cache fields to every `spawn.end` row, cache columns to `harness usage`, and a `cacheTtl` value on `run.start` marking an override.
 
 ## Alignment with Product Vision
 
-No `steering/product.md` exists in this spec store; alignment is to the efficiency plan's order "tokens, then wall clock" (`docs/harness-efficiency-plan.md:8-9`) and decomposition entry 13 (`.spec-workflow/spec-decomposition/decomposition.md:394-464`), which measured 92 of 95 after-gap rewrites on the three orchestrators and estimates about 35% less orchestrator input cost on one hour. Every number added is one the hook measures from the transcript, so the retro can prove the saving per spawn.
+No `steering/product.md` exists in this spec store; alignment is to the efficiency plan's order "tokens, then wall clock" (`docs/harness-efficiency-plan.md:8-9`) and decomposition entry 13 (`.spec-workflow/spec-decomposition/decomposition.md:394-464`), which measured 92 of 95 after-gap rewrites on the three orchestrators and estimates about 35% less orchestrator input cost on one hour. Every number added is one the hook measures from the transcript, so the retro can prove the saving.
 
 ## Requirements
 
@@ -91,7 +91,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 
 ### Requirement 6 — End-to-end verification
 
-**User Story:** As the harness operator, I want the decomposition's six verification scenarios to be checks with a clear pass or fail, so that the PR proves the lifetime is applied and measured.
+**User Story:** As the harness operator, I want the decomposition's six verification scenarios to be checks with a clear pass/fail, so that the PR proves the lifetime is applied and measured.
 
 #### Acceptance Criteria
 
@@ -109,12 +109,12 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 - The hook's extra work is one pass over the calls `readUsage` (`harness/hooks/sdd-activity.sh:41-64`) already parsed; the hook stays within its 5-second timeout (`harness/hooks/hooks.json:27-37`).
 
 ### Reliability
-- A missing or malformed cache field yields `unknown`, never a missing row and never a partial sum shown as known (Requirement 3 criteria 6 to 8).
-- The override probe never stops a run and never changes a setting (Requirement 5 criteria 2 and 4).
+- A missing or malformed cache field yields `unknown`, never a missing row or a partial sum shown as known (Requirement 3 criteria 6 to 8).
+- The override probe never stops a run or changes a setting (Requirement 5 criteria 2 and 4).
 - Ledgers written before this spec and an older `dist/agent-profiles.json` still load and fold with no error.
 
 ### Security
-- The hook change touches `harness/hooks/`, a sensitive path in `.spec-workflow/agent-rules.md`; the task that changes it is high risk.
+- The hook change touches `harness/hooks/`, a sensitive path in `.spec-workflow/agent-rules.md`; the task is high risk.
 
 ## Decisions taken in this document
 
@@ -155,3 +155,4 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
   - **R1-4 — Accepted (MINOR).** Added that a separating space survive at pad width; pad left to design.
   - **R1-5 — Accepted (MINOR).** Criterion 2.2 states a numeric version compare; criterion 4 splits the warning so `unknown` no longer overclaims.
   - **R1-6 — Accepted (MINOR).** Criterion 6 names the code-root fixture and per-tier settings files the test stages; criterion 2.5 defines the code root.
+  - **Lint pass.** 0 fixed; rejected: L1-29 (unchanged, suppressed per rule 11).
````
