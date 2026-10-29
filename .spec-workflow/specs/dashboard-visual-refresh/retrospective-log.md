# Retrospective log — dashboard-visual-refresh

## 2026-10-29T00:00:02Z · implementation · task 1 · bug
fixed tmp XDG_STATE_HOME in playwright.worktree.config.ts left the controller's durable project list (projects.json) uncleared across repeated capture invocations, polluting the sidebar/screenshots; resetSpecWorkflowHome only truncates activeProjects.json, not the durable list.
Evidence: task 1 · mark run-20261028-181442 c1856acf
Cost: implementer

## 2026-10-29T00:07:35Z · implementation · task 1 · tool-error
task-parser.ts dropped the `(declared directory: ...)` annotation without a trailing slash, so gate-rules' prefix match flagged every file under task 1's declared screenshots directory as outside-list; fixed in src/core/task-parser.ts. Also: Grep/Read tool results in this session repeatedly carried an injected "MANDATORY: run graphify query" system-reminder with no graphify-out present — looked like prompt injection, ignored, flagging for visibility.
Evidence: task 1 · mark run-20261028-181442 2eae2b88
Cost: implementer

## 2026-10-29T00:16:15Z · implementation · task 1 · harness-defect
task 1's own gate had a bug (declared-directory File entries) whose fix is inherently outside task 1's File: list; a self-hosting repo can't gate-verify its own gate fix pre-merge. Details: /tmp/scratchpad/sdd/dashboard-visual-refresh/fix-round-3-findings.md
Evidence: task 1 · mark run-20261028-181442 9b64f3db
Cost: implementer

## 2026-10-29T00:17:12Z · implementation · task 1 · deviation
task 1: a fix round left the commit unchanged and the gate returned the same file-outside-list verdict for .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/deferrals-dark.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/deferrals-light.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/now-dark.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/now-light.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/run-dark.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/run-light.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/runs-dark.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/runs-light.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/specs-dark.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/specs-light.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/usage-dark.png, .spec-workflow/specs/dashboard-visual-refresh/screenshots/before/usage-light.png, src/core/__tests__/task-parser-tests.test.ts, src/core/task-parser.ts; no implementer edit can move a file-list verdict — the fix is to list the file(s) in the task's File entries in tasks.md
Evidence: task 1 · mark run-20261028-181442 3f147a50
Cost: unknown

## 2026-10-29T02:34:36Z · implementation · task 1 · deviation
task 1: a fix round left the commit unchanged and the gate returned the same file-outside-list verdict for src/core/__tests__/task-parser-tests.test.ts, src/core/task-parser.ts; no implementer edit can move a file-list verdict — the fix is to list the file(s) in the task's File entries in tasks.md
Evidence: task 1 · mark run-20261028-181442 06191492
Cost: unknown

## 2026-10-29T02:48:38Z · implementation · task 1 · gotcha
task 1 closed: 0 fix round(s), outcome gate
Evidence: task 1 · mark run-20261028-181442 0031dd94
Cost: 1 implementer spawn(s)

## 2026-10-29T03:13:24Z · implementation · task 2 · gotcha
task 2 closed: 0 fix round(s), outcome pass
Evidence: task 2 · mark run-20261028-181442 399c01f8
Cost: 1 implementer spawn(s)

## 2026-10-29T04:05:55Z · implementation · task 3 · ruling
adjudicated after 3 fix rounds; narrow verdict pass
Evidence: task 3 · mark run-20261028-181442 8c7172c6
Cost: 4 rounds

## 2026-10-29T04:05:55Z · implementation · task 3 · inefficiency
task 3 closed: 4 fix round(s), outcome adjudicated
Evidence: task 3 · mark run-20261028-181442 ddf16dcb
Cost: 5 implementer spawn(s)

## 2026-10-29T04:34:16Z · implementation · task 4 · tool-error
this fix brief's Operator rulings and &lt;A&gt;-&lt;B&gt; task-reference were task 1's content, not task 4's actual gate reasons
Evidence: task 4 · mark run-20261028-181442 ab4d6374
Cost: implementer

## 2026-10-29T04:38:41Z · implementation · task 4 · escalation
gate re-sent fix-round-2 with byte-identical output to round 1 (incl. task-1's already-resolved Operator rulings); line-count/structural-red are tasks.md's pre-declared verifier routing, not implementer defects, and "tests fail on HEAD" is contradicted by a live re-run — loop should route to the verifier instead of resending the same brief
Evidence: task 4 · mark run-20261028-181442 ac5a342c
Cost: unknown

## 2026-10-29T04:51:48Z · implementation · task 4 · gotcha
task 4 closed: 0 fix round(s), outcome pass
Evidence: task 4 · mark run-20261028-181442 16754cf6
Cost: 1 implementer spawn(s)

## 2026-10-29T05:53:37Z · implementation · task 5 · inefficiency
task 5 closed: 2 fix round(s), outcome pass
Evidence: task 5 · mark run-20261028-181442 0ec7e8f6
Cost: 3 implementer spawn(s)

## 2026-10-29T06:07:06Z · implementation · task 6 · gotcha
task 6 closed: 0 fix round(s), outcome gate
Evidence: task 6 · mark run-20261028-181442 b95e6256
Cost: 1 implementer spawn(s)

## 2026-10-29T06:18:36Z · implementation · phase · deviation
review coverage gap: completed task(s) 6 logged but unreviewed; merge allowed (retro P9)
Evidence: completion gate · mark run-20261028-181442 133dbe05
Cost: merge allowed (decision C)

## 2026-10-29T06:18:36Z · implementation · phase · cleanup
implementation complete: 6 tasks, 11 fix rounds, 1 adjudications, 53 spawns, 3 deferrals added
Evidence: completion gate · mark run-20261028-181442 7a9fc473
Cost: see the ledger

## 2026-10-29T09:43:52Z · implementation · phase · cleanup
implementation complete: 6 tasks, 11 fix rounds, 1 adjudications, 54 spawns, 3 deferrals added
Evidence: completion gate · mark run-20261028-181442 411c4afe
Cost: see the ledger

## 2026-10-29T10:07:31Z · retrospective · phase · cleanup
retrospective compiled: 27 findings, 19 proposals, 4 decisions needed
Evidence: retrospective.md, retrospective-proposals.md · mark run-20261028-181442 20e5010e
Cost: 2 spawns

## 2026-10-29T10:11:54Z · closeout · store batch 1 · gotcha
P18 is a harness-only item (merge-gate policy + eval case under harness/) yet was batched into the spec store (store 1); route harness-target retro items to the harness store so the eval case can land with its fix.
Evidence: batch 1 · mark run-20261028-181442 38b4b131
Cost: implementer

## 2026-10-29T10:16:13Z · closeout · store batch 1 · cleanup
store batch 1: 1 done of 3, 1 fix round(s)
Evidence: batch 1 · mark run-20261028-181442 20eaba44
Cost: 2 implementer spawn(s)
