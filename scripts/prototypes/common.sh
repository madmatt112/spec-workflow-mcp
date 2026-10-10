#!/bin/bash
# Shared helpers. Scrub API keys so every call bills the subscription (authentication docs:
# ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN win silently over /login).
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
RESULTS="$HERE/results"
mkdir -p "$RESULTS"
MODEL="${PROTO_MODEL:-claude-sonnet-5-5}"
out() { echo "$@" | tee -a "$RESULT_FILE"; }
start() { RESULT_FILE="$RESULTS/$1.txt"; : > "$RESULT_FILE"; out "== $1 == $(date -Is)"; }
