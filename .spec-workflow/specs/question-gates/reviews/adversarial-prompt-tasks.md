# Adversarial Review — question-gates/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/tasks.md

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Atomicity, ordering, coverage

**Example attack angles to consider:** Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don't map to any requirement

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, tasks-format, task-requirement-id, task-requirement-unchecked, task-words, coverage-component, coverage-unchecked, bridge-missing on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call):
  - L-1 (warning, citation-identifier, line 4): Identifier 'harness' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
  - L-2 (warning, citation-identifier, line 4): Identifier 'gate' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
  - L-3 (warning, citation-identifier, line 4): Identifier 'computeClassA' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
  - L-4 (warning, citation-identifier, line 4): Identifier 'vitest' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
  - L-5 (warning, citation-identifier, line 4): Identifier 'get' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
  - L-6 (warning, citation-identifier, line 4): Identifier 'delete' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
  - L-7 (warning, bridge-missing, line 39): task 4 names later task 5 with no bridge (the lint reviser rejected this: task 4's forward mention of task 5's runtime re-spawn names no call signature, label or helper task 5 creates; judge it yourself)
  - L-8 (error, citation-path, line 87): bare `agent-rules.md` — in the v1 Lint-pass Revision-History bullet
  - L-9 (error, citation-path, line 88): bare `sdd-reviser.md` — in the v1 Lint-pass bullet
  - L-10 (error, citation-path, line 89): bare `SKILL.md` — in the v1 Lint-pass bullet
  - L-11 (error, citation-path, line 89): bare `references/briefs.md` — in the v1 Lint-pass bullet
  - L-12 (error, citation-path, line 90): bare `SKILL.md` — in the v1 Lint-pass bullet
  Note on L-8..L-12: the lint pass fixed the original bare-path citations in the task bodies but its own Revision-History bullet (lines 86–90) describes the fixes with bare filenames, which spec-lint re-flags as unresolvable paths. These are real residual errors: the fix is to fully-qualify or code-fence those paths in the historical bullet without rewriting history. L-1..L-6 persist because the split preamble still colocates those identifiers with the `agent-rules.md:26` citation.
- Changes: the diff from the `docs(sdd): question-gates tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `question-gates` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` (entry 7) and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on. There are no steering docs (the steering directory is empty), so the decomposition entry and this spec's `requirements.md` and `design.md` are the scope authority.
- Fresh lens for this round: the sub-agent that receives only the task prompt. For each task, take only its `_Prompt:` line plus the merged code the producer tasks leave, and ask whether an implementer could execute it without the surrounding bullets — every artefact named, every restriction and success criterion checkable, no reliance on a call signature or helper name a different task in this document creates.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. (This is the first review; there are none yet.)
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 4c5f609

````diff
diff --git a/.spec-workflow/specs/question-gates/tasks.md b/.spec-workflow/specs/question-gates/tasks.md
index 47de3f1..366e599 100644
--- a/.spec-workflow/specs/question-gates/tasks.md
+++ b/.spec-workflow/specs/question-gates/tasks.md
@@ -1,7 +1,12 @@
 # Tasks Document
 Document version: v1
 
-Dependency order: every producer lands before its consumer, so no task needs a bridge or stub. Task 1 adds the pure `veto-rules.ts` module (new file, no callers). Task 2 adds the `harness` `gate` action, importing task 1's `computeClassA`. Tasks 1-2 are `src/` changes that each leave `npx tsc --noEmit` and the touched `vitest` suites green. Tasks 3-6 are `harness/` prose changes that do not affect the TypeScript compile or the `vitest` suites; each must run `node scripts/sync-plugin-assets.cjs` (committing the `plugins/` copies in the same commit), `npm run check:plugin-assets`, and `claude plugin validate . --strict` (`.spec-workflow/agent-rules.md:26`). Task 3 registers the `gate-a` PHASE value; task 4 grants the drafter the tool and its gate-A step; task 5 emits both gates from the document-phase skill (using task 2's ops and re-spawning task 4's drafter); task 6 runs both gates in the supervisor (consuming task 5's emissions and task 2's `get`/`delete`).
+Dependency order: every producer lands before its consumer, so no task needs a bridge or stub.
+Task 1 adds the pure `veto-rules.ts` module (new file, no callers). Task 2 adds the `harness` `gate` action, importing task 1's `computeClassA`.
+Tasks 1-2 are `src/` changes that each leave `npx tsc --noEmit` and the touched `vitest` suites green.
+Tasks 3-6 are `harness/` prose changes that do not affect the TypeScript compile or the `vitest` suites.
+Each must run `node scripts/sync-plugin-assets.cjs` (committing the `plugins/` copies in the same commit), `npm run check:plugin-assets`, and `claude plugin validate . --strict` (`.spec-workflow/agent-rules.md:26`).
+Task 3 registers the `gate-a` PHASE value; task 4 grants the drafter the tool and its gate-A step; task 5 emits both gates from the document-phase skill (using task 2's ops and re-spawning task 4's drafter); task 6 runs both gates in the supervisor (consuming task 5's emissions and task 2's `get`/`delete`).
 
 - [ ] 1. Add the pure gate-B class (a) module in src/core/veto-rules.ts
   - File: src/core/veto-rules.ts
@@ -36,9 +41,9 @@ Dependency order: every producer lands before its consumer, so no task needs a b
   - Add the `harness` MCP tool to the frontmatter in the three plugin-prefixed forms that mirror the reviser's `adversarial-response` grant, and add one requirements-phase-only body step.
   - The step extracts and ranks at most five direction-setting decisions from the document's own `## Decisions taken in this document`, builds one header/question/options triple each (options[0] the recorded choice plus at most three rejected alternatives in clause order), and writes `{items}` through the gate action's `put` op (task 2, slot a) before the report; design and tasks phases write nothing.
   - Purpose: Put gate A's ranked decisions on the server surface (design Component 3, Req 2.1).
-  - _Leverage: sdd-reviser.md:14-16 (three-form MCP grant), harness/agents/sdd-drafter.md:7-13,16-26, design Data Models GateADecision_
+  - _Leverage: harness/agents/sdd-reviser.md:14-16 (three-form MCP grant), harness/agents/sdd-drafter.md:7-13,16-26, design Data Models GateADecision_
   - _Requirements: 2.1, 1.6_
-  - _Prompt: Task: Per design Component 3, add the harness MCP tool to sdd-drafter.md's tools in all three plugin-prefixed forms (as sdd-reviser.md:14-16 grants adversarial-response), and add a requirements-phase-only step that extracts up to five ranked direction-setting decisions from the document's own Decisions section, builds one header/question/options triple each capped at four options, and writes {items} through the gate action's put op that task 2 adds (slot a) before the drafter's report. When the document-phase skill (task 5) re-spawns the drafter after a decision-touching lint fix, re-read the corrected section, re-extract and re-rank the full set, and re-put the complete item list (put overwrites the whole file). | Restrictions: Only the requirements phase writes a gate-A payload; keep the drafter's report under 150 words with no file contents; edit only harness/ source, never the plugins/ copies. | Success: The frontmatter lists the three harness forms; the body step matches Req 2.1 and design D9; node scripts/sync-plugin-assets.cjs regenerates plugins/ (committed together); npm run check:plugin-assets and claude plugin validate . --strict pass._
+  - _Prompt: Task: Per design Component 3, add the harness MCP tool to sdd-drafter.md's tools in all three plugin-prefixed forms (as harness/agents/sdd-reviser.md:14-16 grants adversarial-response), and add a requirements-phase-only step that extracts up to five ranked direction-setting decisions from the document's own Decisions section, builds one header/question/options triple each capped at four options, and writes {items} through the gate action's put op that task 2 adds (slot a) before the drafter's report. When the document-phase skill (task 5) re-spawns the drafter after a decision-touching lint fix, re-read the corrected section, re-extract and re-rank the full set, and re-put the complete item list (put overwrites the whole file). | Restrictions: Only the requirements phase writes a gate-A payload; keep the drafter's report under 150 words with no file contents; edit only harness/ source, never the plugins/ copies. | Success: The frontmatter lists the three harness forms; the body step matches Req 2.1 and design D9; node scripts/sync-plugin-assets.cjs regenerates plugins/ (committed together); npm run check:plugin-assets and claude plugin validate . --strict pass._
 
 - [ ] 5. Emit gate A and assemble gate B in the document-phase skill
   - File: harness/skills/sdd-document-phase/SKILL.md
@@ -46,7 +51,7 @@ Dependency order: every producer lands before its consumer, so no task needs a b
   - Gate A: Step 1 (requirements, MODE normal) returns `PHASE: gate-a` after the Lint step and before Step 2; a fixed lint finding whose line falls in the Decisions-section range re-spawns the drafter (task 4) first. A resume to a later step never re-emits it.
   - Gate B: the round prompt tags new-dependency/out-of-scope tasks `[gate-b:Tid]`/`[gate-c:Tid]`, the reviser records kept or removed, and the first `approved` (Step 6, MODE normal) folds the kept tags with `gate class-a` (task 2) into one ranked list `put` to slot b; MODE revision writes none.
   - Purpose: Emit both gates without reading the document body (design Component 4).
-  - _Leverage: SKILL.md:69-120 (Step 1 + Lint), :80-85,127-131 (round-prompt injection), :236-245 (Step 6), references/briefs.md:194-218, src/core/lint-types.ts:17-24_
+  - _Leverage: harness/skills/sdd-document-phase/SKILL.md:69-120 (Step 1 + Lint), :80-85,127-131 (round-prompt injection), :236-245 (Step 6), harness/skills/sdd-document-phase/references/briefs.md:194-218, src/core/lint-types.ts:17-24_
   - _Requirements: 2.2, 2.3, 4.1, 4.3, 4.4, 5.6_
   - _Prompt: Task: Per design Component 4, edit the document-phase skill and briefs so Step 1 (requirements, MODE normal) returns PHASE: gate-a after the Lint step and before Step 2, re-spawning the drafter (task 4) when a fixed lint finding's line falls inside the Decisions section range computed from LINT.findings minus LINT.open and grep -n '^#'; and so gate B is assembled from reviewer tags [gate-b:Tid]/[gate-c:Tid] injected at the same round-prompt point Step 1 item 3 uses for RE-DECIDED, recorded kept or removed in the reviser's Revision-History bullet, then collected by grepping Revision-History lines, folded with gate class-a (task 2) into one ranked list, and put to slot b on the first approved. | Restrictions: Never read the document body beyond the permitted greps and worker reports; MODE revision returns no veto list and re-emits no gate-a; edit only harness/ source, never the plugins/ copies. | Success: Step 1 returns gate-a only in the requirements normal path; the gate-B veto list is assembled without a body read and put to slot b once; node scripts/sync-plugin-assets.cjs regenerates plugins/ (committed together); npm run check:plugin-assets and claude plugin validate . --strict pass._
 
@@ -56,7 +61,7 @@ Dependency order: every producer lands before its consumer, so no task needs a b
   - Gate A: on `PHASE: gate-a`, receipt then ask, route approve to MODE normal and any change to one MODE revision re-spawn; record writes no answer and a HANDOFF row.
   - Gate B: before the first implementation spawn/worktree entry, `gate get` slot b, ask approve-or-annotate (one round on annotate; record writes the veto list and a HANDOFF row), then `gate delete` slot b.
   - Purpose: Resolve each gate's mode, ask or record, and route, never stalling (design Component 5).
-  - _Leverage: SKILL.md:146-210, :215-230, :232-261, :60_
+  - _Leverage: harness/skills/sdd-continue/SKILL.md:146-210, :215-230, :232-261, :60_
   - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2_
   - _Prompt: Task: Per design Component 5, add gate execution to the supervisor skill. Add mode resolution (read gates: block | record from agent-rules.md; default block when AskUserQuestion is available, record when not; a denied, errored or absent call is record and leaves the ledger headless flag untouched) and document the optional key. On PHASE: gate-a, gate get slot a, write and commit the questions.md receipt best-effort before asking, ask the triples (at most five across at most two calls, four options each), map an approve to options[0] verbatim with no free text and anything else to a single MODE revision re-spawn naming each decision's option and free text, and record every decision and answer; record mode writes no answer, a HANDOFF row, and MODE normal. Before the first implementation spawn and worktree entry, gate get slot b, ask approve-or-annotate (annotate runs one MODE revision tasks round; record writes the veto list and a HANDOFF row), then gate delete slot b so a later entry finds present false. | Restrictions: Never stall an unattended run; never read a spec document; a denied call never flips headless; edit only harness/ source, never the plugins/ copies. | Success: Both gates resolve, ask or record, and route without stalling; gate B runs at most once via gate delete; node scripts/sync-plugin-assets.cjs regenerates plugins/ (committed together); npm run check:plugin-assets and claude plugin validate . --strict pass._
 
@@ -78,3 +83,8 @@ Dependency order: every producer lands before its consumer, so no task needs a b
 
 ## Revision History
 - **v1** (2026-09-16) — Initial draft.
+  - **Lint pass.** 11 fixed; rejected: L-7 (task 4's mention of task 5's re-spawn behavior names no call signature, label or helper name task 5 creates, so the template's bridge/stub rule does not trigger; D1's producer-before-consumer order already covers it).
+    - L-1..L-6 (accepted): split the overloaded dependency-order paragraph into one sentence per line so the `agent-rules.md:26` citation sits only with the identifiers it supports (`node scripts/sync-plugin-assets.cjs`, `plugins/`, `npm run check:plugin-assets`, `claude plugin validate . --strict`); no other paragraph in the document mixes a citation with unrelated identifiers.
+    - L-8, L-9 (accepted): prefixed both bare `sdd-reviser.md:14-16` citations (task 4 Leverage and Prompt lines) with `harness/agents/`; verified against harness/agents/sdd-reviser.md:14-16.
+    - L-10, L-11 (accepted): prefixed task 5's bare `SKILL.md:69-120` with `harness/skills/sdd-document-phase/` and bare `references/briefs.md:194-218` with the same directory; verified against harness/skills/sdd-document-phase/SKILL.md:69-120 and harness/skills/sdd-document-phase/references/briefs.md:194-218.
+    - L-12 (accepted): prefixed task 6's bare `SKILL.md:146-210` with `harness/skills/sdd-continue/`; verified against harness/skills/sdd-continue/SKILL.md:146-210,215-230,232-261,60.
````
