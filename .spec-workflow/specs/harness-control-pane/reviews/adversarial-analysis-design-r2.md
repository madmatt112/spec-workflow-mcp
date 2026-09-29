# Adversarial Analysis — harness-control-pane/design (v2)

Round 2. Primary surface: feasibility, consistency, edge cases.
Fresh lens for this round: failure, rollback and partial-failure paths — concurrency
and failure behaviour (Req 2.6, Req 3.10–3.14). Round 1 used the wire-contract lens.

## Deltas attacked first (v2 Revision History)

The v2 delta is the round-1 response: R1-1 (log re-point), R1-2 (provider-merge post-merge
pass), R1-3 (harness/ checks), R1-4 (subscribe-handler snapshot), R1-5 (SetupView/OverviewWatch
prose), R1-6 (supervisor-floor note), plus the D1–D16 and Scope-notes compression and the v2
lint bullet. I read both ends of every citation the delta touched.

## What I verified in the code (both ends of the delta citations)

- **R1-2 fix (C9 `sdd-providers.sh`).** Read the whole script
  (harness/skills/sdd-continue/references/sdd-providers.sh). Every line the delta names is
  correct: `none()` on unreadable file at :35, `none()` on no `## Providers` heading at :41,
  the inline per-row checks (eligibility/provider/model/dup) at :54-64, and `none()` on zero
  parsed rows at :66. The design's "merge then validate over the union, short-circuits do not
  fire with a RUN_FILE" restructure is grounded and correctly resolves R1-2. No citation error.
- **C4 Carried R3-minor-1 reword.** `JOB_TIMEOUT_MS = 15 * 60 * 1000` at adversarial-runner.ts:46;
  the "timed out after 10 minutes" string at :187; `runAgent` arg/env pattern at :156-180;
  `shutdown()` at :250-254; the `adversarialRunner.shutdown()` call at multi-server.ts:2271. All
  resolve. The "15-minute constant / error text says 10" claim is accurate.
- **Finalise citations.** `run.end` row shape via formats.md:178 (the `{ ts, run, spec, type }`
  event object) and the `run.end` `status` key at :194 are correct. `removePointerLine` ports
  formats.md:266-281 (`deregister.mjs`): read → filter on the 3rd tab field (`split('\t')[2]`) →
  `rmSync` at zero lines → temp+rename. The read→rename append-race the Scope note discloses is
  real in that helper. No citation error.
- **Data Models completeness (delta targets).** `SetupView` is fully enumerated (specs, routing,
  handoff, launchable, disabledReason, supervisor, roles, worktree, gates, modelAliases,
  deepseekModels, eligibleRoles, saved) — the C3 prose the delta added names a subset of those
  pinned fields, no union-only object. The log-watch reset payload `harness-log.data` pins
  `{ launchedAt, lines, reset }`, so `launchedAt` is present. Both delta targets pass.
- **Library-capability lens.** The delta added no new library-API claim; it reworded the
  round-1-verified probe (node detached spawn; `claude --help` 2.1.284 flags). Nothing new to
  probe. Passes.

No MUST_FIX in the delta: every reworded citation still points at the cited behaviour.

## Findings

### R2-1 (SHOULD_FIX) — Novel, carried. Launch admission is not atomic with the in-flight mark: a launch race double-spawns
Fresh lens (concurrency). The single-live-run invariant rests on `admission()` plus C4
Launch step 1 "Mark the project in-flight." But C7's launch route runs them with an await
between: "then validates, **admits**, **writes** and **launches**." `admission(project)` is a
distinct route step; `writeRunFile` (C3, temp+rename, async) is awaited next; only then does
`launch()` run its step 1 in-flight mark. Two concurrent `POST …/harness/launch` for one
project (two dashboard clients, or a double-submit) interleave: request A passes `admission`
(no in-flight, no record, no pointer line — the child has not written its pointer yet) and
awaits `writeRunFile`, yielding; request B passes `admission` (A has not marked in-flight yet)
and yields; A resumes into `launch()`, marks in-flight, spawns; B resumes into `launch()`,
marks in-flight (over A's), spawns a **second** detached supervisor.

Failure trace: two supervisors on one project write two `run.start` rows and two pointer
lines to the same spec store, operate the same `feat/<spec>` worktree with colliding git ops,
and both overwrite `launches/<projectId>.json`; the launcher's in-memory record holds only the
second, so Stop can target only one child and the other is an orphan. There is **no** stated
recovery for this path. Pin the fix so `launch()` owns the guard: check-and-set the in-flight
flag **synchronously in its own prologue, before any await** (and treat the route's `admission`
as advisory), so two `launch()` calls cannot both pass. This is an ordering fix, not net-new
prose — no word growth.

### R2-2 (SHOULD_FIX) — Compounds: R1-1, fix-induced. The log re-point fires on every launch-update, not only on a new launch
Fresh lens (failure/UX regression from the R1-1 fix). The R1-1 requirement was: on a **new
launch** re-point the log watch so the second run streams. The v2 fix over-generalised the
trigger. C5: "**On a launch-update** the watch re-derives `logPath` …, resets the byte offset
to 0, re-arms the file watch on the new file and sends a `reset: true` batch." C7 echoes it:
"A `launch-update` … re-points its log watch (C5)." But `HarnessLauncher` "emits 'launch-update'
(LaunchRecord)" on every record write — at spawn, on `stopping`, on `stopped`/finalise, and on
own `exit` — not only at a new launch.

Failure trace: within one run, `logPath` is unchanged, yet each of those emits unconditionally
"resets the byte offset to 0" and "sends a `reset: true` batch." The client keys its buffer on
`launchedAt` and only **drops** a batch whose `launchedAt` **differs**; within a run the
`launchedAt` is identical, so the reset batch is **not** dropped — it replaces every harness
client's log buffer. So each Stop, exit and finalise re-reads the whole launch log from offset 0
and re-broadcasts it, resetting all clients' views — and "Logs are not pruned" (Scope notes),
so that re-read is unbounded and lands right at run end when the log is largest. This partly
defeats the R1-1/R1-4 intent (do not reset an existing client's log view). Pin: re-point/reset
**only when `logPath` differs** from the currently watched path (e.g. "On a launch-update that
changes `logPath`, the watch …"). Word-neutral; drop the now-redundant "on the new file".

### R2-3 (MINOR) — Novel, carried. The record is written only on the 'spawn' event; a launcher crash in that window leaves an untraced orphan
Fresh lens named "a launcher crash between spawn and record-write." C4 step 4 writes the
`LaunchRecord` only "On the `spawn` event." `restore()` — the stated crash recovery — reconciles
from records on disk, so a dashboard crash between the child spawning and the record write leaves
a live detached child with **no** record: `restore()` cannot reattach or finalise it, and its log
is orphaned. The child self-heals (it writes its own `run.end` and `deregister`s at completion),
and the window is tiny, so impact is low — but it is an untraced partial-failure path the lens
called out, and it also opens a brief double-launch window (re-launch after crash, before the
orphan writes its pointer). One scope-note sentence, or writing an intent record before spawn,
closes it.

## Paths traced clean (no finding)

- **`run.start` with no `run.end`** — handled: Finalise step 2 appends `run.end` "stopped from
  the dashboard" only when the run has a `run.start` and no `run.end`; idempotent, so a
  supervisor that wrote its own `run.end` is not doubled. Finalise runs only once the process is
  confirmed gone, so it does not race the child's ledger writes.
- **Stale pointer line** — disclosed in Scope notes (blocks launch via the 409 until the
  operator removes it). Operator has no in-product clear (Stop 404s with no record), but this is
  explicitly out of scope.
- **Worktree setup failure** — Launch step 5 cleans the run file and empty log; the orphan
  worktree is reused on the next launch with setup re-run (closed Req 3 AC 14 ruling). Traced.
- **Reused-pid after reboot** — D7's command-line check prevents SIGKILL of a reused pid; a gone
  reattached run is finalised with run id recovered from the ledger. Traced.

## Top risks / gaps (3)

1. **Launch race double-spawn (R2-1).** The single-live-run invariant has a check-then-act
   window; two clicks can put two supervisors on one worktree/ledger. No recovery stated.
2. **Log reset storm (R2-2).** The R1-1 fix resets every client's log view and re-reads the
   whole unpruned log on every stop/exit/finalise, not just on a new launch.
3. **Spawn→record crash window (R2-3).** An orphan child `restore()` cannot see; low likelihood,
   untraced.

## Top 3 conclusions to challenge

1. **"admission enforces one run per project."** It does not, as sequenced: the guard set moves
   after an awaited write. Make `launch()` own an atomic check-and-set.
2. **"re-point on launch-update."** `launch-update` is the wrong trigger — it fires several times
   per run. Trigger on a `logPath` change, not on any record emit.
3. **"the launch is durable once spawned."** Durability begins only at the 'spawn'-event record
   write, not at spawn; the gap is untraced.

## What's missing before implementation

- An atomic admission→in-flight guard inside `launch()` (R2-1) and a launcher-level test that two
  concurrent `launch()` calls yield one child.
- The `logPath`-change condition on the log re-point (R2-2).
- A scope note (or pre-spawn intent record) for the spawn→record crash window (R2-3).

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
