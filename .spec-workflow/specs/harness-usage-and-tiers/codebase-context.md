# Codebase context — harness-usage-and-tiers

## Plugin hook (writes activity and spawn rows)
- harness/hooks/hooks.json:1-39 — PreToolUse (matcher `*`), SubagentStart and SubagentStop (27) all run `bash ${CLAUDE_PLUGIN_ROOT}/hooks/sdd-activity.sh` with `timeout` 5 (11, 22, 33)
- harness/hooks/sdd-activity.sh:11-27 — pointer file `${XDG_STATE_HOME:-~/.local/state}/sdd/active-run`, one `<checkout>\t<spec dir>\t<run id>` line per run, matched by the hook input's `cwd` prefix
- harness/hooks/sdd-activity.sh:28-31 — exports `SDD_ACTIVITY_FILE`, `SDD_EVENTS_FILE`, `SDD_SPEC`, `SDD_RUN_ID`
- harness/hooks/sdd-activity.sh:32-45 — inline node: parses stdin JSON, requires `agent_type` matching `(^|:)sdd-` (37), strips the plugin prefix (38), builds `{ts, run, session, agentId, agent}`
- harness/hooks/sdd-activity.sh:47-68 — activity kinds: `tool` (PreToolUse, summary rules 50-60), `agent.start`, `agent.stop` (63-65: `tokens` only when `d.usage.tokens` is a number, which no payload carries)
- harness/hooks/sdd-activity.sh:69 — appends the activity line
- harness/hooks/sdd-activity.sh:70-86 — ledger rows: `spawn.start` on PreToolUse when `tool_input.subagent_type` is `sdd-*` and `prompt` matches `/([^\s/]+)-brief[^\s/]*\.md/` (78-82, role = the stem before `-brief`, no `phase` key); `spawn.end` on SubagentStop only when the agent name does not end `-orchestrator` (83-85); no usage keys on either
- harness/hooks/sdd-activity.sh:88 — `exit 0` always
- scripts/dev-link.sh:21 — registers the hook by absolute path on this machine
- src/__tests__/hook-spawn-events.test.ts:13 — path to the real hook script; 21-30 fixture (temp checkout, spec dir, pointer file); 36-41 `runHook(payload)` pipes JSON with `cwd` through `execFileSync('bash')`
- src/__tests__/hook-spawn-events.test.ts:92-108 — `spawn.end` for a non-orchestrator on SubagentStop; 110-116 asserts no `spawn.end` for an orchestrator; 118-140 negative `spawn.start` cases

## Ledger model and watch view (`--watch`)
- src/watch/ledger.ts:14-20 — `LedgerEvent`: `ts`, `type`, optional `run`, `spec`, every other key `string | undefined`
- src/watch/ledger.ts:22-32 — `ActivityEvent` (`tokens?: number`)
- src/watch/ledger.ts:34-53 — `AgentProfile {model, effort, role}` and the hand-kept `AGENT_PROFILES`: 11 entries, short ids without the `claude-` prefix; orchestrators and `sdd-retro-analyst` as `fable-5-1 xhigh`, `sdd-reviser` as `opus-4-8 xhigh`, `sdd-checker` absent
- src/watch/ledger.ts:63-78 — `SpawnNode` (`tokens?: number`; `level` 1 when the name ends `-orchestrator`, else 2)
- src/watch/ledger.ts:106-127 — `RunModel` (`tokensTotal`, `hasActivity`)
- src/watch/ledger.ts:129-142 — `parseJsonl` skips unparseable lines
- src/watch/ledger.ts:188-204 — `buildModel` sorts by ts; run scope = the last `run.start` (200-202); activity rows without `run` are kept (203)
- src/watch/ledger.ts:226-248 — spawn pairing: `spawn.start` opens a node (level by name, 238); `spawn.end` closes the first open same-agent node (241), takes `result` and numeric `tokens` (245)
- src/watch/ledger.ts:250-291 — `spawn.usage` fold onto the nearest earlier unclaimed same-agent node; overrides `role`, `result`, numeric `tokens`, `phase`, `task`, `round` (266-274); synthesizes a level-2 node when unmatched (275-290)
- src/watch/ledger.ts:293-314 — activity join by agent and time window; `agent.stop` tokens fill only when `s.tokens` is undefined (308-309)
- src/watch/ledger.ts:316 — `tokensTotal` = sum of `s.tokens`
- src/watch/ledger.ts:343-352 — ticker text per event type (`spawn.usage` prints tokens, 345)
- src/watch/ledger.ts:384-388 — `formatTokens` (`6.3M`, `84k`)
- src/watch/render.ts:1 — imports `AGENT_PROFILES` (its only consumer)
- src/watch/render.ts:60 — `PHASE_ORDER`
- src/watch/render.ts:79 — header `tokens <total>` from `model.tokensTotal`
- src/watch/render.ts:180-211 — `agentLines`: profile lookup by agent name (182), tokens badge (197), head line with model column width 11 and effort width 7, `profile?.model ?? ''` when absent (203)
- src/watch/index.ts:41-59 — `resolveSpec` (`--spec`, HANDOFF header, newest ledger)
- src/watch/index.ts:61-71 — `renderOnce` reads `harness-events.jsonl`, `harness-activity.jsonl`, `tasks.md` and HANDOFF under `<workflowRoot>/specs/<spec>`
- src/watch/index.ts:73-89 — `runWatch`; `once` renders one frame and returns (86-89)
- src/index.ts:52,143,194 — `--once` help text, flag, `watchOnce`
- src/watch/__tests__/ledger.test.ts:1-54 — fixtures (`HANDOFF`, `TASKS`, `ledger()`, `activity()`); 169-183 `spawn.usage` fold; 185-207 synthesized node; 209-218 old ledger unchanged; 220-226 no ledger
- src/watch/__tests__/render.test.ts:1-41 — fixtures; 43-64 outline (53 and 56 assert `fable-5-1 xhigh` and `opus-4-8 xhigh` from the hand-kept table); 108-116 `spawn.usage` ticker line
- src/watch/__tests__/index.test.ts:36-69 — `runWatch` key loop and `--once`

## `harness` MCP tool
- src/tools/harness.ts:13-14 — imports `parseJsonl`, `parseHandoffPhaseRows`, `LedgerEvent`, `PhaseRow` from `../watch/ledger.js` and `handoffPath` from `../watch/index.js`
- src/tools/harness.ts:27-101 — tool definition: `action` enum `orient | brief | phase-log | gate` (46), parameters (49-92), `required: ['action', 'specName']` (94)
- src/tools/harness.ts:103-121 — `harnessHandler` dispatch
- src/tools/harness.ts:647-712 — `phaseLogAction`: `selectRoots` then `PathUtils.getSpecPath` (660-661), spec dir must exist (664-670), ledger via `PathUtils.safeJoin(specDir, 'harness-events.jsonl')` with ENOENT as empty (673-683), `parseJsonl` (697), returns `{success, message, data}` (708-712)
- src/tools/harness.ts:721 — `derivePhaseRows(events, existing)`
- src/tools/harness.ts:857-880 — `gateAction` header and op validation pattern
- src/tools/__tests__/harness.test.ts:12-29 — temp `<tempDir>/.spec-workflow/specs/<SPEC>/reviews`, `context = {projectPath, workspacePath}`; 246-330 phase-log cases (246, 269, 286, 301, 325); 340-376 gate put/get/delete (340, 351, 363, 370)
- docs/TOOLS-REFERENCE.md:547-570 — `harness` section: says "three actions", lists `orient`, `brief`, `phase-log`; `gate` absent

## Agent files and plugin sync
- harness/agents/sdd-document-orchestrator.md:4-5, sdd-implementation-orchestrator.md:4-5, sdd-closeout-orchestrator.md:4-5, sdd-retro-orchestrator.md:4-5, sdd-retro-analyst.md:4-5 — `model: claude-opus-4-8`, `effort: high` (commit 599bdca, 2026-09-18)
- harness/agents/sdd-drafter.md:4-5, sdd-adjudicator.md:4-5 — `claude-fable-5-1`, `xhigh`
- harness/agents/sdd-reviewer.md:4-5, sdd-implementer.md:4-5, sdd-verifier.md:4-5 — `claude-opus-4-8`, `xhigh`
- harness/agents/sdd-reviser.md:4-5, sdd-checker.md:4-5 — `claude-sonnet-5`, `high`
- harness/agents/*.md:1-3 — frontmatter `name`, `description` (one sentence starting `SDD <role>:`); twelve files
- scripts/sync-plugin-assets.cjs:17-20 — `SOURCE = harness/`, `PLUGINS_DIR = plugins/`, `ASSET_DIRS = ['agents', 'skills', 'commands', 'hooks']` (directories only)
- scripts/sync-plugin-assets.cjs:36-41 — plugin roots = `plugins/*/` holding `.claude-plugin/plugin.json` (three: spec-workflow-harness, spec-workflow-mcp, spec-workflow-mcp-with-dashboard)
- scripts/sync-plugin-assets.cjs:43-63 — `diffAssetDir` (missing / differs / stale); 65-72 `syncAssetDir` (rm then cp); 74-108 `main`, `--check` exits 1 on drift (102-105)
- package.json — scripts `sync:plugin-assets`, `check:plugin-assets`, `build` (runs `sync:plugin-assets`, `tsc`, `build:dashboard` which ends in `copy-static`), `test` = `vitest`; `files` = `dist/**/*`, `README.md`, `CHANGELOG.md`, `LICENSE`; `bin` = `dist/index.js`; version 5.9.0
- scripts/copy-static.cjs:45-61 — copies `src/markdown` to `dist/markdown` and `src/locales` to `dist/locales` at build
- tsconfig.json:8,13,19 — `rootDir: ./src`, `resolveJsonModule: true`, `include: src/**/*`
- src/core/workspace-initializer.ts:9 — `__dirname` from `import.meta.url` (the pattern for locating files shipped next to a module)
- .github/workflows/ci.yml:20,27,30,33,36,39 — node 20; `check:plugin-version`; `check:plugin-assets`; `tsc --noEmit`; `build`; `npm test -- --run`
- plugins/spec-workflow-harness/.claude-plugin/plugin.json — name `spec-workflow-harness`, version 5.9.0 (generated tree, never edited by hand)
- .spec-workflow/agent-rules.md — `harness/hooks/` is a sensitive path; a `harness/` change runs `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets`, `claude plugin validate . --strict`

## Skill passages that take tokens from the Agent result footer
- harness/skills/sdd-continue/SKILL.md:213-216 — supervisor writes `spawn.start` before and `spawn.end ... tokens=<n>` after each orchestrator, `<n>` from the footer
- harness/skills/sdd-continue/SKILL.md:218-226 — model pre-flight: reads `.message.model` from the session transcript's `isSidechain` lines; every orchestrator must be `claude-opus-4-8`
- harness/skills/sdd-continue/references/formats.md:186-198 — ledger event table; `spawn.end` row (193: the supervisor's orchestrator row carries `role`, `result`, `tokens`); `spawn.usage` row (194: `tokens` is "the only source of per-spawn tokens, since hook payloads carry no usage"); 200-201 the supervisor writes both boundary rows for orchestrators
- harness/skills/sdd-document-phase/SKILL.md:44-52 — Ledger bullet, `tokens=<n>` from the footer (46-48); 114-116 lint `spawn.usage` "result and tokens from its report"; 144 gate-a `spawn.usage` "from its report"
- harness/skills/sdd-implementation-phase/SKILL.md:50-64 — Ledger bullet (53-57); 271-272 CI-fix `spawn.usage`
- harness/skills/sdd-closeout-phase/SKILL.md:42-56 — Ledger bullet (46-49)
- harness/skills/sdd-retrospective/SKILL.md:33-39 — retro orchestrator writes `spawn.start` and `spawn.end` around the analyst with `tokens=<n>` from the footer (36-37); 79-87 the analyst is prompt-launched (no brief path, so the hook writes no `spawn.start` for it)

## Docs this spec touches
- docs/SDD-HARNESS.md:155-169 — artifacts table (169: ledger and activity files)
- docs/SDD-HARNESS.md:284-298 — model policy table lists the orchestrators and the analyst as Fable xhigh (stale since 599bdca)
- docs/SDD-HARNESS.md:300-328 — watching a run; 325-328 "token counts are the ones the orchestrators record on spawn.end from the Agent result (hook payloads carry no usage)"
- docs/harness-efficiency-plan.md:11-18 — rules (keep the ledger and `--watch`); 160-177 step 4, prompt at 164-167 (tokens and minutes by phase and agent, orchestrator share; watch for orchestrator share under 20% of a phase)
- .spec-workflow/spec-decomposition/decomposition.md:240-323 — this spec's entry and the facts settled on 2026-09-17 (`transcript_path` on SubagentStop, `message.usage` fields, `effort` not overridable by the Agent tool)

## Ledgers on this store (probed 2026-09-19 with node scripts over `.spec-workflow/specs/*/harness-events.jsonl`)
- event types across all specs: 263 `spawn.end`, 255 `spawn.start`, 70 `spawn.usage`, 121 `note`, 41 `phase.start`, 34 `phase.end`, 40 `round`, 9 `run.start`, 7 `run.end`
- `tokens` values across all specs: 27 x `"0"`, 12 x `"unknown"`, 7 x `"na"`, the rest decimal digit strings
- review-gate: 217 rows, one run; 59 `spawn.end` all numeric (9 orchestrator rows); no `spawn.usage`; `buildModel().tokensTotal` 6,324,447 equals the raw sum; `node dist/index.js --watch . --spec review-gate --once` prints `tokens 6.3M`
- spec-lint: 62 `spawn.end` all numeric; `sdd-closeout-orchestrator` `closeout phase, spawn 1` = 388,958
- question-gates: 188 rows; run ids `run-20260916-194812` and `run-20260916-225339` with one `run.start`; 45 `spawn.end` (1 with tokens: the analyst, 45,675, orchestrator-written); 36 `spawn.usage` (22 numeric, the rest `unknown`, `na` or `0`); no orchestrator row carries numeric tokens; `buildModel().tokensTotal` 1,185,572 against a raw numeric sum of 1,963,320 (6 rows, 732,073 tokens, of the second run id fall outside the last-run scope; the analyst has two `spawn.end` rows, the hook's at 01:10:28 without tokens and the orchestrator's at 01:10:49 with 45,675, and the pairing at ledger.ts:241 keeps only the first); `--once` prints `tokens 1.2M`
- harness-bookkeeping: 53 `spawn.end`, 23 with `tokens`, 2 numeric
- worktree-review-signals: 4 runs; 46 `spawn.end` (4 numeric, all orchestrator); 34 `spawn.usage` (5 numeric)
- .spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl — this run: `run.start`, the orchestrator's `spawn.start` from the supervisor (with `phase`), `phase.start`, the drafter's `spawn.start` from the hook (no `phase`)

## Subagent transcripts (probed 2026-09-19, node 24.13.0)
- `~/.claude/projects/-home-mcf-repo-spec-workflow-mcp/<session>/subagents/agent-<agentId>.jsonl` — `<agentId>` equals the hook payload's `agent_id` (activity row `agentId` a8a51b659b21c6e12 matches file agent-a8a51b659b21c6e12.jsonl)
- entry shape — top-level `type` (`user`, `assistant`, `attachment`), `agentId`, `isSidechain`, `effort`; `message.model`; `message.usage { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cache_creation {...}, service_tier, ... }`
- agent-a8a51b659b21c6e12 (this run's document orchestrator, `claude-opus-4-8`): 30 assistant entries, all with usage; input 60, output 8,497, cacheWrite 376,098, cacheRead 1,351,374, total 1,736,029
- largest local transcript agent-a469098afbeaef3e6.jsonl: 1,871,813 bytes, 586 lines, 240 assistant entries, `claude-sonnet-5`, total 42,460,997, parsed in 16.7 ms
