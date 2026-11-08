---
id: "d-83cc3ac1"
status: "resolved"
title: "Operator decisions from the option-lifecycle-events retro not built: P6 Option A, G1, G2; close-out skips recorded answers"
createdAt: "2026-11-06T18:25:11.720Z"
updatedAt: "2026-11-08T04:37:55.417Z"
resolvedAt: "2026-11-08T04:37:55.417Z"
originSpec: "option-lifecycle-events"
originPhase: null
revisitTrigger: "Next swm harness batch or spec"
tags: ["controller", "harness-defect"]
resolution: "G1 and G2 text went verbatim into .spec-workflow/agent-rules.md ## Checks; P6 Option A and the close-out \"skipped: no change chosen\" fix were built in this spec."
resolvedInSpec: "decisions-and-launch-guard"
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
On 2026-11-06 the operator approved all proposals of the option-lifecycle-events retro. The close-out marked P11, G1 and G2 "skipped: no change chosen" and P6 "to-do (human)". This is the second time: see d-37e510db (eval-gate-runs P5). P11 is held on tradr deferral d-8619948d. The dashboard-deploy close-out did build its decisions P2 and P8, so the failure is not constant: the skipped items carry a target outside code or a required eval that the framework cannot host. P6's close-out note says the named eval needs a gate or orchestrator role that schemas.ts lacks. P1 targeted a deleted orchestrator agent; launch checks belong to d-aaf54e29.

## Decision Deferred
Build P6 Option A (the gate emits a tasks.md File-list patch for the controller to apply, then re-runs the task) without the eval that cannot exist. Apply G1 and G2 rule text to agent-rules.md. Fix the close-out so that an approved item with a recorded decision is never "no change chosen".

## Revisit Criteria
Next swm harness batch or spec
