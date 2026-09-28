# Adversarial Review — harness-control-pane/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below (the lint pass added directory prefixes to skill, reference and providers-script citations). Still open (error = MUST_FIX candidate, warning = your call, info = a note): 63 citation-identifier warnings (warning, citation-identifier) — every one names a design-introduced identifier, a string-literal value, or a probe-verified node field flagged absent from a correct context citation on the same line; the orchestrator verified the cited ranges are correct and rejected all 63 as the known false-positive class. Verify meaning only; do not re-litigate these as citation errors.
- Changes: the diff from the `docs(sdd): harness-control-pane design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `harness-control-pane` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on (node detached-spawn behaviour, `claude --help` flags).
- The drafter re-decided these requirement literals. Rule on each: `refinement` (closed) or `widening` (a MUST_FIX). You may close a flag as a `refinement` and carry it to the next drafter on your own authority when the change stays within the governing requirement's intent; this needs no orchestrator ruling or adjudication — state the closure and its reason in your analysis. Rule `widening` (a MUST_FIX) only when the flag reverses a requirement or crosses a decision the human owns.
  - Req 1 AC 4 — a role mapped to deepseek pre-fills the map's model (D3).
  - Req 3 AC 13 — pointer removal ports the deregister helper plus a retry; an append-race window remains.
  - Req 3 AC 14 — an unmarked existing worktree gets setup re-run, not refused.
  - Req 2 AC 6 — a malformed file is also refused and deleted.
- Fresh lens for this round: wire contracts across a boundary — the websocket subscribe/message contract between the project harness watch, the hub and the frontend (subscribe/unsubscribe message types, `harness-model` / `harness-gates` / `harness-log` / snapshot payload shapes, per-view filtering, and client reset semantics). Confirm every producer field has a consumer and every consumer field a producer.
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at d24c492e8a65a2aef35860a975404cd608f41d37, 0 commits behind HEAD.

## Changes since 70c6486

````diff
diff --git a/.spec-workflow/specs/harness-control-pane/design.md b/.spec-workflow/specs/harness-control-pane/design.md
index 6e3fa29..c67c580 100644
--- a/.spec-workflow/specs/harness-control-pane/design.md
+++ b/.spec-workflow/specs/harness-control-pane/design.md
@@ -59,7 +59,7 @@ graph LR
 - **Interfaces:**
   - `readAgentRules(workflowRoot)` — `worktree` (`yes` on `worktree-per-change: required`), `gates` (a `gates:` line, else `block`), `worktreeSetup` (the first code span of the `worktree-setup:` line, .spec-workflow/agent-rules.md:6), `providers` (`## Providers` rows, grammar of harness/skills/sdd-continue/references/sdd-providers.sh:42).
   - `buildSetupView(project): Promise<SetupView>` — specs from C1, `parseHandoffRouting` (C5), one row per `AGENT_PROFILES` key (src/watch/ledger.ts:84) in sorted order, the supervisor row (`claude-opus-5-5`, `high`), and `launchable` = `routing.spec` when `routing.state` is `active`, else `null` with `disabledReason` = `routing.reason` (Req 1 AC 10).
-  - `validateSetup(input, view): ValidationError | null` — Req 1 AC 6 and AC 8: an anthropic role takes an alias in `MODEL_ALIASES = ['opus', 'sonnet', 'fable']` or a value starting `claude-`; a deepseek role takes a model of sdd-providers.sh:29; only the roles of sdd-providers.sh:23 may leave `anthropic`; `input.spec` must equal `launchable`; the supervisor follows the anthropic rule.
+  - `validateSetup(input, view): ValidationError | null` — Req 1 AC 6 and AC 8: an anthropic role takes an alias in `MODEL_ALIASES = ['opus', 'sonnet', 'fable']` or a value starting `claude-`; a deepseek role takes a model of harness/skills/sdd-continue/references/sdd-providers.sh:29; only the roles of harness/skills/sdd-continue/references/sdd-providers.sh:23 may leave `anthropic`; `input.spec` must equal `launchable`; the supervisor follows the anthropic rule.
   - `toRunFile(input, view, now): HarnessRunFile` — keeps a role only when its model or provider differs from its default (Req 1 AC 12); a kept role carries both.
   - `writeRunFile(workflowRoot, file)` (temp plus rename) and `deleteRunFileIf(workflowRoot, writtenAt)` (deletes only when `writtenAt` matches).
 - A role's default model is its declared model, except that a role the map routes to deepseek defaults to the map's model (D3).
@@ -93,7 +93,7 @@ graph LR
 - **Stop** (Req 3 AC 9): `state: 'stopping'`, `SIGTERM` to `-pgid`, poll every `pollMs`, `SIGKILL` to `-pgid` if alive after `stopGraceMs`, finalise once gone.
 - **Finalise** (Req 3 AC 10; idempotent; `restore()` runs it for a gone record):
   1. Run id: `record.runId`, else the newest `run.start` at or after `launchedAt`, else a pointer line for the spec dir whose run id time is at or after `launchedAt`.
-  2. If that run has a `run.start` and no `run.end`, append `{ ts, run, spec, type: 'run.end', status: 'stopped from the dashboard' }`, the row of formats.md:178.
+  2. If that run has a `run.start` and no `run.end`, append `{ ts, run, spec, type: 'run.end', status: 'stopped from the dashboard' }`, the row of harness/skills/sdd-continue/references/formats.md:178.
   3. `removePointerLine` for that run id (Req 3 AC 13).
   4. `deleteRunFileIf(workflowRoot, record.setupWrittenAt)` (D14).
   5. `state: 'stopped'`, `endedAt`; write the record; emit.
@@ -103,7 +103,7 @@ graph LR
 
 ### C5 — Project harness watch (`project-watch.ts`)
 - **Purpose:** Run model, gates and log for one project's harness subscribers (Req 4).
-- **Interfaces:** `class ProjectHarnessWatch { constructor(project, launcher, send, opts?: { debounceMs?: number }); start(); close(); snapshot(): HarnessMessage[] }`; `parseHandoffRouting(md)` (spec via src/watch/ledger.ts:219-223, then the `Live phase`, `state`, `last result` fields of formats.md:75-76); `parseGateSections(md)` (raw text under `## Gate A` and `## Gate B`).
+- **Interfaces:** `class ProjectHarnessWatch { constructor(project, launcher, send, opts?: { debounceMs?: number }); start(); close(); snapshot(): HarnessMessage[] }`; `parseHandoffRouting(md)` (spec via src/watch/ledger.ts:219-223, then the `Live phase`, `state`, `last result` fields of harness/skills/sdd-continue/references/formats.md:75-76); `parseGateSections(md)` (raw text under `## Gate A` and `## Gate B`).
 - **Behaviour:** The spec is `resolveSpec` (src/watch/index.ts:42-59) on `<projectPath>/.spec-workflow`, `null` when it throws. It watches the four files and options of src/watch/index.ts:101-104, plus `questions.md` and the launch log. A change schedules one rebuild after `debounceMs` (default 300, as src/dashboard/multi-server.ts:91). The rebuild reads as `renderOnce` does (src/watch/index.ts:61-71), calls `buildModel`, and sends `harness-model` and `harness-gates`; a HANDOFF naming another spec re-targets the watcher; new complete log lines, read from a byte offset, go out as one `harness-log`. `snapshot()` holds the model, gates and the last 200 log lines with `reset: true`.
 
 ### C6 — Overview watch (`overview-watch.ts`)
@@ -139,7 +139,7 @@ graph LR
   - another spec: `setup=mismatch file=<spec> active=<spec>`;
   - applied: `setup=applied`, `written=`, `gates=`, `worktree=`, `orchestrators=<agent>=<model>,…|none`, `workers=<agent>=<model>,…|none` (anthropic workers only), `providers=<merged>` and `overrides=<agent>:<model>:<provider>,…`.
   An orchestrator is a name ending `-orchestrator` (src/watch/ledger.ts:294). A malformed file or an AC 1.6 violation exits 2 with one `setup: <reason>` stderr line; the provider merge passes its exit code (2 or 3) through. Any non-zero exit deletes the file (Req 2 AC 6).
-- **`sdd-providers.sh AGENT_RULES_PATH [RUN_FILE]`** (sdd-providers.sh:25-77): the optional argument merges each file role over the parsed rows before the unchanged checks of lines 54-71, so a non-eligible role off `anthropic` is refused there. Only eligible roles and deepseek roles merge. With one argument the output is unchanged.
+- **`sdd-providers.sh AGENT_RULES_PATH [RUN_FILE]`** (harness/skills/sdd-continue/references/sdd-providers.sh:25-77): the optional argument merges each file role over the parsed rows before the unchanged checks of lines 54-71, so a non-eligible role off `anthropic` is refused there. Only eligible roles and deepseek roles merge. With one argument the output is unchanged.
 - **SKILL.md** (harness/skills/sdd-continue/SKILL.md):
   - After Step 2 and before the Run ledger paragraph (lines 100-129), run the script:
     - `mismatch`: print `warning: harness-run.json is for <file spec>, the active spec is <spec>; ignoring it` (Req 2 AC 2).
@@ -153,7 +153,7 @@ graph LR
   - Status line (lines 488-500): when applied, `rm -f` the file in the step that writes `run.end` and deregisters (Req 2 AC 10).
   - The terminal supervisor ignores `supervisorModel` (D9).
 - **formats.md:** `run.start` keys (line 194) gain `overrides` and `setup`; the launch prompt block gains `MODEL_OVERRIDES`.
-- **Phase skills:** the spawn rules of sdd-document-phase/SKILL.md:24-34, sdd-implementation-phase/SKILL.md:26-28, sdd-closeout-phase/SKILL.md:28-29 and sdd-retrospective/SKILL.md:17-18 gain "When `MODEL_OVERRIDES` names the worker, pass that value as the Agent tool's `model` parameter." A deepseek worker gets its model from `PROVIDERS` through the launcher (formats.md:236), never as a parameter (Req 2 AC 4).
+- **Phase skills:** the spawn rules of harness/skills/sdd-document-phase/SKILL.md:24-34, harness/skills/sdd-implementation-phase/SKILL.md:26-28, harness/skills/sdd-closeout-phase/SKILL.md:28-29 and harness/skills/sdd-retrospective/SKILL.md:17-18 gain "When `MODEL_OVERRIDES` names the worker, pass that value as the Agent tool's `model` parameter." A deepseek worker gets its model from `PROVIDERS` through the launcher (harness/skills/sdd-continue/references/formats.md:236), never as a parameter (Req 2 AC 4).
 
 ### C10 — Docs
 `docs/SDD-HARNESS.md` gains a "Dashboard control pane" section after docs/SDD-HARNESS.md:244-251: the pages, the setup file, what Launch forces, where logs and records live, and what Stop writes.
@@ -297,3 +297,4 @@ Tests assert only on node 20 documented fields (.spec-workflow/agent-rules.md:31
 ## Revision History
 
 - **v1** (2026-09-28) — Initial draft.
+  - **Lint pass.** 10 citation-path errors fixed (directory prefixes added to the skill, reference and providers-script citations); 63 citation-identifier warnings rejected — design-introduced identifiers, string-literal values and probe-verified node fields, each sharing a line with a context citation that was verified correct.
````
