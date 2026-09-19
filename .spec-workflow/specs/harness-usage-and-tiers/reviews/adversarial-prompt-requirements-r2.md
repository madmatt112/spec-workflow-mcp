# Adversarial Review — harness-usage-and-tiers/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass ran. A rule with no finding listed here passed. Re-verify only citations the v2 lint commit changed: see the `## Lint commit` section below. The v2 lint pass fixed 0 and rejected all 39 findings as forward-looking (`usage`/`gate`/`SHALL gain` fields the document says do not exist yet), clause-mismatch (the token sits in a different clause than the cited line anchors), or Revision-History shorthand; the reasons are recorded in the v2 `Lint pass` Revision-History bullet. Still open (all rejected; error = your call, warning = your call, info = a note) — judge whether the rejection rationale holds, especially the three the v2 edits introduced:
  - L-12 (warning, citation-identifier, line 53): `vitest` absent from `scripts/copy-static.cjs:45-61, src/core/workspace-initializer.ts:9` — new in v2's Req 3 criterion 7.
  - L-24 (warning, citation-identifier, line 77): `compareSpecName` absent from `src/tools/harness.ts:49-92, :95` — new in v2's Req 5 criterion 3.
  - L-25 (warning, citation-identifier, line 79): `buildModel` absent from `src/watch/ledger.ts:200-202` — v2 changed this citation.
  - L-1..L-11, L-13..L-23, L-26..L-39 (warning/error/info, citation-identifier / citation-path / citation-bare): the same forward-looking or clause-mismatch tokens rejected in v1 and again in v2, including the `tsconfig.json` citation-path error at line 130 (rejected as already at the code root) and the bare `:83`/`:83-85` Revision-History shorthand at line 152.
- Changes: the diff from the newest `docs(sdd): harness-usage-and-tiers requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines; the v2 lint commit follows as `## Lint commit <short sha>`.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v2 delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. The v2 delta accepted all six round-1 findings (R1-1..R1-6): Req 3 gained a criterion 7 pinning the `copy-static.cjs → dist/agent-profiles.json` copy and `ledger.ts` two-step resolution; Req 5 criterion 4 was rewritten with a spawn-identity/counting rule and criterion 5 trimmed; Req 4 gained a criterion 7 on the render-width re-budget; Req 6 criterion 2 split the supervisor out; Req 5 criteria 2/3 pinned `PHASE_ORDER` export and the `compareSpecName` parameter; Req 2 criterion 1 was reworded. Attack these edits for internal contradiction, false claims about the code, and unimplementable criteria.
- Fresh lens for this round: the sub-agent that receives only the acceptance criteria — read each new/rewritten criterion cold and build a truth table of the stated cases (especially Req 5 criterion 4's spawn-identity counting on the double-`spawn.end` fixture), checking each criterion is testable and internally consistent.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 153032f

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
index 4a686e8..90d13e3 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
@@ -32,7 +32,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 
 #### Acceptance Criteria
 
-1. The orchestrator's `spawn.usage` row SHALL keep `agent`, `role`, `result`, `phase`, and `task` or `round`, and SHALL NOT carry `tokens`.
+1. The worker `spawn.usage` row an orchestrator writes SHALL keep `agent`, `role`, `result`, `phase`, and `task` or `round`, and SHALL NOT carry `tokens`.
 2. Every passage that tells an orchestrator to take `tokens=<n>` from the Agent result SHALL be rewritten to drop it: `harness/skills/sdd-document-phase/SKILL.md:46-48`, `:114-116`, `:144`; `harness/skills/sdd-implementation-phase/SKILL.md:53-57`; `harness/skills/sdd-closeout-phase/SKILL.md:46-49`; `harness/skills/sdd-retrospective/SKILL.md:33-39`; `harness/skills/sdd-continue/SKILL.md:213-216`; the `spawn.end` and `spawn.usage` rows of the event table, `harness/skills/sdd-continue/references/formats.md:193-194`; and the supervisor note at `harness/skills/sdd-continue/references/formats.md:200-201`. The command that finds every member: `grep -rn "footer\|tokens=" harness/skills`.
 3. The supervisor SHALL keep writing `spawn.start` for each orchestrator (`harness/skills/sdd-continue/SKILL.md:213-214`; the hook derives `spawn.start` from a brief path, `harness/hooks/sdd-activity.sh:78`, and an orchestrator launch has none) and SHALL write `spawn.usage` (`agent`, `role`, `result`) after the report in place of `spawn.end` (D1).
 4. The retro orchestrator SHALL keep `spawn.start` for the analyst (prompt-launched, `harness/skills/sdd-retrospective/SKILL.md:79-87`) and SHALL write `spawn.usage` in place of `spawn.end` (D2).
@@ -50,6 +50,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 4. The published package (`package.json` `files`: `dist/**/*`, `README.md`, `CHANGELOG.md`, `LICENSE`) SHALL carry the profiles, so `npx ... --watch` on another machine shows declared tiers (D4).
 5. IF the profiles file is missing or malformed at run time THEN the view SHALL render with empty model and effort columns, as `src/watch/render.ts:203` already does for an agent absent from the table, and never fail.
 6. The profiles SHALL cover all twelve agents, `sdd-checker` included.
+7. `scripts/copy-static.cjs` SHALL copy `harness/agent-profiles.json` to `dist/agent-profiles.json` beside its markdown/locales copies (`scripts/copy-static.cjs:45-61`), so the published package (`files: dist/**/*`) carries it (D4). `src/watch/ledger.ts` SHALL resolve it relative to its own module (`import.meta.url`, `src/core/workspace-initializer.ts:9`): the dist copy one level up, else `harness/agent-profiles.json` two levels up, so `vitest` (Req 4.6) and a built module both find it; else criterion 5's empty table.
 
 ### Requirement 4 — Watch view shows declared beside actual
 
@@ -63,6 +64,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 4. The header total (`src/watch/render.ts:79`, `src/watch/ledger.ts:316`) SHALL keep summing `tokens` per spawn, cache reads included; the split by kind lives in Requirement 5 (D10).
 5. WHEN `--watch --once` runs on the fixture ledger of Requirement 5.8 THEN an orchestrator row SHALL show declared `claude-opus-4-8 high` and actual `claude-opus-4-8`.
 6. `src/watch/__tests__/render.test.ts:53` and `:56`, which assert `fable-5-1 xhigh` for the orchestrator and `opus-4-8 xhigh` for the implementer from the hand-kept table, SHALL be updated to the generated profiles.
+7. The fixed-width layout at `src/watch/render.ts:202-203` (46-char role slack, 11-char model column) SHALL be re-budgeted before criterion 2 ships: the longest declared id is 16 characters (`claude-fable-5-1`, Req 3.3) and `padRight` does not truncate. Design owns the new widths; this criterion only pins `roleW`'s 16-character floor holding on an 80-column terminal with both model columns shown.
 
 ### Requirement 5 — Usage report
 
@@ -71,10 +73,10 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 #### Acceptance Criteria
 
 1. The `harness` tool (`src/tools/harness.ts:27-101`) SHALL gain action `usage` in the enum (`:46`) and dispatch (`:109-120`); it SHALL read only `harness-events.jsonl` under the resolved spec store through `PathUtils.safeJoin`, as `phase-log` does (`:673-683`), and spawn no process.
-2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `src/watch/ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
-3. WHEN called with a second spec (one optional parameter, D12) THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
-4. Per spawn, `tokens` SHALL come from a `spawn.end` row that carries a digit string, else from the `spawn.usage` folded onto the same spawn (`src/watch/ledger.ts:250-291`); every digit-string row SHALL be counted exactly once, so an orchestrator-written second `spawn.end` (the old retro shape, criterion 5) is not lost; a spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; a cell with such a spawn prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so, never for an empty cell.
-5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`src/watch/ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens; a seventh, the analyst's orchestrator-written second `spawn.end` (45,675), is dropped by the pairing at `:241` because the hook's `spawn.end` closed the node first (1,185,572 shown against 1,963,320 in the file). The header SHALL state the run count.
+2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`, a non-exported `const` the tool SHALL export or duplicate, since `harness.ts` is a separate module) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `src/watch/ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
+3. WHEN called with a second spec, an optional parameter `compareSpecName` (`src/tools/harness.ts:49-92`; `:95` bars unnamed ones) (D12), THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
+4. A spawn is identified by its `spawn.start` row; every `spawn.end` or `spawn.usage` row for the same agent up to its next `spawn.start` closes the same spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end`, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; `spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later `spawn.end` wins between two (the analyst: 01:10:28 no tokens, 01:10:49 carries `45675`, so 45,675). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5), not a reuse of `buildModel` (`src/watch/ledger.ts:188-291`), whose run scope is the last run only (`:200-202`) and whose pairing (`:241`) keeps only the first closing row.
+5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`src/watch/ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens, plus the analyst's second `spawn.end` criterion 4 counts (45,675, `1,185,572` shown against `1,963,320` in the file). The header SHALL state the run count.
 6. A spawn's phase SHALL be the `phase` key of its `spawn.start` or folded `spawn.usage`; else the phase whose `phase.start`-to-`phase.end` window holds the spawn's start; else `unknown` (D6).
 7. The response SHALL carry the table as text in `message` and the same numbers in `data` (D7).
 8. `src/tools/__tests__/harness.test.ts` SHALL cover: one spec; two specs; an unknown cell; an old ledger (`spawn.end` with `tokens`, `review-gate` shape); a new ledger (hook rows with the six keys); the all-runs scope. A fixture ledger in that shape SHALL be committed under `src/` for the verification scenario.
@@ -88,7 +90,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 #### Acceptance Criteria
 
 1. The agent files SHALL declare: the four orchestrators and `sdd-retro-analyst` `claude-opus-4-8` / `high` (landed at commit 599bdca on 2026-09-18, `harness/agents/sdd-document-orchestrator.md:4-5` and the other four); `sdd-drafter`, `sdd-adjudicator` `claude-fable-5-1` / `xhigh`; `sdd-reviewer`, `sdd-implementer`, `sdd-verifier` `claude-opus-4-8` / `xhigh`; `sdd-reviser`, `sdd-checker` `claude-sonnet-5` / `high`. This spec changes no agent file (D9).
-2. `docs/SDD-HARNESS.md:284-298` (model policy, lists the orchestrators and the analyst as Fable xhigh) SHALL match the agent files and name `harness/agent-profiles.json` as the generated source; `:325-328` SHALL say the hook measures tokens from the transcript.
+2. `docs/SDD-HARNESS.md:284-298` (model policy, groups the supervisor with the orchestrators and analyst as Fable xhigh) SHALL match the agent files and name `harness/agent-profiles.json` as the generated source for the orchestrators, the analyst and the workers; the supervisor has no agent file and is outside the generated profiles (Scope notes), so its row SHALL be described separately; `:325-328` SHALL say the hook measures tokens from the transcript.
 3. `npm run check:plugin-assets` and `claude plugin validate . --strict` SHALL pass with the agent files, the `plugins/` copies and `agent-profiles.json` in agreement.
 4. This document SHALL NOT specify a second cut (Sonnet for an orchestrator); that choice SHALL wait for a retro decision after one measured spec.
 
@@ -146,6 +148,14 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 ## Revision History
 
 - **v1** (2026-09-19) — Initial draft.
-  - **Lint pass.** 24 fixed; rejected: L-1, L-2, L-3, L-4, L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26, L-27, L-28, L-29, L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34, L-35, L-36, L-37, L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43, L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52, L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
-  - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39, L-40, L-41, L-42, L-47, L-48, L-49, L-50, L-54 (added missing directory prefixes), L-12 through L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21 through L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
+  - **Lint pass.** 24 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26–L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34–L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43–L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52–L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
+  - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39–L-42, L-47–L-50, L-54 (added missing directory prefixes), L-12–L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21–L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
   - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
+- **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
+  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains a criterion naming the build copy step into the dist tree and the two-step module-relative resolution a build and a test run both satisfy.
+  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5's counting criterion rewritten: spawn identity is the opening row, every closing row counts once, the end row beats the usage row, the later end row breaks a tie; it is now its own algorithm, not the watch view's fold. The all-runs criterion trimmed to drop the duplicated pairing explanation.
+  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 4 gains a criterion naming the fixed column widths that must be re-budgeted for the longer declared ids before the actual-model column ships; the new widths stay design's call.
+  - **R1-4 — Accepted (MINOR).** Requirement 6's docs criterion splits the supervisor out of the generated-source line; its tier row is described on its own.
+  - **R1-5 — Accepted (MINOR).** Requirement 5's phase-order criterion now says the constant must be exported or duplicated; its second-spec criterion names the new parameter and points at the schema it extends.
+  - **R1-6 — Accepted (MINOR).** Requirement 2's first criterion reworded to name the worker row an orchestrator writes, so it no longer collides with the criterion about the orchestrator's own row.
+  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5, L-26–L-28 (word sits in prose elsewhere in the sentence, not the cited range, as v1); L-6, L-7, L-8–L-11, L-29–L-34, L-36–L-37 (word belongs to a different clause than the cited line, same v1 pattern); L-12, L-24 (`vitest`/`compareSpecName` name a later-clause consumer or a not-yet-added parameter; checked `copy-static.cjs:45-61`, `workspace-initializer.ts:9`, `harness.ts:49-92,95`, absent as expected); L-13–L-18, L-19–L-23 (forward `SHALL gain`/`SHALL document` claims, citation is today's extension point, as v1); L-25 (`buildModel` named at `:188`; `:200-202` anchors only the last-run-scope claim); L-35 (`tsconfig.json` already at the code root, as v1); L-38–L-39 (Revision History shorthand for a past fix, not a live citation).
````

## Lint commit 88c0207

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
index 9c36755..57e37ba 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
@@ -50,7 +50,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 4. The published package (`package.json` `files`: `dist/**/*`, `README.md`, `CHANGELOG.md`, `LICENSE`) SHALL carry the profiles, so `npx ... --watch` on another machine shows declared tiers (D4).
 5. IF the profiles file is missing or malformed at run time THEN the view SHALL render with empty model and effort columns, as `src/watch/render.ts:203` already does for an agent absent from the table, and never fail.
 6. The profiles SHALL cover all twelve agents, `sdd-checker` included.
-7. `scripts/copy-static.cjs` SHALL copy `harness/agent-profiles.json` to `dist/agent-profiles.json` beside its `src/markdown`→`dist/markdown` copy (`scripts/copy-static.cjs:45-61`), so the published package (`files: dist/**/*`) carries it (D4). `src/watch/ledger.ts` SHALL resolve the file relative to its own module directory (`import.meta.url`, the pattern at `src/core/workspace-initializer.ts:9`): the dist copy one level up, else `harness/agent-profiles.json` two levels up, so `vitest` running against `src/watch/ledger.ts` (Req 4.6) and a built `dist/watch/ledger.js` both find it; neither path found falls back to criterion 5's empty table.
+7. `scripts/copy-static.cjs` SHALL copy `harness/agent-profiles.json` to `dist/agent-profiles.json` beside its markdown/locales copies (`scripts/copy-static.cjs:45-61`), so the published package (`files: dist/**/*`) carries it (D4). `src/watch/ledger.ts` SHALL resolve it relative to its own module (`import.meta.url`, `src/core/workspace-initializer.ts:9`): the dist copy one level up, else `harness/agent-profiles.json` two levels up, so `vitest` (Req 4.6) and a built module both find it; else criterion 5's empty table.
 
 ### Requirement 4 — Watch view shows declared beside actual
 
@@ -64,7 +64,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 4. The header total (`src/watch/render.ts:79`, `src/watch/ledger.ts:316`) SHALL keep summing `tokens` per spawn, cache reads included; the split by kind lives in Requirement 5 (D10).
 5. WHEN `--watch --once` runs on the fixture ledger of Requirement 5.8 THEN an orchestrator row SHALL show declared `claude-opus-4-8 high` and actual `claude-opus-4-8`.
 6. `src/watch/__tests__/render.test.ts:53` and `:56`, which assert `fable-5-1 xhigh` for the orchestrator and `opus-4-8 xhigh` for the implementer from the hand-kept table, SHALL be updated to the generated profiles.
-7. The fixed-width layout at `src/watch/render.ts:202-203` (role-width slack 46, model column 11 wide) SHALL be re-budgeted before criterion 2 ships: the longest declared id is `claude-fable-5-1`, 16 characters (Req 3.3), `padRight` does not truncate, and the unbudgeted 11-wide column would overflow and shift every later field. Design owns the new widths; this criterion only pins that `roleW`'s 16-character floor still holds on an 80-column terminal with both model columns shown.
+7. The fixed-width layout at `src/watch/render.ts:202-203` (46-char role slack, 11-char model column) SHALL be re-budgeted before criterion 2 ships: the longest declared id is 16 characters (`claude-fable-5-1`, Req 3.3) and `padRight` does not truncate. Design owns the new widths; this criterion only pins `roleW`'s 16-character floor holding on an 80-column terminal with both model columns shown.
 
 ### Requirement 5 — Usage report
 
@@ -74,8 +74,8 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 
 1. The `harness` tool (`src/tools/harness.ts:27-101`) SHALL gain action `usage` in the enum (`:46`) and dispatch (`:109-120`); it SHALL read only `harness-events.jsonl` under the resolved spec store through `PathUtils.safeJoin`, as `phase-log` does (`:673-683`), and spawn no process.
 2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`, a non-exported `const` the tool SHALL export or duplicate, since `harness.ts` is a separate module) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `src/watch/ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
-3. WHEN called with a second spec, an optional parameter named `compareSpecName` (`src/tools/harness.ts:49-92`; `:95`'s `additionalProperties: false` rejects an unnamed one) (D12), THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
-4. A spawn is identified by its `spawn.start` row; every `spawn.end` or `spawn.usage` row for the same agent up to that agent's next `spawn.start` closes the same spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end` rows, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; when more than one closing row carries a digit string, `spawn.end` wins over `spawn.usage` (Req 7.2), and between two `spawn.end` rows the later timestamp wins (the analyst's 01:10:28 row has no tokens, 01:10:49 carries `45675`, so the spawn counts 45,675). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; a cell with such a spawn prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5); it SHALL NOT reuse `buildModel` (`src/watch/ledger.ts:188-291`), whose run scope is the last run only (`:200-202`) and whose pairing (`:241`) keeps only the first closing row.
+3. WHEN called with a second spec, an optional parameter `compareSpecName` (`src/tools/harness.ts:49-92`; `:95` bars unnamed ones) (D12), THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
+4. A spawn is identified by its `spawn.start` row; every `spawn.end` or `spawn.usage` row for the same agent up to its next `spawn.start` closes the same spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end`, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; `spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later `spawn.end` wins between two (the analyst: 01:10:28 no tokens, 01:10:49 carries `45675`, so 45,675). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5), not a reuse of `buildModel` (`src/watch/ledger.ts:188-291`), whose run scope is the last run only (`:200-202`) and whose pairing (`:241`) keeps only the first closing row.
 5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`src/watch/ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens, plus the analyst's second `spawn.end` criterion 4 counts (45,675, `1,185,572` shown against `1,963,320` in the file). The header SHALL state the run count.
 6. A spawn's phase SHALL be the `phase` key of its `spawn.start` or folded `spawn.usage`; else the phase whose `phase.start`-to-`phase.end` window holds the spawn's start; else `unknown` (D6).
 7. The response SHALL carry the table as text in `message` and the same numbers in `data` (D7).
@@ -90,7 +90,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 #### Acceptance Criteria
 
 1. The agent files SHALL declare: the four orchestrators and `sdd-retro-analyst` `claude-opus-4-8` / `high` (landed at commit 599bdca on 2026-09-18, `harness/agents/sdd-document-orchestrator.md:4-5` and the other four); `sdd-drafter`, `sdd-adjudicator` `claude-fable-5-1` / `xhigh`; `sdd-reviewer`, `sdd-implementer`, `sdd-verifier` `claude-opus-4-8` / `xhigh`; `sdd-reviser`, `sdd-checker` `claude-sonnet-5` / `high`. This spec changes no agent file (D9).
-2. `docs/SDD-HARNESS.md:284-298` (model policy, lists the orchestrators and the analyst as Fable xhigh, the supervisor grouped in) SHALL match the agent files and name `harness/agent-profiles.json` as the generated source for the orchestrators, the analyst and the workers; the supervisor (main session) has no agent file and is not in the generated profiles (Scope notes), so its row SHALL describe its tier separately, not under "the generated source"; `:325-328` SHALL say the hook measures tokens from the transcript.
+2. `docs/SDD-HARNESS.md:284-298` (model policy, groups the supervisor with the orchestrators and analyst as Fable xhigh) SHALL match the agent files and name `harness/agent-profiles.json` as the generated source for the orchestrators, the analyst and the workers; the supervisor has no agent file and is outside the generated profiles (Scope notes), so its row SHALL be described separately; `:325-328` SHALL say the hook measures tokens from the transcript.
 3. `npm run check:plugin-assets` and `claude plugin validate . --strict` SHALL pass with the agent files, the `plugins/` copies and `agent-profiles.json` in agreement.
 4. This document SHALL NOT specify a second cut (Sonnet for an orchestrator); that choice SHALL wait for a retro decision after one measured spec.
 
@@ -148,13 +148,14 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 ## Revision History
 
 - **v1** (2026-09-19) — Initial draft.
-  - **Lint pass.** 24 fixed; rejected: L-1, L-2, L-3, L-4, L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26, L-27, L-28, L-29, L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34, L-35, L-36, L-37, L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43, L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52, L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
-  - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39, L-40, L-41, L-42, L-47, L-48, L-49, L-50, L-54 (added missing directory prefixes), L-12 through L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21 through L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
+  - **Lint pass.** 24 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26–L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33–L-38 (harness tool forward "SHALL gain action `usage`"; forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43–L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52–L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
+  - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39–L-42, L-47–L-50, L-54 (added missing directory prefixes), L-12–L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21–L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
   - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
 - **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
-  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains criterion 7: `copy-static.cjs` copies `harness/agent-profiles.json` to `dist/agent-profiles.json`; `ledger.ts` resolves it one level up from its own module, else `harness/agent-profiles.json` two levels up, so a build and `vitest` both find it.
-  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5 criterion 4 rewritten: a spawn's identity is its `spawn.start` row, every closing row counts once, `spawn.end` beats `spawn.usage`, the later `spawn.end` wins a tie; states the report is its own algorithm and does not reuse `buildModel`. Criterion 5 trimmed to drop the now-duplicated pairing explanation.
-  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 4 gains criterion 7: the fixed 11-wide model column and 46 role-slack at `render.ts:202-203` must be re-budgeted for the 16-character `claude-fable-5-1` id before criterion 2's actual column ships; widths left to design.
-  - **R1-4 — Accepted (MINOR).** Requirement 6 criterion 2: the supervisor is split out of "the generated source" line; its tier row is described separately.
-  - **R1-5 — Accepted (MINOR).** Requirement 5 criterion 2: `PHASE_ORDER` must be exported or duplicated. Criterion 3: the second-spec parameter is named `compareSpecName`, added to the tool's schema.
-  - **R1-6 — Accepted (MINOR).** Requirement 2 criterion 1 reworded to "the worker `spawn.usage` row an orchestrator writes" so it no longer collides with criterion 3.
+  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains a criterion naming the build copy step into the dist tree and the two-step module-relative resolution a build and a test run both satisfy.
+  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5's counting criterion rewritten: spawn identity is the opening row, every closing row counts once, the end row beats the usage row, the later end row breaks a tie; it is now its own algorithm, not the watch view's fold. The all-runs criterion trimmed to drop the duplicated pairing explanation.
+  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 4 gains a criterion naming the fixed column widths that must be re-budgeted for the longer declared ids before the actual-model column ships; the new widths stay design's call.
+  - **R1-4 — Accepted (MINOR).** Requirement 6's docs criterion splits the supervisor out of the generated-source line; its tier row is described on its own.
+  - **R1-5 — Accepted (MINOR).** Requirement 5's phase-order criterion now says the constant must be exported or duplicated; its second-spec criterion names the new parameter and points at the schema it extends.
+  - **R1-6 — Accepted (MINOR).** Requirement 2's first criterion reworded to name the worker row an orchestrator writes, so it no longer collides with the criterion about the orchestrator's own row.
+  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5 (Introduction prose unrelated to the sole citation, as v1's L-1–L-5); L-6 (`jsonl` names the activity file in prose, the citation anchors only the `agent.stop` shape claim); L-7 (`transcript_path` sits in the fixture clause, the citation anchors only the inverted test case); L-8–L-9 (`usage`/`result` sit in the later `spawn.usage` tuple, the citation anchors only the `spawn.start` claim); L-10–L-11 (`start`/`usage` sit in different clauses than the `:79-87` prompt-launch citation); L-12 (`vitest` names a downstream consumer in a later clause, not the copy/resolve citations; checked `scripts/copy-static.cjs:45-61` and `src/core/workspace-initializer.ts:9`, neither mentions it); L-13–L-17 (`SpawnNode` forward `SHALL gain` fields, citation is the extension point, as v1's SpawnNode category); L-18 (harness tool's forward `SHALL gain action usage`, as v1's L-33); L-19–L-23 (forward usage-report fields, unrelated to the `PHASE_ORDER`/level citations, as v1's L-34–L-38); L-24 (`compareSpecName` is itself the forward parameter the schema does not carry yet; checked `src/tools/harness.ts:49-92`, no such property, and `:95`'s `required` list supports only "bars an unnamed one"); L-25 (`buildModel` is named at `:188`; checked `src/watch/ledger.ts:200-202`, which anchors only the last-run-scope claim); L-26–L-27 (doc says `TOOLS-REFERENCE.md` lacks `usage`/`gate` today, so their absence is the point, as v1's L-43–L-44); L-28 (`xhigh` sits in the drafter/adjudicator clause, not the orchestrator citation, as v1's L-45); L-29 (`usage` sits in the `spawn.usage` clause, `:271` anchors only the override claim); L-30–L-31 (`usage`/`safeJoin` sit in the tool's own security clause, not the hook citation); L-32–L-34 (`usage`/`role`/`result` sit in D1's parenthetical, `:241` anchors only the open-node lookup); L-35 (`tsconfig.json` already sits at the code root, no prefix needed, as v1's L-51); L-36–L-37 (`usage`/`note` sit in later clauses unrelated to the step-4 prompt citation, as v1's L-52–L-53); L-38–L-39 (bare `:83`/`:83-85` are Revision History shorthand for a past finding's citation fix, the same convention the surrounding bullet already uses, not a live code citation).
````
