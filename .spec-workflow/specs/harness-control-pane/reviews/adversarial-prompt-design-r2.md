# Adversarial Review — harness-control-pane/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-design.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v2 before the lint pass. A rule with no finding listed here passed. Re-verify only citations the v2 lint commit changed: the v2 lint commit changed no citations (it added only the Lint-pass Revision-History bullet), so the `## Lint commit` section below is meta only. Still open (error = MUST_FIX candidate, warning = your call, info = a note): 73 citation-identifier warnings (warning, citation-identifier) — every one names a design-introduced identifier, a string-literal value, or a probe-verified node field flagged absent from a correct context citation on the same line; the orchestrator verified the cited ranges are correct and rejected all 73 as the known false-positive class. Verify meaning only; do not re-litigate these as citation errors.
- Changes: the diff from the newest `docs(sdd): harness-control-pane design v1` commit to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-2 MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch; the label is guidance and does not change the round budget.
- Fix-induced re-check: when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- The v2 body is 3999 words against a 4,000-word cap: the document sits at the ceiling, so any fix that adds words must remove others. Prefer findings whose fix does not require growth; a SHOULD_FIX that would need net-new words should name what to cut.
- Fresh lens for this round: failure, rollback and partial-failure paths — round 1 used wire contracts, so attack the concurrency and failure behaviour instead (Req 2.6, Req 3.10–3.14): the single-live-run pointer lock under a launch race, a launcher crash between spawn and record-write, a `run.start` with no `run.end`, stale pointer lines, worktree setup failure mid-run, and the log-watch re-point/offset/reset path the v2 delta added (finding R1-1). Trace each failure to a stated recovery or an explicit out-of-scope note.
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX. The v2 delta added `SetupView` fields and the log-watch reset payload (`launchedAt`); confirm both are fully pinned.
- Closed by ruling, do not re-open: the four round-1 RE-DECIDED flags, all ruled refinement — Req 1 AC 4 (a deepseek-mapped role pre-fills the model), Req 3 AC 13 (pointer removal ports the deregister helper plus a retry, append-race window remains), Req 3 AC 14 (an unmarked existing worktree gets setup re-run, not refused), Req 2 AC 6 (a malformed file is refused and deleted).
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. (Round 1 rejected none; all six findings were accepted or partially accepted.)
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at d24c492e8a65a2aef35860a975404cd608f41d37, 0 commits behind HEAD.

## Changes since 63c3427

````diff
diff --git a/.spec-workflow/specs/harness-control-pane/design.md b/.spec-workflow/specs/harness-control-pane/design.md
index c67c580..e736238 100644
--- a/.spec-workflow/specs/harness-control-pane/design.md
+++ b/.spec-workflow/specs/harness-control-pane/design.md
@@ -1,21 +1,21 @@
 # Design Document — harness-control-pane
 
-Document version: v1
+Document version: v2
 
 ## Overview
 
-The dashboard gains a Harness page (set up, launch, stop and watch one run of one project) and an Overview page (all projects plus the operator to-do list), served by new modules under `src/dashboard/harness/`. The supervisor applies `.spec-workflow/harness-run.json` through a new reference script, and the phase skills pass worker model overrides. The live view reuses `buildModel` (src/watch/ledger.ts:243-457) and the TUI watch options (src/watch/index.ts:101-104) unchanged; the spec list reuses the INDEX logic through a read-only `IndexGenerator.snapshot()`.
+The dashboard gains a Harness page (set up, launch, stop and watch one run of one project) and an Overview page (all projects plus the operator to-do list). The supervisor applies `.spec-workflow/harness-run.json` through a new reference script, and the phase skills pass worker model overrides. The live view reuses `buildModel` (src/watch/ledger.ts:243-457) and the TUI watch options (src/watch/index.ts:101-104) unchanged; the spec list reuses the INDEX logic through a read-only `IndexGenerator.snapshot()`.
 
 ## Steering Document Alignment
 
 ### Technical Standards (tech.md)
-N/A (no steering documents); the design follows `.spec-workflow/agent-rules.md`.
+N/A; the design follows `.spec-workflow/agent-rules.md`.
 
 ### Project Structure (structure.md)
 N/A. Server code goes in `src/dashboard/harness/`, pages in `src/dashboard_frontend/src/modules/pages/`, harness changes in `harness/skills/`.
 
 ### Design System (design-system.md) — if applicable
-N/A: no design-system.md; the pages reuse the CSS variables and Tailwind classes of src/dashboard_frontend/src/modules/app/App.tsx:226-237.
+N/A: the pages reuse the CSS variables and Tailwind classes of src/dashboard_frontend/src/modules/app/App.tsx:226-237.
 
 ## Architecture
 
@@ -58,7 +58,7 @@ graph LR
 - **Purpose:** The form, its validation and `harness-run.json` (Req 1).
 - **Interfaces:**
   - `readAgentRules(workflowRoot)` — `worktree` (`yes` on `worktree-per-change: required`), `gates` (a `gates:` line, else `block`), `worktreeSetup` (the first code span of the `worktree-setup:` line, .spec-workflow/agent-rules.md:6), `providers` (`## Providers` rows, grammar of harness/skills/sdd-continue/references/sdd-providers.sh:42).
-  - `buildSetupView(project): Promise<SetupView>` — specs from C1, `parseHandoffRouting` (C5), one row per `AGENT_PROFILES` key (src/watch/ledger.ts:84) in sorted order, the supervisor row (`claude-opus-5-5`, `high`), and `launchable` = `routing.spec` when `routing.state` is `active`, else `null` with `disabledReason` = `routing.reason` (Req 1 AC 10).
+  - `buildSetupView(project): Promise<SetupView>` — specs from C1, `parseHandoffRouting` (C5), one row per `AGENT_PROFILES` key (src/watch/ledger.ts:84) in sorted order, the supervisor row (`claude-opus-5-5`, `high`), and `launchable` = `routing.spec` when `routing.state` is `active`, else `null` with `disabledReason` = `routing.reason` (Req 1 AC 10). It also fills `handoff`, `worktree`, `gates`, `modelAliases`, `deepseekModels`, `eligibleRoles` and `saved` from `readAgentRules` and the module constants.
   - `validateSetup(input, view): ValidationError | null` — Req 1 AC 6 and AC 8: an anthropic role takes an alias in `MODEL_ALIASES = ['opus', 'sonnet', 'fable']` or a value starting `claude-`; a deepseek role takes a model of harness/skills/sdd-continue/references/sdd-providers.sh:29; only the roles of harness/skills/sdd-continue/references/sdd-providers.sh:23 may leave `anthropic`; `input.spec` must equal `launchable`; the supervisor follows the anthropic rule.
   - `toRunFile(input, view, now): HarnessRunFile` — keeps a role only when its model or provider differs from its default (Req 1 AC 12); a kept role carries both.
   - `writeRunFile(workflowRoot, file)` (temp plus rename) and `deleteRunFileIf(workflowRoot, writtenAt)` (deletes only when `writtenAt` matches).
@@ -88,7 +88,7 @@ graph LR
   3. When `<git dir>/sdd-setup-done` is absent (`git rev-parse --absolute-git-dir` in the worktree), run `worktreeSetup` with `bash -c` (the agent-rules command, never form text) and `setupTimeoutMs`; write the marker on success. An unmarked worktree is never used before its setup completes (Req 3 AC 14).
   4. Open the log with `fs.openSync(path, 'a')` and spawn `cli` with `['-p', 'continue the sdd process', '--model', file.supervisorModel, '--effort', 'high', '--permission-mode', 'auto']` (docs/SDD-HARNESS.md:247), `cwd` the checkout or worktree, `detached: true`, `stdio: ['ignore', fd, fd]`, env `{ ...scrubbedGitEnv(), SPEC_WORKFLOW_WORKSPACE: cwd, SPEC_WORKFLOW_SHARED_ROOT: project.projectPath }` (src/core/git-utils.ts:5-6, 45-51). On the `spawn` event, `unref()` and write the record with `pgid` = `pid`.
   5. Any failure throws `LaunchError`, calls `deleteRunFileIf`, removes the empty log and writes no record.
-- **Carried R3-minor-1:** only the argument and env pattern of `runAgent` (src/dashboard/adversarial-runner.ts:156-180) is reused. Neither `JOB_TIMEOUT_MS` (15 minutes at src/dashboard/adversarial-runner.ts:46; its error text at :187 says 10) nor any other run timeout is adopted, and nothing like `shutdown()` (src/dashboard/adversarial-runner.ts:250-254, called at src/dashboard/multi-server.ts:2271) kills a launched run.
+- **Carried R3-minor-1:** only `runAgent`'s argument and env pattern (src/dashboard/adversarial-runner.ts:156-180) is reused. No run timeout (unlike `JOB_TIMEOUT_MS`, src/dashboard/adversarial-runner.ts:46, whose error text at :187 says 10 for a 15-minute constant) and no `shutdown()`-style kill (src/dashboard/adversarial-runner.ts:250-254, src/dashboard/multi-server.ts:2271) apply to a launched run.
 - **Liveness:** `process.kill(-pgid, 0)` succeeds and `ps -o args= -p <pid>` contains `continue the sdd process` (D7).
 - **Stop** (Req 3 AC 9): `state: 'stopping'`, `SIGTERM` to `-pgid`, poll every `pollMs`, `SIGKILL` to `-pgid` if alive after `stopGraceMs`, finalise once gone.
 - **Finalise** (Req 3 AC 10; idempotent; `restore()` runs it for a gone record):
@@ -99,38 +99,38 @@ graph LR
   5. `state: 'stopped'`, `endedAt`; write the record; emit.
 - **Own exit** (Req 3 AC 11): an `exit` with no stop request sets `exited`, `exitCode` and `signal` and touches no ledger or pointer.
 - **Run id** (Req 3 AC 6): C5 calls `noteRunId` on a `run.start` at or after `launchedAt`.
-- **Carried R3-minor-2:** Launch always writes `gates: 'record'` (Req 3 AC 1), overwriting a setup saved for a terminal run with `block`. This is intended: the file holds one pending run, and a headless run cannot ask.
+- **Carried R3-minor-2:** Launch always writes `gates: 'record'` (Req 3 AC 1), overwriting a `block` setup saved for a terminal run. This is intended: a headless run cannot ask.
 
 ### C5 — Project harness watch (`project-watch.ts`)
 - **Purpose:** Run model, gates and log for one project's harness subscribers (Req 4).
 - **Interfaces:** `class ProjectHarnessWatch { constructor(project, launcher, send, opts?: { debounceMs?: number }); start(); close(); snapshot(): HarnessMessage[] }`; `parseHandoffRouting(md)` (spec via src/watch/ledger.ts:219-223, then the `Live phase`, `state`, `last result` fields of harness/skills/sdd-continue/references/formats.md:75-76); `parseGateSections(md)` (raw text under `## Gate A` and `## Gate B`).
-- **Behaviour:** The spec is `resolveSpec` (src/watch/index.ts:42-59) on `<projectPath>/.spec-workflow`, `null` when it throws. It watches the four files and options of src/watch/index.ts:101-104, plus `questions.md` and the launch log. A change schedules one rebuild after `debounceMs` (default 300, as src/dashboard/multi-server.ts:91). The rebuild reads as `renderOnce` does (src/watch/index.ts:61-71), calls `buildModel`, and sends `harness-model` and `harness-gates`; a HANDOFF naming another spec re-targets the watcher; new complete log lines, read from a byte offset, go out as one `harness-log`. `snapshot()` holds the model, gates and the last 200 log lines with `reset: true`.
+- **Behaviour:** The spec is `resolveSpec` (src/watch/index.ts:42-59) on `<projectPath>/.spec-workflow`, `null` when it throws. It watches the four files and options of src/watch/index.ts:101-104, plus `questions.md` and the launch log. A change schedules one rebuild after `debounceMs` (default 300, as src/dashboard/multi-server.ts:91). The rebuild reads as `renderOnce` does (src/watch/index.ts:61-71), calls `buildModel`, and sends `harness-model` and `harness-gates`; a HANDOFF naming another spec re-targets the watcher; new complete log lines, read from a byte offset, go out as one `harness-log`. On a `launch-update` the watch re-derives `logPath` from `launcher.get(projectId)`, resets the byte offset to 0, re-arms the file watch on the new file and sends a `reset: true` batch; the client keys its log buffer on `launchedAt` and drops a batch whose `launchedAt` differs from the current run. `snapshot()` holds the model, gates and the last 200 log lines with `reset: true`.
 
 ### C6 — Overview watch (`overview-watch.ts`)
 - **Purpose:** One watcher set for all Overview clients (Req 5).
-- **Interfaces:** `class OverviewWatch { constructor(projects: ProjectManager, send, opts?: { debounceMs?: number }); start(); close(); refresh(); snapshot() }`; `buildOverviewRow(project, pointer)`.
+- **Interfaces:** `class OverviewWatch { constructor(projects: ProjectManager, send, opts?: { debounceMs?: number }); start(); close(); refresh(); snapshot(): HarnessMessage[] }` — the snapshot emits both `overview-rows` and `overview-todos`; `buildOverviewRow(project, pointer)`.
 - **Rows:** A pointer line in the project's spec store makes it `running` with that spec and run id; else `idle` with the HANDOFF spec (Req 5 AC 2). From that spec's ledger: `lastRow` is the newest `phase.start`, `phase.end`, or `note` whose `text` matches `gate A` or `gate B`; `livePhase` is `buildModel({ spec, ledger, activity: [] }).livePhase?.phase`, else the HANDOFF phase; `waiting` applies requirements D7 to the last run; `newestTs` is the newest row.
 - **Watch set:** the pointer file, the HUD file, and each project's HANDOFF and row ledger, recomputed on a pointer, HANDOFF or `projects-update` change. Projects come from src/dashboard/project-manager.ts:239-241.
 
 ### C7 — Hub and server wiring (`hub.ts`, `multi-server.ts`)
 - `WebSocketConnection` (src/dashboard/multi-server.ts:56-60) gains `views?: Set<'harness' | 'overview'>`.
 - The handler (src/dashboard/multi-server.ts:263-293) accepts `harness-subscribe` (sets `projectId`, adds `harness`), `harness-unsubscribe`, `overview-subscribe` and `overview-unsubscribe`; `subscribe` is unchanged.
-- `HarnessHub.reconcile(clients)` runs after each of those, after `subscribe`, and after both removal paths (src/dashboard/multi-server.ts:252-255, 2153-2166). It starts a watch for each count above zero and closes it at zero (Req 4 AC 7, Req 5 AC 9), and sends a new subscriber the watch's `snapshot()`.
+- `HarnessHub.reconcile(clients)` runs after each of those, after `subscribe`, and after both removal paths (src/dashboard/multi-server.ts:252-255, 2153-2166). It starts a watch for each count above zero and closes it at zero (Req 4 AC 7, Req 5 AC 9). The subscribe handler — not reconcile — sends `snapshot()` to the subscribing socket alone, so an existing client's log view is never reset.
 - `sendToHarness(projectId, msg)` and `sendToOverview(msg)` filter on `views`, not `broadcastToProject` (src/dashboard/multi-server.ts:2139-2151; Req 4 AC 9).
 - Routes (404 for an unknown project, as src/dashboard/multi-server.ts:509-514):
   - `GET /api/projects/:projectId/harness/setup` returns `SetupView`.
   - `PUT …/harness/setup` takes `SetupInput` and returns `{ file }`, 400 `ValidationError` or 409 `{ error: 'not-launchable', reason }`.
   - `POST …/harness/launch` takes `SetupInput`, forces `gates: 'record'`, then validates, admits, writes and launches. It returns `{ launch }`, 400, 409 `{ error: 'run-live', runId, reason }` or 500 `{ error, step, detail }`.
   - `POST …/harness/stop` returns `{ launch }`, or 404 when nothing is running or stopping.
-- `start()` awaits `launcher.restore()` before `listen`; `stop()` closes the hub watches and kills no run. A `launch-update` rebuilds that project's `harness-model` and refreshes the overview.
+- `start()` awaits `launcher.restore()` before `listen`; `stop()` closes the hub watches and kills no run. A `launch-update` rebuilds that project's `harness-model`, re-points its log watch (C5) and refreshes the overview.
 
 ### C8 — Frontend
 - **WebSocketProvider** (src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx): the context gains `watchView(view): () => void`. The provider sends the subscribe message when a view gains its first user and on every `onopen`, and the unsubscribe when it loses its last. `onmessage` (lines 88-113) routes `overview-*` like `projects-update`; `harness-*` carries `projectId`.
-- **HarnessPage** (`/harness`) shows the spec list (routed spec marked, HANDOFF phase, state and result); the run form (a card per role with model input, a provider select for `eligibleRoles`, declared model, and read-only effort with the reason "the Agent tool has no effort override"; a supervisor card; worktree and gates; Save and Launch); a run bar (state, pid, run id, exit code, Stop); the Req 4 AC 3 live view, with declared model and effort from `profiles`; the gates as read-only text (Req 4 AC 5); and the last 500 log lines. In the implementation phase it fetches the summary route (src/dashboard/multi-server.ts:1965-1988) at most every five seconds for each task's verdict and `tdd` (Req 4 AC 4).
+- **HarnessPage** (`/harness`) shows the spec list (routed spec marked, HANDOFF phase, state and result); the run form (a card per role with model input, a provider select for `eligibleRoles`, declared model, and read-only effort; a supervisor card; worktree and gates; Save and Launch); a run bar (state, pid, run id, exit code, Stop); the Req 4 AC 3 live view, with declared model and effort from `profiles`; the gates as read-only text (Req 4 AC 5); and the last 500 log lines. In the implementation phase it fetches the summary route (src/dashboard/multi-server.ts:1965-1988) at most every five seconds for each task's verdict and `tdd` (Req 4 AC 4).
 - **OverviewPage** (`/overview`): a card per `OverviewRow` with the age ticking each second and a "waiting" badge, and the to-do list, open items first. It has no edit, launch or stop control (Req 5 AC 8).
 - Routes go beside src/dashboard_frontend/src/modules/app/App.tsx:239-251, and nav items follow the shape of src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx:44-59.
 - Phone width (Req 6 AC 4): grids go to one column below `sm`, text cells use `min-w-0 break-words`, and nothing has a fixed width.
-- Strings go only in `locales/en.json` (D16; fallback at src/dashboard_frontend/src/i18n.ts:80; scripts/validate-i18n.js:43-78 checks only interpolation variables).
+- Strings go only in `locales/en.json` (D16; scripts/validate-i18n.js:43-78 checks only interpolation variables).
 - `modules/harness/types.ts` copies the Data Models wire shapes and `RunModel`.
 
 ### C9 — Supervisor honours the file (harness)
@@ -139,7 +139,7 @@ graph LR
   - another spec: `setup=mismatch file=<spec> active=<spec>`;
   - applied: `setup=applied`, `written=`, `gates=`, `worktree=`, `orchestrators=<agent>=<model>,…|none`, `workers=<agent>=<model>,…|none` (anthropic workers only), `providers=<merged>` and `overrides=<agent>:<model>:<provider>,…`.
   An orchestrator is a name ending `-orchestrator` (src/watch/ledger.ts:294). A malformed file or an AC 1.6 violation exits 2 with one `setup: <reason>` stderr line; the provider merge passes its exit code (2 or 3) through. Any non-zero exit deletes the file (Req 2 AC 6).
-- **`sdd-providers.sh AGENT_RULES_PATH [RUN_FILE]`** (harness/skills/sdd-continue/references/sdd-providers.sh:25-77): the optional argument merges each file role over the parsed rows before the unchanged checks of lines 54-71, so a non-eligible role off `anthropic` is refused there. Only eligible roles and deepseek roles merge. With one argument the output is unchanged.
+- **`sdd-providers.sh AGENT_RULES_PATH [RUN_FILE]`** (harness/skills/sdd-continue/references/sdd-providers.sh:25-77): with one argument the script is unchanged. With `RUN_FILE`, the per-row checks move out of the inline parse loop (lines 54-64) into one validation pass over the union of parsed rows and run-file roles, and the `none()` short-circuits for no `## Providers` heading (line 41), an unreadable file (line 35) and zero parsed rows (line 66) do not fire — the script merges, then validates. So a role added where agent-rules has no Providers block, or a role flipped to `deepseek`, is always validated; a non-eligible role off `anthropic` is refused there. Only eligible and deepseek roles merge.
 - **SKILL.md** (harness/skills/sdd-continue/SKILL.md):
   - After Step 2 and before the Run ledger paragraph (lines 100-129), run the script:
     - `mismatch`: print `warning: harness-run.json is for <file spec>, the active spec is <spec>; ignoring it` (Req 2 AC 2).
@@ -178,7 +178,7 @@ interface SetupInput {
   roles: Record<string, { model: string; provider?: Provider }>;
 }
 
-interface ValidationError { field: string; value: string; error: string } // field: 'roles.sdd-reviewer.model'
+interface ValidationError { field: string; value: string; error: string }
 
 interface SpecRow {
   name: string; bucket: 'active' | 'deferred' | 'other';
@@ -202,7 +202,7 @@ interface SetupView {
   roles: RoleRow[];                   // empty without profiles
   worktree: 'yes' | 'no'; gates: 'block' | 'record';
   modelAliases: string[]; deepseekModels: string[]; eligibleRoles: string[];
-  saved: HarnessRunFile | null;       // shown as a notice only
+  saved: HarnessRunFile | null;       // display-only notice
 }
 
 interface LaunchRecord {              // <global dir>/harness/launches/<projectId>.json
@@ -241,18 +241,18 @@ type ViewMessage =                    // client to server
   | { type: 'overview-subscribe' | 'overview-unsubscribe' };
 ```
 
-`RunModel` and `AgentProfile` are unchanged (src/watch/ledger.ts:38-44, 157-182). An applied file's `run.start` adds `overrides` (for example `sdd-reviewer:sonnet:anthropic,sdd-checker:deepseek-flash:deepseek`) and `setup: 'harness-run'`.
+`RunModel` and `AgentProfile` are unchanged (src/watch/ledger.ts:38-44, 157-182). An applied file's `run.start` adds `overrides` (`<agent>:<model>:<provider>,…`) and `setup: 'harness-run'`.
 
 ## Error Handling
 
 1. **Invalid value, not launchable, run live:** 400 or 409 as in C7; nothing is written.
 2. **Worktree, setup or spawn failure:** 500 with `step` and `detail` (git stderr; the setup exit code and last 2,000 output characters; `ENOENT`); no record; the run file is deleted.
-3. **Supervisor refusal in the child:** it exits non-zero before any ledger row; the page shows the code and the log's refusal line.
+3. **Supervisor refusal in the child:** it exits non-zero before any ledger row; the page shows the code and the log's refusal line. The form does not pre-validate the supervisor Opus-5.5/Fable-5.1 floor (harness/skills/sdd-continue/SKILL.md:35-37); a below-floor model is caught only here.
 4. **Missing or torn files:** `parseJsonl` skips a torn tail (src/watch/ledger.ts:184-197); a missing file gives an empty section.
 
 ## Testing Strategy
 
-Tests assert only on node 20 documented fields (.spec-workflow/agent-rules.md:31-33): `exit` code and signal, `error.code`, `ESRCH`. Probe on node v24.13.0: a `detached` child had `pgid` equal to its pid; fd `stdio` got both streams; `process.kill(-pid, 0)` passed while the group lived and threw `ESRCH` after a group `SIGTERM`; a missing binary emitted `error` `ENOENT`; `exit` fired after `unref()`. `claude --help` (Claude Code 2.1.284) lists `--effort`, `--model` (aliases such as `fable`, `opus`, `sonnet`, or a full name) and `--permission-mode` `auto`.
+Tests assert only on node 20 documented fields (.spec-workflow/agent-rules.md:31-33): `exit` code and signal, `error.code`, `ESRCH`. A node v24.13.0 probe confirmed the C4 spawn behaviour: `detached` `pgid` equal to pid, fd `stdio`, `process.kill(-pid, 0)` passing while the group lived and throwing `ESRCH` after a group `SIGTERM`, `ENOENT` on a missing binary, and `exit` after `unref()`. `claude --help` (2.1.284) lists `--effort`, `--model` (aliases `fable`/`opus`/`sonnet` or a full name) and `--permission-mode` `auto`.
 
 - **Unit** (`src/dashboard/harness/__tests__/`, plus `src/core/__tests__/index-generator.test.ts`):
   - `snapshot()` writes nothing, and `generate()` output is unchanged.
@@ -264,37 +264,46 @@ Tests assert only on node 20 documented fields (.spec-workflow/agent-rules.md:31
   - `src/dashboard/__tests__/harness-routes.test.ts` (server style of src/dashboard/__tests__/multi-server.test.ts:80-92, a `ws` client): a ledger append reaches a harness subscriber within five seconds and no Specs-page client; the watcher closes at zero subscribers; a `gate-a` row shows "waiting" with two projects; HUD rewrite and delete push todos; PUT and launch return 400, 409 and 200 with the fake cli.
   - `src/__tests__/run-setup-script.test.ts`, in the `execFileSync` style of src/__tests__/providers-map.test.ts:1-30. It covers `none`, `mismatch` and `applied` output, a merged refusal (exit 2, file deleted), a missing key (exit 3), and one-argument `sdd-providers.sh` output unchanged.
   - Parity: the `RunModel` that `ProjectHarnessWatch` sends deep-equals `buildModel` on the same files (Req 6 AC 2); `ledger.test.ts` and `render.test.ts` pass unchanged (Req 6 AC 1).
+- **harness/ checks:** the seven edited `harness/` files require `node scripts/sync-plugin-assets.cjs` (the `plugins/` copies committed in the same commit), `npm run check:plugin-assets` and `claude plugin validate . --strict` (.spec-workflow/agent-rules.md:26-27); each is a line of `verification-evidence.md`.
 - **End-to-end:** decomposition scenario (1)-(7) needs a real `claude -p` in a rebuilt, restarted session, so each of its seven steps is one line of a tracked `verification-evidence.md`, `pending` until an operator runs it; step (6) checks 375 px in browser device mode.
 
 ## Decisions taken in this document
 
-- D1 — Watcher lifecycles are recomputed from the client set after every change: over per-message counters; chosen because an abrupt close cannot leak a watcher.
-- D2 — Launch records and logs live under the global state directory: over the spec store or memory; chosen because they stay out of the repository and survive a restart.
-- D3 — A role the provider map routes to deepseek defaults to the map's model: over the declared Claude model; chosen because that would make the form invalid on load.
-- D4 — Accepted aliases are opus, sonnet and fable: over a longer list; chosen because the installed CLI help names these.
-- D5 — Validation runs on the server only: over duplicated client rules; chosen because one rule set cannot drift.
-- D6 — The page worktree goes under the checkout's Claude worktrees directory on the feat branch, with the setup marker in its git directory: over a new location or a working-tree marker; chosen because it matches EnterWorktree and cannot be committed.
-- D7 — Liveness also checks the command line: over the group check alone; chosen because a reused pid must never get SIGKILL.
-- D8 — A failed launch deletes the setup file it wrote: over leaving it; chosen because a stale record-mode file would change the next terminal run.
-- D9 — A terminal supervisor ignores the file's supervisor model: over refusing; chosen because a session cannot switch its own model.
-- D10 — A new reference script reads the file, and the provider script gains an optional merge argument: over skill prose or a second validator; chosen because scripts are testable and requirements D9 asks for the existing preflight.
-- D11 — Worker overrides travel as one MODEL_OVERRIDES launch prompt line: over a line per role; chosen because it mirrors PROVIDERS.
-- D12 — An alias orchestrator override passes the pre-flight on a family prefix: over requiring full ids; chosen because transcripts record full ids.
-- D13 — The child prints plain text, as the documented headless command does: over stream-json; chosen because the ledger drives the live view.
-- D14 — Finalisation deletes the setup file only when its written-at time matches: over an unconditional delete; chosen because a setup saved for the next run must survive.
-- D15 — Gate sections render as read-only text: over parsed fields; chosen because the supervisor owns that format.
-- D16 — New strings go only into the English locale: over ten translations; chosen because i18n falls back to English.
+- D1 — Watcher lifecycles are recomputed from the client set, so an abrupt close cannot leak a watcher.
+- D2 — Launch records and logs live under the global state directory, out of the repository and surviving a restart.
+- D3 — A role the provider map routes to deepseek defaults to the map's model; the declared Claude model would invalidate the form on load.
+- D4 — Accepted aliases are opus, sonnet and fable, the names the installed CLI help lists.
+- D5 — Validation runs server-side only, so one rule set cannot drift.
+- D6 — The page worktree goes under the checkout's Claude worktrees directory on the feat branch, its setup marker in the git directory: matches EnterWorktree and cannot be committed.
+- D7 — Liveness also checks the command line, so a reused pid never gets SIGKILL.
+- D8 — A failed launch deletes the setup file it wrote; a stale record-mode file would change the next terminal run.
+- D9 — A terminal supervisor ignores the file's supervisor model, because a session cannot switch its own model.
+- D10 — A new reference script reads the file and the provider script gains an optional merge argument: scripts are testable and requirements D9 asks for the existing preflight.
+- D11 — Worker overrides travel as one MODEL_OVERRIDES launch prompt line, mirroring PROVIDERS.
+- D12 — An alias orchestrator override passes the pre-flight on a family prefix, because transcripts record full ids.
+- D13 — The child prints plain text (the documented headless command), since the ledger drives the live view.
+- D14 — Finalisation deletes the setup file only when its written-at time matches, so a setup saved for the next run survives.
+- D15 — Gate sections render as read-only text, which the supervisor owns.
+- D16 — New strings go only into the English locale; i18n falls back to English.
 
 ## Scope notes
 
-- **Carried R3-minor-1** and **R3-minor-2:** addressed in C4. The requirements called the runner timeout 10 minutes; the constant is 15 minutes, and its error text says 10.
+- **Carried R3-minor-1** and **R3-minor-2:** addressed in C4.
 - **Pointer atomicity (Req 3 AC 13):** `removePointerLine` ports `deregister.mjs` and adds a compare-before-rename retry. An append that lands between the last compare and the rename can still be lost, as with that helper; a lock would need the supervisor's appender to change.
-- **Non-`active` routing:** the form is disabled. The supervisor's rules for a pending retrospective or close-out and the decomposition fallback (harness/skills/sdd-continue/SKILL.md:138-152) are not ported; those runs start from a terminal.
-- **Stale pointer line:** a crashed terminal run's line blocks page launches (the 409 names it) until the operator removes it.
-- **After a restart:** a reattached run that exits on its own shows `exitCode: null`. A run found gone gets `stopped from the dashboard`, as Req 3 AC 12 requires, even if it ended on its own.
+- **Non-`active` routing:** the form is disabled; the supervisor's pending-retro/close-out rules and the decomposition fallback (harness/skills/sdd-continue/SKILL.md:138-152) are not ported; they start from a terminal.
+- **Stale pointer line:** a crashed run's line blocks page launches (the 409 names it) until the operator removes it.
+- **After a restart:** a reattached run that exits on its own shows `exitCode: null`; a run found gone gets `stopped from the dashboard` (Req 3 AC 12), even if it ended on its own.
 - Logs are not pruned. The HUD operations array is not read (requirements D1).
 
 ## Revision History
 
 - **v1** (2026-09-28) — Initial draft.
-  - **Lint pass.** 10 citation-path errors fixed (directory prefixes added to the skill, reference and providers-script citations); 63 citation-identifier warnings rejected — design-introduced identifiers, string-literal values and probe-verified node fields, each sharing a line with a context citation that was verified correct.
+  - **Lint pass.** 10 citation-path errors fixed; 63 citation-identifier warnings rejected (known false-positive class).
+- **v2** (2026-09-28) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/3/3).
+  - **Lint pass.** 0 errors; 73 citation-identifier warnings rejected — design-introduced identifiers, string-literal values and probe-verified node fields, each sharing a line with a context citation that was verified correct.
+  - **R1-1 — Accepted (SHOULD_FIX).** C5 now re-points the log watch on a launch-update: it re-derives the path from the launcher, resets the byte offset, re-arms the watch and sends a reset batch, and the client discards a batch whose launch time differs from the current run; C7's launch-update note re-points the log watch too.
+  - **R1-2 — Accepted (SHOULD_FIX).** C9 now validates the union of the agent-rules rows and the run-file roles in one post-merge pass and drops the no-heading, unreadable-file and zero-row short-circuits when a run file is passed, so an added or overridden role is always validated.
+  - **R1-3 — Accepted (SHOULD_FIX).** The Testing Strategy now lists the plugin-sync, plugin-assets check and strict plugin validate the seven harness edits require, each a line of verification-evidence.
+  - **R1-4 — Accepted (MINOR).** C7 now sends the snapshot from the subscribe handler to the subscribing socket alone; reconcile only starts and stops watches.
+  - **R1-5 — Accepted (MINOR).** C3 buildSetupView prose now names its remaining SetupView fields; C6 annotates OverviewWatch.snapshot() as emitting both overview rows and todos.
+  - **R1-6 — Partially accepted (MINOR).** Error Handling #3 now records that the form does not pre-validate the supervisor floor; a below-floor model is caught as a child refusal, not adding a second validation site.
````

## Lint commit edea172

````diff
diff --git a/.spec-workflow/specs/harness-control-pane/design.md b/.spec-workflow/specs/harness-control-pane/design.md
index 24326bf..e736238 100644
--- a/.spec-workflow/specs/harness-control-pane/design.md
+++ b/.spec-workflow/specs/harness-control-pane/design.md
@@ -300,6 +300,7 @@ Tests assert only on node 20 documented fields (.spec-workflow/agent-rules.md:31
 - **v1** (2026-09-28) — Initial draft.
   - **Lint pass.** 10 citation-path errors fixed; 63 citation-identifier warnings rejected (known false-positive class).
 - **v2** (2026-09-28) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/3/3).
+  - **Lint pass.** 0 errors; 73 citation-identifier warnings rejected — design-introduced identifiers, string-literal values and probe-verified node fields, each sharing a line with a context citation that was verified correct.
   - **R1-1 — Accepted (SHOULD_FIX).** C5 now re-points the log watch on a launch-update: it re-derives the path from the launcher, resets the byte offset, re-arms the watch and sends a reset batch, and the client discards a batch whose launch time differs from the current run; C7's launch-update note re-points the log watch too.
   - **R1-2 — Accepted (SHOULD_FIX).** C9 now validates the union of the agent-rules rows and the run-file roles in one post-merge pass and drops the no-heading, unreadable-file and zero-row short-circuits when a run file is passed, so an added or overridden role is always validated.
   - **R1-3 — Accepted (SHOULD_FIX).** The Testing Strategy now lists the plugin-sync, plugin-assets check and strict plugin validate the seven harness edits require, each a line of verification-evidence.
````
