---
id: "d-bbad43e4"
status: "deferred"
title: "design.md:110 wrongly calls ToolContext.workspacePath an untranslated host path"
createdAt: "2026-07-31T13:06:57.500Z"
updatedAt: "2026-07-31T13:06:57.500Z"
resolvedAt: null
originSpec: "worktree-execution-context"
originPhase: "implementation"
revisitTrigger: "Next time worktree-execution-context's design.md is opened for revision, or when worktree-review-signals inherits design language about path translation."
tags: ["design-accuracy", "worktree", "path-translation"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
---

## Context
Found during task 6 and confirmed by an independent reviewer. design.md:110 describes ToolContext.workspacePath as an "untranslated host path". Requirement 5.6 names project.workspacePath, which is translated (project-manager.ts:116 assigns translatePath(entry.workflowRootPath) to projectPath, and :117 the workspace equivalent), and in-process consumers — diff, typecheck, file resolution — need the translated form because they do filesystem access with it. Task 6 followed the acceptance criterion, which is the correct call; the design sentence is simply wrong. This matters because tasks 7 (runner contract split) and 14 (selectRoots) both build directly on this field, and a reader trusting design.md would reintroduce the wrong-root defect this spec exists to fix. The implementation loop does not amend approved spec documents, so the correction was made only in the src/types.ts doc comment, which now names design.md:110 as wrong so nobody "corrects" the code back.

## Decision Deferred
Not decided: whether to amend the approved design.md, which states the opposite of what requirement 5.6 requires and of what the implementation does. The code comment in src/types.ts was corrected and now records that design.md is wrong, but the design document itself is unchanged.

## Revisit Criteria
The document loop re-enters design for this spec (needs-revision branch), or worktree-review-signals drafts a design describing ToolContext path fields.
