# Adversarial Review — provider-per-role/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 and returned 0 findings (0 error, 0 warning, 0 info). Every rule passed: verify meaning only. No lint pass ran (nothing to fix). Still open: none.
- Changes: the diff from the `docs(sdd): provider-per-role requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First adversarial review of this document. v1 was never reviewed: it was drafted, linted clean, and taken to a human gate A; v2 applies the human's gate A answers. So read the decomposition entry for `provider-per-role` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the whole document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Attack the v1→v2 delta first: the Gate A decision change. The decision "A refused run leaves a ledger trace" now reads that a run refused AT START (a missing provider key, or a bad/unresolvable provider-map row detected before any task runs) stops before ANY ledger row is written — no run-start row, no note row, no run-end row, no free text. The reviser changed decision D5's text and rationale plus Requirement 1 criterion 3, Requirement 4 criterion 2, Requirement 7 criterion 3 and the Reliability NFR bullet. Stress-test the internal consistency of this change: does any surviving acceptance criterion, NFR, or the watch-view story still claim a refused-at-start run writes a trace? Is the boundary between a refused-at-start run (no row) and a mid-run failure (Requirement 2 criterion 4, `PHASE: error`, which still logs) stated unambiguously enough that an implementer knows exactly when the first ledger row is written?
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements. Here the boundaries are the provider map → launcher, the launcher → per-task spawn, and the run → ledger/watch-view.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. There are no earlier rounds; nothing to re-raise.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-requirements.md`. It does not exist yet (this is the first review). Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since e342b03

````diff
diff --git a/.spec-workflow/specs/provider-per-role/requirements.md b/.spec-workflow/specs/provider-per-role/requirements.md
index d9a01a5..f5f1dd9 100644
--- a/.spec-workflow/specs/provider-per-role/requirements.md
+++ b/.spec-workflow/specs/provider-per-role/requirements.md
@@ -18,7 +18,7 @@ No `steering/product.md` exists in this store, so alignment is to the harness op
 
 1. THE spec store's `agent-rules.md` SHALL accept an optional `## Providers` section whose bullets read `- <agent>: <provider> <model>`, where `<agent>` is a harness agent name (`sdd-reviewer`), `<provider>` is `anthropic` or `deepseek`, and `<model>` is `deepseek-v4-pro` or `deepseek-flash`, required for `deepseek` and absent for `anthropic`. WHEN the section is absent or names no agent THEN every role SHALL run on Anthropic as today (D1).
 2. THE eligible set for DeepSeek SHALL be `sdd-reviewer` and `sdd-checker` (file tools only: `harness/agents/sdd-reviewer.md:7-12`, `harness/agents/sdd-checker.md:7-12`), plus `sdd-reviser` only after preflight (b) passes (Requirement 6 criterion 4). No other agent SHALL be eligible in this spec.
-3. WHEN the section names an agent outside the eligible set, an unknown provider, a `deepseek` row without a listed model, or the same agent twice THEN the supervisor SHALL refuse the run at `run.start` with a `note` naming the offending bullet (the shape of Requirement 4 criterion 2) and SHALL NOT run that role on Anthropic instead (D2).
+3. WHEN the section names an agent outside the eligible set, an unknown provider, a `deepseek` row without a listed model, or the same agent twice THEN the supervisor SHALL stop before any ledger row is written and SHALL NOT run that role on Anthropic instead (D2, D5).
 4. THE supervisor SHALL read the section once, at the roots step where it locates `agent-rules.md` (`harness/skills/sdd-continue/SKILL.md:71-72`), and SHALL record the map on `run.start` (`harness/skills/sdd-continue/references/formats.md:186-198`) as `providers=<agent>:<provider>[:<model>],...` in section order, or `providers=none` when the section is absent or empty (D4).
 5. THE orchestrator launch prompt (`harness/skills/sdd-continue/SKILL.md:190-208`) SHALL gain two lines, `PROVIDERS: <the same value>` and `LAUNCHER: <path | none>`, so an orchestrator never re-reads `agent-rules.md` for the map (D9).
 6. THE list of machine-read lines (`docs/SDD-HARNESS.md:271-280`) SHALL name `## Providers` as the fifth, with the eligible set and the two model names.
@@ -62,7 +62,7 @@ No `steering/product.md` exists in this store, so alignment is to the harness op
 #### Acceptance Criteria
 
 1. THE key SHALL be `DEEPSEEK_API_KEY` in the environment of the process that starts the run (terminal or dashboard), never read from the spec store, a run file, `agent-rules.md` or a launch prompt.
-2. WHEN the map names a `deepseek` role and `DEEPSEEK_API_KEY` is unset or empty THEN the supervisor SHALL write `run.start` (with `providers`), then `note text="deepseek: <agent> needs DEEPSEEK_API_KEY; not set"`, then `run.end` with a status line naming the role and the missing key, deregister, and stop; it SHALL spawn no orchestrator (D5).
+2. WHEN the map names a `deepseek` role and `DEEPSEEK_API_KEY` is unset or empty THEN the supervisor SHALL stop before any ledger row is written; it SHALL spawn no orchestrator (D5).
 3. THE launcher SHALL also refuse (non-zero, one stderr line, no `spawn.start`) when called with the key unset, so a stale launcher cannot run on a missing key.
 4. THE key SHALL NOT appear in the launcher text, any ledger or activity row, HANDOFF, the retro log, `questions.md`, a brief, or a commit; the child's environment SHALL NOT carry `ANTHROPIC_API_KEY`; and preflight (a) SHALL show the session's Anthropic credential was not used (the child's transcript `message.model` is a DeepSeek name).
 5. WHEN the key is set THEN the run SHALL NOT print it, and the watch view and `harness usage` SHALL NOT read it.
@@ -104,7 +104,7 @@ No `steering/product.md` exists in this store, so alignment is to the harness op
 
 1. WHEN a fixture requirements round runs with `sdd-reviewer` on `deepseek-v4-pro` THEN the analysis file SHALL exist in the round's format with a verdict block; the ledger SHALL hold its `spawn.start` and `spawn.end` with `provider=deepseek`, a DeepSeek model name and digit-string usage; and the reviser round that follows SHALL run on Anthropic through the Agent tool with the hook-written rows of today.
 2. WHEN the same round runs with every role on `anthropic` THEN the ledger SHALL have today's shape: no `provider` key on any spawn row, and `run.start` gaining only `providers`.
-3. WHEN `DEEPSEEK_API_KEY` is unset and the map names one `deepseek` role THEN the run SHALL stop as Requirement 4 criterion 2 says, and `--watch --once` SHALL show the stopped status and no spawn (spec 9's page is not built; Scope notes).
+3. WHEN `DEEPSEEK_API_KEY` is unset and the map names one `deepseek` role THEN the run SHALL stop as Requirement 4 criterion 2 says, writing no ledger row; `--watch --once` SHALL show no entry for that run (spec 9's page is not built; Scope notes).
 4. WHEN `harness usage` runs on the ledger of criterion 1 THEN it SHALL report the reviewer's tokens under `deepseek` and an Anthropic total that excludes them.
 5. THE checks SHALL pass: `npm test`, `npx tsc --noEmit`, `claude plugin validate . --strict`, `npm run check:plugin-assets`; a launcher test SHALL assert only on `child_process` and `fs` fields the node 20 docs guarantee (`.spec-workflow/agent-rules.md:30-32`).
 
@@ -120,7 +120,7 @@ No `steering/product.md` exists in this store, so alignment is to the harness op
 
 ### Reliability
 - A DeepSeek spawn SHALL always leave a `spawn.end`; `unknown` beats a wrong number (the spec 8 rule).
-- Refusal beats a silent fallback: a missing key, a missing launcher or a bad map row stops the run with a `note`.
+- Refusal beats a silent fallback: a missing key, a missing launcher or a bad map row stops the run; a start refusal writes no ledger row.
 - The session that runs the harness SHALL never have its provider changed; the child is the only process with the DeepSeek environment.
 
 ### Compatibility
@@ -132,7 +132,7 @@ No `steering/product.md` exists in this store, so alignment is to the harness op
 - D2 — A bad map row, an ineligible role, a missing key or a missing launcher refuses the run with a note; options were ignore the row with a note, fall back to Anthropic for that role, or refuse; chosen because the decomposition rules out a silent fallback and a wrong provider spends the Max plan without saying so.
 - D3 — The launcher is a per-run wrapper next to the event script that calls a body shipped with the harness and tested like the hook; options were the whole script written by the supervisor each run from the formats reference, or a server action; chosen because the body is real logic that needs a test, and the wrapper keeps the decomposition's contract of a file next to the event script.
 - D4 — Ledger keys: provider, model and effort on spawn start; provider, model and the six usage keys on spawn end; run start carries the whole map; options were provider on spawn end only, or a new event type; chosen because both folds already read those rows, and the map on run start is what spec 9 renders.
-- D5 — A refused run writes run start, a note and run end and spawns nothing; options were stopping before any ledger row, or a run start with a refused status; chosen because the ledger and the watch view then show why the run stopped.
+- D5 — A run refused at start (missing key or bad map row, found before any task runs) writes no ledger row and spawns nothing; options were writing `run.start`, a note and `run.end`, or a `run.start` with a refused status; chosen because a run that never reaches a task should not appear in the ledger.
 - D6 — The Anthropic figure is the headline tokens number and DeepSeek is shown beside it, while the existing all-provider totals keep their values in the data; options were dropping DeepSeek from every total, or a provider filter parameter; chosen because the Max plan number must be the one the eye lands on while nothing an existing test asserts changes.
 - D7 — The preflight file is a new docs file in the step-0 answer format and carries five extra probes the design needs (auth path, agents JSON keys, transcript location, hooks in the child, effort); options were appending to the step-0 file, or a HANDOFF row; chosen because the step-0 file is closed and says do not re-run, and the extra probes are the facts the launcher is built on.
 - D8 — A failed preflight (a) escalates and blocks the rest of the spec; options were continuing with the Anthropic-only parts, or deferring the whole spec; chosen because every other deliverable exists to serve the DeepSeek path.
@@ -153,3 +153,5 @@ No `steering/product.md` exists in this store, so alignment is to the harness op
 
 - **v1** (2026-09-21) — Initial draft.
   - **Lint pass.** 24 fixed; rejected: none.
+- **v2** (2026-09-22) — Gate A decision change (refused-at-start run writes no ledger row).
+  - **RI-1**: accepted — refused-at-start run writes no ledger row.
````
