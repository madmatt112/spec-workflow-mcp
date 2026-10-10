#!/bin/bash
# Check 4: a systemd user service on WSL2 can run claude -p on the subscription login (no
# keychain, no API key). PASS = the transient unit exits 0 and the JSON result says ok.
source "$(dirname "$0")/common.sh"; start p4-service
if ! systemctl --user status >/dev/null 2>&1; then out "FAIL: systemd --user not available (enable systemd in /etc/wsl.conf and loginctl enable-linger $USER)"; exit 0; fi
systemd-run --user --wait --pipe --quiet --unit "proto-claude-$$" --setenv=HOME="$HOME" --setenv=PATH="$PATH" \
  bash -lc "unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN; claude -p 'reply with the single word ok' --model '$MODEL' --max-turns 1 --output-format json --no-session-persistence" > "$RESULTS/p4.json" 2>"$RESULTS/p4.err"; RC=$?
out "exit=$RC result=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("result"))' "$RESULTS/p4.json" 2>/dev/null) stderr=$(head -c 200 "$RESULTS/p4.err")"
[ "$RC" = 0 ] && grep -qi '"result": *"ok' "$RESULTS/p4.json" && out "PASS" || out "FAIL (if auth: run claude setup-token and export CLAUDE_CODE_OAUTH_TOKEN in the unit)"
