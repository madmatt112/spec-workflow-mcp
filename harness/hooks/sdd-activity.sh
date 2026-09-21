#!/bin/bash
# SDD harness activity recorder (PreToolUse, SubagentStart, SubagentStop).
#
# Appends one JSON line per event to <spec dir>/harness-activity.jsonl for agents whose
# type starts with `sdd-` (plugin-scoped names such as spec-workflow-harness:sdd-reviewer
# included). The pointer file the sdd-continue supervisor writes at run start,
# ${XDG_STATE_HOME:-~/.local/state}/sdd/active-run, holds one tab-separated line per active
# run, `<main checkout>\t<spec dir>\t<run id>`; this hook uses the line whose first field
# is a prefix of the hook input's cwd. Without a matching line, or for any other agent, this exits at once,
# so sessions that are not running the harness pay nothing beyond this check.
POINTER="${XDG_STATE_HOME:-$HOME/.local/state}/sdd/active-run"
[ -f "$POINTER" ] || exit 0
IN=$(cat)
case "$IN" in
  *'"agent_type"'*'sdd-'*) ;;
  *) exit 0 ;;
esac
CWD=$(printf '%s' "$IN" | node -e 'try{process.stdout.write(String(JSON.parse(require("fs").readFileSync(0,"utf8")).cwd||""))}catch{}')
SPEC_DIR=""; RUN_ID=""
while IFS=$'\t' read -r CHECKOUT SDIR RID || [ -n "$CHECKOUT" ]; do
  [ -n "$CHECKOUT" ] || continue
  case "$CWD" in
    "$CHECKOUT"|"$CHECKOUT"/*) SPEC_DIR="$SDIR"; RUN_ID="$RID"; break ;;
  esac
done < "$POINTER"
[ -n "$SPEC_DIR" ] || exit 0
[ -d "$SPEC_DIR" ] || exit 0
export SDD_ACTIVITY_FILE="$SPEC_DIR/harness-activity.jsonl"
export SDD_EVENTS_FILE="$SPEC_DIR/harness-events.jsonl"
export SDD_SPEC="${SPEC_DIR##*/}"
export SDD_RUN_ID="$RUN_ID"
printf '%s' "$IN" | node -e '
const fs = require("fs");
let d;
try { d = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
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
    const m = e.message.model; if (typeof m === "string" && !models.includes(m)) models.push(m);
  }
  return seen ? { ...s, tokens: s.input + s.output + s.cacheWrite + s.cacheRead, model: models.join("+") } : null;
}
// The transcript of the subagent itself. On SubagentStop, transcript_path is the PARENT
// session file, so summing it reports the supervisor usage under the worker name
// (deferral d-3091be1c). Prefer agent_transcript_path when the payload carries it; else
// derive the path Claude Code uses: <parent dir>/<session_id>/subagents/agent-<agent_id>.jsonl.
// Never fall back to transcript_path: a wrong number is worse than "unknown".
// (This JS sits inside a single-quoted shell string: no apostrophes in comments.)
function subagentTranscript(d) {
  const a = d.agent_transcript_path;
  if (typeof a === "string" && a) return a;
  const tp = d.transcript_path, sid = d.session_id, aid = d.agent_id;
  if (typeof tp !== "string" || !tp || !sid || !aid) return null;
  const path = require("path");
  return path.join(path.dirname(tp), String(sid), "subagents", "agent-" + String(aid) + ".jsonl");
}
const type = String(d.agent_type || "");
if (!/(^|:)sdd-/.test(type)) process.exit(0);
const agent = type.slice(type.lastIndexOf(":") + 1);
const e = {
  ts: new Date().toISOString(),
  run: process.env.SDD_RUN_ID || undefined,
  session: d.session_id,
  agentId: d.agent_id,
  agent,
};
let u = null;
const ev = d.hook_event_name;
if (ev === "PreToolUse") {
  e.event = "tool";
  e.tool = d.tool_name;
  const i = d.tool_input || {};
  let s = "";
  if (d.tool_name === "Bash") s = i.command || "";
  else if (i.file_path) s = i.file_path;
  else if (i.subagent_type) s = i.subagent_type;
  else if (i.action) s = i.action + (i.specName ? " " + i.specName : "");
  else if (i.pattern) s = i.pattern;
  else if (i.skill) s = i.skill;
  s = String(s).replace(/\s+/g, " ").trim();
  if (s.length > 160) s = s.slice(0, 157) + "...";
  e.summary = s;
} else if (ev === "SubagentStart") {
  e.event = "agent.start";
} else if (ev === "SubagentStop") {
  e.event = "agent.stop";
  const tp = subagentTranscript(d);
  u = tp ? readUsage(tp) : null;
  if (u) e.tokens = u.tokens;
} else {
  process.exit(0);
}
fs.appendFileSync(process.env.SDD_ACTIVITY_FILE, JSON.stringify(e) + "\n");
// Requirement 3: spawn boundary events to harness-events.jsonl (LedgerEvent shape).
const eventsFile = process.env.SDD_EVENTS_FILE;
if (eventsFile) {
  const run = process.env.SDD_RUN_ID || undefined;
  const spec = process.env.SDD_SPEC || undefined;
  if (ev === "PreToolUse") {
    const ti = d.tool_input || {};
    const sub = String(ti.subagent_type || "");
    const m = String(ti.prompt || "").match(/([^\s/]+)-brief[^\s/]*\.md/);
    if (/(^|:)sdd-/.test(sub) && m) {
      const child = sub.slice(sub.lastIndexOf(":") + 1);
      fs.appendFileSync(eventsFile, JSON.stringify({ ts: e.ts, type: "spawn.start", run, spec, agent: child, role: m[1] }) + "\n");
    }
  } else if (ev === "SubagentStop") {
    let row;
    if (u) {
      row = { ts: e.ts, type: "spawn.end", run, spec, agent, input: String(u.input), output: String(u.output), cacheWrite: String(u.cacheWrite), cacheRead: String(u.cacheRead), tokens: String(u.tokens) };
      if (u.model) row.model = u.model;
    } else {
      row = { ts: e.ts, type: "spawn.end", run, spec, agent, tokens: "unknown" };
    }
    fs.appendFileSync(eventsFile, JSON.stringify(row) + "\n");
  }
}
'
exit 0
