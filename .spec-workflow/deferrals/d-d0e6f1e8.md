---
id: "d-d0e6f1e8"
status: "deferred"
title: "Shell-feed flush recomputes every spec of every project per trigger"
createdAt: "2026-10-08T21:36:00.614Z"
updatedAt: "2026-10-08T21:36:00.614Z"
resolvedAt: null
originSpec: "dashboard-shell"
originPhase: "implementation"
revisitTrigger: "a project registry nears the 5 s live-update bound"
tags: ["dashboard"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
---

## Context
Measured 4.1-4.2 s against the 5 s live-update bound in dashboard-shell. Deferred in the dashboard-shell retrospective (P14, option A): acceptable now, make the flush incremental before the bound is at risk.

## Decision Deferred
The shell feed flush recomputes every spec of every project on each trigger instead of updating incrementally.

## Revisit Criteria
a project registry nears the 5 s live-update bound
