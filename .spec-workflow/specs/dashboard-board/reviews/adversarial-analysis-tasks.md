# Adversarial Analysis — dashboard-board/tasks (v1, round 1)

Primary attack surface: **Atomicity, ordering, coverage.** Fresh lens: none (per prompt).

## What I checked and how

- **Delta under review.** The only change since the `tasks v1` checkpoint is the lint
  pass (47 fixes): every fix expands a prose file name to a full repo-relative path
  (`pause.ts` → `src/dashboard_frontend/src/modules/shell/pause.ts`, test paths spelled
  out, `tsc` left as prose). No substantive line reference changed. I re-verified the
  line numbers the lint pass left in the touched tasks (4, 5, 6, 7, 8, 9, 13, 16, 17,
  18, 19, 20, 22) — all accurate (below).
- **Citations read at both ends.** Confirmed against the worktree:
  - Task 1: `InFlightStep`/`onStepSpawn` (`runs.ts:449-465`), `onSpawn` call at
    `implementation.ts:469`, `runModelStep.opts.task` at `:446`, every task-step call
    passes `task: id` (`:665/:748/:776/:907/:967/:996`), `ctxFor` at
    `implementation.test.ts:209`, clear seam at `runs.test.ts:296`.
  - Task 3: `isLive` at `controller.ts:788-791` (the exact R3 AC 7 list),
    `ControllerRunRow`/`toRow`/`listRunsForWire` at `runs.ts:1428-1471`, no path on the
    row.
  - Task 4: `Controller.discard` at `controller.ts:373-378` (today adds to `cancelled`
    and drops the queue *before* the cleanup — the task correctly moves the guard above
    those under `withStoreLock`), `enqueue` lock at `:231-267` writing `branch: ''` at
    `:259`, `cancelRun`/`discardRun` at `runs.ts:1374-1422`, `controller.test.ts:2402-2403`.
  - Task 2: `branchExists` at `worktree.ts:119-128` (unexported; task exports it).
  - Task 5: `buildView(): SetupView` fixture at `run-setup.test.ts:317-323`, setup route
    `:662-674`, launch route forcing `gates:'record'` at `:687`.
  - Tasks 9/13/14: `pause.ts:43/:45` strings, `pauseNote`/`isOperatorHeld` at `:27-48`,
    `ctrlSummary` at `NowPage.tsx:66-78`, `actionTarget` at `:98-102`, `DOT_COLOUR` map
    (no red) at `Sidebar.tsx:37-41`, Discard text at `RunsPage.tsx:360`.
  - Tasks 18/19: `shell-feed.test.ts:301/305/408(seven topics)/413/496/553`,
    `ledger.test.ts:10/242/243-245`, hub watch loops `:78-93`, `snapshotFor:118-121`,
    `overviewSnapshot:123-129` (kept), `watchedProjects:131-134`, `activityEvents:53/149`.
  - Task 20: every cited test line is the right case —
    `:243`(density) `:259`(group) `:273`(gate wait) `:311`(PR panel) deletes;
    `:417/:446/:477`(pause note) `:516/:558`(row Pause) `:590/:620`(panel Resume) rewrites;
    `:468` and `:553` are where "pause requested" is actually asserted.
- **Coverage map.** Every requirement AC (1.1–12.4) and all three NFRs map to ≥1 task;
  every task carries a `_Requirements` line; every design component C1–C12 has a task
  (Scope notes agree). No orphan task, no uncovered AC.
- **Ordering.** Treated "run in number order" as the governing rule and checked for any
  backward edge (a task needing a higher-numbered one): none. Number order is a valid
  topological sort of every real data dependency ("read the field task N exports").
- **Gate B / Gate C.** No task adds an external dependency (git, playwright, vitest all
  present at base); no task exceeds the approved requirements — the `merging`/`queued`
  tiles and tradr default were explicitly delegated to design (requirements "Left to
  design" + D22–D24). Nothing to carry to a human gate.
- **Test/Success seams.** Every `Test:` call exists in design, an earlier task, or the
  task itself, and is assertable from the `Success` clause with stated values. Each
  function a `Task:` body names (retro P7) reappears in that task's `Success` clause
  (checked tasks 1, 2, 5, 8, 9, 10, 11).
- **File: entries.** All are literal repo-relative paths or new-file paths; no prose
  gloss. No file-scope hole.

## Three conclusions I pressed on (and why each holds)

1. **"The dependency chains capture the edges."** They do not: `3 → 8` and `5 → 8`
   (task 8's `stoppedAdmitted`/`nextTiles` read `branchPresent`/`discardAllowed` and
   `launchableOrder`) are omitted, and `10 → 11` is overstated (task 11 does not wire
   `useStages`; task 12 does). **Harmless** — number order already places 1/2/3/5/6 ahead
   of every consumer, and the implementer works one numbered task at a time, so the
   informal chain never drives an implementation. MINOR.
2. **"The non-board Playwright suites go red at task 11."** Task 9 flips the `pause.ts`
   strings, which makes `worktree-shell.spec.ts:468/:553` latently red one task earlier.
   **No operational effect** — neither task 9 nor 11 runs those suites; the agent rules
   run a suite only when a task names it, and nothing names them until tasks 20–22. The
   per-task contract (tsc + vitest green, frontend buildable, board.spec green) still
   holds. MINOR imprecision.
3. **"R6 AC 5 (green dot within 15 s of Re-drive) is covered."** It is tagged only on the
   docs/evidence task 23, which writes a `pending` line, not on the tasks that build the
   mechanism (1 `stepStarted`, 13 `runDot`, 14 Re-drive wiring). I traced the path:
   Re-drive → spawn → `onStepSpawn` writes `inFlight.startedAt` → `patchRun` emits
   `change` → feed pushes `controller-runs` inside the 1 s throttle → `runDot` reads
   `lastActivity ?? stepStarted` fresh → green. The target is met with margin and, by
   D50, only a live run can assert it. **Genuinely satisfied**; traceability is thin but
   not a gap. MINOR.

## Top risks/gaps

None rise to SHOULD_FIX. The three MINOR items above are the whole list; none would
cause rework or a wrong implementation because number order governs and the cited code
behaves as the tasks claim.

## What is missing before acting

Nothing blocking. Optional polish (MINOR, do not iterate for these): add the `3→8`/`5→8`
edges and drop the `10→11` edge in the dependency line; move the "red window" start note
from task 11 to task 9; cross-tag R6 AC 5 onto tasks 13/14 so the implementer sees the
15 s latency target in-band.

VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
