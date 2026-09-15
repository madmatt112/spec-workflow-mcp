# Codebase context — spec-lint

## Tool registry and context

- src/tools/index.ts:16-31 — `registerTools()` array of the twelve registered tools; a new tool is appended here
- src/tools/index.ts:33-92 — `handleToolCall` switch by tool name; unknown name throws `Unknown tool: <name>`
- src/types.ts:58-76 — `ToolContext`: `projectPath` (shared workflow root, holds `.spec-workflow`) and `workspacePath` (the checkout whose code is read), both translated paths
- src/types.ts:218-230 — `ToolResponse` envelope: `success`, `message`, `data?`, `nextSteps?`, `projectContext?`
- src/server.ts:219-224 — the one `ToolContext` construction site
- src/tools/root-selection.ts:36-40 — comment naming the four tools that use `selectRoots` (`review-task`, `log-implementation`, `adversarial-review`, `adversarial-response`)
- src/tools/root-selection.ts:51-56 — `SelectedRoots { workflowRoot, workspacePath }`
- src/tools/root-selection.ts:202-221 — `selectRoots(args, context)`: no override returns the context roots; an override becomes the workspace and derives the workflow root
- src/core/path-utils.ts:183-206 — `PathUtils.safeJoin` rejects `..` and absolute segments and escapes from the base
- src/core/path-utils.ts:208-214 — `getWorkflowRoot(projectPath)` = `projectPath/.spec-workflow`; `getSpecPath(projectPath, specName)` = `projectPath/.spec-workflow/specs/specName`

## Existing document checks the lint reuses

- src/core/mdx-validator.ts:3-14 — `MdxValidationIssue { line, column, ruleId: 'mdx-compile-error', message, severity: 'error' }` and `MdxValidationResult`
- src/core/mdx-validator.ts:26-45 — `validateMarkdownForMdx(content)` compiles with `@mdx-js/mdx` (installed 3.1.1) and returns the first compile error with its line and column
- src/core/mdx-validator.ts:47-49 — `formatMdxValidationIssues` renders `Line L:C [rule] message`
- src/core/__tests__/mdx-validator.test.ts:5-14 — a bare `<5%` fails compile with `Unexpected character`
- src/core/__tests__/mdx-validator.test.ts:16-32 — the same text inside inline code or a fenced block passes
- src/tools/approvals.ts:356-392 — `approvals request` reads the `.md` file and refuses the request on any MDX issue (the approval lint)
- src/tools/approvals.ts:394-421 — `approvals request` on `tasks.md` refuses on `validateTasksMarkdown` errors; warnings do not block
- src/core/task-validator.ts:6-24 — `ValidationError { line (1-based), taskId?, field, message, suggestion?, severity: 'error' | 'warning' }` and `ValidationResult`
- src/core/task-validator.ts:31-248 — `validateTasksMarkdown(content)`: checkbox shape errors (`:57-96`), missing numeric id error (`:101-115`), `_Prompt` closing-underscore detection (`:172-189`) reported as a `prompt` warning (`:205-215`), missing `Task | Restrictions | Success` sections as a `prompt_structure` warning (`:217-229`)
- src/core/task-validator.ts:255-281 — `formatValidationErrors` renders errors then warnings as indented lines

## Task parsing

- src/core/task-parser.ts:108-128 — `ParsedTask`: `id`, `lineNumber` (0-based), `requirements?`, `prompt?`, `isHeader`
- src/core/task-parser.ts:138-146 — `summary.unparsed`: open checkbox lines with no task number
- src/core/task-parser.ts:153-356 — `parseTasksFromMarkdown(content)`
- src/core/task-parser.ts:164-170 — checkbox line regex `^\s*[-*]\s+\[([ x\-])\]`
- src/core/task-parser.ts:173-175 — a task's block runs to the next checkbox line or EOF; a `## ` heading does not bound it
- src/core/task-parser.ts:204-216 — task id regex `^(\d+(?:\.\d+)*)\s*\\?\.?\s+(.+)`; an unnumbered open checkbox is counted as unparsed
- src/core/task-parser.ts:233-263 — `_Prompt:` capture: single line ending `_`, else continuation lines until a blank line, a bullet, `Files?:` or `Purpose:`
- src/core/task-parser.ts:264-271 — `_Requirements:` ids split on comma; the exact token `NFR` is dropped, `NFR Security` is kept
- src/core/gate-rules.ts:16-20 — `SENSITIVE_PATHS_HEADING = '## Sensitive paths'` machine-read from `agent-rules.md`
- src/core/gate-rules.ts:73-93 — `parseSensitivePaths(markdown)`: bullets under the heading to the next `## ` line, backticks stripped, non-bullets ignored, `null` when absent or empty
- src/core/gate-rules.ts:118-133 — `taskBlock(tasksMarkdown, lineNumber)`: bounded by the next checkbox line only
- src/core/gate-rules.ts:42-43 — `MAX_LINE_CHARS = 200`; `:164-168` `truncateLine` keeps the first line cut to 200 characters
- src/tools/review-gate.ts:176-188 — reads `agent-rules.md` at `PathUtils.getWorkflowRoot(workflowRoot)/agent-rules.md`; ENOENT is "no list", any other error is `success: false`
- src/tools/review-gate.ts:274-299 — gate response: `data`, `nextSteps`, `projectContext { projectPath, workflowRoot, specName, dashboardUrl }`

## Git helpers (diff in the round prompt)

- src/core/task-diff.ts:28-30 — `MAX_BUFFER`, `PER_FILE_LINE_CAP = 500`, `TOTAL_BYTE_CAP = 50_000`
- src/core/task-diff.ts:48-59 — file-private `runGit(projectPath, args)`: `execFile('git', …)` with `scrubbedGitEnv()` and `GIT_OPTIONAL_LOCKS: '0'`
- src/core/git-utils.ts:27-32 — `SCRUBBED_GIT_ENV_VARS` (`GIT_DIR`, `GIT_COMMON_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`)
- src/core/git-utils.ts:45-51 — `scrubbedGitEnv()` copies `process.env` without those four

## Adversarial review scaffold (the round prompt)

- src/tools/adversarial-review.ts:54-61 — handler takes `specName`, `phase`, optional `filePath`, `projectPath`, `verdictBlock`; roots from `selectRoots`
- src/tools/adversarial-review.ts:92-96 — spec document path `workflowRoot/specs/<spec>/<phase>.md`, reviews dir beside it
- src/tools/adversarial-review.ts:145-157 — `buildScaffoldedPrompt` result written to `promptOutputPath`
- src/tools/adversarial-review.ts:165-186 — response `data { targetFile, promptOutputPath, analysisOutputPath, version, phase, steeringDocs, priorPhaseDocs, methodology, memoryFilePath, latestAnalysisPath }`
- src/tools/adversarial-review.ts:316-340 — `HARNESS_VERDICT_SECTION`: standing directives ("Ground every claim in the real codebase. Read the files the document cites…") and the verdict block contract
- src/tools/adversarial-review.ts:342-424 — `buildScaffoldedPrompt`: target, prior-review memory section for v2+, analysis approach, closing deliverables, verdict section, output path

## Templates and caps

- src/markdown/templates/requirements-template.md:3 — cap line "3,500 words for the whole document"
- src/markdown/templates/requirements-template.md:15-23 — `### Requirement 1`, `#### Acceptance Criteria`, numbered `WHEN … THEN … SHALL …` items
- src/markdown/templates/design-template.md:3 — cap line "4,000 words for the whole document"
- src/markdown/templates/design-template.md:30-42 — `## Components and Interfaces` with `### Component 1`, `### Component 2` subsections
- src/markdown/templates/tasks-template.md:3 — task shape and "Cap: 150 words per task block, excluding its prompt line"
- .spec-workflow/templates/{requirements,design,tasks}-template.md — byte-identical to the server copies (probe: `diff -q`, 2026-09-14)

## Approved documents in this store (conventions the lint must match)

- .spec-workflow/specs/review-gate/requirements.md:13-17 — heading shape `### Requirement 1 — The \`gate\` action` then `#### Acceptance Criteria`
- .spec-workflow/specs/review-gate/requirements.md:19-26 — criteria begin `WHEN … THEN … SHALL` or `The … SHALL`; probe: 2 of 52 criteria lack `SHALL`; worktree-execution-context 2 of 97 (both a naive per-line grep and, for review-gate, the criterion scope of spec-lint requirements 4.1/4.2 — the two methods agree here); tighter-reviews is 2 of 37 under that same 4.1/4.2 scope (numbered items under `#### Acceptance Criteria`, continuation lines included), not the 18 of 49 a naive per-line grep over every numbered line gives — 12 of those 18 sit outside any `#### Acceptance Criteria` section
- .spec-workflow/specs/review-gate/design.md:36-128 — ten `### Component N — name (path)` headings under `## Components and Interfaces` (`:34`), before `## Data Models` (`:134`)
- .spec-workflow/specs/review-gate/tasks.md:3 — one-paragraph dependency order before the first task
- .spec-workflow/specs/review-gate/tasks.md:5-15 — a full task block: `- File:` lines, action lines, `- Purpose:`, `_Leverage: …_`, `_Requirements: 5.3, 5.4, 5.5, 5.6_`, `_Prompt: Task: … | Restrictions: … | Success: …_`
- .spec-workflow/specs/review-gate/tasks.md:34 — `_Requirements: 1.3, 4.1, 4.4, NFR Security_`
- .spec-workflow/specs/review-gate/tasks.md:50-51 — task 5 names task 6 and the word `bridge`
- .spec-workflow/specs/review-gate/tasks.md:60 — bare range citations `(\`:179-183\`)` after a path named earlier in the block
- probe `wc -w` 2026-09-14: review-gate requirements 3491, design 4000, tasks 3203
- probe `awk` 2026-09-14: task blocks bounded only by checkbox lines count task 10 at 714 words because the block runs to EOF past `## Decisions` and `## Revision History`; bounded by `## ` headings it is under 150
- probe `git log` 2026-09-14: review-gate documents on `main` have one squash commit (`b32dec2`); no per-version checkpoint commits survive a squash merge

## Document-phase skill and agents

- harness/skills/sdd-document-phase/SKILL.md:20-22 — orchestrator never holds the whole document in context
- harness/skills/sdd-document-phase/SKILL.md:23-26 — workers spawned by the Agent tool: `sdd-drafter`, `sdd-reviewer`, `sdd-reviser`, `sdd-adjudicator`, `sdd-checker`
- harness/skills/sdd-document-phase/SKILL.md:43-51 — ledger events via `EVENT_SCRIPT` (`spawn.start`, `spawn.end`, `round`, `note`, `phase.end`)
- harness/skills/sdd-document-phase/SKILL.md:79-98 — Step 1: drafter brief, spawn, spot-check, checkpoint commit `docs(sdd): <SPEC> <PHASE> v1`
- harness/skills/sdd-document-phase/SKILL.md:100-132 — Step 2: `adversarial-review` call, read then overwrite the prompt file with scaffold plus round section, spawn reviewer, route on verdict
- harness/skills/sdd-document-phase/SKILL.md:134-144 — Step 3: reviser brief, spawn, spot-check, checkpoint commit `docs(sdd): <SPEC> <PHASE> v<D+1> after round <A>`
- harness/skills/sdd-document-phase/SKILL.md:193-206 — Step 5: approval; on MDX or tasks-format failure a reviser brief with `RI-n` findings, commit `… v<D+1> lint fixes`, D = D + 1
- harness/skills/sdd-document-phase/SKILL.md:219-230 — Step R: revision input as `RI-n` findings
- harness/skills/sdd-document-phase/references/briefs.md:6-95 — drafter brief template
- harness/skills/sdd-document-phase/references/briefs.md:97-146 — round section appended to the scaffold (`## This round`)
- harness/skills/sdd-document-phase/references/briefs.md:148-206 — reviser brief template; `:178-180` the optional `## Revision input` block; `:190-195` the Revision History line rule
- harness/skills/sdd-document-phase/references/cleanup.md:17-22 — brief and prompt files deleted at phase end, by name
- harness/skills/sdd-document-phase/references/cleanup.md:62-85 — spec store commits and the diff spot-check go through a script file, never a compound shell line
- harness/agents/sdd-document-orchestrator.md:19-33 — `tools` list with three MCP name variants per spec-workflow tool
- harness/agents/sdd-document-orchestrator.md:44-47 — never paste file contents or diffs into messages
- harness/agents/sdd-reviser.md:1-17 — Sonnet 5, high effort, tools include `adversarial-response` under three MCP names
- harness/agents/sdd-reviewer.md:17-26 — standing rules: read cited files at both ends of every range
- harness/skills/sdd-continue/SKILL.md:30-31 — preflight proves the server answers with `spec-index generate`
- harness/skills/sdd-continue/SKILL.md:208 — runaway guard counts orchestrator spawns per phase, not worker spawns
- harness/skills/sdd-continue/references/formats.md:172-174 — `spawn.start`, `spawn.end`, `round` ledger keys; `:177` `note` with `text`

## Docs

- docs/TOOLS-REFERENCE.md:5 — says "11 tools"; `src/tools/index.ts:17-30` registers twelve
- docs/TOOLS-REFERENCE.md:18-33 — tool index table, one row per tool
- docs/TOOLS-REFERENCE.md:131-134 — approvals: `.md` files MDX-validated, `tasks.md` structurally validated
- docs/SDD-HARNESS.md:50-76 — document phase per version and the word caps paragraph
- docs/SDD-HARNESS.md:123-127 — budgets and the twelve-spawn line
- docs/SDD-HARNESS.md:155-165 — artifacts table; `reviews/*-brief-<phase>*.md` deleted at phase end
- docs/SDD-HARNESS.md:241-248 — the three machine-read lines of `agent-rules.md`
- .spec-workflow/agent-rules.md — `## Sensitive paths` section (machine-read); Checks section: `src/` changes run `npx tsc --noEmit` and `npx vitest run`; `harness/` changes run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets`, `claude plugin validate . --strict`; CI is node 20, local node v24.13.0

## Tests

- src/core/__tests__/, src/tools/__tests__/ — vitest suites beside the modules; `src/tools/__tests__/review-gate.e2e.test.ts:7-16` is the unmocked temp-dir pattern (one temp dir as both roots, real git)

## Design-phase additions (2026-09-14)

- src/tools/index.ts:82-89 — `handleToolCall` catch: any thrown error becomes `success: false`, `Tool execution failed: <message>`
- src/tools/get-task-review.ts:6-42 — smallest tool definition: `inputSchema` with `projectPath`, `specName`, `taskId`, `version`; `annotations { title, readOnlyHint: true }`
- src/tools/adversarial-review.ts:36-39 — `projectPath` property description (override text); `:48-51` `annotations { readOnlyHint: false }`; `:63-68` `specName`/`phase` string checks returning `success: false`
- src/core/gate-rules.ts:1-9 — module header: pure functions, no I/O, `core` never imports `tools`; `:36-37` checkbox regex copied from `task-parser.ts:167`
- src/core/task-validator.ts:41 — checkbox candidates `^\s*[-*]\s*\[`; `:51` `lineNum` is 1-based; `:58` well-formed checkbox `^\s*-\s+\[([ x\-])\]\s+(.+)`; `:102` task id regex `^(\d+(?:\.\d+)*)\s*\.?\s+(.+)`; `:177-189` closing-underscore search over the block
- src/core/task-parser.ts:167 — checkbox regex; `:204` id regex with escaped-period support; `:235` single-line prompt `_Prompt:\s*(.+)_$`; `:245-259` continuation loop (a blank line, `^[-*]\s`, `^Files?:`, `^Purpose:` stop it)
- src/tools/review-gate.ts:288-299 — the response shape `success`, `message`, `data`, `nextSteps`, `projectContext`
- src/tools/__tests__/review-gate.test.ts:1-26 — handler-test pattern: `vi.hoisted` override, `vi.mock` of `../../core/typecheck.js`, real temp git repo
- src/core/__tests__/task-validator.test.ts:1-2 — test import convention `from '../task-validator.js'`
- vitest.config.ts — `include: ['src/**/*.{test,spec}.{js,ts}']`, `environment: 'node'`, `globals: true`
- scripts/sync-plugin-assets.cjs:1-13 — copies `harness/agents`, `harness/skills`, `harness/commands` into every `plugins/*` root; `--check` exits 1 on drift
- harness/skills/sdd-document-phase/SKILL.md:98-100 — end of Step 1 (`D = 1. Go to Step 2.`) and the `## Step 2` heading; `:106-108` read then overwrite the prompt file; `:159-176` Step 4a; `:193-206` Step 5; `:227` Step R item 2 (`Spawn sdd-reviser. Spot-check. Checkpoint commit.`)
- harness/skills/sdd-document-phase/references/briefs.md:107 — `- Version under review: v<D>.`; `:151` reviser brief title; `:156` Job line; `:169` Findings bullet; `:170-173` Memory bullet; `:174-176` `adversarial-response` bullet
- harness/skills/sdd-document-phase/references/cleanup.md:19-20 — the brief deletion line (`drafter-brief`, `reviser-brief-<PHASE>-v*`, `adjudication-brief`); `:64-65` scripts written once per run with the Write tool; `:82-84` run line and the diff spot-check script
- harness/agents/sdd-reviewer.md:20 — "Attack the changes since the previous version first, then the fresh lens the prompt names."
- harness/agents/sdd-document-orchestrator.md:45 — never pass `projectPath`; `:46` never paste file contents, diffs or test output
- docs/TOOLS-REFERENCE.md:458-473 — `## get-task-review` section shape (Purpose, Parameters, Returns); `:475` `## MCP Prompts` heading
- docs/SDD-HARNESS.md:50-71 — the six document-phase steps; `:73-76` the caps paragraph; `:162` `reviews/*-brief-<phase>*.md` deleted at phase end

## Probes (design, 2026-09-14)

- `wc --version` GNU coreutils 9.4; `wc -w` in the UTF-8 locale counts NBSP (U+00A0) and em space (U+2003) as separators and zero-width space (U+200B) as not, matching JS `split(/\s+/)`; `LC_ALL=C wc -w` counts none of the three
- node v24.13.0: `require('node:buffer').isUtf8` exists; `isUtf8(Buffer.from([0xff]))` is `false`
- `@mdx-js/mdx` installed 3.1.1
- git 2.43.0: `/usr/bin/git log -1 --format=%H -E --grep='^docs\(sdd\): spec-lint requirements v4( |$)' -- .spec-workflow/specs/spec-lint/requirements.md` returns `69ff43f` whose message carries a `Signed-off-by` trailer; `v3( |$)` returns `f556eee`; `v9( |$)` returns nothing with exit 0
- `.spec-workflow/steering/` is empty (no README, no tech/structure/design-system)

## Tasks-phase additions (2026-09-14)

- src/tools/index.ts:1-14 — one `import { xTool, xHandler } from './x.js'` per registered tool; a new tool's import goes here before `registerTools()`
- src/tools/__tests__/root-selection.test.ts:287-293 — comment and `describe` label "the four override sites (requirement 3.8)"; a label, not an asserted value
- src/__tests__/parity-baseline.test.ts:71-73 — imports `parseArguments` from `src/index.ts` and `reviewTaskHandler`, not the tool registry
- package.json scripts — `check:plugin-assets` = `node scripts/sync-plugin-assets.cjs --check`; `build` runs `sync:plugin-assets` before `tsc`; `test` = `vitest`
- plugins/spec-workflow-harness, plugins/spec-workflow-mcp, plugins/spec-workflow-mcp-with-dashboard — each holds `agents/`, `hooks/`, `skills/`; `harness/` holds the same three (no `commands/`)
- harness/skills/sdd-document-phase/references/cleanup.md:26-36 — retro-log phase summary shape (`## <ISO timestamp> · <PHASE> · phase · cleanup`, body, `Evidence:`, `Cost:`); timestamp from `date -u +%Y-%m-%dT%H:%M:%SZ`
- .spec-workflow/specs/spec-lint/retrospective-log.md:3-6 — a round entry: `## <ISO timestamp> · <PHASE> · round <A> · <category>`, one body line, `Evidence:`, `Cost:`
- .spec-workflow/specs/review-gate/tasks.md:111-127 — trailing sections after the last task, in order: `## Scope notes`, `## Decisions taken in this document`, `## Revision History`

## Probes (tasks, 2026-09-14)

- `grep -rn registerTools src --include='*.test.ts'` — no suite asserts the registered tool list or its length
- `grep -nE 'Tool,?$' src/tools/index.ts` — 12 lines, the `registerTools()` array members (`:18-30`); the count `docs/TOOLS-REFERENCE.md:5` states
- `npx tsx` over `validateTasksMarkdown`, `validateMarkdownForMdx`, `parseTasksFromMarkdown` on spec-lint tasks.md v1 — valid, 0 errors, 0 warnings, MDX valid, 12 tasks parsed, 0 unparsed
- `awk` per task block (checkbox line to the next checkbox or `## ` line, `_Prompt:` line excluded) on tasks.md v1 — largest block is task 7 at 128 words
