---
id: "d-324dbe0d"
status: "resolved"
title: "harness-bookkeeping live-plugin e2e half: MCP harness tool + hook spawn events"
createdAt: "2026-09-15T20:15:44.631Z"
updatedAt: "2026-09-16T21:07:25.322Z"
resolvedAt: "2026-09-16T21:07:25.322Z"
originSpec: "harness-bookkeeping"
originPhase: "implementation"
revisitTrigger: "After the release that republishes the server and the spec-workflow-harness plugin is re-installed and sessions restarted."
tags: ["verification", "harness-bookkeeping"]
resolution: "Confirmed live under 5.7.0 in run run-20260916-194812 (question-gates requirements). Part 1 — MCP harness tool responds live: `harness orient` for question-gates/requirements returned D=4 A=4 P=true narrowCheck=true nextStep=Step5. Part 2 — plugin hooks wrote worker spawn.start/spawn.end with roles in .spec-workflow/specs/question-gates/harness-events.jsonl (sdd-drafter role=drafter; sdd-reviser role=lint and role=reviser; sdd-reviewer; sdd-checker). Caveat (separate defect): the four orchestrator agent definitions do not allowlist mcp__spec-workflow__harness, so orchestrators fall back to manual orient/brief; the tool itself is functional."
resolvedInSpec: null
supersededBy: null
supersedes: null
---

## Context
The `harness` MCP tool and the hook `spawn.start`/`spawn.end` writes are new on branch feat/harness-bookkeeping. The running MCP server and the installed plugin still lack them; they land only when the release republishes and the plugin is re-installed (CLAUDE.md). So the end-to-end verifier could not exercise the live half of decomposition scenarios 1-3 in this session. The in-process/tool half all passed: npm run build, npm test (1233 tests, 2 skipped), npm run check:plugin-assets, claude plugin validate --strict; orient returned the Step 0 nextStep on the real store, brief wrote a task-3 block byte-for-byte equal to taskBlock, and the hook node test drove spawn.start/spawn.end correctly. Fixture staged under /tmp/scratchpad/sdd/harness-bookkeeping/scratch-store/.

## Decision Deferred
Not verified live: a real MCP `harness orient` call over the republished server, and the hook firing `spawn.start`/`spawn.end` on a real sdd-* agent spawn in a live SDD session.

## Revisit Criteria
In a live SDD run after reinstall: (1) call MCP `harness` action orient for a spec and confirm data.nextStep is populated; (2) spawn one sdd-* worker via a brief-path prompt, then `grep -c 'spawn.start' .spec-workflow/specs/<spec>/harness-events.jsonl` shows a spawn.start with role=impl plus a matching spawn.end, and confirm the orchestrator itself wrote no worker spawn.start/spawn.end.
