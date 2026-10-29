---
id: "d-ee90c2ed"
status: "deferred"
title: "npm test red: 6 pre-existing backend failures must be cleared for Requirement 7.4 at the e2e gate"
createdAt: "2026-10-29T05:53:03.513Z"
updatedAt: "2026-10-29T05:53:03.513Z"
resolvedAt: null
originSpec: "dashboard-visual-refresh"
originPhase: "implementation"
revisitTrigger: "At the end-to-end verification gate (task 6) and before merge, when npm test is run for Requirement 7.4; base-diff confirms pre-existing, so decide accept-vs-fix rather than block task 5."
tags: ["info-finding", "dashboard-visual-refresh", "task-5", "pre-existing"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Non-blocking info finding at task-5 review (reviewId 17ea3a3b, verdict findings, 0 critical/warning, 1 info). The task-5 success criterion and Requirement 7.4 require `npm test` green. A full `npx vitest run` at task-5 HEAD (2c6ba503) shows 6 failures in 4 suites: src/dashboard/__tests__/project-manager-durable.test.ts (3: durable project list), src/evals/__tests__/cli.test.ts (--override names an unselected case), src/tools/__tests__/log-implementation.test.ts (records source 'override' when args.projectPath provided), src/tools/__tests__/projectPath.test.ts (override displaces context workflow root). All six were re-run in a scratch worktree at the branch merge-base (33ef6fa1) and fail identically there, so they are pre-existing/environment-coupled, not a regression from this branch or task 5. Task 5's diff is frontend views + the new frontend-style-scan test only; that scan test passes 18/18 in the full run. They all concern the --override / args.projectPath / durable-project feature, unrelated to this visual-refresh spec.

## Decision Deferred
Whether the 6 pre-existing backend test failures must be fixed before this spec merges (Requirement 7.4 demands npm test green) or are accepted as a pre-existing project issue outside this spec's scope.

## Revisit Criteria
At the end-to-end verification gate (task 6) and before merge, when npm test is run for Requirement 7.4; base-diff confirms pre-existing, so decide accept-vs-fix rather than block task 5.
