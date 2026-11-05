# Design Document

## Overview

This design adds a deploy coordinator to the controller, a `--deploy-record` mode to `scripts/sdd-self-update.sh`, a `holdBy` field on the run record, two routes, one shell-feed message and one self-contained dashboard control. The coordinator lives inside the `Controller` and the script runs outside the service cgroup in a transient user unit, so the restart cannot kill it. It reuses the operator hold (`pauseRequested`), the per-run write chain, the feed's broadcast path and the script's existing checks.

## Steering Document Alignment

### Technical Standards (tech.md)
N/A: `.spec-workflow/steering/` holds no `tech.md`; the design follows `.spec-workflow/agent-rules.md`.

### Project Structure (structure.md)
N/A: no `structure.md`; new modules sit beside their peers (`src/controller/`, `src/dashboard_frontend/src/modules/shell/`) and tests in the adjacent `__tests__/`.

### Design System (design-system.md) — if applicable
N/A: no `design-system.md`; the control uses the existing `Button` and tone classes as `OpenAdvisorButton` does (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:104-138`).

## Architecture

The press writes the record and the holds under the deploy lock; the controller's tick waits for quiet, starts the unit and reads the record each second. While the unit lives, the script is the only writer of `deploy.json`, except on start at `restart`, where both sides converge on `done`. One new seam, `DeployUnit`, hides `systemd-run` and `systemctl`, so every test runs without systemd.

## Components and Interfaces

Decision numbers continue from the requirements, whose decisions end at D12.

### C1. Deploy coordinator (`src/controller/deploy.ts`, new)

- **Interfaces:**
  - `deployRecordPath(): string`: `join(controllerHome(), 'deploy.json')`; the claim path adds `.claim`.
  - `readDeployRecord(): Promise<DeployRecord | undefined>`; a missing or unparsable file is `undefined`.
  - `isDeployOpen(record): boolean`, true when `stage` is neither `done` nor `failed`.
  - `readDeployForWireSync(): ControllerDeploy | null`.
  - `deployEvents`: emits `change` with the wire form.
  - `class DeployCoordinator`, constructed with `DeployDeps`: `{ now, unit, isQuiet(): Promise<boolean>, resumeIfAnswered(run): Promise<void>, schedule(): void, waitLimitMs? }`.
  - `press(): Promise<{ ok: true } | { ok: false; error: 'deploy-open'; stage: string }>`
  - `cancel(): Promise<{ status: 200 | 404 | 409 | 500; error?: string; stage?: string }>`
  - `onStart(): Promise<void>`, `tick(): Promise<void>`, `withLock<T>(fn): Promise<T>`.
- **Deploy lock.** One promise-chain mutex in the instance. `press`, `cancel`, `onStart` and `withLock` wait for it. `tick` returns at once when it is held, and the next tick retries (D16). Nothing inside the lock calls `withLock`.
- **`press` post-conditions (R1 AC1-3, 8-10), under the lock:**
  1. Re-read. An open record gives `deploy-open` with its stage.
  2. `unit.state()` of `live` gives `deploy-open` with the record's stage, or `unit` when there is none (D13, D19).
  3. Remove any claim left from an earlier deploy.
  4. List the runs with status `running`, `queued`, `waiting`, `merging` or `paused` and no `pauseRequested`.
  5. Write the record, replacing any `done` or `failed` one, with `stage: 'wait'`, `runs` and `started`, before any hold, so a crash still lists the holds to re-apply.
  6. Apply the holds through `updateRun` (C2), skipping a run that has since gained a hold or ended: `pauseRequested` is the press time, `holdBy: 'deploy'`, status unchanged. Emit `runEvents` `change`.
  7. Call `deps.schedule()`. The route answers 202.
- **`tick` (at the top of `schedule`).** It reads the record, emits `deployEvents` when the wire form changed, then:

| Record | Action |
|---|---|
| absent | release any leftover `deploy` hold (D24) |
| `failed` or `done` | release if any run has `holdBy: 'deploy'` (R3 AC2) |
| `wait`, `unitStarted` not true, `now - started` over the limit | write `failed`, release (R1 AC7) |
| `wait`, `unitStarted` not true, `isQuiet()` true | start the unit (below); not quiet means nothing |
| any other open record | `unit.state()`: `gone` means re-read once and, if the record is still open, write `failed` and release (R3 AC3); `live` or `unknown` means nothing |

- **Starting the unit (R1 AC4, AC6).** Already under the lock, re-read; go on only if the record is still open at `wait` with `unitStarted` not true. Persist `unitStarted: true`, then call `unit.start(deployRecordPath())`. A rejection writes `failed` and releases.
- **`isQuiet` (D17).** True when no run passes the `scripts/sdd-self-update.sh:89-97` test (`inFlight` set and `isProcessAlive`) and `Controller.drivenRuns()` is empty (`src/controller/controller.ts:144-146`). The drive term covers a run past its stop check with no `inFlight` yet, and an in-process merge.
- **`onStart` (under the lock, before `recover`, D21):**

| Record | Action |
|---|---|
| absent, with `deploy` holds on disk | release (D24) |
| `restart` or `done` | release; write `done` if not already (R3 AC1) |
| `failed` | release if any run has `holdBy: 'deploy'` (R3 AC2) |
| open, `unit.state()` `live` | leave record and unit alone, keep the holds (R3 AC5) |
| `wait`, `unitStarted` not true, unit not live | re-apply holds to `runs`: skip a run that is gone or terminal, or that has `pauseRequested` with `holdBy` other than `deploy` (R3 AC4); the tick continues |
| any other open record, unit `gone` | write `failed`, release (R3 AC3) |
| any other open record, unit `unknown` | nothing; the tick decides |

- **Release (R3 AC6).** For every run listed with `holdBy: 'deploy'`, `updateRun` re-checks `holdBy` inside the chain and clears it and `pauseRequested`. A run `paused` with `pauseReason: 'operator'` goes to `queued` with `pauseReason` and `resumeAt` cleared, as in `src/controller/controller.ts:278-281`. Any other run keeps its status. A `waiting` run then goes through `deps.resumeIfAnswered`, and `deps.schedule()` runs. A repeat finds no run.
- **`cancel` (R5), one hold of the lock:**
  1. Re-read. No record gives 404. Stage `swap`, `restart`, `done` or `failed` gives 409 `deploy-past-swap`.
  2. Claim: `fs.mkdir` on the claim path, not recursive. `EEXIST` gives 409 `deploy-past-swap`, because the script has claimed the swap (D15).
  3. If `unitStarted` is true or `unit.state()` is `live`: `unit.stop()`, then poll `unit.state()` until `gone`, for at most 30 seconds. Past that, answer 500 `deploy-stop-failed` and keep the record and the claim; the tick fails the record once the unit is gone.
  4. Release, remove the record, remove the claim, emit `change` with `null`, answer 200.
- **Failed-record writes** keep the other fields. The `error` texts carry no absolute path:
  - `wait: a live step outlasted the 5-hour limit`
  - `wait: systemd-run could not start the unit (exit N)`; the raw stderr goes to `console.error` only, because it can name a path (probe below).
  - `<stage>: unit sdd-deploy.service is not live`, with the `swap`/`restart` suffix from C4 at those stages.
- **Reuses:** `writeJsonAtomic` (`src/controller/state.ts:338-343`), `isProcessAlive` (`:657-660`).

### C2. Hold model (`src/controller/state.ts`)

- **Interfaces:**
  - `RunRecord.holdBy?: 'operator' | 'deploy'` beside `pauseRequested` (`src/controller/state.ts:91`); absent reads as `operator`.
  - `writeRunLocked` treats `holdBy` exactly as `pauseRequested` (`:424-437`): carried from disk unless the writer has `ownsPauseRequest`, cleared on a terminal status (R4 AC2).
  - New `updateRun(id, fn: (run: RunRecord) => RunRecord | undefined): Promise<RunRecord | undefined>`. It runs inside the id's write chain (`:447-455`), re-reads the record, applies `fn`, and writes with `ownsPauseRequest: true`; `fn` returning `undefined` writes nothing. Holds and releases use it, so a stale copy never reverts a driver's status write (D22).

### C3. Controller wiring (`src/controller/controller.ts`)

- **Post-conditions:**
  - `ControllerOptions` gains `deployUnit?: DeployUnit`, `deployWaitLimitMs?: number`, `deployDisabled?: boolean`.
  - `pressDeploy()`, `cancelDeploy()`, `deployRecord()` delegate to C1. With `deployDisabled`, `start()` skips `onStart` and `schedule` skips `tick` (R3 AC8).
  - `start()`: `await deploy.onStart()` between `waitEvents.on` and `recover()` (`:109-111`) (D21).
  - `schedule()`: `await deploy.tick()` first, after the `started` guard (`:395`).
  - `settlePass`: skip a run with `holdBy: 'deploy'`, write nothing (R4 AC3, `:434-449`).
  - The usage-window branch (`:405-409`) skips a `deploy`-held queued run, so its status stays as D4 says.
  - `isStartable` is unchanged: `:456` already refuses (R4 AC4).
  - `onWaitChange`: after the status guard (`:546`), return when `run.holdBy === 'deploy'`, before the abandon branch and the patch. Release replays the answer through `resumeIfWaitAnswered` (`:387-390`), and `recover` meets the same guard (R4 AC6, `:352-353`).
  - `pause`: the early return at `:242` becomes `run.pauseRequested && run.holdBy !== 'deploy'`, and the patch always sets `holdBy: 'operator'` (R4 AC1, AC7). A `deploy`-held run falls through to the operator.
  - `resumeNow(runId)`: returns the new sentinel `'deploy-open'`, under the deploy lock, when the run exists and it has `holdBy: 'deploy'` or a record is open (R4 AC8). Its held branch also clears `holdBy` (`:277-284`).
  - `enqueue`: the admission (`:191-209`) runs inside `deploy.withLock`, and throws `enqueue: a deploy is open (stage <stage>)` while a record is open (R4 AC9, D23). `launchSpec` already maps the throw to 409 (`src/dashboard/multi-server.ts:122-127`).
  - `launchBlock`: returns `A deploy is in progress (<stage>); launch waits until it ends.` first while a record is open (`:315-327`).
  - Cancel and discard are unchanged: a terminal status clears the hold (R4 AC11).
- **Unchanged in `src/controller/runs.ts`:** `stopReason` (`:417-422`) and `pause` (`:573-581`) already park a held run, and `writeRunLocked` keeps `holdBy` (R4 AC5).

### C4. Self-update script (`scripts/sdd-self-update.sh`)

- **Argument:** `--deploy-record <path>` in the parser (`:32-46`) and both usage lines. With `--dry-run` the path is dropped (R2 AC7). Without a path, nothing below applies: no trap, record, claim or gap (R2 AC8).
- **`write_stage <stage>`:** sets `STAGE`, then updates the record through an inline `node -e` using only `fs`, with the path and fields passed through the environment. It merges the given fields into the existing file through a temp file and rename in the same directory, and exits non-zero when the file is absent, so a script write never recreates a removed record (R2 AC5, R5 AC2).
- **Stage calls (R2 AC1):** `wait` before `:81`, `build` before `:191`, `smoke` before `:213`, `gate` before `:239`, `swap` after the claim and before `:276`, `restart` between `:305` and `:307`, `done` after `:308`.
- **`commit` (R2 AC2):** written after `check_move` at `:180`.
- **No-op refusal (R2 AC4):** at the same point, with the flag set and `behind` equal to 0: `log "refusing: nothing to deploy; the checkout is at origin/main"; exit 1`. The second `check_move` at `:276` does not repeat it.
- **Claim (D15):** with the flag, immediately before `write_stage swap`: `mkdir "$DEPLOY_RECORD.claim"`. On failure: `log "refusing: a cancel holds the deploy; nothing moved"; exit 1`. After this `mkdir` a cancel cannot claim and sends no stop, so no cancel's SIGTERM reaches the checkout move or the `dist/` swap.
- **Failure capture (R2 AC3):** `log` (`:54`) also stores its text in `LAST_LOG`. With the flag: `trap 'exit 143' TERM` and an EXIT trap. When the exit code is non-zero the EXIT trap writes `stage: 'failed'` and `error`, and ignores a write failure.
  - Every refusal logs before it exits, so the existing `exit 1` sites stay as they are (R2 AC9).
  - `error` is `<STAGE>: <text>`. `<text>` is `FAIL_NOTE` when set, else `LAST_LOG`, with ` (exit N)` added when `LAST_LOG` is not a refusal.
  - `write_error_wait` (`:59-75`) sets `FAIL_NOTE="the step failed; see the error wait"`. The eval summary stays out of the record because it can hold a path (`src/__tests__/service-scripts.test.ts:510`), and `STAGE` supplies `smoke` and `gate`, not the wait texts.
  - At `swap` or `restart` the text gains `; the live checkout or dist/ may already have changed`.
- **Restart gap (R2 AC6):** with the flag, `sleep 3` after `write_stage restart`.

### C5. Transient unit (`DeployUnit` in `src/controller/deploy.ts`)

- **Interfaces:**

```ts
// illustrative — verify against the test fake
type UnitState = 'live' | 'gone' | 'unknown';
interface DeployUnit {
  start(recordPath: string): Promise<void>; // rejects with the exit code
  state(): Promise<UnitState>;
  stop(): Promise<void>;
}
export function deployUnitArgs(opts: { checkoutRoot: string; recordPath: string; home: string;
  env: NodeJS.ProcessEnv }): string[];
export function systemdDeployUnit(): DeployUnit;
```

- **Name:** `sdd-deploy`, fixed (D13). `scripts/sdd-service.sh` needs no edit: the unit reads the same `service.env` (`:82`) and repeats the key removal of `:84`.
- **`deployUnitArgs` post-condition.** The `systemd-run` argv holds, in any order:
  - `--user`, `--unit=sdd-deploy`, `--collect`, `--quiet`, `--working-directory=<checkoutRoot>`
  - `--setenv=PATH=<env.PATH>`, `--setenv=HOME=<env.HOME>`, `--setenv=SDD_HOME=<home>`
  - `-p EnvironmentFile=-<home>/service.env`
  - `-p UnsetEnvironment=ANTHROPIC_API_KEY`, `-p UnsetEnvironment=ANTHROPIC_AUTH_TOKEN`
  - `-p TimeoutStopSec=15`
  - then `<checkoutRoot>/scripts/sdd-self-update.sh --deploy-record <recordPath>`

  No token passes through argv (R1 AC5, Security). `checkoutRoot` is `process.env.CONTROLLER_HARNESS_REPO ?? packageRoot()`, matching `src/advisor/actions.ts:363`. The `EnvironmentFile` form matches `scripts/sdd-service.sh:213`.
- **`state()`:** `systemctl --user show sdd-deploy.service -p ActiveState --value` with a 5-second timeout. `active`, `activating`, `deactivating` and `reloading` are `live`; any other value on exit 0 is `gone`; a non-zero exit or a timeout is `unknown`, so a bus error never fails a deploy.
- **`stop()`:** `systemctl --user stop sdd-deploy.service` with a 30-second timeout. Exit 5 (not loaded) resolves.
- **Probes (2026-11-05, systemd 255.4, throwaway unit):** `--collect` frees the name after a stop and after a failing exit. A second start under a live name exits 1. `show` on a gone unit prints `inactive` and exits 0. `stop` blocks until the unit is gone and delivers SIGTERM to a bash trap; on a gone unit it exits 5. A missing executable makes `systemd-run` exit 1 with a message naming the path. `UnsetEnvironment` beats `--setenv`; `EnvironmentFile=-` and `--working-directory` hold. With the controller's `PATH`, a unit reached `systemctl --user`, `git ls-remote origin` over SSH, `node`, `npm`, `claude`, `rsync` and `gh`.

### C6. Routes (`src/dashboard/multi-server.ts`)

- **Interfaces** (the new routes sit under the same global hooks with no exemption, `:690`):
  - `POST /api/controller/deploy`: 202 `{ ok: true }`, or 409 `{ error: 'deploy-open', stage }`.
  - `POST /api/controller/deploy/cancel`: 200 `{ ok: true }`; 404 `{ error: 'no-deploy' }`; 409 `{ error: 'deploy-past-swap', stage }`; 500 `{ error: 'deploy-stop-failed' }`.
  - `POST /api/controller/runs/:id/resume` (`:833-839`): the `'deploy-open'` sentinel maps to 409 `{ error: 'deploy-open' }`.
  - `MultiDashboardOptions` (`:70-75`) gains `smoke?: boolean` and `deployUnit?: DeployUnit`, passed to the `Controller` (`:177-194`) as `deployDisabled` and `deployUnit`. `src/index.ts:563-568` passes `smoke: isSmokeMode`.
- **Unchanged:** the advisor tmux spawn (`:741-752`).

### C7. Feed and hub

- **Interfaces:**
  - `ShellMessage` gains `{ type: 'controller-deploy'; data: { deploy: ControllerDeploy | null } }` (`src/dashboard/shell/types.ts:230-236`).
  - `ShellFeed.flush` appends it as the seventh and last message, read with `readDeployForWireSync()` directly before `messages` is built (`src/dashboard/shell/shell-feed.ts:145-153`). No `await` separates that read from the sends, so a flush cannot send a stale stage after a push. The first flush and `overviewSnapshot` (`src/dashboard/multi-server.ts:360-368`) carry the record (R6 AC9).
  - New `ShellFeed.pushDeploy(deploy)`: when not closed, sends the message at once and replaces it in `last`.
  - `HarnessHub` subscribes to `deployEvents` beside its other listeners (`src/dashboard/harness/hub.ts:49-52`) and removes the listener in `close` (`:139-154`). The handler calls `this.shellFeed?.pushDeploy(deploy)`.
- **Timing:** tick 1 s plus an unthrottled send meets the 2-second limit (D18). `controller.start()` runs before `listen` (`src/dashboard/multi-server.ts:404-417`), so a reconnecting page's first flush shows `done`.

### C8. Wire rows and the advisor guard

- `ControllerRunRow`, `toRow` (`src/controller/runs.ts:1428-1462`), server `ControllerRun` (`src/dashboard/shell/types.ts:194-214`) and the hand copy (`src/dashboard_frontend/src/modules/shell/types.ts:215-237`) gain `holdBy?: 'operator' | 'deploy'` (R4 AC12).
- `execDeploy` (`src/advisor/actions.ts:362-384`): first statement reads the record. While open it returns `{ ok: false, outcome: 'refused', detail: <stage>, error: 'deploy-open' }`, spawning nothing (R4 AC10). The confirm route already returns the result body (`src/dashboard/multi-server.ts:789-794`).

### C9. Dashboard control

- **`src/dashboard_frontend/src/modules/shell/deploy.ts` (new, pure, type-only imports):** `DEPLOY_STAGES`, `isDeployOpen(stage)`, `canCancel(stage)` (true for `wait`, `build`, `smoke`, `gate`), `deployHoldCount(runs)` (status in the five live statuses and `pauseRequested` undefined), `deployRetryCap(stage)` (2000 at `swap` or `restart`, else `null`).
- **`src/dashboard_frontend/src/modules/shell/pause.ts`:** `isOperatorHeld` is false when `holdBy === 'deploy'`. `pauseNote` returns `{ text: 'held for deploy', overdue: false }` as its first branch (`:27-44`). Rows on both pages pick this up through `pauseNote` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:352-355`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:249`).
- **`src/dashboard_frontend/src/modules/shell/RunsPage.tsx`:** the `Resume now` branch gains `run.holdBy !== 'deploy'` (`:341`). `held` is false for such a run, so `Resume` hides and Pause stays (`:332-354`).
- **`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx`:** adds `controllerDeploy: ControllerDeploy | null`, subscribes to `controller-deploy` (`:76-121`), and runs one effect calling `setRetryCap(deployRetryCap(stage))`.
- **`src/dashboard_frontend/src/modules/shell/types.ts`:** hand copy of `ControllerDeploy` and the `ShellMessage` member (`:268-274`).
- **`DeployControl.tsx` (new):** no props; reads only `useShell()` (R6 AC10). `src/dashboard_frontend/src/modules/shell/NowPage.tsx:286` renders it beside `OpenAdvisorButton`, the only Now page change.
  - No open record: `Deploy` (test id `deploy-button`) swaps to an inline confirm, as `confirmDiscard` does (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:358-366`), stating the count and that the restart ends the advisor. The POST goes only from `deploy-confirm` (R6 AC1).
  - Open record: `Deploy` disabled with visible `Deploying: <stage>` (R6 AC3).
  - Record present: `deploy-strip` shows the seven stages, the current one with `aria-current="step"` (R6 AC2).
  - `canCancel`: `Cancel and resume now` (`deploy-cancel`) (R6 AC5).
  - `restart`: the advisor note (R6 AC6).
  - `failed`: `error`, which starts with the stage; `done`: `done` and `commit` (R6 AC7).
  - A non-2xx answer shows `deploy-error`.

### C10. Reconnect (`src/dashboard_frontend/src/modules/ws/`)

- New `retry-delay.ts`: `retryDelayFor(delay: number, cap: number | null): number`.
- `src/dashboard_frontend/src/modules/ws/WebSocketProvider.tsx`: `setRetryCap(ms: number | null)` on the context sets a ref. `onclose` (`:94-104`) computes the delay once through `retryDelayFor`, and uses it for both `nextRetryAt` and the timer. The record stays in `ShellProvider` state through the outage, so the strip stays on screen (R6 AC8).

## Data Models

```ts
// src/controller/deploy.ts — illustrative — verify against the test fake
type DeployStage = 'wait' | 'build' | 'smoke' | 'gate' | 'swap' | 'restart' | 'done' | 'failed';

interface DeployRecord {
  v: 1;
  stage: DeployStage;
  runs: string[];
  started: string;                 // ISO press time; base of the 5-hour limit
  commit?: string;
  error?: string;
  unitStarted?: boolean;
}

type ControllerDeploy = Omit<DeployRecord, 'v' | 'unitStarted'>;  // wire form
```

`deploy.json.claim` is an empty directory beside the record; its existence is the claim.

## Error Handling

Failure texts are in C1 and C4.

1. **Press with a record open or a unit live:** 409 `deploy-open`; the page shows the stage.
2. **`systemd-run` fails, or a live step outlasts 5 hours:** `failed` naming `wait`, holds released (R1 AC6, AC7).
3. **Script refusal or failure:** `failed` from the EXIT trap, the tick releases, the script's error wait stays (scenario 3).
4. **Unit killed by hand:** no trap ran; the tick or the next start writes `failed` and releases (scenario 6).
5. **Cancel loses the claim race:** 409 `deploy-past-swap`, even if the record still reads `gate` for the instant before the script's `swap` write.
6. **Cancel cannot stop the unit:** 500 `deploy-stop-failed`; the script cannot pass the claim.
7. **`systemctl` unreadable:** `unknown`; the tick tries again.
8. **Controller dies mid-cancel:** after the claim, the script refuses at the claim and the tick releases; after the stop, the TERM trap left `failed` and `onStart` releases.
9. **Record removed by hand while holds remain:** the tick releases them (D24).

## Testing Strategy

Script tests assert only exit codes and file contents, and `EEXIST` is read through `error.code`; node 20 guarantees all of these. No decision rests on a node timing probe.

- **Unit:**
  - `src/controller/__tests__/deploy.test.ts` (new), fake `DeployUnit`: both tables, two concurrent presses, persist before spawn, cancel at each stage, claim loss, a tick skipping a held lock, the limit through `deployWaitLimitMs`, release idempotence, `deployUnitArgs`.
  - `src/controller/__tests__/pause-request.test.ts` beside `:58`: `holdBy` carry-over, `updateRun`, terminal clear.
  - `src/controller/__tests__/controller.test.ts`: `settlePass` skip, `onWaitChange` and recovery on a held run, Pause transfer, Resume and launch refusal, `deployDisabled`.
  - `src/advisor/__tests__/actions.test.ts`: the staged deploy refusal.
  - `src/dashboard/shell/__tests__/shell-feed.test.ts`: seven messages, `controller-deploy` last (the exact list at `:359-361` changes), and `pushDeploy`.
  - `src/dashboard/shell/__tests__/deploy-view.test.ts` (new): imports `pause.ts`, `deploy.ts` and `retry-delay.ts` from the frontend tree, because the root vitest config skips that tree (`vitest.config.ts:8-9`). Probe 2026-11-05: vitest imported `pause.ts` this way. `tsc` covers this test (`tsconfig.json:19-20`), so those modules stay free of DOM types.
- **Script:** `src/__tests__/service-scripts.test.ts`, on `makeDivergedCheckout` and `stageBuildStub` (`:49-76`), with a stub directory first on `PATH` holding `systemctl` and `npm`: the toy `package.json` has no lockfile, so a real `npm ci` stops the script at `scripts/sdd-self-update.sh:299`. No test may reach the real `systemctl`. Cases: stage sequence, `commit`, no-op refusal, each failure stage, TERM, claim refusal, a record not recreated, dry-run, flag absent, and the 3-second gap (the stub records the time).
- **Integration:**
  - `src/dashboard/__tests__/controller-dashboard-routes.test.ts`, with `deployUnit` passed to the server: route status codes.
  - `src/controller/__tests__/deploy-e2e.test.ts` (new, after `liveness-e2e.test.ts`): scenarios 1 to 6 with a real `Controller`, a temp `SDD_HOME` and the real script in a toy checkout, under a `DeployUnit` that spawns the script as a child. Scenario 1's restart stops one `Controller` and starts another on the same home; scenario 5 runs both cases of the requirements' scope note.
- **End-to-end:**
  - `e2e/worktree-deploy.spec.ts` (new, seeding as `e2e/worktree-shell.spec.ts:417-444` does): seeded `deploy.json` and `run.json` show the strip, the disabled reason, cancel by stage, "held for deploy" and no Resume; `page.route` stubs the POSTs.
  - Live: the six entry scenarios need real systemd and a real restart, and the running service has no Deploy route until this build is deployed by hand. They stay `pending` under a tracked `verification-evidence.md`, one line per scenario, as `.spec-workflow/agent-rules.md` requires. The 10-second reconnect is proved only there.

## Decisions taken in this document

- D13 — Unit name and how a second press finds it: a fixed name, a per-press name stored in the record, or a pid file; chosen fixed because systemd then refuses a duplicate and a press or restart needs no stored state.
- D14 — Time limit on the controller's wait: 30 minutes, 2 hours, 5 hours, or none; chosen 5 hours because no step has a timeout, 1 percent of the 202 ledgered spawns ran over 259 minutes, and the operator can cancel throughout. The script's 30 minutes stays; the holds leave it only stragglers.
- D15 — How a cancel and the swap exclude each other: a one-shot atomic claim, ignoring the signal from the swap on, or a blocking file lock; chosen the claim because after it no stop is sent, so nothing has to survive one, and a crash leaves no waiter.
- D16 — The tick while a cancel holds the deploy lock: skip, or wait; chosen skip because a wait stalls the scheduler for as long as the stop takes.
- D17 — What counts as quiet: live steps, or live steps and active drives; chosen both, because a drive between its stop check and its step, or in a merge, has no live step and would trip the script's first refusal.
- D18 — How a stage reaches the page: arm the throttled feed, or send the one message at once; chosen at once because tick plus throttle already uses the two seconds.
- D19 — A press that finds a finished record and a live unit: refuse, or replace; chosen refuse because the new unit could not start under the same name.
- D20 — Open verification deferrals on the strip: add, or leave out; chosen leave out because the strip reads only the record and the Deferrals page lists them.
- D21 — Order on start: finish the deploy before crash recovery, or after; chosen before, so recovery sees released runs and an answered wait resumes on the normal path.
- D22 — How holds are written: read-then-save, or an update inside the per-run write chain; chosen the chain because a stale write could revert a driver's park.
- D23 — Resume and launch against a press: read the record outside the lock, or take it; chosen take it, because otherwise a run can slip past the hold list.
- D24 — Deploy holds with no record: leave, or release on the tick; chosen release because Resume refuses such a run and nothing else frees it.
- D25 — Script failure text: the last log line after the stage name, or an edit at every refusal site; chosen the log line because it leaves the checks the entry keeps untouched. Error-wait failures use a fixed note, since the eval summary can hold a path.
- D26 — Proof of the live scenarios: an evidence file after a hand deploy, or a suite test on real systemd; chosen the file because a suite must never restart the operator's service.

## Scope notes

The requirements' "left to the design" list is answered by D13, D14, D16 and D20. Nothing was carried from the requirements phase.

Cut: the deferrals line on the strip, which the entry poses as a question (D20).

Departures from a requirement's literal:
- R1 AC4: the unit also waits for active drives (D17).
- R1 AC1, AC10: a press with no open record answers 409 while the unit is live (D19).
- R5 AC1: a record at `gate` answers 409 when the script holds the claim (D15).
- Performance NFR: a stage is sent directly, not by arming the feed (D18).

## Revision History

- **v1** (2026-11-05) — Initial draft.
