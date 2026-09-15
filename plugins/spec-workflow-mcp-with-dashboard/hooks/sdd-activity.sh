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
  if (d.usage && typeof d.usage.tokens === "number") e.tokens = d.usage.tokens;
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
  } else if (ev === "SubagentStop" && !/-orchestrator$/.test(agent)) {
    fs.appendFileSync(eventsFile, JSON.stringify({ ts: e.ts, type: "spawn.end", run, spec, agent }) + "\n");
  }
}
'
exit 0
