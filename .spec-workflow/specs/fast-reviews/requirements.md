# Requirements Document

## Introduction

Adversarial reviews and task reviews currently spend LLM tokens on deterministic work that a TypeScript handler could do in milliseconds. Two specific hotspots:

1. **Adversarial review**: the main agent reads the target doc + steering docs + priors, then drafts the entire prompt file from the methodology text. Most of the prompt is static scaffolding (persona, oppositional framing, phase-specific attack-angle table, closing deliverables, document-insertion block, v2+ prior-review-context wrapper). Only the 3–6 tailored attack dimensions and the v2 memory summary genuinely require LLM judgment.
2. **Task review prepare**: the methodology tells the LLM to hunt every modified file for `console.log`, `TODO`, `FIXME`, and `debugger` leftovers. A line-by-line regex scan finds these instantly.

This spec moves the deterministic parts into the tool handlers so both review flows finish faster without giving up quality — the LLM still owns every judgment call.

## Alignment with Product Vision

`spec-workflow-mcp` exists to make spec-driven development workflows faster and more reliable for agent-assisted teams. Review loops are a central part of that workflow (adversarial review before approval, task review before marking complete). Cutting latency and LLM overhead in the loops directly improves the tool's core value proposition.

## Requirements

### Requirement 1 — Adversarial review writes a scaffolded prompt file

**User Story:** As a user running `adversarial-review`, I want the tool to produce a mostly-complete prompt file with clearly-marked placeholders, so that the reviewing agent only fills in document-specific tailoring instead of regenerating the entire prompt structure.

#### Acceptance Criteria

1. WHEN `adversarialReviewHandler` succeeds THEN the file at `promptOutputPath` SHALL exist on disk and contain the structural sections defined in the methodology (persona/opening, analysis dimensions placeholder, closing deliverables, document-insertion block).
2. WHEN the written file is read THEN it SHALL contain exactly one `<!-- PLACEHOLDER:ANALYSIS_DIMENSIONS ... -->` block giving the LLM directions to produce 3–6 tailored numbered sections with the phase's attack-angle row inlined as reference.
3. IF `version > 1` THEN the written file SHALL additionally contain exactly one `<!-- PLACEHOLDER:PRIOR_REVIEW_CONTEXT ... -->` block referencing `memoryFilePath` and `latestAnalysisPath`.
4. IF `version === 1` THEN the written file SHALL NOT contain any `PLACEHOLDER:PRIOR_REVIEW_CONTEXT` block.
5. WHEN `phase` is one of `requirements`, `design`, `tasks`, `decomposition`, `product`, `tech`, `structure` THEN the scaffold SHALL render a persona opening and attack-angle reference appropriate to that phase.
6. WHEN the handler returns THEN `nextSteps` SHALL direct the agent to "fill the PLACEHOLDER blocks in {promptOutputPath}" rather than "generate a tailored adversarial prompt following the methodology".
7. WHEN an override methodology is configured via `.spec-workflow/adversarial-settings.json` THEN the scaffold SHALL still be written (the override affects the methodology string returned in `data.methodology`, not the scaffold).
8. WHEN the scaffold writes fail (e.g. disk error) THEN the handler SHALL return `success: false` with a descriptive message, without silently continuing.

### Requirement 2 — `review-task prepare` returns pre-computed hygiene signals

**User Story:** As a user running `review-task action: prepare`, I want deterministic hygiene patterns (debug leftovers, TODO/FIXME, debugger statements) already extracted from the modified files, so that the reviewing agent triages pre-found signals instead of hunting for them.

#### Acceptance Criteria

1. WHEN `handlePrepare` succeeds THEN the response `data` SHALL include a `hygieneSignals` array.
2. WHEN a modified or created file contains a line matching `console.(log|warn|error|debug|info|trace)\s*\(` THEN `hygieneSignals` SHALL contain one entry per match with fields `file` (absolute path), `line` (1-indexed), `pattern: 'console'`, and `text` (trimmed line content, truncated to 120 chars).
3. WHEN a line matches `\bTODO\b` (case-sensitive) THEN a signal with `pattern: 'todo'` SHALL be added, with the same field shape as Criterion 2.
4. WHEN a line matches `\bFIXME\b` THEN a signal with `pattern: 'fixme'` SHALL be added.
5. WHEN a line matches `\bdebugger\b` THEN a signal with `pattern: 'debugger'` SHALL be added.
6. IF a listed file does not exist on disk (deleted), is unreadable, or exceeds 1 MB THEN the utility SHALL skip that file silently and continue processing the remaining files.
7. WHEN no matches are found across all files THEN `hygieneSignals` SHALL be an empty array and the response SHALL still succeed.
8. WHEN `hygieneSignals` is non-empty THEN `buildReviewMethodology` SHALL emit a directive telling the LLM to triage each signal (intentional vs. leftover), promote real leftovers to findings with `category: 'hygiene'`, and still check for out-of-band hygiene issues the grep cannot find (hardcoded secrets, commented-out code, unused imports/vars).
9. WHEN `hygieneSignals` is empty THEN `buildReviewMethodology` SHALL emit the full hygiene directive (no pre-computation shortcut taken).

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility**: the scaffold builder is a pure function that takes known inputs and returns a string; the hygiene utility is a pure function that takes file paths and returns signals. Neither owns side effects beyond file reads.
- **One source of truth**: the phase-specific attack-angle rows live in a single constant consumed by both the methodology text and the scaffold. They are not duplicated.
- **No new dependencies**: implementation uses only `fs/promises` and the existing project utilities. No regex library, no AST parser, no spawning `tsc` or `eslint` in this pass.

### Performance

- Scaffold generation + file write completes in < 50 ms for a typical review target.
- Hygiene signal computation completes in < 200 ms for a task log with up to 50 files averaging 500 lines each. Per-file reads happen concurrently (e.g. `Promise.all`).

### Reliability

- Scaffold write failures surface as tool errors, never silent no-ops.
- Hygiene utility tolerates missing/unreadable/oversize files without failing the whole `prepare` action.

### Usability

- Placeholder blocks in the written prompt use inline HTML comments (`<!-- PLACEHOLDER:* -->`) so they are invisible when the prompt is rendered as markdown but grep-able when the agent is filling them in.
- The `nextSteps` in both tool responses read as a short, concrete checklist rather than prose.
