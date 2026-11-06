# Adversarial Analysis — dashboard-board/requirements (v2, round 2)

Primary surface: completeness, ambiguity, scope. Fresh lens applied (memory-guided, not used round 1): failure modes / error paths. Attacked the v2 deltas (R1-1…R1-5 fixes) first.

## What I checked and how

Re-probed every citation the v2 lint/response diff touched, both ends of each range, against code under the worktree:

- **R1-1 fix — R12 AC 1 × R7 AC 6/AC 7.** Row now carries two path-free signals, "branch present" and "Discard allowed". `ControllerRunRow` (`runs.ts:1428-1451`) already carries `status` and `updated`, so the frontend can compute R7 AC 6's `done`-under-24h gate; branch-in-use needs the server bit (no `branch`/`codeRoot` on the row, Security NFR). The three stopped-run outcomes now separate. **Resolved — no contradiction.**
- **R1-3 fix — R4 AC 1.** `ctrlSummary` (`NowPage.tsx:66-78`) verified: `gate-a → "N decision(s)"`, `gate-b → "N item(s)"`, `retro-plan → "N proposal(s)"`, else `questions[0]?.text`, else a kind fixed line. The AC's "decision, item or proposal count … else questions[0].text … else the kind's fixed line" maps 1:1. **Resolved.**
- **R1-4 fix — R6 AC 6.** `pause.ts:42-45` verified: line 43 is the running branch (`'pause requested'`), line 45 the waiting branch (`${waiting.text} · pause requested`); applied pause starts "paused by you" (line 39). AC's "running reads just that / waiting keeps its waiting text with a suffix / once applied starts with paused" is accurate on all three. **Resolved.**
- **R1-2 fix — R12 AC 2.** Citations accurate: `runs.ts:455-458` is `onStepSpawn` and gets only `{id,pid,startTime}`; `implementation.ts:469` is the `onSpawn` call passing `{id: opts.stepId, pid, startTime}`; `:616-617` is `runTask` where `task.id` is known. Scope note now adds `phases/implementation.ts`. **But the start-time wording is wrong — see R2-1.**
- **Reliability NFR delta** ("failed branch read → branch not present → no tile"): consistent with R12 AC 1 + R7 AC 6. A design trade-off, not a contradiction (observation O1).
- Intro / Alignment / D1-D18 / R1 AC4,7 / R3 AC1 / R4 AC4 / R5 AC2 / R8 AC3 / R10 AC1 deltas are wording-only; semantics preserved.

## Topics attacked

### T1 — R12 AC 2's "ISO start time (converted from the numeric spawn value)"
- Trace the numeric spawn value to its producer: `step.ts:511` passes `processStartTime(child.pid)`; `processStartTime` (`state.ts:685-688`) returns `/proc/<pid>/stat` field 22; the comment at `state.ts:42` confirms it is "field 22 at spawn, so a reused pid reads dead."
- Challenge whether field 22 (clock ticks since boot) can be "converted" to a wall-clock ISO time from the value alone — it cannot.
- Stress-test the cascade into R6 AC 1 ("the step age while a step is in flight") and R6 AC 2 ("else from the step's start").

### T2 — The Reliability NFR flip (fresh error-path lens)
- Stress-test "A failed branch read SHALL report the branch as not present, so the run shows no tile" against the operator's need to Discard a lingering worktree.

## Findings

### R2-1 — MUST_FIX (Compounding, fix-induced). Compounds: R1-2
**R12 AC 2's "the step's ISO start time (converted from the numeric spawn value)" directs the wrong data source and is unimplementable as written.**

The numeric spawn value is `startTime`, produced by `processStartTime(child.pid)` (`step.ts:511`), which reads `/proc/<pid>/stat` field 22 (`state.ts:685-688`) — the process start time **in clock ticks since system boot**, kept only so `isProcessAlive` (`state.ts:695-697`) can detect pid reuse. It is not an epoch value. A wall-clock timestamp cannot be derived from it without the system boot time (`/proc/stat` btime) and `sysconf(_SC_CLK_TCK)`, neither of which is in the spawn value or on the `onStepSpawn` contract (`runs.ts:450`, `:455-458`).

Round 1 (R1-2) flagged that the "ISO-vs-/proc conversion" was unstated. The v2 fix resolved it the wrong way — by asserting a conversion of that very value. The correct source is the wall-clock time at the spawn moment (the controller has `deps.now()`), recorded as `now().toISOString()` in the `onStepSpawn` callback; the `/proc` number should not be converted at all.

**Failure scenario:** an implementer follows the AC literally and writes `new Date(startTime*1000).toISOString()` (or `new Date(startTime)`). `startTime` is a boot-relative tick count (e.g. ~`123456789`), so the stored ISO time lands in 1970. R6 AC 1's step-age line then reads decades, and R6 AC 2's heartbeat fallback ("else from the step's start") is always past 15 minutes → every in-flight step shows red. Exactly the kind of fix-induced claim error the citation discipline exists to stop.

**Fix:** replace "(converted from the numeric spawn value)" with wording that the ISO start time is the wall-clock time stamped at spawn (e.g. `now().toISOString()`), distinct from the `/proc` `startTime` the row must not carry.

## Observations (MINOR — not loop-keepers)

- **O1 — Reliability NFR, failed branch read.** Flipping a failed read to "branch not present → no tile" fails safe against accidental Discard, but a transient git-ref lock now hides an `abandoned`/`error`/`done`<24h run for that 60 s cycle, so the operator cannot Discard it until the next read. Self-healing, deliberate; flagging so design states it is intended.
- **O2 — R7 AC 6 tile predicate is branch-presence only.** A stopped run whose branch is gone but whose worktree still exists shows no tile, so its worktree cannot be Discarded from the board. Only a gap if close-out ever deletes the branch while leaving the worktree — unverified here; design should confirm the predicate should be "worktree or branch present", not branch alone.
- **O3 — R4 AC 1 wording.** "the first line of `questions[0].text`" — `ctrlSummary` returns the full `q0`, not its first line. The binding clause ("SHALL be `ctrlSummary`") pins the real behaviour, so harmless, but the prose overstates.

## Top risks / conclusions to challenge

1. **R12 AC 2's start-time source (R2-1).** Reverse "converted from the numeric spawn value" to "stamped at spawn from the wall clock". The one MUST_FIX; blocks R6 AC 1/AC 2's step age.
2. **Branch-presence as the sole tile predicate (O2).** Confirm no orphan-worktree case escapes the board, or widen the predicate.
3. Everything else in the v2 deltas holds; R1-1/R1-3/R1-4 fixes verified resolved against code.

## What's missing before acting

- Correct the R12 AC 2 start-time wording (R2-1) — the only blocker.
- A one-line confirmation in R7 AC 6 / Reliability that branch-presence (not worktree-presence) is the intended tile predicate (O2).

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
