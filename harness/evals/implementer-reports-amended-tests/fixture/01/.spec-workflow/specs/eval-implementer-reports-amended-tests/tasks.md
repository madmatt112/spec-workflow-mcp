# Tasks

Dependency order: task 1 only; it leaves the tree compiling with the existing suite green.

- [ ] 1. Add leg field parsing
  - File: src/features/positions/multi-leg/fields.ts
  - Test: src/features/positions/multi-leg/fields.test.ts — parseFields(raw)
  - Purpose: parse and sanitise a leg's display fields.
  - _Leverage: none_
  - _Requirements: 1.1_
  - _Prompt: Task: implement parseFields(raw) so it trims each value per requirement 1.1 | Restrictions: edit only the listed files; if the author test asserts a wrong expected value, amend it | Success: ./node_modules/.bin/vitest run src/features/positions/multi-leg/fields.test.ts is green_
