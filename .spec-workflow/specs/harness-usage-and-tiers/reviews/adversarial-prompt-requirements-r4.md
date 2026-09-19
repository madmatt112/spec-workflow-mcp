# Adversarial Review — harness-usage-and-tiers/requirements (v4)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v4. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements-r3.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v4 review)

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements-r4.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v4. This is the final budgeted review round; a converged verdict approves the document, an iterate with open items triggers a post-cap corrective pass that is not re-reviewed. Weigh severity accordingly: reserve MUST_FIX for a real contradiction, a false claim about the code, or an untestable/unimplementable criterion.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v4. A rule with no finding listed here passed. Re-verify only citations the v4 lint commit changed: see the `## Lint commit` section below (the v4 lint pass touched only `## Revision History` prose, not the requirements body). Still open, all rejected/known — do not re-discover as new:
  - One `citation-path` ERROR: `tsconfig.json` (line 130), a live body citation the lint pass ruled a known limitation because the file sits at the repo root and has no directory prefix. Confirm the ruling holds; it is not a document defect.
  - The `citation-identifier` warnings on lines 5-143 are the same forward-looking (`usage`/`gate`/`SHALL gain`/report fields that do not exist in the code today) and clause-mismatch tokens rejected in v1-v4, plus the bare `:83`/`:83-85` Revision-History shorthand (info) at line 152.
- Changes: the diff from the newest `docs(sdd): harness-usage-and-tiers requirements v3` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines; the v4 lint commit follows as `## Lint commit <short sha>`.
- Read the Revision History line for v4 first and attack those changes before anything else. The v4 delta accepted both round-3 findings: R3-1 (MUST_FIX) corrected Req 5 criterion 4 so it no longer attributes start-less `spawn.end` synthesis to the `buildModel` fold — the fold synthesizes start-less spawns from `spawn.usage` only, and a start-less `spawn.end` (digit-carrying or not) is dropped because the fold's `spawn.end` pairing needs an open same-agent `spawn.start` (cites `src/watch/ledger.ts:240-247`, `:275-290`); R3-2 (SHOULD_FIX) added `sdd-verifier` (start-less, one `na` `spawn.usage` row) as a third worked start-less case and changed the rule to one spawn per `spawn.usage` row so the fixture yields all 14 unknown marks Req 5.9 mandates. Mark a finding in v4-delta text `Compounds: R3-<n>`. Verify these two claims against the ledger fold at both ends of every cited range — this is the load-bearing counting rule and its last correction must be exactly right.
- Fresh lens for this round: a cold read for internal contradictions across the whole document and a truth table of Req 5's stated cases (per-spawn token source, start-ful vs start-less identity, the four token states unknown/na/0/absent, the all-runs scope) checked for mutual consistency and against Req 5.9's mandated fixture totals.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 67dff04

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
index 3c86227..d12481f 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
@@ -75,7 +75,7 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 1. The `harness` tool (`src/tools/harness.ts:27-101`) SHALL gain action `usage` in the enum (`:46`) and dispatch (`:109-120`); it SHALL read only `harness-events.jsonl` under the resolved spec store through `PathUtils.safeJoin`, as `phase-log` does (`:673-683`), and spawn no process.
 2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`, a non-exported `const` the tool SHALL export or duplicate, since `harness.ts` is a separate module) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `src/watch/ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
 3. WHEN called with a second spec, an optional parameter `compareSpecName` (`src/tools/harness.ts:49-92`; `:95` bars unnamed ones) (D12), THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
-4. A spawn is identified by its `spawn.start` row; when the agent has none, an otherwise-unclaimed `spawn.usage` row (or a digit-carrying `spawn.end` row) SHALL count as its own spawn — the synthesis `buildModel`'s fold performs today for a start-less worker (`src/watch/ledger.ts:275-290`); in question-gates, `sdd-reviewer` (no `spawn.start`, seven numeric `spawn.usage` rows) and `sdd-checker` (no `spawn.start`, two numeric `spawn.usage` rows) each get one spawn per numeric `spawn.usage` row; a start-less `spawn.end` with no digits carries no spawn on its own. Every `spawn.end` or `spawn.usage` row for an agent with a `spawn.start`, up to its next `spawn.start`, closes that spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end`, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; when none on the spawn does, `tokens` SHALL come from a `spawn.usage` digit string instead, as `buildModel`'s fold already reads (`:266`, `:271`) — the source for `sdd-drafter`, `sdd-reviser` and `sdd-implementer`, whose digit-less `spawn.end` leaves the tokens on `spawn.usage`. `spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later `spawn.end` wins between two (the analyst: 45,675 at 01:10:49). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5): it adopts `buildModel`'s fold behaviours — the `spawn.usage` token fallback and the start-less synthesis (`src/watch/ledger.ts:250-291`) — but not its last-run scope (`:200-202`) or its first-closing-row pairing (`:241`).
+4. A spawn is identified by its `spawn.start` row; when the agent has none, an otherwise-unclaimed `spawn.usage` row SHALL count as its own spawn — the synthesis `buildModel`'s fold performs today for a start-less worker, from `spawn.usage` rows only (`src/watch/ledger.ts:275-290`); a start-less `spawn.end` row, digit-carrying or not, carries no spawn on its own — `buildModel`'s `spawn.end` pairing (`:240-247`) requires an open same-agent `spawn.start` and drops the row when none exists. In question-gates, `sdd-reviewer` (no `spawn.start`, seven `spawn.usage` rows, all digit-carrying) and `sdd-checker` (no `spawn.start`, two `spawn.usage` rows, all digit-carrying) each get one spawn per `spawn.usage` row; `sdd-verifier` (no `spawn.start`, one `spawn.usage` row reading `na`) gets one spawn the same way, with `unknown` tokens. Every `spawn.end` or `spawn.usage` row for an agent with a `spawn.start`, up to its next `spawn.start`, closes that spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end`, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; when none on the spawn does, `tokens` SHALL come from a `spawn.usage` digit string instead, as `buildModel`'s fold already reads (`:266`, `:271`) — the source for `sdd-drafter`, `sdd-reviser` and `sdd-implementer`, whose digit-less `spawn.end` leaves the tokens on `spawn.usage`. `spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later `spawn.end` wins between two (the analyst: 45,675 at 01:10:49). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5): it adopts `buildModel`'s fold behaviours — the `spawn.usage` token fallback and the start-less synthesis (`src/watch/ledger.ts:250-291`) — but not its last-run scope (`:200-202`) or its first-closing-row pairing (`:241`).
 5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`src/watch/ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens, plus the analyst's second `spawn.end` criterion 4 counts (45,675, `1,185,572` shown against `1,963,320` in the file). The header SHALL state the run count.
 6. A spawn's phase SHALL be the `phase` key of its `spawn.start` or folded `spawn.usage`; else the phase whose `phase.start`-to-`phase.end` window holds the spawn's start; else `unknown` (D6).
 7. The response SHALL carry the table as text in `message` and the same numbers in `data` (D7).
@@ -148,14 +148,18 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 ## Revision History
 
 - **v1** (2026-09-19) — Initial draft.
-  - **Lint pass.** 24 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26–L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34–L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43–L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52–L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
+  - **Lint pass.** 24 fixed; rejected: L-1–L-5 introduction prose unrelated to the sentence's sole citation; L-26–L-30, L-33, L-34–L-38, L-43–L-44 forward-looking field the code does not carry today; L-45, L-52–L-53 identifier belongs to a different clause than the cited line anchors; L-51 config file sits at the repository root so it needs no directory prefix (known ruling, error persists).
   - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39–L-42, L-47–L-50, L-54 (added missing directory prefixes), L-12–L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21–L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
   - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
+- **v4** (2026-09-19) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md, verdict iterate 1/1/0).
+  - **R3-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 (line 78) dropped the false claim that the fold's start-less synthesis covers a digit-carrying spawn.end row; it now says the synthesis runs from spawn.usage rows only, and that a start-less spawn.end, digit-carrying or not, is dropped because the fold's spawn.end pairing needs an open same-agent spawn.start. Checked the document for the same construct elsewhere (every clause describing the fold's behaviour, every worked start-less case); the only instance was this one.
+  - **R3-2 — Accepted (SHOULD_FIX).** The same criterion's worked start-less set now includes sdd-verifier as the non-numeric case alongside reviewer and checker, and the rule reads one spawn per spawn.usage row rather than per numeric spawn.usage row, so the report yields all 14 unknown marks Req 5.9 mandates.
+  - **Lint pass.** 24 fixed; rejected: 18 recurring body citation-identifier warnings and one info citation-bare note, suppressed under the same forward-looking-field and different-clause reasons as v1–v3; L-B1 config file sits at the repository root so it needs no directory prefix (known ruling, error persists).
 - **v3** (2026-09-19) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/1/0).
   - **R2-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 (line 78) now states an explicit fallback: when no closing row of the digit-carrying end kind exists on a spawn, tokens come from the digit-carrying usage kind instead, naming the drafter, reviser and implementer as the worked case; without this the report read only the analyst's row and missed 97.7% of the flagship total.
   - **R2-2 — Accepted (MUST_FIX).** The same criterion (line 78) now identifies a start-less agent's spawn from its own otherwise-unclaimed closing row, naming the reviewer (seven such rows) and the checker (two) as the worked case; without this, 46% of the flagship total had no spawn to attach to.
   - **R2-3 — Accepted (SHOULD_FIX).** Requirement 4 criterion 7's closing sentence (line 67) now pins the full rendered agent line fitting within 80 columns without wrapping, replacing the prior floor pin that the render code makes unconditionally true and that guarded nothing.
-  - **Lint pass.** 5 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence, as v1); L-6 (`jsonl` belongs to the `harness-activity.jsonl` clause, not the `sdd-activity.sh:63-65`, `:69` citation, same v1/v2 pattern); L-7 (`transcript_path` belongs to the earlier clause, not the `:110-116` invert-case citation); L-8, L-9 (`usage`/`result` belong to the `spawn.usage` clause, not the `spawn.start` citation); L-10, L-11 (`start`/`usage` paraphrase the retro-analyst spawn, the citation evidences prompt-launch, same v1/v2 pattern); L-12 (`vitest` names a later-clause consumer, as v2); L-13–L-18 (SpawnNode forward `SHALL gain` fields, citation is the extension point, as v1); L-19–L-23 (forward `usage`-report fields and `specName`, unrelated to the `PHASE_ORDER`/orchestrator-suffix citations, as v1); L-24 (`compareSpecName` names a not-yet-added parameter, as v2); L-25, L-26 (`buildModel` named at `src/watch/ledger.ts:188`; confirmed the cited ranges anchor its fold behaviours, not the identifier); L-27, L-28 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point, as v1); L-29 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation, as v1); L-30 (`usage` belongs to the `spawn.usage` clause, not the `:271` override citation); L-31, L-32 (`usage`/`safeJoin` belong to the `usage` tool clause, not the hook read/write citation); L-33–L-35 (`usage`/`role`/`result` belong to the `spawn.usage` clause, not the `:241` open-node citation); L-36 (confirmed `tsconfig.json` sits at the repo root, `tsconfig.json:8` carries `rootDir: ./src`; known ruling, error persists, as v1/v2); L-37, L-38 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation, as v1); L-39, L-40 (bare `:83`/`:83-85` are the v1 Revision-History bullet's own before/after shorthand, not a live citation, as v2). L-41–L-45 accepted: the v2 Lint pass bullet's rejection prose backticked bare filenames (`copy-static.cjs`, `workspace-initializer.ts`, `harness.ts`) with line ranges as path citations; stripped the backticks so they read as plain prose (checked the rest of the document for the same construct — a backticked bare path with a line range inside Revision-History prose — none found).
+  - **Lint pass.** 5 fixed; rejected: L-1–L-5 introduction prose unrelated to the sentence's sole citation, as v1; L-13–L-18, L-19–L-23, L-24, L-27–L-28 forward-looking field the code does not carry today, as v1/v2; L-6, L-7, L-8–L-9, L-10–L-11, L-12, L-25–L-26, L-29, L-30, L-31–L-32, L-33–L-35, L-37–L-38 identifier belongs to a different clause than the cited line anchors, as v1/v2; L-36 config file sits at the repository root so it needs no directory prefix (known ruling, error persists); L-39–L-40 Revision-History before/after shorthand, not a live citation, as v2. L-41–L-45 accepted: the v2 Lint-pass bullet's rejection prose named source files with line ranges as path citations; removed those tokens so the prose carries no citation (checked the rest of the document for the same construct; none found).
 - **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
   - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains a criterion naming the build copy step into the dist tree and the two-step module-relative resolution a build and a test run both satisfy.
   - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5's counting criterion rewritten: spawn identity is the opening row, every closing row counts once, the end row beats the usage row, the later end row breaks a tie; it is now its own algorithm, not the watch view's fold. The all-runs criterion trimmed to drop the duplicated pairing explanation.
@@ -163,4 +167,4 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
   - **R1-4 — Accepted (MINOR).** Requirement 6's docs criterion splits the supervisor out of the generated-source line; its tier row is described on its own.
   - **R1-5 — Accepted (MINOR).** Requirement 5's phase-order criterion now says the constant must be exported or duplicated; its second-spec criterion names the new parameter and points at the schema it extends.
   - **R1-6 — Accepted (MINOR).** Requirement 2's first criterion reworded to name the worker row an orchestrator writes, so it no longer collides with the criterion about the orchestrator's own row.
-  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5, L-26–L-28 (word sits in prose elsewhere in the sentence, not the cited range, as v1); L-6, L-7, L-8–L-11, L-29–L-34, L-36–L-37 (word belongs to a different clause than the cited line, same v1 pattern); L-12, L-24 (`vitest`/`compareSpecName` name a later-clause consumer or a not-yet-added parameter; checked copy-static.cjs:45-61, workspace-initializer.ts:9, harness.ts:49-92,95, absent as expected); L-13–L-18, L-19–L-23 (forward `SHALL gain`/`SHALL document` claims, citation is today's extension point, as v1); L-25 (`buildModel` named at `:188`; `:200-202` anchors only the last-run-scope claim); L-35 (`tsconfig.json` already at the code root, as v1); L-38–L-39 (Revision History shorthand for a past fix, not a live citation).
+  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5 introduction prose unrelated to the sentence's sole citation, as v1; L-6, L-7, L-8–L-11, L-25, L-26–L-28, L-29–L-34, L-36–L-37 identifier belongs to a different clause than the cited line anchors, as v1 pattern; L-12, L-13–L-18, L-19–L-23, L-24 forward-looking field the code does not carry today, as v1; L-35 config file sits at the repository root so it needs no directory prefix (known ruling, error persists), as v1; L-38–L-39 Revision-History before/after shorthand, not a live citation.
````

## Lint commit 5f9991a

````diff
diff --git a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
index 0cf436c..d12481f 100644
--- a/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
+++ b/.spec-workflow/specs/harness-usage-and-tiers/requirements.md
@@ -148,17 +148,18 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
 ## Revision History
 
 - **v1** (2026-09-19) — Initial draft.
-  - **Lint pass.** 24 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26–L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34–L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43–L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52–L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
+  - **Lint pass.** 24 fixed; rejected: L-1–L-5 introduction prose unrelated to the sentence's sole citation; L-26–L-30, L-33, L-34–L-38, L-43–L-44 forward-looking field the code does not carry today; L-45, L-52–L-53 identifier belongs to a different clause than the cited line anchors; L-51 config file sits at the repository root so it needs no directory prefix (known ruling, error persists).
   - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39–L-42, L-47–L-50, L-54 (added missing directory prefixes), L-12–L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21–L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
   - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
 - **v4** (2026-09-19) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md, verdict iterate 1/1/0).
   - **R3-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 (line 78) dropped the false claim that the fold's start-less synthesis covers a digit-carrying spawn.end row; it now says the synthesis runs from spawn.usage rows only, and that a start-less spawn.end, digit-carrying or not, is dropped because the fold's spawn.end pairing needs an open same-agent spawn.start. Checked the document for the same construct elsewhere (every clause describing the fold's behaviour, every worked start-less case); the only instance was this one.
   - **R3-2 — Accepted (SHOULD_FIX).** The same criterion's worked start-less set now includes sdd-verifier as the non-numeric case alongside reviewer and checker, and the rule reads one spawn per spawn.usage row rather than per numeric spawn.usage row, so the report yields all 14 unknown marks Req 5.9 mandates.
+  - **Lint pass.** 24 fixed; rejected: 18 recurring body citation-identifier warnings and one info citation-bare note, suppressed under the same forward-looking-field and different-clause reasons as v1–v3; L-B1 config file sits at the repository root so it needs no directory prefix (known ruling, error persists).
 - **v3** (2026-09-19) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/1/0).
   - **R2-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 (line 78) now states an explicit fallback: when no closing row of the digit-carrying end kind exists on a spawn, tokens come from the digit-carrying usage kind instead, naming the drafter, reviser and implementer as the worked case; without this the report read only the analyst's row and missed 97.7% of the flagship total.
   - **R2-2 — Accepted (MUST_FIX).** The same criterion (line 78) now identifies a start-less agent's spawn from its own otherwise-unclaimed closing row, naming the reviewer (seven such rows) and the checker (two) as the worked case; without this, 46% of the flagship total had no spawn to attach to.
   - **R2-3 — Accepted (SHOULD_FIX).** Requirement 4 criterion 7's closing sentence (line 67) now pins the full rendered agent line fitting within 80 columns without wrapping, replacing the prior floor pin that the render code makes unconditionally true and that guarded nothing.
-  - **Lint pass.** 5 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence, as v1); L-6 (`jsonl` belongs to the `harness-activity.jsonl` clause, not the `sdd-activity.sh:63-65`, `:69` citation, same v1/v2 pattern); L-7 (`transcript_path` belongs to the earlier clause, not the `:110-116` invert-case citation); L-8, L-9 (`usage`/`result` belong to the `spawn.usage` clause, not the `spawn.start` citation); L-10, L-11 (`start`/`usage` paraphrase the retro-analyst spawn, the citation evidences prompt-launch, same v1/v2 pattern); L-12 (`vitest` names a later-clause consumer, as v2); L-13–L-18 (SpawnNode forward `SHALL gain` fields, citation is the extension point, as v1); L-19–L-23 (forward `usage`-report fields and `specName`, unrelated to the `PHASE_ORDER`/orchestrator-suffix citations, as v1); L-24 (`compareSpecName` names a not-yet-added parameter, as v2); L-25, L-26 (`buildModel` named at `src/watch/ledger.ts:188`; confirmed the cited ranges anchor its fold behaviours, not the identifier); L-27, L-28 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point, as v1); L-29 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation, as v1); L-30 (`usage` belongs to the `spawn.usage` clause, not the `:271` override citation); L-31, L-32 (`usage`/`safeJoin` belong to the `usage` tool clause, not the hook read/write citation); L-33–L-35 (`usage`/`role`/`result` belong to the `spawn.usage` clause, not the `:241` open-node citation); L-36 (confirmed `tsconfig.json` sits at the repo root, `tsconfig.json:8` carries `rootDir: ./src`; known ruling, error persists, as v1/v2); L-37, L-38 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation, as v1); L-39, L-40 (bare `:83`/`:83-85` are the v1 Revision-History bullet's own before/after shorthand, not a live citation, as v2). L-41–L-45 accepted: the v2 Lint pass bullet's rejection prose backticked bare filenames (`copy-static.cjs`, `workspace-initializer.ts`, `harness.ts`) with line ranges as path citations; stripped the backticks so they read as plain prose (checked the rest of the document for the same construct — a backticked bare path with a line range inside Revision-History prose — none found).
+  - **Lint pass.** 5 fixed; rejected: L-1–L-5 introduction prose unrelated to the sentence's sole citation, as v1; L-13–L-18, L-19–L-23, L-24, L-27–L-28 forward-looking field the code does not carry today, as v1/v2; L-6, L-7, L-8–L-9, L-10–L-11, L-12, L-25–L-26, L-29, L-30, L-31–L-32, L-33–L-35, L-37–L-38 identifier belongs to a different clause than the cited line anchors, as v1/v2; L-36 config file sits at the repository root so it needs no directory prefix (known ruling, error persists); L-39–L-40 Revision-History before/after shorthand, not a live citation, as v2. L-41–L-45 accepted: the v2 Lint-pass bullet's rejection prose named source files with line ranges as path citations; removed those tokens so the prose carries no citation (checked the rest of the document for the same construct; none found).
 - **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
   - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains a criterion naming the build copy step into the dist tree and the two-step module-relative resolution a build and a test run both satisfy.
   - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5's counting criterion rewritten: spawn identity is the opening row, every closing row counts once, the end row beats the usage row, the later end row breaks a tie; it is now its own algorithm, not the watch view's fold. The all-runs criterion trimmed to drop the duplicated pairing explanation.
@@ -166,4 +167,4 @@ The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or whic
   - **R1-4 — Accepted (MINOR).** Requirement 6's docs criterion splits the supervisor out of the generated-source line; its tier row is described on its own.
   - **R1-5 — Accepted (MINOR).** Requirement 5's phase-order criterion now says the constant must be exported or duplicated; its second-spec criterion names the new parameter and points at the schema it extends.
   - **R1-6 — Accepted (MINOR).** Requirement 2's first criterion reworded to name the worker row an orchestrator writes, so it no longer collides with the criterion about the orchestrator's own row.
-  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5, L-26–L-28 (word sits in prose elsewhere in the sentence, not the cited range, as v1); L-6, L-7, L-8–L-11, L-29–L-34, L-36–L-37 (word belongs to a different clause than the cited line, same v1 pattern); L-12, L-24 (`vitest`/`compareSpecName` name a later-clause consumer or a not-yet-added parameter; checked copy-static.cjs:45-61, workspace-initializer.ts:9, harness.ts:49-92,95, absent as expected); L-13–L-18, L-19–L-23 (forward `SHALL gain`/`SHALL document` claims, citation is today's extension point, as v1); L-25 (`buildModel` named at `:188`; `:200-202` anchors only the last-run-scope claim); L-35 (`tsconfig.json` already at the code root, as v1); L-38–L-39 (Revision History shorthand for a past fix, not a live citation).
+  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5 introduction prose unrelated to the sentence's sole citation, as v1; L-6, L-7, L-8–L-11, L-25, L-26–L-28, L-29–L-34, L-36–L-37 identifier belongs to a different clause than the cited line anchors, as v1 pattern; L-12, L-13–L-18, L-19–L-23, L-24 forward-looking field the code does not carry today, as v1; L-35 config file sits at the repository root so it needs no directory prefix (known ruling, error persists), as v1; L-38–L-39 Revision-History before/after shorthand, not a live citation.
````
