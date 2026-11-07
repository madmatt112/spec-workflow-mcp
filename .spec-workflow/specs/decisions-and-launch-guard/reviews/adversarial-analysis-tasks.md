# Adversarial Analysis — decisions-and-launch-guard/tasks (v1, round 1)

Primary lens: atomicity, ordering, coverage. Deltas attacked first (the lint pass:
21 citations directory-prefixed, one wording generalisation in task 5), then the
fresh atomicity/ordering/coverage lens over the whole document.

## Method

Read tasks.md, requirements.md, design.md, codebase-context.md and decomposition
entry 36. Re-verified every citation the v1 lint commit touched against the tree,
and the external G1/G2 source, because a misstated artifact is an automatic MUST_FIX.

## Attack 1 — Citation integrity of the lint-pass deltas (mandated re-verification)

Challenged each path the lint pass rewrote from a bare token to a repo-relative path.
Read both ends; all anchor what the Note claims:

- Task 4 `e2e/worktree-board.spec.ts:871` — `(R5 AC1)` seeds a staged action for an
  unregistered project id; `actionTarget` prints the raw id. Regression-guard claim holds.
- Tasks 6/7 `e2e/worktree-board.spec.ts:2372`, `:2397` — both `(R8 AC2)` tests assert
  one representative tile / member fallback. Task 7 flips `nextProjects` to all-enabled,
  so these assertions must change — exactly what the Note says.
- Task 20 `e2e/worktree-board.spec.ts:348-358` — the 3-band order test.
- Task 8 `closeout.test.ts:139-155` — the `classifyTarget` describe; all cases use
  `Target:`, so `itemTarget` returns the same value and classifications hold.
- Task 10 `ledger.test.ts:118` — the row-type round-trip describe (add `file-list.patch`).
- Task 11 `implementation.test.ts:484` — read the whole test: both stub rounds report
  `flag: 'none'`, so no REQUIRED path fires and P8 still escalates. AC 7 guard holds.
- Task 15 `state.test.ts:186`, `pause-request.test.ts:71` — both write terminal status
  over `running` in a fresh home; the `abandoned` guard never triggers. Hold.
- Task 18 `runs.test.ts:447` — a pause/hold test, not a cancel. Holds.
- Task 21 `runs.test.ts:946`, `:1000`, `controller.test.ts:2458` — `seedRun` pins
  `created` to `2026-10-11T00:00:00.000Z` for every seed (runs.test.ts:98); the two
  rows share `created`, so `branchReused` (requires a *later* `created`) never fires on
  them and both expectations hold. Confirms D20's rationale.
- Tasks 7/20 `board-view.test.ts:634-690` (`nextProjects`, 3 cases) and `:521-535`
  (`running` incl. stopped). Both change as the Notes state; new assertions are in Success.

No misstated artifact found in the delta.

## Attack 2 — Coverage (the primary lens)

Mapped every requirement AC → task via `_Requirements:`, every design component → task,
every decomposition scenario → task.

- Requirement ACs 1.1–11.2: all covered (1→1,2,4,23; 2→5,6,7; 3→8,9; 4→10,11; 5→12,13;
  6→14,23; 7→15–18; 8/10→19; 9→20,21; 11→22). No orphan AC.
- Design C1–C11: each has a task (Scope-notes map verified against `_Requirements`).
- Decomposition scenarios 1–10: 1/6 live in task 23 (6 also task 18); 2→6,7; 3→9; 4→11;
  5→13; 7/9→19; 8→20; 10→22. All ten land.
- No task without a requirement. No requirement without a task.

## Attack 3 — Ordering and dependency edges

Execution is strictly sequential by number ("run the tasks in number order"), so the
"chains" are advisory and there is no parallel-edit merge risk on shared files
(multi-server.ts in 3+6, board.ts in 7/19/20, HomePage.tsx in 4/7/20). Checked every
forward reference resolves to a lower-numbered task: 2←1, 3←2, 4←3, 6/7←5, 9←8, 11←10,
13←12, 18←16, 21 self. All satisfied. No missing edge.

## Attack 4 — Atomicity of the large tasks

Stress-tested tasks 7, 16, 18, 19 for being too large. Each is one cohesive seam:
task 7 = the Next tile + its pure helper (D16); task 16 = the spawn-race/step guard
(D21 fixes its home here); task 18 = the driver choke-point checks (D10 chose one place,
not per-site); task 19 = the one RunTile (C8+C10 both touch tiles.tsx:149-150, :165-174).
Splitting 16/18 would leave a half-cancel state where the full vitest gate could red
mid-chain. Keeping each whole is correct. No atomicity defect.

## Attack 5 — Test seams, Success-clause coverage, File:-entry gate

- Every `Test:` seam resolves to a design interface or the task's own prompt and is
  assertable with stated values (spot-checked tasks 2, 12, 13, 16).
- Success-clause coverage (retro P7): every task's Success clause runs the vitest/e2e
  suites for its File test files and Test seams — including the cross-file ones
  (task 8 runs closeout.test.ts, task 10 runs watch/ledger.test.ts, task 15 runs
  pause-request + paused-at). No prompt-named test dropped from Success.
- File-scope gate: every `File:` entry is a literal repo-relative path (or a concrete
  `.spec-workflow/...` file). No prose gloss, no bare directory. No automatic MUST_FIX.

## Attack 6 — External artifact and Gate B/C

- Task 14 source: `/home/mcf/repo/tradr-hosted/.spec-workflow/specs/option-lifecycle-events/
  retrospective-plan.md:143-148` and `:155-159` read verbatim; they contain the grep
  phrases `no implementer commit can clear it` and `cannot be made to fail first`, and
  carry `Target document:` lines (lines 142, 154) — consistent with task 8 reading
  `Target document:` to classify G1/G2. Accurate.
- Gate B: no task introduces a new external dependency — none.
- Gate C: the "Added beyond design" items (launchPress D16, Controller.save D17,
  STEP_CLASSIFICATIONS D19, seed fix D20) each trace to an approved requirement
  (2.4, 7.3, 7.4/7.6, 9.6). None exceeds the approved requirements — none.

## Minor observations (non-blocking, do not iterate)

- Task 7 `_Prompt` names task 5 as its guard-field source but not task 6, which actually
  sets `view.guard` on the route the e2e exercises. Sequential order covers it.
- Task 20's Note says the band-order test at `:348-358` changes; because `band-stopped`
  is `hideWhenEmpty` and that test seeds no runs, the existing 3-band count may in fact
  survive and the implementer would add a scenario-8 assertion instead. The Note hedges
  ("at least", "widen to every assertion the change touches"), so it is guidance, not a
  wrong claim.

## Deliverables

**Top risks/gaps:** none rise to SHOULD_FIX. The two minor observations above are the
only soft spots and neither causes rework or a wrong implementation.

**Top 3 conclusions challenged (and upheld):**
1. "Both `discardAllowed` seeds share one `created`, so task 21 keeps every value" —
   verified at `runs.test.ts:98`; upheld.
2. "The `implementation.test.ts:484` P8 guard survives task 11" — verified both stubs
   report `flag: 'none'`; upheld.
3. "Task 8 keeps every `classifyTarget` value" — verified all cases use `Target:`, so
   `itemTarget` is value-identical; upheld.

**What's missing before acting:** nothing blocking. The two live scenarios (task 23)
remain `pending` by design and gate the retrospective, as intended.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
