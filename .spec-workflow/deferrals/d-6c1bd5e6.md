---
id: "d-6c1bd5e6"
status: "deferred"
title: "T2 contrast check omits the neutral tone"
createdAt: "2026-10-29T03:13:14.953Z"
updatedAt: "2026-10-29T03:13:14.953Z"
resolvedAt: null
originSpec: "dashboard-visual-refresh"
originPhase: "implementation"
revisitTrigger: "When task 5 (or any later task) changes --tone-neutral-* values, or when touching frontend-tokens.test.ts; add neutral to the TONES array so the neutral contrast pairs are asserted directly."
tags: ["info-finding", "dashboard-visual-refresh", "task-2"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Non-blocking at task-2 review: --tone-neutral-fg/-bg hold the same hex as --text-muted/--surface-inset in both themes, and those exact value pairs ARE asserted (text-muted x surfaces incl. inset and panel), so no contrast guarantee is lost now. The gap is latent: if a later task edits --tone-neutral-fg/-bg to diverge from text-muted/surface-inset, T2 would not catch a broken neutral contrast pair. Recorded as info finding on review 42c2abd4 (verdict: findings, 0 critical/warning).

## Decision Deferred
frontend-tokens.test.ts CONTRAST_PAIRS (TONES array, line 147) checks 5 tones (success, warning, danger, info, accent) but not neutral, though design Data Models says 'each --tone-X-fg on its --tone-X-bg and on --surface-panel' across all six tones. The neutral pair is not directly asserted.

## Revisit Criteria
When task 5 (or any later task) changes --tone-neutral-* values, or when touching frontend-tokens.test.ts; add neutral to the TONES array so the neutral contrast pairs are asserted directly.
