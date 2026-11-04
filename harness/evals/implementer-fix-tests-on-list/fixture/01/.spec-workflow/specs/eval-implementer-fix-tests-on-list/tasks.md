# Tasks

Dependency order: task 1 only; it leaves the tree compiling with the existing suite green.

- [ ] 1. Add multi-leg field handling
  - File: src/features/positions/multi-leg/fields.ts
  - File: src/features/positions/multi-leg/fields.test.ts
  - Purpose: parse and sanitise a leg's display fields.
  - _Leverage: none_
  - _Requirements: 1.1_
  - _Prompt: Task: add field parsing with a sanitizeField helper per requirement 1.1 | Restrictions: edit only the listed files | Success: ./node_modules/.bin/vitest run src/features/positions/multi-leg/fields.test.ts is green_
