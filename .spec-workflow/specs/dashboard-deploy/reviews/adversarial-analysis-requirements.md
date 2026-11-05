# Adversarial Analysis — dashboard-deploy/requirements (v1, round 1)

Primary surface: completeness, ambiguity, scope. Fresh lens: wire contracts across
the router/feed/client-state boundary. Every cited artifact was re-read against the
tree under `/home/mcf/repo/spec-workflow-mcp`; the v1 lint-pass claim ("no citation
is misstated") holds — all grouped-citation members I spot-checked anchor the phrase
they follow.

## Topics attacked

### A. The hold write and the `holdBy`/`pauseRequested` coupling (R1 AC2–3, R4 AC4/AC7, R6 AC4)
- Challenge the claim that R1 AC2 fully specifies the hold write. It says the press
  "set `holdBy: 'deploy'`" but never says it sets `pauseRequested`. Yet R1 AC3 *defines*
  a hold as "`pauseRequested` set, `holdBy` `operator` or absent" — so a deploy hold must
  be `pauseRequested` set + `holdBy: 'deploy'`.
- Stress-test R4 AC4's "(invariant, verified, not red-first)" marking. It cites
  `src/controller/controller.ts:456`, which is `if (run.pauseRequested) return false;`.
  That guard only makes `isStartable` return false for a deploy-held run **if the hold set
  `pauseRequested`**. The invariant marking is only true under the unstated assumption.
- Stress-test R4 AC7 "Today the call returns early (`controller.ts:242`)". Line 242 is
  `if (run.pauseRequested) return run;`. "Returns early" for a deploy-held run is only
  possible if that run already carries `pauseRequested` — again the unstated assumption.
- Challenge R3 AC6 "it SHALL clear the hold" for a `queued` or `merging` deploy-held run
  that "SHALL keep its status". If the hold set `pauseRequested`, clearing only `holdBy`
  leaves `isStartable:456` returning false — the run stays stuck after "release". Release
  must clear `pauseRequested` too, and the doc never says so.
- Challenge R6 AC4 "`isOperatorHeld` SHALL be false" (`pause.ts:27-29`). Today
  `isOperatorHeld` returns true whenever `pauseRequested !== undefined`; it is only *worth
  changing* if a deploy hold sets `pauseRequested`. The AC silently confirms the coupling
  it never states at R1.

### B. The `started` / "unit was started" field(s) (R1 AC1/AC4, R3 AC3/AC4, D3)
- Stress-test R1 AC1's record field list: `v`, `stage: 'wait'`, `runs`, `started`, no
  `error`. `started` is populated **at creation**, before the unit is started (the unit
  starts later at AC4 "WHEN no live step remains").
- Challenge the identity of "the unit was started" (R1 AC4, R3 AC3/AC4, scope note "A
  field in the record says the unit was started"). If this is the same `started` field,
  AC1 populating it at creation contradicts AC4 "SHALL record that the unit was started".
  If it is a second field, it is never named or listed in AC1's record shape.
- Stress-test R3's recovery discrimination: AC3 (unit started + not live → `failed`) vs
  AC4 (`wait` + unit **not** started → re-apply holds and continue). The whole D3 lost-unit
  exception rests on reading this field correctly; an implementer conflating a creation-time
  `started` timestamp with the unit-started signal flips AC4 into AC3 and fails a deploy
  that should have continued.

### C. The new deploy feed message — client half (R6 AC2/AC9/AC10, NFR Performance)
- Challenge R6 AC2's enumeration. It pins only the **server** side of the new message:
  the `ShellMessage` union (`src/dashboard/shell/types.ts:230-236`) and the flush array
  (`src/dashboard/shell/shell-feed.ts:146-153`). The **client** contract is unpinned.
- Contrast with R4 AC12, which pins all three `holdBy` locations (server row, server wire
  type, and the frontend hand copy `dashboard_frontend/.../types.ts:215-237`). The new
  message gets no equivalent client entry.
- Stress-test the consumer path: `ShellProvider.tsx:76-121` subscribes to each topic
  (`shell-now`…`controller-actions`) with a handler + state setter + a hand-copy payload
  type. A `controller-deploy` message with no subscription/handler/type there is emitted
  but never read; R6's strip renders nothing and the gap surfaces only in e2e.

### D. Scope deltas vs the decomposition (D1, D2, D4)
- D1 holds `merging` and non-operator `paused` runs beyond the entry's `running`/`queued`/
  `waiting`; declared in "Added beyond the entry" with a sound rationale (a restart would
  kill a step a `merging`/usage-paused run starts during the build). Covers all live
  statuses. Fine.
- D2 corrects a false premise in the decomposition ("the script's divergence check refuses
  a no-op") — verified: `check_move` only acts when both ahead and behind are non-zero
  (`sdd-self-update.sh:136-138`), so a not-behind no-op is not refused. The doc moves the
  refusal into the script under the flag. Good catch, handled.
- D4's prose "leave status alone"/"keeps its own status underneath" overstates: a running
  deploy-held run with a live drive parks `paused`/`operator` (R4 AC5, `runs.ts:573-581`),
  so "keeps its status" is true only for queued/waiting/merging. The ACs are consistent;
  only the D4 summary is loose.

### E. Router / response shapes (R1 AC1/AC8/AC9, R5 AC1/AC3)
- The deploy POST pins success (`202`) and both failure codes (`409 deploy-open` with the
  current stage). The cancel POST pins its failures (`409 deploy-past-swap`, `404`) but not
  its **success** status. Asymmetric and left unstated.
- The cancel's TOCTOU race (stage read → stop unit → the script advancing to `swap`) is
  acknowledged by Reliability ("A cancel that races the script's write of `swap` … The
  design pins the mechanism") and R5 AC2. Deferred to design with an invariant stated —
  acceptable at requirements level.

## Top 5 risks / gaps

- **R1-1 (SHOULD_FIX).** The `holdBy: 'deploy'` ↔ `pauseRequested` coupling is never stated.
  R1 AC2 sets only `holdBy`; R3 AC6 "clear the hold" never mentions `pauseRequested`. But
  R4 AC4 (invariant via `controller.ts:456`), R4 AC7 (`:242` early-return), R1 AC3 (hold
  definition) and R6 AC4 (`pause.ts:27-29`) all require the deploy hold to set — and release
  to clear — `pauseRequested` in lockstep with `holdBy`. Failure scenario: an implementer
  satisfies R1 AC2 by writing `holdBy` only; `stopReason` (`runs.ts:419`) never returns
  `operator`, a live drive does not stop (R4 AC5 fails), `isStartable:456` does not block,
  and R6 AC4's `isOperatorHeld` change becomes a no-op. Conversely, "clear the hold" that
  drops only `holdBy` leaves a released `queued`/`merging` run stuck unstartable.

- **R1-2 (SHOULD_FIX).** `started` (R1 AC1) and "the unit was started" (R1 AC4, R3 AC3/AC4,
  D3) are not disambiguated. AC1 populates `started` at record creation — before the unit
  starts — so it reads as a timestamp; AC4 then "records that the unit was started", and R3
  reads "the record says the unit was started". Either `started` is overloaded (AC1 vs AC4
  conflict) or a second field exists that AC1 never lists and no AC names. Failure scenario:
  a controller dies after AC1 but before AC4; on restart it reads a present `started`
  (creation timestamp), concludes the unit was started and is now gone, and writes `failed`
  (R3 AC3) instead of re-applying holds and continuing (R3 AC4) — the exact D3 case inverted.

- **R1-3 (SHOULD_FIX, fresh lens).** The new deploy feed message pins only its server half
  (`shell/types.ts:230-236`, `shell-feed.ts:146-153`). No AC pins the client contract: a
  `ShellProvider.tsx:76-121` subscription + handler, a frontend state slot, and a frontend
  hand-copy of the record payload type — the symmetry R4 AC12 enforces for `holdBy`. Failure
  scenario: the message ships with no client subscriber; R6's stage strip and `done`/`failed`
  display (AC2, AC7, AC9) stay blank, caught only at end-to-end.

- **R1-4 (MINOR).** The cancel route's success HTTP status is unspecified while the deploy
  route pins `202` (R1 AC1). R5 AC1 describes the effect but not the response code the Now
  page's "Cancel and resume now" (R6 AC5) reads.

- **R1-5 (MINOR).** D4's "leave status alone"/"keeps its own status underneath" contradicts
  R4 AC5 (a running deploy-held run parks `paused`). The behaviour is correct; the D4 prose
  should scope the claim to queued/waiting/merging to avoid misleading the design.

## Top 3 conclusions to challenge or reverse

1. **"R1 AC2 fully describes what a press writes to a run."** Reverse. The hold is
   `holdBy` **and** `pauseRequested`; every downstream guard proves it (R1-1). State both,
   and state that release clears both.
2. **"R4 AC4 is an invariant that already holds at base."** Challenge. It holds only
   because the deploy hold carries `pauseRequested`, which R1 never establishes. Make the
   dependency explicit or the "not red-first" routing is unjustified.
3. **"The record's field list is settled."** Challenge. `started` vs the unit-started
   marker is unresolved (R1-2); R3's recovery branches cannot be implemented safely until
   the field (one or two, timestamp or boolean) is named and its write points fixed.

## What's missing (before design)

- An explicit statement of the `pauseRequested` lifecycle for a deploy hold: set on hold
  (R1), carried over like `pauseRequested`/`holdBy` (R4 AC2), cleared on release (R3 AC6).
- A disambiguated record schema naming the unit-started field distinctly from `started`,
  and pinning which AC writes each.
- The client-side wire entry for the new deploy message (subscription, state, frontend
  type), mirroring R4 AC12.
- The cancel route's success status code.

## Checks performed

Read in full or at both ends of every cited range: `sdd-self-update.sh` (whole),
`sdd-service.sh:55-89,208-217`, `state.ts:50-170,270-279,415-455`,
`controller.ts:100-608`, `runs.ts:413-422,558-593,1420-1468`,
`multi-server.ts:685-854`, `actions.ts:355-411`, `shell-feed.ts:40-157`,
`hub.ts:45-52,155-167`, `shell/types.ts:190-237`, frontend `pause.ts` (whole),
`RunsPage.tsx:270-372`, `WebSocketProvider.tsx:25-109`, frontend `types.ts:210-237`,
`ShellProvider.tsx:70-121`, `service-scripts.test.ts:450-479` + `stageBuildStub`
(l.74), decomposition entry 31. The `started process.exit(1)` scenario-3 claim (test
`:460`) is accurate: `stageBuildStub` installs a stub `dist/evals/cli.js`, so the stub
fails the gate, not the build. KillMode=control-group probe corroborated (no KillMode
line, `sdd-service.sh:62-89`); `systemd-run --user` + EnvironmentFile precedent at
`sdd-service.sh:211-217`.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
