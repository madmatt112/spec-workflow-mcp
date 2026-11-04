# Requirements — eval-drafter-success-scope-narrow

## Requirement 1 — multi-leg position model

**User Story:** As a trader, I want a position to hold multiple legs, so a spread shows as one position.

#### Acceptance Criteria

1. Component 1 SHALL add the multi-leg position model and its unit test under `src/features/positions/multi-leg/`. The parent directory `src/features/positions/` already holds `transfer-links.route.test.ts`, a concurrency-heavy DB route test that flakes under parallel load (recorded as d-81829919) and is unrelated to this change.
2. The task's Success check SHALL run the project's vitest over the touched subtree or files only, never the whole feature directory, so the unrelated flaky route test cannot red the task gate.
