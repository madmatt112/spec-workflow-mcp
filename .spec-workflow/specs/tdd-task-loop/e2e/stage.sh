#!/usr/bin/env bash
# Stage the tdd-task-loop end-to-end fixture kit in a scratch code root.
#
# Builds a throwaway ES-module code root that is its own git repo, a spec store
# inside it holding the `tdd-fixture` spec (from the three fixture-*.md documents
# beside this script), a `.mcp.json` that runs the built server of this checkout,
# and the store's own event script. All three fixture documents are approved
# through the built server's approvals handler — never by hand-written records.
#
# Every optional input is read as ${VAR:-default} so `set -u` never trips:
#   E2E_ROOT   scratch build root         (default /tmp/scratchpad/sdd/tdd-task-loop/e2e/scratch)
#   SWM_DIST   built server dist dir       (default /home/mcf/repo/spec-workflow-mcp/dist)
#   FIXTURE_DIR  dir holding fixture-*.md  (default: this script's own directory)
#
# The dry run and the live scenario override SWM_DIST and E2E_ROOT to point at
# the checkout under test.
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
E2E_ROOT="${E2E_ROOT:-/tmp/scratchpad/sdd/tdd-task-loop/e2e/scratch}"
SWM_DIST="${SWM_DIST:-/home/mcf/repo/spec-workflow-mcp/dist}"
FIXTURE_DIR="${FIXTURE_DIR:-$SCRIPT_DIR}"

CODE_ROOT="$E2E_ROOT/tdd-fixture-code"
STORE="$CODE_ROOT/.spec-workflow"
SPEC_DIR="$STORE/specs/tdd-fixture"
GIT="/usr/bin/git"

# Fresh scratch tree every run.
rm -rf "$CODE_ROOT"
mkdir -p "$SPEC_DIR" "$CODE_ROOT/src/__tests__"

# --- Code root: an ES-module git repo with the clamp helper that already exists.
cat > "$CODE_ROOT/package.json" <<'JSON'
{
  "name": "tdd-fixture-code",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
JSON

cat > "$CODE_ROOT/src/clamp.js" <<'JS'
// clampPercent already clamps values over 100 to 100 at the base, so task 3's
// test passes on the base and the author must report RED-IMPOSSIBLE.
export function clampPercent(n) {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
JS

# toPercentLabel exists at the base only as a stub with the wrong behaviour, so
# task 1's test imports fine and fails on an assertion (assertion-red), not on
# a missing module (structural-red).
cat > "$CODE_ROOT/src/labels.js" <<'JS'
// Stub: task 1 replaces this with the real percent label.
export function toPercentLabel(fraction) {
  return String(fraction);
}
JS

cat > "$CODE_ROOT/README.md" <<'MD'
# tdd-fixture-code

A throwaway code root for the tdd-task-loop end-to-end scenario. It ships one
helper, `clampPercent`, in `src/clamp.js`.
MD

# --- Spec store: agent rules carry the node --test command for the loop.
cat > "$STORE/agent-rules.md" <<'MD'
# Agent rules — tdd-fixture

worktree-per-change: not required
tdd-test-command: node --test {files}

## Checks

- Any change under `src/`: `node --test`.
MD

# Fixture spec documents: fixture-*.md become the routable requirements/design/tasks.
cp "$FIXTURE_DIR/fixture-requirements.md" "$SPEC_DIR/requirements.md"
cp "$FIXTURE_DIR/fixture-design.md" "$SPEC_DIR/design.md"
cp "$FIXTURE_DIR/fixture-tasks.md" "$SPEC_DIR/tasks.md"

# --- .mcp.json runs the built server of this checkout against the code root.
# The env is empty here; an operator adds TYPESAFE_API_KEY for the judge half.
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

# --- The store's own event script. It never reuses the supervisor's
# EVENT_SCRIPT path; its ledger is the fixture spec's own harness-events.jsonl.
cat > "$STORE/event.sh" <<EVSH
#!/bin/bash
# usage: bash event.sh <type> key=value ...   (values may contain spaces; quote them)
export SDD_LEDGER="$SPEC_DIR/harness-events.jsonl"
export SDD_RUN="run-tdd-fixture"
export SDD_SPEC="tdd-fixture"
node -e '
const [type, ...kv] = process.argv.slice(1);
const e = { ts: new Date().toISOString(), run: process.env.SDD_RUN, spec: process.env.SDD_SPEC, type };
for (const a of kv) { const i = a.indexOf("="); if (i > 0) e[a.slice(0, i)] = a.slice(i + 1); }
require("fs").appendFileSync(process.env.SDD_LEDGER, JSON.stringify(e) + "\n");
process.stdout.write("event: " + type + " recorded\n");
' "\$@"
EVSH
chmod +x "$STORE/event.sh"

# --- Approve all three documents through the built server's approvals handler.
APPROVE_JS="$E2E_ROOT/approve.mjs"
cat > "$APPROVE_JS" <<'MJS'
const dist = process.env.SWM_DIST;
const codeRoot = process.env.CODE_ROOT;
const { approvalsHandler } = await import(`${dist}/tools/approvals.js`);
const ctx = { projectPath: codeRoot, workspacePath: codeRoot };
for (const doc of ['requirements', 'design', 'tasks']) {
  const req = await approvalsHandler({
    action: 'request',
    title: `${doc} — tdd-fixture`,
    filePath: `.spec-workflow/specs/tdd-fixture/${doc}.md`,
    type: 'document',
    category: 'spec',
    categoryName: 'tdd-fixture',
  }, ctx);
  if (!req.success) { console.error(`request ${doc} failed: ${req.message}`); process.exit(1); }
  const dec = await approvalsHandler({ action: 'approve', approvalId: req.data.approvalId }, ctx);
  if (!dec.success) { console.error(`approve ${doc} failed: ${dec.message}`); process.exit(1); }
}
console.log('approved 3 documents');
MJS
SWM_DIST="$SWM_DIST" CODE_ROOT="$CODE_ROOT" node "$APPROVE_JS"

# --- Commit the base: clamp.js exists, toPercentLabel is a stub, docs approved.
cd "$CODE_ROOT"
"$GIT" init -q
"$GIT" config user.email "fixture@example.com"
"$GIT" config user.name "tdd fixture"
"$GIT" add -A
"$GIT" -c commit.gpgsign=false commit -q -m "base: tdd-fixture scratch store"

echo "staged tdd-fixture at $CODE_ROOT"
