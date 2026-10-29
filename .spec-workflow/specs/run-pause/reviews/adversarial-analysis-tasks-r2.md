# Adversarial Analysis — run-pause/tasks (v2, round 2)

Primary attack surface: atomicity, ordering, coverage. Fresh lens: none (prompt).

## Deltas attacked first

The v2 diff touched exactly two clauses, both pure text additions resolving round-1
findings. I re-checked each against the cited code (fix-induced re-check, scoped to the
fix vs. its requirement — not a whole-document re-review).

### R1-1 fix — task 2 new Success case (line 27) — CORRECT
Added: "a run that enters the merge stage unheld, reaches a blocked fix-eligible PR, and
is held before the merge-fix round stop (696) ends paused/operator with cursor stepKind
merge and runMergeFixRound not spawned (no fix-round step consumed)".

Verified against `src/controller/runs.ts`:
- 696 is the cancel guard `if (deps.isCancelled(run.id)) return 'stop';` — the new
  operator stop sits after it (design C3 point 3, body says "after the cancel guard (696)").
  Line number accurate.
- The `merge` cursor `{ phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 }`
  is saved at 689-691, before the fix-eligible branch (692), so "cursor stepKind merge"
  holds whether or not the hold is seen. Accurate.
- `runMergeFixRound` spawns at 711; a stop after 696 never reaches it, so "no fix-round
  step consumed" is right.
- The merge-resume detection (779-781, `run.cursor?.stepKind === 'merge'`) confirms the
  cursor is the durable re-entry marker, so the case is meaningful.
- Assertable through the Test seam `runOnce(deps(fx, { isPauseRequested }), …)`: a stateful
  `isPauseRequested` returning false at the entry check (624) and true at 696 reaches this
  stop via the post-implementation direct call (947), which bypasses the loop top — exactly
  the gap R1-1 named. Existing merge-fix tests stay green (deps helper 104-119 gains no
  default, Note line 22).

Accounting is now consistent: Scope-notes "Not tested directly" and the task-2 Note still
exempt only the merge-stage-**entry** stop (point 4 / 624); the merge-fix round stop
(point 3 / 696) now has its own Success case, so it needs no exemption. The two stops are
no longer conflated. No conflict with D3 (which governs the entry case's outcome-only
assertion, a different stop).

### R1-2 fix — task 1 Success widened (line 16) — CORRECT
Added "and undefined for an unparsable file" to the `readRunSync` Success clause, matching
the `Task:` body ("undefined for a missing or unparsable file") and design C1. The
unparsable branch is modelled on `listRunsSync`'s catch-all skip (`state.ts:358-362`), not
`readJson` (which rethrows non-ENOENT, 333-335); the task points the implementer at
`listRunsSync` (348-365). Retro-P7 parity restored: every behaviour the body names now has
a Success assertion.

## Fresh checks this round

- **Test seams:** task 1 `writeRun(record, { ownsPauseRequest: true })` and task 2
  `runOnce(deps(fx, { isPauseRequested }), …)` both name the new signatures from design
  C1/C3; assertable with the values the requirements state. No miss.
- **Success-clause coverage (retro P7):** with R1-1 and R1-2 applied, every `Task:`-body
  test now appears in the owning `Success:` clause across all nine tasks. No silent drop.
- **File: entries** are all literal repo-relative paths (task 9 →
  `.spec-workflow/specs/run-pause/verification-evidence.md`); no prose gloss.
- **Gate B/C:** no task adds an external dependency (task 7's `playwright install chromium`
  is the existing dev tool); no task exceeds the approved requirements. Nothing to carry.
- **Ordering/coverage** (1→2→3→4→5→6→7→8→9) and the requirement→task map were fully verified
  sound in round 1 and the delta touched neither; not re-derived.

## Conclusions challenged

1. R1-1's "the merge-stage-entry exemption stays as is" — challenged and upheld: point 4
   (624) remains caught by an earlier phase stop (e.g. CI poll `implementation.ts:1339-1340`),
   so outcome-only is still correct; point 3 (696) is now tested separately. Correct split.
2. The new case asserts the merge cursor while D3 keeps the entry case outcome-only —
   challenged as a possible contradiction; not one, they are distinct stops on distinct paths.
3. Task 1 body-vs-Success parity — now closed; nothing left to reverse.

## What's missing before acting
Nothing blocking. The task-2 blocked/fix-eligible fixture is heavier to build than the
existing `auto` not-ready-then-merged test (574-613), but it is reachable through the
existing merge-stage test infrastructure; not a defect.

ESCALATE: none — no security, secret, auth, data-loss, money or legal surface.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
