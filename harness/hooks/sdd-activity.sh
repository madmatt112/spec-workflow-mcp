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
# Per-spawn markers hold the last usage written to a spawn.end, so a re-fired SubagentStop
# with unchanged usage writes nothing (deferral d-3091be1c). They live beside the pointer, outside any repo, so they are never
# committed and are cleared with the machine state, not the spec store.
export SDD_SPAWN_END_DIR="$(dirname "$POINTER")/spawn-ends"
printf '%s' "$IN" | node -e '
const fs = require("fs");
let d;
try { d = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
function num(x) { return typeof x === "number" && Number.isFinite(x) ? x : 0; }
// Design C4: the three cache fields for a spawn.end row, each a string. All three are
// "unknown" when any call lacks a numeric cache_creation.ephemeral_5m/1h; else the two
// sums, and gapRewrites counts calls (stably sorted by t) more than 300000 ms after the
// previous call whose cache_creation_input_tokens is above half its prefix; "unknown" when
// any call has no time. Each call is a { u, model, t } from the dedupe map.
function cacheFields(calls) {
  let w5 = 0, w1 = 0;
  for (const c of calls) {
    const cc = c.u.cache_creation;
    if (!cc || typeof cc !== "object" || !Number.isFinite(cc.ephemeral_5m_input_tokens) || !Number.isFinite(cc.ephemeral_1h_input_tokens)) {
      return { cacheWrite5m: "unknown", cacheWrite1h: "unknown", gapRewrites: "unknown" };
    }
    w5 += cc.ephemeral_5m_input_tokens; w1 += cc.ephemeral_1h_input_tokens;
  }
  let gap = "unknown";
  if (!calls.some((c) => c.t === null)) {
    const sorted = calls.slice().sort((a, b) => a.t - b.t);
    let n = 0;
    for (let i = 1; i < sorted.length; i++) {
      const pv = sorted[i - 1], cu = sorted[i];
      const prefix = num(pv.u.input_tokens) + num(pv.u.cache_creation_input_tokens) + num(pv.u.cache_read_input_tokens);
      if (cu.t - pv.t > 300000 && num(cu.u.cache_creation_input_tokens) > prefix / 2) n++;
    }
    gap = String(n);
  }
  return { cacheWrite5m: String(w5), cacheWrite1h: String(w1), gapRewrites: gap };
}
function readUsage(p) {
  let text; try { text = fs.readFileSync(String(p), "utf8"); } catch { return null; }
  // Dedupe by message.id: a multi-block assistant message writes one transcript line per
  // content block, every line repeating the same message.id and the same usage object, so
  // summing every line inflates the total about 2.5-3x (deferral d-3091be1c). Keep the last
  // usage/model seen for each id and the smallest finite timestamp over its lines; a line
  // with no id counts once on its own with its own time.
  const byId = new Map(); let auto = 0;
  for (const line of text.split("\n")) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    const u = e && e.type === "assistant" && e.message && e.message.usage;
    if (!u || typeof u !== "object") continue;
    const id = e.message.id;
    const key = typeof id === "string" && id ? id : "no-id-" + (auto++);
    const parsed = Date.parse(e.timestamp);
    let t = Number.isFinite(parsed) ? parsed : null;
    const prev = byId.get(key);
    if (prev && prev.t !== null && (t === null || prev.t < t)) t = prev.t;
    byId.set(key, { u: u, model: typeof e.message.model === "string" ? e.message.model : null, t: t });
  }
  if (byId.size === 0) return null;
  const s = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, models = [];
  for (const v of byId.values()) {
    s.input += num(v.u.input_tokens); s.output += num(v.u.output_tokens);
    s.cacheWrite += num(v.u.cache_creation_input_tokens); s.cacheRead += num(v.u.cache_read_input_tokens);
    if (v.model && !models.includes(v.model)) models.push(v.model);
  }
  const cf = cacheFields(Array.from(byId.values()));
  return { ...s, tokens: s.input + s.output + s.cacheWrite + s.cacheRead, model: models.join("+"),
    cacheWrite5m: cf.cacheWrite5m, cacheWrite1h: cf.cacheWrite1h, gapRewrites: cf.gapRewrites };
}
// A bounded synchronous wait, so the read below can let the transcript tail land.
function sleepMs(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* no shared memory: skip */ } }
function waitForTail(p) {
  // SubagentStop can fire tens of ms before the transcript last line is flushed, so the sum
  // would miss the final assistant line (deferral d-3091be1c). Wait, bounded, for the file
  // size to stop growing before reading it.
  let prev = -1;
  for (let i = 0; i < 6; i++) {
    let sz; try { sz = fs.statSync(String(p)).size; } catch { sz = -1; }
    if (sz === prev) return;
    prev = sz; sleepMs(60);
  }
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
  if (tp) waitForTail(tp);
  u = tp ? readUsage(tp) : null;
  if (u) e.tokens = u.tokens;
  // An orchestrator with background children yields, fires SubagentStop, resumes and makes
  // more calls, so SubagentStop fires several times per spawn. Each firing whose usage
  // differs from the last one written for this (run, session, agentId) writes a new
  // spawn.end carrying agentId; consumers keep the latest row per agentId, so the recorded
  // usage is the final total and nothing counts twice (deferral d-3091be1c). A re-fire with
  // unchanged usage writes nothing. The marker holds the last written usage.
  const markerDir = process.env.SDD_SPAWN_END_DIR;
  if (markerDir && d.agent_id) {
    const key = [process.env.SDD_RUN_ID || "", d.session_id || "", d.agent_id].join("__").replace(/[^\w.-]/g, "_");
    const marker = require("path").join(markerDir, key);
    const sig = u ? [u.input, u.output, u.cacheWrite, u.cacheRead].join("/") : "unknown";
    let last = null;
    try { last = fs.readFileSync(marker, "utf8"); } catch {}
    if (last === sig) process.exit(0);
    try { fs.mkdirSync(markerDir, { recursive: true }); fs.writeFileSync(marker, sig); } catch {}
  }
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
      row = { ts: e.ts, type: "spawn.end", run, spec, agent, input: String(u.input), output: String(u.output), cacheWrite: String(u.cacheWrite), cacheRead: String(u.cacheRead), tokens: String(u.tokens), cacheWrite5m: u.cacheWrite5m, cacheWrite1h: u.cacheWrite1h, gapRewrites: u.gapRewrites };
      if (u.model) row.model = u.model;
    } else {
      row = { ts: e.ts, type: "spawn.end", run, spec, agent, tokens: "unknown", cacheWrite5m: "unknown", cacheWrite1h: "unknown", gapRewrites: "unknown" };
    }
    if (d.agent_id) row.agentId = String(d.agent_id);
    fs.appendFileSync(eventsFile, JSON.stringify(row) + "\n");
  }
}
'
exit 0
