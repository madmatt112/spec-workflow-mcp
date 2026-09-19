#!/bin/bash
# Run the SDD harness from this checkout instead of an installed plugin.
#
# Symlinks harness/agents/*.md into ~/.claude/agents/, harness/skills/* into
# ~/.claude/skills/, and registers harness/hooks/sdd-activity.sh as the PreToolUse,
# SubagentStart and SubagentStop hook in ~/.claude/settings.json. Idempotent: run it
# again after adding an agent or a skill. It never removes anything it did not create
# and never touches the MCP configuration; set each project's .mcp.json to
#   "command": "node", "args": ["<this checkout>/dist/index.js", ...]
# yourself, and build with `npm run build`.
#
# Usage: scripts/dev-link.sh            link (or re-link) everything
#        scripts/dev-link.sh --unlink   remove the symlinks and the hook entries
#
# Uninstall any harness plugin at every scope first, or the agents appear twice.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
HOOK_CMD="bash $REPO/harness/hooks/sdd-activity.sh"
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

case "$MODE" in
  link|--link)
    for f in "$REPO"/harness/agents/*.md; do link_one "$f" "$CLAUDE_DIR/agents/$(basename "$f")"; done
    for d in "$REPO"/harness/skills/*/; do d="${d%/}"; link_one "$d" "$CLAUDE_DIR/skills/$(basename "$d")"; done
    ;;
  --unlink)
    for f in "$CLAUDE_DIR"/agents/sdd-*.md; do [ -e "$f" ] || continue; unlink_one "$f" "$REPO/harness/agents/"; done
    for d in "$CLAUDE_DIR"/skills/sdd-*; do [ -e "$d" ] || continue; unlink_one "$d" "$REPO/harness/skills/"; done
    ;;
  *) echo "usage: $0 [--unlink]" >&2; exit 2 ;;
esac

# Hook entries in settings.json (a JSON edit; other keys are preserved).
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak"
node - "$SETTINGS" "$HOOK_CMD" "$MODE" <<'EOF'
const fs = require("fs");
const [file, cmd, mode] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(file, "utf8"));
const hooks = (s.hooks = s.hooks || {});
const isOurs = (h) => (h.hooks || []).some((x) => x.command === cmd);
const entry = (matcher) => ({ ...(matcher ? { matcher } : {}), hooks: [{ type: "command", command: cmd, timeout: 5 }] });
for (const [ev, matcher] of [["PreToolUse", "*"], ["SubagentStart", null], ["SubagentStop", null]]) {
  const arr = (hooks[ev] = (hooks[ev] || []).filter((h) => !isOurs(h)));
  if (mode !== "--unlink") arr.push(entry(matcher));
  if (arr.length === 0) delete hooks[ev];
}
fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
console.log((mode === "--unlink" ? "hook entries removed from " : "hook entries set in ") + file + " (backup: " + file + ".bak)");
EOF

echo
echo "Sessions read agents, skills and hooks at startup: restart them."
echo "MCP: each project's .mcp.json should run  node $REPO/dist/index.js  (npm run build first)."
