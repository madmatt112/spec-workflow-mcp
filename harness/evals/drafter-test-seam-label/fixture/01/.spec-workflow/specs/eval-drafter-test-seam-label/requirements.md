# Requirements — eval-drafter-test-seam-label

## Requirement 1 — the seam provider

**User Story:** As a caller, I want a validated seam, so other components stop re-validating input themselves.

#### Acceptance Criteria

1. Component 1 SHALL export `callSeam(input)` and return its validated result.

## Requirement 2 — the seam consumer

**User Story:** As the consumer, I want to validate through the shared seam, so validation logic is not duplicated.

#### Acceptance Criteria

1. Component 2 SHALL validate every input by calling `callSeam(input)` from Requirement 1.
