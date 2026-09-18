# Adversarial Review — worktree-review-signals/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-design.md using this format:

```markdown
# Adversarial Review Memory — design
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed below passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open after the v2 lint pass: no errors remain (the eight `citation-path` errors the v2 delta introduced were fixed by prefixing bare filenames with their real `src/` paths on lines 106 and 175). The reviser rejected 30 `citation-identifier` warnings — most are prose words the linter mistakes for code identifiers (`observed`, `dependencies`, `undefined`, `dashboardUrl`, `diffStats`, `toEqual`, `HEAD`, `fetch`, `mismatch`, `record`), forward-looking names this design introduces, or citations that support spec 1's migration-position ruling rather than identifier presence; the reviser verified each already carries its correct citation elsewhere in the same passage. Judge each on meaning, not on the linter's identifier match. 67 `citation-bare` info findings (a bare `:NNN` range with no `path:` prefix earlier in its bullet) are traceability nits; treat as notes.
- Changes: the diff from the newest `docs(sdd): worktree-review-signals design v1` commit to the working tree follows as `## Changes since <short sha>` (cut at 500 lines), and the v2 lint commit as `## Lint commit <short sha>`.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the v2 delta wrote (the round-1 response to R1-1 or R1-2 — the recursive undefined-key deletion in the response-encoding component, the architecture summary line 22, the encoding-decision rationale line 262, the round-trip test bullet line 248, or the inline `PrepareData` shapes at lines 96-97/105-107) `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam round 1 already raised is marked `Compounds: R1-<n>`.
- Fresh lens for this round: failure, rollback and partial-failure paths. Round 1 used wire-contract shapes across a boundary; this round attack what happens when a step fails partway — a git spawn that errors or times out, a typecheck that is killed mid-run, a registry-lock acquisition that returns `acquired: false`, a `task-state.json` write that is interrupted between temp-write and rename, a malformed or version-mismatched state file, and every `unavailable` reason path. Check each failure yields the design's stated `observed`/degraded outcome and leaves no partial write, and that the error-handling section covers each path the components can take.
- Closed by ruling, do not re-open: D11 (R4 AC5 — `feature-disabled` emits no degraded note) and D3 (R1 AC11 — `diffBase.commit` is the ref `HEAD`, not a sha); both ruled refinements in round 1.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-design.md`. Read it first and rewrite it after your analysis, as the scaffold's Prior review context section says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since b7145df

````diff
diff --git a/.spec-workflow/specs/worktree-review-signals/design.md b/.spec-workflow/specs/worktree-review-signals/design.md
index 3d3f129..e097749 100644
--- a/.spec-workflow/specs/worktree-review-signals/design.md
+++ b/.spec-workflow/specs/worktree-review-signals/design.md
@@ -1,6 +1,6 @@
 # Design Document
 
-Document version: v1
+Document version: v2
 
 ## Overview
 
@@ -19,7 +19,7 @@ N/A: no visual surface.
 
 ## Architecture
 
-Two writers and one reader share the record: the dashboard status route writes a base keyed by workspace, `log-implementation` writes attribution, `handlePrepare` reads both and never writes. `handlePrepare` resolves the base (validated by ancestry), passes it to `computeTaskDiff`, folds the typecheck's `observed` text and the attribution comparison into `executionContext`, and returns it in `data`; the runner reads `data` through a typed interface, renders the same object, and moves the diff body to a file. The all-drop state becomes a fifth `DiffMethodologyState` kind with its own constants, so no pinned byte moves. The encoder change is a dependency bump proven by probe.
+Two writers and one reader share the record: the dashboard status route writes a base keyed by workspace, `log-implementation` writes attribution, `handlePrepare` reads both and never writes. `handlePrepare` resolves the base (validated by ancestry), passes it to `computeTaskDiff`, folds the typecheck's `observed` text and the attribution comparison into `executionContext`, and returns it in `data`; the runner reads `data` through a typed interface, renders the same object, and moves the diff body to a file. The all-drop state becomes a fifth `DiffMethodologyState` kind with its own constants, so no pinned byte moves. The encoder change is a dependency bump plus an `undefined`-key strip, both probed.
 
 ```mermaid
 graph LR
@@ -93,7 +93,9 @@ graph LR
   export type DiffMethodologyState = { kind: 'present' } | { kind: 'present-truncated' } | { kind: 'empty' } | { kind: 'no-files' } | { kind: 'rejected'; message: string };
   export function computeDiffMethodologyState(result: TaskDiffResult, noReviewableFiles = false): DiffMethodologyState;
   export interface PrepareData {
-    taskContext: TaskContext; implementationSummary: ImplementationSummary; steeringExcerpt: string | null;
+    taskContext: { description: string; requirements: string[]; leverage: string | null; prompt: string | null; promptStructured: PromptSection[] | null };
+    implementationSummary: { summary: string; filesModified: string[]; filesCreated: string[]; statistics: ImplementationLogEntry['statistics']; artifacts: ImplementationLogEntry['artifacts'] };
+    steeringExcerpt: string | null;
     filesToReview: ResolvedFile[]; fileResolution: FileResolutionCounts; hygieneSignals: HygieneSignal[];
     methodology: string; typecheckResults: TypecheckResult[];
     diff: string; diffStats: NonNullable<TaskDiffResult['stats']> | null; skippedPaths: string[]; diffTruncated: boolean;
@@ -101,6 +103,7 @@ graph LR
     executionContext: ExecutionContext;
   }
   ```
+  `taskContext`/`implementationSummary` mirror the literals at `:420-434` (`ParsedTask`, `src/core/task-parser.ts:108-128`; `ImplementationLogEntry`, `src/types.ts:162-212`); `PromptSection` is `src/types.ts:146-149`.
   Precedence in `computeDiffMethodologyState`: `rejection` first, then `noReviewableFiles`, then `diff === ''`, then truncation. `nextSteps` (`:512-520`) and `projectContext` (`:521-526`) are unchanged.
   `executionContext.notes`, built here and rendered verbatim by the runner:
   - `head-degraded`: "Name in your review summary that the recorded diff base `<sha>` was rejected and the diff was taken from HEAD."
@@ -169,7 +172,7 @@ graph LR
 
 ### Component 10 — response encoding (`src/types.ts:288-296`, `package.json:72`)
 - **Purpose:** A prepare response decodes with the library that encoded it.
-- **Interfaces:** `@toon-format/toon` moves from `^0.8.0` to `^4.1.1`; `toMCPResponse` is unchanged. Probe (`npx tsx`, node 24): under 0.8.0, `decode(encode({ m }))` for the real 4,783-character methodology (empty diff, `tsc-not-found`) throws `Expected 0 inline array items, but got 1` though every line alone round-trips; under 4.1.1 the same value and a prepare-shaped object round-trip; both versions encode `undefined` as `null` and produce byte-identical text for a small nested object; neither declares `engines`; both are ESM. Consequences: `data.diffStats` is `null` rather than `undefined` when absent, so the decoded value equals the response; `stripMethodology` (`e2e/worktree-shared.spec.ts:81-100`) is deleted and its call sites decode the full text.
+- **Interfaces:** `@toon-format/toon` moves from `^0.8.0` to `^4.1.1` (0.8.0 throws on the real methodology; 4.1.1 round-trips it). `toMCPResponse` (`:288-296`) also clones `response` and recursively deletes `undefined`-valued keys before encoding, closing `projectContext.dashboardUrl` (`src/types.ts:74`; `undefined` with no dashboard, `src/server.ts:205`/`:222`; copied `src/tools/review-task.ts:525`) and `diffStats`. This repository's Vitest `toEqual` equates a deleted key with `undefined`, so `decode(encode(response))` still deep-equals `response`. `stripMethodology` (`e2e/worktree-shared.spec.ts:81-100`) is deleted; call sites decode the full text.
 - **Dependencies:** none.
 - **Reuses:** `handleToolCall` (`src/tools/index.ts:37-91`), the single encoding site.
 
@@ -242,7 +245,7 @@ Node 20 fields asserted (`agent-rules.md`): `execFile`'s callback `error.code` (
 - **Unit, `src/core/__tests__/task-state-store.test.ts` (new):** missing, malformed and wrong-version files read as null; `recordBase` then `recordAttribution` keeps both; two `recordBase` calls for two workspaces under `Promise.all` are both present afterwards (Requirement 7 AC 6); a lock file held open with `'wx'` and `timeoutMs: 50` gives false and no write.
 - **Unit, `src/core/__tests__/task-diff.test.ts`:** every existing call passes `'HEAD'`; a case commits after a recorded base and asserts the committed hunk appears with `base` the recorded sha and not with `'HEAD'`; `:260-293` and `:295-330` are re-asserted as `rejection` naming `ENOENT`, `exit 128` and `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`; `readHeadCommit` on a repository and a plain directory; `isAncestorOfHead` for an ancestor, a commit on a second branch, and garbage.
 - **Unit, `src/core/__tests__/typecheck.test.ts`:** with the fake `tsc` (`:38-44`), a `package.json` naming one missing devDependency gives `dependencies-unresolved`, `observed` names it, and `expect(mockedExecFile).toHaveBeenCalledTimes(0)` (pattern at `:252`; Requirement 7 AC 2); a missing `optionalDependencies` entry passes; no `package.json` spawns; `no-tsconfig` `observed` on both workflow-root arms; every `unavailable` literal carries `observed`.
-- **Unit, `src/tools/__tests__/review-task.test.ts`** (overrides at `:7-38`): `executionContext` present; `head-expected` with no file; `recorded` with an entry for the reviewing workspace while a sibling's entry is ignored; `head-degraded` with a non-ancestor sha; `match`, `mismatch`, `unknown`; a malformed file gives `head-expected`, `unknown` and success; `notes` per state; a fixture-free all-drop case asserting the methodology contains neither the `:675` sentence nor the first sentence of `R4_2A` and contains both new constants; the seventeen fixtures unchanged; `decode(toMCPResponse(response).content[0].text)` `toEqual` the response, with a context carrying `dashboardUrl` (Requirement 6 AC 4).
+- **Unit, `src/tools/__tests__/review-task.test.ts`** (overrides at `:7-38`): `executionContext` present; `head-expected` with no file; `recorded` with an entry for the reviewing workspace while a sibling's entry is ignored; `head-degraded` with a non-ancestor sha; `match`, `mismatch`, `unknown`; a malformed file gives `head-expected`, `unknown` and success; `notes` per state; a fixture-free all-drop case asserting the methodology contains neither the `:675` sentence nor the first sentence of `R4_2A` and contains both new constants; the seventeen fixtures unchanged; `decode(toMCPResponse(response).content[0].text)` `toEqual` the response for a context with and without `dashboardUrl` (Requirement 6 AC 4).
 - **Unit, `src/tools/__tests__/adversarial-review.test.ts`:** the scaffold names both roots; the response round-trips.
 - **Unit, `src/dashboard/__tests__/task-review-runner.test.ts`** (`buildPrompt` bound as at `:159`; stand-in agent at `:396-415`): the execution-context section; the `mismatch` line and note; the containment message verbatim (Requirement 7 AC 5); the diff path in the prompt, the file present when the agent runs and absent after; no file for an empty diff; omitting `executionContext` from the `buildPrompt` call fails `npx tsc --noEmit`.
 - **Unit, `src/tools/__tests__/log-implementation.test.ts`:** attribution with `source: 'context'` and, with `args.projectPath`, `'override'`; a non-repository workspace gives `commit: null` and a written entry.
@@ -256,7 +259,7 @@ Node 20 fields asserted (`agent-rules.md`): `execFile`'s callback `error.code` (
 - D2 — `computeTaskDiff` takes `base` as a required third parameter: a defaulted `'HEAD'`; chosen because the requirement updates every caller and a default hides a caller that forgot.
 - D3 — For `head-expected` and `head-degraded`, `diffBase.commit` is the ref `HEAD`, not its sha: one `rev-parse HEAD` per prepare; chosen because the performance requirement grants one new git spawn per prepare and it is spent on the ancestry check.
 - D4 — Any non-zero exit of `merge-base --is-ancestor` is "not validated": distinguishing exit 1 from 128; chosen because both degrade identically and the sha is named either way.
-- D5 — Encoding: bump `@toon-format/toon` to 4.x and make the prepare payload free of `undefined`: a JSON fallback in `toMCPResponse`, carrying `methodology` in a file, an array-of-lines carrier; chosen because the probe shows 4.1.1 round-trips the failing value with byte-identical small-object output and no tool changes shape.
+- D5 — Encoding: bump `@toon-format/toon` to 4.x and recursively strip `undefined`-valued keys in `toMCPResponse`: per-field `?? null`, a JSON fallback, carrying `methodology` in a file, an array-of-lines carrier; chosen because 4.1.1 round-trips the failing value and a strip closes every optional field.
 - D6 — A repeated in-progress transition overwrites the workspace's base: keep-first; chosen because the route fires only on a real status change and the newer start is the task's current starting point.
 - D7 — The dependency probe checks `<workspace>/node_modules/<name>/package.json` only: node resolution walking parent directories; chosen because `resolveTscBinary` already binds the compiler to the workspace's own `node_modules`.
 - D8 — The probe runs after `resolveTscBinary` and before `spawnTsc`: before the binary lookup; chosen because a missing `node_modules` stays `tsc-not-found`, the behaviour spec 1 recorded.
@@ -286,3 +289,7 @@ Node 20 fields asserted (`agent-rules.md`): `execFile`'s callback `error.code` (
 
 - **v1** (2026-09-18) — Initial draft.
   - **Lint pass.** 16 fixed (L-1, L-2, L-4, L-9, L-10, L-12 to L-21, L-29 — corrected bare paths, widened citation ranges to cover the named identifier, or re-anchored a citation after a mid-bullet file change); rejected: L-3, L-25, L-26 (name a field or paragraph this design adds; it cannot appear in a current-state citation), L-5 to L-8, L-11, L-22 to L-24, L-27, L-28, L-30 (prose word, not a cited identifier), L-31 to L-35 (the citation supports the migration-position ruling, not a claim the identifiers appear in that file).
+- **v2** (2026-09-18) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/1).
+  - **R1-1 — Accepted (SHOULD_FIX).** The prepare response failed its own round trip whenever any optional field held undefined, not only the diff statistics: the dashboard URL is left undefined with no dashboard session and is copied straight into the response. Changed the response-encoding component so the encoding helper clones the response and recursively deletes every undefined-valued key before encoding, then probed that this repository's test-matcher equality treats a deleted key the same as one holding undefined, so the round trip still holds; updated the architecture summary (line 22), the encoding decision's rationale (line 262), and the round-trip test bullet (line 248) to name the same fix and cover a context with and without the dashboard URL, closing the finding at every sibling site.
+  - **R1-2 — Accepted (MINOR).** The exported prepare-data interface named two types that exist nowhere in the source tree. Replaced them with the inline shapes the current literals actually build, sourced from the real parsed-task and implementation-log-entry types, and added a line naming where those types live (lines 96-97, 105).
+  - **Lint pass.** 8 fixed (L-11, L-12, L-13, L-14, L-25, L-26, L-27, L-28 — the eight bare filenames `types.ts`, `server.ts`, `review-task.ts` prefixed with their real `src/` paths on lines 106 and 175); rejected: L-6 to L-10, L-15 to L-20, L-17, L-18 (each already carries its own correct citation elsewhere in the same passage — `taskContext`/`implementationSummary` at `:420-434`, `nextSteps` at `:512-520`, `projectContext` at `:521-526`, `R4_1_DIFF_PRESENT`/`R4_7_TYPECHECK_TIMEOUT` at `:771-781`/`:806-819`, all verified against source; `computeDiffMethodologyState`, `rejection`, `noReviewableFiles`, `notes` are this design's own new vocabulary, needing no code citation); L-1 to L-5, L-21 to L-24, L-29, L-30, L-31 to L-33 (prose or forward-looking words, not a claim the identifier appears verbatim at the cited range); L-34 to L-38 (the citation supports the migration-position ruling in spec 1's design, not identifier presence); 67 `citation-bare` info findings not enumerated (traceability nits, cap has no slack).
````

## Lint commit 1ca9450

````diff
diff --git a/.spec-workflow/specs/worktree-review-signals/design.md b/.spec-workflow/specs/worktree-review-signals/design.md
index 57fe9eb..e097749 100644
--- a/.spec-workflow/specs/worktree-review-signals/design.md
+++ b/.spec-workflow/specs/worktree-review-signals/design.md
@@ -103,7 +103,7 @@ graph LR
     executionContext: ExecutionContext;
   }
   ```
-  `taskContext`/`implementationSummary` mirror the literals at `:420-434` (`ParsedTask`, `src/core/task-parser.ts:108-128`; `ImplementationLogEntry`, `types.ts:162-212`); `PromptSection` is `types.ts:146-149`.
+  `taskContext`/`implementationSummary` mirror the literals at `:420-434` (`ParsedTask`, `src/core/task-parser.ts:108-128`; `ImplementationLogEntry`, `src/types.ts:162-212`); `PromptSection` is `src/types.ts:146-149`.
   Precedence in `computeDiffMethodologyState`: `rejection` first, then `noReviewableFiles`, then `diff === ''`, then truncation. `nextSteps` (`:512-520`) and `projectContext` (`:521-526`) are unchanged.
   `executionContext.notes`, built here and rendered verbatim by the runner:
   - `head-degraded`: "Name in your review summary that the recorded diff base `<sha>` was rejected and the diff was taken from HEAD."
@@ -172,7 +172,7 @@ graph LR
 
 ### Component 10 — response encoding (`src/types.ts:288-296`, `package.json:72`)
 - **Purpose:** A prepare response decodes with the library that encoded it.
-- **Interfaces:** `@toon-format/toon` moves from `^0.8.0` to `^4.1.1` (0.8.0 throws on the real methodology; 4.1.1 round-trips it). `toMCPResponse` (`:288-296`) also clones `response` and recursively deletes `undefined`-valued keys before encoding, closing `projectContext.dashboardUrl` (`types.ts:74`; `undefined` with no dashboard, `server.ts:205`/`:222`; copied `review-task.ts:525`) and `diffStats`. This repository's Vitest `toEqual` equates a deleted key with `undefined`, so `decode(encode(response))` still deep-equals `response`. `stripMethodology` (`e2e/worktree-shared.spec.ts:81-100`) is deleted; call sites decode the full text.
+- **Interfaces:** `@toon-format/toon` moves from `^0.8.0` to `^4.1.1` (0.8.0 throws on the real methodology; 4.1.1 round-trips it). `toMCPResponse` (`:288-296`) also clones `response` and recursively deletes `undefined`-valued keys before encoding, closing `projectContext.dashboardUrl` (`src/types.ts:74`; `undefined` with no dashboard, `src/server.ts:205`/`:222`; copied `src/tools/review-task.ts:525`) and `diffStats`. This repository's Vitest `toEqual` equates a deleted key with `undefined`, so `decode(encode(response))` still deep-equals `response`. `stripMethodology` (`e2e/worktree-shared.spec.ts:81-100`) is deleted; call sites decode the full text.
 - **Dependencies:** none.
 - **Reuses:** `handleToolCall` (`src/tools/index.ts:37-91`), the single encoding site.
 
@@ -292,3 +292,4 @@ Node 20 fields asserted (`agent-rules.md`): `execFile`'s callback `error.code` (
 - **v2** (2026-09-18) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/1/1).
   - **R1-1 — Accepted (SHOULD_FIX).** The prepare response failed its own round trip whenever any optional field held undefined, not only the diff statistics: the dashboard URL is left undefined with no dashboard session and is copied straight into the response. Changed the response-encoding component so the encoding helper clones the response and recursively deletes every undefined-valued key before encoding, then probed that this repository's test-matcher equality treats a deleted key the same as one holding undefined, so the round trip still holds; updated the architecture summary (line 22), the encoding decision's rationale (line 262), and the round-trip test bullet (line 248) to name the same fix and cover a context with and without the dashboard URL, closing the finding at every sibling site.
   - **R1-2 — Accepted (MINOR).** The exported prepare-data interface named two types that exist nowhere in the source tree. Replaced them with the inline shapes the current literals actually build, sourced from the real parsed-task and implementation-log-entry types, and added a line naming where those types live (lines 96-97, 105).
+  - **Lint pass.** 8 fixed (L-11, L-12, L-13, L-14, L-25, L-26, L-27, L-28 — the eight bare filenames `types.ts`, `server.ts`, `review-task.ts` prefixed with their real `src/` paths on lines 106 and 175); rejected: L-6 to L-10, L-15 to L-20, L-17, L-18 (each already carries its own correct citation elsewhere in the same passage — `taskContext`/`implementationSummary` at `:420-434`, `nextSteps` at `:512-520`, `projectContext` at `:521-526`, `R4_1_DIFF_PRESENT`/`R4_7_TYPECHECK_TIMEOUT` at `:771-781`/`:806-819`, all verified against source; `computeDiffMethodologyState`, `rejection`, `noReviewableFiles`, `notes` are this design's own new vocabulary, needing no code citation); L-1 to L-5, L-21 to L-24, L-29, L-30, L-31 to L-33 (prose or forward-looking words, not a claim the identifier appears verbatim at the cited range); L-34 to L-38 (the citation supports the migration-position ruling in spec 1's design, not identifier presence); 67 `citation-bare` info findings not enumerated (traceability nits, cap has no slack).
````
