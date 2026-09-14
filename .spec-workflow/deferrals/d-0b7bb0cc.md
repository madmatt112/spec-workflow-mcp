---
id: "d-0b7bb0cc"
status: "deferred"
title: "isProcessAlive cannot verify PIDs under Docker path translation"
createdAt: "2026-07-29T17:54:38.275Z"
updatedAt: "2026-07-29T17:54:38.275Z"
resolvedAt: null
originSpec: "worktree-execution-context"
originPhase: "design"
revisitTrigger: "When Docker users report phantom or accumulating projects in the dashboard, or when the registry self-heal work is revisited for any other reason — a heartbeat mechanism would replace PID liveness for all deployments, not just Docker."
tags: ["docker", "registry", "liveness", "self-heal", "worktree"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
---

## Context
Designing worktree-execution-context, Requirement 2 AC 7 required a stated position on the Docker path-translation env vars at the runner spawn boundary. The position taken: preserve them unchanged in spawned children, because the child needs them to translate paths. The v2 adversarial review noted the side effect — isProcessAlive returns true unconditionally under those vars (src/core/project-registry.ts:164-171), because host PIDs are not checkable from inside a container. Consequence: cleanupStaleProjects never reaps dead instances in Docker, so registry entries accumulate and phantom projects persist in the dashboard. This is pre-existing behaviour, not introduced by this spec, but Requirement 1 makes it more visible by creating one registry entry per worktree rather than collapsing them into one. Fixing it properly needs a liveness signal that crosses the container boundary — a heartbeat file written by each live MCP server with a staleness timeout, replacing PID checks entirely — which is a separate mechanism from the optimistic-write concurrency work in Requirement 11.

## Decision Deferred
Not fixing the unconditional `return true` in ProjectRegistry.isProcessAlive when SPEC_WORKFLOW_HOST_PATH_PREFIX and SPEC_WORKFLOW_CONTAINER_PATH_PREFIX are both set. Registry self-healing stays disabled in Docker deployments.

## Revisit Criteria
Reported phantom projects in a containerised deployment, or any change to registry liveness/self-heal. Related to the broader pattern of forward-written metadata never being back-cleared.
