#!/bin/bash
# Check 6: stream-json carries enough to show a "current tool" line live. PASS = tool_use
# events with tool names appear in order in the stream.
source "$(dirname "$0")/common.sh"; start p6-stream
W=$(mktemp -d); cd "$W"; echo "alpha" > a.txt
claude -p "Read a.txt, then run the shell command: echo beta, then reply done." --model "$MODEL" --allowedTools "Read,Bash(echo:*)" --permission-mode dontAsk --permission-prompts none \
  --max-turns 6 --output-format stream-json --verbose --no-session-persistence > "$RESULTS/p6-stream.jsonl" 2>"$RESULTS/p6.err"; out "exit=$?"
out "event types: $(python3 -c '
import json,sys
seen=[]
for l in open(sys.argv[1]):
    try: d=json.loads(l)
    except: continue
    t=d.get("type")
    if t=="assistant":
        for c in d.get("message",{}).get("content",[]):
            if c.get("type")=="tool_use": seen.append("tool_use:"+c.get("name",""))
    elif t: seen.append(t)
print(" ".join(seen))' "$RESULTS/p6-stream.jsonl")"
grep -q '"name": *"Read"' "$RESULTS/p6-stream.jsonl" && grep -q '"name": *"Bash"' "$RESULTS/p6-stream.jsonl" && out "PASS tool names visible in the stream" || out "FAIL (see p6-stream.jsonl)"
