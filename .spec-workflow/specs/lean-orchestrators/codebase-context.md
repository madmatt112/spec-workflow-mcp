# Codebase context — lean-orchestrators

## Usage fold (`harness usage`)
- src/watch/usage.ts:13-35 — `UsageCell`, `UsageKinds`, `UsagePhase`, `UsageReport`, `UsageDelta` shapes; no W field, no source field
- src/watch/usage.ts:126-231 — `buildUsageReport`: pairs `spawn.start`/`spawn.end`/`spawn.usage` rows per agent, aggregates per phase and agent
- src/watch/usage.ts:207-213 — `orchestratorShare`: raw token share of agents whose name ends `-orchestrator`
- src/watch/usage.ts:252-299 — `reduceSpawn`: tokens, kinds and cache numbers from the latest digit `spawn.end` row
- src/watch/usage.ts:302-314 — `usageDelta`: per-phase spawns and tokens, second report minus first
- src/watch/usage.ts:321-324 — `isGraphCall`: graphify read calls from activity rows
- src/watch/usage.ts:333-359 — `applyGraphCounts`: folds activity rows onto the report
- src/watch/usage.ts:403-457 — `formatUsageTable`, `formatOne`, `formatCompare`: the printed tables
- src/tools/harness.ts:36-43 — tool description: `usage` folds `harness-events.jsonl`; "reads only the spec store; it never spawns a process"
- src/tools/harness.ts:1139-1174 — `readSpecLedger`: reads `<spec dir>/harness-events.jsonl`
- src/tools/harness.ts:1183-1207 — `readSpecActivity`: reads `<spec dir>/harness-activity.jsonl`
- src/tools/harness.ts:1215-1244 — `usageAction`: one report, or two with `compareSpecName`

## Ledger and activity row shapes
- src/watch/ledger.ts:18-24 — `LedgerEvent`: `ts`, `type`, `run`, `spec`, string-valued extra keys
- src/watch/ledger.ts:26-36 — `ActivityEvent`: carries `session` and `agentId` (the keys that locate a subagent transcript)

## Activity hook (spawn rows, transcripts)
- harness/hooks/sdd-activity.sh:68-98 — `readUsage`: one usage per `message.id`, sums input, output, cache write, cache read; `cacheFields` adds `cacheWrite5m`, `cacheWrite1h`, `gapRewrites`
- harness/hooks/sdd-activity.sh:102-115 — `readReport`: last assistant text of a worker transcript
- harness/hooks/sdd-activity.sh:135-142 — `subagentTranscript`: `agent_transcript_path`, else `<parent dir>/<session_id>/subagents/agent-<agent_id>.jsonl`
- harness/hooks/sdd-activity.sh:146-152 — activity row base: `ts`, `run`, `session`, `agentId`, `agent`
- harness/hooks/sdd-activity.sh:176-200 — SubagentStop: usage read, `spawn.report` skipped for orchestrators (184), re-fire marker per agentId
- harness/hooks/sdd-activity.sh:220-236 — `spawn.end` row (usage keys, cache keys, `agentId`) and worker `spawn.report` row

## Orchestrator agents
- harness/agents/sdd-document-orchestrator.md:1-41 — frontmatter: `claude-opus-4-8`, `effort: high`, `cacheTtl: 1h`, preloaded skill `sdd-document-phase`, tool list
- harness/agents/sdd-document-orchestrator.md:43-55 — body: follow the skill, foreground workers, no pasted contents, 150-word report
- harness/agents/sdd-implementation-orchestrator.md:1-44 — frontmatter: same model, effort, cache; preloaded skill `sdd-implementation-phase`
- harness/agents/sdd-implementation-orchestrator.md:46-58 — body rules
- harness/agent-profiles.json:20-25 — document orchestrator profile
- harness/agent-profiles.json:32-37 — implementation orchestrator profile

## Document-phase skill
- harness/skills/sdd-document-phase/SKILL.md:14-17 — read `references/briefs.md` and `references/cleanup.md` once at the start
- harness/skills/sdd-document-phase/SKILL.md:19-23 — hold at most one version; read verdict blocks and structure only
- harness/skills/sdd-document-phase/SKILL.md:61-69 — ledger calls: `phase.start`, one `spawn.usage` per worker, `round`, `note`, `phase.end`
- harness/skills/sdd-document-phase/SKILL.md:71-84 — Step 0 orient
- harness/skills/sdd-document-phase/SKILL.md:169-208 — Step 2 review round (adversarial-review call, prompt overwrite, verdict tail, ledger, retro entry, route)
- harness/skills/sdd-document-phase/SKILL.md:318-337 — Step 5 approve: `approvals` list, request, approve
- harness/skills/sdd-document-phase/SKILL.md:428-434 — Budget: `PHASE: resume` after `BUDGET` review rounds
- harness/skills/sdd-document-phase/references/briefs.md — 30,608 bytes (wc -c, 2026-10-02)
- harness/skills/sdd-document-phase/references/cleanup.md — 8,072 bytes (wc -c, 2026-10-02)

## Implementation-phase skill
- harness/skills/sdd-implementation-phase/SKILL.md:6-13 — the orchestrator's own reads: `tasks.md`, decomposition entry, `agent-rules.md`, HANDOFF, retro log, worker reports
- harness/skills/sdd-implementation-phase/SKILL.md:22 — read `references/briefs.md` once at the start
- harness/skills/sdd-implementation-phase/SKILL.md:59-77 — ledger calls per task: `task.pick`, `spawn.usage`, gate `note`, `judge`, `task.done`
- harness/skills/sdd-implementation-phase/SKILL.md:79-98 — Step 0 orient
- harness/skills/sdd-implementation-phase/SKILL.md:104-107 — Pick: mark `[-]` in `tasks.md`, capture HEAD
- harness/skills/sdd-implementation-phase/SKILL.md:252-267 — Complete (mark `[x]`, retro entry, HANDOFF State row, commit) and Budget (`PHASE: resume`)
- harness/skills/sdd-implementation-phase/references/briefs.md — 13,420 bytes (wc -c, 2026-10-02)

## Supervisor dispatch
- harness/skills/sdd-continue/SKILL.md:100-126 — setup file: `harness-run.json` gives `ORCH_MODELS`, `WORKER_MODELS`
- harness/skills/sdd-continue/SKILL.md:254-260 — orchestrator spawn; `model` passed only when `ORCH_MODELS` names the agent
- harness/skills/sdd-continue/SKILL.md:291 — launch line `BUDGET: <4 review rounds | 20 tasks | all items | n/a>`
- harness/skills/sdd-continue/SKILL.md:350-351 — `resume`: phase-log, then a fresh orchestrator with the same prompt
- harness/skills/sdd-continue/SKILL.md:379-380 — runaway guard: more than 12 orchestrator spawns for one phase is an error
- src/dashboard/harness/run-setup.ts:21 — `MODEL_ALIASES`: `opus`, `sonnet`, `fable`

## Baseline data
- .spec-workflow/specs/tdd-task-loop/harness-events.jsonl — 51 orchestrator `spawn.end` rows, each with `cacheWrite5m`/`cacheWrite1h` (probe 2026-10-02)
- /home/mcf/repo/tradr-hosted/.spec-workflow/specs/trading-rules/harness-events.jsonl — 36 orchestrator `spawn.end` rows, same keys (probe 2026-10-02)
- /tmp/scratchpad/sdd/lean-orchestrators/source-probe.js — drafter probe: char-apportioned W per source for one orchestrator transcript
