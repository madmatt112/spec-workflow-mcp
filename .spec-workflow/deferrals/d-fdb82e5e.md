---
id: "d-fdb82e5e"
status: "deferred"
title: "Retro analyst writes its proposals to scratch and never copies them into the spec folder"
createdAt: "2026-10-30T00:36:40.261Z"
updatedAt: "2026-10-30T00:36:40.261Z"
resolvedAt: null
originSpec: "run-pause"
originPhase: "implementation"
revisitTrigger: "Next harness agent change, or the next \"wrote no retrospective-proposals.md\" error"
tags: ["harness", "retro", "bug"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
2026-10-30, run-20261029-194113 (run-pause): the retrospective phase failed twice with "the analyst wrote no retrospective-proposals.md" (wait w-31e235ba). The step log shows the analyst wrote /tmp/scratchpad/sdd/run-pause/retrospective-proposals.md (12 proposals) both times, although its brief (/tmp/scratchpad/sdd/run-pause/retro-analyst-brief.md line 6) names .spec-workflow/specs/run-pause/retrospective-proposals.md. agent-rules.md lines 51-55 tell worktree-isolated sessions to write .spec-workflow files to scratch and then cp them into place; the analyst applied the first half only. The coordinator copied the file in and retried, which worked. Fix candidates: a line in harness/agents/sdd-retro-analyst.md ("write the output file at the path named; you are not worktree-isolated"), and/or a controller fallback.

## Decision Deferred
Make the retro analyst write retrospective-proposals.md at the exact path its brief names (it is not worktree-isolated), or have the controller look in /tmp/scratchpad/sdd/<spec>/ and copy the file in before failing the phase.

## Revisit Criteria
Next harness agent change, or the next "wrote no retrospective-proposals.md" error
