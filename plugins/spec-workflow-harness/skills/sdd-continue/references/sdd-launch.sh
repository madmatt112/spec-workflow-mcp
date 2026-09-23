#!/bin/bash
# SDD launcher body — run one DeepSeek-provider worker as a `claude -p` child.
#
# usage: bash sdd-launch.sh AGENT "MESSAGE"
# Called by the per-run launch.sh, which exports the SDD_* run values and then
# `exec bash "$SDD_LAUNCH_BODY" "$@"`. This body spawns the worker against the
# DeepSeek Anthropic-compatible endpoint, writes spawn.start and spawn.end through
# the run's event.sh, and prints the worker's report on stdout. It never prints,
# writes or logs DEEPSEEK_API_KEY; the child gets it only as ANTHROPIC_AUTH_TOKEN
# with ANTHROPIC_API_KEY unset. Node code sits in single-quoted strings with no
# apostrophes, the same way harness/hooks/sdd-activity.sh:32-35 does.
set -u

AGENT="${1:-}"
MESSAGE="${2:-}"

# Step 1 — refusals: exit 2, one stderr line, no ledger row.
[ -n "${DEEPSEEK_API_KEY:-}" ] || { echo "launcher: DEEPSEEK_API_KEY unset" >&2; exit 2; }

MODEL=""
IFS=',' read -ra SDD_ENTRIES <<< "${SDD_PROVIDERS:-}"
for entry in "${SDD_ENTRIES[@]}"; do
  case "$entry" in
    "$AGENT":deepseek:*) MODEL="${entry##*:}"; break ;;
  esac
done
[ -n "$MODEL" ] || { echo "launcher: $AGENT is not a deepseek provider in SDD_PROVIDERS" >&2; exit 2; }

AGENTS_DIR="$(dirname "$SDD_LAUNCH_BODY")/../../../agents"
AGENT_FILE="$AGENTS_DIR/$AGENT.md"
[ -f "$AGENT_FILE" ] || { echo "launcher: agent file missing for $AGENT" >&2; exit 2; }
command -v claude >/dev/null 2>&1 || { echo "launcher: claude not on PATH" >&2; exit 2; }
[ -f "$SDD_EVENT_SCRIPT" ] || { echo "launcher: event script missing" >&2; exit 2; }

# Step 2 — ALIAS (the request model the DeepSeek endpoint maps), ROLE, TOOLS.
case "$MODEL" in
  deepseek-v4-pro) ALIAS="claude-opus-4-8" ;;
  deepseek-flash)  ALIAS="claude-sonnet-5" ;;
  *) echo "launcher: unknown deepseek model $MODEL" >&2; exit 2 ;;
esac
ROLE="${AGENT#sdd-}"

# Step 3 — TOOLS, MCP_TOOLS and the --agents JSON, built from the agent file
# frontmatter and body; effort from the first existing profiles file, else the
# frontmatter (D13). model in the JSON is the request ALIAS, same as --model (D4).
PROFILE1="$SDD_HARNESS_REPO/harness/agent-profiles.json"
PROFILE2="$AGENTS_DIR/../agent-profiles.json"
{
  IFS= read -r TOOLS
  IFS= read -r MCP_TOOLS
  IFS= read -r AGENTS_JSON
} < <(node -e '
const fs = require("fs");
const [file, alias, agent, p1, p2] = process.argv.slice(1);
const text = fs.readFileSync(file, "utf8");
const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
const fm = m ? m[1] : "";
const body = m ? m[2] : text;
let desc = "";
const dm = fm.match(/^description:\s*(.*)$/m);
if (dm) desc = dm[1].trim();
const tools = [];
let inTools = false;
for (const ln of fm.split("\n")) {
  if (/^tools:\s*$/.test(ln)) { inTools = true; continue; }
  if (inTools) {
    const tm = ln.match(/^\s*-\s*(.+?)\s*$/);
    if (tm) { tools.push(tm[1]); continue; }
    if (/^\S/.test(ln)) break;
  }
}
let effort = "";
const em = fm.match(/^effort:\s*(.*)$/m);
if (em) effort = em[1].trim();
function profEffort(p) {
  try { const j = JSON.parse(fs.readFileSync(p, "utf8")); return j[agent] && j[agent].effort; } catch { return null; }
}
const pe = profEffort(p1) || profEffort(p2);
if (pe) effort = pe;
const mcp = tools.filter(function (t) { return t.indexOf("mcp__") === 0; });
const obj = {};
obj[agent] = { description: desc, prompt: body, tools: tools, model: alias, effort: effort };
process.stdout.write(tools.join(",") + "\n" + mcp.join(",") + "\n" + JSON.stringify(obj) + "\n");
' "$AGENT_FILE" "$ALIAS" "$AGENT" "$PROFILE1" "$PROFILE2")
[ -n "$AGENTS_JSON" ] || { echo "launcher: could not build agents JSON for $AGENT" >&2; exit 2; }

# Step 4 — a fresh session id per call, and an empty per-run state home so the
# child's hooks exit before reading their payload (D3).
SID="$(node -e 'console.log(require("crypto").randomUUID())')"
STATE="/tmp/scratchpad/sdd/$SDD_SPEC/child-state"
mkdir -p "$STATE"
mkdir -p "/tmp/scratchpad/sdd/$SDD_SPEC"

# Step 5 — spawn.start row.
bash "$SDD_EVENT_SCRIPT" spawn.start agent="$AGENT" role="$ROLE" provider=deepseek model="$MODEL" effort=not-applied

# Step 6 — the child command, foreground, from SDD_CODE_ROOT.
OUT="/tmp/scratchpad/sdd/$SDD_SPEC/launch-$SID.out"
ERR="/tmp/scratchpad/sdd/$SDD_SPEC/launch-$SID.err"
ARGS=(-p "$MESSAGE" --agents "$AGENTS_JSON" --agent "$AGENT" --model "$ALIAS" --tools "$TOOLS"
  --strict-mcp-config --permission-mode auto --permission-prompts none
  --output-format text --session-id "$SID")
case "$SDD_SPEC_STORE_REPO" in
  "$SDD_CODE_ROOT"|"$SDD_CODE_ROOT"/*) ;;
  *) ARGS+=(--add-dir "$SDD_SPEC_STORE_REPO") ;;
esac
if [ -n "$MCP_TOOLS" ]; then
  ARGS+=(--mcp-config "$SDD_CODE_ROOT/.mcp.json" --allowedTools "$MCP_TOOLS")
fi
(
  cd "$SDD_CODE_ROOT" && \
  env -u ANTHROPIC_API_KEY \
    ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic \
    ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY" \
    ANTHROPIC_MODEL="$ALIAS" \
    XDG_STATE_HOME="$STATE" \
    claude "${ARGS[@]}"
) >"$OUT" 2>"$ERR"
CODE=$?

# Step 7 — locate the transcript deterministically and sum it with a copy of the
# hook's readUsage (harness/hooks/sdd-activity.sh:37-49). Missing or empty: tokens=unknown.
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SLUG="$(printf '%s' "$SDD_CODE_ROOT" | sed 's/[^A-Za-z0-9]/-/g')"
T="$CFG/projects/$SLUG/$SID.jsonl"
USAGE="$(node -e '
const fs = require("fs");
function num(x) { return typeof x === "number" && Number.isFinite(x) ? x : 0; }
function readUsage(p) {
  let text; try { text = fs.readFileSync(String(p), "utf8"); } catch { return null; }
  const s = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, models = []; let seen = 0;
  for (const line of text.split("\n")) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    const u = e && e.type === "assistant" && e.message && e.message.usage;
    if (!u || typeof u !== "object") continue;
    seen++; s.input += num(u.input_tokens); s.output += num(u.output_tokens);
    s.cacheWrite += num(u.cache_creation_input_tokens); s.cacheRead += num(u.cache_read_input_tokens);
    const mm = e.message.model; if (typeof mm === "string" && !models.includes(mm)) models.push(mm);
  }
  return seen ? Object.assign(s, { tokens: s.input + s.output + s.cacheWrite + s.cacheRead, model: models.join("+") }) : null;
}
const r = readUsage(process.argv[1]);
if (r) process.stdout.write([r.input, r.output, r.cacheWrite, r.cacheRead, r.tokens, r.model].join("\t"));
' "$T")"
if [ -n "$USAGE" ]; then
  IFS=$'\t' read -r U_IN U_OUT U_CW U_CR U_TOK U_MODEL <<< "$USAGE"
  bash "$SDD_EVENT_SCRIPT" spawn.end agent="$AGENT" provider=deepseek model="$U_MODEL" \
    input="$U_IN" output="$U_OUT" cacheWrite="$U_CW" cacheRead="$U_CR" tokens="$U_TOK"
else
  bash "$SDD_EVENT_SCRIPT" spawn.end agent="$AGENT" provider=deepseek tokens=unknown
fi

# Step 8 — report the child's stdout, or exit 1 naming the .err file.
if [ "$CODE" -eq 0 ] && [ -s "$OUT" ]; then
  cat "$OUT"
  exit 0
fi
BYTES="$(wc -c < "$OUT" 2>/dev/null || echo 0)"
echo "launcher: $AGENT exited $CODE, stdout $BYTES bytes, stderr $ERR" >&2
exit 1
