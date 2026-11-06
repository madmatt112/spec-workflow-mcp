# Adversarial Analysis — dashboard-board/requirements (v3, round 3)

Primary surface: completeness, ambiguity, scope. Fresh lens: none (per prompt). Attacked the v3 deltas first — the R2-1 and O3 fixes — as a fix-induced re-check, then spot-checked the prose compression for semantic loss.

## What I checked and how

The v3 diff has two semantic edits (R2-1, O3) and a prose compression of the Introduction, Alignment, D1–D18 and Scope notes. I read both ends of every citation the edits touch, under the worktree code root.

### R2-1 fix — R12 AC 2 start-time source (fix-induced re-check)

v3 replaced "(converted from the numeric spawn value)" with "(the wall-clock stamp taken at spawn from `deps.now()`, `src/controller/runs.ts:455`, not the `/proc` `startTime`)".

- `stepLifecycle` (`src/controller/runs.ts:449-465`): `onStepSpawn` (`:455-458`) receives `{ id, pid, startTime }`, calls `deps.setInFlight(s.pid, s.startTime)` and `patchRun(deps, runId, { inFlight: { id, pid, startTime } })`. The `startTime` it propagates is the `/proc` value.
- `deps.now()` is available in this scope: `patchRun` (`:431`) already stamps `updated: deps.now().toISOString()`, and `setRunHeartbeat` (`:444`) uses `now().toISOString()`. So a wall-clock ISO stamp from `deps.now()` at the spawn callback is implementable.
- `InFlightStep.startTime` (`src/controller/state.ts:39-46`) is commented "`/proc/<pid>/stat` field 22 at spawn", confirming the `/proc` source the AC now says NOT to use.

**The semantic error R2-1 flagged is resolved correctly.** v2 asserted a conversion of a boot-relative tick count that carries no wall-clock time; v3 now names the wall-clock `deps.now()` stamp and explicitly excludes the `/proc` `startTime`. This is exactly the fix R2-1 prescribed, and it keeps the new ISO field distinct from the `/proc` `startTime` the row must not carry (Security NFR). The cascade into R6 AC 1 (step age in flight) and R6 AC 2 ("else from the step's start") is now sound: the start value is a real epoch time.

### R2-1 fix — task-id routing citations (unchanged from v2, re-grounded)

- `implementation.ts:469`: `onSpawn: (pid, startTime) => { spawnWrite = ctx.onStepSpawn?.({ id: opts.stepId, pid, startTime }); }` — carries `opts.stepId`, no task id. Supports "The task id is not on the spawn callback".
- `implementation.ts:616-617`: `async function runTask(task) { const id = task.id; … }` — the task id is known here. Supports "design SHALL route it from the implementation phase where the task is known".
- Grouped-citation spot-check (agent-rules): both members annotate the phrase they follow. Accurate.

### O3 fix — R4 AC 1 summary wording

v3 changed "the first line of `questions[0].text`" to "the whole of `questions[0].text`". `ctrlSummary` (`NowPage.tsx:66-78`) returns `questions[0]?.text` entire, so the prose now matches the binding helper. **Resolved.**

### Prose compression (Intro, Alignment, D1–D18, Scope notes)

Spot-read every compressed bullet against its v2 form. No requirement content lost:
- D6 dropped "This adds controller files to the entry's list" — still carried by the Scope notes "Added" bullet.
- D4/D15/D16 dropped rationale clauses only; the governing ACs (R2 AC 3, R8 AC 2, R11 AC 2) carry the detail.
- Scope notes dropped the "Narrowed" bullet (R6 AC 4 ↔ D7); D7 and R6 AC 4 both still state the full driven-false predicate, so nothing binding is lost.

## Findings

No MUST_FIX or SHOULD_FIX. The single v3 MUST_FIX (R2-1) is resolved correctly and introduces no new semantic error; the O3 edit is correct; the compression preserves semantics. Two MINOR notes below, neither a loop-keeper.

## Observations (MINOR — not loop-keepers)

- **O4 (Novel, MINOR) — R12 AC 2 `deps.now()` citation precision.** The clause anchors "the wall-clock stamp taken at spawn from `deps.now()`" to `src/controller/runs.ts:455`, which is the `onStepSpawn` callback signature line; `deps.now()` is not called there — it appears at `:431` (inside `patchRun`) and `:444`. The citation works as a *location* anchor (the spawn callback is where design adds the stamp), and the AC's own "not the `/proc` `startTime`" makes the intent unambiguous, so no wrong implementation follows. Precision only: if the intent was to cite the `deps.now()` precedent, `:431` is the exact line.
- **O5 (Novel, MINOR) — Scope notes "Added" antecedent.** "…the controller writes of R12. Its 'Design MUST enumerate' list omits…" — "Its" grammatically attaches to R12 but means the decomposition entry's list. Harmless; a one-word edit ("The entry's") restores the v2 referent.

## Top risks / conclusions to challenge

1. **R2-1 is cleanly closed.** The start-time source is now the wall-clock `deps.now()` stamp, distinct from the `/proc` `startTime`; R6 AC 1/AC 2 step age no longer cascades into a 1970 timestamp. No reversal warranted.
2. **No new fix-induced error.** The memory predicted converged (0/0) if the R2-1 fix was clean and introduced no new error — it is, and it did not.
3. Nothing else in the v3 deltas changes a requirement; the compression is prose-only.

## What's missing before acting

- Nothing blocking. Optionally re-point the `deps.now()` citation to `runs.ts:431` (O4) and fix the "Its" antecedent (O5) during the next editorial pass.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
