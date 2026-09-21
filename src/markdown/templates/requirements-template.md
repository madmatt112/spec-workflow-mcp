# Requirements Document

[Cap: 3,500 words for the whole document. Every sentence is for an agent that acts on it: a criterion, a decision, a constraint, a citation. Describe the codebase in codebase-context.md, not here.]

## Introduction

[Three sentences: what the feature is, who it is for, what it changes.]

## Alignment with Product Vision

[Three sentences: which product.md goals this serves and how.]

## Requirements

### Requirement 1

**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria

1. WHEN [event] THEN [system] SHALL [response]
2. IF [precondition] THEN [system] SHALL [response]
3. WHEN [event] AND [condition] THEN [system] SHALL [response]

### Requirement 2

**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria

1. WHEN [event] THEN [system] SHALL [response]
2. IF [precondition] THEN [system] SHALL [response]

## Non-Functional Requirements

[Only the ones this feature changes, one line each. Delete the headings that do not apply.]

### Performance
- [Requirement]

### Security
- [Requirement]

### Reliability
- [Requirement]

## Decisions taken in this document

[Every call made on the product's behalf, so a human can confirm or overturn it.]

[In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.]

- D1 — [decision]: [options considered]; chosen because [one line]
- D2 — [decision]: [options considered]; chosen because [one line]

## Scope notes

[What the decomposition entry lists that this document cuts or defers, with the reason. Carried items from an earlier phase that do not apply here, with the reason. Write "none" when empty.]
