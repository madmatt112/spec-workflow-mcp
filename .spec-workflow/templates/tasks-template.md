# Tasks Document

[Shape rules, read by the parser and the implementer. Each task is `- [ ] N. Title` (sub-tasks `- [ ] N.M Title`), then `- File:` lines, one or two action lines, a `- Purpose:` line, `_Leverage: …_`, `_Requirements: …_`, and a `_Prompt: Task: … | Restrictions: … | Success: …_` line that ends with `_`. Every task numbered, so the parser counts it. Cap: 150 words per task block, excluding its prompt line. One paragraph before the first task states the dependency order: each task leaves the tree compiling and every existing suite green. A prompt never pins a call signature, label or helper name that another task in this document creates; it names the task that does. When a task uses an artefact a later task creates, the prompt names the bridge (a cast, a stub) and the later task's prompt says to remove it. For every existing test file a task names, say whether the change alters a value it asserts exactly.]

[Dependency order: one paragraph.]

- [ ] 1. Create core interfaces in src/types/feature.ts
  - File: src/types/feature.ts
  - Define the feature's data-structure interfaces, extending the base interfaces
  - Purpose: Type safety for the feature implementation
  - _Leverage: src/types/base.ts_
  - _Requirements: 1.1_
  - _Prompt: Task: Create the TypeScript interfaces for the feature data structures per requirement 1.1, extending src/types/base.ts | Restrictions: Do not modify the base interfaces; follow project naming conventions | Success: Interfaces compile, inherit from the base types, cover every field requirement 1.1 names_

- [ ] 2. Implement feature service in src/services/FeatureService.ts
  - File: src/services/FeatureService.ts
  - Implement the service using the interfaces task 1 exports and the existing error utilities
  - Purpose: Business logic layer for feature operations
  - _Leverage: src/services/BaseService.ts, src/utils/errorHandler.ts_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Task: Implement FeatureService per requirements 2.1 and 2.2, extending BaseService and using the interfaces task 1 exports, with error handling from src/utils/errorHandler.ts | Restrictions: Do not bypass validation; keep data access out of the service | Success: Every interface method implemented, errors handled through the shared utility, unit tests in tests/services/FeatureService.test.ts pass_

- [ ] 3. Add API endpoints
  - File: src/api/featureRoutes.ts
  - Purpose: Expose the service over HTTP
  - _Leverage: src/api/baseApi.ts_
  - _Requirements: 3.0_
  - _Prompt: Task: Register the feature routes per requirement 3.0 following src/api/baseApi.ts | Restrictions: REST conventions; no internal shapes on the wire | Success: Routes registered with the right methods and status codes; integration tests pass_

- [ ] 3.1 Implement CRUD handlers
  - File: src/api/featureHandlers.ts
  - Validate every request; call the service task 2 exports
  - Purpose: Complete the endpoint behaviour
  - _Leverage: src/controllers/BaseController.ts, src/utils/validation.ts_
  - _Requirements: 3.1, 3.2_
  - _Prompt: Task: Implement the CRUD handlers per requirements 3.1 and 3.2, validating input with src/utils/validation.ts and calling the service task 2 exports | Restrictions: Validate every input; follow the existing controller pattern | Success: Every operation works end to end; invalid input is rejected with the documented status; tests/api/feature.test.ts passes_
