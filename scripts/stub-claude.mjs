#!/usr/bin/env node
// scripts/stub-claude.mjs
//
// A stand-in `claude` for the controller's tests (docs/controller-tasks.md "T1").
// It never calls a model. It reads STUB_CLAUDE_SCRIPT, a JSON file listing canned
// runs in order, consumes one entry per invocation (a counter file next to the
// script), and prints the stream exactly as `claude -p --output-format
// stream-json --verbose` would: one JSON object per line, the final one the
// `result`. Point CONTROLLER_CLAUDE_BIN at this file to swap it in.
//
// Script shape (STUB_CLAUDE_SCRIPT): an array of runs, or `{ "runs": [ ... ] }`.
// Each run:
//   {
//     "stream":   [ <event objects> ],   // printed verbatim, in order
//     "result":   { ... },               // the final result object (type forced)
//     "exitCode": 0,                      // process exit code (default 0)
//     "delayMs":  0,                      // optional pause before emitting
//     "edits":    [ { "path": "rel/or/abs", "content": "..." } ],  // writes in cwd
//     "appends":  [ { "path": "rel/or/abs", "content": "..." } ]   // appends in cwd
//   }
// `appends` is how a stubbed supervisor writes its own ledger rows (the real
// supervisor appends phase.start/phase.end to harness-events.jsonl).
// If a run has no leading system/init event the stub prepends one; either way the
// init event is augmented with `env`, `argv` and `cwd` extras so tests can assert
// env scrubbing, that `--resume` was passed, and the cwd.

import { readFileSync, writeFileSync, renameSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';

function fail(message) {
  process.stderr.write(`stub-claude: ${message}\n`);
  process.exit(2);
}

const scriptPath = process.env.STUB_CLAUDE_SCRIPT;
if (!scriptPath) fail('STUB_CLAUDE_SCRIPT is not set');

let script;
try {
  script = JSON.parse(readFileSync(scriptPath, 'utf8'));
} catch (err) {
  fail(`cannot read STUB_CLAUDE_SCRIPT (${scriptPath}): ${err.message}`);
}
const runs = Array.isArray(script) ? script : Array.isArray(script?.runs) ? script.runs : null;
if (!runs) fail('STUB_CLAUDE_SCRIPT must be an array of runs or { runs: [...] }');

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
  // Past the end of the script: behave like an errored run rather than crash.
  const result = {
    type: 'result',
    subtype: 'error_during_execution',
    is_error: true,
    num_turns: 0,
    session_id: argvValue('--session-id') || argvValue('--resume') || 'stub-exhausted',
    result: `stub-claude: no run at index ${index}`,
    structured_output: null,
    usage: {},
    duration_ms: 0,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(1);
}

function argvValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

// Perform any file edits in the cwd.
for (const edit of run.edits ?? []) {
  const target = isAbsolute(edit.path) ? edit.path : join(process.cwd(), edit.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, edit.content ?? '');
}

// Append to any files in the cwd (e.g. a stubbed supervisor's ledger rows).
for (const add of run.appends ?? []) {
  const target = isAbsolute(add.path) ? add.path : join(process.cwd(), add.path);
  mkdirSync(dirname(target), { recursive: true });
  appendFileSync(target, add.content ?? '');
}

async function main() {
  if (run.delayMs) {
    await new Promise((r) => setTimeout(r, run.delayMs));
  }

  const argv = process.argv.slice(2);
  const sessionId = argvValue('--session-id') || argvValue('--resume') || 'stub-session';
  const model = argvValue('--model') || 'stub-model';
  const allowed = argvValue('--allowedTools');
  const stubExtras = { env: { ...process.env }, argv, cwd: process.cwd() };

  const events = Array.isArray(run.stream) ? run.stream.slice() : [];
  const first = events[0];
  if (first && first.type === 'system' && first.subtype === 'init') {
    events[0] = { ...first, ...stubExtras };
  } else {
    events.unshift({
      type: 'system',
      subtype: 'init',
      session_id: sessionId,
      model,
      cwd: process.cwd(),
      permissionMode: argvValue('--permission-mode') || 'default',
      tools: allowed ? allowed.split(',') : [],
      ...stubExtras,
    });
  }

  for (const event of events) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
  if (run.result) {
    process.stdout.write(`${JSON.stringify({ ...run.result, type: 'result' })}\n`);
  }

  await new Promise((resolve) => process.stdout.write('', resolve));
  process.exit(typeof run.exitCode === 'number' ? run.exitCode : 0);
}

main();
