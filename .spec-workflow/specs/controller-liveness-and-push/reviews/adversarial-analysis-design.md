# Adversarial Analysis — controller-liveness-and-push/design (v1, round 1)

First review. Primary surface: feasibility, consistency, edge cases. Fresh lens: none specified.

## Verification coverage (what I checked and how)

I read both ends of every cited range against the worktree code
(`/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push`).
Every artifact the design cites resolves exactly as stated. Spot-list:

- **C1/C3 write chain:** `writeChains` (state.ts:415), `writeRunLocked` (417-433, conditional
  disk read at 423-425), `writeJsonAtomic` (336-341), `RunRecord` (70-109). Correct.
- **C2 step seam:** `StepSpec` (step.ts:94-135), the parsed-object branch (446-448, calls
  `handleEvent` — heartbeat `line()` goes before it), leftover-buffer `handleLine` in `finish`
  (466-469), spawn-error handler `settled=true` (509-511). Correct.
- **C3 wiring:** all six `...stepLifecycle(deps, run.id)` spreads (runs.ts 753, 963, 984, 1015,
  1033, 1319) — confirmed by grep, so "no call site in runs.ts changes" holds; `stepLifecycle`
  (436-447); document context `onStepEnd` (185) and StepSpec build (377-396); `runEvents` (57);
  `opinion.ts:154` is outside any run. Correct.
- **C4 wire row:** `ControllerRunRow` (runs.ts:1410-1427), `toRow` (1429-1438), `listRunsForWire`
  (1441-1444); ShellFeed opts (shell-feed.ts:41), flush→`listRunsForWire` (117); hub `new ShellFeed`
  (hub.ts:98), opts (44); GET route (multi-server.ts:809-811). **Grep confirms the only two
  production `listRunsForWire` callers (810, shell-feed 117) and the only production `new ShellFeed`
  (hub 98) — the driven-set wiring enumeration is complete.** Server `ControllerRun` (types.ts:194-210)
  does lack `pauseRequested`; frontend (215-233) has it. Correct.
- **C5 controller:** `active`/`drives` (controller.ts:75-78), `reattach` add (321), drive `catch`
  (428-429), startDrive `.finally` (419), `recover` (304-317), `reattach` (320-332), `onWaitChange`
  (438-466, state!=answered return at 439, status!=waiting return at 449-450), `save` (599-606),
  `runDeps` (512-528), `mcpConfigFor` option (54), `resumeNow` (240-267), `settlePass` (381-396).
  Correct. `PathUtils.getSpecPath(specStore, spec)` matches the real call at runs.ts:830.
- **C6 waits:** `ControllerWaitRecord` (waits.ts:38-43), `createWait`/`answerWait` (87-141),
  `listOpenWaits` (187-190), `listWaitsForView` (193-198, filters open|answered so `expired` is
  hidden), `enqueueWaitWrite` (73-84). Correct.
- **C7/C10 routes & routing:** resume route (multi-server.ts:832-838), app-level `onRequest` hooks
  (275-282), `harnessNotLaunchable` (79-87) and `validateSetup` (265-267) both compare `view.launchable`,
  the guard (run-setup.ts:197-199), launchable/disabledReason (200-201), `nextUnstartedSpec` (223-232),
  `RoutingState` 5-member union (spec-routing-deriver.ts:8-18), all-on-disk-complete reason (96-106),
  `launchSpec` folder creation (multi-server.ts:118-120). `RunsPage.tsx:406` reads `launchable`. Correct.
- **C8/C9 pusher:** `pushConfigPath` (home.ts:39-41), `pushState` (summary.ts:93-100, today only
  `fs.access` → the design's switch to `readNotifyConfig` is a genuine fix for the malformed-file
  disagreement), `WaitPusherOptions` (push.ts:48-51), queue `enqueue` (145-152), `runStartupScan`
  loop (166-172) and first-start branch (155-163), `handleWait` (175-186), `attemptPush` (188-204),
  `postOnce` (206-217), prune (104-111). `WaitKind` values are all ASCII (state.ts:140-147).
  `readProjects` (504-506), `isProcessAlive` (612-615). Correct.

No misstated artifact. The write-chain, throttle, driven-set, crash-wait and re-drive reasoning
are internally consistent (details below). This is a strong document.

## Topics attacked

### 1. Message redaction vs. the "no path" requirement (C9, D12, NFR Security)

- **Challenge the claim that D12's redaction satisfies Requirement 4 AC 3.** C9 states plainly:
  "a relative path and an `https://` URL are not [redacted]." Yet D12's own rationale says "the
  requirement bans paths" and AC 3 says the message carries "no path." The implementation redacts
  only absolute and `~/` paths of two-plus segments; a relative path in a question's first line
  reaches the phone unredacted. The design contradicts its own stated intent and the AC.
- **Stress-test the failure case.** A gate/question/escalation wait — not only a crash wait — can
  carry a relative path in `questions[0].text`. First line "Review the change to
  src/controller/step.ts and approve" POSTs verbatim: no absolute path, so `[path]` never fires,
  and `src/controller/step.ts` leaves the machine. That violates AC 3 and NFR Security "nothing
  else from the wait" for every wait kind, not just the crash path D12 reasons about.
- **Note the blast radius is bounded:** the real secrets (ntfy topic, token) are never in the body
  and never logged (NFR Security, honored throughout), so this is a requirement-compliance and
  info-hygiene gap, not a credential leak — SHOULD_FIX, not MUST_FIX.

### 2. The ntfy header/body contract is unconfirmed (C9 UNCONFIRMED, D11, Scope "Open item")

- **Confirm the deferral is honestly tracked, then test its mitigation.** C9 and Scope notes both
  record that `docs.ntfy.sh/publish` could not be read, so `Title`/`Priority`/`Authorization: Bearer`,
  the priority value and any body-size cap are provisional. **I independently hit the same wall: a
  WebFetch of the ntfy docs is denied in this environment too.** So the design did the only thing it
  could: ship provisional values, defer to the push task with a hard "read the page first, stop and
  escalate on disagreement" gate, and assert tests prove only what the sender emits.
- **Stress-test the gate.** This only holds if the push task runs in an environment where the docs
  *are* reachable; if that environment also blocks the fetch, the gate cannot fire and the task
  either ships blind or stalls. The design does not say where/how the task obtains doc access.
- **Verdict on this item:** the design already records it as an Open item and Requirement 4 AC 4's
  "before it is pinned" is met by the provisional-then-confirm flow (nothing is pinned here). This
  is a tracked, operator-visible deferral — surfaced for sign-off, not counted as a fresh defect.

### 3. The crash-wait → driven-false timing (C5, D6, Requirement 2 AC 5)

- **Stress-test the transient `waiting`+`driven:true` emit.** `openCrashWait` runs inside the `catch`
  (controller.ts:428-429) while `active` still holds the run, so its `this.save({status:'waiting'})`
  emits a `runEvents` change with `driven:true`. Then `drive`'s `finally` (431) clears `active`,
  and startDrive's `.finally` (419, per D6) emits again with `driven:false`. Because C4 reads
  `drivenRuns()` **live at flush time**, any coalesced feed flush after the `finally` reports
  `driven:false` — the row cannot stick at `driven:true`. AC 5's "within 5 seconds" holds. Sound.
- **Check the double-drive guard.** `startDrive` short-circuits on `active.has || drives.has`
  (418), so a scheduler tick firing during `openCrashWait` cannot start a second drive; the
  `running` run is also not `isStartable`. No race-loser branch needed. Sound.

### 4. Heartbeat throttle and the step-end clear (C1, C3, Requirement 1 AC 3/4/6/7)

- **Stress-test "no write lands after exit."** `end()` cancels the window timer and enqueues
  `write(undefined)` on the same per-run `writeChains`; `line()`/`end()` become no-ops afterward.
  The leftover-buffer `handleLine` (step.ts:467) runs before `end()` (C2), so the last line is
  recorded then dropped. Serial chain + terminal-status guard in `writeLastActivity` means a
  heartbeat can never resurrect `lastActivity` on a `done`/`error` run. AC 4/6/7 hold. Sound.
- **Check the cadence.** Writes land at t=0 (first line), then at each 10 s window end only if a
  line was recorded; an idle window closes with no write and the next line re-opens one. Max
  staleness < 10 s, no idle writes. AC 3 holds. Sound.

### 5. Launch-routing broadening (C10, Requirement 6)

- **Confirm `!== 'active'` names exactly the four states.** The union has five members
  (spec-routing-deriver.ts:8-18); `routing.state !== 'active'` = {ambiguous, all-on-disk-complete,
  all-deferred, no-specs}, matching Requirement 6 AC 1. `launchable`/`disabledReason` (200-201)
  and both consumers (`harnessNotLaunchable` 79-87, `validateSetup` 265-267) read `view.launchable`,
  so broadening flows with no extra site. Sound.

## Top risks / gaps

1. **R1-1 (SHOULD_FIX, Novel).** C9/D12 redaction leaks relative paths (and `https://` URLs) in the
   message body, contradicting Requirement 4 AC 3 / NFR Security "no path" and D12's own rationale.
   Applies to every wait kind, not just crash waits.
2. **R1-2 (MINOR, Novel).** Config-read TOCTOU: the recording step reads `notify.json` to arm
   `firstPush`/`reminded`, then `attemptPush` reads it again. If the file appears/disappears between
   the two awaits, a wait can be POSTed without arming its reminder, or arm a reminder that becomes
   the first message seen. Vanishingly rare; worth one sentence in C9.
3. **R1-3 (MINOR, Novel).** The ntfy deferral (topic 2 above) assumes the push task runs where
   `docs.ntfy.sh` is reachable. The fetch is denied in both the drafting and this review session;
   if it is also denied for the task, the C9 gate cannot fire. State where the task gets doc access.
4. **R1-4 (MINOR, Novel).** C1 cites `RunRecord` at `state.ts:70-109`; Requirement 1 AC 1 and the
   context file say `69-109` (the doc-comment line). The interface body is 70-109, so the citation
   resolves — cosmetic only.

## Top 3 conclusions to challenge or reverse

1. **"a relative path ... [is] not [redacted]" (C9).** Reverse or justify. As written it defeats
   AC 3's "no path" for the common case where a question quotes a repo-relative file. Widen the
   redaction to any path-shaped token (a segment with `/` and a file extension), or have D12
   explicitly scope "no path" to absolute/`~` and get that scope accepted against AC 3.
2. **"The task ... SHALL read that page first" closes Requirement 4 AC 4 (C9/Scope).** Challenge the
   assumption that the page is reachable from the task. It was not reachable to the drafter or to
   this reviewer. Either name the doc-access path for the task or pin the headers from an offline
   authority, else the gate is unfireable and the headers ship provisional.
3. **"the post-conditions bind, not the code shape" plus provisional headers (Overview/C9).** The
   combination means the one externally-observable contract (what ntfy accepts) is bound by neither
   the post-conditions (they assert only emitted bytes) nor a probe. That is acceptable only with a
   real task-phase gate; keep it hard.

## What's missing before acting

- A redaction rule that actually meets "no path," or an accepted AC-3 scope narrowing.
- A one-line statement of how/where the push task reaches the ntfy docs so its confirm-or-escalate
  gate can fire.
- Nothing else. Data Models completeness (the `redrive` string-literal union and both route
  response bodies are fully enumerated) and error-branch shapes (404 `run-not-found`, 409
  `not-stalled`, 200 `{ ok: true }`; the crash wait's `drive-crash` discriminant) are satisfied.
  Decomposition scope — every "MUST enumerate" file and all three "should address" items — is covered.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
