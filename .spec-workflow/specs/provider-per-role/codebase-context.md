# Codebase context — provider-per-role

## Run ledger and the activity hook
- harness/hooks/sdd-activity.sh:11-27 — pointer-file lookup; exits at once unless the payload names an `sdd-` agent type and the cwd matches an active run
- harness/hooks/sdd-activity.sh:14-17 — the `agent_type` gate: a payload without an `sdd-` agent type writes nothing
- harness/hooks/sdd-activity.sh:37-49 — `readUsage`: sums `message.usage` over a transcript's assistant entries, joins the distinct `message.model` values with `+`
- harness/hooks/sdd-activity.sh:56-63 — `subagentTranscript`: `agent_transcript_path`, else the derived subagents path; never the parent transcript
- harness/hooks/sdd-activity.sh:106-113 — `spawn.start` on PreToolUse only when `subagent_type` is `sdd-*` and the prompt names a `<role>-brief*.md` file; the role is the filename stem
- harness/hooks/sdd-activity.sh:114-123 — `spawn.end` on SubagentStop with the six usage keys and `model`, or `tokens=unknown`
- harness/hooks/hooks.json:1-30 — the three hook registrations with `${CLAUDE_PLUGIN_ROOT}`
- scripts/dev-link.sh:47-60 — the checkout layout registers the same hook in `~/.claude/settings.json` with an absolute path
- harness/skills/sdd-continue/references/formats.md:155-182 — the run ledger and the `event.sh` text the supervisor writes per run (`key=value` string rows)
- harness/skills/sdd-continue/references/formats.md:186-198 — event types and keys; `run.start` keys `model`, `specStore`, `codeRoot`, `worktree`, `headless`; who writes `spawn.start`, `spawn.end`, `spawn.usage`
- harness/skills/sdd-continue/references/formats.md:200-210 — orchestrator spawn rows and the interrupted `spawn.end` the supervisor writes by hand
- .spec-workflow/specs/provider-per-role/harness-events.jsonl:1 — a live `run.start` row of today's shape
- .spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:104-105 — a live reviewer spawn: `spawn.end` from the hook and `spawn.usage` from the orchestrator, no `spawn.start` (prompt-launched)

## Supervisor (sdd-continue)
- harness/skills/sdd-continue/SKILL.md:33-56 — preflight: model check, server, agent prefix, harness source
- harness/skills/sdd-continue/SKILL.md:58-74 — roots; worktree check and main checkout (63-67); `agent-rules.md` at `<spec store root>/agent-rules.md`, path passed to every orchestrator (71-72)
- harness/skills/sdd-continue/SKILL.md:76-86 — run ledger start: run id, `event.sh` written with the Write tool, pointer line, `run.start` with `model`, `specStore`, `codeRoot`, `worktree`, `headless`
- harness/skills/sdd-continue/SKILL.md:190-208 — the orchestrator launch prompt lines (`AGENT_RULES`, `AGENT_PREFIX`, `HARNESS_REPO`, `EVENT_SCRIPT`, `BUDGET`, `REVISION_INPUT`)
- harness/skills/sdd-continue/SKILL.md:213-216 — supervisor writes `spawn.start` and `spawn.usage` per orchestrator; the hook writes its `spawn.end`
- harness/skills/sdd-continue/SKILL.md:226-234 — model pre-flight: reads `.message.model` from the run transcript under `~/.claude/projects/`
- harness/skills/sdd-continue/SKILL.md:275-282 — worktree rule keyed on `worktree-per-change: required` and `worktree-setup:` in `agent-rules.md`
- harness/skills/sdd-continue/SKILL.md:292-307 — gate mode keyed on the optional top-of-file `gates:` key in `agent-rules.md`
- harness/skills/sdd-continue/SKILL.md:419-433 — status line, `run.end`, ledger commit, `deregister.mjs`
- harness/skills/sdd-continue/references/harness-source.sh:13-18 — a shipped script located from the skill's own base dir; prints `source:` and `drift:`

## Document orchestrator and workers
- harness/agents/sdd-document-orchestrator.md:48-54 — standing rules; line 50: spawn workers only with the Agent tool, never a `model` parameter
- harness/skills/sdd-document-phase/SKILL.md:23-27 — the same spawn rule in the skill; the five worker names
- harness/skills/sdd-document-phase/SKILL.md:44-52 — ledger calls: `spawn.usage` after each worker report (`agent`, `role`, `phase`, `round` or `task`, `result`); the hook records the spawn boundary
- harness/skills/sdd-document-phase/SKILL.md:113-115 — reviser spawn from a brief file (brief-launched, hook-recorded)
- harness/skills/sdd-document-phase/SKILL.md:160-164 — reviewer spawn with exactly `Read and execute the instructions in <promptOutputPath>`; a missing analysis file spawns once more, then `PHASE: error`
- harness/skills/sdd-document-phase/SKILL.md:278-283 — checker spawn from the narrow-check prompt; `VERIFIED:` line and deferred findings read from the file
- harness/skills/sdd-document-phase/references/briefs.md:125-176 — the round section appended to the review prompt scaffold
- harness/skills/sdd-document-phase/references/briefs.md:225 — the reviser brief permits the `adversarial-response` MCP call
- harness/skills/sdd-document-phase/references/briefs.md:375-398 — the narrow-check prompt the checker executes
- src/tools/adversarial-review.ts:112-117 — prompt and analysis paths `reviews/adversarial-prompt-<phase>[-rN].md`, `reviews/adversarial-analysis-<phase>[-rN].md`
- src/tools/adversarial-review.ts:184-187 — the launch instruction the tool returns
- harness/agents/sdd-reviewer.md:1-13 — frontmatter: `claude-opus-4-8`, `xhigh`, tools Read, Grep, Glob, Bash, Write (7-12); no MCP tool
- harness/agents/sdd-checker.md:1-13 — frontmatter: `claude-sonnet-5`, `high`, the same five tools (7-12); no MCP tool
- harness/agents/sdd-reviser.md:1-16 — frontmatter: `claude-sonnet-5`, `high`; declares `mcp__spec-workflow__adversarial-response` and its two plugin-prefixed names (14-16)
- harness/agents/sdd-adjudicator.md:7-16 — declares `adversarial-response`
- harness/agents/sdd-drafter.md:7-16 — declares `mcp__spec-workflow__harness`
- harness/agents/sdd-implementer.md:7-18 — declares `log-implementation` and `deferrals`
- harness/agents/sdd-verifier.md:7-18 — declares `review-task`, `get-task-review`, `mcp__playwright`
- harness/skills/sdd-retrospective/SKILL.md:79-87 — the analyst is prompt-launched (a non-brief worker)

## Declared tiers
- harness/agent-profiles.json:1-62 — generated `{model, effort, role}` per agent; checker 7-11, reviewer 47-51, reviser 52-56
- scripts/sync-plugin-assets.cjs:85-110 — `buildProfiles` from agent frontmatter (`model`, `effort`, role from the description)
- scripts/sync-plugin-assets.cjs:112-128 — `syncProfiles` writes or checks the file
- src/watch/ledger.ts:38-42 — `AgentProfile`
- src/watch/ledger.ts:51-78 — `loadAgentProfiles`: `dist/../agent-profiles.json`, else `harness/agent-profiles.json`
- docs/SDD-HARNESS.md:284-304 — model policy table; skills never pass `model` to the Agent tool

## Usage fold (`harness usage`)
- src/watch/usage.ts:13-23 — `UsageCell`, `UsageKinds`, `UsagePhase`, `UsageReport`, `UsageDelta`
- src/watch/usage.ts:76-161 — `buildUsageReport`: stable sort, one open spawn per agent, start-less `spawn.usage` synthesis, start-less `spawn.end` dropped (93-100), per-phase cells, orchestrator share
- src/watch/usage.ts:163-216 — `reduceSpawn`: tokens from the later digit `spawn.end`, else `spawn.usage`; `unknown` mark; phase window
- src/watch/usage.ts:219-231 — `usageDelta`
- src/watch/usage.ts:253-298 — `formatUsageTable`, `formatOne`, `formatCompare`: `phase | agent | spawns | tokens` rows, total lines with `orch` share and kinds
- src/tools/harness.ts:28-108 — the `harness` tool schema (`action` enum, `compareSpecName`)
- src/tools/harness.ts:110-130 — action dispatch
- src/tools/harness.ts:1020-1055 — `readSpecLedger`
- src/tools/harness.ts:1063-1084 — `usageAction`: `message` table, `data.report` (plus `compare`, `delta`)
- src/watch/__tests__/usage.test.ts:8-9 — the committed fixture ledger path
- src/watch/__tests__/usage.test.ts:42-60 — spawn opening rules tests (start-less cases)
- src/__tests__/fixtures/usage-ledger.jsonl:1-20 — the new-shape fixture ledger (no `provider` key)
- docs/TOOLS-REFERENCE.md:574-577 — the `usage` action's documentation

## Watch view (`--watch`)
- src/index.ts:47-52 — `--watch`, `--spec`, `--once` flags
- src/index.ts:380-386 — watch dispatch to `runWatch`
- src/watch/index.ts:61-71 — `renderOnce` reads the two jsonl files, `tasks.md`, HANDOFF
- src/watch/ledger.ts:18-24 — `LedgerEvent`: string values only
- src/watch/ledger.ts:94-114 — `SpawnNode` (`model`, six usage numbers, `level`)
- src/watch/ledger.ts:142-163 — `RunModel` (`model` from `run.start`, `tokensTotal`, `hasActivity`)
- src/watch/ledger.ts:262-288 — `spawn.start`/`spawn.end` pairing; usage numbers and `model` copied from `spawn.end`
- src/watch/ledger.ts:291-332 — `spawn.usage` fold and start-less synthesis
- src/watch/ledger.ts:357 — `tokensTotal` sums every spawn
- src/watch/ledger.ts:380-401 — ticker lines per event type
- src/watch/ledger.ts:403-422 — the returned `RunModel`; `model` from `runStart`
- src/watch/render.ts:67-79 — header: spec, code root, worktree, run, `tokens` total (77)
- src/watch/render.ts:178-218 — `agentLines`; tier line `declared ... actual ...` with `!=` on substitution (204-211)
- docs/SDD-HARNESS.md:305-333 — watching a run; the two files; tokens from the hook (330-333)

## agent-rules.md and its machine-read lines
- .spec-workflow/agent-rules.md:5-6 — `worktree-per-change`, `worktree-setup`
- .spec-workflow/agent-rules.md:30-32 — CI node 20; tests on `child_process`, `fs` or streams assert only guaranteed fields
- .spec-workflow/agent-rules.md:61-70 — `## Sensitive paths` (includes `harness/hooks/`)
- .spec-workflow/agent-rules.md:72-87 — `## Generated paths`, `## Prose paths`
- docs/SDD-HARNESS.md:263-282 — writing `agent-rules.md`; the four machine-read lines (271-280)
- src/core/gate-rules.ts:20-23 — heading constants for machine-read sections

## Hook tests
- src/__tests__/hook-spawn-events.test.ts:13-41 — drives the real script with a temp pointer file and JSON payloads on stdin, `HOME` and `XDG_STATE_HOME` overridden
- src/__tests__/hook-spawn-events.test.ts:107-134 — `spawn.start` for a brief-launched worker
- src/__tests__/hook-spawn-events.test.ts:171-195 — six usage keys and `model` from a fixture transcript

## CLI and environment probes (2026-09-21)
- `claude --version` prints `2.1.278 (Claude Code)`
- `claude -p --help` lists `-p, --print`, `--agents <json>`, `--agent <agent>`, `--model <model>`, `--tools <tools...>`, `--allowedTools`, `--mcp-config`, `--strict-mcp-config`, `--session-id <uuid>`, `--add-dir`, `--permission-mode <mode>`, `--permission-prompts host|none`, `--output-format text|json|stream-json`, `--no-session-persistence`, `--bare`, `--effort <level>`, `--settings`, `--setting-sources`
- docs/step-0-answers.md:1-17 — the answer-file format (date, source, summary table, one section per question)
- Shell of this drafter: `DEEPSEEK_API_KEY` unset, `ANTHROPIC_API_KEY` unset
- Transcripts: `~/.claude/projects/<cwd slug>/<session id>.jsonl` (25 files in this project's directory)
