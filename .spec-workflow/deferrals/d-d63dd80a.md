---
id: "d-d63dd80a"
status: "deferred"
title: "Controller routes regression-guard-only tasks to the test author"
createdAt: "2026-10-30T16:21:56.762Z"
updatedAt: "2026-10-30T16:21:56.762Z"
resolvedAt: null
originSpec: "ca-acb-pooling"
originPhase: "implementation"
revisitTrigger: "Next swm harness spec or close-out batch; sooner if another run escalates on red-commit-ownership for a guard-only task"
tags: ["controller", "tdd", "harness-defect"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Hit on tradr ca-acb-pooling run-20261030-134018, task 1, 2026-10-30. The author wrote apps/api/src/db/schema/ca-acb-pooling.schema.test.ts (red 1acf3f3, 11 useful cases on the task's CHECKs, unique indexes and cascades). The declared Test was table-inventory.test.ts, marked "Regression guard, not a red test". Escalation w-b328b26e: overwatch ruled to keep the test and declared it on task 1 in tasks.md (tradr-hosted 1eaba3d). Each guard-only task with a Test seam costs one author spawn plus one escalation.

## Decision Deferred
isTddMarked (src/controller/phases/implementation.ts:252) routes every task that has a `- Test:` seam to sdd-test-author. It skips only `kind: e2e`. A task whose notes say "Regression guard, not a red test" still gets an author, which then writes a new, undeclared test file. The P5 red-commit-ownership gate then rejects it and the run escalates. Not decided: whether the tasks drafter must not emit `- Test:` for guard-only seams (brief-templates.ts:87 already says such ACs are "verified, not red-first"), or whether isTddMarked must skip blocks that mark every seam a regression guard.

## Revisit Criteria
Next swm harness spec or close-out batch; sooner if another run escalates on red-commit-ownership for a guard-only task
