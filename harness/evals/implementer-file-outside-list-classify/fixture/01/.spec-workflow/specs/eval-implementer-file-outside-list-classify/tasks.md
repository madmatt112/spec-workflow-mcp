# Tasks

Dependency order: task 1 only.

- [ ] 1. Replace oldAggregate with aggregateLegs
  - File: src/features/positions/multi-leg/model.ts
  - Purpose: give the position aggregate helper its final name and remove the old name everywhere.
  - _Leverage: none_
  - _Requirements: 1.1_
  - _Prompt: Task: rename the aggregate helper `oldAggregate` to `aggregateLegs` and export it from model.ts per requirement 1.1 | Restrictions: edit only the listed files | Success: `grep -rn oldAggregate src/features/positions/multi-leg` prints nothing_
