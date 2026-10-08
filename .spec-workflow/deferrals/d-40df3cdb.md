---
id: "d-40df3cdb"
status: "deferred"
title: "dashboard-shell check 3: press the enabled Launch once"
createdAt: "2026-10-08T21:09:22.102Z"
updatedAt: "2026-10-08T21:09:22.102Z"
resolvedAt: null
originSpec: "dashboard-shell"
originPhase: "implementation"
revisitTrigger: "Next time Matthew runs the rebuilt dashboard. Press Launch once on a fixture project and confirm a run starts: run.start appears in that spec's harness-events.jsonl and the card shows the run as live."
tags: ["verification", "dashboard"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
---

## Context
Overwatch live checks for PR #86 (2026-10-07) verified the setup API and the disabled reason "A run is live for this project." (RunsPage.tsx:176-184,234). Pressing Launch starts a real harness run, so that was left to the operator. Matthew ruled on 2026-10-08 to accept check 3 as partial and carry the Launch press as this deferral, so the retrospective can run.

## Decision Deferred
Verification check 3 (Launch on the Runs page) is only partly verified. The disabled-reason path passed. The enabled Launch button was not pressed, so it is not proven that a launch starts a run.

## Revisit Criteria
Next time Matthew runs the rebuilt dashboard. Press Launch once on a fixture project and confirm a run starts: run.start appears in that spec's harness-events.jsonl and the card shows the run as live.
