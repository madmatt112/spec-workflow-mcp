#!/usr/bin/env node
// scripts/stub-gh.mjs
//
// A stand-in `gh` for the controller's discard test (docs/controller-tasks.md
// "T6"), the same shape as scripts/stub-claude.mjs. It never calls GitHub: it
// appends its argv (one JSON array per line) to STUB_GH_LOG so a test can assert
// `gh pr close ...` was invoked, and exits 0. Point CONTROLLER_GH_BIN at it.
import { appendFileSync } from 'node:fs';

const log = process.env.STUB_GH_LOG;
if (log) {
  try {
    appendFileSync(log, JSON.stringify(process.argv.slice(2)) + '\n');
  } catch {
    // Best effort: a missing log directory is not the test's concern.
  }
}
process.exit(0);
