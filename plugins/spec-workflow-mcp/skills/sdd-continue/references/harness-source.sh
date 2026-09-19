#!/bin/bash
# Where does the harness run from, and does an installed plugin still match its source?
# Prints two lines:
#   source: <checkout> | none
#   drift: yes | no | unknown
# Used by the sdd-continue supervisor's preflight. Safe to run anywhere; never fails.
#
# Two layouts. Linked from a checkout: this file is <repo>/harness/skills/sdd-continue/
# references/harness-source.sh (possibly reached through a symlink under ~/.claude/skills),
# so source is <repo> and there is nothing to drift. Installed as a plugin: this file is
# <plugin root>/skills/sdd-continue/references/harness-source.sh and source is the local
# directory marketplace the plugin was installed from, if any.
HERE=$(cd "$(dirname "$0")" && pwd -P)
PLUGIN_ROOT=$(cd "$HERE/../../.." && pwd -P)
if [ "$(basename "$PLUGIN_ROOT")" = "harness" ] && [ -d "$PLUGIN_ROOT/agents" ] && [ -f "$PLUGIN_ROOT/../package.json" ]; then
  echo "source: $(cd "$PLUGIN_ROOT/.." && pwd -P)"
  echo "drift: no"
  exit 0
fi
MANIFEST="$PLUGIN_ROOT/.claude-plugin/plugin.json"
KNOWN="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/known_marketplaces.json"
if [ ! -f "$MANIFEST" ] || [ ! -f "$KNOWN" ]; then echo "source: none"; echo "drift: unknown"; exit 0; fi
NAME=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).name || "")' "$MANIFEST" 2>/dev/null)
SRC=$(node -e '
const fs = require("fs"), path = require("path");
const [name, knownPath] = process.argv.slice(1);
let known = {};
try { known = JSON.parse(fs.readFileSync(knownPath, "utf8")); } catch { console.log("none"); process.exit(0); }
for (const m of Object.values(known)) {
  const src = m && m.source;
  if (!src || src.source !== "directory" || !src.path) continue;
  if (fs.existsSync(path.join(src.path, "plugins", name, ".claude-plugin", "plugin.json"))) { console.log(src.path); process.exit(0); }
}
console.log("none");
' "$NAME" "$KNOWN" 2>/dev/null || echo none)
echo "source: $SRC"
if [ "$SRC" = "none" ] || [ -z "$NAME" ]; then echo "drift: unknown"; exit 0; fi
if diff -rq "$SRC/plugins/$NAME" "$PLUGIN_ROOT" >/dev/null 2>&1; then echo "drift: no"; else echo "drift: yes"; fi
exit 0
