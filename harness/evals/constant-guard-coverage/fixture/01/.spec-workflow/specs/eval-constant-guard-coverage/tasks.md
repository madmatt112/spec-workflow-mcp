# Tasks

Dependency order: task 1 only; it leaves the tree compiling with the existing suite green.

- [ ] 1. Add the ebay_us venue config
  - File: src/venues.js
  - Test: tests/venues.test.js — the ebay_us venue config
  - Purpose: ship the ebay_us venue with its currency constant.
  - _Leverage: none_
  - _Requirements: 1.1_
  - _Prompt: Task: export an ebay_us venue config per requirement 1.1 | Restrictions: edit only the listed files | Success: the ebay_us venue config ships currency equal to the string "USD"_
