# Adversarial Review — harness-control-pane/requirements (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-requirements.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v3 and the post-fix run is clean (0 findings). A rule with no finding listed here passed: verify meaning only for it. Re-verify only citations the v3 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): none.
- Changes: the diff from the newest `docs(sdd): harness-control-pane requirements v2` commit to the working tree follows as `## Changes since <short sha>`, cut at 500 lines, with the `## Lint commit` diff after it.
- Read the Revision History line for v3 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R2-<n>` (or the earlier round that first raised the seam), naming the finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised is marked `Compounds: R<k>-<n>` for the round `k` that first raised it. Label each round-3 MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch; the label is guidance and does not change the round budget.
- Fix-induced re-check: when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Note: v3 dispositioned round 2 as R2-1 accepted (scope-note citation corrected to `decomposition.md:754-755`), R2-2 partially accepted (restored "distinct from `initial` and `projects-update`" in AC 4.9 and AC 5.10; per-payload source-AC cross-refs left dropped for the cap), R2-3 accepted (AC 4.9 pushes now keyed on the AC 4.8 subscription state, not the `projectId`-only `broadcastToProject`), three minors rejected. The v3 lint pass then added the `src/dashboard/multi-server.ts:205-294` citation to AC 4.9 to ground the restored message names. Verify these fixes did not introduce a new contradiction, and that R2-2's partial acceptance left no dangling reference.
- Fresh lens for this round: failure, rollback and partial-failure paths — trace what the ACs say (and do not say) when a launch, stop, worktree setup, file delete, pointer-line rewrite or dashboard restart half-completes or races a terminal run.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
A `file:line` from the graph is a hint to confirm, not a citation.

## Changes since f15d391

````diff
diff --git a/.spec-workflow/specs/harness-control-pane/requirements.md b/.spec-workflow/specs/harness-control-pane/requirements.md
index f33d416..70ffaed 100644
--- a/.spec-workflow/specs/harness-control-pane/requirements.md
+++ b/.spec-workflow/specs/harness-control-pane/requirements.md
@@ -2,7 +2,7 @@
 
 ## Introduction
 
-This spec adds a Harness page and an Overview page to the existing dashboard: the Harness page sets up, launches, stops and watches one SDD run of one project; the Overview page shows every registered project's harness work and the operator to-do list on one screen. It replaces launching runs by hand with `continue the sdd process` or `claude -p` and watching them in the `--watch` TUI, and changes the supervisor skill to honour a per-run setup file. The only ledger change is two provenance keys on the `run.start` row of a run that applied the file (decomposition entry, spec-decomposition/decomposition.md:665-667); every other key and the TUI renderer are unchanged, and a run with no file writes the same `run.start`.
+This spec adds a Harness page and an Overview page to the existing dashboard: the Harness page sets up, launches, stops and watches one SDD run of one project; the Overview page shows every registered project's harness work and the operator to-do list on one screen. It replaces launching runs by hand and watching them in the `--watch` TUI, and changes the supervisor skill to honour a per-run setup file. The only ledger change is two provenance keys on the `run.start` row of a run that applied the file (decomposition entry, spec-decomposition/decomposition.md:665-667); every other key and the TUI renderer are unchanged.
 
 ## Alignment with Product Vision
 
@@ -81,7 +81,7 @@ The spec store has no steering documents, so this aligns with the decomposition
 6. WHEN a spawn has no tokens or the build has no agent profiles THEN the page SHALL render the row without them.
 7. WHEN no Harness page of a project is open THEN the system SHALL NOT keep a harness watcher running for that project (keyed on the harness-subscriber count of AC 4.8, not `connection.projectId`).
 8. WHEN a Harness page opens for a project THEN it SHALL send a subscribe message whose `type` names the harness view, distinct from the Specs page's `subscribe`, so the server can tell the two apart on one `projectId` — the existing socket binds each connection to a single `connection.projectId` and knows only the `subscribe`, `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294) — and SHALL key the AC 4.7 watcher lifecycle on the harness-subscriber count for that project.
-9. WHEN the server pushes to a Harness page THEN each message SHALL carry a type field the page demultiplexes, distinct from the AC 4.8 messages: one for the run model, one for a batch of new log lines, one for the gate sections; the run-model and gate pushes SHALL reach only that project's harness subscribers via the existing `broadcastToProject` (src/dashboard/multi-server.ts:2139-2151).
+9. WHEN the server pushes to a Harness page THEN each message SHALL carry a type field the page demultiplexes, distinct from the existing `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294): one for the run model, one for a batch of new log lines, one for the gate sections; the run-model and gate pushes SHALL reach only that project's harness subscribers, keyed on the AC 4.8 subscription state, not `broadcastToProject`, which filters on `projectId` alone (src/dashboard/multi-server.ts:2139-2151).
 
 ### Requirement 5 — Overview page
 
@@ -98,7 +98,7 @@ The spec store has no steering documents, so this aligns with the decomposition
 7. IF the HUD file is missing, unreadable or has no `todos` array THEN the system SHALL show an empty list and no error.
 8. WHEN the Overview page is open THEN it SHALL offer no control that edits the HUD file, launches a run or stops a run.
 9. WHEN the Overview page is open THEN the system SHALL watch each registered project's pointer-named ledger and the HUD file with one watcher set shared by all Overview clients, and SHALL close it when the last Overview client leaves.
-10. WHEN the Overview page opens THEN it SHALL send a subscribe message whose `type` names the overview view (all projects), which the single-`projectId` socket of AC 4.8 has no equivalent for; the server SHALL key the AC 5.9 shared watcher set on the overview-subscriber count and push overview rows and the todos list only to them, each with a distinct type field.
+10. WHEN the Overview page opens THEN it SHALL send a subscribe message whose `type` names the overview view (all projects), which the single-`projectId` socket of AC 4.8 has no equivalent for; the server SHALL key the AC 5.9 shared watcher set on the overview-subscriber count and push overview rows and the todos list only to them, each with a type field distinct from `initial` and `projects-update`.
 
 ### Requirement 6 — Compatibility and checks
 
@@ -150,7 +150,7 @@ The spec store has no steering documents, so this aligns with the decomposition
 - Effort per role stays read-only (decomposition).
 - The Overview page does not read the HUD operations array (D1); a later spec may add it.
 - D2 replaces the decomposition's "existing interrupt handling" for run end; no such handling exists for a signalled process.
-- The two `run.start` provenance keys of AC 2.9 are the spec-9 deliverable that "records the overrides on `run.start`" (decomposition entry, spec-decomposition/decomposition.md:665-667, 711). The boundary note "it adds no ledger field" (spec-decomposition/decomposition.md:753-754) scopes per-spawn usage to spec 8, not this: spec 9 adds no per-spawn field and no `RunModel` field, and only the file case changes `run.start` (AC 2.11).
+- The two `run.start` provenance keys of AC 2.9 are the spec-9 deliverable that "records the overrides on `run.start`" (decomposition entry, spec-decomposition/decomposition.md:665-667, 711). The boundary note "it adds no ledger field" (spec-decomposition/decomposition.md:754-755) scopes per-spawn usage to spec 8, not this: spec 9 adds no per-spawn field and no `RunModel` field, and only the file case changes `run.start` (AC 2.11).
 
 ## Revision History
 
@@ -163,3 +163,12 @@ The spec store has no steering documents, so this aligns with the decomposition
   - R1-5 (accepted) — AC 1.1 now reuses the read-only ordering/routing logic without the generator's INDEX.md write.
   - Minors (rejected) — the waiting-state imprecision is self-correcting; the launch flag list and the log/launch-record paths are design-phase details the analysis marks non-blocking.
   - **Lint pass.** 13 fixed; rejected: none.
+- **v3** (2026-09-28) — Round-2 adversarial review dispositions:
+  - R2-1 (accepted) — Corrected the scope-note citation from `decomposition.md:753-754` to `754-755`, the range that carries the quoted phrase "it adds no ledger field" (753 is an unrelated spec-2 note); this is the authority the R1-1 ledger-scope reconciliation rests on.
+  - R2-2 (partially accepted) — Restored the load-bearing demux constraint "distinct from `initial` and `projects-update`" in AC 4.9 and AC 5.10; the per-payload source-AC cross-refs stay dropped to hold the 3,500-word cap, since AC 5.10 already enumerates its two types.
+  - R2-3 (accepted) — AC 4.9 now keys the run-model and gate pushes on the AC 4.8 subscription state, not the existing `broadcastToProject`, which filters on `projectId` alone and cannot restrict to harness subscribers.
+  - Minor 1 — AC 1.1 R1-5 wording (rejected) — the surviving "reuse … through a read-only function, and SHALL NOT call the generator's INDEX.md write path" still states the requirement; analysis rates it non-blocking.
+  - Minor 2 — Introduction key names (rejected) — AC 2.9 still names both `overrides` and `setup`; no content lost.
+  - Minor 3 — AC 2.4 vs 2.6 trigger wording (rejected) — covered because AC 1.11 writes a provider entry per non-omitted role, so a deepseek role always carries `provider=deepseek`.
+  - Body trimmed elsewhere (Introduction) to offset the restored content, holding the 3,500-word cap.
+  - **Lint pass.** 1 fixed; rejected: none.
````

## Lint commit c3a3d8b

````diff
diff --git a/.spec-workflow/specs/harness-control-pane/requirements.md b/.spec-workflow/specs/harness-control-pane/requirements.md
index 0d07e0f..70ffaed 100644
--- a/.spec-workflow/specs/harness-control-pane/requirements.md
+++ b/.spec-workflow/specs/harness-control-pane/requirements.md
@@ -81,7 +81,7 @@ The spec store has no steering documents, so this aligns with the decomposition
 6. WHEN a spawn has no tokens or the build has no agent profiles THEN the page SHALL render the row without them.
 7. WHEN no Harness page of a project is open THEN the system SHALL NOT keep a harness watcher running for that project (keyed on the harness-subscriber count of AC 4.8, not `connection.projectId`).
 8. WHEN a Harness page opens for a project THEN it SHALL send a subscribe message whose `type` names the harness view, distinct from the Specs page's `subscribe`, so the server can tell the two apart on one `projectId` — the existing socket binds each connection to a single `connection.projectId` and knows only the `subscribe`, `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294) — and SHALL key the AC 4.7 watcher lifecycle on the harness-subscriber count for that project.
-9. WHEN the server pushes to a Harness page THEN each message SHALL carry a type field the page demultiplexes, distinct from `initial` and `projects-update`: one for the run model, one for a batch of new log lines, one for the gate sections; the run-model and gate pushes SHALL reach only that project's harness subscribers, keyed on the AC 4.8 subscription state, not the existing `broadcastToProject`, which filters on `projectId` alone (src/dashboard/multi-server.ts:2139-2151).
+9. WHEN the server pushes to a Harness page THEN each message SHALL carry a type field the page demultiplexes, distinct from the existing `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294): one for the run model, one for a batch of new log lines, one for the gate sections; the run-model and gate pushes SHALL reach only that project's harness subscribers, keyed on the AC 4.8 subscription state, not `broadcastToProject`, which filters on `projectId` alone (src/dashboard/multi-server.ts:2139-2151).
 
 ### Requirement 5 — Overview page
 
@@ -171,3 +171,4 @@ The spec store has no steering documents, so this aligns with the decomposition
   - Minor 2 — Introduction key names (rejected) — AC 2.9 still names both `overrides` and `setup`; no content lost.
   - Minor 3 — AC 2.4 vs 2.6 trigger wording (rejected) — covered because AC 1.11 writes a provider entry per non-omitted role, so a deepseek role always carries `provider=deepseek`.
   - Body trimmed elsewhere (Introduction) to offset the restored content, holding the 3,500-word cap.
+  - **Lint pass.** 1 fixed; rejected: none.
````
