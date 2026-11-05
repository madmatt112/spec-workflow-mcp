# Adversarial Analysis — eval-gate-runs/tasks (v2, round 2)

Primary surface: atomicity, ordering, coverage. Fresh lens: none.

## Delta under review

v2 carries exactly one change (diff from 95a5b4e2): the R1-1 disposition on task 5.
It removed the `- Test:` seam and rewrote the first Note to mark the task
implementer-only with the test-author/verifier skip stated, citing
`.spec-workflow/agent-rules.md:176-178`. Version line and Revision History updated.
Nothing else moved.

## What I checked and how

- Read the R1-1 finding (memory + prior analysis) and the v2 diff first.
- **Citation `.spec-workflow/agent-rules.md:176-178`** — read it at both ends. It is the
  exact rule: "A task whose every acceptance criterion is a regression guard (holds at
  base) is marked implementer-only in the decomposition up front, with the
  verifier/test-author skip stated; the routing is not discovered mid-run." Accurate.
- **Routing the fix claims.** Traced `isTddMarked` (`implementation.ts:255-259`): returns
  false when `task.tests` is empty. Task 5 now has no `- Test:` line → false → no test
  author spawn. Traced the verifier decision (`implementation.ts:850,857-860`): a task
  that is not `risk === 'high'` and not `isWiringTask` falls to the else branch, the gate
  stands as the review and the id is pushed to `verifierSkipped`. Task 5's file
  (`src/__tests__/service-scripts.test.ts`) and title ("…in the script tests") match
  neither the file nor title regex in `isWiringTask` (`implementation.ts:266-272`). So
  "implementer-only, no test author and no verifier" is exactly what the code does.
- **Lint-safe.** Read `checkTestSeams` (`lint-tasks.ts:320-345`). The no-Test-line branch
  (338-345) only flags a task that has a non-test, non-doc file; task 5's sole file is a
  test path (`isTestPath` true), so it is skipped. Removing the seam raises no
  `task-test-seam` finding. Matches the empty "Still open" list in the prompt.
- **Fix completeness (memory guidance).** Task 5's `Success:` clause still names both
  tests — the dry run ("exits 0 and prints … `: 1 run` … `select: 2 cases, 4 runs`") and
  the error wait ("exits 1, its recorded wait text names `demo fail 0/1`"). Nothing the
  `Task:` body names is dropped from `Success:` (retro P7). `_Requirements: 2.5, 4.6, 4.7`
  unchanged.
- Re-walked atomicity, ordering and coverage against the delta: the removed seam changes
  no `File:`, no `_Requirements`, no component mapping, no dependency edge. The 1→2→3→4→5→6
  DAG and the disjoint file set are untouched.

**The delta is correct, complete, citation-accurate and lint-safe.** R1-1 is resolved.

## R2-0 — R1-1, status

- **R1-1 (SHOULD_FIX) — RESOLVED, not re-raised.** v2 removed the `- Test:` seam and marks
  task 5 implementer-only up front with the skip stated, per `agent-rules.md:176-178`. The
  wasteful test-author spawn → RED-IMPOSSIBLE → mid-run re-route is gone: `isTddMarked` now
  returns false, so no author is ever spawned. Verified above. No finding.

## One thing I specifically probed and cleared

- **Is task 5's verifier-skip a problem now that the final task (6, docs) is also
  verifier-skipped (reviewCoverage N−2 of N)?** No, and it is not delta-induced. Task 5 was
  verifier-skipped in v1 too (it is low-risk and non-wiring; the only change is it no longer
  takes the wasteful author detour to get there). `agent-rules.md:176-178` explicitly blesses
  a regression-guard task skipping the verifier, independent of the final-task N−1 allowance
  at 179-182. No defect.

## Top risks/gaps (short doc — 3)

1. None at MUST_FIX or SHOULD_FIX. The sole round-1 defect is fixed and the fix introduced
   no regression.
2. (Not a defect) Tasks 5 and 6 are both verifier-skipped. Pre-existing, rule-blessed
   (`agent-rules.md:176-178`), not delta-induced.
3. (Not a defect) The dry-run test needs a built tree the base worktree lacks; D1 and the
   implementer-only routing are precisely why no base red run is attempted. Correct.

## Top conclusions to challenge

1. **"implementer-only, no test author and no verifier" (task 5 Note)** — I tried to reverse
   it and could not: both skips are exactly what `isTddMarked` false + non-wiring/low-risk
   produce. Holds.
2. **"there is no red to prove" (task 5 Note)** — challenged against the no-build base
   worktree; the behaviour is shipped by tasks 3–4, so there is no new behaviour to drive
   red-first, and D1 explains why a base red run would fail for the wrong reason. Holds.
3. **Fix is lint-safe** — challenged `checkTestSeams`; a test-only task with no Test line is
   not flagged. Holds.

## What's missing before acting

- Nothing. The document is implementation-ready.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
