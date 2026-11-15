---
id: "d-bfcb31b3"
status: "deferred"
title: "npm test fails 13 cases on this machine that are green on CI (global commit-msg hook + controller spawn env)"
createdAt: "2026-11-15T06:35:54.864Z"
updatedAt: "2026-11-15T06:35:54.864Z"
resolvedAt: null
originSpec: null
originPhase: null
revisitTrigger: "Next swm spec whose gate runs the full npm test, or the next escalation that names these files"
tags: ["harness-defect", "tests", "environment"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
2026-11-15 dashboard-plain-pages task 11 escalated (w-416fa655): npm test failed 13 cases identically at base 1054a946, CI green there. Overwatch reproduced in the run worktree: src/evals/__tests__/graders.test.ts (no-attribution-trailer) and runner.test.ts (attribution trailer case) fail in any local env because the global core.hooksPath ~/.config/git/hooks/commit-msg strips Co-Authored-By trailers; with GIT_CONFIG_GLOBAL=/dev/null both files pass 43/43. project-manager-durable.test.ts (5, setDisplayName), log-implementation.test.ts and projectPath.test.ts (attribution override) pass in a plain shell and fail only under the controller's spawn env; same family as memory note shared-root-env-breaks-npm-test. Ruled as environment; task 11 told to treat these as passing.

## Decision Deferred
Make the affected tests independent of the machine: run fixture git commits with GIT_CONFIG_GLOBAL=/dev/null (or core.hooksPath unset) and clear SPEC_WORKFLOW_SHARED_ROOT / SPEC_WORKFLOW_WORKSPACE in the test setup, so a phase-completion npm test gate does not escalate on base failures.

## Revisit Criteria
Next swm spec whose gate runs the full npm test, or the next escalation that names these files
