# Adversarial Analysis — controller-liveness-and-push/tasks (v1, round 1)

Primary attack surface: atomicity, ordering, coverage. Fresh lens: none (first review).

## Deltas re-verified (the v1 lint commit)

The lint pass only prefixed bare `*.test.ts` filenames with their repo-relative dirs and
reworded two prose bullets (tasks 11, 15). Every changed citation re-read at both ends:

- Task 6 `src/dashboard/shell/__tests__/sidebar-rows.test.ts:189-198` — the `run()` helper
  building a `ControllerRun`. Verified (lines 189-198). `driven: false` must be added there.
- Task 7 `src/controller/__tests__/controller.test.ts:496-506` — the one `runEvents` `change`
  listener, added at 498 / removed at 505, spanning a `pause` with no drive. Verified.
- Task 10 `home.test.ts:67` (`under(pushConfigPath())`), `:79` (`pushConfigPath()` === push.json),
  `summary.test.ts:411` (`summary.push` === 'off'). All verified; all still hold under task 10's
  bridge (pushConfigPath stays exported).
- Task 12 `push.test.ts:211-212` (writePushConfig helper), `:304-306` (JSON body assertions),
  `advisor-e2e.test.ts:438-441` (push.json seed), `:461` (exact body). All verified; all are the
  sites the ntfy switch must rewrite, and all are in task 12's File list.
- Task 14 `run-setup.test.ts:505-511` (no-specs test) and `:516-529` (all-on-disk-complete test).
  Verified as the existing routing tests that keep their values.
- Scope note `now-model.ts:131-132` (idle row reads `routing.state` directly) + added
  `buildSetupView` (`run-setup.ts:146-217`). Both verified; the "known gap" is real and correctly
  scoped out (Requirement 6 names `buildSetupView` only).

All delta citations are accurate. No delta MUST_FIX.

## Load-bearing citations re-read in code

- `controller.ts:54` mcpConfigFor option; `:428-429` drive catch + log; `:419` startDrive `.finally`
  (deletes drives entry — active already deleted in drive's own finally at :431, so `drivenRuns()`
  is clear at the task-7 emit); `:438-466` onWaitChange (abandon→cancel 455-457, else re-queue/park
  461-465). All correct.
- `runs.ts:832` `deps.mcpConfigFor(run)`; `:850-858` loop-top hold stop; `:1410-1427`/`:1429-1438`/
  `:1441-1444` ControllerRunRow/toRow/listRunsForWire (row currently lacks `driven`/`lastActivity`,
  as the tasks assume). All correct.
- `multi-server.ts:101-105` `launchSpec(project, input, controller)` — matches task 14's Test line
  exactly; mkdir at :120 within the 6.5 range. GET route :809-811, resume route :832-838 (redrive
  lands after it). All correct.
- `state.ts:415` writeChains, `:417-433` writeRunLocked (pauseRequested carry 422-426, terminal drop
  426 — the pattern task 1 mirrors for lastActivity). `step.ts:446-448` parsed-object branch (so a
  JSON scalar is excluded — task 3 (c) holds), `:466-469` leftover buffer, `:509-511` spawn-error
  settle. `waits.ts:73-84` enqueueWaitWrite, `:87-104` createWait. All correct.
- `shell-feed.ts:38-46` constructor is `(projects, send, opts)` — 3 args, matching task 6's
  `new ShellFeed(projects, send, { drivenRuns })` and design C4. The 4-arg `(projects, launcher,
  send, opts)` in shell-feed.test.ts's header is a stale comment from an earlier spec, not this
  task's concern. `WaitPusherOptions:48-51` already has `retryDelayMs`, so task 12's Test line
  constructs. All correct.

## Coverage (atomicity / ordering / coverage lens)

All 43 acceptance criteria (Req 1: 9, Req 2: 7, Req 3: 8, Req 4: 8, Req 5: 6, Req 6: 5) map to a
task via `_Requirements:`; cross-checked each AC → task. No orphan AC, no task without a requirement.
spec-lint coverage-component / coverage-unchecked passed pre-fix.

Ordering and green-tree bridges sound:
- heartbeat chain 1→2→3→4 (type from 2, writer from 1, wired in 4); crash/wire/controller/route
  5→6→7→8→9 (7 adds drivenRuns+openCrashWait, 8 adds redrive/recover using 5's finder + 4's
  setRunHeartbeat, 9 removes task 6's empty-set bridge and wires the live set); push 10→11→12→13
  (10 keeps pushConfigPath exported, 11 exports an uncalled buildMessage, 12 removes the bridge and
  sends, 13 adds the sweep). Each bridge keeps tsc + suites green at its own task.
- liveness-e2e.test.ts created in 4, extended in 8 (scenarios 2,3) and 14 (scenario 5); strictly
  increasing task order.
- `listRunsForWire` tests (runs.test.ts:505-527) assert single fields, not whole-row equality, so
  adding `driven`/`lastActivity` keeps them green — task 6's "assert no value this changes" holds.

Success-clause coverage (retro P7): for every task, each test/behaviour the `Task:` body names is
present in the `Success:` clause. No silently-dropped test. Every `File:` entry is a literal
repo-relative path (no prose gloss). Every `Test:` call exists in a design interface or this/earlier
task and is assertable with requirement values.

## Findings

No MUST_FIX. No SHOULD_FIX.

MINOR (recorded, not loop-keeping):
- M1 — Tasks 2-4 implement NFR Performance (≤1 write/10s, no activity-relay touch, no extra feed
  push) and NFR Reliability (injected clock), but only task 12 tags `NFR` in `_Requirements:`. The
  NFRs are referenced inline in the tasks' Restrictions, and lint coverage passed; tagging only.
- M2 — Task 7 Restriction "Call `openCrashWait` inside the `try`, so `active` still holds the run"
  is imprecise: the call belongs in the `catch` (the task body says so — "the `catch` … then calls
  a private `openCrashWait`"), and `active` is deleted only in the `finally`, so the substance is
  correct. Mirrors the design's own C5 wording. No implementation risk.
- M3 — Task 15 (docs) tags `_Requirements: 3.1, 4.2` though its Success also asserts the one
  reminder (Req 5) and the four message fields (Req 4.3); it cites the governing C11 in the
  `_Prompt`, so the thin tag set is cosmetic.

## Top risks / conclusions

Nothing to reverse. The two-task config rename (D1), the crash-wait status guard (D4), and the
non-persisted `driven` set (D14/Req 2 AC 1) are each justified and consistent between requirements,
design and tasks. The one genuine residual — the Now page's idle row still showing a disabled
reason (now-model.ts:131-132) — is explicitly scoped out and traced to Requirement 6 naming
`buildSetupView` only.

## What's missing before acting

Nothing blocking. Task 12's live ntfy-doc fetch (Req 4.4) remains the one open item and is
correctly built to escalate rather than ship a blind header.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
