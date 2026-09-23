# DeepSeek Preflight

Date: 2026-09-23
Source: the launcher body `harness/skills/sdd-continue/references/sdd-launch.sh`, run
through a per-run `launch.sh` from a scratch spec dir at
`/tmp/scratchpad/sdd/provider-per-role/preflight/`. The nine `SDD_*` values were the
design's `launch.sh` block (`design.md:113-121`): `SDD_CODE_ROOT=/home/mcf/repo/spec-workflow-mcp`
(the main checkout — it holds the built `dist/index.js` and the tracked `.mcp.json` the
child needs; the worktree has neither), `SDD_HARNESS_REPO` the worktree,
`SDD_SPEC_STORE_REPO` the scratch dir (so `--add-dir` covers it),
`SDD_PROVIDERS=sdd-reviewer:deepseek:deepseek-v4-pro,sdd-reviser:deepseek:deepseek-v4-pro`.
Commands run (the key is only ever read from `$DEEPSEEK_API_KEY` in the environment and is
redacted everywhere):

```
bash launch.sh sdd-reviewer "Read and execute the instructions in <review-prompt-a.md>"
bash launch.sh sdd-reviser  "Read and execute the instructions in <review-prompt-b.md>"
```

The child command the body builds (per `design.md:125-135`):

```
env -u ANTHROPIC_API_KEY ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic \
  ANTHROPIC_AUTH_TOKEN=$DEEPSEEK_API_KEY ANTHROPIC_MODEL=claude-opus-4-8 XDG_STATE_HOME=<empty> \
  claude -p "MESSAGE" --agents "<JSON>" --agent AGENT --model claude-opus-4-8 --tools "<list>" \
    --strict-mcp-config --permission-mode auto --permission-prompts none \
    --output-format text --session-id <uuid> --add-dir <scratch> \
    [--mcp-config <code root>/.mcp.json --allowedTools <mcp tools>]   # reviser only
```

## Summary

| # | Question | Answer |
|---|----------|--------|
| 1 | (a) reviewer run against DeepSeek | Pass — analysis written, ends with the verdict block, `message.model=deepseek-v4-pro`, usage sums to 2,894,094 tokens |
| 2 | (b) reviser one `adversarial-response` MCP call | Answered — the call succeeded and returned; `sdd-reviser` is eligible (Req 6 crit 4) |
| 3 | Does `ANTHROPIC_AUTH_TOKEN` alone authenticate the child? | Yes — no `ANTHROPIC_API_KEY`, no OAuth; requests went to `api.deepseek.com` |
| 4 | Does `--agents` accept `tools` and `model` keys? | Yes — both accepted, neither rejected |
| 5 | Where does the transcript land, and does `--session-id` fix its name? | `~/.claude/projects/<code-root slug>/<session-id>.jsonl`; `--session-id` names it; the D15 slug rule holds |
| 6 | Do the child's hooks fire and write to the run's files? | No — the empty `XDG_STATE_HOME` has no `sdd/active-run`, so the hook exits before its payload (D3) |
| 7 | Does the declared `effort` reach DeepSeek? | No — recorded `effort=not-applied`; the endpoint ignores it (decomposition preamble) |

No probe showed a flag or path wrong, so the launcher body was not changed after the runs.

## 1. (a) reviewer run — Pass

`bash launch.sh sdd-reviewer` exited 0 and printed the reviewer's report on stdout. All
three pass conditions held:

- The analysis file `analysis-a.md` (5.4 KB) exists in the review prompt's format and ends
  with the verdict block (`VERDICT: iterate` / `MUST_FIX: 1` / `SHOULD_FIX: 1` / `MINOR: 2`
  / `DESIGN_READY: no` / `ESCALATE: none`).
- The transcript was found at the computed path
  `~/.claude/projects/-home-mcf-repo-spec-workflow-mcp/65d65f0c-527a-4b9b-8317-cff08058e9bc.jsonl`
  and summed to digits: `input=238797 output=72641 cacheWrite=0 cacheRead=2582656`,
  `tokens=2894094`.
- `message.model` in every one of the transcript's 51 assistant entries is
  `deepseek-v4-pro` — the value Req 7 criterion 1 asserts on `spawn.end`.

Consequence: the launcher's report contract, ledger rows and transcript sum are proven
against a real DeepSeek run; the spec proceeds (Req 6 crit 6, no escalation).

## 2. (b) reviser MCP call — Answered

`bash launch.sh sdd-reviser` exited 0. The reviser (running on DeepSeek: 8 assistant
entries, all `message.model=deepseek-v4-pro`) made one
`mcp__spec-workflow__adversarial-response` call with `specName: provider-per-role`,
`phase: requirements`; it was answered by the spec-workflow MCP server started from
`--mcp-config /home/mcf/repo/spec-workflow-mcp/.mcp.json`, and the reviser wrote
`success: true` to `answer-b.txt`. The refusal question does not arise — the call reached
the connector and returned; it was neither refused by the API connector nor by Claude
Code's client tools.

Consequence: an MCP tool call works over DeepSeek, so `sdd-reviser` joins the eligible set
in this spec (Req 6 crit 4). Task 4 reads this record to make that edit; this task does not
touch any eligible list.

## 3. Auth by `ANTHROPIC_AUTH_TOKEN` alone — Yes

The child ran with `ANTHROPIC_API_KEY` unset (`env -u`) and only `ANTHROPIC_AUTH_TOKEN` set
from `$DEEPSEEK_API_KEY`, and both runs returned `message.model=deepseek-v4-pro`. The
child's stderr confirms the routing: `your requests go through api.deepseek.com`. A benign
warning noted that "ANTHROPIC_API_KEY or another auth source is set and takes precedence
over your claude.ai login" — the "another auth source" is the auth token; no login or API
key was used.

Consequence: the launcher can pass the key as `ANTHROPIC_AUTH_TOKEN` only and never touch
the session's Anthropic credential (Req 4 crit 4). Had the token alone not authenticated,
the launcher would have had to leak the session credential — the "no" that would fail (a).

## 4. `--agents` `tools` and `model` keys — Accepted

Both runs passed the `--agents` JSON with `tools` (the frontmatter list) and `model` (the
request alias `claude-opus-4-8`) keys. Neither run errored on `--agents`; the reviewer used
its `Read`/`Write` tools and the reviser used its MCP tool, so the definition was applied,
not rejected.

Consequence: the body keeps `tools` and `model` inside the `--agents` JSON (design Data
Models). A rejection would have moved the list to `--tools` and the alias to `--model` —
both of which the body already also passes — so no change was needed either way.

## 5. Transcript path and `--session-id` — As computed

Each run's transcript landed at
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/<slug>/<session-id>.jsonl`, where `<slug>` is
`SDD_CODE_ROOT` with every character outside `A-Za-z0-9` replaced by `-`
(`/home/mcf/repo/spec-workflow-mcp` → `-home-mcf-repo-spec-workflow-mcp`), and
`<session-id>` is the UUID the body passed with `--session-id` (reviewer
`65d65f0c-...`, reviser `1f4fce96-...`, different per call). Both files were present at
exactly that path.

Consequence: the body locates the transcript deterministically (Req 3 crit 3), so the
`spawn.end` usage sums come from the child's own transcript, never the newest file. The D15
slug rule is confirmed; a different directory-name rule would have changed the path and
forced `tokens=unknown`.

## 6. Child hooks — write nothing to the run's files

`XDG_STATE_HOME` pointed at an empty per-run directory (`.../child-state`) with no
`sdd/active-run` pointer, so the activity hook exits at `harness/hooks/sdd-activity.sh:11-12`
before reading its payload (D3). Evidence: after both runs the scratch ledger holds exactly
the four rows the launcher wrote (one `spawn.start` and one `spawn.end` per call), and no
`harness-activity.jsonl` was created in the scratch spec dir.

Consequence: a DeepSeek spawn is accounted for by the launcher's two rows only, never
double-counted by the child's own hooks (Req 3 crit 4).

## 7. Effort — not applied

`spawn.start` records `effort=not-applied` for both agents by design; the DeepSeek
Anthropic-compatible endpoint takes no Anthropic `effort`/thinking parameter, so the
profile's declared effort (`xhigh` for the reviewer, `high` for the reviser) does not reach
it. There is no behavioural signal of applied effort in either transcript.

Consequence: the ledger states the truth — effort is `not-applied` on a DeepSeek row
(Req 3 crit 1, D4) — matching the decomposition preamble's expectation that DeepSeek
ignores it.
