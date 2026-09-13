#!/bin/bash
# Where did the installed plugin come from, and does it still match that source?
# Prints two lines:
#   source: <local marketplace checkout> | none
#   drift: yes | no | unknown
# Used by the sdd-continue supervisor's preflight. Safe to run anywhere; never fails.
HERE=$(cd "$(dirname "$0")" && pwd)
PLUGIN_ROOT=$(cd "$HERE/../../.." && pwd)
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
