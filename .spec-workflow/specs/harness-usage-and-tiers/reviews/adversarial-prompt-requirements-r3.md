# Adversarial Review — harness-usage-and-tiers/requirements (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v3. A rule with no finding listed here passed. Re-verify only citations the v3 lint commit changed: see the `## Lint commit` section below. The v3 lint pass fixed 0 and rejected all findings; reasons are in the v3 `Lint pass` Revision-History bullet. Still open (your call):
  - Two `citation-path` ERRORS on live body text: `tsconfig.json` (line 130) — the lint pass rejected it as already at the repo root; verify whether it truly sits at the code root.
  - Five `citation-path` ERRORS at line 165 — these are inside the **v2 Lint-pass Revision-History bullet**, whose rejection prose cites bare filenames in backticks (`copy-static.cjs`, `workspace-initializer.ts`, `harness.ts` x3). They are format-only lint noise in prior history, not a defect in any requirement; the fix is to de-backtick that history prose. Do not treat these as document defects unless a requirement's meaning is wrong.
  - The recurring `citation-identifier` warnings on lines 5, 25-143 are the same forward-looking (`usage`/`gate`/`SHALL gain` fields that do not exist today) and clause-mismatch tokens rejected in v1, v2 and v3, plus the bare `:83`/`:83-85` Revision-History shorthand at line 152. Judge whether the rejection rationale holds; do not re-discover them as new.
- Changes: the diff from the newest `docs(sdd): harness-usage-and-tiers requirements v2` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines; the v3 lint commit follows as `## Lint commit <short sha>`.
- Read the Revision History line for v3 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v3 delta wrote `Compounds: R2-<n>`, naming the round-2 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised is marked `Compounds: R<k>-<n>`. The v3 delta accepted all three round-2 findings: R2-1/R2-2 rewrote Req 5 criterion 4's spawn-identity and token-source rule (a start-less agent gets one spawn per numeric `spawn.usage` row; `tokens` fall back from `spawn.end` to `spawn.usage` when the `spawn.end` carries no digits; worked through `sdd-reviewer`/`sdd-checker`/`sdd-drafter`/`sdd-reviser`/`sdd-implementer` and the question-gates fixture totals); R2-3 rewrote Req 4 criterion 7 to pin the full rendered agent line fitting within 80 columns unwrapped. Attack these edits for internal contradiction, false claims about the ledger fold in `src/watch/ledger.ts`, and criteria that the question-gates fixture would not actually satisfy.
- Fresh lens for this round: every cited artifact re-read at both ends of its range — verify that the v3 criterion-4 citations into `src/watch/ledger.ts` (the fold at 250-291, the token fallback at 266/271, the start-less synthesis at 275-290, the last-run scope it rejects at 200-202, the first-closing-row pairing at 241) each describe what that code actually does, since the criterion now leans on the fold's real behaviour.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 88c0207

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
index 57e37ba..afe1c54 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
@@ -64,7 +64,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 4. The header total (`src/watch/render.ts:79`, `src/watch/ledger.ts:316`) SHALL keep summing `tokens` per spawn, cache reads included; the split by kind lives in Requirement 5 (D10).
 5. WHEN `--watch --once` runs on the fixture ledger of Requirement 5.8 THEN an orchestrator row SHALL show declared `claude-opus-4-8 high` and actual `claude-opus-4-8`.
 6. `src/watch/__tests__/render.test.ts:53` and `:56`, which assert `fable-5-1 xhigh` for the orchestrator and `opus-4-8 xhigh` for the implementer from the hand-kept table, SHALL be updated to the generated profiles.
-7. The fixed-width layout at `src/watch/render.ts:202-203` (46-char role slack, 11-char model column) SHALL be re-budgeted before criterion 2 ships: the longest declared id is 16 characters (`claude-fable-5-1`, Req 3.3) and `padRight` does not truncate. Design owns the new widths; this criterion only pins `roleW`'s 16-character floor holding on an 80-column terminal with both model columns shown.
+7. The fixed-width layout at `src/watch/render.ts:202-203` (46-char role slack, 11-char model column) SHALL be re-budgeted before criterion 2 ships: the longest declared id is 16 characters (`claude-fable-5-1`, Req 3.3) and `padRight` does not truncate. Design owns the new widths; this criterion pins the full rendered line — indent, agent, both model columns, effort, role, duration, badge, tokens — fitting within 80 columns without wrapping.
 
 ### Requirement 5 — Usage report
 
@@ -75,7 +75,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 1. The `harness` tool (`src/tools/harness.ts:27-101`) SHALL gain action `usage` in the enum (`:46`) and dispatch (`:109-120`); it SHALL read only `harness-events.jsonl` under the resolved spec store through `PathUtils.safeJoin`, as `phase-log` does (`:673-683`), and spawn no process.
 2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`, a non-exported `const` the tool SHALL export or duplicate, since `harness.ts` is a separate module) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `src/watch/ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
 3. WHEN called with a second spec, an optional parameter `compareSpecName` (`src/tools/harness.ts:49-92`; `:95` bars unnamed ones) (D12), THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
-4. A spawn is identified by its `spawn.start` row; every `spawn.end` or `spawn.usage` row for the same agent up to its next `spawn.start` closes the same spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end`, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; `spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later `spawn.end` wins between two (the analyst: 01:10:28 no tokens, 01:10:49 carries `45675`, so 45,675). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5), not a reuse of `buildModel` (`src/watch/ledger.ts:188-291`), whose run scope is the last run only (`:200-202`) and whose pairing (`:241`) keeps only the first closing row.
+4. A spawn is identified by its `spawn.start` row; when the agent has none, an otherwise-unclaimed `spawn.usage` row (or a digit-carrying `spawn.end` row) SHALL count as its own spawn — the synthesis `buildModel`'s fold performs today for a start-less worker (`src/watch/ledger.ts:275-290`); in question-gates, `sdd-reviewer` (no `spawn.start`, seven numeric `spawn.usage` rows) and `sdd-checker` (no `spawn.start`, two numeric `spawn.usage` rows) each get one spawn per numeric `spawn.usage` row; a start-less `spawn.end` with no digits carries no spawn on its own. Every `spawn.end` or `spawn.usage` row for an agent with a `spawn.start`, up to its next `spawn.start`, closes that spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end`, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; when none on the spawn does, `tokens` SHALL come from a `spawn.usage` digit string instead, as `buildModel`'s fold already reads (`:266`, `:271`) — the source for `sdd-drafter`, `sdd-reviser` and `sdd-implementer`, whose digit-less `spawn.end` leaves the tokens on `spawn.usage`. `spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later `spawn.end` wins between two (the analyst: 45,675 at 01:10:49). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5): it adopts `buildModel`'s fold behaviours — the `spawn.usage` token fallback and the start-less synthesis (`src/watch/ledger.ts:250-291`) — but not its last-run scope (`:200-202`) or its first-closing-row pairing (`:241`).
 5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`src/watch/ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens, plus the analyst's second `spawn.end` criterion 4 counts (45,675, `1,185,572` shown against `1,963,320` in the file). The header SHALL state the run count.
 6. A spawn's phase SHALL be the `phase` key of its `spawn.start` or folded `spawn.usage`; else the phase whose `phase.start`-to-`phase.end` window holds the spawn's start; else `unknown` (D6).
 7. The response SHALL carry the table as text in `message` and the same numbers in `data` (D7).
@@ -148,9 +148,13 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 ## Revision History
 
 - **v1** (2026-09-19) — Initial draft.
-  - **Lint pass.** 24 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26–L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33–L-38 (harness tool forward "SHALL gain action `usage`"; forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43–L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52–L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
+  - **Lint pass.** 24 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26–L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34–L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43–L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52–L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
   - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39–L-42, L-47–L-50, L-54 (added missing directory prefixes), L-12–L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21–L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
   - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
+- **v3** (2026-09-19) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/1/0).
+  - **R2-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 (line 78) now states an explicit fallback: when no closing row of the digit-carrying end kind exists on a spawn, tokens come from the digit-carrying usage kind instead, naming the drafter, reviser and implementer as the worked case; without this the report read only the analyst's row and missed 97.7% of the flagship total.
+  - **R2-2 — Accepted (MUST_FIX).** The same criterion (line 78) now identifies a start-less agent's spawn from its own otherwise-unclaimed closing row, naming the reviewer (seven such rows) and the checker (two) as the worked case; without this, 46% of the flagship total had no spawn to attach to.
+  - **R2-3 — Accepted (SHOULD_FIX).** Requirement 4 criterion 7's closing sentence (line 67) now pins the full rendered agent line fitting within 80 columns without wrapping, replacing the prior floor pin that the render code makes unconditionally true and that guarded nothing.
 - **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
   - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains a criterion naming the build copy step into the dist tree and the two-step module-relative resolution a build and a test run both satisfy.
   - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5's counting criterion rewritten: spawn identity is the opening row, every closing row counts once, the end row beats the usage row, the later end row breaks a tie; it is now its own algorithm, not the watch view's fold. The all-runs criterion trimmed to drop the duplicated pairing explanation.
@@ -158,4 +162,4 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
   - **R1-4 — Accepted (MINOR).** Requirement 6's docs criterion splits the supervisor out of the generated-source line; its tier row is described on its own.
   - **R1-5 — Accepted (MINOR).** Requirement 5's phase-order criterion now says the constant must be exported or duplicated; its second-spec criterion names the new parameter and points at the schema it extends.
   - **R1-6 — Accepted (MINOR).** Requirement 2's first criterion reworded to name the worker row an orchestrator writes, so it no longer collides with the criterion about the orchestrator's own row.
-  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5 (Introduction prose unrelated to the sole citation, as v1's L-1–L-5); L-6 (`jsonl` names the activity file in prose, the citation anchors only the `agent.stop` shape claim); L-7 (`transcript_path` sits in the fixture clause, the citation anchors only the inverted test case); L-8–L-9 (`usage`/`result` sit in the later `spawn.usage` tuple, the citation anchors only the `spawn.start` claim); L-10–L-11 (`start`/`usage` sit in different clauses than the `:79-87` prompt-launch citation); L-12 (`vitest` names a downstream consumer in a later clause, not the copy/resolve citations; checked `scripts/copy-static.cjs:45-61` and `src/core/workspace-initializer.ts:9`, neither mentions it); L-13–L-17 (`SpawnNode` forward `SHALL gain` fields, citation is the extension point, as v1's SpawnNode category); L-18 (harness tool's forward `SHALL gain action usage`, as v1's L-33); L-19–L-23 (forward usage-report fields, unrelated to the `PHASE_ORDER`/level citations, as v1's L-34–L-38); L-24 (`compareSpecName` is itself the forward parameter the schema does not carry yet; checked `src/tools/harness.ts:49-92`, no such property, and `:95`'s `required` list supports only "bars an unnamed one"); L-25 (`buildModel` is named at `:188`; checked `src/watch/ledger.ts:200-202`, which anchors only the last-run-scope claim); L-26–L-27 (doc says `TOOLS-REFERENCE.md` lacks `usage`/`gate` today, so their absence is the point, as v1's L-43–L-44); L-28 (`xhigh` sits in the drafter/adjudicator clause, not the orchestrator citation, as v1's L-45); L-29 (`usage` sits in the `spawn.usage` clause, `:271` anchors only the override claim); L-30–L-31 (`usage`/`safeJoin` sit in the tool's own security clause, not the hook citation); L-32–L-34 (`usage`/`role`/`result` sit in D1's parenthetical, `:241` anchors only the open-node lookup); L-35 (`tsconfig.json` already sits at the code root, no prefix needed, as v1's L-51); L-36–L-37 (`usage`/`note` sit in later clauses unrelated to the step-4 prompt citation, as v1's L-52–L-53); L-38–L-39 (bare `:83`/`:83-85` are Revision History shorthand for a past finding's citation fix, the same convention the surrounding bullet already uses, not a live code citation).
+  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5, L-26–L-28 (word sits in prose elsewhere in the sentence, not the cited range, as v1); L-6, L-7, L-8–L-11, L-29–L-34, L-36–L-37 (word belongs to a different clause than the cited line, same v1 pattern); L-12, L-24 (`vitest`/`compareSpecName` name a later-clause consumer or a not-yet-added parameter; checked `copy-static.cjs:45-61`, `workspace-initializer.ts:9`, `harness.ts:49-92,95`, absent as expected); L-13–L-18, L-19–L-23 (forward `SHALL gain`/`SHALL document` claims, citation is today's extension point, as v1); L-25 (`buildModel` named at `:188`; `:200-202` anchors only the last-run-scope claim); L-35 (`tsconfig.json` already at the code root, as v1); L-38–L-39 (Revision History shorthand for a past fix, not a live citation).
````

## Lint commit 97a72c6

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
index ddf6cac..afe1c54 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
@@ -152,9 +152,9 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
   - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39–L-42, L-47–L-50, L-54 (added missing directory prefixes), L-12–L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21–L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
   - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
 - **v3** (2026-09-19) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/1/0).
-  - **R2-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 now says that, when no `spawn.end` on a spawn carries a digit string, `tokens` come from a `spawn.usage` digit string instead, naming `sdd-drafter`, `sdd-reviser` and `sdd-implementer` as the worked case; without this the report read only the analyst's `spawn.end` and missed 97.7% of question-gates' total.
-  - **R2-2 — Accepted (MUST_FIX).** The same criterion now identifies a start-less agent's spawn from an otherwise-unclaimed `spawn.usage` row (or a digit-carrying `spawn.end` row), naming `sdd-reviewer` (seven) and `sdd-checker` (two) as the worked case; without this, 46% of question-gates' total had no spawn to attach to.
-  - **R2-3 — Accepted (SHOULD_FIX).** Requirement 4 criterion 7's closing sentence now pins the full rendered agent line fitting within 80 columns without wrapping, replacing the `roleW` floor pin that `Math.max(16, …)` makes unconditionally true and that guarded nothing.
+  - **R2-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 (line 78) now states an explicit fallback: when no closing row of the digit-carrying end kind exists on a spawn, tokens come from the digit-carrying usage kind instead, naming the drafter, reviser and implementer as the worked case; without this the report read only the analyst's row and missed 97.7% of the flagship total.
+  - **R2-2 — Accepted (MUST_FIX).** The same criterion (line 78) now identifies a start-less agent's spawn from its own otherwise-unclaimed closing row, naming the reviewer (seven such rows) and the checker (two) as the worked case; without this, 46% of the flagship total had no spawn to attach to.
+  - **R2-3 — Accepted (SHOULD_FIX).** Requirement 4 criterion 7's closing sentence (line 67) now pins the full rendered agent line fitting within 80 columns without wrapping, replacing the prior floor pin that the render code makes unconditionally true and that guarded nothing.
 - **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
   - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains a criterion naming the build copy step into the dist tree and the two-step module-relative resolution a build and a test run both satisfy.
   - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5's counting criterion rewritten: spawn identity is the opening row, every closing row counts once, the end row beats the usage row, the later end row breaks a tie; it is now its own algorithm, not the watch view's fold. The all-runs criterion trimmed to drop the duplicated pairing explanation.
````
