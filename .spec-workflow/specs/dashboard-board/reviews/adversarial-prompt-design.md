# Adversarial Review — dashboard-board/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-board
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-board design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-board` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-board` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-board/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-board`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since ea2f45fe

````diff
diff --git a/.spec-workflow/specs/dashboard-board/design.md b/.spec-workflow/specs/dashboard-board/design.md
index 185584fc..c6c84b44 100644
--- a/.spec-workflow/specs/dashboard-board/design.md
+++ b/.spec-workflow/specs/dashboard-board/design.md
@@ -39,8 +39,8 @@ graph TD
 ### C1 — Run record and step spawn (R12 AC 2, 3)
 - **Purpose:** Hold the step's wall-clock start and task id for the step's lifetime.
 - **Interfaces:** `InFlightStep` (`src/controller/state.ts:39-46`) gains optional `startedAt?: string` and `task?: string`. `stepLifecycle`'s `onStepSpawn` (`src/controller/runs.ts:449-465`) takes `{ id, pid, startTime, task? }` and writes `startedAt` from `deps.now().toISOString()`.
-- **Post-conditions:** Both fields live inside `inFlight`, so `onStepEnd` and every `inFlight: undefined` write clear them with no new clear site. A record that predates them yields no start time.
-- **Task route:** `ImplementationPhaseContext.onStepSpawn` (`src/controller/phases/implementation.ts:95`) gains `task?: string`, and `runModelStep` passes `opts.task` (`src/controller/phases/implementation.ts:469`; `opts.task` already exists at `:446`, and every task step sets it). The other phases do not change: a callback that accepts an optional field still fits their narrower type.
+- **Post-conditions:** Both fields live inside `inFlight`, so `onStepEnd` and every `inFlight: undefined` write clear them with no new clear site.
+- **Task route:** `ImplementationPhaseContext.onStepSpawn` (`src/controller/phases/implementation.ts:95`) gains `task?: string`, and `runModelStep` passes `opts.task` (`src/controller/phases/implementation.ts:444-469`; `opts.task` already exists at `:446`, and every task step sets it). The other phases do not change: a callback that accepts an optional field still fits their narrower type.
 
 ### C2 — Branch presence (R12 AC 1, NFR Performance, NFR Reliability)
 - **Purpose:** Answer "does this run's branch exist" at most once per stopped run per 60 s.
@@ -48,20 +48,20 @@ graph TD
   - `branchPresent(run: Pick<RunRecord, 'id'|'branch'|'codeRoot'>, read?: BranchRead, now?: () => number): Promise<boolean>`
   - `forgetBranchPresence(runId: string): void`
   - `type BranchRead = (codeRoot: string, branch: string) => Promise<boolean>`
-- **Post-conditions:** The cache maps run id to `{ at, value: Promise<boolean> }`, so two overlapping flushes share one read. An empty branch gives `false` with no read. A rejected read gives `false`. An entry older than 60,000 ms is re-read. `read` and `now` are optional trailing parameters for tests.
+- **Post-conditions:** The cache maps run id to `{ at, value: Promise<boolean> }`, so two overlapping flushes share one read. An empty branch gives `false` with no read. A rejected read gives `false`. An entry older than 60,000 ms is re-read.
 - **Dependencies:** `branchExists` (`src/dashboard/harness/worktree.ts:119-128`), exported as is; it runs `git rev-parse --verify --quiet` with `scrubbedGitEnv()`.
 
 ### C3 — Wire row (R12 AC 1, 4; R7 AC 6, 7)
 - **Purpose:** Carry every tile field with no path.
 - **Interfaces:** `ControllerRunRow` (`src/controller/runs.ts:1428-1451`) and both hand copies (`src/dashboard/shell/types.ts:195`, `src/dashboard_frontend/src/modules/shell/types.ts:215-239`) gain the fields in Data Models. `listRunsForWire(driven, branchRead?)` (`src/controller/runs.ts:1468-1471`) takes the read as an optional trailing parameter, resolves presence for stopped runs first, then maps `toRow`.
 - **Post-conditions:** `branchPresent` is the C2 read for `done`, `abandoned` and `error`; a moving run reports `run.branch !== ''` with no read. `discardAllowed` is `!branchHeld(run, allRuns)`. `driven`, `lastActivity`, `prReads`, `holdBy` and `stepKind` keep their base values.
-- **`branchHeld(run, runs)`:** New export of `runs.ts`. True when another run has a moving status and the same `codeRoot`, and either the same non-empty `branch` or an empty branch with the same `spec`. The second clause covers a queued relaunch: `enqueue` writes `branch: ''` (`src/controller/controller.ts:256-261`) and the drive fills it in later (`src/controller/runs.ts:840-842`).
+- **`branchHeld(run, runs)`:** New export of `runs.ts`. True when another run has a moving status and the same `codeRoot`, and either the same non-empty `branch` or an empty branch with the same `spec`. The second clause covers a queued relaunch: `enqueue` writes `branch: ''` (`src/controller/controller.ts:231-261`) and the drive fills it in later (`src/controller/runs.ts:840-842`).
 - **Moving statuses:** `isLive` (`src/controller/controller.ts:788-791`) already names R3 AC 7's list. It moves to `state.ts` as an export and `controller.ts` imports it.
 
 ### C4 — Discard (R7 AC 7, 8)
 - **Interfaces:** `Controller.discard(runId)` (`src/controller/controller.ts:373-378`) returns `RunRecord | undefined | 'branch-in-use'`. The discard route (`src/dashboard/multi-server.ts:859-864`) answers 409 `{ error: 'branch-in-use' }` on the sentinel.
 - **Post-conditions:**
-  - The run read, the `branchHeld` check and the discard all run inside `withStoreLock(run.specStore, …)`, the lock `enqueue` holds (`src/controller/controller.ts:245`).
+  - The run read, the `branchHeld` check and the discard all run inside `withStoreLock(run.specStore, …)`, the lock `enqueue` holds (`src/controller/controller.ts:231-245`).
   - On `branch-in-use` nothing changes: no `cancelled` entry, no queue edit, no write.
   - `discardRun` (`src/controller/runs.ts:1400-1422`) skips `cancelRun` when the run is `done`, so status stays `done`.
   - After the git and `gh` cleanup, `discardRun` calls `forgetBranchPresence(runId)`, then emits `runEvents` `change`. `cancelRun` emits before the cleanup and a `done` discard writes nothing, so the tile would otherwise wait out the 60 s cache.
@@ -72,20 +72,20 @@ graph TD
 
 ### C6 — Feed, hub and server removal (R2 AC 2, 3)
 - **`src/dashboard/shell/shell-feed.ts:92-161`:** `flush` sends `shell-specs`, `controller-waits`, `controller-runs`, `controller-actions`, `controller-deploy`. `buildNowModel`, `buildSidebarRows` and `listActivityForWire` drop out. `liveRunsByProject` stays for spec rows.
-- **`src/dashboard/harness/hub.ts`:** Delete `projectWatches`, `sendHarness`, `snapshotFor`, `watchedProjects`, the watch loops at `:78-93`, and the `activityEvents` listener (`:53`, `:149`). `setRunHeartbeat` already emits `runEvents` `change` (`src/controller/runs.ts:441-446`), so tile heartbeats still push. `OverviewWatch` stays: it is the feed's file trigger (`:103-106`).
-- **`src/dashboard/multi-server.ts`:** Delete the `harness-subscribe` and `harness-unsubscribe` branches (`:353-366`), `sendToHarness` (`:938-952`), the hub's first callback (`:172`), the log route (`:866-875`), the summary route (`:593-617`) and the imports only they use. `views` narrows to `Set<'overview'>`. `sendToProjectOrOverview` keeps `connection.projectId`, which the socket URL sets (`:318-320`).
+- **`src/dashboard/harness/hub.ts`:** Delete `projectWatches`, `sendHarness`, `snapshotFor`, `watchedProjects` (`:119-132`), the watch loops at `:78-93`, and the `activityEvents` listener (`:53`, `:149`). `setRunHeartbeat` already emits `runEvents` `change` (`src/controller/runs.ts:441-446`), so tile heartbeats still push. `OverviewWatch` stays: it is the feed's file trigger (`src/dashboard/harness/hub.ts:103-106`).
+- **`src/dashboard/multi-server.ts`:** Delete the `harness-subscribe` and `harness-unsubscribe` branches (`:353-366`), `sendToHarness` (`:938-952`), the hub's first callback (`:172`), the log route (`:866-875`), the summary route (`:593-617`) and the imports only they use. `views` narrows to `Set<'overview'>`. `sendToProjectOrOverview` (`:959`) keeps `connection.projectId`, which the socket URL sets (`:318-320`).
 - **`src/dashboard/harness/project-watch.ts`:** Keep `parseHandoffRouting` (`:28`) at its path. Delete `ProjectHarnessWatch` (`:118`) and `parseGateSections` (`:63`), whose only other reader is the deleted `waits.ts`.
 - **Deleted with their tests:** `src/dashboard/shell/now-model.ts`, `sidebar-rows.ts`, `waits.ts`, `run-detail.ts`.
 - **`src/controller/runs.ts`:** Delete `readRunLogTail` and its only helper `safeMtime` (`:1487-1536`).
 - **Types:** Delete `Wait` through `NowModel`, `RunDetail`, `ControllerActivity` and the matching message arms from `src/dashboard/shell/types.ts` and `src/dashboard_frontend/src/modules/shell/types.ts`; `harness-model`, `harness-gates`, `harness-run-detail` and the `harness-*` view messages from both `harness/types.ts`. Keep what `SpecDetail` reads (`PhaseRow`).
 
 ### C7 — Shell frame (R1, R2 AC 1)
-- **`modules/app/App.tsx`:** `Shell` renders `TopBar` then `main`; the two `/runs` routes go and `/` renders `HomePage`. The catch-all (`:31`) stays and serves R2 AC 1.
+- **`src/dashboard_frontend/src/modules/app/App.tsx`:** `Shell` renders `TopBar` then `main`; the two `/runs` routes go and `/` renders `HomePage`. The catch-all (`:31`) stays and serves R2 AC 1.
 - **`TopBar.tsx` (new):** No props. One `header` with `flex flex-wrap items-center`, in order: `NavLink`s Home, Specs, Usage, Deferrals (`ui.navRow`, no counts, test ids `nav-home`, `nav-specs`, `nav-usage`, `nav-deferrals`), `DeployControl` with no props inside a `min-w-0 max-w-full` wrapper, `OpenAdvisor`, `Gear` with `ml-auto`.
 - **`OpenAdvisor.tsx` (new):** The logic of `src/dashboard_frontend/src/modules/shell/NowPage.tsx:105-139`, keeping test id `open-advisor`. The result line drops `truncate` and takes `whitespace-normal break-words`; the root drops `mb-3`.
-- **`Gear.tsx`:** The panel opens with `absolute right-0 top-full mt-2` (replaces `:64`). Lines `:75-99` go. The panel adds one switch per listed project, sorted by `projectName`, using the markup of `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:137-152` without the dot and live count, keeping test id `project-toggle-` plus the id.
-- **`ShellProvider.tsx`:** Delete `Density`, `DENSITY_KEY`, `readDensity`, `density`, `setDensity`, the `--row-h` effect (`:153-156`), `now`, `controllerActivity`, and `connected`, which only the sidebar read. `--row-h` then keeps its token default (`src/dashboard_frontend/src/modules/theme/tokens.css:54`).
-- **`modules/ws/WebSocketProvider.tsx`:** `WatchView` becomes `{ kind: 'overview' }`; `viewKey`, `subscribeMessage` and `unsubscribeMessage` lose the harness branch (`:37-51`).
+- **`src/dashboard_frontend/src/modules/shell/Gear.tsx`:** The panel opens with `absolute right-0 top-full mt-2` (replaces `:64`). Lines `:75-99` go. The panel adds one switch per listed project, sorted by `projectName`, using the markup of `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:137-152` without the dot and live count, keeping test id `project-toggle-` plus the id.
+- **`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx`:** Delete `Density`, `DENSITY_KEY`, `readDensity`, `density`, `setDensity`, the `--row-h` effect (`:153-156`), and `now`, `controllerActivity`, `connected` (`:7-63`), which only the sidebar read. `--row-h` then keeps its token default (`src/dashboard_frontend/src/modules/theme/tokens.css:54`).
+- **`src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx`:** `WatchView` becomes `{ kind: 'overview' }`; `viewKey`, `subscribeMessage` and `unsubscribeMessage` lose the harness branch (`:37-51`).
 - **Unchanged:** `PageLayout.tsx` (Specs and Deferrals keep their panels), `primitives.tsx`, `harness.tsx` (`tiles.tsx` and `useStages.ts` read it), `DeployControl.tsx`, `ConnectionBanner.tsx`.
 - **Deleted:** `NowPage.tsx`, `RunsPage.tsx`, `RunPage.tsx`, `Sidebar.tsx`. `AnswerSheet` and its helpers move out of `NowPage.tsx` first (C10).
 
@@ -95,7 +95,7 @@ graph TD
   - `toggled(id, name, off, on): { off: string[]; on: string[] }`
   - `DEFAULT_OFF_NAMES = ['sdd-fixture']`
 - **Post-conditions:** An id in `on` is enabled, else an id in `off` is disabled, else the project is enabled unless its name is in `DEFAULT_OFF_NAMES`. `toggled` flips the current value by moving the id into the other list.
-- **`ProjectProvider.tsx`:** `shell.projects` keeps its meaning (`:28-39`); a second key `shell.projects.on` holds explicit-on ids. `enabled(id)` and `toggle(id)` keep their signatures and look the name up in `projects`; an id not yet listed is enabled, as at base (`:74-77`). Every existing caller follows with no change.
+- **`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx`:** `shell.projects` keeps its meaning (`:28-39`); a second key `shell.projects.on` holds explicit-on ids. `enabled(id)` and `toggle(id)` keep their signatures and look the name up in `projects`; an id not yet listed is enabled, as at base (`:74-77`). Every existing caller follows with no change.
 - Home renders no tile while `useProjects().loading` is true, so the fixture does not flash on first load.
 
 ### C9 — Board model (R3, R4 AC 1-3, R5 AC 1-3, R6, R7 AC 1-4, 6, R8 AC 2-4, R10)
@@ -120,7 +120,7 @@ graph TD
 | `tabTitle(waits, enabled, now, base)` | R10. |
 
 - **`runControls`:** `resume = isOperatorHeld(run) || (status === 'paused' && holdBy !== 'deploy')`; `pause = moving && !resume`; `stop = moving`; `discard = stopped && discardAllowed`; `redrive = isStalled`. A deploy-held run keeps Pause, because pause moves the hold to the operator (`src/controller/controller.ts:292-297`).
-- **`pause.ts` (R6 AC 6):** The two strings at `:43` and `:45` become `pausing after this step`. Nothing else in the file changes.
+- **`src/dashboard_frontend/src/modules/shell/pause.ts` (R6 AC 6):** The two strings at `:43` and `:45` become `pausing after this step`. Nothing else in the file changes.
 
 ### C10 — Home and tiles (R3 AC 1-5, R4 AC 2, 4, 5, R5, R6, R7 AC 5, R8 AC 1, 6, R11 AC 3)
 - **`HomePage.tsx` (new):** Owns a one-second tick, `useStages`, `useNextViews` and `openWaitId`.
@@ -170,9 +170,9 @@ function advance(stage: Stage, seen: Observed, now: number): Stage | null;
 - **Retained tiles:** Home keeps the last item per tile key. A key absent from its band stays rendered from that snapshot, with controls hidden, while its stage is `pressed`, `running` or `done`. An action tile also stays while `failed`, since no later press can reach it; R5 AC 2 has it stay until the outcome shows. A run or Next tile that leaves clears a `failed` stage. Leaving Home drops stage state, as a reload does.
 
 ### C12 — Look (R11, R1 AC 5)
-- **`tokens.css`:** Inside `@theme static`, add `--text-display: 32px` with `--text-display--line-height: 40px`, `--text-tile: 15px` with `--text-tile--line-height: 22px`, `--tile-pad: 20px`, `--tile-gap: 16px`, `--band-gap: 32px`. Delete `--sidebar-w` and `--row-h-compact` (`:53`, `:56`). `--panel-w` stays for `src/dashboard_frontend/src/modules/shell/PageLayout.tsx:22`. Lines `:9-17` and `:61-160` do not change.
+- **`src/dashboard_frontend/src/modules/theme/tokens.css`:** Inside `@theme static`, add `--text-display: 32px` with `--text-display--line-height: 40px`, `--text-tile: 15px` with `--text-tile--line-height: 22px`, `--tile-pad: 20px`, `--tile-gap: 16px`, `--band-gap: 32px`. Delete `--sidebar-w` and `--row-h-compact` (`:56`, `:53`). Lines `:9-17` and `:61-160` do not change. `--panel-w` stays for `src/dashboard_frontend/src/modules/shell/PageLayout.tsx:22`.
 - **Probe:** tailwindcss 4.1.18 `compile()` (2026-11-06), with `--text-*` reset as here, produced `text-display`, `text-tile`, `p-(--tile-pad)`, `gap-(--tile-gap)`, and `lg:grid-cols-2` under `width >= 64rem`: 1024 px at the default root size, which `src/dashboard_frontend/src/modules/theme/tailwind.css` leaves alone.
-- **`ui.tsx`:** Add `tile(tone)` to the `ui` constants (`:132-157`) for `neutral`, `warning` and `danger`.
+- **`src/dashboard_frontend/src/modules/ui/ui.tsx`:** Add `tile(tone)` to the `ui` constants (`:132-157`) for `neutral`, `warning` and `danger`.
 - **390 px:** `TopBar` wraps; tiles carry `min-w-0`; long text takes `break-words`.
 
 ## Data Models
@@ -218,7 +218,7 @@ Tests load frontend modules at runtime, as `src/dashboard/shell/__tests__/deploy
   - `src/dashboard/harness/__tests__/project-watch.test.ts` keeps only `parseHandoffRouting`.
 - **Unit, frontend pure:** `src/dashboard/shell/__tests__/board-view.test.ts` (new) covers `board.ts`, `stage.ts`, `enable.ts` and the two `pause.ts` strings: every sort, each tone and dot threshold, `runControls` per status, `mergeRead`'s outcomes, each `resolved` row, `advance`'s 5 s and 30 s, title formats.
 - **Tokens:** `src/dashboard/__tests__/frontend-tokens.test.ts:126-127` matches the new list. `src/dashboard/__tests__/frontend-style-scan.test.ts:338` uses `--sidebar-w` as its declared-token sample and moves to `--panel-w`.
-- **End-to-end:** New `e2e/worktree-board.spec.ts`, matched by `WORKTREE_SPEC_PATTERN`, seeds `run.json`, wait and action records as `e2e/worktree-deploy.spec.ts:49-52` does, and runs entry scenarios 1, 3, 4, 5, 6, 7 and 8, plus scenario 2's "Stalled" and Re-drive press. Mutating fetches rely on the dev proxy's Origin rewrite (`src/dashboard_frontend/vite.config.ts:28-36`). Scenario 2's "green within 15 s" needs a real step, so the end-to-end gate proves it on a fixture run.
+- **End-to-end:** New `e2e/worktree-board.spec.ts`, matched by `WORKTREE_SPEC_PATTERN` (`playwright.worktree-pattern.ts:21`), seeds `run.json`, wait and action records as `e2e/worktree-deploy.spec.ts:49-52` does, and runs entry scenarios 1, 3, 4, 5, 6, 7 and 8, plus scenario 2's "Stalled" and Re-drive press. Mutating fetches rely on the dev proxy's Origin rewrite (`src/dashboard_frontend/vite.config.ts:28-36`). Scenario 2's "green within 15 s" needs a real step, so the end-to-end gate proves it on a fixture run.
 - **Rewrites (R2 AC 5):** `e2e/worktree-shell.spec.ts` (includes the "pause requested" asserts at `:446`, `:468`, `:553`), `e2e/worktree-project-list.spec.ts`, `e2e/worktree-no-shared.spec.ts`, `e2e/worktree-deploy.spec.ts`, `e2e/worktree-visual.spec.ts`, and the nav reads in `e2e/helpers/shell-seed.ts` and `e2e/helpers/worktree-harness.ts`.
 - **Docs:** `docs/SDD-HARNESS.md:99-100`, `:120` and `:469` name Home.
 
@@ -259,3 +259,4 @@ Numbers continue from the requirements document.
 ## Revision History
 
 - **v1** (2026-11-06) — Initial draft.
+  - **Lint pass.** 29 fixed; rejected: L-1,L-2,L-5,L-7,L-8,L-28,L-29,L-32–L-47,L-52 (each names a new or cross-file identifier, not the cited range).

````
