---
id: "d-1cadcc61"
status: "deferred"
title: "Advisor launch input omits gates; real launchSpec validation would 400"
createdAt: "2026-10-27T06:55:27.335Z"
updatedAt: "2026-10-27T06:55:27.335Z"
resolvedAt: null
originSpec: "advisor"
originPhase: "implementation"
revisitTrigger: "When task 12 wires the real deps.launchSpec adapter in the confirm route, or the first time a confirmed advisor launch is exercised end to end."
tags: ["info-finding", "advisor", "launch", "task-11"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
The launch route sets gates:'record' itself before calling launchSpec (headless run, carried R3-minor-2). The advisor launch path reaches launchSpec via the deps.launchSpec adapter, which is wired in task 12. The task-11 launch test uses a fake deps.launchSpec that skips validateSetup, so the gap is invisible to it. Surfaced as an info finding in the task-11 review (not blocking, since the real adapter is task-12 scope).

## Decision Deferred
Task 11's execLaunch forwards input = { spec, ...params } with no gates, but the real launchSpec runs validateSetup which rejects an undefined gates (block|record required) with a 400. Neither execLaunch nor launchSpec injects gates:'record' the way the HTTP launch route does.

## Revisit Criteria
When task 12 wires the real deps.launchSpec adapter in the confirm route, or the first time a confirmed advisor launch is exercised end to end.
