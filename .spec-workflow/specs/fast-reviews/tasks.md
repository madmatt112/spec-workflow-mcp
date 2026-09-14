# Tasks Document

## Dependency Graph

- **Track A — adversarial scaffold (tasks 1–4):** edits to `src/tools/adversarial-review.ts` and `src/tools/__tests__/adversarial-review.test.ts`. Land in order 1 → 2 → 3 → 4.
- **Track B — hygiene signals (tasks 5–8):** new `src/core/hygiene-signals.ts` and edits to `src/tools/review-task.ts` plus its test file. Land in order 5 → 6 → 7 → 8.
- Tracks A and B are independent and can land in parallel PRs. Task 9 is the joint verification gate and must run after both tracks merge.

- [x] 1. Extract phase attack-angle table into a shared constant in src/tools/adversarial-review.ts
  - File: src/tools/adversarial-review.ts
  - Create `PHASE_ATTACK_ANGLES: Record<string, { persona: string; attackSurface: string; exampleAngles: string }>` at module scope, populated with entries for `requirements`, `design`, `tasks`, `decomposition`, `product`, `tech`, `structure`. Source the `attackSurface` and `exampleAngles` values from the current methodology table at lines 272–277. Pick concise persona strings matching each phase (e.g. "senior technical product manager" for requirements, "staff engineer" for design).
  - Update `getAdversarialReviewMethodology()` to interpolate rows from this constant instead of hard-coding the markdown table, so the table content stays in one place.
  - Purpose: single source of truth for phase-specific review guidance, consumed by both the methodology text and the scaffold builder (task 2).
  - _Leverage: existing methodology text in src/tools/adversarial-review.ts:237-366_
  - _Requirements: 1.5_
  - _Prompt: Role: TypeScript Developer with expertise in refactoring | Task: Extract the inline phase attack-angle table at src/tools/adversarial-review.ts:272-277 into a typed constant PHASE_ATTACK_ANGLES and refactor getAdversarialReviewMethodology to interpolate from it, covering requirement 1.5 | Restrictions: Do not change the methodology *content* — same set of rows in the same order with the same per-cell text. Whitespace inside markdown table cells (cell padding, trailing spaces, pipe alignment) MAY differ. Do not add new dependencies | Success: Constant defined once and consumed by the methodology renderer; the structural test in Task 4 confirms each PHASE_ATTACK_ANGLES entry's attackSurface and exampleAngles strings appear verbatim in getAdversarialReviewMethodology() output; constant is exported or module-visible so buildScaffoldedPrompt (task 2) can consume it_

- [x] 2. Add buildScaffoldedPrompt pure function in src/tools/adversarial-review.ts
  - File: src/tools/adversarial-review.ts
  - Add `function buildScaffoldedPrompt(args: { specName, phase, version, targetFile, analysisOutputPath, memoryFilePath, latestAnalysisPath }): string` returning the scaffold text defined in design.md.
  - Always emit: H1 title, persona opening (from PHASE_ATTACK_ANGLES, fallback to a generic persona for unknown phases), `## Target document`, `## Analysis dimensions` with the `PLACEHOLDER:ANALYSIS_DIMENSIONS` HTML comment referencing the phase's attackSurface/exampleAngles, `## Closing deliverables`, and `## Output` with analysisOutputPath.
  - When `version > 1`, also emit a `## Prior review context` section with a `PLACEHOLDER:PRIOR_REVIEW_CONTEXT` HTML comment referencing memoryFilePath and latestAnalysisPath.
  - Unknown phase falls back to a generic persona/attack-surface pair and still returns a valid scaffold (all five base sections + placeholder block intact).
  - Purpose: produce the 90%-complete prompt the handler will write to disk.
  - _Leverage: PHASE_ATTACK_ANGLES from task 1_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Prompt: Role: TypeScript Developer with expertise in template generation | Task: Implement buildScaffoldedPrompt as a pure string-builder function satisfying requirements 1.1-1.5, consuming PHASE_ATTACK_ANGLES from task 1 | Restrictions: Pure function — no fs calls, no async, no side effects; use template literals not string concatenation; do not include escape-sequence tricks that would mangle the HTML comments on render | Success: Function returns a string containing the exact sections listed in design.md, PLACEHOLDER comments are valid HTML comments (open/close tokens intact), v2+ branch adds the prior-review section only when version > 1, unknown phases produce a valid generic scaffold with all five base sections present_

- [x] 3. Wire scaffold write into adversarialReviewHandler, tighten nextSteps, and update the tool description
  - File: src/tools/adversarial-review.ts
  - After path computation (current line ~131) and before the return, call `buildScaffoldedPrompt(...)` and `await fs.writeFile(promptOutputPath, scaffold, 'utf-8')`. Wrap the write in try/catch; on failure return `{ success: false, message: 'Failed to write scaffolded prompt: <err>' }`.
  - Update the `nextSteps` array in the success return to: (1) "Read the target document", (2) "Fill the PLACEHOLDER blocks in <promptOutputPath>", (3) `'Launch a fresh-context subagent with only: "Read and execute the instructions in ' + promptOutputPath + '"'`, (4) "The subagent will write its analysis to <analysisOutputPath>".
  - Update the tool `description` (top of file) to reflect the new flow: the prompt file is pre-scaffolded by the tool and the agent fills in placeholders. The new description string MUST contain the words "scaffold" and "placeholder" (pinned by Task 4(i)).
  - Purpose: complete the adversarial-review handler flow so the prompt file is produced by the tool.
  - _Leverage: existing path computation in adversarialReviewHandler, buildScaffoldedPrompt from task 2_
  - _Requirements: 1.1, 1.6, 1.7, 1.8_
  - _Prompt: Role: Backend Developer with expertise in MCP tool handlers | Task: Integrate buildScaffoldedPrompt into adversarialReviewHandler, revise nextSteps, and update the tool description to satisfy requirements 1.1, 1.6, 1.7, 1.8 | Restrictions: Do not change the existing response data shape (additive only — all existing fields remain); do not remove data.methodology | Success: Handler writes the scaffold file on success; write failure propagates as `success: false` with a descriptive message including the underlying error (R1.8 — promoted from Restrictions to Success and pinned by Task 4(e)); nextSteps reference placeholder-filling instead of prompt generation; adversarial-settings.json override still works (data.methodology populated from override; pinned by Task 4(f)); tool description mentions "scaffold" and "placeholder"_

- [x] 4. Add unit tests for the scaffolded prompt file
  - File: src/tools/__tests__/adversarial-review.test.ts (extend existing file)
  - Add tests that after `adversarialReviewHandler` succeeds the file at `promptOutputPath` is read from disk and asserted against:
    - (a) v1 (fresh spec): contains `PLACEHOLDER:ANALYSIS_DIMENSIONS`; does NOT contain `PLACEHOLDER:PRIOR_REVIEW_CONTEXT`; contains the exact `analysisOutputPath` string in the Output section.
    - (b) v2 (after a prior analysis file is seeded in the reviews dir): contains BOTH placeholder blocks; the prior-review block references `memoryFilePath` and `latestAnalysisPath`.
    - (c) decomposition phase: scaffold is written at the decomposition reviewsDir; contains the exact `attackSurface` AND `exampleAngles` strings from `PHASE_ATTACK_ANGLES['decomposition']` (deterministic substring match — not just the word "decomposition", which would pass trivially).
    - (d) Unknown phase (e.g. `phase: 'bogus'`): scaffold is still written; assert ALL five base sections are present (`# Adversarial Review` H1, persona paragraph, `## Target document`, `## Analysis dimensions` + `PLACEHOLDER:ANALYSIS_DIMENSIONS` block, `## Closing deliverables`, `## Output`); contains a generic persona string; handler returns `success: true`. A bug emitting only the H1 + persona must fail this test.
    - (e) Write failure: simulate by making `reviewsDir` read-only (or mock `fs.writeFile` to throw); handler returns `success: false` with an error message containing the underlying error text. Pins R1.8.
    - (f) Override + scaffold both present (closes R1.7 gap): write `.spec-workflow/adversarial-settings.json` with `{ reviewMethodology: 'Custom override text' }`, run the handler, assert (i) the scaffold file at `promptOutputPath` exists on disk, (ii) `data.methodology === 'Custom override text'`, (iii) the scaffold file content does NOT equal `data.methodology` (override replaces methodology only, scaffold remains structural).
    - (g) Override + unknown phase precedence: same setup as (f) but with `phase: 'bogus'`. Assert scaffold still uses the generic persona, `data.methodology` equals the override.
    - (h) Methodology structural integrity (covers Task 1's "no content drift" guarantee): for each entry in `PHASE_ATTACK_ANGLES`, assert that `getAdversarialReviewMethodology()` output contains the entry's `attackSurface` substring AND its `exampleAngles` substring. Pins the table-from-data refactor to the source data without locking in whitespace.
    - (i) Tool description: assert `adversarialReviewTool.description` contains both the substrings `"scaffold"` and `"placeholder"` (case-insensitive).
  - Purpose: lock in scaffold behavior so future methodology edits do not silently drift.
  - _Leverage: existing test patterns in src/tools/__tests__/adversarial-review.test.ts:60-218 (temp dirs via fs.mkdtemp, real fs, no module mocks required)_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8_
  - _Prompt: Role: QA Engineer with expertise in vitest and filesystem-based tests | Task: Add the test cases (a)-(i) above to adversarial-review.test.ts, covering requirements 1.1-1.5, 1.7, 1.8 | Restrictions: Do not rewrite existing tests; do not introduce module mocking for fs in tests that can use real fs (only test (e) may need fs.writeFile mocking); keep each test narrowly focused | Success: All new tests pass, existing tests still pass, scaffold-related assertions read the file from disk (not just the tool response) to verify actual persistence_

- [x] 5. Create hygiene signal utility in src/core/hygiene-signals.ts
  - File: src/core/hygiene-signals.ts (new)
  - Export type `HygieneSignal = { file: string; line: number; pattern: 'console' | 'todo' | 'fixme' | 'debugger'; text: string }`.
  - Export `async function computeHygieneSignals(files: string[]): Promise<HygieneSignal[]>` which reads each path concurrently, skips files that fail `stat` / `readFile` or exceed 1 MB, splits content on `\n`, and applies four regexes: `/console\.(log|warn|error|debug|info|trace)\s*\(/`, `/\bTODO\b/`, `/\bFIXME\b/`, `/\bdebugger\b/`. Each match produces one HygieneSignal with `line` 1-indexed and `text` trimmed + truncated to 120 chars. A line that matches multiple patterns produces multiple signals (one per pattern) on the same `(file, line)` — pinned by Task 6(g).
  - Purpose: deterministic grep utility consumed by review-task prepare.
  - _Leverage: fs/promises (already used throughout src/core)_
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - _Prompt: Role: TypeScript Developer with expertise in file I/O utilities | Task: Implement src/core/hygiene-signals.ts satisfying requirements 2.2-2.7 | Restrictions: Use only fs/promises — no regex library, no AST parser, no external dependencies; guard every file access in try/catch so one bad file does not sink the whole scan; do not mutate a shared array from multiple async branches without coordination (use Promise.all + flat() instead); truncate text to 120 chars after trim | Success: Utility returns the expected signal shape, handles missing/unreadable/oversize files silently, exports both the type and the function. Performance NFR (50 files × 500 lines under 200 ms) is asserted by the perf test in Task 6(h), not by this task's success criterion_

- [x] 6. Add unit tests for computeHygieneSignals
  - File: src/core/__tests__/hygiene-signals.test.ts (new)
  - Tests:
    - (a) single file with one `console.log` and one `TODO` returns two signals with correct line numbers and patterns.
    - (b) file with `debugger` returns a signal with `pattern: 'debugger'`.
    - (c) lowercase `todo` produces no signal (case sensitivity verified per R2.3).
    - (d) missing file path is skipped without throwing; the scan still returns signals from the remaining real files.
    - (e) oversize file: stub `fs.stat` to return `{ size: 1024 * 1024 + 1 }` for the target file; spy on `fs.readFile`; assert `readFile` is NOT called for that file AND the function returns the signals from the other (real, in-budget) files. Stubbing `stat` alone is insufficient — without the `readFile` spy, the size guard could be vacuously satisfied by the regex finding nothing in real content.
    - (f) multi-file case: signals are ordered within each file ascending by line number.
    - (g) double-match: a single line matching two patterns simultaneously (e.g. `// TODO: remove console.log(x)`) produces TWO signals on the same `(file, line)` with differing `pattern` values. Pins the "report both, no dedupe" decision.
    - (h) performance assertion (NFR): generate 50 temp files of 500 lines each (mostly noise, some matches), measure `computeHygieneSignals(files)` with `performance.now()`, assert wall time `< 200ms`. If this proves flaky in CI on slow runners, the budget may be widened to `< 500ms` with a comment, OR the NFR must be struck from `requirements.md` — the asymmetry of "promised but unenforced" is not acceptable.
  - Purpose: lock in hygiene grep behavior and the performance NFR.
  - _Leverage: existing vitest + real-fs temp-dir pattern from src/tools/__tests__/review-task.test.ts:1-49_
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7; NFR Performance (200 ms budget)_
  - _Prompt: Role: QA Engineer with expertise in vitest | Task: Write tests in src/core/__tests__/hygiene-signals.test.ts covering scenarios (a)-(h) | Restrictions: Use fs.mkdtemp for isolated temp dirs per test, clean up in afterEach; real fs only (no module mocks) except for test (e), which MUST use stat/readFile spies as specified | Success: All tests pass; each regex pattern has at least one positive and one negative test; skipped-file behavior is verified by asserting the overall scan still succeeds with the remaining files; perf test passes within the documented budget_

- [x] 7. Wire hygiene signals into review-task handlePrepare and update buildReviewMethodology (single change)
  - File: src/tools/review-task.ts
  - After `allFiles` is computed (current line 177), canonicalize entries to absolute paths via `path.resolve(projectPath, p)` BEFORE calling the utility (R2.2 promises absolute paths in signals; the implementation log may store relative paths). Then call `const hygieneSignals = await computeHygieneSignals(allFiles);`. Add `hygieneSignals` to the returned `data` object.
  - Add a new parameter `hasHygieneSignals: boolean` to `buildReviewMethodology` (signature becomes `taskContext, hasTechSteering, hasPriorReviews, hasHygieneSignals`). Pass `hygieneSignals.length > 0` from the handler.
  - In `buildReviewMethodology`, when `hasHygieneSignals` is true, replace the current item 9 text (line 414) with: "Pre-computed hygiene signals are attached in `hygieneSignals` (file, line, pattern). For each: confirm whether it is a genuine leftover vs. intentional (e.g., an error-path `console.error`). Promote real leftovers to findings with `category: 'hygiene'`. Also check for hygiene issues the grep cannot find: hardcoded secrets, commented-out code, unused imports or variables introduced by this task." When `hasHygieneSignals` is false, keep the current item 9 text byte-for-byte verbatim.
  - The parameter is added AND consumed in this single task — no intermediate state where `buildReviewMethodology` accepts a flag it ignores. (Previously this was split across two tasks; the merge avoids dead-parameter PRs.)
  - Purpose: surface pre-computed signals to the reviewing agent and steer triage rather than hunting.
  - _Leverage: computeHygieneSignals from task 5; existing handlePrepare flow in src/tools/review-task.ts:116-228; existing conditional section pattern in buildReviewMethodology (see hasTechSteering / hasPriorReviews branches at lines 403-407 and 416-426)_
  - _Requirements: 2.1, 2.2, 2.8, 2.9_
  - _Prompt: Role: Backend Developer with expertise in MCP tool handlers and prompt engineering | Task: Wire computeHygieneSignals into handlePrepare with absolute-path canonicalization, thread hasHygieneSignals into buildReviewMethodology, and update item 9 conditionally per requirements 2.1, 2.2, 2.8, 2.9 — all in one change | Restrictions: Do not change the signature of reviewTaskHandler; keep data shape additive; do not block on hygiene computation errors — the utility already swallows per-file failures; keep items 1-8 of the methodology unchanged; keep the "Classification" and "Recording Results" blocks unchanged; do not reorder section numbers | Success: data.hygieneSignals present in every successful prepare response; every signal's `file` field is an absolute path (R2.2, pinned by Task 8(d)); methodology contains the triage directive when signals are present and the original item 9 text byte-for-byte when absent; no existing tests broken_

- [x] 8. Add unit tests for review-task hygiene integration
  - File: src/tools/__tests__/review-task.test.ts (extend existing file)
  - Tests:
    - (a) prepare on a task whose modified file contains `console.log('debug')` and `// TODO: x` returns `data.hygieneSignals` with two entries with correct `line` numbers and `pattern` values.
    - (b) prepare on a clean task returns `data.hygieneSignals: []` AND the methodology string contains the original item 9 text. Capture the original item 9 text as a constant in the test (not a substring) to detect any drift in the fallback.
    - (c) when signals are present, methodology contains the triage directive (substring "Pre-computed hygiene signals are attached in").
    - (d) every entry in `data.hygieneSignals` has `path.isAbsolute(signal.file) === true`. Pins R2.2's absolute-path guarantee end-to-end.
  - Purpose: verify end-to-end integration of hygiene signals through the handler.
  - _Leverage: existing test patterns in src/tools/__tests__/review-task.test.ts:1-49_
  - _Requirements: 2.1, 2.2, 2.8, 2.9_
  - _Prompt: Role: QA Engineer with expertise in vitest and integration tests | Task: Add four test cases (a)-(d) to review-task.test.ts covering requirements 2.1, 2.2, 2.8, 2.9 | Restrictions: Use real fs temp dirs matching existing patterns; seed an implementation log via ImplementationLogManager so prepare can find filesModified; do not duplicate coverage already in hygiene-signals.test.ts — these tests verify the wiring and the absolute-path guarantee, not the regexes | Success: All four tests pass; existing review-task tests still pass; tests assert on data.hygieneSignals contents AND methodology string content AND path absoluteness_

- [x] 9. Build + full test pass + manual MCP verification
  - File: n/a (verification task)
  - Run `npm run build` — TypeScript compiles cleanly.
  - Run `npm test` — all tests pass (existing + new from tasks 4, 6, 8).
  - Manual (sandbox): create a throwaway spec at `.spec-workflow/specs/__manual-verify-fast-reviews__/` containing a minimal `requirements.md`. Invoke `mcp__spec-workflow__adversarial-review` against it (v1), inspect the written prompt file, then invoke again (v2) and inspect. Confirm placeholders read naturally and direct the agent to fill in document-specific content. Delete the sandbox spec directory after verification.
  - Manual (hygiene): invoke `mcp__spec-workflow__review-task action: prepare` on an existing task whose implementation contains a known `console.log`; confirm `hygieneSignals` lists it with the correct line number AND an absolute path.
  - Purpose: catch wiring regressions before merging.
  - _Leverage: package.json scripts_
  - _Requirements: All_
  - _Prompt: Role: Release Engineer with expertise in CI verification | Task: Execute build, full test run, and the two manual MCP invocations as listed, confirming all requirements end-to-end | Restrictions: Do not ship if typecheck fails; do not ship if any test fails; the manual scaffold-verification MUST run against a sandbox spec under `__manual-verify-fast-reviews__/` and clean up afterward — do NOT run it against `.spec-workflow/specs/fast-reviews/` itself, which would pollute that spec's own review version counter and conflate implementation artifacts with review artifacts | Success: Build green; tests green; manual sandbox runs produce v1 scaffold (one PLACEHOLDER block) and v2 scaffold (both PLACEHOLDER blocks); hygiene signal manual run shows the known leftover with an absolute file path; sandbox directory is deleted after verification_
