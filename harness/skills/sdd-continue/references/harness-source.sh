#!/bin/bash
# Where does the harness run from?
# Prints two lines:
#   source: <checkout> | none
#   drift: yes | no | unknown
# Used by the sdd-continue supervisor's preflight. Safe to run anywhere; never fails.
#
# Linked from a checkout: this file is <repo>/harness/skills/sdd-continue/references/
# harness-source.sh (possibly reached through a symlink under ~/.claude/skills), so
# source is <repo> and there is nothing to drift.
HERE=$(cd "$(dirname "$0")" && pwd -P)
PLUGIN_ROOT=$(cd "$HERE/../../.." && pwd -P)
if [ "$(basename "$PLUGIN_ROOT")" = "harness" ] && [ -d "$PLUGIN_ROOT/agents" ] && [ -f "$PLUGIN_ROOT/../package.json" ]; then
  echo "source: $(cd "$PLUGIN_ROOT/.." && pwd -P)"
  echo "drift: no"
  exit 0
fi
echo "source: none"
echo "drift: unknown"
exit 0
