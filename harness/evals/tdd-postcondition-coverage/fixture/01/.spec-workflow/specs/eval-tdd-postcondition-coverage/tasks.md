# Tasks

Dependency order: task 1 only; it leaves the tree compiling with the existing suite green.

- [ ] 1. Build the budget split
  - File: src/budget.js
  - Test: tests/budget.test.js — splitBudget(total, legs)
  - Purpose: split a total across legs under the design's numbered post-conditions.
  - _Leverage: none_
  - _Requirements: 1.1_
  - _Prompt: Task: add splitBudget(total, legs) per requirement 1.1 and design post-conditions PC1, PC2, PC3 | Restrictions: edit only the listed files | Success: splitBudget(100, 3) satisfies PC1 (the returned leg budgets sum to the total 100), PC2 (no leg budget is negative), and PC3 (the reserve equals 10 of the total)_
