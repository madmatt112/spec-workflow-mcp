#!/bin/bash
# Check 3: --resume <session-id> from a different parent process continues the step with its
# context. PASS = the second call, run under setsid from a fresh shell, repeats the nonce the
# first call was told.
source "$(dirname "$0")/common.sh"; start p3-resume
W=$(mktemp -d); cd "$W"; SID=$(python3 -c 'import uuid; print(uuid.uuid4())'); NONCE="nonce-$RANDOM$RANDOM"
claude -p "Remember this token and reply only with the word stored: $NONCE" --model "$MODEL" --session-id "$SID" --max-turns 1 --output-format json > "$RESULTS/p3-first.json" 2>&1; out "first exit=$? sid=$SID"
sleep 3
setsid bash -c "cd '$W' && claude -p 'Reply with only the token you were told to remember.' --model '$MODEL' --resume '$SID' --max-turns 1 --output-format json" > "$RESULTS/p3-second.json" 2>&1; out "second exit=$?"
grep -q "$NONCE" "$RESULTS/p3-second.json" && out "PASS resume kept context ($NONCE)" || out "FAIL (see p3-second.json)"
