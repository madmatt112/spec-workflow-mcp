#!/bin/bash
# Check 5: --json-schema returns a valid object for a reviewer-style verdict, three runs.
# PASS = structured_output present and valid on all three.
source "$(dirname "$0")/common.sh"; start p5-schema
SCHEMA='{"type":"object","required":["verdict","must_fix","should_fix","summary"],"properties":{"verdict":{"enum":["converged","iterate"]},"must_fix":{"type":"array","items":{"type":"string"}},"should_fix":{"type":"array","items":{"type":"string"}},"summary":{"type":"string","maxLength":300}},"additionalProperties":false}'
DOC="Requirement 1: the system shall respond. Requirement 2: users can do things quickly. Requirement 3: data is stored."
PASSES=0
for i in 1 2 3; do
  claude -p "Review these requirements for testability and give a verdict: $DOC" --model "$MODEL" --json-schema "$SCHEMA" --max-turns 2 --output-format json --no-session-persistence > "$RESULTS/p5-$i.json" 2>&1; RC=$?
  OK=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); s=d.get("structured_output"); print("yes" if isinstance(s,dict) and s.get("verdict") in ("converged","iterate") else "no")' "$RESULTS/p5-$i.json" 2>/dev/null)
  out "run $i exit=$RC structured_output_valid=$OK"; [ "$OK" = yes ] && PASSES=$((PASSES+1))
done
[ $PASSES = 3 ] && out "PASS 3/3" || out "FAIL $PASSES/3"
