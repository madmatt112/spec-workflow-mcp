---
id: "d-3a26cd7c"
status: "deferred"
title: "Eval selector marks provisional per brief-source change, not only when it is the sole reason (R3 AC6)"
createdAt: "2026-10-23T20:09:31.418Z"
updatedAt: "2026-10-23T20:09:31.418Z"
resolvedAt: null
originSpec: "harness-evals"
originPhase: "implementation"
revisitTrigger: "When the --dry-run preview's provisional labelling is reworked, or if any downstream consumer begins acting on the provisional flag (today only the CLI preview reads it)."
tags: ["info-finding"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Task-8 (harness-evals) verifier info finding. selectCases in src/evals/select.ts (line ~201) sets provisional=true whenever a brief-source file (src/tools/brief-templates.ts or harness.ts) changed in provisional mode, even when a hard reason (case/role/profile/grader) also selects the case. R3 AC6 (requirements.md:56) says to mark provisional only a case "selected by that signal alone". Design Component 7 post-condition 6 (design.md:107) states it unconditionally and the implementation faithfully matches the design. Effect is limited to --dry-run preview labelling; the real deploy runs exact mode where provisional is always false, so no deploy pass/fail decision changes.

## Decision Deferred
Whether to narrow the provisional flag to cases selected by the brief-source signal alone (per R3 AC6), or keep the design's unconditional per-brief-source marking.

## Revisit Criteria
When the --dry-run preview's provisional labelling is reworked, or if any downstream consumer begins acting on the provisional flag (today only the CLI preview reads it).
