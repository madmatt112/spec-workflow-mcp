# Tasks Document — tdd-fixture
Document version: v1

Three tasks, one per loop branch: a marked task honestly red at the base, an
unmarked docs-only task, and a marked task whose behaviour already exists.

- [ ] 1. Add the percent-label helper
  - File: src/labels.js
  - File: src/__tests__/labels.test.js
  - Test: src/__tests__/labels.test.js — toPercentLabel(0.5) returns '50%'
  - _Requirements: 1.1, 1.2_
  - _Prompt: Task: Add `toPercentLabel(fraction)` to `src/labels.js` returning `` `${Math.round(fraction * 100)}%` ``, and the named test that calls it | Restrictions: Only add the helper and its test; do not touch `src/clamp.js` | Success: `node --test src/__tests__/labels.test.js` passes_

- [ ] 2. Document the clamp helper in the README
  - File: README.md
  - _Requirements: 2.1_
  - _Prompt: Task: Add a Usage section to `README.md` that names `clampPercent` and shows one call | Restrictions: Documentation only; change no file under `src/` and add no test | Success: `README.md` names `clampPercent`_

- [ ] 3. Clamp percentages above one hundred
  - File: src/clamp.js
  - File: src/__tests__/clamp.test.js
  - Test: src/__tests__/clamp.test.js — clampPercent(150) returns 100
  - _Requirements: 3.1, 3.2_
  - _Prompt: Task: Ensure `clampPercent(150)` returns `100`, with the named test that asserts it | Restrictions: Do not weaken the existing clamp; add only the test | Success: `node --test src/__tests__/clamp.test.js` passes_
