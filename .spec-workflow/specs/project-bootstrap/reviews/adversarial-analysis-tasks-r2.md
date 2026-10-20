# Adversarial Analysis — project-bootstrap/tasks (v2, round 2)

Attack surface: atomicity, ordering, coverage. Fresh lens: none (per prompt).
Deltas attacked first; both prior SHOULD_FIX re-checked against their fix diff
only (fix-induced re-check, not a full re-review).

## Deltas since v1 (commit 3a7c758)

1. Task 7 `_Prompt` `Success:` — added the not-committed/`doctor` last-line
   assertion (R1-1 fix). tasks.md:81.
2. Task 8 — added `- Test: …doctor.test.ts — runDoctor(repoPath, io, timeoutMs)`
   (R1-2 fix). tasks.md:87.
3. Task 3 `_Prompt` — bare `health-route.test.ts:49-71` → `src/dashboard/__tests__/health-route.test.ts:49-71` (lint L-3).
4. Revision History v2 block.

## Fix-induced re-checks

- **R1-1 (was SHOULD_FIX, Accepted).** Task 7 `Success:` now reads "the last line
  on exit 0 and on exit 2 states the files are not committed and names doctor as
  the next command". Matches Req 6 AC 5 and design D8 (`files are not committed;
  … run doctor <top>`, design.md:83). The `Task:` body phrase "the not-committed
  last line on exit 0 and 2 (design D8)" is now mirrored in `Success:`, so the
  test-author will write it red-first. No contradiction with the exit-2
  `registration failed: … sdd-service.sh install` line (that line precedes the
  not-committed last line; Req 5 AC 7 vs Req 6 AC 5 are distinct hints). **Resolved.**
- **R1-2 (was SHOULD_FIX, Accepted).** Task 8 gains `runDoctor(repoPath, io,
  timeoutMs)`. The call exists in design C4 (design.md:95-97). The `Success:`
  clause "the last line names the first failure and the exit is 1, else 0" (Req 7
  AC 3) is now assertable through it; `runChecks` returns `CheckResult[]` and does
  not print or exit, `serviceEnv` is unrelated — the new seam is the right one.
  The em-dash seam separator is a real ` — ` (verified, parses under
  `parseTestLine`, task-parser.ts:17,37). Complementary to task 10's all-ok e2e
  path. **Resolved.**

## Delta citation check

- `src/dashboard/__tests__/health-route.test.ts:49-71` — real server on a free
  port with temp homes (`getFreePort`, `new MultiProjectDashboardServer`,
  per-test `SPEC_WORKFLOW_HOME`/`SDD_HOME`). Accurate (health-route.test.ts:49-71).
- `runDoctor(repoPath, io, timeoutMs)` — matches design C4 signature
  (design.md:95-97). Accurate.
- No misstated-artifact MUST_FIX in the delta.

## Per-round mandated checks (full sweep)

- **Every `Test:` line** (tasks 1,2,3,4,5,6,7,8,9): each call resolves to a design
  C1–C9 interface or this/an earlier task's prompt, and each `Success:` claim is
  assertable through it with requirement-stated values. No miss.
- **Success-clause coverage (retro P7), all tasks:** every test the `Task:` body
  names reappears in that task's `Success:` clause. Checked each task line by
  line; after the v2 fixes, no further silent drop. Thin spots examined and
  cleared, not raised:
  - Task 7 "always send both paths (D2)" — functionally material only with
    `--store` (controller derivation == top for in-repo); that case is pinned by
    the `env` assertion and task 10's both-paths check. Not a correctness gap.
  - Task 7 "realpath both roots (D9)" — redundant with server-side
    `normalizeIdentityPath` (asserted at task 2 "both realpath paths") and
    `gitTopLevel`'s realpath return (D5). Covered.
  - Task 2 "a failed write rejects (D3)" / route 500 — no AC mandates a red-first
    test; init's non-2xx→exit-2 path is pinned at task 7. MINOR at most.

## Ordering / atomicity (primary surface)

- Deltas change neither the dependency order (1→4/8, 2→3, 4→7/8, 5→7, 6→7/9,
  {3,7,8}→10) nor task boundaries. Task 8's third seam is the same module; no new
  shared-state seam. Task 7 breadth was ruled closed (R1-M1). No new edge needed.

## Findings

None. Both v1 SHOULD_FIX are resolved by the v2 deltas; the lint-prefix delta is
accurate; the full retro-P7 and Test-line sweep surfaced no novel or compounding
MUST_FIX/SHOULD_FIX.

## Top risks/gaps

1. None open. Coverage (AC→task, component→task), ordering and every delta
   citation are sound.

## Top conclusions to challenge

1. "R1-1/R1-2 are fixed." Confirmed against the fix diff and the governing ACs.
2. "Task 8's seam set now covers doctor's reporter/exit." Confirmed via `runDoctor`.
3. "No new defect was introduced by the v2 delta." Confirmed.

## What's missing before acting

- Nothing blocking. The document is ready to implement.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
