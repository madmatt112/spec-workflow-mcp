#!/bin/bash
# Run the SDD harness from this checkout instead of an installed plugin.
#
# Symlinks harness/agents/*.md into ~/.claude/agents/ and harness/skills/* into
# ~/.claude/skills/. Idempotent: run it again after adding or removing an agent or a
# skill; a link whose target this checkout no longer has is removed. It never removes
# anything it did not create and never touches the MCP configuration; set each
# project's .mcp.json to
#   "command": "node", "args": ["<this checkout>/dist/index.js", ...]
# yourself, and build with `npm run build`.
#
# The activity hook (harness/hooks/sdd-activity.sh) went with step (d) of the foundation
# rework: the controller writes the ledger itself. Any entry an earlier run of this script
# put in ~/.claude/settings.json is removed on every run, link or unlink.
#
# Usage: scripts/dev-link.sh            link (or re-link) everything
#        scripts/dev-link.sh --unlink   remove the symlinks
#
# Uninstall any harness plugin at every scope first, or the agents appear twice.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
OLD_HOOK_CMD="bash $REPO/harness/hooks/sdd-activity.sh"
MODE="${1:-link}"

[ -d "$REPO/harness/agents" ] || { echo "not a spec-workflow-mcp checkout: $REPO" >&2; exit 1; }
mkdir -p "$CLAUDE_DIR/agents" "$CLAUDE_DIR/skills"

link_one() { # <target> <link>
  if [ -e "$2" ] && [ ! -L "$2" ]; then echo "skip (exists, not a symlink): $2"; return; fi
  ln -sfn "$1" "$2"; echo "linked: $2 -> $1"
}
unlink_one() { # <link> <expected target prefix>
  if [ -L "$1" ] && [[ "$(readlink "$1")" == "$2"* ]]; then rm "$1"; echo "removed: $1"; fi
}
prune_dangling() { # <expected target prefix> <link>...: links into this checkout whose target is gone
  local prefix="$1"; shift
  for l in "$@"; do
    [ -L "$l" ] || continue
    [[ "$(readlink "$l")" == "$prefix"* ]] || continue
    [ -e "$l" ] || { rm "$l"; echo "pruned (target gone): $l"; }
  done
}

case "$MODE" in
  link|--link)
    for f in "$REPO"/harness/agents/*.md; do link_one "$f" "$CLAUDE_DIR/agents/$(basename "$f")"; done
    for d in "$REPO"/harness/skills/*/; do d="${d%/}"; link_one "$d" "$CLAUDE_DIR/skills/$(basename "$d")"; done
    prune_dangling "$REPO/harness/agents/" "$CLAUDE_DIR"/agents/sdd-*.md
    prune_dangling "$REPO/harness/skills/" "$CLAUDE_DIR"/skills/sdd-*
    ;;
  --unlink)
    for f in "$CLAUDE_DIR"/agents/sdd-*.md; do [ -L "$f" ] || continue; unlink_one "$f" "$REPO/harness/agents/"; done
    for d in "$CLAUDE_DIR"/skills/sdd-*; do [ -L "$d" ] || continue; unlink_one "$d" "$REPO/harness/skills/"; done
    ;;
  *) echo "usage: $0 [--unlink]" >&2; exit 2 ;;
esac

# Remove the retired hook's entries from settings.json, if an earlier run left them (a
# JSON edit; other keys are preserved).
if [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.bak"
  node - "$SETTINGS" "$OLD_HOOK_CMD" <<'EOF'
const fs = require("fs");
const [file, cmd] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(file, "utf8"));
const hooks = s.hooks || {};
let removed = 0;
for (const ev of Object.keys(hooks)) {
  const before = hooks[ev].length;
  hooks[ev] = hooks[ev].filter((h) => !(h.hooks || []).some((x) => x.command === cmd));
  removed += before - hooks[ev].length;
  if (hooks[ev].length === 0) delete hooks[ev];
}
if (removed > 0) {
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
  console.log("removed " + removed + " retired hook entr" + (removed === 1 ? "y" : "ies") + " from " + file + " (backup: " + file + ".bak)");
}
EOF
fi

echo
echo "Sessions read agents and skills at startup: restart them."
echo "MCP: each project's .mcp.json should run  node $REPO/dist/index.js  (npm run build first)."
