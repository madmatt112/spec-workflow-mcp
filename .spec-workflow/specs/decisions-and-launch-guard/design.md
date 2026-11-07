# Design Document

## Overview

This design builds eleven operator fixes across the dashboard shell, the controller driver, and the close-out, implementation and document phases. Each fix extends an existing seam: the durable project list, the setup route, the plan parsers, the fix-round loop, the review loop and the run-record write chain. The launch route, the gate rules and `runControls` do not change.

## Steering Document Alignment

### Technical Standards (tech.md)
N/A: `.spec-workflow/steering/` is empty; `.spec-workflow/agent-rules.md` governs checks and layout.

### Project Structure (structure.md)
N/A for the same reason; new code sits beside its callers, tests in the adjacent `__tests__/` (`.spec-workflow/agent-rules.md:15-16`).

### Design System (design-system.md) — if applicable
N/A: no design-system.md exists. The UI reuses `ui.tile`, `Button`, `Tile` and the `--text-*` tokens.

## Architecture

Display names live in one durable field and reach every page through the project context `syncOnce` already fills. The guard runs in the setup route, so `launchSpec` and `enqueue` never see it. Cancel gets one source of truth, `abandoned` on disk, written before the step is signalled and enforced at three choke points: `writeRunLocked`, `runStep` and `createWait`.

## Components and Interfaces

### C1 — Display names (Requirement 1)
- **Purpose:** One operator-set name that survives re-registration, restart and a missing registry entry.
- **Where it is set:** the gear. Each project row gets `project-rename-<id>`, an input `project-name-input-<id>` and `project-name-save-<id>`. An empty value clears the name.
- **Interfaces:**
  - `KnownProject.displayName?: string` (`src/controller/state.ts:256-266`).
  - `shownName(p: Pick<KnownProject, 'name' | 'displayName'>): string` in `src/controller/state.ts`.
  - `setProjectDisplayName(id: string, displayName: string | null): Promise<boolean>` in the same file, under `withProjectsLock`; `false` when no row has that id.
  - `ProjectManager.setDisplayName(projectId, displayName): Promise<boolean>`: that call, then `syncWithRegistry()`.
  - `POST /api/projects/:projectId/display-name`, body `{ displayName: string | null }`; answers in Data Models.
- **Post-conditions:**
  - `rememberProject` keeps an existing row's `displayName` (`src/controller/state.ts:619-628`), for both callers (`src/dashboard/project-manager.ts:233`, `:355`).
  - `syncOnce` maps id to `displayName` from `remembered` (`src/dashboard/project-manager.ts:115`) and applies it where it sets `existing.projectName` (`:145`) and creates a context (`:152`, `:216`).
  - `addProject` still remembers the generated name as `name` (`src/dashboard/project-manager.ts:233-236`), because `src/advisor/summary.ts:111-112` matches `name` against operator config.
  - `src/core/project-registry.ts` does not change: `generateProjectDisplayName` and `projectName` stay the fallback, so re-registration (`src/core/project-registry.ts:376`) cannot touch a display name. The registry cannot hold it (D1).
  - `src/advisor/push.ts:92` returns `shownName(p)`.
  - `ActionTile` takes `projectName: (id: string) => string`, and `actionTarget` prints that for `t.project` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280`).
  - Specs, Usage and Deferrals need no edit: they read the context (`src/dashboard/shell/spec-rows.ts:83`, `src/dashboard/shell/usage-rows.ts:37`) or `/api/projects/list`.
- **Deploy step (AC 8):** after the deploy, the operator names the project at `/home/mcf/repo/tradr` `tradr app` and the one at `/home/mcf/repo/tradr-hosted` `tradr infra`. This is data in `projects.json`, recorded as a `verification-evidence.md` line.

### C2 — Launch guard (Requirement 2)
- **Purpose:** Compare a spec's files with each store project's code root and tell the tile.
- **Interfaces:**
  - New `src/dashboard/harness/launch-guard.ts`: `evaluateLaunchGuard(spec: string, project: GuardProject, storeProjects: GuardProject[]): LaunchGuard` and `specFileList(workflowRoot: string, spec: string): { source: LaunchGuard['source']; paths: string[] }`.
  - `decompositionEntry(workflowRoot: string, spec: string): string | null` in `src/dashboard/harness/run-setup.ts`: uses `DECOMPOSITION_HEADING` (`:23`), returns the entry up to the next `### ` line.
  - `SetupView.guard?: LaunchGuard` in `src/dashboard/harness/types.ts:31-41` and its copy `src/dashboard_frontend/src/modules/harness/types.ts:58`.
- **Route:** `GET .../harness/setup` (`src/dashboard/multi-server.ts:620-632`) sets `view.guard` after `launchBlock`, only while `view.launchable` is set. `storeProjects` is `getAllProjects()` filtered on `projectPath === project.projectPath`. A `try/catch` leaves `guard` unset on failure (AC 9). `buildSetupView` does not change, so `launchSpec` does not (AC 10).
- **File list, by source (AC 7):**
  1. When `tasks.md` exists: the union of `task.files` (`src/core/task-parser.ts:332-345`), source `tasks`. The decomposition is read only when `tasks.md` is absent, so an existing `tasks.md` with no `File:` entries gives `no-list`.
  2. Otherwise the decomposition entry: backticked tokens holding a `/`, with a trailing `:<line>` or `:<start>-<end>` removed. A bare name such as `tiles.tsx` names no location and is dropped. Source `decomposition`.
  3. Otherwise source `none`, state `no-list`.
- **Filters on both sources (NFR Security):** drop a path that is absolute, holds a `..` segment, starts with `~`, holds whitespace, `*` or `<`, or starts with `.spec-workflow/` (a store path says nothing about a code root). If nothing survives, the state is `no-list`.
- **Compare rule (AC 3, 6, 8):**
  - A project holds a path when `existsSync(join(p.workspacePath, path))`. No git call, no model call.
  - A path no store project holds is new or stale and is dropped; the rest are `compared`.
  - State `warn` when another store project holds strictly more compared paths than this one, else `clear`. `useProject` holds the most; ties break on `projectName`.
  - A path under two roots counts for both, so a shared `package.json` cannot hide a wrong tile.
  - With `compared` at 0, the state is `clear` and no project is named.
- **Next tiles (AC 2):** `nextProjects` (`src/dashboard_frontend/src/modules/shell/board.ts:61-76`) becomes `projects.filter((p) => enabled(p.projectId))`. `nextTiles` keeps its sort.
- **`NextTile` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:245-273`):**
  - New props `codeRoot: string` and `useProject?: { name: string; codeRoot: string }`, which `HomePage` resolves from `projects` (`src/dashboard/project-manager.ts:302`), so no path enters `SetupView`. The root renders in `next-code-root-<id>`.
  - On `warn`: tone `warning`; `next-guard-<id>` reads ``${held} of ${compared} spec files are under ${codeRoot}. Use ${name} (${root}).``
  - On `no-list`: `next-guard-<id>` reads `No file list to compare`; one press.
  - **Two press (AC 4):** local `armedSpec: string | null`. On `warn`, a press with `armedSpec !== view.launchable` only sets it; the armed press calls `onLaunch`, so the body stays `buildLaunchInput(view)`. The armed button is `danger`, reading `Launch anyway`. Keying on the spec clears the arm when the spec changes.

### C3 — Close-out decisions (Requirement 3)
- **Purpose:** Act on `## Decisions` answers and read `Target document:`.
- **Interfaces, in `src/tools/harness.ts`:**
  - `parsePlanDecisions(content: string): Map<string, string>`: reads `- <id>: <question> → <answer>` lines inside `## Decisions`, split at the last ` → `. Empty or `no answer` gives no entry. A probe of every `retrospective-plan.md` in the swm and tradr-hosted stores found no line with two arrows.
  - `itemTarget(block: string): string`: the value of `Target:` or `Target document:`. `classifyTarget` (`src/tools/harness.ts:541-542`) and Step 1 (`src/controller/phases/closeout.ts:368`) call it.
  - `answerChoosesNoChange(answer: string): boolean`: removes a leading `Option <x>:`, then matches case-insensitively. Illustrative, verify against the test table: `^(no[ -]change|no[ -]action|do nothing|leave (it|as is|alone|unchanged|deferred)|keep as is)\b`, or the whole answer being `no`, `none`, `skip` or `n/a`.
- **The match is narrow on purpose (AC 5):** `keep the design-defect stop but trigger it on the first verdict` and `drop the two moved paths` are real answers that change code.
- **Flow in `runCloseoutPhase`:**
  - `openItems` (`src/controller/phases/closeout.ts:262-266`) adds `answer`.
  - New step before Step 1: an open item of any class whose answer chooses no change gets `skipped — <answer>`.
  - Step 1 (`src/controller/phases/closeout.ts:362-375`): a class `none` item with an answer gets `to-do (human) — recorded decision: <answer>; its target gives no landing class, so no batch can build it`, and joins `todos` (AC 4). With no answer, Step 1 stays as at base (AC 8).
  - `withAnswer(it)` returns `Recorded decision: <answer>`, a newline and the block. `itemsText` (`src/controller/phases/closeout.ts:404`), the verifier text (`:490`) and `findingsText` (`:526`) use it (AC 3). `itemPaths` keeps the raw block.
  - The final line (`src/controller/phases/closeout.ts:633`): an answered item that did not land writes `to-do (human) — <reason>` and joins `todos`. The reverts (`:585-625`) do not change (AC 6).
- **Reference plan:** P6 goes to the harness batch with its answer. P11 (`project deferral queue`) has no class and becomes a to-do. G1 and G2 read `Target document:`, class `store` and go to a batch.

### C4 — File-list patch (Requirement 4)
- **Purpose:** Turn a genuine `REQUIRED:` report into a `tasks.md` edit and a fresh gate.
- **Interfaces:**
  - `addTaskFiles(content: string, taskId: string, files: string[]): string | undefined` in `src/core/task-parser.ts`: inserts one `File:` line per file after the task's last `File:`/`Files:` line at its indent, or after the checkbox line when it has none, and changes no other line. Returns `undefined` for an unknown task, or a path holding a comma, parenthesis or whitespace, which the parser would split (`src/core/task-parser.ts:338-343`).
  - `fileListPatch(reasons: string[], flag: string): string[] | undefined` in `src/controller/phases/implementation.ts`: `undefined` unless every reason starts with `file-outside-list:` and every flag file is among them. Flag files are the text before the first ` — `, split on commas.
  - `routeImplementerFlags(task, report, text, gateReasons?: string[])`: optional trailing parameter. `src/controller/phases/implementation.ts:912` passes `gate.reasons` only when `variant === 'gate'`; the first-pass call (`:754`) passes nothing.
  - `RunLedger.filePatch(fields: { task: string; round: string | number; file: string; reason: string })` (`src/controller/ledger.ts:53-73`). `src/watch/ledger.ts:420-428` gets a render arm, because an unknown type renders empty there.
- **Flow,** at the `REQUIRED` branch (`src/controller/phases/implementation.ts:929-936`), after the `DESIGN-DEFECT` check: with `gateReasons` set and `fileListPatch` defined, write `tasks.md`, re-parse to confirm every file is listed, call `commitSpecStore` with `docs(sdd): <spec> task <id> file-list patch`, write the row, append to `task.files`, and return `undefined`. The loop reaches its top and `:805-807` gates the same commit with the new list.
- **Rounds and risk:** the round was counted at `src/controller/phases/implementation.ts:880` and the cap at `:881` still applies (AC 6). A high-risk pass reaches the verifier at `:860` (AC 5). A round with no flag keeps P8 (`:834-835`) (AC 7).
- **Failure (NFR Reliability):** restore the prior text, write a `note`, take the base `design-defect` stop.
- **Text (AC 9):** `src/tools/brief-templates.ts:803-804` and `harness/agents/sdd-implementer.md:31` say a `REQUIRED` report adds the file and the gate reruns with no wait, and keep the self-exemption ban. The prefix stays, so `harness/evals/implementer-file-outside-list-classify/case.json:29` holds. `src/core/gate-rules.ts:520-530` does not change.

### C5 — Doc review cap (Requirement 5)
- **Purpose:** End review after round 1 when only drafting defects remain.
- **How a reviewer labels a finding:** the finding string starts `[drafting] ` or `[design] `. `REVIEWER_SCHEMA` keeps plain strings (`src/controller/phases/document.ts:253-265`), so the standoff, circling and checker paths and existing stubs do not change. A new bullet in `HARNESS_VERDICT_SECTION` (`src/tools/adversarial-review.ts:318-325`) gives the AC 1 definition and requires the prefix on every MUST_FIX and SHOULD_FIX, in the analysis and the report arrays.
- **Interfaces:**
  - `isDraftingDefect(item: string): boolean` in `src/controller/phases/document.ts`: `/^\s*\[drafting\]/i`; anything else is design (AC 4).
  - `reviserStep` gains variant `'drafting-only'` (`src/controller/phases/document.ts:452-454`); `renderReviser` gains the descriptor `Drafting-only corrective pass.` (`src/tools/brief-templates.ts:457-462`).
- **Flow:** after `openMustFix` (`src/controller/phases/document.ts:883`) and before the converged check (`:885-888`), with `items = [...openMustFix, ...shouldFix]`: when `ledgerRoundCount() === 1 && items.length > 0 && items.every(isDraftingDefect)`, run `reviserStep('drafting-only', D, ...)` (it writes v(D+1)), then `D += 1`, `lintStep(D)` and `narrowCheck(D, analysisPath, items)`, as the should-fix-only path does (`:893-900`), set `narrowCheckRan`, write the note `review cap: round 1 drafting-only, <n> item(s), v<D> approved` (now v(D+1)) (AC 7), and return `approve(D, 'drafting-only → converged')`.
- **Why the ledger count:** `reviewRounds` restarts at 0 on re-entry (`src/controller/phases/document.ts:345`); `ledgerRoundCount` (`:522-523`) does not, and this round's row is already written (`:855`).
- **Order:** the escalate return (`src/controller/phases/document.ts:861-864`) comes first (AC 5). One `[design]` item fails the test and the base loop runs (AC 3). All three phases share this loop (AC 6).

### C6 — Rules and deferrals (Requirement 6)
- **Rules:** two bullets at the end of `## Checks` in `.spec-workflow/agent-rules.md`, with the words of lines 143-148 and 155-159 of the tradr-hosted plan, `> ` markers removed. No bullet starts with a machine-read key (`src/dashboard/harness/run-setup.ts:72-141`). The implementer writes through scratch and `cp` (`.spec-workflow/agent-rules.md:51-55`).
- **Deferrals:** the last task resolves `d-83cc3ac1`, `d-37e510db`, `d-4f6a6271` and, for its launch half, `d-aaf54e29`, through the `deferrals` tool.

### C7 — Cancel stops the driver (Requirement 7)
- **Purpose:** Make `abandoned` on disk final and honoured on every driver path.
- **Order change:** `cancelRun` (`src/controller/runs.ts:1380-1400`) writes `abandoned` first, then signals the pid it read, so a step killed by the signal always finds `abandoned` on disk. The worktree, branch and PR stay (AC 6).
- **Status guard (AC 3):** `writeRunLocked` (`src/controller/state.ts:431-463`) reads the disk record first — for terminal writes too, not only under the current `if (!terminal)` gate (`:442`) — and when disk is `abandoned` and `record.status` is not, it writes nothing and returns `false`, so a losing `error` or `done` write cannot clobber `abandoned`. `writeRun` resolves that `boolean`. `updateRun` passes through it, and `writeLastActivityLocked` already skips a terminal run (`:512-513`). `save` and `patchRun` (`src/controller/runs.ts:566-571`, `:429-435`) emit `change` only when written; a dropped `save` returns the disk record.
- **Step guard (AC 1):** `runStep` (`src/controller/step.ts:353`) first checks `spec.runId && readRunSync(spec.runId)?.status === 'abandoned'` and resolves classification `cancelled` with no spawn. All five sites pass `runId` (`src/controller/phases/document.ts:389`, `src/controller/phases/implementation.ts:463`, `src/controller/phases/retrospective.ts:163`, `src/controller/phases/closeout.ts:313`, `src/controller/merge-fix.ts:220`). `StepClassification` gains `'cancelled'` (`src/controller/step.ts:72-78`); every consumer treats non-`ok` as failure.
- **Spawn race:** `stepLifecycle.onStepSpawn` (`src/controller/runs.ts:456-464`) signals the new pid and records nothing when the run is cancelled, for a cancel landing between the guard and the spawn (`src/controller/step.ts:511`).
- **Wait guard (AC 2, 5):** `createWait` (`src/controller/waits.ts:87-104`) throws `RunAbandonedError` for an `abandoned` run. That covers `waitAnd`, both gates (`src/controller/phases/gates.ts:169`, `:256`) and the merge wait (`src/controller/merge.ts:732`). `Controller.drive` (`src/controller/controller.ts:592-604`) ends quietly on that class.
- **Driver checks:**
  - New `runCancelled(deps, runId)`: `deps.isCancelled(runId) || readRunSync(runId)?.status === 'abandoned'`. The disk read gives AC 4. `stopReason` (`src/controller/runs.ts:419`), the loop top (`:868`) and the merge round (`:754`) call it.
  - `runOnce` returns after its first read for an `abandoned` run, before `ensureWorktree` and the `running` write (`src/controller/runs.ts:846-851`).
  - The four `handle*Outcome` functions return `'stop'` first when `runCancelled`: no retry, no wait (AC 2). `handleDocumentOutcome` checks again after its retry (`src/controller/runs.ts:1347`), and `runMergeStageStep` on entry (`:1024`).
  - Both document `shouldStop` lambdas (`src/controller/runs.ts:989`, `:1345`) return `'cancelled'` before `'operator'`. The comment at `src/controller/phases/document.ts:201-206` is corrected.
- **Crash wait (AC 7):** `src/controller/controller.ts:611-638` already skips a cancelled run; its status filter covers a restart.

### C8 — Phase and age (Requirement 8)
`RunTile` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:165-174`) joins `[run.phase, run.stepKind, run.task]` in the step line and adds `run-age-<id>` reading `run ${compactAge(now - Date.parse(run.created))}`. The step age stays. Both values come from the run's own row (`src/controller/runs.ts:1495-1500`); no ledger is read.

### C9 — Running and stopped bands (Requirement 9)
- **Interfaces:** `running(runs, enabled)` returns moving runs in the base order (`src/dashboard_frontend/src/modules/shell/board.ts:46-59`). New `stopped(runs, enabled, now)` returns `stoppedAdmitted` runs, newest `updated` first. `Band` gains `quiet?: boolean` and `hideWhenEmpty?: boolean` (`src/dashboard_frontend/src/modules/shell/HomePage.tsx:18-39`). `RunTile` gains `quiet?: boolean`. New `branchReused(run: RunRecord, runs: RunRecord[]): boolean` in `src/controller/runs.ts`.
- **Placement:** `band-stopped`, title `Stopped`, after `band-next`, absent when empty.
- **Quieter weight (AC 3):** the heading is `text-xs font-medium text-(--text-muted)`. A `quiet` tile shows `run-status-<id>` with `done`, `abandoned` or `error` in `text-sm text-(--text-muted)`, in place of the display-size age and the dot row. `runControls` is unchanged (AC 4).
- **How long an abandoned run stays (AC 5):** until its branch is gone, with no time limit, as at base (`src/dashboard_frontend/src/modules/shell/board.ts:38-44`). The band holds the only Discard press, and the worktree stays until that press.
- **Reused branch (AC 6):** `branchReused` is true when another run has the same `codeRoot`, the same non-empty `branch` and a later `created`, in any status. `dashboard-deploy` run-20261104-205502 is abandoned on `feat/dashboard-deploy`; run-20261105-155538 reused that branch and worktree. `toRow` (`src/controller/runs.ts:1490-1511`) sets `discardAllowed: !(branchHeld(run, runs) || branchReused(run, runs))` and `branchPresent: false` with no branch read, so a reused run leaves the band. `Controller.discard`'s guard (`src/controller/controller.ts:388`) gains the same `|| branchReused`, so a direct POST returns `'branch-in-use'` and deletes nothing. `branchHeld` stays live-only and unchanged; since the `dashboard-deploy` reuser is not live, `branchHeld` alone would miss it.

### C10 — Tile colour (Requirement 10)
`runTone(run: ControllerRun, waits: ControllerWait[], now: number): 'neutral' | 'warning' | 'danger'` in `src/dashboard_frontend/src/modules/shell/board.ts`: `danger` when `isStalled`; else `warning` when `runDot` is `amber` or `red`; else `neutral`. It replaces `ageTone` at `src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150`. Wait and action tiles keep `ageTone` (`:78-79`, `:308-309`).

### C11 — Deploy alignment (Requirement 11)
Remove `mb-3` at `src/dashboard_frontend/src/modules/shell/DeployControl.tsx:57`. The header is already an `items-center` row (`src/dashboard_frontend/src/modules/shell/TopBar.tsx:28`). A Playwright box check at 1280 px proves alignment.

## Data Models

Illustrative; verify against the test fake.

```ts
// src/dashboard/harness/launch-guard.ts
type GuardProject = Pick<ProjectContext, 'projectId' | 'projectName' | 'projectPath' | 'workspacePath'>;

interface LaunchGuard {
  state: 'clear' | 'warn' | 'no-list';
  source: 'tasks' | 'decomposition' | 'none';
  listed: number;      // paths left after the filters
  compared: number;    // listed paths at least one store project holds
  held: number;        // compared paths under this project's code root
  useProject?: string; // project id; set only when state is 'warn'
}

// src/controller/waits.ts
class RunAbandonedError extends Error { readonly code = 'run-abandoned'; }
```

`POST /api/projects/:projectId/display-name`:

| Status | Body | When |
|---|---|---|
| 200 | `{ success: true }` | saved or cleared |
| 400 | `{ error: 'display-name-invalid' }` | not a string or null, over 60 characters after trim, or a control character |
| 404 | `{ error: 'project-not-found' }` | no live context |
| 404 | `{ error: 'project-not-remembered' }` | no `projects.json` row (a transient worktree project) |

Skipped step `StepResult`: `structuredOutput: null`, `usage: mapUsage(null)`, `sessionId: null`, `numTurns: 0`, `isError: true`, `subtype: 'cancelled'`, `resultText: null`, `exitCode: null`, `classification: 'cancelled'`, `durationMs: null`.

Ledger row: `{ ts, run, spec, type: 'file-list.patch', task, round, file, reason }`, all strings. `file` joins several with `, `; `reason` is the flag text.

Discard of a reused run: 409 `{ error: 'branch-in-use' }` (`src/dashboard/multi-server.ts:820`).

## Error Handling

1. **Guard read fails:** `guard` stays unset; the tile shows its code root, no warning, one press.
2. **`tasks.md` patch fails:** C4 failure path.
3. **Late write on an abandoned run:** dropped, no `change` event.
4. **Wait race:** a step failing on its own between the `createWait` read and write can still open a wait. A cancel-caused failure cannot, because `abandoned` is written first.
5. **Merge at cancel:** no wait, no status. A `gh pr merge` already sent cannot be recalled.
6. **Display name save fails:** the gear shows the route's error and keeps the input open.
7. **Reviewer omits labels:** every item is design and the base loop runs.

## Testing Strategy

No test asserts a node-version-specific `child_process`, `fs` or stream field.

- **Unit:**
  - `src/controller/__tests__/state.test.ts`: `shownName`, `setProjectDisplayName`, `rememberProject` keeps the name, the `abandoned` guard.
  - `src/dashboard/__tests__/project-manager-durable.test.ts`: re-registration and a registry-less row keep the name.
  - New `src/dashboard/harness/__tests__/launch-guard.test.ts`: both sources, filters, the no-holder drop, strictly-more, ties, a path under both roots, `no-list`.
  - `src/dashboard/shell/__tests__/board-view.test.ts`: `nextProjects` (assertions at `:634-690` change), `running`, `stopped`, `runTone`, two press.
  - `src/tools/__tests__/harness.test.ts`: `parsePlanDecisions`, `itemTarget`, and an `answerChoosesNoChange` table of the real answers in C3 plus `No change — the rule already requires`, `leave it; agents correctly flag` and `add the 30/60s per-user limiter`.
  - `src/core/__tests__/task-parser-tests.test.ts`: `addTaskFiles` round trip, every other line unchanged.
  - `src/controller/__tests__/step.test.ts`, `src/controller/__tests__/waits.test.ts`: an abandoned run spawns nothing; `createWait` throws.
  - `src/tools/__tests__/adversarial-review.test.ts`: the label bullet.
- **Integration:**
  - `src/controller/phases/__tests__/closeout.test.ts`: a plan shaped like option-lifecycle-events never writes `skipped — no change chosen` for P6, P11, G1 or G2; the brief carries the answer.
  - `src/controller/phases/__tests__/implementation.test.ts`: a stub `REQUIRED:` round patches, writes the row, re-gates and opens no wait; a mixed gate, a foreign flag file, a verifier round and a failed write each stop; a high-risk re-gate reaches the verifier.
  - `src/controller/phases/__tests__/document.test.ts`: all-`[drafting]` round 1 ends with one reviser and one narrow check; a `[design]` or unlabelled item does not; a resumed round does not cap.
  - `src/controller/__tests__/liveness-e2e.test.ts` with `scripts/stub-claude.mjs`: a cancel during a document step leaves `abandoned`, one spawn, no wait, no retry, also with the in-memory set empty and in a merge stage.
  - `src/dashboard/__tests__/harness-routes.test.ts`, the concrete no-`tasks.md` check Requirement 2 asks for: a two-project fixture store, no spec directory, a decomposition entry naming one path that exists only under the app root. Pass means infra's setup returns `state: 'warn'`, `source: 'decomposition'`, `compared: 1`, `held: 0`, `useProject` the app id, and app's returns `state: 'clear'`, `held: 1`. The same suite covers the four display-name answers.
  - `src/controller/__tests__/controller.test.ts`: `discard` of a reused run whose reuser is not live answers `branch-in-use`.
- **End-to-end:** `e2e/worktree-board.spec.ts` covers scenarios 2, 7, 8, 9 and 10; its band-order test (`:343-358`) gains `band-stopped`. Scenarios 3, 4 and 5 are the integration tests above.
- **Live:** scenario 1, after the operator sets the names, and scenario 6, against a live step with 60 seconds of watching, are `verification-evidence.md` lines that must read `passed` before the retrospective opens.

## Decisions taken in this document

- D1 — Display names live in a new field of the durable project list: options were the process registry or a new file; chosen because a registry entry dies with its last server.
- D2 — The operator sets a name in the gear through one POST route: options were hand-editing the file or a command-line tool; chosen because a hand edit is not seen until the next sync.
- D3 — The operator sets the two tradr names after the deploy: options were a seed script or a migration; chosen because a seed puts tradr values in the repository and older code drops the field.
- D4 — With no tasks file the guard reads backticked paths from the decomposition entry: options were the design or requirements document; chosen because the entry is the one source every launchable spec has.
- D5 — A tile warns when another store project holds strictly more compared paths: options were any path missing, all missing, or a majority; chosen because shared files defeat all-missing and any-missing warns on every spec that adds a file.
- D6 — A path no store project holds is dropped, so a mostly-new spec is judged on its existing files: options were counting it or warning on it; chosen because the requirement forbids counting it.
- D7 — The no-change match is narrow and is honoured for any class before Step 1: options were a broad word list or a model call; chosen because a false skip loses an approved decision.
- D8 — The label is a prefix of the finding string: options were a parallel array or objects; chosen because the string paths stay unchanged and a missing prefix fails safe to design.
- D9 — The cap counts round 1 from the ledger: options were the in-memory counter; chosen because the counter resets on re-entry.
- D10 — Cancel writes the status before it signals, and the step, wait and status writes each refuse at one choke point, not at every call site, because a later call site cannot forget it.
- D11 — A refused wait throws and the drive ends quietly: options were a nullable return; chosen because stopping the drive is the wanted effect.
- D12 — An abandoned run stays in the stopped band until its branch is gone: options were a timed expiry; chosen because the band holds the only Discard press.
- D13 — An older run whose branch was reused leaves the band and cannot be discarded: options were a control-less tile or a Discard that skips deletion; chosen because a control-less tile could never leave.
- D14 — The patch writes a typed ledger row: options were a note; chosen because its four fixed fields stay parseable.

## Scope notes

- The advisor's MCP listing (`src/advisor/mcp-endpoint.ts:177`) and summary keep the generated `name`: Requirement 1 AC 1 names only the push text.
- A wait already open at a cancel stays as at base: Requirement 7 covers new waits.
- Cut by the requirements, unchanged here: the eval `file-outside-list-emits-tasks-patch`, the no-PR half of `d-aaf54e29`, the recreated spec folder of `d-4f6a6271`, and retro P11.

## Revision History

- **v2** (2026-11-07) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/2/3).
  - **R1-1 — Accepted (SHOULD_FIX).** The drafting-only cap now increments the version after the reviser, so the lint, narrow check, approval and note name the revised version, not the stale one.
  - **R1-2 — Accepted (SHOULD_FIX).** Both discard guards now also refuse a run whose branch a later run reused, and the test uses a non-live reuser, so a direct discard of a reused branch deletes nothing.
  - **R1-3 — Accepted (MINOR).** The guard reads the decomposition only when the tasks file is absent; an existing tasks file with no file entries now gives no list.
  - **R1-4 — Accepted (MINOR).** The abandoned status guard now reads disk for terminal writes too, so a losing write cannot overwrite an abandoned run.
  - **R1-5 — Rejected (MINOR).** The close-out reference plan is illustrative, as the reviewer concurs; the close-out integration test pins the concrete behaviour.
- **v1** (2026-11-07) — Initial draft.
  - **Lint pass.** 25 citation-bare warnings fixed (directory-prefixed path per bullet; L-20 widened to `:541-542`); 46 citation-identifier warnings rejected as false positives, each anchoring the location the design edits.
