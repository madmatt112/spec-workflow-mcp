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

## Orient and task parser (design)
- src/tools/harness.ts:311-364 — `orientImplementation`: task counts, approvals, `nextStep`, `inFlightReports`; no task id or title
- src/core/task-parser.ts:8-11 — `TaskTest`: normalised test path and seam
- src/core/task-parser.ts:148-169 — `ParsedTask`: id, description, status, isHeader, files, tests
- src/core/task-parser.ts:420-439 — `taskBlock`: task line to the next checkbox line
- src/core/task-parser.ts:446-485 — `updateTaskStatus`: checkbox regex and in-place marker rewrite
- src/core/task-parser.ts:490-492 — `findNextPendingTask`: first pending non-header task

## Brief action (design)
- src/tools/harness.ts:493-557 — `BRIEF_TEMPLATES`: six string templates (drafter, reviser, adjudicator, verifier, implementer, test-author)
- src/tools/harness.ts:560-563 — server-filled keys and optional `redTests`
- src/tools/harness.ts:572-588 — `codeGraphSection`: the appended code graph block
- src/tools/harness.ts:595-765 — `briefAction`: fill, agent-rules line, task block, graph append, safeJoin write
- src/tools/__tests__/harness.test.ts:491-495 — drift guard that reads the document-phase `briefs.md`
- harness/skills/sdd-document-phase/references/briefs.md:6-137 — drafter brief section
- harness/skills/sdd-document-phase/references/briefs.md:139-158 — gate-A re-spawn brief
- harness/skills/sdd-document-phase/references/briefs.md:160-262 — round section appended to the reviewer scaffold
- harness/skills/sdd-document-phase/references/briefs.md:264-359 — reviser brief and disposition rules
- harness/skills/sdd-implementation-phase/references/briefs.md:5-65 — implementer standing brief
- harness/skills/sdd-implementation-phase/references/briefs.md:134-156 — verifier standing brief

## Run scripts (design)
- harness/skills/sdd-continue/references/formats.md:101-117 — `retro.sh` text and entry header
- harness/skills/sdd-continue/references/formats.md:164-183 — `event.sh` text: `SDD_LEDGER`, `SDD_RUN`, `SDD_SPEC` lines
- harness/skills/sdd-document-phase/references/cleanup.md:71-97 — `commit-spec-store.sh`
- harness/skills/sdd-document-phase/references/cleanup.md:99-125 — `spec-edit.mjs`
- harness/skills/sdd-document-phase/references/cleanup.md:127-159 — `append-changes.sh`

## Skill sections that move (design)
- harness/skills/sdd-document-phase/SKILL.md:114-141 — Lint step (kept)
- harness/skills/sdd-document-phase/SKILL.md:143-167 — Gate A
- harness/skills/sdd-document-phase/SKILL.md:175-182 — Step 2 item 3: prompt read, overwrite, `append-changes.sh`
- harness/skills/sdd-document-phase/SKILL.md:224-273 — Standoff, Circling and Cap convergence checks
- harness/skills/sdd-document-phase/SKILL.md:275-316 — Step 4a and Step 4b
- harness/skills/sdd-document-phase/SKILL.md:339-363 — Design scope-cut gate
- harness/skills/sdd-document-phase/SKILL.md:379-412 — Gate B
- harness/skills/sdd-document-phase/SKILL.md:414-426 — Step R
- harness/skills/sdd-document-phase/SKILL.md:436-444 — Legacy rules
- harness/skills/sdd-implementation-phase/SKILL.md:186-198 — Gate step: `files` and `checks` sources
- harness/skills/sdd-implementation-phase/SKILL.md:269-277 — Deferral bar (kept)
- harness/skills/sdd-implementation-phase/SKILL.md:279-322 — Design defect, Escalate, Resume recovery
- harness/skills/sdd-implementation-phase/SKILL.md:324-491 — Completion gate, Live verification, Reconcile a red PR
- harness/skills/sdd-implementation-phase/SKILL.md:493-520 — Repair and the stop table

## Worker report bullets (design)
- harness/agents/sdd-drafter.md:30 — 150-word report
- harness/agents/sdd-reviewer.md:26 — 100-word final message
- harness/agents/sdd-reviser.md:35 — 150-word report with per-finding dispositions
- harness/agents/sdd-adjudicator.md:29 — 150-word report
- harness/agents/sdd-checker.md:25 — 100-word final message
- harness/agents/sdd-implementer.md:38 — 150-word report with file list
- harness/agents/sdd-test-author.md:32 — 120-word report
- harness/agents/sdd-verifier.md:34 — 150-word report with findings

## Gate and note consumers (design)
- src/tools/review-task.ts:263-267 — gate `files`: paths the change should stay within
- src/dashboard/harness/overview-watch.ts:51-54 — `mentionsGate`: only "gate a" or "gate b" in note text

## Decomposition scenario labels (design)
- .spec-workflow/spec-decomposition/decomposition.md:771 — `**End-to-end verification.**` form
- /home/mcf/repo/tradr-hosted/.spec-workflow/spec-decomposition/decomposition.md:72 — `**End-to-end verification**:` form

## Design probes
- /tmp/scratchpad/sdd/lean-orchestrators/design-probe-w.js — last-line usage per message id matches ledger W (0.000%) on the 5 baseline spawns; first-line usage is 0.3-6.3% low (probe 2026-10-02)
- /tmp/scratchpad/sdd/lean-orchestrators/design-probe-base.js — baseline implementation spawn: 127 calls, peak 229,380, base 33,546 tokens, base 24.7% of W
- /tmp/scratchpad/sdd/lean-orchestrators/design-probe-fs.mjs — readdir withFileTypes flags a symlinked entry not a directory; realpath exposes an escaping symlink (node 22, 24)
