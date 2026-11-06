---
id: "d-5d1b63ce"
status: "deferred"
title: "Flaky test: controller.test.ts DeployCoordinator.tick \"a run in drivenRuns stops the unit from starting\""
createdAt: "2026-11-06T02:41:49.167Z"
updatedAt: "2026-11-06T02:41:49.167Z"
resolvedAt: null
originSpec: "dashboard-deploy"
originPhase: null
revisitTrigger: "Next swm harness batch, or the next CI failure of this test"
tags: ["controller", "test-flake"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
On 2026-11-06 the test failed in CI on close-out PR #206 (run 42151358631): at controller.test.ts:1971 unit.start was called 0 times, expected 1. PR #206 does not touch that code. The same test passed on main at 6b645fae, and the re-run of the failed job passed. Timing in the control half of the test (the same unit starts once the drive ends) is the likely cause, but this was not diagnosed. The code under test is the new DeployCoordinator, so a real race is possible. The advisor push.test.ts retry test is a separate known flake.

## Decision Deferred
Diagnose if the failure is a test timing problem or a real race in DeployCoordinator.tick and pump, then fix that cause.

## Revisit Criteria
Next swm harness batch, or the next CI failure of this test
