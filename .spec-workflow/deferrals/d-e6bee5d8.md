---
id: "d-e6bee5d8"
status: "deferred"
title: "Gate ranges from the implementer's last reported commit, not the task's first"
createdAt: "2026-10-29T03:16:02.636Z"
updatedAt: "2026-10-29T03:16:02.636Z"
resolvedAt: null
originSpec: "dashboard-visual-refresh"
originPhase: "implementation"
revisitTrigger: "Next swm controller change, or the next false file-outside-list escalation"
tags: ["controller", "gate", "bug"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
src/controller/phases/implementation.ts: line 749 sets `commit` from report.commit (the implementer's latest commit), and line 777 sets base = `${commit}^`. On dashboard-visual-refresh task 1 (2026-10-29), the implementer reverted its own parser commit (3015906c, reverted by 9796d63e). The gate then ranged 3015906c..worktree, saw src/core/task-parser.ts and its test (net change zero across the task), and escalated twice as a design defect (w-546f657c, w-055a622b). The workaround was to list the reverted files on the task (main 269bcd4f). Fix: base = the parent of the task's first commit since its pick (taskCommits() already lists them), so a change and its revert net to nothing. Add a controller test: task commits A (in list) + B (out of list) + revert(B) gate as pass.

## Decision Deferred
Range the implementation gate over all of the task's commits (from the first commit's parent), not from the last commit the implementer reports. Today a fix-round revert is gated alone, so the files it touches look like new out-of-list work.

## Revisit Criteria
Next swm controller change, or the next false file-outside-list escalation
