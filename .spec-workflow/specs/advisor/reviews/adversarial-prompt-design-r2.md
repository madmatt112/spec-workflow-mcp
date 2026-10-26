# Adversarial Review — advisor/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-design.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): advisor design v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/advisor/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 92db0f5a

````diff
diff --git a/.spec-workflow/specs/advisor/design.md b/.spec-workflow/specs/advisor/design.md
index cc35ecd3..a8f7251d 100644
--- a/.spec-workflow/specs/advisor/design.md
+++ b/.spec-workflow/specs/advisor/design.md
@@ -2,7 +2,7 @@
 
 ## Overview
 
-This design builds the advisor: a conversation entry (`spec-workflow-mcp advisor`, shell or Remote Control), a one-shot second opinion on a wait, and a code-built state of the world (summary, tallies, search) served through an MCP endpoint on the dashboard server. Every shared-state change the advisor asks for is a staged action that runs only on a confirm in the dashboard, and the controller sends one phone push per new wait. It reuses the controller's waits, step runner, merge rule, store lock, launch admission and access hook, and puts new code in `src/advisor/`.
+This design builds the advisor: a conversation entry (`spec-workflow-mcp advisor`, shell or Remote Control), a one-shot second opinion on a wait, and a code-built state of the world (summary, tallies, search) served through an MCP endpoint on the dashboard server. Every shared-state change the advisor asks for is a staged action that runs only on a confirm in the dashboard; the controller sends one phone push per new wait. It reuses the controller's waits, step runner, merge rule, store lock, launch admission and access hook, with new code in `src/advisor/`.
 
 ## Steering Document Alignment
 
@@ -50,28 +50,28 @@ graph LR
 
 ### C4 — Summary (`src/advisor/summary.ts`)
 - **Interfaces:** `buildSummary(opts: { include?: string[]; now?: Date }): Promise<AdvisorSummary>`; `renderSummary(s): string`.
-- **Post-conditions:** Built from current files on each call, no cache. Sections: open waits (kind, project, spec, age; `listOpenWaits`, `src/controller/waits.ts:128-132`); stuck runs (`error`, or `running` with the newest file under `runStepsDir(id)`, `src/controller/state.ts:254-256`, older than 15 minutes or absent); open PRs (latest `PrRead` per PR, verdict not `merged`, run not `abandoned`); `owner: matthew` deferrals (`src/core/deferral-storage.ts:150-152`); live runs (phase, `cursor.stepKind`); `fiveHour` and `sevenDay` windows; this ISO week's tallies (C5); sources by name and line (Requirement 8 AC 3); `push: off` without `push.json`. A project in `sources.json` `personalProjects` appears only when named in `include`. Lists cap at 5 rows plus an `N more` line; rendered text at most 400 words. A project whose reads throw is dropped from every section and named once in `skipped` (`src/dashboard/shell/now-model.ts:1-8`).
+- **Post-conditions:** Built from current files on each call, no cache. Sections (shape in Data Models): open waits (`listOpenWaits`, `src/controller/waits.ts:128-132`); stuck runs (`error`, or `running` with the newest file under `runStepsDir(id)`, `src/controller/state.ts:254-256`, older than 15 minutes or absent); open PRs (latest `PrRead` per PR, verdict not `merged`, run not `abandoned`); `owner: matthew` deferrals (`src/core/deferral-storage.ts:150-152`); live runs; `fiveHour` and `sevenDay` windows; this ISO week's tallies (C5); sources by name and line (Requirement 8 AC 3); `push: off` without `push.json`. A project in `sources.json` `personalProjects` appears only when named in `include`. Lists cap at 5 rows plus an `N more` line; rendered text at most 400 words. A project whose reads throw is dropped from every section and named once in `skipped` (`src/dashboard/shell/now-model.ts:1-8`).
 
 ### C5 — Tallies (`src/advisor/tallies.ts`)
 - **Interfaces:** `buildTallies(q: { from: string; to: string; project?: string }): Promise<Tallies>`.
 - **Post-conditions:** Reads every known project's `specs/*/harness-events.jsonl` and `specs/*/retrospective.md` and the home `events.jsonl`, bucketed by ISO week (`2026-W43`). Tokens: each `spawn.end` row (`src/controller/ledger.ts:130-143`) adds `tokens` to its `agent` and `spec`; each `advisor.opinion` row adds to role `sdd-advisor` (Requirement 3 AC 4). Failures: a `spawn.usage` row (`src/controller/ledger.ts:145-153`) whose `result` is a non-`ok` `StepClassification` (`src/controller/step.ts:71-77`) counts under it; any other value but `ok` or `success` counts as `unknown`. Findings: each `- **F` line counts under the level-2 heading above it, dated by the file's last commit. A row missing a needed field counts as `unknown`, and that column carries `floor: true` (Requirement 3 AC 3).
 
 ### C6 — Search (`src/advisor/search/`)
-- **Interfaces:** `corpus.ts` `listCorpus(projects)` (each project's `.spec-workflow/**/*.md`, `docs/**/*.md`, `GLOSSARY.md`, and the home `waits/*.json`; never transcripts or `advisor/notes/`) and `chunk(file)` (split at level 1-3 headings, at most 60 lines; a wait is one chunk); `text.ts` `textSearch(chunks, query)`; `embed.ts` `interface Embedder { model: string; embed(texts: string[]): Promise<number[][]> }` and `loadEmbedder(): Promise<Embedder | null>`; `index.ts` `refreshIndex(embedder)`; `search.ts` `search(q)`.
-- **Post-conditions:** A hit has `project`, `path`, `startLine`, `endLine`, `kind` (from the path) and `date` (a wait's `created`, else the last commit date, else mtime). Filters apply before ranking. Text score: distinct query words of three letters or more (stop words removed) present in the chunk, plus one for the whole phrase. Meaning score: cosine similarity. Lists merge by reciprocal rank fusion (k = 60), de-duplicated on `project|path|startLine`; limit 10 by default, 30 at most. Searches run one at a time. Each search hashes every corpus file (SHA-256), re-embeds only changed files and drops gone ones (Requirement 4 AC 6). Over 200 chunks to embed: text hits now, `meaning: "indexing n of m"`, embedding continues in process. No embedder: `meaning: "off"`, text hits only (Requirement 4 AC 7).
+- **Interfaces:** `corpus.ts` `listCorpus(projects)` (each project's `.spec-workflow/**/*.md`, `docs/**/*.md`, `GLOSSARY.md`, and the home `waits/*.json`; never transcripts or `advisor/notes/`) and `chunk(file)` (split at level 1-3 headings, at most 60 lines; a wait is one chunk); `text.ts` `textSearch(chunks, query)`; `embed.ts` `interface Embedder { model: string; embed(texts: string[]): Promise<number[][]> }` and `loadEmbedder(): Promise<Embedder | null>`; `index.ts` `refreshIndex(embedder)`; `search.ts` `search(q): Promise<SearchResult>` (Data Models).
+- **Post-conditions:** A hit's shape is in Data Models; `kind` comes from the path and `date` is a wait's `created`, else the last commit date, else mtime. Filters apply before ranking. Text score: distinct query words of three letters or more (stop words removed) present in the chunk, plus one for the whole phrase. Meaning score: cosine similarity. Lists merge by reciprocal rank fusion (k = 60), de-duplicated on `project|path|startLine`; limit 10 by default, 30 at most. Searches run one at a time. Each search hashes every corpus file (SHA-256), re-embeds only changed files and drops gone ones (Requirement 4 AC 6). Over 200 chunks to embed: text hits now, `meaning: "indexing n of m"`, embedding continues in process. No embedder: `meaning: "off"`, text hits only (Requirement 4 AC 7).
 - **Embedder:** a local Ollama server named in `search.json` (`{ v: 1, url, model }`). `loadEmbedder` returns null when the file is absent, the url is not loopback, or a one-text call fails; loopback only, so no text leaves the machine (Requirement 4 AC 5). The request shape is not pinned: no embedding server is installed here, so the task that writes `embed.ts` probes one and pins the shape in its test fake.
 - **Index files:** `advisor/index/projectId.json` (`{ v: 1, model, files: { relPath: { hash, chunks: [{ startLine, endLine, kind, date, vector }] } } }`, vectors base64 Float32); a model change drops the file.
 
 ### C7 — Second opinion (`src/advisor/opinion.ts`)
 - **Interfaces:** `POST /api/controller/waits/:id/second-opinion` (operator credential) → 202; `startSecondOpinion(waitId, deps: { usageBlock(): { blocked: boolean; resumeAt?: string } })`. `Controller` gains a public `usageBlock()` returning its `windowBlock()` (`src/controller/controller.ts:373-388`), so the threshold is the controller's (`src/controller/controller.ts:85-86`).
-- **Post-conditions:** 404 unknown wait; 409 `not-open`; 409 `running` when one is in flight for the wait; 409 `usage-window` with the reason when blocked (Requirement 5 AC 5). Otherwise: sets `opinionStatus` running, writes `advisor/opinions/waitId/stamp/brief.md` (questions, options, recommendation, rendered summary, word limits), and calls `runStep` (`src/controller/step.ts:350`) with role `sdd-advisor`, cwd the home `advisor/`, `maxTurns: 6`, `schema: OPINION_SCHEMA`, `mcpConfig: { mcpServers: {} }` (strict, so no MCP server; `src/controller/step.ts:372-374`), `noSessionPersistence: true`. It is not in `Controller.active` and not queued, so it takes no run slot. Valid result: schema match, each pick names a wait question and, where options exist, one of them; reasons at most 60 words, summary at most 100. Valid → `attachAdvice(id, opinion.summary, opinion)`, status cleared. Otherwise → `opinionStatus` failed with the classification or `invalid result`, advice and opinion untouched (Requirement 5 AC 7). Either way one `advisor.opinion` row with the five `StepUsage` fields. It never answers the wait, writes a run or touches the queue (Requirement 5 AC 3); `opinion.ts` is the only `runStep` caller with role `sdd-advisor` (Requirement 5 AC 4).
+- **Post-conditions:** 404 unknown wait; 409 `not-open`; 409 `running` when one is in flight for the wait; 409 `usage-window` with the reason when blocked (Requirement 5 AC 5). Otherwise: sets `opinionStatus` running, writes `advisor/opinions/waitId/stamp/brief.md` (questions, options, recommendation, rendered summary, word limits), and calls `runStep` (`src/controller/step.ts:350`) with role `sdd-advisor`, cwd the home `advisor/`, `maxTurns: 6`, `schema: OPINION_SCHEMA`, `mcpConfig: { mcpServers: {} }` (strict, so no MCP server; `src/controller/step.ts:372-374`), `noSessionPersistence: true`. It is not in `Controller.active` and not queued, so it takes no run slot. Valid result: schema match, each pick names a wait question and, where options exist, one of them; reasons at most 60 words, summary at most 100. Valid → `attachAdvice(id, opinion.summary, opinion)`, status cleared. Otherwise → `opinionStatus` failed with the classification or `invalid result`, advice and opinion untouched (Requirement 5 AC 7). Either way one `advisor.opinion` row with the five `StepUsage` fields. The call passes no `onRateLimit`, so the opinion's own spend reaches `rate-limit.json` only at the next scheduled step that wires it (`src/controller/controller.ts:413`); the lag is accepted. It never answers the wait, writes a run or touches the queue (Requirement 5 AC 3); `opinion.ts` is the only `runStep` caller with role `sdd-advisor` (Requirement 5 AC 4).
 - **Wait writes:** `answerWait`, `attachAdvice` and the status write go through one in-process queue per wait id in `src/controller/waits.ts`, so an advice write never overwrites an answer read before it.
 
 ### C8 — Staged actions (`src/advisor/actions.ts`)
 - **Interfaces:** `stageAction(input)`, `listActions(state?)`, `confirmAction(id, deps)`, `dismissAction(id)`, `actionEvents` (`change`). Routes, operator credential only: `GET /api/controller/actions`, `POST /api/controller/actions/:id/confirm`, `POST /api/controller/actions/:id/dismiss`; 409 on an action not `staged`.
 - **Executor per kind:**
-  - `merge`: a run on that project with this `pr` and an open `merge` wait → `answerWait` with `merge` by `advisor`; the run's merge pass applies the rule (`src/controller/merge.ts:729-753`); outcome `answered-wait`. Else `mergeByRule` (`src/controller/merge.ts:695-778`) with `pr: { number, repoDir: workspacePath, branch }`, the project's rules (`src/controller/merge.ts:160-163`) with `merge: 'auto'`, `runId` the action id, and `MergeStageDeps` (`src/controller/merge.ts:136-150`) rooted at `advisor/actions/id/`. Any status but `merged` is `refused` with the rule's reasons (Requirement 6 AC 6).
-  - `deploy`: spawn `scripts/sdd-self-update.sh` (`scripts/sdd-self-update.sh:1-24`) from the package root, detached, logged to `advisor/actions/id/deploy.log`; outcome `started`; the script reports its own failures.
+  - `merge`: a run on that project with this `pr` and an open `merge` wait → `answerWait` with `merge` by `advisor`; the run's merge pass applies the rule (`src/controller/merge.ts:729-753`); outcome `answered-wait`. Else `mergeByRule` (`src/controller/merge.ts:695-778`) with a full `MergeTarget` (`src/controller/merge.ts:542-551`) — `pr: { number, repoDir: workspacePath, branch }`, `runId` the action id, `projectId`, `spec`, `questionId: 'merge'`, `label` from the action — the project's rules (`src/controller/merge.ts:160-163`) with `merge: 'auto'`, and `MergeStageDeps` (`src/controller/merge.ts:136-150`) whose `ledger` is a synthetic `openRunLedger` (`src/controller/ledger.ts:95`) rooted at `advisor/actions/id/`, so the `pr.merged` row lands there, outside any `specs/*/harness-events.jsonl` (so a no-run merge is invisible to tallies). Any status but `merged` is `refused` with the rule's reasons (Requirement 6 AC 6).
+  - `deploy`: spawn `scripts/sdd-self-update.sh` (`scripts/sdd-self-update.sh:1-24`) from the checkout root, detached, logged to `advisor/actions/id/deploy.log`; outcome `started`; the script reports its own failures.
   - `launch`: the launch route body (`src/dashboard/multi-server.ts:604-635`) moves into `launchSpec(projectId, input)`, called by route and executor, so the launch checks and `enqueue` (`src/controller/controller.ts:145-179`) apply (Requirement 6 AC 9).
   - `answer`: the route's unknown-question check (`src/dashboard/multi-server.ts:649-657`) moves into `checkAnswerKeys(wait, answers)`, then `answerWait(id, answers, 'advisor')` (`src/controller/waits.ts:90-116`; Requirement 6 AC 8).
   - `deferral`: `DeferralStorage.create` (`src/core/deferral-storage.ts:229-270`) and `checkpoint` (`src/controller/ledger.ts:233-245`) of that one file, inside one `withStoreLock` (`src/controller/state.ts:535-546`; Requirement 6 AC 10).
@@ -84,7 +84,7 @@ graph LR
 
 ### C10 — Conversation entry (`src/advisor/cli.ts`)
 - **Interfaces:** `advisorCommand(args)` routed in `main` before argument parsing, beside `bootstrapCommand` (`src/index.ts:129-131`, `:394-398`); `runAdvisorCommand(args)` with `--remote-control`; `spec-workflow-mcp advisor commit --store path -m message -- paths` runs `checkpoint` inside `withStoreLock`, the way the advisor commits decisions (Requirement 9 AC 2). Route `POST /api/controller/advisor/open` (operator credential) → `{ state: 'live', name }` or `{ state: 'command', command }`.
-- **`runAdvisorCommand`:** finds the dashboard url with `peekDashboardSession` (`src/core/dashboard-session.ts:153-177`), else exits 1; creates `advisor/` and `advisor/notes/`; seeds sources; makes a conversation UUID; writes mode 0600 `advisor/mcp.json` (one `type: 'http'` server at the dashboard url plus `ADVISOR_MCP_PATH`, `headers` with the advisor bearer and `x-sdd-conversation`; the `headers` key is probed) and `advisor/settings.json` (deny rules on the operator secret file for Read and Bash); writes the role body to `advisor/system.md`; spawns `claude` in `advisor/`, stdio inherited, with `--append-system-prompt-file`, `--model` and `--effort` from `loadRole('sdd-advisor')`, `--mcp-config`, `--strict-mcp-config`, `--settings`, `--session-id`, `-n advisor`, `--remote-control advisor` when asked, and the prompt `Give me the hello summary.` (flags from `claude --help`, 2.1.311). It writes `advisor/session.json` after the spawn and deletes it when the child exits.
+- **`runAdvisorCommand`:** finds the dashboard url with `peekDashboardSession` (`src/core/dashboard-session.ts:153-177`), else exits 1; creates `advisor/` and `advisor/notes/`; seeds sources; makes a conversation UUID; writes mode 0600 `advisor/mcp.json` (one `type: 'http'` server at the dashboard url plus `ADVISOR_MCP_PATH`, `headers` with the advisor bearer and `x-sdd-conversation`; the `headers` key form is a task-phase probe) and `advisor/settings.json` (deny rules on the operator secret file for Read and Bash); writes the role body to `advisor/system.md`; spawns `claude` in `advisor/`, stdio inherited, with `--append-system-prompt-file`, `--model` and `--effort` from `loadRole('sdd-advisor')`, `--mcp-config`, `--strict-mcp-config`, `--settings`, `--session-id`, `-n advisor`, `--remote-control advisor` when asked, and the prompt `Give me the hello summary.` (flags from `claude --help`, 2.1.311). It writes `advisor/session.json` after the spawn and deletes it when the child exits.
 - **Open route:** a live `session.json` process (`isProcessAlive`, `src/controller/state.ts:479-482`) is returned as is (Requirement 1 AC 4). Else it spawns `spec-workflow-mcp advisor --remote-control` detached, stdio ignored, checks liveness once after 10 seconds, and returns `live` or, if it exited, `command` (requirements D7). Nothing stays armed after the response (Requirement 1 AC 5).
 
 ### C11 — Wait pusher (`src/advisor/push.ts`)
@@ -127,6 +127,34 @@ type HomeEvent =
   | { v: 1; ts: string; type: 'advisor.opinion'; wait: string; outcome: string; input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
   | { v: 1; ts: string; type: 'advisor.action'; action: string; kind: ActionKind; target: object; conversation: string; outcome: string; detail?: string }
   | { v: 1; ts: string; type: 'push.failure'; wait: string; detail: string };
+
+// Read-tool responses (the code-built state of the world).
+interface AdvisorSummary {
+  openWaits: { kind: string; project: string; spec: string; ageMins: number }[];
+  stuckRuns: { id: string; project: string; reason: 'error' | 'running' }[];
+  openPrs: { project: string; pr: number; verdict: string }[];
+  deferrals: { project: string; title: string }[];
+  liveRuns: { id: string; project: string; phase: string; stepKind?: string }[];
+  windows: { fiveHour?: RateLimitFile['fiveHour']; sevenDay?: RateLimitFile['sevenDay'] };
+  week: Tallies;
+  sources: { name: string; location: string }[];
+  push: 'on' | 'off';
+  skipped: string[];                   // reads that threw
+}
+interface Tallies {
+  weeks: Record<string, {              // key `2026-W43`
+    tokens: { byAgent: Record<string, number>; bySpec: Record<string, number> };
+    failures: Record<string, number>;  // StepClassification or `unknown`
+    findings: Record<string, number>;  // level-2 heading → count
+    floor: Partial<Record<'tokens' | 'failures' | 'findings', true>>;
+  }>;
+}
+interface Hit {
+  project: string; path: string; startLine: number; endLine: number;
+  kind: string; date: string;
+  textScore: number; meaningScore?: number; score: number;
+}
+interface SearchResult { hits: Hit[]; meaning: 'on' | 'off' | string }  // `indexing n of m` while embedding
 ```
 
 ## Error Handling
@@ -149,36 +177,43 @@ type HomeEvent =
 
 ## Decisions taken in this document
 
-- D1 — The embedder is a local Ollama server named in a home config file: options were a bundled runtime as an npm dependency, a local Ollama server, or text only; chosen because it adds no native dependency and an absent server simply means meaning search is off.
-- D2 — The push trigger is a file watch on the home waits directory plus a start-up scan: options were the in-process wait emitter, a file watch, or an interval poll; chosen because the watchdog writes waits from another process and polling is ruled out.
-- D3 — The first start records every open wait without a push: options were pushing them once or recording them; chosen because a deploy must not send a burst for old waits.
-- D4 — The advisor credential opens exactly one path, the MCP endpoint: options were all reads or one path; chosen because the endpoint already carries every read.
-- D5 — The conversation id is a UUID the subcommand makes, used as the session id and sent as a header: options were a tool argument or a header; chosen because the model cannot misstate a header.
-- D6 — A confirmed merge of a PR with no run uses the merge rule with the merge key set to auto: options were a direct evaluate-then-merge, refusing such PRs, or the rule; chosen because one merge path keeps the checks identical.
-- D7 — A confirmed merge of a run's PR under ask answers that run's merge wait: options were merging directly or answering; chosen because the run then records the merge in its own ledger.
-- D8 — A confirmed deploy runs the self-update script detached: options were waiting or detaching; chosen because the script restarts the server that would wait.
-- D9 — The one-shot gets the wait and summary inline, no MCP server and only the Read tool: options were the advisor endpoint or inlining; chosen because a one-shot that cannot stage cannot be steered into staging.
-- D10 — The typed opinion rides a trailing optional argument of the advice attach, and the advice text becomes its summary: options were a new function or a trailing argument; chosen because existing callers stay valid.
-- D11 — The wait record carries an opinion status: options were a status file or a wait field; chosen because the wait list already reaches the browser.
-- D12 — The search index refreshes on search start and keeps embedding in process past 200 chunks: options were blocking or continuing; chosen because a first index would break the three-second bound.
-- D13 — Text search scans chunks in node and lists merge by rank fusion: options were ripgrep or a node scan, score sum or rank fusion; chosen because ripgrep is not a sure install and fusion needs no score scaling.
-- D14 — A ledger result that is not a step classification counts as unknown: options were mapping CLI subtypes or unknown; chosen because the document phase writes the CLI subtype there.
-- D15 — Personal marks live in the sources file: options were a new file or the sources file; chosen because the operator already edits it.
-- D16 — Open advisor checks the spawned process once after ten seconds: options were a pseudo-terminal wrapper or one check; chosen because the requirement allows showing the command instead.
-- D17 — A stuck run is one whose newest step log is older than fifteen minutes: options were the run record's update time or the log time; chosen because the record does not change while a step streams.
+- D1 — The embedder is a local Ollama server named in a home config file: chosen because it adds no native dependency and an absent server simply means meaning search is off.
+- D2 — The push trigger is a file watch on the home waits directory plus a start-up scan: chosen because the watchdog writes waits from another process and polling is ruled out.
+- D3 — The first start records every open wait without a push: chosen because a deploy must not send a burst for old waits.
+- D4 — The advisor credential opens exactly one path, the MCP endpoint: chosen because the endpoint already carries every read.
+- D5 — The conversation id is a UUID the subcommand makes, used as the session id and sent as a header: chosen because the model cannot misstate a header.
+- D6 — A confirmed merge of a PR with no run uses the merge rule with the merge key set to auto: chosen because one merge path keeps the checks identical.
+- D7 — A confirmed merge of a run's PR under ask answers that run's merge wait: chosen because the run then records the merge in its own ledger.
+- D8 — A confirmed deploy runs the self-update script detached: chosen because the script restarts the server that would wait.
+- D9 — The one-shot gets the wait and summary inline, no MCP server and only the Read tool: chosen because a one-shot that cannot stage cannot be steered into staging.
+- D10 — The typed opinion rides a trailing optional argument of the advice attach, and the advice text becomes its summary: chosen because existing callers stay valid.
+- D11 — The wait record carries an opinion status: chosen because the wait list already reaches the browser.
+- D12 — The search index refreshes on search start and keeps embedding in process past 200 chunks: chosen because a first index would break the three-second bound.
+- D13 — Text search scans chunks in node and lists merge by rank fusion: chosen because ripgrep is not a sure install and fusion needs no score scaling.
+- D14 — A ledger result that is not a step classification counts as unknown: chosen because the document phase writes the CLI subtype there.
+- D15 — Personal marks live in the sources file: chosen because the operator already edits it.
+- D16 — Open advisor checks the spawned process once after ten seconds: chosen because the requirement allows showing the command instead.
+- D17 — A stuck run is one whose newest step log is older than fifteen minutes: chosen because the record does not change while a step streams.
 - D18 — The owner-backlog write is a plain append with no commit: chosen because that file is not in a repository.
-- D19 — Wait writes are queued per wait id in process: options were no guard or a per-wait queue; chosen because an advice write that lands after an answer read would erase the answer.
-- D20 — The advisor commits decisions through an advisor commit subcommand that holds the store lock: options were a stage tool or a subcommand; chosen because decision commits are ordinary work, yet the lock lives in controller code.
+- D19 — Wait writes are queued per wait id in process: chosen because an advice write that lands after an answer read would erase the answer.
+- D20 — The advisor commits decisions through an advisor commit subcommand that holds the store lock: chosen because decision commits are ordinary work, yet the lock lives in controller code.
 
 ## Scope notes
 
 - Carried items from requirements: none.
 - Deferred: a standing "watch X" one-shot (as in requirements).
 - Not changed: the document phase keeps writing the CLI subtype into `spawn.usage` (`src/controller/phases/document.ts:375`); D14 counts it as unknown.
-- Left to the tasks phase as probes: the Ollama request shape (no embedding server is installed here) and the Bash-tool deny-rule form.
+- Left to the tasks phase as probes: the Ollama request shape (no embedding server is installed here), the Bash-tool deny-rule form, and the mcp.json `headers` key form.
 - Outside the repository: archiving `owctl` and deleting the retired home files stay operator steps (Requirement 11 AC 2).
 
 ## Revision History
 
+- **v2** (2026-10-26) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 1/1/3).
+  - **R1-1 — Accepted (MUST_FIX).** C7 cites the controller threshold and windowBlock (the lint pass corrected the exact lines).
+  - **R1-2 — Accepted.** Data Models pins AdvisorSummary, Tallies, Hit/SearchResult and the per-week floor map (Requirement 3 AC 3); C6 returns SearchResult.
+  - **R1-3 — Accepted.** C8's no-run merge names the full MergeTarget and synthetic openRunLedger; its pr.merged row lands outside the spec ledgers.
+  - **R1-4 — Accepted.** C10 and the scope-note probe list mark the mcp.json headers key a task-phase probe.
+  - **R1-5 — Accepted.** C7 notes the opinion runStep passes no onRateLimit; its spend reaches rate-limit.json at the next scheduled step (lag accepted).
+  - **Lint pass.** 2 fixed: L-36 windowBlock 375-390→373-388 and L-42 onRateLimit 415→413 — symbols the cited range missed; also fixed the sibling threshold cite 87-88→85-86. Rejected L-1–L-35, L-37–L-41, L-43–L-66 as citation-identifier false positives (token is never the line's cited symbol; verified against the tree).
 - **v1** (2026-10-26) — Initial draft.
-  - **Lint pass.** 0 fixed; rejected: all 65 are citation-identifier false positives — the flagged token is not the cited symbol, and every adjacent citation correctly supports its phrase (verified against the tree and the codebase-context map). File extension in a filename: L-1, L-30. New symbol this spec defines, so absent from the existing range it extends: L-2, L-5, L-6, L-7, L-8, L-36, L-38, L-48, L-49, L-51, L-54, L-55. External fs/SDK/fastify/probed API, not repo code: L-3, L-10, L-11, L-56. JSON field/object key being defined: L-4, L-24, L-27, L-28, L-31, L-63. MCP/agent tool name, not a code symbol: L-13, L-14, L-15, L-16, L-17, L-18, L-65. String/state-value literal: L-12, L-19, L-20, L-22, L-23, L-29, L-32, L-33, L-34, L-37, L-39, L-40, L-43, L-44, L-45, L-46, L-47, L-57, L-59, L-60, L-61, L-62, L-64. RateLimitFile field whose authoritative citation is on line 47: L-25, L-26. Real symbol cited on another line: L-21, L-42, L-52, L-53, L-58. Class/type/entry declared outside the cited method range: L-9, L-35, L-41, L-50.
+  - **Lint pass.** 0 fixed; all 65 rejected as citation-identifier false positives — the flagged token is not the cited symbol (verified against the tree).

````
