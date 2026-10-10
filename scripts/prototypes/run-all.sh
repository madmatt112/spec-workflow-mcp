#!/bin/bash
# Runs checks 1, 3, 4, 5, 6 (check 2 is a capture wrapper for when a usage limit is near).
HERE=$(cd "$(dirname "$0")" && pwd -P)
for s in p1-persona p3-resume p4-service p5-schema p6-stream; do echo; echo "### $s"; bash "$HERE/$s.sh"; done
echo; echo "Results in $HERE/results/. Paste the *.txt files (not the .json) to the session."
