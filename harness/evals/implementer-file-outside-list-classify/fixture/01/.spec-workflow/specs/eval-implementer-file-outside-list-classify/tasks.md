# Tasks

Dependency order: task 1 only; it leaves the tree compiling with the existing suite green.

- [ ] 1. Add the multi-leg aggregate helper
  - File: src/features/positions/multi-leg/model.ts
  - Purpose: aggregate a position's legs into one total.
  - _Leverage: none_
  - _Requirements: 1.1_
  - _Prompt: Task: add aggregateLegs(position) per requirement 1.1 | Restrictions: edit only the listed files | Success: ./node_modules/.bin/vitest run src/features/positions/multi-leg is green_
