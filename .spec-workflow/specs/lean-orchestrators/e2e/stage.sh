#!/usr/bin/env bash
# Stage the lean-orchestrators end-to-end fixture kit in a scratch code root.
#
# Builds a throwaway ES-module code root that is its own git repo, a spec store
# inside it holding the `lean-fixture` decomposition (from the two fixture-*.md
# documents beside this script) and its agent rules, and a `.mcp.json` that runs
# the built server of this checkout. The store ships NO `specs/` folder: the live
# run's `spec-index generate` creates an empty one, so routing is `no-specs` and
# falls through to the decomposition, and `lean-fixture` starts at requirements
# (sdd-continue step 2).
#
# The kit writes NO event script (design D8): the supervisor writes the live
# run's own `event.sh` under /tmp/scratchpad when it starts the run.
#
# Every optional input is read as ${VAR:-default} so `set -u` never trips:
#   E2E_ROOT    scratch build root       (default /tmp/scratchpad/sdd/lean-orchestrators/e2e/scratch)
#   SWM_DIST    built server dist dir    (default /home/mcf/repo/spec-workflow-mcp/dist)
#   FIXTURE_DIR dir holding fixture-*.md (default: this script's own directory)
#
# The dry run and the live scenario override SWM_DIST and E2E_ROOT to point at
# the checkout under test.
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
E2E_ROOT="${E2E_ROOT:-/tmp/scratchpad/sdd/lean-orchestrators/e2e/scratch}"
SWM_DIST="${SWM_DIST:-/home/mcf/repo/spec-workflow-mcp/dist}"
FIXTURE_DIR="${FIXTURE_DIR:-$SCRIPT_DIR}"

CODE_ROOT="$E2E_ROOT/lean-fixture-code"
STORE="$CODE_ROOT/.spec-workflow"
DECOMP_DIR="$STORE/spec-decomposition"
GIT="/usr/bin/git"

# Fresh scratch tree every run. No specs/ folder is created.
rm -rf "$CODE_ROOT"
mkdir -p "$DECOMP_DIR" "$CODE_ROOT/src"

# --- Code root: a small ES-module git repo with a README.
cat > "$CODE_ROOT/package.json" <<'JSON'
{
  "name": "lean-fixture-code",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
JSON

cat > "$CODE_ROOT/src/strings.js" <<'JS'
// Small string helpers for the lean-fixture end-to-end spec. The six functions
// the `lean-fixture` decomposition names are added here by the fixture run.
export const LIB = 'lean-fixture strings';
JS

cat > "$CODE_ROOT/README.md" <<'MD'
# lean-fixture-code

A throwaway code root for the lean-orchestrators end-to-end scenario
(Requirement 8). It ships one small ES module, `src/strings.js`; the
`lean-fixture` spec adds six small string helpers to it.

This repo has NO git remote on purpose: it is a local `git init` with no
`origin`. A run against it records `remote=no` at `run.start` and leaves the
one-PR criterion `pending` by design — there is nowhere to push, so the kit
cannot exercise that gate.
MD

# --- Spec store: agent rules and the decomposition, under their routable names.
# No specs/ folder is written here: the server's spec-index generate creates an
# empty one at live-run time, so routing is `no-specs` and falls through to the
# decomposition (sdd-continue step 2).
cp "$FIXTURE_DIR/fixture-agent-rules.md" "$STORE/agent-rules.md"
cp "$FIXTURE_DIR/fixture-decomposition.md" "$DECOMP_DIR/decomposition.md"

# --- .mcp.json runs the built server of this checkout against the code root.
# This file lives only in the throwaway code root, never in the tracked store.
cat > "$CODE_ROOT/.mcp.json" <<JSON
{
  "mcpServers": {
    "spec-workflow": {
      "type": "stdio",
      "command": "node",
      "args": ["$SWM_DIST/index.js", "$CODE_ROOT"],
      "env": {}
    }
  }
}
JSON

# --- Commit the base: the code root is its own clean git repo.
cd "$CODE_ROOT"
"$GIT" init -q
"$GIT" config user.email "fixture@example.com"
"$GIT" config user.name "lean fixture"
"$GIT" add -A
"$GIT" -c commit.gpgsign=false commit -q -m "base: lean-fixture scratch store"

echo "staged lean-fixture at $CODE_ROOT"
