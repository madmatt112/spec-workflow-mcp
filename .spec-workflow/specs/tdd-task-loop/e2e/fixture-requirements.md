# Requirements Document — tdd-fixture

## Introduction

`tdd-fixture` is a throwaway spec used only by the tdd-task-loop end-to-end
scenario. Its three tasks exercise the three loop branches in one headless run:
a marked task whose test is honestly red at the base, an unmarked docs-only
task, and a marked task whose behaviour already exists so its test cannot be
made red. Nothing here ships; the kit builds it in a scratch code root.

## Requirements

### Requirement 1 — Honest red (marked task)

**User Story:** As the loop, I want a marked task whose named test fails at the
base, so that the author writes a red test and the gate records `assertion-red`.

#### Acceptance Criteria

1. WHEN the author runs the task 1 test against the base THEN it SHALL fail,
   because `toPercentLabel` does not yet exist in `src/labels.js`.
2. THE task 1 checkbox SHALL carry a `- Test:` line naming a `src/__tests__/`
   path and the public call under test.

### Requirement 2 — Docs-only (unmarked task)

**User Story:** As the loop, I want an unmarked docs-only task, so that the
phase spawns no author and records no `tdd` block for it.

#### Acceptance Criteria

1. THE task 2 files SHALL be documentation only (`README.md`) and the task SHALL
   carry no `- Test:` line.

### Requirement 3 — Already met (marked task)

**User Story:** As the loop, I want a marked task whose behaviour already exists
at the base, so that the author reports `RED-IMPOSSIBLE` and the phase takes the
design-defect stop.

#### Acceptance Criteria

1. WHEN the author runs the task 3 test against the base THEN it SHALL pass,
   because `clampPercent` already clamps values over 100 to 100 in
   `src/clamp.js`.
2. THE task 3 checkbox SHALL carry a `- Test:` line naming a `src/__tests__/`
   path and the public call under test.
