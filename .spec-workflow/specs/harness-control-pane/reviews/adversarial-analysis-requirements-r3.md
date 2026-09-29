# Adversarial Analysis — harness-control-pane/requirements (v3)

Round 3. Primary attack surface: completeness, ambiguity, scope. Fresh lens (per the
prompt): failure, rollback and partial-failure paths — what the ACs say, and do not say,
when a launch, stop, worktree setup, file delete, pointer-line rewrite or dashboard
restart half-completes or races a terminal run.

## What I checked and how

**Delta first (v3 dispositions R2-1, R2-2, R2-3).** I re-read both ends of every range the
v3 delta touched and confirmed the three fixes are correct and introduced no new
contradiction:

- **R2-1 (scope note citation `754-755`).** `spec-decomposition/decomposition.md:754-755`
  reads "…Spec 9 renders `RunModel`; it adds no / ledger field.…" — the quoted phrase
  "it adds no ledger field" now spans the cited range exactly, and line 753 (the unrelated
  spec-2 execution-context note) is no longer pulled in. The `665-667` / `711` authority is
  still correct (665-667 = "The supervisor honours it… records the overrides on `run.start`";
  711 = "`run.start` appears… and carries the override"). Fixed, clean.
- **R2-2 (restored demux constraint).** AC 4.9 now reads "distinct from the existing
  `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294)"; AC 5.10
  now reads "each with a type field distinct from `initial` and `projects-update`" and still
  enumerates its two payloads ("overview rows and the todos list"). Verified
  multi-server.ts:205-294 carries `type:'initial'` (231, 279), `type:'projects-update'` (246)
  and the `subscribe` message (266). The dropped per-payload source-AC cross-refs
  (`(AC 4.2)`, `(Requirement 3 AC 5)`, `(AC 4.5)`) leave no dangling reference — the three
  types are still named in prose. Partial acceptance is sound.
- **R2-3 (run-model/gate pushes keyed on subscription state, not `broadcastToProject`).**
  `broadcastToProject` (multi-server.ts:2139-2151) filters on
  `connection.projectId === projectId` alone (2143); it cannot restrict to harness
  subscribers, so AC 4.9's rewrite is accurate. No contradiction with AC 4.7/4.8. Fixed.

The delta is clean. The findings below come from the fresh lens, applied to code I read at
both ends: `harness/skills/sdd-continue/SKILL.md:83-96` (provider preflight refusal),
`:100-129` (pointer append), `:331-345` (worktree rule), `:486-500` (deregister step),
`harness/hooks/sdd-activity.sh:1-31` (pointer file is machine-wide and shared),
`src/dashboard/adversarial-runner.ts:156-220` (cited spawn pattern) and `:250-254`
(shutdown kill), `src/dashboard/multi-server.ts:2139-2151` (`broadcastToProject`).

## Findings

### R3-1 — The log-lines push has no routing constraint, while R2-3 tightened only the run-model and gate pushes — SHOULD_FIX (Compounding: R2-3, first raised R1-2)

AC 4.9 lists three server→client push types ("one for the run model, one for a batch of new
log lines, one for the gate sections") but applies the harness-subscriber-only routing to
just two of them: "the **run-model and gate pushes** SHALL reach only that project's harness
subscribers, keyed on the AC 4.8 subscription state, not `broadcastToProject`, which filters
on `projectId` alone." The **log-lines push is left with no routing rule.** AC 3.5 says only
"stream the new log lines to that project's open Harness pages over the existing websocket" —
intent, not mechanism.

The R2-3 fix (v3) rewrote AC 4.9 specifically because `broadcastToProject` fans out to every
same-`projectId` connection, including Specs tabs. Leaving the log push outside that fix
reopens the exact hole for the log stream: an implementer routes log lines through the one
helper the AC still names (`broadcastToProject`) and every open Specs tab on that project
receives a flood of harness log-line pushes it never subscribed to (needless traffic, and a
client error if the Specs handler is not defensive about unknown types). Log output is the
highest-volume of the three push types, so this is the worst channel to leave unrouted.

Fix: bring the log-lines push under the same "harness subscribers only, keyed on the AC 4.8
subscription state" rule as the run-model and gate pushes.

### R3-2 — The pointer-line rewrite is required to match the deregister step, but the doc never requires it be safe against a concurrent writer on the machine-wide shared file — SHOULD_FIX (Novel)

`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run` is **one file shared by every SDD run on
the machine** — "one tab-separated line per active run … so concurrent runs in other
checkouts keep their own lines" (SKILL.md:104-106) — read by the activity hook for *all*
runs (sdd-activity.sh:11-25). The supervisor's deregister step goes out of its way to warn
that this file is shared and must never be rewritten unsafely: it forbids `grep -v` because
it "can splice summary text into the file a concurrent session shares" and mandates the
`deregister.mjs` node helper that "drops the line whose run id is this run's"
(SKILL.md:494-500).

AC 3.10 and AC 3.13 now add a **second, independent writer** (the dashboard) that removes a
line from this same file on Stop, "the same rule as the supervisor's deregister step
(…SKILL.md:488-500)." But "the same rule" describes the *behaviour* (drop one line, delete
when empty); nothing in the requirement states the dashboard's rewrite must be atomic or
otherwise safe against a **concurrent** append (a terminal run starting, SKILL.md:104) or a
concurrent deregister (another run ending) that races the dashboard's read-modify-write.

Failure scenario: the dashboard reads the file to drop its own line at the same moment a
terminal supervisor appends a new run's line (SKILL.md:104); the dashboard writes back the
version it read, silently dropping the just-appended line. That run's activity hook then
finds no matching line and goes silent (sdd-activity.sh:12,26) — precisely the corruption the
memory rule "never delete active-run pointer lines for run ids I do not own" exists to
prevent. Fix: require the dashboard to reuse `deregister.mjs` (or an equivalent atomic
single-line removal) and state the rewrite is safe against a concurrent append/removal by
another run.

### R3-3 — No liveness reconciliation on dashboard restart or after a half-completed stop; a dead run shows as running with a live Stop — SHOULD_FIX (Novel)

AC 3.8 (admission) refuses a launch when "the project has a live dashboard launch record
**whose process still exists**" — so the admission path *does* check pid liveness. But the
restore path does not: AC 3.12 says only that after a restart the dashboard "SHALL read the
launch record back so the page shows the run, its log and a working Stop." It never re-checks
whether the recorded pid/pgid is still alive.

Two concrete partial-failure paths are left unhandled, and D4 makes restart routine ("the
dashboard restarts after each build"):

1. **Run died while the dashboard was down.** The child self-exits or is SIGKILLed while the
   dashboard is stopped; the `close` event that AC 3.11 relies on to "show the exit code" is
   missed. On restart AC 3.12 re-shows the run as running with a Stop button — a zombie row
   that never resolves, because no AC reconciles the launch record against actual process
   state on restart.
2. **Stop crashed mid-sequence.** AC 3.10 does four things on Stop (append `run.end`, remove
   the pointer line, delete `harness-run.json`, mark stopped) with no ordering or idempotency
   stated. If the dashboard dies after SIGTERM but before removing the pointer line, the
   stale line remains; AC 3.7 then refuses every future launch of that spec ("pointer line
   whose spec dir is inside this project's spec store"), with no documented cleanup. Pressing
   Stop again only helps if the page still offers Stop and the operator knows to.

Fix: on restart, reconcile each launch record against process liveness (the same check
AC 3.8 already performs) and drive a dead-but-unfinalised run through the AC 3.10 finalisation
(or surface it as exited); state that AC 3.10's steps are idempotent and safe to resume.

### R3-4 — Launch has no error or rollback path when worktree setup, worktree creation or the spawn fails — SHOULD_FIX (Novel)

The launch sequence (Req 3) is multi-step: AC 3.3 creates a `feat/<spec>` git worktree "(or
reuse it)" and runs the agent rules' `worktree-setup` command (`npm ci`, agent-rules.md:6)
once, then AC 3.4 spawns the detached child and writes a launch record. **No AC covers any
step failing.** The cited spawn reference itself shows the failure modes exist — spawn
`ENOENT`, non-zero exit, timeout (adversarial-runner.ts:196-218) — yet the requirement is
silent on all of:

- `worktree-setup` (`npm ci`) fails (offline, lockfile drift): the child is spawned into a
  worktree with no `node_modules` and fails immediately, or is not spawned at all. The
  operator sees nothing actionable; the requirement names no error surface.
- git worktree creation fails partway (dirty branch, existing `feat/<spec>` from a prior
  failed launch): "or reuse it" (AC 3.3) then **reuses a worktree whose `npm ci` never
  succeeded**, so every subsequent launch inherits the broken tree.
- the `claude -p` spawn errors (AC 3.4): no launch record cleanup, no operator-visible
  reason.

Fix: state what the operator sees on each launch-step failure, whether a freshly created
worktree/branch is torn down or left for reuse, and the validity bar a reused worktree must
meet before it is reused.

### R3-5 — A run refused at the provider preflight orphans `harness-run.json`, and the file then blocks every future run of that spec — SHOULD_FIX (Novel)

AC 2.10 deletes `harness-run.json` only "WHEN a run that applied the file **ends**" — i.e.
when `run.end` is written. But AC 2.6 refuses a run "before any ledger row on a failed
validation, as SKILL.md:85-96 does," and that path writes **no** `run.start` and **no**
`run.end`: "no run id, `event.sh`, pointer line or `run.start` exists" (SKILL.md:87-90). So a
preflight-refused run never reaches AC 2.10 and the file is never deleted.

The refusal is reachable even from a form-written file: AC 1.6/1.8 validate the file's own
values at save time, but AC 2.6 re-validates the **merged** map (file provider/model over the
agent-rules `## Providers` map). If the agent-rules map changed after the file was saved, or a
required provider key is unexported (SKILL.md:91-94, exit 3), the merged map fails where the
file alone passed. The invalid file then persists and AC 2.1 re-applies it on every
subsequent run of that spec — terminal *and* page — so each run re-refuses at preflight. A
terminal-only operator has no way to clear it short of manually deleting the file (the page
operator can re-save via AC 1.11, but the doc never says so). Fix: delete or quarantine
`harness-run.json` on an AC 2.6 refusal, or state the recovery path.

### R3-6 — The "one live run per spec store" invariant has a check-to-spawn race the admission ACs do not close for a concurrent terminal run — SHOULD_FIX (Novel)

The decomposition calls the pointer file "the lock the route checks" (decomposition.md:673-674)
and the doc enforces one live run through AC 3.7 (refuse if a pointer line names this spec
store) and AC 3.8 (refuse if a live launch record's process exists). But the pointer line is
written **seconds after** spawn, by the spawned supervisor (AC 3.6 / SKILL.md:104), not at
admission. AC 3.8 closes the dashboard-vs-dashboard window (same single-threaded process), but
a **concurrent terminal launch** (`continue the sdd process`, typed by the operator) checks
neither the dashboard's launch record nor anything else the dashboard wrote — it only appends
its own pointer line. So a page Launch and a terminal launch of the same spec, issued close
together, both pass admission (pointer file empty, no dashboard launch record) and both start:
two `run.start` rows, two supervisors, competing worktree and ledger writes on one spec store.

This is the fresh lens's "races a terminal run" case for the launch path. Fix: state how the
single-live-run invariant holds against a terminal run that starts inside the dashboard's
check-to-pointer-line window (e.g. an atomically created lock the terminal supervisor also
respects), or scope the invariant to dashboard-initiated launches and say terminal races are
out of scope.

### Minors (do not keep the loop alive)

- **AC 3.2 cites a 65-line pattern whose timeout and shutdown-kill contradict D4.** AC 3.2
  says "use the child-process pattern of adversarial-runner.ts:156-220." The three attributes
  it enumerates (scrubbed git env 176, `cwd` 168, both root vars 177-178) are accurate, so the
  citation is not misstated. But that range also contains a 10-minute SIGTERM timeout (185-188),
  and the same runner kills every child on dashboard shutdown (250-254, outside the range) —
  both the opposite of D4's hours-long run that "survives a dashboard restart." A literal
  reuse of "the pattern" breaks D4. AC 3.4 (detached, file-logged) already overrides the
  spawn's stdio/attachment, so a careful reader is bounded; state that the timeout and
  shutdown-kill are *not* adopted. MINOR.
- **A page Launch silently overwrites a saved terminal setup.** AC 3.1 re-saves
  `harness-run.json` "with the gates choice set to record." A prior Save made for a terminal
  run with gates `block` (D6 says the form's gates choice applies to terminal runs) is
  clobbered by any page Launch. Probably intended; state it. MINOR.
- **AC 3.10 file delete idempotency.** On a stop that races a clean self-exit, the supervisor
  may have already deleted `harness-run.json` (AC 2.10) and removed the pointer line; AC 3.10
  then deletes an already-gone file and removes an already-gone line. The AC 3.10 guard "when
  it has a `run.start` and no `run.end`" prevents a double `run.end`, but the file/line steps'
  idempotency is unstated. MINOR.

## Closing deliverables

### Top 5 risks / gaps

1. The dashboard becomes a second concurrent writer of the machine-wide `active-run` pointer
   file, but the requirement never mandates a concurrency-safe rewrite; a race with a terminal
   run's append can drop a live run's line and silence its activity hook (R3-2).
2. No liveness reconciliation on restart or after a crashed stop: a dead run shows as running
   with a live Stop, and a stale pointer line blocks every future launch of the spec (R3-3).
3. Launch is a multi-step sequence (worktree create, `npm ci`, spawn) with no failure or
   rollback path; a failed `npm ci` leaves a broken `feat/<spec>` worktree that "reuse it"
   then reuses (R3-4).
4. The log-lines push — the highest-volume channel — is left without the harness-subscriber
   routing that R2-3 just added for run-model and gate pushes, reopening the fan-out hole for
   logs (R3-1).
5. A preflight-refused run orphans `harness-run.json`, which then re-refuses every future run
   of that spec with no documented cleanup for a terminal operator (R3-5).

### Top 3 conclusions to challenge or reverse

1. **AC 3.13 "the same rule as the supervisor's deregister step" is sufficient.** Reverse: the
   supervisor's own step exists *because* the file is shared and fragile (it bans `grep -v` and
   mandates `deregister.mjs`); copying the behaviour without the concurrency guarantee, from a
   new independent writer, is the gap (R3-2).
2. **AC 3.12 "read the launch record back… a working Stop" makes a run recoverable after
   restart.** Challenge: recovery needs the liveness check AC 3.8 already performs on
   admission but AC 3.12 omits on restore; without it the page shows zombies and the exit code
   AC 3.11 promises is lost (R3-3).
3. **"One live run per spec store" is enforced.** Challenge: the lock (pointer line) is written
   after spawn by a different process, so the invariant holds only against launches the
   dashboard itself serialises, not against a concurrent terminal run (R3-6).

### What's missing — do before acting on this document

- A failure/partial-failure section for Req 3: what the operator sees and what state is
  cleaned up when worktree setup, worktree creation, or the spawn fails (R3-4); when a stop
  half-completes (R3-3); when a run is refused at preflight (R3-5).
- A concurrency statement for the shared pointer file: atomic single-line removal safe against
  a concurrent append/removal (R3-2), and how the single-live-run invariant survives a
  terminal race (R3-6).
- Extend the AC 4.9 harness-subscriber routing rule to the log-lines push (R3-1).

ESCALATE: none. R3-2 touches machine-local run state on a shared file, not user data,
secrets, auth, money or migrations; it is a robustness gap in the requirement, not a live
security or data-loss incident. (D10's reuse of the existing binding/rate-limit/audit hooks
for a permission-skipping headless `claude` was reviewed and accepted in round 1; no new
security surface in the v3 delta.)

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 6
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
