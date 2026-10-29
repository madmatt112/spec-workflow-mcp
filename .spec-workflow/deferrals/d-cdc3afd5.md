---
id: "d-cdc3afd5"
status: "resolved"
title: "Keyboard focus ring on the danger Discard button is invisible (1.07:1); worktree-visual e2e red on main"
createdAt: "2026-10-29T16:52:21.214Z"
updatedAt: "2026-10-29T16:58:33.348Z"
resolvedAt: "2026-10-29T16:58:33.348Z"
originSpec: "dashboard-visual-refresh"
originPhase: "implementation"
revisitTrigger: "Next swm frontend change, or before the next frontend spec's verification"
tags: ["frontend", "a11y", "e2e", "bug"]
resolution: "Fixed in PR #192 (merge e61fb627): new token --focus-ring-on-solid (#000000 light, #ffffff dark) for the primary and danger solid buttons, at least 3.38:1 on every solid fill and hover in both themes; frontend-tokens.test.ts asserts the four new pairs. The full e2e/worktree-visual.spec.ts suite passes (7 passed, 6 opt-in capture skips). The CI gap (worktree e2e not in CI) stays as a note here; not changed."
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
2026-10-29: on origin/main e12b2499, `npx playwright test -c playwright.worktree.config.ts e2e/worktree-visual.spec.ts` fails at worktree-visual.spec.ts:217: "runs (light) stop 9 (BUTTON ... bg-(--danger-solid) ... :ctrl-discard) Expected >= 3, Received 1.068". The test measures outline color against the nearest non-transparent background, which for the danger-solid button is its own fill. dashboard-visual-refresh's task 6 verification passed this suite, and its retro PR #189 (6ba6dfa0, shared Button for Gear plus a widened seed/capture) changed this spec file and e2e/helpers. CI does not run the worktree e2e suite, so #189 merged with this red. dashboard-project-list's task 13 also saw it (Implementation Logs task-13). The 4 later tests in the serial describe do not run when this fails. Also consider adding `npm run test:e2e:worktree` to CI, or to the merge gate for frontend PRs, so a retro PR cannot merge it red again.

## Decision Deferred
Give danger-solid buttons a focus ring that reaches 3:1 (a danger-specific ring token, or an offset ring checked against the surrounding surface), and get e2e/worktree-visual.spec.ts "keyboard focus shows the focus ring on every view" green on main.

## Revisit Criteria
Next swm frontend change, or before the next frontend spec's verification
