#!/bin/bash
# SDD run-setup reader — turn a saved harness-run.json into the supervisor values
# for one run, before the run ledger exists (design C9, D9, D10; Requirement 2
# criteria 1, 2, 3, 4, 6, 9, 11).
#
# usage: bash sdd-run-setup.sh SPEC_STORE_ROOT ACTIVE_SPEC AGENT_RULES_PATH
# The run file is SPEC_STORE_ROOT/harness-run.json. Called by the sdd-continue
# supervisor after it derives the active spec. On success it prints key=value
# lines the supervisor reads, one per line, on stdout and exits 0; with no file
# it prints setup=none and with a file for another spec it prints setup=mismatch,
# both exit 0 and leave the file. A refusal exits 2 or 3 with one setup: REASON
# line on stderr and no stdout, and deletes the run file so an invalid file does
# not re-refuse every future run of the spec (Req 2 crit 6). It leaves no ledger
# row and is deterministic and testable like sdd-providers.sh. It reads only the
# run file, the rules file (through sdd-providers.sh) and the environment, never
# prints DEEPSEEK_API_KEY, and writes nothing but the deletion.
#
# When the file applies it runs the sibling sdd-providers.sh in its task 14 mode
# (bash sdd-providers.sh AGENT_RULES_PATH RUN_FILE) to validate and print the
# merged provider map, and passes that scripts exit code and stderr through on a
# failure (design C9, Req 2 crit 4 and 6). The file supervisorModel is never
# printed, because a terminal supervisor cannot switch its own model (design D9).
#
# The parse, validation and printing is a node -e body in a single-quoted string
# with no apostrophes, the same way harness/hooks/sdd-activity.sh does. It reads
# SPEC_STORE_ROOT as argv[1], ACTIVE_SPEC as argv[2], AGENT_RULES_PATH as argv[3]
# and SETUP_DIR (this scripts directory) from the environment, and sets the exit
# code and the output lines.
set -u

SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SETUP_DIR="$SETUP_DIR" node -e '
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const storeRoot = process.argv[1] || "";
const active = process.argv[2] || "";
const rules = process.argv[3] || "";
const dir = String(process.env.SETUP_DIR || "");
const runFile = path.join(storeRoot, "harness-run.json");
const aliases = ["opus", "sonnet", "fable"];
const deepseekModels = ["deepseek-v4-pro", "deepseek-flash"];

function del() { try { fs.unlinkSync(runFile); } catch (e) {} }
function refuse(reason) { del(); process.stderr.write("setup: " + reason + "\n"); process.exit(2); }

if (!fs.existsSync(runFile)) { process.stdout.write("setup=none\n"); process.exit(0); }

let text;
try { text = fs.readFileSync(runFile, "utf8"); } catch (e) { refuse("bad run file"); }
let file;
try { file = JSON.parse(text); } catch (e) { refuse("bad run file"); }
if (!file || typeof file !== "object") refuse("bad run file");

if (file.spec !== active) {
  process.stdout.write("setup=mismatch file=" + file.spec + " active=" + active + "\n");
  process.exit(0);
}

const required = ["spec", "writtenAt", "supervisorModel", "worktree", "gates", "roles"];
for (let i = 0; i < required.length; i++) {
  if (!Object.prototype.hasOwnProperty.call(file, required[i])) refuse("missing key " + required[i]);
}
if (file.worktree !== "yes" && file.worktree !== "no") refuse("worktree " + file.worktree);
if (file.gates !== "block" && file.gates !== "record") refuse("gates " + file.gates);

const roles = file.roles || {};
if (typeof roles !== "object") refuse("bad roles");
const agents = Object.keys(roles);
for (let i = 0; i < agents.length; i++) {
  const agent = agents[i];
  const cfg = roles[agent] || {};
  const provider = cfg.provider;
  const model = cfg.model;
  if (provider === "anthropic") {
    if (aliases.indexOf(model) < 0 && !/^claude-/.test(String(model))) refuse(agent + ": " + model + " is not an anthropic model");
  } else if (provider === "deepseek") {
    if (deepseekModels.indexOf(model) < 0) refuse(agent + ": " + model + " is not a deepseek model");
  } else {
    refuse(agent + ": unknown provider " + provider);
  }
}

let providersLine;
try {
  const out = cp.execFileSync("bash", [path.join(dir, "sdd-providers.sh"), rules, runFile], { encoding: "utf8" });
  providersLine = out.replace(/\n+$/, "");
} catch (e) {
  del();
  if (e.stderr) process.stderr.write(String(e.stderr));
  process.exit(typeof e.status === "number" ? e.status : 1);
}

const orch = [];
const workers = [];
const overrides = [];
for (let i = 0; i < agents.length; i++) {
  const agent = agents[i];
  const cfg = roles[agent] || {};
  overrides.push(agent + ":" + cfg.model + ":" + cfg.provider);
  if (agent.endsWith("-orchestrator")) orch.push(agent + "=" + cfg.model);
  else if (cfg.provider === "anthropic") workers.push(agent + "=" + cfg.model);
}

const lines = [];
lines.push("setup=applied");
lines.push("written=" + file.writtenAt);
lines.push("gates=" + file.gates);
lines.push("worktree=" + file.worktree);
lines.push("orchestrators=" + (orch.length ? orch.join(",") : "none"));
lines.push("workers=" + (workers.length ? workers.join(",") : "none"));
lines.push(providersLine);
lines.push("overrides=" + overrides.join(","));
process.stdout.write(lines.join("\n") + "\n");
process.exit(0);
' "${1:-}" "${2:-}" "${3:-}"
