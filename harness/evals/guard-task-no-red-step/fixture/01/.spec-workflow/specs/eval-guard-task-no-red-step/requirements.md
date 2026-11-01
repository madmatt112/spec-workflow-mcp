# Requirements — eval-guard-task-no-red-step

## Requirement 1 — the config schema

**User Story:** As a developer, I want a declared config shape, so every reader of the config agrees on its fields.

#### Acceptance Criteria

1. Component 1 SHALL define the `AppConfig` type and its default-values object in `src/config/schema.ts`. It is a data shape only: nothing in it runs, and no branch of it can fail before the file exists.

## Requirement 2 — the config loader

**User Story:** As a caller, I want to load config from a file, so the app reads its settings at start-up.

#### Acceptance Criteria

1. Component 2 SHALL export `loadConfig(path)` in `src/config/loader.ts`. It reads the file at `path`, returns an `AppConfig`, and throws when a required key is absent.
