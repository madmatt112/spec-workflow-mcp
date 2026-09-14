---
id: "d-f3cb6fd8"
status: "deferred"
title: "Two read-every-file instructions survive the all-drop guard, byte-pinned across a spec boundary"
createdAt: "2026-07-30T18:06:37.768Z"
updatedAt: "2026-07-30T18:06:37.768Z"
resolvedAt: null
originSpec: "worktree-execution-context"
originPhase: "tasks"
revisitTrigger: "When tighter-reviews is next revised or completed, or when a reviewing agent is observed returning a pass on an all-drop review despite the two-site guard, or when the methodology golden fixtures are regenerated for any other reason."
tags: []
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
---

## Context
worktree-execution-context R4 AC 20 makes the all-drop disclosure actionable at the two sites that spec owns: the runner's numbered prompt instruction (src/dashboard/task-review-runner.ts:283) and the nextSteps guidance (src/tools/review-task.ts:426). The v2 adversarial review on tasks found two more instruction sites, both pinned. The methodology header at :584 appears in all seventeen committed fixtures under src/tools/__tests__/__fixtures__/methodology/. R4_2A_DIFF_EMPTY at :684 is byte-pinned by a two-way drift test (src/tools/__tests__/review-task.test.ts:1293) comparing against the tighter-reviews spec's requirements.md — a different spec's approved document, which is gitignored, so the test is skipIf-disabled in a fresh clone and live on the maintainer's machine. Worse, R4_2A fires necessarily on the all-drop path: an empty workspace file set yields an empty diff with no rejection at src/core/task-diff.ts:41-43, classifying as the benign empty case. Options considered: (a) narrow R4 AC 20 to the two owned sites and record this residual, chosen; (b) grow the task to cover all four, regenerating fixtures and resolving the cross-spec pin, roughly two days and requiring edits to another spec's approved requirements; (c) split into a separate task with its own approval. Chose (a) because the two owned sites sit on the direct disclosure path, and the other two need a cross-spec decision this spec should not make unilaterally.

## Decision Deferred
Not changing the unconditional methodology header (src/tools/review-task.ts:584) or the R4_2A_DIFF_EMPTY constant (:684). An all-drop review still receives two instructions to read every listed file, and R4_2A still supplies the fabricated "the task changes were already committed before review" explanation.

## Revisit Criteria
Any of: tighter-reviews reaches a state where its requirements.md can be amended; an observed passing verdict on a zero-file review; the seventeen methodology fixtures being regenerated for another change, which makes the marginal cost of including these two constants near zero.
