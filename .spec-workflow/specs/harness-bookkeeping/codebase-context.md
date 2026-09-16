# Codebase context — harness-bookkeeping

## The server tool surface
- src/tools/index.ts:17-33 — `registerTools` array; a new tool is added here.
- src/tools/index.ts:35-96 — `handleToolCall` switch that dispatches by tool name.
- src/tools/spec-lint.ts:31-65 — model for a read-only tool: `specName`/`phase`/optional `projectPath` schema, `readOnlyHint`, roots via `selectRoots`.
- src/tools/spec-index.ts:64-131 — `spec-index` handler with actions (`generate`/`defer`/`undefer`); the `generate` action model for rendering a file from spec state.
- src/types.ts:58-70 — `ToolContext`: `projectPath` (shared workflow root, holds `.spec-workflow`) and `workspacePath`, both translated.

## The tasks parser
- src/core/task-parser.ts:153-356 — `parseTasksFromMarkdown`: each task carries `id`, `status`, `lineNumber` (0-based), metadata and full `prompt`.
- src/core/task-parser.ts:314-339 — the per-task object and in-progress tracking; `lineNumber` is the checkbox line, block runs to the next checkbox index (task-parser.ts:173-176).
- src/core/task-parser.ts:342-355 — summary counts: `total`, `completed`, `inProgress`, `pending`, `unparsed`.

## spec-status and the Step 0 state source
- src/tools/spec-status.ts:37-114 — `spec-status` handler: `deriveSpecStatus`, per-document approval state, `taskProgress`.
- src/tools/spec-status.ts:69-79 — `deriveSpecStatus(spec)` plus `deriveDocumentApprovalStates` fill approved/`approvalStatus`/`approvalId`.
- src/tools/spec-status.ts:153-205 — completed-task log and review coverage.
- src/core/index-generator.ts:44-72 — `IndexGenerator.generate`: derive per-spec status, render, `fs.writeFile` INDEX.md.

## Approval snapshots
- src/core/approval-records.ts:19-28 — `DocumentApprovalState` (approved, approvalId, approvalStatus, approvedAt).
- src/core/approval-records.ts:42-77 — `readApprovalRecords`: read every record under `.spec-workflow/approvals/`, newest first.

## The watch ledger model
- src/watch/ledger.ts:14-32 — `LedgerEvent` (harness-events.jsonl) and `ActivityEvent` (harness-activity.jsonl) shapes.
- src/watch/ledger.ts:55-127 — `PhaseRow`, `SpawnNode`, `RunModel` shapes.
- src/watch/ledger.ts:144-161 — `parseHandoffPhaseRows`: reads existing `## Phase log` rows from HANDOFF.md.
- src/watch/ledger.ts:170-181 — `parseTasks`: task rows from tasks.md.
- src/watch/ledger.ts:188-338 — `buildModel`: merges ledger and activity; phases from HANDOFF rows then `phase.end` (208-212); spawn pairing from `spawn.start`/`spawn.end` (226-248); tokens from `spawn.end` (245) or a windowed `agent.stop` (265); `tokensTotal` sum (273).

## The watch renderer and entry
- src/watch/render.ts:62-178 — `render`: header, phase lines, live phase, ticker.
- src/watch/index.ts:26-71 — `readIfExists`, `handoffPath`, `resolveSpec`, `renderOnce` (reads harness-events.jsonl, harness-activity.jsonl, tasks.md, HANDOFF).
- src/watch/index.ts:73-143 — `runWatch`: chokidar watch of the four files, `--once` path.

## The plugin hooks (source of truth in harness/)
- harness/hooks/hooks.json:4-38 — PreToolUse (matcher `*`), SubagentStart, SubagentStop all run `sdd-activity.sh`.
- harness/hooks/sdd-activity.sh:11-29 — pointer file `${XDG_STATE_HOME}/sdd/active-run` maps cwd prefix to spec dir and run id.
- harness/hooks/sdd-activity.sh:44-67 — PreToolUse writes a `tool` event; SubagentStart `agent.start`; SubagentStop `agent.stop`, tokens only when `d.usage.tokens` is present (never today, docs/step-0-answers.md answer 2).

## SDD skills — Step 0, briefs, events
- harness/skills/sdd-document-phase/SKILL.md:44-51 — orchestrator writes `phase.*`, `spawn.start`/`spawn.end` (with tokens), `round`, `note` via `EVENT_SCRIPT`.
- harness/skills/sdd-document-phase/SKILL.md:53-77 — document Step 0: D, P, A, the verdict decision table, `phase.start`.
- harness/skills/sdd-document-phase/references/briefs.md:6-59 — drafter brief template with `<…>` placeholders.
- harness/skills/sdd-implementation-phase/SKILL.md:47-59 — implementation event contract; budget wording.
- harness/skills/sdd-implementation-phase/SKILL.md:61-88 — implementation Step 0 and per-task pick; the brief carries the task's full text.
- harness/skills/sdd-closeout-phase/SKILL.md:16-17 — `BUDGET` `all items`; one spawn per class.
- harness/skills/sdd-closeout-phase/SKILL.md:39-85 — close-out event contract and Step 0 items/classes.
- harness/skills/sdd-continue/SKILL.md:139-143 — supervisor writes a missing phase-log row before dispatch.
- harness/skills/sdd-continue/SKILL.md:180-199 — supervisor writes `spawn.start`/`spawn.end` per orchestrator and one HANDOFF row per `PHASE:` result.

## Formats reference
- harness/skills/sdd-continue/references/formats.md:52-67 — HANDOFF phase row and `## Phase log` table header.
- harness/skills/sdd-continue/references/formats.md:154-199 — run-ledger event script, event types, `spawn.end` tokens are the only per-spawn token source, supervisor writes orchestrator spawns.

## Roots, paths and derivation (design additions)
- src/tools/root-selection.ts:202-221 — `selectRoots`: no override ⇒ context roots; override ⇒ workspace, workflow root derived.
- src/core/path-utils.ts:183-206 — `safeJoin`: traversal-guarded join.
- src/core/path-utils.ts:208-214 — `getWorkflowRoot`/`getSpecPath` build `.spec-workflow` and spec-dir paths.
- src/tools/spec-lint.ts:79-90 — read pattern: `selectRoots`, `getSpecPath`, `safeJoin`, read error ⇒ `success:false` naming the path.
- src/core/spec-status-deriver.ts:17-37 — `deriveSpecStatus`: currentPhase/overallStatus from phase existence and task counts.
- src/core/approval-records.ts:98-121 — `deriveDocumentApprovalStates`: newest record per document, approved flag.

## Task-block bounds and phase-log serialize (design additions)
- src/core/task-parser.ts:164-176 — `checkboxIndices`; a task block is `lines[lineNumber .. next checkbox index]`.
- src/core/index-generator.ts:159-211 — `render`: deterministic re-serialize of a generated block, model for the phase-log block rewrite.

## Hook spawn seams (design additions)
- harness/hooks/sdd-activity.sh:45-58 — PreToolUse reads `tool_input` (`subagent_type`, `prompt`, `file_path`) for the summary; the spawn.start reads the same fields.

## Docs and tests (tasks additions)
- docs/TOOLS-REFERENCE.md:5 — the "13 tools" count word, updated when `harness` registers.
- docs/TOOLS-REFERENCE.md:20-39 — the tool index table and origin note; a `harness` row is added.
- src/tools/index.ts:1-15 — tool imports; a `harness` import is added beside them.
- src/core/__tests__/task-parser-progress.test.ts:4-24 — `parseTaskProgress` tests only; the `taskBlock` test is added here.
- src/watch/__tests__/ledger.test.ts:33-176 — `buildModel` fixtures and assertions over the old `spawn.start`/`spawn.end` token path.
- src/watch/__tests__/render.test.ts:28-123 — `render` fixtures over the old spawn path (role/tokens on `spawn.start`).
