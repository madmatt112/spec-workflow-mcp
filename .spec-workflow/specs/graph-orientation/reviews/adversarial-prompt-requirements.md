# Adversarial Review — graph-orientation/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below (the v1 lint pass fixed 0 findings; it only recorded dispositions). Still open (error = MUST_FIX candidate, warning = your call, info = a note) — the v1 lint pass rejected all of these as naming to-be-built artifacts of this feature (the `GRAPH`/`GRAPH_BEHIND`/`GRAPH_BUILT_AT` env keys, the `graph`/`graphBuiltAt`/`graphBehind` fields, `explain`/`query` subcommands), which do not yet exist in the cited ranges; confirm that reasoning holds:
  - L-1 (warning, citation-identifier, line 19): Identifier 'GRAPH' absent from harness/skills/sdd-continue/SKILL.md:66-94, :224-247
  - L-2 (warning, citation-identifier, line 23): Identifier 'GRAPH' absent from harness/skills/sdd-continue/SKILL.md:224-247
  - L-3 (warning, citation-identifier, line 24): Identifier 'GRAPH' absent from harness/skills/sdd-continue/SKILL.md:320-327
  - L-4 (warning, citation-identifier, line 24): Identifier 'GRAPH_BEHIND' absent from harness/skills/sdd-continue/SKILL.md:320-327
  - L-5 (warning, citation-identifier, line 24): Identifier 'GRAPH_BUILT_AT' absent from harness/skills/sdd-continue/SKILL.md:320-327
  - L-6 (warning, citation-identifier, line 35): Identifier 'GRAPH' absent from harness/skills/sdd-implementation-phase/SKILL.md:84-159
  - L-7 (warning, citation-identifier, line 36): Identifier 'GRAPH' absent from harness/skills/sdd-closeout-phase/SKILL.md:120-159
  - L-8 (warning, citation-identifier, line 48): Identifier 'graph' absent from src/tools/harness.ts:28-49, :485-535
  - L-9 (warning, citation-identifier, line 53): Identifier 'graph' absent from src/tools/harness.ts:617-631
  - L-10 (warning, citation-identifier, line 53): Identifier 'graphBuiltAt' absent from src/tools/harness.ts:617-631
  - L-11 (warning, citation-identifier, line 53): Identifier 'graphBehind' absent from src/tools/harness.ts:617-631
  - L-12 (warning, citation-identifier, line 65): Identifier 'GRAPH' absent from harness/skills/sdd-document-phase/references/briefs.md:136-208, :386-409
  - L-13 (warning, citation-identifier, line 75): Identifier 'GRAPH' absent from harness/skills/sdd-document-phase/references/briefs.md:50-59
  - L-14 (warning, citation-identifier, line 75): Identifier 'explain' absent from harness/skills/sdd-document-phase/references/briefs.md:50-59
  - L-15 (warning, citation-identifier, line 75): Identifier 'query' absent from harness/skills/sdd-document-phase/references/briefs.md:50-59
  - L-16 (warning, citation-identifier, line 89): Identifier 'graph' absent from src/watch/usage.ts:361-410
  - L-17 (warning, citation-identifier, line 100): Identifier 'graph' absent from docs/TOOLS-REFERENCE.md:547-579
- Changes: the diff from the `docs(sdd): graph-orientation requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `graph-orientation` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under /home/mcf/repo/spec-workflow-mcp; the spec store under /home/mcf/repo/spec-workflow-mcp/.spec-workflow. Use absolute paths. Project rules for reading code and running checks: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since fd3d59e

````diff
diff --git a/.spec-workflow/specs/graph-orientation/requirements.md b/.spec-workflow/specs/graph-orientation/requirements.md
index 10aa29d..95f6921 100644
--- a/.spec-workflow/specs/graph-orientation/requirements.md
+++ b/.spec-workflow/specs/graph-orientation/requirements.md
@@ -16,7 +16,7 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 
 #### Acceptance Criteria
 
-1. WHEN the supervisor has resolved the roots (`harness/skills/sdd-continue/SKILL.md:66-94`) THEN the supervisor SHALL resolve `GRAPH` to `<CODE_ROOT>/graphify-out/graph.json` when `CODE_ROOT` is not a worktree, and to `<main checkout>/graphify-out/graph.json` when it is.
+1. WHEN the supervisor has resolved the roots (`harness/skills/sdd-continue/SKILL.md:66-94`) THEN the supervisor SHALL resolve `GRAPH` to `<CODE_ROOT>/graphify-out/graph.json` when `CODE_ROOT` (`harness/skills/sdd-continue/SKILL.md:224-247`) is not a worktree, and to `<main checkout>/graphify-out/graph.json` when it is.
 2. IF that file does not exist OR `command -v graphify` fails THEN the supervisor SHALL set `GRAPH` to `none`.
 3. WHEN `GRAPH` is a path THEN the supervisor SHALL read the top-level `built_at_commit` key of the file and set `GRAPH_BEHIND` to the output of `git rev-list --count <built_at_commit>..HEAD` run in `CODE_ROOT`, and `GRAPH_BUILT_AT` to that sha.
 4. IF `built_at_commit` is missing OR the `git rev-list` call fails THEN the supervisor SHALL set `GRAPH_BEHIND` to `unknown` and `GRAPH_BUILT_AT` to `unknown`.
@@ -45,14 +45,14 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 
 #### Acceptance Criteria
 
-1. WHEN `harness` `brief` is called with `values.graph` set to a path THEN the tool SHALL append a `## Code graph` section at the end of the brief, for every template in `BRIEF_TEMPLATES` (`src/tools/harness.ts:485-535`) and for any template added later.
+1. WHEN `harness` `brief` (`src/tools/harness.ts:28-49`) is called with `values.graph` set to a path THEN the tool SHALL append a `## Code graph` section at the end of the brief, for every template in `BRIEF_TEMPLATES` (`src/tools/harness.ts:485-535`) and for any template added later.
 2. The section SHALL state: the graph path; the three calls with `--graph <path>`: `graphify explain "<symbol>"` for one symbol and its edges, `graphify path "A" "B"` for a chain, and `graphify query "<terms>" --budget 800` for an area, with terms taken from the graph's labels; the rule (below); and the freshness line.
 3. The rule text SHALL say: run `explain` on a symbol before opening its code file, then read only the cited range to confirm it; never use the graph for the spec store; when `explain` prints "No node matching", read the file as before; an `[INFERRED]` edge is never a citation; a citation in a document or the context file names a range the worker read.
 4. The freshness line SHALL read `built at <values.graphBuiltAt>, <values.graphBehind> commits behind HEAD`; WHEN `graphBehind` is not `0` THEN the line SHALL add that a `file:line` from the graph is a hint to confirm, not a citation.
 5. IF `values.graph` is absent or equals `none` THEN the tool SHALL write a brief byte-identical to the pre-spec output for the same template and values.
 6. IF `values.graph` is a path AND `values.graphBuiltAt` or `values.graphBehind` is absent THEN the tool SHALL fail naming the missing values and write no file, as the missing-value rule does (`src/tools/harness.ts:617-631`).
 7. The graph values SHALL NOT be `{{key}}` placeholders of any template, so a caller that passes no graph value never fails the missing-value rule.
-8. The tool SHALL NOT read `graph.json`, run `git` or spawn any process: every graph fact comes from `values` (`src/tools/harness.ts:17-27`).
+8. The tool SHALL NOT read `graph.json`, run git or spawn any process (`src/tools/harness.ts:17-27`): every graph fact comes from `values` (`src/tools/harness.ts:547-655`).
 
 ### Requirement 4 — Every orchestrator passes the graph to every worker
 
@@ -85,7 +85,7 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 
 1. WHEN `harness` `usage` runs for a spec THEN it SHALL read `harness-activity.jsonl` from the spec dir next to `harness-events.jsonl`; IF the file is missing THEN every graph count SHALL be 0 and the call SHALL succeed.
 2. A graph call SHALL be one activity row with `event: tool`, `tool: Bash`, and a `summary` that names `graphify explain`, `graphify query` or `graphify path`; one row counts once, and a `graphify update` row does not count.
-3. The fold SHALL attribute each graph call to the row's `agent` and to the phase whose live window contains the row's `ts`, by the rule `src/watch/usage.ts:277-294` applies to a spawn's start, else to phase `unknown`.
+3. The fold SHALL attribute each graph call to the row's `agent` and to the phase whose live window contains the row's `ts`, by the rule `src/watch/usage.ts:277-296` applies to a spawn's start, else to phase `unknown`.
 4. The one-report and compare tables (`src/watch/usage.ts:361-410`) SHALL print a `graph` column on every phase-agent row, every phase total and the spec total, and `data.report` SHALL carry the counts.
 5. IF an agent has graph calls in a phase but no spawn cell there THEN the table SHALL print a row for it with 0 spawns.
 6. WHEN `compareSpecName` names a spec THEN the tool SHALL read that spec's activity log the same way, so `harness usage` for this spec against `agent-cache-ttl` prints that run's count.
@@ -144,3 +144,4 @@ The steering directory holds no `product.md`, so this spec aligns with the harne
 ## Revision History
 
 - **v1** (2026-09-25) — Initial draft.
+  - **Lint pass.** 6 fixed (L-2, L-9, L-10, L-15, L-16, L-21); rejected: L-1, L-3, L-4, L-5, L-6, L-7, L-8, L-11, L-12, L-13, L-14, L-17, L-18 (GRAPH/graph/graphBuiltAt/graphBehind are new names this spec proposes, absent from the cited code today), L-19, L-20 (explain/query are content Requirement 5 adds to that section, not there yet), L-22, L-23 (the graph column is new, not in usage.ts or the docs table yet).
````
