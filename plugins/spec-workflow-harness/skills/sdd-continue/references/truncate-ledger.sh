#!/bin/bash
# SDD ledger truncate-on-resume helper (retro P4, option A).
#
# usage: bash truncate-ledger.sh LEDGER_PATH
# On resume, trim harness-events.jsonl back to its last COMPLETE line: drop a trailing
# partial line (bytes after the last newline, which a crashed write leaves) and any trailing
# NUL run, so the next append starts on a clean line boundary. It keeps the run id and every
# complete line, and never changes an already-clean file. A missing file is a no-op. The
# node body sits in a single-quoted string with no apostrophes, the same way
# harness/hooks/sdd-activity.sh does.
set -u
LEDGER="${1:-}"
[ -n "$LEDGER" ] || { echo "truncate-ledger: need a ledger path" >&2; exit 2; }
[ -f "$LEDGER" ] || exit 0
LEDGER="$LEDGER" node -e '
const fs = require("fs");
const p = process.env.LEDGER;
let buf;
try { buf = fs.readFileSync(p); } catch { process.exit(0); }
// Strip a trailing NUL run a torn write can leave, then keep up to and including the last
// newline; any bytes after it are an incomplete final line. event.sh always ends a complete
// row with a newline, so a missing trailing newline marks a torn write.
let end = buf.length;
while (end > 0 && buf[end - 1] === 0) end--;
const nl = buf.lastIndexOf(10, end - 1);
const keep = nl >= 0 ? nl + 1 : 0;
if (keep !== buf.length) fs.writeFileSync(p, buf.subarray(0, keep));
process.stdout.write("truncate-ledger: kept " + keep + " of " + buf.length + " bytes\n");
'
