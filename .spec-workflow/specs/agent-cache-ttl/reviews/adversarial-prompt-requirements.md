# Adversarial Review — agent-cache-ttl/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/requirements.md

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

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2. This is the first adversarial review, but the document is at v2: v1 was drafted, then a human's Gate A answers produced v2. Read the v2 Revision History line first and attack those changes before anything else — the Gate A change (RI-1) removed the verification-deferral path for the live scenarios (1),(2),(3),(5) and replaced it with a block-until-restart condition on the PR, and rewrote decision D10. Verify the document is internally consistent after that change: no remaining clause, acceptance criterion, or decision still says the live half may be deferred; every cross-reference to D10 agrees; scenarios (4) and (6) are unchanged.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything; it found 0 errors and 29 citation-identifier warnings, all of which the v2 lint pass rejected as unchanged since v1 (identifiers the spec proposes to add at the cited attachment points, framed as additions). A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Still open (warning = your call): L-1..L-29 are those 29 citation-identifier warnings on lines 22, 32, 33, 43, 50, 62, 63, 66, 68, 78, 88, 89 — each names a proposed-new identifier (cacheTtl, experimental, default, cacheWrite5m, cacheWrite1h, gapRewrites, cacheUnknown, cw5m, cw1h, unknown, CACHE_TTL, claude, HOME) absent from its cited range because it does not exist yet. Ruled at v1 as addition-point citations; re-raise only with new evidence.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): agent-cache-ttl requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review of this spec's requirements: read the decomposition entry for `agent-cache-ttl` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fresh lens for this round: wire contracts across a boundary (the hook that writes the cache keys, the event-row schema, the usage-report reader, and the run.start override) — check the producer and every consumer agree on field names, presence, and the unknown/dash conventions.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-memory-requirements.md`. It does not exist yet. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-requirements.md

## Changes since 4e9b27d

````diff
diff --git a/.spec-workflow/specs/agent-cache-ttl/requirements.md b/.spec-workflow/specs/agent-cache-ttl/requirements.md
index b0ef30f..5f3fd20 100644
--- a/.spec-workflow/specs/agent-cache-ttl/requirements.md
+++ b/.spec-workflow/specs/agent-cache-ttl/requirements.md
@@ -101,7 +101,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 4. Scenario (4): `harness usage` on the fixture ledger SHALL print the three columns with digits, and on the `provider-per-role` ledger SHALL print them as `unknown` (Requirement 4 criterion 8).
 5. Scenario (5): A run started with `FORCE_PROMPT_CACHING_5M=1` exported SHALL have `cacheTtl=FORCE_PROMPT_CACHING_5M=1` on its `run.start` row, and the supervisor output SHALL contain exactly one `warning: cacheTtl` line.
 6. Scenario (6): `npm run check:plugin-assets`, `claude plugin validate . --strict` (at the repository root, as `.spec-workflow/agent-rules.md` runs it) and `npm test` SHALL pass.
-7. IF the session that runs the end-to-end gate does not run the changed hook, agents or supervisor skill (this machine runs the harness from the main checkout, so worktree changes are live only after merge and a session restart) THEN scenarios (1), (2), (3) and (5) SHALL be recorded as one deferral with tag `verification`, naming each scenario and its pass condition, and the PR SHALL NOT be blocked on them; scenarios (4) and (6) SHALL run before the PR (D10).
+7. IF the session that runs the end-to-end gate does not run the changed hook, agents or supervisor skill (this machine runs the harness from the main checkout, so worktree changes are live only after merge and a session restart) THEN scenarios (1), (2), (3) and (5) SHALL NOT be recorded as passed from that session; the pull request SHALL stay unopened, or if already opened SHALL stay not marked ready for review, until a session restarted on the rebuilt harness has run scenarios (1), (2), (3) and (5) and recorded their evidence. Scenarios (4) and (6) SHALL run and pass before the PR is opened or marked ready (D10).
 
 ## Non-Functional Requirements
 
@@ -127,7 +127,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 - D7 — Claude Code version unreadable: options were record unknown and warn, record unsupported, record per-agent; chose unknown because it neither hides nor invents a fact.
 - D8 — Settings files the probe reads: options were the code root's local and project settings plus the user settings, those three plus managed settings, user settings only; chose the three because they are the files a user edits here, and managed settings are not used on this machine.
 - D9 — Frontmatter form: options were the one-line flow mapping from the decomposition, a two-line block mapping; chose the one-line form because the profile builder parses one line per key.
-- D10 — Live scenarios when the session runs the old harness: options were defer the live half with a verification deferral, block the PR until a restarted session runs them; chose the deferral because the project instructions already name this path for harness specs.
+- D10 — Live scenarios when the session runs the old harness: options were defer the live half with a verification deferral, block the PR until a restarted session runs them; Gate A chose blocking the PR until a session restarted on the rebuilt harness has run scenarios (1), (2), (3) and (5) and recorded their evidence, superseding the deferral this document first recorded.
 - D11 — Override precedence: options were first match in force flag, environment variable, then settings files local, project, user, report every override found; chose the first match because the run start row holds one value and any match already means the frontmatter does not apply.
 
 ## Scope notes
@@ -144,3 +144,7 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 
 - **v1** (2026-09-24) — Initial draft.
   - **Lint pass.** 13 fixed (L1-3, L14-19, L34-35, L36, L37); rejected: L4-5, L6-7, L20-31 (interface/function citations already the exact attachment point for a field this spec proposes to add, already framed as an addition); L8-13 (event-row citations already exact; new keys explicitly marked as additions); L32-33 (Step 0 and event-table-row citations already the single exact attachment line).
+- **v2** (2026-09-24) — Gate A answers (questions.md), verdict revision.
+  - **RI-1 — Accepted.** Removed the verification-deferral path for live scenarios (1), (2), (3), (5): Requirement 6 criterion 7 now states the blocking condition (the PR stays unopened, or not marked ready, until a session restarted on the rebuilt harness has run those scenarios and recorded their evidence); scenarios (4) and (6) are unchanged. D10 in the decision log is rewritten to record the block-until-restart choice in place of the superseded deferral; both citations to D10 in the document now agree.
+  - **RI-2 — Rejected (already correct).** The document already states each recorded Gate A choice: D1 uses the earliest line timestamp per message id, D5 counts unknown with a DeepSeek dash, D3 uses one key holding the setting name and value, D2 marks all three fields unknown on a partial split. No contradiction found, so no edit made.
+  - **Lint pass.** 0 fixed; rejected: L1-29 (unchanged since v1, suppressed per rule 11).
````

## Lint commit e3fdf8c

````diff
diff --git a/.spec-workflow/specs/agent-cache-ttl/requirements.md b/.spec-workflow/specs/agent-cache-ttl/requirements.md
index 080247a..5f3fd20 100644
--- a/.spec-workflow/specs/agent-cache-ttl/requirements.md
+++ b/.spec-workflow/specs/agent-cache-ttl/requirements.md
@@ -147,3 +147,4 @@ No `steering/product.md` exists in this spec store; alignment is to the efficien
 - **v2** (2026-09-24) — Gate A answers (questions.md), verdict revision.
   - **RI-1 — Accepted.** Removed the verification-deferral path for live scenarios (1), (2), (3), (5): Requirement 6 criterion 7 now states the blocking condition (the PR stays unopened, or not marked ready, until a session restarted on the rebuilt harness has run those scenarios and recorded their evidence); scenarios (4) and (6) are unchanged. D10 in the decision log is rewritten to record the block-until-restart choice in place of the superseded deferral; both citations to D10 in the document now agree.
   - **RI-2 — Rejected (already correct).** The document already states each recorded Gate A choice: D1 uses the earliest line timestamp per message id, D5 counts unknown with a DeepSeek dash, D3 uses one key holding the setting name and value, D2 marks all three fields unknown on a partial split. No contradiction found, so no edit made.
+  - **Lint pass.** 0 fixed; rejected: L1-29 (unchanged since v1, suppressed per rule 11).
````
