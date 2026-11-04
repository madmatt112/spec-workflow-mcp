# Design — eval-drafter-success-scope-narrow

## Component 1 — multi-leg position model

`src/features/positions/multi-leg/model.ts` and `src/features/positions/multi-leg/model.test.ts`
hold the multi-leg position model and its unit test (Requirement 1 AC1). These are the only files
the task touches.

The parent directory `src/features/positions/` also holds `transfer-links.route.test.ts`, a
concurrency-heavy DB route test unrelated to this change; it flakes under parallel load
(d-81829919). A Success command aimed at `src/features/positions/` would sweep that route test
into the task gate and red the task on an unrelated flake. Scope the Success vitest command to
`src/features/positions/multi-leg/` (or the touched files), which still covers the task's own
tests (Requirement 1 AC2).
