# Step 0 Answers

Date: 2026-09-13
Source: the Claude Code documentation at `code.claude.com`.

The documentation moved. Each URL at `docs.claude.com/en/docs/claude-code/*` now
redirects to `code.claude.com/docs/en/*`.

## Summary

| # | Question | Answer |
|---|---|---|
| 1 | Does the Agent tool `schema` option work for plugin agent types from a skill? | No |
| 2 | Does the SubagentStop hook payload carry token usage? | No |
| 3 | Does `subagentPromptCacheTtl` exist? | Yes |
| 4 | Does the Max plan publish a weight for Sonnet against Opus and Fable? | No |
| 5 | Do `claude -p` runs never have AskUserQuestion? | No |

## 1. Agent tool `schema` option — No

The question contains an incorrect premise. The Agent tool has no `schema`
parameter.

`schema` is an option of the `agent()` function in a Workflow script. The
documentation puts no limit on the agent type that can use it. Subagent
frontmatter also has no schema field. The permitted fields are `name`,
`description`, `tools`, `disallowedTools`, `model`, `permissionMode`,
`maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`,
`isolation`, `color`, `initialPrompt` and `experimental`.

URL: https://code.claude.com/docs/en/workflows#what-the-saved-script-looks-like

## 2. SubagentStop token usage — No

The payload has these fields only:

- `session_id`
- `prompt_id`
- `transcript_path`
- `cwd`
- `permission_mode`
- `hook_event_name`
- `agent_id`
- `agent_type`
- `last_assistant_message`
- `stop_reason`

The payload has no field for token usage, cost or usage statistics.

URL: https://code.claude.com/docs/en/hooks#subagentstop

## 3. `subagentPromptCacheTtl` — Yes

The setting exists. It accepts `5m` or `1h`. Claude Code ignores all other
values. The equivalent environment variable is
`CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`. Both need Claude Code v2.1.242 or
later.

The setting controls the "everything else" request bucket. This bucket holds
subagents, workflows, teammates, forks, compaction and session titles. These
requests get a 5-minute TTL by default, also on a Claude subscription.

### How the API bills the longer TTL

The API bills a 1-hour cache write at a higher rate than a 5-minute cache
write. A cache read stays at approximately 10% of the standard input rate.

### Two conditions to know

- `FORCE_PROMPT_CACHING_5M=1` has a higher precedence. It forces 5 minutes for
  both buckets.
- Claude Code ignores a `1h` value in a subagent's `experimental.cacheTtl`
  frontmatter while your Claude subscription uses usage credits.

URL: https://code.claude.com/docs/en/prompt-caching#choose-the-ttl-yourself

## 4. Max plan model weight — No

Anthropic publishes no weight, multiplier or conversion rate between Sonnet,
Opus, Fable and Haiku tokens.

The documentation gives this structure instead:

- The five-hour window and the weekly window are shared across all models.
- Separate model-family limits apply in addition. After the message
  `You've hit your Opus limit` or `You've hit your Sonnet limit`, a switch to a
  model in a different family with `/model` lets the work continue.
- After the message `You've hit your session limit` or
  `You've hit your weekly limit`, a switch to a different model does not help.

Any specific ratio, for example "Fable uses two times more than Opus", is a
third-party estimate. It is not documented.

URL: https://code.claude.com/docs/en/costs#when-a-developer-asks-about-a-limit

## 5. AskUserQuestion in `claude -p` — No

The statement is incorrect. The tool is present in a `-p` run.

- In a bare `-p` run with no permission host, Claude Code denies the call. The
  tool is still in the tool list.
- A permission host can answer the call. Use an Agent SDK `canUseTool` callback
  or the `--permission-prompt-tool` flag.
- `--permission-prompts none` removes the tool from Claude's tool list.
- `dontAsk` mode denies the call, also when an allow rule matches.
- The tool is not available in a subagent.

URLs:
- https://code.claude.com/docs/en/headless#turn-off-permission-prompts-in-unattended-runs
- https://code.claude.com/docs/en/agent-sdk/user-input
