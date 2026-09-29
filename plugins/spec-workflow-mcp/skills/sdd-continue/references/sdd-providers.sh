#!/bin/bash
# SDD provider map validator — parse and validate the `## Providers` section of
# agent-rules.md before the run ledger exists (design Component 1, D1, D17).
#
# usage: bash sdd-providers.sh AGENT_RULES_PATH [RUN_FILE]  (the path may be `none`)
# Called by the sdd-continue supervisor at the roots step. On success it prints
# one line `providers=VALUE` on stdout and exits 0; a refusal exits 2 or 3 with
# one `providers: REASON` line on stderr and no stdout, so it leaves no ledger
# row and is deterministic and testable like the activity hook. It reads only
# the rules file, the optional run file and the environment and never prints
# DEEPSEEK_API_KEY.
#
# With the optional second argument the run file (a harness-run.json) can add or
# flip roles: the per-row checks run once over the union of the parsed rows and
# the eligible-or-deepseek run-file roles, so a role the run file introduces is
# validated by the same preflight rules (design C9, Req 2 crit 4 and 6).
#
# ELIGIBLE is the one shell variable that names the roles a map may route to a
# non-Anthropic provider (design D17). sdd-reviser is listed because preflight
# (b) passed: docs/deepseek-preflight.md records the reviser MCP call as answered
# and the reviser as eligible (Req 6 crit 4).
#
# The parse and validation is a node -e body in a single-quoted string with no
# apostrophes, the same way harness/hooks/sdd-activity.sh:32-35 does. It reads
# AGENT_RULES_PATH as argv[1], the optional RUN_FILE as argv[2] and ELIGIBLE and
# DEEPSEEK_API_KEY from the environment, and sets the exit code and the one
# output line.
set -u

ELIGIBLE="sdd-reviewer sdd-checker sdd-reviser"

ELIGIBLE="$ELIGIBLE" node -e '
const fs = require("fs");
const eligible = String(process.env.ELIGIBLE || "").split(/\s+/).filter(Boolean);
const providersAllowed = ["anthropic", "deepseek"];
const modelsAllowed = ["deepseek-v4-pro", "deepseek-flash"];
const argPath = process.argv[1];
const runPath = process.argv[2];
const hasRun = !!(runPath && runPath.length);
function none() { process.stdout.write("providers=none\n"); process.exit(0); }
function bad(reason) { process.stderr.write("providers: " + reason + "\n"); process.exit(2); }

const rows = [];
const seen = {};
function check(agent, provider, model) {
  if (eligible.indexOf(agent) < 0) bad(agent + " is not an eligible agent");
  if (providersAllowed.indexOf(provider) < 0) bad(agent + ": unknown provider " + provider);
  if (provider === "deepseek") {
    if (!model) bad(agent + ": deepseek needs a model");
    if (modelsAllowed.indexOf(model) < 0) bad(agent + ": unknown model " + model);
  } else if (model) {
    bad(agent + ": anthropic takes no model");
  }
  if (seen[agent]) bad("duplicate agent " + agent);
  seen[agent] = true;
  rows.push({ agent: agent, provider: provider, model: model });
}

let runRoles = {};
if (hasRun) {
  let runText;
  try { runText = fs.readFileSync(runPath, "utf8"); } catch (e) { bad("bad run file"); }
  let parsed;
  try { parsed = JSON.parse(runText); } catch (e) { bad("bad run file"); }
  runRoles = (parsed && parsed.roles) || {};
}

const rulesRows = [];
if (!argPath || argPath === "none") {
  if (!hasRun) none();
} else {
  let text;
  let readable = true;
  try { text = fs.readFileSync(argPath, "utf8"); } catch (e) { readable = false; }
  if (!readable) {
    if (!hasRun) none();
  } else {
    const lines = text.split(/\r?\n/);
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^##\s+Providers\s*$/.test(lines[i])) { idx = i + 1; break; }
    }
    if (idx < 0) {
      if (!hasRun) none();
    } else {
      const grammar = /^- ([^:\s]+): (\S+)(?: (\S+))?$/;
      for (let i = idx; i < lines.length; i++) {
        const raw = lines[i];
        if (/^##\s/.test(raw)) break;
        const t = raw.trim();
        if (t === "") continue;
        if (t[0] !== "-") continue;
        const m = grammar.exec(t);
        if (!m) bad("bad row: " + t);
        const agent = m[1], provider = m[2], model = m[3];
        if (!hasRun) check(agent, provider, model);
        else rulesRows.push({ agent: agent, provider: provider, model: model });
      }
    }
  }
}

if (!hasRun) {
  if (rows.length === 0) none();
} else {
  const union = [];
  const at = {};
  for (let i = 0; i < rulesRows.length; i++) {
    const r = rulesRows[i];
    at[r.agent] = union.length;
    union.push({ agent: r.agent, provider: r.provider, model: r.model });
  }
  const agents = Object.keys(runRoles);
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const spec = runRoles[agent] || {};
    const provider = spec.provider;
    const model = provider === "deepseek" ? spec.model : undefined;
    if (eligible.indexOf(agent) < 0 && provider !== "deepseek") continue;
    const row = { agent: agent, provider: provider, model: model };
    if (Object.prototype.hasOwnProperty.call(at, agent)) union[at[agent]] = row;
    else { at[agent] = union.length; union.push(row); }
  }
  for (let i = 0; i < union.length; i++) check(union[i].agent, union[i].provider, union[i].model);
  if (rows.length === 0) none();
}

const deepseekRows = rows.filter(function (r) { return r.provider === "deepseek"; });
if (deepseekRows.length && !process.env.DEEPSEEK_API_KEY) {
  process.stderr.write("providers: DEEPSEEK_API_KEY unset; " + deepseekRows[0].agent + " runs on deepseek\n");
  process.exit(3);
}
const value = rows.map(function (r) {
  return r.provider === "deepseek" ? r.agent + ":deepseek:" + r.model : r.agent + ":" + r.provider;
}).join(",");
process.stdout.write("providers=" + value + "\n");
process.exit(0);
' "${1:-}" "${2:-}"
