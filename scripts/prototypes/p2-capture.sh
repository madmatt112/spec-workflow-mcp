#!/bin/bash
# Check 2: the exact error shape of a -p run on a subscription usage limit. This cannot be
# forced; use this wrapper for any -p call when the usage window is nearly spent, and keep the
# output. PASS = we have one captured example with exit code, is_error, subtype and result text.
#   bash p2-capture.sh "<prompt>"
source "$(dirname "$0")/common.sh"; start p2-capture
claude -p "${1:-reply with the single word ok}" --model "$MODEL" --max-turns 2 --output-format json --no-session-persistence > "$RESULTS/p2-last.json" 2>"$RESULTS/p2-last.err"; RC=$?
out "exit=$RC"; out "json keys: $(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(sorted(d.keys()))' "$RESULTS/p2-last.json" 2>/dev/null)"
out "is_error/subtype: $(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("is_error"), d.get("subtype"), str(d.get("result"))[:200])' "$RESULTS/p2-last.json" 2>/dev/null)"
out "stderr: $(head -c 300 "$RESULTS/p2-last.err")"
