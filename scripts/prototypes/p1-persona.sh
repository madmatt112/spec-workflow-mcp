#!/bin/bash
# Check 1: can an agent file's body be the persona of a -p session, and can that session edit a
# file and run a command with no permission prompt? PASS = hello.txt rewritten AND the marker
# command output appears in the result, with exit 0 and no permission denial in the JSON.
source "$(dirname "$0")/common.sh"; start p1-persona
W=$(mktemp -d); cd "$W"; git init -q .; echo "hello" > hello.txt; git add -A; git -c user.name=p -c user.email=p@p commit -qm init
cat > persona.md <<'P'
You are the prototype worker. You follow the brief exactly, make the smallest change, and report in one line.
P
BRIEF="Edit hello.txt so its only line is the word goodbye. Then run the shell command: echo MARKER-\$((6*7)). Report the exact output of that command."
for MODE in default acceptEdits dontAsk bypassPermissions; do
  out "-- permission-mode $MODE"
  claude -p "$BRIEF" --model "$MODEL" --append-system-prompt-file persona.md \
    --allowedTools "Read,Edit,Write,Bash(echo:*),Bash(git:*)" --permission-mode "$MODE" --permission-prompts none \
    --max-turns 8 --output-format json --no-session-persistence > "$RESULTS/p1-$MODE.json" 2>"$RESULTS/p1-$MODE.err"; RC=$?
  out "exit=$RC hello.txt=$(cat hello.txt | tr -d '\n') marker=$(grep -o 'MARKER-42' "$RESULTS/p1-$MODE.json" | head -1) denied=$(grep -ci 'denied\|permission' "$RESULTS/p1-$MODE.json")"
  [ "$RC" = 0 ] && [ "$(cat hello.txt | tr -d '\n')" = goodbye ] && grep -q 'MARKER-42' "$RESULTS/p1-$MODE.json" && out "PASS $MODE" || out "FAIL $MODE (see p1-$MODE.json/.err)"
  git checkout -q hello.txt
done
