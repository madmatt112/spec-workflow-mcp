---
id: "d-ae7a5d40"
status: "deferred"
title: "TDD gate runs a task-authorized non-test config in the red commit as a test (false head:fail)"
createdAt: "2026-11-05T23:37:07.967Z"
updatedAt: "2026-11-05T23:37:07.967Z"
resolvedAt: null
originSpec: "dashboard-deploy"
originPhase: "implementation"
revisitTrigger: "When the tdd gate's testFiles derivation is next touched, or at the dashboard-deploy retrospective."
tags: ["info-finding", "tdd", "gate-tooling"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Task 13's red commit (15df8af) edited e2e/worktree-deploy.spec.ts AND playwright.worktree.config.ts (SDD_DEPLOY_DISABLED=1), the latter required by the task File list, D27 and agent-rules 94-98. The gate's tdd.testFiles included the config; the tdd-test-command's `*)` fallback ran `npx vitest run playwright.worktree.config.ts`, which exits 1 ("No test files found"), yielding spurious reasons tdd:tests fail on HEAD, tdd:author changed source, tdd-inconclusive. The real e2e check passed on HEAD (gate pass(0)); reproduced the vitest exit-1 artifact. Ruled out at task-13 review round 4; verdict pass. Distinct from d-64ce8349 (task-6 regression-guard reuse).

## Decision Deferred
Whether the tdd regression-guard should exclude task-authorized support/config files (vite.config, playwright config, runner config) from testFiles instead of feeding them to the generic test command.

## Revisit Criteria
When the tdd gate's testFiles derivation is next touched, or at the dashboard-deploy retrospective.
