---
id: "d-a38fea66"
status: "deferred"
title: "Verify the provider-per-role supervisor/orchestrator halves in a restarted session"
createdAt: "2026-09-23T22:37:35.991Z"
updatedAt: "2026-09-23T22:37:35.991Z"
resolvedAt: null
originSpec: "provider-per-role"
originPhase: "implementation"
revisitTrigger: "Next session restart after this spec's harness skills merge, before relying on DeepSeek-provider routing in a real document phase."
tags: ["verification", "provider-per-role"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
---

## Context
Task 10 verified the launcher, map-script and usage-fold halves of Requirement 7 in-process (all six scenarios and the full check suite passed, with a real DeepSeek launcher run). The supervisor half (refusal at the roots step) and the document-orchestrator half (routing a DeepSeek-provider worker to the launcher, and running an Anthropic reviser round through the Agent tool) depend on the merged harness skills, which agents and skills load only at session start; the current session loaded the pre-spec skills, so those halves cannot be exercised end-to-end this run.

## Decision Deferred
The supervisor/orchestrator end-to-end halves of scenarios (1)-(3) were not exercised this run; they need the merged skills in a restarted session.

## Revisit Criteria
run a fixture requirements round of a scratch spec with agent-rules.md naming sdd-reviewer: deepseek deepseek-v4-pro, then with every role anthropic, then with the key unset
