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
