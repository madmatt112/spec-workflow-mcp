#!/usr/bin/env node
// scripts/stub-gh.mjs
//
// A stand-in `gh` for the controller's merge tests (docs/controller-tasks.md
// "T7 `merge`") and the discard test ("T6"). It never talks to GitHub. With
// STUB_GH_SCRIPT unset it only appends argv to STUB_GH_LOG and exits 0 (T6).
// Otherwise it reads STUB_GH_SCRIPT, a JSON file
// listing canned responses in order, consumes one entry per invocation (a
// counter file next to the script), records every invocation's argv (an
// `.argv` sidecar, one JSON array per line) so a test can assert which `gh`
// commands ran, and prints the entry's stdout. Point CONTROLLER_GH_BIN at this
// file to swap it in.
//
// Script shape (STUB_GH_SCRIPT): an array of responses, or `{ "runs": [ ... ] }`.
// Each response:
//   {
//     "argvIncludes": ["pr", "merge"],  // optional: every string must be in argv
//     "stdout":   "..." | { ... },       // string printed verbatim, object JSON-stringified
//     "stderr":   "...",                 // optional
//     "exitCode": 0                      // process exit code (default 0)
//   }

import { readFileSync, writeFileSync, renameSync, appendFileSync } from 'node:fs';

function fail(message) {
  process.stderr.write(`stub-gh: ${message}\n`);
  process.exit(2);
}

const scriptPath = process.env.STUB_GH_SCRIPT;
if (!scriptPath) {
  // No script (the T6 discard test): record argv to STUB_GH_LOG if set, exit 0.
  const log = process.env.STUB_GH_LOG;
  if (log) {
    try { appendFileSync(log, JSON.stringify(process.argv.slice(2)) + '\n'); } catch { /* best effort */ }
  }
  process.exit(0);
}

let script;
try {
  script = JSON.parse(readFileSync(scriptPath, 'utf8'));
} catch (err) {
  fail(`cannot read STUB_GH_SCRIPT (${scriptPath}): ${err.message}`);
}
const runs = Array.isArray(script) ? script : Array.isArray(script?.runs) ? script.runs : null;
if (!runs) fail('STUB_GH_SCRIPT must be an array of responses or { runs: [...] }');

const argv = process.argv.slice(2);
// Record this invocation's argv for the test to assert on.
appendFileSync(`${scriptPath}.argv`, JSON.stringify(argv) + '\n');

// One entry per invocation, tracked in a counter file next to the script.
const counterPath = `${scriptPath}.counter`;
let index = 0;
try {
  index = Number.parseInt(readFileSync(counterPath, 'utf8').trim(), 10) || 0;
} catch {
  index = 0;
}
const tmp = `${counterPath}.${process.pid}.tmp`;
writeFileSync(tmp, String(index + 1));
renameSync(tmp, counterPath);

const run = runs[index];
if (!run) {
  process.stderr.write(`stub-gh: no response at index ${index} for argv ${JSON.stringify(argv)}\n`);
  process.exit(1);
}

if (Array.isArray(run.argvIncludes)) {
  for (const needle of run.argvIncludes) {
    if (!argv.includes(needle)) {
      process.stderr.write(
        `stub-gh: response ${index} expected argv to include ${JSON.stringify(needle)}; got ${JSON.stringify(argv)}\n`,
      );
      process.exit(3);
    }
  }
}

const out = typeof run.stdout === 'string' ? run.stdout : run.stdout !== undefined ? JSON.stringify(run.stdout) : '';
if (out) process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
if (typeof run.stderr === 'string' && run.stderr) process.stderr.write(run.stderr);

process.exit(typeof run.exitCode === 'number' ? run.exitCode : 0);
