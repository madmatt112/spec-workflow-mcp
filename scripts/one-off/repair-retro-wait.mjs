#!/usr/bin/env -S npx tsx
// One-off: re-parse a retrospective-proposals file with the current parser and
// rewrite the question list of an open `retro-plan` wait record in place,
// keeping the record's id, kind, state, proposals and any existing answers.
//
// Usage:
//   npx tsx scripts/one-off/repair-retro-wait.mjs <wait.json> <retrospective-proposals.md>
//
// It touches only `questions`. Run it against an open wait whose questions were
// written by the old parser (truncated decision text, no options). The dashboard
// picks up the rewritten record on its next `controller-waits` push; nothing
// needs restarting.
import { readFileSync, writeFileSync } from 'fs';
import { parseProposals, proposalWaitQuestions } from '../../src/controller/runs.ts';

const [waitPath, proposalsPath] = process.argv.slice(2);
if (!waitPath || !proposalsPath) {
  console.error('usage: repair-retro-wait.mjs <wait.json> <proposals.md>');
  process.exit(2);
}

const record = JSON.parse(readFileSync(waitPath, 'utf-8'));
if (record.kind !== 'retro-plan') {
  console.error(`refusing: ${waitPath} is kind "${record.kind}", not "retro-plan"`);
  process.exit(1);
}
if (record.state && record.state !== 'open') {
  console.error(`refusing: wait ${record.id} is "${record.state}", not open`);
  process.exit(1);
}

const proposals = parseProposals(readFileSync(proposalsPath, 'utf-8'));
record.questions = proposalWaitQuestions(proposals);

writeFileSync(waitPath, JSON.stringify(record, null, 2) + '\n', 'utf-8');

console.log(`rewrote ${record.questions.length} questions on ${record.id} (state: ${record.state})`);
for (const q of record.questions) {
  if (q.id.startsWith('proposal:')) continue;
  console.log(`\n[${q.id}] ${q.text}`);
  if (q.options) {
    for (const o of q.options) {
      console.log(`   - ${o}${o === q.recommended ? '  (recommended)' : ''}`);
    }
  } else {
    console.log('   (free text)');
  }
}
