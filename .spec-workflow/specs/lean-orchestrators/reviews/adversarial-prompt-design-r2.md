# Adversarial Review — lean-orchestrators/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md using this format:

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

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid and doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below (the v2 lint pass fixed 0 and changed no citation; it only added a Revision-History bullet). Still open (error = MUST_FIX candidate, warning = your call, info = a note) — all citation-identifier warnings, rejected in the v1 and v2 lint passes because each names a design-introduced identifier (a new type, field, report key, or `orient` datum), a data value matched against behaviour code, or a cross-file token the rule mis-associated with a correct behavioural citation. Verify that each cited range anchors its adjacent claim; the flagged identifier need not appear literally in the range. The same set as round 1 minus the two line-215 identifiers the v2 delta removed:
  - line 40: `UsageCell`, `wUnknown` (src/watch/usage.ts:259-275)
  - line 42: `round`, `implementation` (src/watch/usage.ts:116-124)
  - line 44: `perUnit` (src/watch/usage.ts:365-367)
  - line 81: `sources`, `listSpawns`, `resolveSession`, `findTranscript`, `readFile`, `breakdownTranscript`, `perUnit`, `compareSources` (src/tools/harness.ts:1215-1244)
  - line 95: `nextStep`, `Repair`, `safeJoin` (.spec-workflow/spec-decomposition/decomposition.md:771)
  - line 123: `brief` (harness/skills/sdd-continue/references/formats.md:164-183)
  - line 159: `nextStep` (harness/skills/sdd-document-phase/SKILL.md:224-273)
  - line 167: `nextTask` (src/tools/review-task.ts:263-267)
  - lines 176–183: worker report keys on each agent file's replaced report bullet (harness/agents/*.md)
  - line 190: `total`, `harness`, `orient` (harness/skills/sdd-continue/SKILL.md:379-380)
- Changes: the diff from the newest `docs(sdd): lean-orchestrators design v1` commit to the working tree follows as `## Changes since <short sha>`, cut at 500 lines, with the v2 `## Lint commit` after it.
- Read the Revision History line for v2 first and attack those changes before anything else. The v2 delta accepted three round-1 findings: R1-1 cut `QueuedTask.testFiles` and `integration` (and the paragraph defining them off the absent `- Test (integration):` convention); R1-2 pinned `data.sources` and `data.compareSources` shapes in Data Models; R1-3 changed `listSpawns` to draw W from the token-setting row. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v2 delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam round 1 already raised is marked `Compounds: R1-<n>`. Label each MUST_FIX `fix-induced` when the v2 delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the v2 delta did not touch; the label is guidance and does not change the round budget.
- Fix-induced re-check: when a finding is caused by the v2 fix — a regression of earlier-agreed wording, not a newly discovered defect — scope your check to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check.
- Fresh lens for this round: the cost of touching an existing component — the tests, fixtures and callers of every file this design edits or deletes. The design moves `BRIEF_TEMPLATES` to a new module, deletes both `references/briefs.md` files and converts the drift-guard test (`src/tools/__tests__/harness.test.ts:491-495`) to per-kind snapshots, adds a `W` column to every usage table row, and rewrites step text across the skills. Trace each such change to the existing tests and callers it breaks, and confirm the design accounts for them.
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch (a race loser included) pins both its error-type discriminant and its response status or exit behaviour in the design, not only its message. A named error branch that leaves its discriminant or its status/exit unstated is a MUST_FIX.
- Closed by ruling, do not re-open: the five drafter RE-DECIDED literals, ruled refinement (closed) in round 1 — Req 1.5 (per-call W from the last line of each message.id), Req 3.3 (lint rules inline in the Lint step), Req 4.2 (orient returns the whole open-task queue with files and test files), Req 6.4 (one generic book.sh written by a harness brief template), Req 7.3 (runaway guard uses the task total).
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
A `file:line` from the graph is a hint to confirm, not a citation.

## Changes since b094f68

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/design.md b/.spec-workflow/specs/lean-orchestrators/design.md
index 12a1183..53d7d0f 100644
--- a/.spec-workflow/specs/lean-orchestrators/design.md
+++ b/.spec-workflow/specs/lean-orchestrators/design.md
@@ -38,7 +38,7 @@ graph LR
 - **Interfaces:**
   - `spawnW(row: LedgerEvent): number | undefined` returns `input + 1.25·cacheWrite5m + 2·cacheWrite1h + 0.1·cacheRead + 5·output` from a `spawn.end` row, or `undefined` when any of the five is not a digit string.
   - `UsageCell` gains `w` and `wUnknown`; W comes from the row that sets tokens (`src/watch/usage.ts:259-275`), and a spawn with tokens only from `spawn.usage`, or undefined W, adds 1 to `wUnknown`.
-  - `listSpawns(events: LedgerEvent[]): SpawnSummary[]`: each reduced spawn, same pairing (`src/watch/usage.ts:137-155`) and phase rule (`src/watch/usage.ts:290-296`), with the latest `spawn.end` row's `agentId` and W.
+  - `listSpawns(events: LedgerEvent[]): SpawnSummary[]`: each reduced spawn, same pairing (`src/watch/usage.ts:137-155`) and phase rule (`src/watch/usage.ts:290-296`), with the latest `spawn.end` row's `agentId` and W from the row that sets tokens (`src/watch/usage.ts:259-275`), as in C1.
   - `unitCount(events: LedgerEvent[], phase: string): number`: `round` rows whose `phase` key matches, for a document phase; for `implementation`, `task.done` rows inside an implementation window (`src/watch/usage.ts:116-124`).
   - `UsagePhase` gains `orchW` (the two orchestrator cells' W), `units` and `orchWPerUnit: number | null` (null at 0 units).
   - `formatUsageTable(report, compare?, opts?: { perUnit?: boolean })`, trailing parameter optional: a `W` column after `tokens` in every row, ` (+N unknown)` as in `src/watch/usage.ts:365-367`; with `perUnit`, phase totals add `orch W/round` or `orch W/task`, and the compare table prints both and the delta.
@@ -209,10 +209,10 @@ type SpawnSources =
   | { phase: string; agent: string; agentId: string; ledgerW: number | null; ok: true; breakdown: TranscriptBreakdown; diff: number | null }
   | { phase: string; agent: string; agentId: string | undefined; ledgerW: number | null; ok: false; reason: 'no-agent-id' | 'no-session' | 'invalid-id' | 'missing' | 'unreadable' }
 interface SourcesReport { spec: string; spawns: SpawnSources[]; unknown: number }
-interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progress'; files: string[]; testFiles: string[]; integration: boolean }
+interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progress'; files: string[] }
 ```
 
-`testFiles` holds the paths of the task's `- Test:` seams (`src/core/task-parser.ts:8-11`). `integration` is true when the block holds `- Test (integration):`.
+`data.sources` is a `SourcesReport`; `data.compareSources` is `SourcesReport | null`.
 
 ## Error Handling
 
@@ -269,5 +269,10 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
 
 ## Revision History
 
+- **v2** (2026-10-02) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/2).
+  - **Lint pass.** 0 fixed; rejected: the 43 citation-identifier warnings — same disposition as v1, each names a design-introduced identifier (a new type, field, report key, or orient datum), a data value matched against behaviour code, or a cross-file token the rule mis-associated with a correct behavioural citation; every cited range re-verified to anchor its adjacent claim. No errors.
+  - **R1-1 — Accepted (SHOULD_FIX).** Cut the two consumerless fields from the open-task queue entry (the test-file list and the integration flag), leaving only its id, title, status and file list, and deleted the paragraph that defined them off an absent test-bullet convention.
+  - **R1-2 — Accepted (MINOR).** Data Models now pins both source-breakdown response fields, the compare field as a nullable source report.
+  - **R1-3 — Accepted (MINOR).** The spawn-listing function now states its weighted-token figure comes from the same token-setting row as the usage fold, so it cannot diverge on an unknown re-fire.
 - **v1** (2026-10-02) — Initial draft.
   - **Lint pass.** 2 fixed (readUsage citation tightened to the line the symbol starts on; cross-repo absolute path dropped from the C5 scenario-form note, keeping the in-repo citation); rejected: the 45 remaining citation-identifier warnings — all name design-introduced identifiers (new types and fields such as the W and unknown-W cells, per-unit fields, the orient queue and next-task, and the new worker report keys), data values matched against behaviour code, or cross-file tokens the rule mis-associated with a correct behavioural citation; each cited range was re-verified to anchor its adjacent claim.
````

## Lint commit 209e169

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/design.md b/.spec-workflow/specs/lean-orchestrators/design.md
index db2f368..53d7d0f 100644
--- a/.spec-workflow/specs/lean-orchestrators/design.md
+++ b/.spec-workflow/specs/lean-orchestrators/design.md
@@ -270,6 +270,7 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
 ## Revision History
 
 - **v2** (2026-10-02) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/2).
+  - **Lint pass.** 0 fixed; rejected: the 43 citation-identifier warnings — same disposition as v1, each names a design-introduced identifier (a new type, field, report key, or orient datum), a data value matched against behaviour code, or a cross-file token the rule mis-associated with a correct behavioural citation; every cited range re-verified to anchor its adjacent claim. No errors.
   - **R1-1 — Accepted (SHOULD_FIX).** Cut the two consumerless fields from the open-task queue entry (the test-file list and the integration flag), leaving only its id, title, status and file list, and deleted the paragraph that defined them off an absent test-bullet convention.
   - **R1-2 — Accepted (MINOR).** Data Models now pins both source-breakdown response fields, the compare field as a nullable source report.
   - **R1-3 — Accepted (MINOR).** The spawn-listing function now states its weighted-token figure comes from the same token-setting row as the usage fold, so it cannot diverge on an unknown re-fire.
````
