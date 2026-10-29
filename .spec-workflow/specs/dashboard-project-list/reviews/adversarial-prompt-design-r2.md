# Adversarial Review — dashboard-project-list/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-design.md using this format:

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-project-list design v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 0b95633c

````diff
diff --git a/.spec-workflow/specs/dashboard-project-list/design.md b/.spec-workflow/specs/dashboard-project-list/design.md
index bebaae72..519e6025 100644
--- a/.spec-workflow/specs/dashboard-project-list/design.md
+++ b/.spec-workflow/specs/dashboard-project-list/design.md
@@ -2,12 +2,12 @@
 
 ## Overview
 
-The dashboard folds run worktrees into their parent, prunes registrations with missing paths at start, keeps eval servers out of the registry, reads each spec store once, and gives each sidebar row a status dot, a live-run count and an activity sort. The changes sit in the registry, the project manager, the shell feed, the MCP server start path, the eval runner and three frontend views. It reuses the registry lock, the git common-dir call, the shell feed's existing reads and the spec 22 tone tokens.
+The dashboard folds run worktrees into their parent, prunes missing-path registrations at start, keeps eval servers out of the registry, reads each spec store once, and gives each sidebar row a status dot, a live-run count and an activity sort. The changes touch the registry, project manager, shell feed, MCP start path, eval runner and three frontend views, reusing the registry lock, the git common-dir call, the feed's existing reads and the spec 22 tone tokens.
 
 ## Steering Document Alignment
 
 ### Technical Standards (tech.md)
-No `tech.md` exists; per the agent rules, server tests sit in `__tests__/` beside the module under vitest, and frontend behaviour is proved by the worktree Playwright suite.
+No `tech.md` exists; per the agent rules, server tests sit in `__tests__/` beside the module (vitest), frontend behaviour in the worktree Playwright suite.
 
 ### Project Structure (structure.md)
 No `structure.md` exists; new server modules sit beside the code they serve, and the one new frontend module goes in `src/dashboard_frontend/src/modules/projects/`.
@@ -17,7 +17,7 @@ No `design-system.md` exists. The dot's colours are spec 22 tone tokens (`src/da
 
 ## Architecture
 
-One serialized reconcile in the project manager builds the listed set from the registry and `projects.json`, computes folds with a pure function, and adds or removes contexts to match. Dashboard start prunes missing paths from both files, each under its file lock, before the first reconcile. The shell feed builds spec rows once per store and adds a `sidebar` array to `shell-now`; the frontend renders it and keys counts and page lists on the store identity the project list now carries.
+One serialized reconcile in the project manager builds the listed set from the registry and `projects.json`, computes folds with a pure function, and adds or removes contexts to match. Dashboard start prunes missing paths from both files, each under its file lock, before the first reconcile. The shell feed builds spec rows once per store and adds a `sidebar` array to `shell-now`; the frontend renders it and keys counts and page lists on the store identity now on the project list.
 
 ```mermaid
 graph LR
@@ -37,17 +37,17 @@ graph LR
 ## Components and Interfaces
 
 ### C1 — Worktree classification (`src/core/git-utils.ts`)
-- **Purpose:** Classify one workspace as a linked worktree and return its main working tree, from one git call (R1 Terms, NFR Performance).
-- **Interfaces:** `linkedWorktreeInfo(workspacePath: string): { linked: boolean; mainTree: string | null }`. Post-conditions: runs `git rev-parse --git-common-dir` exactly once through `gitCapture` (`src/core/git-utils.ts:64-71`, scrubbed env, 5000 ms timeout at `src/core/git-utils.ts:7-11`); `linked` is true only when the raw output is non-null and not `.git` (the test `isGitWorktree` applies at `src/core/git-utils.ts:260-270`); `mainTree` is the parent of the realpath-normalized common directory (as `gitCommonDirAbsolute` computes it at `src/core/git-utils.ts:133-139`) when that directory's base name is `.git`, else null; a failed call returns `{ linked: false, mainTree: null }`. It never reads `SPEC_WORKFLOW_SHARED_ROOT`, unlike `resolveGitRoot` (`src/core/git-utils.ts:214-252`). Never throws.
+- **Purpose:** Classify one workspace as a linked worktree and return its main tree, from one git call (R1 Terms, NFR Performance).
+- **Interfaces:** `linkedWorktreeInfo(workspacePath: string): { linked: boolean; mainTree: string | null }`. Post-conditions: runs `git rev-parse --git-common-dir` once through `gitCapture` (`src/core/git-utils.ts:64-71`, scrubbed env, 5000 ms timeout at `src/core/git-utils.ts:7-11`); `linked` is true only when the raw output is non-null and not `.git` (the `isGitWorktree` test, `src/core/git-utils.ts:260-270`); `mainTree` is the parent of the realpath-normalized common directory (`gitCommonDirAbsolute`, `src/core/git-utils.ts:133-139`) when its base name is `.git`, else null; a failed call returns `{ linked: false, mainTree: null }`. It never reads `SPEC_WORKFLOW_SHARED_ROOT`, unlike `resolveGitRoot` (`src/core/git-utils.ts:214-252`). Never throws.
 - **Dependencies:** `gitCapture` (`src/core/git-utils.ts:64-71`), `normalizeIdentityPath` (`src/core/git-utils.ts:101-112`).
-- **Reuses:** the existing common-dir handling; no new git command.
+- **Reuses:** its two dependencies only; it runs the common-dir command once and applies the non-`.git` test and parent-of-`.git` logic inline, not via `isGitWorktree` or `gitCommonDirAbsolute` (each would issue its own call).
 
 ### C2 — Fold computation (new `src/dashboard/project-folding.ts`)
-- **Purpose:** Decide which candidate entries fold and into which parent (R1 AC1 to AC3, D5, D6 of requirements).
+- **Purpose:** Decide which candidates fold and into which parent (R1 AC1 to AC3, D5, D6 of requirements).
 - **Interfaces:** `computeFolds(candidates: FoldCandidate[], classify: (workspacePath: string) => { linked: boolean; mainTree: string | null }): Map<string, string>` returning folded id to parent id. `FoldCandidate` is `{ projectId: string; projectPath: string; workflowRootPath: string }`. Post-conditions:
-  1. `classify` is called once per candidate whose two paths differ, and never for a candidate whose paths are equal.
-  2. Parents are drawn only from candidates that are not linked worktrees (equal-path candidates count as not linked). A linked worktree never becomes a parent, so folds never chain.
-  3. For a linked candidate: if a parent has `projectPath` equal to the candidate's `mainTree` and `workflowRootPath` equal to the candidate's, it folds there (R1 AC1); else if a parent has `projectPath` and `workflowRootPath` both equal to the candidate's `workflowRootPath`, it folds there (R1 AC2); else it is absent from the map (R1 AC3).
+  1. `classify` is called once per candidate whose two paths differ, never when they are equal.
+  2. Parents are drawn only from candidates that are not linked worktrees (equal-path candidates count as not linked), so a linked worktree never becomes a parent and folds never chain.
+  3. For a linked candidate: if a parent has `projectPath` equal to the candidate's `mainTree` and `workflowRootPath` equal to the candidate's, it folds there (R1 AC1); else if a parent has `projectPath` and `workflowRootPath` both equal to the candidate's `workflowRootPath`, it folds there (R1 AC2); else it is not in the map (R1 AC3).
   4. If `classify` throws for a candidate, that candidate does not fold and the error is reported through an optional trailing `onError?: (projectId: string, error: unknown) => void`.
 - **Dependencies:** none (pure).
 - **Reuses:** nothing; path comparison is plain string equality on the realpath-normalized strings the registry stores (`src/core/project-registry.ts:354-393`).
@@ -55,28 +55,28 @@ graph LR
 ### C3 — Project manager reconcile (`src/dashboard/project-manager.ts`)
 - **Purpose:** Keep the in-memory project set equal to the unfolded candidates on every change (R1 AC4, AC5, AC6; R2 AC8).
 - **Interfaces:**
-  - `syncWithRegistry()` keeps its name (a test calls it, `src/dashboard/__tests__/project-manager-durable.test.ts:84`) and becomes the one reconcile. Post-conditions: candidates are the registry entries plus each `projects.json` entry the registry lacks (with `instances: []`), each file read once; `computeFolds` runs with `linkedWorktreeInfo`; every unfolded candidate has a context (added by `addProject` or updated in place as `src/dashboard/project-manager.ts:146-154` does); every folded candidate and non-candidate has none (`removeProject` stops its watchers); one `projects-update` is emitted.
-  - Calls to `syncWithRegistry` are serialized: a call waits for the running one, then makes its own full pass, so a watcher event and a manual add cannot add one id twice.
-  - `initialize()` order: registry cleanup with the existence check (C4), `projects.json` prune (C5), `syncWithRegistry()`, then the registry watcher. `loadProjectsFromRegistry` and `loadRememberedProjects` are replaced by the first `syncWithRegistry()`.
+  - `syncWithRegistry()` keeps its name (a test calls it, `src/dashboard/__tests__/project-manager-durable.test.ts:84`) and becomes the one reconcile. Post-conditions: candidates are the registry entries plus each `projects.json` entry the registry lacks (`instances: []`), each file read once; `computeFolds` runs with `linkedWorktreeInfo`; every unfolded candidate has a context (added by `addProject` or updated in place, `src/dashboard/project-manager.ts:146-154`); folded candidates and non-candidates have none (`removeProject` stops their watchers); one `projects-update` is emitted.
+  - Calls to `syncWithRegistry` are serialized: a call waits for the running one, then makes its own full pass, so a watcher event and a manual add cannot add one id twice. The registry watcher's `change`/`add` handlers (`src/dashboard/project-manager.ts:115-121`) coalesce through a 100 ms trailing debounce (D12), so a run-startup write burst runs one reconcile, not one per write; `initialize()` runs the first `syncWithRegistry()` directly, keeping the cleanup -> prune -> sync -> watcher order.
+  - `initialize()` order: registry cleanup with the existence check (C4), `projects.json` prune (C5), `syncWithRegistry()`, then the registry watcher. The first `syncWithRegistry()` replaces `loadProjectsFromRegistry` and `loadRememberedProjects`.
   - `addProjectByPath` keeps its registry and `rememberProject` writes and its explicit-root re-add (`src/dashboard/project-manager.ts:364-372`), then awaits `syncWithRegistry()`; it returns the entry's id, folded or not.
-  - `removeProjectById` unregisters and forgets as today (`src/dashboard/project-manager.ts:389-393`), then awaits `syncWithRegistry()`, so a worktree it had folded is listed again (R1 AC5).
-  - `getProjectsList()` adds `workflowRootPath: string` (the original, untranslated workflow root) to each item (R2 AC8). No other field changes.
-  - A failed classification logs once per project id per process: `[ProjectManager] Could not classify <id> (<path>): <message>; listing it`.
+  - `removeProjectById` forgets the `projects.json` entry before it unregisters (today's order is the reverse, `src/dashboard/project-manager.ts:389-393`), then awaits `syncWithRegistry()`, so a worktree it had folded is listed again (R1 AC5). Forgetting first means a `forgetProject` lock-miss throw (C5) fires before anything is removed, leaving both files whole (Error Handling #3).
+  - `getProjectsList()` adds `workflowRootPath: string` (the original, untranslated workflow root) to each item (R2 AC8); no other field changes.
+  - A failed classification logs once per id per process: `[ProjectManager] Could not classify <id> (<path>): <message>; listing it`.
 - **Dependencies:** C1, C2, C4, C5.
 - **Reuses:** `addProject` (`src/dashboard/project-manager.ts:181-256`) unchanged, including its remember-only-equal-paths rule (`src/dashboard/project-manager.ts:240-249`), so a folded entry is never added and never remembered (R1 AC10). Per-project routes call `getProject`, which returns `undefined` for a folded id, so they answer 404 as today (`src/dashboard/multi-server.ts:576-583`, R1 AC6) with no route change.
 
 ### C4 — Registry startup cleanup (`src/core/project-registry.ts`)
 - **Purpose:** Remove registry entries whose workspace or workflow root path is gone, under the registry lock (R4 AC1, AC3 to AC7).
-- **Interfaces:** `cleanupStaleProjects(isMissing?: (path: string) => Promise<boolean>): Promise<number>` — the predicate is an optional trailing parameter, so existing callers and tests keep compiling. Post-conditions: the whole read-modify-write runs inside `withRegistryLock(this.lockPath, …)` (`src/core/registry-lock.ts:371-412`); with `isMissing` given, an entry is deleted when `isMissing(projectPath)` or `isMissing(workflowRootPath)` resolves true, whatever its pids; otherwise the dead-pid rule of `src/core/project-registry.ts:479-496` applies unchanged; each path deletion logs one line `[ProjectRegistry] Removed <id> from <registry path>: <missing path> does not exist`; the return value still counts removed instances. If the lock is not acquired, it logs one line and returns 0 with no write, so every entry is kept.
+- **Interfaces:** `cleanupStaleProjects(isMissing?: (path: string) => Promise<boolean>): Promise<number>` — the predicate is optional, so existing callers and tests keep compiling. Post-conditions: the whole read-modify-write runs inside `withRegistryLock(this.lockPath, …)` (`src/core/registry-lock.ts:371-412`); with `isMissing` given, an entry is deleted when `isMissing(projectPath)` or `isMissing(workflowRootPath)` resolves true, whatever its pids; otherwise the dead-pid rule of `src/core/project-registry.ts:479-496` applies unchanged; each path deletion logs one line `[ProjectRegistry] Removed <id> from <registry path>: <missing path> does not exist`; the return value still counts removed instances. If the lock is not acquired, it logs, returns 0 and writes nothing, so every entry is kept.
 - **Dependencies:** the registry lock.
 - **Reuses:** `readRegistry` (unchanged, still no filesystem call per entry, R4 AC5) and `writeRegistry`.
 
 ### C5 — `projects.json` lock and startup prune (`src/controller/state.ts`)
 - **Purpose:** Remove remembered projects whose paths are gone, serialized with `rememberProject` and `forgetProject` (R4 AC2, AC8).
 - **Interfaces:**
-  - A private `withProjectsLock(fn)` takes `withRegistryLock` on `projects.json.lock` beside `projects.json` (`src/controller/state.ts:302-304`) and throws when the lock is not acquired, the same contract as `withStoreLock` (`src/controller/state.ts:559-570`).
+  - A private `withProjectsLock(fn)` takes `withRegistryLock` on `projects.json.lock` beside `projects.json` (`src/controller/state.ts:302-304`) and throws when the lock is not acquired, like `withStoreLock` (`src/controller/state.ts:559-570`).
   - `rememberProject` and `forgetProject` run their read-modify-write inside it. Signatures unchanged.
-  - New `pruneMissingProjects(isMissing: (path: string) => Promise<boolean>): Promise<KnownProject[]>` runs inside the same lock, drops every entry whose `workspacePath` or `workflowRootPath` is missing, writes once when anything was dropped, logs one line per drop `[projects] Removed <id> from <projects.json path>: <missing path> does not exist`, and returns the dropped entries. On lock failure it logs and returns `[]` with no write.
+  - New `pruneMissingProjects(isMissing: (path: string) => Promise<boolean>): Promise<KnownProject[]>` runs inside the same lock, drops every entry whose `workspacePath` or `workflowRootPath` is missing, writes once if anything dropped, logs one line per drop `[projects] Removed <id> from <projects.json path>: <missing path> does not exist`, and returns the dropped entries. On lock failure it logs and returns `[]`, no write.
 - **Dependencies:** the registry lock primitive.
 - **Reuses:** `readProjects`, `writeProjects` (`src/controller/state.ts:451-457`), `writeJsonAtomic` (`src/controller/state.ts:318-323`).
 
@@ -89,7 +89,7 @@ graph LR
 - **Purpose:** The server an eval step launches writes nothing to the operator's registry, and so nothing reaches `projects.json` (R3 AC1 to AC3, AC5).
 - **Interfaces:**
   - `CLI_FLAGS` (`src/index.ts:164-177`) gains `'--no-register': 'boolean'`; `parseArguments` returns `noRegister: boolean`; the help OPTIONS block (`src/index.ts:37-65`) gains one entry for it ("Do not add this server to the project registry; used by eval runs").
-  - `SpecWorkflowMCPServer.initialize(projectPath, workspacePath, lang?, inferredWorkspaceFallback?, options?: { register?: boolean })` — `options` is an optional trailing parameter, default `register: true`. With `register: false` it skips the registration block (`src/server.ts:185-195`), logs `Project registration skipped (--no-register)`, and leaves `registeredProjectId` unset, so `stop()` unregisters nothing (`src/server.ts:289`). Workspace, workflow root and the tool context are unchanged (R1 AC8, R3 AC3).
+  - `SpecWorkflowMCPServer.initialize(projectPath, workspacePath, lang?, inferredWorkspaceFallback?, options?: { register?: boolean })` — `options` is optional, default `register: true`. With `register: false` it skips the registration block (`src/server.ts:185-195`), logs `Project registration skipped (--no-register)`, and leaves `registeredProjectId` unset, so `stop()` unregisters nothing (`src/server.ts:289`). Workspace, workflow root and the tool context are unchanged (R1 AC8, R3 AC3).
   - `src/index.ts:662-668` passes `{ register: !noRegister }`.
   - `runCases` (`src/evals/runner.ts:190-197`) appends `'--no-register'` to the inline server's `args`, after the fixture root. The runner reads, edits and deletes nothing in the registry or `projects.json` (R3 AC5).
 - **Dependencies:** none new.
@@ -97,7 +97,7 @@ graph LR
 
 ### C8 — Store grouping (new `src/dashboard/shell/store-groups.ts`; `src/dashboard/shell/shell-feed.ts`)
 - **Purpose:** Read each store once per flush (R2 AC7).
-- **Interfaces:** `groupByStore(projects: ProjectContext[]): { workflowRootPath: string; representative: ProjectContext; projects: ProjectContext[] }[]`. Post-conditions: one group per distinct `workflowRootPath` string; the representative is the project whose `originalProjectPath` equals `workflowRootPath`, else the first by `projectName` (locale compare), then `projectId`. In `flush`, `buildSpecRows` (`src/dashboard/shell/spec-rows.ts:78-99`) runs once per group with the representative and a live spec taken from the first project in the group with a live run (`src/dashboard/shell/live-runs.ts:10-18`). Spec rows therefore carry the representative's `projectId` and `projectName`. A group whose rows throw is skipped and logged as today (`src/dashboard/shell/shell-feed.ts:98-100`).
+- **Interfaces:** `groupByStore(projects: ProjectContext[]): { workflowRootPath: string; representative: ProjectContext; projects: ProjectContext[] }[]`. Post-conditions: one group per distinct `workflowRootPath`; the representative is the project whose `originalProjectPath` equals `workflowRootPath`, else the first by `projectName` (locale compare), then `projectId`. In `flush`, `buildSpecRows` (`src/dashboard/shell/spec-rows.ts:78-99`) runs once per group with the representative and a live spec taken from the first project in the group with a live run (`src/dashboard/shell/live-runs.ts:10-18`). Spec rows carry the representative's `projectId` and `projectName`. A group whose rows throw is skipped and logged as today (`src/dashboard/shell/shell-feed.ts:98-100`).
 - **Dependencies:** none new.
 - **Reuses:** `buildSpecRows`, `FileCache`.
 
@@ -105,13 +105,13 @@ graph LR
 - **Purpose:** Compute each listed project's dot, live-run count, last activity and sort position on the server, from data the feed already reads (R5 AC1 to AC6, AC9, AC11; R6).
 - **Interfaces:**
   - `NOW_LIVE_STATUSES: readonly string[]` = `['queued', 'running', 'merging', 'paused', 'waiting']`, the server copy of `CTRL_LIVE_STATUSES` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:27`).
-  - `buildSidebarRows(projects: { projectId: string; projectName: string }[], now: NowModel, waits: ControllerWait[], runs: ControllerRun[]): SidebarProjectRow[]`. Post-conditions, per project id P:
-    - `liveCount` = the number of `runs` with `project` P and a status in `NOW_LIVE_STATUSES`; when that is 0, the number of `now.live` rows with `projectId` P (the Now page's rule at `src/dashboard_frontend/src/modules/shell/NowPage.tsx:257-264`, R5 AC5).
+  - `buildSidebarRows(projects: { projectId: string; projectName: string }[], now: NowModel, waits: ControllerWait[], runs: ControllerRun[]): SidebarProjectRow[]`. Post-conditions, per id P:
+    - `liveCount` = the count of `runs` with `project` P and a status in `NOW_LIVE_STATUSES`; when that is 0, the count of `now.live` rows with `projectId` P (the Now page's rule at `src/dashboard_frontend/src/modules/shell/NowPage.tsx:257-264`, R5 AC5).
     - `dot` = `waiting` when some `waits` entry has `project` P and `state` `open`, or some `now.waits` row has `projectId` P (R5 AC2, D7 of requirements); else `running` when `liveCount` is 1 or more (R5 AC3); else `idle` (R5 AC4).
     - `lastActivity` = the greatest `updated` among `runs` with `project` P, any status, else null (R6 AC3).
-    - Order: `waiting` and `running` rows before `idle` rows (R6 AC1); within each group, non-null `lastActivity` newest first, then null (R6 AC2, AC4); ties by `projectName` (locale compare), then `projectId`. The order is a total order over the inputs, so equal inputs give an equal order (R6 AC5).
+    - Order: `waiting` and `running` rows before `idle` rows (R6 AC1); within each group, non-null `lastActivity` newest first, then null (R6 AC2, AC4); ties by `projectName` (locale compare), then `projectId`. It is a total order, so equal inputs give an equal order (R6 AC5).
     - The sidebar filter is not an input (R5 AC11).
-  - `NowModel` (`src/dashboard/shell/types.ts`) gains `sidebar: SidebarProjectRow[]`; `buildNowModel` returns `[]`; `flush` fills it after it reads waits and runs, before it sends `shell-now`. `SidebarProjectRow` is `{ projectId: string; dot: 'waiting' | 'running' | 'idle'; liveCount: number; lastActivity: string | null }`.
+  - `NowModel` (`src/dashboard/shell/types.ts`) gains `sidebar: SidebarProjectRow[]`; `buildNowModel` returns `[]`; `flush` fills it after reading waits and runs, before sending `shell-now`. `SidebarProjectRow` is `{ projectId: string; dot: 'waiting' | 'running' | 'idle'; liveCount: number; lastActivity: string | null }`.
 - **Dependencies:** the waits and runs `flush` already reads (`src/dashboard/shell/shell-feed.ts:103-115`).
 - **Reuses:** the existing `shell-now` topic; no new route, poll or topic (R5 AC9).
 
@@ -128,34 +128,34 @@ graph LR
 - **Interfaces:**
   - Specs count: `specRows` whose store (`storeOf` on `row.projectId`) is in an enabled group; rows are one per store and spec (C8), so each pair counts once (R2 AC1).
   - Deferrals count: per enabled group, the `deferred` records of the first project in the group with a payload in `deferralsByProject` (R2 AC2); payloads are built per store (`src/dashboard/multi-server.ts:464-473`).
-  - Project rows: sorted by the index of `projectId` in `now.sidebar`; a project absent from it goes after all present ones, by `projectName`. Each row renders, after the toggle and before the name, one dot (`span`, 8 px circle, `role="img"`, `aria-label` and `title` such as "Running, 1 live run", "Waiting on you", "Idle") and, when `liveCount` is 1 or more, the count as text in the row's existing muted text style (R5 AC1, AC6, AC7). A project absent from `now.sidebar` shows `idle` with no count.
-  - Dot colours: `waiting` uses `--tone-warning-fg`, `running` uses `--tone-success-fg`, `idle` uses `--tone-neutral-fg` (R5 AC8). No other element, size or spacing changes (R5 AC10). Test ids added: `project-dot-<projectId>` with a `data-state` attribute, `project-live-count-<projectId>`.
+  - Project rows: sorted by the index of `projectId` in `now.sidebar`; a project absent from it goes after all present ones, by `projectName`. Each row renders, after the toggle and before the name, one dot (`span`, 8 px circle, `role="img"`, `aria-label` and `title` such as "Running, 1 live run", "Waiting on you", "Idle") and, when `liveCount` is 1 or more, the count as text in the row's existing muted style (R5 AC1, AC6, AC7). A project absent from `now.sidebar` shows `idle`, no count.
+  - Dot colours: `waiting` `--tone-warning-fg`, `running` `--tone-success-fg`, `idle` `--tone-neutral-fg` (R5 AC8). No other element, size or spacing changes (R5 AC10). Test ids added: `project-dot-<projectId>` with a `data-state` attribute, `project-live-count-<projectId>`.
 - **Dependencies:** C9 rows in `now`, C10.
 
 ### C12 — Specs and Deferrals pages (`SpecsPage.tsx`, `DeferralsPage.tsx`, frontend `types.ts`)
 - **Purpose:** List each store's rows once, grouped by store, so a page's count equals the sidebar count under the same filter (R2 AC5, AC6).
 - **Interfaces:**
-  - Both pages iterate `storeGroups(projects, enabled)` filtered to enabled groups, in place of `enabledProjects` (`src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:82-144`, `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:88-165`). Group key and selection key use the store (`<store>::<spec>`, `<store>::<deferral id>`); the group title is the representative's `projectName`.
+  - Both pages iterate `storeGroups(projects, enabled)` filtered to enabled groups, in place of `enabledProjects` (`src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:82-144`, `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:88-165`). Group and selection keys use the store (`<store>::<spec>`, `<store>::<deferral id>`); the group title is the representative's `projectName`.
   - Specs: a group's rows are the `specRows` whose store is the group's store. Deferrals: a group's records come from the first project in the group with a payload.
-  - Row test ids keep their form: `spec-row-<row.projectId>-<spec>` and `deferral-row-<representative id>-<deferral id>`. In the one-store-per-project e2e fixtures (`e2e/worktree-shell.spec.ts:108`) these ids do not change.
+  - Row test ids keep their form: `spec-row-<row.projectId>-<spec>` and `deferral-row-<representative id>-<deferral id>`. In the one-store-per-project e2e fixtures (`e2e/worktree-shell.spec.ts:108`) they do not change.
   - The frontend `NowModel` hand copy (`src/dashboard_frontend/src/modules/shell/types.ts:86-93`) gains `sidebar`, and `SidebarProjectRow` is copied by hand beside it.
 - **Dependencies:** C10.
 
 ## Data Models
 
-### Project-list item (`GET /api/projects/list`, illustrative — verify against the test fake)
+### Project-list item (`GET /api/projects/list`)
 ```
 { projectId: string; projectName: string; projectPath: string;
-  workflowRootPath: string;   // new: original workflow root, the store key
+  workflowRootPath: string;   // new: the store key
   instances: ProjectInstance[] }
 ```
 
-### SidebarProjectRow (in `shell-now` data as `sidebar`, illustrative — verify against the test fake)
+### SidebarProjectRow (in `shell-now` data as `sidebar`)
 ```
 { projectId: string;
   dot: 'waiting' | 'running' | 'idle';
-  liveCount: number;           // 0 or more
-  lastActivity: string | null  // ISO, newest run record `updated`
+  liveCount: number;
+  lastActivity: string | null  // ISO, newest run `updated`
 }
 ```
 The array is in sidebar order. It adds no path to the wire (NFR Security).
@@ -167,7 +167,7 @@ The array is in sidebar order. It adds no path to the wire (NFR Security).
 
 1. **Git classification fails or times out:** `linkedWorktreeInfo` returns not-linked, so the entry stays listed (NFR Reliability). A throw inside `computeFolds` keeps the entry and logs once per id.
 2. **Registry lock not acquired at start:** the cleanup logs one line and keeps every entry; the dashboard still starts and lists them.
-3. **`projects.json` lock not acquired:** the prune logs and keeps every entry; `rememberProject` throws, which `addProject` already catches and logs (`src/dashboard/project-manager.ts:246-248`) and which makes the explicit-root manual add answer 500, as a failed write does today.
+3. **`projects.json` lock not acquired:** the prune logs and keeps every entry. `rememberProject` throws, which `addProject` already catches and logs (`src/dashboard/project-manager.ts:246-248`), so the explicit-root add answers 500, as a failed write does today. `forgetProject` throws too; `removeProjectById` calls it before it unregisters (C3), so the throw precedes any registry or `projects.json` write: the DELETE answers 500 with both files whole, a retry removes it cleanly, never a registry-removed but still-remembered entry re-listed next sync.
 4. **Stat fails with anything other than `ENOENT` or `ENOTDIR`** (permission, I/O): the entry is kept and the path is logged once (R4 AC3, D11 of requirements).
 5. **Docker path translation throws:** the entry is kept (R4 AC4).
 6. **A live server's workspace was deleted:** the prune removes its entry whatever its pid (R4 AC1); its later `stop()` finds no entry (`src/core/project-registry.ts:421-425`).
@@ -176,9 +176,9 @@ The array is in sidebar order. It adds no path to the wire (NFR Security).
 ## Testing Strategy
 
 - **Unit:**
-  - `src/core/__tests__/git-utils-worktree.test.ts` (new): `linkedWorktreeInfo` on a main checkout (not linked), a `git worktree add` (linked, main tree is the checkout's realpath), a non-git directory, and with `SPEC_WORKFLOW_SHARED_ROOT` set (main tree is still the checkout).
+  - `src/core/__tests__/git-utils-worktree.test.ts` (new): `linkedWorktreeInfo` on a main checkout (not linked), a `git worktree add` (linked, main tree the checkout's realpath), a non-git directory, and with `SPEC_WORKFLOW_SHARED_ROOT` set (main tree still the checkout).
   - `src/dashboard/__tests__/project-folding.test.ts` (new): `computeFolds` with a stub `classify` — R1 AC1 fold, AC2 fallback, AC2 refused on another store, AC3 no parent, AC9 not folded, no linked parent, no `classify` call for equal paths, a throw keeps the entry.
-  - `src/dashboard/__tests__/project-manager-durable.test.ts`: new cases for fold on sync, unfold when the parent is removed, fold when the parent is added later (R1 AC5), `workflowRootPath` on `getProjectsList`, a startup prune of both files, and concurrent `syncWithRegistry` calls leaving one context per id. Changed exact values: `src/dashboard/__tests__/project-manager-durable.test.ts:87` expects 1, not 2 (the worktree now folds into its main project); `src/dashboard/__tests__/project-manager-durable.test.ts:115` expects `[]`, not the id (the deleted project is pruned at start). Both edits are required by R1 AC1 and R4 AC2.
+  - `src/dashboard/__tests__/project-manager-durable.test.ts`: new cases for fold on sync, unfold when the parent is removed, fold when the parent is added later (R1 AC5), `workflowRootPath` on `getProjectsList`, a startup prune of both files, concurrent `syncWithRegistry` calls leaving one context per id, a write burst running one debounced reconcile with the first reconcile direct (R1-2), and a `removeProjectById` whose `forgetProject` lock-miss removes nothing and rethrows (R1-3). Changed values: `src/dashboard/__tests__/project-manager-durable.test.ts:87` expects 1 not 2 (the worktree folds into its main project) and `src/dashboard/__tests__/project-manager-durable.test.ts:115` expects `[]` not the id (the deleted project is pruned at start), both required by R1 AC1 and R4 AC2.
   - `src/core/__tests__/project-registry.test.ts`: `cleanupStaleProjects(isMissing)` removes a missing-path entry with a live pid, keeps one the predicate passes, writes nothing when the lock is held, and logs. Existing values are unchanged.
   - `src/controller/__tests__/state.test.ts`: `pruneMissingProjects` drops and returns missing entries; a `rememberProject` during the prune is not lost (R4 AC8).
   - `src/dashboard/__tests__/path-missing.test.ts` (new): `ENOENT` and `ENOTDIR` are missing; an existing path is not; a translation throw is not.
@@ -186,38 +186,44 @@ The array is in sidebar order. It adds no path to the wire (NFR Security).
   - `src/__tests__/server-shutdown.test.ts`: `initialize(…, { register: false })` writes no registry entry and `stop()` writes nothing.
   - `src/evals/__tests__/runner.test.ts`: the stub step receives a server entry whose `args` include `--no-register` (R3 AC4).
   - `src/dashboard/shell/__tests__/store-groups.test.ts` and `sidebar-rows.test.ts` (new): representative rule; each dot rule; live count with and without a controller run; last activity across statuses; sort order, ties and stability. `sidebar-rows.test.ts` also reads `NowPage.tsx` as text and asserts its `CTRL_LIVE_STATUSES` literal equals `NOW_LIVE_STATUSES`.
-  - `src/dashboard/shell/__tests__/shell-feed.test.ts`: two projects on one store give one set of spec rows; `shell-now` carries `sidebar`. Message order is unchanged; an assertion that deep-equals a `shell-now` payload gains the `sidebar` key.
-- **Integration:** `src/evals/__tests__/runner-registry.test.ts` (new) runs `runCases` with a stub step that starts the configured server for real: it takes the `args` from the step's MCP config, swaps `dist/index.js` for `src/index.ts` and runs it with `tsx` (a dev dependency, used by `npm run dev`), waits for the registration log line, closes stdin, and asserts the per-worker registry and `projects.json` are byte-equal to before (R3 AC1, AC2, R7 AC2). At base the args lack the flag, the server registers the fixture, and the test fails.
-- **End-to-end:** `e2e/worktree-project-list.spec.ts` (new, worktree Playwright config, `./playwright.worktree.config.ts:46-70`). It adds a main repo, starts one worktree MCP server on the same store, and seeds a controller run record (status `running`, project the main id) as `e2e/worktree-shell.spec.ts:174` does: one sidebar row, `data-state="running"`, count 1, and Specs and Deferrals counts equal to those read before the worktree server started (R7 AC1). A second project with a seeded open wait and an older run sorts above an idle project with a newer done run, with `data-state="waiting"` (R7 AC4). It also toggles the main project off and checks the dot and position stay (R5 AC11). R7 AC3 (deleted workspace, restart) is the `project-manager-durable` start-time case above, since the Playwright dashboard cannot restart mid-suite. `npm run build`, `npx tsc --noEmit` and `npm test` close the gate (R7 AC5).
+  - `src/dashboard/shell/__tests__/shell-feed.test.ts`: two projects on one store give one set of spec rows; `shell-now` carries `sidebar`. Message order is unchanged; a deep-equal assertion on a `shell-now` payload gains the `sidebar` key.
+- **Integration:** `src/evals/__tests__/runner-registry.test.ts` (new) runs `runCases` with a stub step that starts the configured server for real: it takes the step's MCP-config `args`, swaps `dist/index.js` for `src/index.ts`, runs it with `tsx` (a dev dependency, used by `npm run dev`), and waits for whichever startup line prints — `Project registered:` at base (`src/server.ts:195`) or `Project registration skipped` after the fix (C7), a signal in both states — then ends the child's stdin and waits for exit 0 (`src/server.ts:234`), and asserts the per-worker registry and `projects.json` are byte-equal to before (R3 AC1, AC2, R7 AC2). It asserts only node-20-guaranteed fields: a stderr `data` line and the `exit` code. At base the args lack the flag, the server registers the fixture, and the test fails.
+- **End-to-end:** `e2e/worktree-project-list.spec.ts` (new, worktree Playwright config, `./playwright.worktree.config.ts:46-70`). It adds a main repo, starts one worktree MCP server on the same store, and seeds a controller run record (status `running`, project the main id) as `e2e/worktree-shell.spec.ts:174` does: one sidebar row, `data-state="running"`, count 1, and Specs and Deferrals counts equal to those read before the worktree server started (R7 AC1). A second project with a seeded open wait and an older run sorts above an idle project with a newer done run, `data-state="waiting"` (R7 AC4). It also toggles the main project off and checks the dot and position hold (R5 AC11). R7 AC3 (deleted workspace, restart) is the `project-manager-durable` start-time case above, as the Playwright dashboard cannot restart mid-suite. `npm run build`, `npx tsc --noEmit` and `npm test` close the gate (R7 AC5).
 - **Regression guards (hold at base, verified, not red-first):** R1 AC3 (`e2e/worktree-shared.spec.ts:370-414` stays green), R1 AC7 (`e2e/worktree-shared.spec.ts:748-795`), R1 AC8, R1 AC9, R1 AC10, R4 AC5 (`readRegistry` is not edited), R5 AC8 (the existing frontend style scan, `src/dashboard/__tests__/frontend-style-scan.test.ts`), R5 AC10.
-- **Why no frontend vitest test:** a 2026-10-29 probe showed vitest 4.0.16 imports a frontend module from a root test, but `tsc` 5.9.3 under the root `node16` resolution (`./tsconfig.json:4-5`) rejects its extensionless imports (TS2835 on `src/dashboard_frontend/src/modules/shell/pause.ts:1`). So C9 lives on the server and C10 to C12 are proved by Playwright.
+- **Why no frontend vitest test:** a 2026-10-29 probe showed vitest 4.0.16 imports a frontend module from a root test, but `tsc` 5.9.3 under the root `node16` resolution (`./tsconfig.json:4-5`) rejects its extensionless imports (TS2835 on `src/dashboard_frontend/src/modules/shell/pause.ts:1`). So C9 lives on the server; C10 to C12 are proved by Playwright.
 
 ## Decisions taken in this document
 
-- D1 — Where the dot, the live-run count and the sort are computed: the options were the frontend from the controller topics, or the server in the shell feed as a new field of the existing Now payload; chosen the server because root tests cannot type-check a frontend module (probe in Testing Strategy) and the feed already reads every input.
-- D2 — How the eval server stays out of the registry: the options were a no-register CLI flag, pointing the global-directory variable at a fixture directory through the step environment, or an environment field in the inline MCP config; chosen the flag because both ends are in this repository, while the others rely on Claude Code passing environment to its MCP child, which no test here can prove without a live model.
-- D3 — How folds stay current: the options were incremental add and remove per event, or one full reconcile per sync, manual add and removal; chosen the full reconcile, serialized, because a parent's arrival or removal changes other entries' folds and two concurrent passes could add one id twice.
-- D4 — Which entries can be parents: chosen only non-worktree entries (over any listed entry), so folds never chain or depend on order.
-- D5 — The store's representative project: chosen the project whose workspace is the store, else by display name then id (over registry order), so the Specs group title and the spec rows' project id are stable across restarts.
-- D6 — How the durable-list prune serializes with remember and forget: the options were a file lock, or an in-process queue; chosen the file lock on its own lock path because the per-store lock already uses this primitive and it also covers a second dashboard process.
-- D7 — Where the registry stats run: the options were inside the registry lock, or before it with a re-check under it; chosen inside because it runs once per start over a few entries.
-- D8 — How the path check joins the registry cleanup: the options were an optional predicate on the existing cleanup, now run under the lock, or a second prune method with its own write; chosen the optional predicate so start does one locked read and one write.
-- D9 — Dot colours: chosen warning for waiting, success for running and neutral for idle (over the danger or info tones), because waiting is the call to action.
-- D10 — Last sort tie-break: chosen the project id after the display name (over list order), so a push that changes nothing cannot reorder rows.
-- D11 — The live status set on the server: chosen a copy of the Now page's set plus a test that compares the two by reading the page source (over a shared module, which the separate frontend compile does not allow).
-- D12 — Classification cache: chosen none (over a per-path cache), one git call per differing entry per sync, as the requirements' performance note states.
-- D13 — Dot position: chosen after the toggle and before the name, count after the dot (over after the name), so the name keeps its truncation.
+- D1 — Dot, count and sort computed server-side in the shell feed (over the frontend from controller topics), because root tests cannot type-check a frontend module (probe in Testing Strategy) and the feed already reads every input.
+- D2 — Eval server stays out of the registry via a no-register CLI flag (over a fixture-pointed global-directory variable or an inline-config env field), because both ends live in this repo and the alternatives need Claude Code to pass env to its MCP child, unprovable without a live model.
+- D3 — Folds stay current through one full serialized reconcile per sync, manual add and removal (over incremental add/remove per event), because a parent's arrival or removal changes other entries' folds, and two concurrent passes could add one id twice.
+- D4 — Only non-worktree entries can be parents (over any listed entry), so folds never chain or depend on order.
+- D5 — The store's representative is the project whose workspace is the store, else by display name then id (over registry order), so the Specs title and spec-row id are stable across restarts.
+- D6 — The durable-list prune serializes with remember and forget via a file lock on its own lock path (over an in-process queue), because the per-store lock already uses this primitive, which also covers a second dashboard process.
+- D7 — Registry stats run inside the registry lock (over before it with a re-check under it): it runs once per start over a few entries.
+- D8 — The path check joins the registry cleanup as an optional predicate under the lock (over a second prune method with its own write), so start does one locked read and one write.
+- D9 — Dot colours: warning for waiting, success for running, neutral for idle (over the danger or info tones), because waiting is the call to action.
+- D10 — Last-sort tie-break is project id after display name (over list order), so a no-op push cannot reorder rows.
+- D11 — The server's live-status set copies the Now page's, plus a test comparing the two by reading the page source (over a shared module, which the separate frontend compile forbids).
+- D12 — Classification cost: no per-path cache (one git call per differing entry per sync, per the requirements' performance note), plus a 100 ms trailing debounce on the watcher so a write burst runs one reconcile. The synchronous `gitCapture` blocks the reconcile up to 5000 ms per differing candidate; the debounce bounds a burst to one such pass.
+- D13 — Dot position after the toggle and before the name, count after the dot (over after the name), so the name keeps its truncation.
 
 ## Scope notes
 
-- Kept: items 1 to 6 and every file the decomposition names: the registry (`registerProject` unchanged, cleanup in C4), the project manager (C3), `projects.json` (C5), the eval path (C7; `src/evals/fixture.ts` is unchanged because the registration comes from the server the runner starts), the sidebar (C11) and the Specs and Deferrals counts (C8, C11, C12).
+- Kept: items 1 to 6 and every file the decomposition names — the registry (C4), project manager (C3), `projects.json` (C5), the eval path (C7; `src/evals/fixture.ts` unchanged, registration comes from the runner's server), the sidebar (C11) and the Specs and Deferrals counts (C8, C11, C12).
 - Cut, as the requirements record: one row per product, better display names, a persistent Hide, nested worktrees, a Remove action.
 - Deferred, as the requirements record: pruning while the dashboard runs; showing a folded worktree's server instances on its parent row.
-- Not changed: the Now page's own rows for two projects that share a store; only the dot must agree with them.
-- Not changed: a project whose workflow root moves during a sync keeps its old watchers (`src/dashboard/project-manager.ts:146-154`), existing behaviour outside this spec.
+- Not changed: the Now page's own rows for two projects sharing a store (only the dot must agree with them); a project whose workflow root moves during a sync keeps its old watchers (`src/dashboard/project-manager.ts:146-154`), outside this spec.
 - Carried items from requirements: none.
 
 ## Revision History
 
+- **v2** (2026-10-29) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/3/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Integration test now waits for whichever startup line prints (registered at base, skip after the fix — a signal in both states), ends stdin and waits for exit 0, and names the node-20 fields it asserts on. Testing Strategy Integration now reads "waits for whichever startup line the run prints".
+  - **R1-2 — Accepted (SHOULD_FIX).** Watcher reconcile now coalesces writes through a 100 ms trailing debounce, first reconcile still called directly to keep the initialize order; D12 states the synchronous call is bounded at 5000 ms per differing candidate and coalesced to one pass per burst. C3 serialized bullet and D12 changed.
+  - **R1-3 — Accepted (SHOULD_FIX).** removeProjectById now forgets before it unregisters, so a lock-miss throw leaves both files whole and the DELETE answers 500 for a clean retry, never a registry-removed but still-remembered entry. C3 removeProjectById bullet and Error Handling item 3 changed.
+  - **R1-4 — Accepted (MINOR).** C1 Reuses now says it issues the common-dir command once and applies the worktree test and parent logic inline, not by calling the two helpers that each issue their own call.
+  - **R1-5 — Accepted (MINOR).** Dropped the "illustrative — verify against the test fake" hedge from both Data Models shapes; the enumerated fields are the pinned contract.
+  - **Lint pass.** 1 fixed: L-1 (trimmed the body from 4140 to 3996 words, cap 4000; no citation moved off its phrase or dropped from an accepted AC). Rejected, all citation-identifier re-fires suppressed per rule 11 (token unchanged since v1's reasoned rejection; citations re-verified against the tree where v2 changed the surrounding text — L-8,12,31,32,33,34,35,40,41,42,43,44,45 all resolve to real lines): L-2,3,4,5,11,12,14,15,19,22,24,26,29,30,36,37 (symbol this design defines, not a cited-code claim); L-6,7,8,9,10,18,20,21,23,25,27,28,31,32,33,34,35,38,39,40 (citation anchors the behaviour it names, not the reused subject's declaration); L-13,16,17,41,42,43,44,45,46 (keyword/literal/tool name, not a citable symbol).
 - **v1** (2026-10-29) — Initial draft.
   - **Lint pass.** 5 fixed: L-3,15,16 gave each listed existing function its own range; L-38,41 prefixed the root config files with `./`. Rejected: L-1,2,4,5,10,11,13,14,20,25,26,27,30,31,35,36 (identifier this design defines, not a cited-code claim); L-6,7,8,9,19,21,22,23,24,28,29,32,33,34 (citation anchors the behaviour it names, not the reused subject's declaration); L-12,17,18,37,39,40 (keyword/literal/tool name, not a citable symbol).

````
