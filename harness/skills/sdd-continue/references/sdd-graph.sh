#!/bin/bash
# SDD code-graph probe — resolve the graph fact and run the refresh (design
# Component 1, C1, D1, D2, D3; requirements 1.1-1.4, 2.4-2.5, 2.7).
#
# usage: bash sdd-graph.sh fact CODE_ROOT MAIN_CHECKOUT
#        bash sdd-graph.sh refresh CODE_ROOT [TIMEOUT_S]
# Called by the sdd-continue supervisor and the phase orchestrators. Both modes
# print to stdout and exit 0 in every case, so the probe never stops a run.
#
# fact prints exactly three lines:
#   GRAPH: <MAIN_CHECKOUT>/graphify-out/graph.json | none
#   GRAPH_BEHIND: <n> | unknown | n/a
#   GRAPH_BUILT_AT: <sha> | unknown | n/a
# GRAPH is none, and both freshness lines n/a, when the graph file is missing or
# command -v graphify fails. Otherwise node reads the top-level built_at_commit
# string, sets GRAPH_BEHIND to the stdout of git -C CODE_ROOT rev-list --count
# SHA..HEAD and GRAPH_BUILT_AT to that sha; a missing or empty key, a JSON parse
# error, or a non-zero git exit sets both freshness lines to unknown.
#
# refresh runs graphify update CODE_ROOT through node spawnSync with stdio
# ignore, a timeout of TIMEOUT_S times 1000 (default 100) and a copy of the
# environment without GRAPHIFY_FORCE, so it never forces the rebuild. On exit 0
# it prints refresh: ok, GRAPH_BEHIND: 0 and GRAPH_BUILT_AT: the HEAD sha
# (unknown when git fails); otherwise one line, first match wins:
# refresh: failed timeout Ns, refresh: failed CODE, refresh: failed exit N,
# refresh: failed signal SIG. It never passes --force.
#
# The node bodies are single-quoted strings with no apostrophes, the same shape
# as harness/skills/sdd-continue/references/sdd-cache-ttl.sh:1-22. The shell part
# reads every optional value as ${VAR:-} so it is safe under set -u.
set -u

mode="${1:-}"

if [ "$mode" = "fact" ]; then
  code_root="${2:-}"
  main_checkout="${3:-}"
  if [ ! -f "${main_checkout}/graphify-out/graph.json" ] || ! command -v graphify >/dev/null 2>&1; then
    echo "GRAPH: none"
    echo "GRAPH_BEHIND: n/a"
    echo "GRAPH_BUILT_AT: n/a"
    exit 0
  fi
  CODE_ROOT="${code_root}" MAIN_CHECKOUT="${main_checkout}" node -e '
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const codeRoot = process.env.CODE_ROOT;
const file = path.join(process.env.MAIN_CHECKOUT, "graphify-out", "graph.json");

function out(behind, builtAt) {
  process.stdout.write("GRAPH: " + file + "\n");
  process.stdout.write("GRAPH_BEHIND: " + behind + "\n");
  process.stdout.write("GRAPH_BUILT_AT: " + builtAt + "\n");
  process.exit(0);
}

let sha;
try {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  sha = data && data.built_at_commit;
} catch (e) { out("unknown", "unknown"); }
if (!sha || typeof sha !== "string") out("unknown", "unknown");

let behind;
try {
  behind = execFileSync("git", ["-C", codeRoot, "rev-list", "--count", sha + "..HEAD"], { encoding: "utf8" }).trim();
} catch (e) { out("unknown", "unknown"); }
out(behind, sha);
'
  exit 0
fi

if [ "$mode" = "refresh" ]; then
  code_root="${2:-}"
  timeout_s="${3:-}"
  CODE_ROOT="${code_root}" TIMEOUT_S="${timeout_s}" node -e '
const { spawnSync, execFileSync } = require("child_process");

const codeRoot = process.env.CODE_ROOT;
const timeoutS = Number(process.env.TIMEOUT_S) || 100;

const env = Object.assign({}, process.env);
delete env.GRAPHIFY_FORCE;

function line(s) { process.stdout.write(s + "\n"); process.exit(0); }

const r = spawnSync("graphify", ["update", codeRoot], { stdio: "ignore", timeout: timeoutS * 1000, env: env });

if (r.status === 0) {
  let head;
  try { head = execFileSync("git", ["-C", codeRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch (e) { head = "unknown"; }
  process.stdout.write("refresh: ok\n");
  process.stdout.write("GRAPH_BEHIND: 0\n");
  process.stdout.write("GRAPH_BUILT_AT: " + head + "\n");
  process.exit(0);
}

if (r.error && r.error.code === "ETIMEDOUT") line("refresh: failed timeout " + timeoutS + "s");
if (r.error) line("refresh: failed " + r.error.code);
if (r.status !== null) line("refresh: failed exit " + r.status);
line("refresh: failed signal " + r.signal);
'
  exit 0
fi

exit 0
