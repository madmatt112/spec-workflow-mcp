# Requirements — eval-drafter-success-includes-eslint

## Requirement 1 — the position formatter

**User Story:** As a trader, I want positions formatted for display, so the list reads cleanly.

#### Acceptance Criteria

1. Component 1 SHALL add `formatPosition(position)` in `src/features/positions/format.ts`, a TypeScript source file.
2. The task's Success check SHALL run the worktree-root ESLint binary over the edited TypeScript files, so a lint error (for example `import-x/order`) reds at the task gate rather than later at the phase-completion gate.
