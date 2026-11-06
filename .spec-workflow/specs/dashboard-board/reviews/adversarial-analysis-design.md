# Adversarial Analysis — dashboard-board/design (v1), Round 1

Primary surface: feasibility, consistency, edge cases. First review of the design.

## What I checked and how

Read the design, requirements (v3), decomposition entry 32, codebase-context, and agent-rules. Then read both ends of every artifact the `## Changes since` diff touched, plus the load-bearing citations the lint pass did not change:

- **C1/C12 interfaces & probe:** `state.ts:38-46` (InFlightStep), `runs.ts:448-465` (stepLifecycle.onStepSpawn), `implementation.ts:95`, `:444-471`, `:616-617` (opts.task route), `setRunHeartbeat` `:441-446`. Tailwind probe: installed `tailwindcss` **is 4.1.18** (matches the probe); `tailwind.css` sets only `body` font-size, not root — so `lg: = 64rem = 1024px` claim holds.
- **C2/C3/C4 controller:** `worktree.ts:119-128` (branchExists, private→export, `rev-parse --verify --quiet` + `scrubbedGitEnv`), `controller.ts:231-272` (enqueue writes `branch:''` under `withStoreLock(project.projectPath)` == `run.specStore`), `runs.ts:840-842` (drive sets branch+status in one save — no running-with-empty-branch window, so `branchHeld` is race-tight), `isLive:788-791` (= R3 AC 7 set), `discard:373-378`, `discardRun:1400-1422`, `cancelRun:1374-1394`, `ControllerRunRow:1428-1451`, `listRunsForWire:1468-1471`, `readRunLogTail`+`safeMtime:1487-1536`. **Layering:** controller already imports from `dashboard/harness/*` (controller.ts:13, merge.ts:18, state.ts:15), so the new `controller/branch-presence.ts`→`worktree.ts` import is no new inversion and no cycle (worktree.ts imports only fs/child_process/core).
- **C5:** `run-setup.ts:146-218` (buildSetupView), `:224-233` (nextUnstartedSpec regex `/^###\s+\d+\.\s+\`([\w.-]+)\`/`); C5's "deferred included" index deliberately diverges from nextUnstartedSpec's deferred-skip — consistent with R3 AC 9.
- **C6:** `shell-feed.ts:92-161` (7→5 topics; liveRunsByProject still feeds spec rows), `hub.ts:53/78-93/103-106/149` and `:119-132`, `multi-server.ts:170-175/318-320/353-366/593-617/859-864/866-875/938-952`, `types.ts:33-60`.
- **C7–C12 frontend:** `App.tsx:26-27/31`, `ShellProvider.tsx:7-63/153-156`, `WebSocketProvider.tsx:37-51`, `tokens.css:52-57` (grouped cite `--sidebar-w`→:56 / `--row-h-compact`→:53 now correct), `PageLayout.tsx:22` (reads `--panel-w`), `ProjectProvider.tsx:28-39/74-77`, `Gear.tsx:64/75-99`, `Sidebar.tsx:37-41/137-152`, `NowPage.tsx:66-78/98-102/196-228/433-701`, `pause.ts:33-48`, `merge.ts:28/556`, `waits.ts:193`, `actions.ts:34/450-465` (`ActionState` includes `refused`), `RunsPage.tsx:360`, test cites `frontend-style-scan:338` / `frontend-tokens:126-127`.

Every artifact path, range, signature and behaviour the document asserts is accurate. Error branches are pinned: discard race-loser = **409 `{error:'branch-in-use'}`**; confirm executor fail = **200 `ok:false` + `error`**. No MUST_FIX.

## Findings

### R1-1 — SHOULD_FIX — The red run-dot has no class in the cited source (Novel)
C10: "The dot classes copy `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:37-41`." That map (`DOT_COLOUR`) has exactly three entries — `waiting` (amber), `running` (green), `idle` (grey) — **no danger/red**. But C9 `runDot` returns a fourth value, `red`, at 900,000 ms, and R6 AC 2 requires "at 15 minutes and after red" for a live-but-slow heartbeat (driven, not stalled). An implementer copying `:37-41` literally produces no red dot; `board-view.test.ts` only exercises `runDot`'s return string, not the rendered class in `tiles.tsx`, so the miss is not gated.
Failure scenario: a `running`, `driven:true` run whose `lastActivity` is 16 min old renders a dot with no `--tone-danger-fg` — amber or unstyled instead of red. Fix: state the dot maps `red → bg-(--tone-danger-fg)` (that token exists), since the cited source lacks it.

### R1-2 — MINOR — "only the sidebar read" is imprecise (Novel)
C7 deletes `now`, `controllerActivity`, `connected` from `ShellProvider` "which only the sidebar read." In fact `now` is also read by `NowPage.tsx:233` and `RunsPage.tsx:83`, and `controllerActivity` by `RunPage.tsx:52`. The deletion is still safe (all three files are deleted here, and `ConnectionBanner` takes `connected` from `useWs`, not `useShell`), so only the justification is wrong, not the conclusion.

### R1-3 — MINOR — hub.ts deletion range swallows a survivor (Novel)
C6: delete "`snapshotFor`, `watchedProjects` (`:119-132`)". That range also spans `overviewSnapshot()` (`:123-129`), which must stay, and stops at :132 though `watchedProjects` runs to :134. The named identifiers are the contract and they are right; the range is just loose.

### R1-4 — MINOR — Gear's `useShell().density` read is not enumerated (Novel)
C7 deletes `density`/`setDensity` from `ShellProvider` and removes the density block `Gear.tsx:75-99`, but `Gear.tsx:14` destructures `{ density, setDensity } = useShell()`; that line must go too or `tsc` fails. Implied by R1 AC 5 but not spelled out.

## Top risks / conclusions to weigh
1. **R1-1** is the only substantive gap: a required state colour whose cited implementation source cannot express it.
2. Everything else verified clean — notably the Discard/relaunch race (store lock + the two-clause `branchHeld` covering queued-empty-branch and running-filled-branch) is sound, and the `done`-discard cache-staleness fix (`forgetBranchPresence` + post-cleanup `change`) is correct.
3. No security/data/money surface beyond Discard, which sits behind a second press and the store lock (D1).

## What's missing before acting
Only the red-dot class note (R1-1). The document is otherwise implementation-ready.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
