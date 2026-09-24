# Codebase context — agent-cache-ttl

## Activity hook (`SubagentStop` and `spawn.end`)
- harness/hooks/sdd-activity.sh:11-31 — pointer-file lookup by cwd prefix; exports the activity file, events file, spec and run id
- harness/hooks/sdd-activity.sh:41-64 — `readUsage`: reads the subagent transcript, keeps the last line per `message.id` (43-55), sums `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` (57-63); returns `null` when no assistant usage exists. It does not read `cache_creation` or `timestamp` today
- harness/hooks/sdd-activity.sh:67-77 — `waitForTail`: bounded wait for the transcript size to settle
- harness/hooks/sdd-activity.sh:82-91 — `subagentTranscript`: `agent_transcript_path`, else the derived subagents path; never the parent transcript ("a wrong number is worse than unknown", line 82)
- harness/hooks/sdd-activity.sh:120-136 — SubagentStop: once-per-spawn marker, then `readUsage`
- harness/hooks/sdd-activity.sh:154-163 — `spawn.end` row: digit-string `input`, `output`, `cacheWrite`, `cacheRead`, `tokens`, and `model` (156-158); else `tokens: "unknown"` only (159-161)
- harness/hooks/sdd-activity.sh:36-165 — the whole node body sits in one single-quoted shell string (no apostrophes allowed, line 83)
- harness/hooks/hooks.json:27-37 — SubagentStop registration
- A live subagent transcript line (Claude Code 2.1.281, probed 2026-09-24) carries top-level `timestamp` and `message.usage.cache_creation` with `ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` beside `cache_creation_input_tokens`

## Hook tests
- src/__tests__/hook-spawn-events.test.ts:15-349 — spawns the hook with fixture payloads and transcripts; 171 (six usage keys), 246 and 262 (`tokens=unknown`), 295 (dedupe by `message.id`), 324 (one `spawn.end` per spawn)

## DeepSeek launcher (out of scope, unchanged)
- harness/skills/sdd-continue/references/sdd-launch.sh:131-143 — its own usage sum and `spawn.end` for DeepSeek children; no `cache_creation` split

## Agent frontmatter and profiles
- harness/agents/sdd-document-orchestrator.md:1-20 — frontmatter: `model` line 4, `effort` line 5
- harness/agents/sdd-implementation-orchestrator.md:1-8 — same shape, `model` line 4, `effort` line 5
- harness/agents/sdd-closeout-orchestrator.md:1-12 — same shape, `model` line 4, `effort` line 5
- harness/agent-profiles.json:1-62 — generated `{ model, effort, role }` per agent; orchestrators at 12-16, 17-21, 27-31; retro orchestrator at 42-46
- scripts/sync-plugin-assets.cjs:20 — asset dirs `agents`, `skills`, `commands`, `hooks`
- scripts/sync-plugin-assets.cjs:67-74 — `syncAssetDir` copies `harness/agents` byte for byte into every plugin root; 45-65 `diffAssetDir` is the `--check` comparison
- scripts/sync-plugin-assets.cjs:76-110 — `buildProfiles`: splits each frontmatter line on its first colon (93-98), so a one-line `experimental: { cacheTtl: 1h }` arrives as the string `{ cacheTtl: 1h }` under `experimental`; writes `model`, `effort`, `role` (103-107)
- scripts/sync-plugin-assets.cjs:112-128 — `syncProfiles`: `--check` fails when the file differs from `buildProfiles`
- scripts/copy-static.cjs:63-71 — copies `harness/agent-profiles.json` to `dist/agent-profiles.json` at build

## Watch view
- src/watch/ledger.ts:38-42 — `AgentProfile { model, effort, role }`
- src/watch/ledger.ts:51-78 — `loadAgentProfiles`: first candidate (`dist` copy, then `harness`) whose every entry has string `model`, `effort`, `role` (65-69); extra keys are dropped
- src/watch/ledger.ts:81 — `AGENT_PROFILES`
- src/watch/ledger.ts:283-296 — `spawn.end` fold onto the spawn node (token kinds, model, provider)
- src/watch/ledger.ts:418-439 — the model returned; `run.start` keys `model`, `providers` read at 424 and 436
- src/watch/render.ts:192-234 — `agentLines`; the tier line at 218-227 prints `declared <model> <effort>` padded to 23 (220, 226) beside `actual`
- src/watch/render.ts:91-93 — the dim `providers` header line from `run.start`

## Usage fold (`harness usage`)
- src/watch/usage.ts:13-24 — `UsageCell { spawns, tokens, unknown }`, `UsageKinds`, `UsagePhase`, `UsageReport`
- src/watch/usage.ts:90-184 — `buildUsageReport`: pairs rows to spawns, aggregates per phase and per agent (a DeepSeek spawn keys as `agent@deepseek`, 131-133)
- src/watch/usage.ts:186-242 — `reduceSpawn`: kinds from the last digit-string `spawn.end` (195-207); `unknown` mark (215-220)
- src/watch/usage.ts:263-265 — `tokenCell`: `N (+M unknown)`
- src/watch/usage.ts:288-299 — `formatOne`; 301-330 — `formatCompare` (two specs side by side with delta)
- src/tools/harness.ts:1063-1084 — `usageAction` builds the report(s) and returns `data.report` / `compare` / `delta`

## Supervisor and ledger format
- harness/skills/sdd-continue/SKILL.md:33-56 — Step 0 Preflight (model, server, agents, harness source; warn-and-continue pattern at 53-55)
- harness/skills/sdd-continue/SKILL.md:73-84 — `sdd-providers.sh` preflight (a shipped script that prints one `key=value` line)
- harness/skills/sdd-continue/SKILL.md:88-107 — run ledger start; `run.start` keys at 100-102
- harness/skills/sdd-continue/references/formats.md:170-182 — `event.sh`: splits each argument at its first `=`, so a value may contain `=`
- harness/skills/sdd-continue/references/formats.md:192-201 — event table; `run.start` keys 194, `spawn.end` keys 199
- harness/skills/sdd-continue/references/sdd-providers.sh:1-30 — script header and node-in-shell pattern to copy

## Checks (probed 2026-09-24)
- `claude --version` prints `2.1.281 (Claude Code)`
- `claude plugin validate . --strict` at the repo root validates the marketplace manifest and passes; run inside `plugins/spec-workflow-harness` it fails before this spec on three unquoted `${CLAUDE_PLUGIN_ROOT}` hook warnings. An agent file with `experimental: { cacheTtl: 1h }` added drew no agent warning in that probe

## Decomposition
- .spec-workflow/spec-decomposition/decomposition.md:394-464 — entry 13: measurement, Delivers, Decided, End-to-end verification (1)-(6), Depends on
