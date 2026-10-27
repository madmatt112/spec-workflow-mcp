#!/usr/bin/env node
// Stand-in `claude` for cli.test.ts's interactive-session criteria (task 16;
// design.md C10). Unlike scripts/stub-claude.mjs — built for a headless `-p`
// stream, read back over stdout — this process is spawned with stdio
// inherited (the real cli.ts's own choice), so its stdout is not capturable
// from the parent test. It reports the one thing the test needs — the argv
// and cwd it was actually spawned with — by writing them to STUB_ARGV_OUT
// instead, then stays alive (standing in for the interactive session) until
// STUB_ALIVE_MS elapses or it is sent SIGTERM/SIGINT, whichever is first, so
// the test controls exactly when the "conversation" ends.
import { writeFileSync } from 'node:fs';

const outPath = process.env.STUB_ARGV_OUT;
if (!outPath) {
  process.stderr.write('stub-interactive-claude: STUB_ARGV_OUT is not set\n');
  process.exit(2);
}

writeFileSync(outPath, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));

const aliveMs = Number(process.env.STUB_ALIVE_MS || 500);
const timer = setTimeout(() => process.exit(0), aliveMs);

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    clearTimeout(timer);
    process.exit(0);
  });
}
